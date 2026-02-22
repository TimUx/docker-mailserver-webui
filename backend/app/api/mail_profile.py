from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.api.deps import get_current_user

router = APIRouter(prefix="/mail-profile", tags=["mail-profile"])

_THUNDERBIRD_AUTOCONFIG = """\
<?xml version="1.0" encoding="UTF-8"?>
<clientConfig version="1.1">
  <emailProvider id="{domain}">
    <domain>{domain}</domain>
    <displayName>{domain} Mail</displayName>
    <displayShortName>{domain}</displayShortName>
    <incomingServer type="imap">
      <hostname>{hostname}</hostname>
      <port>993</port>
      <socketType>SSL</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </incomingServer>
    <incomingServer type="pop3">
      <hostname>{hostname}</hostname>
      <port>995</port>
      <socketType>SSL</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </incomingServer>
    <outgoingServer type="smtp">
      <hostname>{hostname}</hostname>
      <port>587</port>
      <socketType>STARTTLS</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </outgoingServer>
  </emailProvider>
</clientConfig>
"""

_IOS_MOBILECONFIG = """\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>EmailAccountDescription</key>
      <string>{domain} Mail</string>
      <key>EmailAccountName</key>
      <string>{domain}</string>
      <key>EmailAccountType</key>
      <string>EmailTypeIMAP</string>
      <key>EmailAddress</key>
      <string>user@{domain}</string>
      <key>IncomingMailServerHostName</key>
      <string>{hostname}</string>
      <key>IncomingMailServerPortNumber</key>
      <integer>993</integer>
      <key>IncomingMailServerUseSSL</key>
      <true/>
      <key>IncomingMailServerUsername</key>
      <string>user@{domain}</string>
      <key>OutgoingMailServerHostName</key>
      <string>{hostname}</string>
      <key>OutgoingMailServerPortNumber</key>
      <integer>587</integer>
      <key>OutgoingMailServerUseSSL</key>
      <false/>
      <key>OutgoingMailServerUsername</key>
      <string>user@{domain}</string>
      <key>PayloadDescription</key>
      <string>Email account configuration for {domain}</string>
      <key>PayloadDisplayName</key>
      <string>{domain} Mail Account</string>
      <key>PayloadIdentifier</key>
      <string>com.{domain_nodot}.mail</string>
      <key>PayloadType</key>
      <string>com.apple.mail.managed</string>
      <key>PayloadUUID</key>
      <string>{uuid}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>SMIMEEnabled</key>
      <false/>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Mail profile for {domain}</string>
  <key>PayloadDisplayName</key>
  <string>{domain} Mail</string>
  <key>PayloadIdentifier</key>
  <string>com.{domain_nodot}.mailprofile</string>
  <key>PayloadOrganization</key>
  <string>{domain}</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>{profile_uuid}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>
"""


def _generic_settings(domain: str, hostname: str) -> dict:
    return {
        "domain": domain,
        "hostname": hostname,
        "imap": {"host": hostname, "port": 993, "security": "SSL/TLS", "username": f"user@{domain}"},
        "pop3": {"host": hostname, "port": 995, "security": "SSL/TLS", "username": f"user@{domain}"},
        "smtp": {"host": hostname, "port": 587, "security": "STARTTLS", "username": f"user@{domain}"},
        "clients": {
            "thunderbird": {
                "name": "Mozilla Thunderbird",
                "autoconfig_url": f"https://autoconfig.{domain}/mail/config-v1.1.xml",
                "instructions": "Thunderbird discovers settings automatically when you enter your email address.",
            },
            "outlook": {
                "name": "Microsoft Outlook",
                "protocol": "IMAP",
                "incoming": f"Server: {hostname}, Port: 993, SSL",
                "outgoing": f"Server: {hostname}, Port: 587, STARTTLS",
            },
            "android": {
                "name": "Android Mail / Gmail app",
                "protocol": "IMAP",
                "incoming": f"Server: {hostname}, Port: 993, SSL",
                "outgoing": f"Server: {hostname}, Port: 587, STARTTLS",
                "note": "Use your full email address as username.",
            },
            "ios": {
                "name": "Apple Mail (iOS/macOS)",
                "protocol": "IMAP",
                "incoming": f"Server: {hostname}, Port: 993, SSL",
                "outgoing": f"Server: {hostname}, Port: 587, STARTTLS",
                "mobileconfig_url": f"/api/mail-profile/{domain}/ios.mobileconfig",
            },
        },
    }


@router.get("/{domain}")
def mail_profile(
    domain: str,
    hostname: str = "",
    _=Depends(get_current_user),
):
    effective_hostname = hostname or f"mail.{domain}"
    return _generic_settings(domain, effective_hostname)


@router.get("/{domain}/autoconfig.xml", response_class=Response)
def thunderbird_autoconfig(
    domain: str,
    hostname: str = "",
    _=Depends(get_current_user),
):
    effective_hostname = hostname or f"mail.{domain}"
    xml = _THUNDERBIRD_AUTOCONFIG.format(domain=domain, hostname=effective_hostname)
    return Response(content=xml, media_type="application/xml")


@router.get("/{domain}/ios.mobileconfig", response_class=Response)
def ios_mobileconfig(
    domain: str,
    hostname: str = "",
    _=Depends(get_current_user),
):
    import uuid
    effective_hostname = hostname or f"mail.{domain}"
    domain_nodot = domain.replace(".", "")
    profile_xml = _IOS_MOBILECONFIG.format(
        domain=domain,
        hostname=effective_hostname,
        domain_nodot=domain_nodot,
        uuid=str(uuid.uuid4()),
        profile_uuid=str(uuid.uuid4()),
    )
    return Response(
        content=profile_xml,
        media_type="application/x-apple-aspen-config",
        headers={"Content-Disposition": f'attachment; filename="{domain}-mail.mobileconfig"'},
    )
