"""
RSS Collector — parse les feeds RSS/Atom définis dans config.yaml.

Utilise feedparser pour la compatibilité maximale (RSS 2.0, Atom, RDF).
Normalise les dates et extrait les métadonnées clés.
"""

from __future__ import annotations

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import feedparser

from config import FeedConfig, load_config
from logger import get_logger
from models import RawArticle, SourceType

logger = get_logger(__name__)


class RSSCollector:
    """Parse et collecte les articles depuis des flux RSS/Atom."""

    def __init__(self) -> None:
        self.config = load_config()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def collect_all(self) -> list[RawArticle]:
        """Collecte les articles de tous les feeds configurés."""
        all_articles: list[RawArticle] = []
        feeds = self.config.rss.feeds

        logger.info("rss_collector.start", feed_count=len(feeds))

        for feed_cfg in feeds:
            try:
                articles = self._collect_feed(feed_cfg)
                all_articles.extend(articles)
                logger.info(
                    "rss_collector.feed_done",
                    feed=feed_cfg.name,
                    count=len(articles),
                )
            except Exception as exc:
                logger.error(
                    "rss_collector.feed_failed",
                    feed=feed_cfg.name,
                    url=feed_cfg.url,
                    error=str(exc),
                )

        logger.info("rss_collector.done", total=len(all_articles))
        return all_articles

    def collect_feed(self, url: str, name: str = "custom", category: str = "") -> list[RawArticle]:
        """Parse un feed RSS unique (utilitaire CLI)."""
        cfg = FeedConfig(name=name, url=url, category=category)
        return self._collect_feed(cfg)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _collect_feed(self, feed_cfg: FeedConfig) -> list[RawArticle]:
        """Parse un feed feedparser et retourne une liste RawArticle."""
        parsed = feedparser.parse(feed_cfg.url)

        # feedparser ne lève pas d'exception en cas d'erreur réseau
        if parsed.get("bozo") and parsed.get("bozo_exception"):
            exc = parsed["bozo_exception"]
            logger.warning(
                "rss_collector.parse_warning",
                feed=feed_cfg.name,
                error=str(exc),
            )

        articles: list[RawArticle] = []

        for entry in parsed.entries:
            article = self._parse_entry(entry, feed_cfg)
            if article:
                articles.append(article)

        return articles

    def _parse_entry(self, entry: feedparser.FeedParserDict, feed_cfg: FeedConfig) -> RawArticle | None:
        """Convertit une entrée feedparser en RawArticle."""
        try:
            title = entry.get("title", "").strip()
            url = entry.get("link", "").strip()

            if not title or not url:
                return None

            # Extraction résumé — supporte summary et content
            summary = ""
            if entry.get("summary"):
                summary = entry["summary"][:1000]
            elif entry.get("content"):
                summary = entry["content"][0].get("value", "")[:1000]

            # Normalisation de la date
            published_at = self._parse_date(entry)

            return RawArticle(
                source=SourceType.RSS,
                feed_name=feed_cfg.name,
                title=title,
                url=url,
                summary=summary or None,
                published_at=published_at,
                category=feed_cfg.category,
            )

        except Exception as exc:
            logger.warning(
                "rss_collector.entry_error",
                feed=feed_cfg.name,
                title=entry.get("title"),
                error=str(exc),
            )
            return None

    @staticmethod
    def _parse_date(entry: feedparser.FeedParserDict) -> datetime | None:
        """Extrait et normalise la date de publication d'une entrée."""
        # feedparser fournit published_parsed ou updated_parsed (struct_time)
        for attr in ("published_parsed", "updated_parsed"):
            struct = entry.get(attr)
            if struct:
                try:
                    dt = datetime(*struct[:6], tzinfo=timezone.utc)
                    return dt.replace(tzinfo=None)
                except (ValueError, TypeError):
                    continue

        # Fallback : parser la chaîne brute
        for attr in ("published", "updated"):
            raw = entry.get(attr, "")
            if raw:
                try:
                    dt = parsedate_to_datetime(raw)
                    return dt.astimezone(timezone.utc).replace(tzinfo=None)
                except Exception:
                    continue

        return None
