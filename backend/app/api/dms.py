from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import csrf_protect, get_current_user
from app.schemas.dms import AccountCreate, AccountDelete, AliasCreate, AliasDelete, PasswordChange
from app.services.dms_setup import DMSSetupError, DMSSetupService

router = APIRouter(prefix="/dms", tags=["dms"])
service = DMSSetupService()


@router.get("/accounts")
def list_accounts(_=Depends(get_current_user)):
    return {"accounts": service.list_accounts()}


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


@router.get("/aliases")
def list_aliases(_=Depends(get_current_user)):
    return {"aliases": service.list_aliases()}


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
    return {"domains": service.list_domains()}
