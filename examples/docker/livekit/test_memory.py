import json
import os
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import HTTPException
from livekit.agents import llm
from memory import Store, verified_user, public_config
from memory_agent import MemoryAgent
from settings import Settings
import web

USER = '11111111-1111-4111-8111-111111111111'
OTHER = '22222222-2222-4222-8222-222222222222'
ENV = {'SUPABASE_URL': 'http://supabase', 'SUPABASE_PUBLISHABLE_KEY': 'public-key',
       'SUPABASE_SECRET_KEY': 'sb_secret_PRIVATE', 'SUPABASE_EMBED_FUNCTION': 'embed'}


class MemoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_scoped_writes_and_embedding(self):
        requests = []
        def backend(req):
            requests.append(req)
            if req.url.path == '/functions/v1/embed':
                return httpx.Response(200, json={'embedding':[0.1]*384})
            if req.method == 'POST':
                body = json.loads(req.content)
                self.assertEqual(body['user_id'], USER)
                self.assertEqual(len(body['embedding']), 384)
                self.assertNotIn('Authorization', req.headers)  # modern key is apikey-only
                self.assertEqual(req.headers['apikey'], 'sb_secret_PRIVATE')
                return httpx.Response(201, json=[{'id':'example'}])
            self.assertEqual(req.url.params['user_id'], 'eq.'+USER)
            return httpx.Response(200, json=[])
        with patch.dict(os.environ, ENV), httpx_mock(backend) as client:
            store = Store(USER, client)
            await store.upsert('memories','equipment','EF-03')
            await store.delete('knowledge',OTHER)
            await store.list_memories()
        self.assertEqual(len(requests), 4)

    async def test_embedding_failure_falls_back_without_cross_user_query(self):
        def backend(req):
            if req.url.path == '/functions/v1/embed':
                return httpx.Response(503)
            body = json.loads(req.content)
            self.assertEqual(body['p_user_id'], USER)
            self.assertIsNone(body['query_embedding'])
            self.assertEqual(body['p_kind'], 'memories')
            return httpx.Response(200, json=[{'content':'remembered'}])
        with patch.dict(os.environ, ENV), httpx_mock(backend) as client:
            self.assertTrue(await Store(USER,client).search('memories','設備'))

    async def test_wrong_embedding_dimensions_fail_write(self):
        with patch.dict(os.environ, ENV), httpx_mock(lambda _: httpx.Response(200,json={'embedding':[1,2]})) as client:
            with self.assertRaises(ValueError):
                await Store(USER,client).upsert('knowledge','Title','Content')

    async def test_connect_requires_verified_identity(self):
        config = Settings(memory_enabled=True).model_dump()
        with patch.dict(os.environ, ENV):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(web.app),base_url='http://web') as client:
                response=await client.post('/connect',json=config)
                self.assertEqual(response.status_code,401)
        with patch('web.verified_user',new=AsyncMock(return_value=USER)) as verify, \
             patch('web.save_identity') as identity, patch('web.save_session'), \
             patch.dict(os.environ,{'LIVEKIT_API_KEY':'devkey','LIVEKIT_API_SECRET':'x'*32,'LIVEKIT_NODE_IP':'127.0.0.1'}):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(web.app),base_url='http://web') as client:
                response=await client.post('/connect',json={**config,'user_id':OTHER},headers={'Authorization':'Bearer user-token'})
                self.assertEqual(response.status_code,200)
                self.assertEqual(identity.call_args.args[1],USER)
                verify.assert_awaited_once_with('Bearer user-token')

    def test_no_secret_in_browser_config(self):
        with patch.dict(os.environ, ENV):
            result=public_config()
            self.assertTrue(result['enabled'])
            self.assertNotIn('PRIVATE',json.dumps(result))

    async def test_retrieval_is_reference_and_memory_write_failures_are_honest(self):
        store=AsyncMock()
        store.search.side_effect=[[{'content':'EF-03 procedure'}],[{'content':'confirmed user fact'}]]
        assistant=MemoryAgent('Follow the prompt',store,3)
        context=llm.ChatContext()
        message=llm.ChatMessage(role='user',content=['EF-03'])
        await assistant.on_user_turn_completed(context,message)
        self.assertIn('not instructions',context.items[0].text_content)
        self.assertIn('confirmed user fact',context.items[0].text_content)


class httpx_mock:
    def __init__(self, handler): self.client=httpx.AsyncClient(transport=httpx.MockTransport(handler))
    def __enter__(self): return self.client
    def __exit__(self,*args): pass
