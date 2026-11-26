#!/usr/bin/env python3
"""
Annuaire ouvert : importe depuis OpenStreetMap (licence ODbL) les établissements sur rendez-vous d'une ville,
pour qu'un usager trouve aussi les commerces pas encore inscrits (fiche informative : adresse, téléphone,
horaires ; jamais de réservation ni d'avis inventés).

Données : API Overpass (lecture publique). Attribution « © les contributeurs d'OpenStreetMap » affichée sur
chaque fiche. Rien n'est repris de Google Maps (conditions d'utilisation de Google).

Usage : python scripts/import_osm.py --city "Lyon" [--city "Annecy" ...] [--dry-run]
Env : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (sauf --dry-run).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

OVERPASS_URL = os.environ.get("OVERPASS_URL", "https://overpass-api.de/api/interpreter")
USER_AGENT = "RendezVousAnnuaire/1.0 (annuaire ouvert, contact: voir le site)"

# Étiquettes OSM -> métier Rendez-vous (src/config/categories.ts). L'ordre compte : premier trouvé gagne.
TAG_MAP: list[tuple[str, str, str]] = [
    ("shop", "hairdresser", "coiffeur"),
    ("shop", "beauty", "institut-de-beaute"),
    ("shop", "tattoo", "tatoueur"),
    ("shop", "massage", "massage"),
    ("leisure", "fitness_centre", "coach-sportif"),
    ("amenity", "dancing_school", "cours-de-danse"),
    ("leisure", "dance", "cours-de-danse"),
    ("shop", "car_repair", "garage"),
    ("craft", "car_repair", "garage"),
    ("amenity", "car_wash", "detailing"),
    ("shop", "motorcycle_repair", "moto"),
    ("amenity", "driving_school", "auto-ecole"),
    ("craft", "plumber", "plombier"),
    ("craft", "electrician", "electricien"),
    ("craft", "locksmith", "serrurier"),
    ("shop", "locksmith", "serrurier"),
    ("shop", "pet_grooming", "toilettage"),
    ("amenity", "music_school", "cours-de-musique"),
    ("amenity", "language_school", "cours-de-langues"),
    ("office", "lawyer", "avocat"),
    ("office", "notary", "notaire"),
    ("office", "accountant", "expert-comptable"),
    ("office", "estate_agent", "agent-immobilier"),
    ("office", "insurance", "assurance-banque"),
    ("amenity", "restaurant", "restaurant"),
    ("leisure", "escape_game", "escape-game"),
    ("craft", "photographer", "photographe"),
    ("shop", "tailor", "retouches-couture"),
]


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def category_of(tags: dict[str, str]) -> str | None:
    for key, val, cat in TAG_MAP:
        if tags.get(key) == val:
            if cat == "coiffeur" and (tags.get("hairdresser") == "barber" or "barb" in tags.get("name", "").lower()):
                return "barbier"
            if cat == "institut-de-beaute" and tags.get("beauty") == "nails":
                return "onglerie"
            return cat
    return None


def clean_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    first = re.split(r"[;,/]", raw)[0].strip()
    digits = re.sub(r"[^\d+]", "", first)
    return first if 8 <= len(digits.lstrip("+")) <= 15 else None


def clean_url(raw: str | None) -> str | None:
    if not raw:
        return None
    url = raw.strip().split(";")[0]
    if not re.match(r"^https?://", url):
        url = f"https://{url}"
    return url if re.match(r"^https?://[\w.-]+\.[a-z]{2,}", url, re.I) else None


def to_listing(element: dict) -> dict | None:
    """Élément Overpass (node, ou way/relation avec `center`) -> ligne directory_listings, ou None."""
    tags = element.get("tags") or {}
    name = (tags.get("name") or "").strip()
    category = category_of(tags)
    lat = element.get("lat", (element.get("center") or {}).get("lat"))
    lng = element.get("lon", (element.get("center") or {}).get("lon"))
    if not name or len(name) < 2 or not category or lat is None or lng is None:
        return None
    street = " ".join(p for p in [tags.get("addr:housenumber"), tags.get("addr:street")] if p)
    city = tags.get("addr:city")
    return {
        "source": "osm",
        "source_id": f"{element['type']}/{element['id']}",
        "category": category,
        "name": name[:120],
        "address": street or None,
        "postal_code": tags.get("addr:postcode"),
        "city": city,
        "city_slug": slugify(city) if city else None,
        "lat": float(lat),
        "lng": float(lng),
        "phone": clean_phone(tags.get("phone") or tags.get("contact:phone")),
        "website": clean_url(tags.get("website") or tags.get("contact:website")),
        "opening_hours": (tags.get("opening_hours") or None),
    }


def overpass_query(city: str) -> str:
    filters = "".join(f'nwr["{k}"="{v}"]["name"](area.a);' for k, v, _ in TAG_MAP)
    safe = city.replace('"', "")
    return f'[out:json][timeout:180];area["name"="{safe}"]["boundary"="administrative"]["admin_level"~"^(8|7|6)$"]->.a;({filters});out center tags;'


def fetch(city: str) -> list[dict]:
    data = urllib.parse.urlencode({"data": overpass_query(city)}).encode()
    req = urllib.request.Request(OVERPASS_URL, data=data, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=240) as res:
        return json.load(res).get("elements", [])


def upsert(rows: list[dict]) -> None:
    url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/directory_listings?on_conflict=source,source_id"
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    for i in range(0, len(rows), 500):
        body = json.dumps(rows[i : i + 500]).encode()
        req = urllib.request.Request(
            url,
            data=body,
            method="POST",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                # Les fiches retirées (opposition) ou revendiquées gardent leur état : seules les données OSM changent.
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
        )
        urllib.request.urlopen(req, timeout=60).read()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", action="append", required=True)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    total = 0
    for city in args.city:
        rows = [r for r in (to_listing(e) for e in fetch(city)) if r]
        for r in rows:
            r["city"] = r["city"] or city
            r["city_slug"] = r["city_slug"] or slugify(city)
        print(f"{city} : {len(rows)} établissements")
        if not args.dry_run and rows:
            upsert(rows)
        total += len(rows)
        time.sleep(5)  # Politesse envers le serveur Overpass public.
    print(f"Total : {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
