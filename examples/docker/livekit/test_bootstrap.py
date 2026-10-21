from pathlib import Path
import unittest

DIRECTORY = Path(__file__).resolve().parent


class BootstrapTests(unittest.TestCase):
    def test_database_uses_native_bootstrap_superuser(self):
        compose = (DIRECTORY/'compose.supabase.yml').read_text()
        self.assertIn('POSTGRES_USER: supabase_admin', compose)
        self.assertIn('PGUSER: supabase_admin', compose)
        self.assertIn("rolname='authenticator'", compose)
        self.assertIn('NOT rolsuper', compose)

    def test_failed_volume_can_be_preserved_with_explicit_override(self):
        compose = (DIRECTORY/'compose.supabase.yml').read_text()
        self.assertIn('name: ${SUPABASE_DB_VOLUME:-${COMPOSE_PROJECT_NAME:-audiocpp-livekit}_supabase-db}', compose)
        self.assertIn('}_supabase-db}-config', compose)
        self.assertNotIn('recover-bootstrap.sh', compose)
