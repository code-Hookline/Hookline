// app.js — the ONLY module that touches the DOM. Builder, timeline, panels,
// calibrator, vault. All timing/storage/export logic lives in pure modules.

import * as db from './storage.js';
import {
  BLOCK_TYPES, TONES, STYLES, LANGUAGES, PLATFORMS, FORMATS,
  blockMeta, scriptTiming, fmtDuration, statusMessage,
  calcWpm, CALIBRATION_SAMPLE, SAMPLE_WORDS,
} from './timing.js';
import * as ex from './exporter.js';
import { createPeer, makeClock } from './peer.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const c of [].concat(kids)) if (c != null) n.append(c);
  return n;
}

const cssVal = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

let S;            // settings
let script;       // current script
let timing;       // computed timing
let saveTimer;

const newBlock = (type, text = '') => ({
  id: db.uid(), type, text, tone: '', visualNote: '', directorNote: '',
  pinnedDuration: '',
});

function defaultTitle() {
  const p = (PLATFORMS.find((x) => x.id === S.platform) || {}).label || 'Short-form';
  const d = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${p} script · ${d}`;
}

function blankScript() {
  return {
    title: defaultTitle(), platform: S.platform, format: S.format,
    language: S.language, paceStyle: S.defaultStyle,
    campaign: '', status: 'draft',
    blocks: [newBlock('hook'), newBlock('cta')],
  };
}

// ---- Boot ---------------------------------------------------------------

async function boot() {
  S = await db.loadSettings();
  await db.seedIfEmpty();
  setChrome(S.chrome || 'brand');

  if (S.draftScriptId) script = await db.scripts.get(S.draftScriptId);
  if (!script) { script = blankScript(); await persist(true); }

  buildTopbar();
  renderBuilder();
  liveUpdate();
  wirePanels();
  initTooltips();
}

// ---- Tooltips -----------------------------------------------------------
// Themed, not the browser default. One element, event-delegated over any
// [data-tip] target. Follows the active theme (uses chrome tokens).

function initTooltips() {
  const tip = el('div', { class: 'tip', role: 'tooltip' });
  document.body.append(tip);
  let cur = null;

  function place(target) {
    const r = target.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    let top = r.top - tr.height - 9;
    if (top < 8) top = r.bottom + 9;
    let left = r.left + r.width / 2 - tr.width / 2;
    left = Math.max(8, Math.min(left, innerWidth - tr.width - 8));
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
  }
  function show(target) {
    const txt = target.getAttribute('data-tip');
    if (!txt) return;
    cur = target;
    tip.textContent = txt;
    tip.classList.add('show');
    place(target);
  }
  function hide() { cur = null; tip.classList.remove('show'); }

  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t && t !== cur) show(t);
  });
  document.addEventListener('pointerout', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t && t === cur && !t.contains(e.relatedTarget)) hide();
  });
  document.addEventListener('focusin', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t) show(t); else hide();
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', hide, true);
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
}

// ---- Persistence --------------------------------------------------------

async function persist(immediate) {
  clearTimeout(saveTimer);
  const run = async () => {
    const saved = await db.scripts.save(script);
    script.id = saved.id;
    if (S.draftScriptId !== saved.id) { S = await db.saveSettings({ draftScriptId: saved.id }); }
  };
  if (immediate) return run();
  saveTimer = setTimeout(run, 450);
}

function liveUpdate() {
  timing = scriptTiming(script, S);
  renderTimeline();
  renderSub();
  persist(false);
  broadcast();
}

// ---- Topbar -------------------------------------------------------------

function selectFrom(list, value, onChange, labelKey = 'label') {
  const s = el('select', { onchange: (e) => onChange(e.target.value) });
  for (const o of list) {
    const opt = el('option', { value: o.id }, o[labelKey]);
    if (o.id === value) opt.selected = true;
    s.append(opt);
  }
  return s;
}

function buildTopbar() {
  const bar = $('#topbar');
  bar.innerHTML = '';
  // Pace stays outside the drawer so it is always visible — on mobile it is
  // the personalization badge a creator checks before filming. Everything
  // else collapses behind one toggle so the script canvas leads on a phone.
  const paceBtn = el('button', {
    class: 'btn btn-sm tb-pace' + (S.calibrated ? '' : ' tb-cta'),
    onclick: () => openPanel('calib'),
    'data-tip': S.calibrated
      ? 'Your measured speaking pace — click to recalibrate'
      : 'Read a short paragraph out loud so the timeline times to YOUR pace, not a generic average',
  }, S.calibrated ? `Pace: ${paceLabel()}` : 'Calibrate pace');

  const toggle = el('button', {
    class: 'btn btn-sm tb-toggle', 'aria-expanded': 'false',
    'data-tip': 'Show or hide script settings and tools',
    onclick: () => {
      const open = bar.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    },
  }, 'Settings ▾');

  const drawer = el('div', { class: 'tb-drawer' }, [
    ctl('Platform', selectFrom(PLATFORMS, script.platform, (v) => {
      script.platform = v; stampMeta(); S = liveSet({ platform: v }); liveUpdate();
    })),
    ctl('Format', selectFrom(FORMATS, script.format, (v) => {
      script.format = v; stampMeta(); liveSet({ format: v }); liveUpdate();
    })),
    ctl('Language', selectFrom(LANGUAGES, script.language, (v) => {
      script.language = v; stampMeta(); liveSet({ language: v }); liveUpdate();
    })),
    ctl('Delivery', selectFrom(STYLES, script.paceStyle, (v) => {
      script.paceStyle = v; stampMeta(); liveSet({ defaultStyle: v }); liveUpdate();
    })),
    el('div', { class: 'grow' }),
    // Library tools — quiet, grouped together.
    el('div', { class: 'tb-group', 'data-tip': 'Reusable libraries' }, [
      el('button', {
        class: 'btn btn-sm btn-ghost', onclick: () => openPanel('hooks'),
        'data-tip': 'Browse and reuse proven opening hooks',
      }, 'Hooks'),
      el('button', {
        class: 'btn btn-sm btn-ghost', onclick: () => openPanel('frameworks'),
        'data-tip': 'Insert a proven block structure (problem→bridge→demo…)',
      }, 'Frameworks'),
      el('button', {
        class: 'btn btn-sm btn-ghost', onclick: () => openPanel('ctas'),
        'data-tip': 'Browse call-to-action lines that convert',
      }, 'CTAs'),
    ]),
    el('span', { class: 'tb-sep' }),
    el('button', {
      class: 'btn btn-sm' + (live.peer && live.peer.connected ? ' is-live' : ''),
      onclick: () => openPanel('live'),
      'data-tip': live.peer && live.peer.connected
        ? 'Live co-edit session active — peer-to-peer, no server'
        : 'Co-edit this script live with one other person — peer-to-peer, your script never touches a server',
    }, live.peer && live.peer.connected ? 'Co-edit ●' : 'Co-edit'),
    el('button', {
      class: 'btn btn-sm', onclick: () => openPanel('vault'),
      'data-tip': 'Open your saved scripts and campaigns',
    }, 'Vault'),
    el('button', {
      class: 'btn btn-sm btn-primary', onclick: newScript,
      'data-tip': 'Start a new blank script (this one stays saved in the Vault)',
    }, 'New'),
    el('span', { class: 'tb-sep' }),
    themeSeg(),
  ]);

  bar.append(
    el('a', { class: 'wordmark', href: 'index.html' }, [
      el('img', { class: 'mk', src: 'favicon-96x96.png', alt: '', width: '20', height: '20' }), 'Hookline',
    ]),
    paceBtn, toggle, drawer,
  );
}

function paceLabel() {
  const id = script.paceStyle || S.defaultStyle;
  const st = STYLES.find((s) => s.id === id);
  return (S.pace[id] || 140) + ' wpm · ' + (st ? st.label : id);
}

function liveSet(patch) { S = { ...S, ...patch }; db.saveSettings(patch); return S; }

// Apply a theme and mirror it to localStorage so the static pages
// (landing, privacy, 404) can adopt it before first paint.
function setChrome(id) {
  document.documentElement.setAttribute('data-chrome', id);
  try { localStorage.setItem('hookline-chrome', id); } catch (e) { /* private mode */ }
}

function ctl(label, control) {
  return el('label', { class: 'ctl' }, [label, control]);
}

function themeSeg() {
  const TIP = {
    brand: 'Dark mode — the Hookline look',
    bw: 'Light mode — same brand, light background',
    print: 'Print mode — vintage red & black on cream',
  };
  const mk = (id, txt) => el('button', {
    'aria-pressed': String((S.chrome || 'brand') === id),
    'data-tip': TIP[id],
    onclick: () => {
      S = liveSet({ chrome: id });
      setChrome(id);
      buildTopbar(); renderTimeline();
    },
  }, txt);
  return el('div', { class: 'seg', 'data-tip': 'Switch theme' },
    [mk('brand', 'Dark'), mk('bw', 'Light'), mk('print', 'Print')]);
}

function renderSub() {
  const sub = $('#builderSub');
  if (!timing.totalWords) {
    sub.textContent = 'Untimed draft · written here, stored only in this browser';
    return;
  }
  const camp = script.campaign ? ` · ${script.campaign}` : '';
  sub.textContent =
    `${timing.totalWords} words · ${fmtDuration(timing.totalDuration)} ` +
    `· ${timing.wpm} wpm · ${cap(script.status)}${camp}`;
}

const cap = (s) => (s || '').charAt(0).toUpperCase() + (s || '').slice(1);

// ---- Builder ------------------------------------------------------------

function renderBuilder() {
  const root = $('#blocks');
  root.innerHTML = '';
  script.blocks.forEach((b, i) => root.append(blockCard(b, i)));
  if (isFreshSkeleton()) root.append(structureHint());
  root.append(addBar());
  const titleEl = $('#scriptTitle');
  titleEl.value = script.title || '';
  // Empty script: the placeholder teaches that naming is optional. Once the
  // script has words, the instruction is stale — switch to a plain prompt so
  // an unnamed-but-written script reads as "name me", not as a blank slate.
  const hasContent = script.blocks.some((b) => (b.text || '').trim());
  titleEl.placeholder = hasContent
    ? 'Name your script'
    : 'Name your script — or just start writing below';
  titleEl.classList.toggle('needs-name', hasContent && !(script.title || '').trim());
}

// A new script starts as just Hook + CTA. Until the writer fills it in,
// nudge them toward the middle that actually carries the video.
function isFreshSkeleton() {
  return script.blocks.length <= 2 &&
    script.blocks.every((b) => !(b.text || '').trim());
}

function structureHint() {
  const mids = ['problem', 'bridge', 'demo'];
  return el('div', { class: 'structure-hint' }, [
    el('p', { html:
      'Most videos live in the <b>middle</b>. A hook earns attention and a ' +
      'CTA closes — Problem, Bridge and Demo are where you actually deliver.' }),
    el('button', {
      class: 'btn btn-sm',
      'data-tip': 'Insert Problem, Bridge and Demo blocks between the hook and the CTA',
      onclick: () => {
        const at = Math.max(script.blocks.length - 1, 1);
        const ins = mids.map((t) => newBlock(t));
        ins.forEach(stampBlock); script.blocks.splice(at, 0, ...ins);
        stampOrder(); renderBuilder(); liveUpdate();
      },
    }, 'Add Problem → Bridge → Demo'),
  ]);
}

function blockCard(b, i) {
  const m = blockMeta(b.type);
  const color = cssVal(m.token) || cssVal('--ink-2');
  const wrap = el('div', { class: 'block' });
  wrap.style.setProperty('--bt', color);

  const typeSel = el('select', {
    onchange: (e) => { b.type = e.target.value; stampBlock(b); renderBuilder(); liveUpdate(); },
  });
  for (const t of BLOCK_TYPES) {
    const o = el('option', { value: t.id }, t.label);
    if (t.id === b.type) o.selected = true;
    typeSel.append(o);
  }
  const toneSel = el('select', {
    onchange: (e) => { b.tone = e.target.value; stampBlock(b); liveUpdate(); },
  }, el('option', { value: '' }, 'Tone'));
  for (const t of TONES) {
    const o = el('option', { value: t }, t);
    if (t === b.tone) o.selected = true;
    toneSel.append(o);
  }

  const meta = el('span', { class: 'block-meta' });

  const head = el('div', { class: 'block-head' }, [
    el('span', { class: 'block-type', text: m.label }),
    typeSel, toneSel,
    el('span', { class: 'grow' }),
    meta,
    iconBtn('↑', 'Move up', () => move(i, -1)),
    iconBtn('↓', 'Move down', () => move(i, 1)),
    iconBtn('⎘', 'Duplicate', () => duplicate(i)),
    iconBtn('×', 'Delete', () => removeBlock(i)),
  ]);

  const scriptTa = el('textarea', {
    class: 'script', placeholder: 'Script text the creator says on camera…',
    rows: '2', oninput: (e) => { b.text = e.target.value; stampBlock(b); liveUpdate(); updateMeta(); },
  });
  scriptTa.value = b.text || '';

  const visTa = el('textarea', {
    placeholder: 'Visual note (private — never exported to teleprompter)',
    oninput: (e) => { b.visualNote = e.target.value; stampBlock(b); persist(false); broadcast(); },
  });
  visTa.value = b.visualNote || '';
  const dirTa = el('textarea', {
    placeholder: 'Director note (private — stripped from all exports)',
    oninput: (e) => { b.directorNote = e.target.value; stampBlock(b); persist(false); broadcast(); },
  });
  dirTa.value = b.directorNote || '';

  const pinIn = el('input', {
    type: 'text', inputmode: 'decimal', placeholder: 'auto',
    'aria-label': 'Locked duration in seconds',
    'data-tip': 'Leave on "auto" to time this block from your pace, or type a number of seconds to lock it (overrides the pace calculation)',
    oninput: (e) => { b.pinnedDuration = e.target.value.trim(); stampBlock(b); liveUpdate(); updateMeta(); },
  });
  pinIn.value = b.pinnedDuration || '';

  function updateMeta() {
    const tb = scriptTiming(script, S).blocks[i];
    meta.textContent = `${tb.words} words · ${fmtDuration(tb.duration)}`;
    meta.classList.toggle('pinned', tb.pinned);
  }
  updateMeta();

  // Mobile only: notes start collapsed so the spoken script leads. The
  // toggle is hidden on desktop, where notes are always shown.
  const hasNotes = !!((b.visualNote || '').trim() || (b.directorNote || '').trim());
  if (hasNotes) wrap.classList.add('notes-on');
  const notesToggle = el('button', {
    class: 'btn btn-sm btn-ghost notes-toggle',
    onclick: () => wrap.classList.toggle('notes-on'),
  }, 'Notes');

  wrap.append(
    head, scriptTa, notesToggle,
    el('div', { class: 'notes' }, [visTa, dirTa]),
    el('div', { class: 'block-foot' }, [
      el('label', {
        class: 'pin',
        'data-tip': 'Lock this block to a fixed length instead of timing it from your pace',
      }, [
        el('span', { class: 'pin-lbl', text: 'Lock duration' }),
        pinIn,
        el('span', { class: 'pin-unit', text: 'sec' }),
      ]),
    ]),
  );
  return wrap;
}

function iconBtn(glyph, title, onclick) {
  return el('button', { class: 'ico', 'data-tip': title, 'aria-label': title, onclick }, glyph);
}

function addBar() {
  const bar = el('div', { class: 'addbar' }, el('span', { class: 'lbl' }, 'Add block'));
  for (const t of BLOCK_TYPES) {
    const c = el('button', {
      class: 'chip', onclick: () => {
        const nb = newBlock(t.id); stampBlock(nb); script.blocks.push(nb);
        stampOrder(); renderBuilder(); liveUpdate();
      },
    }, t.label);
    c.style.setProperty('--bt', cssVal(t.token));
    bar.append(c);
  }
  bar.append(el('p', { class: 'addbar-hint', html:
    'Typical order: <b>Hook → Problem → Bridge → Demo → Social proof → '
    + 'Objection handler → CTA</b>. A Transition can link any two. New blocks '
    + 'drop at the end — drag is not needed, reorder with the ↑ ↓ arrows on '
    + 'each block.' }));
  return bar;
}

function move(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= script.blocks.length) return;
  [script.blocks[i], script.blocks[j]] = [script.blocks[j], script.blocks[i]];
  stampOrder(); renderBuilder(); liveUpdate();
}
function duplicate(i) {
  const copy = { ...script.blocks[i], id: db.uid() };
  stampBlock(copy); script.blocks.splice(i + 1, 0, copy);
  stampOrder(); renderBuilder(); liveUpdate();
}
function removeBlock(i) {
  if (script.blocks.length <= 1) return;
  script.blocks.splice(i, 1);
  stampOrder(); renderBuilder(); liveUpdate();
}

$('#scriptTitle').addEventListener('input', (e) => {
  script.title = e.target.value; stampMeta(); persist(false); renderSub(); broadcast();
});

// Keyboard: Ctrl/Cmd+D duplicates the focused block.
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
    const card = document.activeElement.closest && document.activeElement.closest('.block');
    if (card) {
      e.preventDefault();
      duplicate($$('#blocks .block').indexOf(card));
    }
  }
});

// ---- Timeline -----------------------------------------------------------

function renderTimeline() {
  const tl = $('#timeline');
  tl.innerHTML = '';
  const segs = timing.blocks.filter((b) => b.duration > 0 || (b.text || '').trim());
  const t = $('#totals');
  const st = $('#status');
  if (!segs.length) {
    const p = timing.platform;
    tl.className = 'timeline-ghost';
    tl.append(
      el('span', { class: 'zero', text: '0:00' }),
      el('div', { class: 'rail' }),
      el('span', { class: 'tgt',
        text: `${p.label} sweet spot · ${Math.round(p.sweet)}s` }),
    );
    t.innerHTML = '';
    st.className = 'status';
    st.textContent = S.calibrated
      ? 'Start writing. Every block times itself to your pace as you type — nothing to press.'
      : 'Start writing — the timeline builds as you go. Calibrate your pace for times tuned to your real voice.';
    renderFrame();
    return;
  }
  {
    tl.className = 'timeline';
    for (const b of segs) {
      const m = blockMeta(b.type);
      const seg = el('div', { class: 'seg-b', 'data-tip': `${m.label} — ${fmtDuration(b.duration)}` }, [
        el('b', { text: m.short || m.label }),
        el('span', { text: fmtDuration(b.duration) }),
      ]);
      seg.style.background = cssVal(m.token);
      seg.style.flex = Math.max(b.duration, 0.6);
      tl.append(seg);
    }
    // Labels are intentional short words. If a thin segment can't fit its
    // word, step down to the initial — never a truncated, broken-looking
    // word. Too thin even for that: drop the label; color + duration carry
    // it, and the full name is always one hover away (data-tip).
    segs.forEach((b, i) => {
      const lab = tl.children[i].firstChild;
      const m = blockMeta(b.type);
      if (lab.scrollWidth > lab.clientWidth + 1) lab.textContent = m.code || (m.short || m.label).charAt(0);
      if (lab.scrollWidth > lab.clientWidth + 1) lab.style.display = 'none';
    });
  }

  t.innerHTML = '';
  t.append(
    el('div', {}, [el('span', { class: 'big', text: fmtDuration(timing.totalDuration) }), ' total']),
    el('div', { text: `${timing.totalWords} words` }),
    el('div', { text: `${timing.wpm} wpm` }),
    el('div', { text: timing.platform.label }),
  );

  st.className = 'status ' + timing.status;
  st.textContent = statusMessage(timing);

  renderFrame();
}

function renderFrame() {
  const f = $('#frame');
  const fmt = FORMATS.find((x) => x.id === script.format) || FORMATS[0];
  const maxH = 150;
  let h = maxH, w = (fmt.w / fmt.h) * h;
  if (w > 240) { w = 240; h = (fmt.h / fmt.w) * w; }
  f.style.width = Math.round(w) + 'px';
  f.style.height = Math.round(h) + 'px';
  f.setAttribute('data-fmt', fmt.id);

  // Fill the frame with the block composition, proportional to duration —
  // a live thumbnail of how the video breaks down.
  f.innerHTML = '';
  const segs = (timing.blocks || []).filter((b) => b.duration > 0);
  const total = timing.totalDuration || 0;
  // With blocks, the frame fills with the live composition. Empty, it is
  // just the clean format outline — never a broken-looking placeholder.
  if (segs.length && total > 0) {
    for (const b of segs) {
      const m = blockMeta(b.type);
      const s = el('div', {
        class: 'frame-seg',
        'data-tip': `${m.label} — ${fmtDuration(b.duration)}`,
      });
      s.style.height = (b.duration / total) * 100 + '%';
      s.style.background = cssVal(m.token);
      f.append(s);
    }
  }
  f.append(el('span', { class: 'frame-tag', text: fmt.id }));
}

// ---- Exports ------------------------------------------------------------

function openDoc(artifact) {
  const w = window.open('', '_blank');
  if (!w) { alert('Allow pop-ups to export. Then try again.'); return; }
  w.document.open(); w.document.write(artifact.html); w.document.close();
}

async function copyText(text, label) {
  try { await navigator.clipboard.writeText(text); toast(`${label} copied`); }
  catch { toast('Copy failed — clipboard blocked'); }
}

function download(blob, name) {
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function wireExports() {
  const exportTele = () => {
    const pt = Number($('#telePt').value) || 22;
    openDoc(ex.teleprompter(script, S, pt));
  };
  $('#exTele').onclick = exportTele;
  $('#mexTele').onclick = exportTele; // mobile sticky bar — same action
  $('#exDir').onclick = () => openDoc(ex.directorBrief(script, S));
  $('#exShot').onclick = () => openDoc(ex.shotList(script, S));
  $('#exPlain').onclick = () => copyText(ex.plainText(script, S), 'Script text');
  $('#exCap').onclick = () => copyText(ex.captionDraft(script), 'Caption draft');
  $('#exBatch').onclick = () => openPanel('vault');
}

let toastTimer;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = el('div', { id: 'toast', class: 'consent' }); document.body.append(t); }
  t.textContent = msg;
  t.style.maxWidth = '320px'; t.style.justifyContent = 'center';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2200);
}

// ---- Panels -------------------------------------------------------------

const PANELS = {};
function wirePanels() {
  $('#scrim').onclick = closePanels;
  $$('.panel [data-close]').forEach((b) => (b.onclick = closePanels));
  wireExports();
}

function openPanel(name) {
  $('#scrim').classList.add('open');
  $(`#panel-${name}`).classList.add('open');
  ({ vault: renderVault, hooks: renderHooks, frameworks: renderFrameworks,
     ctas: renderCtas, calib: renderCalib, live: renderLive }[name] || (() => {}))();
}
function closePanels() {
  $('#scrim').classList.remove('open');
  $$('.panel').forEach((p) => p.classList.remove('open'));
}

