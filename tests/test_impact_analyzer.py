"""
Tests unitaires du moteur d'analyse d'impact changelog.

Couverture :
    - ChangelogAnalyzer : détection par catégorie, pondérations personnalisées
    - score_to_impact_level : seuils de classification
    - determine_action : logique de recommandation
    - ProfileEngine : pertinence par profil et projet
    - ImpactScoreEngine : analyse complète, calcul final_score
"""

from __future__ import annotations

import pytest

from engine.impact_analyzer import (
    ChangelogAnalyzer,
    ImpactScoreEngine,
    ProfileEngine,
    analyze_release,
    compute_impact,
    determine_action,
    determine_urgency,
    score_to_impact_level,
)
from models import ActionRecommended, ChangelogCategory, DetectedFactor, ImpactLevel, UrgencyLevel, UserProfile


# ── ChangelogAnalyzer ─────────────────────────────────────────────────────────

class TestChangelogAnalyzer:
    """Tests de détection des catégories dans les changelogs."""

    def test_security_cve_detection(self):
        analyzer = ChangelogAnalyzer()
        text = "Fixed CVE-2024-12345 security vulnerability in the authentication module"
        factors, score = analyzer.analyze(text)
        cats = {f.category for f in factors}
        assert ChangelogCategory.SECURITY in cats
        assert score >= 100.0

    def test_security_multiple_cves(self):
        analyzer = ChangelogAnalyzer()
        text = (
            "Patched CVE-2024-001 remote code execution vulnerability\n"
            "Fixed CVE-2024-002 XSS injection in template rendering\n"
            "Resolved CVE-2024-003 path traversal in file upload"
        )
        factors, score = analyzer.analyze(text)
        sec = next(f for f in factors if f.category == ChangelogCategory.SECURITY)
        assert sec.count >= 3
        # Score brut = 300, mais borné à 100
        assert score == 100.0
        # La contribution brute reflète bien les 3 occurrences
        assert sec.score_contribution == 300.0

    def test_breaking_change_detection(self):
        analyzer = ChangelogAnalyzer()
        text = "BREAKING CHANGE: The old scan() API has been removed\nThis is incompatible with v1.x"
        factors, score = analyzer.analyze(text)
        cats = {f.category for f in factors}
        assert ChangelogCategory.BREAKING_CHANGE in cats
        assert score >= 50.0

    def test_breaking_change_variants(self):
        analyzer = ChangelogAnalyzer()
        texts = [
            "BREAKING: removed public API",
            "[breaking] old behavior changed",
            "**breaking** — incompatible change",
            "⚠ Breaking: new signature required",
        ]
        for text in texts:
            factors, _ = analyzer.analyze(text)
            cats = {f.category for f in factors}
            assert ChangelogCategory.BREAKING_CHANGE in cats, f"Not detected in: {text!r}"

    def test_deprecated_detection(self):
        analyzer = ChangelogAnalyzer()
        text = "The old_function() is now deprecated and will be removed in v3.0\nMarked as deprecated: legacy_api"
        factors, _ = analyzer.analyze(text)
        cats = {f.category for f in factors}
        assert ChangelogCategory.DEPRECATED in cats

    def test_removed_detection(self):
        analyzer = ChangelogAnalyzer()
        text = "Removed the legacy Python 3.8 support\nDropped support for deprecated XML format"
        factors, _ = analyzer.analyze(text)
        cats = {f.category for f in factors}
        assert ChangelogCategory.REMOVED in cats

    def test_migration_detection(self):
        analyzer = ChangelogAnalyzer()
        text = "See the migration guide for upgrading from v1 to v2\nMigration required for existing installations"
        factors, _ = analyzer.analyze(text)
        cats = {f.category for f in factors}
        assert ChangelogCategory.MIGRATION in cats

    def test_performance_detection(self):
        analyzer = ChangelogAnalyzer()
        text = "Performance improvements: queries are now 3x faster\nOptimized memory usage by 40%\nImproved throughput"
        factors, score = analyzer.analyze(text)
        cats = {f.category for f in factors}
        assert ChangelogCategory.PERFORMANCE in cats
        perf = next(f for f in factors if f.category == ChangelogCategory.PERFORMANCE)
        assert perf.count >= 2

    def test_enhancement_detection(self):
        analyzer = ChangelogAnalyzer()
        text = (
            "- Added support for streaming API\n"
            "- New feature: parallel execution\n"
            "- Implemented batch processing mode"
        )
        factors, _ = analyzer.analyze(text)
        cats = {f.category for f in factors}
        assert ChangelogCategory.ENHANCEMENT in cats

    def test_bug_fix_detection(self):
        analyzer = ChangelogAnalyzer()
        text = (
            "- Fixed null pointer exception in parser\n"
            "- Bugfix: resolved regression in v1.2\n"
            "- Corrected timezone handling"
        )
        factors, _ = analyzer.analyze(text)
        cats = {f.category for f in factors}
        assert ChangelogCategory.BUG_FIX in cats

    def test_documentation_detection(self):
        analyzer = ChangelogAnalyzer()
        text = "Updated documentation and README for the new release\nImproved docstrings"
        factors, score = analyzer.analyze(text)
        cats = {f.category for f in factors}
        assert ChangelogCategory.DOCUMENTATION in cats

    def test_empty_text_returns_zero(self):
        analyzer = ChangelogAnalyzer()
        factors, score = analyzer.analyze("")
        assert factors == []
        assert score == 0.0

    def test_whitespace_only_returns_zero(self):
        analyzer = ChangelogAnalyzer()
        factors, score = analyzer.analyze("   \n\n\t  ")
        assert factors == []
        assert score == 0.0

    def test_documentation_only_low_score(self):
        analyzer = ChangelogAnalyzer()
        text = "Updated docs and README only"
        factors, score = analyzer.analyze(text)
        assert score <= 10.0

    def test_mixed_categories(self):
        analyzer = ChangelogAnalyzer()
        text = """
        ## v2.0.0

        BREAKING CHANGE: removed old scan API
        - Performance improvements: 2x faster query execution
        - Optimized memory usage
        - Fixed regression in CSV parser
        - Added new Arrow backend (enhancement)
        - See migration guide for upgrading
        """
        factors, score = analyzer.analyze(text)
        cats = {f.category for f in factors}
        assert ChangelogCategory.BREAKING_CHANGE in cats
        assert ChangelogCategory.PERFORMANCE in cats
        assert ChangelogCategory.MIGRATION in cats
        # Score doit refléter breaking + perf + migration
        assert score >= 50.0 + 15.0 + 25.0

    def test_custom_weights(self):
        custom = {"security": 200.0, "bug_fix": 1.0}
        analyzer = ChangelogAnalyzer(weights=custom)
        text = "Fixed CVE-2024-5678 critical security flaw"
        factors, score = analyzer.analyze(text)
        # Le score total est borné à 100 même avec des poids élevés
        assert score == 100.0
        # Mais la contribution brute reflète bien le poids custom
        sec = next((f for f in factors if f.category == ChangelogCategory.SECURITY), None)
        assert sec is not None
        assert sec.score_contribution >= 200.0

    def test_factors_sorted_by_contribution(self):
        analyzer = ChangelogAnalyzer()
        text = "CVE-2024-1234 security fix\nFixed a small bug"
        factors, _ = analyzer.analyze(text)
        contributions = [f.score_contribution for f in factors]
        assert contributions == sorted(contributions, reverse=True)

    def test_snippets_extracted(self):
        analyzer = ChangelogAnalyzer()
        text = "Fixed CVE-2024-1234 critical vulnerability in auth module"
        factors, _ = analyzer.analyze(text)
        sec = next((f for f in factors if f.category == ChangelogCategory.SECURITY), None)
        assert sec is not None
        assert len(sec.snippets) > 0
        assert "CVE-2024-1234" in sec.snippets[0]

    def test_score_contribution_matches_weight_times_count(self):
        weights = {"bug_fix": 5.0}
        analyzer = ChangelogAnalyzer(weights=weights)
        text = "- Fixed parser bug\n- Fixed null pointer\n- Fixed regression"
        factors, score = analyzer.analyze(text)
        bf = next((f for f in factors if f.category == ChangelogCategory.BUG_FIX), None)
        if bf:
            # score_contribution = weight × count (raw, avant cap à 100)
            assert bf.score_contribution == bf.count * 5.0
            # Le score retourné est min(100, total)
            assert score == min(100.0, bf.score_contribution)


