"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/org/context";
import { getOrgRole } from "@/lib/org/membership";
import { generateAccessCode } from "@/lib/access-code";

export type InviteFormState = { error?: string } | undefined;

/** Ten istý kryptografický generátor ako pri kóde pre rodiča, len s pomlčkou. */
function generateInviteCode() {
  const code = generateAccessCode(8);
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Pripojenie pozvaného trénera k organizácii. Celú kontrolu robí RPC
 * `claim_organization_invite` (kód musí sedieť, účet nesmie mať osobných
 * hráčov, sedadlo musí byť voľné) — tu chyby len prekladáme.
 *
 * Členstvo je dobrovoľné: účet k pozvánke pripojí LEN toto, šéftréner cudzí
 * účet priamym zápisom priradiť nemôže (trigger `enforce_membership_rules`).
 */
export async function claimOrganizationInvite(
  _prevState: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const code = ((formData.get("code") as string) ?? "").trim().toUpperCase();
  const t = await getTranslations("Join.errors");

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

  const { error } = await supabase.rpc("claim_organization_invite", {
    p_code: code,
  });

  if (error) {
    const reason = error.message ?? "";
    if (reason.includes("has_personal_data")) {
      return { error: t("hasPersonalData") };
    }
    if (reason.includes("seat_limit_reached")) {
      return { error: t("seatLimitReached") };
    }
    if (reason.includes("already_member")) {
      return { error: t("alreadyMember") };
    }
    return { error: t("invalidCode") };
  }

  // Členstvo mení všetko, čo účet vidí — kalendár, hráčov aj kódy cvičení.
  revalidatePath("/", "layout");
  redirect("/");
}

/** Overí, že volajúci je šéftréner TEJTO organizácie, a vráti jej id. */
async function requireDirectorOrg() {
  const org = await getOrgContext();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  if (!org || (await getOrgRole(supabase, user.id)) !== "director") {
    redirect("/");
  }

  return { supabase, org };
}

/**
 * Nová pozvánka pre trénera — riadok bez `user_id` s jednorazovým kódom.
 * Sedadlá kontroluje až claim (pozvánka sedadlo nedrží), takže šéftréner môže
 * rozposlať aj viac kódov, než má miest; obsadí sa ten, kto príde skôr.
 */
export async function createInvite(
  _prevState: InviteFormState,
  _formData: FormData,
): Promise<InviteFormState> {
  const { supabase, org } = await requireDirectorOrg();

  // Kolízia kódu je nepravdepodobná, ale unique index ju zachytí — skúsime
  // niekoľkokrát namiesto toho, aby onboarding spadol na náhode.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from("organization_members").insert({
      organization_id: org.id,
      role: "coach",
      status: "invited",
      invite_code: generateInviteCode(),
    });

    if (!error) {
      revalidatePath("/director/team");
      return undefined;
    }
  }

  const t = await getTranslations("Director.team.errors");
  return { error: t("inviteFailed") };
}

/** Zruší nevyužitú pozvánku (kód prestane platiť). */
export async function revokeInvite(
  memberId: string,
  _prevState: InviteFormState,
  _formData: FormData,
): Promise<InviteFormState> {
  const { supabase, org } = await requireDirectorOrg();

  const { error } = await supabase
    .from("organization_members")
    .update({ status: "removed", invite_code: null })
    .eq("id", memberId)
    .eq("organization_id", org.id)
    .eq("status", "invited");

  if (error) {
    const t = await getTranslations("Director.team.errors");
    return { error: t("removeFailed") };
  }

  revalidatePath("/director/team");
  return undefined;
}

/**
 * Odobratie trénera z organizácie. Jeho hráči ani tréningy sa NEMAŽÚ — dáta
 * vlastní federácia (§5.4), takže ostávajú a v pulte sa objavia v skupine
 * „už nie je v organizácii", kým ich šéftréner nepridelí niekomu inému.
 *
 * Riadok ostáva v `removed` a na `/director/team` sa zobrazí ako neaktívny:
 * dá sa vrátiť späť alebo vymazať natrvalo. Uvoľní sa aj sedadlo.
 */
export async function removeMember(
  memberId: string,
  _prevState: InviteFormState,
  _formData: FormData,
): Promise<InviteFormState> {
  const { supabase, org } = await requireDirectorOrg();

  const { error } = await supabase
    .from("organization_members")
    .update({ status: "removed" })
    .eq("id", memberId)
    .eq("organization_id", org.id)
    .eq("role", "coach")
    .eq("status", "active");

  if (error) {
    const t = await getTranslations("Director.team.errors");
    return { error: t("removeFailed") };
  }

  revalidatePath("/director/team");
  revalidatePath("/director");
  return undefined;
}

/**
 * Vrátenie odobratého trénera späť. Kontroly nerobíme tu — postráži ich trigger
 * `enforce_membership_rules`: musí byť voľné sedadlo a tréner si medzitým nesmel
 * založiť osobných hráčov (medzi odobratím a návratom je z pohľadu appky
 * samostatný tréner, takže si ich založiť MOHOL).
 */
export async function reactivateMember(
  memberId: string,
  _prevState: InviteFormState,
  _formData: FormData,
): Promise<InviteFormState> {
  const { supabase, org } = await requireDirectorOrg();
  const t = await getTranslations("Director.team.errors");

  const { error } = await supabase
    .from("organization_members")
    .update({ status: "active" })
    .eq("id", memberId)
    .eq("organization_id", org.id)
    .eq("role", "coach")
    .eq("status", "removed");

  if (error) {
    const reason = error.message ?? "";
    if (reason.includes("seat_limit_reached")) {
      return { error: t("seatLimitReached") };
    }
    if (reason.includes("has_personal_data")) {
      return { error: t("reactivateHasPersonalData") };
    }
    // Unikátny index `one_active_membership_per_user` — medzitým vstúpil inam.
    if (error.code === "23505") {
      return { error: t("reactivateMemberElsewhere") };
    }
    return { error: t("reactivateFailed") };
  }

  revalidatePath("/director/team");
  revalidatePath("/director");
  return undefined;
}

/**
 * Trvalé zmazanie už odobratého trénera. Ide cez `security definer` RPC —
 * `authenticated` nemá na `organization_members` DELETE a bezpečnostný audit
 * mu ho odobral zámerne, takže sa nevracia kvôli jednej obrazovke.
 *
 * Hráči sa tým nemažú: ostávajú organizácii a čakajú v pulte na prevzatie.
 */
export async function deleteMember(
  memberId: string,
  _prevState: InviteFormState,
  _formData: FormData,
): Promise<InviteFormState> {
  const { supabase } = await requireDirectorOrg();

  const { error } = await supabase.rpc("delete_organization_member", {
    p_member_id: memberId,
  });

  if (error) {
    const t = await getTranslations("Director.team.errors");
    return { error: t("deleteFailed") };
  }

  revalidatePath("/director/team");
  revalidatePath("/director");
  return undefined;
}

// Pozn.: šéftréner, ktorý aj sám trénuje, si na to zakladá DRUHÝ účet a vstupuje
// doň ako bežný tréner (rozhodnuté 2026-08-11). Vstavané „trénerské kreslo"
// v jednom účte sme zvážili a zamietli — vyžiadalo by si prepis zapisovacích org
// policy a zmenu §5.7, kým dva účty fungujú bez zásahu do kódu. Podrobnosti
// v CLAUDE.md, sekcia „Onboarding do organizácie".
