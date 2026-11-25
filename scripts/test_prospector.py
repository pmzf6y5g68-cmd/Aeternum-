"""Tests du robot : python3 scripts/test_prospector.py (dépendances : scripts/requirements.txt)."""
import os
import sys
from datetime import datetime, timedelta, timezone

os.environ["UNSUBSCRIBE_SECRET"] = "test-unsub-secret"
sys.path.insert(0, os.path.dirname(__file__))
import prospector as p  # noqa: E402

NOW = datetime(2026, 11, 25, tzinfo=timezone.utc)


def test_token_matches_typescript_vector() -> None:
    # Même vecteur que __tests__/outreach.test.ts : les deux implémentations doivent rester identiques.
    assert p.unsubscribe_token("Julie@Elegance.fr") == "anVsaWVAZWxlZ2FuY2UuZnI.RR0dO_5aIYepGiDxcfy6I4WKNFDvwweix0J_-gV2dJI"


def test_warmup_ramp() -> None:
    assert p.compute_daily_cap(None, 0, 0, 0, NOW)[0] == p.WARMUP_START
    assert p.compute_daily_cap(NOW - timedelta(days=10), 0, 0, 0, NOW)[0] == int(p.WARMUP_START * p.WARMUP_GROWTH ** 10)
    assert p.compute_daily_cap(NOW - timedelta(days=90), 0, 0, 0, NOW)[0] == p.MAX_EMAILS_PER_DAY


def test_health_brakes() -> None:
    old = NOW - timedelta(days=90)
    assert p.compute_daily_cap(old, 1000, 50, 0, NOW)[0] == p.MAX_EMAILS_PER_DAY // 2  # rebonds 5 %
    assert p.compute_daily_cap(old, 1000, 0, 1, NOW)[0] == p.MAX_EMAILS_PER_DAY // 2  # plaintes 0,1 %
    assert p.compute_daily_cap(old, 1000, 0, 3, NOW)[0] == 0  # plaintes 0,3 % : pause
    assert p.compute_daily_cap(old, 50, 40, 5, NOW)[0] == p.MAX_EMAILS_PER_DAY  # échantillon trop petit


def test_ceiling_grows_only_with_excellent_health() -> None:
    old = NOW - timedelta(days=60)
    grown = p.compute_daily_cap(old, 10000, 20, 1, NOW)[0]
    assert p.MAX_EMAILS_PER_DAY < grown <= p.HARD_MAX_EMAILS_PER_DAY
    assert p.compute_daily_cap(old, 10000, 200, 1, NOW)[0] == p.MAX_EMAILS_PER_DAY  # rebonds 2 % : pas d'extension
    assert p.compute_daily_cap(NOW - timedelta(days=3650), 10000, 0, 0, NOW)[0] == p.HARD_MAX_EMAILS_PER_DAY


def test_footer_has_one_click_unsubscribe() -> None:
    assert "/desinscription?t=" in p.footer("a@b.fr")


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok {name}")
