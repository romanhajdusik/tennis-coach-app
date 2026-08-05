import { getTranslations, getFormatter } from "next-intl/server";
import {
  PRACTICE_LOOKBACK_DAYS,
  type AttentionLevel,
  type RosterEntry,
  type ScheduledSession,
} from "@/lib/players/roster";

/**
 * Spoločné zobrazenie stavu hráča v rosteri — používa ho obrazovka „Dnes"
 * aj `/players`, aby tie isté dni znamenali všade tú istú farbu a text.
 *
 * Stavové farby sú zámerne mimo brandovej antukovej palety (rovnaká konvencia
 * ako naplánovaný/dokončený tréning v kalendári).
 */
export const ATTENTION_DOT_CLASSES: Record<AttentionLevel, string> = {
  ok: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};

export const ATTENTION_TEXT_CLASSES: Record<AttentionLevel, string> = {
  ok: "text-muted",
  warning: "text-amber-300",
  critical: "text-red-300",
};

/** Číselná dlaždica zhrnutia (tréningy dnes, hráči, vyžaduje pozornosť). */
export function SummaryTile({
  value,
  label,
  highlight,
}: {
  value: number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p
        className={`text-xl font-semibold ${
          highlight ? "text-amber-300" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="text-xs leading-tight text-muted">{label}</p>
    </div>
  );
}

export async function AttentionDot({ level }: { level: AttentionLevel }) {
  const t = await getTranslations("Players.roster");

  return (
    <span
      title={t(`status.${level}`)}
      aria-label={t(`status.${level}`)}
      className={`inline-block h-2.5 w-2.5 flex-none rounded-full ${ATTENTION_DOT_CLASSES[level]}`}
    />
  );
}

/** „Practiced today" / „5 days without a practice" / „No practice in the last 60 days". */
export async function lastPracticeLabel(entry: RosterEntry) {
  const t = await getTranslations("Players.roster");

  return entry.daysSincePractice === null
    ? t("noRecentPractice", { days: PRACTICE_LOOKBACK_DAYS })
    : t("lastPractice", { days: entry.daysSincePractice });
}

/** „Next today at 16:00" / „Next tomorrow at 15:00" / „Next 12 Aug, 14:00". */
export async function nextPracticeLabel(session: ScheduledSession | null) {
  const t = await getTranslations("Players.roster");
  const format = await getFormatter();

  if (!session) {
    return t("noNextPractice");
  }

  const date = new Date(session.date);

  if (session.dayOffset === 0) {
    return t("nextToday", { time: format.dateTime(date, { timeStyle: "short" }) });
  }
  if (session.dayOffset === 1) {
    return t("nextTomorrow", {
      time: format.dateTime(date, { timeStyle: "short" }),
    });
  }

  return t("nextOn", {
    date: format.dateTime(date, { dateStyle: "medium", timeStyle: "short" }),
  });
}
