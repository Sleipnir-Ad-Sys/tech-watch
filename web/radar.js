/**
 * Tech Watch — Radar / Découvertes (radar.js)
 * Gère la page radar.html : filtres, recherche, suivi localStorage.
 * Clé localStorage : "tech-watch:tracked"
 */

"use strict";

const DATA_URL    = "./data.json";
const TRACKED_KEY = "tech-watch:tracked";

// ── État ─────────────────────────────────────────────────────────
let allDiscoveries = [];
let activeCategory = "all";
let searchQuery    = "";

// ── localStorage helpers ─────────────────────────────────────────

function getTracked() {
  try { return JSON.parse(localStorage.getItem(TRACKED_KEY) || "[]"); }
  catch { return []; }
}

function isTracked(fullName) {
  return getTracked().some(r => r.full_name === fullName);
}

function toggleTrack(repo) {
  if (isTracked(repo.full_name)) {
    localStorage.setItem(TRACKED_KEY,
      JSON.stringify(getTracked().filter(r => r.full_name !== repo.full_name)));
  } else {
    const list = getTracked();
    list.unshift(repo);                  // plus récent en premier
    localStorage.setItem(TRACKED_KEY, JSON.stringify(list));
  }
  renderAll();
}

// ── Utilitaires ─────────────────────────────────────────────────

function escHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso), now = new Date();
  const days = Math.floor((now - d) / 86400000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7)   return `il y a ${days}j`;
  if (days < 30)  return `il y a ${Math.floor(days / 7)}sem`;
  if (days < 365) return `il y a ${Math.floor(days / 30)}mois`;
  return `il y a ${Math.floor(days / 365)}an`;
}

// ── Rendu ─────────────────────────────────────────────────────────

function renderHeroStats() {
  const tracked = getTracked();
  const cats    = new Set(allDiscoveries.map(r => r.category).filter(Boolean));
  document.getElementById("stat-total").textContent        = allDiscoveries.length || "—";
  document.getElementById("stat-tracked-hero").textContent = tracked.length;
  document.getElementById("stat-cats").textContent         = cats.size || "—";
}

function renderTracked() {
  const section = document.getElementById("tracked-section");
  const grid    = document.getElementById("tracked-grid");
  const countEl = document.getElementById("tracked-count");
  const tracked = getTracked();

  if (tracked.length === 0) { section.style.display = "none"; return; }

  section.style.display = "";
  countEl.textContent   = `${tracked.length} outil${tracked.length > 1 ? "s" : ""}`;
  grid.innerHTML        = tracked.map(r => renderCard(r, true)).join("");
  bindButtons(grid);
}

function getFiltered() {
  const q = searchQuery.toLowerCase();
  return allDiscoveries.filter(r => {
    const catOk  = activeCategory === "all" || r.category === activeCategory;
    const textOk = !q
      || (r.full_name   || "").toLowerCase().includes(q)
      || (r.description || "").toLowerCase().includes(q);
    return catOk && textOk;
  });
}

function renderDiscoveries() {
  const grid    = document.getElementById("discoveries-grid");
  const countEl = document.getElementById("disc-count");
  const items   = getFiltered();

  countEl.textContent = `${items.length} outil${items.length !== 1 ? "s" : ""}`;

  if (items.length === 0) {
    grid.innerHTML = '<div class="empty-state">Aucun résultat pour ces filtres.</div>';
    return;
  }

  grid.innerHTML = items.map(r => renderCard(r, false)).join("");
  bindButtons(grid);
}

function renderCard(repo, inTrackedPanel) {
  const name    = escHtml(repo.full_name || "");
  const desc    = escHtml(repo.description || "Pas de description.");
  const url     = escHtml(repo.url || `https://github.com/${repo.full_name}`);
  const stars   = (repo.stars || 0).toLocaleString("fr-FR");
  const lang    = repo.language
                  ? `<span class="disc-lang">${escHtml(repo.language)}</span>` : "";
  const cat     = repo.category
                  ? `<span class="disc-cat">${escHtml(repo.category)}</span>` : "";
  const src     = repo.discovery_source
                  ? `<span class="disc-source">via ${escHtml(repo.discovery_source)}</span>` : "";
  const pushed  = repo.pushed_at
                  ? `<span class="disc-date">${formatDate(repo.pushed_at)}</span>` : "";

  const tracked = isTracked(repo.full_name);
  let btnLabel, btnExtra;

  if (inTrackedPanel) {
    btnLabel = "✕ Retirer";
    btnExtra = ' data-remove="true"';
  } else if (tracked) {
    btnLabel = "✓ Suivi";
    btnExtra = ' data-tracked="true"';
  } else {
    btnLabel = "+ Suivre";
    btnExtra = "";
  }

  const btnClass = (inTrackedPanel || tracked) ? "track-btn tracked" : "track-btn";

  return `
    <article class="discovery-card">
      <div class="disc-header">
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="disc-name">${name}</a>
        <span class="disc-stars">★ ${stars}</span>
      </div>
      <p class="disc-desc">${desc}</p>
      <div class="disc-meta">${cat}${lang}${src}${pushed}</div>
      <div class="disc-actions">
        <button class="${btnClass}" data-track="${escHtml(repo.full_name)}"${btnExtra}>${btnLabel}</button>
      </div>
    </article>`;
}

function bindButtons(container) {
  container.querySelectorAll("[data-track]").forEach(btn => {
    btn.addEventListener("click", () => {
      const fn   = btn.dataset.track;
      const repo = allDiscoveries.find(r => r.full_name === fn)
                || getTracked().find(r => r.full_name === fn);
      if (repo) toggleTrack(repo);
    });
  });
}

function renderAll() {
  renderHeroStats();
  renderTracked();
  renderDiscoveries();
}

// ── Chargement ────────────────────────────────────────────────────

async function loadData() {
  try {
    const res  = await fetch(DATA_URL + "?t=" + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allDiscoveries = data.discoveries || [];
    renderAll();
  } catch (err) {
    console.error("Erreur chargement data.json :", err);
    document.getElementById("discoveries-grid").innerHTML = `
      <div class="empty-state">
        ⚠️ Impossible de charger les données.<br>
        <small>Lancez le pipeline : <code>python -m scripts.run_pipeline</code></small>
      </div>`;
  }
}

// ── Filtres ───────────────────────────────────────────────────────

function initFilters() {
  document.getElementById("cat-filters").addEventListener("click", e => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    document.querySelectorAll("#cat-filters .filter-btn")
            .forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeCategory = btn.dataset.cat;
    renderDiscoveries();
  });

  document.getElementById("radar-search").addEventListener("input", e => {
    searchQuery = e.target.value.trim();
    renderDiscoveries();
  });
}

// ── Init ──────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  initFilters();
  loadData();
});
