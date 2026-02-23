from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "DMS WebUI"
    api_v1_prefix: str = "/api"
    database_url: str = "sqlite:///./data/webui.db"
    secret_key: str = "change-me-super-secret"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    csrf_cookie_name: str = "dms_csrf"
    session_cookie_name: str = "dms_session"
    encryption_key: str = ""

    dms_container_name: str = "mail-server"
    dms_setup_path: str = "setup"
    rspamd_container_name: str = "mail-rspamd"
    redis_container_name: str = "mail-redis"
    clamav_container_name: str = "mail-clamav"
    rspamd_controller_url: str = "http://mail-rspamd:11334/stat"
    rspamd_controller_password: str = ""
    rspamd_web_host: str = "mail-rspamd:11334"

    stack_base_path: str = "/srv/apps/mailserver"
    dms_config_mount_path: str = "/tmp/docker-mailserver"
    dms_mail_data_path: str = "/var/mail"
    dms_mail_state_path: str = "/var/mail-state"
    mailserver_env_path: str = "/config/mailserver.env"

    imapsync_log_path: str = "/var/log/imapsync"
    imapsync_container_name: str = "mail-imapsync"
    webui_log_path: str = "/var/log/webui"
    mail_log_path: str = "/var/log/mail"

    cookie_secure: bool = False

    scheduler_timezone: str = "UTC"
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    admin_email: str = "admin@example.com"
    admin_password: str = "ChangeMe123!"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
