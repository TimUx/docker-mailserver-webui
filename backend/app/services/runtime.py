from app.services.imapsync import ImapSyncService

_imapsync_service: ImapSyncService | None = None


def get_imapsync_service() -> ImapSyncService:
    global _imapsync_service
    if _imapsync_service is None:
        _imapsync_service = ImapSyncService()
    return _imapsync_service
