/* compare.js — Comparatifs & Benchmarks
   Dépendance : Chart.js 4.x (chargé via CDN dans compare.html)
*/

// ── Palette de couleurs (dark-mode friendly) ────────────────────
const PALETTE = [
  "#58a6ff",  // bleu accent
  "#a371f7",  // violet
  "#3fb950",  // vert
  "#d29922",  // jaune
  "#f85149",  // rouge
  "#db6d28",  // orange
  "#39d353",  // vert clair
];

// ── Config globale Chart.js ──────────────────────────────────────
Chart.defaults.color            = "#8b949e";
Chart.defaults.borderColor      = "#30363d";
Chart.defaults.font.family      = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size        = 12;
Chart.defaults.plugins.legend.labels.boxWidth   = 12;
Chart.defaults.plugins.legend.labels.padding    = 14;
Chart.defaults.plugins.tooltip.backgroundColor  = "#1c2128";
Chart.defaults.plugins.tooltip.borderColor      = "#30363d";
Chart.defaults.plugins.tooltip.borderWidth      = 1;
Chart.defaults.plugins.tooltip.titleColor       = "#e6edf3";
Chart.defaults.plugins.tooltip.bodyColor        = "#8b949e";
Chart.defaults.plugins.tooltip.padding          = 10;

// ── Helpers ──────────────────────────────────────────────────────
function makeBarDataset(label, data, idx) {
  return {
    label,
    data,
    backgroundColor: PALETTE[idx % PALETTE.length] + "cc",
    borderColor:     PALETTE[idx % PALETTE.length],
    borderWidth: 1,
    borderRadius: 4,
  };
}

function makeRadarDataset(label, data, idx) {
  return {
    label,
    data,
    backgroundColor: PALETTE[idx % PALETTE.length] + "22",
    borderColor:     PALETTE[idx % PALETTE.length],
    pointBackgroundColor: PALETTE[idx % PALETTE.length],
    borderWidth: 2,
    pointRadius: 3,
  };
}

function hBar(canvasId, labels, datasets, xLabel = "") {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        x: {
          grid: { color: "#21262d" },
          title: { display: !!xLabel, text: xLabel, color: "#6e7681" },
        },
        y: { grid: { color: "#21262d" } },
      },
    },
  });
}

