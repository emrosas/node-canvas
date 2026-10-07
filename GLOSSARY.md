# node-canvas

A map tool. Agents read and write a folder of Markdown notes, and people read the same map as a canvas of cards and links.

## Language

### Maps and builds

**Map**:
A folder of notes plus its settings, drawn as one canvas.
_Avoid_: diagram, board, sitemap

**Canvas**:
The pannable, zoomable surface a map's cards and links are drawn on.
_Avoid_: board, whiteboard

**Build**:
One self-contained HTML file made from a map for one audience. Every map has an internal build and a client build.
_Avoid_: view, page, export

**Export**:
A one-way copy of a map in another format, such as JSON Canvas. Never edited and never read back.
_Avoid_: build, source

### Notes and cards

**Note**:
One Markdown file in a map, describing one thing. Every note becomes one card.
_Avoid_: node, page, file

**Card**:
How a note appears on the canvas.
_Avoid_: node, box, tile

**Note kind**:
A free-text label naming what a note describes, such as Record or Section.
_Avoid_: kind (on its own), type

**Attention item**:
An open question or decision listed on a note. A note with any attention item flags its card.
_Avoid_: open item, todo, flag

**Callout**:
A fenced block in a note body that shows as a styled box, such as a question or a conflict.
_Avoid_: admonition, box

**Internal block**:
A callout that only appears in the internal build.
_Avoid_: private note, hidden block

**Note reference**:
A mention of another note inside a note body. It jumps to that note but draws nothing on the canvas.
_Avoid_: wiki link, link

**Source**:
A citation for where a note's facts came from.
_Avoid_: reference, citation

### Layout

**Grid map**:
A map laid out in columns and rows, with each note placed in one cell.
_Avoid_: table, matrix

**Freeform map**:
A map with no columns or rows, where each note has its own position.
_Avoid_: free map, absolute layout

**Column**:
A left-to-right division of a grid map, such as a page or a journey stage.

**Row**:
A top-to-bottom division of a grid map, such as a team or a level of detail.
_Avoid_: lane, swimlane

**Cell**:
Where one column and one row meet. A cell can hold several notes.

### Links

**Link**:
A directed connection from one note to another, drawn as a line between their cards.
_Avoid_: edge, connection, arrow

**Link kind**:
A named category of link that sets what it means and how it is drawn, such as flow, data, gap or planned.
_Avoid_: edge kind, kind (on its own)

### Facets

**Facet**:
One way to color every card, with a fixed list of values, such as design status or build status. A map shows one facet at a time.
_Avoid_: lens, coloring, dimension

**Facet value**:
One entry in a facet's list. A note holds at most one value per facet.
_Avoid_: state, tag

**Status**:
The facet a map gets when it defines none.

### Audiences

**Client**:
The organization a map is made for.
_Avoid_: customer, account

**Audience**:
Who a build is for: internal or client. A note can be limited to one audience.
_Avoid_: visibility, mode

**Internal build**:
The build with every note, internal block and file path, for the team making the map.
_Avoid_: internal view, full build

**Client build**:
The build with internal notes, internal blocks and file paths removed, safe to send to the client.
_Avoid_: client view, public build
