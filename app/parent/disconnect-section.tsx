"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { revokeMyConnection } from "@/lib/actions/player-connections";

/**
 * Odpojenie sledujúceho od trénera (od 2026-09-02).
 *
 * Dovtedy vedel prepojenie zrušiť **len tréner**, takže rodič, ktorý chcel
 * prestať dostávať nové záznamy a zároveň si nechať doterajšie, nemal ako —
 * jedinou cestou bolo zmazať si celý účet, čím prišiel aj o kópie.
 *
 * Zbalené v `<details>` a až na konci stránky zámerne: je to vzácny úkon
 * a nemá súperiť so zoznamom tréningov, kvôli ktorému sem človek chodí.
 * Potvrdenie je dvojkrokové, lebo appka sa používa na telefóne.
 */
export function DisconnectSection() {
  const t = useTranslations("Parent.dashboard");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDisconnect() {
    startTransition(async () => {
      await revokeMyConnection();
      setConfirming(false);
    });
  }

  return (
    <details className="rounded-xl border border-border bg-surface p-4">
      <summary className="cursor-pointer text-sm font-medium text-muted ">
        {t("disconnectHeading")}
      </summary>

      <p className="mt-3 text-xs text-muted ">{t("disconnectText")}</p>

      {confirming ? (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-sm text-foreground ">{t("disconnectConfirm")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={pending}
              className="rounded-lg bg-red-950 px-4 py-2 text-sm font-medium text-red-300 disabled:opacity-50 "
            >
              {pending ? t("disconnectPending") : t("disconnectConfirmYes")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50 "
            >
              {t("disconnectCancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground "
        >
          {t("disconnectButton")}
        </button>
      )}
    </details>
  );
}
