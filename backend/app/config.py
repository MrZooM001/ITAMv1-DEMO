from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ----- Application -----
    APP_NAME: str
    APP_VERSION: str
    DEBUG: bool = False

    # ----- Database -----
    DATABASE_URL: str

    # ----- Authentication -----
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ----- Redis -----
    REDIS_URL: str = "redis://redis:6379/0"

    # ----- CORS -----
    # Comma-separated list of allowed origins, e.g.
    # "https://my-itam-demo.vercel.app,https://app.mydomain.com"
    # Defaults to local dev origins if unset.
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:3030"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    # ----- Platform (default tenant for super-admins) -----
    # This is the slug of the SaaS provider's own tenant.
    # Only users belonging to this tenant AND with role=super_admin
    # can create / manage other tenants.
    PLATFORM_TENANT_SLUG: str = "ITAM"

    # ----- Initial seed (created by seed.py on first boot) -----
    SEED_TENANT_NAME: str = "ITAM"
    SEED_TENANT_SLUG: str = "default"
    SEED_ADMIN_EMAIL: str = "super.admin@itam.com"
    SEED_ADMIN_NAME: str = "Super Admin"
    SEED_ADMIN_PASS: str = "P@$$w0rd"

    # Set "true" only on the public demo deployment (see backend/seed_demo.py)
    SEED_DEMO_DATA: bool = False

    class Config:
        env_file = ".env"


settings = Settings()
