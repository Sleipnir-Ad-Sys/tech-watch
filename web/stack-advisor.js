/**
 * Stack Advisor v2 — Moteur de recommandation rule-based
 *
 * Modèle de contexte :
 *   - volume        : small / medium / large / massive
 *   - tasks         : etl / analytics / api / ml / streaming / script / reporting
 *   - executionMode : local / distributed / unknown  ← NOUVEAU
 *   - dataFormat    : csv / parquet / db / api / logs / unknown ← NOUVEAU
 *   - constraints   : performance / simplicity / scalability / maintenance / realtime
 *
 * Règles critiques :
 *   - Spark UNIQUEMENT si executionMode=distributed ET volume≥large
 *   - MÉDIUM toujours rempli (≥ 1 outil)
 *   - NE PAS UTILISER = contextuel, jamais absolu
 */

"use strict";


// ═══════════════════════════════════════════════════════════════════
// 1. CATALOGUE D'OUTILS
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {"local"|"distributed"|"any"} ExecRequirement
 * @typedef {"data"|"backend"|"math"|"storage"|"bigdata"|"devtool"} ToolCategory
 * @typedef {"etl"|"analytics"|"api"|"ml"|"script"|"streaming"|"reporting"} TaskType
 * @typedef {"small"|"medium"|"large"|"massive"} VolumeLevel
 *
 * @typedef {Object} Tool
 * @property {string}                id
 * @property {string}                name
 * @property {string}                icon
 * @property {ToolCategory}          category
 * @property {string}                description
 * @property {VolumeLevel[]}         goodVolumes     +30 pts
 * @property {VolumeLevel[]}         warnVolumes     -15 pts, pas de mismatch
 * @property {VolumeLevel[]}         badVolumes      -50 pts, isMismatch=true
 * @property {TaskType[]}            goodTasks
 * @property {TaskType[]}            badTasks
 * @property {ExecRequirement}       executionRequirement
 * @property {string[]}              goodFormats
 * @property {string[]}              tags
 * @property {number}                baseScore       0-100
 * @property {number}                simplicity      1=simple … 5=complexe
 * @property {string}                avoidReason     raison générique
 * @property {Record<string,string>} contextualAvoid raisons par contexte
 */