# ── score_to_impact_level ─────────────────────────────────────────────────────

class TestScoreToImpactLevel:
    """Tests des seuils de classification."""

    def test_zero_is_low(self):
        assert score_to_impact_level(0.0) == ImpactLevel.LOW

    def test_boundary_low(self):
        assert score_to_impact_level(20.0) == ImpactLevel.LOW

    def test_boundary_moderate(self):
        assert score_to_impact_level(20.1) == ImpactLevel.MODERATE
        assert score_to_impact_level(50.0) == ImpactLevel.MODERATE

    def test_boundary_high(self):
        assert score_to_impact_level(50.1) == ImpactLevel.HIGH
        assert score_to_impact_level(80.0) == ImpactLevel.HIGH  # exactement 80 = HIGH

    def test_boundary_critical(self):
        # Score > 80 → CRITICAL (purement basé sur le score, sans gate)
        assert score_to_impact_level(80.1) == ImpactLevel.CRITICAL
        assert score_to_impact_level(100.0) == ImpactLevel.CRITICAL

    def test_typical_scores(self):
        assert score_to_impact_level(5.0) == ImpactLevel.LOW
        assert score_to_impact_level(35.0) == ImpactLevel.MODERATE
        assert score_to_impact_level(75.0) == ImpactLevel.HIGH
        assert score_to_impact_level(85.0) == ImpactLevel.CRITICAL


