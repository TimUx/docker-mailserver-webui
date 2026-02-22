import re
import shlex
import subprocess
from typing import Sequence

from app.core.config import get_settings

settings = get_settings()

# Matches a valid email address within a line
_EMAIL_RE = re.compile(r'[\w.!#$%&\'*+/=?^_`{|}~-]+@[\w.-]+\.[a-zA-Z]{2,}')
# Matches quota info: "( used / limit ) [pct%]"
_QUOTA_RE = re.compile(r'\(\s*(\S+)\s*/\s*(\S+)\s*\)\s*\[(\d+)%\]')


class DMSSetupError(Exception):
    pass


class DMSSetupService:
    @staticmethod
    def _exec(args: Sequence[str]) -> str:
        safe_args = [str(a) for a in args]
        cmd = ["docker", "exec", settings.dms_container_name, settings.dms_setup_path, *safe_args]
        try:
            result = subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=30)
            return result.stdout.strip()
        except subprocess.CalledProcessError as exc:
            raise DMSSetupError(exc.stderr.strip() or exc.stdout.strip()) from exc
        except subprocess.TimeoutExpired as exc:
            raise DMSSetupError(f"Command timed out after {exc.timeout}s: {' '.join(cmd)}") from exc
        except OSError as exc:
            raise DMSSetupError(f"Failed to run docker: {exc}") from exc

    def list_accounts(self) -> list[dict]:
        """Return a list of account dicts with email and quota information.

        Alias lines (containing '->') are excluded so only real mailbox
        accounts are returned.
        """
        out = self._exec(["email", "list"])
        accounts = []
        for line in out.splitlines():
            line = line.strip()
            # Skip alias lines such as "[ aliases -> game@domain.com ]"
            if "->" in line:
                continue
            m = _EMAIL_RE.search(line)
            if not m:
                continue
            email = m.group(0)
            quota_m = _QUOTA_RE.search(line)
            accounts.append({
                "email": email,
                "quota_used": quota_m.group(1) if quota_m else None,
                "quota_limit": quota_m.group(2) if quota_m else None,
                "quota_pct": int(quota_m.group(3)) if quota_m else None,
            })
        return accounts

    def add_account(self, email: str, password: str) -> str:
        return self._exec(["email", "add", email, password])

    def del_account(self, email: str) -> str:
        return self._exec(["email", "del", email])

    def update_password(self, email: str, password: str) -> str:
        return self._exec(["email", "update", email, password])

    def set_quota(self, email: str, quota: str) -> str:
        """Set the mailbox quota for *email*.

        *quota* is passed directly to ``setup quota set``, e.g. ``"1G"``,
        ``"500M"``, or ``"0"`` to remove the quota limit.
        """
        return self._exec(["quota", "set", email, quota])

    def list_aliases(self) -> list[str]:
        out = self._exec(["alias", "list"])
        return [line.strip() for line in out.splitlines() if line.strip()]

    def add_alias(self, alias: str, destination: str) -> str:
        return self._exec(["alias", "add", alias, destination])

    def del_alias(self, alias: str, destination: str) -> str:
        return self._exec(["alias", "del", alias, destination])

    def list_domains(self) -> list[str]:
        accounts = self.list_accounts()
        domains = sorted({acc["email"].split("@", 1)[1] for acc in accounts})
        return domains

    def add_domain(self, domain: str) -> str:
        # DMS has no explicit domain add in setup; create tmp account and remove if desired by admin.
        raise DMSSetupError(f"Domain creation is not directly supported by setup; add an account under {shlex.quote(domain)}")
