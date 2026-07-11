import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TOKEN_REFRESH_BUFFER_MS = 60_000;

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
};

function googleEnv() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI!,
  };
}

export function getGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = googleEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<Required<GoogleTokenResponse>> {
  const { clientId, clientSecret, redirectUri } = googleEnv();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    throw new Error("Výmena Google autorizačného kódu zlyhala.");
  }
  return response.json();
}

async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = googleEnv();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    throw new Error("Obnovenie Google tokenu zlyhalo.");
  }
  return response.json();
}

type ActiveConnection = { accessToken: string; calendarId: string };

async function getValidConnection(
  supabase: SupabaseServerClient,
  coachId: string,
): Promise<ActiveConnection | null> {
  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("access_token, refresh_token, token_expires_at, calendar_id")
    .eq("coach_id", coachId)
    .maybeSingle();

  if (!connection) return null;

  const expiresAt = new Date(connection.token_expires_at).getTime();
  if (expiresAt - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return { accessToken: connection.access_token, calendarId: connection.calendar_id };
  }

  const refreshed = await refreshAccessToken(connection.refresh_token);
  const tokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await supabase
    .from("google_calendar_connections")
    .update({ access_token: refreshed.access_token, token_expires_at: tokenExpiresAt })
    .eq("coach_id", coachId);

  return { accessToken: refreshed.access_token, calendarId: connection.calendar_id };
}

// Používa events.list namiesto freeBusy.query — freeBusy vyžaduje vlastný
// scope (calendar.freebusy), ktorý appka nemá nastavený a nezhoduje sa s
// tým, čo dovoľuje OAuth consent screen. events.list funguje pod tým istým
// scope (calendar.events), čo už appka na vytváranie udalostí používa.
async function hasCollision(
  accessToken: string,
  calendarId: string,
  startISO: string,
  endISO: string,
): Promise<boolean> {
  const params = new URLSearchParams({
    timeMin: startISO,
    timeMax: endISO,
    singleEvents: "true",
    maxResults: "1",
  });
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new Error("Kontrola kolízií v Google Kalendári zlyhala.");
  }
  const data = await response.json();
  return (data.items?.length ?? 0) > 0;
}

async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  summary: string,
  startISO: string,
  endISO: string,
): Promise<string> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary,
        start: { dateTime: startISO, timeZone: "Europe/Bratislava" },
        end: { dateTime: endISO, timeZone: "Europe/Bratislava" },
      }),
    },
  );
  if (!response.ok) {
    throw new Error("Vytvorenie udalosti v Google Kalendári zlyhalo.");
  }
  const event = await response.json();
  return event.id as string;
}

export type SessionCalendarSyncResult = {
  googleEventId: string | null;
  collision: boolean;
};

// Vytvorí udalosť v Google Kalendári trénera pre naplánovaný tréning a
// skontroluje kolíziu s existujúcimi udalosťami. Ak tréner nemá pripojený
// kalendár alebo Google API zlyhá, tréning sa aj tak vytvorí bez neho —
// kalendárová synchronizácia je len doplnková vrstva, nesmie zablokovať
// základnú funkcionalitu plánovania.
export async function syncSessionToGoogleCalendar(
  supabase: SupabaseServerClient,
  coachId: string,
  summary: string,
  startISO: string,
  endISO: string,
): Promise<SessionCalendarSyncResult> {
  try {
    const connection = await getValidConnection(supabase, coachId);
    if (!connection) {
      return { googleEventId: null, collision: false };
    }

    const collision = await hasCollision(
      connection.accessToken,
      connection.calendarId,
      startISO,
      endISO,
    );
    const googleEventId = await createCalendarEvent(
      connection.accessToken,
      connection.calendarId,
      summary,
      startISO,
      endISO,
    );

    return { googleEventId, collision };
  } catch (error) {
    console.error("Synchronizácia s Google Kalendárom zlyhala:", error);
    return { googleEventId: null, collision: false };
  }
}
