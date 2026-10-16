import unittest
from app.forex import fetch_live_usd_to_inr, get_live_usd_to_inr_rate

class TestForexModule(unittest.TestCase):
    def test_fetch_live_rate_structure(self):
        result = fetch_live_usd_to_inr()
        self.assertIn("rate", result)
        self.assertIn("currency_pair", result)
        self.assertEqual(result["currency_pair"], "USD/INR")
        self.assertGreater(result["rate"], 50.0)
        self.assertLess(result["rate"], 200.0)
        self.assertIn("formatted", result)
        self.assertTrue(result["formatted"].startswith("₹"))

    def test_get_live_rate_float(self):
        rate = get_live_usd_to_inr_rate()
        self.assertIsInstance(rate, float)
        self.assertGreater(rate, 50.0)
        self.assertLess(rate, 200.0)

if __name__ == "__main__":
    unittest.main()
