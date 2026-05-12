import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { token } = await req.json();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing token' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Look up the share record
  const { data: share, error: shareError } = await supabase
    .from('blueprint_shares')
    .select('id, blueprint_id, can_comment, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (shareError || !share) {
    return new Response(JSON.stringify({ error: 'Invalid share token' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: 'Share link has expired' }), {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch the blueprint data
  const { data: bp, error: bpError } = await supabase
    .from('blueprints')
    .select('data')
    .eq('id', share.blueprint_id)
    .maybeSingle();

  if (bpError || !bp) {
    return new Response(JSON.stringify({ error: 'Blueprint not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      blueprint: bp.data,
      canComment: share.can_comment,
      shareId: share.id,
      blueprintRowId: share.blueprint_id,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
