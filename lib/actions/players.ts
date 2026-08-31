"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requirePlayerSlot, requireWriteAccess } from "@/lib/subscription";
import { getOrgContext } from "@/lib/org/context";
import { getOrgMembership } from "@/lib/org/membership";

export type PlayerFormState = { error?: string } | undefined;

/**
 * Ako sa pri zápise obmedzí, že hráč je „môj": v samostatnom režime cez
 * `coach_id`, vo federácii cez organizáciu.
 *
 * Vo federácii je totiž `players.coach_id` len AUTOR riadku — koho tréner
 * trénuje, hovorí priradenie na disciplínu (`player_assignments`). Filtrovanie
 * podľa `coach_id` by tam kondičnému trénerovi zamietlo aj vlastného hráča.
 * Skutočnou hranicou je aj tak RLS (`players_org_coach_update` sa pýta
 * `is_assigned_player`), toto je len zúženie dotazu.
 */
async function ownPlayerScope(userId: string) {
  const membership = await getOrgMembership();
  return membership
    ? { column: "organization_id" as const, value: membership.organizationId }
    : { column: "coach_id" as const, value: userId };
}

/**
 * Rok narodenia je nepovinný, ale keď je vyplnený, musí dávať zmysel. Zdieľajú
 * to zakladanie aj oprava — inak by sa dala kontrola cez opravu obísť.
 */
function parseBirthYear(
  raw: string | undefined,
): { ok: true; value: number | null } | { ok: false } {
  if (!raw) return { ok: true, value: null };

  const parsed = Number.parseInt(raw, 10);
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > currentYear) {
    return { ok: false };
  }
  return { ok: true, value: parsed };
}

export async function createPlayer(
  _prevState: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  const name = (formData.get("name") as string)?.trim();
  const birthYearRaw = (formData.get("birth_year") as string)?.trim();
  const t = await getTranslations("Players.errors");

  if (!name) {
    return { error: t("missingName") };
  }

  const parsedYear = parseBirthYear(birthYearRaw);
  if (!parsedYear.ok) {
    return { error: t("invalidBirthYear") };
  }
  const birthYear = parsedYear.value;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const blocked = await requireWriteAccess(supabase, user.id);
  if (blocked) {
    return { error: (await getTranslations("Common"))(blocked) };
  }

  // Koľko hráčov smie mať účet naraz aktívnych, je cenová hladina — rozhoduje
  // o nej výhradne `requirePlayerSlot` (lib/subscription.ts). Federačného
  // trénera sa netýka, tam počet určuje priradenie od šéftrénera.
  if (await requirePlayerSlot(supabase, user.id)) {
    return { error: t("playerLimitReached") };
  }

  // Nový hráč je vždy aktívny — v samostatnom aj federačnom režime. Kým platilo
  // 1:1, sa tu druhý hráč zakladal rovno do archívu (index `one_active_player`
  // by inak zápis zamietol); od 20260810090000 to drží cenová hladina vyššie.
  const org = await getOrgContext();

  const { error } = await supabase.from("players").insert({
    coach_id: user.id,
    organization_id: org?.id ?? null,
    name,
    birth_year: birthYear,
    is_active: true,
  });

  if (error) {
    return { error: t("createFailed") };
  }

  revalidatePath("/players");
}

/**
 * Oprava karty hráča — meno a rok narodenia.
 *
 * Do 2026-08-30 sa karta v appke upraviť nedala vôbec (boli tu len `create`,
 * `deactivate`, `activate`), takže **preklep v mene dieťaťa neopravil ani
 * tréner**. Databáza to pritom dovoľovala (`players_personal_all` je `FOR ALL`
 * a na `is_active` sa nepýta) — prekážka bola len v rozhraní, a pritom je
 * oprava nesprávneho údaja právo dotknutej osoby (čl. 16 GDPR).
 *
 * **Obsah dokončeného tréningu sa takto opraviť NEDÁ a nemá** — jeho nemennosť
 * je bezpečnostný sľub (príloha C zmluvy podľa čl. 28 aj oba audity). Tá cesta
 * vedie cez podporu, nie cez tlačidlo „odomknúť".
 */
