"""CPU orchestration only: reuse the existing audio.cpp and llama.cpp APIs."""
import os

import httpx
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, cli
from livekit.plugins import openai, silero
from settings import load_session

server = AgentServer(host='127.0.0.1', port=int(os.getenv('AGENT_HEALTH_PORT', '8096')),
                     num_idle_processes=0)


@server.rtc_session()
async def entrypoint(ctx: JobContext):
    await ctx.connect()
    settings = load_session(ctx.room.name)
    adapter = f"http://127.0.0.1:{os.getenv('ADAPTER_PORT', '8095')}/sessions/{ctx.room.name}/v1"
    vad = silero.VAD.load(activation_threshold=settings.vad_threshold,
                          min_silence_duration=settings.vad_silence)
    session = AgentSession(
        vad=vad,
        stt=openai.STT(base_url=adapter, api_key='local',
                       model=settings.stt_model,
                       language=settings.language),
        llm=openai.LLM(base_url=settings.llm_url,
                       api_key=os.getenv('LLM_API_KEY', 'local'),
                       model=settings.llm_model, temperature=settings.temperature,
                       max_completion_tokens=settings.max_tokens,
                       timeout=httpx.Timeout(settings.timeout)),
        # tts-1 selects the plugin's binary audio transport. The adapter replaces
        # this wire-protocol model name with the real audio.cpp model ID.
        tts=openai.TTS(base_url=adapter, api_key='local', model='tts-1',
                       voice=settings.voice, response_format='wav'),
        min_endpointing_delay=settings.endpoint_delay,
        max_endpointing_delay=settings.max_endpoint_delay,
        allow_interruptions=settings.interruptions,
        min_interruption_duration=settings.interruption_duration,
        preemptive_generation=settings.preemptive,
    )
    await session.start(room=ctx.room, agent=Agent(
        instructions=settings.prompt))
    greeting = settings.greeting.strip()
    if greeting:
        session.say(greeting, add_to_chat_ctx=False)


if __name__ == '__main__':
    cli.run_app(server)
