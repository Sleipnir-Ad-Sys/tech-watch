"""
Rules — ensemble de règles métier pour la classification des releases.

Les règles sont évaluées dans l'ordre et peuvent être chaînées.
Chaque règle prend un contexte de release et retourne un score additionnel
ou modifie le niveau d'impact.

Architecture extensible : ajouter une Rule en héritant de BaseRule.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from config import load_config
from models import ImpactLevel


@dataclass
class RuleContext:
    """Contexte passé à chaque règle pour évaluation."""

    name: str
    tag: str
    version_major: int | None
    version_minor: int | None
    version_patch: int | None
    has_breaking_change: bool
    body_excerpt: str
    category: str
    impact_score: float
    impact_level: str


@dataclass
class RuleResult:
    """Résultat d'une règle — peut modifier le score ou le niveau."""

    score_delta: float = 0.0
    force_level: str | None = None   # Forcer un ImpactLevel spécifique
    reason: str = ""


class BaseRule(ABC):
    """Interface de base pour toutes les règles."""

    name: str = "base"
    enabled: bool = True

    @abstractmethod
    def evaluate(self, ctx: RuleContext) -> RuleResult:
        """Évalue la règle et retourne un RuleResult."""
        ...


# ---------------------------------------------------------------------------
# Implémentations de règles
# ---------------------------------------------------------------------------


class MajorVersionRule(BaseRule):
    """Force HIGH si c'est une version majeure (x.0.0)."""

    name = "major_version"

    def evaluate(self, ctx: RuleContext) -> RuleResult:
        if (
            ctx.version_major is not None
            and ctx.version_major >= 1
            and ctx.version_minor == 0
            and ctx.version_patch == 0
        ):
            return RuleResult(
                score_delta=5.0,
                force_level=ImpactLevel.HIGH.value,
                reason=f"Version majeure {ctx.version_major}.0.0",
            )
        return RuleResult()


class BreakingChangeRule(BaseRule):
    """Force CRITICAL si breaking change + version majeure."""

    name = "breaking_critical"

    def evaluate(self, ctx: RuleContext) -> RuleResult:
        if ctx.has_breaking_change and ctx.version_major is not None and ctx.version_minor == 0:
            return RuleResult(
                score_delta=10.0,
                force_level=ImpactLevel.CRITICAL.value,
                reason="Breaking change sur version majeure",
            )
        if ctx.has_breaking_change:
            return RuleResult(
                score_delta=5.0,
                force_level=ImpactLevel.HIGH.value,
                reason="Breaking change détecté",
            )
        return RuleResult()


class DataEngineeringBoostRule(BaseRule):
    """Boost les projets de la catégorie data-engineering."""

    name = "data_engineering_boost"

    def evaluate(self, ctx: RuleContext) -> RuleResult:
        if ctx.category in ("data-engineering", "lakehouse"):
            return RuleResult(
                score_delta=2.0,
                reason=f"Boost catégorie {ctx.category}",
            )
        return RuleResult()


class SecurityKeywordRule(BaseRule):
    """Détecte les mots clés de sécurité dans le body."""

    name = "security_keyword"

    _KEYWORDS = [
        "security", "vulnerability", "CVE-", "exploit",
        "RCE", "injection", "XSS", "CSRF", "patch critique",
    ]

    def evaluate(self, ctx: RuleContext) -> RuleResult:
        body_lower = ctx.body_excerpt.lower()
        for kw in self._KEYWORDS:
            if kw.lower() in body_lower:
                return RuleResult(
                    score_delta=8.0,
                    force_level=ImpactLevel.CRITICAL.value,
                    reason=f"Mot clé sécurité détecté : {kw}",
                )
        return RuleResult()


class LTSRule(BaseRule):
    """Détecte les releases LTS (Long Term Support)."""

    name = "lts_detection"

    def evaluate(self, ctx: RuleContext) -> RuleResult:
        if "lts" in ctx.tag.lower() or "lts" in ctx.body_excerpt.lower():
            return RuleResult(
                score_delta=3.0,
                reason="Release LTS détectée",
            )
        return RuleResult()


# ---------------------------------------------------------------------------
# Moteur de règles
# ---------------------------------------------------------------------------

class RuleEngine:
    """Applique une liste de règles à un contexte de release."""

    def __init__(self) -> None:
        self._rules: list[BaseRule] = [
            MajorVersionRule(),
            BreakingChangeRule(),
            DataEngineeringBoostRule(),
            SecurityKeywordRule(),
            LTSRule(),
        ]

    def evaluate(self, ctx: RuleContext) -> tuple[float, str]:
        """
        Évalue toutes les règles sur le contexte.

        Returns:
            (final_score, final_level)
        """
        score = ctx.impact_score
        level = ctx.impact_level
        reasons: list[str] = []

        for rule in self._rules:
            if not rule.enabled:
                continue
            result = rule.evaluate(ctx)
            score += result.score_delta
            if result.force_level:
                level = result.force_level
            if result.reason:
                reasons.append(f"[{rule.name}] {result.reason}")

        return score, level
