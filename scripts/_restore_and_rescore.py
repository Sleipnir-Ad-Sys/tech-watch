"""
Restaure les releases GitHub depuis git HEAD et les re-score avec le nouveau moteur.
"""
from __future__ import annotations
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from engine.impact_analyzer import ChangelogAnalyzer, ProfileEngine, score_to_impact_level, determine_urgency, determine_action
from models import ChangelogCategory

DATA_JSON = Path("web/data.json")
PROFILES = ["data_engineering"]

analyzer = ChangelogAnalyzer()
profile_engine = ProfileEngine()


def rescore_release(release: dict) -> dict:
    body = release.get("body_excerpt") or ""
    name = release.get("name") or ""

    factors, technical_score = analyzer.analyze(body)

    relevance_score = profile_engine.get_relevance(name, PROFILES)

    # Score final borné à 100 : final = min(100, tech × 0.7 + relevance × 3)
    final_score = round(min(100.0, (technical_score * 0.7) + (relevance_score * 3.0)), 2)
    impact_level = score_to_impact_level(final_score)
    urgency_level = determine_urgency(factors)
    action, reasons = determine_action(factors, impact_level, urgency_level)

    return {
        **release,
        "technical_score": technical_score,
        "relevance_score": relevance_score,
        "final_score": final_score,
        "impact_score": technical_score,
        "impact_level": impact_level.value,
        "urgency_level": urgency_level.value,
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
    # 1. Recuperer la version git HEAD de data.json
    result = subprocess.run(
        ["git", "show", "HEAD:web/data.json"],
        capture_output=True, text=True, encoding="utf-8"
    )
    if result.returncode != 0:
        print("Erreur git:", result.stderr)
        sys.exit(1)

    old_data = json.loads(result.stdout)
    github_releases = [r for r in old_data.get("releases", []) if r.get("source") == "github"]
    print("Releases GitHub recuperees depuis git:", len(github_releases))

    # 2. Re-scorer avec le nouveau moteur
    rescored_github = [rescore_release(r) for r in github_releases]

    # 3. Afficher quelques resultats
    print("\nExemples:")
    for r in sorted(rescored_github, key=lambda x: -(x.get("technical_score") or 0))[:10]:
        nm = r.get("name", "")
        tg = r.get("tag", "")
        lvl = r.get("impact_level", "")
        ts = r.get("technical_score", 0)
        rs = r.get("relevance_score", 0)
        fs = r.get("final_score", 0)
        action = r.get("action_recommended", "")
        nf = len(r.get("detected_factors", []))
        print("  " + nm + " " + tg + " -> " + lvl + " T=" + str(ts) + " R=" + str(rs) + " F=" + str(fs) + " [" + action + "] " + str(nf) + " facteurs")
        for f in r.get("detected_factors", [])[:3]:
            print("    " + str(f.get("category")) + " x" + str(f.get("count")) + " +" + str(f.get("score_contribution")))

    # 4. Charger le data.json actuel et y remplacer les GitHub releases
    current_data = json.loads(DATA_JSON.read_text(encoding="utf-8"))
    pypi_releases = [r for r in current_data.get("releases", []) if r.get("source") != "github"]
    print("\nReleases PyPI gardees:", len(pypi_releases))

    # Combiner: GitHub en tete (tri par published_at desc), puis PyPI
    all_releases = sorted(
        rescored_github + pypi_releases,
        key=lambda r: r.get("published_at") or "",
        reverse=True
    )

    current_data["releases"] = all_releases
    current_data.setdefault("trends", old_data.get("trends", []))
    current_data.setdefault("discoveries", old_data.get("discoveries", []))

    DATA_JSON.write_text(json.dumps(current_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\nOK data.json mis a jour: " + str(len(rescored_github)) + " GitHub + " + str(len(pypi_releases)) + " PyPI = " + str(len(all_releases)) + " total")


if __name__ == "__main__":
    main()
