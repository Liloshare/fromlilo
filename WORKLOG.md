# Worklog

## 2026-07-27

- Created the `data-qc` project.
- Added the first tool: `tools/joseon-bbox-qc/index.html`.
- Added a root tool index page.
- Added project handoff docs for multi-computer Codex sessions.
- Renamed the public site title to `업무자동화 툴`.
- Restyled the root page with a Tally-inspired single-column layout.
- Revised the root page to a dark, typewriter-style layout.
- Updated the public copy to concise English keywords.

## Next Session Notes

- Decide whether to keep the current local-file mode as a fallback.
- Plan Cloudflare storage architecture for Joseon BBox QC:
  - R2 for images and label text files
  - D1 or KV for project metadata and review results
  - Worker or Pages Functions for API endpoints
- Add deployment instructions after Cloudflare Pages is connected.
