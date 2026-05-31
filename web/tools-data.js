/**
 * Tool Knowledge Base — Data
 * Fiches de décision rapide orientées prise de décision technique.
 */
"use strict";

const TOOLS_KB = [

  // ─────────────────────────────────────────────────────────────────────
  // POLARS
  // ─────────────────────────────────────────────────────────────────────
  {
    id: "polars",
    name: "Polars",
    icon: "🐻‍❄️",
    category: "Data Engineering",
    language: "Rust / Python / JS",
    created: "2020",
    maturity: "stable",
    popularity: "high",
    version: "1.x",
    github_repo: "pola-rs/polars",
    tags: ["dataframe", "etl", "performance", "parquet", "rust"],
    summary: "Polars est un DataFrame ultra-performant écrit en Rust, exposé en Python. Il utilise Apache Arrow comme format mémoire, l'évaluation paresseuse (lazy) et le parallélisme automatique. Il surpasse pandas sur les volumes > 100k lignes et ne souffre pas du Global Interpreter Lock.",
    use_cases: ["ETL haute performance", "Calcul de KPI", "Traitement CSV/Parquet volumineux", "Data Engineering quotidien", "Remplacement de pandas sur gros volumes"],
    when_to_use: [
      "Traitement de fichiers > 500k lignes",
      "Pipeline ETL en production nécessitant la reproductibilité",
      "Lecture/écriture Parquet/Arrow optimisée",
      "Calculs parallèles sur plusieurs CPU",
      "Remplacement de pandas dans un projet existant",
      "Chaînes de transformations complexes (lazy API)"
    ],
    when_to_avoid: [
      "Petits scripts < 10k lignes (pandas suffit)",
      "Besoin d'un écosystème riche (seaborn, statsmodels…)",
      "Code partagé avec des profils non-techniques habitués à pandas",
      "Intégration directe avec sklearn/scipy sans conversion",
      "Cas d'usage nécessitant des index nommés"
    ],
    alternatives: [
      { id: "ibis",     name: "Ibis",     category: "SQL Interface",  reason: "Interface SQL portable sur plusieurs backends dont Polars et DuckDB" },
      { id: "cudf",    name: "cuDF",     category: "DataFrame GPU",  reason: "DataFrame GPU NVIDIA — même concept, pour volumes nécessitant GPU" }
    ],
    ratings: { performance: 5, simplicity: 4, scalability: 4, memory: 5, ecosystem: 3 },
    cheatsheet: {
      install:     "pip install polars",
      read_csv:    "df = pl.read_csv('data.csv')",
      read_parquet:"df = pl.read_parquet('data.parquet')",
      filter:      "df.filter(pl.col('age') > 30)",
      select:      "df.select(['col1', 'col2'])",
      groupby:     "df.group_by('category').agg(pl.col('value').sum())",
      join:        "df.join(other, on='id', how='left')",
      lazy:        "df.lazy().filter(pl.col('x') > 0).collect()",
      write_parquet:"df.write_parquet('out.parquet')",
      with_columns:"df.with_columns((pl.col('a') * 2).alias('a2'))",
      sort:        "df.sort('score', descending=True)",
      sample:      "df.sample(n=1000, seed=42)"
    },
    compatibilities: {
      formats:       ["Parquet", "Arrow (IPC)", "CSV", "JSON", "Delta Lake", "Avro"],
      engines:       ["DuckDB", "pandas", "PyArrow", "Apache Spark"],
      frameworks:    ["FastAPI", "Pydantic", "Streamlit"],
      visualization: ["matplotlib (via pandas)", "Plotly", "Altair"]
    },
    architecture: {
      position: "Transformation",
      diagram: [
        { step: "Source", items: ["CSV", "Parquet", "JSON", "DB"] },
        { step: "↓ Polars", items: ["lazy scan → filter → groupby → join"] },
        { step: "Stockage", items: ["Parquet", "DuckDB", "Delta Lake"] },
        { step: "Visualisation", items: ["FastAPI", "Streamlit", "Jupyter"] }
      ]
    },
    profile_scores: { data_analyst: 9, data_engineer: 10, data_scientist: 7, backend: 3, ml_engineer: 8 },
    related: ["duckdb", "pyarrow", "pandas", "delta-lake"],
    learning_paths: [
      { label: "Data Analyst",   steps: [{id:"pandas",name:"pandas"},{id:"polars",name:"Polars"},{id:"duckdb",name:"DuckDB"}] },
      { label: "Data Engineer",  steps: [{id:"pandas",name:"pandas"},{id:"polars",name:"Polars"},{id:"duckdb",name:"DuckDB"},{id:"spark",name:"Spark"}] },
      { label: "ML Engineer",    steps: [{id:"pandas",name:"pandas"},{id:"pyarrow",name:"PyArrow"},{id:"polars",name:"Polars"},{id:"spark",name:"Spark"}] }
    ],
    avis_terrain: "Je privilégie Polars pour tous les projets où le volume dépasse quelques centaines de milliers de lignes. L'API lazy est un vrai plus : on décrit le pipeline complet, Polars optimise et exécute en un seul passage. Couplé à Parquet, c'est la combinaison idéale pour un lakehouse local performant.",
    limitations: [
      "Écosystème plus jeune que pandas — certaines librairies spécialisées n'ont pas de support natif",
      "Certaines bibliothèques (sklearn, matplotlib) attendent encore un DataFrame pandas — conversion nécessaire",
      "Pas d'index nommés — certains patterns pandas ne se traduisent pas directement",
      "Courbe d'apprentissage légèrement supérieure si on vient de pandas (lazy API, expressions)",
      "Documentation moins abondante que pandas pour les cas avancés",
      "Incompatibilités ponctuelles entre versions mineures (API encore active)"
    ],
    migration: {
      from: "pandas",
      title: "Migration depuis pandas",
      disclaimer: "Ces exemples couvrent les cas courants. La migration réelle dépend de la structure des données et des patterns utilisés — certains patterns pandas (index multi-niveaux, apply complexe) nécessitent une adaptation manuelle.",
      mappings: [
        { before: "import pandas as pd",               after: "import polars as pl" },
        { before: "pd.read_csv('f.csv')",              after: "pl.read_csv('f.csv')" },
        { before: "df.groupby('col').sum()",           after: "df.group_by('col').agg(pl.col('val').sum())" },
        { before: "pd.merge(df, other, on='id')",      after: "df.join(other, on='id', how='left')" },
        { before: "df['col'].apply(func)",             after: "df.with_columns(pl.col('col').map_elements(func))" },
        { before: "df.rename(columns={'a': 'b'})",     after: "df.rename({'a': 'b'})" },
        { before: "df.dropna(subset=['col'])",         after: "df.drop_nulls(subset=['col'])" },
        { before: "df.fillna(0)",                      after: "df.fill_null(0)" }
      ]
    },
    competitors: {
      direct: [
        { id: "pandas",  name: "pandas",      reason: "Le prédécesseur historique — même cas d'usage, API différente" },
        { id: "dask",    name: "Dask",        reason: "DataFrame pandas distribué — vise les mêmes volumes" },
        { id: "vaex",    name: "Vaex",        reason: "DataFrame out-of-core optimisé pour l'exploration" },
        { id: "modin",   name: "Modin",       reason: "Drop-in replacement de pandas avec exécution parallèle" }
      ],
      indirect: [
        { id: "duckdb", name: "DuckDB",        reason: "SQL analytique — alternative pour les transformations" },
        { id: "spark",  name: "Apache Spark",  reason: "Distribué — prend le relai au-delà de la RAM d'une machine" }
      ]
    },
    tradeoffs: {
      forces:    ["Performances élevées sur volumes > 100k lignes grâce au format Arrow columnar", "Faible empreinte mémoire comparée à pandas sur les mêmes opérations", "API lazy : le plan d'exécution est optimisé avant tout calcul", "Parallélisme CPU automatique sans GIL Python", "Excellent sur Parquet et l'interopérabilité Arrow"],
      faiblesses: ["Bibliothèques spécialisées (statsmodels, scipy) sans support natif", "sklearn et matplotlib attendent un DataFrame pandas — conversion nécessaire", "Pas d'index nommés : certains patterns pandas ne se transposent pas", "Courbe d'apprentissage si on vient de pandas (lazy API, expressions)"],
      compromis: ["Performances supérieures contre compatibilité réduite avec l'écosystème ML Python", "API lazy plus efficace mais moins intuitive pour l'exploration interactive ponctuelle"]
    },
    architecture_recommandee: [
      { cas: "Pipeline ETL 10M lignes",        stack: ["Source CSV/DB", "Polars (scan lazy + filtre + agrégation)", "Parquet (stockage)", "DuckDB (analyse SQL)"] },
      { cas: "KPI quotidien en production",    stack: ["Source SQL/Parquet", "Polars LazyFrame", "Parquet/JSON (résultat)", "FastAPI (exposition API)"] }
    ],
    recommended_stacks: [
      { name: "ETL moderne",             stack: ["Polars", "Parquet", "DuckDB"] },
      { name: "Data Engineering Python", stack: ["Polars", "PyArrow", "FastAPI"] },
      { name: "Lakehouse local",         stack: ["Polars", "Delta Lake", "DuckDB"] }
    ],
    when_to_move_on: [
      { trigger: "Données distribuées sur cluster",          alternative: "Spark" },
      { trigger: "SQL analytique complexe sur fichiers",     alternative: "DuckDB" },
      { trigger: "Streaming temps réel",                    alternative: "Flink" },
      { trigger: "Intégration Hadoop existante",            alternative: "Spark" }
    ],
    common_mistakes: [
      "Appeler collect() immédiatement sans exploiter le mode lazy",
      "Comparer directement les performances à pandas sans tenir compte du matériel et du contexte",
      "Oublier que Polars ne remplace pas un moteur SQL pour les jointures complexes multi-tables",
      "Utiliser pandas apply() par habitude au lieu des expressions Polars natives"
    ],
    enterprise_usage: { startup: 5, pme: 4, grand_groupe: 3, cloud: 4, on_prem: 5 },
    context_switch_rules: [
      { condition: "Dataset < 100k lignes, exploration ponctuelle",          recommendation: "pandas suffit — la migration n'est pas justifiée",                          action: "avoid" },
      { condition: "Dataset > 500k lignes, pipeline ETL reproductible",      recommendation: "Polars recommandé — gains significatifs en vitesse et mémoire",           action: "use" },
      { condition: "Transformations SQL complexes dominantes",               recommendation: "Envisager DuckDB — SQL plus expressif pour les jointures",               action: "evaluate" },
      { condition: "Intégration sklearn / matplotlib imposée",               recommendation: "Convertir en pandas ponctuellement via to_pandas()",                     action: "evaluate" },
      { condition: "Volume dépasse la RAM disponible",                        recommendation: "Polars LazyFrame + streaming, ou DuckDB, ou Spark si cluster dispo",   action: "evaluate" }
    ],
    recommendation: {
      stars: 5,
      label: "Fortement recommandé",
      context: "pour Data Engineering moderne sur un seul nœud"
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // DUCKDB
  // ─────────────────────────────────────────────────────────────────────
  {
    id: "duckdb",
    name: "DuckDB",
    icon: "🦆",
    category: "Analytics SQL",
    language: "C++ / Python / SQL",
    created: "2019",
    maturity: "stable",
    popularity: "high",
    version: "1.x",
    github_repo: "duckdb/duckdb",
    tags: ["sql", "analytics", "olap", "parquet", "embedded"],
    summary: "DuckDB est un moteur SQL analytique embarqué (OLAP) sans serveur. Il s'exécute in-process, lit nativement Parquet/CSV/JSON/Arrow et excelle sur les requêtes analytiques complexes. Pensé comme le 'SQLite des analytics', il est parfait pour le lakehouse local.",
    use_cases: ["Analytics SQL locale", "Exploration de fichiers Parquet/CSV", "Jointures complexes sur données volumineuses", "Lakehouse local", "Remplacement de SQLite pour analytics"],
    when_to_use: [
      "Requêtes SQL analytiques sur fichiers locaux",
      "Jointures sur plusieurs fichiers Parquet",
      "Prototypage rapide de pipelines analytics",
      "Remplacement de pandas+SQL sur un seul nœud",
      "CI/CD analytique sans infrastructure",
      "BI locale sans serveur"
    ],
    when_to_avoid: [
      "Transactions OLTP (INSERT/UPDATE fréquents)",
      "Bases de données multi-utilisateurs concurrent",
      "Volumes > 100 Go sur une seule machine",
      "Besoin d'un serveur centralisé",
      "Streaming temps réel"
    ],
    alternatives: [
      { id: "chdb",       name: "chDB",       category: "OLAP embarqué",  reason: "ClickHouse embarqué en Python — même concept sans serveur" },
      { id: "datafusion", name: "DataFusion", category: "SQL OLAP",      reason: "SQL analytique Arrow natif Rust, sans overhead Python" }
    ],
    ratings: { performance: 5, simplicity: 5, scalability: 3, memory: 4, ecosystem: 4 },
    cheatsheet: {
      install:      "pip install duckdb",
      connect:      "con = duckdb.connect('mydb.duckdb')",
      query_csv:    "duckdb.sql(\"SELECT * FROM 'data.csv' LIMIT 10\")",
      query_parquet:"duckdb.sql(\"SELECT * FROM 'data.parquet' WHERE age > 30\")",
      create_table: "con.sql('CREATE TABLE t AS SELECT * FROM df')",
      join:         "duckdb.sql('SELECT a.*, b.label FROM a JOIN b ON a.id = b.id')",
      aggregation:  "duckdb.sql('SELECT cat, COUNT(*), AVG(val) FROM t GROUP BY cat')",
      to_polars:    "duckdb.sql('SELECT * FROM df').pl()",
      to_pandas:    "duckdb.sql('SELECT * FROM df').df()",
      write_parquet:"duckdb.sql(\"COPY t TO 'out.parquet' (FORMAT PARQUET)\")",
      from_arrow:   "duckdb.sql('SELECT * FROM arrow_table')"
    },
    compatibilities: {
      formats:       ["Parquet", "CSV", "Arrow", "Delta Lake (lecture)", "Iceberg (lecture)", "JSON"],
      engines:       ["Polars", "pandas", "PyArrow", "Apache Spark"],
      frameworks:    ["dbt-duckdb", "Streamlit", "FastAPI"],
      visualization: ["Metabase", "Apache Superset", "Jupyter"]
    },
    architecture: {
      position: "Transformation & Stockage",
      diagram: [
        { step: "Source", items: ["CSV", "Parquet", "JSON", "S3", "HTTP"] },
        { step: "↓ DuckDB", items: ["SQL analytique → jointure → agrégation"] },
        { step: "Stockage", items: ["Fichier .duckdb", "Parquet", "CSV"] },
        { step: "Visualisation", items: ["Jupyter", "Streamlit", "Metabase"] }
      ]
    },
    profile_scores: { data_analyst: 10, data_engineer: 9, data_scientist: 8, backend: 4, ml_engineer: 5 },
    related: ["polars", "pyarrow", "delta-lake", "sqlite"],
    learning_paths: [
      { label: "Data Analyst",       steps: [{id:"sql",name:"SQL"},{id:"sqlite",name:"SQLite"},{id:"duckdb",name:"DuckDB"}] },
      { label: "Data Engineer",      steps: [{id:"sqlite",name:"SQLite"},{id:"duckdb",name:"DuckDB"},{id:"delta-lake",name:"Delta Lake"},{id:"spark",name:"Spark"}] },
      { label: "Analytics Engineer", steps: [{id:"sql",name:"SQL"},{id:"duckdb",name:"DuckDB"},{id:"dbt",name:"dbt"},{id:"delta-lake",name:"Delta Lake"}] }
    ],
    avis_terrain: "DuckDB est devenu mon outil privilégié pour l'exploration et l'analytics SQL. Sa capacité à requêter directement des fichiers Parquet sans les charger en RAM est un avantage concret. Je l'utilise fréquemment comme couche SQL au-dessus d'un lakehouse local Polars+Parquet — selon le contexte projet.",
    limitations: [
      "Mode mono-processus en écriture — pas de concurrence multi-utilisateurs",
      "Pas conçu pour l'OLTP (INSERT/UPDATE fréquents à fort débit)",
      "Volumes > 100 Go sur une seule machine approchent les limites pratiques",
      "Pas de streaming temps réel natif",
      "Fichier .duckdb non partageable entre processus simultanément",
      "Extensions tiers encore limitées comparé à PostgreSQL"
    ],
    migration: {
      from: "SQLite",
      title: "Migration depuis SQLite",
      disclaimer: "Ces exemples couvrent les cas courants. SQLite et DuckDB ont des dialectes SQL distincts — vérifier les fonctions analytiques (window functions, PIVOT) et les types de données.",
      mappings: [
        { before: "import sqlite3; con = sqlite3.connect('db.sqlite')", after: "import duckdb; con = duckdb.connect('db.duckdb')" },
        { before: "con.execute('SELECT * FROM t')",                     after: "duckdb.sql('SELECT * FROM t')" },
        { before: "pd.read_sql('SELECT ...', con)",                     after: "duckdb.sql('SELECT ...').df()" },
        { before: "# pas de lecture Parquet",                           after: "duckdb.sql(\"SELECT * FROM 'data.parquet'\")" },
        { before: "con.close()",                                        after: "con.close()  # même API" }
      ]
    },
    competitors: {
      direct: [
        { id: "sqlite",      name: "SQLite",      reason: "Même concept embarqué, mais OLTP et non optimisé OLAP" },
        { id: "motherduck",  name: "MotherDuck",  reason: "DuckDB cloud — concurrent direct sur la même technologie" }
      ],
      indirect: [
        { id: "polars",     name: "Polars",       reason: "API DataFrame alternative aux requêtes SQL" },
        { id: "clickhouse", name: "ClickHouse",   reason: "OLAP distribué pour les volumes dépassant un seul nœud" }
      ]
    },
    tradeoffs: {
      forces:    ["SQL analytique sans aucune infrastructure à gérer", "Lit directement Parquet, CSV, Arrow, Delta Lake sans chargement", "Intégration zero-copy avec Polars et pandas", "Transactions ACID sans serveur", "Très rapide pour les agrégations sur données colonaires"],
      faiblesses: ["Mono-nœud uniquement — pas de scalabilité horizontale", "Pas adapté aux écritures concurrentes OLTP", "Pas de gestion native des schémas évolutifs sans Delta Lake"],
      compromis: ["Simplicité maximale et performances locales contre scalabilité horizontale absente", "Parfait pour l'analytique mono-noeud contre limité en environnement multi-utilisateurs"] 
    },
    architecture_recommandee: [
      { cas: "Analyse KPI locale sur Parquet",   stack: ["Parquet (source)", "DuckDB (SQL analytique)", "CSV/JSON (résultat)", "Streamlit (dashboard)"] },
      { cas: "Lakehouse local sans infrastructure", stack: ["Source CSV/API", "Delta Lake (stockage ACID)", "DuckDB (requêtes)", "dbt-duckdb (transformations)"] }
    ],
    recommended_stacks: [
      { name: "Analytics local",        stack: ["DuckDB", "Parquet"] },
      { name: "BI locale",              stack: ["DuckDB", "Metabase"] },
      { name: "Analytics Engineering", stack: ["dbt", "DuckDB", "Parquet"] }
    ],
    when_to_move_on: [
      { trigger: "Multi-utilisateurs simultanés en écriture",       alternative: "PostgreSQL" },
      { trigger: "Volumes très importants avec distribution",        alternative: "ClickHouse ou Spark" },
      { trigger: "Transactions OLTP (insertions fréquentes)",        alternative: "PostgreSQL" },
      { trigger: "Cluster distribué requis",                         alternative: "Spark" }
    ],
    common_mistakes: [
      "Utiliser DuckDB comme base OLTP (il est conçu pour l'analytique en lecture)",
      "Partager un fichier .duckdb entre plusieurs processus en écriture simultanée",
      "Sous-estimer les limitations en accès concurrent",
      "Confondre DuckDB et SQLite (DuckDB est analytique, SQLite est transactionnel)"
    ],
    enterprise_usage: { startup: 5, pme: 5, grand_groupe: 3, cloud: 4, on_prem: 5 },
    context_switch_rules: [
      { condition: "Requêtes SQL sur fichiers Parquet ou CSV locaux",          recommendation: "DuckDB — cas d'usage idéal, zéro infrastructure",                        action: "use" },
      { condition: "Transformations DataFrame Python complexes",               recommendation: "Polars plus adapté — API Python native et ergonomique",                 action: "avoid" },
      { condition: "Multi-utilisateurs concurrent ou OLTP",                   recommendation: "PostgreSQL ou SQLite selon le cas d'usage",                            action: "avoid" },
      { condition: "Volume > 100 Go sur un seul nœud",                         recommendation: "ClickHouse ou Spark selon l'infrastructure — DuckDB approche ses limites", action: "evaluate" },
      { condition: "BI SQL local sans serveur",                               recommendation: "DuckDB + dbt-duckdb ou Metabase — combinaison efficace",                 action: "use" }
    ],
    recommendation: {
      stars: 5,
      label: "Fortement recommandé",
      context: "pour l'analytics SQL locale et le lakehouse sans infrastructure"
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // PANDAS
  // ─────────────────────────────────────────────────────────────────────
  {
    id: "pandas",
    name: "pandas",
    icon: "🐼",
    category: "Data Engineering",
    language: "Python / Cython",
    created: "2008",
    maturity: "mature",
    popularity: "very-high",
    version: "2.x",
    github_repo: "pandas-dev/pandas",
    tags: ["dataframe", "python", "data-science", "etl", "classic"],
    summary: "pandas est la bibliothèque de référence Python pour la manipulation de données tabulaires. Omniprésente dans l'écosystème data science, elle offre un DataFrame riche avec index nommés, intégration native avec matplotlib, sklearn, et toutes les libs scientifiques Python.",
    use_cases: ["Prototypage data science", "Petits ETL (< 500k lignes)", "Exploration interactive en Jupyter", "Nettoyage de données", "Interopérabilité avec sklearn/matplotlib"],
    when_to_use: [
      "Prototypage rapide et exploration",
      "Volumes < 500k lignes en RAM",
      "Intégration avec sklearn, matplotlib, seaborn",
      "Partage de notebooks avec des collègues",
      "Héritage de code existant en pandas",
      "Cours et formations data science"
    ],
    when_to_avoid: [
      "Volumes > 1M lignes (lenteur, mémoire x5 vs Polars)",
      "Pipelines production haute performance",
      "Traitement parallèle natif",
      "Chargement de fichiers Parquet lourds",
      "ETL dans des contraintes mémoire strictes"
    ],
    alternatives: [
      { id: "vaex",  name: "Vaex",  category: "DataFrame",     reason: "Exploration lazy out-of-core, idéal pour les très grands datasets sans RAM" },
      { id: "ibis",  name: "Ibis",  category: "SQL Interface",  reason: "Interface tabulaire portable sur pandas, Polars, DuckDB — code identique" }
    ],
    ratings: { performance: 2, simplicity: 5, scalability: 2, memory: 2, ecosystem: 5 },
    cheatsheet: {
      install:      "pip install pandas",
      read_csv:     "df = pd.read_csv('data.csv')",
      read_parquet: "df = pd.read_parquet('data.parquet')",
      filter:       "df[df['age'] > 30]",
      groupby:      "df.groupby('cat')['val'].sum()",
      join:         "pd.merge(df, other, on='id', how='left')",
      apply:        "df['col'].apply(lambda x: x * 2)",
      fillna:       "df.fillna(0)",
      dropna:       "df.dropna(subset=['col'])",
      to_parquet:   "df.to_parquet('out.parquet')",
      info:         "df.info(); df.describe()"
    },
    compatibilities: {
      formats:       ["CSV", "Excel", "JSON", "Parquet", "HDF5", "Feather"],
      engines:       ["DuckDB", "Polars", "PyArrow", "SQLAlchemy"],
      frameworks:    ["scikit-learn", "FastAPI", "Streamlit", "Jupyter"],
      visualization: ["matplotlib", "seaborn", "Plotly", "Altair"]
    },
    architecture: {
      position: "Transformation",
      diagram: [
        { step: "Source", items: ["CSV", "Excel", "SQL", "JSON"] },
        { step: "↓ pandas", items: ["read → filter → merge → transform"] },
        { step: "Stockage", items: ["CSV", "Parquet", "SQLite", "Excel"] },
        { step: "Visualisation", items: ["matplotlib", "seaborn", "Jupyter"] }
      ]
    },
    profile_scores: { data_analyst: 9, data_engineer: 5, data_scientist: 10, backend: 4, ml_engineer: 9 },
    related: ["polars", "duckdb", "numpy", "pyarrow"],
    learning_paths: [
      { label: "Data Analyst",  steps: [{id:"excel",name:"Excel"},{id:"sql",name:"SQL"},{id:"pandas",name:"pandas"}] },
      { label: "Data Scientist",steps: [{id:"pandas",name:"pandas"},{id:"pyarrow",name:"PyArrow"},{id:"polars",name:"Polars"}] },
      { label: "ML Engineer",   steps: [{id:"pandas",name:"pandas"},{id:"polars",name:"Polars"},{id:"pyarrow",name:"PyArrow"},{id:"spark",name:"Spark"}] }
    ],
    avis_terrain: "pandas reste incontournable pour l'exploration et la data science grâce à son écosystème. J'envisage la migration vers Polars en production quand les volumes dépassent la capacité confortable de pandas — l'arbitrage dépend des contraintes de l'équipe, de l'écosystème existant et du gain réel attendu.",
    limitations: [
      "Significativement plus lent que Polars sur les volumes importants (> 500k lignes)",
      "Consommation mémoire sensiblement plus élevée que Polars sur les mêmes données",
      "Pas de parallélisme natif — bloqué sur un seul CPU",
      "Index nommés déroutants et source fréquente de bugs",
      "Pas conçu pour la production à grande échelle",
      "API historique peu cohérente (plusieurs façons de faire la même chose)"
    ],
    migration: {
      from: "polars",
      title: "Migration vers Polars (cas fréquents)",
      disclaimer: "Ces transformations couvrent les cas courants. Les patterns pandas avec index, apply() complexes ou accesseurs .str/.dt nécessitent une réécriture spécifique. Évaluer le gain réel avant de migrer.",
      mappings: [
        { before: "pd.read_csv('f.csv')",        after: "pl.read_csv('f.csv')" },
        { before: "df[df['age'] > 30]",           after: "df.filter(pl.col('age') > 30)" },
        { before: "df.groupby('cat').sum()",      after: "df.group_by('cat').agg(pl.all().sum())" },
        { before: "pd.merge(df, other, on='id')", after: "df.join(other, on='id', how='left')" },
        { before: "df.fillna(0)",                 after: "df.fill_null(0)" },
        { before: "df.dropna()",                  after: "df.drop_nulls()" }
      ]
    },
    competitors: {
      direct: [
        { id: "polars",  name: "Polars",  reason: "Alternative naturelle — même concept, performances souvent observées comme supérieures sur les gros volumes" },
        { id: "modin",   name: "Modin",   reason: "Drop-in replacement de pandas avec Ray/Dask" },
        { id: "cudf",    name: "cuDF",    reason: "pandas sur GPU (NVIDIA RAPIDS)" }
      ],
      indirect: [
        { id: "duckdb",  name: "DuckDB",  reason: "SQL analytique — remplace souvent pandas+SQL" },
        { id: "dask",    name: "Dask",    reason: "pandas distribué pour volumes out-of-core" }
      ]
    },
    tradeoffs: {
      forces:    ["Ecosystème le plus riche de Python data — librairies tierce très nombreuses", "Courbe d'apprentissage faible, universel dans les équipes data", "Compatible nativement avec sklearn, matplotlib, seaborn, statsmodels", "Documentation et communauté immenses"],
      faiblesses: ["Significativement plus lent que Polars sur les volumes importants (> 500k lignes)", "Consommation mémoire sensiblement plus élevée — pas de format columnar natif", "Single-thread par défaut, pas de parallélisme automatique", "Index complexes sources de bugs et de confusion fréquente"],
      compromis: ["Compatibilité et familiarité maximales contre performances limitées sur les gros volumes", "Exploration interactive optimale contre inefficacité mémoire en production"]
    },
    architecture_recommandee: [
      { cas: "Data Science notebook < 500k lignes", stack: ["Source CSV/Excel", "pandas (exploration + nettoyage)", "scikit-learn (ML)", "matplotlib/seaborn (viz)"] },
      { cas: "Pipeline prod avec contrainte écosystème", stack: ["Source DB/CSV", "pandas (transformation)", "scikit-learn (scoring)", "FastAPI (exposition API)"] }
    ],
    recommended_stacks: [
      { name: "Exploration & prototype",  stack: ["pandas", "Jupyter", "matplotlib"] },
      { name: "Data Science standard",    stack: ["pandas", "scikit-learn", "matplotlib"] },
      { name: "Migration progressive",   stack: ["pandas", "Polars", "PyArrow"] }
    ],
    when_to_move_on: [
      { trigger: "Volumes dépassant la mémoire disponible",       alternative: "Polars" },
      { trigger: "SQL analytique complexe",                       alternative: "DuckDB" },
      { trigger: "Traitement distribué",                          alternative: "Spark" },
      { trigger: "Performance critique sur données volumineuses", alternative: "Polars" }
    ],
    common_mistakes: [
      "Utiliser apply() en boucle au lieu d'opérations vectorisées",
      "Charger l'intégralité d'un fichier volumineux sans filtrer ni typer les colonnes",
      "Multiplier les copies de DataFrames inutilement en mémoire",
      "Ignorer les types de colonnes (object vs category vs string[pyarrow])"
    ],
    enterprise_usage: { startup: 5, pme: 5, grand_groupe: 5, cloud: 5, on_prem: 5 },
    context_switch_rules: [
      { condition: "Exploration interactive, notebook, < 500k lignes",       recommendation: "pandas — écosystème et familiarité optimaux",                             action: "use" },
      { condition: "Volume > 1M lignes, pipeline ETL production",            recommendation: "Polars — meilleures performances et empreinte mémoire réduites",      action: "avoid" },
      { condition: "Modèle sklearn, matplotlib, seaborn requis",             recommendation: "pandas — interopérabilité maximale avec l'écosystème ML",              action: "use" },
      { condition: "Code partagé avec profils non-techniques",               recommendation: "pandas — familiarité universelle, courbe d'apprentissage faible",      action: "use" },
      { condition: "Pipeline production avec contraintes mémoire strictes",  recommendation: "Polars ou DuckDB selon la nature des transformations",                action: "avoid" }
    ],
    recommendation: {
      stars: 4,
      label: "Pertinent mais vieillissant",
      context: "encore indispensable pour l'écosystème data science, privilégier Polars en production"
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // FASTAPI
  // ─────────────────────────────────────────────────────────────────────
  {
    id: "fastapi",
    name: "FastAPI",
    icon: "⚡",
    category: "Backend",
    language: "Python",
    created: "2018",
    maturity: "stable",
    popularity: "very-high",
    version: "0.115.x",
    github_repo: "tiangolo/fastapi",
    tags: ["api", "rest", "async", "python", "pydantic", "openapi"],
    summary: "FastAPI est un framework web Python moderne basé sur les type hints, ASGI et Pydantic. Il génère automatiquement la documentation OpenAPI/Swagger, valide les entrées/sorties via Pydantic et offre des performances proches de NodeJS grâce à asyncio.",
    use_cases: ["APIs REST en Python", "Microservices Data", "Exposition de modèles ML", "Backend pour applications data", "APIs avec validation stricte"],
    when_to_use: [
      "Construction d'une API REST en Python",
      "Exposition d'un modèle ML en production",
      "Besoin de documentation OpenAPI automatique",
      "Validation forte des entrées/sorties",
      "I/O intensif avec asyncio (appels DB, HTTP externes)",
      "Typage strict et autocompletion IDE maximale"
    ],
    when_to_avoid: [
      "Applications web avec rendu HTML (préférer Django ou Jinja2)",
      "Très petits scripts sans besoin d'API",
      "Équipes non familières avec les async/await Python",
      "Besoin d'un ORM full-stack intégré (Django ORM)",
      "Applications nécessitant l'écosystème Django (admin, auth…)"
    ],
    alternatives: [
      { id: "aiohttp", name: "aiohttp",  category: "Web async",   reason: "Web async Python bas niveau — plus de contrôle, moins d'abstractions" },
      { id: "falcon",  name: "Falcon",   category: "API Python",  reason: "Framework API minimaliste, performant — quand le minimalisme prime" }
    ],
    ratings: { performance: 4, simplicity: 4, scalability: 4, memory: 4, ecosystem: 5 },
    cheatsheet: {
      install:     "pip install fastapi uvicorn",
      start:       "uvicorn main:app --reload",
      get_route:   "@app.get('/items/{id}')\nasync def get_item(id: int): ...",
      post_route:  "@app.post('/items')\nasync def create(item: ItemModel): ...",
      pydantic:    "class Item(BaseModel):\n    name: str\n    price: float",
      query_param: "async def search(q: str = None, skip: int = 0): ...",
      dependency:  "@app.get('/me')\nasync def me(user=Depends(get_current_user)): ...",
      background:  "background_tasks.add_task(send_email, to=email)",
      middleware:  "@app.middleware('http')\nasync def log_requests(req, call_next): ...",
      openapi:     "# Auto-généré sur /docs et /redoc"
    },
    compatibilities: {
      formats:       ["JSON", "MessagePack", "Protobuf (via grpcio)"],
      engines:       ["SQLAlchemy", "SQLModel", "Polars", "pandas"],
      frameworks:    ["Pydantic", "Celery", "Redis", "Docker", "Kubernetes"],
      visualization: ["Swagger UI (auto)", "ReDoc (auto)"]
    },
    architecture: {
      position: "API Layer",
      diagram: [
        { step: "Client", items: ["Browser", "Mobile App", "Autre service"] },
        { step: "↓ FastAPI", items: ["Routing → Validation (Pydantic) → Business Logic"] },
        { step: "Données", items: ["PostgreSQL", "DuckDB", "Redis", "Polars"] },
        { step: "Déploiement", items: ["Docker", "Kubernetes", "Railway", "Fly.io"] }
      ]
    },
    profile_scores: { data_analyst: 3, data_engineer: 7, data_scientist: 6, backend: 10, ml_engineer: 8 },
    related: ["pydantic", "sqlmodel", "polars", "duckdb"],
    learning_paths: [
      { label: "Backend Dev",  steps: [{id:"flask",name:"Flask"},{id:"fastapi",name:"FastAPI"},{id:"litestar",name:"Litestar"}] },
      { label: "Data Engineer",steps: [{id:"fastapi",name:"FastAPI"},{id:"pydantic",name:"Pydantic"},{id:"sqlmodel",name:"SQLModel"}] },
      { label: "ML Engineer",  steps: [{id:"fastapi",name:"FastAPI"},{id:"pydantic",name:"Pydantic"},{id:"ray",name:"Ray Serve"}] }
    ],
    avis_terrain: "FastAPI est mon choix par défaut pour exposer n'importe quel service Python. La génération automatique du schéma OpenAPI et la validation Pydantic réduisent considérablement le code boilerplate. Idéal pour les MLOps : on expose un modèle sklearn en moins de 20 lignes.",
    limitations: [
      "Moins adapté au rendu HTML/templates (Django ou Jinja2 préférables)",
      "Courbe d'apprentissage async/await pour les débutants",
      "Pas d'admin intégré, pas d'ORM, pas d'auth out-of-the-box",
      "ASGI server requis (uvicorn/hypercorn) — pas de déploiement WSGI simple",
      "Overhead Pydantic significatif pour les payloads très volumineux",
      "Versioning 0.x historique (passé 0.100 sans bump majeur)"
    ],
    migration: {
      from: "Flask",
      title: "Migration depuis Flask",
      disclaimer: "Ces exemples couvrent les cas courants. La migration implique l'adoption d'async/await, la suppression de request.json et jsonify au profit des type hints Pydantic. Les extensions Flask (auth, sessions) n'ont pas toujours d'équivalent direct.",
      mappings: [
        { before: "from flask import Flask\napp = Flask(__name__)",       after: "from fastapi import FastAPI\napp = FastAPI()" },
        { before: "@app.route('/items', methods=['GET'])",                after: "@app.get('/items')" },
        { before: "@app.route('/items', methods=['POST'])",               after: "@app.post('/items')" },
        { before: "request.json",                                         after: "item: ItemModel  # Pydantic validation auto" },
        { before: "jsonify(result)",                                      after: "return result  # sérialisation auto" },
        { before: "flask run",                                            after: "uvicorn main:app --reload" }
      ]
    },
    competitors: {
      direct: [
        { id: "flask",    name: "Flask",     reason: "Plus simple, synchrone, même niche API Python" },
        { id: "litestar", name: "Litestar",  reason: "Alternative async moderne, API plus stricte" },
        { id: "django",   name: "Django RF", reason: "Django REST Framework — full-stack, admin intégré" }
      ],
      indirect: [
        { id: "express",  name: "Express.js", reason: "Même niche mais ecosystème Node.js/TypeScript" },
        { id: "nestjs",   name: "NestJS",     reason: "Framework API TypeScript structuré" }
      ]
    },
    tradeoffs: {
      forces:    ["Génération automatique OpenAPI/Swagger incluse", "Validation des entrées via Pydantic intégré", "Async natif — performances élevées pour les I/O bound", "Typage Python fort — moins d'erreurs runtime"],
      faiblesses: ["Pas de rendu HTML natif (pas de moteur de templates)", "ORM, admin, sessions, auth à implémenter séparément", "Async peut complexifier le débogage pour les équipes moins expérimentées"],
      compromis: ["Légèreté et performances I/O contre absence de batteries incluses (vs Django)", "DX moderne et auto-doc contre courbe async pour les équipes venant de Flask"]
    },
    architecture_recommandee: [
      { cas: "API ML Serving",         stack: ["Modèle ML (sklearn/torch)", "FastAPI (endpoint /predict)", "Pydantic (validation I/O)", "Docker + Kubernetes"] },
      { cas: "API CRUD + base de données", stack: ["PostgreSQL", "SQLModel (ORM)", "FastAPI (routes)", "Pydantic (schémas)", "Swagger UI (doc auto)"] }
    ],
    recommended_stacks: [
      { name: "API Data / ML Serving",   stack: ["FastAPI", "Pydantic", "SQLModel", "PostgreSQL"] },
      { name: "Microservice ML",         stack: ["FastAPI", "Pydantic", "scikit-learn", "Docker"] },
      { name: "Backend moderne",         stack: ["FastAPI", "SQLModel", "Alembic", "Redis"] }
    ],
    when_to_move_on: [
      { trigger: "Équipe souhaitant un framework MVC structuré",   alternative: "Django" },
      { trigger: "Application principalement server-side rendering", alternative: "Django" },
      { trigger: "Besoin d'un ORM intégré et d'un admin auto",     alternative: "Django" },
      { trigger: "Micro-service très minimal sans async",          alternative: "Flask" }
    ],
    common_mistakes: [
      "Bloquer la boucle d'événements async avec des appels synchrones bloquants",
      "Ne pas utiliser Pydantic pour valider les corps de requête",
      "Exposer des endpoints sans authentification en environnement de production",
      "Gérer les exceptions unitairement sans handler global"
    ],
    enterprise_usage: { startup: 5, pme: 5, grand_groupe: 4, cloud: 5, on_prem: 4 },
    context_switch_rules: [
      { condition: "API REST Python avec validation de données",             recommendation: "FastAPI — choix naturel, documentation auto incluse",                   action: "use" },
      { condition: "Application web avec templates HTML",                    recommendation: "Django ou Flask + Jinja2 — rendu HTML non natif dans FastAPI",         action: "avoid" },
      { condition: "ORM, admin, auth intégrés requis",                       recommendation: "Django REST Framework — full-stack, écosystème complet",               action: "avoid" },
      { condition: "Équipe non familiere avec async/await Python",           recommendation: "Flask synchrone d'abord — async ajoute une courbe d'apprentissage",   action: "evaluate" },
      { condition: "Exposition d'un modèle ML en production",                recommendation: "FastAPI — standard MLOps Python, < 20 lignes pour un endpoint",     action: "use" }
    ],
    recommendation: {
      stars: 5,
      label: "Fortement recommandé",
      context: "pour toute API Python moderne — standard de facto"
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // PYDANTIC
  // ─────────────────────────────────────────────────────────────────────
  {
    id: "pydantic",
    name: "Pydantic",
    icon: "🔒",
    category: "Backend / Data Validation",
    language: "Python / Rust",
    created: "2017",
    maturity: "stable",
    popularity: "very-high",
    version: "2.x",
    github_repo: "pydantic/pydantic",
    tags: ["validation", "schema", "typing", "python", "serialisation"],
    summary: "Pydantic est la bibliothèque de validation de données Python la plus utilisée. En v2, le cœur est réécrit en Rust pour des performances x10. Elle valide, désérialise et sérialise des structures de données complexes via les type hints Python, avec JSON Schema automatique.",
    use_cases: ["Validation d'entrées API", "Configuration typée", "Sérialisation/désérialisation", "Schémas de données", "Configuration d'applications"],
    when_to_use: [
      "Toute API FastAPI ou Litestar",
      "Configuration d'application typée (BaseSettings)",
      "Validation de données provenant de sources externes",
      "Génération de schémas JSON automatique",
      "Modèles de données partagés entre services"
    ],
    when_to_avoid: [
      "Scripts ultra-simples sans validation nécessaire",
      "Si vous préférez marshmallow/attrs (compatibilité équipe)",
      "Contraintes mémoire extrêmes (overhead classes)"
    ],
    alternatives: [
      { id: "msgspec", name: "msgspec",  category: "Sérialisation",  reason: "Ultra-performant, format binaire (MessagePack/JSON), moins de fonctionnalités" },
      { id: "cattrs",  name: "cattrs",   category: "Classes Python",  reason: "Structuring/unstructuring automatique avec attrs — sans magie" }
    ],
    ratings: { performance: 5, simplicity: 4, scalability: 5, memory: 4, ecosystem: 5 },
    cheatsheet: {
      install:       "pip install pydantic",
      model:         "class User(BaseModel):\n    id: int\n    name: str\n    email: EmailStr",
      validation:    "user = User(id=1, name='Alice', email='a@b.com')",
      to_dict:       "user.model_dump()",
      to_json:       "user.model_dump_json()",
      from_json:     "User.model_validate_json(json_str)",
      optional:      "field: Optional[str] = None",
      validator:     "@field_validator('name')\ndef name_must_be_upper(cls, v): ...",
      settings:      "class Settings(BaseSettings):\n    db_url: str\n    api_key: str",
      nested:        "class Order(BaseModel):\n    items: list[Item]",
      alias:         "field: str = Field(..., alias='field_name')"
    },
    compatibilities: {
      formats:       ["JSON", "YAML (pydantic-settings)", "TOML", "Env vars"],
      engines:       ["SQLAlchemy", "SQLModel", "FastAPI", "LangChain"],
      frameworks:    ["FastAPI", "Litestar", "Celery", "Kafka (schémas)"],
      visualization: []
    },
    architecture: {
      position: "Validation Layer",
      diagram: [
        { step: "Entrée", items: ["JSON", "Form data", "Env vars"] },
        { step: "↓ Pydantic", items: ["Parsing → Validation → Typage fort"] },
        { step: "Logique", items: ["FastAPI", "Service Layer", "ORM"] },
        { step: "Sortie", items: ["JSON API", "Config objet", "Schéma OpenAPI"] }
      ]
    },
    profile_scores: { data_analyst: 3, data_engineer: 7, data_scientist: 5, backend: 10, ml_engineer: 7 },
    related: ["fastapi", "sqlmodel", "langchain"],
    learning_paths: [
      { label: "Backend Dev",  steps: [{id:"dataclasses",name:"dataclasses"},{id:"pydantic",name:"Pydantic"},{id:"fastapi",name:"FastAPI"}] },
      { label: "Data Engineer",steps: [{id:"pydantic",name:"Pydantic"},{id:"fastapi",name:"FastAPI"},{id:"sqlmodel",name:"SQLModel"}] },
      { label: "ML Engineer",  steps: [{id:"pydantic",name:"Pydantic"},{id:"fastapi",name:"FastAPI"},{id:"langchain",name:"LangChain"}] }
    ],
    avis_terrain: "Pydantic v2 (Rust) est quasi-obligatoire dans tout projet Python sérieux. Je l'utilise aussi bien pour valider les payloads d'API que pour typer la configuration (BaseSettings). La combinaison FastAPI + Pydantic + SQLModel est mon stack backend Python préféré.",
    limitations: [
      "Breaking changes majeurs entre v1 et v2 — migration parfois laborieuse",
      "Overhead de compilation des schémas au démarrage (notable en Lambda/FaaS)",
      "Verbosité sur des modèles très imbriqués avec validators complexes",
      "Comportement de la coercition implicite peut surprendre (str→int automatique)",
      "Moins adapté aux structures de données non-tabulaires complexes"
    ],
    migration: {
      from: "pydantic v1",
      title: "Migration v1 → v2",
      disclaimer: "Ces exemples couvrent les changements les plus fréquents. La migration v1 → v2 peut être complexe sur les validators personnalisés, les Config classes et les comportements de coercition implicite. Utiliser pydantic v1 compat layer en transition.",
      mappings: [
        { before: "from pydantic import validator",     after: "from pydantic import field_validator" },
        { before: "@validator('field')",                after: "@field_validator('field')" },
        { before: "class Config:\n    orm_mode = True", after: "model_config = ConfigDict(from_attributes=True)" },
        { before: "obj.dict()",                        after: "obj.model_dump()" },
        { before: "obj.json()",                        after: "obj.model_dump_json()" },
        { before: "Model.parse_obj(data)",             after: "Model.model_validate(data)" }
      ]
    },
    competitors: {
      direct: [
        { id: "marshmallow", name: "marshmallow",  reason: "Sérialisation/validation Python historique, Flask-friendly" },
        { id: "attrs",       name: "attrs",         reason: "Classes Python immuables, plus léger, sans magie" }
      ],
      indirect: [
        { id: "dataclasses", name: "dataclasses",   reason: "Standard library — aucune dépendance, mais sans validation" },
        { id: "typeddict",   name: "TypedDict",     reason: "Typage statique seul, pas de validation à l'exécution" }
      ]
    },
    tradeoffs: {
      forces:    ["Validation runtime avec messages d'erreur explicites et structurés", "Génération de schéma JSON automatique", "Intégration native FastAPI, LangChain, SQLModel", "Pydantic v2 (core Rust) — très performant pour la validation"],
      faiblesses: ["Overhead de validation à chaque instanciation — non adapté aux boucles ultra-critiques", "Migration v1 → v2 complexe sur les validators personnalisés et Config classes", "Coercition implicite peut masquer des erreurs de type silencieuses"],
      compromis: ["Sécurité des données et expressivité contre overhead runtime et complexité migration v1→v2", "Typage fort et auto-doc contre configuration initiale plus verbeuse que dataclasses"]
    },
    architecture_recommandee: [
      { cas: "API FastAPI avec validation stricte", stack: ["Requête HTTP", "Pydantic (validation input)", "Logique métier", "Pydantic (sérialisation output)", "JSON"] },
      { cas: "Configuration applicative typée",  stack: ["Variables d'environnement", "Pydantic BaseSettings", "Objet config typé", "Injection dans services"] }
    ],
    recommended_stacks: [
      { name: "API validation",       stack: ["FastAPI", "Pydantic", "PostgreSQL"] },
      { name: "Config applicative",   stack: ["Pydantic Settings", "FastAPI", "Docker"] },
      { name: "ETL typé",             stack: ["Pydantic", "Polars", "PyArrow"] }
    ],
    when_to_move_on: [
      { trigger: "Schémas très dynamiques ou générés à l'exécution", alternative: "marshmallow" },
      { trigger: "Sérialisation uniquement sans validation",         alternative: "dataclasses" },
      { trigger: "Contraintes mémoire très strictes",               alternative: "dataclasses" }
    ],
    common_mistakes: [
      "Mélanger Pydantic v1 et v2 dans le même projet (incompatibilités subtiles)",
      "Utiliser Optional sans valeur par défaut clairement définie",
      "Imbriquer des modèles profonds sans penser à la sérialisation JSON et aux performances",
      "Oublier model_rebuild() après des références circulaires"
    ],
    enterprise_usage: { startup: 5, pme: 5, grand_groupe: 5, cloud: 5, on_prem: 5 },
    context_switch_rules: [
      { condition: "API FastAPI ou Litestar",                                 recommendation: "Pydantic — intégration native, zéro configuration",                    action: "use" },
      { condition: "Configuration typée d'application",                      recommendation: "Pydantic BaseSettings — lecture env vars + validation en une classe", action: "use" },
      { condition: "Sérialisation ultra-performante (μs) critique",           recommendation: "msgspec ou attrs — moins de fonctionnalités mais plus rapide",       action: "evaluate" },
      { condition: "Typage statique uniquement, sans validation runtime",     recommendation: "dataclasses + mypy — stdlib, aucune dépendance",                      action: "evaluate" },
      { condition: "Projet Flask existant avec marshmallow",                  recommendation: "Migration Pydantic possible mais non urgente — arbitrer le ROI",      action: "evaluate" }
    ],
    recommendation: {
      stars: 5,
      label: "Fortement recommandé",
      context: "pour tout projet Python sérieux nécessitant validation et typage fort"
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // APACHE SPARK
  // ─────────────────────────────────────────────────────────────────────
  {
    id: "spark",
    name: "Apache Spark",
    icon: "⚡",
    category: "Big Data",
    language: "Scala / Python / Java / R",
    created: "2010",
    maturity: "mature",
    popularity: "very-high",
    version: "3.5.x",
    github_repo: "apache/spark",
    tags: ["big-data", "distributed", "streaming", "ml", "etl"],
    summary: "Apache Spark est le moteur de traitement de données distribué le plus utilisé au monde. Il supporte le batch, le streaming (Structured Streaming) et le ML (MLlib). PySpark expose son API en Python. Indispensable pour les volumes > 10 Go nécessitant un cluster.",
    use_cases: ["ETL distribué sur cluster", "Streaming Structured Streaming", "ML à grande échelle (MLlib)", "Data Lakes multi-pétaoctets", "Pipelines Databricks/EMR"],
    when_to_use: [
      "Volume > 10 Go ou qui ne tient pas en RAM",
      "Infrastructure cluster (Databricks, EMR, GCP Dataproc)",
      "Streaming + batch dans le même pipeline",
      "MLlib pour ML distribué",
      "SQL sur Data Lake avec Spark SQL"
    ],
    when_to_avoid: [
      "Volumes < 10 Go (Polars ou DuckDB sont plus rapides)",
      "Pas d'infrastructure cluster disponible",
      "Besoin de résultats immédiats (latence JVM)",
      "Scripts exploratoires locaux",
      "Contraintes de coût infrastructure (cluster = cher)"
    ],
    alternatives: [
      { id: "ray",    name: "Ray",    category: "Distribué Python",  reason: "Calcul distribué Python plus léger, bonne intégration ML/AI" },
      { id: "trino",  name: "Trino",  category: "SQL distribué",     reason: "SQL distribué multi-sources, sans JVM Python — moins complet mais plus agile" }
    ],
    ratings: { performance: 4, simplicity: 2, scalability: 5, memory: 3, ecosystem: 5 },
    cheatsheet: {
      install:       "pip install pyspark",
      session:       "spark = SparkSession.builder.appName('app').getOrCreate()",
      read_parquet:  "df = spark.read.parquet('data.parquet')",
      filter:        "df.filter(df.age > 30)",
      groupby:       "df.groupBy('cat').agg(F.sum('val').alias('total'))",
      join:          "df.join(other, on='id', how='left')",
      write_parquet: "df.write.parquet('output/', mode='overwrite')",
      sql:           "spark.sql('SELECT * FROM table WHERE age > 30')",
      streaming:     "df = spark.readStream.format('kafka').load()",
      cache:         "df.cache(); df.persist(StorageLevel.MEMORY_AND_DISK)"
    },
    compatibilities: {
      formats:       ["Parquet", "Delta Lake", "Iceberg", "Hudi", "Avro", "ORC", "JSON", "CSV"],
      engines:       ["Polars (conversion)", "pandas (conversion)", "Kafka"],
      frameworks:    ["Databricks", "AWS EMR", "Azure Synapse", "Airflow", "Prefect"],
      visualization: ["Databricks Notebooks", "Zeppelin", "Jupyter"]
    },
    architecture: {
      position: "Transformation (cluster)",
      diagram: [
        { step: "Source", items: ["S3", "GCS", "HDFS", "Kafka", "Delta Lake"] },
        { step: "↓ Apache Spark", items: ["Distributed DAG → Transformations → Actions"] },
        { step: "Stockage", items: ["Delta Lake", "Parquet", "Iceberg", "Hive"] },
        { step: "Consommation", items: ["BI tools", "ML models", "Data APIs"] }
      ]
    },
    profile_scores: { data_analyst: 5, data_engineer: 10, data_scientist: 7, backend: 3, ml_engineer: 8 },
    related: ["delta-lake", "kafka", "duckdb", "polars"],
    learning_paths: [
      { label: "Data Engineer",      steps: [{id:"pandas",name:"pandas"},{id:"polars",name:"Polars"},{id:"duckdb",name:"DuckDB"},{id:"spark",name:"Spark"}] },
      { label: "ML Engineer",        steps: [{id:"pandas",name:"pandas"},{id:"polars",name:"Polars"},{id:"spark",name:"Spark MLlib"},{id:"ray",name:"Ray"}] },
      { label: "Analytics Engineer", steps: [{id:"duckdb",name:"DuckDB"},{id:"dbt",name:"dbt"},{id:"spark",name:"Spark SQL"},{id:"delta-lake",name:"Delta Lake"}] }
    ],
    avis_terrain: "Spark est indispensable en entreprise dès qu'on parle de vrais volumes (dizaines de Go+). Mais pour 95% des projets data engineering courants, Polars sur un bon serveur est plus rapide, plus simple et moins cher. Je recommande d'évaluer honnêtement si un cluster est vraiment nécessaire.",
    limitations: [
      "Latence JVM au démarrage — pas adapté aux jobs courts ou interactifs",
      "Complexité d'installation et de maintenance d'un cluster",
      "Sur-dimensionné et plus lent que Polars/DuckDB pour volumes < 10 Go",
      "Coût infrastructure élevé (cluster Databricks, EMR)",
      "Débogage difficile sur les stacks traces JVM",
      "API PySpark moins pythonique que Polars ou pandas"
    ],
    migration: {
      from: "polars",
      title: "Migration de Polars vers Spark (scale-out)",
      disclaimer: "Ces exemples couvrent les transformations courantes. Les APIs PySpark et Polars diffèrent sur les UDFs, les window functions et la gestion des nulls. Prévoir une phase de validation des résultats entre les deux implémentations.",
      mappings: [
        { before: "pl.read_parquet('data.parquet')",                      after: "spark.read.parquet('data.parquet')" },
        { before: "df.filter(pl.col('age') > 30)",                        after: "df.filter(df.age > 30)" },
        { before: "df.group_by('cat').agg(pl.col('v').sum())",            after: "df.groupBy('cat').agg(F.sum('v').alias('v'))" },
        { before: "df.join(other, on='id', how='left')",                  after: "df.join(other, on='id', how='left')" },
        { before: "df.write_parquet('out.parquet')",                      after: "df.write.parquet('output/', mode='overwrite')" }
      ]
    },
    competitors: {
      direct: [
        { id: "flink",  name: "Apache Flink", reason: "Streaming basse latence — plus spécialisé que Spark pour l'event-time processing" },
        { id: "beam",   name: "Apache Beam",  reason: "API unifiée batch+streaming, multi-runner" },
        { id: "dask",   name: "Dask",         reason: "Distribué léger Python, API pandas-like" }
      ],
      indirect: [
        { id: "polars",  name: "Polars",  reason: "Mono-nœud mais nettement plus performant pour les volumes tenant en RAM" },
        { id: "duckdb",  name: "DuckDB",  reason: "SQL analytique sans cluster pour les volumes modérés" }
      ]
    },
    tradeoffs: {
      forces:    ["Traitement distribué — scalabilité horizontale sur cluster", "Ecosystème mature : MLlib, Streaming, SQL dans un seul framework", "Standard de facto Databricks/EMR/Azure Synapse", "Batch et streaming unifiés"],
      faiblesses: ["Overhead de démarrage JVM + cluster significatif", "Complexe à configurer et déboguer localement", "Coûteux en infrastructure — non justifié pour les volumes < 10 Go", "PySpark moins performant que Scala Spark"],
      compromis: ["Scalabilité illimitée contre complexité d'infrastructure élevée", "Ecosystème complet et maturé contre overhead de démarrage non négligeable"]
    },
    architecture_recommandee: [
      { cas: "ETL Lakehouse > 100 Go",     stack: ["Source S3/ADLS/GCS", "Spark (transformation distribuée)", "Delta Lake (stockage)", "dbt-spark (qualité SQL)", "Power BI / Tableau"] },
      { cas: "ML distribué sur gros volumes", stack: ["Delta Lake (données)", "Spark MLlib (features + training)", "MLflow (tracking)", "FastAPI (serving)"] }
    ],
    recommended_stacks: [
      { name: "Data Lake distribué", stack: ["Spark", "Delta Lake", "S3 / ADLS"] },
      { name: "Streaming",          stack: ["Spark Streaming", "Kafka", "Delta Lake"] },
      { name: "ML distribué",       stack: ["Spark MLlib", "Delta Lake", "MLflow"] }
    ],
    when_to_move_on: [
      { trigger: "Volume tenant en mémoire sur une seule machine",  alternative: "Polars ou DuckDB" },
      { trigger: "Latence très faible requise (event-time)",        alternative: "Flink" },
      { trigger: "Coût infrastructure trop élevé",                  alternative: "Polars ou DuckDB" },
      { trigger: "Équipe Python sans expérience Scala / JVM",       alternative: "Polars ou Dask" }
    ],
    common_mistakes: [
      "Appeler collect() sur un grand dataset (ramène toutes les données dans le driver)",
      "Ne pas persister un DataFrame réutilisé plusieurs fois (.cache() ou .persist())",
      "Ignorer le shuffle sur les jointures avec des données non-partitionnées",
      "Sur-partitionner ou sous-partitionner les données (impacte fortement les performances)"
    ],
    enterprise_usage: { startup: 2, pme: 3, grand_groupe: 5, cloud: 5, on_prem: 4 },
    context_switch_rules: [
      { condition: "Dataset tient en RAM d'un seul serveur (< 50 Go)",        recommendation: "Polars ou DuckDB — plus rapides et sans complexité cluster",        action: "avoid" },
      { condition: "Infrastructure cluster Databricks/EMR disponible",        recommendation: "Spark — écosystème optimal pour ce contexte",                         action: "use" },
      { condition: "Streaming + batch dans le même pipeline",                recommendation: "Spark Structured Streaming — référence technique",                    action: "use" },
      { condition: "Pas d'infrastructure cluster, budget contraint",          recommendation: "Polars sur un bon serveur — souvent suffisant et moins coûteux",     action: "avoid" },
      { condition: "ML distribué sur gros volumes",                           recommendation: "Spark MLlib + Databricks, ou Ray si Python natif préféré",            action: "use" }
    ],
    recommendation: {
      stars: 3,
      label: "Réservé aux gros volumes",
      context: "uniquement si volume > 10 Go et infrastructure cluster disponible"
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // PYARROW
  // ─────────────────────────────────────────────────────────────────────
  {
    id: "pyarrow",
    name: "PyArrow",
    icon: "🏹",
    category: "Data Engineering",
    language: "C++ / Python",
    created: "2016",
    maturity: "stable",
    popularity: "high",
    version: "19.x",
    github_repo: "apache/arrow",
    tags: ["arrow", "parquet", "columnar", "serialisation", "interop"],
    summary: "PyArrow est l'implémentation Python d'Apache Arrow, le format mémoire columnar standard. Il est la couche d'interopérabilité universelle entre Polars, DuckDB, pandas, Spark et tout l'écosystème data Python. Indispensable pour lire/écrire Parquet efficacement.",
    use_cases: ["Lecture/écriture Parquet", "Interopérabilité entre libs data", "Transfert zero-copy entre outils", "Stockage columnar en mémoire", "Conversion de formats"],
    when_to_use: [
      "Besoin d'interopérabilité entre Polars, DuckDB, pandas",
      "Lecture de fichiers Parquet avec contrôle fin",
      "Transfert de données zero-copy entre processus",
      "Pipeline multi-outil avec format commun",
      "Construction de datasets Hugging Face"
    ],
    when_to_avoid: [
      "Manipulation directe de données (préférer Polars ou pandas)",
      "Simple lecture CSV (Polars est plus ergonomique)",
      "Débutants sans connaissance du format Arrow"
    ],
    alternatives: [
      { id: "polars",      name: "Polars",      category: "DataFrame",      reason: "API manipulation plus haute, construite sur Apache Arrow — usage courant" },
      { id: "pandas",      name: "pandas",      category: "DataFrame",      reason: "API tabulaire classique — lit/écrit nativement le format Arrow" },
      { id: "fastparquet", name: "fastparquet", category: "Parquet",        reason: "Lecture Parquet alternative, empreinte plus légère" }
    ],
    ratings: { performance: 5, simplicity: 3, scalability: 5, memory: 5, ecosystem: 5 },
    cheatsheet: {
      install:       "pip install pyarrow",
      read_parquet:  "table = pq.read_table('data.parquet')",
      write_parquet: "pq.write_table(table, 'out.parquet')",
      to_pandas:     "table.to_pandas()",
      from_pandas:   "pa.Table.from_pandas(df)",
      to_polars:     "pl.from_arrow(table)",
      schema:        "table.schema",
      filter:        "pq.read_table('data.parquet', filters=[('age', '>', 30)])",
      partitioned:   "pq.write_to_dataset(table, 'dir/', partition_cols=['year'])",
      column_select: "pq.read_table('data.parquet', columns=['a', 'b'])"
    },
    compatibilities: {
      formats:       ["Parquet", "Arrow IPC", "Feather", "ORC", "CSV"],
      engines:       ["DuckDB", "Polars", "pandas", "Apache Spark"],
      frameworks:    ["Hugging Face Datasets", "Ray", "Dask"],
      visualization: ["Matplotlib (via pandas)", "Plotly"]
    },
    architecture: {
      position: "Couche d'interopérabilité",
      diagram: [
        { step: "Polars / DuckDB / pandas", items: ["Outils de transformation"] },
        { step: "↓↑ PyArrow", items: ["Format Arrow commun — zéro copie"] },
        { step: "Stockage", items: ["Parquet", "Feather", "IPC", "S3"] },
        { step: "Consommation", items: ["Tous les outils compatibles Arrow"] }
      ]
    },
    profile_scores: { data_analyst: 4, data_engineer: 9, data_scientist: 6, backend: 5, ml_engineer: 6 },
    related: ["polars", "duckdb", "pandas", "delta-lake"],
    learning_paths: [
      { label: "Data Engineer",      steps: [{id:"pandas",name:"pandas"},{id:"pyarrow",name:"PyArrow"},{id:"polars",name:"Polars"},{id:"duckdb",name:"DuckDB"}] },
      { label: "ML Engineer",        steps: [{id:"pandas",name:"pandas"},{id:"pyarrow",name:"PyArrow"},{id:"polars",name:"Polars"},{id:"spark",name:"Spark"}] },
      { label: "Analytics Engineer", steps: [{id:"pandas",name:"pandas"},{id:"pyarrow",name:"PyArrow"},{id:"duckdb",name:"DuckDB"},{id:"delta-lake",name:"Delta Lake"}] }
    ],
    avis_terrain: "PyArrow est souvent invisible mais omniprésent. C'est la 'glue' de l'écosystème data Python. Je ne l'utilise pas directement pour manipuler des données, mais je m'assure qu'il est installé dans tous mes environnements data pour garantir l'interopérabilité.",
    limitations: [
      "API de bas niveau — pas ergonomique pour la manipulation directe de données",
      "Documentation technique dense, peu accessible pour les débutants",
      "Versions majeures fréquentes avec breaking changes dans les modules internes",
      "Pas conçu pour être utilisé seul — couche d'interopérabilité uniquement",
      "Compatibilité à vérifier entre versions pyarrow, polars et pandas"
    ],
    migration: {
      from: "pandas",
      title: "Interopérabilité pandas ↔ PyArrow",
      disclaimer: "PyArrow n'est généralement pas une 'migration' mais une couche d'interopérabilité. Les conversions préservent les données mais pas toujours les types (notamment les index pandas, les catégories, les types DateTime avec timezone).",
      mappings: [
        { before: "df  # pandas DataFrame",                  after: "pa.Table.from_pandas(df)" },
        { before: "table  # PyArrow Table",                  after: "table.to_pandas()" },
        { before: "pd.read_parquet('f.parquet')",            after: "pq.read_table('f.parquet')" },
        { before: "df.to_parquet('f.parquet')",              after: "pq.write_table(table, 'f.parquet')" },
        { before: "# polars → arrow",                        after: "df.to_arrow()  # polars natif" }
      ]
    },
    competitors: {
      direct: [
        { id: "pandas-array", name: "pandas Array",  reason: "Format mémoire alternatif pour pandas" },
        { id: "numpy",        name: "NumPy",          reason: "Format numérique standard avant Arrow" }
      ],
      indirect: [
        { id: "cudf",  name: "cuDF (RAPIDS)",  reason: "Format columnar GPU comme alternative Arrow" }
      ]
    },
    tradeoffs: {
      forces:    ["Standard de facto pour l'interopérabilité données en Python", "Zero-copy entre Polars, DuckDB, pandas, Spark — pas de copie mémoire", "Lecture Parquet ultra-performante avec projection et filtres poussés", "Format natif Hugging Face Datasets"],
      faiblesses: ["API bas niveau — verbeux pour les transformations tabulaires", "Pas de groupby natif ergonomique ni d'API de manipulation haut niveau", "Documentation moins accessible pour les débutants que pandas ou Polars"],
      compromis: ["Interopérabilité maximale et performances optimales contre API moins ergonomique pour la transformation", "Outil de transit idéal mais pas conçu pour remplacer Polars ou pandas"]
    },
    architecture_recommandee: [
      { cas: "Transit zero-copy entre outils data",    stack: ["Polars (transformation)", "PyArrow Table (transit)", "DuckDB (analyse SQL)", "pandas (ML/viz)"] },
      { cas: "Lecture Parquet optimisée depuis S3",    stack: ["Parquet S3/local", "PyArrow (scan + colonnes sélectifs)", "Polars/pandas (traitement)"] }
    ],
    recommended_stacks: [
      { name: "Interopérabilité data",  stack: ["PyArrow", "Polars", "DuckDB"] },
      { name: "Stockage columnar",      stack: ["PyArrow", "Parquet", "S3"] },
      { name: "Échange zero-copy",      stack: ["PyArrow Flight", "Polars", "DuckDB"] }
    ],
    when_to_move_on: [
      { trigger: "Traitement analytique complet avec API riche",    alternative: "Polars ou DuckDB" },
      { trigger: "Requêtes SQL sur fichiers",                       alternative: "DuckDB" },
      { trigger: "Interface DataFrame simplifiée",                  alternative: "Polars" }
    ],
    common_mistakes: [
      "Convertir systématiquement vers pandas au lieu de traiter directement en Arrow",
      "Ignorer les schémas Arrow lors de la lecture Parquet (perte de types)",
      "Utiliser PyArrow comme DataFrame principal au lieu d'un outil analytique dédié"
    ],
    enterprise_usage: { startup: 3, pme: 4, grand_groupe: 5, cloud: 5, on_prem: 5 },
    context_switch_rules: [
      { condition: "Lecture / écriture Parquet avec contrôle fin",            recommendation: "PyArrow — accès bas niveau le plus performant",                          action: "use" },
      { condition: "Manipulation de données tabulaires",                     recommendation: "Polars ou pandas — API plus ergonomique au-dessus d'Arrow",          action: "avoid" },
      { condition: "Interopérabilité Polars ↔ DuckDB ↔ pandas",              recommendation: "PyArrow comme format de transit — zéro copie mémoire",                action: "use" },
      { condition: "Construction de datasets Hugging Face",                  recommendation: "PyArrow — format natif Arrow des datasets HF",                        action: "use" },
      { condition: "Débutant sans connaissance du format Arrow",              recommendation: "Commencer par Polars ou pandas — PyArrow reste implicite",           action: "avoid" }
    ],
    recommendation: {
      stars: 4,
      label: "Recommandé comme couche d'interopérabilité",
      context: "indispensable dans tout environnement multi-outils data Python"
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // DELTA LAKE
  // ─────────────────────────────────────────────────────────────────────
  {
    id: "delta-lake",
    name: "Delta Lake",
    icon: "🔷",
    category: "Lakehouse",
    language: "Scala / Python / Rust",
    created: "2019",
    maturity: "stable",
    popularity: "high",
    version: "3.x",
    github_repo: "delta-io/delta",
    tags: ["lakehouse", "acid", "parquet", "versioning", "streaming"],
    summary: "Delta Lake est un format de table open source (au-dessus de Parquet) apportant les transactions ACID, le versioning, le schema enforcement et le time travel à un Data Lake. C'est le format standard du lakehouse, supporté par Spark, Polars et DuckDB.",
    use_cases: ["Lakehouse ACID sur cloud", "Time travel et audit", "Upsert/Delete sur Parquet", "Streaming + batch unifié", "Schema evolution"],
    when_to_use: [
      "Besoin de transactions ACID sur un Data Lake",
      "Upsert (MERGE) sur des tables Parquet",
      "Time travel et audit de données",
      "Streaming + batch dans le même storage",
      "Schema evolution controlée"
    ],
    when_to_avoid: [
      "Projets locaux simples sans besoin ACID (Parquet suffit)",
      "Pas de Spark ou de runtime Delta compatible",
      "Volumes très petits sans besoin de versioning"
    ],
    alternatives: [
      { id: "nessie",        name: "Project Nessie",     category: "Catalog",          reason: "Catalog git-like pour tables Delta/Iceberg — versioning multi-tables" },
      { id: "lakeformation", name: "AWS Lake Formation", category: "Lakehouse managé", reason: "Lakehouse managé AWS avec gouvernance — Delta Lake sans opérations" }
    ],
    ratings: { performance: 4, simplicity: 3, scalability: 5, memory: 4, ecosystem: 4 },
    cheatsheet: {
      install:        "pip install deltalake",
      write:          "write_deltalake('path/table', df_arrow)",
      read:           "dt = DeltaTable('path/table'); df = dt.to_pandas()",
      read_polars:    "pl.read_delta('path/table')",
      history:        "dt.history()",
      time_travel:    "dt.load_as_version(3)",
      vacuum:         "dt.vacuum(retention_hours=168)",
      merge_upsert:   "(dt.merge(src, 'target.id = src.id')\n  .when_matched_update_all()\n  .when_not_matched_insert_all()\n  .execute())",
      optimize:       "dt.optimize.compact()"
    },
    compatibilities: {
      formats:       ["Parquet (base)", "Arrow", "JSON (log Delta)"],
      engines:       ["Polars (delta-rs)", "DuckDB (lecture)", "Apache Spark", "PyArrow"],
      frameworks:    ["dbt-delta", "MLflow", "Hudi (alternative)", "Iceberg (alternative)"],
      visualization: ["Databricks", "AWS Athena", "Azure Synapse"]
    },
    architecture: {
      position: "Stockage (Lakehouse)",
      diagram: [
        { step: "Source", items: ["Kafka", "API", "DB", "Fichiers"] },
        { step: "Transformation", items: ["Spark", "Polars"] },
        { step: "↓ Delta Lake", items: ["ACID · Versioning · Schema · Time Travel"] },
        { step: "Consommation", items: ["Spark SQL", "DuckDB", "BI tools"] }
      ]
    },
    profile_scores: { data_analyst: 5, data_engineer: 10, data_scientist: 6, backend: 3, ml_engineer: 5 },
    related: ["spark", "polars", "pyarrow", "duckdb"],
    learning_paths: [
      { label: "Data Engineer",      steps: [{id:"parquet",name:"Parquet"},{id:"delta-lake",name:"Delta Lake"},{id:"dbt",name:"dbt"},{id:"spark",name:"Spark"}] },
      { label: "Analytics Engineer", steps: [{id:"duckdb",name:"DuckDB"},{id:"delta-lake",name:"Delta Lake"},{id:"dbt",name:"dbt"}] },
      { label: "MLOps",              steps: [{id:"parquet",name:"Parquet"},{id:"delta-lake",name:"Delta Lake"},{id:"mlflow",name:"MLflow"}] }
    ],
    avis_terrain: "Delta Lake s'est imposé comme le standard du lakehouse. La combinaison delta-rs (Python natif) + Polars me permet d'avoir un lakehouse ACID local sans Spark, ce qui est idéal pour les projets data engineering à taille humaine.",
    limitations: [
      "Overhead du delta log pour les très petites tables (< 1 Go) — Parquet brut suffisant",
      "Certaines fonctionnalités avancées (OPTIMIZE complet) nécessitent encore Spark",
      "delta-rs (Python) est moins mature que l'implémentation Spark originale",
      "Pas de support OLTP — pas fait pour les mises à jour unitaires fréquentes",
      "Lock de fichier possible sur certains cloud providers lors d'écritures concurrentes"
    ],
    migration: {
      from: "Parquet brut",
      title: "Migration depuis Parquet vers Delta Lake",
      disclaimer: "La migration est incrémentale : les fichiers Parquet existants peuvent être convertis table par table. Le delta log ajoute un overhead de métadonnées — non justifié pour les petites tables ou les données en lecture seule.",
      mappings: [
        { before: "df.write_parquet('data/table/')",   after: "write_deltalake('data/table/', df.to_arrow())" },
        { before: "pl.read_parquet('data/table/')",    after: "pl.read_delta('data/table/')" },
        { before: "# pas de MERGE/UPSERT natif",       after: "dt.merge(src, 'target.id = src.id').when_matched_update_all().execute()" },
        { before: "# pas de time travel",              after: "dt.load_as_version(3)  # version précédente" },
        { before: "# pas d'historique",                after: "dt.history()  # audit complet" }
      ]
    },
    competitors: {
      direct: [
        { id: "iceberg", name: "Apache Iceberg", reason: "Standard ouvert plus supporté par AWS/GCP/Snowflake" },
        { id: "hudi",    name: "Apache Hudi",    reason: "Spécialisé CDC et upserts streaming" }
      ],
      indirect: [
        { id: "parquet",      name: "Parquet",       reason: "Plus simple, sans overhead lakehouse" },
        { id: "deltasharing", name: "DeltaSharing",  reason: "Partage de données Delta sans copie" }
      ]
    },
    tradeoffs: {
      forces:    ["Transactions ACID sur fichiers Parquet — MERGE, UPDATE, DELETE", "Time travel et rollback sur les versions précédentes", "Schéma évolutif géré automatiquement", "Compatible Polars, DuckDB (lecture), Spark"],
      faiblesses: ["Overhead de métadonnées (delta log) non justifié pour les petites tables", "Vacuum régulier nécessaire pour maintenir les performances à long terme", "Lock-in partiel selon l'écosystème cloud (vs Iceberg plus neutre)"],
      compromis: ["Fiabilité ACID et time travel contre overhead opérationnel (vacuum, optimize)", "Standard lakehouse Python contre dépendance partielle à l'écosystème Databricks"]
    },
    architecture_recommandee: [
      { cas: "Lakehouse Python sans Spark",       stack: ["Source CSV/API", "Polars (transformation)", "Delta Lake via delta-rs (ACID)", "DuckDB (analyse SQL)"] },
      { cas: "Lakehouse cloud avec Spark",         stack: ["Source S3/ADLS", "Spark (ETL)", "Delta Lake (stockage)", "dbt-spark (transformations SQL)", "Power BI"] }
    ],
    recommended_stacks: [
      { name: "Lakehouse cloud",         stack: ["Delta Lake", "Spark", "S3 / ADLS"] },
      { name: "Delta local sans Spark",  stack: ["Delta Lake", "Polars", "DuckDB"] },
      { name: "Medallion Architecture",  stack: ["Delta Lake", "dbt", "Spark"] }
    ],
    when_to_move_on: [
      { trigger: "Pas de besoin de time travel ou d'ACID",           alternative: "Parquet simple" },
      { trigger: "Volume modeste sans historique requis",             alternative: "DuckDB + Parquet" },
      { trigger: "Écosystème Iceberg déjà en place",                  alternative: "Apache Iceberg" },
      { trigger: "Catalog partagé multi-moteurs",                    alternative: "Apache Iceberg + Nessie" }
    ],
    common_mistakes: [
      "Négliger le VACUUM régulier (accumulation de versions et d'anciens fichiers)",
      "Confondre Delta Lake avec une base de données transactionnelle OLTP",
      "Ignorer le partitionnement sur de gros volumes (impact fort sur les performances)",
      "Oublier d'optimiser les small files avec OPTIMIZE pour maintenir la performance"
    ],
    enterprise_usage: { startup: 3, pme: 4, grand_groupe: 5, cloud: 5, on_prem: 4 },
    context_switch_rules: [
      { condition: "Simples fichiers Parquet sans ACID, usage local",          recommendation: "Parquet brut — Delta Lake apporte un overhead non justifié",           action: "avoid" },
      { condition: "Lakehouse avec transactions ACID requis",                  recommendation: "Delta Lake — standard avec delta-rs (Python, sans Spark)",           action: "use" },
      { condition: "AWS/GCP avec support Iceberg natif",                      recommendation: "Iceberg peut être préférable — arbitrer selon l'écosystème cloud",     action: "evaluate" },
      { condition: "Upserts / deletes sur Parquet",                           recommendation: "Delta Lake (MERGE) ou Iceberg — selon l'infrastructure existante",   action: "use" },
      { condition: "Time travel, audit et rollback requis",                   recommendation: "Delta Lake ou Iceberg — fonctionnalité équivalente entre les deux",  action: "use" }
    ],
    recommendation: {
      stars: 4,
      label: "Recommandé pour les lakehouses en production",
      context: "avec delta-rs (Python) — Spark non requis pour les volumes < 100 Go"
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // DBT
  // ─────────────────────────────────────────────────────────────────────
  {
    id: "dbt",
    name: "dbt",
    icon: "🔧",
    category: "Analytics Engineering",
    language: "SQL / Python / Jinja",
    created: "2016",
    maturity: "stable",
    popularity: "high",
    version: "1.9.x",
    github_repo: "dbt-labs/dbt-core",
    tags: ["sql", "analytics-engineering", "transformation", "testing", "documentation"],
    summary: "dbt (data build tool) est l'outil standard de l'analytics engineering. Il permet d'écrire les transformations SQL sous forme de modèles versionnés, testés et documentés. Compatible avec tous les data warehouses (BigQuery, Snowflake, Redshift, DuckDB…).",
    use_cases: ["Transformations SQL versionnées", "Analytics engineering", "Documentation auto de la data", "Testing de qualité de données", "Lineage et DaG de transformation"],
    when_to_use: [
      "Transformations SQL dans un data warehouse",
      "Besoin de tests de qualité de données automatisés",
      "Documentation et lineage du pipeline analytique",
      "Collaboration équipe sur les modèles SQL",
      "CI/CD pour la data transformation"
    ],
    when_to_avoid: [
      "Ingestion de données (dbt ne fait que transformer)",
      "Traitement en dehors d'un SQL warehouse",
      "Scripts one-shot sans besoin de maintenance"
    ],
    alternatives: [
      { id: "great-expectations", name: "Great Expectations", category: "Data Quality",      reason: "Tests de qualité avancés — complète dbt sur les assertions complexes" },
      { id: "elementary",         name: "Elementary",         category: "Data Observability", reason: "Monitoring et alertes de qualité de données — s'intègre à dbt" }
    ],
    ratings: { performance: 3, simplicity: 4, scalability: 4, memory: 4, ecosystem: 5 },
    cheatsheet: {
      install:      "pip install dbt-duckdb  # ou dbt-bigquery, dbt-snowflake",
      init:         "dbt init my_project",
      run:          "dbt run",
      test:         "dbt test",
      docs_gen:     "dbt docs generate && dbt docs serve",
      model:        "-- models/my_model.sql\nSELECT * FROM {{ ref('source_table') }} WHERE active = true",
      sources:      "# sources.yml\nversion: 2\nsources:\n  - name: raw\n    tables:\n      - name: orders",
      schema_test:  "# schema.yml\nmodels:\n  - name: orders\n    columns:\n      - name: id\n        tests: [unique, not_null]",
      snapshot:     "dbt snapshot",
      seed:         "dbt seed  # charge les CSV statiques"
    },
    compatibilities: {
      formats:       ["SQL (DDL généré)", "Parquet (via adapters)", "CSV (seeds)"],
      engines:       ["DuckDB", "BigQuery", "Snowflake", "Redshift", "PostgreSQL", "Spark"],
      frameworks:    ["Airflow (orchestration)", "Prefect (orchestration)", "GitHub Actions (CI)"],
      visualization: ["Metabase", "Looker", "Power BI", "Apache Superset"]
    },
    architecture: {
      position: "Transformation SQL",
      diagram: [
        { step: "Sources", items: ["Data warehouse tables brutes"] },
        { step: "↓ dbt", items: ["Modèles SQL → Tests → Documentation → Lineage"] },
        { step: "Couches", items: ["Staging → Intermediate → Marts"] },
        { step: "BI", items: ["Metabase", "Tableau", "Looker", "Superset"] }
      ]
    },
    profile_scores: { data_analyst: 8, data_engineer: 9, data_scientist: 5, backend: 2, ml_engineer: 3 },
    related: ["duckdb", "spark", "airflow", "prefect"],
    learning_paths: [
      { label: "Analytics Engineer", steps: [{id:"sql",name:"SQL"},{id:"dbt",name:"dbt"},{id:"duckdb",name:"DuckDB"},{id:"delta-lake",name:"Delta Lake"}] },
      { label: "Data Engineer",      steps: [{id:"sql",name:"SQL"},{id:"dbt",name:"dbt"},{id:"airflow",name:"Airflow"},{id:"spark",name:"Spark"}] },
      { label: "Data Analyst",       steps: [{id:"sql",name:"SQL"},{id:"dbt",name:"dbt"}] }
    ],
    avis_terrain: "dbt a révolutionné la pratique de l'analytics engineering. La discipline imposée (tests, documentation, lineage) est un investissement qui paie rapidement. Je l'utilise avec dbt-duckdb pour des pipelines locaux très performants.",
    limitations: [
      "Uniquement transformation SQL — pas d'ingestion, pas d'orchestration",
      "dbt-python (modèles Python) encore expérimental sur plusieurs adapters",
      "Temps de compilation des modèles peut être lent sur de très grands projets",
      "Configuration initiale (profiles.yml, sources, adapters) longue",
      "Tests unitaires natifs apparus tardivement (v1.8+)",
      "Vendor lock-in sur dbt Cloud pour les fonctionnalités avancées"
    ],
    migration: {
      from: "scripts SQL manuels",
      title: "Migration depuis scripts SQL manuels",
      disclaimer: "Ces exemples couvrent les cas courants. La migration vers dbt implique de structurer en couches (staging/intermediate/marts), de nommer les modèles, et de définir les tests. Un audit du SQL existant est recommandé avant de commencer.",
      mappings: [
        { before: "script_extract.sql (pas de version)",     after: "models/staging/stg_orders.sql avec {{ ref() }}" },
        { before: "# pas de test",                           after: "schema.yml: tests: [unique, not_null]" },
        { before: "# pas de documentation",                  after: "dbt docs generate && dbt docs serve" },
        { before: "python run_sql.py (manuel)",              after: "dbt run --select my_model" },
        { before: "# dépendances implicites",                after: "{{ ref('upstream_model') }}  # DAG explicite" }
      ]
    },
    competitors: {
      direct: [
        { id: "sqlmesh", name: "SQLMesh",   reason: "Plus moderne — plans d'exécution, tests unitaires natifs" },
        { id: "transform",name: "Transform", reason: "dbt-like avec meilleures fonctionnalités collaboratives" }
      ],
      indirect: [
        { id: "spark",   name: "Spark SQL",  reason: "Transformations Python/Scala distribuées" },
        { id: "polars",  name: "Polars",     reason: "Python natif, sans SQL warehouse" }
      ]
    },
    tradeoffs: {
      forces:    ["Tests de qualité données intégrés (unique, not_null, relationships)", "Documentation auto-générée des modèles et leur lignéage", "Versionné en Git — collaboration d'équipe naturelle", "ref() gère automatiquement les dépendances entre modèles"],
      faiblesses: ["Ne fait pas d'ingestion (EL) — uniquement les transformations (T)", "Transformations Python complexes (ML, logique métier) mal supportées", "Overhead de configuration et de structure pour les projets solo"],
      compromis: ["Discipline analytics engineering et collaboration contre overhead de setup initial", "SQL pur naturel dans le paradigme de base contre limitations des transformations complexes"]
    },
    architecture_recommandee: [
      { cas: "Analytics pipeline en équipe",     stack: ["Source (EL: Airbyte/Fivetran)", "Warehouse (BigQuery/Snowflake)", "dbt (transformation SQL)", "BI (Metabase/Looker)"] },
      { cas: "Lakehouse local dbt-DuckDB",        stack: ["Source CSV/API", "DuckDB (stockage)", "dbt-duckdb (transformation)", "Streamlit (dashboard)"] }
    ],
    recommended_stacks: [
      { name: "Analytics Engineering",  stack: ["dbt", "DuckDB", "Metabase"] },
      { name: "Data Warehouse cloud",   stack: ["dbt", "Snowflake / BigQuery", "Looker"] },
      { name: "Lakehouse",              stack: ["dbt", "Delta Lake", "Spark"] }
    ],
    when_to_move_on: [
      { trigger: "Transformations Python complexes non SQL",        alternative: "Polars ou Spark" },
      { trigger: "Streaming temps réel",                            alternative: "Flink ou Spark Streaming" },
      { trigger: "Orchestration complexe multi-systèmes",           alternative: "Airflow" }
    ],
    common_mistakes: [
      "Utiliser dbt pour l'ingéstion de données (c'est un outil de transformation uniquement)",
      "Ne pas versionner les modèles dbt dans un dépôt git",
      "Créer des modèles trop larges et difficiles à maintenir ou à tester",
      "Ignorer les tests de données (schema tests, data tests) disponibles dans dbt"
    ],
    enterprise_usage: { startup: 4, pme: 5, grand_groupe: 5, cloud: 5, on_prem: 4 },
    context_switch_rules: [
      { condition: "Transformations SQL en équipe dans un warehouse",         recommendation: "dbt — standard analytics engineering, discipline automatique",        action: "use" },
      { condition: "Ingestion de données nécessaire",                         recommendation: "dbt ne transforme pas — ajouter Airbyte, Fivetran ou un connecteur", action: "avoid" },
      { condition: "Transformations Python complexes (ML, logique métier)",   recommendation: "Polars ou Spark Python selon le volume — plus flexible",            action: "avoid" },
      { condition: "Projet solo, one-shot SQL",                               recommendation: "DuckDB direct ou psql — dbt overhead non justifié",                    action: "avoid" },
      { condition: "Tests et documentation de données nécessaires",           recommendation: "dbt — excellent sur ces aspects, avec dbt-duckdb pour les tests",  action: "use" }
    ],
    recommendation: {
      stars: 4,
      label: "Recommandé — standard de l'analytics engineering",
      context: "incontournable dès que plusieurs personnes collaborent sur des pipelines SQL"
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // AIRFLOW
  // ─────────────────────────────────────────────────────────────────────
  {
    id: "airflow",
    name: "Apache Airflow",
    icon: "🌀",
    category: "Orchestration",
    language: "Python",
    created: "2014",
    maturity: "mature",
    popularity: "very-high",
    version: "2.10.x",
    github_repo: "apache/airflow",
    tags: ["orchestration", "workflow", "dag", "scheduling", "etl"],
    summary: "Apache Airflow est l'orchestrateur de pipelines data le plus répandu en entreprise. Les workflows (DAGs) sont définis en Python, avec une UI web riche, un scheduler robuste et des centaines d'intégrations (operators). Standard de facto pour le batch orchestration.",
    use_cases: ["Orchestration de pipelines ETL", "Scheduling de jobs data", "Coordination de services", "Workflows complexes avec dépendances", "Airflow on Kubernetes (KubernetesPodOperator)"],
    when_to_use: [
      "Orchestration de workflows complexes avec dépendances",
      "Scheduling ETL en production",
      "Équipe déjà familière avec Airflow",
      "Intégrations nombreuses (cloud providers, DBs…)",
      "Monitoring et alerting de pipelines"
    ],
    when_to_avoid: [
      "Pipelines simples (cron suffit)",
      "Équipes cherchant quelque chose de plus moderne (Prefect, Dagster)",
      "Infrastructure légère (Airflow est lourd)",
      "Streaming temps réel"
    ],
    alternatives: [
      { id: "luigi",    name: "Luigi",    category: "Orchestration",   reason: "Orchestrateur Python Spotify, simple, moins de magie qu'Airflow" },
      { id: "temporal", name: "Temporal", category: "Workflow engine", reason: "Workflows durables et résilients — fort pour la logique métier complexe" }
    ],
    ratings: { performance: 3, simplicity: 2, scalability: 5, memory: 3, ecosystem: 5 },
    cheatsheet: {
      install:      "pip install apache-airflow",
      init:         "airflow db init && airflow users create ...",
      webserver:    "airflow webserver --port 8080",
      scheduler:    "airflow scheduler",
      dag:          "@dag(schedule='@daily', start_date=datetime(2024,1,1))\ndef my_pipeline(): ...",
      task:         "@task\ndef extract(): return data",
      bash_op:      "BashOperator(task_id='run', bash_command='python script.py')",
      python_op:    "PythonOperator(task_id='t', python_callable=my_func)",
      xcom:         "ti.xcom_push(key='data', value=result)",
      trigger:      "airflow dags trigger my_dag"
    },
    compatibilities: {
      formats:       ["JSON (XComs)", "Parquet (via operators)", "YAML (config DAGs)"],
      engines:       ["Spark (SparkSubmitOperator)", "dbt (BashOperator)", "Polars", "pandas"],
      frameworks:    ["Kubernetes (KubernetesExecutor)", "Celery (CeleryExecutor)", "AWS MWAA", "GCP Cloud Composer"],
      visualization: ["Airflow UI (Gantt, Graph, Tree)"]
    },
    architecture: {
      position: "Orchestration",
      diagram: [
        { step: "Scheduler Airflow", items: ["DAG → Tasks → Dépendances"] },
        { step: "↓ Exécution", items: ["Python tasks", "BashOperator", "K8s pods"] },
        { step: "Workers", items: ["Celery", "Kubernetes", "Local"] },
        { step: "Monitoring", items: ["UI Airflow", "Alerting", "Logs"] }
      ]
    },
    profile_scores: { data_analyst: 3, data_engineer: 10, data_scientist: 4, backend: 5, ml_engineer: 5 },
    related: ["prefect", "dbt", "spark", "dagster"],
    learning_paths: [
      { label: "Data Engineer",      steps: [{id:"cron",name:"cron"},{id:"airflow",name:"Airflow"},{id:"prefect",name:"Prefect"},{id:"dagster",name:"Dagster"}] },
      { label: "DataOps",            steps: [{id:"cron",name:"cron"},{id:"airflow",name:"Airflow"},{id:"kubernetes",name:"Kubernetes Executor"}] },
      { label: "Analytics Engineer", steps: [{id:"cron",name:"cron"},{id:"airflow",name:"Airflow"},{id:"dbt",name:"dbt (orchestré)"}] }
    ],
    avis_terrain: "Airflow reste le standard en entreprise mais montre son âge. Je le recommande quand l'équipe le connaît déjà ou pour de grosses infrastructures nécessitant ses nombreux operators. Pour les nouveaux projets, je préfère Prefect ou Dagster pour leur meilleure DX.",
    limitations: [
      "Architecture lourde : scheduler + worker + webserver + metadata DB",
      "DAGs statiques — pas de génération dynamique simple sans hacks",
      "Expérience développeur (DX) nettement inférieure à Prefect ou Dagster",
      "Debugging difficile — logs dispersés entre UI et fichiers",
      "Pas adapté au streaming ou aux workflows sub-minute",
      "Montée en version souvent accompagnée de breaking changes"
    ],
    migration: {
      from: "cron + scripts Python",
      title: "Migration depuis cron vers Airflow",
      disclaimer: "Ces exemples couvrent les cas courants. Airflow introduit une infrastructure significative (scheduler, worker, metadata DB, webserver). Évaluer si la complexité du pipeline justifie cet overhead avant de migrer.",
      mappings: [
        { before: "0 7 * * * python pipeline.py",        after: "@dag(schedule='0 7 * * *')\ndef daily_pipeline(): ..." },
        { before: "script1.py && script2.py",            after: "t1 >> t2  # dépendance explicite" },
        { before: "# pas de retry",                     after: "@task(retries=3, retry_delay=timedelta(minutes=5))" },
        { before: "# pas d'UI",                         after: "airflow webserver  # UI sur port 8080" },
        { before: "# logs manuels",                      after: "logging intégré dans l'UI Airflow" }
      ]
    },
    competitors: {
      direct: [
        { id: "prefect",  name: "Prefect",  reason: "Plus moderne, meilleure DX, cloud-native" },
        { id: "dagster",  name: "Dagster",  reason: "Asset-centric, meilleure testabilité" },
        { id: "mage",     name: "Mage",     reason: "Plus simple, notebooks intégrés" }
      ],
      indirect: [
        { id: "kestra",       name: "Kestra",        reason: "YAML-based, multi-langage, léger" },
        { id: "github-actions",name: "GitHub Actions", reason: "CI/CD — remplace Airflow pour les pipelines simples" }
      ]
    },
    tradeoffs: {
      forces:    ["Maturité — 10 ans de production, référence enterprise", "Catalogue d'operators étendu (AWS, GCP, Azure, Spark, dbt…)", "UI riche : DAG view, logs, historique d'exécution", "Standard pour l'orchestration dans les grandes organisations data"],
      faiblesses: ["Complexité de déploiement (scheduler, webserver, workers, metadata DB)", "DAGs définis statiquement — dynamisme limité par défaut", "Dépendances inter-DAGs difficiles à gérer proprement"],
      compromis: ["Maturité et catalogue d'operators contre complexité d'infrastructure significative", "Standard enterprise reconnu contre DX inférieure à Prefect ou Dagster"]
    },
    architecture_recommandee: [
      { cas: "Pipeline ETL enterprise complexe",   stack: ["Airflow (orchestration)", "Spark (traitement)", "dbt (transformation)", "Delta Lake (stockage)", "Power BI"] },
      { cas: "Migration progressive vers Prefect", stack: ["Airflow (existant, flows stables)", "Prefect (nouveaux flows)", "Migration par domaine métier"] }
    ],
    recommended_stacks: [
      { name: "Data Platform",    stack: ["Airflow", "dbt", "Spark", "S3"] },
      { name: "ML Pipeline",      stack: ["Airflow", "MLflow", "Spark"] },
      { name: "ETL Enterprise",   stack: ["Airflow", "dbt", "PostgreSQL"] }
    ],
    when_to_move_on: [
      { trigger: "Orchestration simple sans dépendances complexes",     alternative: "Prefect" },
      { trigger: "Coût infrastructure trop élevé pour une petite équipe", alternative: "Prefect Cloud" },
      { trigger: "Orchestration ML uniquement",                         alternative: "Prefect ou Metaflow" },
      { trigger: "Équipe sans expertise Airflow",                        alternative: "Prefect ou Dagster" }
    ],
    common_mistakes: [
      "Mettre de la logique métier dans les DAGs (les DAGs doivent orchestrer, pas transformer)",
      "Utiliser des XCom pour passer de gros volumes de données entre tâches",
      "Définir des schedules trop fréquents sans analyser la charge générée",
      "Ne pas monitorer les queues et les workers Celery"
    ],
    enterprise_usage: { startup: 2, pme: 4, grand_groupe: 5, cloud: 5, on_prem: 5 },
    context_switch_rules: [
      { condition: "Pipeline simple, 1-3 étapes, sans dépendances complexes",  recommendation: "cron ou GitHub Actions — Airflow overhead non justifié",            action: "avoid" },
      { condition: "Équipe déjà formée sur Airflow, infrastructure existante", recommendation: "Continuer Airflow — coût de migration élevé vs gain marginal",      action: "evaluate" },
      { condition: "Nouveau projet d'orchestration Python",                   recommendation: "Prefect ou Dagster — meilleure DX et démarrage plus rapide",          action: "avoid" },
      { condition: "Orchestration multi-services enterprise, > 100 DAGs",     recommendation: "Airflow pertinent — maturité et catalogue d'operators étendu",       action: "use" },
      { condition: "Streaming ou scheduling sub-minute requis",               recommendation: "Airflow non adapté — Prefect, Temporal ou Flink selon le cas",      action: "avoid" }
    ],
    recommendation: {
      stars: 3,
      label: "Acceptable — plutôt pour l'existant",
      context: "à éviter pour les nouveaux projets, préférer Prefect ou Dagster"
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // PREFECT
  // ─────────────────────────────────────────────────────────────────────
  {
    id: "prefect",
    name: "Prefect",
    icon: "🌊",
    category: "Orchestration",
    language: "Python",
    created: "2018",
    maturity: "stable",
    popularity: "medium",
    version: "3.x",
    github_repo: "PrefectHQ/prefect",
    tags: ["orchestration", "workflow", "python", "cloud-native", "modern"],
    summary: "Prefect est un orchestrateur de workflows Python moderne, conçu pour une meilleure expérience développeur qu'Airflow. Les flows et tasks sont des fonctions Python décorées. Prefect Cloud offre une UI moderne et le monitoring. L'exécution locale est triviale.",
    use_cases: ["Orchestration Python moderne", "Pipelines ETL", "Workflows data ML", "Alternatives légères à Airflow", "CI/CD data"],
    when_to_use: [
      "Nouveau projet d'orchestration Python",
      "Équipe cherchant une alternative moderne à Airflow",
      "Développement local simple (prefect server)",
      "Workflows qui bénéficient des retries automatiques",
      "Observabilité fine des flows"
    ],
    when_to_avoid: [
      "Écosystème déjà bien établi sur Airflow",
      "Besoin d'operators spécialisés nombreux (Airflow gagne)",
      "Contraintes budget sur Prefect Cloud"
    ],
    alternatives: [
      { id: "apscheduler", name: "APScheduler", category: "Scheduling",  reason: "Scheduling Python léger sans infrastructure — jobs simples" },
      { id: "celery",      name: "Celery",      category: "Task Queue",  reason: "File de tâches async distribuées — complémentaire ou alternatif selon l'usage" }
    ],
    ratings: { performance: 4, simplicity: 5, scalability: 4, memory: 4, ecosystem: 3 },
    cheatsheet: {
      install:      "pip install prefect",
      server:       "prefect server start",
      flow:         "@flow\ndef my_flow():\n    result = extract()\n    return transform(result)",
      task:         "@task(retries=3)\ndef extract(): ...",
      run_local:    "my_flow()",
      schedule:     "@flow(schedule=CronSchedule(cron='0 7 * * *'))\ndef daily_flow(): ...",
      deploy:       "prefect deploy",
      work_pool:    "prefect work-pool create my-pool --type process",
      logging:      "from prefect import get_run_logger\nlogger = get_run_logger()",
      state:        "if result.is_failed(): ..."
    },
    compatibilities: {
      formats:       ["JSON (résultats flows)", "Parquet (via tasks)", "YAML (config)"],
      engines:       ["Polars", "pandas", "dbt", "Spark"],
      frameworks:    ["Docker", "Kubernetes", "AWS", "GCP", "GitHub Actions"],
      visualization: ["Prefect Cloud UI", "Prefect Server (self-hosted)"]
    },
    architecture: {
      position: "Orchestration",
      diagram: [
        { step: "Prefect Server / Cloud", items: ["UI · Scheduling · Monitoring"] },
        { step: "↓ Flow execution", items: ["@flow → @task → @task → ..."] },
        { step: "Workers", items: ["Local", "Docker", "Kubernetes"] },
        { step: "Stockage artefacts", items: ["S3", "GCS", "Local"] }
      ]
    },
    profile_scores: { data_analyst: 3, data_engineer: 9, data_scientist: 5, backend: 5, ml_engineer: 5 },
    related: ["airflow", "dagster", "dbt", "polars"],
    learning_paths: [
      { label: "Data Engineer", steps: [{id:"cron",name:"cron"},{id:"prefect",name:"Prefect"},{id:"dagster",name:"Dagster"}] },
      { label: "MLOps",         steps: [{id:"prefect",name:"Prefect"},{id:"mlflow",name:"MLflow"},{id:"ray",name:"Ray"}] },
      { label: "DataOps",       steps: [{id:"cron",name:"cron"},{id:"prefect",name:"Prefect"},{id:"kubernetes",name:"Kubernetes"}] }
    ],
    avis_terrain: "Préfect est mon orchestrateur préféré pour les projets Python modernes. Le démarrage local en une commande, les décorateurs intuitifs et l'UI claire réduisent considérablement la friction. C'est mon choix par défaut pour tout nouveau projet d'orchestration data.",
    limitations: [
      "Moins d'operators que Airflow pour les intégrations cloud/SaaS",
      "Certaines fonctionnalités avancées requièrent Prefect Cloud (payant)",
      "Breaking changes entre v2 et v3 — migration non triviale",
      "Communauté plus petite qu'Airflow — moins de réponses Stack Overflow",
      "Observabilité limitée sans Prefect Cloud"
    ],
    migration: {
      from: "Airflow",
      title: "Migration depuis Airflow vers Prefect",
      disclaimer: "Ces exemples couvrent les patterns de base. Airflow et Prefect ont des modèles d'exécution différents (DAG statique vs flow dynamique). Les XComs, sensors et operators spécifiques Airflow n'ont pas toujours d'équivalent direct dans Prefect.",
      mappings: [
        { before: "@dag(schedule='@daily')",             after: "@flow\ndef daily_flow(): ..." },
        { before: "@task(task_id='extract')",            after: "@task(retries=3)\ndef extract(): ..." },
        { before: "ti.xcom_push(key='k', value=v)",     after: "return v  # Prefect passe les résultats automatiquement" },
        { before: "airflow scheduler",                   after: "prefect server start" },
        { before: "airflow dags trigger my_dag",         after: "my_flow()  # exécution locale directe" }
      ]
    },
    competitors: {
      direct: [
        { id: "airflow", name: "Airflow",  reason: "Plus mature, plus d'operators, standard en entreprise" },
        { id: "dagster", name: "Dagster",  reason: "Asset-centric, meilleure data quality intégrée" },
        { id: "mage",    name: "Mage",     reason: "Notebooks intégrés, encore plus accessible" }
      ],
      indirect: [
        { id: "kestra",   name: "Kestra",   reason: "YAML-based, multi-langage" },
        { id: "temporal", name: "Temporal", reason: "Workflows durables, forte cohérence" }
      ]
    },
    tradeoffs: {
      forces:    ["Flows = fonctions Python décorées — courbe d'apprentissage très faible", "Exécution locale triviale sans infrastructure", "UI moderne et monitoring des flows en temps réel", "Retry, caching, paramétrage natifs et naturels"],
      faiblesses: ["Prefect Cloud payant au-delà du tier gratuit", "Ecosystème d'intégrations moins étendu qu'Airflow", "Moins éprouvé que Airflow dans les environnements enterprise très complexes"],
      compromis: ["Meilleure DX et démarrage rapide contre écosystème d'operators moins étendu qu'Airflow", "Gratuit en local contre coût Prefect Cloud en production à l'échelle"]
    },
    architecture_recommandee: [
      { cas: "Pipeline Python moderne sans Airflow", stack: ["Source API/DB", "Prefect Flow (orchestration)", "Polars (transformation)", "Delta Lake (stockage)"] },
      { cas: "MLOps pipeline avec monitoring",       stack: ["Prefect (orchestration)", "Polars (preprocessing)", "MLflow (tracking)", "FastAPI (serving)"] }
    ],
    recommended_stacks: [
      { name: "Pipeline Data Python",  stack: ["Prefect", "Polars", "DuckDB"] },
      { name: "ML Automation",         stack: ["Prefect", "MLflow", "scikit-learn"] },
      { name: "ETL moderne",            stack: ["Prefect", "dbt", "Snowflake"] }
    ],
    when_to_move_on: [
      { trigger: "DAGs complexes avec dépendances multi-équipes",  alternative: "Airflow" },
      { trigger: "Historique et audit strict requis",              alternative: "Airflow" },
      { trigger: "Intégration Hadoop / Spark native",              alternative: "Airflow" }
    ],
    common_mistakes: [
      "Confondre Prefect Flows et Airflow DAGs (conceptuellement différents)",
      "Ne pas utiliser les Work Pools pour la scalabilité des agents",
      "Ignorer les retries automatiques sur les tâches réseau ou API"
    ],
    enterprise_usage: { startup: 5, pme: 5, grand_groupe: 3, cloud: 5, on_prem: 3 },
    context_switch_rules: [
      { condition: "Nouveau projet Python, pas d'héritage Airflow",            recommendation: "Prefect — démarrage rapide, bonne DX, local trivial",                 action: "use" },
      { condition: "Écosystème Airflow établi dans l'équipe",                  recommendation: "Rester Airflow ou migrer progressivement — arbitrer le ROI",       action: "evaluate" },
      { condition: "Pipeline simple, déclenchement régulier",                 recommendation: "cron ou APScheduler — Prefect overhead non justifié",               action: "avoid" },
      { condition: "Observabilité fine des flows requise",                    recommendation: "Prefect Cloud ou Dagster — meilleur monitoring natif",               action: "evaluate" },
      { condition: "Budget infrastructure contraint",                         recommendation: "Prefect OSS (local) gratuit, Prefect Cloud est payant au-delà du tier", action: "evaluate" }
    ],
    recommendation: {
      stars: 4,
      label: "Recommandé pour les nouveaux projets",
      context: "meilleure DX que Airflow — choix par défaut pour l'orchestration Python"
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // LANGCHAIN
  // ─────────────────────────────────────────────────────────────────────
  {
    id: "langchain",
    name: "LangChain",
    icon: "🦜",
    category: "AI / LLM",
    language: "Python / TypeScript",
    created: "2022",
    maturity: "stable",
    popularity: "very-high",
    version: "0.3.x",
    github_repo: "langchain-ai/langchain",
    tags: ["llm", "rag", "agents", "ai", "openai", "embeddings"],
    summary: "LangChain est le framework Python de référence pour construire des applications LLM. Il fournit des abstractions pour les LLMs, les chaînes de prompts, les agents, les outils RAG (Retrieval-Augmented Generation) et les vector stores. LCEL (LangChain Expression Language) simplifie la composition.",
    use_cases: ["RAG (Retrieval-Augmented Generation)", "Agents LLM", "Chatbots d'entreprise", "Pipeline de documents", "Extraction d'informations avec LLM"],
    when_to_use: [
      "Construction d'une application RAG",
      "Agents LLM avec outils externes",
      "Chaînes de prompts complexes",
      "Prototypage rapide d'applications LLM",
      "Intégration multi-providers (OpenAI, Anthropic, Mistral…)"
    ],
    when_to_avoid: [
      "Simple appel API LLM (openai SDK suffit)",
      "Besoin de contrôle fin et de performance maximale",
      "Équipes préférant moins d'abstraction (LlamaIndex, DSPy)",
      "Production critique où la stabilité prime (API LangChain évolue vite)"
    ],
    alternatives: [
      { id: "openai-sdk",      name: "OpenAI SDK",      category: "LLM Client",    reason: "SDK officiel OpenAI — accès direct sans abstraction, plus prédictible" },
      { id: "semantic-kernel", name: "Semantic Kernel", category: "AI Framework", reason: "Framework Microsoft — intégrations enterprise (Azure, M365, C#)" }
    ],
    ratings: { performance: 3, simplicity: 3, scalability: 4, memory: 3, ecosystem: 5 },
    cheatsheet: {
      install:      "pip install langchain langchain-openai langchain-community",
      llm:          "from langchain_openai import ChatOpenAI\nllm = ChatOpenAI(model='gpt-4o-mini')",
      chain:        "chain = prompt | llm | output_parser",
      rag_vectorstore: "db = Chroma.from_documents(docs, embeddings)",
      rag_retriever: "retriever = db.as_retriever(search_kwargs={'k': 4})",
      rag_chain:    "chain = create_retrieval_chain(retriever, doc_chain)",
      prompt:       "PromptTemplate.from_template('Answer: {context}\\nQ: {question}')",
      memory:       "ConversationBufferMemory(memory_key='history')",
      agent:        "agent = create_openai_tools_agent(llm, tools, prompt)",
      stream:       "for chunk in chain.stream(input): print(chunk)"
    },
    compatibilities: {
      formats:       ["JSON", "Markdown", "PDF (via loaders)", "HTML"],
      engines:       ["OpenAI", "Anthropic", "Mistral", "Ollama (local)"],
      frameworks:    ["FastAPI", "Pydantic", "Chroma", "Pinecone", "Weaviate"],
      visualization: ["Streamlit (UI RAG)", "Gradio"]
    },
    architecture: {
      position: "AI Layer",
      diagram: [
        { step: "User Query", items: ["Question / Instruction"] },
        { step: "↓ LangChain", items: ["Retriever → Prompt → LLM → Parser"] },
        { step: "Context", items: ["Vector Store (Chroma)", "Documents", "Tools"] },
        { step: "Réponse", items: ["Texte structuré", "Action", "JSON"] }
      ]
    },
    profile_scores: { data_analyst: 5, data_engineer: 5, data_scientist: 8, backend: 7, ml_engineer: 10 },
    related: ["fastapi", "pydantic", "duckdb"],
    learning_paths: [
      { label: "ML Engineer",   steps: [{id:"openai-sdk",name:"OpenAI SDK"},{id:"langchain",name:"LangChain"},{id:"llamaindex",name:"LlamaIndex"},{id:"dspy",name:"DSPy"}] },
      { label: "Backend Dev",   steps: [{id:"fastapi",name:"FastAPI"},{id:"langchain",name:"LangChain"},{id:"pydantic",name:"Pydantic"}] },
      { label: "Data Scientist",steps: [{id:"pandas",name:"pandas"},{id:"langchain",name:"LangChain"},{id:"llamaindex",name:"LlamaIndex"}] }
    ],
    avis_terrain: "LangChain est incontournable pour les preuves de concept LLM. L'écosystème et la communauté sont énormes. Toutefois pour la production, je tends à réduire les abstractions et à revenir à des appels directs plus prévisibles, en utilisant LangChain principalement pour le RAG et les vector stores.",
    limitations: [
      "Abstractions trop nombreuses qui cachent les appels LLM réels — difficile à déboguer",
      "Breaking changes très fréquents (plusieurs par mois) — code rapidement obsolète",
      "Overhead de dépendances important (> 100 packages transitifs)",
      "Performances dégradées par les couches d'abstraction pour la production",
      "API qui évolue encore — LCEL, LangGraph, LangSmith — fragmentation",
      "Modèles de coûts LLM masqués — difficile à optimiser sans instrumentation"
    ],
    migration: {
      from: "openai SDK direct",
      title: "Migration depuis openai SDK vers LangChain",
      disclaimer: "Ces exemples couvrent les patterns de base. LangChain ajoute des couches d'abstraction qui peuvent masquer le comportement réel des LLMs. Pour la production, contrôler la version exacte — l'API change fréquemment.",
      mappings: [
        { before: "from openai import OpenAI\nclient = OpenAI()",          after: "from langchain_openai import ChatOpenAI\nllm = ChatOpenAI()" },
        { before: "client.chat.completions.create(messages=[...])",         after: "llm.invoke([HumanMessage(content='...')])" },
        { before: "# RAG manuel",                                           after: "retriever = vectorstore.as_retriever()" },
        { before: "# prompt formaté manuellement",                         after: "PromptTemplate.from_template('{context}\\n{question}')" },
        { before: "# pas de chaîne",                                       after: "chain = prompt | llm | StrOutputParser()" }
      ]
    },
    competitors: {
      direct: [
        { id: "llamaindex", name: "LlamaIndex",  reason: "Meilleur pour le RAG et l'indexation de documents" },
        { id: "dspy",       name: "DSPy",         reason: "Optimisation automatique des prompts, plus rigoureux" },
        { id: "haystack",   name: "Haystack",     reason: "Pipeline NLP/RAG enterprise-ready" }
      ],
      indirect: [
        { id: "openai-assistants", name: "OpenAI Assistants",  reason: "RAG managé côté OpenAI, sans code" },
        { id: "azure-ai",          name: "Azure AI Studio",     reason: "Plateforme RAG/agents managée" }
      ]
    },
    tradeoffs: {
      forces:    ["Intégrations LLM les plus nombreuses (OpenAI, Anthropic, Mistral, Ollama…)", "Abstractions RAG prêtes à l'emploi : loaders, splitters, embeddings, retrievers", "Communauté et documentation très actives", "LangGraph pour les agents LLM multi-étapes"],
      faiblesses: ["API change fréquemment — breaking changes entre versions mineures", "Abstraction parfois excessive — masque le comportement réel des LLMs", "Overhead non justifié pour les appels LLM simples (1 prompt, 1 réponse)"],
      compromis: ["Richesse d'intégrations et vélocité de prototypage contre instabilité des APIs", "Productivité en exploration contre contrôle limité en production"]
    },
    architecture_recommandee: [
      { cas: "RAG prototype rapide",       stack: ["Documents (PDF/Markdown)", "LangChain (loading + splitting)", "Chroma/Pinecone (vectorstore)", "LLM (OpenAI/Anthropic)", "FastAPI (API)"] },
      { cas: "Agent LLM multi-outils",    stack: ["LangGraph (orchestration agents)", "LangChain (outils + LLMs)", "Pydantic (validation I/O)", "FastAPI (exposition)"] }
    ],
    recommended_stacks: [
      { name: "RAG basique",       stack: ["LangChain", "OpenAI", "Chroma / FAISS"] },
      { name: "RAG enterprise",    stack: ["LangChain", "Azure OpenAI", "Pinecone", "FastAPI"] },
      { name: "Agent LLM",         stack: ["LangChain", "LangGraph", "OpenAI", "Redis"] }
    ],
    when_to_move_on: [
      { trigger: "Besoin de contrôle fin sur les appels LLM",          alternative: "LiteLLM + code custom" },
      { trigger: "Latence critique sur les chaînes",                   alternative: "LangGraph + optimisation manuelle" },
      { trigger: "Abstraction trop élevée pour l'équipe",              alternative: "LlamaIndex" },
      { trigger: "Production stable avec peu d'évolutions",            alternative: "Haystack" }
    ],
    common_mistakes: [
      "Utiliser LangChain sans comprendre les prompts et appels LLM sous-jacents",
      "Négliger les coûts de tokens sur des chaînes longues ou des agents multi-étapes",
      "Confondre RAG et fine-tuning (objectifs différents : contexte vs comportement)",
      "Ne pas versionner les prompts comme du code source"
    ],
    enterprise_usage: { startup: 5, pme: 4, grand_groupe: 3, cloud: 5, on_prem: 3 },
    context_switch_rules: [
      { condition: "Simple appel LLM, prompt direct",                         recommendation: "OpenAI SDK ou httpx — LangChain overhead non justifié",               action: "avoid" },
      { condition: "Prototype RAG rapide",                                    recommendation: "LangChain — intégrations nombreuses, communauté active",              action: "use" },
      { condition: "RAG production avec contrôle fin et stabilité",           recommendation: "LlamaIndex ou implémentation directe — plus prédictible",            action: "evaluate" },
      { condition: "Pipeline LLM critique, versions fixées",                  recommendation: "Contrôler strictement la version LangChain — API instable",          action: "evaluate" },
      { condition: "Agent LLM multi-outils",                                  recommendation: "LangGraph (LangChain) ou DSPy selon la complexité des agents",      action: "use" }
    ],
    recommendation: {
      stars: 3,
      label: "Acceptable pour le prototypage",
      context: "attention aux breaking changes fréquents — envisager LlamaIndex ou DSPy en production"
    }
  },

  // ─────────────────────────────────────────────────────────────────────
  // SQLMODEL
  // ─────────────────────────────────────────────────────────────────────
  {
    id: "sqlmodel",
    name: "SQLModel",
    icon: "🗄️",
    category: "Backend / ORM",
    language: "Python",
    created: "2021",
    maturity: "stable",
    popularity: "medium",
    version: "0.0.x",
    github_repo: "tiangolo/sqlmodel",
    tags: ["orm", "sql", "pydantic", "fastapi", "database"],
    summary: "SQLModel est un ORM Python construit sur SQLAlchemy et Pydantic, conçu par le créateur de FastAPI. Il permet de définir les modèles de base de données et les schémas d'API en une seule classe, éliminant la duplication entre SQLAlchemy models et Pydantic schemas.",
    use_cases: ["ORM + validation en une seule classe", "Backend FastAPI avec base de données", "API avec modèles de données typés", "CRUD simplifié"],
    when_to_use: [
      "Projet FastAPI avec base de données relationnelle",
      "Vouloir fusionner SQLAlchemy et Pydantic en une classe",
      "CRUD simple sans logique ORM complexe",
      "Prototypage rapide d'API avec DB"
    ],
    when_to_avoid: [
      "ORM complexe avec héritage, événements, plugins (SQLAlchemy pur)",
      "ORM Django (admin intégré)",
      "Projets sans FastAPI dans le stack"
    ],
    alternatives: [
      { id: "peewee",    name: "Peewee",    category: "ORM",       reason: "ORM Python minimaliste — moins de magie, apprentissage rapide" },
      { id: "databases", name: "databases", category: "ORM async", reason: "Requêtes SQL async légères pour Python — sans overhead ORM complet" }
    ],
    ratings: { performance: 4, simplicity: 5, scalability: 3, memory: 4, ecosystem: 3 },
    cheatsheet: {
      install:      "pip install sqlmodel",
      model:        "class Hero(SQLModel, table=True):\n    id: int | None = Field(default=None, primary_key=True)\n    name: str\n    secret_name: str",
      engine:       "engine = create_engine('sqlite:///db.db')",
      create_tables:"SQLModel.metadata.create_all(engine)",
      session:      "with Session(engine) as session:",
      insert:       "session.add(hero)\nsession.commit()",
      select_all:   "session.exec(select(Hero)).all()",
      select_where: "session.exec(select(Hero).where(Hero.name == 'Deadpond')).first()",
      update:       "hero.name = 'New'\nsession.add(hero)\nsession.commit()",
      fastapi_dep:  "def get_session():\n    with Session(engine) as session:\n        yield session"
    },
    compatibilities: {
      formats:       ["JSON", "SQL DDL (migrations Alembic)", "CSV (import)"],
      engines:       ["PostgreSQL", "SQLite", "MySQL", "SQLAlchemy"],
      frameworks:    ["FastAPI", "Pydantic", "Alembic (migrations)", "Docker"],
      visualization: ["Swagger UI (via FastAPI)"]
    },
    architecture: {
      position: "Data Layer",
      diagram: [
        { step: "FastAPI Endpoint", items: ["Request → Pydantic validation"] },
        { step: "↓ SQLModel", items: ["Model → Session → SQL Query"] },
        { step: "Base de données", items: ["PostgreSQL", "SQLite", "MySQL"] },
        { step: "Réponse", items: ["Model → JSON auto-serialisé"] }
      ]
    },
    profile_scores: { data_analyst: 2, data_engineer: 4, data_scientist: 3, backend: 9, ml_engineer: 4 },
    related: ["fastapi", "pydantic", "sqlalchemy"],
    learning_paths: [
      { label: "Backend Dev",  steps: [{id:"sqlite",name:"SQLite"},{id:"sqlalchemy",name:"SQLAlchemy"},{id:"sqlmodel",name:"SQLModel"},{id:"fastapi",name:"FastAPI"}] },
      { label: "Data Engineer",steps: [{id:"pandas",name:"pandas"},{id:"sqlalchemy",name:"SQLAlchemy"},{id:"sqlmodel",name:"SQLModel"}] },
      { label: "ML Engineer",  steps: [{id:"fastapi",name:"FastAPI"},{id:"sqlmodel",name:"SQLModel"},{id:"pydantic",name:"Pydantic"}] }
    ],
    avis_terrain: "SQLModel est élégant pour les projets FastAPI simples à moyens. La fusion Pydantic + SQLAlchemy en une seule classe est un vrai gain. Pour des ORM plus complexes avec héritage ou des patterns avancés, SQLAlchemy core reste plus adapté.",
    limitations: [
      "Encore en version 0.0.x — pas encore officiellement v1.0",
      "Moins de fonctionnalités avancées que SQLAlchemy pur (héritage, events, plugins)",
      "Documentation communautaire limitée comparée à SQLAlchemy",
      "Peu adapté aux grands projets ORM avec des schémas complexes",
      "Migrations Alembic moins fluides qu'avec SQLAlchemy pur"
    ],
    migration: {
      from: "SQLAlchemy + Pydantic",
      title: "Migration depuis SQLAlchemy + Pydantic séparés",
      disclaimer: "Ces exemples couvrent les cas simples. SQLModel ne supporte pas encore toutes les fonctionnalités SQLAlchemy (multi-héritage de table, composite FK, certains événements ORM). Tester les migrations Alembic avant de migrer un projet existant.",
      mappings: [
        { before: "class HeroBase(BaseModel):\n    name: str\nclass HeroDB(Base):\n    name = Column(String)", after: "class Hero(SQLModel, table=True):\n    name: str" },
        { before: "Session(engine).add(HeroDB(**data.dict()))",  after: "session.add(Hero(**data.model_dump()))" },
        { before: "session.query(HeroDB).filter(...)",           after: "session.exec(select(Hero).where(...))" },
        { before: "HeroBase.from_orm(db_hero)",                  after: "hero  # même objet" }
      ]
    },
    competitors: {
      direct: [
        { id: "sqlalchemy",  name: "SQLAlchemy",   reason: "Plus mature, plus flexible, fonctionnalités avancées" },
        { id: "tortoise",    name: "Tortoise ORM", reason: "ORM async natif Python, bonne DX" }
      ],
      indirect: [
        { id: "prisma",   name: "Prisma (Python)",  reason: "Type-safe, génération de code, moderne" },
        { id: "django-orm",name: "Django ORM",      reason: "ORM full-stack avec admin intégré" }
      ]
    },
    tradeoffs: {
      forces:    ["Une seule classe Python pour Pydantic + SQLAlchemy — moins de code dupliqué", "Intégration native FastAPI — modèles DB réutilisés directement comme schémas", "Typage Python complet sur les modèles DB", "API intuitive pour les cas CRUD simples"],
      faiblesses: ["Pas encore v1.0 — API peut évoluer entre versions", "Fonctionnalités SQLAlchemy avancées partiellement supportées", "Migrations Alembic moins maîtrisables qu'avec SQLAlchemy pur", "Communauté plus petite, moins de ressources tierces"],
      compromis: ["Moins de code (DX optimale FastAPI) contre limitations sur les projets ORM complexes", "Simplicité du CRUD contre risques sur les projets long terme ou à fort héritage"]
    },
    architecture_recommandee: [
      { cas: "API CRUD FastAPI + base relationnelle", stack: ["PostgreSQL", "SQLModel (modèles + ORM)", "FastAPI (routes)", "Pydantic (validation I/O)", "Swagger UI (doc auto)"] },
      { cas: "Prototype rapide API + SQLite",         stack: ["SQLite (DB locale)", "SQLModel (ORM)", "FastAPI (CRUD)", "Tests pytest"] }
    ],
    recommended_stacks: [
      { name: "API Full Stack",      stack: ["FastAPI", "SQLModel", "PostgreSQL", "Alembic"] },
      { name: "Prototype rapide",    stack: ["FastAPI", "SQLModel", "SQLite"] },
      { name: "Microservice Data",   stack: ["FastAPI", "SQLModel", "Redis", "PostgreSQL"] }
    ],
    when_to_move_on: [
      { trigger: "ORM complexe avec héritage multiple",             alternative: "SQLAlchemy seul" },
      { trigger: "Base de données NoSQL",                           alternative: "Beanie (MongoDB)" },
      { trigger: "Performances ORM critiques (ex. INSERT massif)", alternative: "SQLAlchemy Core" },
      { trigger: "Framework non-FastAPI",                           alternative: "SQLAlchemy + Pydantic séparés" }
    ],
    common_mistakes: [
      "Mélanger SQLModel et SQLAlchemy sans comprendre l'héritage de classe",
      "Ignorer les sessions async (nécessite aiosqlite ou asyncpg selon la DB)",
      "Ne pas utiliser Alembic pour les migrations de schéma en production"
    ],
    enterprise_usage: { startup: 5, pme: 4, grand_groupe: 3, cloud: 4, on_prem: 4 },
    context_switch_rules: [
      { condition: "Projet FastAPI CRUD simple avec base de données",          recommendation: "SQLModel — fusion élégante Pydantic + SQLAlchemy",                    action: "use" },
      { condition: "ORM complexe (héritage, événements, plugins)",             recommendation: "SQLAlchemy pur — plus flexible et mieux documenté",                  action: "avoid" },
      { condition: "Application sans FastAPI dans le stack",                  recommendation: "SQLAlchemy ou Tortoise ORM — plus adaptés hors écosystème FastAPI", action: "avoid" },
      { condition: "Schéma complexe, migrations fines",                        recommendation: "SQLAlchemy + Alembic — meilleur contrôle des migrations",             action: "avoid" },
      { condition: "Prototypage rapide API + DB",                             recommendation: "SQLModel — optimal pour ce cas, moins de boilerplate",               action: "use" }
    ],
    recommendation: {
      stars: 3,
      label: "Acceptable pour les projets FastAPI simples",
      context: "pas encore v1.0 — SQLAlchemy reste le choix pour les projets complexes"
    }
  }

]; // end TOOLS_KB

// ─── Helpers ────────────────────────────────────────────────────────────
function getToolById(id) {
  return TOOLS_KB.find(t => t.id === id) || null;
}

function getToolsByTag(tag) {
  return TOOLS_KB.filter(t => t.tags.includes(tag));
}

function getToolsByCategory(cat) {
  return TOOLS_KB.filter(t => t.category.toLowerCase().includes(cat.toLowerCase()));
}

function getAllTags() {
  const tags = new Set();
  TOOLS_KB.forEach(t => t.tags.forEach(tag => tags.add(tag)));
  return [...tags].sort();
}

function getAllCategories() {
  return [...new Set(TOOLS_KB.map(t => t.category))].sort();
}

function searchTools(query) {
  const q = query.toLowerCase().trim();
  if (!q) return TOOLS_KB;
  return TOOLS_KB.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.summary.toLowerCase().includes(q) ||
    t.tags.some(tag => tag.includes(q)) ||
    t.category.toLowerCase().includes(q) ||
    t.use_cases.some(uc => uc.toLowerCase().includes(q))
  );
}

function renderStars(count, max = 5) {
  let out = '';
  for (let i = 1; i <= max; i++) {
    out += i <= count
      ? '<span class="star star-filled">★</span>'
      : '<span class="star star-empty">☆</span>';
  }
  return out;
}

function maturityBadge(m) {
  const map = {
    experimental: { label: 'Expérimental', cls: 'badge-warning' },
    stable:       { label: 'Stable',       cls: 'badge-success' },
    mature:       { label: 'Mature',       cls: 'badge-info' },
    legacy:       { label: 'Legacy',       cls: 'badge-muted' }
  };
  const b = map[m] || { label: m, cls: 'badge-muted' };
  return `<span class="badge ${b.cls}">${b.label}</span>`;
}

function popularityBadge(p) {
  const map = {
    low:       { label: 'Faible',     cls: 'badge-muted' },
    medium:    { label: 'Moyenne',    cls: 'badge-info' },
    high:      { label: 'Populaire',  cls: 'badge-success' },
    'very-high':{ label: '🔥 Très populaire', cls: 'badge-critical' }
  };
  const b = map[p] || { label: p, cls: 'badge-muted' };
  return `<span class="badge ${b.cls}">${b.label}</span>`;
}

function profileBar(score, max = 10) {
  const pct = (score / max) * 100;
  const cls = score >= 8 ? 'profile-bar-high' : score >= 5 ? 'profile-bar-mid' : 'profile-bar-low';
  return `<div class="profile-bar-wrap">
    <div class="profile-bar ${cls}" style="width:${pct}%"></div>
  </div>`;
}
