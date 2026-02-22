import json
import re
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
                "dashboard_url": "/rspamd-ui/",
            }
        except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as exc:
            return {
                **state,
                "status": "degraded",
                "message": f"controller unavailable: {exc}",
                "dashboard_url": "/rspamd-ui/",
            }

    def _mailserver_info(self) -> dict:
        return self._docker_running(settings.dms_container_name)

    def get_status(self) -> dict:
        return {
            "rspamd": self._rspamd_info(),
            "redis": self._redis_info(),
            "clamav": self._clamav_info(),
        }

    def get_mailserver_status(self) -> dict:
        return self._mailserver_info()

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

    def get_supervisorctl_status(self) -> dict:
        """Return parsed output of ``supervisorctl status`` from the mail-server container."""
        ok, out = self._run(["docker", "exec", settings.dms_container_name, "supervisorctl", "status"])
        processes = []
        for line in out.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            name = parts[0]
            status = parts[1]
            pid = None
            uptime = None
            # parse "pid 123, uptime 0:01:00"
            if "pid" in line:
                m = re.search(r"pid\s+(\d+)", line)
                if m:
                    pid = int(m.group(1))
                m2 = re.search(r"uptime\s+([\d:]+)", line)
                if m2:
                    uptime = m2.group(1)
            processes.append({"name": name, "status": status, "pid": pid, "uptime": uptime})
        return {"ok": ok, "processes": processes, "raw": out if not ok else ""}

    def get_mailq(self) -> dict:
        """Return mail queue information from the mail-server container."""
        ok, out = self._run(["docker", "exec", settings.dms_container_name, "mailq"])
        if not ok:
            return {"ok": False, "count": 0, "entries": [], "raw": out}
        lines = out.strip().splitlines()
        # "Mail queue is empty" means no queued mail
        if not lines or (len(lines) == 1 and "empty" in lines[0].lower()):
            return {"ok": True, "count": 0, "entries": [], "raw": out}
        # Count queue entries: lines starting with a queue-id (hex chars, no whitespace at start)
        entries = []
        count = 0
        for line in lines:
            # Queue ID line: starts with alphanumeric (not whitespace, not a separator)
            if line and line[0] not in (' ', '\t', '-', '\\') and not line.startswith("Mail"):
                m = re.match(r'^(\S+)\s+(\d+)\s+(\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+)$', line)
                if m:
                    count += 1
                    entries.append({
                        "queue_id": m.group(1),
                        "size": int(m.group(2)),
                        "date": m.group(3).strip(),
                        "sender": m.group(4).strip(),
                    })
        return {"ok": True, "count": count, "entries": entries, "raw": out}

    def get_doveadm_who(self) -> dict:
        """Return active IMAP/POP3 sessions from doveadm who."""
        ok, out = self._run(["docker", "exec", settings.dms_container_name, "doveadm", "who"])
        if not ok:
            return {"ok": False, "connections": [], "raw": out}
        connections = []
        lines = out.strip().splitlines()
        # Skip header line
        for line in lines[1:]:
            parts = line.split()
            if len(parts) >= 4:
                connections.append({
                    "username": parts[0],
                    "service": parts[1],
                    "pid": parts[2],
                    "ip": parts[3],
                    "secured": len(parts) > 4 and parts[4].lower() == "secured",
                })
        return {"ok": True, "connections": connections, "count": len(connections)}
