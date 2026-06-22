import sys
import uuid

sys.path.insert(0, "/app")

from app.database import SessionLocal
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.core.security import hash_password
from app.config import settings

TENANT_NAME = settings.SEED_TENANT_NAME
TENANT_SLUG = settings.SEED_TENANT_SLUG
ADMIN_EMAIL = settings.SEED_ADMIN_EMAIL
ADMIN_NAME = settings.SEED_ADMIN_NAME
ADMIN_PASS = settings.SEED_ADMIN_PASS


def seed():
    db = SessionLocal()
    try:
        # ── Tenant ─────────────────────────────────────────────
        tenant = db.query(Tenant).filter(Tenant.slug == TENANT_SLUG).first()
        if not tenant:
            tenant = Tenant(
                id=uuid.uuid4(),
                name=TENANT_NAME,
                slug=TENANT_SLUG,
                is_active=True,
            )
            db.add(tenant)
            db.flush()
            print(f"  ✅ Tenant created: {tenant.name}")
        else:
            print(f"  ⏭  Tenant exists: {tenant.name}")

        # ── Super Admin ─────────────────────────────────────────
        user = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        if not user:
            user = User(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                full_name=ADMIN_NAME,
                email=ADMIN_EMAIL,
                password_hash=hash_password(ADMIN_PASS),
                role=UserRole.super_admin,
                is_active=True,
            )
            db.add(user)
            db.commit()
            print(f"  ✅ Super Admin created: {ADMIN_EMAIL} / {ADMIN_PASS}")
        else:
            print(f"  ⏭  Super Admin exists: {user.email}")

        db.commit()

    except Exception as e:
        db.rollback()
        print(f"  ❌ Seed error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
