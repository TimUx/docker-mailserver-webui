from sqlalchemy.orm import Session

from app.models.imapsync_job import ImapSyncJob
from app.services.security import encrypt_secret


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

    def create_job(self, db: Session, data) -> ImapSyncJob:
        job = ImapSyncJob(
            **data.model_dump(exclude={"source_password", "destination_password"}),
            source_password_enc=encrypt_secret(data.source_password),
            destination_password_enc=encrypt_secret(data.destination_password),
            last_status="managed",
            last_message="Managed by WebUI. Run this job with your external IMAPSync container.",
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
        job.last_status = "managed"
        job.last_message = "Managed by WebUI. Run this job with your external IMAPSync container."
        db.commit()
        db.refresh(job)
        return job

    def delete_job(self, db: Session, job: ImapSyncJob) -> None:
        db.delete(job)
        db.commit()
