import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, raw_text, column_mapping, rows, tenant_id, user_id, file_name } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // ═══ Step 1: Analyze columns ═══
    if (action === "analyze") {
      // Send first 10 rows to AI to identify columns
      const lines = raw_text.split(/\r?\n/).filter((l: string) => l.trim()).slice(0, 15);
      const sampleText = lines.join("\n");

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a data analyst that identifies columns in CSV/spreadsheet data for a CRM contact import.
Analyze the provided rows and identify what each column contains.

Available CRM fields to map to:
- name (person's full name)
- email (email address)
- phone (phone number)
- company (company/organization name)
- city (city/location)
- tags (category/label/group)
- notes (any additional info)
- skip (column should be ignored)

Return your analysis using the suggest_mapping tool.`
            },
            {
              role: "user",
              content: `Analyze these rows from a contact file and identify each column:\n\n${sampleText}`
            }
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "suggest_mapping",
                description: "Suggest column mappings for the imported data",
                parameters: {
                  type: "object",
                  properties: {
                    delimiter: {
                      type: "string",
                      description: "The detected delimiter (comma, semicolon, tab, pipe)"
                    },
                    has_header: {
                      type: "boolean",
                      description: "Whether the first row is a header"
                    },
                    columns: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          index: { type: "number", description: "0-based column index" },
                          detected_header: { type: "string", description: "The header name if present, or a description" },
                          suggested_field: {
                            type: "string",
                            enum: ["name", "email", "phone", "company", "city", "tags", "notes", "skip"]
                          },
                          confidence: { type: "number", description: "0-1 confidence score" },
                          sample_values: {
                            type: "array",
                            items: { type: "string" },
                            description: "2-3 sample values from this column"
                          }
                        },
                        required: ["index", "detected_header", "suggested_field", "confidence", "sample_values"],
                        additionalProperties: false
                      }
                    },
                    total_data_rows: {
                      type: "number",
                      description: "Estimated number of data rows (excluding header)"
                    }
                  },
                  required: ["delimiter", "has_header", "columns", "total_data_rows"],
                  additionalProperties: false
                }
              }
            }
          ],
          tool_choice: { type: "function", function: { name: "suggest_mapping" } },
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await aiResponse.text();
        console.error("AI error:", aiResponse.status, t);
        throw new Error("AI analysis failed");
      }

      const result = await aiResponse.json();
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("AI did not return mapping");

      const mapping = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ mapping }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ Step 2: Import with confirmed mapping ═══
    if (action === "import") {
      if (!column_mapping || !rows || !tenant_id || !user_id) {
        throw new Error("Missing required fields for import");
      }

      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseKey);

      // Create list entry
      const { data: list, error: listErr } = await sb.from("crm_contact_lists").insert({
        tenant_id, user_id, name: file_name || "Smart Import",
        file_name: file_name || "import.csv", total_rows: rows.length, status: "processing",
      }).select("id").single();
      if (listErr) throw listErr;

      // Parse rows using the confirmed mapping
      const delimiter_map: Record<string, string> = {
        comma: ",", semicolon: ";", tab: "\t", pipe: "|"
      };
      const delim = delimiter_map[column_mapping.delimiter] || ",";
      const startIdx = column_mapping.has_header ? 1 : 0;

      const contacts: any[] = [];
      const seen = new Set<string>();

      for (let i = startIdx; i < rows.length; i++) {
        const row = rows[i];
        if (!row?.trim()) continue;

        // Smart split handling quoted fields
        const cols = splitCSVRow(row, delim);

        const contact: any = {
          tenant_id, user_id, source: "smart_import",
          pipeline_stage: "lead", is_active: true,
          tags: [file_name?.replace(/\.\w+$/, "") || "import"],
        };

        for (const col of column_mapping.columns) {
          const val = (cols[col.index] || "").trim();
          if (!val || col.confirmed_field === "skip") continue;

          switch (col.confirmed_field) {
            case "name": contact.name = val.substring(0, 200); break;
            case "email": contact.email = val.toLowerCase().substring(0, 255); break;
            case "phone": {
              contact.phone = val;
              const digits = val.replace(/\D/g, "");
              if (digits.length >= 10) {
                contact.phone_normalized = digits.length >= 12 ? `+${digits}` : `+55${digits}`;
                contact.is_international = !contact.phone_normalized.startsWith("+55");
              }
              break;
            }
            case "company": contact.company = val.substring(0, 200); break;
            case "city": contact.city = val.substring(0, 100); break;
            case "tags": contact.tags = [...(contact.tags || []), ...val.split(/[,;]/).map((t: string) => t.trim()).filter(Boolean)]; break;
            case "notes": contact.notes = val.substring(0, 1000); break;
          }
        }

        // Need at least a phone, email, or name
        if (!contact.phone_normalized && !contact.email && !contact.name) continue;

        // Dedup key
        const key = contact.phone_normalized || contact.email || contact.name;
        if (seen.has(key)) continue;
        seen.add(key);

        if (!contact.name) contact.name = contact.email?.split("@")[0] || contact.phone || "Sem nome";
        if (!contact.phone) contact.phone = "";
        if (!contact.phone_normalized) contact.phone_normalized = "";

        contacts.push(contact);
      }

      let imported = 0, duplicates = 0;
      const BATCH = 100;
      for (let i = 0; i < contacts.length; i += BATCH) {
        const batch = contacts.slice(i, i + BATCH);
        // Use phone_normalized for dedup if available, otherwise email
        const { data: result, error } = await sb.from("crm_contacts")
          .upsert(batch, { onConflict: "tenant_id,phone_normalized", ignoreDuplicates: true })
          .select("id");
        if (!error) imported += result?.length || 0;
        duplicates += batch.length - (result?.length || 0);
      }

      await sb.from("crm_contact_lists").update({
        status: "completed", imported_count: imported, duplicates_found: duplicates, total_rows: contacts.length,
      }).eq("id", list.id);

      return new Response(JSON.stringify({ imported, duplicates, total: contacts.length, list_id: list.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (e) {
    console.error("crm-smart-import error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function splitCSVRow(row: string, delim: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delim && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map(v => v.replace(/^"|"$/g, "").trim());
}
