from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
import json
import urllib.error
import urllib.request

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.imapsync_job import ImapSyncJob
from app.services.dms_setup import DMSSetupService
from app.services.logs import get_logs
from app.services.stack_integrations import StackIntegrationService

router = APIRouter(tags=["monitoring"])
service = DMSSetupService()
stack = StackIntegrationService()
_settings = get_settings()


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), _=Depends(get_current_user)):
    try:
        accounts = service.list_accounts()
    except Exception:
        accounts = []
    try:
        aliases = service.list_aliases()
    except Exception:
        aliases = []
    domains = sorted({a["email"].split('@')[1] for a in accounts})
    active_sync = db.query(ImapSyncJob).filter(ImapSyncJob.enabled.is_(True)).count()
    last_sync = db.query(ImapSyncJob).order_by(ImapSyncJob.last_run_at.desc()).first()
    try:
        integrations = stack.get_status()
    except Exception as exc:
        integrations = {
            name: {"container": name, "status": "unknown", "message": str(exc)}
            for name in ("rspamd", "redis", "clamav")
        }
    try:
        mailserver = stack.get_mailserver_status()
    except Exception as exc:
        mailserver = {"container": "mail-server", "status": "unknown", "message": str(exc)}
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


@router.get("/observability")
def observability(_=Depends(get_current_user)):
    """Return detailed observability data for Rspamd and other services."""
    rspamd_stats = _fetch_rspamd_stats()
    services = stack.get_status()
    mailserver = stack.get_mailserver_status()
    return {
        "services": {**services, "mailserver": mailserver},
        "rspamd": rspamd_stats,
    }


def _fetch_rspamd_stats() -> dict:
    """Fetch detailed stats from Rspamd controller API."""
    try:
        base_url = _settings.rspamd_controller_url.removesuffix("/stat").rstrip("/")
    except (AttributeError, TypeError) as exc:
        return {"stat": {"error": str(exc)}, "actions": {}, "symbols": {}}
    endpoints = {
        "stat": f"{base_url}/stat",
        "actions": f"{base_url}/actions",
        "symbols": f"{base_url}/symbols",
    }
    result: dict = {}
    for key, url in endpoints.items():
        try:
            req = urllib.request.Request(url)
            if _settings.rspamd_controller_password:
                req.add_header("Password", _settings.rspamd_controller_password)
            with urllib.request.urlopen(req, timeout=5) as resp:
                result[key] = json.loads(resp.read().decode())
        except Exception as exc:
            result[key] = {"error": str(exc)}
    return result


@router.get("/logs/{log_type}")
def logs(
    log_type: str,
    lines: int = Query(default=200, ge=10, le=1000),
    search: str | None = Query(default=None),
    _=Depends(get_current_user),
):
    return {"lines": get_logs(log_type, lines, search)}
