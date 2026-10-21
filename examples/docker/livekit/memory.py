"""Supabase REST persistence with server-verified user scopes and local embeddings."""
import json
import logging
import math
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, Field
from settings import session_path

logger = logging.getLogger(__name__)
TABLES = {'knowledge': 'voice_knowledge', 'memories': 'voice_memories',
          'sessions': 'voice_sessions', 'turns': 'voice_turns'}


def configured():
    return bool(os.getenv('SUPABASE_URL') and os.getenv('SUPABASE_PUBLISHABLE_KEY')
                and os.getenv('SUPABASE_SECRET_KEY'))


def public_config():
    # Publishable/anon key is intentionally public; secret/service-role never is.
    return {'enabled': configured(), 'url': os.getenv('SUPABASE_PUBLIC_URL') or os.getenv('SUPABASE_URL', ''),
            'publishable_key': os.getenv('SUPABASE_PUBLISHABLE_KEY', '') if configured() else ''}


async def verified_user(authorization):
    if not configured():
        raise HTTPException(503, 'Configure Supabase URL, publishable key and server secret first')
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Sign in to Supabase first')
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(os.environ['SUPABASE_URL'].rstrip('/') + '/auth/v1/user',
            headers={'apikey': os.environ['SUPABASE_PUBLISHABLE_KEY'], 'Authorization': authorization})
    if response.status_code in (401, 403, 404):
        raise HTTPException(401, 'Supabase session expired or invalid')
    if response.status_code != 200:
        raise HTTPException(502, 'Supabase authentication unavailable; check the auth service and API configuration')
    user_id = response.json().get('id')
    import uuid
    try:
        return str(uuid.UUID(user_id))
    except (ValueError, TypeError, AttributeError) as error:
        raise HTTPException(401, 'Invalid verified user identity') from error


def save_identity(room, user_id):
    path = session_path(room).with_suffix('.identity.json')
    path.write_text(json.dumps({'user_id': user_id}), encoding='utf-8')
    path.chmod(0o600)


def load_identity(room):
    return json.loads(session_path(room).with_suffix('.identity.json').read_text())['user_id']


class MemoryRow(BaseModel):
    kind: str = Field(pattern='^memories$')
    key: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=12000)


