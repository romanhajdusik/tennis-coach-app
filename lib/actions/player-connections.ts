"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireWriteAccess } from "@/lib/subscription";
import { generateAccessCode } from "@/lib/access-code";

// Generovanie kódu (vrátane dôvodu, prečo kryptograficky) je v lib/access-code.ts.

export async function generateConnectCode(playerId: string) {
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

  // Hráč musí byť vlastný a osobný. Hranicou je RLS (migrácia
  // `20260807120000` — predtým sa dalo prepojenie vyrobiť na ĽUBOVOĽNÉ
  // `player_id` a prečítať si tak cudzieho hráča aj jeho históriu), ale
  // `playerId` sem chodí od klienta, takže ho odmietame rovno tu a nenecháme
  // to skončiť ako pätica tichých zamietnutí v cykle nižšie.
  const { data: owned } = await supabase
    .from("players")
    .select("id")
    .eq("id", playerId)
    .eq("coach_id", user.id)
    .is("organization_id", null)
    .maybeSingle();

  if (!owned) {
    return;
  }

  const { data: existing } = await supabase
    .from("player_connections")
    .select("id")
    .eq("coach_id", user.id)
    .eq("player_id", playerId)
    .in("status", ["pending", "active"])
    .maybeSingle();

  if (!existing) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await supabase.from("player_connections").insert({
        coach_id: user.id,
        player_id: playerId,
        connect_code: generateAccessCode(),
        status: "pending",
      });
      if (!error) break;
      // Opakuje sa len zrážka vygenerovaného kódu (`connect_code` je unique).
      // Pri inej chybe je ďalší pokus zbytočný — dopadne rovnako.
      if (error.code !== "23505") break;
    }
  }

  revalidatePath("/players");
}

export async function revokeConnection(connectionId: string) {
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

  await supabase
    .from("player_connections")
    .update({ status: "revoked" })
    .eq("id", connectionId)
    .eq("coach_id", user.id);

  revalidatePath("/players");
}

/**
 * Sledujúci si zruší VLASTNÉ prepojenie (od 2026-09-02).
 *
 * Dovtedy to vedel len tréner (`revokeConnection` filtruje na `coach_id`),
 * takže kto chcel prestať dostávať nové záznamy, musel si zmazať celý účet — a
 * prišiel tým aj o doterajšie kópie. Podmienky pre sledujúceho §4 to popisovali
 * pravdivo, ale bolo to nepohodlné a lacné na opravu.
 *
 * **Bez `requireWriteAccess`, zámerne.** Odobrať raz dané zdieľanie musí ísť
 * vždy — rovnaká výnimka ako pri vypnutí súhrnu na prepojení kariet. Sledujúci
 * navyše dnes neplatí nič.
 *
 * **Kópie ostávajú.** Zastaví sa len synchronizácia, `parent_session_records`
 * sa nemažú — presne ako keď prepojenie zruší tréner.
 */
export async function revokeMyConnection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/parent/login");
  }

  // Funkcia nemá parameter — sledujúci má naraz najviac jedno aktívne
  // prepojenie, takže si ho nevyberá a nemôže ukázať na cudzí riadok.
  await supabase.rpc("revoke_my_connection");

  revalidatePath("/parent");
}

export type ClaimConnectionState = { error?: string } | undefined;

export async function claimConnection(
  _prevState: ClaimConnectionState,
  formData: FormData,
): Promise<ClaimConnectionState> {
  const code = ((formData.get("code") as string) ?? "").trim().toUpperCase();
  const t = await getTranslations("Parent.errors");

  if (!code) {
    return { error: t("missingCode") };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("claim_player_connection", {
    p_code: code,
  });

  if (error) {
    return { error: t("invalidCode") };
  }

  revalidatePath("/parent");
  redirect("/parent");
}