# ── determine_urgency ──────────────────────────────────────────────────

class TestDetermineUrgency:
    """Tests de l'urgence métier (indépendante du score technique)."""

    def _make_factor(self, cat: ChangelogCategory, count: int = 1) -> DetectedFactor:
        return DetectedFactor(category=cat, count=count, score_contribution=10.0, snippets=[])

    def test_security_is_urgent(self):
        assert determine_urgency([self._make_factor(ChangelogCategory.SECURITY)]) == UrgencyLevel.URGENT

    def test_breaking_change_is_high(self):
        assert determine_urgency([self._make_factor(ChangelogCategory.BREAKING_CHANGE)]) == UrgencyLevel.HIGH

    def test_migration_is_medium(self):
        assert determine_urgency([self._make_factor(ChangelogCategory.MIGRATION)]) == UrgencyLevel.MEDIUM

    def test_performance_only_is_low(self):
        assert determine_urgency([self._make_factor(ChangelogCategory.PERFORMANCE)]) == UrgencyLevel.LOW

    def test_bug_fix_only_is_low(self):
        assert determine_urgency([self._make_factor(ChangelogCategory.BUG_FIX)]) == UrgencyLevel.LOW

    def test_deprecated_is_low(self):
        assert determine_urgency([self._make_factor(ChangelogCategory.DEPRECATED)]) == UrgencyLevel.LOW

    def test_empty_is_low(self):
        assert determine_urgency([]) == UrgencyLevel.LOW

    def test_security_overrides_breaking(self):
        factors = [
            self._make_factor(ChangelogCategory.SECURITY),
            self._make_factor(ChangelogCategory.BREAKING_CHANGE),
        ]
        assert determine_urgency(factors) == UrgencyLevel.URGENT

    def test_breaking_overrides_migration(self):
        factors = [
            self._make_factor(ChangelogCategory.BREAKING_CHANGE),
            self._make_factor(ChangelogCategory.MIGRATION),
        ]
        assert determine_urgency(factors) == UrgencyLevel.HIGH


# ── determine_action ──────────────────────────────────────────────────────────

