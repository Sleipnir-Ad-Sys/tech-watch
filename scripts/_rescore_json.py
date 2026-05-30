"""
Re-score data.json directement depuis le fichier existant.
Applique le nouveau moteur semantique sur les body_excerpt stockes.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from engine.impact_analyzer import ChangelogAnalyzer, ProfileEngine, score_to_impact_level, determine_action
from models import ChangelogCategory

DATA_JSON = Path("web/data.json")
PROFILES = ["data_engineering"]

analyzer = ChangelogAnalyzer()
profile_engine = ProfileEngine()


def rescore_release(release: dict) -> dict:
    body = release.get("body_excerpt") or ""
    name = release.get("name") or ""

    factors, technical_score = analyzer.analyze(body)

    has_critical_factor = any(
        f.category in (ChangelogCategory.SECURITY, ChangelogCategory.BREAKING_CHANGE)
        for f in factors
    )
    impact_level = score_to_impact_level(technical_score, has_critical_factor=has_critical_factor)
    action, reasons = determine_action(factors, impact_level)

    relevance_score = profile_engine.get_relevance(name, PROFILES)
    final_score = round(technical_score * max(relevance_score, 1.0), 2)

    return {
        **release,
        "technical_score": technical_score,
        "relevance_score": relevance_score,
        "final_score": final_score,
        "impact_score": technical_score,
        "impact_level": impact_level.value,
        "action_recommended": action.value,
        "detected_factors": [
            {
                "category": f.category.value,
                "count": f.count,
                "score_contribution": f.score_contribution,
                "snippets": f.snippets,
            }
            for f in factors
        ],
        "analysis_reasons": reasons,
    }


def main():
    data = json.loads(DATA_JSON.read_text(encoding="utf-8"))
    releases = data.get("releases", [])
    print("Releases a re-scorer:", len(releases))

    rescored = [rescore_release(r) for r in releases]

    counts = {}
    for r in rescored:
        lvl = r.get("impact_level", "unknown")
        counts[lvl] = counts.get(lvl, 0) + 1

    print("Resume des niveaux d'impact :")
    for lvl, n in sorted(counts.items(), key=lambda x: -x[1]):
        print("  " + str(lvl) + " : " + str(n))

    # Quelques exemples avec facteurs detectes
    with_factors = [r for r in rescored if r.get("detected_factors")]
    print("\nExemples avec facteurs detectes (" + str(len(with_factors)) + " releases):")
    for r in with_factors[:5]:
        print("  " + str(r.get("name")) + " " + str(r.get("tag")) + " -> " + str(r.get("impact_level")) + " score=" + str(r.get("technical_score")))
        for f in r.get("detected_factors", [])[:3]:
            print("    " + str(f.get("category")) + " x" + str(f.get("count")) + " +" + str(f.get("score_contribution")))

    data["releases"] = rescored
    DATA_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\nOK data.json mis a jour avec " + str(len(rescored)) + " releases re-scorees")


if __name__ == "__main__":
    main()
