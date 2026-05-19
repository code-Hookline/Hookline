# Hookline — AI Instructions

Read this before editing. It states what Hookline is, how it is wired, and
the rules to keep when changing it.

---

## What Hookline is

A **static, no-account, content-local** short-form video scripting workspace.
The creator assembles a script as a sequence of typed **blocks** (Hook,
Problem, Bridge, Demo, Social proof, Objection handler, CTA, Transition) on a
live **timeline** that auto-times every block to their *own* measured speaking
pace. When done they export a teleprompter PDF + a director's brief with all
notes stripped. The swipe file of winning hooks, frameworks, and CTAs lives
only in the browser's IndexedDB and is never uploaded. The site does load
Google Analytics (`js/analytics.js`, consent-gated, dormant until a GA4 ID is
set) for anonymous usage measurement — it never has access to script content.
One-line pitch: **"Your scripts are yours."**

The name: every short-form video lives or dies by its hook — the first two
seconds. A *hookline* is the one sentence that stops the scroll; "hook, line,
and sinker" is capturing attention completely. Self-explanatory to any creator.

## User flow

Pick platform + format → add blocks, write script text → timeline re-times
live against your calibrated pace → rate/save hooks to the library → export
teleprompter / director brief / shot list, or batch-ZIP a whole campaign. No
submit button. Everything autosaves to IndexedDB.

## File map

```
index.html        marketing landing page (interactive canvas starfield)
app.html          the app — the scripting workspace (single screen)
privacy.html      data policy + irreversible local-wipe button
404.html          branded not-found
css/style.css     all app chrome styling (token-driven; brand theme default,
                  html[data-chrome=bw] black-and-white alternate)
js/storage.js     IndexedDB wrapper: scripts, hooks, frameworks, ctas,
                  campaigns, settings
js/seed.js        built-in hook library + framework gallery + CTA sub-library
js/timing.js      pure pace/duration/language engine — no DOM
js/exporter.js    teleprompter / director / shot-list / caption builders +
                  a dependency-free store-only ZIP writer (batch export)
js/analytics.js   GA4, consent-gated, dormant until a Measurement ID is set
js/landing.js     landing-only interactive canvas starfield (cursor repel)
js/app.js         the ONLY DOM module (app.html): builder, timeline, panels
```

## Rules when editing

- Keep `storage.js`, `seed.js`, `timing.js`, `exporter.js` free of UI code.
  `app.js` is the only module that touches the DOM.
- No build step, no framework, no runtime dependency. Plain ES modules; must
  run by serving the folder. The app stays fully client-side.
- Content-locality is non-negotiable: Hookline runs no server, collects
  nothing, and no third party ever receives script content. It is never
  uploaded and never auto-synced. The ONLY permitted third-party code is
  Google Analytics via `js/analytics.js` (consent-gated). Never feed script
  content to the analytics layer. Keep privacy.html truthful to the code.
- The one sanctioned way content reaches another person is a user-initiated
  live session (`js/peer.js`): WebRTC with a manual copy/paste handshake,
  peer-to-peer to exactly the recipient the user hands the session code to.
  STUN is permitted and used (currently Google's public STUN) because a STUN
  server is contacted only for network-address discovery — it sees an IP, NEVER
  the data channel or script content. This stays within content-locality:
  Hookline runs no server, no third party receives script content, no signaling
  server is used. Never add a signaling server or a TURN relay — TURN would put
  a third party in the data path. Never auto-sync, never store the session.
- `peer.js` is pure transport + a Lamport clock: NO DOM, NO storage. Co-edit
  convergence (snapshot + per-block Last-Write-Wins, ties broken by a stable
  per-session id) lives in `app.js`, which owns document state.
- No AI generation, no platform-API pulls, no cloud sync, no signaling server,
  no TURN relay — these are deliberate non-features (see landing "what we
  leave out"). User-initiated peer-to-peer live co-edit (STUN-assisted, no
  relay) is the sole exception.
- Timing is the soul of the product. The duration of a block =
  `words / (wpm/60)` × language multiplier, unless a manual override is
  pinned. The calibrator sets the user's real wpm for three delivery styles
  (conversational / energetic / slow). All of this is pure in `timing.js`.
- Exports never include visual notes or director notes — they are private.
  Teleprompter = script text only. Director brief = everything.
- Batch export is a pure-JS store-only (no-compression) ZIP of teleprompter
  HTML documents (each prints to PDF from the browser). Never add a zip lib
  or any CDN to do this.
- UI stays clean and paid-grade. No emojis in code or shipped copy.
- IndexedDB: DB `hookline`, stores `scripts` (keyPath `id`), `hooks`,
  `frameworks`, `ctas`, `campaigns`, `settings` (single record `id:1`). Bump
  `VERSION` and add an `onupgradeneeded` migration if a store's shape changes.
- The vault is append-on-save and never auto-pruned. Panel deletes and the
  privacy page wipe are the only removers.
- App-chrome theming is a pure token-swap: `:root` is the default brand
  theme; `html[data-chrome="bw"]` is the black-and-white alternate.
  Components reference vars only — never hardcode a color. Block-type colors
  are functional tokens (`--b-hook`, `--b-problem`, …), not chrome accents.
- Email/contact protection: never render a contact address as static text or
  a plain `mailto:`. Assemble it in JS at runtime, generic link text only.
