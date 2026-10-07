// Reads a map folder into one resolved graph. The folder is the source of
// truth: `map.md` holds the map's settings, every other `.md` file is a note.
import { readFile, readdir } from 'node:fs/promises'
import { basename, extname, join, relative } from 'node:path'
import { parse as parseYaml } from 'yaml'

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
const SKIP_FILES = new Set(['README.md', 'AGENTS.md', 'CLAUDE.md'])
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git'])
const IMAGE_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

export const DEFAULT_EDGE_KINDS = {
  flow: { label: 'Moves to', style: 'solid', color: 'ink' },
  data: { label: 'Creates or carries', style: 'dashed', color: 'blue' },
  gap: { label: 'Breaks here', style: 'dashed', color: 'red' },
  planned: { label: 'Planned link', style: 'dotted', color: 'gray' },
}

export const DEFAULT_FACETS = [
  {
    id: 'status',
    title: 'Status',
    values: [
      { id: 'done', label: 'Done', color: 'green' },
      { id: 'doing', label: 'In progress', color: 'blue' },
      { id: 'planned', label: 'Planned', color: 'violet' },
      { id: 'blocked', label: 'Blocked', color: 'red' },
      { id: 'unknown', label: 'Unknown', color: 'gray' },
    ],
  },
]

export function splitFrontmatter(text, file) {
  const match = text.match(FRONTMATTER)
  if (!match) return { data: {}, body: text }
  let data
  try {
    data = parseYaml(match[1]) ?? {}
  } catch (error) {
    throw new Error(`${file}: frontmatter is not valid YAML. ${error.message}`)
  }
  return { data, body: match[2] }
}

async function listNotes(dir, root = dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...(await listNotes(path, root)))
    } else if (entry.name.endsWith('.md') && !SKIP_FILES.has(entry.name)) {
      out.push(relative(root, path))
    }
  }
  return out.sort()
}

const asList = (value) =>
  value == null ? [] : Array.isArray(value) ? value : [value]

function normaliseLink(link) {
  if (typeof link === 'string') return { to: link }
  return link
}

/**
 * Load and validate a map folder.
 * Returns `{ map, nodes, edges, problems }`. `problems` holds
 * `{ level: 'error' | 'warning', file, message }` entries; the CLI decides
 * whether they stop the build.
 */
