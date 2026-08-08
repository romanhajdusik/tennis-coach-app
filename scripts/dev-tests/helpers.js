// Spoločné pomôcky pre lokálne overovacie skripty (viď README.md v tomto
// priečinku). Nie sú súčasťou buildu appky — spúšťajú sa ručne cez `node`.
const http = require("node:http");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

// Kľúče lokálnej Supabase inštancie. NIE SÚ TAJNÉ: `supabase start` ich
// generuje rovnaké pre každého, sú súčasťou dokumentácie Supabase a platia
// výhradne pre inštanciu na 127.0.0.1. Produkčné kľúče sem nikdy nedávaj.
const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const DEV_PORT = Number(process.env.DEV_PORT ?? 3000);
/** Subdoména testovacej organizácie — org kontext ide výhradne z hostname. */
const ORG_HOST = process.env.ORG_HOST ?? "todaytest.plaw.win";
const ORG_SLUG = ORG_HOST.split(".")[0];
const APP_HOST = process.env.APP_HOST ?? "plaw.win";

const PASSWORD = "TestPlaw2026!";
// Demo účet samostatného trénera pochádza zo seedu na fotenie landingu a má
// vlastné heslo.
const PASSWORDS = { "demo@plaw.win": "DemoPlaw2026!" };

const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

/** Klient so `service_role` — obchádza RLS, používaj len na seed a kontrolu. */
function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

/** Prihlásený klient konkrétneho účtu (podlieha RLS ako v appke). */
async function signIn(email) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORDS[email] ?? PASSWORD,
  });
  if (error) throw new Error(`${email}: ${error.message}`);
  return client;
}

/**
 * Cookies prihláseného účtu pre HTTP volania na dev server.
 *
 * `NEXT_TIMEZONE` je tu zámerne: appka renderuje časy v pásme diváka a bez
 * cookie by použila `Europe/Bratislava`, kým seed píše časy v pásme stroja —
 * testy by sa potom rozišli o offset pásma.
 */
async function authCookies(email) {
  const { createServerClient } = require("@supabase/ssr");
  const jar = [];
  const client = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: { getAll: () => jar, setAll: (list) => jar.push(...list) },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORDS[email] ?? PASSWORD,
  });
  if (error) throw new Error(`${email}: ${error.message}`);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return [
    ...jar.map((cookie) => `${cookie.name}=${cookie.value}`),
    `NEXT_TIMEZONE=${timeZone}`,
  ].join("; ");
}

/**
 * GET na dev server s podvrhnutou hlavičkou `Host` (tak sa testuje org
 * subdoména). Node `fetch` hlavičku `Host` zahadzuje — preto `node:http`.
 */
function request(pathname, { host = ORG_HOST, cookies = "" } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: DEV_PORT,
        path: pathname,
        headers: { Host: host, ...(cookies ? { Cookie: cookies } : {}) },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/** HTML bez `<script>` blokov — next-intl do nich posiela všetky preklady. */
function rendered(html) {
  return html.replace(/<script[\s\S]*?<\/script>/g, "");
}

/** Vykreslený text stránky (bez prekladov zo `<script>`, s normalizovanými medzerami). */
function textOf(html) {
  return rendered(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** To isté pre Playwright: klonuje `body` a zahodí `script`/`style`. */
function browserText(page) {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll("script, style").forEach((node) => node.remove());
    return clone.textContent.replace(/\s+/g, " ");
  });
}

/**
 * Argumenty pre chromium, aby ostré hostname ukazovali na dev server.
 *
 * **Mapuj SEM každý host, na ktorý test chodí.** Nenamapovaný host sa v
 * prehliadači vyrieši cez DNS — teda na PRODUKCIU, kde by sa scenár prihlásil
 * a zapisoval naostro.
 */
function chromiumArgs() {
  const rules = [ORG_HOST, APP_HOST]
    .map((host) => `MAP ${host} 127.0.0.1:${DEV_PORT}`)
    .join(",");
  return [`--host-resolver-rules=${rules}`];
}

/**
 * Prihlásenie v prehliadači. Zámerne NEČAKÁ na konkrétnu cieľovú cestu:
 * reťaz redirectov (`/` → `/director`) robí `waitForURL` vratkým — na cieľ
 * choď radšej priamo cez `goto()`, presmerovanie overuj HTTP sadou.
 */
async function browserLogin(page, email, baseUrl) {
  await page.goto(`${baseUrl}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORDS[email] ?? PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), {
    timeout: 40000,
  });
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** Jednoduchý zberač výsledkov — každý skript končí `report()`. */
function createChecks() {
  let passed = 0;
  let failed = 0;

  return {
    check(name, condition, detail = "") {
      if (condition) {
        passed++;
        console.log("  OK   " + name);
      } else {
        failed++;
        console.log("  FAIL " + name + (detail ? " — " + detail : ""));
      }
    },
    section(title) {
      console.log("\n" + title);
    },
    report() {
      console.log(`\nVýsledok: ${passed} OK, ${failed} FAIL`);
      process.exit(failed ? 1 : 0);
    },
  };
}

module.exports = {
  SUPABASE_URL,
  ANON_KEY,
  SERVICE_KEY,
  DEV_PORT,
  ORG_HOST,
  ORG_SLUG,
  APP_HOST,
  PASSWORD,
  PASSWORDS,
  SCREENSHOT_DIR,
  serviceClient,
  signIn,
  authCookies,
  request,
  rendered,
  textOf,
  browserText,
  chromiumArgs,
  browserLogin,
  createChecks,
};