class TestDetermineAction:
    """Tests de la logique de recommandation d'action (Impact + Urgence)."""

    def _make_factor(self, cat: ChangelogCategory, count: int = 1, score: float = 10.0) -> DetectedFactor:
        return DetectedFactor(
            category=cat,
            count=count,
            score_contribution=score,
            snippets=["test snippet"],
        )

    def test_security_triggers_upgrade_immediately(self):
        factors = [self._make_factor(ChangelogCategory.SECURITY, count=1, score=100.0)]
        urgency = determine_urgency(factors)  # URGENT
        action, reasons = determine_action(factors, ImpactLevel.CRITICAL, urgency)
        assert action == ActionRecommended.UPGRADE_IMMEDIATELY
        assert any("sécurité" in r.lower() or "faille" in r.lower() for r in reasons)

    def test_breaking_change_triggers_plan_migration(self):
        factors = [self._make_factor(ChangelogCategory.BREAKING_CHANGE, count=2, score=100.0)]
        urgency = determine_urgency(factors)  # HIGH
        action, reasons = determine_action(factors, ImpactLevel.HIGH, urgency)
        assert action == ActionRecommended.PLAN_MIGRATION

    def test_removed_triggers_monitor_or_update(self):
        """REMOVED seul (sans BREAKING) → urgence LOW → action selon niveau d'impact."""
        factors = [self._make_factor(ChangelogCategory.REMOVED, count=1, score=30.0)]
        urgency = determine_urgency(factors)  # LOW
        action, _ = determine_action(factors, ImpactLevel.MODERATE, urgency)
        # MODERATE + LOW urgency → SURVEILLER
        assert action == ActionRecommended.MONITOR

    def test_deprecated_triggers_monitor(self):
        factors = [self._make_factor(ChangelogCategory.DEPRECATED, count=1, score=30.0)]
        urgency = determine_urgency(factors)  # LOW
        action, reasons = determine_action(factors, ImpactLevel.MODERATE, urgency)
        assert action == ActionRecommended.MONITOR

    def test_performance_moderate_triggers_monitor(self):
        factors = [self._make_factor(ChangelogCategory.PERFORMANCE, count=2, score=30.0)]
        urgency = determine_urgency(factors)  # LOW
        action, _ = determine_action(factors, ImpactLevel.MODERATE, urgency)
        assert action == ActionRecommended.MONITOR

    def test_performance_high_triggers_monitor_update(self):
        """Impact HIGH + urgence LOW → METTRE À JOUR (prochain cycle, pas planifier migration)."""
        factors = [self._make_factor(ChangelogCategory.PERFORMANCE, count=5, score=75.0)]
        urgency = determine_urgency(factors)  # LOW
        action, _ = determine_action(factors, ImpactLevel.HIGH, urgency)
        assert action == ActionRecommended.MONITOR_UPDATE

    def test_bug_fix_low_triggers_ignore(self):
        factors = [self._make_factor(ChangelogCategory.BUG_FIX, count=3, score=15.0)]
        urgency = determine_urgency(factors)  # LOW
        action, _ = determine_action(factors, ImpactLevel.LOW, urgency)
        assert action == ActionRecommended.IGNORE

    def test_empty_factors_triggers_ignore(self):
        action, reasons = determine_action([], ImpactLevel.LOW, UrgencyLevel.LOW)
        assert action == ActionRecommended.IGNORE

    def test_security_priority_over_breaking(self):
        """Sécurité prime sur breaking : urgence URGENT même si breaking présent."""
        factors = [
            self._make_factor(ChangelogCategory.SECURITY, count=1, score=100.0),
            self._make_factor(ChangelogCategory.BREAKING_CHANGE, count=1, score=50.0),
        ]
        urgency = determine_urgency(factors)  # URGENT (security wins)
        action, _ = determine_action(factors, ImpactLevel.CRITICAL, urgency)
        assert action == ActionRecommended.UPGRADE_IMMEDIATELY


# ── ProfileEngine ─────────────────────────────────────────────────────────────

class TestProfileEngine:
    """Tests du calcul de pertinence par profil."""

    def test_polars_data_engineering(self):
        engine = ProfileEngine()
        score = engine.get_relevance("pola-rs/polars", [UserProfile.DATA_ENGINEERING.value])
        assert score == 10.0

    def test_duckdb_data_engineering(self):
        engine = ProfileEngine()
        score = engine.get_relevance("duckdb/duckdb", [UserProfile.DATA_ENGINEERING.value])
        assert score == 10.0

    def test_fastapi_python(self):
        engine = ProfileEngine()
        score = engine.get_relevance("tiangolo/fastapi", [UserProfile.PYTHON.value])
        assert score >= 9.0

    def test_tokio_rust(self):
        engine = ProfileEngine()
        score = engine.get_relevance("tokio-rs/tokio", [UserProfile.RUST.value])
        assert score == 10.0

    def test_transformers_ai_llm(self):
        engine = ProfileEngine()
        score = engine.get_relevance("huggingface/transformers", [UserProfile.AI_LLM.value])
        assert score == 10.0

    def test_unknown_project_returns_zero(self):
        engine = ProfileEngine()
        score = engine.get_relevance("unknown/totally_unknown_tool_xyz", [UserProfile.DATA_ENGINEERING.value])
        assert score == 0.0

    def test_multiple_profiles_returns_max(self):
        engine = ProfileEngine()
        # polars = 10 en data_engineering, 8 en rust
        score = engine.get_relevance(
            "pola-rs/polars",
            [UserProfile.RUST.value, UserProfile.DATA_ENGINEERING.value],
        )
        assert score == 10.0

    def test_list_profiles_returns_all(self):
        engine = ProfileEngine()
        profiles = engine.list_profiles()
        assert len(profiles) >= 7
        ids = {p["id"] for p in profiles}
        assert "data_engineering" in ids
        assert "python" in ids
        assert "ai_llm" in ids

    def test_no_profile_returns_zero(self):
        engine = ProfileEngine()
        score = engine.get_relevance("pola-rs/polars", [])
        assert score == 0.0


