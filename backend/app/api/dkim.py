from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import csrf_protect, get_current_user
from app.db.session import get_db
from app.models.dkim_key import DkimKey
from app.schemas.dkim import DkimGenerate
from app.services.dkim import DkimError, DkimService

router = APIRouter(prefix="/dkim", tags=["dkim"])
service = DkimService()


@router.get("")
def list_keys(db: Session = Depends(get_db), _=Depends(get_current_user)):
    keys = db.query(DkimKey).order_by(DkimKey.domain, DkimKey.selector).all()
    return {
        "keys": [
            {
                "domain": k.domain,
                "selector": k.selector,
                "dns_record": k.dns_record,
                "created_at": k.created_at.isoformat() if k.created_at else None,
            }
            for k in keys
        ]
    }


@router.get("/{domain}")
def get_key(domain: str, selector: str = "dkim", db: Session = Depends(get_db), _=Depends(get_current_user)):
    key = db.query(DkimKey).filter(DkimKey.domain == domain, DkimKey.selector == selector).first()
    if not key:
        raise HTTPException(status_code=404, detail="DKIM key not found for this domain")
    return {
        "domain": key.domain,
        "selector": key.selector,
        "dns_record": key.dns_record,
        "created_at": key.created_at.isoformat() if key.created_at else None,
    }


@router.post("/generate", dependencies=[Depends(csrf_protect)])
def generate_key(payload: DkimGenerate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    try:
        dns_record = service.generate(payload.domain, payload.selector, payload.bits)
    except DkimError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    existing = db.query(DkimKey).filter(
        DkimKey.domain == payload.domain, DkimKey.selector == payload.selector
    ).first()
    if existing:
        existing.dns_record = dns_record
        db.commit()
        db.refresh(existing)
        key = existing
    else:
        key = DkimKey(domain=payload.domain, selector=payload.selector, dns_record=dns_record)
        db.add(key)
        db.commit()
        db.refresh(key)

    return {
        "domain": key.domain,
        "selector": key.selector,
        "dns_record": key.dns_record,
        "created_at": key.created_at.isoformat() if key.created_at else None,
    }
