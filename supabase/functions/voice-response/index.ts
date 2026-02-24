import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * voice-response — ElevenLabs TTS
 *
 * Converts text to speech via ElevenLabs and returns a signed URL
 * pointing to the audio stored in Supabase Storage.
 *
 * POST { text: string, voice_id?: string, project_id?: string }
 * → { url: string, duration_estimate: number }
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ELEVENLABS_API = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE  = "21m00Tcm4TlvDq8ikWAM"; // Rachel — clear, neutral

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sc = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  try {
    const { text, voice_id, project_id } = await req.json() as {
      text: string;
      voice_id?: string;
      project_id?: string;
    };

    if (!text?.trim()) return json({ error: "text required" }, 400);

    // Sanitize text
    const cleanText = text.replace(/<[^>]+>/g, "").slice(0, 5000);

    // Get ElevenLabs key
    const keyResp = await sc.functions.invoke("api-key-router", {
      body: { action: "get", provider: "elevenlabs" },
    });

    const apiKey: string = keyResp.data?.key || Deno.env.get("ELEVENLABS_API_KEY") || "";
    const voiceFromConfig: string = keyResp.data?.extra_config?.voice_id || DEFAULT_VOICE;
    const finalVoice = voice_id || voiceFromConfig;
    const keyId: string = keyResp.data?.id;

    if (!apiKey) {
      return json({ error: "Nenhuma chave ElevenLabs disponível. Configure em Admin > Integrações." }, 503);
    }

    // Call ElevenLabs TTS
    const ttsResp = await fetch(`${ELEVENLABS_API}/text-to-speech/${finalVoice}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!ttsResp.ok) {
      const errText = await ttsResp.text();
      throw new Error(`ElevenLabs ${ttsResp.status}: ${errText.slice(0, 200)}`);
    }

    // Store audio in Supabase Storage
    const audioBuffer = await ttsResp.arrayBuffer();
    const filename = `voice/${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;

    const { error: uploadErr } = await sc.storage
      .from("public-assets")
      .upload(filename, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadErr) throw uploadErr;

    const { data: urlData } = sc.storage.from("public-assets").getPublicUrl(filename);

    // Update key usage (estimate chars as tokens proxy)
    if (keyId) {
      await sc.functions.invoke("api-key-router", {
        body: { action: "update_usage", id: keyId, tokens_used: cleanText.length },
      });
    }

    // Log to orchestrator if project_id given
    if (project_id) {
      await sc.from("orchestrator_logs").insert({
        project_id,
        level:   "info",
        message: `[Voz] Áudio gerado: ${cleanText.slice(0, 60)}...`,
        metadata: { audio_url: urlData.publicUrl, chars: cleanText.length },
      });
    }

    return json({
      url:               urlData.publicUrl,
      duration_estimate: Math.ceil(cleanText.length / 15), // ~15 chars/sec estimate
      voice_id:          finalVoice,
    });

  } catch (e) {
    console.error("[voice-response]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
