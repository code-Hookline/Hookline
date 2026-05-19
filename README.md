# Hookline

Script your short-form video in blocks. Time it automatically. Ship it fast.

A static, no-account, content-local scripting workspace for short-form video
creators. Assemble a script as a sequence of typed blocks on a live timeline
that auto-times to *your* measured speaking pace. Export a teleprompter PDF
and a director's brief. Your swipe file of hooks, frameworks, and CTAs lives
only in your browser's IndexedDB — nothing uploads, nothing syncs.

## Run it

No build step. Serve the folder with any static server:

```
python3 -m http.server 8080
# open http://localhost:8080
```

## Layout

- `index.html` — landing page
- `app.html` — the workspace
- `js/app.js` — the only DOM module; everything else is pure logic
- See `CLAUDE.md` for architecture and the rules that keep it honest.

## Privacy

Script content never leaves the browser. The site loads Google Analytics
(consent-gated, disclosed in `privacy.html`) for anonymous usage measurement
only — it never sees your scripts.
