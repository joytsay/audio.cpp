"""Local HTTP compatibility layer; no inference or cloud calls."""
import base64
import csv
import io
import os
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
from settings import load_session


def speech_body(text: str, settings=None) -> dict:
    if (settings.chinese_numbers if settings else os.getenv('CHINESE_NUMBERS', '1') == '1'):
        text = text.translate(str.maketrans('0123456789', '零一二三四伍六七八九'))
    body = {'model': (settings.tts_model if settings else os.getenv('TTS_MODEL', 'zipvoice')), 'input': text,
            'response_format': 'wav'}
    voice = settings.voice if settings else os.getenv('TTS_VOICE', 'lingCL')
    preset = {'lingCL': 'lingCLvocals', 'WangSG': 'wangSG9s'}.get(voice)
    if preset:
        directory = Path(os.getenv('VOICE_DIR', '/data/voices'))
        lines = (directory / 'prompt_text').read_text(encoding='utf-8').splitlines()
        transcript = next((line.partition('|')[2] for line in lines
                           if line.startswith(preset + '|')), '')
        if not transcript:
            raise ValueError(f'Missing reference transcript: {preset}')
        body['voice_ref'] = {'type': 'base64', 'data': base64.b64encode(
            (directory / f'{preset}.wav').read_bytes()).decode()}
        body['reference_text'] = transcript
    else:
        body['voice'] = voice
    return body


@asynccontextmanager
async def lifespan(app):
    async with httpx.AsyncClient(timeout=float(os.getenv('API_TIMEOUT', '120'))) as client:
        app.state.client = client
        yield


app = FastAPI(lifespan=lifespan)


def headers(kind):
    return {'Authorization': 'Bearer ' + os.getenv(f'{kind}_API_KEY', 'local')}


def checked(response):
    if response.is_error:
        raise HTTPException(response.status_code, response.text[:2000])
    return response


@app.post('/sessions/{room}/v1/audio/transcriptions')
@app.post('/v1/audio/transcriptions')
async def transcribe(request: Request, room: str = None):
    settings = session_settings(room)
    async with request.form() as form:
        upload = form.get('file')
        if upload is None or not hasattr(upload, 'read'):
            raise HTTPException(400, 'file upload required')
        data = {'model': settings.stt_model if settings else os.getenv('STT_MODEL', 'qwen3-asr')}
        language = settings.language if settings else os.getenv('STT_LANGUAGE', 'zh')
        if language:
            data['language'] = language
        if (settings.hotwords_enabled if settings else os.getenv('USE_HOTWORDS', '0') == '1'):
            if settings:
                data['prompt'] = settings.hotwords
            else:
                rows = list(csv.reader(io.StringIO(Path('/data/hotword.csv').read_text())))
                data['prompt'] = rows[1][0]
        response = checked(await request.app.state.client.post(
            (settings.stt_url if settings else os.getenv('STT_BASE_URL', 'http://127.0.0.1:8081/v1')).rstrip('/') + '/audio/transcriptions',
            headers=headers('STT'), data=data, timeout=settings.timeout if settings else float(os.getenv('API_TIMEOUT', '120')),
            files={'file': ('speech.wav', await upload.read(), 'audio/wav')}))
        return response.json()


@app.post('/sessions/{room}/v1/audio/speech')
@app.post('/v1/audio/speech')
async def speak(request: Request, room: str = None):
    settings = session_settings(room)
    body = await request.json()
    text = body.get('input')
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(400, 'non-empty input required')
    response = checked(await request.app.state.client.post(
        (settings.tts_url if settings else os.getenv('TTS_BASE_URL', 'http://127.0.0.1:8081/v1')).rstrip('/') + '/audio/speech',
        headers=headers('TTS'), json=speech_body(text, settings), timeout=settings.timeout if settings else float(os.getenv('API_TIMEOUT', '120'))))
    return Response(response.content, media_type='audio/wav')


def session_settings(room):
    if room is None:
        return None
    try:
        return load_session(room)
    except (ValueError, FileNotFoundError) as error:
        raise HTTPException(404, 'Session not found') from error
