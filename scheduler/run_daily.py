"""
Run Daily — scheduler quotidien du pipeline de veille.

Utilise APScheduler pour exécuter le pipeline complet chaque jour à l'heure
configurée dans config.yaml (scheduler.cron).

Peut aussi être déclenché directement via GitHub Actions (cron workflow).

Usage :
    python -m scheduler.run_daily          # Lance le scheduler en boucle
    python -m scheduler.run_daily --once   # Exécute une seule fois immédiatement
"""

from __future__ import annotations

import argparse
import sys

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from config import load_config
from logger import configure_logging, get_logger
from scripts.run_pipeline import run_pipeline

configure_logging()
logger = get_logger(__name__)


def job() -> None:
    """Tâche planifiée — exécute le pipeline complet."""
    logger.info("scheduler.job_start")
    try:
        run_pipeline()
        logger.info("scheduler.job_success")
    except Exception as exc:
        logger.error("scheduler.job_failed", error=str(exc))


def main() -> None:
    parser = argparse.ArgumentParser(description="Tech Watch scheduler")
    parser.add_argument(
        "--once",
        action="store_true",
        help="Exécuter le pipeline une seule fois immédiatement",
    )
    args = parser.parse_args()

    cfg = load_config()

    if args.once:
        logger.info("scheduler.run_once")
        job()
        return

    if not cfg.scheduler.enabled:
        logger.warning("scheduler.disabled")
        sys.exit(0)

    # Parsing du cron "0 7 * * *" → minute=0, hour=7
    cron_parts = cfg.scheduler.cron.split()
    if len(cron_parts) != 5:
        logger.error("scheduler.invalid_cron", cron=cfg.scheduler.cron)
        sys.exit(1)

    minute, hour, day, month, day_of_week = cron_parts

    trigger = CronTrigger(
        minute=minute,
        hour=hour,
        day=day,
        month=month,
        day_of_week=day_of_week,
        timezone=cfg.scheduler.timezone,
    )

    scheduler = BlockingScheduler(timezone=cfg.scheduler.timezone)
    scheduler.add_job(job, trigger, id="tech_watch_daily", replace_existing=True)

    logger.info(
        "scheduler.start",
        cron=cfg.scheduler.cron,
        timezone=cfg.scheduler.timezone,
    )

    try:
        scheduler.start()
    except KeyboardInterrupt:
        logger.info("scheduler.stopped")
        scheduler.shutdown()


if __name__ == "__main__":
    main()
