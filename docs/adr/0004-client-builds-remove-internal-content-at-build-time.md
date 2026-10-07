# Client builds remove internal content at build time, not in the viewer

Every map is built twice: an internal file with everything, and a client file without `:::internal` blocks, notes marked `audience: internal`, links to them, and note file paths. The filtering happens in `forAudience` before the data is embedded, rather than as a toggle in the viewer, because anything shipped in the file can be read with view-source. Maps are sent to clients (the first was for Granite South's owner) and carry code paths and internal notes that must never reach them.
