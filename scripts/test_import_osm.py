import unittest

from import_osm import category_of, clean_phone, clean_url, to_listing


class ImportOsmTest(unittest.TestCase):
    def test_mapping(self):
        self.assertEqual(category_of({"shop": "hairdresser", "name": "Salon"}), "coiffeur")
        self.assertEqual(category_of({"shop": "hairdresser", "hairdresser": "barber"}), "barbier")
        self.assertEqual(category_of({"shop": "beauty", "beauty": "nails"}), "onglerie")
        self.assertEqual(category_of({"craft": "plumber"}), "plombier")
        self.assertIsNone(category_of({"shop": "bakery"}))

    def test_listing(self):
        row = to_listing({"type": "node", "id": 42, "lat": 45.76, "lon": 4.83, "tags": {"shop": "hairdresser", "name": "Coiffure du Parc", "addr:housenumber": "3", "addr:street": "Rue Neuve", "addr:city": "Lyon", "phone": "+33 4 78 00 00 00;+33 6 00", "website": "coiffure.fr"}})
        self.assertEqual(row["source_id"], "node/42")
        self.assertEqual(row["address"], "3 Rue Neuve")
        self.assertEqual(row["city_slug"], "lyon")
        self.assertEqual(row["phone"], "+33 4 78 00 00 00")
        self.assertEqual(row["website"], "https://coiffure.fr")

    def test_way_center_and_rejects(self):
        self.assertIsNotNone(to_listing({"type": "way", "id": 1, "center": {"lat": 1, "lon": 2}, "tags": {"amenity": "restaurant", "name": "Chez Lu"}}))
        self.assertIsNone(to_listing({"type": "node", "id": 2, "lat": 1, "lon": 2, "tags": {"amenity": "restaurant"}}))
        self.assertIsNone(clean_phone("12"))
        self.assertIsNone(clean_url("pas une url"))


if __name__ == "__main__":
    unittest.main()
