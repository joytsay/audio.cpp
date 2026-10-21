"""LAN development client and local participant-token endpoint."""
import os
from fastapi import FastAPI, HTTPException
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
async def connect(settings: Settings):
    import uuid
    room = 'maintenance-' + uuid.uuid4().hex[:12]
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
