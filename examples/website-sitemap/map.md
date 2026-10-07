---
title: Example website sitemap
subtitle: Pages and their sections, colored by design and build status.
client: Example Co
updated: 2026-10-07
columns:
  - id: home
    title: Home
  - id: services
    title: Services
  - id: contact
    title: Contact
rows:
  - id: page
    title: Page
  - id: sections
    title: Sections
facets:
  - id: design
    title: Design
    values:
      - { id: approved, label: Approved, color: green }
      - { id: draft, label: In Figma, color: blue }
      - { id: none, label: Not started, color: gray }
  - id: build
    title: Build
    values:
      - { id: live, label: Live, color: green }
      - { id: wip, label: In progress, color: amber }
      - { id: todo, label: To do, color: gray }
---

Each column is a page. The top row is the page itself, the row below lists its sections in order.