# ── ImpactScoreEngine ─────────────────────────────────────────────────────────

class TestImpactScoreEngine:
    """Tests d'intégration du moteur complet."""

    def test_security_release_critical(self):
        engine = ImpactScoreEngine()
        result = engine.analyze(
            release_id="test-sec-001",
            project_name="fastapi/fastapi",
            changelog_text="Critical: CVE-2024-5678 security vulnerability patched in auth middleware",
            profiles=[UserProfile.PYTHON.value],
        )
        assert result.release_id == "test-sec-001"
        assert result.impact_level == ImpactLevel.CRITICAL
        assert result.urgency_level == UrgencyLevel.URGENT
        assert result.action_recommended == ActionRecommended.UPGRADE_IMMEDIATELY
        assert result.technical_score >= 100.0

    def test_breaking_change_release(self):
        engine = ImpactScoreEngine()
        result = engine.analyze(
            release_id="test-bc-001",
            project_name="duckdb/duckdb",
            changelog_text="BREAKING CHANGE: The scan() function signature has changed\nSee migration guide",
            profiles=[UserProfile.DATA_ENGINEERING.value],
        )
        assert result.action_recommended == ActionRecommended.PLAN_MIGRATION
        assert result.urgency_level == UrgencyLevel.HIGH
        assert ChangelogCategory.BREAKING_CHANGE in {f.category for f in result.detected_factors}

    def test_empty_changelog_is_low(self):
        engine = ImpactScoreEngine()
        result = engine.analyze(
            release_id="test-empty-001",
            project_name="some/project",
            changelog_text="",
            profiles=[UserProfile.PYTHON.value],
        )
        assert result.technical_score == 0.0
        assert result.impact_level == ImpactLevel.LOW
        assert result.action_recommended == ActionRecommended.IGNORE

    def test_final_score_formula(self):
        """Vérifie que final_score = min(100, technical × 0.7 + relevance × 3)."""
        engine = ImpactScoreEngine()
        result = engine.analyze(
            release_id="test-formula-001",
            project_name="pola-rs/polars",
            changelog_text="Performance optimization: 3x faster memory usage reduced by 40%",
            profiles=[UserProfile.DATA_ENGINEERING.value],
        )
        expected = round(min(100.0, (result.technical_score * 0.7) + (result.relevance_score * 3.0)), 2)
        assert abs(result.final_score - expected) < 0.01

    def test_relevance_score_applied(self):
        """polars en data_engineering → relevance = 10."""
        engine = ImpactScoreEngine()
        result = engine.analyze(
            release_id="test-rel-001",
            project_name="pola-rs/polars",
            changelog_text="Performance improvements and bug fixes",
            profiles=[UserProfile.DATA_ENGINEERING.value],
        )
        assert result.relevance_score == 10.0

    def test_unknown_project_relevance_one(self):
        """Projet inconnu → relevance=0, final = min(100, technical × 0.7)."""
        engine = ImpactScoreEngine()
        result = engine.analyze(
            release_id="test-unk-001",
            project_name="unknown/xyz_tool",
            changelog_text="Performance improvement",
            profiles=[UserProfile.DATA_ENGINEERING.value],
        )
        assert result.relevance_score == 0.0
        expected = round(min(100.0, result.technical_score * 0.7), 2)
        assert abs(result.final_score - expected) < 0.01

    def test_detected_factors_returned(self):
        engine = ImpactScoreEngine()
        result = engine.analyze(
            release_id="test-factors-001",
            project_name="pola-rs/polars",
            changelog_text=(
                "Performance: 2x faster\n"
                "Fixed regression bug\n"
                "New feature: streaming support added"
            ),
            profiles=[UserProfile.DATA_ENGINEERING.value],
        )
        assert len(result.detected_factors) >= 2

    def test_reasons_non_empty(self):
        engine = ImpactScoreEngine()
        result = engine.analyze(
            release_id="test-reasons-001",
            project_name="tokio-rs/tokio",
            changelog_text="Fixed CVE-2024-9999 use-after-free vulnerability",
            profiles=[UserProfile.RUST.value],
        )
        assert len(result.reasons) > 0

    def test_polars_performance_release_display(self):
        """
        Performance + bug fixes sans security/breaking → urgence LOW.
        L'impact peut être CRITICAL avec relevance élevée, mais l'urgence reste LOW.
        """
        engine = ImpactScoreEngine()
        text = """
        ## Performance Improvements
        - Improved query performance by 2x for group_by operations
        - Optimized memory usage in scan operations
        - Faster CSV reading via parallel parsing
        - Reduced throughput bottleneck in lazy evaluation

        ## Bug Fixes
        - Fixed regression in datetime parsing
        - Corrected timezone offset handling

        ## Enhancements
        - Added support for new Arrow IPC format
        """
        result = engine.analyze(
            release_id="polars-perf-001",
            project_name="pola-rs/polars",
            changelog_text=text,
            profiles=[UserProfile.DATA_ENGINEERING.value],
        )
        cats = {f.category for f in result.detected_factors}
        assert ChangelogCategory.PERFORMANCE in cats
        assert ChangelogCategory.BUG_FIX in cats
        assert ChangelogCategory.ENHANCEMENT in cats
        # Sans SECURITY ni BREAKING_CHANGE → urgence LOW (pas urgent)
        assert result.urgency_level == UrgencyLevel.LOW
        # Pas de faille sécurité → pas d'action immédiate
        assert result.action_recommended != ActionRecommended.UPGRADE_IMMEDIATELY
        assert result.action_recommended != ActionRecommended.PLAN_MIGRATION


