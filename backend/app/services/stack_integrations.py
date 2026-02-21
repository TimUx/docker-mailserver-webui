import json
import subprocess
import urllib.error
import urllib.request

from app.core.config import get_settings

settings = get_settings()


class StackIntegrationService:
    @staticmethod
    def _run(cmd: list[str], timeout: int = 15) -> tuple[bool, str]:
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            if result.returncode == 0:
                return True, (result.stdout or "ok").strip()
            return False, (result.stderr or result.stdout or "failed").strip()
        except Exception as exc:
            return False, str(exc)

    def _docker_running(self, container_name: str) -> dict:
        ok, out = self._run(["docker", "inspect", "--format", "{{.State.Status}}", container_name])
        return {
            "container": container_name,
            "status": "running" if ok and out == "running" else "down",
            "message": out,
        }

    def _redis_info(self) -> dict:
        state = self._docker_running(settings.redis_container_name)
        if state["status"] != "running":
            return state
        ok, out = self._run(["docker", "exec", settings.redis_container_name, "redis-cli", "INFO", "server"])
        return {
            **state,
            "status": "running" if ok else "degraded",
            "message": out.splitlines()[0] if out else "redis-cli info executed",
        }

    def _clamav_info(self) -> dict:
        state = self._docker_running(settings.clamav_container_name)
        if state["status"] != "running":
            return state
        ok, out = self._run(["docker", "exec", settings.clamav_container_name, "clamdscan", "--version"])
        return {
            **state,
            "status": "running" if ok else "degraded",
            "message": out.splitlines()[0] if out else "clamdscan version fetched",
        }

    def _rspamd_info(self) -> dict:
        state = self._docker_running(settings.rspamd_container_name)
        if state["status"] != "running":
            return state
        request = urllib.request.Request(settings.rspamd_controller_url)
        if settings.rspamd_controller_password:
            request.add_header("Password", settings.rspamd_controller_password)
        try:
            with urllib.request.urlopen(request, timeout=8) as response:
                data = json.loads(response.read().decode())
            scanned = data.get("scanned", "n/a") if isinstance(data, dict) else "n/a"
            return {
                **state,
                "status": "running",
                "message": f"rspamd controller reachable, scanned={scanned}",
            }
        except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as exc:
            return {
                **state,
                "status": "degraded",
                "message": f"controller unavailable: {exc}",
            }

    def get_status(self) -> dict:
        return {
            "rspamd": self._rspamd_info(),
            "redis": self._redis_info(),
            "clamav": self._clamav_info(),
        }

    def restart(self, service: str) -> dict:
        mapping = {
            "rspamd": settings.rspamd_container_name,
            "redis": settings.redis_container_name,
            "clamav": settings.clamav_container_name,
        }
        if service not in mapping:
            return {"ok": False, "message": "Unknown service"}
        ok, out = self._run(["docker", "restart", mapping[service]], timeout=60)
        return {"ok": ok, "message": out, "service": service}
