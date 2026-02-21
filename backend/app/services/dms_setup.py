import shlex
import subprocess
from typing import Sequence

from app.core.config import get_settings

settings = get_settings()


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

    def list_accounts(self) -> list[str]:
        out = self._exec(["email", "list"])
        return [line.strip() for line in out.splitlines() if "@" in line]

    def add_account(self, email: str, password: str) -> str:
        return self._exec(["email", "add", email, password])

    def del_account(self, email: str) -> str:
        return self._exec(["email", "del", email])

    def update_password(self, email: str, password: str) -> str:
        return self._exec(["email", "update", email, password])

    def list_aliases(self) -> list[str]:
        out = self._exec(["alias", "list"])
        return [line.strip() for line in out.splitlines() if line.strip()]

    def add_alias(self, alias: str, destination: str) -> str:
        return self._exec(["alias", "add", alias, destination])

    def del_alias(self, alias: str, destination: str) -> str:
        return self._exec(["alias", "del", alias, destination])

    def list_domains(self) -> list[str]:
        accounts = self.list_accounts()
        domains = sorted({acc.split("@", 1)[1] for acc in accounts if "@" in acc})
        return domains

    def add_domain(self, domain: str) -> str:
        # DMS has no explicit domain add in setup; create tmp account and remove if desired by admin.
        raise DMSSetupError(f"Domain creation is not directly supported by setup; add an account under {shlex.quote(domain)}")
