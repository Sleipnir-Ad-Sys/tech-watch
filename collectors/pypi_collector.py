"""
PyPI Collector — interroge l'API PyPI JSON pour récupérer les infos
des packages configurés (version, date de release, description).

Endpoint : https://pypi.org/pypi/{package}/json
"""

from __future__ import annotations

import time
from datetime import datetime, timezone

import requests

from config import PyPIPackageConfig, load_config
from logger import get_logger
from models import RawPackageRelease, SourceType

logger = get_logger(__name__)


class PyPICollector:
    """Collecte les données de release depuis PyPI."""

    def __init__(self) -> None:
        self.config = load_config()
        self.base_url = self.config.pypi.base_url
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": "tech-watch/0.1 (+github)"})

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def collect_all(self) -> list[RawPackageRelease]:
        """Collecte les releases pour tous les packages configurés."""
        all_releases: list[RawPackageRelease] = []
        packages = self.config.pypi.packages

        logger.info("pypi_collector.start", package_count=len(packages))

        for pkg_cfg in packages:
            try:
                releases = self._collect_package(pkg_cfg)
                all_releases.extend(releases)
                logger.info(
                    "pypi_collector.package_done",
                    package=pkg_cfg.name,
                    count=len(releases),
                )
                # Pause courtoise entre les requêtes
                time.sleep(0.2)
            except Exception as exc:
                logger.error(
                    "pypi_collector.package_failed",
                    package=pkg_cfg.name,
                    error=str(exc),
                )

        logger.info("pypi_collector.done", total=len(all_releases))
        return all_releases

    def collect_package(self, package_name: str) -> list[RawPackageRelease]:
        """Collecte les releases d'un package unique."""
        cfg = PyPIPackageConfig(name=package_name, category="manual")
        return self._collect_package(cfg)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _collect_package(self, pkg_cfg: PyPIPackageConfig) -> list[RawPackageRelease]:
        """Récupère et parse les données PyPI d'un package."""
        url = f"{self.base_url}/{pkg_cfg.name}/json"

        try:
            response = self._session.get(url, timeout=10)
            response.raise_for_status()
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 404:
                logger.warning("pypi_collector.not_found", package=pkg_cfg.name)
                return []
            raise

        data = response.json()
        return self._parse_releases(data, pkg_cfg)

    def _parse_releases(
        self, data: dict, pkg_cfg: PyPIPackageConfig
    ) -> list[RawPackageRelease]:
        """Parse le JSON PyPI en liste de RawPackageRelease."""
        releases: list[RawPackageRelease] = []

        info = data.get("info", {})
        summary = info.get("summary", "")
        requires_python = info.get("requires_python")

        releases_data = data.get("releases", {})

        for version, files in releases_data.items():
            # On ignore les pre-releases (alpha, beta, rc)
            if any(pre in version.lower() for pre in ("a", "b", "rc", "dev", "post")):
                continue

            upload_time = self._extract_upload_time(files)

            releases.append(
                RawPackageRelease(
                    source=SourceType.PYPI,
                    package_name=pkg_cfg.name,
                    version=version,
                    upload_time=upload_time,
                    requires_python=requires_python,
                    summary=summary or None,
                    category=pkg_cfg.category,
                    weight=pkg_cfg.weight,
                )
            )

        return releases

    @staticmethod
    def _extract_upload_time(files: list[dict]) -> datetime | None:
        """Extrait la date d'upload la plus ancienne parmi les fichiers."""
        times: list[datetime] = []

        for file_info in files:
            raw = file_info.get("upload_time_iso_8601") or file_info.get("upload_time")
            if not raw:
                continue
            try:
                dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                times.append(dt.astimezone(timezone.utc).replace(tzinfo=None))
            except (ValueError, AttributeError):
                continue

        return min(times) if times else None
