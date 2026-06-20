from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.config import settings
from app.database import engine, Base
from app.api.router import router
from app.core.logging import setup_logging, RequestLoggingMiddleware

import app.models

setup_logging(level="DEBUG" if settings.DEBUG else "INFO")

# --- Create Tables ---
Base.metadata.create_all(bind=engine)


# Rate Limiter
limiter = Limiter(key_func=get_remote_address)


# --- App Instance ---
app = FastAPI(
  title = settings.APP_NAME,
  version = settings.APP_VERSION,
  docs_url = "/docs",
  redoc_url = "/redoc",
  swagger_ui_parameters={"persistAuthorization": True},
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(RequestLoggingMiddleware)

# --- CORS ---
app.add_middleware(
  CORSMiddleware,
  allow_origins = settings.cors_origins_list,
  allow_credentials = True,
  allow_methods=["*"],
  allow_headers=["*"],
)

# -- Routers ---
app.include_router(router)


# --- Health Check ---
@app.get("/health", tags=["System"])
def health_check():
  return {
    "status": "OK",
    "app": settings.APP_NAME,
    "version": settings.APP_VERSION
  }

