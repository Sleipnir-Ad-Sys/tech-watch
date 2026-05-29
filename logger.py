"""
Logger structuré — utilise structlog pour des logs JSON lisibles.
Configure un logger global réutilisable dans tous les modules.
"""

from __future__ import annotations

import logging
import sys

import structlog

from config import load_settings


def configure_logging() -> None:
    """Initialise structlog avec le niveau de log défini dans les settings."""
    settings = load_settings()
    level = getattr(logging, settings.log_level.upper(), logging.INFO)

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
    )

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer() if settings.environment == "development"
            else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Retourne un logger nommé structlog."""
    return structlog.get_logger(name)
