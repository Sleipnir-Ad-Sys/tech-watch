"""
GitHub Releases Collector — interroge l'API GitHub REST v3 pour récupérer
les dernières releases de repositories configurés dans config.yaml.

Gère :
- Rate limiting (headers X-RateLimit-*)
- Pagination
- Token optionnel via GITHUB_TOKEN
- Retry simple sur erreurs transitoires
"""

from __future__ import annotations

import time
from datetime import datetime, timezone

import requests

from config import RepoConfig, get_github_headers, load_config, load_settings
from logger import get_logger
from models import RawRelease, SourceType

logger = get_logger(__name__)


class GitHubCollector:
    """Collecte les releases GitHub pour une liste de repositories."""

    def __init__(self) -> None:
        self.config = load_config()
        self.settings = load_settings()
        self.headers = get_github_headers(self.settings)
        self.base_url = self.config.github.base_url
        self.per_page = self.config.github.per_page

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def collect_all(self) -> list[RawRelease]:
        """Collecte les releases pour tous les repos configurés."""
        all_releases: list[RawRelease] = []
        repos = self.config.github.repos

        logger.info("github_collector.start", repo_count=len(repos))

        for repo_cfg in repos:
            try:
                releases = self._collect_repo(repo_cfg)
                all_releases.extend(releases)
                logger.info(
                    "github_collector.repo_done",
                    repo=f"{repo_cfg.owner}/{repo_cfg.repo}",
                    count=len(releases),
                )
            except Exception as exc:
                logger.error(
                    "github_collector.repo_failed",
                    repo=f"{repo_cfg.owner}/{repo_cfg.repo}",
                    error=str(exc),
                )

        logger.info("github_collector.done", total=len(all_releases))
        return all_releases

    def collect_repo(self, owner: str, repo: str) -> list[RawRelease]:
        """Collecte les releases d'un repo unique (utilitaire CLI)."""
        cfg = RepoConfig(owner=owner, repo=repo, category="manual")
        return self._collect_repo(cfg)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _collect_repo(self, repo_cfg: RepoConfig) -> list[RawRelease]:
        """Récupère les releases paginées d'un repository."""
        url = f"{self.base_url}/repos/{repo_cfg.owner}/{repo_cfg.repo}/releases"
        params = {"per_page": self.per_page, "page": 1}
        releases: list[RawRelease] = []

        while True:
            response = self._get(url, params=params)
            data = response.json()

            if not isinstance(data, list) or len(data) == 0:
                break

            for item in data:
                release = self._parse_release(item, repo_cfg)
                if release and not release.draft:
                    releases.append(release)

            # Arrêt si on a moins d'items que per_page (dernière page)
            if len(data) < self.per_page:
                break

            params["page"] += 1  # type: ignore[operator]

        return releases

    def _parse_release(self, item: dict, repo_cfg: RepoConfig) -> RawRelease | None:
        """Parse un objet JSON GitHub release en RawRelease."""
        try:
            published_raw = item.get("published_at")
            published_at = None
            if published_raw:
                published_at = datetime.fromisoformat(
                    published_raw.replace("Z", "+00:00")
                ).astimezone(timezone.utc).replace(tzinfo=None)

            return RawRelease(
                source=SourceType.GITHUB,
                repo_owner=repo_cfg.owner,
                repo_name=repo_cfg.repo,
                tag_name=item.get("tag_name", ""),
                name=item.get("name"),
                body=item.get("body"),
                published_at=published_at,
                html_url=item.get("html_url", ""),
                prerelease=item.get("prerelease", False),
                draft=item.get("draft", False),
                category=repo_cfg.category,
                repo_weight=repo_cfg.weight,
            )
        except Exception as exc:
            logger.warning(
                "github_collector.parse_error",
                repo=f"{repo_cfg.owner}/{repo_cfg.repo}",
                tag=item.get("tag_name"),
                error=str(exc),
            )
            return None

    def _get(
        self,
        url: str,
        params: dict | None = None,
        retries: int = 3,
    ) -> requests.Response:
        """GET avec retry simple et respect du rate limit GitHub."""
        for attempt in range(retries):
            try:
                response = requests.get(
                    url,
                    headers=self.headers,
                    params=params,
                    timeout=15,
                )

                # Vérification rate limit
                remaining = int(response.headers.get("X-RateLimit-Remaining", 1))
                if remaining < 5:
                    reset_ts = int(response.headers.get("X-RateLimit-Reset", 0))
                    wait = max(0, reset_ts - int(time.time())) + 1
                    logger.warning("github_collector.rate_limit", wait_seconds=wait)
                    time.sleep(wait)

                response.raise_for_status()
                return response

            except requests.HTTPError as exc:
                if exc.response is not None and exc.response.status_code == 404:
                    logger.warning("github_collector.not_found", url=url)
                    raise
                if attempt < retries - 1:
                    time.sleep(2**attempt)  # backoff exponentiel
                else:
                    raise

            except requests.RequestException as exc:
                if attempt < retries - 1:
                    logger.warning(
                        "github_collector.retry",
                        attempt=attempt + 1,
                        error=str(exc),
                    )
                    time.sleep(2**attempt)
                else:
                    raise

        # Jamais atteint mais satisfait le type checker
        raise RuntimeError(f"Failed to GET {url} after {retries} retries")
