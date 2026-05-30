/**
 * Tech Watch — Frontend Application
 * Charge data.json et pilote le dashboard
 */

"use strict";

// ── Configuration ────────────────────────────────────────────────
const DATA_URL = "./data.json";

// ── État global ──────────────────────────────────────────────────
const PAGE_SIZE = 10;

// Profils disponibles (clés doivent correspondre à config.yaml)
const PROFILES = [
  { id: "data_engineering",       label: "Data Engineering" },
  { id: "analytics_engineering",  label: "Analytics Eng." },
  { id: "python",                 label: "Python" },
  { id: "rust",                   label: "Rust" },
  { id: "ai_llm",                 label: "AI / LLM" },
  { id: "cloud",                  label: "Cloud" },
  { id: "frontend",               label: "Frontend" },
];

let state = {
  releases: [],
  trends: [],
  summaries: [],
  discoveries: [],
  updatedAt: null,
  activeCategory: "all",
  activeImpact: "all",
  activeProfiles: ["data_engineering"],  // profil(s) sélectionné(s)
  currentPage: 1,
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
    critical: { icon: "🔴", label: "CRITICAL" },
    high:     { icon: "🟠", label: "HIGH" },
    moderate: { icon: "🟡", label: "MODERATE" },
    medium:   { icon: "🟡", label: "MODERATE" },  // alias
    low:      { icon: "🟢", label: "LOW" },
    unknown:  { icon: "⚪", label: "Inconnu" },
  };
  const { icon, label } = labels[level] || labels.unknown;
  return `<span class="badge badge-${level === 'medium' ? 'moderate' : level}">${icon} ${label}</span>`;
}

/**
 * Retourne la classe CSS de couleur pour un score numérique.
 */
function scoreColorClass(level) {
  const map = { critical: "impact-critical", high: "impact-high",
    moderate: "impact-moderate", medium: "impact-moderate", low: "impact-low" };
  return map[level] || "impact-unknown";
}

/**
 * Calcule le final_score de la release (0–100).
 * Formule : min(100, technical × 0.7 + relevance × 3)
 * Si la donnée est déjà dans la release (pré-calculée), on la retourne directement.
 */
function getFinalScore(r) {
  if (r.final_score != null && r.final_score >= 0) return r.final_score;
  const tech = r.technical_score || r.impact_score || 0;
  const rel  = r.relevance_score || 0;
  return Math.round(Math.min(100, (tech * 0.7) + (rel * 3)) * 10) / 10;
}

/**
 * Formate les facteurs détectés en liste lisible.
 */
function formatFactors(detectedFactors) {
  if (!detectedFactors || !detectedFactors.length) return "";
  const labels = {
    security:       "Sécurité / CVE",
    breaking_change:"Breaking Change",
    deprecated:     "Dépréciation",
    removed:        "Suppression",
    migration:      "Migration",
    performance:    "Performance",
    enhancement:    "Enhancement",
    bug_fix:        "Bug Fix",
    documentation:  "Documentation",
  };
  return detectedFactors
    .filter(f => f.count > 0)
    .map(f => {
      const lbl = labels[f.category] || f.category;
      return `<li><span class="factor-count">${f.count}</span> ${escapeHtml(lbl)}</li>`;
    })
    .join("");
}

/**
 * Retourne l'icône et la classe CSS pour une action recommandée.
 */
function actionIcon(action) {
  const map = {
    "URGENT":              { icon: "🚨", cls: "action-critical" },
    "PLANIFIER MIGRATION": { icon: "⚠️",  cls: "action-high" },
    "METTRE À JOUR":       { icon: "🔄",  cls: "action-moderate" },
    "SURVEILLER":          { icon: "👁",   cls: "action-low" },
    "IGNORER":             { icon: "💤",  cls: "action-ignore" },
  };
  return map[action] || { icon: "ℹ️", cls: "" };
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
  const container  = document.getElementById("releases-list");
  const pagination = document.getElementById("releases-pagination");
  const releases   = getFilteredReleases();

  if (releases.length === 0) {
    container.innerHTML = '<div class="empty-state">Aucune release pour ces filtres.</div>';
    if (pagination) pagination.innerHTML = "";
    return;
  }

  const totalPages = Math.ceil(releases.length / PAGE_SIZE);
  // Recadrer la page courante si elle dépasse le total après un changement de filtre
  if (state.currentPage > totalPages) state.currentPage = 1;

  const start = (state.currentPage - 1) * PAGE_SIZE;
  const page  = releases.slice(start, start + PAGE_SIZE);

  container.innerHTML = page.map(r => renderReleaseCard(r)).join("");

  // Bind click → modal
  container.querySelectorAll(".release-card").forEach(card => {
    card.addEventListener("click", () => {
      const release = state.releases.find(r => r.id === card.dataset.id);
      if (release) openModal(release);
    });
  });

  // Pagination
  if (pagination) renderPagination(pagination, totalPages, releases.length);
}