/** @type {Tool[]} */
const TOOLS = [
  // ── Data Processing ─────────────────────────────────────────────
  {
    id: "polars",
    functionalRole: "dataframe_processing",
    name: "Polars",
    icon: "🐻",
    category: "data",
    description: "DataFrame ultra-performant, lazy evaluation, columnar, multi-thread",
    goodVolumes: ["medium", "large", "massive"],
    warnVolumes: [],
    badVolumes: ["small"],
    goodTasks: ["etl", "analytics", "ml", "reporting"],
    badTasks: ["api", "streaming"],
    executionRequirement: "any",
    goodFormats: ["csv", "parquet"],
    tags: ["dataframe", "csv", "parquet", "performance", "vectorise", "colonnes", "agregations", "kpi", "rapide", "efficace"],
    baseScore: 85,
    simplicity: 3,
    avoidReason: "Inadapté aux APIs REST ou au streaming continu.",
    contextualAvoid: {
      api:       "Polars est un outil de traitement batch, pas un framework API.",
      streaming: "Polars est orienté batch. Utiliser Kafka + consommeur pour le streaming.",
    },
  },
  {
    id: "pandas",
    functionalRole: "dataframe_processing",
    name: "pandas",
    icon: "🐼",
    category: "data",
    description: "DataFrame standard Python, vaste écosystème, simple à prendre en main",
    goodVolumes: ["small", "medium"],
    warnVolumes: ["large"],
    badVolumes: ["massive"],
    goodTasks: ["etl", "analytics", "ml", "script", "reporting"],
    badTasks: ["api", "streaming"],
    executionRequirement: "any",
    goodFormats: ["csv", "parquet"],
    tags: ["dataframe", "csv", "standard", "jupyter", "notebook", "connu", "simple", "classique"],
    baseScore: 65,
    simplicity: 1,
    avoidReason: "Lent et gourmand en RAM sur gros volumes (> 5-10 M lignes).",
    contextualAvoid: {
      large:   "Fonctionnel sur ~10-20M lignes mais 5-10x plus lent que Polars. Acceptable pour un prototype.",
      massive: "Hors capacité sur 100M+ lignes : OOM fréquent. Utiliser Polars ou DuckDB.",
    },
  },
  {
    id: "duckdb",
    functionalRole: "sql_analytics",
    name: "DuckDB",
    icon: "🦆",
    category: "data",
    description: "Moteur SQL OLAP local, vectorisé, query-pushdown sur fichiers Parquet/CSV",
    goodVolumes: ["medium", "large", "massive"],
    warnVolumes: [],
    badVolumes: ["small"],
    goodTasks: ["analytics", "etl", "reporting"],
    badTasks: ["api", "streaming"],
    executionRequirement: "any",
    goodFormats: ["csv", "parquet", "db"],
    tags: ["sql", "analytics", "parquet", "olap", "requetes", "agregations", "kpi", "jointures", "local"],
    baseScore: 82,
    simplicity: 2,
    avoidReason: "Orienté analytics SQL local, pas conçu pour APIs ou streaming.",
    contextualAvoid: {
      api:       "DuckDB est un moteur analytique embarqué, pas un serveur API.",
      streaming: "DuckDB est un moteur batch, pas temps réel.",
    },
  },
  {
    id: "pyarrow",
    functionalRole: "serialization",
    name: "PyArrow",
    icon: "🏹",
    category: "data",
    description: "Interopérabilité données (Parquet, Arrow IPC, columnar in-memory)",
    goodVolumes: ["medium", "large", "massive"],
    warnVolumes: [],
    badVolumes: ["small"],
    goodTasks: ["etl"],
    badTasks: ["api", "streaming"],
    executionRequirement: "any",
    goodFormats: ["parquet"],
    tags: ["parquet", "arrow", "interop", "serialisation", "pipeline", "columnar"],
    baseScore: 68,
    simplicity: 4,
    avoidReason: "API bas niveau, à combiner avec Polars/DuckDB plutôt qu'utiliser seul.",
    contextualAvoid: {
      api: "PyArrow est une lib de sérialisation, pas un framework API.",
    },
  },

  // ── Backend ─────────────────────────────────────────────────────
  {
    id: "fastapi",
    functionalRole: "api_layer",
    name: "FastAPI",
    icon: "⚡",
    category: "backend",
    description: "API async moderne, OpenAPI auto, validation Pydantic, très performant",
    goodVolumes: ["small", "medium", "large"],
    warnVolumes: [],
    badVolumes: [],
    goodTasks: ["api", "streaming"],
    badTasks: ["etl", "analytics"],
    executionRequirement: "any",
    goodFormats: ["api"],
    tags: ["api", "rest", "http", "endpoint", "service", "web", "async", "microservice", "exposer"],
    baseScore: 88,
    simplicity: 2,
    avoidReason: "Conçu pour exposer des endpoints, pas pour traiter des données en batch.",
    contextualAvoid: {
      etl:       "Un framework API n'est pas adapté à un pipeline ETL. Utiliser Polars ou DuckDB.",
      analytics: "FastAPI expose des données, il ne les analyse pas.",
    },
  },
  {
    id: "flask",
    functionalRole: "api_layer",
    name: "Flask",
    icon: "🫙",
    category: "backend",
    description: "Micro-framework web minimaliste, très facile à démarrer, idéal pour prototypes",
    goodVolumes: ["small", "medium"],
    warnVolumes: ["large"],
    badVolumes: [],
    goodTasks: ["api", "script"],
    badTasks: ["etl", "analytics", "streaming"],
    executionRequirement: "any",
    goodFormats: ["api"],
    tags: ["api", "rest", "http", "web", "simple", "prototype", "leger"],
    baseScore: 60,
    simplicity: 1,
    avoidReason: "Pas async natif, moins adapté aux APIs haute charge.",
    contextualAvoid: {
      large:     "Flask synchrone devient un goulot à forte charge. Préférer FastAPI.",
      etl:       "Flask est un serveur web, pas un outil ETL.",
      analytics: "Flask expose des données, il ne les analyse pas.",
    },
  },
  {
    id: "django",
    functionalRole: "api_layer",
    name: "Django",
    icon: "🎸",
    category: "backend",
    description: "Framework web complet : admin, ORM, authentification, i18n inclus",
    goodVolumes: ["small", "medium"],
    warnVolumes: [],
    badVolumes: [],
    goodTasks: ["api"],
    badTasks: ["etl", "analytics", "ml", "streaming"],
    executionRequirement: "any",
    goodFormats: ["api", "db"],
    tags: ["api", "web", "admin", "orm", "authentification", "complet"],
    baseScore: 55,
    simplicity: 2,
    avoidReason: "Lourd pour des APIs simples. Idéal pour apps web complètes avec admin/auth.",
    contextualAvoid: {
      etl:       "Django est un framework web applicatif, pas un outil ETL.",
      analytics: "Django ne fait pas d'analyse de données.",
    },
  },

  // ── Math / Compute ───────────────────────────────────────────────
  {
    id: "numpy",
    functionalRole: "math_compute",
    name: "NumPy",
    icon: "🔢",
    category: "math",
    description: "Calcul vectorisé, tableaux N-dim, fondation de l'écosystème scientifique Python",
    goodVolumes: ["small", "medium"],
    warnVolumes: ["large"],
    badVolumes: ["massive"],
    goodTasks: ["ml", "analytics", "script"],
    badTasks: ["api", "streaming"],
    executionRequirement: "any",
    goodFormats: ["csv"],
    tags: ["calcul", "math", "matrice", "vecteur", "scientifique", "numerique", "ml"],
    baseScore: 62,
    simplicity: 2,
    avoidReason: "Pas de lazy evaluation. Charge tout en RAM.",
    contextualAvoid: {
      massive: "NumPy charge tout en RAM, impossible sur volumes massifs.",
      api:     "NumPy est une lib de calcul, pas un framework API.",
    },
  },
  {
    id: "scipy",
    functionalRole: "math_compute",
    name: "SciPy",
    icon: "🔬",
    category: "math",
    description: "Algorithmes scientifiques : stats, signal, optimisation, algèbre linéaire",
    goodVolumes: ["small", "medium"],
    warnVolumes: [],
    badVolumes: ["massive"],
    goodTasks: ["ml", "analytics"],
    badTasks: ["api", "etl", "streaming"],
    executionRequirement: "any",
    goodFormats: ["csv"],
    tags: ["stats", "statistiques", "signal", "optimisation", "scientifique"],
    baseScore: 55,
    simplicity: 3,
    avoidReason: "Spécialisé algorithmes scientifiques. Pas un outil ETL.",
    contextualAvoid: {
      etl: "SciPy n'est pas un outil ETL.",
      api: "SciPy est une bibliothèque de calcul scientifique, pas un framework API.",
    },
  },
  {
    id: "scikit-learn",
    functionalRole: "ml_compute",
    name: "scikit-learn",
    icon: "🤖",
    category: "math",
    description: "ML classique : classification, régression, clustering, pipelines sklearn",
    goodVolumes: ["small", "medium"],
    warnVolumes: ["large"],
    badVolumes: ["massive"],
    goodTasks: ["ml"],
    badTasks: ["api", "etl", "streaming"],
    executionRequirement: "any",
    goodFormats: ["csv", "parquet"],
    tags: ["ml", "machine learning", "classification", "regression", "clustering", "modele", "entrainer", "prediction", "sklearn"],
    baseScore: 80,
    simplicity: 2,
    avoidReason: "Conçu pour entraîner des modèles, pas pour ETL ou API.",
    contextualAvoid: {
      etl:     "scikit-learn entraîne des modèles, il ne fait pas de pipeline ETL.",
      api:     "scikit-learn ne sert pas d'API (combiner avec FastAPI pour ça).",
      massive: "scikit-learn nécessite un sous-échantillonnage ou spark-ml sur volumes massifs.",
    },
  },

  // ── Storage ──────────────────────────────────────────────────────
  {
    id: "parquet",
    functionalRole: "storage_format",
    name: "Parquet",
    icon: "📦",
    category: "storage",
    description: "Format columnar compressé, optimal pour analytics et interopérabilité",
    goodVolumes: ["medium", "large", "massive"],
    warnVolumes: [],
    badVolumes: ["small"],
    goodTasks: ["etl", "analytics", "reporting"],
    badTasks: ["api", "streaming"],
    executionRequirement: "any",
    goodFormats: ["parquet"],
    tags: ["parquet", "columnar", "compression", "stockage", "format", "donnees", "interop"],
    baseScore: 80,
    simplicity: 3,
    avoidReason: "Format batch columnar. Pas adapté au streaming ou aux APIs.",
    contextualAvoid: {
      api:       "Parquet est un format de fichier, pas un protocole API.",
      streaming: "Parquet est un format batch, pas streaming.",
    },
  },
  {
    id: "csv",
    functionalRole: "storage_format",
    name: "CSV",
    icon: "📄",
    category: "storage",
    description: "Format texte universel, simple, lisible, interopérable partout",
    goodVolumes: ["small"],
    warnVolumes: ["medium"],
    badVolumes: ["large", "massive"],
    goodTasks: ["script", "reporting", "etl"],
    badTasks: ["streaming", "analytics"],
    executionRequirement: "any",
    goodFormats: ["csv"],
    tags: ["csv", "texte", "simple", "interoperable", "fichier"],
    baseScore: 45,
    simplicity: 1,
    avoidReason: "Pas de compression ni types stricts. Lent à parser sur gros volumes.",
    contextualAvoid: {
      large:   "CSV sans compression est très lent sur ce volume. Convertir en Parquet.",
      massive: "CSV inadapté aux volumes massifs : pas de découpage ni compression.",
    },
  },
  {
    id: "sqlite",
    functionalRole: "sql_transactional",
    name: "SQLite",
    icon: "🗄️",
    category: "storage",
    description: "Base SQL fichier locale, ACID, zéro configuration, idéal pour petits projets",
    goodVolumes: ["small", "medium"],
    warnVolumes: [],
    badVolumes: ["large", "massive"],
    goodTasks: ["script", "api"],
    badTasks: ["analytics", "streaming"],
    executionRequirement: "local",
    goodFormats: ["db"],
    tags: ["sql", "base de donnees", "local", "simple", "transaction", "leger"],
    baseScore: 50,
    simplicity: 1,
    avoidReason: "Non vectorisé, single-writer. Pas conçu pour analytics ou gros volumes.",
    contextualAvoid: {
      large:     "SQLite non adapté aux volumes importants.",
      massive:   "SQLite hors capacité pour ce volume.",
      streaming: "SQLite n'est pas conçu pour l'ingestion en streaming.",
    },
  },

  // ── Big Data ─────────────────────────────────────────────────────
  {
    id: "spark",
    functionalRole: "distributed_compute",
    name: "Apache Spark",
    icon: "🔥",
    category: "bigdata",
    description: "Traitement distribué massivement parallèle, batch et streaming structuré",
    goodVolumes: ["massive"],
    warnVolumes: ["large"],
    badVolumes: ["small", "medium"],
    goodTasks: ["etl", "analytics", "streaming", "ml"],
    badTasks: ["api", "script"],
    executionRequirement: "distributed",
    goodFormats: ["parquet", "csv"],
    tags: ["spark", "distribue", "cluster", "big data", "hadoop", "yarn", "databricks", "emr"],
    baseScore: 75,
    simplicity: 5,
    avoidReason: "Overhead JVM + cluster requis. Inadapté en local ou volumes < 100M lignes.",
    contextualAvoid: {
      local:  "Spark nécessite un vrai cluster. En local, Polars ou DuckDB sont 5-10x plus efficaces.",
      medium: "Spark surdimensionné : démarrage 30-60s, overhead JVM prohibitif pour ce volume.",
      small:  "Spark surdimensionné : overhead trop lourd pour de petits volumes.",
    },
  },
  {
    id: "dask",
    functionalRole: "distributed_compute",
    name: "Dask",
    icon: "⚙️",
    category: "bigdata",
    description: "Parallélisme pandas-compatible sur multi-core local ou petit cluster",
    goodVolumes: ["large", "massive"],
    warnVolumes: ["medium"],
    badVolumes: ["small"],
    goodTasks: ["etl", "analytics", "ml"],
    badTasks: ["api", "script", "streaming"],
    executionRequirement: "any",
    goodFormats: ["csv", "parquet"],
    tags: ["dask", "parallele", "distribue", "multi-core", "big data", "pandas"],
    baseScore: 60,
    simplicity: 4,
    avoidReason: "API complexe. En local, Polars ou DuckDB sont souvent plus rapides.",
    contextualAvoid: {
      small:  "Dask surdimensionné pour ce volume. pandas ou Polars suffisent.",
      medium: "Polars ou DuckDB sont plus simples et plus rapides en local.",
    },
  },
  {
    id: "kafka",
    functionalRole: "streaming_transport",
    name: "Apache Kafka",
    icon: "📨",
    category: "bigdata",
    description: "Bus de messages distribué pour streaming haute volumétrie et fiabilité",
    goodVolumes: ["large", "massive"],
    warnVolumes: [],
    badVolumes: ["small"],
    goodTasks: ["streaming"],
    badTasks: ["etl", "analytics", "ml", "script"],
    executionRequirement: "distributed",
    goodFormats: ["logs"],
    tags: ["kafka", "streaming", "temps reel", "evenements", "message broker", "flux", "realtime"],
    baseScore: 72,
    simplicity: 5,
    avoidReason: "Infrastructure lourde. Uniquement pour streaming distribué haute volumétrie.",
    contextualAvoid: {
      etl:       "Kafka transporte des événements, il ne fait pas de transformation batch.",
      analytics: "Kafka ne fait pas d'agrégations SQL. Utiliser DuckDB sur les topics.",
      local:     "Kafka nécessite une infrastructure distribuée (brokers + ZooKeeper/KRaft).",
    },
  },

  // ── Dev Tools (anti-patterns) ───────────────────────────────────
  {
    id: "python-loops",
    functionalRole: "devtool",
    name: "Boucles Python pures",
    icon: "🐌",
    category: "devtool",
    description: "Itérations Python ligne par ligne (for/while), non vectorisé",
    goodVolumes: ["small"],
    warnVolumes: [],
    badVolumes: ["medium", "large", "massive"],
    goodTasks: ["script"],
    badTasks: ["etl", "analytics", "ml", "streaming"],
    executionRequirement: "any",
    goodFormats: ["csv"],
    tags: ["boucle", "for", "iteration", "script"],
    baseScore: 20,
    simplicity: 1,
    avoidReason: "Non vectorisé (GIL), 10-100x plus lent que Polars/NumPy sur data processing.",
    contextualAvoid: {
      medium:  "10-100x plus lent que Polars sur ce volume. Passer aux opérations vectorisées.",
      large:   "Inacceptable en production sur ce volume.",
      massive: "Impossible à terminer dans un délai raisonnable sur ce volume.",
    },
  },
  {
    id: "excel",
    functionalRole: "devtool",
    name: "Excel",
    icon: "📊",
    category: "devtool",
    description: "Tableur Microsoft, limité à ~1M lignes, non scriptable",
    goodVolumes: ["small"],
    warnVolumes: [],
    badVolumes: ["medium", "large", "massive"],
    goodTasks: ["reporting"],
    badTasks: ["etl", "analytics", "ml", "streaming", "api"],
    executionRequirement: "any",
    goodFormats: ["csv"],
    tags: ["excel", "tableur", "rapport", "visualisation"],
    baseScore: 15,
    simplicity: 1,
    avoidReason: "Limité à ~1M lignes, non scriptable, non reproductible, non versionnable.",
    contextualAvoid: {
      medium:    "Excel est limité à 1M lignes et ne s'intègre pas dans un pipeline.",
      large:     "Excel ne peut techniquement pas traiter ce volume.",
      massive:   "Hors capacité d'Excel.",
      etl:       "Excel n'est pas un outil ETL. Non scriptable, non reproductible.",
      ml:        "Excel ne fait pas de Machine Learning.",
      analytics: "Excel non adapté pour des analyses reproductibles sur gros volumes.",
    },
  },
];


