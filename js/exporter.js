// exporter.js — builds the export artifacts. Pure: returns strings / Blobs,
// touches no DOM. Visual notes and director notes are PRIVATE: they appear
// only in the director's brief, never in the teleprompter or any other
// audience-facing export.

import { scriptTiming, fmtDuration, blockMeta, platformMeta } from './timing.js';
import { ATKINSON_WOFF2 } from './vendor/atkinson.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const slug = (s) => (s || 'script').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'script';

// First sentence of the first non-empty hook block, trimmed to a sane length.
function firstHookLine(script) {
  const h = (script.blocks || []).find(
    (b) => b.type === 'hook' && (b.text || '').trim());
  if (!h) return '';
  const first = h.text.trim().split(/(?<=[.!?])\s+|\n+/)[0].trim();
  return first.length > 56
    ? first.slice(0, 56).replace(/\s+\S*$/, '') + '…' : first;
}

// What ships in the header / filename. Never blank "Untitled script" when the
// hook already says what the video is — fall back to the hook's first line.
function displayTitle(script) {
  return (script.title && script.title.trim())
    || firstHookLine(script) || 'Untitled script';
}

const PAGE_CSS = `
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",
Roboto,Helvetica,Arial,sans-serif;color:#15150f;background:#fff;
-webkit-print-color-adjust:exact;print-color-adjust:exact}
.wrap{max-width:780px;margin:0 auto;padding:48px 40px}
h1{font-size:22px;margin:0 0 4px}
.meta{color:#6b6b60;font-size:13px;margin:0 0 28px}
.row{border-top:1px solid #e3e0d5;padding:18px 0}
.tag{display:inline-block;font-size:11px;letter-spacing:.06em;
text-transform:uppercase;color:#6b6b60;margin:0 0 6px}
.note{font-size:13px;color:#6b6b60;margin:8px 0 0}
.note b{color:#15150f}
@media print{.wrap{padding:24px}@page{margin:14mm}}
`;

