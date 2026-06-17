import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();

  // ─── Image generation pipeline (Nano Banana / gemini-2.5-flash-image) ───────
  if (body.type === 'image') {
    const googleApiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!googleApiKey) {
      console.error('GOOGLE_AI_API_KEY not set');
      return new Response(JSON.stringify({ url: null, error: 'Image generation not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { prompt, blueprintId, frameId } = body as {
      prompt: string;
      blueprintId: string;
      frameId: string;
    };

    // Call Nano Banana (gemini-2.5-flash-image) via generateContent
    // Docs: https://ai.google.dev/gemini-api/docs/image-generation
    const modelId = 'gemini-2.5-flash-image';
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${googleApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error('Nano Banana error:', geminiRes.status, err);
      return new Response(JSON.stringify({ url: null, error: 'Image generation failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiData = await geminiRes.json();

    // Extract base64 image from response parts
    const parts = geminiData?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(
      (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.mimeType?.startsWith('image/')
    );

    if (!imagePart?.inlineData?.data) {
      console.error('No image in Nano Banana response:', JSON.stringify(geminiData).slice(0, 500));
      return new Response(JSON.stringify({ url: null, error: 'No image returned' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const b64 = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType ?? 'image/png';
    const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';

    // Upload to Supabase Storage (service-role for bucket write)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const imageBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    // Include a timestamp in the path to bust CDN/browser cache on regeneration
    const ts = Date.now();
    const path = `${user.id}/${blueprintId}/${frameId}-${ts}.${ext}`;

    // Clean up previous versions of this frame's image (best-effort)
    try {
      const { data: existingFiles } = await adminClient.storage
        .from('storyboard-images')
        .list(`${user.id}/${blueprintId}`, { search: frameId });
      if (existingFiles?.length) {
        const toRemove = existingFiles
          .filter((f) => f.name.startsWith(frameId) && f.name !== `${frameId}-${ts}.${ext}`)
          .map((f) => `${user.id}/${blueprintId}/${f.name}`);
        if (toRemove.length) {
          await adminClient.storage.from('storyboard-images').remove(toRemove);
        }
      }
    } catch {
      // Non-critical — old files will just be orphaned
    }

    const { error: uploadError } = await adminClient.storage
      .from('storyboard-images')
      .upload(path, imageBytes, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error('Storage upload error:', uploadError.message);
      // Don't fall back to data URLs — they're too large and cause persistence issues.
      // Instead return an error so the client knows to retry.
      return new Response(JSON.stringify({ url: null, error: 'Storage upload failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { publicUrl } } = adminClient.storage
      .from('storyboard-images')
      .getPublicUrl(path);

    return new Response(JSON.stringify({ url: publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ─── Anthropic proxy (style guide + frame structure generation) ─────────────
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  const data = await anthropicRes.json();
  return new Response(JSON.stringify(data), {
    status: anthropicRes.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