// ═══════════════════════════════════════════════════════════════════
// 2. PARSER — extraction de tokens depuis la description
// ═══════════════════════════════════════════════════════════════════

function parseQuery(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1);
}

function matchesAny(tokens, patterns, original) {
  const norm = original.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return patterns.some(p => norm.includes(p));
}


// ═══════════════════════════════════════════════════════════════════
// 3. EXTRACTOR — détecte features sémantiques
// ═══════════════════════════════════════════════════════════════════

const VOLUME_SIGNALS = {
  massive: [
    "100 million", "100m", "1 milliard", "1 billion", "terabyte", "petabyte",
    "cluster", "databricks", "emr", "dataproc", "hadoop",
  ],
  large: [
    "million", "millions", "10m", "20m", "30m", "50m", "giga", "go", "gb",
    "gros volume", "large volume",
  ],
  medium: [
    "millier", "milliers", "100k", "500k", "mega", "mo", "mb", "quelques milliers",
  ],
  small: [
    "petit", "simple", "leger", "quelques", "prototype", "poc",
  ],
};

const TASK_SIGNALS = {
  etl: [
    "etl", "pipeline", "transformer", "transformation", "charger", "extraire",
    "ingestion", "batch", "quotidien", "journalier", "migrer", "migration",
    "nettoyer", "nettoyage", "preparer", "preparation", "convertir", "conversion",
  ],
  analytics: [
    "kpi", "analytique", "analytics", "agregation", "agregations", "requete",
    "requetes", "sql", "analyse", "analyser", "rapport", "reporting",
    "statistique", "statistiques", "dashboard", "metriques", "calcul", "calculer",
  ],
  api: [
    "api", "rest", "endpoint", "service", "http", "web", "exposer", "serveur",
    "backend", "microservice", "routes", "mobile", "application",
  ],
  ml: [
    "machine learning", "ml", "modele", "entrainer", "classification",
    "regression", "prediction", "features", "feature engineering",
    "clustering", "inference", "random forest", "xgboost", "neural", "ia",
  ],
  script: [
    "script", "simple", "leger", "prototype", "poc",
    "automatiser", "automatisation", "one-shot", "ponctuel",
  ],
  streaming: [
    "streaming", "temps reel", "realtime", "flux", "event", "evenement",
    "kafka", "kinesis", "pubsub", "latence faible", "direct",
  ],
  reporting: [
    "rapport", "reporting", "excel", "pdf", "tableau", "visualisation",
    "graphique", "export", "bilan",
  ],
};

