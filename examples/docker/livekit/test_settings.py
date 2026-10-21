import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
from pydantic import ValidationError
from settings import Settings, load_session, save_session, session_path
import adapter
import web
import agent


class SettingsTests(unittest.IsolatedAsyncioTestCase):
    def test_bounds_and_urls(self):
        for fields in ({'temperature': 3}, {'vad_threshold': 0},
                       {'endpoint_delay': 4, 'max_endpoint_delay': 1},
                       {'stt_url': 'file:///etc/passwd'}):
            with self.assertRaises(ValidationError):
                Settings(**fields)
        with self.assertRaises(ValueError):
            session_path('../private')

    async def test_connect_persists_distinct_room_settings(self):
        root = Path(tempfile.mkdtemp())
        with patch.dict(os.environ, {'LIVEKIT_API_KEY': 'devkey', 'LIVEKIT_API_SECRET': 'x' * 32,
                                     'LIVEKIT_NODE_IP': '192.168.5.151'}), \
             patch('settings.session_path', side_effect=lambda room: root / (room + '.json')):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(web.app), base_url='http://web') as client:
                first = await client.post('/connect', json=Settings(prompt='First', voice='lingCL').model_dump())
                second = await client.post('/connect', json=Settings(prompt='Second', voice='WangSG').model_dump())
                self.assertEqual(first.status_code, 200)
                self.assertNotEqual(first.json()['room'], second.json()['room'])
                self.assertEqual(load_session(first.json()['room']).prompt, 'First')
                self.assertEqual(load_session(second.json()['room']).voice, 'WangSG')
                bad = await client.post('/connect', json={'temperature': 9})
                self.assertEqual(bad.status_code, 422)

    async def test_session_adapter_uses_room_backend_and_voice(self):
        config = Settings(tts_url='http://custom:1234/v1', tts_model='custom-tts',
                          voice='custom', chinese_numbers=False)
        def backend(request):
            self.assertEqual(str(request.url), 'http://custom:1234/v1/audio/speech')
            body = json.loads(request.content)
            self.assertEqual(body['input'], 'SN 12')
            self.assertEqual(body['voice'], 'custom')
            self.assertEqual(body['model'], 'custom-tts')
            return httpx.Response(200, content=b'RIFF')
        with patch('adapter.load_session', return_value=config):
            async with httpx.AsyncClient(transport=httpx.MockTransport(backend)) as upstream:
                adapter.app.state.client = upstream
                async with httpx.AsyncClient(transport=httpx.ASGITransport(adapter.app), base_url='http://adapter') as client:
                    response = await client.post('/sessions/maintenance-0123456789ab/v1/audio/speech', json={'input': 'SN 12'})
                    self.assertEqual(response.content, b'RIFF')

    async def test_agent_applies_session_controls(self):
        config = Settings(prompt='Session instructions', greeting='', temperature=0.7,
                          max_tokens=200, interruptions=False, vad_threshold=0.65)
        ctx = MagicMock()
        ctx.connect = AsyncMock()
        ctx.room.name = 'maintenance-0123456789ab'
        session = MagicMock()
        session.start = AsyncMock()
        with patch('agent.load_session', return_value=config), \
             patch('agent.silero.VAD.load') as vad, \
             patch('agent.openai.LLM') as llm, \
             patch('agent.openai.STT'), patch('agent.openai.TTS'), \
             patch('agent.AgentSession', return_value=session) as factory:
            await agent.entrypoint(ctx)
            self.assertFalse(factory.call_args.kwargs['allow_interruptions'])
            self.assertEqual(vad.call_args.kwargs['activation_threshold'], 0.65)
            self.assertEqual(llm.call_args.kwargs['temperature'], 0.7)
            self.assertEqual(llm.call_args.kwargs['max_completion_tokens'], 200)
            session.start.assert_awaited_once()


if __name__ == '__main__':
    unittest.main()
