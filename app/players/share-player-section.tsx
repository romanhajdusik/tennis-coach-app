"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { generateConnectCode, revokeConnection } from "@/lib/actions/player-connections";

type Connection = {
  id: string;
  connect_code: string;
  status: string;
  connected_role: string | null;
} | null;

const ROLE_LABEL_KEYS: Record<string, string> = {
  parent: "roleParent",
  manager: "roleManager",
  player: "rolePlayer",
};

/**
 * Zdieľanie prístupu s rodičom/hráčom — **jedna sekcia na hráča**. Tréner môže
 * mať viac aktívnych hráčov (cenová hladina), takže panel žije priamo v karte
 * hráča a nie raz na stránke pri „tom vybranom": inak by tréner musel prepínať
 * vybraného hráča len preto, aby zdieľal iného.
 *
 * Zbalené v `<details>` zámerne — pri ôsmich hráčoch by osem rozbalených panelov
 * stránku zahltilo. Funguje bez JS (natívny prvok), rozbalí sa len to, čo tréner
 * naozaj potrebuje. Stav prepojenia je vidieť už v zhrnutí, takže kvôli kontrole
 * „komu to už beží" netreba rozbaliť nič.
 */
export function SharePlayerSection({
  playerId,
  connection,
}: {
  playerId: string;
  connection: Connection;
}) {
  const t = useTranslations("Players.share");
  const tRole = useTranslations("Auth.register");
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    startTransition(async () => {
      await generateConnectCode(playerId);
    });
  }

  function handleRevoke() {
    if (!connection) return;
    startTransition(async () => {
      await revokeConnection(connection.id);
    });
  }

  function handleCopy() {
    if (!connection) return;
    navigator.clipboard.writeText(connection.connect_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeLabel =
    connection?.connected_role && ROLE_LABEL_KEYS[connection.connected_role]
      ? t("activeStatus", {
          role: tRole(ROLE_LABEL_KEYS[connection.connected_role]),
        })
      : t("activeStatusUnknown");

  return (
    <details className="border-t border-border pt-3">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium text-muted">
        {t("heading")}
        {connection?.status === "active" && (
          <span className="text-xs font-medium text-emerald-400">
            ✓ {activeLabel}
          </span>
        )}
        {connection?.status === "pending" && (
          <span className="font-mono text-xs tracking-widest text-foreground">
            {connection.connect_code}
          </span>
        )}
      </summary>

      <div className="flex flex-col gap-2 pt-3">
        <p className="text-sm text-muted ">{t("description")}</p>

        {!connection && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
            className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 "
          >
            {t("generateButton")}
          </button>
        )}

        {connection && connection.status === "pending" && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground ">
                {t("codeLabel")}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-border px-3 py-2 font-mono text-lg tracking-widest ">
                  {connection.connect_code}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground "
                >
                  {copied ? t("copiedButton") : t("copyButton")}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted ">{t("pendingStatus")}</p>
            <button
              type="button"
              onClick={handleRevoke}
              disabled={isPending}
              className="self-start rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 border-red-800 text-red-400"
            >
              {t("revokeButton")}
            </button>
          </div>
        )}

        {connection && connection.status === "active" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-emerald-400">✓ {activeLabel}</p>
            <button
              type="button"
              onClick={handleRevoke}
              disabled={isPending}
              className="self-start rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 border-red-800 text-red-400"
            >
              {t("revokeButton")}
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
