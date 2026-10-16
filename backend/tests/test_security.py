import unittest
import hashlib
from app.security import hash_password, verify_and_upgrade_password, sanitize_identifier, generate_session_token

class TestSecurityModule(unittest.TestCase):
    def test_bcrypt_hashing(self):
        pwd = "EnterpriseSecret#2026"
        hashed = hash_password(pwd)
        self.assertTrue(hashed.startswith("$2b$"))
        
        is_valid, needs_upgrade = verify_and_upgrade_password(pwd, hashed)
        self.assertTrue(is_valid)
        self.assertFalse(needs_upgrade)

        is_valid_wrong, _ = verify_and_upgrade_password("WrongPassword", hashed)
        self.assertFalse(is_valid_wrong)

    def test_legacy_sha256_upgrade(self):
        pwd = "LegacyPassword123"
        legacy_hash = hashlib.sha256(pwd.encode("utf-8")).hexdigest()

        is_valid, needs_upgrade = verify_and_upgrade_password(pwd, legacy_hash)
        self.assertTrue(is_valid)
        self.assertTrue(needs_upgrade)

    def test_sanitize_identifier(self):
        raw = "vol-0123456789; rm -rf /; `whoami`"
        cleaned = sanitize_identifier(raw)
        self.assertNotIn(";", cleaned)
        self.assertNotIn("`", cleaned)
        self.assertNotIn(" ", cleaned)
        self.assertTrue(cleaned.startswith("vol-0123456789"))

    def test_token_entropy(self):
        t1 = generate_session_token()
        t2 = generate_session_token()
        self.assertEqual(len(t1), 64)
        self.assertNotEqual(t1, t2)

if __name__ == "__main__":
    unittest.main()
