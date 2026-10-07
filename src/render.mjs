// Turns a loaded map into a single self-contained HTML file.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Marked } from 'marked'

const viewerDir = fileURLToPath(new URL('./viewer/', import.meta.url))

const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  )

/**
 * `:::type` ... `:::` fences become callouts. `:::internal` blocks are
 * dropped from the client build, so working notes never reach the client.
 */
export function applyCallouts(markdown, audience) {
  const lines = markdown.split('\n')
  const out = []
  const stack = []
  for (const line of lines) {
    const open = line.match(/^:::\s*([\w-]+)\s*(.*)$/)
    if (open) {
      const [, type, title] = open
      const hidden =
        stack.some((s) => s.hidden) ||
        (type === 'internal' && audience === 'client')
      stack.push({ type, hidden })
      if (!hidden) {
        const heading = title ? `<p class="callout-title">${escapeHtml(title)}</p>` : ''
        out.push('', `<div class="callout callout-${type}">${heading}`, '')
      }
      continue
    }
    if (/^:::\s*$/.test(line) && stack.length) {
      const closed = stack.pop()
      if (!closed.hidden) out.push('', '</div>', '')
      continue
    }
    if (!stack.some((s) => s.hidden)) out.push(line)
  }
  return out.join('\n')
}

export function linkNotes(markdown, titles) {
  return markdown.replace(
    /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g,
    (_, id, text) => {
      const key = id.trim()
      const label = text?.trim() || titles.get(key) || key
      return `<a class="note-link" href="#n=${encodeURIComponent(key)}" data-node="${escapeHtml(key)}">${escapeHtml(label)}</a>`
    },
  )
}

export function renderMarkdown(markdown, { audience, titles }) {
  const marked = new Marked({ gfm: true })
  return marked.parse(linkNotes(applyCallouts(markdown, audience), titles))
}

/** Strip a graph down to what one audience may see. */
export function forAudience(graph, audience) {
  const visible = graph.nodes.filter(
    (n) => n.audience === 'all' || n.audience === audience,
  )
  const ids = new Set(visible.map((n) => n.id))
  const titles = new Map(visible.map((n) => [n.id, n.title]))
  return {
    map: {
      ...graph.map,
      audience,
      audienceLabel: graph.map.audiences?.[audience] ?? audience,
      aboutHtml: renderMarkdown(graph.map.body, { audience, titles }),
      body: undefined,
    },
    nodes: visible.map(({ body, links, ...node }) => ({
      ...node,
      file: audience === 'client' ? undefined : node.file,
      html: renderMarkdown(body, { audience, titles }),
      text: applyCallouts(body, audience)
        .replace(/<[^>]+>|[#*_`>\[\]|:-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    })),
    edges: graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
  }
}

export async function renderHtml(graph, audience, { dev = false } = {}) {
  const data = forAudience(graph, audience)
  const [template, css, js] = await Promise.all([
    readFile(viewerDir + 'template.html', 'utf8'),
    readFile(viewerDir + 'viewer.css', 'utf8'),
    readFile(viewerDir + 'viewer.js', 'utf8'),
  ])
  // `</` inside the JSON would end the script element early.
  const json = JSON.stringify(data).replace(/<\//g, '<\\/')
  const reload = dev
    ? `<script>new EventSource('/__reload').onmessage = () => location.reload()</script>`
    : ''
  const title = data.map.client
    ? `${data.map.title} · ${data.map.client}`
    : data.map.title
  return template
    .replace('{{title}}', () => escapeHtml(title))
    .replace('{{css}}', () => css)
    .replace('{{data}}', () => json)
    .replace('{{js}}', () => js)
    .replace('{{reload}}', () => reload)
}

/** JSON Canvas 1.0 export, so a map also opens in Obsidian and friends. */
export function toJsonCanvas(graph, layout) {
  const colors = { green: '4', blue: '5', violet: '6', red: '1', orange: '2', amber: '3' }
  const facet = graph.map.facets.find((f) => f.id === graph.map.defaultFacet)
  return {
    nodes: graph.nodes.map((n) => {
      const pos = layout.get(n.id)
      const value = facet?.values.find((v) => v.id === n.facets[facet.id])
      return {
        id: n.id,
        type: 'text',
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        ...(value && colors[value.color] ? { color: colors[value.color] } : {}),
        text: `## ${n.title}\n\n${n.body.trim()}`,
      }
    }),
    edges: graph.edges.map((e) => ({
      id: e.id,
      fromNode: e.from,
      toNode: e.to,
      ...(e.label ? { label: e.label } : {}),
    })),
  }
}

/**
 * A rough grid layout for exports that cannot measure DOM heights.
 * The browser viewer does its own measured layout.
 */
export function roughLayout(graph) {
  const { columns, rows } = graph.map
  const layout = new Map()
  const W = 260
  const H = 140
  if (!columns.length || !rows.length) {
    for (const n of graph.nodes)
      layout.set(n.id, { x: n.x, y: n.y, width: W, height: H })
    return layout
  }
  const colIndex = new Map(columns.map((c, i) => [c.id, i]))
  const cells = new Map()
  for (const n of [...graph.nodes].sort((a, b) => a.order - b.order)) {
    const key = `${n.column}|${n.row}`
    if (!cells.has(key)) cells.set(key, [])
    cells.get(key).push(n)
  }
  let y = 0
  for (const row of rows) {
    let tallest = 1
    for (const col of columns) {
      const stack = cells.get(`${col.id}|${row.id}`) ?? []
      stack.forEach((n, i) =>
        layout.set(n.id, {
          x: colIndex.get(col.id) * (W + 60),
          y: y + i * (H + 20),
          width: W,
          height: H,
        }),
      )
      tallest = Math.max(tallest, stack.length)
    }
    y += tallest * (H + 20) + 80
  }
  return layout
}
