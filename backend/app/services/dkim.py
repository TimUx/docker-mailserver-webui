"""Service for generating DKIM keys via the rspamd container."""
import re
import subprocess

from app.core.config import get_settings

settings = get_settings()

# Matches quoted TXT record segments in rspamadm dkim_keygen output
_QUOTED_RE = re.compile(r'"([^"]*)"')


class DkimError(Exception):
    pass


class DkimService:
    @staticmethod
    def _key_path(domain: str, selector: str) -> str:
        return f"{settings.rspamd_dkim_path}/{domain}.{selector}.key"

    @staticmethod
    def _parse_dns_record(output: str) -> str:
        """Concatenate all quoted string segments from dkim_keygen output into
        a single DNS TXT record value (e.g. ``v=DKIM1; k=rsa; p=…``)."""
        parts = _QUOTED_RE.findall(output)
        if not parts:
            raise DkimError("Could not parse DNS record from rspamadm output")
        return "".join(parts)

    def generate(self, domain: str, selector: str = "dkim", bits: int = 2048) -> str:
        """Generate a DKIM key pair in the rspamd container and return the
        DNS TXT record value.  The private key is written to
        ``{rspamd_dkim_path}/{domain}.{selector}.key`` inside the container.
        """
        key_path = self._key_path(domain, selector)
        cmd = [
            "docker", "exec", settings.rspamd_container_name,
            "rspamadm", "dkim_keygen",
            "-d", domain,
            "-s", selector,
            "-k", key_path,
            "-b", str(bits),
        ]
        try:
            result = subprocess.run(
                cmd, check=True, capture_output=True, text=True, timeout=30
            )
        except subprocess.CalledProcessError as exc:
            raise DkimError(exc.stderr.strip() or exc.stdout.strip()) from exc
        except subprocess.TimeoutExpired as exc:
            raise DkimError(f"Command timed out: {' '.join(cmd)}") from exc
        except OSError as exc:
            raise DkimError(f"Failed to run docker: {exc}") from exc

        output = result.stdout.strip() or result.stderr.strip()
        return self._parse_dns_record(output)
