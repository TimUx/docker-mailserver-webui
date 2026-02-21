from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import csrf_protect, get_current_user
from app.services.stack_integrations import StackIntegrationService

router = APIRouter(prefix="/integrations", tags=["integrations"])
service = StackIntegrationService()


@router.get("/status")
def status(_=Depends(get_current_user)):
    return service.get_status()


@router.post("/{service_name}/restart", dependencies=[Depends(csrf_protect)])
def restart(service_name: str, _=Depends(get_current_user)):
    result = service.restart(service_name)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("message", "restart failed"))
    return result