class Store:
    def __init__(self, user_id, client=None):
        # Never accept this ID directly from browser JSON or model tool arguments.
        import uuid
        self.user_id = str(uuid.UUID(user_id))
        self.client = client

    async def request(self, method, path, *, params=None, body=None, prefer=None):
        key = os.environ['SUPABASE_SECRET_KEY']
        headers = {'apikey': key}
        if key.startswith('eyJ'):
            headers['Authorization'] = 'Bearer ' + key
        if prefer:
            headers['Prefer'] = prefer
        async def send(client):
            response = await client.request(method, os.environ['SUPABASE_URL'].rstrip('/') + '/rest/v1/' + path,
                                           headers=headers, params=params, json=body)
            response.raise_for_status()
            return response.json() if response.content else None
        if self.client:
            return await send(self.client)
        async with httpx.AsyncClient(timeout=15) as client:
            return await send(client)

    async def embed(self, text):
        # Embeddings run inside Supabase Edge Runtime, not on the Jetson.
        if os.getenv('SUPABASE_EMBED_FUNCTION', 'embed') == '':
            return None
        async def send(client):
            response = await client.post(os.environ['SUPABASE_URL'].rstrip('/') +
                '/functions/v1/' + os.getenv('SUPABASE_EMBED_FUNCTION', 'embed'),
                headers={'apikey': os.environ['SUPABASE_SECRET_KEY'],
                         'x-voice-embed-secret': os.getenv('SUPABASE_EMBED_SECRET') or os.environ['SUPABASE_SECRET_KEY']},
                json={'input': text})
            response.raise_for_status()
            vector = response.json()['embedding']
            if len(vector) != 384 or not all(isinstance(x, (int, float)) and math.isfinite(x) for x in vector):
                raise ValueError('Expected a finite 384-dimensional embedding from Supabase')
            return vector
        if self.client:
            return await send(self.client)
        async with httpx.AsyncClient(timeout=20) as client:
            return await send(client)

    async def list_memories(self, limit=10):
        return await self.request('GET', TABLES['memories'], params={
            'select': 'id,memory_type,content,updated_at',
            'order': 'updated_at.desc', 'limit': min(limit, 20)})

    async def upsert(self, kind, key, content):
        if kind not in ('knowledge', 'memories'):
            raise ValueError('Unsupported table')
        try:
            vector = await self.embed(key + '\n' + content)
        except Exception:
            # Saving text must not depend on embedding availability.
            logger.warning('Saving memory without embedding', exc_info=True)
            vector = None
        field = 'title' if kind == 'knowledge' else 'memory_type'
        row = {'user_id': self.user_id, field: key, 'content': content,
               'embedding': vector, 'updated_at': datetime.now(timezone.utc).isoformat()}
        # Keyed updates replace the old embedding too; stale vectors are never retained.
        conflict = field if kind == 'memories' else 'user_id,' + field
        rows = await self.request('POST', TABLES[kind], params={'on_conflict': conflict,
            'select': 'id,' + field + ',content,updated_at'}, body=row,
            prefer='resolution=merge-duplicates,return=representation')
        return rows

    async def delete(self, kind, row_id):
        if kind not in ('knowledge', 'memories'):
            raise ValueError('Unsupported table')
        params = {'id': 'eq.' + str(row_id), 'select': 'id'}
        if kind == 'knowledge':
            params['user_id'] = 'eq.' + self.user_id
        return await self.request('DELETE', TABLES[kind], params=params, prefer='return=representation')

    async def forget(self, memory_type):
        return await self.request('DELETE', TABLES['memories'], params={
            'memory_type': 'eq.' + memory_type,
            'select': 'id'}, prefer='return=representation')

    async def search(self, kind, query, limit=5, *, vector=...):
        if kind not in ('knowledge', 'memories'):
            raise ValueError('Unsupported table')
        if vector is ...:
            vector = None
            try:
                vector = await self.embed(query)
            except Exception:
                logger.warning('Embedding unavailable; using lexical search', exc_info=True)
        if kind == 'memories':
            return await self.request('POST', 'rpc/voice_search_shared', body={
                'query_text': query, 'query_embedding': vector,
                'match_count': min(max(limit, 1), 10)})
        return await self.request('POST', 'rpc/voice_search', body={
            'p_user_id': self.user_id, 'p_kind': kind, 'query_text': query,
            'query_embedding': vector, 'match_count': min(max(limit, 1), 10)})

    async def start_session(self, room):
        return await self.request('POST', TABLES['sessions'], params={'on_conflict': 'room'},
            body={'room': room, 'user_id': self.user_id, 'status': 'active'},
            prefer='resolution=merge-duplicates,return=minimal')

    async def add_turn(self, room, item_id, role, content):
        return await self.request('POST', TABLES['turns'], params={'on_conflict': 'room,item_id'},
            body={'room': room, 'item_id': item_id, 'user_id': self.user_id,
                  'role': role, 'content': content}, prefer='resolution=merge-duplicates,return=minimal')

    async def finish_session(self, room, report):
        return await self.request('PATCH', TABLES['sessions'], params={
            'room': 'eq.' + room, 'user_id': 'eq.' + self.user_id}, body={
            'status': 'completed', 'ended_at': datetime.now(timezone.utc).isoformat(), 'report': report})


    async def save_work_order(self, room, metadata):
        return await self.request('POST', 'rpc/voice_save_work_order', body={
            'p_user_id': self.user_id, 'p_room': room,
            'p_data': metadata.model_dump(mode='json', exclude_none=True)})