const EXEC_SIGNALS = {
  distributed: [
    "cluster", "distribue", "distribuer", "distribution", "cloud", "emr",
    "dataproc", "databricks", "kubernetes", "k8s", "yarn", "hadoop",
    "plusieurs machines", "multi-machine", "noeuds", "nodes", "spark",
    "multi-serveur",
  ],
  local: [
    "local", "mon pc", "laptop", "ordinateur", "single machine", "seul",
    "serveur unique", "en local", "une seule machine", "standalone",
  ],
};

const FORMAT_SIGNALS = {
  csv:     ["csv", "tsv", "fichier texte", "delimiteur"],
  parquet: ["parquet", "columnar"],
  db:      ["sql", "postgres", "mysql", "sqlite", "base de donnee", "database", "bdd"],
  api:     ["api", "rest", "json", "http", "endpoint"],
  logs:    ["logs", "log", "journaux", "events", "evenements"],
};

const CONSTRAINT_SIGNALS = {
  performance:  ["performance", "rapide", "vite", "vitesse", "optimise", "efficace", "faible latence"],
  simplicity:   ["simple", "facile", "leger", "minimal", "prototype", "poc", "rapidement", "junior", "maintenable"],
  scalability:  ["scalable", "scalabilite", "monte", "croissance", "evolutif"],
  maintenance:  ["maintenable", "maintenance", "lisible", "equipe", "standard", "connu", "classique"],
  realtime:     ["temps reel", "realtime", "streaming", "immediat", "latence", "direct"],
};

