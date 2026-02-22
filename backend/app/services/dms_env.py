"""Service for reading and writing the docker-mailserver mailserver.env file."""
import os
import re

# Regex that matches a valid KEY=value line (ignores comments and blanks)
_LINE_RE = re.compile(r'^([A-Za-z_][A-Za-z0-9_]*)=(.*)$')

# Canonical list of known DMS settings shown in the UI.
# "type" is "bool" (stored as "0"/"1") or "text" (free-form string).
# "options" is an optional list of allowed values rendered as a <select>.
DMS_ENV_SETTINGS: list[dict] = [
    # ── Identity ─────────────────────────────────────────────────────────────
    {"key": "OVERRIDE_HOSTNAME",   "type": "text",   "default": "",            "group": "Identity",  "label": "Override Hostname"},
    {"key": "POSTMASTER_ADDRESS",  "type": "text",   "default": "",            "group": "Identity",  "label": "Postmaster Address"},
    # ── Security ─────────────────────────────────────────────────────────────
    {"key": "SSL_TYPE",            "type": "select", "default": "",            "group": "Security",  "label": "SSL Type",
     "options": ["", "letsencrypt", "manual", "self-signed", "custom", "off"]},
    {"key": "ENABLE_FAIL2BAN",     "type": "bool",   "default": "0",           "group": "Security",  "label": "Enable Fail2Ban"},
    {"key": "SPOOF_PROTECTION",    "type": "bool",   "default": "0",           "group": "Security",  "label": "Spoof Protection"},
    # ── Services ─────────────────────────────────────────────────────────────
    {"key": "ENABLE_RSPAMD",       "type": "bool",   "default": "0",           "group": "Services",  "label": "Enable Rspamd"},
    {"key": "ENABLE_CLAMAV",       "type": "bool",   "default": "0",           "group": "Services",  "label": "Enable ClamAV"},
    {"key": "ENABLE_AMAVIS",       "type": "bool",   "default": "0",           "group": "Services",  "label": "Enable Amavis"},
    {"key": "ENABLE_QUOTAS",       "type": "bool",   "default": "1",           "group": "Services",  "label": "Enable Quotas"},
    {"key": "ENABLE_IMAP",         "type": "bool",   "default": "1",           "group": "Services",  "label": "Enable IMAP"},
    {"key": "ENABLE_POP3",         "type": "bool",   "default": "0",           "group": "Services",  "label": "Enable POP3"},
    # ── Network ──────────────────────────────────────────────────────────────
    {"key": "ENABLE_POSTSCREEN",   "type": "bool",   "default": "0",           "group": "Network",   "label": "Enable Postscreen"},
    {"key": "ENABLE_IPV6",         "type": "bool",   "default": "0",           "group": "Network",   "label": "Enable IPv6"},
    # ── System ───────────────────────────────────────────────────────────────
    {"key": "LOG_LEVEL",           "type": "select", "default": "info",        "group": "System",    "label": "Log Level",
     "options": ["trace", "debug", "info", "warn", "error"]},
    {"key": "ONE_DIR",             "type": "bool",   "default": "1",           "group": "System",    "label": "One Directory Layout"},
]

# Set of all known keys for validation
_KNOWN_KEYS: set[str] = {s["key"] for s in DMS_ENV_SETTINGS}


def read_mailserver_env(path: str) -> dict[str, str]:
    """Parse *path* as a KEY=value env file and return values for known DMS settings.

    Unknown/comment lines are ignored.  If the file does not exist an empty
    dict is returned so the UI can fall back to the schema defaults.
    """
    result: dict[str, str] = {}
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                m = _LINE_RE.match(line)
                if m:
                    result[m.group(1)] = m.group(2)
    except FileNotFoundError:
        pass
    return result


def write_mailserver_env(path: str, updates: dict[str, str]) -> None:
    """Merge *updates* into an existing mailserver.env file (creating it if needed).

    Existing comments and unrelated keys are preserved.  Only *known* keys
    (those listed in DMS_ENV_SETTINGS) are written to prevent injection of
    arbitrary content.
    """
    # Restrict to known keys; strip newlines from values to prevent file corruption
    updates = {k: v.replace("\n", "").replace("\r", "") for k, v in updates.items() if k in _KNOWN_KEYS}

    lines: list[str] = []
    try:
        with open(path, encoding="utf-8") as fh:
            lines = fh.readlines()
    except FileNotFoundError:
        pass

    written: set[str] = set()
    new_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            new_lines.append(line)
            continue
        m = _LINE_RE.match(stripped)
        if m and m.group(1) in updates:
            key = m.group(1)
            new_lines.append(f"{key}={updates[key]}\n")
            written.add(key)
        else:
            new_lines.append(line)

    # Append keys not already present in the file
    for key, value in updates.items():
        if key not in written:
            new_lines.append(f"{key}={value}\n")

    parent = os.path.dirname(os.path.abspath(path))
    os.makedirs(parent, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.writelines(new_lines)
