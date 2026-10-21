import os
import tempfile
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, patch
from livekit.agents import Agent, ModelSettings, llm
from memory import Store
from memory_agent import MemoryAgent, WorkOrderDecision
from settings import defaults
from work_orders import WorkOrder


class WorkOrderFlowTests(unittest.IsolatedAsyncioTestCase):
    def assistant(self):
        store = Store('11111111-1111-4111-8111-111111111111')
        store.embed = AsyncMock(return_value=None)
        store.search = AsyncMock(return_value=[])
        store.save_work_order = AsyncMock(return_value={'saved': True})
        notify = AsyncMock()
        return MemoryAgent('prompt', store, 3, 'maintenance-0123456789ab', notify), store, notify

    async def test_no_change_decision_does_not_write(self):
        assistant, store, notify = self.assistant()
        await assistant.route_work_order('no_change', 'User is asking a question')
        store.save_work_order.assert_not_awaited()
        self.assertEqual(notify.await_args.args[0]['state'], 'unchanged')

    async def test_save_decision_executes_database_write(self):
        assistant, store, notify = self.assistant()
        await assistant.route_work_order('save', 'User confirmed prior report', WorkOrder(customer='台積電'))
        store.save_work_order.assert_awaited_once()
        self.assertEqual(notify.await_args.args[0]['state'], 'saved')

    async def test_save_without_metadata_is_rejected(self):
        assistant, store, notify = self.assistant()
        result = await assistant.route_work_order('save', 'User requested storage')
        store.save_work_order.assert_not_awaited()
        self.assertIn('NOT saved', result)

    async def test_report_is_saved_before_reply_generation(self):
        assistant, store, notify = self.assistant()
        assistant.decide_work_order = AsyncMock(return_value=WorkOrderDecision(
            action='save', reason='maintenance report', metadata=WorkOrder(customer='台積電')))
        await assistant.on_user_turn_completed(llm.ChatContext(), llm.ChatMessage(role='user', content=['我要新增工單']))
        store.save_work_order.assert_awaited_once()
        self.assertEqual(notify.await_args.args[0]['state'], 'saved')

    async def test_failed_decision_cannot_speak_success(self):
        assistant, store, notify = self.assistant()
        assistant.decide_work_order = AsyncMock(side_effect=ValueError('invalid JSON'))
        with self.assertLogs('memory_agent', level='ERROR'):
            await assistant.on_user_turn_completed(llm.ChatContext(), llm.ChatMessage(role='user', content=['正確']))
        with patch.object(Agent.default, 'llm_node') as generate:
            output = [chunk async for chunk in assistant.llm_node(llm.ChatContext(), assistant.tools, ModelSettings())]
            generate.assert_not_called()
        self.assertNotIn('已新增完成', ''.join(output))
        self.assertIn('尚未儲存', ''.join(output))
        self.assertEqual(notify.await_args.args[0]['state'], 'error')

    async def test_commit_result_drives_status_and_original_source(self):
        assistant, store, notify = self.assistant()
        assistant.latest_source_text = '新增工單，EF-03 更換強排FAN 2個'
        result = await assistant.save_work_order_metadata(WorkOrder(customer='台積電'))
        self.assertIn('saved in Supabase', result)
        self.assertTrue(assistant.work_order_active)
        self.assertEqual(store.save_work_order.await_args.args[1].source_text, assistant.latest_source_text)
        self.assertEqual([call.args[0]['state'] for call in notify.await_args_list], ['saving', 'saved'])

    async def test_failed_commit_has_no_success_event_or_spoken_claim(self):
        assistant, store, notify = self.assistant()
        store.save_work_order.side_effect = RuntimeError('database unavailable')
        with self.assertLogs('memory_agent', level='ERROR'):
            result = await assistant.save_work_order_metadata(WorkOrder())
        self.assertIn('NOT saved', result)
        self.assertEqual([call.args[0]['state'] for call in notify.await_args_list], ['saving', 'error'])
        with patch.object(Agent.default, 'llm_node') as generate:
            output = [chunk async for chunk in assistant.llm_node(llm.ChatContext(), assistant.tools, ModelSettings())]
            generate.assert_not_called()
        self.assertIn('尚未儲存', ''.join(output))

    async def test_unconfirmed_rpc_response_is_not_success(self):
        assistant, store, notify = self.assistant()
        store.save_work_order.return_value = {}
        with self.assertLogs('memory_agent', level='ERROR'):
            await assistant.save_work_order_metadata(WorkOrder())
        self.assertEqual(notify.await_args.args[0]['state'], 'error')

    def test_ui_memory_default_follows_configured_backend(self):
        with tempfile.TemporaryDirectory() as directory:
            prompt = Path(directory)/'prompt.csv'
            hotwords = Path(directory)/'hotword.csv'
            prompt.write_text('prompt')
            hotwords.write_text('context\n"maintenance"')
            values = {'PROMPT_FILE': str(prompt), 'HOTWORDS_FILE': str(hotwords),
                      'SUPABASE_URL': 'http://local', 'SUPABASE_PUBLISHABLE_KEY': 'anon',
                      'SUPABASE_SECRET_KEY': 'secret'}
            with patch.dict(os.environ, values):
                self.assertTrue(defaults().memory_enabled)
            values['SUPABASE_SECRET_KEY'] = ''
            with patch.dict(os.environ, values):
                self.assertFalse(defaults().memory_enabled)
