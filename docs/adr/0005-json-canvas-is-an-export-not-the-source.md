# JSON Canvas is an export, not the source format

Obsidian's JSON Canvas (`.canvas`) was the closest existing format and was considered as the source. It was rejected because it stores absolute positions and sizes and puts each card's text inside one JSON file, which is hard for agents to edit and noisy to diff. node-canvas keeps one Markdown file per note with a column and row, lays them out itself, and offers `build --canvas` as a one-way export for people who want to open a map in Obsidian.
