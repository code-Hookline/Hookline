// timing.js — the pace / duration / language engine. Pure: no DOM, no I/O.
// This is the soul of Hookline. A block's duration is words / (wpm/60),
// scaled by a language multiplier, unless a manual override is pinned.

// Three label widths for the dense timeline bar, picked deliberately (not
// truncated): `short` when the segment fits a word, `code` when it only fits
// an abbreviation, then nothing (color + tooltip carry it). `label` is the
// full name used everywhere else, including the segment tooltip.
export const BLOCK_TYPES = [
  { id: 'hook',       label: 'Hook',              short: 'Hook',       code: 'H',   token: '--b-hook' },
  { id: 'problem',    label: 'Problem',           short: 'Problem',    code: 'P',   token: '--b-problem' },
  { id: 'bridge',     label: 'Bridge',            short: 'Bridge',     code: 'B',   token: '--b-bridge' },
  { id: 'demo',       label: 'Demo',              short: 'Demo',       code: 'Demo', token: '--b-demo' },
  { id: 'proof',      label: 'Social proof',      short: 'Proof',      code: 'Proof', token: '--b-proof' },
  { id: 'objection',  label: 'Objection handler', short: 'Objection',  code: 'OBJ', token: '--b-objection' },
  { id: 'cta',        label: 'CTA',               short: 'CTA',        code: 'CTA', token: '--b-cta' },
  { id: 'transition', label: 'Transition',        short: 'Transition', code: 'TR',  token: '--b-transition' },
];

export const blockMeta = (id) =>
  BLOCK_TYPES.find((b) => b.id === id) || BLOCK_TYPES[0];

export const TONES = [
  'Disruptive', 'Empathetic', 'Curious', 'Urgent', 'Authoritative', 'Playful',
];

// Delivery styles — each maps to a calibrated wpm in settings.pace.
export const STYLES = [
  { id: 'conversational', label: 'Conversational' },
  { id: 'energetic',      label: 'Energetic' },
  { id: 'slow',           label: 'Slow / emotive' },
];

// Spoken-length multiplier relative to English at the same wpm. Romance
// languages and German run longer; CJK syllable-timed languages differ.
export const LANGUAGES = [
  { id: 'en', label: 'English',    mult: 1.00 },
  { id: 'es', label: 'Spanish',    mult: 1.18 },
  { id: 'fr', label: 'French',     mult: 1.17 },
  { id: 'pt', label: 'Portuguese', mult: 1.15 },
  { id: 'de', label: 'German',     mult: 1.12 },
  { id: 'it', label: 'Italian',    mult: 1.16 },
  { id: 'nl', label: 'Dutch',      mult: 1.10 },
  { id: 'ja', label: 'Japanese',   mult: 1.20 },
  { id: 'ko', label: 'Korean',     mult: 1.15 },
  { id: 'zh', label: 'Mandarin',   mult: 0.90 },
];

export const langMult = (id) =>
  (LANGUAGES.find((l) => l.id === id) || LANGUAGES[0]).mult;

// Platform sweet-spots (seconds). warn = past the ideal range; over = long.
export const PLATFORMS = [
  { id: 'tiktok',   label: 'TikTok',          sweet: 34, warn: 60, over: 180 },
  { id: 'reels',    label: 'Instagram Reels', sweet: 30, warn: 90, over: 90 },
  { id: 'shorts',   label: 'YouTube Shorts',  sweet: 40, warn: 60, over: 180 },
  { id: 'linkedin', label: 'LinkedIn Video',  sweet: 60, warn: 120, over: 600 },
  { id: 'twitter',  label: 'Twitter / X',     sweet: 44, warn: 140, over: 140 },
];

export const platformMeta = (id) =>
  PLATFORMS.find((p) => p.id === id) || PLATFORMS[0];

export const FORMATS = [
  { id: '9:16', label: 'Vertical 9:16', w: 9,  h: 16 },
  { id: '1:1',  label: 'Square 1:1',    w: 1,  h: 1 },
  { id: '16:9', label: 'Horizontal 16:9', w: 16, h: 9 },
];