function extractFeatures(tokens, original) {
  const signals = [];

  // ── Volume ──────────────────────────────────────────────────────
  let volume = "medium";
  const numMatch = original.match(/(\d[\d\s]*)\s*(million|milliard|m\b|k\b|go\b|gb\b)/i);
  if (numMatch) {
    const num = parseInt(numMatch[1].replace(/\s/g, ""), 10);
    const unit = numMatch[2].toLowerCase();
    const rows = unit.startsWith("milliard") ? num * 1_000_000_000
               : unit === "million" || unit === "m"  ? num * 1_000_000
               : (unit === "go" || unit === "gb")    ? num * 5_000_000
               : num * 1_000;
    if (rows >= 100_000_000)    { volume = "massive"; signals.push(`${num}${unit} -> volume massive`); }
    else if (rows >= 5_000_000) { volume = "large";   signals.push(`${num}${unit} -> volume large`); }
    else if (rows >= 100_000)   { volume = "medium";  signals.push(`${num}${unit} -> volume medium`); }
    else                         { volume = "small";   signals.push(`${num}${unit} -> volume small`); }
  } else {
    for (const [level, keywords] of Object.entries(VOLUME_SIGNALS)) {
      if (matchesAny(tokens, keywords, original)) {
        volume = level;
        signals.push(`signal volume -> ${level}`);
        break;
      }
    }
  }

  // ── Tasks ────────────────────────────────────────────────────────
  const tasks = [];
  for (const [task, keywords] of Object.entries(TASK_SIGNALS)) {
    if (matchesAny(tokens, keywords, original)) {
      tasks.push(task);
      signals.push(`tâche -> ${task}`);
    }
  }
  if (tasks.length === 0) {
    tasks.push("script");
    signals.push("aucune tâche spécifique -> script par défaut");
  }

  // Filtrage : si 'script' a été déclenché par un qualificatif ('simple', 'léger', 'prototype')
  // mais qu'une tâche spécifique est déjà détectée, supprimer le faux positif.
  const STRONG_SCRIPT_SIGNALS = ["script", "automatiser", "automatisation", "one-shot", "ponctuel"];
  const SPECIFIC_TASKS = ["api", "etl", "analytics", "ml", "streaming", "reporting"];
  if (tasks.includes("script") && tasks.some(t => SPECIFIC_TASKS.includes(t))) {
    if (!matchesAny(tokens, STRONG_SCRIPT_SIGNALS, original)) {
      const idx = tasks.indexOf("script");
      tasks.splice(idx, 1);
      signals.push("'script' retiré (qualificatif sans marqueur fort, tâche spécifique prioritaire)");
    }
  }

  // ── Execution mode ───────────────────────────────────────────────
  let executionMode = "unknown";
  if (matchesAny(tokens, EXEC_SIGNALS.distributed, original)) {
    executionMode = "distributed";
    signals.push("mode -> distribué");
  } else if (matchesAny(tokens, EXEC_SIGNALS.local, original)) {
    executionMode = "local";
    signals.push("mode -> local");
  } else {
    if (volume === "small" || volume === "medium" || volume === "large") {
      executionMode = "local";
      signals.push(`volume ${volume} sans cluster -> mode local implicite`);
    }
  }

  // ── Data format ──────────────────────────────────────────────────
  let dataFormat = "unknown";
  for (const [fmt, keywords] of Object.entries(FORMAT_SIGNALS)) {
    if (matchesAny(tokens, keywords, original)) {
      dataFormat = fmt;
      signals.push(`format -> ${fmt}`);
      break;
    }
  }

  // ── Constraints ──────────────────────────────────────────────────
  const constraints = [];
  for (const [c, keywords] of Object.entries(CONSTRAINT_SIGNALS)) {
    if (matchesAny(tokens, keywords, original)) {
      constraints.push(c);
      signals.push(`contrainte -> ${c}`);
    }
  }

  return { volume, tasks, executionMode, dataFormat, constraints, detectedSignals: signals };
}


// ═══════════════════════════════════════════════════════════════════
// 4. SCORER — note chaque outil selon les features
// ═══════════════════════════════════════════════════════════════════

function scoreTool(tool, features) {
  let score = tool.baseScore;
  const reasons = [];
  let isMismatch = false;
  let contextualAvoidReason = null;

  // ── Gate critique : mode d'exécution ────────────────────────────
  if (tool.executionRequirement === "distributed") {
    if (features.executionMode === "distributed") {
      reasons.push("☁️ Mode distribué : outil optimisé pour cluster");
    } else if (features.executionMode === "local") {
      score -= 65;
      isMismatch = true;
      contextualAvoidReason = tool.contextualAvoid?.local || tool.avoidReason;
      reasons.push("⛔ Mode local : outil nécessite un cluster distribué");
    } else {
      // unknown
      if (features.volume === "massive") {
        score -= 20;
        reasons.push("⚠️ Mode inconnu : cluster probablement requis sur ce volume");
      } else {
        score -= 50;
        isMismatch = true;
        contextualAvoidReason = tool.contextualAvoid?.[features.volume] || tool.avoidReason;
        reasons.push("⛔ Pas de cluster détecté : outil distribué inadapté ici");
      }
    }
  }

  // ── Compatibilité volume ─────────────────────────────────────────
  if (tool.goodVolumes.includes(features.volume)) {
    score += 30;
    reasons.push(`✅ Volume ${features.volume} : outil bien adapté`);
  } else if (tool.warnVolumes && tool.warnVolumes.includes(features.volume)) {
    score -= 15;
    reasons.push(`⚠️ Volume ${features.volume} : fonctionnel mais sous-optimal`);
    if (!contextualAvoidReason) {
      contextualAvoidReason = tool.contextualAvoid?.[features.volume] || tool.avoidReason;
    }
  } else if (tool.badVolumes.includes(features.volume)) {
    score -= 50;
    isMismatch = true;
    if (!contextualAvoidReason) {
      contextualAvoidReason = tool.contextualAvoid?.[features.volume] || tool.avoidReason;
    }
    reasons.push(`⛔ Volume ${features.volume} : inadapté`);
  }

  // ── Compatibilité tâches ─────────────────────────────────────────
  let taskBonus = 0;
  let taskPenalty = 0;
  for (const task of features.tasks) {
    if (tool.goodTasks.includes(task)) {
      taskBonus += 20;
      reasons.push(`✅ Tâche ${task} : bien supportée`);
    } else if (tool.badTasks.includes(task)) {
      taskPenalty += 25;
      if (!contextualAvoidReason) {
        contextualAvoidReason = tool.contextualAvoid?.[task] || tool.avoidReason;
      }
      reasons.push(`⛔ Tâche ${task} : inadaptée`);
    }
  }
  score += Math.min(taskBonus, 40);
  score -= taskPenalty;
  if (taskPenalty > 0 && taskBonus === 0) isMismatch = true;

  // ── Format de données ────────────────────────────────────────────
  if (features.dataFormat !== "unknown" && tool.goodFormats && tool.goodFormats.includes(features.dataFormat)) {
    score += 10;
    reasons.push(`✅ Format ${features.dataFormat} : outil natif`);
  }

  // ── Contraintes ──────────────────────────────────────────────────
  if (features.constraints.includes("performance")) {
    const fast = ["polars", "duckdb", "fastapi", "pyarrow", "parquet", "spark"];
    const slow  = ["pandas", "python-loops", "excel", "sqlite", "flask", "csv"];
    if (fast.includes(tool.id)) { score += 15; reasons.push("⚡ Performance : outil optimisé"); }
    if (slow.includes(tool.id)) { score -= 10; reasons.push("🐢 Performance : moins rapide"); }
  }

  if (features.constraints.includes("simplicity") || features.constraints.includes("maintenance")) {
    const sim   = tool.simplicity || 3;
    const delta = (3 - sim) * 8;
    if (delta > 0) reasons.push(`🎯 Simplicité : outil accessible (niv. ${sim}/5)`);
    if (delta < 0) reasons.push(`🔧 Complexité : courbe d'apprentissage élevée (niv. ${sim}/5)`);
    score += delta;
  }

  if (features.constraints.includes("scalability")) {
    const scalable = ["polars", "duckdb", "fastapi", "spark", "dask", "kafka", "parquet"];
    if (scalable.includes(tool.id)) { score += 12; reasons.push("📈 Scalabilité : outil adapté"); }
  }

  if (features.constraints.includes("realtime")) {
    const rt    = ["fastapi", "kafka"];
    const batch = ["pandas", "polars", "duckdb", "spark", "dask"];
    if (rt.includes(tool.id))    { score += 20; reasons.push("⚡ Temps réel : outil adapté"); }
    if (batch.includes(tool.id)) { score -= 15; reasons.push("⏳ Temps réel : outil orienté batch"); }
  }

  score = Math.max(0, score);

  return {
    tool,
    score,
    isMismatch,
    reasons,
    contextualAvoidReason: contextualAvoidReason || tool.avoidReason,
  };
}


