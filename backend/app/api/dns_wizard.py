from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.dkim_key import DkimKey

router = APIRouter(prefix="/dns-wizard", tags=["dns-wizard"])


def _records(domain: str, hostname: str, server_ip: str, dkim_record: str | None = None, dkim_selector: str = "mail") -> list[dict]:
    return [
        {
            "type": "MX",
            "name": f"{domain}.",
            "value": f"10 {hostname}.",
            "ttl": 3600,
            "description": "Mail exchanger – routes email to your mail server",
        },
        {
            "type": "A",
            "name": f"{hostname}.",
            "value": server_ip or "<your-server-ip>",
            "ttl": 3600,
            "description": "IP address of your mail server",
        },
        {
            "type": "TXT",
            "name": f"{domain}.",
            "value": f"v=spf1 mx ~all",
            "ttl": 3600,
            "description": "SPF record – authorises your mail server to send email for this domain",
        },
        {
            "type": "TXT",
            "name": f"_dmarc.{domain}.",
            "value": f"v=DMARC1; p=none; rua=mailto:dmarc-reports@{domain}",
            "ttl": 3600,
            "description": "DMARC policy – set p=quarantine or p=reject once SPF/DKIM are verified",
        },
        {
            "type": "TXT",
            "name": f"{dkim_selector}._domainkey.{domain}.",
            "value": dkim_record if dkim_record else f"<generate DKIM key via the Domains page or run: docker exec mail-rspamd rspamadm dkim_keygen -d {domain} -s {dkim_selector} -k /var/lib/rspamd/dkim/{domain}.{dkim_selector}.key>",
            "ttl": 3600,
            "description": f"DKIM public key (selector: {dkim_selector}) – use the Domains page to generate and manage DKIM keys",
        },
        {
            "type": "PTR",
            "name": f"{server_ip or '<your-server-ip>'}",
            "value": f"{hostname}.",
            "ttl": 3600,
            "description": "Reverse DNS (rDNS/PTR) – must be set with your hosting provider",
        },
        {
            "type": "TXT",
            "name": f"_mta-sts.{domain}.",
            "value": f"v=STSv1; id={domain.replace('.', '')}",
            "ttl": 3600,
            "description": "MTA-STS version identifier – update the id value whenever you change your MTA-STS policy",
        },
        {
            "type": "TXT",
            "name": f"_smtp._tls.{domain}.",
            "value": "v=TLSRPTv1; rua=mailto:tls-reports@" + domain,
            "ttl": 3600,
            "description": "TLS reporting – receive TLS failure reports (optional)",
        },
    ]

@router.get("/{domain}")
def dns_wizard(
    domain: str,
    hostname: str = "",
    server_ip: str = "",
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    effective_hostname = hostname or f"mail.{domain}"
    # Look up any stored DKIM key for this domain
    dkim_key = (
        db.query(DkimKey)
        .filter(DkimKey.domain == domain)
        .order_by(DkimKey.selector)
        .first()
    )
    dkim_record = dkim_key.dns_record if dkim_key else None
    dkim_selector = dkim_key.selector if dkim_key else "dkim"
    return {
        "domain": domain,
        "hostname": effective_hostname,
        "server_ip": server_ip,
        "dkim_configured": dkim_record is not None,
        "records": _records(domain, effective_hostname, server_ip, dkim_record, dkim_selector),
    }
