# 🔭 Tech Watch

> Plateforme de veille technologique automatisée · Data Engineering · IA · Rust · Cloud

[![Pipeline](https://github.com/sleipnir-ad-sys/tech-watch/actions/workflows/daily_pipeline.yml/badge.svg)](https://github.com/sleipnir-ad-sys/tech-watch/actions/workflows/daily_pipeline.yml)
[![Python](https://img.shields.io/badge/Python-3.12+-blue?logo=python)](https://python.org)
[![Polars](https://img.shields.io/badge/Polars-ETL-orange)](https://pola.rs)
[![DuckDB](https://img.shields.io/badge/DuckDB-analytics-yellow)](https://duckdb.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-API-green)](https://fastapi.tiangolo.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey)](LICENSE)

**Tech Watch** est une plateforme Python qui collecte automatiquement les dernières releases et actualités tech (GitHub, RSS, PyPI), les analyse avec Polars + DuckDB, calcule un score d'impact, détecte les tendances et expose les résultats sur un dashboard GitHub Pages.

→ **[Voir le dashboard live](https://sleipnir-ad-sys.github.io/tech-watch/)**

---

## ✨ Fonctionnalités

| Fonctionnalité | Description |
|---|---|
| 📡 **Collecte multi-sources** | GitHub Releases, flux RSS, packages PyPI |
| 🔄 **Pipeline Polars** | Transformation, nettoyage, normalisation |
| 🦆 **DuckDB analytics** | Stockage local, requêtes analytiques |
| ⚡ **Scoring d'impact** | Score pondéré : version majeure, breaking change, fréquence |
| 📈 **Détection de tendances** | Fenêtre glissante 30 jours, direction RISING/STABLE/DECLINING |
| 📝 **Résumés automatiques** | Templates structurés sans LLM |
| 🌐 **FastAPI REST** | Endpoints `/releases`, `/trends`, `/impact`, `/stats` |
| 📊 **Dashboard GitHub Pages** | HTML/CSS/JS natif, responsive, dark mode |
| ⏰ **Scheduler quotidien** | APScheduler ou GitHub Actions cron |

---

## 🏗️ Architecture

```
tech-watch/
│
├── collectors/               # Collecte de données
│   ├── github_collector.py   # API GitHub Releases
│   ├── rss_collector.py      # Flux RSS/Atom (feedparser)
│   ├── pypi_collector.py     # Packages PyPI
│   └── registry.py           # Orchestrateur des collectors
│
├── pipeline/                 # ETL Polars + DuckDB
│   ├── transform.py          # Nettoyage, parsing semver, dédup
│   ├── scoring.py            # Score d'impact (Polars)
│   ├── trends.py             # Détection de tendances
│   ├── diff.py               # Delta entre runs
│   └── storage.py            # DuckDB + Parquet I/O
│
├── engine/                   # Règles métier + résumés
│   ├── rules.py              # RuleEngine extensible
│   ├── classifier.py         # Application des règles sur DataFrame
│   └── summarizer.py         # Génération de résumés texte
│
├── api/                      # FastAPI REST
│   └── app.py
│
├── scheduler/                # Exécution planifiée
│   └── run_daily.py          # APScheduler + entry point
│
├── scripts/                  # CLI
│   └── run_pipeline.py       # Pipeline complet
│
├── web/                      # Frontend GitHub Pages
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── data.json             # Données exportées par le pipeline
│
├── data/
│   ├── raw/                  # Données brutes (gitignored)
│   ├── processed/            # Fichiers Parquet (gitignored)
│   └── warehouse.duckdb      # Base DuckDB locale (gitignored)
│
├── .github/workflows/
│   └── daily_pipeline.yml    # GitHub Actions : pipeline + déploiement Pages
│
├── config.yaml               # Configuration centralisée
├── config.py                 # Loader Pydantic
├── models.py                 # Modèles Pydantic v2 partagés
├── logger.py                 # Logger structlog
├── pyproject.toml
└── requirements.txt
```

---

## 🚀 Démarrage rapide

### Prérequis

- Python 3.12+
- [uv](https://github.com/astral-sh/uv) (recommandé) ou pip

### Installation

```bash
# Cloner le repo
git clone https://github.com/sleipnir-ad-sys/tech-watch.git
cd tech-watch

# Installer les dépendances (avec uv)
uv venv && source .venv/bin/activate   # Linux/Mac
uv venv && .venv\Scripts\activate      # Windows
uv pip install -r requirements.txt

# Ou avec pip
pip install -r requirements.txt
```

### Configuration

```bash
# (Optionnel) Configurer le token GitHub pour éviter le rate-limit
cp .env.example .env
# Éditer .env et renseigner GITHUB_TOKEN=ghp_...
```

Personnaliser les sources dans `config.yaml` :

```yaml
github:
  repos:
    - owner: "pola-rs"
      repo: "polars"
      category: "data-engineering"
      weight: 1.5
```

### Lancer le pipeline

```bash
# Pipeline complet
python -m scripts.run_pipeline

# Sans collecte GitHub (rate limit)
python -m scripts.run_pipeline --no-github

# Mode test sans stockage
python -m scripts.run_pipeline --dry-run
```

### Lancer l'API

```bash
uvicorn api.app:app --reload
# → http://localhost:8000/docs
```

### Voir le dashboard local

Ouvrir `web/index.html` dans un navigateur ou lancer :

```bash
python -m http.server 8080 --directory web
# → http://localhost:8080
```

---

## 📡 API Endpoints

| Endpoint | Description |
|---|---|
| `GET /` | Health check |
| `GET /releases` | Dernières releases (`?limit=20&category=data-engineering&impact=high`) |
| `GET /trends` | Tendances (`?window_days=30`) |
| `GET /impact` | Par niveau d'impact (`?level=critical`) |
| `GET /summary/{id}` | Résumé d'une release |
| `GET /stats` | Statistiques globales |

Documentation interactive : `http://localhost:8000/docs`

---

## 📊 Score d'Impact

Le score est calculé selon la formule :

```
score = (major×10 + minor×3 + patch×0.5 + breaking×8 + frequency×2) × repo_weight
```

| Niveau | Score |
|---|---|
| 🔴 Critical | ≥ 20 |
| 🟠 High | ≥ 12 |
| 🟡 Medium | ≥ 5 |
| 🟢 Low | > 0 |

Le **RuleEngine** (`engine/rules.py`) applique des règles supplémentaires :
- Force `CRITICAL` si version majeure + breaking change
- Boost `+2` pour les projets data-engineering / lakehouse
- Détection des mots clés de sécurité (CVE, RCE, etc.)
- Détection des releases LTS

---

## ⚙️ GitHub Actions

Le workflow `.github/workflows/daily_pipeline.yml` :

1. Se déclenche chaque jour à 07:00 UTC
2. Installe les dépendances avec `uv`
3. Exécute le pipeline complet
4. Commit `web/data.json` mis à jour
5. Déploie le dossier `web/` sur GitHub Pages

**Configuration requise :**
- Activer **GitHub Pages** sur `Settings > Pages > Source: GitHub Actions`
- Le `GITHUB_TOKEN` automatique suffit (pas de secret additionnel nécessaire)

Pour un accès GitHub plus élevé (éviter rate-limit) :
- Créer un **Personal Access Token** (lecture seule)
- L'ajouter en secret : `Settings > Secrets > GITHUB_TOKEN_PAT`

---

## 🔌 Étendre le projet

### Ajouter un collector

```python
# collectors/my_collector.py
from models import RawRelease

class MyCollector:
    def collect_all(self) -> list[RawRelease]:
        ...
```

Puis l'enregistrer dans `collectors/registry.py`.

### Ajouter une règle d'impact

```python
# engine/rules.py
class MyCustomRule(BaseRule):
    name = "my_rule"

    def evaluate(self, ctx: RuleContext) -> RuleResult:
        if "important_keyword" in ctx.body_excerpt:
            return RuleResult(score_delta=5.0, reason="Mot clé détecté")
        return RuleResult()
```

### Évolution vers LLM (prévu)

L'architecture `engine/summarizer.py` est préparée pour substituer le générateur de résumés par un LLM :

```python
# Futur : injecter un backend LLM
summarizer = LLMSummarizer(model="gpt-4o-mini")
summary = summarizer.generate(release)
```

---

## 🗺️ Roadmap

- [ ] Résumés LLM (OpenAI / Ollama local)
- [ ] Notifications Discord / Slack
- [ ] Dashboard React (recharts)
- [ ] Scoring ML (features engineered → XGBoost)
- [ ] Agent IA de veille autonome
- [ ] Support GitLab + npm registry
- [ ] Export newsletter hebdomadaire

---

## 🛠️ Stack Technique

| Couche | Technologie |
|---|---|
| Runtime | Python 3.12+ |
| ETL | [Polars](https://pola.rs) |
| Analytics | [DuckDB](https://duckdb.org) |
| API | [FastAPI](https://fastapi.tiangolo.com) + Uvicorn |
| Validation | [Pydantic v2](https://docs.pydantic.dev) |
| HTTP | requests + httpx |
| RSS | feedparser |
| Sérialisation | PyArrow + Parquet |
| Scheduler | APScheduler |
| Logs | structlog |
| CLI | Rich |
| Linting | Ruff |
| CI/CD | GitHub Actions |
| Frontend | HTML + CSS + JS vanilla |
| Hébergement | GitHub Pages |

---

## 📄 Licence

MIT — voir [LICENSE](LICENSE)

---

<p align="center">
  Construit avec Python · Polars · DuckDB · FastAPI
</p>
