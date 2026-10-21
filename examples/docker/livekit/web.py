"""LAN development client and local participant-token endpoint."""
import os
from fastapi import FastAPI, HTTPException, Request
from memory import public_config, verified_user, save_identity, Store, MemoryRow
import httpx
from settings import Settings, defaults, save_session
from fastapi.responses import FileResponse
from livekit import api

app = FastAPI()


@app.get('/')
async def index():
    return FileResponse('/app/index.html')


@app.get('/client.js')
async def javascript():
    return FileResponse('/app/client.js', media_type='application/javascript')


@app.post('/connect')
async def connect(settings: Settings, request: Request):
    import uuid
    room = 'maintenance-' + uuid.uuid4().hex[:12]
    if settings.memory_enabled:
        user_id = await verified_user(request.headers.get("authorization"))
        save_session(room, settings)
        save_identity(room, user_id)
    else:
        save_session(room, settings)
    token = (api.AccessToken(os.environ['LIVEKIT_API_KEY'], os.environ['LIVEKIT_API_SECRET'])
             .with_identity('operator-' + uuid.uuid4().hex[:12])
             .with_grants(api.VideoGrants(room_join=True, room=room)))
    return {'url': os.getenv('LIVEKIT_PUBLIC_URL') or
            f"ws://{os.environ['LIVEKIT_NODE_IP']}:{os.getenv('LIVEKIT_PORT', '7880')}",
            'token': token.to_jwt(), 'room': room}


@app.get('/settings')
async def get_settings():
    return defaults()


@app.post('/models/{kind}')
async def models(kind: str, settings: Settings):
    if kind not in ('stt', 'llm', 'tts'):
        raise HTTPException(404)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(getattr(settings, kind + '_url') + '/models',
                headers={'Authorization': 'Bearer ' + os.getenv(kind.upper() + '_API_KEY', 'local')})
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as error:
        raise HTTPException(502, str(error)) from error


@app.get('/memory/config')
async def memory_config():
    return public_config()


@app.post('/memory/rows')
async def put_memory_row(row: MemoryRow, request: Request):
    user_id = await verified_user(request.headers.get('authorization'))
    try:
        return await Store(user_id).upsert(row.kind, row.key, row.content)
    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(502, 'Could not save memory; check database and Supabase embedding function') from error


@app.delete('/memory/rows/{kind}/{row_id}')
async def delete_memory_row(kind: str, row_id: str, request: Request):
    import uuid
    if kind != 'memories':
        raise HTTPException(404)
    try:
        uuid.UUID(row_id)
    except ValueError:
        raise HTTPException(400, 'Invalid row ID')
    user_id = await verified_user(request.headers.get('authorization'))
    result = await Store(user_id).delete(kind, row_id)
    if not result:
        raise HTTPException(404, 'Owned row not found')
    return {'deleted': True}
