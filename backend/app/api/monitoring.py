from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.imapsync_job import ImapSyncJob
from app.services.dms_setup import DMSSetupService
from app.services.logs import get_logs
from app.services.stack_integrations import StackIntegrationService

router = APIRouter(tags=["monitoring"])
service = DMSSetupService()
stack = StackIntegrationService()


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), _=Depends(get_current_user)):
    accounts = service.list_accounts()
    aliases = service.list_aliases()
    domains = sorted({a.split('@')[1] for a in accounts if '@' in a})
    active_sync = db.query(ImapSyncJob).filter(ImapSyncJob.enabled.is_(True)).count()
    last_sync = db.query(ImapSyncJob).order_by(ImapSyncJob.last_run_at.desc()).first()
    integrations = stack.get_status()
    mailserver = stack.get_mailserver_status()
    running = sum(1 for v in integrations.values() if v.get("status") == "running")
    degraded = [k for k, v in integrations.items() if v.get("status") != "running"]
    return {
        "domains": len(domains),
        "accounts": len(accounts),
        "aliases": len(aliases),
        "active_sync_jobs": active_sync,
        "last_sync_status": last_sync.last_status if last_sync else "never",
        "system_health": "degraded" if degraded else "ok",
        "security_services_running": running,
        "security_services_total": len(integrations),
        "security_services_degraded": degraded,
        "security_services": integrations,
        "mailserver": mailserver,
    }


@router.get("/logs/{log_type}")
def logs(
    log_type: str,
    lines: int = Query(default=200, ge=10, le=1000),
    search: str | None = Query(default=None),
    _=Depends(get_current_user),
):
    return {"lines": get_logs(log_type, lines, search)}