function radar(canvasId, dimensions, datasets) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  new Chart(ctx, {
    type: "radar",
    data: { labels: dimensions, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { stepSize: 20, backdropColor: "transparent", color: "#6e7681" },
          grid: { color: "#21262d" },
          angleLines: { color: "#21262d" },
          pointLabels: { color: "#8b949e", font: { size: 11 } },
        },
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// DONNÉES PAR CATÉGORIE
// ═══════════════════════════════════════════════════════════════

// ── DataFrames ────────────────────────────────────────────────
function initDataFrames() {
  // Benchmark GroupBy (multiple opérations), Pandas = 1×
  hBar(
    "chart-df-bench",
    ["Pandas", "Modin", "Dask (4t)", "Polars", "DuckDB"],
    [
      makeBarDataset("GroupBy ×",  [1.0,  1.7,  2.3, 12.4, 15.8], 0),
      makeBarDataset("Join ×",     [1.0,  1.5,  1.9,  8.2, 13.1], 1),
      makeBarDataset("Filter ×",   [1.0,  1.6,  2.1,  5.9,  9.4], 2),
      makeBarDataset("Sort ×",     [1.0,  1.4,  1.7,  4.2,  6.6], 3),
    ],
    "× Pandas"
  );

  // Radar multidimensionnel
  radar(
    "chart-df-radar",
    ["Vitesse", "Mémoire eff.", "Richesse API", "Communauté", "Maturité", "Lazy / Stream"],
    [
      makeRadarDataset("Pandas",  [22, 28, 95, 100, 100,  8], 0),
      makeRadarDataset("Polars",  [92, 88, 76,  74,  66, 90], 1),
      makeRadarDataset("DuckDB",  [95, 86, 64,  72,  74, 96], 2),
      makeRadarDataset("Dask",    [52, 48, 70,  80,  86, 72], 3),
      makeRadarDataset("Modin",   [48, 44, 91,  54,  56, 16], 4),
    ]
  );
}

// ── IA / LLM ─────────────────────────────────────────────────
function initAI() {
  // Stars GitHub (k)
  hBar(
    "chart-ai-bench",
    ["DSPy", "Haystack", "LlamaIndex", "AutoGen", "LangChain"],
    [makeBarDataset("Stars GitHub (k)", [22, 18, 38, 40, 98], 1)],
    "Stars (milliers)"
  );

  radar(
    "chart-ai-radar",
    ["Écosystème", "RAG", "Agents", "Observabilité", "Facilité", "Maturité"],
    [
      makeRadarDataset("LangChain",  [98, 82, 88, 68, 42, 80], 0),
      makeRadarDataset("LlamaIndex", [74, 95, 68, 64, 70, 66], 1),
      makeRadarDataset("Haystack",   [60, 80, 62, 82, 76, 72], 2),
      makeRadarDataset("AutoGen",    [52, 55, 96, 46, 48, 54], 3),
      makeRadarDataset("DSPy",       [45, 72, 55, 50, 62, 44], 4),
    ]
  );
}

// ── Lakehouse ────────────────────────────────────────────────
function initLakehouse() {
  // Score par dimension (indépendamment du radar)
  hBar(
    "chart-lake-bench",
    ["Hudi", "Delta Lake", "Iceberg", "Databricks"],
    [
      makeBarDataset("Transactions ACID", [88, 95, 92, 96], 0),
      makeBarDataset("Streaming / CDC",   [96, 90, 78, 95], 1),
      makeBarDataset("Time Travel",       [82, 92, 96, 96], 2),
      makeBarDataset("Open source",       [92, 78, 98, 36], 2),
    ],
    "Score /100"
  );

  radar(
    "chart-lake-radar",
    ["ACID", "Streaming", "Time Travel", "Perf. lecture", "Open source", "Cloud managé"],
    [
      makeRadarDataset("Delta Lake",  [95, 90, 92, 85, 78, 88], 0),
      makeRadarDataset("Iceberg",     [92, 78, 96, 88, 98, 94], 1),
      makeRadarDataset("Apache Hudi", [88, 96, 82, 78, 92, 80], 2),
      makeRadarDataset("Databricks",  [96, 94, 96, 96, 36, 99], 4),
    ]
  );
}

// ── Backend Python ───────────────────────────────────────────
function initBackend() {
  hBar(
    "chart-be-bench",
    ["Django", "Flask", "FastAPI", "Litestar", "Starlette"],
    [makeBarDataset("Req/s (× 1 000)", [4.8, 6.5, 25, 29, 31], 0)],
    "req/s (milliers)"
  );

  radar(
    "chart-be-radar",
    ["Vitesse", "DX", "Async", "Validation auto", "Docs auto", "Maturité"],
    [
      makeRadarDataset("FastAPI",   [90, 92, 95, 92, 96, 80], 0),
      makeRadarDataset("Litestar",  [94, 78, 95, 94, 90, 52], 1),
      makeRadarDataset("Starlette", [96, 68, 98, 46, 38, 78], 2),
      makeRadarDataset("Flask",     [38, 86, 38, 38, 72, 100], 3),
      makeRadarDataset("Django",    [30, 82, 58, 76, 88, 100], 4),
    ]
  );
}

// ── Rust Tooling ─────────────────────────────────────────────
function initRustTools() {
  hBar(
    "chart-rust-bench",
    ["Pylint", "Flake8", "Black", "isort", "Ruff (lint+fmt)", "pip", "Poetry", "uv"],
    [
      makeBarDataset("Vitesse relative (×)", [0.1, 1, 5, 4, 100, 1, 2, 50], 0),
    ],
    "× outil de référence"
  );

  radar(
    "chart-rust-radar",
    ["Vitesse", "Compatibilité", "Config", "Intégration IDE", "Couverture règles", "Maturité"],
    [
      makeRadarDataset("Ruff",   [99, 88, 78, 92, 80, 76], 0),
      makeRadarDataset("Flake8", [40, 98, 72, 92, 72, 100], 3),
      makeRadarDataset("Pylint", [18, 95, 90, 88, 98, 100], 4),
      makeRadarDataset("Black",  [82, 92, 40, 96, 100, 96], 2),
    ]
  );
}

// ═══════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════
function initTabs() {
  const tabs = document.querySelectorAll(".ctab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      // Mettre à jour les onglets
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      // Afficher/masquer les sections
      document.querySelectorAll(".csection").forEach(sec => {
        sec.classList.add("csection-hidden");
      });
      const section = document.getElementById(`tab-${target}`);
      if (section) section.classList.remove("csection-hidden");
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initDataFrames();
  initAI();
  initLakehouse();
  initBackend();
  initRustTools();
});
