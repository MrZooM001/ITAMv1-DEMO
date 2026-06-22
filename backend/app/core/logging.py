# /backend/app/core/logging.py

import logging
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# ── JSON Formatter ─────────────────────────────────────────────


class JsonFormatter(logging.Formatter):
    """بيحوّل كل log record لـ JSON line."""

    def format(self, record: logging.LogRecord) -> str:
        log: dict = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # أي extra fields تتضاف تلقائياً
        for key, value in record.__dict__.items():
            if key not in (
                "args",
                "asctime",
                "created",
                "exc_info",
                "exc_text",
                "filename",
                "funcName",
                "id",
                "levelname",
                "levelno",
                "lineno",
                "module",
                "msecs",
                "message",
                "msg",
                "name",
                "pathname",
                "process",
                "processName",
                "relativeCreated",
                "stack_info",
                "thread",
                "threadName",
            ):
                log[key] = value

        if record.exc_info:
            log["exception"] = self.formatException(record.exc_info)

        return json.dumps(log, ensure_ascii=False, default=str)


# ── Setup ──────────────────────────────────────────────────────


def setup_logging(level: str = "INFO") -> None:
    """بيعمل JSON logging لكل الـ app."""

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())

    # Root logger
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    root.handlers = [handler]

    # تخفيف ضوضاء uvicorn access logs
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").propagate = False


# ── Request Logger ─────────────────────────────────────────────

logger = logging.getLogger("itam.request")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware بيسجل كل request/response:
    - request_id فريد لكل request
    - method, path, status_code, duration_ms
    - IP address
    - أي errors بتحصل
    """

    SKIP_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # تجاهل الـ health/docs endpoints
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        request_id = str(uuid.uuid4())[:8]
        start_time = time.perf_counter()

        # أضف الـ request_id للـ request state عشان يتستخدم في الـ services
        request.state.request_id = request_id

        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

            log_level = logging.WARNING if response.status_code >= 400 else logging.INFO

            logger.log(
                log_level,
                "request",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "query": str(request.url.query) or None,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                    "ip": _get_client_ip(request),
                },
            )

            # بعث الـ request_id في الـ response header
            response.headers["X-Request-ID"] = request_id
            return response

        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(
                "unhandled_exception",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
                    "ip": _get_client_ip(request),
                    "error": str(exc),
                },
                exc_info=True,
            )
            raise


def _get_client_ip(request: Request) -> str:
    """بيجيب الـ real IP حتى لو وراء proxy."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
