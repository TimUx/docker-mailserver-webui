import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import csrf_protect, get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.schemas.settings import DmsEnvUpdate, SettingsUpdate
from app.services.dms_env import DMS_ENV_SETTINGS, read_mailserver_env, write_mailserver_env
from app.services.settings import apply_settings_to_db, read_all_settings

router = APIRouter(prefix="/settings", tags=["settings"])
logger = logging.getLogger(__name__)


@router.get("/")
def get_settings_endpoint(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return read_all_settings(db)


@router.put("/", dependencies=[Depends(csrf_protect)])
def update_settings_endpoint(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    apply_settings_to_db(db, payload.settings)
    return {"ok": True}


@router.get("/dms-env")
def get_dms_env(_=Depends(get_current_user)):
    """Return current mailserver.env values and the settings schema."""
    cfg = get_settings()
    values = read_mailserver_env(cfg.mailserver_env_path)
    return {"values": values, "schema": DMS_ENV_SETTINGS, "path": cfg.mailserver_env_path}


@router.put("/dms-env", dependencies=[Depends(csrf_protect)])
def update_dms_env(payload: DmsEnvUpdate, _=Depends(get_current_user)):
    """Persist DMS env settings to mailserver.env on disk."""
    cfg = get_settings()
    try:
        write_mailserver_env(cfg.mailserver_env_path, payload.settings)
    except OSError as exc:
        logger.error("Failed to write mailserver.env at %r: %s", cfg.mailserver_env_path, exc)
        raise HTTPException(status_code=500, detail=f"Cannot write mailserver.env: {exc}") from exc
    return {"ok": True}

