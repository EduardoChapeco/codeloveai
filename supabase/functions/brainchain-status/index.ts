import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-clf-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const { queue_id } = await req.json().catch(() => ({}));
  if (!queue_id) {
    return new Response(JSON.stringify({ error: 'queue_id obrigatório' }), { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data } = await supabase.from('brainchain_queue')
    .select('status, response, error_msg, created_at, completed_at')
    .eq('id', queue_id).single();

  if (!data) {
    return new Response(JSON.stringify({ error: 'queue_id não encontrado' }), { status: 404, headers: corsHeaders });
  }

  return new Response(JSON.stringify({
    status: data.status,
    response: data.response,
    error: data.error_msg,
    retry_after: data.status === 'pending' || data.status === 'processing' ? 5 : null,
  }), { headers: corsHeaders });
});
