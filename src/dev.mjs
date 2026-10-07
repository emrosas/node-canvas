// Dev server: rebuilds on every request and tells open tabs to reload when a
// note changes. `/` is the internal map, `/client` the client map.
import { watch } from 'node:fs'
import { createServer } from 'node:http'
import { loadMap } from './load.mjs'
import { renderHtml } from './render.mjs'

export async function serve(dir, port) {
  const listeners = new Set()

  watch(dir, { recursive: true }, (_, file) => {
    if (!file?.endsWith('.md')) return
    for (const res of listeners) res.write('data: reload\n\n')
  })

  const viewerDir = new URL('./viewer/', import.meta.url)
  watch(viewerDir, () => {
    for (const res of listeners) res.write('data: reload\n\n')
  })

  createServer(async (req, res) => {
    if (req.url === '/__reload') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      })
      listeners.add(res)
      req.on('close', () => listeners.delete(res))
      return
    }
    if (req.url === '/favicon.ico') return res.writeHead(404).end()
    const audience = req.url.startsWith('/client') ? 'client' : 'internal'
    try {
      const graph = await loadMap(dir)
      const errors = graph.problems.filter((p) => p.level === 'error')
      if (errors.length) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        res.end(errors.map((p) => `${p.file}  ${p.message}`).join('\n'))
        return
      }
      const html = await renderHtml(graph, audience, { dev: true })
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(html)
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(String(error.stack ?? error))
    }
  }).listen(port, () => {
    console.log(`node-canvas dev: http://localhost:${port}  (client view: /client)`)
  })
}