function renderPagination(container, totalPages, totalItems) {
  if (totalPages <= 1) { container.innerHTML = ""; return; }

  const cur   = state.currentPage;
  const start = (cur - 1) * PAGE_SIZE + 1;
  const end   = Math.min(cur * PAGE_SIZE, totalItems);

  // Génère les numéros à afficher : toujours 1, ..., cur-1, cur, cur+1, ..., last
  const pages = new Set([1, totalPages, cur, cur - 1, cur + 1].filter(p => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);

  const btnHtml = sorted.reduce((acc, p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) acc += '<span class="page-ellipsis">…</span>';
    acc += `<button class="page-btn${p === cur ? " active" : ""}" data-page="${p}">${p}</button>`;
    return acc;
  }, "");

  container.innerHTML = `
    <div class="pagination">
      <button class="page-btn page-prev" data-page="${cur - 1}" ${cur === 1 ? "disabled" : ""}>‹</button>
      ${btnHtml}
      <button class="page-btn page-next" data-page="${cur + 1}" ${cur === totalPages ? "disabled" : ""}>›</button>
      <span class="page-info">${start}–${end} / ${totalItems}</span>
    </div>`;

  container.querySelectorAll(".page-btn:not([disabled])").forEach(btn => {
    btn.addEventListener("click", () => {
      state.currentPage = parseInt(btn.dataset.page, 10);
      renderReleases();
      // Remonter en haut de la liste
      document.getElementById("releases-list").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function renderReleaseCard(r) {
  const name       = escapeHtml(r.name || "");
  const tag        = escapeHtml(r.tag || "");
  const category   = escapeHtml(r.category || "");
  const excerpt    = escapeHtml((r.body_excerpt || "").substring(0, 180));
  const breaking   = r.has_breaking_change
    ? '<span class="breaking-badge">⚠ Rupture</span>'
    : "";

  // Scores
  const techScore  = (r.technical_score || r.impact_score || 0).toFixed(0);
  const relScore   = r.relevance_score != null ? r.relevance_score.toFixed(0) : "—";
  const finalScore = getFinalScore(r).toFixed(0);
  const lvl        = r.impact_level || "unknown";

  // Action recommandée + Urgence
  const action     = r.action_recommended || "";
  const { icon: aIcon, cls: aCls } = actionIcon(action);
  const urgency    = r.urgency_level || "";
  const urgencyMap = {
    "URGENT": { icon: "🔴", cls: "urgency-urgent", label: "URGENT — faille sécurité" },
    "HIGH":   { icon: "🟠", cls: "urgency-high",   label: "HIGH — breaking change" },
    "MEDIUM": { icon: "🟡", cls: "urgency-medium",  label: "MEDIUM — migration requise" },
    "LOW":    { icon: "🟢", cls: "urgency-low",     label: "LOW — routine" },
  };
  const urgencyInfo = urgencyMap[urgency] || null;

  // Facteurs (jusqu'à 3)
  let factors = r.detected_factors || [];
  if (typeof factors === "string") {
    try { factors = JSON.parse(factors); } catch (_) { factors = []; }
  }
  const topFactors = factors.slice(0, 3);
  const factorTags = topFactors.map(f => {
    const lbl = { security:"SEC", breaking_change:"BC", deprecated:"DEP",
      removed:"REM", migration:"MIG", performance:"PERF",
      enhancement:"ENH", bug_fix:"FIX", documentation:"DOC" }[f.category] || f.category;
    return `<span class="factor-tag factor-${f.category}">${lbl}×${f.count}</span>`;
  }).join("");

  return `
    <article class="release-card" data-id="${escapeHtml(r.id)}" data-impact="${escapeHtml(lvl)}">
      <div class="release-header">
        <span class="release-name">${name}</span>
        <span class="release-tag">${tag}</span>
      </div>
      <div class="release-meta">
        ${impactBadge(lvl)}
        <span class="badge badge-unknown">${category}</span>
        <span class="release-date">${formatDate(r.published_at)}</span>
        ${breaking}
      </div>
      <div class="release-scores">
        <span class="score-pill score-tech" title="Score technique">T:${techScore}</span>
        <span class="score-pill score-rel"  title="Score pertinence">R:${relScore}</span>
        <span class="score-pill score-final ${scoreColorClass(lvl)}" title="Score final">F:${finalScore}</span>
        ${action ? `<span class="action-pill ${aCls}" title="${escapeHtml(action)}">${aIcon} ${escapeHtml(action)}</span>` : ""}
        ${urgencyInfo ? `<span class="urgency-pill ${urgencyInfo.cls}" title="Urgence : ${urgencyInfo.label}">${urgencyInfo.icon}</span>` : ""}
      </div>
      ${factorTags ? `<div class="factor-tags">${factorTags}</div>` : ""}
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

/**
 * Génère le bloc HTML d'explication du score d'impact (nouveau moteur changelog).
 */
function scoreExplanation(release) {
  let factors = release.detected_factors || [];
  if (typeof factors === "string") {
    try { factors = JSON.parse(factors); } catch (_) { factors = []; }
  }

  if (!factors.length) return "";

  const labels = {
    security:       "Sécurité / CVE",
    breaking_change:"Breaking Change",
    deprecated:     "Dépréciation",
    removed:        "Suppression de fonctionnalité",
    migration:      "Migration requise",
    performance:    "Amélioration de performance",
    enhancement:    "Enhancement / Nouvelle fonctionnalité",
    bug_fix:        "Correction de bug",
    documentation:  "Documentation",
  };

  const items = factors.map(f => {
    const lbl   = labels[f.category] || f.category;
    const score = f.score_contribution != null ? ` (+${f.score_contribution.toFixed(0)}pts)` : "";
    return `<li><strong>${f.count}×</strong> ${escapeHtml(lbl)}${score}</li>`;
  }).join("");

  return `<ul class="score-breakdown">${items}</ul>`;
}

function formatDateFull(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (isNaN(d)) return isoStr;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function impactLabel(level) {
  return {
    critical: "CRITICAL", high: "HIGH", moderate: "MODERATE",
    medium: "MODERATE", low: "LOW", unknown: "Inconnu",
  }[level] || level;
}

function impactDescription(level) {
  const desc = {
    critical: "Score final > 80 + SECURITY/BREAKING détecté — faille ou rupture confirmée. Action immédiate requise.",
    high:     "Score final 51–80 — impacts importants. Planifier la mise à jour.",
    moderate: "Score final 21–50 — changements notables non critiques. À intégrer dans le prochain cycle.",
    medium:   "Score final 21–50 — changements notables non critiques. À intégrer dans le prochain cycle.",
    low:      "Score final ≤ 20 — impact faible : docs, bugfixes mineurs ou corrections de routine.",
    unknown:  "Niveau d'impact non déterminé — changelog insuffisant.",
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

  // Scores
  const techScore  = (release.technical_score || release.impact_score || 0).toFixed(1);
  const relScore   = release.relevance_score != null ? release.relevance_score.toFixed(1) : "—";
  const finalScore = getFinalScore(release).toFixed(1);
  const action     = release.action_recommended || "";
  const { icon: aIcon, cls: aCls } = actionIcon(action);
  const urgency    = release.urgency_level || "";
  const modalUrgencyMap = {
    "URGENT": { icon: "🔴", cls: "urgency-urgent", label: "URGENT — faille sécurité" },
    "HIGH":   { icon: "🟠", cls: "urgency-high",   label: "HIGH — breaking change" },
    "MEDIUM": { icon: "🟡", cls: "urgency-medium",  label: "MEDIUM — migration requise" },
    "LOW":    { icon: "🟢", cls: "urgency-low",     label: "LOW — routine" },
  };
  const modalUrgencyInfo = modalUrgencyMap[urgency] || null;

  // Reasons
  const reasons = release.analysis_reasons || [];
  const reasonsList = reasons.length
    ? `<ul class="reasons-list">${reasons.map(r => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
    : "";

  content.innerHTML = `
    <div class="modal-title">${name}</div>
    <div class="modal-tag">${category} · ${formatDateFull(release.published_at)}</div>

    <div class="modal-impact-row">
      ${impactBadge(release.impact_level)}
      ${release.has_breaking_change ? '<span class="breaking-badge">⚠ Rupture</span>' : ""}
      <span class="modal-version">${versionDetail}</span>
    </div>

    <div class="modal-impact-desc">${impactDescription(release.impact_level)}</div>

    <div class="modal-scores-grid">
      <div class="modal-score-box">
        <span class="modal-score-label">Score Technique</span>
        <span class="modal-score-value impact-${release.impact_level}">${techScore}<small style="font-size:.6em;opacity:.6">/100</small></span>
      </div>
      <div class="modal-score-box">
        <span class="modal-score-label">Score Pertinence</span>
        <span class="modal-score-value">${relScore}<small style="font-size:.6em;opacity:.6">/10</small></span>
      </div>
      <div class="modal-score-box">
        <span class="modal-score-label">Score Final</span>
        <span class="modal-score-value impact-${release.impact_level}">${finalScore}<small style="font-size:.6em;opacity:.6">/100</small></span>
      </div>
    </div>

    ${action ? `<div class="modal-action ${aCls}">
      <span class="modal-action-icon">${aIcon}</span>
      <span class="modal-action-label">Action recommandée</span>
      <span class="modal-action-value">${escapeHtml(action)}</span>
    </div>` : ""}

    ${modalUrgencyInfo ? `<div class="modal-urgency ${modalUrgencyInfo.cls}">
      <span class="modal-urgency-icon">${modalUrgencyInfo.icon}</span>
      <span class="modal-urgency-label">Urgence</span>
      <span class="modal-urgency-value">${modalUrgencyInfo.label}</span>
    </div>` : ""}

    <div class="modal-section">
      <div class="modal-section-label">Facteurs détectés</div>
      ${scoreBreakdown || '<div class="modal-body">Aucun facteur détecté dans le changelog.</div>'}
    </div>

    ${reasonsList ? `<div class="modal-section">
      <div class="modal-section-label">Analyse</div>
      ${reasonsList}
    </div>` : ""}

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
      state.currentPage = 1;
      renderReleases();
    });
  });

  // Filtre impact
  document.querySelectorAll(".impact-filter").forEach(el => {
    el.addEventListener("click", () => {
      document.querySelectorAll(".impact-filter").forEach(e => e.classList.remove("active"));
      el.classList.add("active");
      state.activeImpact = el.dataset.impact;
      state.currentPage = 1;
      renderReleases();
    });
  });

  // Sélecteur de profils
  document.querySelectorAll(".profile-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const profile = btn.dataset.profile;
      if (btn.classList.contains("active")) {
        // Ne pas désactiver si c'est le seul actif
        if (state.activeProfiles.length > 1) {
          state.activeProfiles = state.activeProfiles.filter(p => p !== profile);
          btn.classList.remove("active");
        }
      } else {
        state.activeProfiles.push(profile);
        btn.classList.add("active");
      }
      state.currentPage = 1;
      renderReleases();
      renderTopImpact();
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

// ── Tri par profil ────────────────────────────────────────────────

/**
 * Trie les releases par final_score décroissant (basé sur les profils actifs).
 * Si la release a déjà un final_score pré-calculé (pipeline), on l'utilise.
 * Sinon, on trie par impact_score.
 */
function sortByProfileRelevance(releases) {
  return [...releases].sort((a, b) => {
    const fa = getFinalScore(a);
    const fb = getFinalScore(b);
    if (fb !== fa) return fb - fa;
    return new Date(b.published_at) - new Date(a.published_at);
  });
}

// ── Init ──────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  initFilters();
  loadData();
});
