# Docker Mailserver WebUI

> Modern, secure, production-oriented web interface for administrating [Docker Mailserver](https://github.com/docker-mailserver/docker-mailserver).

[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=black)](https://react.dev/)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Configuration](#configuration)
5. [Pages & Features](#pages--features)
   - [Dashboard](#dashboard)
   - [Accounts](#accounts)
   - [Domains](#domains)
   - [Aliases](#aliases)
   - [DNS Wizard](#dns-wizard)
   - [Mail Profiles](#mail-profiles)
   - [Observability](#observability)
   - [IMAPSync](#imapsync)
   - [Logs](#logs)
   - [Settings](#settings)
6. [API Reference](#api-reference)
7. [Security](#security)
8. [Production Notes](#production-notes)
9. [Build & Publish](#build--publish)

---

## Overview

Docker Mailserver WebUI is a self-hosted administration interface for [Docker Mailserver](https://github.com/docker-mailserver/docker-mailserver). It wraps the official `setup` CLI with a clean browser UI and adds first-class support for IMAPSync job orchestration, DNS record generation, mail client profile delivery, and real-time observability of the entire mail stack.

The interface is fully bilingual (🇬🇧 English / 🇩🇪 German). The language is auto-detected from the browser on first load and can be switched at any time via the 🌐 selector in the sidebar.

![Login](docs/screenshots/login.svg)

---

## Architecture

| Layer | Technology |
|-------|-----------|
| **Container runtime** | Single container (`webui`) — backend + frontend bundled together |
| **Backend** | FastAPI · SQLAlchemy · APScheduler |
| **Frontend** | React · Vite · served by Nginx |
| **Database** | SQLite (default, embedded) · PostgreSQL (optional, via Compose profile) |
| **Mail-stack integrations** | docker-mailserver · Rspamd · Redis · ClamAV |

The WebUI container communicates with docker-mailserver by executing `docker exec` commands against named containers, and reads/writes `mailserver.env` directly from a bind-mounted path. No additional agent is required inside the mailserver container.

---

## Quick Start

### SQLite (single container — recommended for getting started)

```bash
cp .env.example .env
# Open .env and set at minimum:
#   SECRET_KEY=<long-random-string>
#   ADMIN_EMAIL=you@example.com
#   ADMIN_PASSWORD=<strong-password>
#   DMS_CONTAINER_NAME=<your-mailserver-container-name>
docker compose up -d
```

- **UI:** `http://localhost:8080`
- **Health check:** `http://localhost:8080/health`

### Optional PostgreSQL Container

If you prefer a dedicated database container, activate the `postgres` Compose profile:

```bash
# In .env:
DATABASE_URL=postgresql+psycopg://dmswebui:dmswebui@db:5432/dmswebui

docker compose --profile postgres up -d
```

### Integrating an Existing Mail Stack

Point the WebUI at the container names used by your existing stack:

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

If `mailserver.env` lives at a non-default path (and is bind-mounted into the WebUI container):

```env
MAILSERVER_ENV_PATH=/config/mailserver.env
```

---

## Configuration

Copy `.env.example` to `.env` and adjust the values before starting the container:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./data/webui.db` | SQLite (default) or PostgreSQL connection string |
| `SECRET_KEY` | — | **Required.** Long random string used for JWT signing |
| `ENCRYPTION_KEY` | — | Fernet key for encrypting IMAPSync credentials at rest (auto-generated if blank) |
| `ADMIN_EMAIL` | `admin@example.com` | E-mail address of the initial admin account |
| `ADMIN_PASSWORD` | `ChangeMe123!` | Password for the initial admin account — **change on first login** |
| `DMS_CONTAINER_NAME` | `mail-server` | Name of the docker-mailserver container |
| `CORS_ORIGINS` | `http://localhost:8080` | Comma-separated list of allowed CORS origins |
| `RSPAMD_CONTAINER_NAME` | `mail-rspamd` | Name of the Rspamd container |
| `REDIS_CONTAINER_NAME` | `mail-redis` | Name of the Redis container |
| `CLAMAV_CONTAINER_NAME` | `mail-clamav` | Name of the ClamAV container |
| `RSPAMD_CONTROLLER_URL` | `http://mail-rspamd:11334/stat` | Full URL of the Rspamd controller statistics endpoint |
| `RSPAMD_CONTROLLER_PASSWORD` | — | Optional password for the Rspamd controller |
| `RSPAMD_WEB_HOST` | `mail-rspamd:11334` | Rspamd web host used for the dashboard link |
| `STACK_BASE_PATH` | `/srv/apps/mailserver` | Absolute path to your mail stack directory on the host |
| `MAILSERVER_ENV_PATH` | `${STACK_BASE_PATH}/mailserver.env` | Path to `mailserver.env` (must be bind-mounted into the WebUI container) |

> All settings except `SECRET_KEY` and `ENCRYPTION_KEY` can also be changed at runtime via **Settings → Application Settings** without restarting the container.

---

## Pages & Features

### Dashboard

The Dashboard is the first page you see after logging in. It gives you an at-a-glance view of the health and activity of your entire mail stack.

**What you can see:**

- **Summary cards** — total number of domains, mail accounts, aliases, and active IMAPSync jobs.
- **System health indicator** — an aggregated status that turns red as soon as any monitored service is unhealthy.
- **Per-service status cards** — individual status and version information for docker-mailserver, Rspamd, Redis, and ClamAV. When a tag of `latest` is used, the version is resolved from the container image labels.
- **Restart buttons** — each service card has a ↺ Restart button to bounce that service without leaving the browser.
- **Last IMAPSync status** — a quick summary of the most recently executed sync job.

**How to use it:**

1. Open the WebUI — the Dashboard loads automatically.
2. Check the **System health** badge at the top. Green means all services are running.
3. If a service shows as stopped or unhealthy, click its **Restart** button to recover it.
4. Use the summary cards as a quick sanity check after making bulk changes to accounts or aliases.

![Dashboard](docs/screenshots/dashboard.svg)

---

### Accounts

The Accounts page lets you create and manage all mail accounts across your domains.

**What you can do:**

- **Create** a new mail account by entering an e-mail address, password, and optional quota.
- **Delete** an account — the action is confirmed before execution.
- **Change password** for any existing account without knowing the current password.
- **Set quota** — enter a value in megabytes; the account row immediately updates its visual quota bar.
  - The quota bar is colour-coded: green below 70 %, amber from 70–89 %, red at 90 % and above.
  - The bar shows used storage, the configured limit, and the percentage at a glance.
- **Add notes** — attach a free-text comment to any account (e.g. "IT dept shared mailbox"). Notes are stored in the WebUI database and never written to the mailserver.
- **View alias count** — each row shows how many aliases point to that account.

**Navigating the table:**

- Use the **domain tabs** (one per domain + "All") to scope the view to a single domain. When a specific domain tab is active, the redundant Domain column is hidden automatically.
- Type in the **live filter** box to instantly search across e-mail address, domain, and note.
- Click any **column header** to sort the table ascending or descending (▲/▼) by e-mail, domain, quota %, alias count, or note.

**How to create an account:**

1. Go to **Accounts** in the sidebar.
2. Click **Add Account**.
3. Enter the full e-mail address (e.g. `alice@example.com`), a password, and an optional quota in MB.
4. Click **Save**. The account appears in the table immediately.

![Accounts](docs/screenshots/accounts.svg)

---

### Domains

The Domains page provides an overview of all domains known to the mail stack and lets you manage which ones are explicitly registered with the WebUI.

**What you can see:**

- Every domain is listed with its **account count**, **alias count**, and a **source label**:
  - 🗃 **Managed** — explicitly added via the WebUI.
  - 📬 **Auto-detected** — inferred from existing mail accounts but not yet explicitly managed.
- An optional **description** field per managed domain (e.g. "Primary company domain").

**How to add a domain:**

1. Go to **Domains** in the sidebar.
2. Click **Add Domain**.
3. Enter the domain name (e.g. `example.com`) and an optional description.
4. Click **Save**. The domain now appears as *Managed* and becomes available in DNS Wizard and Mail Profiles.

**How to remove a domain:**

1. Click the trash icon on the domain row.
2. Confirm the deletion. Note: removing a domain from the WebUI does **not** delete the associated accounts — it only removes the explicit registration.

![Domains](docs/screenshots/domains.svg)

---

### Aliases

The Aliases page lets you create and manage e-mail aliases — addresses that forward mail to one or more real accounts.

**What you can do:**

- **Create** an alias by specifying the alias address and the destination address.
- **Delete** an alias with a single click (with confirmation).
- **Add notes** — attach a free-text comment to any alias (e.g. "Forwards to sales team"). Notes are stored in the WebUI database.

**Navigating the table:**

- Use the **domain tabs** to filter aliases by domain.
- Use the **live filter** to search across alias address, destination, domain, and note.
- Click any **column header** to sort by alias, destination, domain, or note.

**How to create an alias:**

1. Go to **Aliases** in the sidebar.
2. Click **Add Alias**.
3. Enter the alias address (e.g. `info@example.com`) and the destination address (e.g. `alice@example.com`).
4. Optionally add a note.
5. Click **Save**.

![Aliases](docs/screenshots/aliases.svg)

---

### DNS Wizard

The DNS Wizard generates the recommended DNS records for each of your managed domains, ready to copy-paste into your DNS provider.

**Records generated:**

| Type | Purpose |
|------|---------|
| `MX` | Routes incoming mail to your server |
| `A` | Points the mail hostname to your server IP |
| `SPF` | Authorises your server to send mail for the domain |
| `DMARC` | Policy for handling unauthenticated mail |
| `DKIM` | Cryptographic signing key published in DNS |

**How to use it:**

1. Go to **DNS Wizard** in the sidebar.
2. Select the domain tab you want to configure.
3. Review each record — the wizard shows the exact record **name**, **type**, and **value** to enter in your DNS provider.
4. Click the **copy** icon next to any value to copy it to the clipboard.
5. Paste each record into your DNS provider's management console.

> DKIM records are read directly from the docker-mailserver configuration. Ensure your DKIM keys are already generated (`setup config dkim`) before opening the DNS Wizard.

![DNS Wizard](docs/screenshots/dns-wizard.svg)

---

### Mail Profiles

The Mail Profiles page generates ready-to-use mail client configuration information for your end users. Instead of sending manual setup instructions, you can point users to this page or export the configuration directly.

**What is provided:**

- **IMAP / POP3 / SMTP settings** — server hostname, port, encryption type, and authentication method for each protocol.
- **Autoconfig URL** — a Thunderbird-compatible autodiscovery URL that users can paste into Mozilla Thunderbird's account setup wizard.
- **`.mobileconfig` download** — a signed Apple configuration profile for automatic setup on iOS and macOS devices. Click **Download** and open the file on the device.
- **Manual setup hints** — step-by-step instructions for Outlook (Windows/Mac) and Android mail clients.

**How to use it:**

1. Go to **Mail Profiles** in the sidebar.
2. Select the domain tab for the domain you are configuring.
3. Share the IMAP/SMTP settings with your users, or send them the Autoconfig URL.
4. For mobile users, download the `.mobileconfig` file and send it via e-mail or MDM system.

![Mail Profiles](docs/screenshots/mail-profiles.svg)

---

### Observability

The Observability page gives you deep operational visibility into every component of the mail stack from a single screen.

**Sections on this page:**

- **Service status & restart** — real-time status and ↺ Restart buttons for docker-mailserver, Rspamd, Redis, and ClamAV.
- **Mail queue** — the live Postfix queue. Each entry shows the queue ID, message size, arrival date, sender, and recipients. Useful for spotting stuck messages.
- **Active mail connections** — live Dovecot sessions via `doveadm who`. Columns include username, service (IMAP/POP3), PID, remote IP, and TLS status.
- **Rspamd statistics** — scanned message count, spam/ham totals, active connections, uptime, version, and a full breakdown of actions taken (reject, soft-reject, rewrite, add header, no action).
- **Supervisor process status** — all processes managed by Supervisord inside the docker-mailserver container: name, status (RUNNING / STOPPED), PID, and uptime.

**How to use it:**

1. Go to **Observability** in the sidebar.
2. Check the **Service status** cards at the top. If any service is stopped, click **Restart**.
3. Scroll to **Mail queue** to check for stuck or bounced messages.
4. Review **Active connections** to see who is currently logged in.
5. Check **Rspamd statistics** to verify spam filtering is working and review action distribution.

![Observability](docs/screenshots/observability.svg)

---

### IMAPSync

The IMAPSync page lets you define, manage, and monitor mail migration and synchronisation jobs between remote IMAP servers and your local mailboxes.

**What you can do:**

- **Create** a sync job by specifying the source server (host, port, user, password, SSL) and a local destination mailbox.
- **Edit** any job to update credentials, schedule, or connection parameters.
- **Delete** a job permanently.
- **Enable / disable** jobs — disabled jobs are skipped by the scheduler.
- **Monitor** the last status and last run timestamp of every job at a glance.

**Local account selector:**

When creating a job, selecting a local mailbox from the dropdown auto-fills the destination host as `mail.<domain>` (editable) and populates the destination username. Choose **Custom** for a fully manual destination entry when syncing between two external servers.

**Security:**

All source and destination passwords are encrypted at rest using Fernet symmetric encryption. The `ENCRYPTION_KEY` in `.env` protects the credentials.

**How to create a sync job:**

1. Go to **IMAPSync** in the sidebar.
2. Click **Add Job**.
3. Fill in the source server details (host, port, username, password, SSL toggle).
4. Select a local destination mailbox from the dropdown (or choose **Custom** and enter details manually).
5. Set the sync interval and optionally enable the job immediately.
6. Click **Save**. The job appears in the table with its current status.

![IMAPSync](docs/screenshots/imapsync.svg)

---

### Logs

The Log Viewer page gives you direct access to the most recent log output of the key components in your mail stack, without needing shell access to the server.

**What you can do:**

- **Select the log source:**
  - `mailserver` — the docker-mailserver container log (requires `/var/log/mail.log` to be bind-mounted into the WebUI container).
  - `imapsync` — the IMAPSync container or job log.
  - `webui` — the WebUI backend application log.
- **Configure line count** — choose how many of the most recent lines to retrieve: 100, 200, 500, or 1000.
- **Filter** the displayed output by entering a search term in the filter box — only matching lines are shown.
- **Manually refresh** the log by clicking the refresh button to fetch the latest output.

**How to use it:**

1. Go to **Logs** in the sidebar.
2. Select the **source** from the dropdown.
3. Adjust the **line count** if needed.
4. Type a search term in the **filter** box to narrow down the output (e.g. `NOQUEUE`, `reject`, `alice@`).
5. Click **Refresh** to reload the log at any time.

![Logs](docs/screenshots/logs.svg)

---

### Settings

The Settings page is divided into three tabs that let you configure the WebUI itself, the underlying mail stack, and your administrator account.

#### Application Settings

Configure the WebUI's runtime parameters. Changes are persisted to the database and applied on the next request — no container restart required.

- **Container names** — adjust the names of docker-mailserver, Rspamd, Redis, and ClamAV containers to match your stack.
- **Stack base path** and **mailserver.env path** — update if your directory layout differs from the default.
- **Rspamd controller URL and password** — connect to a Rspamd instance with a custom address or access control.
- **Session duration** — how long a user session remains valid (in minutes).
- **CORS origins** — whitelist additional origins if the WebUI is accessed from a different hostname.

#### Email Settings

Edit the fields in `mailserver.env` directly from the browser, grouped by category (General, TLS, Spam, DKIM, …). This requires `mailserver.env` to be bind-mounted into the WebUI container. Changes are written to the file immediately and take effect after reloading docker-mailserver.

#### Change Password

Update the WebUI administrator password. You must supply the current password before setting a new one.

**How to change application settings:**

1. Go to **Settings → Application Settings** in the sidebar.
2. Update the relevant fields.
3. Click **Save**. Settings are applied on the next API request.

![Settings](docs/screenshots/settings.svg)

---

## API Reference

All endpoints are prefixed with `/api` and require an authenticated session.  
State-changing requests (`POST`, `PUT`, `DELETE`) additionally require the `X-CSRF-Token` header, whose value is provided in the `csrf_token` cookie after login.

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Log in — returns session cookie and CSRF token |
| `POST` | `/api/auth/logout` | Log out and invalidate the session |
| `GET` | `/api/auth/me` | Return the currently authenticated user |
| `PUT` | `/api/auth/password` | Change the admin password |

### Accounts

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dms/accounts` | List all accounts with quota, alias count, and notes |
| `POST` | `/api/dms/accounts` | Create a new account |
| `DELETE` | `/api/dms/accounts` | Delete an account |
| `PUT` | `/api/dms/accounts/password` | Change an account's password |
| `PUT` | `/api/dms/accounts/quota` | Set an account's quota |
| `PUT` | `/api/dms/accounts/notes` | Save or update an account note |

### Aliases

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dms/aliases` | List all aliases with notes |
| `POST` | `/api/dms/aliases` | Create a new alias |
| `DELETE` | `/api/dms/aliases` | Delete an alias |
| `PUT` | `/api/dms/aliases/notes` | Save or update an alias note |

### Domains

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dms/domains` | List all domains (managed and auto-detected) |
| `POST` | `/api/dms/domains` | Add a managed domain |
| `DELETE` | `/api/dms/domains` | Remove a managed domain |

### IMAPSync

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/imapsync` | List all sync jobs |
| `POST` | `/api/imapsync` | Create a new sync job |
| `PUT` | `/api/imapsync/{id}` | Update an existing sync job |
| `DELETE` | `/api/imapsync/{id}` | Delete a sync job |

### Observability

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/observability` | Service status and Rspamd statistics |
| `GET` | `/api/supervisorctl` | Supervisor process list |
| `GET` | `/api/mailq` | Postfix mail queue entries |
| `GET` | `/api/doveadm/who` | Active Dovecot sessions |
| `POST` | `/api/integrations/{service}/restart` | Restart a service (`rspamd`, `redis`, `clamav`) |

### Misc

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dashboard` | Dashboard summary statistics |
| `GET` | `/api/logs/{type}` | Log lines — `type` is `mailserver`, `imapsync`, or `webui`; supports `lines` and `search` query params |
| `GET` | `/api/settings/` | Read application settings |
| `PUT` | `/api/settings/` | Save application settings |
| `GET` | `/api/settings/dms-env` | Read `mailserver.env` schema and current values |
| `PUT` | `/api/settings/dms-env` | Write values to `mailserver.env` |
| `GET` | `/api/dns-wizard` | Generate DNS records for a domain |
| `GET` | `/api/mail-profile` | Generate mail client profile data |

---

## Security

The WebUI is designed with a defence-in-depth approach:

- **Session cookies** — `HttpOnly`, `Secure`, `SameSite=Strict`. Sessions are never exposed to JavaScript.
- **Password hashing** — Argon2id via [passlib](https://passlib.readthedocs.io/).
- **CSRF protection** — double-submit cookie strategy. All mutating API calls require the `X-CSRF-Token` header.
- **Input validation** — all request payloads are validated by Pydantic models before reaching business logic.
- **Subprocess safety** — Docker CLI calls are constructed as argument lists with no shell interpolation, eliminating shell injection.
- **Encrypted credentials** — IMAPSync source/destination passwords are encrypted at rest with Fernet using your `ENCRYPTION_KEY`.

---

## Production Notes

Follow these guidelines when deploying the WebUI in a production environment:

- **Generate a strong `SECRET_KEY`**: `openssl rand -hex 32`
- **Change `ADMIN_PASSWORD`** immediately after the first login.
- **TLS termination** — run a reverse proxy (Nginx, Caddy, Traefik) in front of the WebUI container; do not expose port 8080 directly to the internet.
- **Docker socket** — the WebUI needs access to the Docker socket to run `docker exec` commands. Restrict this with a socket proxy (e.g. [Tecnativa/docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy)) or use a dedicated unprivileged user.
- **Mount mail logs** — bind-mount `/var/log/mail.log` from the host (or the mailserver container volume) into the WebUI container at the same path to enable live log tailing.
- **Back up the database** — the SQLite database is stored in the `webui_data` Docker volume. Back it up regularly, or switch to PostgreSQL for managed backups.
- **CORS origins** — set `CORS_ORIGINS` to exactly the public URL(s) used to access the UI; do not use `*` in production.

---

## Build & Publish

A GitHub Actions workflow is provided at `.github/workflows/publish-ghcr.yml` to build a multi-arch image and push it to the GitHub Container Registry.

**Trigger:**  
Go to **Actions → Publish Docker image to GHCR → Run workflow** in your repository.

**Output images:**

```
ghcr.io/<owner>/<repo>:latest
ghcr.io/<owner>/<repo>:sha-<commit-sha>
```

**Using the published image in `docker-compose.yml`:**

```env
WEBUI_IMAGE=ghcr.io/<owner>/<repo>:latest
```

To build locally:

```bash
docker build -t docker-mailserver-webui:local .
```
