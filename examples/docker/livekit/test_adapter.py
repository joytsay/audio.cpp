import base64
import os
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx

from adapter import app, speech_body


class AdapterTests(unittest.IsolatedAsyncioTestCase):
    def test_preset_and_identifiers(self):
        voices = Path(__file__).resolve().parents[3] / 'voices'
        with patch.dict(os.environ, {'VOICE_DIR': str(voices), 'TTS_VOICE': 'lingCL',
                                     'CHINESE_NUMBERS': '1', 'TTS_MODEL': 'zipvoice'}):
            body = speech_body('F15P1 SN 0014778725，6460MF')
        self.assertEqual(body['input'], 'F一伍P一 SN 零零一四七七八七二伍，六四六零MF')
        self.assertEqual(body['model'], 'zipvoice')
        self.assertEqual(base64.b64decode(body['voice_ref']['data']),
                         (voices / 'lingCLvocals.wav').read_bytes())
        self.assertTrue(body['reference_text'])

    async def test_stt_multipart_and_tts_routing(self):
        calls = []

        def backend(request):
            calls.append(request)
            if request.url.path.endswith('transcriptions'):
                self.assertIn(b'qwen3-asr', request.content)
                self.assertIn(b'RIFF', request.content)
                self.assertNotIn(b'name="prompt"', request.content)
                return httpx.Response(200, json={'text': '維修工單'})
            self.assertIn('zipvoice', request.content.decode())
            return httpx.Response(200, content=b'RIFF-test-wave')

        with patch.dict(os.environ, {'STT_BASE_URL': 'http://backend:8081/v1',
                                    'TTS_BASE_URL': 'http://backend:8081/v1',
                                    'TTS_MODEL': 'zipvoice', 'STT_MODEL': 'qwen3-asr',
                                    'TTS_VOICE': 'custom', 'USE_HOTWORDS': '0'}):
            async with httpx.AsyncClient(transport=httpx.MockTransport(backend)) as upstream:
                app.state.client = upstream
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://adapter') as client:
                    response = await client.post('/v1/audio/transcriptions', files={'file': ('a.wav', b'RIFF')})
                    self.assertEqual(response.json(), {'text': '維修工單'})
                    response = await client.post('/v1/audio/speech', json={'model': 'tts-1', 'input': 'SN 12'})
                    self.assertEqual(response.content, b'RIFF-test-wave')
                    self.assertEqual(response.headers['content-type'], 'audio/wav')
        self.assertEqual(len(calls), 2)

    async def test_upstream_failure_is_not_audio(self):
        async with httpx.AsyncClient(transport=httpx.MockTransport(
                lambda _: httpx.Response(503, text='model unavailable'))) as upstream:
            app.state.client = upstream
            with patch.dict(os.environ, {'TTS_VOICE': 'custom'}):
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url='http://adapter') as client:
                    result = await client.post('/v1/audio/speech', json={'input': '測試'})
                    self.assertEqual(result.status_code, 503)


if __name__ == '__main__':
    unittest.main()
