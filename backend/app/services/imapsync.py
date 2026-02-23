import logging
import re
import subprocess
import threading
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.imapsync_job import ImapSyncJob
from app.services.security import decrypt_secret, encrypt_secret

logger = logging.getLogger(__name__)
_MAX_MESSAGE_LENGTH = 300


def _parse_transferred(output: str) -> str | None:
    """Extract a short transfer-stats summary from imapsync output."""
    # Try to build a multi-line summary from the key imapsync stats lines.
    stat_patterns = (
        r"Folders synced\s*:[^\n]*",
        r"Messages transferred\s*:[^\n]*",
        r"Total bytes transferred\s*:[^\n]*",
    )
    stats = []
    for pattern in stat_patterns:
        m = re.search(pattern, output, re.IGNORECASE)
        if m:
            stats.append(m.group(0).strip())
    if stats:
        return "\n".join(stats)

    # Fallback: single-line summary patterns
    for pattern in (
        r"Transferred:[^\n]*",
        r"Exiting with return value \d+",
    ):
        m = re.search(pattern, output, re.IGNORECASE)
        if m:
            return m.group(0).strip()
    return None


class ImapSyncService:
    def start(self) -> None:
        return

    def stop(self) -> None:
        return

    def schedule_job(self, job: ImapSyncJob) -> None:
        return

    def unschedule_job(self, job_id: int) -> None:
        return

    def bootstrap(self, db: Session) -> None:
        return

    # ------------------------------------------------------------------
    # Manual / on-demand sync
    # ------------------------------------------------------------------

    def run_job_background(self, job_id: int) -> None:
        """Spawn a background thread to run imapsync for the given job."""
        t = threading.Thread(target=self._run_job, args=(job_id,), daemon=True)
        t.start()

    def _run_job(self, job_id: int) -> None:
        """Run imapsync via Docker and update the job record with results."""
        from app.core.config import get_settings
        from app.db.session import SessionLocal

        settings = get_settings()
        db = SessionLocal()
        try:
            job = db.query(ImapSyncJob).filter(ImapSyncJob.id == job_id).first()
            if not job:
                return

            job.last_status = "running"
            job.last_run_at = datetime.now(timezone.utc)
            job.last_message = "Sync in progress…"
            db.commit()

            src_pass = decrypt_secret(job.source_password_enc)
            dst_pass = decrypt_secret(job.destination_password_enc)

            log_dir = Path(settings.imapsync_log_path)
            log_dir.mkdir(parents=True, exist_ok=True)
            log_file = log_dir / f"job-{job_id}.log"

            cmd = [
                "docker", "exec", settings.imapsync_container_name, "imapsync",
                "--host1", job.source_host,
                "--user1", job.source_user,
                "--password1", src_pass,
                "--host2", job.destination_host,
                "--user2", job.destination_user,
                "--password2", dst_pass,
                "--port1", str(job.port),
                "--port2", str(job.port),
            ]
            if job.ssl_enabled:
                cmd += ["--ssl1", "--ssl2"]
            if not job.verify_cert:
                cmd += ["--tls1", "--tls2"]

            logger.info("Running imapsync for job %d: %s → %s", job_id, job.source_user, job.destination_user)
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=7200)
                output = result.stdout + result.stderr
                status = "ok" if result.returncode == 0 else "error"
            except subprocess.TimeoutExpired:
                output = "imapsync timed out after 2 hours"
                status = "error"
            except Exception as exc:
                output = str(exc)
                status = "error"

            # Write log file
            try:
                log_file.write_text(output, errors="replace")
            except Exception as exc:
                logger.warning("Could not write imapsync log for job %d: %s", job_id, exc)

            transferred = _parse_transferred(output)
            message = transferred or (output.strip()[-_MAX_MESSAGE_LENGTH:] if output.strip() else "No output")

            # Reload job in case it was updated while running
            db.expire(job)
            job = db.query(ImapSyncJob).filter(ImapSyncJob.id == job_id).first()
            if job:
                job.last_status = status
                job.last_message = message
                job.last_run_at = datetime.now(timezone.utc)
                db.commit()
        except Exception as exc:
            logger.error("Unexpected error in imapsync background job %d: %s", job_id, exc)
            try:
                job = db.query(ImapSyncJob).filter(ImapSyncJob.id == job_id).first()
                if job:
                    job.last_status = "error"
                    job.last_message = str(exc)
                    db.commit()
            except Exception:
                pass
        finally:
            db.close()

    def create_job(self, db: Session, data) -> ImapSyncJob:
        job = ImapSyncJob(
            **data.model_dump(exclude={"source_password", "destination_password"}),
            source_password_enc=encrypt_secret(data.source_password),
            destination_password_enc=encrypt_secret(data.destination_password),
            last_status="pending",
            last_message="Job created – press ▶ to run a manual sync.",
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    def update_job(self, db: Session, job: ImapSyncJob, data) -> ImapSyncJob:
        payload = data.model_dump(exclude_unset=True)
        if "source_password" in payload:
            job.source_password_enc = encrypt_secret(payload.pop("source_password"))
        if "destination_password" in payload:
            job.destination_password_enc = encrypt_secret(payload.pop("destination_password"))
        for key, value in payload.items():
            setattr(job, key, value)
        job.last_status = "pending"
        job.last_message = "Job updated – press ▶ to run a manual sync."
        db.commit()
        db.refresh(job)
        return job

    def delete_job(self, db: Session, job: ImapSyncJob) -> None:
        db.delete(job)
        db.commit()
