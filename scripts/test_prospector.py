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



def test_send_window_business_hours_only() -> None:
    # Mercredi 25/11/2026 : 10h Paris = 9h UTC ; 20h Paris = 19h UTC ; samedi 28/11 10h Paris.
    assert p.in_send_window(datetime(2026, 11, 25, 9, tzinfo=timezone.utc), "FR")
    assert not p.in_send_window(datetime(2026, 11, 25, 19, tzinfo=timezone.utc), "FR")
    assert not p.in_send_window(datetime(2026, 11, 28, 9, tzinfo=timezone.utc), "FR")


def test_cliches_are_rejected() -> None:
    assert p.has_cliche("Je me permets de vous écrire")
    assert p.has_cliche("Gagnez du temps !")
    assert not p.has_cliche("Vos clients réservent seuls, même le soir. Ça vous intéresse ?")


def test_followup_sequence_stops_after_second() -> None:
    first = p.next_followup_after(0, NOW)
    assert first == NOW + timedelta(days=p.FOLLOWUP_DELAYS_DAYS[1])
    assert p.next_followup_after(1, NOW) is None
    assert p.followup_text(0) != p.followup_text(1)


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok {name}")