# ── DataFrame integration ─────────────────────────────────────────────────────

class TestAnalyzeDataframe:
    """Tests de l'analyse batch sur DataFrame Polars."""

    def test_batch_adds_columns(self):
        import polars as pl
        engine = ImpactScoreEngine()

        df = pl.DataFrame({
            "id": ["id1", "id2"],
            "name": ["pola-rs/polars", "duckdb/duckdb"],
            "body_excerpt": [
                "Performance improvements and bug fixes",
                "BREAKING CHANGE: removed legacy API",
            ],
        })

        result = engine.analyze_dataframe(df, profiles=[UserProfile.DATA_ENGINEERING.value])

        for col in ("technical_score", "relevance_score", "final_score",
                    "impact_score", "impact_level", "urgency_level",
                    "detected_factors", "action_recommended", "analysis_reasons"):
            assert col in result.columns, f"Missing column: {col}"

    def test_batch_empty_dataframe(self):
        import polars as pl
        engine = ImpactScoreEngine()
        empty = pl.DataFrame()
        result = engine.analyze_dataframe(empty)
        assert result.is_empty()

    def test_batch_breaking_change_detected(self):
        import polars as pl
        engine = ImpactScoreEngine()

        df = pl.DataFrame({
            "id": ["bc-001"],
            "name": ["some/project"],
            "body_excerpt": ["BREAKING CHANGE: all public APIs removed"],
        })
        result = engine.analyze_dataframe(df)
        assert result["impact_level"][0] != ImpactLevel.LOW.value


# ── compute_impact (fonction pure publique) ───────────────────────────────────