export function countWords(text) {
  const t = (text || '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

// Duration of a single block in seconds. A pinned override wins outright
// (for prop beats, pauses, non-speaking moments).
export function blockDuration(block, wpm, mult) {
  if (block && block.pinnedDuration != null && block.pinnedDuration !== '') {
    return Math.max(0, Number(block.pinnedDuration) || 0);
  }
  const words = countWords(block && block.text);
  if (!words || !wpm) return 0;
  return (words / (wpm / 60)) * mult;
}

export function paceFor(settings, styleId) {
  const id = styleId || settings.defaultStyle || 'conversational';
  return (settings.pace && settings.pace[id]) || 140;
}

// Full timing pass over a script. Returns enriched blocks + totals and the
// platform status so the UI never recomputes timing itself.
export function scriptTiming(script, settings) {
  const wpm = paceFor(settings, script.paceStyle);
  const mult = langMult(script.language || settings.language || 'en');
  const blocks = (script.blocks || []).map((b) => {
    const words = countWords(b.text);
    const duration = blockDuration(b, wpm, mult);
    return { ...b, words, duration, pinned: b.pinnedDuration != null && b.pinnedDuration !== '' };
  });
  const totalWords = blocks.reduce((s, b) => s + b.words, 0);
  const totalDuration = blocks.reduce((s, b) => s + b.duration, 0);
  const platform = platformMeta(script.platform || settings.platform);
  let status = 'ok';
  if (totalDuration > platform.over) status = 'over';
  else if (totalDuration > platform.warn) status = 'warn';
  return { blocks, totalWords, totalDuration, wpm, mult, platform, status };
}

export function fmtDuration(s) {
  const sec = Math.round((s || 0) * 10) / 10;
  if (sec < 60) return sec.toFixed(1) + 's';
  const m = Math.floor(sec / 60);
  const r = Math.round(sec - m * 60);
  return m + 'm ' + String(r).padStart(2, '0') + 's';
}

export function statusMessage(timing) {
  const p = timing.platform;
  const d = timing.totalDuration || 0;
  // Words scale with time at the calibrated pace, so the actionable lever is
  // a word count, not "talk faster" — pace is measured, not a dial to spin.
  const wordsFor = (secs) => (d > 0 && timing.totalWords > 0)
    ? Math.max(1, Math.round(timing.totalWords * Math.abs(secs) / d)) : 0;
  if (timing.status === 'over')
    return `Over ${p.label}'s ${fmtDuration(p.over)} limit by `
      + `${fmtDuration(d - p.over)} — cut about ${wordsFor(d - p.sweet)} words `
      + `to reach the ${fmtDuration(p.sweet)} sweet spot.`;
  if (timing.status === 'warn')
    return `Past ${p.label}'s ${fmtDuration(p.sweet)} sweet spot by `
      + `${fmtDuration(d - p.sweet)} — cut about ${wordsFor(d - p.sweet)} words `
      + `to hit it.`;
  if (d > p.sweet)
    return `Inside ${p.label}'s limit but ${fmtDuration(d - p.sweet)} past the `
      + `${fmtDuration(p.sweet)} sweet spot — about ${wordsFor(d - p.sweet)} `
      + `words over.`;
  return `In ${p.label}'s sweet spot — room for about ${wordsFor(p.sweet - d)} `
    + `more words before ${fmtDuration(p.sweet)}.`;
}

// Calibrator: words read / minutes elapsed = real wpm.
export function calcWpm(wordCount, elapsedMs) {
  if (!wordCount || !elapsedMs) return 0;
  return Math.round(wordCount / (elapsedMs / 60000));
}

// The fixed sample paragraph the user reads aloud during calibration.
export const CALIBRATION_SAMPLE =
  `Here is the thing nobody tells you when you start making short-form ` +
  `video. The first two seconds decide everything. If the opening line ` +
  `does not stop the scroll, it does not matter how good the rest of the ` +
  `script is, because almost no one will ever see it. So read this at the ` +
  `pace you would actually talk to the camera. Not faster to sound ` +
  `impressive, not slower to sound careful. Just the way you really speak ` +
  `when the record button is on and you are telling a friend something ` +
  `you genuinely think they need to hear right now.`;

export const SAMPLE_WORDS = countWords(CALIBRATION_SAMPLE);
