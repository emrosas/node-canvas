// node-canvas viewer. No dependencies: reads the JSON the build embedded,
// lays notes out on a grid, draws links as SVG curves, and handles pan, zoom,
// filters, search and the slide-over panel.
;(() => {
  const data = JSON.parse(document.getElementById('map-data').textContent)
  const { map, nodes, edges } = data

  const NODE_W = 236
  const COL_GAP = 52
  const COL_W = NODE_W + COL_GAP
  const LEFT = 24
  const STRIP = 34
  const TOP = 56
  const ROW_PAD = 26
  const STACK_GAP = 14
  const MIN_K = 0.2
  const MAX_K = 2

  const $ = (sel) => document.querySelector(sel)
  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue
      if (k === 'class') node.className = v
      else if (k === 'style') node.style.cssText = v
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v)
      else node.setAttribute(k, v === true ? '' : v)
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue
      node.append(child.nodeType ? child : document.createTextNode(child))
    }
    return node
  }
  const svg = (tag, attrs = {}) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
    return node
  }
  const color = (name) =>
    name?.startsWith('#') ? name : `var(--c-${name ?? 'gray'})`

  const themeVars = { accent: '--accent', ink: '--ink', paper: '--paper', logoColor: '--logo-color' }
  for (const [key, cssVar] of Object.entries(themeVars)) {
    if (map.theme?.[key]) document.documentElement.style.setProperty(cssVar, map.theme[key])
  }

  const viewport = $('[data-viewport]')
  const world = $('[data-world]')
  const nodesLayer = $('[data-nodes]')
  const edgesLayer = $('[data-edges]')
  const labelsLayer = $('[data-edge-labels]')
  const bandsLayer = $('[data-bands]')
  const colHeads = $('[data-col-heads]')
  const rowHeads = $('[data-row-heads]')
  const panel = $('[data-panel]')
  const panelBody = $('[data-panel-body]')

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const facetById = new Map(map.facets.map((f) => [f.id, f]))
  const grid = map.columns.length > 0 && map.rows.length > 0

  const state = {
    facet: facetById.has(map.defaultFacet) ? map.defaultFacet : map.facets[0]?.id,
    hidden: new Set(),
    attentionOnly: false,
    query: '',
    selected: null,
    tx: 0,
    ty: 0,
    k: 1,
  }

  const hashParams = () => new URLSearchParams(location.hash.slice(1))
  {
    const f = hashParams().get('f')
    if (facetById.has(f)) state.facet = f
  }

  // ── Header ────────────────────────────────────────────────────────────
  $('[data-map-title]').textContent = map.title
  $('[data-map-sub]').textContent = [map.client, map.updated && `Updated ${map.updated}`]
    .filter(Boolean)
    .join(' · ')
  const audienceEl = $('[data-audience]')
  audienceEl.textContent = `${map.audienceLabel} view`
  audienceEl.dataset.kind = map.audience

  // Link between the internal and client builds when the build provided both.
  const viewsEl = $('[data-views]')
  const otherViews = Object.entries(map.views ?? {}).filter(([id]) => id !== map.audience)
  if (otherViews.length) {
    audienceEl.hidden = true
    viewsEl.hidden = false
    const labels = map.audiences ?? {}
    viewsEl.append(
      el('span', { 'aria-current': 'page' }, labels[map.audience] ?? map.audience),
      ...otherViews.map(([id, href]) => el('a', { href, title: `Open the ${labels[id] ?? id} view` }, labels[id] ?? id)),
    )
  }

  const facetsEl = $('[data-facets]')
  if (map.facets.length < 2) facetsEl.hidden = true
  for (const facet of map.facets) {
    facetsEl.append(
      el(
        'button',
        {
          type: 'button',
          role: 'tab',
          'data-facet': facet.id,
          title: facet.description ?? '',
          onclick: () => setFacet(facet.id),
        },
        facet.title,
      ),
    )
  }

  const attentionTotal = nodes.filter((n) => n.attention.length).length
  $('[data-attention-count]').textContent = attentionTotal
  if (!attentionTotal) $('[data-attention-toggle]').hidden = true

  // ── Notes ─────────────────────────────────────────────────────────────
  const cards = new Map()
  for (const node of nodes) {
    const card = el(
      'button',
      {
        class: 'node',
        type: 'button',
        'data-id': node.id,
        onclick: (e) => {
          if (dragMoved) return e.preventDefault()
          select(node.id, { center: false })
        },
        onpointerenter: () => hover(node.id),
        onpointerleave: () => hover(null),
      },
      node.kind && el('span', { class: 'node-kind' }, node.kind),
      el('span', { class: 'node-title' }, node.title),
      node.summary && el('span', { class: 'node-summary' }, node.summary),
      el('span', { class: 'node-foot' }),
    )
    cards.set(node.id, card)
    nodesLayer.append(card)
  }

  function paintCards() {
    const facet = facetById.get(state.facet)
    for (const node of nodes) {
      const card = cards.get(node.id)
      const value = facet?.values.find((v) => v.id === node.facets[facet.id])
      card.style.setProperty('--node-color', color(value?.color))
      const foot = card.querySelector('.node-foot')
      const tags = [
        value
          ? el('span', { class: 'tag', style: `--tag-color:${color(value.color)}` }, value.label)
          : el('span', { class: 'tag' }, `No ${facet?.title.toLowerCase() ?? 'status'}`),
        node.attention.length
          ? el(
              'span',
              { class: 'tag attention', title: node.attention.join('\n') },
              node.attention.length === 1 ? 'Needs attention' : `${node.attention.length} need attention`,
            )
          : null,
      ]
      foot.replaceChildren(...tags.filter(Boolean))
    }
  }

  // ── Layout ────────────────────────────────────────────────────────────
  const boxes = new Map()
  let worldW = 0
  let worldH = 0
  const rowBoxes = []
  const colX = new Map()

  function layout() {
    boxes.clear()
    rowBoxes.length = 0
    if (!grid) {
      for (const node of nodes) {
        const card = cards.get(node.id)
        const box = { x: node.x, y: node.y, w: NODE_W, h: card.offsetHeight }
        boxes.set(node.id, box)
      }
    } else {
      map.columns.forEach((c, i) => colX.set(c.id, LEFT + i * COL_W))
      const cells = new Map()
      for (const node of [...nodes].sort((a, b) => a.order - b.order)) {
        const key = `${node.column}|${node.row}`
        if (!cells.has(key)) cells.set(key, [])
        cells.get(key).push(node)
      }
      let y = TOP
      for (const row of map.rows) {
        let tallest = 0
        for (const col of map.columns) {
          let cy = y + ROW_PAD
          for (const node of cells.get(`${col.id}|${row.id}`) ?? []) {
            const h = cards.get(node.id).offsetHeight
            boxes.set(node.id, { x: colX.get(col.id) + COL_GAP / 2, y: cy, w: NODE_W, h })
            cy += h + STACK_GAP
          }
          tallest = Math.max(tallest, cy - STACK_GAP - y - ROW_PAD)
        }
        const h = Math.max(tallest, 60) + ROW_PAD * 2
        rowBoxes.push({ row, y, h })
        y += h
      }
    }
    for (const [id, box] of boxes) {
      const card = cards.get(id)
      card.style.left = `${box.x}px`
      card.style.top = `${box.y}px`
    }
    const all = [...boxes.values()]
    worldW = Math.max(...all.map((b) => b.x + b.w)) + (grid ? COL_GAP : 80)
    worldH = Math.max(...all.map((b) => b.y + b.h)) + 80
    if (grid) {
      worldW = LEFT + map.columns.length * COL_W
      worldH = rowBoxes.at(-1).y + rowBoxes.at(-1).h
    }
    world.style.width = `${worldW}px`
    world.style.height = `${worldH}px`
    drawBands()
    drawEdges()
  }

  function drawBands() {
    bandsLayer.replaceChildren()
    colHeads.replaceChildren()
    rowHeads.replaceChildren()
    if (!grid) return
    for (const { row, y, h } of rowBoxes) {
      bandsLayer.append(
        el('div', { class: 'band', style: `top:${y}px;height:${h}px;width:${worldW}px` }),
      )
      rowHeads.append(
        el('div', { class: 'row-head', 'data-row': row.id }, el('span', { title: row.description ?? '' }, row.title)),
      )
    }
    map.columns.forEach((col, i) => {
      if (i > 0) {
        bandsLayer.append(
          el('div', { class: 'col-line', style: `left:${colX.get(col.id)}px;height:${worldH}px` }),
        )
      }
      colHeads.append(
        el(
          'div',
          { class: 'col-head', 'data-col': col.id, title: col.description ?? '' },
          el('b', {}, String(i + 1).padStart(2, '0')),
          col.title,
        ),
      )
    })
  }

  // ── Links ─────────────────────────────────────────────────────────────
  const edgeEls = new Map()

  function sideOf(a, b) {
    const ac = a.x + a.w / 2
    const bc = b.x + b.w / 2
    if (Math.abs(bc - ac) > a.w * 0.6) return bc > ac ? ['right', 'left'] : ['left', 'right']
    return b.y > a.y ? ['bottom', 'top'] : ['top', 'bottom']
  }

  function drawEdges() {
    edgesLayer.replaceChildren()
    labelsLayer.replaceChildren()
    edgeEls.clear()
    edgesLayer.setAttribute('width', worldW)
    edgesLayer.setAttribute('height', worldH)

    const defs = svg('defs')
    for (const [id, kind] of Object.entries(map.edgeKinds)) {
      const marker = svg('marker', {
        id: `arrow-${id}`,
        viewBox: '0 0 10 10',
        refX: 9,
        refY: 5,
        markerWidth: 7,
        markerHeight: 7,
        orient: 'auto-start-reverse',
      })
      marker.append(svg('path', { d: 'M0 0 10 5 0 10z', fill: color(kind.color) }))
      defs.append(marker)
    }
    edgesLayer.append(defs)

    // Spread links that share a side so they do not stack on one point.
    const ports = new Map()
    const plans = edges.map((edge) => {
      const a = boxes.get(edge.from)
      const b = boxes.get(edge.to)
      const [sa, sb] = sideOf(a, b)
      const plan = { edge, a, b, sa, sb }
      for (const [id, side, other] of [
        [edge.from, sa, b],
        [edge.to, sb, a],
      ]) {
        const key = `${id}|${side}`
        if (!ports.has(key)) ports.set(key, [])
        ports.get(key).push({ plan, other, end: id === edge.from ? 'a' : 'b' })
      }
      return plan
    })
    for (const [key, list] of ports) {
      const side = key.split('|')[1]
      const vertical = side === 'left' || side === 'right'
      list.sort((p, q) => (vertical ? p.other.y - q.other.y : p.other.x - q.other.x))
      list.forEach((p, i) => {
        p.plan[`${p.end}Offset`] = list.length === 1 ? 0.5 : 0.25 + (0.5 * i) / (list.length - 1)
      })
    }

    const point = (box, side, t) => {
      if (side === 'right') return [box.x + box.w, box.y + box.h * t]
      if (side === 'left') return [box.x, box.y + box.h * t]
      if (side === 'bottom') return [box.x + box.w * t, box.y + box.h]
      return [box.x + box.w * t, box.y]
    }
    const push = { right: [1, 0], left: [-1, 0], bottom: [0, 1], top: [0, -1] }

    for (const { edge, a, b, sa, sb, aOffset, bOffset } of plans) {
      const kind = map.edgeKinds[edge.kind]
      const [x1, y1] = point(a, sa, aOffset)
      const [x2, y2] = point(b, sb, bOffset)
      const dist = Math.hypot(x2 - x1, y2 - y1)
      const bend = Math.min(Math.max(dist * 0.4, 36), 220)
      const c1 = [x1 + push[sa][0] * bend, y1 + push[sa][1] * bend]
      const c2 = [x2 + push[sb][0] * bend, y2 + push[sb][1] * bend]
      const path = svg('path', {
        class: 'edge',
        d: `M${x1} ${y1} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${x2} ${y2}`,
        'data-style': kind.style ?? 'solid',
        'marker-end': `url(#arrow-${edge.kind})`,
        style: `--edge-color:${color(kind.color)}`,
      })
      edgesLayer.append(path)
      // Cubic Bezier midpoint.
      const mx = 0.125 * x1 + 0.375 * c1[0] + 0.375 * c2[0] + 0.125 * x2
      const my = 0.125 * y1 + 0.375 * c1[1] + 0.375 * c2[1] + 0.125 * y2
      const label = edge.label
        ? el('span', { class: 'edge-label', style: `left:${mx}px;top:${my}px;--edge-color:${color(kind.color)}` }, edge.label)
        : null
      if (label) labelsLayer.append(label)
      edgeEls.set(edge.id, { path, label, edge })
    }
  }

  // ── Filters, focus and dimming ────────────────────────────────────────
  const neighbours = (id) => {
    const set = new Set([id])
    for (const e of edges) {
      if (e.from === id) set.add(e.to)
      if (e.to === id) set.add(e.from)
    }
    return set
  }

  function passes(node) {
    const value = node.facets[state.facet] ?? '__none'
    if (state.hidden.has(value)) return false
    if (state.attentionOnly && !node.attention.length) return false
    return true
  }

  function matches(node) {
    if (!state.query) return false
    const q = state.query.toLowerCase()
    return [node.title, node.kind, node.summary, node.text, node.id]
      .join(' ')
      .toLowerCase()
      .includes(q)
  }

  let hovered = null
  function hover(id) {
    hovered = id
    refresh()
  }

  function refresh() {
    const focus = state.selected ?? hovered
    const near = focus ? neighbours(focus) : null
    const searching = Boolean(state.query)
    for (const node of nodes) {
      const card = cards.get(node.id)
      const match = searching && matches(node)
      const dim =
        !passes(node) || (near && !near.has(node.id)) || (searching && !match && !near)
      card.classList.toggle('dim', Boolean(dim))
      card.classList.toggle('match', match)
      card.classList.toggle('selected', node.id === state.selected)
    }
    for (const { path, label, edge } of edgeEls.values()) {
      const lit = focus && (edge.from === focus || edge.to === focus)
      const hiddenEnd = !passes(byId.get(edge.from)) || !passes(byId.get(edge.to))
      const dim = hiddenEnd || (focus && !lit) || (state.query && !focus)
      const quiet = map.edgeKinds[edge.kind].show === 'focus' && !lit
      path.classList.toggle('lit', Boolean(lit))
      path.classList.toggle('dim', Boolean(dim))
      path.classList.toggle('quiet', quiet)
      label?.classList.toggle('quiet', quiet)
      label?.classList.toggle('lit', Boolean(lit))
      label?.classList.toggle('dim', Boolean(dim))
    }
  }

  // ── Legend ────────────────────────────────────────────────────────────
  const legend = $('[data-legend]')
  function drawLegend() {
    const facet = facetById.get(state.facet)
    legend.replaceChildren(
      el(
        'button',
        {
          type: 'button',
          class: 'legend-title',
          'aria-expanded': String(!legend.classList.contains('collapsed')),
          onclick: () => {
            legend.classList.toggle('collapsed')
            drawLegend()
          },
        },
        facet?.title ?? 'Status',
        el('span', { class: 'n' }, legend.classList.contains('collapsed') ? 'Show' : 'Hide'),
      ),
    )
    const counts = new Map()
    for (const n of nodes) {
      const v = n.facets[state.facet] ?? '__none'
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    const values = [...(facet?.values ?? [])]
    if (counts.has('__none')) values.push({ id: '__none', label: 'Not set', color: 'gray' })
    for (const value of values) {
      legend.append(
        el(
          'button',
          {
            type: 'button',
            'aria-pressed': String(!state.hidden.has(value.id)),
            title: value.description ?? '',
            onclick: () => {
              state.hidden.has(value.id) ? state.hidden.delete(value.id) : state.hidden.add(value.id)
              drawLegend()
              refresh()
            },
          },
          el('span', { class: 'chip-dot', style: `--dot-color:${color(value.color)}` }),
          value.label,
          el('span', { class: 'n' }, String(counts.get(value.id) ?? 0)),
        ),
      )
    }
    const used = new Set(edges.map((e) => e.kind))
    if (used.size) legend.append(el('hr'))
    for (const [id, kind] of Object.entries(map.edgeKinds)) {
      if (!used.has(id)) continue
      const sw = svg('svg', { viewBox: '0 0 28 6' })
      sw.append(
        svg('path', {
          class: 'edge lit',
          d: 'M1 3H27',
          'data-style': kind.style ?? 'solid',
          style: `--edge-color:${color(kind.color)}`,
        }),
      )
      legend.append(
        el(
          'div',
          { class: 'legend-edge' },
          sw,
          kind.label,
          kind.show === 'focus' && el('span', { class: 'n' }, 'on hover'),
        ),
      )
    }
  }

  function setFacet(id) {
    state.facet = id
    state.hidden.clear()
    for (const b of facetsEl.children) b.setAttribute('aria-selected', String(b.dataset.facet === id))
    const params = hashParams()
    params.set('f', id)
    history.replaceState(null, '', `#${params}`)
    paintCards()
    drawLegend()
    refresh()
  }

  // ── Panel ─────────────────────────────────────────────────────────────
  function openPanel(content) {
    panelBody.replaceChildren(...content.filter(Boolean))
    panelBody.scrollTop = 0
    panel.setAttribute('aria-hidden', 'false')
    document.body.classList.add('panel-open')
  }

  function closePanel() {
    panel.setAttribute('aria-hidden', 'true')
    document.body.classList.remove('panel-open')
    state.selected = null
    const params = hashParams()
    params.delete('n')
    history.replaceState(null, '', params.size ? `#${params}` : location.pathname)
    refresh()
  }

  const html = (markup) => {
    const div = el('div')
    div.innerHTML = markup
    return div
  }

  function linkRow(edge, dir) {
    const otherId = dir === 'out' ? edge.to : edge.from
    const other = byId.get(otherId)
    const kind = map.edgeKinds[edge.kind]
    return el(
      'li',
      {},
      el(
        'button',
        { type: 'button', style: `--edge-color:${color(kind.color)}`, onclick: () => select(otherId) },
        el('span', { class: 'dir' }, dir === 'out' ? '→' : '←'),
        el(
          'span',
          {},
          edge.label && el('span', { class: 'label' }, `${edge.label} · `),
          el('span', { class: 'to' }, other.title),
          edge.note && el('span', { class: 'lnote' }, edge.note),
        ),
      ),
    )
  }

  function select(id, { center = true } = {}) {
    const node = byId.get(id)
    if (!node) return
    state.selected = id
    const params = hashParams()
    params.set('n', id)
    history.replaceState(null, '', `#${params}`)

    const col = map.columns.find((c) => c.id === node.column)
    const row = map.rows.find((r) => r.id === node.row)
    const facetRows = map.facets.map((facet) => {
      const value = facet.values.find((v) => v.id === node.facets[facet.id])
      return [
        el('dt', {}, facet.title),
        el(
          'dd',
          {},
          value
            ? el('span', { class: 'tag', style: `--tag-color:${color(value.color)}` }, value.label)
            : el('span', { class: 'hint' }, 'Not set'),
          value?.description && el('span', { class: 'hint' }, value.description),
        ),
      ]
    })
    const outgoing = edges.filter((e) => e.from === id)
    const incoming = edges.filter((e) => e.to === id)

    openPanel([
      el('div', { class: 'panel-eyebrow' }, [node.kind, col?.title, row?.title].filter(Boolean).join(' · ')),
      el('h1', {}, node.title),
      el('dl', { class: 'facet-grid' }, facetRows.flat()),
      node.attention.length
        ? el(
            'div',
            { class: 'attention-box' },
            el('p', {}, 'Needs attention'),
            el('ul', {}, node.attention.map((a) => el('li', {}, a))),
          )
        : null,
      html(node.html),
      incoming.length || outgoing.length
        ? el(
            'div',
            {},
            el('h2', {}, 'Connections'),
            el('ul', { class: 'links-list' }, incoming.map((e) => linkRow(e, 'in')), outgoing.map((e) => linkRow(e, 'out'))),
          )
        : null,
      node.sources.length
        ? el('div', {}, el('h2', {}, 'Sources'), el('ul', { class: 'sources' }, node.sources.map((s) => el('li', {}, s))))
        : null,
      node.file && el('div', { class: 'file-path' }, `Note: ${node.file}`),
    ])
    refresh()
    if (center) centerOn(id)
  }

  function about() {
    state.selected = null
    refresh()
    openPanel([
      el('div', { class: 'panel-eyebrow' }, [map.client, map.updated && `Updated ${map.updated}`].filter(Boolean).join(' · ')),
      el('h1', {}, map.title),
      map.subtitle && el('p', {}, map.subtitle),
      html(map.aboutHtml),
      ...map.facets.map((facet) =>
        el(
          'div',
          {},
          el('h2', {}, facet.title),
          facet.description && el('p', {}, facet.description),
          el(
            'dl',
            { class: 'facet-grid' },
            facet.values.flatMap((v) => [
              el('dt', {}, el('span', { class: 'tag', style: `--tag-color:${color(v.color)}` }, v.label)),
              el('dd', {}, v.description ?? ''),
            ]),
          ),
        ),
      ),
    ])
  }

  panelBody.addEventListener('click', (e) => {
    const link = e.target.closest('[data-node]')
    if (!link) return
    e.preventDefault()
    select(link.dataset.node)
  })
  $('[data-close]').addEventListener('click', closePanel)
  $('[data-about]').addEventListener('click', (e) => {
    e.preventDefault()
    about()
  })

  // ── Pan and zoom ──────────────────────────────────────────────────────
  function apply() {
    world.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.k})`
    const g = 22 * state.k
    viewport.style.setProperty('--grid', `${g}px`)
    viewport.style.setProperty('--gx', `${state.tx}px`)
    viewport.style.setProperty('--gy', `${state.ty}px`)
    $('[data-zoom-level]').textContent = `${Math.round(state.k * 100)}%`
    if (!grid) return
    for (const head of colHeads.children) {
      const x = colX.get(head.dataset.col)
      head.style.left = `${state.tx + (x + COL_GAP / 2) * state.k - STRIP}px`
      head.style.width = `${NODE_W * state.k}px`
    }
    for (const head of rowHeads.children) {
      const box = rowBoxes.find((r) => r.row.id === head.dataset.row)
      const top = Math.max(state.ty + box.y * state.k, 40)
      const bottom = state.ty + (box.y + box.h) * state.k
      head.style.top = `${top}px`
      head.style.height = `${Math.max(bottom - top, 0)}px`
    }
  }

  function zoomAt(factor, cx, cy) {
    const k = Math.min(MAX_K, Math.max(MIN_K, state.k * factor))
    state.tx = cx - ((cx - state.tx) * k) / state.k
    state.ty = cy - ((cy - state.ty) * k) / state.k
    state.k = k
    apply()
  }

  function fit() {
    const vw = viewport.clientWidth - (panel.getAttribute('aria-hidden') === 'false' ? panel.offsetWidth : 0)
    const vh = viewport.clientHeight
    const k = Math.min(Math.max(Math.min((vw - 32) / worldW, (vh - 32) / worldH, 1), 0.5), MAX_K)
    state.k = k
    state.tx = Math.max(STRIP + 8, (vw - worldW * k) / 2)
    state.ty = Math.max(0, (vh - worldH * k) / 2)
    apply()
  }

  function centerOn(id) {
    const box = boxes.get(id)
    const vw = viewport.clientWidth - (panel.getAttribute('aria-hidden') === 'false' ? panel.offsetWidth : 0)
    const vh = viewport.clientHeight
    if (state.k < 0.7) state.k = 0.9
    state.tx = vw / 2 - (box.x + box.w / 2) * state.k
    state.ty = vh / 2 - (box.y + box.h / 2) * state.k
    world.style.transition = 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)'
    apply()
    setTimeout(() => (world.style.transition = ''), 380)
  }

  let dragMoved = false
  const pointers = new Map()
  let pinchStart = null

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    dragMoved = false
    if (pointers.size === 2) {
      const [p, q] = [...pointers.values()]
      pinchStart = { d: Math.hypot(p.x - q.x, p.y - q.y), k: state.k }
    }
  })

  window.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId)
    if (!prev) return
    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2 && pinchStart) {
      const [p, q] = [...pointers.values()]
      const d = Math.hypot(p.x - q.x, p.y - q.y)
      const rect = viewport.getBoundingClientRect()
      zoomAt((pinchStart.k * d) / pinchStart.d / state.k, (p.x + q.x) / 2 - rect.left, (p.y + q.y) / 2 - rect.top)
      dragMoved = true
      return
    }
    if (!dragMoved && Math.hypot(dx, dy) < 3) return
    if (!dragMoved) viewport.setPointerCapture?.(e.pointerId)
    dragMoved = true
    viewport.classList.add('panning')
    state.tx += dx
    state.ty += dy
    apply()
  })

  const endPointer = (e) => {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinchStart = null
    viewport.classList.remove('panning')
    setTimeout(() => (dragMoved = false), 0)
  }
  window.addEventListener('pointerup', endPointer)
  window.addEventListener('pointercancel', endPointer)

  viewport.addEventListener('click', (e) => {
    if (dragMoved || e.target.closest('.node')) return
    if (state.selected) closePanel()
  })

  viewport.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const rect = viewport.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-Math.max(-40, Math.min(40, e.deltaY)) * 0.01), e.clientX - rect.left, e.clientY - rect.top)
      } else {
        state.tx -= e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX
        state.ty -= e.shiftKey && !e.deltaX ? 0 : e.deltaY
        apply()
      }
    },
    { passive: false },
  )

  for (const b of document.querySelectorAll('[data-zoom]')) {
    b.addEventListener('click', () => {
      zoomAt(b.dataset.zoom === '1' ? 1.2 : 1 / 1.2, viewport.clientWidth / 2, viewport.clientHeight / 2)
    })
  }
  $('[data-zoom-fit]').addEventListener('click', fit)

  // ── Toolbar ───────────────────────────────────────────────────────────
  const search = $('[data-search]')
  search.addEventListener('input', () => {
    state.query = search.value.trim()
    refresh()
  })
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = nodes.find((n) => passes(n) && matches(n))
      if (first) select(first.id)
    }
    if (e.key === 'Escape') {
      search.value = ''
      state.query = ''
      search.blur()
      refresh()
    }
  })

  const attentionBtn = $('[data-attention-toggle]')
  attentionBtn.addEventListener('click', () => {
    state.attentionOnly = !state.attentionOnly
    attentionBtn.setAttribute('aria-pressed', String(state.attentionOnly))
    refresh()
  })

  const labelsBtn = $('[data-labels-toggle]')
  labelsBtn.addEventListener('click', () => {
    const on = !document.body.classList.contains('show-labels')
    document.body.classList.toggle('show-labels', on)
    labelsBtn.setAttribute('aria-pressed', String(on))
  })

  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return
    if (e.key === '/') {
      e.preventDefault()
      search.focus()
    } else if (e.key === 'Escape') {
      if (panel.getAttribute('aria-hidden') === 'false') closePanel()
    } else if (e.key === 'f') {
      fit()
    } else if (e.key === '=' || e.key === '+') {
      zoomAt(1.2, viewport.clientWidth / 2, viewport.clientHeight / 2)
    } else if (e.key === '-') {
      zoomAt(1 / 1.2, viewport.clientWidth / 2, viewport.clientHeight / 2)
    }
  })

  window.addEventListener('hashchange', () => {
    const id = hashParams().get('n')
    if (id && id !== state.selected) select(id)
  })

  window.addEventListener('resize', apply)

  // ── Start ─────────────────────────────────────────────────────────────
  function start() {
    setFacet(state.facet)
    layout()
    fit()
    refresh()
    const id = hashParams().get('n')
    if (id && byId.has(id)) select(id)
  }

  if (document.fonts?.ready) document.fonts.ready.then(start)
  else start()
})()
