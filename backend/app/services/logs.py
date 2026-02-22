import logging
import subprocess
from pathlib import Path

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def tail_file(path: Path, lines: int = 200, search: str | None = None) -> list[str]:
    if not path.exists():
        return []
    content = path.read_text(errors="ignore").splitlines()
    if search:
        content = [line for line in content if search.lower() in line.lower()]
    return content[-lines:]


def docker_logs(container: str, lines: int = 200, search: str | None = None) -> list[str]:
    """Fetch the last *lines* log lines from a running Docker container.

    Uses ``docker logs --tail`` to retrieve combined stdout/stderr.
    Returns an empty list if the docker command fails or times out,
    allowing callers to fall back to file-based log sources.
    """
    try:
        result = subprocess.run(
            ["docker", "logs", "--tail", str(lines), container],
            capture_output=True,
            text=True,
            timeout=15,
        )
        combined = (result.stdout + result.stderr).splitlines()
        if search:
            combined = [line for line in combined if search.lower() in line.lower()]
        return combined[-lines:]
    except Exception as exc:
        logger.debug("docker_logs failed for container %r: %s", container, exc)
        return []


def get_logs(log_type: str, lines: int = 200, search: str | None = None) -> list[str]:
    if log_type == "mailserver":
        # Prefer docker logs; fall back to mounted log file
        result = docker_logs(settings.dms_container_name, lines, search)
        if result:
            return result
        return tail_file(Path(settings.mail_log_path) / "mail.log", lines, search)
    mapping = {
        "imapsync": Path(settings.imapsync_log_path) / "job-1.log",
        "webui": Path(settings.webui_log_path) / "app.log",
    }
    if log_type not in mapping:
        return []
    return tail_file(mapping[log_type], lines, search)

