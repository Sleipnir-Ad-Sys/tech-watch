"""
Trending Collector — découverte dynamique de nouveaux outils via GitHub Search API.

Pour chaque topic configuré dans config.yaml > discovery.topics,
interroge l'API de recherche GitHub pour trouver des repos actifs
non encore suivis dans la configuration.

Les repos sont triés par activité récente (pushed_at) et filtrés
par nombre d'étoiles minimum pour éviter le bruit.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone

import requests

from config import DiscoveryTopicConfig, get_github_headers, load_config, load_settings
from logger import get_logger
from models import DiscoveredRepo

logger = get_logger(__name__)

SEARCH_URL = "https://api.github.com/search/repositories"


class TrendingCollector:
    """Découvre des repos GitHub actifs par topic, non encore suivis dans config."""

    def __init__(self) -> None:
        self.config = load_config()
        self.settings = load_settings()
        self.headers = get_github_headers(self.settings)
        self._tracked: set[str] = self._get_tracked_repos()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def collect_all(self) -> list[DiscoveredRepo]:
        """Collecte les repos tendance pour tous les topics configurés."""
        discovery_cfg = self.config.discovery
        if not discovery_cfg.enabled:
            logger.info("trending_collector.disabled")
            return []

        all_discovered: list[DiscoveredRepo] = []
        seen_full_names: set[str] = set()

        for topic in discovery_cfg.topics:
            try:
                repos = self._collect_topic(topic)
                for repo in repos:
                    key = repo.full_name.lower()
                    if key not in seen_full_names:
                        seen_full_names.add(key)
                        all_discovered.append(repo)
                logger.info(
                    "trending_collector.topic_done",
                    topic=topic.name,
                    found=len(repos),
                    new=sum(1 for r in repos if r.full_name.lower() not in (seen_full_names - {r.full_name.lower()})),
                )
                # Respecter le rate limit GitHub Search API (10 req/min sans token)
                time.sleep(0.5)
            except Exception as exc:
                logger.error(
                    "trending_collector.topic_failed",
                    topic=topic.name,
                    error=str(exc),
                )

        # Trier par étoiles décroissantes pour affichage frontend
        all_discovered.sort(key=lambda r: r.stars, reverse=True)

        logger.info("trending_collector.done", total=len(all_discovered))
        return all_discovered

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _collect_topic(self, topic: DiscoveryTopicConfig) -> list[DiscoveredRepo]:
        """Recherche les repos actifs pour un topic donné via GitHub Search API."""
        min_stars = self.config.discovery.min_stars
        per_topic = self.config.discovery.per_topic

        # Tri par activité récente — on veut des projets vivants, pas juste populaires
        params = {
            "q": f"topic:{topic.name} stars:>{min_stars}",
            "sort": "updated",
            "order": "desc",
            "per_page": min(per_topic * 3, 30),  # overfetch pour filtrer les déjà suivis
        }

        resp = requests.get(
            SEARCH_URL,
            headers=self.headers,
            params=params,
            timeout=15,
        )

        if resp.status_code == 403:
            # Rate limited — attendre 60s et essayer une fois
            logger.warning("trending_collector.rate_limited", topic=topic.name)
            time.sleep(60)
            resp = requests.get(SEARCH_URL, headers=self.headers, params=params, timeout=15)

        resp.raise_for_status()
        items = resp.json().get("items", [])

        results: list[DiscoveredRepo] = []
        for item in items:
            full_name: str = item.get("full_name", "")
            if not full_name:
                continue

            # Exclure les repos déjà suivis
            if full_name.lower() in self._tracked:
                continue

            pushed_at = _parse_dt(item.get("pushed_at"))
            created_at = _parse_dt(item.get("created_at"))

            owner, _, repo = full_name.partition("/")
            results.append(
                DiscoveredRepo(
                    owner=owner,
                    repo=repo,
                    full_name=full_name,
                    description=item.get("description"),
                    url=item.get("html_url", f"https://github.com/{full_name}"),
                    stars=item.get("stargazers_count", 0),
                    language=item.get("language"),
                    topics=item.get("topics", []),
                    pushed_at=pushed_at,
                    created_at=created_at,
                    category=topic.category,
                    discovery_source=topic.name,
                )
            )

            if len(results) >= per_topic:
                break

        return results

    def _get_tracked_repos(self) -> set[str]:
        """Retourne l'ensemble {owner/repo en minuscule} déjà suivis dans config."""
        tracked: set[str] = set()
        for repo_cfg in self.config.github.repos:
            tracked.add(f"{repo_cfg.owner}/{repo_cfg.repo}".lower())
        return tracked


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_dt(value: str | None) -> datetime | None:
    """Parse une date ISO GitHub (avec Z) en datetime aware."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
