# Automatic dubbing, visual refinement and presentation verification

2026-10-28. This report records observed behavior, not subjective voice-quality claims.

## Automated checks

- `pnpm -r test`: **456 passed** — story-domain 31, server 250, web 175.
- `pnpm lint`: web / server passed without new warnings.
- `pnpm build`: all workspace builds passed, including TypeScript.
- `pnpm test:readiness`: launcher and documentation checks passed.
- `pnpm test:presentation`: current static images / zoom targets exist; both public sample audio hashes match the licensed source pack.
- Personal website: `project-navigation.test.cjs` and `recruiter-portfolio.test.cjs` passed, including eight-project navigation, mobile, no-JS behavior, asset availability, focus restoration and reduced motion.

The first root `pnpm test` preparation attempt encountered the Windows Prisma DLL lock while the backend was running. No schema changed. All workspaces were subsequently tested with the existing generated Client via `pnpm -r test`; no generated Client or user database was manually deleted.

## Real local synthesis

Created a separate temporary story, chapter and role bound to the existing licensed synthetic Yuki voice. In the real browser:

1. Enabled automatic dubbing once; no per-line generation or acceptance button was used.
2. The Chinese line “一起回家吧。” received a completed Chinese generation job, accepted asset and persisted `voiceTracks.zh`.
3. Selected Japanese in the voice workbench, kept automatic mode and returned to editing. The local translation produced “一緒に帰るよ。” and the Japanese job completed; accepted asset and `voiceTracks.ja` were persisted.
4. Database inspection showed chapter version 3, both completed / accepted jobs and both tracks; the Chinese source text was unchanged.
5. Paused automation, left the temporary story and removed it through the authenticated project deletion API. The published official story was not used for synthesis QA.

Unit / integration coverage checks changed text, bindings, manual audio and chapter changes during asynchronous acceptance; recovered in-flight jobs; no concurrent runs; explicit retry after provider failure; automatic track updates preserving the author's undo history.

## Visual and browser checks

- Home uses contain sizing for the complete original illustration, with responsive ivory/lilac gradients. Verified desktop and 390 px mobile with no horizontal overflow.
- New default draft and official story covers use distinct original art; uploaded covers are preserved by the compatibility helper.
- Found and fixed a real background URL defect while recapturing the editor: `/assets/...` paths were previously wrapped as IDs. The regression failed before the fix and passed afterward; actual editor images then had no broken sources.
- Recaptured Home, voice catalog, role assignment, automatic voice workbench, music, editor, flowchart, Agent and player from the running application.
- Project and personal showcase pages load two audio samples to HTML media readyState 4 without errors, remain within the mobile viewport and support native-dialog screenshot enlargement. Audio is opt-in and only one sample plays at once.
- Screenshots were copied losslessly to the personal website; synthetic art is only used as decoration / story covers, not fabricated UI evidence.

## Delivery boundaries

Automatic synthesis is scheduled while the editor is open, not during public playback. Voice and language preferences are local per browser/project; bindings and accepted audio are server-backed. Official bundled voices are synthetic, only part of the story is pre-recorded, and no human-equivalence quality claim is made.

Personal website unrelated pre-existing deletions / documents remain outside the commit scope. Only DreamChord presentation files, media and its explicit handoff are included. Current documentation is rooted at `CURRENT_HANDOFF.md` and `VOICE_WORKFLOW.md`; unused temporary QA screenshots, obsolete placeholder JPGs and six unreferenced old portfolio captures were removed.

## Showcase correction: preserve the original design

Following the author's clarification, the project showcase uses the original `2446b35` Dream Light page as its foundation. Its Hero video, title, entrance animation, parallax, footer video, philosophy, comparison, Agent explanation, characters, scenes and architecture remain. The Hero font size is constrained to keep the badge and actions visible. The application homepage is separate and keeps its approved writing-room illustration.

The new voice section supplements this foundation with current catalog / binding / automatic dubbing / music / player captures and opt-in Chinese / Japanese samples. Obsolete planned-TTS and music descriptions are corrected. The comparison table retains its purpose while correcting third-party claims against official Ren'Py and TyranoBuilder documentation. Static scene illustrations are explicitly distinguished from real browser captures.

Verified locally at 1440 × 900, 390 × 844 and 320 × 740: no horizontal document overflow after fixing the original overview and quick-start grid sizing; screenshot dialog opens and closes with Escape; FAQ reports its expanded state; both samples load to readyState 4 (5.76 / 5.92 seconds). Original Hero video loads to readyState 4 and plays. Browser autoplay restrictions still require user interaction for audible samples.

Re-ran lint, production build and all 456 workspace tests successfully. Presentation resource / audio provenance checks and workspace readiness pass. The presentation audit now protects the original Hero title, both video identities and retained core sections from accidental replacement.
