import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_FIELDS = [
  'requester_name', 'requester_email', 'requester_phone', 'requester_type',
  'requester_department', 'title', 'description', 'category', 'priority',
  'tags', 'sentiment', 'summary', 'assigned_to', 'ai_triaged',
]

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()

    if (!body.requester_name || !body.title) {
      return json({ error: 'requester_name and title are required.' }, 400)
    }
    if (!body.requester_email) {
      return json({ error: 'requester_email is required.' }, 400)
    }

    const payload = {}
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) payload[key] = body[key]
    }
    payload.status = 'Open'

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data, error } = await admin.from('tickets').insert(payload).select().single()

    if (error) return json({ error: error.message }, 400)
    return json(data)
  } catch (e) {
    return json({ error: e.message || String(e) }, 500)
  }
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}