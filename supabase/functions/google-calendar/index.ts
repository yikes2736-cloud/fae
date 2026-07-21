// supabase/functions/google-calendar/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    // verify the caller via their own Fae session
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) throw new Error("Invalid session");
    const uid = userData.user.id;

    // admin client — bypasses RLS, only used server-side, never exposed to the browser
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();
    const { action } = body;

    // ---- is this user connected? ----
    if (action === "status") {
      const { data } = await admin
        .from("google_calendar_tokens")
        .select("user_id")
        .eq("user_id", uid)
        .maybeSingle();
      return json({ connected: !!data });
    }

    // ---- first-time connect: trade the auth code for tokens ----
    if (action === "connect") {
      const { code, redirectUri } = body;
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error_description || "Token exchange failed");
      if (!tokenData.refresh_token) {
        throw new Error(
          "Google didn't return a refresh token. In your Google Account settings, remove Fae's access under " +
          "'Third-party apps', then try connecting again."
        );
      }
      const { error: upsertErr } = await admin
        .from("google_calendar_tokens")
        .upsert({ user_id: uid, refresh_token: tokenData.refresh_token });
      if (upsertErr) throw new Error(upsertErr.message);
      return json({ ok: true });
    }

    // ---- disconnect: forget the stored token ----
    if (action === "disconnect") {
      await admin.from("google_calendar_tokens").delete().eq("user_id", uid);
      return json({ ok: true });
    }

    // ---- sync (create/update) or delete a calendar event ----
    if (action === "sync" || action === "delete") {
      const { data: tok } = await admin
        .from("google_calendar_tokens")
        .select("refresh_token")
        .eq("user_id", uid)
        .maybeSingle();
      if (!tok) throw new Error("Google Calendar isn't connected");

      // refresh tokens are long-lived; access tokens expire hourly and must be refreshed each call
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: tok.refresh_token,
          grant_type: "refresh_token",
        }),
      });
      const refreshData = await refreshRes.json();
      if (!refreshRes.ok) throw new Error(refreshData.error_description || "Couldn't refresh Google access");
      const accessToken = refreshData.access_token;

      if (action === "delete") {
        const { eventId } = body;
        if (eventId) {
          await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        }
        return json({ ok: true });
      }

      // action === "sync"
      const { name, dueAt, eventId, leadMinutes } = body;
      const start = new Date(dueAt);
      const end = new Date(start.getTime() + 30 * 60000); // 30-minute block on the calendar

      const eventBody = {
        summary: `Fae: ${name}`,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: leadMinutes ?? 30 }],
        },
      };

      const url = eventId
        ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`
        : `https://www.googleapis.com/calendar/v3/calendars/primary/events`;

      const evRes = await fetch(url, {
        method: eventId ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventBody),
      });
      const evData = await evRes.json();
      if (!evRes.ok) throw new Error(evData.error?.message || "Calendar event failed");

      return json({ ok: true, eventId: evData.id });
    }

    throw new Error("Unknown action: " + action);
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
});
