// storage.js — IndexedDB wrapper. The only module that talks to the database.
// Nothing here ever leaves the machine. No network, no sync, no telemetry.

import { SEED_HOOKS, SEED_FRAMEWORKS, SEED_CTAS } from './seed.js';

const DB_NAME = 'hookline';
const VERSION = 1;

// Stores:
//   scripts    — every script (id = timestamp string), full block sequence
//   hooks      — swipe-file hooks (built-ins seeded once, then user-owned)
//   frameworks — script frameworks (built-ins seeded once + user customs)
//   ctas       — CTA sub-library (built-ins seeded once + user customs)
//   campaigns  — named folders
//   settings   — single record (id:1): pace calibration, ui prefs, draft id

let _db = null;

function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('scripts')) {
        const s = db.createObjectStore('scripts', { keyPath: 'id' });
        s.createIndex('updatedAt', 'updatedAt');
        s.createIndex('campaign', 'campaign');
      }
      if (!db.objectStoreNames.contains('hooks')) {
        const h = db.createObjectStore('hooks', { keyPath: 'id' });
        h.createIndex('category', 'category');
        h.createIndex('niche', 'niche');
      }
      if (!db.objectStoreNames.contains('frameworks')) {
        db.createObjectStore('frameworks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('ctas')) {
        db.createObjectStore('ctas', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('campaigns')) {
        db.createObjectStore('campaigns', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode = 'readonly') {
  return open().then((db) => db.transaction(store, mode).objectStore(store));
}

function done(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const all = (store) => tx(store).then((s) => done(s.getAll()));
const get = (store, key) => tx(store).then((s) => done(s.get(key)));
const put = (store, value) => tx(store, 'readwrite').then((s) => done(s.put(value)));
const del = (store, key) => tx(store, 'readwrite').then((s) => done(s.delete(key)));

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- One-time seeding of built-in libraries -----------------------------
// Built-ins live in seed.js but are copied into the DB once so the user can
// rate and edit them. Idempotent: only seeds a store that is still empty.

export async function seedIfEmpty() {
  const [h, f, c] = await Promise.all([all('hooks'), all('frameworks'), all('ctas')]);
  const jobs = [];
  if (h.length === 0) {
    for (const x of SEED_HOOKS) jobs.push(put('hooks', { ...x, builtin: true, rating: 0 }));
  }
  if (f.length === 0) {
    for (const x of SEED_FRAMEWORKS) jobs.push(put('frameworks', { ...x, builtin: true }));
  }
  if (c.length === 0) {
    for (const x of SEED_CTAS) jobs.push(put('ctas', { ...x, builtin: true, rating: 0 }));
  }
  await Promise.all(jobs);
}

// ---- Settings (single record) -------------------------------------------

const DEFAULT_SETTINGS = {
  id: 1,
  // Calibrated speaking pace (wpm) per delivery style. Sane defaults until
  // the user runs the calibrator.
  pace: { conversational: 140, energetic: 165, slow: 110 },
  calibrated: false,
  defaultStyle: 'conversational',
  language: 'en',
  platform: 'tiktok',
  format: '9:16',
  draftScriptId: null,
  chrome: 'brand',
};

export async function loadSettings() {
  const rec = await get('settings', 1);
  return { ...DEFAULT_SETTINGS, ...(rec || {}), pace: { ...DEFAULT_SETTINGS.pace, ...((rec || {}).pace || {}) } };
}

export async function saveSettings(patch) {
  const cur = await loadSettings();
  const next = { ...cur, ...patch, id: 1 };
  await put('settings', next);
  return next;
}

// ---- Scripts ------------------------------------------------------------

export const scripts = {
  all: () => all('scripts'),
  get: (id) => get('scripts', id),
  remove: (id) => del('scripts', id),

  async save(rec) {
    const id = rec.id || uid();
    const now = Date.now();
    const full = { ...rec, id, updatedAt: now };
    if (!full.createdAt) full.createdAt = now;
    await put('scripts', full);
    return full;
  },

  async search(q) {
    const list = await all('scripts');
    const t = q.trim().toLowerCase();
    const sorted = list.sort((a, b) => b.updatedAt - a.updatedAt);
    if (!t) return sorted;
    return sorted.filter((s) => {
      if ((s.title || '').toLowerCase().includes(t)) return true;
      return (s.blocks || []).some((b) =>
        (b.text || '').toLowerCase().includes(t) ||
        (b.tone || '').toLowerCase().includes(t) ||
        (b.visualNote || '').toLowerCase().includes(t) ||
        (b.directorNote || '').toLowerCase().includes(t));
    });
  },
};

// ---- Hooks --------------------------------------------------------------

export const hooks = {
  all: () => all('hooks'),
  save: (h) => put('hooks', { ...h, id: h.id || uid() }),
  remove: (id) => del('hooks', id),
};

// ---- Frameworks ---------------------------------------------------------

export const frameworks = {
  all: () => all('frameworks'),
  save: (f) => put('frameworks', { ...f, id: f.id || uid() }),
  remove: (id) => del('frameworks', id),
};

// ---- CTAs ---------------------------------------------------------------

export const ctas = {
  all: () => all('ctas'),
  save: (c) => put('ctas', { ...c, id: c.id || uid() }),
  remove: (id) => del('ctas', id),
};

// ---- Campaigns ----------------------------------------------------------

export const campaigns = {
  all: () => all('campaigns'),
  save: (c) => put('campaigns', { ...c, id: c.id || uid() }),
  remove: (id) => del('campaigns', id),
};

// ---- Wipe (privacy: user-initiated data deletion) -----------------------

export async function wipeEverything() {
  const db = await open();
  const names = ['scripts', 'hooks', 'frameworks', 'ctas', 'campaigns', 'settings'];
  await Promise.all(names.map((n) => new Promise((res, rej) => {
    const r = db.transaction(n, 'readwrite').objectStore(n).clear();
    r.onsuccess = res; r.onerror = () => rej(r.error);
  })));
}
