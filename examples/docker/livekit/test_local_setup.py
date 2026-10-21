import json
import base64
import hashlib
import hmac
from pathlib import Path
import unittest
from pydantic import ValidationError
from work_orders import WorkOrder
from memory import Store
from memory_agent import MemoryAgent

class LocalSetupTests(unittest.TestCase):
    def test_environment_example_contains_matching_keys(self):
        text=Path(__file__).with_name('.env.example').read_text()
        data=dict(line.split('=',1) for line in text.splitlines() if '=' in line and not line.startswith('#'))
        self.assertEqual(len(data['VOICE_REALTIME_DB_KEY']),16)
        self.assertGreaterEqual(len(data['VOICE_REALTIME_SECRET']),64)
        for name,role in [('SUPABASE_PUBLISHABLE_KEY','anon'),('SUPABASE_SECRET_KEY','service_role')]:
            token=data[name].split('.')
            expected=base64.urlsafe_b64encode(hmac.new(data['VOICE_JWT_SECRET'].encode(),'.'.join(token[:2]).encode(),hashlib.sha256).digest()).rstrip(b'=').decode()
            self.assertEqual(token[2],expected)
            self.assertEqual(json.loads(base64.urlsafe_b64decode(token[1]+'=='))['role'],role)

    def test_metadata_types_and_unknown_equipment_association(self):
        record=WorkOrder(reported_at='2026-06-02T14:00:00+08:00',customer='台積電',
            equipment=[{'equipment_id':'F15P1H4K-GEX-EF-03','exhaust_fan_quantity':2,'panel_fan_quantity':0}],
            spare_parts=[{'part_number':'20BD156AOANNANCU','serial_number':'0014778725',
                          'manufactured_on':'2010-12-03','capacitance_value':6460,'capacitance_unit':'MF'}])
        self.assertEqual(record.spare_parts[0].serial_number,'0014778725')
        self.assertIsNone(record.spare_parts[0].equipment_id)
        self.assertEqual(record.equipment[0].panel_fan_quantity,0)
        with self.assertRaises(ValidationError): WorkOrder(reported_at='2026-06-02T14:00:00')

    def test_real_store_exposes_only_expected_tools(self):
        agent=MemoryAgent('prompt',Store('11111111-1111-4111-8111-111111111111'),3,'maintenance-0123456789ab')
        self.assertEqual(len(agent.tools),5)
