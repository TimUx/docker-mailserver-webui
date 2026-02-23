# Docker Mailserver WebUI

Modern, secure, production-oriented WebUI for administrating [Docker Mailserver](https://github.com/docker-mailserver/docker-mailserver) through the official `setup` CLI and IMAPSync orchestration.

## Architecture

- **Single container runtime (default)**: frontend + backend in one container (`webui`)
- **Backend**: FastAPI + SQLAlchemy + APScheduler
- **Frontend**: React + Vite (served by Nginx)
- **DB**:
  - Default: **SQLite inside the webui container**
  - Optional: **PostgreSQL in a dedicated container** via Compose profile
- **Extended mail-security integrations**: rspamd + redis + clamav status/admin hooks

## Features

### Dashboard

- Summary cards: total domains, accounts, aliases, active sync jobs
- System health indicator (aggregates mailserver + security stack status)
- Per-service status cards: docker-mailserver, Rspamd, Redis, ClamAV with restart buttons
- Last IMAPSync status

### Account Management

- Create, delete, and list mail accounts (`setup email add/del/list`)
- Change account password (`setup email update`)
- Set or update per-account quota (`setup email setquota`)
- **Alias count per account** – each row shows how many aliases point to that account
- **Notes** – free-text note/comment per account (stored in WebUI database)
- **Domain tabs** – one tab per domain plus "All"; selecting a domain filters the table and hides the redundant Domain column
- **Live filter** – text search across email, domain, and note
- **Sortable columns** – click any header to sort (▲/▼): email, domain, quota %, alias count, note

### Domain Management

- List all domains (auto-detected from accounts + explicitly managed)
- Add/remove managed domains with optional description
- Correct **account count** and **alias count** per domain
- Source label: 🗃 managed vs 📬 auto-detected

### Alias Management

- Create, delete, and list aliases (`setup alias add/del/list`)
- Correct parsing of the DMS alias file format (`* alias@domain -> destination@domain`)
- **Notes** – free-text note/comment per alias (stored in WebUI database)
- **Domain tabs** – same tab-per-domain UX as Accounts
- **Live filter** – searches across alias address, destination, domain, and note
- **Sortable columns** – alias, destination, domain, note

### DNS Wizard

- Generate recommended DNS records for any managed domain: MX, A, SPF, DMARC, DKIM
- Per-domain tabs; copy-ready record values

### Mail Profiles

- IMAP / POP3 / SMTP server settings for end users
- Autoconfig URL for Thunderbird
- `.mobileconfig` download for iOS / macOS
- Manual setup hints for Outlook and Android

### Observability

- **Service status**: real-time status + restart buttons for docker-mailserver, Rspamd, Redis, ClamAV
- **Mail queue**: live Postfix queue (queue ID, size, date, sender)
- **Active mail connections**: Dovecot sessions via `doveadm who` (user, service, PID, IP, TLS)
- **Rspamd statistics**: scanned, spam/ham counts, connections, uptime, version, actions breakdown
- **Supervisor process status**: name, status (RUNNING/STOPPED), PID, uptime — at the bottom of the page

### IMAPSync Management

- CRUD IMAPSync job definitions (source/destination host, user, port, SSL, interval)
- Enable/disable jobs; last status and run time tracked per job
- Encrypted credentials at rest (Fernet)
- Execution delegated to an external IMAPSync container/automation

### Log Viewer

- Selectable source: mailserver, imapsync, webui
- Configurable line count (100/200/500/1000)
- Full-text search/filter; manual refresh

### Settings

- **Application Settings**: container names, paths, Rspamd controller, session duration, CORS — changes persisted in DB, applied on next request
- **Email Settings**: edit `mailserver.env` fields grouped by category (file must be mounted into container)
- **Change Password**: update the WebUI admin password

### Security

- Session authentication with secure cookies (`httponly`, `secure`, `samesite=strict`)
- Argon2 password hashing
- CSRF protection (double-submit cookie strategy)
- Strict input validation (Pydantic)
- Subprocess invocation with no shell interpolation

---

## API Reference

All endpoints require authentication and are prefixed with `/api`.  
State-changing endpoints additionally require the CSRF header (`X-CSRF-Token`).

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/login` | Login — returns session cookie + CSRF token |
| `POST` | `/auth/logout` | Logout |
| `GET`  | `/auth/me` | Get current user |
| `PUT`  | `/auth/password` | Change admin password |

### Accounts

| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/dms/accounts` | List accounts + notes |
| `POST`   | `/dms/accounts` | Create account (email, password, quota) |
| `DELETE` | `/dms/accounts` | Delete account |
| `PUT`    | `/dms/accounts/password` | Change account password |
| `PUT`    | `/dms/accounts/quota` | Set account quota |
| `PUT`    | `/dms/accounts/notes` | Save/update account note |

### Aliases

| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/dms/aliases` | List aliases + notes |
| `POST`   | `/dms/aliases` | Create alias |
| `DELETE` | `/dms/aliases` | Delete alias |
| `PUT`    | `/dms/aliases/notes` | Save/update alias note |

### Domains

| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/dms/domains` | List domains (managed + auto-detected) |
| `POST`   | `/dms/domains` | Add managed domain |
| `DELETE` | `/dms/domains` | Remove managed domain |

### IMAPSync

| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/imapsync` | List sync jobs |
| `POST`   | `/imapsync` | Create sync job |
| `PUT`    | `/imapsync/{job_id}` | Update sync job |
| `DELETE` | `/imapsync/{job_id}` | Delete sync job |

### Observability

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/observability` | Service status + Rspamd stats |
| `GET` | `/supervisorctl` | Supervisor process list |
| `GET` | `/mailq` | Postfix mail queue |
| `GET` | `/doveadm/who` | Active Dovecot connections |
| `POST` | `/integrations/{service}/restart` | Restart rspamd / redis / clamav |

### Misc

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/dashboard` | Dashboard summary stats |
| `GET` | `/logs/{mailserver\|imapsync\|webui}` | Log lines (`lines`, `search` params) |
| `GET` | `/settings/` | Read application settings |
| `PUT` | `/settings/` | Save application settings |
| `GET` | `/settings/dms-env` | Read mailserver.env schema + values |
| `PUT` | `/settings/dms-env` | Write mailserver.env |
| `GET` | `/dns-wizard` | Generate DNS records |
| `GET` | `/mail-profile` | Generate mail client profile |

---

## Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./data/webui.db` | SQLite (default) or PostgreSQL connection string |
| `SECRET_KEY` | — | **Required.** Long random string for JWT signing |
| `ENCRYPTION_KEY` | — | Fernet key for IMAPSync credential encryption (auto-generated if blank) |
| `ADMIN_EMAIL` | `admin@example.com` | Initial admin email |
| `ADMIN_PASSWORD` | `ChangeMe123!` | Initial admin password — change on first login! |
| `DMS_CONTAINER_NAME` | `mail-server` | docker-mailserver container name |
| `CORS_ORIGINS` | `http://localhost:8080` | Allowed CORS origins (comma-separated) |
| `RSPAMD_CONTAINER_NAME` | `mail-rspamd` | Rspamd container name |
| `REDIS_CONTAINER_NAME` | `mail-redis` | Redis container name |
| `CLAMAV_CONTAINER_NAME` | `mail-clamav` | ClamAV container name |
| `RSPAMD_CONTROLLER_URL` | `http://mail-rspamd:11334/stat` | Rspamd controller URL |
| `RSPAMD_CONTROLLER_PASSWORD` | — | Optional Rspamd controller password |
| `RSPAMD_WEB_HOST` | `mail-rspamd:11334` | Rspamd web host (for dashboard link) |
| `STACK_BASE_PATH` | `/srv/apps/mailserver` | Base path of your mail stack on the host |
| `MAILSERVER_ENV_PATH` | `${STACK_BASE_PATH}/mailserver.env` | Path to `mailserver.env` (must be mounted into the WebUI container) |

All settings except `SECRET_KEY` and `ENCRYPTION_KEY` can also be changed at runtime via **Settings → Application Settings** without restarting the container.

---

## Quick Start (SQLite, single container)

```bash
cp .env.example .env
# Edit .env: set SECRET_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, DMS_CONTAINER_NAME
docker compose up -d
```

- UI: `http://localhost:8080`  
- Health: `http://localhost:8080/health`

## Optional PostgreSQL Container

```bash
# .env
DATABASE_URL=postgresql+psycopg://dmswebui:dmswebui@db:5432/dmswebui

docker compose --profile postgres up -d
```

## Integrating an Existing Mail Stack

```env
DMS_CONTAINER_NAME=mail-server
RSPAMD_CONTAINER_NAME=mail-rspamd
REDIS_CONTAINER_NAME=mail-redis
CLAMAV_CONTAINER_NAME=mail-clamav
RSPAMD_CONTROLLER_URL=http://mail-rspamd:11334/stat
STACK_BASE_PATH=/srv/apps/mailserver
```

If your Rspamd controller is password-protected:

```env
RSPAMD_CONTROLLER_PASSWORD=<your_controller_password>
```

If `mailserver.env` is at a non-default path (and mounted into the container):

```env
MAILSERVER_ENV_PATH=/config/mailserver.env
```

## Build + Publish Image to GHCR

A GitHub Actions workflow is available at `.github/workflows/publish-ghcr.yml`.

- Trigger: **Actions → Publish Docker image to GHCR → Run workflow**
- Output: `ghcr.io/<owner>/<repo>:latest` and `ghcr.io/<owner>/<repo>:sha-...`

```env
WEBUI_IMAGE=ghcr.io/<owner>/<repo>:latest
```

## Production Notes

- Use a strong, unique `SECRET_KEY`
- Change `ADMIN_PASSWORD` immediately after first login
- Terminate TLS at reverse proxy / load balancer
- Restrict Docker socket access to least privilege
- Mount `/var/log/mail.log` into the container for live log tailing
- Back up the DB volume (`webui_data`)

---

## Screenshots

### Dashboard
![Dashboard](docs/screenshots/dashboard.svg)

### Accounts
![Accounts](docs/screenshots/accounts.svg)

### Domains
![Domains](docs/screenshots/domains.svg)

### Aliases
![Aliases](docs/screenshots/aliases.svg)

### DNS Wizard
![DNS Wizard](docs/screenshots/dns-wizard.svg)

### Mail Profiles
![Mail Profiles](docs/screenshots/mail-profiles.svg)

### Observability
![Observability](docs/screenshots/observability.svg)

### IMAPSync
![IMAPSync](docs/screenshots/imapsync.svg)

### Logs
![Logs](docs/screenshots/logs.svg)

### Settings
![Settings](docs/screenshots/settings.svg)
