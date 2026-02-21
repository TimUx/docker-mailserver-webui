from pathlib import Path

from app.core.config import get_settings

settings = get_settings()


def tail_file(path: Path, lines: int = 200, search: str | None = None) -> list[str]:
    if not path.exists():
        return []
    content = path.read_text(errors="ignore").splitlines()
    if search:
        content = [line for line in content if search.lower() in line.lower()]
    return content[-lines:]


def get_logs(log_type: str, lines: int = 200, search: str | None = None) -> list[str]:
    mapping = {
        "mailserver": Path(settings.mail_log_path) / "mail.log",
        "imapsync": Path(settings.imapsync_log_path) / "job-1.log",
        "webui": Path(settings.webui_log_path) / "app.log",
    }
    if log_type not in mapping:
        return []
    return tail_file(mapping[log_type], lines, search)
