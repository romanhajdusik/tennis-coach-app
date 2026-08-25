"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  claimCardLink,
  generateCardLinkCode,
  revokeCardLink,
  setCardLinkFollowerSharing,
  setCardLinkSummary,
  type ClaimCardLinkState,
} from "@/lib/actions/player-links";

export type CardLink = {
  id: string;
  status: string;
  link_code: string;
  source_discipline: string;
  target_shares_summary: boolean;
  source_shares_with_follower: boolean;
} | null;

/**
 * Prepojenie karty hráča s tou istou kartou u trénera druhej disciplíny
 * (docs §2.0, krok 4). **Jedna sekcia na hráča** a zbalená v `<details>` —
 * rovnaký dôvod ako pri zdieľaní s rodičom: tréner môže mať osem detí a osem
 * rozbalených panelov by stránku zahltilo.
 *
 * Komponent má dve podoby podľa toho, ktorú stranu appka hrá (`cardLink`
 * v konfigurácii disciplíny): vlastník dát kód VYDÁVA, druhá strana ho ZADÁVA.
 * Rolu určuje konfigurácia, nie tento súbor — žiadne „ak je to kondička".
 */
export function LinkPlayerSection({
  playerId,
  link,
  role,
}: {
  playerId: string;
  link: CardLink;
  role: "owner" | "viewer";
}) {
  const t = useTranslations("Players.link");
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [claimState, claimAction, isClaiming] = useActionState<
    ClaimCardLinkState,
    FormData
  >(claimCardLink, undefined);
  const [sharesSummary, setSharesSummary] = useOptimistic(
    link?.target_shares_summary ?? false,
  );
  const [sharesWithFollower, setSharesWithFollower] = useOptimistic(
    link?.source_shares_with_follower ?? false,
  );

  function handleGenerate() {
    startTransition(async () => {
      await generateCardLinkCode(playerId);
    });
  }

  function handleRevoke() {
    if (!link) return;
    startTransition(async () => {
      await revokeCardLink(link.id);
    });
  }

  function handleCopy() {
    if (!link) return;
    navigator.clipboard.writeText(link.link_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /**
   * Zaškrtnutie musí byť vidieť HNEĎ. Bez optimistického stavu drží políčko
   * hodnotu z databázy, takže sa po kliknutí na sekundu vráti späť (kým dobehne
   * akcia a prekreslenie) — vyzerá to, že prepínač nefunguje.
   */
  function handleSummary(enabled: boolean) {
    if (!link) return;
    startTransition(async () => {
      setSharesSummary(enabled);
      await setCardLinkSummary(link.id, enabled);
    });
  }

  /** To isté pre sledujúceho druhej karty — iný súhlas, iná strana. */
  function handleFollowerSharing(enabled: boolean) {
    if (!link) return;
    startTransition(async () => {
      setSharesWithFollower(enabled);
      await setCardLinkFollowerSharing(link.id, enabled);
    });
  }

  const isActive = link?.status === "active";

  return (
    <details className="border-t border-border pt-3">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium text-muted">
        {t("heading")}
        {isActive && (
          <span className="text-xs font-medium text-emerald-400">
            ✓ {t("activeStatus")}
          </span>
        )}
        {link?.status === "pending" && role === "owner" && (
          <span className="font-mono text-xs tracking-widest text-foreground">
            {link.link_code}
          </span>
        )}
      </summary>

      <div className="flex flex-col gap-2 pt-3">
        <p className="text-sm text-muted">
          {role === "owner" ? t("ownerDescription") : t("viewerDescription")}
        </p>

        {/* Vlastník dát: vydá kód a pošle ho druhému trénerovi. */}
        {role === "owner" && !link && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
            className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {t("generateButton")}
          </button>
        )}

        {role === "owner" && link?.status === "pending" && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                {t("codeLabel")}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-border px-3 py-2 font-mono text-lg tracking-widest">
                  {link.link_code}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground"
                >
                  {copied ? t("copiedButton") : t("copyButton")}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted">{t("pendingStatus")}</p>
          </div>
        )}

        {/* Druhá strana: zadá kód, ktorý dostal. */}
        {role === "viewer" && !isActive && (
          <form action={claimAction} className="flex flex-col gap-2">
            <input type="hidden" name="playerId" value={playerId} />
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                name="code"
                required
                autoComplete="off"
                autoCapitalize="characters"
                placeholder={t("codePlaceholder")}
                className="w-40 rounded-lg border border-border bg-input px-3 py-2 font-mono text-lg uppercase tracking-widest text-foreground"
              />
              <button
                type="submit"
                disabled={isClaiming}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {isClaiming ? t("claimPending") : t("claimButton")}
              </button>
            </div>
            {claimState?.error && (
              <p className="text-sm text-red-400">{claimState.error}</p>
            )}
          </form>
        )}

        {isActive && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-emerald-400">✓ {t("activeStatus")}</p>

            {/* Vydávajúci sa o súhrne inak nemá ako dozvedieť — prepínač je na
                druhej strane a blok v analytike sa mu objaví, až keď ho niekto
                zapne. */}
            {role === "owner" && (
              <p className="text-xs text-muted">{t("summaryOwnerHint")}</p>
            )}

            {/* Súhrn pre SLEDUJÚCEHO druhej karty (docs §2.3b) — ponúka sa
                vlastníkovi dát, teda opačnej strane než prepínač nižšie. Sú to
                dva nezávislé súhlasy: že prácu ukazujem kolegovi, neznamená, že
                ju chcem posielať aj rodičovi. */}
            {link && role === "owner" && (
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-input p-3">
                <input
                  type="checkbox"
                  checked={sharesWithFollower}
                  onChange={(event) =>
                    handleFollowerSharing(event.target.checked)
                  }
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">
                    {t("followerLabel")}
                  </span>
                  <span className="text-xs text-muted">
                    {t("followerHint")}
                  </span>
                </span>
              </label>
            )}

            {/* Súhrn opačným smerom (docs §2.3) — ponúka sa len tej strane,
                ktorá kód ZADALA, lebo rozhoduje o vlastných dátach. Vedome je
                to prepínač na už bežiacom prepojení, nie druhý kód: totožnosť
                kariet je overená a druhý riadok by z jednosmerného pohľadu
                spravil obojsmerný plný detail. */}
            {link && role === "viewer" && (
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-input p-3">
                <input
                  type="checkbox"
                  checked={sharesSummary}
                  onChange={(event) => handleSummary(event.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">
                    {t("summaryLabel")}
                  </span>
                  <span className="text-xs text-muted">{t("summaryHint")}</span>
                </span>
              </label>
            )}

            <button
              type="button"
              onClick={handleRevoke}
              disabled={isPending}
              className="self-start rounded-lg border border-red-800 px-3 py-1.5 text-xs font-medium text-red-400 disabled:opacity-50"
            >
              {t("revokeButton")}
            </button>
          </div>
        )}

        {/* Nezadaný kód smie vydávajúci zrušiť tiež — napríklad keď ho poslal
            nesprávnemu človeku. */}
        {role === "owner" && link?.status === "pending" && (
          <button
            type="button"
            onClick={handleRevoke}
            disabled={isPending}
            className="self-start rounded-lg border border-red-800 px-3 py-1.5 text-xs font-medium text-red-400 disabled:opacity-50"
          >
            {t("revokeButton")}
          </button>
        )}
      </div>
    </details>
  );
}
