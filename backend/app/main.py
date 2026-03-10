from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.api import auth, dkim, dms, dns_wizard, imapsync, integrations, mail_profile, monitoring, settings as settings_router_module
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.user import User
from app.models.alias_note import AliasNote  # noqa: F401 – ensure table is created
from app.models.dkim_key import DkimKey  # noqa: F401 – ensure table is created
from app.models.imapsync_job import ImapSyncJob  # noqa: F401 – ensure table is created
from app.models.managed_domain import ManagedDomain  # noqa: F401 – ensure table is created
from app.services.runtime import get_imapsync_service
from app.services.security import hash_password, verify_password
from app.services.settings import load_settings_from_db, seed_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _run_migrations() -> None:
    """Apply any schema changes that create_all() cannot handle (existing tables).

    Add new entries here whenever a column is added to an existing model so that
    deployments upgrading from an older version get the column automatically.
    """
    inspector = inspect(engine)
    if "imapsync_jobs" in inspector.get_table_names():
        existing_columns = {col["name"] for col in inspector.get_columns("imapsync_jobs")}
        if "mirror" not in existing_columns:
            # Default 0 (False): existing jobs were created without mirror mode, so
            # treating them as non-mirror preserves their original behaviour.
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE imapsync_jobs ADD COLUMN mirror BOOLEAN NOT NULL DEFAULT 0"))
                conn.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.email == settings.admin_email).first()
        if admin_user is None:
            # If exactly one admin exists with a different email this is an
            # email-change scenario – migrate that user instead of creating a
            # duplicate so the operator's existing sessions/data are preserved.
            existing_admin_count = db.query(User).filter(User.is_admin.is_(True)).count()
            if existing_admin_count == 1:
                admin_user = db.query(User).filter(User.is_admin.is_(True)).first()
                admin_user.email = settings.admin_email
                admin_user.hashed_password = hash_password(settings.admin_password)
                db.commit()
                logger.info("Migrated admin user email to %s", settings.admin_email)
            else:
                db.add(User(email=settings.admin_email, hashed_password=hash_password(settings.admin_password), is_admin=True))
                db.commit()
                logger.info("Created admin user %s", settings.admin_email)
        else:
            # Admin email already matches; sync the password if it changed in
            # the environment so that updating ADMIN_PASSWORD takes effect on
            # the next container restart without requiring a DB wipe.
            if not verify_password(settings.admin_password, admin_user.hashed_password):
                admin_user.hashed_password = hash_password(settings.admin_password)
                db.commit()
                logger.info("Updated admin password for %s", settings.admin_email)
        # Seed DB settings from env vars on first run, then load DB values into runtime
        seed_settings(db)
        load_settings_from_db(db)
        get_imapsync_service().bootstrap(db)
    finally:
        db.close()
    if not settings.cookie_secure:
        logger.warning("COOKIE_SECURE is False – session cookies are not Secure-flagged. Set COOKIE_SECURE=true when serving over HTTPS.")
    yield
    get_imapsync_service().stop()


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(dkim.router, prefix=settings.api_v1_prefix)
app.include_router(dms.router, prefix=settings.api_v1_prefix)
app.include_router(dns_wizard.router, prefix=settings.api_v1_prefix)
app.include_router(imapsync.router, prefix=settings.api_v1_prefix)
app.include_router(integrations.router, prefix=settings.api_v1_prefix)
app.include_router(mail_profile.router, prefix=settings.api_v1_prefix)
app.include_router(monitoring.router, prefix=settings.api_v1_prefix)
app.include_router(settings_router_module.router, prefix=settings.api_v1_prefix)


@app.get("/health")
def health():
    return {"status": "ok"}
