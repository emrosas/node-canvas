import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadMap } from '../src/load.mjs'
import { applyCallouts, forAudience, renderHtml } from '../src/render.mjs'

async function makeMap(files) {
  const dir = await mkdtemp(join(tmpdir(), 'node-canvas-'))
  for (const [name, text] of Object.entries(files)) {
    await mkdir(join(dir, name, '..'), { recursive: true })
    await writeFile(join(dir, name), text)
  }
  return dir
}

const MAP = `---
title: Test
columns: [a, b]
rows: [r]
---
About text.
`

test('loads notes and resolves links', async () => {
  const dir = await makeMap({
    'map.md': MAP,
    'one.md': '---\ntitle: One\ncolumn: a\nrow: r\nstatus: done\nlinks:\n  - { to: two, label: Next }\n---\nBody',
    'nested/two.md': '---\ntitle: Two\ncolumn: b\nrow: r\n---\nSee [[one]].',
  })
  const graph = await loadMap(dir)
  assert.deepEqual(graph.problems, [])
  assert.equal(graph.nodes.length, 2)
  assert.deepEqual(graph.edges.map((e) => [e.from, e.to, e.kind]), [['one', 'two', 'flow']])
  assert.equal(graph.nodes.find((n) => n.id === 'one').facets.status, 'done')
})

test('reports unknown columns, facet values and broken links', async () => {
  const dir = await makeMap({
    'map.md': MAP,
    'bad.md': '---\ncolumn: z\nrow: r\nstatus: nope\nlinks: [ghost]\n---\n[[missing]]',
  })
  const { problems } = await loadMap(dir)
  const messages = problems.map((p) => `${p.level}: ${p.message}`).join('\n')
  assert.match(messages, /error: column "z"/)
  assert.match(messages, /error: status: "nope"/)
  assert.match(messages, /error: links\[0\] points at "ghost"/)
  assert.match(messages, /warning: \[\[missing\]\]/)
})

test('client builds drop internal blocks, internal notes and file paths', async () => {
  const dir = await makeMap({
    'map.md': MAP,
    'public.md': '---\ncolumn: a\nrow: r\nlinks: [secret]\n---\nShared.\n\n:::internal\nSECRET CODE PATH\n:::\n',
    'secret.md': '---\ncolumn: b\nrow: r\naudience: internal\n---\nHidden note.',
  })
  const graph = await loadMap(dir)
  const client = forAudience(graph, 'client')
  assert.deepEqual(client.nodes.map((n) => n.id), ['public'])
  assert.equal(client.edges.length, 0)
  assert.equal(client.nodes[0].file, undefined)
  const html = await renderHtml(graph, 'client')
  assert.ok(!html.includes('SECRET CODE PATH'))
  assert.ok(!html.includes('Hidden note'))
  const internal = await renderHtml(graph, 'internal')
  assert.ok(internal.includes('SECRET CODE PATH'))
})

test('callouts nest and keep their titles', () => {
  const out = applyCallouts(':::conflict Two sources\nA\n:::internal\nB\n:::\n:::', 'client')
  assert.match(out, /callout-conflict/)
  assert.match(out, /Two sources/)
  assert.ok(!out.includes('B'))
})

test('note text cannot close the data script early', async () => {
  const dir = await makeMap({
    'map.md': MAP,
    'x.md': '---\ncolumn: a\nrow: r\n---\n</script><script>alert(1)</script>',
  })
  const html = await renderHtml(await loadMap(dir), 'internal')
  const dataBlock = html.split('id="map-data">')[1].split('</script>')[0]
  assert.ok(dataBlock.includes('<\\/script>'))
})
