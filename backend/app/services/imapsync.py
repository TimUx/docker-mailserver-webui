import subprocess
from datetime import datetime
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.imapsync_job import ImapSyncJob
from app.services.security import decrypt_secret, encrypt_secret

settings = get_settings()
LOG_DIR = Path(settings.imapsync_log_path)
LOG_DIR.mkdir(parents=True, exist_ok=True)


class ImapSyncService:
    def __init__(self) -> None:
        self.scheduler = BackgroundScheduler(timezone=settings.scheduler_timezone)

    def start(self) -> None:
        if not self.scheduler.running:
            self.scheduler.start()

    def stop(self) -> None:
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)

    def schedule_job(self, job: ImapSyncJob) -> None:
        self.scheduler.add_job(
            self.run_job_by_id,
            "interval",
            minutes=job.interval_minutes,
            id=f"imapsync-{job.id}",
            replace_existing=True,
            kwargs={"job_id": job.id},
        )

    def unschedule_job(self, job_id: int) -> None:
        jid = f"imapsync-{job_id}"
        if self.scheduler.get_job(jid):
            self.scheduler.remove_job(jid)

    def bootstrap(self, db: Session) -> None:
        self.start()
        jobs = db.query(ImapSyncJob).filter(ImapSyncJob.enabled.is_(True)).all()
        for job in jobs:
            self.schedule_job(job)

    def create_job(self, db: Session, data) -> ImapSyncJob:
        job = ImapSyncJob(
            **data.model_dump(exclude={"source_password", "destination_password"}),
            source_password_enc=encrypt_secret(data.source_password),
            destination_password_enc=encrypt_secret(data.destination_password),
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        if job.enabled:
            self.schedule_job(job)
        return job

    def update_job(self, db: Session, job: ImapSyncJob, data) -> ImapSyncJob:
        payload = data.model_dump(exclude_unset=True)
        if "source_password" in payload:
            job.source_password_enc = encrypt_secret(payload.pop("source_password"))
        if "destination_password" in payload:
            job.destination_password_enc = encrypt_secret(payload.pop("destination_password"))
        for key, value in payload.items():
            setattr(job, key, value)
        db.commit()
        db.refresh(job)
        if job.enabled:
            self.schedule_job(job)
        else:
            self.unschedule_job(job.id)
        return job

    def delete_job(self, db: Session, job: ImapSyncJob) -> None:
        self.unschedule_job(job.id)
        db.delete(job)
        db.commit()

    def run_job(self, db: Session, job: ImapSyncJob) -> ImapSyncJob:
        log_file = LOG_DIR / f"job-{job.id}.log"
        cmd = [
            "imapsync",
            "--host1", job.source_host,
            "--user1", job.source_user,
            "--password1", decrypt_secret(job.source_password_enc),
            "--host2", job.destination_host,
            "--user2", job.destination_user,
            "--password2", decrypt_secret(job.destination_password_enc),
            "--port1", str(job.port),
            "--port2", str(job.port),
        ]
        if job.ssl_enabled:
            cmd.extend(["--ssl1", "--ssl2"])
        if not job.verify_cert:
            cmd.extend(["--nosslcheck"])

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
            content = f"{result.stdout}\n{result.stderr}".strip()
            log_file.write_text(content)
            job.last_status = "success" if result.returncode == 0 else "failed"
            job.last_message = content[-4000:]
        except Exception as exc:
            job.last_status = "failed"
            job.last_message = str(exc)
            log_file.write_text(str(exc))

        job.last_run_at = datetime.utcnow()
        db.commit()
        db.refresh(job)
        return job

    def run_job_by_id(self, job_id: int) -> None:
        from app.db.session import SessionLocal

        db = SessionLocal()
        try:
            job = db.query(ImapSyncJob).filter(ImapSyncJob.id == job_id).first()
            if job and job.enabled:
                self.run_job(db, job)
        finally:
            db.close()