// ═══════════════════════════════════════════════════════════════════
// 5. CLASSIFIER & RECOMMENDER
// ═══════════════════════════════════════════════════════════════════

// Mappe chaque rôle fonctionnel aux tâches pour lesquelles il est pertinent
const ROLE_TASK_MAP = {
  dataframe_processing: ["etl", "analytics", "ml", "reporting", "script"],
  sql_analytics:        ["analytics", "etl", "reporting"],
  distributed_compute:  ["etl", "analytics", "ml", "streaming"],
  storage_format:       ["etl", "analytics", "reporting", "script"],
  sql_transactional:    ["api", "script"],
  api_layer:            ["api"],
  math_compute:         ["ml", "analytics"],
  ml_compute:           ["ml"],
  serialization:        ["etl"],
  streaming_transport:  ["streaming"],
};

/**
 * Un outil est pertinent pour OPTIMISÉ/MÉDIUM si son rôle fonctionnel
 * couvre au moins une des tâches détectées dans le contexte.
 * Les devtools sont exclus ici (gérés séparément dans classify).
 */
function isRelevant(tool, features) {
  const relevantTasks = ROLE_TASK_MAP[tool.functionalRole];
  if (!relevantTasks) return false;
  return features.tasks.some(t => relevantTasks.includes(t));
}

/**
 * Classe les outils en 3 catégories EXCLUSIVES.
 *
 * Règles v3 :
 *   OPTIMISÉ  — max 1 outil par rôle fonctionnel, max 5 au total
 *   MÉDIUM    — runners-up + autres valides non placés, max 4, ≥ 1 garanti
 *   AVOID     — vrais mismatches contextuels (outils tentants mais inadaptés)
 *   Exclusivité — chaque outil dans 1 seule catégorie au maximum
 *
 * @param {Array}  allScored  Résultats de scoreTool sur l'intégralité du catalogue
 * @param {Object} features   Contexte détecté par extractFeatures
 */
function classify(allScored, features) {
  const placed = new Set(); // ids déjà assignés à une catégorie

  // Valides et contextuellement pertinents (rôle ↔ tâche correspondants)
  const validCandidates = allScored
    .filter(s => !s.isMismatch && s.score > 15 && isRelevant(s.tool, features))
    .sort((a, b) => b.score - a.score);

  // Mismatches — triés par notoriété décroissante (les plus tentants en premier)
  const mismatchCandidates = allScored
    .filter(s => s.isMismatch)
    .sort((a, b) => b.tool.baseScore - a.tool.baseScore);

  // ── OPTIMISÉ : 1 outil par rôle fonctionnel, max 5 ─────────────
  const seenRoles = new Set();
  const optimized = [];

  for (const s of validCandidates) {
    const role = s.tool.functionalRole;
    if (seenRoles.has(role)) continue;
    // Exclure tout outil dont une tâche détectée est explicitement incompatible
    const hasBadTaskConflict = features.tasks.some(t => s.tool.badTasks.includes(t));
    if (hasBadTaskConflict) continue;
    seenRoles.add(role);
    placed.add(s.tool.id);
    optimized.push(s);
    if (optimized.length >= 5) break;
  }

  // ── MÉDIUM : runners-up + autres valides non encore placés, max 4 ──
  const medium = [];

  for (const s of validCandidates) {
    if (placed.has(s.tool.id)) continue;
    placed.add(s.tool.id);
    medium.push(s);
    if (medium.length >= 4) break;
  }

  // Garantie MÉDIUM ≥ 1 : pool élargi (sans filtre isRelevant strict)
  if (medium.length === 0) {
    const fallback = allScored
      .filter(s =>
        !placed.has(s.tool.id)              &&
        !s.isMismatch                        &&
        s.tool.functionalRole !== "devtool"
      )
      .sort((a, b) => (a.tool.simplicity || 3) - (b.tool.simplicity || 3));

    if (fallback.length > 0) {
      placed.add(fallback[0].tool.id);
      medium.push(fallback[0]);
    }
  }

  // ── AVOID : vrais mismatches tentants, max 6 ────────────────────
  const avoid = [];

  for (const s of mismatchCandidates) {
    if (placed.has(s.tool.id)) continue;
    // Devtools : afficher seulement si réellement anti-pattern dans ce contexte
    if (s.tool.functionalRole === "devtool") {
      const { volume, tasks } = features;
      const antiPattern =
        (s.tool.id === "python-loops" &&
          (volume !== "small" || tasks.some(t => ["etl", "analytics", "ml"].includes(t)))) ||
        (s.tool.id === "excel" &&
          (volume !== "small" || tasks.some(t => ["etl", "analytics", "ml", "api"].includes(t))));
      if (!antiPattern) continue;
    }
    placed.add(s.tool.id);
    avoid.push(s);
    if (avoid.length >= 6) break;
  }

  return { optimized, medium, avoid };
}