// ---- Live co-edit session ----------------------------------------------
// Peer-to-peer, user-initiated. No Hookline server, no TURN relay: the script
// travels only to the person the user hands the session code to. A STUN
// server is contacted only for address discovery — it sees an IP, never the
// script. Convergence is per-block Last-Write-Wins on a Lamport
// clock, ties broken by a stable per-session id. Honest limit: simultaneous
// edits to the SAME block resolve last-write-wins (different blocks: both
// kept) — char-level merge would need a CRDT, which the no-dependency rule
// forbids. Surfaced in the panel, not hidden.

const SELF = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())).slice(0, 8);
const clock = makeClock();
const live = { peer: null, state: 'idle', applying: false, remoteStream: null, uiConnected: false };
const ZERO_ICE = 'No network candidates were gathered — your browser or network '
  + 'is blocking outbound UDP, so this code will not connect. Try a different '
  + 'network; the no-relay design cannot work around a blocked stack.';
let syncTimer;

const META_KEYS = ['title', 'platform', 'format', 'language', 'paceStyle', 'status', 'campaign'];

function stampBlock(b) { if (!live.applying) { b._v = clock.tick(); b._by = SELF; } }
function stampMeta() { if (!live.applying) { script._metaV = clock.tick(); script._metaBy = SELF; } }
function stampOrder() { if (!live.applying) { script._orderV = clock.tick(); script._orderBy = SELF; } }

