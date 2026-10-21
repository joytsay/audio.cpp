"""Validated per-room settings shared by the web service, agent and adapter."""
import csv
import io
import os
import re
from pathlib import Path
from urllib.parse import urlparse
from pydantic import BaseModel, Field, field_validator, model_validator


class Settings(BaseModel):
    stt_url: str = 'http://127.0.0.1:8081/v1'
    stt_model: str = Field(default='qwen3-asr', min_length=1, max_length=256)
    language: str = 'zh'
    hotwords_enabled: bool = False
    hotwords: str = Field(default='', max_length=8000)
    llm_url: str = 'http://127.0.0.1:8082/v1'
    llm_model: str = Field(default='bartowski/Qwen2.5-3B-Instruct-GGUF:Q4_K_M', min_length=1)
    temperature: float = Field(default=0.2, ge=0, le=2)
    max_tokens: int = Field(default=512, ge=32, le=4096)
    tts_url: str = 'http://127.0.0.1:8081/v1'
    tts_model: str = Field(default='zipvoice', min_length=1)
    voice: str = Field(default='lingCL', min_length=1)
    chinese_numbers: bool = True
    prompt: str = Field(default='', max_length=64000)
    greeting: str = Field(default='', max_length=2000)
    timeout: float = Field(default=120, ge=5, le=600)
    endpoint_delay: float = Field(default=0.8, ge=0, le=10)
    max_endpoint_delay: float = Field(default=3, ge=0, le=15)
    vad_threshold: float = Field(default=0.5, ge=0.05, le=0.95)
    vad_silence: float = Field(default=0.55, ge=0.1, le=5)
    interruptions: bool = True
    interruption_duration: float = Field(default=0.5, ge=0.1, le=5)
    preemptive: bool = False
    memory_enabled: bool = False
    memory_top_k: int = Field(default=3, ge=1, le=10)

    @field_validator('stt_url', 'llm_url', 'tts_url')
    @classmethod
    def valid_url(cls, value):
        parsed = urlparse(value)
        if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError('Use an HTTP(S) API base URL without credentials, query or fragment')
        return value.rstrip('/')

    @model_validator(mode='after')
    def valid_delays(self):
        if self.max_endpoint_delay < self.endpoint_delay:
            raise ValueError('Maximum turn delay must be at least the minimum turn delay')
        return self


def defaults():
    data = {}
    for field, env in {'stt_url': 'STT_BASE_URL', 'stt_model': 'STT_MODEL', 'language': 'STT_LANGUAGE',
                       'llm_url': 'LLM_BASE_URL', 'llm_model': 'LLM_MODEL', 'tts_url': 'TTS_BASE_URL',
                       'tts_model': 'TTS_MODEL', 'voice': 'TTS_VOICE', 'greeting': 'GREETING',
                       'timeout': 'API_TIMEOUT'}.items():
        if env in os.environ:
            data[field] = os.environ[env]
    data['memory_enabled'] = all(os.getenv(key) for key in ('SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY'))
    data['hotwords_enabled'] = os.getenv('USE_HOTWORDS', '0') == '1'
    data['chinese_numbers'] = os.getenv('CHINESE_NUMBERS', '1') == '1'
    data['prompt'] = Path(os.getenv('PROMPT_FILE', '/data/prompt.csv')).read_text(encoding='utf-8')
    rows = list(csv.reader(io.StringIO(Path(os.getenv('HOTWORDS_FILE', '/data/hotword.csv')).read_text(encoding='utf-8'))))
    data['hotwords'] = rows[1][0] if len(rows) > 1 else ''
    return Settings(**data)


def session_path(room):
    if not re.fullmatch(r'maintenance-[a-f0-9]{12}', room):
        raise ValueError('Invalid session ID')
    return Path('/tmp/livekit-sessions') / (room + '.json')


def save_session(room, settings):
    path = session_path(room)
    path.parent.mkdir(mode=0o700, exist_ok=True)
    # Expire unused sessions; active sessions retain settings in agent memory.
    import time
    for old in path.parent.glob('maintenance-*.json'):
        if time.time() - old.stat().st_mtime > 86400:
            old.unlink(missing_ok=True)
    path.write_text(settings.model_dump_json(), encoding='utf-8')
    path.chmod(0o600)


def load_session(room):
    return Settings.model_validate_json(session_path(room).read_text(encoding='utf-8'))
