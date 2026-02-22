import logging
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.setting import Setting

logger = logging.getLogger(__name__)

EDITABLE_SETTINGS: list[str] = [
    "dms_container_name",
    "dms_setup_path",
    "rspamd_container_name",
    "redis_container_name",
    "clamav_container_name",
    "rspamd_controller_url",
    "rspamd_controller_password",
    "rspamd_web_host",
    "mail_log_path",
    "imapsync_log_path",
    "webui_log_path",
    "scheduler_timezone",
    "cors_origins",
    "admin_email",
    "cookie_secure",
    "access_token_minutes",
    "mailserver_env_path",
]

# Settings whose DB value must be cast to bool
_BOOL_SETTINGS = {"cookie_secure"}
# Settings whose DB value must be cast to int
_INT_SETTINGS = {"access_token_minutes"}


def _cast(key: str, value: str) -> object:
    if key in _BOOL_SETTINGS:
        return value.lower() in ("1", "true", "yes")
    if key in _INT_SETTINGS:
        try:
            return int(value)
        except ValueError:
            return value
    return value


def seed_settings(db: Session) -> None:
    """Populate DB settings from env-var defaults if not already present."""
    env = get_settings()
    for key in EDITABLE_SETTINGS:
        if not db.query(Setting).filter(Setting.key == key).first():
            db.add(Setting(key=key, value=str(getattr(env, key, ""))))
    db.commit()


def load_settings_from_db(db: Session) -> None:
    """Override the cached Settings singleton with values stored in DB."""
    env = get_settings()
    rows = db.query(Setting).filter(Setting.key.in_(EDITABLE_SETTINGS)).all()
    for row in rows:
        try:
            setattr(env, row.key, _cast(row.key, row.value))
        except Exception as exc:
            logger.warning("Failed to apply DB setting %r=%r: %s", row.key, row.value, exc)


def apply_settings_to_db(db: Session, updates: dict[str, str]) -> None:
    """Persist a dict of {key: value} to DB and update the live Settings object."""
    env = get_settings()
    for key, value in updates.items():
        if key not in EDITABLE_SETTINGS:
            continue
        row = db.query(Setting).filter(Setting.key == key).first()
        if row:
            row.value = value
        else:
            db.add(Setting(key=key, value=value))
        try:
            setattr(env, key, _cast(key, value))
        except Exception as exc:
            logger.warning("Failed to apply live setting %r=%r: %s", key, value, exc)
    db.commit()


def read_all_settings(db: Session) -> dict[str, str]:
    """Return all editable settings as a {key: str-value} dict."""
    rows = db.query(Setting).filter(Setting.key.in_(EDITABLE_SETTINGS)).all()
    return {row.key: row.value for row in rows}