function wins(v, by, curV, curBy) {
  v = v || 0; curV = curV || 0;
  return v > curV || (v === curV && String(by) > String(curBy));
}

function snapshot() {
  return {
    k: 'sync',
    blocks: script.blocks.map((b) => ({ ...b })),
    order: script.blocks.map((b) => b.id),
    orderV: script._orderV || 0, orderBy: script._orderBy || '',
    meta: Object.fromEntries(META_KEYS.map((k) => [k, script[k]])),
    metaV: script._metaV || 0, metaBy: script._metaBy || '',
  };
}

function applySnapshot(s) {
  // No special-case wholesale adopt: that silently wiped a joiner's document
  // on connect. Everything converges by per-block Last-Write-Wins — the side
  // that actually edited has higher Lamport stamps, so its doc wins
  // deterministically; the other side's untouched seed blocks drop out via
  // the order filter below. Symmetric, non-destructive, less code.
  const local = new Map(script.blocks.map((b) => [b.id, b]));
  for (const inc of s.blocks) {
    clock.observe(inc._v);
    const cur = local.get(inc.id);
    if (!cur || wins(inc._v, inc._by, cur._v, cur._by)) local.set(inc.id, { ...inc });
  }
  clock.observe(s.orderV); clock.observe(s.metaV);
  // Order LWW decides membership + sequence; unknown ids resolve to whatever
  // block message carried them (or are dropped if never seen).
  let order = script.blocks.map((b) => b.id);
  if (wins(s.orderV, s.orderBy, script._orderV, script._orderBy)) {
    order = s.order; script._orderV = s.orderV; script._orderBy = s.orderBy;
  }
  script.blocks = order.map((id) => local.get(id)).filter(Boolean);
  if (wins(s.metaV, s.metaBy, script._metaV, script._metaBy)) {
    META_KEYS.forEach((k) => { if (s.meta[k] !== undefined) script[k] = s.meta[k]; });
    script._metaV = s.metaV; script._metaBy = s.metaBy;
  }
  live.applying = true;
  try {
    buildTopbar(); renderBuilder(); liveUpdate();
  } finally { live.applying = false; }
}

