// Obnova zabudnutého hesla — celý reťazec od stránky po platnú session.
//
// Server actions (žiadosť o mail, uloženie nového hesla) sa cez holé HTTP
// zavolať nedajú, takže sa tu overuje to, čo sa overiť DÁ: že stránky existujú
// a púšťajú správnych ľudí, že `/auth/confirm` vymení token za session a že
// neplatný alebo už použitý odkaz nikoho dnu nepustí. Odoslanie mailu sa
// kontroluje proti lokálnemu mailboxu (`local_smtp` v supabase/config.toml).
const {
  serviceClient,
  request,
  textOf,
  SUPABASE_URL,
  ANON_KEY,
  APP_HOST,
  ORG_HOST,
  createChecks,
} = require("./helpers");

const { check, section, report } = createChecks();
const db = serviceClient();

const COACH = "demo@plaw.win";
const MAILBOX_URL = process.env.MAILBOX_URL ?? "http://127.0.0.1:54324";
const CONFIRM = "/auth/confirm";

/** Cookies zo `Set-Cookie` odpovede v tvare, aký berie `request()`. */
function cookiesFrom(response) {
  const raw = response.headers["set-cookie"] ?? [];
  return raw.map((cookie) => cookie.split(";")[0]).join("; ");
}

/** Jednorazový token obnovy hesla — presne ten, čo by prišiel mailom. */
async function recoveryToken(email) {
  const { data, error } = await db.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (error) throw new Error(`generateLink: ${error.message}`);
  return data.properties.hashed_token;
}

/** Telo posledného mailu v lokálnej schránke. */
async function latestMail() {
  const list = await (await fetch(`${MAILBOX_URL}/api/v1/messages`)).json();
  const id = list.messages?.[0]?.ID ?? list.messages?.[0]?.id;
  if (!id) return "";
  const message = await (
    await fetch(`${MAILBOX_URL}/api/v1/message/${id}`)
  ).json();
  return message.HTML || message.Text || "";
}

/** Počet mailov v lokálnom mailboxe; `null` = mailbox neodpovedá. */
async function mailboxCount() {
  try {
    const response = await fetch(`${MAILBOX_URL}/api/v1/messages`);
    if (!response.ok) return null;
    const data = await response.json();
    if (Array.isArray(data.messages)) return data.messages.length;
    if (typeof data.total === "number") return data.total;
    return null;
  } catch {
    return null;
  }
}

