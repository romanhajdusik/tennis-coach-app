"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createInvite,
  deleteMember,
  reactivateMember,
  removeMember,
  revokeInvite,
  type InviteFormState,
} from "@/lib/actions/organization-members";

export type PendingInvite = {
  id: string;
  code: string;
  discipline: string;
};

export type ActiveMember = {
  id: string;
  name: string;
  role: string;
  discipline: string;
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
  inactive,
  seatsUsed,
  seatLimit,
}: {
  pending: PendingInvite[];
  members: ActiveMember[];
  inactive: ActiveMember[];
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

        {/* Disciplína sa volí pri POZVÁNKE, nie neskôr: je vlastnosťou členstva
            a po prijatí ju už zmeniť nemožno (rozišla by sa s priradeniami
            hráčov). Kondičný tréner tak dostane kondičnú podobu appky. */}
        <form action={inviteAction} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">
              {t("disciplineLabel")}
            </span>
            <select
              name="discipline"
              defaultValue="tennis"
              className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
            >
              <option value="tennis">{t("disciplineTennis")}</option>
              <option value="fitness">{t("disciplineFitness")}</option>
            </select>
          </label>
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
                  <span className="min-w-0">
                    <code className="block text-lg font-semibold tracking-widest text-foreground">
                      {invite.code}
                    </code>
                    <span className="block text-xs text-muted">
                      {invite.discipline === "fitness"
                        ? t("disciplineFitness")
                        : t("disciplineTennis")}
                    </span>
                  </span>
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
                      : `${
                          member.discipline === "fitness"
                            ? t("disciplineFitness")
                            : t("disciplineTennis")
                        } · ${t("playersCount", { count: member.playerCount })}`}
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

      {inactive.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted">
            {t("inactiveHeading")}
          </h2>
          <ul className="flex flex-col gap-2">
            {inactive.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-muted">
                    {member.name}
                  </span>
                  <span className="block text-xs text-muted">
                    {t("inactiveLabel")}
                    {member.playerCount > 0 &&
                      ` · ${t("playersCount", { count: member.playerCount })}`}
                  </span>
                </span>

                <span className="flex flex-none flex-wrap gap-2">
                  <RowForm
                    action={reactivateMember.bind(null, member.id)}
                    label={t("reactivate")}
                    confirmMessage={t("reactivateConfirm", {
                      name: member.name,
                    })}
                  />
                  <RowForm
                    action={deleteMember.bind(null, member.id)}
                    label={t("delete")}
                    confirmMessage={t("deleteConfirm", { name: member.name })}
                    destructive
                  />
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">{t("inactiveNote")}</p>
        </section>
      )}
    </div>
  );
}

/**
 * Jednoriadkový formulár (zrušiť pozvánku, odobrať/vrátiť/vymazať trénera).
 * `destructive` odlíši nezvratné mazanie od ostatných akcií — vrátiť späť sa
 * dá všetko okrem neho.
 */
function RowForm({
  action,
  label,
  confirmMessage,
  destructive,
}: {
  action: (
    prevState: InviteFormState,
    formData: FormData,
  ) => Promise<InviteFormState>;
  label: string;
  confirmMessage?: string;
  destructive?: boolean;
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
        className={`rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
          destructive
            ? "border-red-800 text-red-400"
            : "border-border text-muted"
        }`}
      >
        {label}
      </button>
      {state?.error && (
        <span className="ml-2 text-xs text-red-300">{state.error}</span>
      )}
    </form>
  );
}
