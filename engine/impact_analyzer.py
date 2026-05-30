"""
Impact Analyzer — moteur d'analyse sémantique des changelogs.

Remplace l'approche basée sur les numéros de version par une analyse
du contenu réel des release notes pour calculer un score d'impact.

Architecture :
    ChangelogAnalyzer  → détecte les catégories dans le texte via regex
    ProfileEngine      → calcule la pertinence selon les profils utilisateur
    ImpactScoreEngine  → orchestre l'analyse complète (LLM-ready)

LLM-ready :
    L'interface de ImpactScoreEngine est stable. Pour intégrer un LLM,
    créer une sous-classe et surcharger la méthode `analyze()` sans
    modifier ni le modèle de données ni les consommateurs.
"""

from __future__ import annotations

import json
import re
from datetime import datetime

import polars as pl

from config import load_config
from logger import get_logger
from models import (
    ActionRecommended,
    ChangelogCategory,
    DetectedFactor,
    ImpactLevel,
    ReleaseImpactScore,
    UrgencyLevel,
)

logger = get_logger(__name__)


# ── Patterns de détection par catégorie ──────────────────────────────────────
# Chaque catégorie possède une liste de patterns compilés.
# L'analyse se fait ligne par ligne : une ligne qui matche AU MOINS UN pattern
# est comptée une seule fois pour cette catégorie.

