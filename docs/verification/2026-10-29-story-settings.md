# Story settings and presentation verification

The approved Home art and original showcase video Hero remain. Home and editor now share cover presets/upload, title/description, independent subtitle/voice defaults and the existing Story Bible. Actual server completion controls the save state; errors preserve inputs, dirty exits confirm, and Story Bible fetch failures require explicit retry. The Home feature cards are followed by a real screenshot gallery with tabs, keyboard navigation and enlargement.

## Data and language

Additive migration `20261029000000_project_languages` adds two default-`zh` fields. Backup v2 accepts older manifests and preserves new defaults. The local legacy database has an existing failed July migration record, so deployment was not forced or reset: verified the schema diff, made a pre-upgrade backup through the existing helper, and executed only the two additive ALTER statements. Project counts match the pre-upgrade backup after temporary QA cleanup. Clean clones use normal Prisma migrations.

Author defaults initialize automatic/manual synthesis and playback. Reader overrides are scoped by project and the author's current default pair; changing author defaults invalidates old overrides. Global volume/text-speed preferences remain independent.

## Real browser QA

- Created one isolated `星夜来信 · 设置演示` story. Chose a built-in cover and Japanese voice / Chinese subtitles in the actual Home dialog; read back persisted values through the project API.
- Reopened, edited the title, pressed Escape and confirmed abandoning it; the saved title remained unchanged.
- Uploaded a PNG through the actual file input, saved, and verified an uploaded cover URL.
- Added one official dual-track demonstration line to this temporary story. Entered playback from Home and observed the requested audio URL ending in `s1-d1-ja.wav`; the displayed text remained `最后一页……只差最后一句。`. The actual player settings read `voiceLocale: ja`, `subtitleLocale: zh`; sample returned HTTP 200.
- Checked the settings dialog at 1440×1000 and 390×844; mobile document width remained 390, with an internal scroll area and accessible save/cancel controls.
- Deleted the temporary story through its authenticated API (HTTP 200), including its uploaded image. No official chapter was rewritten for QA.
- Captured real editor, voice catalog, formal player, story settings and Home workflows. Settings uses temporary demonstration data; public Home captures use the unauthenticated view. Publicly bundled WebP files are lossless conversions of these captures.

## Resume

The personal site's download and compatibility copy are exact copies of the author's current original PDF. No text/layout edits were applied. Cache-busting uses the new content hash.

## Checks

31 domain, 256 server and 182 web tests passed (469 total, including two additional focused dismissal/pending-save tests). Lint, production build, TypeScript, workspace readiness, 18 voice-runtime checks and the 27-reference presentation audit passed. Personal-site navigation and recruiter-portfolio browser suites passed. Both presentations loaded the new settings image with no broken sources; Home mobile and its enlarged screenshot dialog stay within the viewport. Remote CI/deployment should be assessed against the final commit, not historical runs.
