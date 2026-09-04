"""Tests for StackIntegrationService._clamav_info fallback behavior.

The official DMS image (ghcr.io/docker-mailserver/docker-mailserver) does not
ship ``clamdscan`` — only ``clamd`` and ``clamscan`` are available. The ClamAV
status check must therefore fall back to ``clamscan --version`` when
``clamdscan`` is not found in the container.
"""
from unittest.mock import patch

from app.services.stack_integrations import StackIntegrationService


def _make_service() -> StackIntegrationService:
    return StackIntegrationService()


class TestClamavInfo:
    def test_container_down_returns_early(self):
        service = _make_service()
        with patch.object(
            StackIntegrationService, "_run", return_value=(False, "No such container")
        ) as run:
            result = service._clamav_info()
        assert result["status"] == "down"
        # Only the `docker inspect` call, no exec attempts
        assert run.call_count == 1

    def test_clamdscan_success_no_fallback(self):
        service = _make_service()
        outputs = {
            "inspect": (True, "running"),
            "clamdscan": (True, "ClamAV 1.0.5/27234/Wed Sep  3 10:00:00 2024"),
        }

        def fake_run(cmd, timeout=15):
            if "inspect" in cmd:
                return outputs["inspect"]
            if "clamdscan" in cmd:
                return outputs["clamdscan"]
            raise AssertionError(f"unexpected command: {cmd}")

        with patch.object(StackIntegrationService, "_run", side_effect=fake_run) as run:
            result = service._clamav_info()

        assert result["status"] == "running"
        assert result["version"] == "1.0.5"
        assert "ClamAV 1.0.5" in result["message"]
        # inspect + clamdscan only — clamscan must not be called
        assert run.call_count == 2

    def test_fallback_to_clamscan_when_clamdscan_missing(self):
        """Reproduces the issue: clamdscan not in $PATH inside the DMS container."""
        service = _make_service()

        def fake_run(cmd, timeout=15):
            if "inspect" in cmd:
                return (True, "running")
            if "clamdscan" in cmd:
                return (
                    False,
                    'OCI runtime exec failed: exec failed: unable to start container '
                    'process: exec: "clamdscan": executable file not found in $PATH',
                )
            if "clamscan" in cmd:
                return (True, "ClamAV 1.4.2/27400/Mon Sep  1 09:00:00 2025")
            raise AssertionError(f"unexpected command: {cmd}")

        with patch.object(StackIntegrationService, "_run", side_effect=fake_run) as run:
            result = service._clamav_info()

        assert result["status"] == "running"
        assert result["version"] == "1.4.2"
        assert "ClamAV 1.4.2" in result["message"]
        # inspect + clamdscan + clamscan
        assert run.call_count == 3

    def test_degraded_when_both_scanners_fail(self):
        service = _make_service()

        def fake_run(cmd, timeout=15):
            if "inspect" in cmd:
                return (True, "running")
            return (False, "executable file not found in $PATH")

        with patch.object(StackIntegrationService, "_run", side_effect=fake_run):
            result = service._clamav_info()

        assert result["status"] == "degraded"
        assert "version" not in result
