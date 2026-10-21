"""CPU orchestration only: reuse the existing audio.cpp and llama.cpp APIs."""
import os
import asyncio
import logging
import json

import httpx
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, cli
from livekit.plugins import openai, silero
from settings import load_session
from memory import Store, load_identity
from personal_memory_agent import PersonalMemoryAgent

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
                       parallel_tool_calls=False,
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
        # Database writes must run only for finalized turns, never speculative replies.
        preemptive_generation=settings.preemptive and not settings.memory_enabled,
    )
    async def notify_persistence(payload):
        logging.info('memory-v3 room=%s state=%s detail=%s',
                     ctx.room.name, payload.get('state'), payload.get('detail'))
        encoded = json.dumps(payload)
        # Attributes retain the latest status for late-joining/reconnecting clients.
        # A transient data-message delivery failure must not undo a committed write.
        results = await asyncio.gather(
            ctx.room.local_participant.set_attributes({'audiocpp.persistence': encoded}),
            ctx.room.local_participant.publish_data(
                encoded.encode(), reliable=True, topic='audiocpp.persistence'),
            return_exceptions=True)
        for result in results:
            if isinstance(result, Exception):
                logging.warning('Memory status delivery failed: %s', result)

    assistant = Agent(instructions=settings.prompt)
    if settings.memory_enabled:
        store = Store(load_identity(ctx.room.name))
        # Fail visibly before enabling persistence if the schema/database is unavailable.
        await store.start_session(ctx.room.name)
        assistant = PersonalMemoryAgent(settings.prompt, store, settings.memory_top_k,
                                        notify_persistence, settings=settings)
        notification_tasks = set()

        def tool_finished(event):
            for call, output in zip(event.function_calls, event.function_call_outputs):
                if call.name == 'remember_detail' and (output is None or output.is_error):
                    task = asyncio.create_task(notify_persistence({
                        'state': 'error', 'table': 'memories',
                        'detail': 'Memory tool failed; no save was confirmed. Check agent logs.'}))
                    notification_tasks.add(task)
                    task.add_done_callback(notification_tasks.discard)

        session.on('function_tools_executed', tool_finished)
        queue = asyncio.Queue()
        report = []
        failures = []

        async def persist_turns():
            while True:
                event = await queue.get()
                try:
                    if event is None:
                        return
                    item = event.item
                    if item.role in ('user', 'assistant') and item.text_content:
                        await store.add_turn(ctx.room.name, item.id, item.role, item.text_content)
                        report.append({'role': item.role, 'content': item.text_content})
                except Exception:
                    failures.append('turn_write_failed')
                    logging.exception('Could not persist conversation turn')
                finally:
                    queue.task_done()

        writer = asyncio.create_task(persist_turns())
        session.on('conversation_item_added', lambda event: queue.put_nowait(event))

        async def finish_memory():
            queue.put_nowait(None)
            await writer
            if notification_tasks:
                await asyncio.gather(*notification_tasks, return_exceptions=True)
            await store.finish_session(ctx.room.name, {'turn_count': len(report),
                'transcript': report, 'persistence_errors': failures})

        ctx.add_shutdown_callback(finish_memory)
    await session.start(room=ctx.room, agent=assistant)
    logging.info('memory-v3 session started room=%s memory_enabled=%s agent=%s',
                 ctx.room.name, settings.memory_enabled, type(assistant).__name__)
    if settings.memory_enabled:
        await notify_persistence({'state': 'ready', 'table': 'memories',
                                  'detail': 'memory-v3 handler connected; automatic memory updates enabled'})
    greeting = settings.greeting.strip()
    if greeting:
        session.say(greeting, add_to_chat_ctx=False)


if __name__ == '__main__':
    cli.run_app(server)
