import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate user via JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const url = new URL(req.url);

    // ── GET /notes-sync?uid=X → list all notes for user ──
    if (req.method === "GET") {
      const uid = url.searchParams.get("uid");
      if (uid && uid !== userId) {
        return new Response(JSON.stringify({ error: "Acesso negado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", userId)
        .order("updated", { ascending: false });

      if (error) {
        console.error("Notes fetch error:", error.message);
        return new Response(JSON.stringify({ error: "Erro ao buscar notas" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ notes: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE /notes-sync?uid=X&id=Y → delete specific note ──
    if (req.method === "DELETE") {
      const noteId = url.searchParams.get("id");
      if (!noteId) {
        return new Response(JSON.stringify({ error: "ID da nota obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("notes")
        .delete()
        .eq("id", noteId)
        .eq("user_id", userId);

      if (error) {
        console.error("Notes delete error:", error.message);
        return new Response(JSON.stringify({ error: "Erro ao deletar nota" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── POST /notes-sync → sync notes (last-write-wins merge) ──
    if (req.method === "POST") {
      const body = await req.json();
      const { notes = [], folders = [] } = body;

      // Validate arrays
      if (!Array.isArray(notes) || !Array.isArray(folders)) {
        return new Response(JSON.stringify({ error: "Payload inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upsert folders
      for (const folder of folders) {
        if (!folder.name || typeof folder.name !== "string") continue;
        await supabase.from("note_folders").upsert(
          {
            id: folder.id || undefined,
            user_id: userId,
            name: folder.name.substring(0, 100),
          },
          { onConflict: "user_id,name", ignoreDuplicates: true }
        );
      }

      // Upsert notes with last-write-wins
      const results = [];
      for (const note of notes) {
        if (!note.id || typeof note.id !== "string") continue;

        // Check if server version is newer
        const { data: existing } = await supabase
          .from("notes")
          .select("updated")
          .eq("id", note.id)
          .eq("user_id", userId)
          .maybeSingle();

        // Only update if client version is newer or note doesn't exist
        if (existing && Number(existing.updated) > Number(note.updated || 0)) {
          results.push({ id: note.id, action: "skipped", reason: "server_newer" });
          continue;
        }

        const { error } = await supabase.from("notes").upsert(
          {
            id: note.id,
            user_id: userId,
            title: (note.title || "").substring(0, 500),
            text: (note.text || "").substring(0, 50000),
            folder: (note.folder || "Geral").substring(0, 100),
            color: (note.color || "#ffffff").substring(0, 20),
            pinned: !!note.pinned,
            ts: Number(note.ts) || Date.now(),
            updated: Number(note.updated) || Date.now(),
          },
          { onConflict: "id" }
        );

        results.push({
          id: note.id,
          action: error ? "error" : "synced",
          error: error?.message,
        });
      }

      // Return full merged state
      const { data: merged } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", userId)
        .order("updated", { ascending: false });

      const { data: mergedFolders } = await supabase
        .from("note_folders")
        .select("*")
        .eq("user_id", userId)
        .order("name");

      return new Response(
        JSON.stringify({
          ok: true,
          results,
          notes: merged || [],
          folders: mergedFolders || [],
          ts: Date.now(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Método não suportado" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Notes sync error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