function docShell(title, bodyHtml, extraCss = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${PAGE_CSS}${extraCss}</style></head>
<body><div class="wrap">${bodyHtml}</div>
<script>window.addEventListener('load',function(){setTimeout(function(){try{window.print()}catch(e){}},250)})<\/script>
</body></html>`;
}

// Split block text into sentences so the page-break unit is the sentence,
// not the whole block — page 1 fills tightly, and a seam can only fall
// between sentences, never mid-sentence. Newlines start a new line too.
function sentences(text) {
  return String(text == null ? '' : text).trim()
    .split(/(?<=[.!?…])["'’”)]?\s+(?=\S)|\n+/)
    .map((s) => s.trim()).filter(Boolean);
}

// ---- Teleprompter — script text only, large, no notes -------------------

export function teleprompter(script, settings, fontPt = 22) {
  const t = scriptTiming(script, settings);
  const sections = t.blocks
    .filter((b) => (b.text || '').trim())
    .map((b) => {
      const lab = esc(blockMeta(b.type).short || blockMeta(b.type).label);
      const rows = sentences(b.text)
        .map((s) => `<tr><td class="ln">${esc(s)}</td></tr>`).join('');
      // Each block is a table: the label lives in a thead, which the print
      // engine repeats at the top of every page the block spans. So a block
      // that breaks across a page re-announces itself ("DEMO" again on the
      // next page) automatically — wherever the engine puts the seam.
      return `<table class="blk"><thead><tr><th class="lbl">${lab}</th></tr></thead>`
        + `<tbody>${rows}</tbody></table>`;
    }).join('');
  // Sentence = break unit: each .ln stays whole (never splits mid-sentence),
  // the block may break between its sentences so page 1 packs tight.
  // orphans/widows guard a rare page-long sentence.
  // Atkinson Hyperlegible: built for character disambiguation (I/l/1, O/0)
  // at reading distance. Embedded base64 so the standalone export renders it
  // with no network — only the spoken lines use it; chrome stays system.
  const css = `@font-face{font-family:'Atkinson Hyperlegible';font-weight:400;
font-style:normal;font-display:swap;src:url(${ATKINSON_WOFF2}) format('woff2')}
.tp{width:100%}
.tp .blk{width:100%;border-collapse:collapse;margin:0 0 34px;page-break-inside:auto}
.tp thead{display:table-header-group}
.tp .lbl{font-size:12px;letter-spacing:.08em;text-transform:uppercase;
color:#9a9a8c;font-weight:600;text-align:left;padding:0 0 10px}
.tp .ln{font-family:'Atkinson Hyperlegible',-apple-system,BlinkMacSystemFont,
"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:${fontPt}pt;
line-height:1.55;font-weight:400;letter-spacing:.01em;padding:0 0 12px;
orphans:2;widows:2;break-inside:avoid;page-break-inside:avoid}
.tp tbody tr:last-child .ln{padding-bottom:0}.wrap{max-width:900px}`;
  const title = displayTitle(script);
  const body = `<h1>${esc(title)}</h1>
<p class="meta">Teleprompter &middot; ${esc(platformMeta(script.platform).label)}
&middot; ${fmtDuration(t.totalDuration)} &middot; ${t.totalWords} words</p>
<div class="tp">${sections || '<p>(empty script)</p>'}</div>`;
  return { filename: slug(title) + '-teleprompter.html', html: docShell('Teleprompter', body, css) };
}

// ---- Director's brief — everything, notes included ----------------------

export function directorBrief(script, settings) {
  const t = scriptTiming(script, settings);
  const rows = t.blocks.map((b, i) => {
    const m = blockMeta(b.type);
    const vis = b.visualNote ? `<p class="note"><b>Visual:</b> ${esc(b.visualNote)}</p>` : '';
    const dir = b.directorNote ? `<p class="note"><b>Director:</b> ${esc(b.directorNote)}</p>` : '';
    const tone = b.tone ? ` &middot; ${esc(b.tone)}` : '';
    return `<div class="row"><span class="tag">${i + 1}. ${esc(m.label)}
&middot; ${fmtDuration(b.duration)} &middot; ${b.words} words${tone}</span>
<div style="font-size:16px;line-height:1.5">${esc(b.text) || '<em>(empty)</em>'}</div>
${vis}${dir}</div>`;
  }).join('');
  const title = displayTitle(script);
  const body = `<h1>${esc(title)}</h1>
<p class="meta">Director's brief &middot; ${esc(platformMeta(script.platform).label)}
&middot; ${esc(script.format || '9:16')} &middot; runtime ${fmtDuration(t.totalDuration)}
&middot; ${t.totalWords} words &middot; pace ${t.wpm} wpm</p>${rows}`;
  return { filename: slug(title) + '-director-brief.html', html: docShell("Director's brief", body) };
}

// ---- Shot list — from visual notes --------------------------------------

export function shotList(script, settings) {
  const t = scriptTiming(script, settings);
  const shots = t.blocks
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => (b.visualNote || '').trim())
    .map(({ b }, n) => `<div class="row"><span class="tag">Shot ${n + 1}
&middot; ${fmtDuration(b.duration)} &middot; ${esc(blockMeta(b.type).label)}</span>
<div style="font-size:16px">${esc(b.visualNote)}</div></div>`).join('');
  const title = displayTitle(script);
  const body = `<h1>${esc(title)} — shot list</h1>
<p class="meta">${esc(platformMeta(script.platform).label)} &middot;
${esc(script.format || '9:16')} &middot; total ${fmtDuration(t.totalDuration)}</p>
${shots || '<p class="meta">No visual notes yet — add a visual note to a block to build the shot list.</p>'}`;
  return { filename: slug(title) + '-shot-list.html', html: docShell('Shot list', body) };
}

// ---- Plain text — just the spoken script --------------------------------

export function plainText(script, settings) {
  const t = scriptTiming(script, settings);
  return t.blocks.map((b) => (b.text || '').trim()).filter(Boolean).join('\n\n');
}

// ---- Caption draft — CTA text + hashtag placeholder ---------------------

export function captionDraft(script) {
  const ctas = (script.blocks || [])
    .filter((b) => b.type === 'cta' && (b.text || '').trim())
    .map((b) => b.text.trim());
  const hook = (script.blocks || []).find((b) => b.type === 'hook');
  const lead = hook && hook.text ? hook.text.trim() : (script.title || '');
  const body = [lead, ...ctas].filter(Boolean).join('\n\n');
  return `${body}\n\n#yourhashtag #addyourtags #${slug(script.title).replace(/-/g, '')}`;
}

// ---- Pure-JS store-only ZIP (batch teleprompter export) -----------------
// No compression, no dependency, no CDN. Each entry prints to PDF in-browser.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// files: [{ name, html }]  ->  Blob (application/zip)
export function zipFiles(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;

  const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
  const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = enc.encode(f.html);
    const crc = crc32(data);
    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0),
    ];
    chunks.push(new Uint8Array(local), nameBytes, data);
    const localSize = local.length + nameBytes.length + data.length;
    central.push({ nameBytes, crc, size: data.length, offset });
    offset += localSize;
  }

  const cdir = [];
  let cdirSize = 0;
  for (const c of central) {
    const h = [
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(c.crc), ...u32(c.size), ...u32(c.size),
      ...u16(c.nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(c.offset),
    ];
    cdir.push(new Uint8Array(h), c.nameBytes);
    cdirSize += h.length + c.nameBytes.length;
  }
  const end = [
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(central.length), ...u16(central.length),
    ...u32(cdirSize), ...u32(offset), ...u16(0),
  ];
  return new Blob([...chunks, ...cdir, new Uint8Array(end)], { type: 'application/zip' });
}

export function batchTeleprompterZip(scriptList, settings, fontPt = 22) {
  const files = scriptList.map((s) => {
    const tp = teleprompter(s, settings, fontPt);
    return { name: tp.filename, html: tp.html };
  });
  return zipFiles(files);
}
