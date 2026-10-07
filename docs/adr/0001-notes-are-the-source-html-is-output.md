# Markdown notes are the source, the HTML is only output

A map is a folder of Markdown files, one per card, and the built HTML is generated from them and never edited. Agents read and write the notes because plain text with frontmatter is cheap to diff, grep and rewrite; people read the HTML because a canvas is easier to scan than forty files. Anything that exists only in the HTML (a hand-moved card, an edited label) is lost on the next build, so the viewer has no editing features on purpose.
