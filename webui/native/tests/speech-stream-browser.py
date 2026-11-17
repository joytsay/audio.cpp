"""Compare real Web Audio rendering of streamed and continuous VoxCPM PCM.
Pass an ES-module browser bundle of src/lib/speech-stream.ts as the argument.
Requires Python Playwright and Chromium; performs no live inference or deployment.
"""
import functools
import http.server
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import threading
from playwright.sync_api import sync_playwright

with tempfile.TemporaryDirectory(prefix='speech-boundaries-') as directory:
    root = Path(directory)
    shutil.copyfile(sys.argv[1], root / 'speech.mjs')
    (root / 'index.html').write_text('<!doctype html><title>Streaming PCM regression</title>')
    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *_):
            pass
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=directory))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.environ.get('UI_BROWSER_EXECUTABLE', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
            page = browser.new_page()
            page.goto(f'http://127.0.0.1:{server.server_port}/')
            results = page.evaluate('''async () => {
              const {playSpeechStream,speechContextOptions}=await import('/speech.mjs');
              const frames=1280*12,samples=new Float32Array(frames),bytes=new Uint8Array(frames*2),view=new DataView(bytes.buffer);
              for(let i=0;i<frames;i++){const value=Math.round(14000*Math.sin(2*Math.PI*1234*i/16000));view.setInt16(2*i,value,true);samples[i]=value/32768;}
              const events=[];
              for(let offset=0;offset<bytes.length;offset+=2560)
                events.push({type:'speech.audio.delta',audio:btoa(String.fromCharCode(...bytes.subarray(offset,offset+2560))),sample_rate:16000,channels:1,format:'pcm_s16le'});
              events.push({type:'speech.audio.done'});
              const originalFetch=window.fetch;
              const NativeWorklet=window.AudioWorkletNode;let queueNodes=0;
              window.AudioWorkletNode=new Proxy(NativeWorklet,{construct(target,args){queueNodes++;return Reflect.construct(target,args);}});
              const results=[];
              try {
                for(const speed of [0.7,0.9,1,1.25]){
                  const options=speechContextOptions('voxcpm1',speed),rate=options.sampleRate;
                  const length=frames+Math.ceil(rate*0.2);
                  const offline=new OfflineAudioContext(1,length,rate);
                  let rendering;
                  const context=offline;context.resume=async()=>{};
                  window.fetch=async()=>new Response(events.map(event=>'data: '+JSON.stringify(event)+'\\n\\n').join(''),{headers:{'Content-Type':'text/event-stream'}});
                  const summary=await playSpeechStream(context,{input:'A continuous test sentence.'},new AbortController().signal,{
                    playbackRate:speed,bufferSeconds:0.32,collectAudio:true,continuousPcm:true,onSynthesized(){rendering=offline.startRendering();}
                  });
                  const actual=(await rendering).getChannelData(0);
                  const reference=new OfflineAudioContext(1,length,rate);
                  const buffer=reference.createBuffer(1,frames,rate);buffer.copyToChannel(samples,0);
                  const source=reference.createBufferSource();source.buffer=buffer;source.connect(reference.destination);source.start(.06);
                  const expected=(await reference.startRendering()).getChannelData(0);
                  let error=0;
                  for(let i=0;i<length;i++)error=Math.max(error,Math.abs(actual[i]-expected[i]));
                  const replay=new DataView(await summary.audio.arrayBuffer());
                  results.push({speed,contextRate:rate,chunks:summary.chunks,maxError:error,replayRate:replay.getUint32(24,true),replayBytes:summary.audio.size});
                }
              } finally {window.fetch=originalFetch;window.AudioWorkletNode=NativeWorklet;}
              if(queueNodes!==4)throw new Error("Continuous PCM renderer was not used for all playback speeds");
              return results;
            }''')
            for result in results:
                assert result['maxError'] < 1e-6, result
                assert result['chunks'] == 12 and result['replayRate'] == 16000, result
                assert result['replayBytes'] == 44 + 1280 * 12 * 2, result
            print(json.dumps(results))
            print('PASS real streamed playback matches continuous PCM at 0.7x/0.9x/1x/1.25x; replay keeps all native 16 kHz samples')
            browser.close()
    finally:
        server.shutdown()
