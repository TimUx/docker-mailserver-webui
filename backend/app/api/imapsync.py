from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import csrf_protect, get_current_user
from app.db.session import get_db
from app.models.imapsync_job import ImapSyncJob
from app.schemas.imapsync import ImapSyncJobCreate, ImapSyncJobRead, ImapSyncJobUpdate
from app.services.runtime import get_imapsync_service

router = APIRouter(prefix="/imapsync", tags=["imapsync"])


@router.get("", response_model=list[ImapSyncJobRead])
def list_jobs(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(ImapSyncJob).all()


@router.post("", response_model=ImapSyncJobRead, dependencies=[Depends(csrf_protect)])
def create_job(payload: ImapSyncJobCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return get_imapsync_service().create_job(db, payload)


@router.put("/{job_id}", response_model=ImapSyncJobRead, dependencies=[Depends(csrf_protect)])
def update_job(job_id: int, payload: ImapSyncJobUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    job = db.query(ImapSyncJob).filter(ImapSyncJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return get_imapsync_service().update_job(db, job, payload)


@router.delete("/{job_id}", dependencies=[Depends(csrf_protect)])
def delete_job(job_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    job = db.query(ImapSyncJob).filter(ImapSyncJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    get_imapsync_service().delete_job(db, job)
    return {"message": "Deleted"}


@router.post("/{job_id}/run", response_model=ImapSyncJobRead, dependencies=[Depends(csrf_protect)])
def run_job(job_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    job = db.query(ImapSyncJob).filter(ImapSyncJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return get_imapsync_service().run_job(db, job)