function buildExplanation(features) {
  const lines = [];

  const volDesc = {
    small:   "🟢 <strong>Volume faible</strong> (&lt; 100k lignes) — outils simples suffisent.",
    medium:  "🟡 <strong>Volume moyen</strong> (100k – 5M lignes) — outils classiques ou modernes.",
    large:   "🟠 <strong>Volume important</strong> (5M – 100M lignes) — outils vectorisés nécessaires.",
    massive: "🔴 <strong>Volume massif</strong> (100M+ lignes) — outils columnar ou distribués requis.",
  };
  lines.push(`<strong>Volume :</strong> ${volDesc[features.volume]}`);

  if (features.executionMode !== "unknown") {
    const modeDesc = {
      local:       "💻 <strong>Traitement local</strong> — un seul nœud. Polars et DuckDB sont les meilleurs choix en local.",
      distributed: "☁️ <strong>Cluster distribué</strong> détecté — Apache Spark ou Dask sont éligibles.",
    };
    lines.push(`<strong>Mode :</strong> ${modeDesc[features.executionMode]}`);
  }

  if (features.dataFormat !== "unknown") {
    const fmtDesc = {
      csv:     "📄 Format <strong>CSV</strong> — Polars et DuckDB lisent le CSV nativement.",
      parquet: "📦 Format <strong>Parquet</strong> — format columnar optimal pour analytics.",
      db:      "🗄️ <strong>Base de données</strong> — DuckDB (OLAP), SQLite (OLTP léger).",
      api:     "🌐 <strong>API</strong> — FastAPI pour exposition, Flask pour prototypes.",
      logs:    "📋 <strong>Logs/événements</strong> — Kafka pour ingestion, DuckDB pour analyse.",
    };
    lines.push(`<strong>Format :</strong> ${fmtDesc[features.dataFormat]}`);
  }

  const taskDesc = {
    etl:       "Pipeline ETL / transformation de données",
    analytics: "Analyse et agrégations (KPI, reporting)",
    api:       "Exposition via API REST",
    ml:        "Machine Learning / modélisation",
    script:    "Script ponctuel / automatisation",
    streaming: "Traitement en temps réel / streaming",
    reporting: "Génération de rapports / exports",
  };
  lines.push(`<strong>Tâche(s) :</strong> ${features.tasks.map(t => taskDesc[t] || t).join(", ")}`);

  if (features.constraints.length > 0) {
    const cDesc = {
      performance:  "Performance prioritaire",
      simplicity:   "Simplicité demandée",
      scalability:  "Scalabilité requise",
      maintenance:  "Maintenabilité requise",
      realtime:     "Temps réel / faible latence",
    };
    lines.push(`<strong>Contraintes :</strong> ${features.constraints.map(c => cDesc[c] || c).join(", ")}`);
  }

  const principles = [];
  if ((features.volume === "large" || features.volume === "massive") && features.executionMode === "local") {
    principles.push("Outils <em>columnar et vectorisés</em> en local : Polars et DuckDB.");
  }
  if (features.volume === "massive" && features.executionMode === "distributed") {
    principles.push("Volume massif + cluster → Apache Spark est pleinement justifié.");
  }
  if (features.volume === "massive" && features.executionMode === "unknown") {
    principles.push("Volume massif : si pas de cluster, Polars/DuckDB en local. Si cluster disponible, Spark.");
  }
  if (features.tasks.includes("api")) {
    principles.push("FastAPI recommandé pour toute API Python moderne.");
  }
  if (features.tasks.includes("ml")) {
    principles.push("scikit-learn reste la référence ML classique sur volumes moyens.");
  }
  if (features.volume === "small" || (features.constraints.includes("simplicity"))) {
    principles.push("pandas reste un choix parfaitement valide sur petits volumes ou si la simplicité prime.");
  }
  if (principles.length > 0) {
    lines.push(`<strong>Principe :</strong> ${principles.join(" ")}`);
  }

  return lines.join("<br/>");
}

function recommend(query) {
  const tokens    = parseQuery(query);
  const features  = extractFeatures(tokens, query);
  // Score l'intégralité du catalogue (nécessaire pour détecter les mismatches → AVOID)
  const allScored = TOOLS.map(t => scoreTool(t, features));
  const { optimized, medium, avoid } = classify(allScored, features);
  return { optimized, medium, avoid, features, allScored, explanation: buildExplanation(features) };
}


// ═══════════════════════════════════════════════════════════════════
// 6. RENDU HTML
// ═══════════════════════════════════════════════════════════════════

function renderToolCard(st) {
  const { tool, score } = st;
  const pct = Math.min(100, Math.round(score));
  const topReason = st.reasons.find(r => r.startsWith("✅") || r.startsWith("⚡")) || st.reasons[0] || "";
  return `
    <div class="sa-tool-card" title="${topReason.replace(/"/g, "&quot;")}">
      <span class="sa-tool-icon">${tool.icon}</span>
      <div class="sa-tool-info">
        <div class="sa-tool-name">${tool.name}</div>
        <div class="sa-tool-desc">${tool.description}</div>
        <div class="sa-tool-score-bar">
          <div class="sa-tool-score-fill" style="width:${pct}%"></div>
        </div>
      </div>
      <span class="sa-tool-score-val">${pct}</span>
    </div>`;
}