async function main() {
  section("1) Stránky obnovy hesla sú dostupné odhlásenému");
  const forgot = await request("/forgot-password", { host: APP_HOST });
  check("/forgot-password sa vykreslí", forgot.status === 200, forgot.status);
  check(
    "je na nej formulár na e-mail",
    /name="email"/.test(forgot.body),
    "chýba pole e-mail",
  );

  // Federačný tréner sa prihlasuje na subdoméne svojej organizácie, takže si
  // heslo musí vedieť obnoviť aj tam — inak by ho odkaz z mailu vyhodil na
  // plaw.win, kde jeho session ani neplatí (cookies sú host-only).
  const forgotOrg = await request("/forgot-password", { host: ORG_HOST });
  check(
    "funguje aj na subdoméne organizácie",
    forgotOrg.status === 200,
    forgotOrg.status,
  );

  const bare = await request("/reset-password", { host: APP_HOST });
  check("/reset-password bez session vráti 200", bare.status === 200, bare.status);
  check(
    "bez session neponúka formulár, ale ponuku nového odkazu",
    !/name="password"/.test(bare.body) &&
      textOf(bare.body).includes("no longer works"),
    textOf(bare.body).slice(0, 120),
  );

  section("2) Odkaz na obidvoch prihláseniach");
  const login = await request("/login", { host: APP_HOST });
  check(
    "trénerske prihlásenie vedie na obnovu",
    login.body.includes('href="/forgot-password"'),
  );
  const parentLogin = await request("/parent/login", { host: APP_HOST });
  check(
    "rodičovské prihlásenie vedie na obnovu",
    parentLogin.body.includes('href="/forgot-password"'),
  );

  section("3) Neplatný odkaz nikoho nepustí dnu");
  const empty = await request(CONFIRM, { host: APP_HOST });
  check(
    "bez tokenu presmeruje na vysvetlenie",
    empty.status === 303 &&
      (empty.headers.location ?? "").includes("/reset-password?error=link"),
    `${empty.status} ${empty.headers.location}`,
  );

  const garbage = await request(
    `${CONFIRM}?token_hash=nezmysel&type=recovery`,
    { host: APP_HOST },
  );
  check(
    "vymyslený token neprejde",
    (garbage.headers.location ?? "").includes("error=link"),
    garbage.headers.location,
  );
  check(
    "a nevydá session",
    !(garbage.headers["set-cookie"] ?? []).some((c) =>
      /^sb-.*auth-token=.+/.test(c),
    ),
  );

  section("4) Platný odkaz z mailu vytvorí session a otvorí formulár");
  const token = await recoveryToken(COACH);
  const confirmed = await request(
    `${CONFIRM}?next=%2Freset-password&token_hash=${token}&type=recovery`,
    { host: APP_HOST },
  );
  check(
    "presmeruje na nastavenie hesla",
    confirmed.status === 303 &&
      (confirmed.headers.location ?? "").endsWith("/reset-password"),
    `${confirmed.status} ${confirmed.headers.location}`,
  );

  const cookies = cookiesFrom(confirmed);
  check(
    "vydá session cookie",
    /sb-.*auth-token=/.test(cookies),
    cookies.slice(0, 80),
  );

  const form = await request("/reset-password", { host: APP_HOST, cookies });
  const formText = textOf(form.body);
  check("formulár na nové heslo sa vykreslí", /name="password"/.test(form.body));
  check(
    "a ukáže, komu sa heslo mení",
    formText.includes(COACH),
    formText.slice(0, 160),
  );

  section("5) Jednorazovosť a otvorené presmerovanie");
  const reused = await request(
    `${CONFIRM}?token_hash=${token}&type=recovery`,
    { host: APP_HOST },
  );
  check(
    "ten istý token druhý raz neprejde",
    (reused.headers.location ?? "").includes("error=link"),
    reused.headers.location,
  );

  // Odkaz z mailu je dôveryhodný, takže by z appky spravil odrazový mostík na
  // cudziu stránku, keby si cieľ presmerovania nekontrolovala.
  const outside = await request(
    `${CONFIRM}?next=https%3A%2F%2Fexample.com&token_hash=${await recoveryToken(
      COACH,
    )}&type=recovery`,
    { host: APP_HOST },
  );
  check(
    "cudziu adresu v ?next ignoruje",
    (outside.headers.location ?? "").startsWith(`http://${APP_HOST}`),
    outside.headers.location,
  );

  const protocolRelative = await request(
    `${CONFIRM}?next=%2F%2Fexample.com&token_hash=${await recoveryToken(
      COACH,
    )}&type=recovery`,
    { host: APP_HOST },
  );
  check(
    "ani v podobe //host",
    !(protocolRelative.headers.location ?? "").includes("example.com"),
    protocolRelative.headers.location,
  );

  section("6) Celý reťazec presne ako v appke: mail → odkaz → formulár");
  // Sekcia 4 skratkuje token cez service_role. Tu ide o cestu, ktorou pôjde
  // PRODUKCIA: appka žiada o obnovu serverovým (SSR) klientom, čiže v režime
  // PKCE — odkaz z predvolenej šablóny vedie na overovanie Supabase a to
  // presmeruje späť s `?code=`, ktorý sa páruje s cookie uloženou pri žiadosti.
  // Práve preto musí odkaz otvoriť ten istý prehliadač, ktorý o obnovu žiadal.

  // Supabase stráži, ako často sa smie o obnovu žiadať (`max_frequency`
  // v supabase/config.toml). Sekcie vyššie si pre ten istý účet práve vypýtali
  // tokeny, takže bez tejto pauzy žiadosť narazí na limit a sada by hlásila
  // chybu appky tam, kde žiadna nie je.
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const before = await mailboxCount();
  if (before === null) {
    console.log(
      "  --   preskočené: lokálny mailbox neodpovedá (MAILBOX_URL=" +
        MAILBOX_URL +
        ")",
    );
    return;
  }

  const { createServerClient } = require("@supabase/ssr");
  const jar = [];
  const asApp = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: { getAll: () => jar, setAll: (list) => jar.push(...list) },
  });
  const redirectTo = `http://${APP_HOST}${CONFIRM}?next=%2Freset-password`;
  const { error } = await asApp.auth.resetPasswordForEmail(COACH, { redirectTo });
  check("žiadosť o obnovu prejde", !error, error?.message);

  // Mail odchádza synchrónne, ale schránka ho indexuje s malým oneskorením.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const after = await mailboxCount();
  check(
    "v schránke pribudol mail",
    after !== null && after > before,
    `${before} → ${after}`,
  );

  const mail = await latestMail();
  const verifyUrl = (mail.match(/href="([^"]*\/verify[^"]*)"/) ?? [])[1]?.replace(
    /&amp;/g,
    "&",
  );
  check("mail obsahuje overovací odkaz", Boolean(verifyUrl), mail.slice(0, 120));

  // Toto je kontrola, ktorá by inak unikla: cieľ, ktorý nie je na zozname
  // povolených adries, Supabase TICHO zahodí a do mailu dá `site_url` —
  // odkaz potom vedie na úvodnú stránku a obnova hesla nefunguje, hoci appka
  // je v poriadku. Na produkcii to isté drží dashboard (Redirect URLs).
  check(
    "odkaz vedie na obnovu hesla, nie na východziu adresu",
    decodeURIComponent(verifyUrl ?? "").includes(`${APP_HOST}${CONFIRM}`),
    verifyUrl,
  );

  const verified = await fetch(verifyUrl, { redirect: "manual" });
  const landing = new URL(verified.headers.get("location"));
  check(
    "overenie vráti človeka s kódom na /auth/confirm",
    landing.pathname === CONFIRM &&
      (landing.searchParams.has("code") || landing.searchParams.has("token_hash")),
    landing.href,
  );

  const jarCookies = jar.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  const accepted = await request(landing.pathname + landing.search, {
    host: APP_HOST,
    cookies: jarCookies,
  });
  check(
    "appka kód prijme a pustí na nastavenie hesla",
    (accepted.headers.location ?? "").endsWith("/reset-password"),
    accepted.headers.location,
  );

  const finalPage = await request("/reset-password", {
    host: APP_HOST,
    cookies: cookiesFrom(accepted),
  });
  check(
    "formulár na nové heslo sa vykreslí správnemu účtu",
    /name="password"/.test(finalPage.body) &&
      textOf(finalPage.body).includes(COACH),
    textOf(finalPage.body).slice(0, 140),
  );
}

main()
  .then(report)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