function broadcast() {
  if (!live.peer || !live.peer.connected || live.applying) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => live.peer && live.peer.send(snapshot()), 200);
}

function onLiveState(state) {
  live.state = state;
  // Both peers send their snapshot on connect; per-block LWW reconciles them
  // deterministically (edited doc wins). Symmetric — no host/guest asymmetry.
  if (state === 'connected' && live.peer) {
    live.peer.send(snapshot());
  }
  // Only tear down on a terminal state. 'disconnected' is transient and can
  // recover — destroying the peer there guarantees it never reconnects.
  if (state === 'closed' || state === 'failed') {
    if (live.peer) { live.peer.close(); }
    live.peer = null; live.remoteStream = null;
  }
  buildTopbar();
  // Re-render the panel ONLY when the settled connected-ness flips, never on
  // transient 'new'/'connecting'/'disconnected' — a full rebuild mid-
  // handshake wipes the offer/answer codes before they can be exchanged.
  // Otherwise just update the live status line in place.
  const nowConn = !!(live.peer && live.peer.connected);
  const open = $('#panel-live').classList.contains('open');
  if (open && (nowConn !== live.uiConnected || state === 'closed' || state === 'failed')) {
    renderLive();
  } else if (open) {
    const s = $('#liveStatus');
    if (s) s.textContent = liveStatusText();
  }
}

function liveStatusText() {
  if (live.peer && live.peer.connected) return 'Connected — co-editing live.';
  switch (live.state) {
    case 'connecting': case 'new': case 'checking':
      return 'Connecting… keep this panel open.';
    case 'disconnected':
      return 'Connection dropped. There is no server to resume from — by design, '
        + 'so nothing about the session is stored anywhere. Just start a new '
        + 'session to reconnect; you can do this every time it drops.';
    case 'failed':
      return 'Could not connect. This is peer-to-peer with no relay, so it '
        + 'fails behind strict symmetric NATs (some corporate or mobile '
        + 'networks). Try again on a different network — and remember the '
        + 'session is meant to be retried, not persistent.';
    default: return '';
  }
}

function onLiveMessage(msg) {
  if (msg.k === 'sync') return applySnapshot(msg);
  if (msg.k === 'rtc-offer' || msg.k === 'rtc-answer') return live.peer && live.peer.onSignal(msg);
  if (msg.k === 'screen' && !msg.on) { live.remoteStream = null; if ($('#panel-live').classList.contains('open')) renderLive(); }
}