class TestComputeImpact:
    """Tests de la fonction pure compute_impact."""

    def test_security_gives_critical(self):
        # Avec relevance=4.0 → final = min(100, 100×0.7 + 4×3) = 82 → CRITICAL
        result = compute_impact("CVE-2024-1234 critical security vulnerability in auth", relevance=4.0)
        assert result["classification"] == "CRITICAL"
        assert result["score"] == 100.0
        assert result["final_score"] > 80
        assert result["urgency"] == UrgencyLevel.URGENT.value
        assert result["action"] == ActionRecommended.UPGRADE_IMMEDIATELY.value

    def test_no_breaking_no_security_urgency_is_low(self):
        """Sans security/breaking → urgence toujours LOW, même avec un score élevé."""
        text = "\n".join([
            "## Performance improvements",
            "- 10x faster queries",
            "- Optimized memory usage by 50%",
            "## Bug fixes",
            "- Fixed regression in CSV parser",
            "## Enhancements",
            "- Added new feature for streaming",
        ])
        result = compute_impact(text)
        assert result["urgency"] == UrgencyLevel.LOW.value
        assert result["action"] != ActionRecommended.UPGRADE_IMMEDIATELY.value
        assert result["action"] != ActionRecommended.PLAN_MIGRATION.value

    def test_empty_is_low(self):
        result = compute_impact("")
        assert result["classification"] == "LOW"
        assert result["score"] == 0.0
        assert result["urgency"] == UrgencyLevel.LOW.value
        assert result["action"] == ActionRecommended.IGNORE.value

    def test_result_has_required_keys(self):
        result = compute_impact("Fixed a bug in the parser")
        for key in ("classification", "score", "final_score", "urgency", "factors", "action", "reasons"):
            assert key in result

    def test_breaking_change_can_reach_critical_with_high_score(self):
        """BREAKING + SECURITY + relevance → final > 80 → CRITICAL + urgence URGENT."""
        text = (
            "BREAKING CHANGE: entire public API removed\n"
            "CVE-2024-9999 security vulnerability patched\n"
            "See migration guide for upgrading"
        )
        result = compute_impact(text, relevance=4.0)
        assert result["classification"] == "CRITICAL"
        assert result["urgency"] == UrgencyLevel.URGENT.value
        assert result["action"] == ActionRecommended.UPGRADE_IMMEDIATELY.value


# ── analyze_release (fonction principale) ─────────────────────────────────

class TestAnalyzeRelease:
    """Tests de la fonction principale exposant les 3 concepts séparés."""

    def test_structure_has_required_keys(self):
        result = analyze_release("Fixed bug in parser")
        for key in ("impact", "urgency", "action", "factors"):
            assert key in result
        assert "score" in result["impact"]
        assert "level" in result["impact"]
        assert "level" in result["urgency"]
        assert "reason" in result["urgency"]
        assert "recommendation" in result["action"]
        assert "reasons" in result["action"]

    def test_security_separates_impact_and_urgency(self):
        """Sécurité : urgence URGENT indépendamment du score d'impact."""
        result = analyze_release("CVE-2024-1234 security vulnerability fixed")
        assert result["urgency"]["level"] == UrgencyLevel.URGENT.value
        assert result["action"]["recommendation"] == ActionRecommended.UPGRADE_IMMEDIATELY.value
        # technical_score élevé (sécurité = 100 pts)
        assert result["impact"]["score"] == 100.0

    def test_breaking_gives_plan_migration(self):
        result = analyze_release("BREAKING CHANGE: removed public API")
        assert result["urgency"]["level"] == UrgencyLevel.HIGH.value
        assert result["action"]["recommendation"] == ActionRecommended.PLAN_MIGRATION.value

    def test_migration_gives_medium_urgency(self):
        result = analyze_release("See migration guide for upgrading from v1 to v2")
        assert result["urgency"]["level"] == UrgencyLevel.MEDIUM.value

    def test_performance_only_gives_low_urgency(self):
        result = analyze_release("Performance improvements: 3x faster queries. Optimized memory usage.")
        assert result["urgency"]["level"] == UrgencyLevel.LOW.value

    def test_empty_gives_low_and_ignore(self):
        result = analyze_release("")
        assert result["impact"]["score"] == 0.0
        assert result["urgency"]["level"] == UrgencyLevel.LOW.value
        assert result["action"]["recommendation"] == ActionRecommended.IGNORE.value

    def test_urgency_independent_of_score(self):
        """Urgence LOW même avec beaucoup d'enhancements (score élevé)."""
        text = ("New feature added\n" * 5) + ("Enhancement: improved processing\n" * 5)
        result = analyze_release(text)
        assert result["urgency"]["level"] == UrgencyLevel.LOW.value
