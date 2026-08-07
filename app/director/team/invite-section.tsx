"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createInvite,
  removeMember,
  revokeInvite,
  type InviteFormState,
} from "@/lib/actions/organization-members";

export type PendingInvite = { id: string; code: string };

export type ActiveMember = {
  id: string;
  name: string;
  role: string;
  playerCount: number;
};

/**
 * Správa členstva organizácie. Šéftréner tu spravuje ORGANIZAČNÚ
 * administratívu — read-only dohľad podľa §5.7 sa týka tréningových dát,
 * nie toho, kto v organizácii je.
 *
 * Všetky zmeny idú cez formuláre (vzor `useActionState` + bindované argumenty
 * ako inde v appke), takže fungujú aj bez JavaScriptu; potvrdenie mazania je
 * len nadstavba nad natívnym odoslaním.
 */
export function InviteSection({
  pending,
  members,
  seatsUsed,
  seatLimit,
}: {
  pending: PendingInvite[];
  members: ActiveMember[];
  seatsUsed: number;
  seatLimit: number;
}) {
  const t = useTranslations("Director.team");
  const [inviteState, inviteAction, invitePending] = useActionState<
    InviteFormState,
    FormData
  >(createInvite, undefined);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const seatsFull = seatsUsed >= seatLimit;

  function copy(invite: PendingInvite) {
    navigator.clipboard.writeText(invite.code);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div>
          <h2 className="text-sm font-medium text-foreground">
            {t("inviteHeading")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("inviteDescription")}</p>
        </div>

        <p className={`text-sm ${seatsFull ? "text-amber-300" : "text-muted"}`}>
          {t("seats", { used: seatsUsed, limit: seatLimit })}
          {seatsFull && ` — ${t("seatsFull")}`}
        </p>

        <form action={inviteAction}>
          <button
            type="submit"
            disabled={invitePending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {invitePending ? t("invitePending") : t("inviteButton")}
          </button>
        </form>

        {inviteState?.error && (
          <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
            {inviteState.error}
          </p>
        )}

        {pending.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              {t("pendingHeading")}
            </h3>
            <ul className="flex flex-col gap-2">
              {pending.map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background p-3"
                >
                  <code className="text-lg font-semibold tracking-widest text-foreground">
                    {invite.code}
                  </code>
                  <span className="flex flex-none gap-2">
                    <button
                      type="button"
                      onClick={() => copy(invite)}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground"
                    >
                      {copiedId === invite.id ? t("copied") : t("copy")}
                    </button>
                    <RowForm
                      action={revokeInvite.bind(null, invite.id)}
                      label={t("revoke")}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">
          {t("membersHeading")}
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted">{t("noMembers")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">
                    {member.name}
                  </span>
                  <span className="block text-xs text-muted">
                    {member.role === "director"
                      ? t("roleDirector")
                      : `${t("roleCoach")} · ${t("playersCount", { count: member.playerCount })}`}
                  </span>
                </span>

                {member.role === "coach" && (
                  <RowForm
                    action={removeMember.bind(null, member.id)}
                    label={t("remove")}
                    confirmMessage={t("removeConfirm", { name: member.name })}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">{t("removeNote")}</p>
      </section>
    </div>
  );
}

/** Jednoriadkový formulár (zrušiť pozvánku / odobrať trénera). */
function RowForm({
  action,
  label,
  confirmMessage,
}: {
  action: (
    prevState: InviteFormState,
    formData: FormData,
  ) => Promise<InviteFormState>;
  label: string;
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState<InviteFormState, FormData>(
    action,
    undefined,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmMessage && !confirm(confirmMessage)) event.preventDefault();
      }}
    >
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted disabled:opacity-60"
      >
        {label}
      </button>
      {state?.error && (
        <span className="ml-2 text-xs text-red-300">{state.error}</span>
      )}
    </form>
  );
}