function newPeer() {
  return createPeer({
    onstate: onLiveState,
    onmessage: onLiveMessage,
    ontrack: (stream) => {
      live.remoteStream = stream;
      if ($('#panel-live').classList.contains('open')) renderLive();
    },
    onscreenend: () => { live.peer && live.peer.send({ k: 'screen', on: false }); },
  });
}

function copyBtn(getText) {
  return el('button', {
    class: 'btn btn-sm', onclick: async (e) => {
      try { await navigator.clipboard.writeText(getText()); e.target.textContent = 'Copied'; }
      catch (_) { e.target.textContent = 'Copy failed — select manually'; }
    },
  }, 'Copy');
}

function renderLive() {
  const body = $('#liveBody');
  body.innerHTML = '';
  live.uiConnected = !!(live.peer && live.peer.connected);
  const note = el('p', { class: 'sub', text:
    'Peer-to-peer and user-initiated. No Hookline server, no relay — the script '
    + 'goes only to the person you send the code to. A public STUN server is '
    + 'used to discover each side’s address; it sees an IP, never the script. '
    + 'Simultaneous edits to the same block resolve last-write-wins. Sessions '
    + 'are deliberately not persistent: there is no server holding the link '
    + 'open, so if it drops you just start a new one. That impermanence is the '
    + 'point — nothing about the connection lives anywhere but the two browsers in it.' });
  const status = el('p', { id: 'liveStatus', class: 'live-status', text: liveStatusText() });

  if (live.peer && live.peer.connected) {
    const sharing = el('button', { class: 'btn', onclick: async () => {
      try {
        await live.peer.shareScreen();
        live.peer.send({ k: 'screen', on: true });
        renderLive();
      } catch (_) {}
    } }, 'Share my screen');
    const leave = el('button', { class: 'btn', onclick: () => { live.peer.send({ k: 'screen', on: false }); live.peer.close(); live.peer = null; live.remoteStream = null; buildTopbar(); renderLive(); } }, 'Leave session');
    const kids = [
      el('div', { class: 'card' }, [
        el('div', { class: 'ttl', text: 'Connected — co-editing live' }),
        el('div', { class: 'sub', text: 'Edits sync both ways automatically.' }),
      ]),
      note,
      el('div', { class: 'lib-tools' }, [sharing, leave]),
    ];
    if (live.remoteStream) {
      const v = el('video', { class: 'live-video', autoplay: 'true', playsinline: 'true' });
      v.srcObject = live.remoteStream; v.muted = true;
      kids.push(el('div', { class: 'ttl', text: 'Their screen' }), v);
    }
    body.append(...kids);
    return;
  }

  const offerOut = el('textarea', { class: 'calib-sample live-code', readonly: 'true', rows: '4', placeholder: 'Session code appears here' });
  const answerOut = el('textarea', { class: 'calib-sample live-code', readonly: 'true', rows: '4', placeholder: 'Reply code appears here' });
  const pasteIn = el('textarea', { class: 'live-code', rows: '4', placeholder: 'Paste the code from the other person here' });

  const hostBtn = el('button', { class: 'btn btn-primary', onclick: async () => {
    live.peer = newPeer();
    hostBtn.disabled = true; hostBtn.textContent = 'Generating code…';
    try {
      offerOut.value = await live.peer.createOffer();
      hostFlow.classList.add('on');
      iceWarn.textContent = live.peer.iceCount === 0 ? ZERO_ICE : '';
    } catch (e) { hostBtn.textContent = 'Failed — retry'; hostBtn.disabled = false; }
  } }, 'Start a session (you host)');

  const connectBtn = el('button', { class: 'btn btn-primary', onclick: async () => {
    try { await live.peer.acceptAnswer(pasteIn.value); }
    catch (e) { connectBtn.textContent = 'Invalid reply code'; }
  } }, 'Connect with their reply');

  const iceWarn = el('p', { class: 'live-status', text: '' });
  const hostFlow = el('div', { class: 'live-flow' }, [
    el('p', { class: 'sub', text: '1. Send this code to the other person:' }),
    offerOut, copyBtn(() => offerOut.value), iceWarn,
    el('p', { class: 'sub', text: '2. Paste their reply code, then connect:' }),
    pasteIn, connectBtn,
  ]);

  const joinIn = el('textarea', { class: 'live-code', rows: '4', placeholder: 'Paste the host’s session code here' });
  const joinBtn = el('button', { class: 'btn btn-primary', onclick: async () => {
    live.peer = newPeer();
    joinBtn.disabled = true; joinBtn.textContent = 'Generating reply…';
    try {
      answerOut.value = await live.peer.acceptOffer(joinIn.value);
      joinFlow.classList.add('on');
      jIceWarn.textContent = live.peer.iceCount === 0 ? ZERO_ICE : '';
    } catch (e) { joinBtn.textContent = 'Invalid session code'; joinBtn.disabled = false; }
  } }, 'Generate my reply');
  const jIceWarn = el('p', { class: 'live-status', text: '' });
  const joinFlow = el('div', { class: 'live-flow' }, [
    el('p', { class: 'sub', text: 'Send this reply code back to the host:' }),
    answerOut, copyBtn(() => answerOut.value), jIceWarn,
    el('p', { class: 'sub', text: 'You connect automatically once they accept it.' }),
  ]);

  body.append(
    note, status,
    el('div', { class: 'card' }, [
      el('div', { class: 'ttl', text: 'Host a session' }),
      hostBtn, hostFlow,
    ]),
    el('div', { class: 'card' }, [
      el('div', { class: 'ttl', text: 'Join a session' }),
      joinIn, joinBtn, joinFlow,
    ]),
  );
}

function newScript() {
  script = blankScript();
  S = liveSet({ draftScriptId: null });
  persist(true);
  buildTopbar(); renderBuilder(); liveUpdate();
  closePanels();
}

// ---- Vault --------------------------------------------------------------

const STATUSES = ['draft', 'ready', 'filmed', 'published', 'archived'];

