/**
 * Tech Watch — Frontend Application
 * Charge data.json et pilote le dashboard
 */

"use strict";

// ── Configuration ────────────────────────────────────────────────
const DATA_URL = "./data.json";

// ── État global ──────────────────────────────────────────────────
let state = {
  releases: [],
  trends: [],
  summaries: [],
  discoveries: [],
  updatedAt: null,
  activeCategory: "all",
  activeImpact: "all",
};

// ── Utilitaires ──────────────────────────────────────────────────

/**
 * Formate une date ISO en string relative lisible.
 */
function formatDate(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (isNaN(d)) return isoStr;
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days}j`;
  if (days < 30) return `il y a ${Math.floor(days / 7)}sem`;
  if (days < 365) return `il y a ${Math.floor(days / 30)}mois`;
  return `il y a ${Math.floor(days / 365)}an`;
}

/**
 * Échappe le HTML pour prévenir les injections.
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Retourne le badge HTML selon le niveau d'impact.
 */
function impactBadge(level) {
  const labels = {
    critical: { icon: "🔴", label: "Critique" },
    high:     { icon: "🟠", label: "Élevé" },
    medium:   { icon: "🟡", label: "Moyen" },
    low:      { icon: "🟢", label: "Faible" },
    unknown:  { icon: "⚪", label: "Inconnu" },
  };
  const { icon, label } = labels[level] || labels.unknown;
  return `<span class="badge badge-${level}">${icon} ${label}</span>`;
}

/**
 * Retourne l'icône de direction de tendance.
 */
function trendIcon(direction) {
  return { rising: "🚀", stable: "→", declining: "📉" }[direction] || "→";
}

// ── Chargement des données ────────────────────────────────────────

async function loadData() {
  try {
    const res = await fetch(DATA_URL + "?t=" + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.releases    = data.releases    || [];
    state.trends       = data.trends       || [];
    state.summaries    = data.summaries    || [];
    state.discoveries  = data.discoveries  || [];
    state.updatedAt    = data.updated_at   || null;
    renderAll();
  } catch (err) {
    console.error("Erreur chargement data.json:", err);
    showError();
  }
}

function showError() {
  document.getElementById("releases-list").innerHTML = `
    <div class="empty-state">
      ⚠️ Impossible de charger les données.<br>
      <small>Lancez le pipeline : <code>python -m scripts.run_pipeline</code></small>
    </div>`;
}

// ── Rendu principal ───────────────────────────────────────────────

function renderAll() {
  renderHeader();
  renderStats();
  renderReleases();
  renderTrends();
  renderTopImpact();
  renderCategoryChart();
  renderDiscoveries();
}

function renderHeader() {
  if (state.updatedAt) {
    const d = new Date(state.updatedAt);
    document.getElementById("last-updated").textContent =
      "Mis à jour " + formatDate(state.updatedAt);
  }
}

function renderStats() {
  const releases = state.releases;
  const critical = releases.filter(r => r.impact_level === "critical").length;
  const rising   = state.trends.filter(t => t.direction === "rising").length;
  const projects = new Set(releases.map(r => r.name)).size;

  document.getElementById("stat-releases").textContent    = releases.length;
  document.getElementById("stat-critical").textContent    = critical;
  document.getElementById("stat-rising").textContent      = rising;
  document.getElementById("stat-projects").textContent    = projects;
  document.getElementById("stat-discoveries").textContent = state.discoveries.length || "—";
}

// ── Releases ─────────────────────────────────────────────────────

function getFilteredReleases() {
  return state.releases
    .filter(r => {
      const catMatch = state.activeCategory === "all" || r.category === state.activeCategory;
      const impMatch = state.activeImpact === "all" || r.impact_level === state.activeImpact;
      return catMatch && impMatch;
    })
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
}

function renderReleases() {
  const container = document.getElementById("releases-list");
  const releases = getFilteredReleases();

  if (releases.length === 0) {
    container.innerHTML = '<div class="empty-state">Aucune release pour ces filtres.</div>';
    return;
  }

  container.innerHTML = releases.slice(0, 30).map(r => renderReleaseCard(r)).join("");

  // Bind click
  container.querySelectorAll(".release-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      const release = state.releases.find(r => r.id === id);
      if (release) openModal(release);
    });
  });
}

function renderReleaseCard(r) {
  const name     = escapeHtml(r.name || "");
  const tag      = escapeHtml(r.tag || "");
  const category = escapeHtml(r.category || "");
  const excerpt  = escapeHtml((r.body_excerpt || "").substring(0, 200));
  const breaking = r.has_breaking_change
    ? '<span class="breaking-badge">⚠ Rupture</span>'
    : "";

  return `
    <article class="release-card" data-id="${escapeHtml(r.id)}" data-impact="${escapeHtml(r.impact_level)}">
      <div class="release-header">
        <span class="release-name">${name}</span>
        <span class="release-tag">${tag}</span>
      </div>
      <div class="release-meta">
        ${impactBadge(r.impact_level)}
        <span class="badge badge-unknown">${category}</span>
        <span class="release-date">${formatDate(r.published_at)}</span>
        ${breaking}
      </div>
      ${excerpt ? `<p class="release-excerpt">${excerpt}</p>` : ""}
    </article>`;
}

// ── Tendances ─────────────────────────────────────────────────────

function renderTrends() {
  const container = document.getElementById("trends-list");
  const trends = state.trends.slice(0, 12);

  if (trends.length === 0) {
    container.innerHTML = '<div class="loading">Aucune tendance disponible.</div>';
    return;
  }

  container.innerHTML = trends.map(t => {
    const name = escapeHtml((t.name || "").replace(/.*\//, ""));
    const fullName = escapeHtml(t.name || "");
    const count = t.release_count_window || 0;
    const ver = t.latest_version ? escapeHtml(t.latest_version) : "";
    return `
      <div class="trend-item" title="${fullName}">
        <span class="trend-direction">${trendIcon(t.direction)}</span>
        <span class="trend-name">${name}</span>
        ${ver ? `<span class="badge badge-unknown" style="font-size:.7rem">${ver}</span>` : ""}
        <span class="trend-count">${count}r/30j</span>
      </div>`;
  }).join("");
}

// ── Top Impact ────────────────────────────────────────────────────

function renderTopImpact() {
  const container = document.getElementById("top-impact");
  const top = [...state.releases]
    .sort((a, b) => (b.impact_score || 0) - (a.impact_score || 0))
    .slice(0, 8);

  if (top.length === 0) {
    container.innerHTML = '<div class="loading">Aucune donnée.</div>';
    return;
  }

  const maxScore = top[0].impact_score || 1;

  container.innerHTML = top.map(r => {
    const name = escapeHtml((r.name || "").replace(/.*\//, ""));
    const pct  = Math.round((r.impact_score / maxScore) * 100);
    return `
      <div class="impact-item" data-id="${escapeHtml(r.id)}">
        <span class="impact-item-name" title="${escapeHtml(r.name)}">${name}</span>
        <div class="impact-score-bar">
          <div class="impact-score-fill" style="width:${pct}%"></div>
        </div>
        <span class="impact-item-score">${(r.impact_score || 0).toFixed(1)}</span>
      </div>`;
  }).join("");

  container.querySelectorAll(".impact-item").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      const r = state.releases.find(x => x.id === id);
      if (r) openModal(r);
    });
  });
}

// ── Graphe catégories ─────────────────────────────────────────────

function renderCategoryChart() {
  const container = document.getElementById("category-chart");
  const counts = {};

  state.releases.forEach(r => {
    const c = r.category || "unknown";
    counts[c] = (counts[c] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    container.innerHTML = '<div class="loading">Aucune donnée.</div>';
    return;
  }

  const max = sorted[0][1];

  container.innerHTML = sorted.map(([cat, count]) => {
    const pct = Math.round((count / max) * 100);
    return `
      <div class="category-row">
        <span class="category-label">${escapeHtml(cat)}</span>
        <div class="category-bar-wrap">
          <div class="category-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="category-count">${count}</span>
      </div>`;
  }).join("");
}

// ── Modal ─────────────────────────────────────────────────────────

function scoreExplanation(release) {
  const parts = [];
  const maj = release.version_major;
  const min = release.version_minor;
  const pat = release.version_patch;

  if (maj !== null && maj !== undefined) {
    if (maj >= 1) parts.push(`Version majeure ×${maj} (+${(maj * 10).toFixed(0)}pts)`);
  }
  if (min) parts.push(`Version mineure ×${min} (+${(min * 3).toFixed(0)}pts)`);
  if (pat) parts.push(`Patch ×${pat} (+${(pat * 0.5).toFixed(1)}pts)`);
  if (release.has_breaking_change) parts.push("Rupture de compatibilité (+8pts)");
  if (release.repo_weight && release.repo_weight !== 1.0)
    parts.push(`Multiplicateur projet ×${release.repo_weight}`);

  return parts.length
    ? `<ul class="score-breakdown">${parts.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`
    : "";
}

function formatDateFull(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (isNaN(d)) return isoStr;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function impactLabel(level) {
  return { critical: "Critique", high: "Élevé", medium: "Moyen", low: "Faible", unknown: "Inconnu" }[level] || level;
}

function impactDescription(level) {
  const desc = {
    critical: "Cette release introduit des changements majeurs (version majeure + rupture de compatibilité ou failles de sécurité). Revue immédiate recommandée.",
    high:     "Changement significatif : version majeure ou breaking change. Planifier une mise à jour.",
    medium:   "Version mineure avec nouvelles fonctionnalités. Pas d'urgence mais à intégrer.",
    low:      "Patch ou correction mineure. Mise à jour de routine.",
    unknown:  "Niveau d'impact non déterminé.",
  };
  return desc[level] || "";
}

function openModal(release) {
  const overlay = document.getElementById("modal-overlay");
  const content = document.getElementById("modal-content");

  const summary  = state.summaries.find(s => s.release_id === release.id);
  const name     = escapeHtml(release.name || "");
  const tag      = escapeHtml(release.tag || "");
  const url      = escapeHtml(release.html_url || "");
  const score    = (release.impact_score || 0).toFixed(1);
  const excerpt  = escapeHtml(release.body_excerpt || "Pas de description disponible.");
  const category = escapeHtml(release.category || "");

  // Version breakdown
  const vMaj = release.version_major;
  const vMin = release.version_minor;
  const vPat = release.version_patch;
  const versionDetail = (vMaj !== null && vMaj !== undefined)
    ? `<span class="ver-part ver-major" title="Majeur">${vMaj}</span>.<span class="ver-part ver-minor" title="Mineur">${vMin ?? "0"}</span>.<span class="ver-part ver-patch" title="Patch">${vPat ?? "0"}</span>`
    : escapeHtml(tag);

  const changesList = summary && summary.changes && summary.changes.length > 0
    ? `<ul class="changes-list">${summary.changes.map(c => `<li>${escapeHtml(c)}</li>`).join("")}</ul>`
    : `<div class="modal-body">${excerpt}</div>`;

  const breakingSection = release.has_breaking_change
    ? `<div class="modal-section">
        <div class="modal-section-label">⚠ Ruptures de compatibilité</div>
        <div class="modal-body modal-breaking">
          ${(release.breaking_snippets || []).map(s => escapeHtml(s)).join("\n") || "Rupture de compatibilité détectée"}
        </div>
       </div>`
    : "";

  const scoreBreakdown = scoreExplanation(release);

  content.innerHTML = `
    <div class="modal-title">${name}</div>
    <div class="modal-tag">${category} · ${formatDateFull(release.published_at)}</div>

    <div class="modal-impact-row">
      ${impactBadge(release.impact_level)}
      ${release.has_breaking_change ? '<span class="breaking-badge">⚠ Rupture</span>' : ""}
      <span class="modal-version">${versionDetail}</span>
    </div>

    <div class="modal-impact-desc">${impactDescription(release.impact_level)}</div>

    <div class="modal-score-row">
      <span class="modal-score-label">Score d'impact</span>
      <span class="modal-score-value impact-${release.impact_level}">${score}</span>
    </div>
    ${scoreBreakdown}

    <div class="modal-section">
      <div class="modal-section-label">Changements</div>
      ${changesList}
    </div>

    ${breakingSection}

    ${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="modal-link">
      Voir la release complète ↗
    </a>` : ""}
  `;

  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  document.body.style.overflow = "";
}

// ── Radar — Outils émergents ──────────────────────────────────────

function renderDiscoveries() {
  const grid    = document.getElementById("discoveries-grid");
  const countEl = document.getElementById("radar-count");
  const items   = state.discoveries;

  if (!grid) return;

  if (items.length === 0) {
    grid.innerHTML = '<div class="loading">Aucune découverte — lancez le pipeline avec GITHUB_TOKEN.</div>';
    if (countEl) countEl.textContent = "";
    return;
  }

  // Mode aperçu : limiter au nombre indiqué par data-preview
  const previewLimit = parseInt(grid.dataset.preview, 10) || items.length;
  const shown = items.slice(0, previewLimit);

  if (countEl) countEl.textContent = `${items.length} détectés`;

  grid.innerHTML = shown.map(repo => renderDiscoveryCard(repo)).join("");
}

function renderDiscoveryCard(repo) {
  const name    = escapeHtml(repo.full_name || "");
  const desc    = escapeHtml(repo.description || "Pas de description.");
  const url     = escapeHtml(repo.url || `https://github.com/${repo.full_name}`);
  const stars   = (repo.stars || 0).toLocaleString("fr-FR");
  const lang    = repo.language ? `<span class="disc-lang">${escapeHtml(repo.language)}</span>` : "";
  const cat     = escapeHtml(repo.category || "");
  const src     = escapeHtml(repo.discovery_source || "");
  const pushed  = repo.pushed_at ? formatDate(repo.pushed_at) : "—";

  return `
    <article class="discovery-card">
      <div class="disc-header">
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="disc-name">${name}</a>
        <span class="disc-stars">★ ${stars}</span>
      </div>
      <p class="disc-desc">${desc}</p>
      <div class="disc-meta">
        ${cat ? `<span class="disc-cat">${cat}</span>` : ""}
        ${lang}
        <span class="disc-source">via ${src}</span>
        <span class="disc-date">${pushed}</span>
      </div>
    </article>`;
}

// ── Filtres ───────────────────────────────────────────────────────

function initFilters() {
  // Filtre catégorie
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeCategory = btn.dataset.filter;
      renderReleases();
    });
  });

  // Filtre impact
  document.querySelectorAll(".impact-filter").forEach(el => {
    el.addEventListener("click", () => {
      document.querySelectorAll(".impact-filter").forEach(e => e.classList.remove("active"));
      el.classList.add("active");
      state.activeImpact = el.dataset.impact;
      renderReleases();
    });
  });

  // Fermeture modal
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-overlay").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeModal();
  });
}

// ── Init ──────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  initFilters();
  loadData();
});