function renderAvoidCard(st) {
  const { tool } = st;
  return `
    <div class="sa-tool-card sa-tool-card-avoid">
      <span class="sa-tool-icon">${tool.icon}</span>
      <div class="sa-tool-info">
        <div class="sa-tool-name">${tool.name}</div>
        <div class="sa-tool-avoid-reason">${st.contextualAvoidReason}</div>
      </div>
    </div>`;
}

function renderContextBar(features) {
  const volEmoji  = { small: "🟢", medium: "🟡", large: "🟠", massive: "🔴" };
  const taskEmoji = { etl: "⚙️", analytics: "📊", api: "🌐", ml: "🤖", script: "📄", streaming: "⚡", reporting: "📋" };
  const modeEmoji = { local: "💻", distributed: "☁️" };
  const fmtEmoji  = { csv: "📄", parquet: "📦", db: "🗄️", api: "🌐", logs: "📋" };

  const pills = [
    `<span class="sa-ctx-pill sa-ctx-volume">
       ${volEmoji[features.volume] || "⚪"} Volume : <strong>${features.volume}</strong>
     </span>`,
    ...features.tasks.map(t =>
      `<span class="sa-ctx-pill sa-ctx-task">${taskEmoji[t] || "🔹"} ${t}</span>`
    ),
  ];
  if (features.executionMode !== "unknown") {
    pills.push(`<span class="sa-ctx-pill sa-ctx-mode">
       ${modeEmoji[features.executionMode]} Mode : <strong>${features.executionMode}</strong>
     </span>`);
  }
  if (features.dataFormat !== "unknown") {
    pills.push(`<span class="sa-ctx-pill sa-ctx-format">${fmtEmoji[features.dataFormat] || "📎"} ${features.dataFormat}</span>`);
  }
  pills.push(...features.constraints.map(c =>
    `<span class="sa-ctx-pill sa-ctx-constraint">🎯 ${c}</span>`
  ));
  return pills.join("");
}

function renderDebugTable(allScored) {
  const rows = [...allScored]
    .sort((a, b) => b.score - a.score)
    .map(s => `
      <tr class="${s.isMismatch ? "debug-mismatch" : ""}">
        <td>${s.tool.icon} ${s.tool.name}</td>
        <td>${s.tool.functionalRole}</td>
        <td>${s.tool.executionRequirement}</td>
        <td class="debug-score">${Math.round(s.score)}</td>
        <td>${s.isMismatch ? "⛔" : "✅"}</td>
        <td class="debug-reasons">${s.reasons.join(" · ")}</td>
      </tr>`).join("");
  return `
    <table class="sa-debug-table">
      <thead><tr><th>Outil</th><th>Rôle fonctionnel</th><th>Exec</th><th>Score</th><th>OK</th><th>Raisons</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderColReason(items, type) {
  if (items.length === 0) {
    const empty = {
      optimized: "Aucun outil optimal pour ce contexte.",
      medium:    "Aucune alternative identifiée.",
      avoid:     "Aucun anti-pattern notable dans ce contexte.",
    };
    return `<p class="sa-col-reason-empty">${empty[type]}</p>`;
  }
  if (type === "optimized") {
    const roleLabels = {
      dataframe_processing: "DataFrame",
      sql_analytics:        "SQL Analytics",
      distributed_compute:  "Calcul distribué",
      storage_format:       "Format stockage",
      sql_transactional:    "SQL transactionnel",
      api_layer:            "API",
      math_compute:         "Calcul numérique",
      ml_compute:           "Machine Learning",
      serialization:        "Sérialisation",
      streaming_transport:  "Streaming",
    };
    const roles = items.map(s => `<em>${roleLabels[s.tool.functionalRole] || s.tool.functionalRole}</em>`);
    return `<p>1 outil par rôle fonctionnel — ${roles.join(", ")}. Sélection sans redondance par meilleur score contexte × volume × tâche.</p>`;
  }
  if (type === "medium") {
    return `<p>Alternatives sans doublon fonctionnel avec OPTIMISÉ — outils classiques, plus simples, ou runners-up légèrement sous le seuil.</p>`;
  }
  return `<p>Mismatches fréquents dans ce contexte — outils tentants mais architecturalement inadaptés.</p>`;
}


// ═══════════════════════════════════════════════════════════════════
// 7. CONTRÔLEUR UI
// ═══════════════════════════════════════════════════════════════════

function runAdvisor() {
  const query = document.getElementById("sa-query").value.trim();
  if (!query) return;

  const result = recommend(query);

  document.getElementById("sa-context-bar").innerHTML = renderContextBar(result.features);

  const optList = document.getElementById("sa-optimized-list");
  const medList = document.getElementById("sa-medium-list");
  const avdList = document.getElementById("sa-avoid-list");

  optList.innerHTML = result.optimized.map(renderToolCard).join("") || '<p class="sa-empty-col">Aucun outil optimal identifié.</p>';
  medList.innerHTML = result.medium.map(renderToolCard).join("")    || '<p class="sa-empty-col">Aucune alternative identifiée.</p>';
  avdList.innerHTML = result.avoid.map(renderAvoidCard).join("")    || '<p class="sa-empty-col">Aucun outil à déconseiller dans ce contexte.</p>';

  document.getElementById("sa-optimized-reason").innerHTML = renderColReason(result.optimized, "optimized");
  document.getElementById("sa-medium-reason").innerHTML    = renderColReason(result.medium,    "medium");
  document.getElementById("sa-avoid-reason").innerHTML     = renderColReason(result.avoid,     "avoid");

  document.getElementById("sa-explanation-body").innerHTML = result.explanation;
  document.getElementById("sa-debug-body").innerHTML = renderDebugTable(result.allScored);

  document.getElementById("sa-results").classList.remove("hidden");
  document.getElementById("sa-empty").classList.add("hidden");
  document.getElementById("sa-results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetAdvisor() {
  document.getElementById("sa-query").value = "";
  document.getElementById("sa-results").classList.add("hidden");
  document.getElementById("sa-empty").classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("sa-analyze-btn").addEventListener("click", runAdvisor);
  document.getElementById("sa-reset-btn").addEventListener("click", resetAdvisor);
  document.getElementById("sa-query").addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) runAdvisor();
  });
  document.querySelectorAll(".sa-example-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("sa-query").value = btn.dataset.q;
      runAdvisor();
    });
  });
});