async function renderVault() {
  const body = $('#vaultBody');
  const list = await db.scripts.all();
  const camps = await db.campaigns.all();

  const q = el('input', { type: 'search', placeholder: 'Search scripts, tone, notes…' });
  const fStatus = el('select', {}, el('option', { value: '' }, 'Any status'));
  STATUSES.forEach((s) => fStatus.append(el('option', { value: s }, cap(s))));
  const fCamp = el('select', {}, el('option', { value: '' }, 'Any campaign'));
  camps.forEach((c) => fCamp.append(el('option', { value: c.name }, c.name)));
  const sortSel = el('select', {}, ...[
    ['recent', 'Most recent'], ['duration', 'Duration'], ['platform', 'Platform'],
    ['status', 'Status'],
  ].map(([v, l]) => el('option', { value: v }, l)));

  const results = el('div');
  const tools = el('div', { class: 'lib-tools' }, [
    q, fStatus, fCamp, sortSel,
    el('button', { class: 'btn btn-sm', onclick: addCampaign }, '+ Campaign'),
  ]);

  // Analytics summary
  const totalDur = list.reduce((s, x) => s + scriptTiming(x, S).totalDuration, 0);
  const typeCount = {};
  list.forEach((x) => (x.blocks || []).forEach((b) => (typeCount[b.type] = (typeCount[b.type] || 0) + 1)));
  const topType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0];
  const stats = el('div', { class: 'card' }, [
    el('div', { class: 'ttl', text: 'Your patterns' }),
    el('div', { class: 'sub' }, [
      `${list.length} scripts`,
      `avg ${list.length ? fmtDuration(totalDur / list.length) : '0s'}`,
      `most-used block: ${topType ? blockMeta(topType[0]).label : '—'}`,
    ]),
  ]);

  function draw() {
    const term = q.value.trim().toLowerCase();
    let rows = list.filter((x) => {
      if (fStatus.value && (x.status || 'draft') !== fStatus.value) return false;
      if (fCamp.value && x.campaign !== fCamp.value) return false;
      if (!term) return true;
      if ((x.title || '').toLowerCase().includes(term)) return true;
      return (x.blocks || []).some((b) =>
        [b.text, b.tone, b.visualNote, b.directorNote]
          .some((v) => (v || '').toLowerCase().includes(term)));
    });
    const dur = (x) => scriptTiming(x, S).totalDuration;
    rows.sort((a, b) => {
      if (sortSel.value === 'duration') return dur(b) - dur(a);
      if (sortSel.value === 'platform') return (a.platform || '').localeCompare(b.platform || '');
      if (sortSel.value === 'status') return (a.status || '').localeCompare(b.status || '');
      return b.updatedAt - a.updatedAt;
    });

    results.innerHTML = '';
    if (!rows.length) { results.append(el('div', { class: 'empty', text: 'No scripts yet. Close this and start writing.' })); return; }

    // Batch export bar
    const picked = new Set();
    const batchBtn = el('button', { class: 'btn btn-sm', disabled: 'true',
      onclick: () => {
        const chosen = rows.filter((r) => picked.has(r.id));
        const blob = ex.batchTeleprompterZip(chosen, S, 22);
        download(blob, 'hookline-teleprompters.zip');
        toast(`${chosen.length} teleprompters zipped`);
      } }, 'Batch export ZIP');
    results.append(el('div', { class: 'lib-tools' }, [batchBtn,
      el('span', { class: 'sub', text: 'Tick scripts to batch-export teleprompter PDFs.' })]));

    for (const x of rows) {
      const t = scriptTiming(x, S);
      const pick = el('input', { type: 'checkbox', onchange: (e) => {
        e.target.checked ? picked.add(x.id) : picked.delete(x.id);
        batchBtn.disabled = picked.size === 0;
      } });
      const stSel = el('select', { onchange: async (e) => {
        x.status = e.target.value; await db.scripts.save(x);
        if (x.id === script.id) { script.status = x.status; renderSub(); }
      } });
      STATUSES.forEach((s) => {
        const o = el('option', { value: s }, cap(s));
        if ((x.status || 'draft') === s) o.selected = true;
        stSel.append(o);
      });
      results.append(el('div', { class: 'card' }, [
        el('div', { class: 'top' }, [
          pick,
          el('div', { class: 'grow' }, [
            el('div', { class: 'ttl', text: x.title || 'Untitled script' }),
            el('div', { class: 'sub', text: [
              (PLATFORMS.find((p) => p.id === x.platform) || {}).label || x.platform,
              fmtDuration(t.totalDuration), `${t.totalWords} words`,
              x.campaign || 'no campaign',
            ].join(' · ') }),
          ]),
          stSel,
        ]),
        el('div', { class: 'row-acts' }, [
          el('button', { class: 'btn btn-sm btn-primary', onclick: () => openScript(x.id) }, 'Open'),
          el('button', { class: 'btn btn-sm', onclick: async () => {
            const copy = { ...x, id: null, title: (x.title || 'Untitled') + ' (copy)',
              blocks: x.blocks.map((b) => ({ ...b, id: db.uid() })) };
            await db.scripts.save(copy); renderVault();
          } }, 'Duplicate'),
          el('button', { class: 'btn btn-sm', onclick: () => assignCampaign(x) }, 'Campaign'),
          el('button', { class: 'btn btn-sm', onclick: async () => {
            if (!confirm('Delete this script permanently?')) return;
            await db.scripts.remove(x.id);
            if (x.id === script.id) newScript();
            renderVault();
          } }, 'Delete'),
        ]),
      ]));
    }
  }
  [q, fStatus, fCamp, sortSel].forEach((c) => c.addEventListener('input', draw));

  body.innerHTML = '';
  body.append(tools, stats, results);
  draw();
}

async function addCampaign() {
  const name = prompt('Campaign name (a folder like "Q4 collagen launch")');
  if (!name) return;
  await db.campaigns.save({ name: name.trim() });
  renderVault();
}
async function assignCampaign(x) {
  const camps = await db.campaigns.all();
  const name = prompt('Assign to campaign (existing or new; blank to clear):\n' +
    camps.map((c) => '• ' + c.name).join('\n'), x.campaign || '');
  if (name === null) return;
  const trimmed = name.trim();
  if (trimmed && !camps.some((c) => c.name === trimmed)) await db.campaigns.save({ name: trimmed });
  x.campaign = trimmed; await db.scripts.save(x);
  if (x.id === script.id) { script.campaign = trimmed; renderSub(); }
  renderVault();
}

async function openScript(id) {
  script = await db.scripts.get(id);
  S = liveSet({ draftScriptId: id });
  buildTopbar(); renderBuilder(); liveUpdate(); closePanels();
}

// ---- Hook library -------------------------------------------------------

const HOOK_CATS = ['curiosity-gap', 'pattern-interrupt', 'bold-claim',
  'relatability', 'controversy', 'transformation', 'fomo'];
const NICHES = ['general', 'beauty', 'fitness', 'finance', 'food',
  'parenting', 'tech', 'travel', 'fashion'];

async function renderHooks() {
  const body = $('#hooksBody');
  const list = await db.hooks.all();

  const q = el('input', { type: 'search', placeholder: 'Search hooks…' });
  const fCat = el('select', {}, el('option', { value: '' }, 'All categories'));
  HOOK_CATS.forEach((c) => fCat.append(el('option', { value: c }, c.replace(/-/g, ' '))));
  const fNiche = el('select', {}, el('option', { value: '' }, 'All niches'));
  NICHES.forEach((n) => fNiche.append(el('option', { value: n }, n)));
  const fRate = el('select', {}, ...[['', 'Any rating'], ['4', '4+ stars'],
    ['5', '5 stars']].map(([v, l]) => el('option', { value: v }, l)));

  const results = el('div');
  const tools = el('div', { class: 'lib-tools' }, [
    q, fCat, fNiche, fRate,
    el('button', { class: 'btn btn-sm', onclick: () => editHook({}) }, '+ Hook'),
    el('button', { class: 'btn btn-sm', onclick: () => exportHooksCsv(list) }, 'Export CSV'),
    el('button', { class: 'btn btn-sm', onclick: importHooksCsv }, 'Import CSV'),
  ]);

  function draw() {
    const term = q.value.trim().toLowerCase();
    let rows = list.filter((h) => {
      if (fCat.value && h.category !== fCat.value) return false;
      if (fNiche.value && h.niche !== fNiche.value) return false;
      if (fRate.value && (h.rating || 0) < Number(fRate.value)) return false;
      if (term && !(`${h.text} ${h.tone} ${h.source}`.toLowerCase().includes(term))) return false;
      return true;
    }).sort((a, b) => (b.rating || 0) - (a.rating || 0));
    results.innerHTML = '';
    results.append(el('div', { class: 'sub', text: `${rows.length} hooks` }));
    for (const h of rows) results.append(hookCard(h));
  }
  [q, fCat, fNiche, fRate].forEach((c) => c.addEventListener('input', draw));
  body.innerHTML = ''; body.append(tools, results); draw();
}

