from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import csrf_protect, get_current_user
from app.db.session import get_db
from app.schemas.settings import SettingsUpdate
from app.services.settings import apply_settings_to_db, read_all_settings

router = APIRouter(prefix="/settings", tags=["settings"])


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
