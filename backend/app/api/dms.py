from fastapi import APIRouter, Depends, HTTPException
import logging
from sqlalchemy.orm import Session

from app.api.deps import csrf_protect, get_current_user
from app.db.session import get_db
from app.models.account_note import AccountNote
from app.schemas.dms import AccountCreate, AccountDelete, AccountNoteUpdate, AliasCreate, AliasDelete, PasswordChange
from app.services.dms_setup import DMSSetupError, DMSSetupService

router = APIRouter(prefix="/dms", tags=["dms"])
service = DMSSetupService()
logger = logging.getLogger(__name__)


@router.get("/accounts")
def list_accounts(db: Session = Depends(get_db), _=Depends(get_current_user)):
    try:
        accounts = service.list_accounts()
    except DMSSetupError as exc:
        logger.warning("list_accounts failed: %s", exc)
        accounts = []
    notes = {n.email: n.note for n in db.query(AccountNote).all()}
    return {"accounts": accounts, "notes": notes}


@router.post("/accounts", dependencies=[Depends(csrf_protect)])
def create_account(payload: AccountCreate, _=Depends(get_current_user)):
    try:
        return {"message": service.add_account(payload.email, payload.password)}
    except DMSSetupError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/accounts", dependencies=[Depends(csrf_protect)])
def delete_account(payload: AccountDelete, _=Depends(get_current_user)):
    try:
        return {"message": service.del_account(payload.email)}
    except DMSSetupError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/accounts/password", dependencies=[Depends(csrf_protect)])
def change_password(payload: PasswordChange, _=Depends(get_current_user)):
    try:
        return {"message": service.update_password(payload.email, payload.password)}
    except DMSSetupError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/accounts/notes", dependencies=[Depends(csrf_protect)])
def update_account_note(payload: AccountNoteUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    note = db.query(AccountNote).filter(AccountNote.email == payload.email).first()
    if note:
        note.note = payload.note
    else:
        db.add(AccountNote(email=payload.email, note=payload.note))
    db.commit()
    return {"ok": True}


@router.get("/aliases")
def list_aliases(_=Depends(get_current_user)):
    try:
        return {"aliases": service.list_aliases()}
    except DMSSetupError as exc:
        logger.warning("list_aliases failed: %s", exc)
        return {"aliases": []}


@router.post("/aliases", dependencies=[Depends(csrf_protect)])
def create_alias(payload: AliasCreate, _=Depends(get_current_user)):
    try:
        return {"message": service.add_alias(payload.alias, payload.destination)}
    except DMSSetupError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/aliases", dependencies=[Depends(csrf_protect)])
def delete_alias(payload: AliasDelete, _=Depends(get_current_user)):
    try:
        return {"message": service.del_alias(payload.alias, payload.destination)}
    except DMSSetupError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/domains")
def list_domains(_=Depends(get_current_user)):
    try:
        return {"domains": service.list_domains()}
    except DMSSetupError as exc:
        logger.warning("list_domains failed: %s", exc)
        return {"domains": []}
