import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      user_id, user_email, screen_width, screen_height,
      language, referrer, page_url, user_agent, session_id, tenant_id,
    } = body;

    // Get real IP from headers
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Resolve geolocation via free ip-api.com
    let geo: any = {};
    try {
      const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,lat,lon,timezone,isp,org,as,mobile,proxy`, {
        signal: AbortSignal.timeout(5000),
      });
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData.status === "success") {
          geo = {
            country: geoData.country,
            country_code: geoData.countryCode,
            region: geoData.regionName,
            city: geoData.city,
            latitude: geoData.lat,
            longitude: geoData.lon,
            timezone: geoData.timezone,
            isp: geoData.isp,
            org: geoData.org,
            as_number: geoData.as,
            is_mobile: geoData.mobile || false,
            is_vpn: geoData.proxy || false,
          };
        }
      }
    } catch (e) {
      console.warn("Geo lookup failed:", e);
    }

    // Parse user agent for device/browser/OS
    const ua = user_agent || req.headers.get("user-agent") || "";
    const parsed = parseUserAgent(ua);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await sb.from("access_logs").insert({
      user_id: user_id || null,
      user_email: user_email || null,
      ip_address: ip,
      country: geo.country || null,
      country_code: geo.country_code || null,
      region: geo.region || null,
      city: geo.city || null,
      latitude: geo.latitude || null,
      longitude: geo.longitude || null,
      timezone: geo.timezone || null,
      isp: geo.isp || null,
      org: geo.org || null,
      as_number: geo.as_number || null,
      is_mobile: geo.is_mobile || parsed.is_mobile,
      is_vpn: geo.is_vpn || false,
      device_type: parsed.device_type,
      browser: parsed.browser,
      browser_version: parsed.browser_version,
      os: parsed.os,
      os_version: parsed.os_version,
      screen_width: screen_width || null,
      screen_height: screen_height || null,
      language: language || null,
      referrer: referrer || null,
      page_url: page_url || null,
      user_agent: ua.substring(0, 500),
      session_id: session_id || null,
      tenant_id: tenant_id || null,
    });

    if (error) console.error("Insert error:", error.message);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("track-access error:", e);
    return new Response(JSON.stringify({ ok: false }), {
      status: 200, // Don't break client
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function parseUserAgent(ua: string) {
  let browser = "Unknown", browser_version = "", os = "Unknown", os_version = "", device_type = "desktop", is_mobile = false;

  // OS detection
  if (/Windows NT (\d+\.\d+)/.test(ua)) { os = "Windows"; os_version = RegExp.$1; }
  else if (/Mac OS X (\d+[._]\d+[._]?\d*)/.test(ua)) { os = "macOS"; os_version = RegExp.$1.replace(/_/g, "."); }
  else if (/Android (\d+\.?\d*)/.test(ua)) { os = "Android"; os_version = RegExp.$1; is_mobile = true; }
  else if (/iPhone OS (\d+_\d+)/.test(ua)) { os = "iOS"; os_version = RegExp.$1.replace(/_/g, "."); is_mobile = true; }
  else if (/iPad/.test(ua)) { os = "iPadOS"; is_mobile = true; }
  else if (/Linux/.test(ua)) { os = "Linux"; }
  else if (/CrOS/.test(ua)) { os = "ChromeOS"; }

  // Browser detection
  if (/Edg\/(\d+\.?\d*)/.test(ua)) { browser = "Edge"; browser_version = RegExp.$1; }
  else if (/OPR\/(\d+\.?\d*)/.test(ua)) { browser = "Opera"; browser_version = RegExp.$1; }
  else if (/Chrome\/(\d+\.?\d*)/.test(ua)) { browser = "Chrome"; browser_version = RegExp.$1; }
  else if (/Safari\/(\d+\.?\d*)/.test(ua) && /Version\/(\d+\.?\d*)/.test(ua)) { browser = "Safari"; browser_version = RegExp.$1; }
  else if (/Firefox\/(\d+\.?\d*)/.test(ua)) { browser = "Firefox"; browser_version = RegExp.$1; }

  // Device type
  if (/Mobile|Android|iPhone/.test(ua)) device_type = "mobile";
  else if (/iPad|Tablet/.test(ua)) device_type = "tablet";

  return { browser, browser_version, os, os_version, device_type, is_mobile };
}
