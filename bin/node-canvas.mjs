#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { loadMap } from '../src/load.mjs'
import { renderHtml, roughLayout, toJsonCanvas } from '../src/render.mjs'
import { serve } from '../src/dev.mjs'

const HELP = `node-canvas: Markdown notes in, canvas map out.

Usage
  node-canvas check <map-dir>             Validate notes and links
  node-canvas build <map-dir> [options]   Write the HTML maps
  node-canvas dev   <map-dir> [--port n]  Serve with live reload

Build options
  --out <file>       Internal map (default: <map-dir>.html)
  --client <file>    Client map with internal notes removed
                     (default: <map-dir>.client.html)
  --no-client        Skip the client map
  --canvas           Also write <map-dir>.canvas (JSON Canvas 1.0)
  --json             Also write <map-dir>.json (the resolved graph)
`

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    client: { type: 'string' },
    'no-client': { type: 'boolean' },
    canvas: { type: 'boolean' },
    json: { type: 'boolean' },
    port: { type: 'string', default: '4321' },
    help: { type: 'boolean', short: 'h' },
  },
})

const [command, dirArg] = positionals
if (values.help || !command || !dirArg) {
  console.log(HELP)
  process.exit(command ? 1 : 0)
}

const dir = resolve(dirArg)
const base = resolve(dirname(dir), basename(dir))

function report(problems) {
  for (const p of problems) {
    const tag = p.level === 'error' ? 'error' : 'warn '
    console.error(`${tag}  ${p.file}  ${p.message}`)
  }
  return problems.filter((p) => p.level === 'error').length
}

async function write(file, content) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, content)
  console.log(`wrote ${file}`)
}

if (command === 'check') {
  const graph = await loadMap(dir)
  const errors = report(graph.problems)
  console.log(
    `${graph.nodes.length} notes, ${graph.edges.length} links, ${errors} errors`,
  )
  process.exit(errors ? 1 : 0)
} else if (command === 'build') {
  const graph = await loadMap(dir)
  if (report(graph.problems)) process.exit(1)
  const internalOut = resolve(values.out ?? `${base}.html`)
  const clientOut = resolve(values.client ?? `${base}.client.html`)
  const withClient = !values['no-client']
  const views = withClient
    ? { internal: '', client: relative(dirname(internalOut), clientOut) }
    : {}
  await write(internalOut, await renderHtml(graph, 'internal', { views }))
  if (withClient) await write(clientOut, await renderHtml(graph, 'client'))
  if (values.canvas) {
    const canvas = toJsonCanvas(graph, roughLayout(graph))
    await write(`${base}.canvas`, JSON.stringify(canvas, null, 2))
  }
  if (values.json) {
    const { map, nodes, edges } = graph
    await write(`${base}.json`, JSON.stringify({ map, nodes, edges }, null, 2))
  }
} else if (command === 'dev') {
  await serve(dir, Number(values.port))
} else {
  console.log(HELP)
  process.exit(1)
}