_DETECTION_PATTERNS: dict[ChangelogCategory, list[re.Pattern[str]]] = {
    ChangelogCategory.SECURITY: [
        re.compile(r"\bsecurity\b", re.IGNORECASE),
        re.compile(r"\bCVE-\d{4}-\d+\b"),
        re.compile(r"\bvulnerabilit\w*\b", re.IGNORECASE),
        re.compile(r"\bexploit\b", re.IGNORECASE),
        re.compile(r"\bRCE\b"),
        re.compile(r"\binjection\b", re.IGNORECASE),
        re.compile(r"\bXSS\b"),
        re.compile(r"\bCSRF\b"),
        re.compile(r"\bsandbox\s+escape\b", re.IGNORECASE),
        re.compile(r"\bpath\s+traversal\b", re.IGNORECASE),
        re.compile(r"\bauth\w*\s+bypass\b", re.IGNORECASE),
        re.compile(r"\bsécurité\b", re.IGNORECASE),
        re.compile(r"\bfaille\b", re.IGNORECASE),
    ],
    ChangelogCategory.BREAKING_CHANGE: [
        re.compile(r"BREAKING[\s_\-]?CHANGE", re.IGNORECASE),
        re.compile(r"BREAKING:", re.IGNORECASE),
        re.compile(r"\[breaking\]", re.IGNORECASE),
        re.compile(r"breaking\s+change", re.IGNORECASE),
        re.compile(r"incompatible\s+change", re.IGNORECASE),
        re.compile(r"\*\*breaking\*\*", re.IGNORECASE),
        re.compile(r"⚠\s*breaking", re.IGNORECASE),
        re.compile(r"rupture\s+de\s+compatibilit", re.IGNORECASE),
    ],
    ChangelogCategory.DEPRECATED: [
        re.compile(r"\bdeprecated?\b", re.IGNORECASE),
        re.compile(r"\bDEPRECATED\b"),
        re.compile(r"will\s+be\s+removed\s+in", re.IGNORECASE),
        re.compile(r"marked\s+as\s+deprecated", re.IGNORECASE),
        re.compile(r"\bdépréci\w+\b", re.IGNORECASE),
    ],
    ChangelogCategory.REMOVED: [
        re.compile(r"\bremoved?\b", re.IGNORECASE),
        re.compile(r"REMOVED:", re.IGNORECASE),
        re.compile(r"was\s+removed", re.IGNORECASE),
        re.compile(r"dropped\s+support", re.IGNORECASE),
        re.compile(r"drop\s+support\s+for", re.IGNORECASE),
        re.compile(r"\bsupprim\w+\b", re.IGNORECASE),
    ],
    ChangelogCategory.MIGRATION: [
        re.compile(r"\bmigrat\w+\b", re.IGNORECASE),
        re.compile(r"upgrade\s+guide", re.IGNORECASE),
        re.compile(r"migration\s+required", re.IGNORECASE),
        re.compile(r"how\s+to\s+migrate", re.IGNORECASE),
        re.compile(r"migration\s+path", re.IGNORECASE),
        re.compile(r"migration\s+guide", re.IGNORECASE),
        re.compile(r"guide\s+de\s+migration", re.IGNORECASE),
    ],
    ChangelogCategory.PERFORMANCE: [
        re.compile(r"\bperformance\b", re.IGNORECASE),
        re.compile(r"\boptimiz\w+\b", re.IGNORECASE),
        re.compile(r"\boptimis\w+\b", re.IGNORECASE),
        re.compile(r"\bmemory\s+(?:usage|leak|reduction|improvement)\b", re.IGNORECASE),
        re.compile(r"\bfaster\b", re.IGNORECASE),
        re.compile(r"\bspeedup\b", re.IGNORECASE),
        re.compile(r"\bthroughput\b", re.IGNORECASE),
        re.compile(r"\blatency\b", re.IGNORECASE),
        re.compile(r"\b\d+[×xX]\s*(?:faster|speedup)\b", re.IGNORECASE),
        re.compile(r"\bimproved?\s+performance\b", re.IGNORECASE),
        re.compile(r"\breduced?\s+memory\b", re.IGNORECASE),
        re.compile(r"\bperfs?\b", re.IGNORECASE),
    ],
    ChangelogCategory.ENHANCEMENT: [
        re.compile(r"\benhancements?\b", re.IGNORECASE),   # plural fix: matches both
        re.compile(r"\bfeatures?\b", re.IGNORECASE),        # plural fix: New Features section header
        re.compile(r"\bnew\s+features?\b", re.IGNORECASE),
        re.compile(r"\badded?\s+support\s+for\b", re.IGNORECASE),
        re.compile(r"^[-*•]\s*[Aa]dd\b", re.MULTILINE),
        re.compile(r"^[-*•]\s*[Nn]ew\b", re.MULTILINE),
        re.compile(r"\bintroduc\w+\b", re.IGNORECASE),
        re.compile(r"\bimplement\w*\b", re.IGNORECASE),
        re.compile(r"\bfeat(?:ure)?(?:\(|\b)", re.IGNORECASE),
        re.compile(r"\bnouvel(?:le)?\b", re.IGNORECASE),
        re.compile(r"\bajout\w*\b", re.IGNORECASE),
    ],
    ChangelogCategory.BUG_FIX: [
        re.compile(r"\bbug\s*fix\b", re.IGNORECASE),
        re.compile(r"\bbugfix\b", re.IGNORECASE),
        re.compile(r"^[-*•]\s*[Ff]ix\b", re.MULTILINE),
        re.compile(r"\bfixed?\s+\w+", re.IGNORECASE),
        re.compile(r"\bfixes\b", re.IGNORECASE),
        re.compile(r"\bpatch(?:ed)?\b", re.IGNORECASE),
        re.compile(r"\bregression\b", re.IGNORECASE),
        re.compile(r"\bresolve[sd]?\b", re.IGNORECASE),
        re.compile(r"\bcorrect(?:ed|ion)?\b", re.IGNORECASE),
        re.compile(r"\bcorrection\b", re.IGNORECASE),
    ],
    ChangelogCategory.DOCUMENTATION: [
        re.compile(r"\bdocumentation\b", re.IGNORECASE),
        re.compile(r"\bdocs?\b", re.IGNORECASE),
        re.compile(r"\bREADME\b"),
        re.compile(r"\bdocstring\b", re.IGNORECASE),
        re.compile(r"\bchangelog\b", re.IGNORECASE),
        re.compile(r"\btypehint\b", re.IGNORECASE),
        re.compile(r"\bdocumentation\b", re.IGNORECASE),
    ],
}


