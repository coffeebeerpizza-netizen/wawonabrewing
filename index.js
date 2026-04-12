'use strict';

// ── CONFIG ────────────────────────────────────────────────────────────────────
const SHEET_ID  = '1a-l80qcKPBaGRXWX0ODP_8REFvYlEc7q9XbAUj06ljg';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;
const KEY       = 'wb2026';
const ADMIN_PIN = '1234'; // ← Change this to your preferred PIN

// ── STATE ─────────────────────────────────────────────────────────────────────
let BEERS           = [];
let state           = {};
let currentBeerIdx  = null;
let favFilterActive = false;

function slugify(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function loadState() { state = JSON.parse(localStorage.getItem(KEY) || '{}'); }
function saveState() { localStorage.setItem(KEY, JSON.stringify(state)); }

function getVal(slug, field) {
  const k = `b${slug}_${field}`;
  return Object.prototype.hasOwnProperty.call(state, k) ? state[k] : null;
}
function setVal(slug, field, value) {
  state[`b${slug}_${field}`] = value;
  saveState();
}

function isRetired(slug) { return getVal(slug, 'retired') === true; }

// ── ADMIN MODE ────────────────────────────────────────────────────────────────
function isAdmin() { return sessionStorage.getItem('wb_admin') === '1'; }
function setAdmin(on) {
  on ? sessionStorage.setItem('wb_admin', '1') : sessionStorage.removeItem('wb_admin');
}

function updateAdminUI() {
  const lockBtn = document.getElementById('admin-lock-btn');
  if (lockBtn) {
    lockBtn.textContent = isAdmin() ? '🔓' : '🔒';
    lockBtn.title = isAdmin() ? 'Admin mode on — tap to lock' : 'Admin access';
  }
  const badge = document.getElementById('admin-badge');
  if (badge) badge.classList.toggle('hidden', !isAdmin());

  const appScreen = document.getElementById('screen-app');
  if (appScreen?.classList.contains('active') && currentBeerIdx !== null) {
    openBeer(currentBeerIdx);
  }
  const histScreen = document.getElementById('screen-history');
  if (histScreen?.classList.contains('active')) {
    buildHistory();
  }
}

function showPinModal() {
  if (isAdmin()) {
    setAdmin(false);
    updateAdminUI();
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'pin-overlay';

  const modal = document.createElement('div');
  modal.className = 'pin-modal';
  modal.innerHTML = `
    <div class="pin-title">Admin Access</div>
    <div class="pin-subtitle">Enter your PIN to manage the tap list</div>
    <input class="pin-input" type="password" inputmode="numeric"
           maxlength="8" placeholder="••••" autocomplete="off">
    <div class="pin-error hidden">Incorrect PIN — try again</div>
    <div class="pin-actions">
      <button class="pin-cancel">Cancel</button>
      <button class="pin-submit">Unlock</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const input  = modal.querySelector('.pin-input');
  const errMsg = modal.querySelector('.pin-error');

  setTimeout(() => input.focus(), 60);

  function tryUnlock() {
    if (input.value === ADMIN_PIN) {
      setAdmin(true);
      updateAdminUI();
      overlay.remove();
    } else {
      errMsg.classList.remove('hidden');
      input.value = '';
      input.focus();
      modal.classList.add('pin-shake');
      setTimeout(() => modal.classList.remove('pin-shake'), 420);
    }
  }

  modal.querySelector('.pin-submit').addEventListener('click', tryUnlock);
  modal.querySelector('.pin-cancel').addEventListener('click', () => overlay.remove());
  input.addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
  if (name === 'scorecard') buildScorecard();
  if (name === 'history')   buildHistory();
  if (name === 'app') {
    closeDetail();
    buildBeerList(document.getElementById('search-input')?.value || '');
  }
}

// ── BEER LIST ─────────────────────────────────────────────────────────────────
function buildBeerList(filter) {
  filter = (filter || '').toLowerCase();
  const list = document.getElementById('beer-list');
  list.innerHTML = '';

  const toShow = BEERS.filter(beer => {
    const retired = isRetired(beer.slug);
    const isFav   = getVal(beer.slug, 'fav') === true;
    // Favorites mode: always show favorites, even if off tap
    if (favFilterActive) return isFav;
    // Normal mode: hide retired beers
    if (retired) return false;
    if (!filter) return true;
    return [beer.name, beer.brewery, beer.style, beer.bjcp, beer.origin]
      .some(s => (s || '').toLowerCase().includes(filter));
  });

  if (toShow.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = favFilterActive
      ? 'No favorites yet — tap ★ on any beer to save it.'
      : 'No beers found.';
    list.appendChild(empty);
    return;
  }

  toShow.forEach((beer, i) => {
    const score    = getVal(beer.slug, 'score');
    const isFav    = getVal(beer.slug, 'fav') === true;
    const retired  = isRetired(beer.slug);
    const mainIdx  = BEERS.indexOf(beer);

    const card = document.createElement('div');
    card.className = 'beer-card' + (retired ? ' beer-card-retired' : '');
    card.style.animationDelay = `${i * 0.04}s`;
    card.addEventListener('click', () => openBeer(mainIdx));

    card.innerHTML = `
      <div class="beer-card-header">
        <div class="beer-card-info">
          <div class="beer-card-name">${esc(beer.name)}</div>
          ${beer.brewery ? `<div class="beer-card-brewery">${esc(beer.brewery)}</div>` : ''}
        </div>
        <div class="beer-card-meta">
          ${retired ? '<div class="ot-badge" title="Off Tap">OT</div>' : ''}
          ${score !== null ? `<div class="score-badge">${score}</div>` : ''}
          ${isFav ? '<div class="fav-indicator">★</div>' : ''}
        </div>
      </div>
      <div class="beer-card-tags">
        ${beer.style  ? `<span class="tag tag-style">${esc(beer.style)}</span>`   : ''}
        ${beer.bjcp   ? `<span class="tag tag-bjcp">${esc(beer.bjcp)}</span>`     : ''}
        ${beer.abv    ? `<span class="tag tag-abv">${esc(beer.abv)}% ABV</span>`  : ''}
        ${beer.origin ? `<span class="tag tag-origin">${esc(beer.origin)}</span>` : ''}
      </div>
      ${beer.notes ? `<div class="beer-card-notes">${esc(beer.notes)}</div>` : ''}
    `;
    list.appendChild(card);
  });
}

function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── DETAIL / RATING VIEW ──────────────────────────────────────────────────────
function openBeer(idx) {
  currentBeerIdx = idx;
  const beer   = BEERS[idx];
  const detail = document.getElementById('detail');
  detail.innerHTML = '';

  // Sticky header
  const header = document.createElement('div');
  header.className = 'detail-header';
  header.innerHTML = `
    <button class="back-btn" onclick="closeDetail()">←</button>
    <div class="detail-header-info">
      <div class="detail-beer-name">${esc(beer.name)}</div>
      ${beer.brewery ? `<div class="detail-brewery">${esc(beer.brewery)}</div>` : ''}
    </div>
  `;

  // Off Tap / Restore button — admin only
  if (isAdmin()) {
    const adminBtn = document.createElement('button');
    if (isRetired(beer.slug)) {
      adminBtn.className = 'restore-btn-inline';
      adminBtn.textContent = 'Restore';
      adminBtn.title = 'Put back on tap';
      adminBtn.addEventListener('click', () => {
        setVal(beer.slug, 'retired', false);
        closeDetail();
      });
    } else {
      adminBtn.className = 'retire-btn';
      adminBtn.textContent = 'Off Tap';
      adminBtn.title = 'Remove from current tap list';
      adminBtn.addEventListener('click', () => {
        setVal(beer.slug, 'retired', true);
        closeDetail();
      });
    }
    header.appendChild(adminBtn);
  }
  detail.appendChild(header);

  // Tags row: style, BJCP, ABV, origin
  if (beer.style || beer.bjcp || beer.abv || beer.origin) {
    const infoRow = document.createElement('div');
    infoRow.className = 'detail-info-row';
    infoRow.innerHTML = `
      ${beer.style  ? `<span class="tag tag-style">${esc(beer.style)}</span>`   : ''}
      ${beer.bjcp   ? `<span class="tag tag-bjcp">${esc(beer.bjcp)}</span>`     : ''}
      ${beer.abv    ? `<span class="tag tag-abv">${esc(beer.abv)}% ABV</span>`  : ''}
      ${beer.origin ? `<span class="tag tag-origin">${esc(beer.origin)}</span>` : ''}
    `;
    detail.appendChild(infoRow);
  }

  // About notes
  if (beer.notes) {
    const ns = document.createElement('div');
    ns.className = 'detail-notes-section';
    ns.innerHTML = `
      <button class="notes-toggle" onclick="toggleNotes(this)">
        <span>About This Beer</span><span class="toggle-icon">✦</span>
      </button>
      <div class="notes-content hidden">${esc(beer.notes)}</div>
    `;
    detail.appendChild(ns);
  }

  // ── Tab strip ──────────────────────────────────────────────────────────────
  const tabBar = document.createElement('div');
  tabBar.className = 'detail-tabs';

  const tastingTab = document.createElement('button');
  tastingTab.className = 'detail-tab active';
  tastingTab.textContent = 'Tasting';

  const recipeTab = document.createElement('button');
  recipeTab.className = 'detail-tab';
  recipeTab.textContent = 'Recipe';

  tabBar.appendChild(tastingTab);
  tabBar.appendChild(recipeTab);
  detail.appendChild(tabBar);

  // Tab panes
  const tastingPane = document.createElement('div');
  tastingPane.className = 'tab-pane';
  tastingPane.appendChild(buildRatingCard(beer));

  const recipePane = document.createElement('div');
  recipePane.className = 'tab-pane hidden';
  recipePane.appendChild(buildRecipeView(beer));

  detail.appendChild(tastingPane);
  detail.appendChild(recipePane);

  // Tab switching
  tastingTab.addEventListener('click', () => {
    tastingTab.classList.add('active');
    recipeTab.classList.remove('active');
    tastingPane.classList.remove('hidden');
    recipePane.classList.add('hidden');
    detail.scrollTo({ top: 0, behavior: 'smooth' });
  });
  recipeTab.addEventListener('click', () => {
    recipeTab.classList.add('active');
    tastingTab.classList.remove('active');
    recipePane.classList.remove('hidden');
    tastingPane.classList.add('hidden');
    detail.scrollTo({ top: 0, behavior: 'smooth' });
  });

  detail.classList.add('visible');
  document.getElementById('beer-list-container').classList.add('detail-open');
  detail.scrollTop = 0;
}

function closeDetail() {
  document.getElementById('detail').classList.remove('visible');
  document.getElementById('beer-list-container').classList.remove('detail-open');
  currentBeerIdx = null;
  buildBeerList(document.getElementById('search-input')?.value || '');
}

function toggleNotes(btn) {
  const content = btn.nextElementSibling;
  content.classList.toggle('hidden');
  btn.querySelector('.toggle-icon').textContent =
    content.classList.contains('hidden') ? '✦' : '✧';
}

// ── RECIPE VIEW ───────────────────────────────────────────────────────────────
function buildRecipeView(beer) {
  const view = document.createElement('div');
  view.className = 'recipe-view';

  // Stats bar: ABV, IBU, OG, FG
  const stats = document.createElement('div');
  stats.className = 'recipe-stats';
  [
    { label: 'ABV', value: beer.abv ? beer.abv + '%' : '—' },
    { label: 'IBU', value: beer.ibu || '—' },
    { label: 'OG',  value: beer.og  || '—' },
    { label: 'FG',  value: beer.fg  || '—' },
  ].forEach(({ label, value }) => {
    const stat = document.createElement('div');
    stat.className = 'recipe-stat';
    stat.innerHTML = `
      <div class="recipe-stat-value">${esc(value)}</div>
      <div class="recipe-stat-label">${label}</div>
    `;
    stats.appendChild(stat);
  });
  view.appendChild(stats);

  // Ingredient sections
  if (beer.ferms)      view.appendChild(buildIngredientSection('Fermentables', beer.ferms));
  if (beer.hops)       view.appendChild(buildIngredientSection('Hops',         beer.hops));
  if (beer.yeast)      view.appendChild(buildTextSection('Yeast',              beer.yeast));
  if (beer.brew_notes) view.appendChild(buildTextSection("Brewer's Notes",     beer.brew_notes));

  if (!beer.ferms && !beer.hops && !beer.yeast && !beer.brew_notes) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No recipe data yet. Add recipe details to your Google Sheet.';
    view.appendChild(empty);
  }

  const pad = document.createElement('div');
  pad.style.height = 'calc(2rem + env(safe-area-inset-bottom))';
  view.appendChild(pad);

  return view;
}

// Parse newline-separated "Name | Amount" ingredient lines
function parseIngredients(raw) {
  return (raw || '').split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split('|').map(s => s.trim());
      return { name: parts[0] || '', amount: parts[1] || '' };
    });
}

function buildIngredientSection(title, raw) {
  const sec = document.createElement('div');
  sec.className = 'recipe-section';

  const hdr = document.createElement('div');
  hdr.className = 'recipe-section-title';
  hdr.textContent = title;
  sec.appendChild(hdr);

  parseIngredients(raw).forEach(({ name, amount }) => {
    const row = document.createElement('div');
    row.className = 'ingredient-row';
    row.innerHTML = `
      <span class="ingredient-name">${esc(name)}</span>
      ${amount ? `<span class="ingredient-amount">${esc(amount)}</span>` : ''}
    `;
    sec.appendChild(row);
  });

  return sec;
}

function buildTextSection(title, text) {
  const sec = document.createElement('div');
  sec.className = 'recipe-section';

  const hdr = document.createElement('div');
  hdr.className = 'recipe-section-title';
  hdr.textContent = title;
  sec.appendChild(hdr);

  const body = document.createElement('div');
  body.className = 'recipe-text';
  body.textContent = text;
  sec.appendChild(body);

  return sec;
}

// ── HISTORY SCREEN ────────────────────────────────────────────────────────────
function buildHistory() {
  const container = document.getElementById('history-content');
  container.innerHTML = '';

  const retired = BEERS.filter(beer => isRetired(beer.slug));

  if (retired.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No beers archived yet. Tap "Off Tap" on any beer to move it here.';
    container.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'history-list';

  retired.forEach(beer => {
    const score = getVal(beer.slug, 'score');
    const isFav = getVal(beer.slug, 'fav') === true;

    const card = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML = `
      <div class="history-card-info">
        <div class="history-beer-name">${esc(beer.name)}</div>
        <div class="history-meta">
          ${beer.style  ? `<span class="tag tag-style">${esc(beer.style)}</span>`  : ''}
          ${beer.bjcp   ? `<span class="tag tag-bjcp">${esc(beer.bjcp)}</span>`    : ''}
          ${beer.abv    ? `<span class="tag tag-abv">${esc(beer.abv)}% ABV</span>` : ''}
          ${isFav ? '<span class="fav-indicator" style="font-size:0.85rem">★</span>' : ''}
        </div>
      </div>
      <div class="history-card-right">
        ${score !== null ? `<div class="score-badge">${score}</div>` : ''}
        ${isAdmin() ? '<button class="restore-btn">Restore</button>' : ''}
      </div>
    `;

    if (isAdmin()) {
      card.querySelector('.restore-btn').addEventListener('click', () => {
        setVal(beer.slug, 'retired', false);
        buildHistory();
      });
    }

    list.appendChild(card);
  });

  container.appendChild(list);
}

// ── RATING CARD ───────────────────────────────────────────────────────────────
function buildRatingCard(beer) {
  const card = document.createElement('div');
  card.className = 'rating-card';

  // Star / favorite
  const starRow = document.createElement('div');
  starRow.className = 'star-row';
  const starBtn = document.createElement('button');
  starBtn.className = 'star-btn' + (getVal(beer.slug, 'fav') === true ? ' active' : '');
  starBtn.textContent = getVal(beer.slug, 'fav') === true ? '★' : '☆';
  starBtn.addEventListener('click', () => {
    const now = getVal(beer.slug, 'fav') !== true;
    setVal(beer.slug, 'fav', now);
    starBtn.textContent = now ? '★' : '☆';
    starBtn.classList.toggle('active', now);
  });
  starRow.appendChild(starBtn);
  card.appendChild(starRow);

  // Appearance
  const appSec = mkSection('Appearance');
  appSec.appendChild(attrSlider('Color',   beer.slug, 'color_val',   ['Pale','Straw','Golden','Amber','Dark']));
  appSec.appendChild(attrSlider('Clarity', beer.slug, 'clarity_val', ['Clear','Slight Haze','Hazy']));
  appSec.appendChild(attrSlider('Head',    beer.slug, 'head_val',    ['Thin','Medium','Thick']));
  card.appendChild(appSec);

  // Aroma
  card.appendChild(textRow('Aroma', beer.slug));

  // Flavor
  const flvSec = mkSection('Flavor');
  flvSec.appendChild(attrSlider('Malt',       beer.slug, 'malt_val', ['Low','Med-Low','Med','Med-High','High']));
  flvSec.appendChild(attrSlider('Hops',       beer.slug, 'hops_val', ['Low','Med-Low','Med','Med-High','High']));
  flvSec.appendChild(attrSlider('Bitterness', beer.slug, 'bitt_val', ['Low','Med-Low','Med','Med-High','High']));
  card.appendChild(flvSec);

  // Body & Finish
  card.appendChild(attrSlider('Body',   beer.slug, 'body_val', ['Light','Light-Med','Medium','Med-Full','Full']));
  card.appendChild(attrSlider('Finish', beer.slug, 'fin_val',  ['Short','Short-Med','Medium','Med-Long','Long']));

  // Overall score
  card.appendChild(scoreRow(beer.slug));

  // Spider chart
  card.appendChild(buildSpiderWrap(beer.slug));

  return card;
}

function mkSection(title) {
  const sec = document.createElement('div');
  const t   = document.createElement('div');
  t.className   = 'section-title';
  t.textContent = title;
  sec.appendChild(t);
  return sec;
}

// ── ATTRIBUTE SLIDER ──────────────────────────────────────────────────────────
function attrSlider(label, slug, field, labels) {
  const n = labels.length;

  function lblIdx(v) {
    return Math.min(n - 1, Math.round((v - 1) / (9 / (n - 1))));
  }

  const row = document.createElement('div');
  row.className = 'attr-row';

  const lbl = document.createElement('div');
  lbl.className   = 'attr-label';
  lbl.textContent = label;
  row.appendChild(lbl);

  const wrap = document.createElement('div');
  wrap.className = 'attr-slider-wrap';

  const saved    = getVal(slug, field);
  let   hasValue = saved !== null;

  const valLbl = document.createElement('div');
  valLbl.className   = 'attr-value-label';
  valLbl.textContent = hasValue ? labels[lblIdx(saved)] : '';
  wrap.appendChild(valLbl);

  const sliderRow = document.createElement('div');
  sliderRow.className = 'attr-slider-row';

  const slider = document.createElement('input');
  slider.type      = 'range';
  slider.className = 'attr-slider';
  slider.min       = 1;
  slider.max       = 10;
  slider.step      = 1;
  slider.value     = hasValue ? saved : 1;

  function updateTrack() {
    const pct = ((slider.value - 1) / 9) * 100;
    slider.style.background = hasValue
      ? `linear-gradient(to right, var(--green) ${pct}%, var(--slider-track) ${pct}%)`
      : 'var(--slider-track)';
  }

  const labelRow = document.createElement('div');
  labelRow.className = 'attr-labels-row';
  const labelEls = labels.map((txt, i) => {
    const span = document.createElement('span');
    span.className   = 'attr-tick-label';
    span.textContent = txt;
    if (hasValue && lblIdx(saved) === i) span.classList.add('active');
    labelRow.appendChild(span);
    return span;
  });

  slider.addEventListener('input', () => {
    hasValue = true;
    const v   = parseInt(slider.value, 10);
    const idx = lblIdx(v);
    setVal(slug, field, v);
    valLbl.textContent = labels[idx];
    labelEls.forEach((el, i) => el.classList.toggle('active', i === idx));
    updateTrack();
    const chart = row.closest('.rating-card')?.querySelector('.spider-chart');
    if (chart?.updateData) chart.updateData();
  });

  updateTrack();
  sliderRow.appendChild(slider);
  wrap.appendChild(sliderRow);
  wrap.appendChild(labelRow);
  row.appendChild(wrap);
  return row;
}

// ── AROMA TEXT ROW ────────────────────────────────────────────────────────────
function textRow(label, slug) {
  const row = document.createElement('div');
  row.className = 'text-row';

  const lbl = document.createElement('div');
  lbl.className   = 'attr-label';
  lbl.textContent = label;
  row.appendChild(lbl);

  const ta = document.createElement('textarea');
  ta.className   = 'aroma-textarea';
  ta.placeholder = 'Aroma notes…';
  ta.value       = getVal(slug, 'aroma') || '';
  ta.rows        = 2;
  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    setVal(slug, 'aroma', ta.value);
  });
  row.appendChild(ta);
  return row;
}

// ── OVERALL SCORE SLIDER ──────────────────────────────────────────────────────
function scoreRow(slug) {
  const row = document.createElement('div');
  row.className = 'score-row';

  const lbl = document.createElement('div');
  lbl.className   = 'attr-label';
  lbl.textContent = 'Overall';
  row.appendChild(lbl);

  const wrap     = document.createElement('div');
  wrap.className = 'slider-wrap';
  const saved    = getVal(slug, 'score');
  let   hasValue = saved !== null;

  const display = document.createElement('div');
  display.className   = 'score-value' + (hasValue ? ' active' : '');
  display.textContent = hasValue ? saved : '–';
  wrap.appendChild(display);

  const sliderRow = document.createElement('div');
  sliderRow.className = 'slider-row';

  const minLbl = document.createElement('span');
  minLbl.className   = 'slider-label';
  minLbl.textContent = '1';

  const slider = document.createElement('input');
  slider.type      = 'range';
  slider.className = 'score-slider';
  slider.min       = 1;
  slider.max       = 10;
  slider.step      = 1;
  slider.value     = hasValue ? saved : 5;

  const maxLbl = document.createElement('span');
  maxLbl.className   = 'slider-label';
  maxLbl.textContent = '10';

  function updateTrack() {
    const pct = ((slider.value - 1) / 9) * 100;
    slider.style.background = hasValue
      ? `linear-gradient(to right, var(--green) ${pct}%, var(--slider-track) ${pct}%)`
      : 'var(--slider-track)';
  }

  slider.addEventListener('input', () => {
    hasValue = true;
    display.textContent = slider.value;
    display.classList.add('active');
    setVal(slug, 'score', parseInt(slider.value, 10));
    updateTrack();
    const chart = row.closest('.rating-card')?.querySelector('.spider-chart');
    if (chart?.updateData) chart.updateData();
  });

  updateTrack();
  sliderRow.appendChild(minLbl);
  sliderRow.appendChild(slider);
  sliderRow.appendChild(maxLbl);
  wrap.appendChild(sliderRow);
  row.appendChild(wrap);
  return row;
}

// ── SPIDER / RADAR CHART ──────────────────────────────────────────────────────
const SPIDER_AXES = [
  { label: 'Malt',    field: 'malt_val', min: 1, max: 10 },
  { label: 'Hops',    field: 'hops_val', min: 1, max: 10 },
  { label: 'Bitter',  field: 'bitt_val', min: 1, max: 10 },
  { label: 'Body',    field: 'body_val', min: 1, max: 10 },
  { label: 'Finish',  field: 'fin_val',  min: 1, max: 10 },
  { label: 'Overall', field: 'score',    min: 1, max: 10 },
];

function buildSpiderWrap(slug) {
  const wrap = document.createElement('div');
  wrap.className = 'spider-wrap';

  const title = document.createElement('div');
  title.className   = 'spider-title';
  title.textContent = 'Flavor Profile';
  wrap.appendChild(title);

  wrap.appendChild(buildSpiderChart(slug));
  return wrap;
}

function buildSpiderChart(slug) {
  const NS  = 'http://www.w3.org/2000/svg';
  const n   = SPIDER_AXES.length;
  const cx  = 150, cy = 155, r = 100;
  const size = 300;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size + 10}`);
  svg.setAttribute('class', 'spider-chart');

  function pt(axis, t) {
    const angle = (axis * 2 * Math.PI / n) - Math.PI / 2;
    return [cx + t * r * Math.cos(angle), cy + t * r * Math.sin(angle)];
  }

  function ptsStr(t) {
    return Array.from({ length: n }, (_, i) => pt(i, t).join(',')).join(' ');
  }

  // Grid rings
  [0.25, 0.5, 0.75, 1.0].forEach(t => {
    const ring = document.createElementNS(NS, 'polygon');
    ring.setAttribute('points', ptsStr(t));
    ring.setAttribute('class', 'spider-grid');
    svg.appendChild(ring);
  });

  // Axis lines
  for (let i = 0; i < n; i++) {
    const [x2, y2] = pt(i, 1);
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', cx); line.setAttribute('y1', cy);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    line.setAttribute('class', 'spider-axis');
    svg.appendChild(line);
  }

  // Data polygon
  const dataPoly = document.createElementNS(NS, 'polygon');
  dataPoly.setAttribute('class', 'spider-data');
  svg.appendChild(dataPoly);

  // Labels
  SPIDER_AXES.forEach((axis, i) => {
    const [lx, ly] = pt(i, 1.28);
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', lx);
    text.setAttribute('y', ly);
    text.setAttribute('class', 'spider-label');
    const cos = Math.cos((i * 2 * Math.PI / n) - Math.PI / 2);
    const sin = Math.sin((i * 2 * Math.PI / n) - Math.PI / 2);
    text.setAttribute('text-anchor',
      Math.abs(cos) < 0.15 ? 'middle' : cos > 0 ? 'start' : 'end');
    text.setAttribute('dominant-baseline',
      Math.abs(sin) < 0.15 ? 'middle' : sin > 0 ? 'hanging' : 'auto');
    text.textContent = axis.label;
    svg.appendChild(text);
  });

  svg.updateData = function () {
    const pts = SPIDER_AXES.map((axis, i) => {
      const val  = getVal(slug, axis.field);
      const norm = val !== null
        ? Math.max(0, Math.min(1, (val - axis.min) / (axis.max - axis.min)))
        : 0;
      return pt(i, norm).join(',');
    }).join(' ');
    dataPoly.setAttribute('points', pts);
  };

  svg.updateData();
  return svg;
}

// ── SCORECARD ─────────────────────────────────────────────────────────────────
function buildScorecard() {
  const container = document.getElementById('scorecard-content');
  container.innerHTML = '';

  const rated = BEERS
    .map(beer => ({ ...beer, score: getVal(beer.slug, 'score') }))
    .filter(b  => b.score !== null)
    .map(b     => ({ ...b, score: parseInt(b.score, 10) }))
    .sort((a, b) => b.score - a.score);

  const avg = rated.length
    ? (rated.reduce((s, r) => s + r.score, 0) / rated.length).toFixed(1)
    : '–';

  const activeTap = BEERS.filter(b => !isRetired(b.slug)).length;

  const stats = document.createElement('div');
  stats.className = 'scorecard-stats';
  stats.innerHTML = `
    <div class="stat"><div class="stat-value">${rated.length}</div><div class="stat-label">Rated</div></div>
    <div class="stat"><div class="stat-value">${avg}</div><div class="stat-label">Avg Score</div></div>
    <div class="stat"><div class="stat-value">${activeTap}</div><div class="stat-label">On Tap</div></div>
  `;
  container.appendChild(stats);

  if (rated.length === 0) {
    const empty = document.createElement('div');
    empty.className   = 'empty-state';
    empty.textContent = 'No beers rated yet — use the Overall slider on any beer.';
    container.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'scorecard-list';

  rated.forEach(beer => {
    const retired = isRetired(beer.slug);
    const row = document.createElement('div');
    row.className = 'scorecard-row' + (retired ? ' scorecard-row-retired' : '');
    row.innerHTML = `
      <div class="scorecard-info">
        <div class="scorecard-beer-name">${esc(beer.name)}</div>
        ${beer.brewery ? `<div class="scorecard-brewery">${esc(beer.brewery)}</div>` : ''}
        ${retired ? '<div class="scorecard-retired-badge">Archived</div>' : ''}
      </div>
      <div class="scorecard-score">${beer.score}</div>
      <div class="scorecard-arrow">›</div>
    `;
    row.addEventListener('click', () => {
      const idx = BEERS.findIndex(b => b.slug === beer.slug);
      if (idx !== -1) { showScreen('app'); setTimeout(() => openBeer(idx), 120); }
    });
    list.appendChild(row);
  });

  container.appendChild(list);
}

// ── DATA LOADING ──────────────────────────────────────────────────────────────
async function initApp() {
  loadState();

  // Set up search
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', e => buildBeerList(e.target.value));
  }

  // Set up favorites filter
  const favBtn = document.getElementById('fav-filter-btn');
  if (favBtn) {
    favBtn.addEventListener('click', () => {
      favFilterActive = !favFilterActive;
      favBtn.classList.toggle('active', favFilterActive);
      buildBeerList(searchInput?.value || '');
    });
  }

  try {
    document.getElementById('splash-status').textContent = 'Loading tap list…';
    const res    = await fetch(SHEET_URL);
    const csv    = await res.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

    BEERS = parsed.data
      .filter(r => r.beer_name?.trim())
      .map(r => ({
        slug:       slugify((r.beer_name || '') + '-' + (r.brewery || '')),
        name:       (r.beer_name      || '').trim(),
        brewery:    (r.brewery        || '').trim(),
        style:      (r.style          || '').trim(),
        bjcp:       (r.bjcp_category  || '').trim(),
        abv:        (r.abv            || '').trim(),
        origin:     (r.origin         || '').trim(),
        notes:      (r.notes          || '').trim(),
        ibu:        (r.ibu            || '').trim(),
        og:         (r.og             || '').trim(),
        fg:         (r.fg             || '').trim(),
        ferms:      (r.fermentables   || '').trim(),
        hops:       (r.hops           || '').trim(),
        yeast:      (r.yeast          || '').trim(),
        brew_notes: (r.brewers_notes  || '').trim(),
      }));

    const active = BEERS.filter(b => !isRetired(b.slug)).length;
    document.getElementById('splash-status').textContent =
      `${active} beer${active !== 1 ? 's' : ''} on tap`;
  } catch (err) {
    console.error('Sheet load failed:', err);
    BEERS = getDefaultBeers();
    document.getElementById('splash-status').textContent = '⚠ Could not load sheet (showing demo)';
  }
}

function getDefaultBeers() {
  return [
    {
      slug: 'wawona-winter-warmer-wawona-brewing',
      name: 'Wawona Winter Warmer',
      brewery: 'Wawona Brewing', style: '', bjcp: '', abv: '', origin: '', notes: '',
      ibu: '', og: '', fg: '', ferms: '', hops: '', yeast: '', brew_notes: '',
    },
    {
      slug: 'oh-so-standard-pale-ale-wawona-brewing',
      name: 'Oh So Standard Pale Ale',
      brewery: 'Wawona Brewing', style: 'Pale Ale', bjcp: '', abv: '', origin: '', notes: '',
      ibu: '', og: '', fg: '', ferms: '', hops: '', yeast: '', brew_notes: '',
    },
    {
      slug: 'hop-water-wawona-brewing',
      name: 'Hop Water',
      brewery: 'Wawona Brewing', style: '', bjcp: '', abv: '0', origin: '', notes: '',
      ibu: '', og: '', fg: '', ferms: '', hops: '', yeast: '', brew_notes: '',
    },
    {
      slug: 'lucky-13-czech-pils-wawona-brewing',
      name: 'Lucky 13 Czech Pils',
      brewery: 'Wawona Brewing', style: 'Czech Pilsner', bjcp: '', abv: '', origin: '', notes: '',
      ibu: '', og: '', fg: '', ferms: '', hops: '', yeast: '', brew_notes: '',
    },
    {
      slug: 'give-us-liberty-hamdi-pale-ale-wawona-brewing',
      name: 'Give Us Liberty Hamdi Pale Ale',
      brewery: 'Wawona Brewing', style: 'Pale Ale', bjcp: '', abv: '', origin: '', notes: '',
      ibu: '', og: '', fg: '', ferms: '', hops: '', yeast: '', brew_notes: '',
    },
    {
      slug: 'why-the-bock-not-helles-bock-wawona-brewing',
      name: 'Why the Bock Not Helles Bock',
      brewery: 'Wawona Brewing', style: 'Helles Bock', bjcp: '', abv: '', origin: '', notes: '',
      ibu: '', og: '', fg: '', ferms: '', hops: '', yeast: '', brew_notes: '',
    },
    {
      slug: 'summer-saison-wawona-brewing',
      name: 'Summer Saison',
      brewery: 'Wawona Brewing', style: 'Saison', bjcp: '', abv: '', origin: '', notes: '',
      ibu: '', og: '', fg: '', ferms: '', hops: '', yeast: '', brew_notes: '',
    },
    {
      slug: 'slippin-into-darkness-sf-style-black-lager-wawona-brewing',
      name: "Slippin' Into Darkness SF Style Black Lager",
      brewery: 'Wawona Brewing', style: 'Black Lager', bjcp: '', abv: '', origin: '', notes: '',
      ibu: '', og: '', fg: '', ferms: '', hops: '', yeast: '', brew_notes: '',
    },
  ];
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initApp);