export async function updatePlayer(
  playerId: string,
  _prevState: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  const name = (formData.get("name") as string)?.trim();
  const birthYearRaw = (formData.get("birth_year") as string)?.trim();
  const t = await getTranslations("Players.errors");

  if (!name) {
    return { error: t("missingName") };
  }

  const parsedYear = parseBirthYear(birthYearRaw);
  if (!parsedYear.ok) {
    return { error: t("invalidBirthYear") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Neplatiaci účet číta ďalej, ale nezapisuje (lib/subscription.ts).
  //
  // **Nad cenovou hladinou sa oprava povoľuje** — rovnaká výnimka ako pri
  // archivácii a z rovnakého dôvodu: prekročenie hladiny je stav, do ktorého
  // trénera dostaneme my (znížením hladiny), a opravu mena dieťaťa ním blokovať
  // nemá čo. Pridať hráča sa tým nedá, takže hladinu to neobchádza.
  const blocked = await requireWriteAccess(supabase, user.id, {
    allowOverPlayerLimit: true,
  });
  if (blocked) {
    return { error: (await getTranslations("Common"))(blocked) };
  }

  const scope = await ownPlayerScope(user.id);

  // `select` je tu kvôli odpovedi, nie kvôli dátam: keď RLS zápis zamietne,
  // PostgREST nevráti chybu, len nula riadkov — bez tejto kontroly by klik
  // vyzeral ako úspech. Vo federácii sa to stane trénerovi, ktorý hráča má
  // prideleného, ale nie je autorom riadku (`players_org_coach_update` sa pýta
  // `coach_id = auth.uid()`).
  const { data, error } = await supabase
    .from("players")
    .update({ name, birth_year: parsedYear.value })
    .eq("id", playerId)
    .eq(scope.column, scope.value)
    .select("id");

  if (error || !data?.length) {
    return { error: t("updateFailed") };
  }

  revalidatePath("/players");
}

export async function deactivatePlayer(playerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Neplatiaci účet číta ďalej, ale nezapisuje (lib/subscription.ts).
  //
  // **Jediná výnimka z blokovania nad cenovou hladinou** — archivácia je cesta
  // SPÄŤ pod ňu. Keby sa blokovala tiež, tréner, ktorému hladinu znížime, by
  // uviazol natrvalo: zapisovať nesmie, kým neuberie hráčov, a ubrať by nemohol.
  if (await requireWriteAccess(supabase, user.id, { allowOverPlayerLimit: true })) {
    return;
  }

  const scope = await ownPlayerScope(user.id);

  await supabase
    .from("players")
    .update({ is_active: false })
    .eq("id", playerId)
    .eq(scope.column, scope.value);

  revalidatePath("/players");
}

export async function activatePlayer(playerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Neplatiaci účet číta ďalej, ale nezapisuje (lib/subscription.ts).
  if (await requireWriteAccess(supabase, user.id)) {
    return;
  }

  // Vrátenie z archívu pridáva ďalšieho aktívneho hráča, takže musí cez tú istú
  // stráž ako zakladanie. Kým platilo 1:1, sa tu doterajší aktívny hráč najprv
  // ticho archivoval (index `one_active_player` by inak zápis zamietol) —
  // dnes by to trénerovi s viacerými hráčmi jedného z nich nečakane zhodilo.
  //
  // Tlačidlo sa pri vyčerpanej hladine na `/players` ani nevykreslí; toto je
  // serverová poistka, nie hlavná cesta, preto sa len ticho vráti.
  if (await requirePlayerSlot(supabase, user.id)) {
    return;
  }

  const scope = await ownPlayerScope(user.id);

  await supabase
    .from("players")
    .update({ is_active: true })
    .eq("id", playerId)
    .eq(scope.column, scope.value);

  revalidatePath("/players");
}