def _analyze_lines(
    text: str,
    patterns: list[re.Pattern[str]],
) -> tuple[int, list[str]]:
    """
    Analyse le texte ligne par ligne et compte les lignes distinctes
    qui matchent au moins un des patterns.

    Returns:
        (nombre de lignes matchées, extraits — max 5)
    """
    lines = text.splitlines()
    matched: list[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        for pat in patterns:
            if pat.search(stripped):
                excerpt = stripped[:200]
                if excerpt not in matched:
                    matched.append(excerpt)
                break  # une seule correspondance par ligne suffit

    return len(matched), matched[:5]


# ── Mapping score → ImpactLevel ──────────────────────────────────────────────

def score_to_impact_level(score: float) -> ImpactLevel:
    """
    Mappe un score final (0–100) vers un ImpactLevel.

    Classification purement basée sur le score — indépendante du type de facteurs.
    L'urgence métier est calculée séparément via determine_urgency().

    Seuils :
        > 80  → CRITICAL
        > 50  → HIGH
        > 20  → MODERATE
        ≤ 20  → LOW
    """
    if score > 80:
        return ImpactLevel.CRITICAL
    elif score > 50:
        return ImpactLevel.HIGH
    elif score > 20:
        return ImpactLevel.MODERATE
    else:
        return ImpactLevel.LOW


# ── Urgence métier (indépendante du score) ────────────────────────────────────

def determine_urgency(factors: list[DetectedFactor]) -> UrgencyLevel:
    """
    Détermine l'urgence d'une release indépendamment du score technique.

    Basée UNIQUEMENT sur la criticité métier des facteurs détectés :
        URGENT  → Sécurité / CVE (action immédiate, indépendamment du score)
        HIGH    → Breaking change (rupture de compatibilité)
        MEDIUM  → Migration requise
        LOW     → Tout le reste (performance, enhancement, bug_fix, docs)

    L'urgence NE DÉPEND PAS du score. Une release avec beaucoup d'enhancements
    peut avoir un impact CRITICAL mais une urgence LOW.
    """
    cats = {f.category for f in factors}
    if ChangelogCategory.SECURITY in cats:
        return UrgencyLevel.URGENT
    if ChangelogCategory.BREAKING_CHANGE in cats:
        return UrgencyLevel.HIGH
    if ChangelogCategory.MIGRATION in cats:
        return UrgencyLevel.MEDIUM
    return UrgencyLevel.LOW


# ── Action recommandée ────────────────────────────────────────────────────────

def determine_action(
    factors: list[DetectedFactor],
    impact_level: ImpactLevel,
    urgency_level: UrgencyLevel,
) -> tuple[ActionRecommended, list[str]]:
    """
    Détermine l'action recommandée à partir de l'impact + l'urgence.

    Règles (par priorité) :
        1. Urgence URGENT (sécurité)       → METTRE À JOUR IMMÉDIATEMENT
        2. Breaking change détecté          → PLANIFIER MIGRATION
        3. Impact HIGH ou CRITICAL           → METTRE À JOUR (prochain cycle)
        4. Aucun facteur / Impact LOW        → IGNORER
        5. Sinon (MODERATE)                  → SURVEILLER

    Returns:
        (ActionRecommended, liste de raisons textuelles)
    """
    cats = {f.category for f in factors}
    reasons: list[str] = []

    def _factor(cat: ChangelogCategory) -> DetectedFactor | None:
        return next((f for f in factors if f.category == cat), None)

    # 1. Urgence URGENT (sécurité) → mise à jour immédiate
    if urgency_level == UrgencyLevel.URGENT:
        sec = _factor(ChangelogCategory.SECURITY)
        if sec:
            reasons.append(f"Faille de sécurité détectée ({sec.count} occurrence(s))")
            for s in sec.snippets[:2]:
                reasons.append(f"  → {s[:120]}")
        reasons.append("Action immédiate requise — ne pas attendre le prochain cycle")
        return ActionRecommended.UPGRADE_IMMEDIATELY, reasons

    # 2. Breaking change → planifier migration
    if ChangelogCategory.BREAKING_CHANGE in cats:
        bc = _factor(ChangelogCategory.BREAKING_CHANGE)
        if bc:
            reasons.append(f"{bc.count} rupture(s) de compatibilité détectée(s)")
        mig = _factor(ChangelogCategory.MIGRATION)
        if mig:
            reasons.append("Guide de migration présent")
        rm = _factor(ChangelogCategory.REMOVED)
        if rm:
            reasons.append(f"{rm.count} fonctionnalité(s) supprimée(s)")
        reasons.append("Pas de faille de sécurité détectée")
        return ActionRecommended.PLAN_MIGRATION, reasons

    # 3. Impact HIGH ou CRITICAL → prochain cycle de mise à jour
    if impact_level in (ImpactLevel.HIGH, ImpactLevel.CRITICAL):
        perf = _factor(ChangelogCategory.PERFORMANCE)
        dep = _factor(ChangelogCategory.DEPRECATED)
        enh = _factor(ChangelogCategory.ENHANCEMENT)
        bf = _factor(ChangelogCategory.BUG_FIX)
        mig = _factor(ChangelogCategory.MIGRATION)
        if perf:
            reasons.append(f"{perf.count} amélioration(s) de performance")
        if dep:
            reasons.append(f"{dep.count} dépréciation(s) — planifier avant suppression")
        if enh:
            reasons.append(f"{enh.count} amélioration(s) / nouvelle(s) fonctionnalité(s)")
        if bf:
            reasons.append(f"{bf.count} correction(s) de bug(s)")
        if mig:
            reasons.append("Migration recommandée")
        reasons.append(f"Impact {impact_level.value} — intégrer au prochain cycle de mise à jour")
        return ActionRecommended.MONITOR_UPDATE, reasons

    # 4. Aucun facteur ou impact LOW → ignorer
    if not factors or impact_level == ImpactLevel.LOW:
        reasons.append("Impact faible — pas d'action requise")
        return ActionRecommended.IGNORE, reasons

    # 5. MODERATE avec facteurs → surveiller
    for f in factors[:3]:
        reasons.append(f"{f.count} {f.category.value.replace('_', ' ')}(s)")
    reasons.append("Changements non critiques — surveillance recommandée")
    return ActionRecommended.MONITOR, reasons


# ── API publique pure ─────────────────────────────────────────────────────────

def compute_impact(changelog: str, relevance: float = 0.0) -> dict:
    """
    Fonction pure pour analyser l'impact d'un changelog.

    Système de scoring déterministe et borné :
    - technical_score = min(100, somme des points par catégorie)
    - final_score     = min(100, technical × 0.7 + relevance × 3)
    - Impact          = classifié sur final_score (0–100)
    - Urgence         = basée uniquement sur la criticité métier des facteurs
    - Action          = dérivée de Impact + Urgence

    Args:
        changelog: Texte du changelog / release notes
        relevance: Score de pertinence du projet (0.0–10.0, défaut 0.0)

    Returns:
        dict avec keys :
            classification  — "LOW" | "MODERATE" | "HIGH" | "CRITICAL"
            score           — score technique borné (0–100)
            final_score     — score final borné (0–100)
            urgency         — "URGENT" | "HIGH" | "MEDIUM" | "LOW"
            factors         — liste de dicts {category, count, score_contribution}
            action          — valeur de l'ActionRecommended enum
            reasons         — liste de raisons textuelles
    """
    analyzer = ChangelogAnalyzer()
    factors, technical_score = analyzer.analyze(changelog)

    final_score = round(min(100.0, (technical_score * 0.7) + (relevance * 3.0)), 2)
    impact_level = score_to_impact_level(final_score)
    urgency_level = determine_urgency(factors)
    action, reasons = determine_action(factors, impact_level, urgency_level)

    return {
        "classification": impact_level.value.upper(),
        "score": technical_score,
        "final_score": final_score,
        "urgency": urgency_level.value,
        "factors": [
            {
                "category": f.category.value,
                "count": f.count,
                "score_contribution": f.score_contribution,
            }
            for f in factors
        ],
        "action": action.value,
        "reasons": reasons,
    }


def analyze_release(changelog: str) -> dict:
    """
    Analyse complète séparant Impact, Urgence et Action.

    Fonction principale du moteur — expose les 3 concepts indépendants :
        1. Impact  = importance technique (score + niveau)
        2. Urgence = nécessité métier d'agir (indépendant du score)
        3. Action  = décision finale (dérivée des deux précédents)

    Args:
        changelog: Texte du changelog / release notes

    Returns:
        dict avec keys :
            impact  — {"score": float, "level": str}
            urgency — {"level": str, "reason": str}
            action  — {"recommendation": str, "reasons": list[str]}
            factors — list[dict]
    """
    analyzer = ChangelogAnalyzer()
    factors, technical_score = analyzer.analyze(changelog)

    impact_level = score_to_impact_level(technical_score)
    urgency_level = determine_urgency(factors)
    action, reasons = determine_action(factors, impact_level, urgency_level)

    urgency_reason_map = {
        UrgencyLevel.URGENT: "Sécurité / CVE détecté — action immédiate requise",
        UrgencyLevel.HIGH:   "Breaking change — rupture de compatibilité",
        UrgencyLevel.MEDIUM: "Migration requise — planifier la mise à jour",
        UrgencyLevel.LOW:    "Aucun facteur d'urgence critique",
    }

    return {
        "impact": {
            "score": technical_score,
            "level": impact_level.value,
        },
        "urgency": {
            "level": urgency_level.value,
            "reason": urgency_reason_map[urgency_level],
        },
        "action": {
            "recommendation": action.value,
            "reasons": reasons,
        },
        "factors": [
            {
                "category": f.category.value,
                "count": f.count,
                "score_contribution": f.score_contribution,
            }
            for f in factors
        ],
    }


# ── ChangelogAnalyzer ─────────────────────────────────────────────────────────

class ChangelogAnalyzer:
    """
    Analyse le texte d'un changelog et détecte les catégories d'impact.

    Configurable via config.yaml (section impact_analysis.changelog_weights).
    Les poids peuvent être mis à jour sans modifier le code.

    Compatible LLM-ready : interface stable pour une future intégration LLM.
    """

    def __init__(self, weights: dict[str, float] | None = None) -> None:
        self._weights = weights if weights is not None else self._load_weights()

    @staticmethod
    def _load_weights() -> dict[str, float]:
        """Charge les pondérations depuis config.yaml."""
        try:
            cfg = load_config()
            return cfg.impact_analysis.changelog_weights.as_dict()
        except Exception:
            pass
        # Valeurs par défaut si config non disponible
        return {
            "security": 100.0,
            "breaking_change": 50.0,
            "deprecated": 30.0,
            "removed": 30.0,
            "migration": 25.0,
            "performance": 15.0,
            "enhancement": 10.0,
            "bug_fix": 5.0,
            "documentation": 1.0,
        }

    def analyze(self, text: str) -> tuple[list[DetectedFactor], float]:
        """
        Analyse le texte du changelog et retourne les facteurs détectés
        ainsi que le score technique total.

        Args:
            text: Contenu du changelog (body complet ou extrait)

        Returns:
            (liste de DetectedFactor, score technique total)
        """
        if not text or not text.strip():
            return [], 0.0

        factors: list[DetectedFactor] = []
        total_score = 0.0

        for category, patterns in _DETECTION_PATTERNS.items():
            count, snippets = _analyze_lines(text, patterns)
            if count == 0:
                continue

            weight = self._weights.get(category.value, 0.0)
            score_contribution = weight * count

            factors.append(DetectedFactor(
                category=category,
                count=count,
                score_contribution=score_contribution,
                snippets=snippets,
            ))
            total_score += score_contribution

        # Trier par contribution décroissante
        factors.sort(key=lambda f: f.score_contribution, reverse=True)

        # Le score technique est obligatoirement borné à 100.
        # score_contribution reste raw (weight × count) pour la traçabilité.
        return factors, round(min(100.0, total_score), 2)

    def reload(self) -> None:
        """Recharge les pondérations depuis la configuration (utile en dev)."""
        # Invalide le cache de lru_cache pour recharger config.yaml
        from config import load_config as _lc
        _lc.cache_clear()
        self._weights = self._load_weights()


# ── ProfileEngine ────────────────────────────────────────────────────────────

class ProfileEngine:
    """
    Calcule la pertinence d'une release selon les profils utilisateur.

    La pertinence est déterminée par la correspondance entre le nom
    du projet et les technologies répertoriées dans le profil sélectionné.
    Si plusieurs profils sont sélectionnés, le score maximal est retenu.
    """

    # Alias connus pour normaliser les noms de projets
    _ALIASES: dict[str, list[str]] = {
        "polars": ["pola_rs", "polars_rs"],
        "duckdb": ["duck_db"],
        "delta_rs": ["delta", "delta_lake"],
        "pyo3": ["pyo3_ffi"],
        "arrow": ["pyarrow", "apache_arrow"],
        "transformers": ["huggingface_transformers", "hf_transformers"],
        "langchain_core": ["langchain"],
        "scikit_learn": ["sklearn", "scikit-learn"],
        "nextjs": ["next_js", "next"],
        "ibis_framework": ["ibis"],
    }

    def __init__(self) -> None:
        self._profiles = self._load_profiles()

    def _load_profiles(self) -> dict[str, dict[str, float]]:
        """Charge les profils depuis config.yaml."""
        try:
            cfg = load_config()
            profiles = cfg.impact_analysis.profiles
            if profiles:
                return {
                    profile_id: dict(p.technologies)
                    for profile_id, p in profiles.items()
                }
        except Exception:
            pass
        return self._default_profiles()

    @staticmethod
    def _default_profiles() -> dict[str, dict[str, float]]:
        """Profils par défaut si config.yaml ne contient pas la section."""
        return {
            "data_engineering": {
                "polars": 10, "duckdb": 10, "arrow": 9, "pyarrow": 9,
                "iceberg": 8, "delta_rs": 8, "delta": 8, "spark": 7,
                "pandas": 6, "ibis": 7, "dbt": 8, "datafusion": 8,
            },
            "analytics_engineering": {
                "dbt": 10, "duckdb": 9, "polars": 8, "metabase": 7,
                "lightdash": 7, "superset": 6,
            },
            "python": {
                "fastapi": 9, "pydantic": 8, "ruff": 8, "uv": 8,
                "httpx": 7, "starlette": 8, "uvicorn": 7, "pytest": 7, "mypy": 7,
            },
            "rust": {
                "tokio": 10, "axum": 9, "serde": 8, "polars": 8,
                "maturin": 8, "pyo3": 8, "delta_rs": 7,
            },
            "ai_llm": {
                "transformers": 10, "langchain": 9, "openai": 8,
                "scikit_learn": 7, "sentence_transformers": 9, "vllm": 9,
            },
            "cloud": {
                "terraform": 8, "kubernetes": 9, "docker": 8, "helm": 8,
            },
            "frontend": {
                "react": 10, "vue": 9, "svelte": 8, "typescript": 9,
                "vite": 8, "nextjs": 9, "tailwind": 7,
            },
        }

    @staticmethod
    def _normalize(name: str) -> str:
        """Normalise un nom de projet pour la comparaison."""
        return name.lower().replace("-", "_").replace(".", "_").strip()

    def get_relevance(self, project_name: str, profiles: list[str]) -> float:
        """
        Retourne le score de pertinence maximal parmi les profils sélectionnés.

        Args:
            project_name: Nom complet du projet (ex: "pola-rs/polars" ou "polars")
            profiles: Liste des identifiants de profils utilisateur

        Returns:
            Score de pertinence entre 0.0 et 10.0
        """
        # Extrait la partie après le dernier slash, puis normalise
        short = self._normalize(project_name.split("/")[-1])
        aliases = self._ALIASES.get(short, [])
        candidates = {short} | set(aliases)

        best = 0.0
        for profile_id in profiles:
            tech_map = self._profiles.get(profile_id, {})
            for tech_raw, score in tech_map.items():
                tech = self._normalize(tech_raw)
                if tech in candidates or short.startswith(tech) or tech.startswith(short):
                    best = max(best, float(score))

        return best

    def list_profiles(self) -> list[dict]:
        """Retourne la liste des profils disponibles avec leurs labels."""
        try:
            cfg = load_config()
            return [
                {
                    "id": profile_id,
                    "label": profile.label or profile_id.replace("_", " ").title(),
                    "technology_count": len(profile.technologies),
                }
                for profile_id, profile in cfg.impact_analysis.profiles.items()
            ]
        except Exception:
            return [
                {"id": k, "label": k.replace("_", " ").title(), "technology_count": len(v)}
                for k, v in self._profiles.items()
            ]

    def reload(self) -> None:
        """Recharge les profils depuis la configuration."""
        from config import load_config as _lc
        _lc.cache_clear()
        self._profiles = self._load_profiles()


# ── ImpactScoreEngine ─────────────────────────────────────────────────────────

class ImpactScoreEngine:
    """
    Orchestre l'analyse complète d'une release.

    Combine :
    1. ChangelogAnalyzer  → détection des catégories et score technique
    2. ProfileEngine      → score de pertinence par profil utilisateur
    3. Calcul du score final = technical_score × max(relevance_score, 1.0)

    LLM-ready :
        Sous-classer et surcharger `analyze()` pour intégrer un LLM.
        Le modèle de données (ReleaseImpactScore) reste stable.
    """

    def __init__(self) -> None:
        self._changelog_analyzer = ChangelogAnalyzer()
        self._profile_engine = ProfileEngine()

    def analyze(
        self,
        release_id: str,
        project_name: str,
        changelog_text: str,
        profiles: list[str] | None = None,
    ) -> ReleaseImpactScore:
        """
        Analyse complète d'une release.

        Args:
            release_id:     Identifiant unique de la release
            project_name:   Nom du projet (ex: "pola-rs/polars")
            changelog_text: Texte des release notes / changelog complet
            profiles:       Profils utilisateur sélectionnés (défaut: config)

        Returns:
            ReleaseImpactScore complet et prêt pour stockage / affichage
        """
        try:
            default_profiles = load_config().impact_analysis.default_profiles
        except Exception:
            default_profiles = ["data_engineering"]

        active_profiles = profiles if profiles else default_profiles

        # 1. Analyse sémantique du changelog (technical_score borné 0–100)
        factors, technical_score = self._changelog_analyzer.analyze(changelog_text)

        # 2. Score de pertinence (0–10)
        relevance_score = self._profile_engine.get_relevance(project_name, active_profiles)

        # 3. Score final borné à 100
        #    final_score = min(100, technical_score × 0.7 + relevance_score × 3)
        final_score = round(min(100.0, (technical_score * 0.7) + (relevance_score * 3.0)), 2)

        # 4. Impact (basé purement sur le score final, 0–100)
        impact_level = score_to_impact_level(final_score)

        # 5. Urgence (indépendante du score, basée sur la criticité métier)
        urgency_level = determine_urgency(factors)

        # 6. Action dérivée de Impact + Urgence
        action, reasons = determine_action(factors, impact_level, urgency_level)

        logger.debug(
            "impact_analyzer.analyzed",
            release_id=release_id,
            project=project_name,
            technical_score=technical_score,
            relevance_score=relevance_score,
            final_score=final_score,
            impact=impact_level.value,
            urgency=urgency_level.value,
            factors=len(factors),
            action=action.value,
        )

        return ReleaseImpactScore(
            release_id=release_id,
            technical_score=technical_score,
            relevance_score=relevance_score,
            final_score=final_score,
            impact_level=impact_level,
            urgency_level=urgency_level,
            profiles=active_profiles,
            detected_factors=factors,
            action_recommended=action,
            reasons=reasons,
        )

    def analyze_dataframe(
        self,
        df: pl.DataFrame,
        profiles: list[str] | None = None,
    ) -> pl.DataFrame:
        """
        Applique l'analyse d'impact sur tout un DataFrame Polars.

        Colonnes ajoutées / mises à jour :
            impact_score        (= technical_score, alias de compatibilité)
            impact_level        (LOW / MODERATE / HIGH / CRITICAL)
            technical_score
            relevance_score
            final_score
            detected_factors    (JSON string)
            action_recommended  (string)
            analysis_reasons    (list[str])

        Returns:
            DataFrame enrichi
        """
        if df.is_empty():
            return df

        results: list[ReleaseImpactScore] = []
        for row in df.iter_rows(named=True):
            result = self.analyze(
                release_id=row.get("id", ""),
                project_name=row.get("name", ""),
                changelog_text=row.get("body_excerpt", ""),
                profiles=profiles,
            )
            results.append(result)

        technical_scores = [r.technical_score for r in results]
        relevance_scores = [r.relevance_score for r in results]
        final_scores = [r.final_score for r in results]
        impact_levels = [r.impact_level.value for r in results]
        urgency_levels = [r.urgency_level.value for r in results]
        detected_factors_json = [
            json.dumps([f.model_dump() for f in r.detected_factors]) for r in results
        ]
        actions = [r.action_recommended.value for r in results]
        reasons_list = [r.reasons for r in results]

        df = df.with_columns([
            pl.Series("technical_score",   technical_scores,        dtype=pl.Float64),
            pl.Series("relevance_score",   relevance_scores,        dtype=pl.Float64),
            pl.Series("final_score",       final_scores,            dtype=pl.Float64),
            pl.Series("impact_score",      technical_scores,        dtype=pl.Float64),
            pl.Series("impact_level",      impact_levels,           dtype=pl.Utf8),
            pl.Series("urgency_level",     urgency_levels,          dtype=pl.Utf8),
            pl.Series("detected_factors",  detected_factors_json,   dtype=pl.Utf8),
            pl.Series("action_recommended",actions,                 dtype=pl.Utf8),
            pl.Series("analysis_reasons",  reasons_list,            dtype=pl.List(pl.Utf8)),
        ])

        counts = {}
        for lvl in ("critical", "high", "moderate", "low"):
            counts[lvl] = sum(1 for v in impact_levels if v == lvl)

        logger.info(
            "impact_analyzer.batch_done",
            total=len(df),
            **counts,
        )

        return df
