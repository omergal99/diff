"""
Structured logging for Diffinity backend.
Uses stdlib logging — no external deps.
"""

import logging
import sys
import time
from contextlib import contextmanager

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%H:%M:%S"


def get_logger(name: str) -> logging.Logger:
    """Return a named logger configured for Diffinity."""
    logger = logging.getLogger(f"diffinity.{name}")
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)
    return logger


@contextmanager
def timed(logger: logging.Logger, label: str):
    """Context manager that logs how long a block takes."""
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = (time.perf_counter() - start) * 1000
        logger.debug(f"{label} completed in {elapsed:.2f}ms")
