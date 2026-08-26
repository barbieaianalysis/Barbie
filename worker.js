// ============================================================
// Barbie AI — Cloudflare Worker
//
// SETUP:
// 1. Go to https://workers.cloudflare.com and create a new Worker
// 2. Paste this entire file as the Worker code
// 3. Go to Worker → Settings → Variables and Secrets
// 4. Add secret:  GEMINI_API_KEY = AIza...your key
// 5. (Optional) Add secret: REMOVEBG_API_KEY = your remove.bg key
//    (background removal falls back gracefully if not set)
// 6. Save and Deploy
// 7. Copy the Worker URL (e.g. https://barbie-ai.yourname.workers.dev)
// 8. Paste that URL into dashboard.html where WORKER_URL is defined
// ============================================================

const GEMINI_MODEL = 'gemini-3.1-flash-image-preview';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // ── Background removal route ──────────────────────────────
    if (url.pathname.endsWith('/removebg')) {
      return handleRemoveBg(request, env);
    }

    // ── Default route: Gemini generateContent proxy ───────────
    const GEMINI_API_KEY = env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return json({
        error: 'GEMINI_API_KEY not set. Go to Worker → Settings → Variables and Secrets and add it.'
      }, 500);
    }

    try {
      const body = await request.json();
      const { payload } = body;

      const geminiUrl =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

      const enhancedPayload = {
        ...payload,
        generationConfig: {
          ...(payload.generationConfig || {}),
          temperature: 0.4,
          topP: 0.9,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      };

      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enhancedPayload)
      });

      const data = await geminiRes.json();

      return json(data, geminiRes.status);

    } catch (err) {
      return json({ error: err.message }, 500);
    }
  }
};

// ── Background removal (remove.bg with graceful fallback) ─────
async function handleRemoveBg(request, env) {
  const REMOVEBG_API_KEY = env.REMOVEBG_API_KEY;

  if (!REMOVEBG_API_KEY) {
    return json({ fallback: true, reason: 'REMOVEBG_API_KEY not set' }, 200);
  }

  try {
    const { base64, mime } = await request.json();

    const form = new FormData();
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    form.append('image_file', new Blob([bytes], { type: mime }), 'image');
    form.append('size', 'auto');

    const rbRes = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': REMOVEBG_API_KEY },
      body: form
    });

    if (!rbRes.ok) {
      return json({ fallback: true, reason: 'remove.bg error ' + rbRes.status }, 200);
    }

    const outBuf = await rbRes.arrayBuffer();
    const outB64 = btoa(String.fromCharCode(...new Uint8Array(outBuf)));

    return json({ base64: outB64, mime: 'image/png', fallback: false }, 200);

  } catch (err) {
    return json({ fallback: true, reason: err.message }, 200);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