function stars(value, onSet) {
  const wrap = el('span', { class: 'stars', 'data-tip': 'Rate' });
  for (let i = 1; i <= 5; i++) {
    const s = el('i', { text: '★', class: i <= (value || 0) ? 'on' : '' });
    s.onclick = () => onSet(i === value ? 0 : i);
    wrap.append(s);
  }
  return wrap;
}

function hookCard(h) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'top' }, [
      el('div', { class: 'grow' }, [
        el('div', { class: 'ttl', text: h.text }),
        el('div', { class: 'sub' }, [
          el('span', { class: 'pill', text: (h.category || '').replace(/-/g, ' ') }),
          el('span', { class: 'pill', text: h.niche || 'general' }),
          h.tone ? el('span', { class: 'pill', text: h.tone }) : null,
          h.source ? `src: ${h.source}` : null,
        ]),
      ]),
      stars(h.rating, async (v) => { h.rating = v; await db.hooks.save(h); renderHooks(); }),
    ]),
    el('div', { class: 'row-acts' }, [
      el('button', { class: 'btn btn-sm btn-primary', onclick: () => insertHook(h) }, 'Use in Hook block'),
      el('button', { class: 'btn btn-sm', onclick: () => editHook(h) }, 'Edit'),
      el('button', { class: 'btn btn-sm', onclick: async () => {
        if (!confirm('Delete this hook?')) return;
        await db.hooks.remove(h.id); renderHooks();
      } }, 'Delete'),
    ]),
  ]);
}

function insertHook(h) {
  let hb = script.blocks.find((b) => b.type === 'hook');
  if (!hb) { hb = newBlock('hook'); script.blocks.unshift(hb); }
  hb.text = h.text;
  renderBuilder(); liveUpdate(); closePanels();
  toast('Hook inserted');
}

function editHook(h) {
  const isNew = !h.id;
  const text = prompt('Hook text (use [brackets] for fill-in parts):', h.text || '');
  if (text == null) return;
  const category = prompt('Category (' + HOOK_CATS.join(', ') + '):', h.category || 'curiosity-gap');
  const niche = prompt('Niche (' + NICHES.join(', ') + '):', h.niche || 'general');
  const tone = prompt('Tone (optional):', h.tone || '');
  const source = prompt('Source (creator/brand you saw it use, optional):', h.source || '');
  db.hooks.save({ ...h, text: text.trim(), category: (category || '').trim(),
    niche: (niche || 'general').trim(), tone: (tone || '').trim(),
    source: (source || '').trim(), rating: h.rating || 0,
    builtin: isNew ? false : h.builtin }).then(renderHooks);
}

const csvCell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
function exportHooksCsv(list) {
  const head = 'text,category,niche,tone,rating,source';
  const rows = list.map((h) => [h.text, h.category, h.niche, h.tone, h.rating || 0, h.source]
    .map(csvCell).join(','));
  download(new Blob([head + '\n' + rows.join('\n')], { type: 'text/csv' }), 'hookline-hooks.csv');
}
function importHooksCsv() {
  const inp = el('input', { type: 'file', accept: '.csv,text/csv' });
  inp.onchange = async () => {
    const txt = await inp.files[0].text();
    const lines = txt.split(/\r?\n/).filter(Boolean);
    lines.shift();
    let n = 0;
    for (const line of lines) {
      const c = parseCsvLine(line);
      if (!c[0]) continue;
      await db.hooks.save({ text: c[0], category: c[1] || 'curiosity-gap',
        niche: c[2] || 'general', tone: c[3] || '', rating: Number(c[4]) || 0,
        source: c[5] || '', builtin: false });
      n++;
    }
    toast(`${n} hooks imported`); renderHooks();
  };
  inp.click();
}
function parseCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

// ---- Framework gallery --------------------------------------------------

async function renderFrameworks() {
  const body = $('#frameworksBody');
  const list = await db.frameworks.all();
  const q = el('input', { type: 'search', placeholder: 'Search frameworks…' });
  const results = el('div');
  const tools = el('div', { class: 'lib-tools' }, [
    q, el('button', { class: 'btn btn-sm', onclick: saveCurrentAsFramework },
      'Save current script as framework'),
  ]);
  function draw() {
    const term = q.value.trim().toLowerCase();
    const rows = list.filter((f) =>
      !term || `${f.name} ${f.category}`.toLowerCase().includes(term));
    results.innerHTML = '';
    for (const f of rows) {
      const est = f.blocks.reduce((s, b) =>
        s + (b.text ? b.text.trim().split(/\s+/).length : 0), 0);
      results.append(el('div', { class: 'card' }, [
        el('div', { class: 'top' }, [
          el('div', { class: 'grow' }, [
            el('div', { class: 'ttl', text: f.name }),
            el('div', { class: 'sub' }, [
              el('span', { class: 'pill', text: (f.category || '').replace(/-/g, ' ') }),
              `${f.blocks.length} blocks`,
              `~${Math.round(est / (S.pace[S.defaultStyle] / 60))}s`,
            ]),
          ]),
        ]),
        el('div', { class: 'row-acts' }, [
          el('button', { class: 'btn btn-sm btn-primary', onclick: () => useFramework(f) }, 'Open framework'),
          f.builtin ? null : el('button', { class: 'btn btn-sm', onclick: async () => {
            if (!confirm('Delete this framework?')) return;
            await db.frameworks.remove(f.id); renderFrameworks();
          } }, 'Delete'),
        ]),
      ]));
    }
  }
  q.addEventListener('input', draw);
  body.innerHTML = ''; body.append(tools, results); draw();
}

function useFramework(f) {
  if (script.blocks.some((b) => (b.text || '').trim()) &&
      !confirm('Replace the current script blocks with this framework? ' +
               'Your script text will be overwritten.')) return;
  script.blocks = f.blocks.map((b) => newBlockFrom(b));
  renderBuilder(); liveUpdate(); closePanels();
  toast(`Framework "${f.name}" loaded`);
}
const newBlockFrom = (b) => ({ ...newBlock(b.type, b.text || ''), tone: b.tone || '' });

async function saveCurrentAsFramework() {
  const name = prompt('Framework name:');
  if (!name) return;
  const category = prompt('Category tag:', 'custom') || 'custom';
  await db.frameworks.save({
    name: name.trim(), category: category.trim(), builtin: false,
    blocks: script.blocks.map((b) => ({ type: b.type, text: b.text, tone: b.tone })),
  });
  toast('Saved as framework'); renderFrameworks();
}

// ---- CTA builder --------------------------------------------------------

const CTA_FORMATS = ['follow', 'link-in-bio', 'comment-trigger', 'save-prompt',
  'duet', 'product'];

