from fastapi import APIRouter, Depends, HTTPException
import logging
from sqlalchemy.orm import Session

from app.api.deps import csrf_protect, get_current_user
from app.db.session import get_db
from app.models.account_note import AccountNote
from app.models.managed_domain import ManagedDomain
from app.schemas.dms import AccountCreate, AccountDelete, AccountNoteUpdate, AliasCreate, AliasDelete, DomainCreate, DomainDelete, PasswordChange, QuotaSet
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
        result = service.add_account(payload.email, payload.password)
    except DMSSetupError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if payload.quota:
        try:
            service.set_quota(payload.email, payload.quota)
        except DMSSetupError as exc:
            # Account was created but quota could not be set; surface the partial failure.
            raise HTTPException(
                status_code=207,
                detail=f"Account created, but setting quota failed: {exc}",
            ) from exc
    return {"message": result}


@router.delete("/accounts", dependencies=[Depends(csrf_protect)])
def delete_account(payload: AccountDelete, _=Depends(get_current_user)):
    try:
        return {"message": service.del_account(payload.email)}
    except DMSSetupError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/accounts/quota", dependencies=[Depends(csrf_protect)])
def set_quota(payload: QuotaSet, _=Depends(get_current_user)):
    try:
        return {"message": service.set_quota(payload.email, payload.quota)}
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
def list_domains(db: Session = Depends(get_db), _=Depends(get_current_user)):
    try:
        account_domains = service.list_domains()
    except DMSSetupError as exc:
        logger.warning("list_domains failed: %s", exc)
        account_domains = []
    managed = db.query(ManagedDomain).order_by(ManagedDomain.domain).all()
    managed_names = {m.domain for m in managed}
    # Merge: managed domains first, then any account-derived domains not yet managed
    extra = sorted(d for d in account_domains if d not in managed_names)
    result = [{"domain": m.domain, "description": m.description, "managed": True} for m in managed]
    result += [{"domain": d, "description": "", "managed": False} for d in extra]
    return {"domains": result}


@router.post("/domains", dependencies=[Depends(csrf_protect)])
def create_domain(payload: DomainCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if db.query(ManagedDomain).filter(ManagedDomain.domain == payload.domain).first():
        raise HTTPException(status_code=400, detail="Domain already exists")
    db.add(ManagedDomain(domain=payload.domain, description=payload.description))
    db.commit()
    return {"ok": True, "domain": payload.domain}


@router.delete("/domains", dependencies=[Depends(csrf_protect)])
def delete_domain(payload: DomainDelete, db: Session = Depends(get_db), _=Depends(get_current_user)):
    record = db.query(ManagedDomain).filter(ManagedDomain.domain == payload.domain).first()
    if not record:
        raise HTTPException(status_code=404, detail="Domain not found in managed domains")
    db.delete(record)
    db.commit()
    return {"ok": True}
