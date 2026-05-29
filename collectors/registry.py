"""
Registry des collectors — point d'entrée unique pour lancer
tous les collectors ou un sous-ensemble.

Usage :
    registry = CollectorRegistry()
    results = registry.run_all()
"""

from __future__ import annotations

from dataclasses import dataclass, field

from logger import get_logger
from models import DiscoveredRepo, RawArticle, RawPackageRelease, RawRelease

from collectors.github_collector import GitHubCollector
from collectors.pypi_collector import PyPICollector
from collectors.rss_collector import RSSCollector
from collectors.trending_collector import TrendingCollector

logger = get_logger(__name__)


@dataclass
class CollectionResult:
    """Agrège les résultats de tous les collectors."""

    releases: list[RawRelease] = field(default_factory=list)
    articles: list[RawArticle] = field(default_factory=list)
    pypi_releases: list[RawPackageRelease] = field(default_factory=list)
    discoveries: list[DiscoveredRepo] = field(default_factory=list)

    @property
    def total(self) -> int:
        return len(self.releases) + len(self.articles) + len(self.pypi_releases)


class CollectorRegistry:
    """Orchestre l'exécution de tous les collectors."""

    def __init__(
        self,
        enable_github: bool = True,
        enable_rss: bool = True,
        enable_pypi: bool = True,
        enable_discovery: bool = True,
    ) -> None:
        self.enable_github = enable_github
        self.enable_rss = enable_rss
        self.enable_pypi = enable_pypi
        self.enable_discovery = enable_discovery

    def run_all(self) -> CollectionResult:
        """Lance tous les collectors activés et retourne les résultats agrégés."""
        result = CollectionResult()

        logger.info(
            "registry.start",
            github=self.enable_github,
            rss=self.enable_rss,
            pypi=self.enable_pypi,
        )

        if self.enable_github:
            try:
                collector = GitHubCollector()
                result.releases = collector.collect_all()
            except Exception as exc:
                logger.error("registry.github_failed", error=str(exc))

        if self.enable_rss:
            try:
                collector = RSSCollector()
                result.articles = collector.collect_all()
            except Exception as exc:
                logger.error("registry.rss_failed", error=str(exc))

        if self.enable_pypi:
            try:
                collector = PyPICollector()
                result.pypi_releases = collector.collect_all()
            except Exception as exc:
                logger.error("registry.pypi_failed", error=str(exc))

        if self.enable_discovery:
            try:
                collector = TrendingCollector()
                result.discoveries = collector.collect_all()
            except Exception as exc:
                logger.error("registry.discovery_failed", error=str(exc))

        logger.info(
            "registry.done",
            releases=len(result.releases),
            articles=len(result.articles),
            pypi_releases=len(result.pypi_releases),
            discoveries=len(result.discoveries),
            total=result.total,
        )

        return result