async function renderCtas() {
  const body = $('#ctasBody');
  const list = await db.ctas.all();
  const fFmt = el('select', {}, el('option', { value: '' }, 'All formats'));
  CTA_FORMATS.forEach((f) => fFmt.append(el('option', { value: f }, f.replace(/-/g, ' '))));
  const fPlat = el('select', {}, el('option', { value: '' }, 'All platforms'),
    ...PLATFORMS.map((p) => el('option', { value: p.id }, p.label)));

  const gen = el('div', { class: 'card' }, [
    el('div', { class: 'ttl', text: 'Comment-trigger generator' }),
    el('div', { class: 'sub', text: 'Type your topic. Get comment-bait prompts that drive the algorithm. No AI — proven templates.' }),
  ]);
  const topic = el('input', { type: 'text', placeholder: 'your topic (e.g. meal prep)', style: 'margin-top:8px' });
  const genOut = el('div');
  const genBtn = el('button', { class: 'btn btn-sm', style: 'margin-top:8px',
    onclick: () => {
      const tp = topic.value.trim() || 'this';
      const ideas = [
        `Comment "yes" if ${tp} has happened to you.`,
        `Which one are you with ${tp} — 1 or 2? Comment below.`,
        `Comment "${tp.split(' ')[0] || 'send'}" and I will send you the full breakdown.`,
        `Tell me your biggest ${tp} mistake in the comments.`,
        `Drop a \u{1F44D} if you want part two on ${tp}.`,
      ];
      genOut.innerHTML = '';
      ideas.forEach((t) => genOut.append(el('div', { class: 'card' }, [
        el('div', { text: t }),
        el('div', { class: 'row-acts' }, [
          el('button', { class: 'btn btn-sm btn-primary', onclick: () => insertCta({ text: t }) }, 'Use'),
          el('button', { class: 'btn btn-sm', onclick: async () => {
            await db.ctas.save({ text: t, format: 'comment-trigger', platform: 'tiktok', rating: 0, builtin: false });
            toast('Saved to CTA vault');
          } }, 'Save'),
        ]),
      ])));
    } }, 'Generate');
  gen.append(topic, genBtn, genOut);

  const results = el('div');
  const tools = el('div', { class: 'lib-tools' }, [
    fFmt, fPlat,
    el('button', { class: 'btn btn-sm', onclick: () => editCta({}) }, '+ CTA'),
  ]);
  function draw() {
    let rows = list.filter((c) => {
      if (fFmt.value && c.format !== fFmt.value) return false;
      if (fPlat.value && c.platform !== 'any' && c.platform !== fPlat.value) return false;
      return true;
    }).sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const recFmt = { tiktok: 'comment-trigger', reels: 'save-prompt', shorts: 'follow' }[script.platform];
    results.innerHTML = '';
    if (recFmt) results.append(el('div', { class: 'sub',
      text: `Tip: ${PLATFORMS.find((p) => p.id === script.platform).label} favors "${recFmt.replace(/-/g, ' ')}" CTAs.` }));
    for (const c of rows) {
      results.append(el('div', { class: 'card' }, [
        el('div', { class: 'top' }, [
          el('div', { class: 'grow' }, [
            el('div', { class: 'ttl', text: c.text }),
            el('div', { class: 'sub' }, [
              el('span', { class: 'pill', text: (c.format || '').replace(/-/g, ' ') }),
              el('span', { class: 'pill', text: c.platform || 'any' }),
            ]),
          ]),
          stars(c.rating, async (v) => { c.rating = v; await db.ctas.save(c); renderCtas(); }),
        ]),
        el('div', { class: 'row-acts' }, [
          el('button', { class: 'btn btn-sm btn-primary', onclick: () => insertCta(c) }, 'Use in CTA block'),
          el('button', { class: 'btn btn-sm', onclick: () => editCta(c) }, 'Edit'),
          el('button', { class: 'btn btn-sm', onclick: async () => {
            if (!confirm('Delete this CTA?')) return;
            await db.ctas.remove(c.id); renderCtas();
          } }, 'Delete'),
        ]),
      ]));
    }
  }
  [fFmt, fPlat].forEach((c) => c.addEventListener('input', draw));
  body.innerHTML = ''; body.append(gen, tools, results); draw();
}

function insertCta(c) {
  let cb = [...script.blocks].reverse().find((b) => b.type === 'cta');
  if (!cb) { cb = newBlock('cta'); script.blocks.push(cb); }
  cb.text = c.text;
  renderBuilder(); liveUpdate(); closePanels();
  toast('CTA inserted');
}
function editCta(c) {
  const text = prompt('CTA text:', c.text || '');
  if (text == null) return;
  const format = prompt('Format (' + CTA_FORMATS.join(', ') + '):', c.format || 'follow');
  const platform = prompt('Platform (any, ' + PLATFORMS.map((p) => p.id).join(', ') + '):', c.platform || 'any');
  db.ctas.save({ ...c, text: text.trim(), format: (format || 'follow').trim(),
    platform: (platform || 'any').trim(), rating: c.rating || 0,
    builtin: c.id ? c.builtin : false }).then(renderCtas);
}

// ---- Calibrator ---------------------------------------------------------

let calState = null;

function renderCalib() {
  const body = $('#calibBody');
  body.innerHTML = '';

  const style = el('select', {}, ...STYLES.map((s) =>
    el('option', { value: s.id }, s.label)));
  style.value = script.paceStyle || S.defaultStyle;

  const sample = el('div', { class: 'calib-sample', text: CALIBRATION_SAMPLE });
  const timerEl = el('div', { class: 'calib-timer', text: '0.0s' });
  const result = el('div', { class: 'calib-result' });

  const startBtn = el('button', { class: 'btn btn-primary' }, 'Start reading');
  const stopBtn = el('button', { class: 'btn', disabled: 'true' }, 'Stop');

  let raf, t0;
  startBtn.onclick = () => {
    t0 = performance.now(); startBtn.disabled = true; stopBtn.disabled = false;
    result.textContent = '';
    const tick = () => {
      timerEl.textContent = ((performance.now() - t0) / 1000).toFixed(1) + 's';
      raf = requestAnimationFrame(tick);
    };
    tick();
  };
  stopBtn.onclick = async () => {
    cancelAnimationFrame(raf);
    const elapsed = performance.now() - t0;
    startBtn.disabled = false; stopBtn.disabled = true;
    const wpm = calcWpm(SAMPLE_WORDS, elapsed);
    const id = style.value;
    result.innerHTML = `Your <b>${id}</b> pace: <b>${wpm}</b> wpm`;
    const pace = { ...S.pace, [id]: wpm };
    S = await db.saveSettings({ pace, calibrated: true });
    if ((script.paceStyle || S.defaultStyle) === id) liveUpdate();
    buildTopbar();
  };

  body.append(
    el('div', { class: 'field' }, [el('label', { text: 'Calibrating for delivery style' }), style]),
    el('p', { class: 'sub', text: 'Read the paragraph below out loud the way you actually talk to camera. Hit Start, read it, hit Stop. Set all three styles for the most accurate timing.' }),
    sample, timerEl,
    el('div', { class: 'lib-tools' }, [startBtn, stopBtn]),
    result,
    el('div', { class: 'card' }, [
      el('div', { class: 'ttl', text: 'Current calibration' }),
      el('div', { class: 'sub' }, STYLES.map((s) =>
        `${s.label}: ${S.pace[s.id]} wpm`)),
    ]),
  );
}

boot();
