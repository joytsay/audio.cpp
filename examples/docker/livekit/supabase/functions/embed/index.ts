// Supabase Edge Runtime supplies Supabase.ai. No Jetson embedding service.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const model = new Supabase.ai.Session('gte-small');

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('POST required', {status: 405});
  // verify_jwt=false permits modern Supabase keys; authenticate explicitly here.
  const expected = Deno.env.get('VOICE_EMBED_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!expected) return new Response('Function secret not configured', {status: 503});
  if (request.headers.get('x-voice-embed-secret') !== expected) {
    return new Response('Unauthorized', {status: 401});
  }
  try {
    const {input} = await request.json();
    if (typeof input !== 'string' || !input.trim() || input.length > 12500) {
      return Response.json({error: 'input must contain 1–12500 characters'}, {status: 400});
    }
    const embedding = await model.run(input, {mean_pool: true, normalize: true});
    return Response.json({embedding});
  } catch {
    return Response.json({error: 'Embedding generation failed'}, {status: 500});
  }
});
