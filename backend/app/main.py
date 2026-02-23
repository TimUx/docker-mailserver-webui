from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, dms, dns_wizard, imapsync, integrations, mail_profile, monitoring, settings as settings_router_module
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.user import User
from app.models.alias_note import AliasNote  # noqa: F401 – ensure table is created
from app.models.managed_domain import ManagedDomain  # noqa: F401 – ensure table is created
from app.services.security import hash_password
from app.services.settings import load_settings_from_db, seed_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.email == settings.admin_email).first():
            db.add(User(email=settings.admin_email, hashed_password=hash_password(settings.admin_password), is_admin=True))
            db.commit()
        # Seed DB settings from env vars on first run, then load DB values into runtime
        seed_settings(db)
        load_settings_from_db(db)
    finally:
        db.close()
    if not settings.cookie_secure:
        logger.warning("COOKIE_SECURE is False – session cookies are not Secure-flagged. Set COOKIE_SECURE=true when serving over HTTPS.")
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_v1_prefix)
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