export async function loadMap(dir) {
  const problems = []
  const files = await listNotes(dir)
  if (!files.includes('map.md')) {
    throw new Error(`${dir}: no map.md. Every map folder needs one.`)
  }

  const mapText = await readFile(join(dir, 'map.md'), 'utf8')
  const { data: mapData, body: mapBody } = splitFrontmatter(mapText, 'map.md')

  const map = {
    title: mapData.title ?? basename(dir),
    subtitle: mapData.subtitle ?? '',
    client: mapData.client ?? '',
    updated: mapData.updated ? String(mapData.updated) : '',
    columns: asList(mapData.columns).map((c) =>
      typeof c === 'string' ? { id: c, title: c } : c,
    ),
    rows: asList(mapData.rows).map((r) =>
      typeof r === 'string' ? { id: r, title: r } : r,
    ),
    facets: mapData.facets ?? DEFAULT_FACETS,
    defaultFacet: mapData.defaultFacet,
    edgeKinds: { ...DEFAULT_EDGE_KINDS, ...(mapData.edgeKinds ?? {}) },
    audiences: mapData.audiences ?? { internal: 'Internal', client: 'Client' },
    theme: mapData.theme ?? {},
    body: mapBody,
  }
  map.defaultFacet ??= map.facets[0]?.id

  if (map.theme.logo) {
    const file = String(map.theme.logo)
    try {
      const bytes = await readFile(join(dir, file))
      const ext = extname(file).toLowerCase()
      if (ext === '.svg') {
        map.theme.logoSvg = bytes.toString('utf8')
      } else if (IMAGE_TYPES[ext]) {
        map.theme.logoSrc = `data:${IMAGE_TYPES[ext]};base64,${bytes.toString('base64')}`
      } else {
        problems.push({
          level: 'error',
          file: 'map.md',
          message: `theme.logo "${file}" must be .svg, .png, .jpg or .webp`,
        })
      }
    } catch {
      problems.push({
        level: 'error',
        file: 'map.md',
        message: `theme.logo "${file}" not found next to map.md`,
      })
    }
  }

  const columnIds = new Set(map.columns.map((c) => c.id))
  const rowIds = new Set(map.rows.map((r) => r.id))
  const facetById = new Map(map.facets.map((f) => [f.id, f]))
  const grid = map.columns.length > 0 && map.rows.length > 0

  const nodes = []
  const seen = new Map()
  for (const file of files) {
    if (file === 'map.md') continue
    const text = await readFile(join(dir, file), 'utf8')
    const { data, body } = splitFrontmatter(text, file)
    const id = String(data.id ?? basename(file, '.md'))
    if (seen.has(id)) {
      problems.push({
        level: 'error',
        file,
        message: `id "${id}" is already used by ${seen.get(id)}`,
      })
      continue
    }
    seen.set(id, file)

    const facets = {}
    for (const facet of map.facets) {
      const value = data[facet.id]
      if (value == null) continue
      if (!facet.values.some((v) => v.id === String(value))) {
        problems.push({
          level: 'error',
          file,
          message: `${facet.id}: "${value}" is not one of ${facet.values.map((v) => v.id).join(', ')}`,
        })
        continue
      }
      facets[facet.id] = String(value)
    }

    if (grid) {
      if (!data.column || !columnIds.has(data.column)) {
        problems.push({
          level: 'error',
          file,
          message: `column "${data.column}" is not a column in map.md`,
        })
      }
      if (!data.row || !rowIds.has(data.row)) {
        problems.push({
          level: 'error',
          file,
          message: `row "${data.row}" is not a row in map.md`,
        })
      }
    } else if (data.x == null || data.y == null) {
      problems.push({
        level: 'error',
        file,
        message: 'map.md has no columns and rows, so every note needs x and y',
      })
    }

    nodes.push({
      id,
      file,
      title: data.title ?? id,
      kind: data.kind ?? '',
      summary: data.summary ?? '',
      column: data.column,
      row: data.row,
      order: data.order ?? 0,
      x: data.x,
      y: data.y,
      audience: data.audience ?? 'all',
      facets,
      attention: asList(data.attention).map(String),
      sources: asList(data.sources).map(String),
      links: asList(data.links).map(normaliseLink),
      body,
    })
  }

  for (const facet of map.facets) {
    if (!facetById.get(facet.id)?.values?.length) {
      problems.push({
        level: 'error',
        file: 'map.md',
        message: `facet "${facet.id}" has no values`,
      })
    }
  }

  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges = []
  for (const node of nodes) {
    node.links.forEach((link, i) => {
      if (!link.to || !nodeIds.has(String(link.to))) {
        problems.push({
          level: 'error',
          file: node.file,
          message: `links[${i}] points at "${link.to}", which is not a note`,
        })
        return
      }
      const kind = link.kind ?? 'flow'
      if (!map.edgeKinds[kind]) {
        problems.push({
          level: 'error',
          file: node.file,
          message: `links[${i}] kind "${kind}" is not one of ${Object.keys(map.edgeKinds).join(', ')}`,
        })
        return
      }
      edges.push({
        id: `${node.id}->${link.to}#${i}`,
        from: node.id,
        to: String(link.to),
        label: link.label ?? '',
        kind,
        note: link.note ?? '',
      })
    })
  }

  for (const node of nodes) {
    for (const match of node.body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
      if (!nodeIds.has(match[1].trim())) {
        problems.push({
          level: 'warning',
          file: node.file,
          message: `[[${match[1]}]] does not match any note id`,
        })
      }
    }
  }

  return { map, nodes, edges, problems }
}
