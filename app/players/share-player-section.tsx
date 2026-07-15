"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { generateConnectCode, revokeConnection } from "@/lib/actions/player-connections";

type Connection = { id: string; connect_code: string; status: string } | null;

export function SharePlayerSection({
  playerId,
  connection,
}: {
  playerId: string;
  connection: Connection;
}) {
  const t = useTranslations("Players.share");
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

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {t("heading")}
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {t("description")}
      </p>

      {!connection && (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {t("generateButton")}
        </button>
      )}

      {connection && connection.status === "pending" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("codeLabel")}
            </span>
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-zinc-300 px-3 py-2 font-mono text-lg tracking-widest dark:border-zinc-700">
                {connection.connect_code}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
              >
                {copied ? t("copiedButton") : t("copyButton")}
              </button>
            </div>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("pendingStatus")}
          </p>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={isPending}
            className="self-start rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-400"
          >
            {t("revokeButton")}
          </button>
        </div>
      )}

      {connection && connection.status === "active" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            ✓ {t("activeStatus")}
          </p>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={isPending}
            className="self-start rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-400"
          >
            {t("revokeButton")}
          </button>
        </div>
      )}
    </div>
  );
}
