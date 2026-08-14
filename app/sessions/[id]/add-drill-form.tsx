"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "next-intl";
import { addDrill, removeDrill } from "@/lib/actions/session-drills";
import { useDiscipline } from "@/lib/discipline-context";

type LastAdded = {
  id: string;
  category: string;
  character: string;
  drillCode: string;
};

export function AddDrillForm({
  sessionId,
  drillsByCategory,
  initialCategory,
}: {
  sessionId: string;
  drillsByCategory: Record<string, string[]>;
  initialCategory?: string;
}) {
  const DISCIPLINE = useDiscipline();
  // Prázdny reťazec v disciplíne bez charakteru — pole sa vtedy nevykreslí
  // a server ho nevalidne (`checkDrillInput`).
  const DEFAULT_CHARACTER = DISCIPLINE.character?.defaultValue ?? "";
  const t = useTranslations("Sessions.addDrillForm");
  const addDrillWithSession = addDrill.bind(null, sessionId);
  const [state, formAction] = useActionState(addDrillWithSession, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const processedIdRef = useRef<string | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();

  // Zameranie sa predvypĺňa podľa naposledy uloženého cvičenia v tomto
  // tréningu (nie natvrdo defaultom), nech si tréner nemusí kategóriu
  // vyberať znova ani po reloade stránky (napr. po zamknutí telefónu)
  const [category, setCategory] = useState(
    initialCategory ?? DISCIPLINE.defaultCategory,
  );
  const [character, setCharacter] = useState(DEFAULT_CHARACTER);
  const drillOptions = drillsByCategory[category];
  const [drillCode, setDrillCode] = useState(drillOptions?.[0] ?? "");
  const [duration, setDuration] = useState("");
  const [lastAdded, setLastAdded] = useState<LastAdded | null>(null);
  const [justConfirmed, setJustConfirmed] = useState(false);

  useEffect(() => {
    if (state?.addedDrillId && state.addedDrillId !== processedIdRef.current) {
      processedIdRef.current = state.addedDrillId;
      setLastAdded({ id: state.addedDrillId, category, character, drillCode });
      // pripraviť formulár na ďalšie cvičenie — zameranie zámerne necháme
      // na poslednej použitej hodnote (tréner často zadáva viac cvičení
      // za sebou v tej istej kategórii), resetuje sa len charakter a kód
      setCharacter(DEFAULT_CHARACTER);
      setDrillCode(drillsByCategory[category]?.[0] ?? "");
      setDuration("");

      // Udrží scroll pri formulári (nie inde na stránke) a na chvíľu
      // vizuálne zvýrazní potvrdenie, nech je jasné, že sa cvičenie
      // naozaj zapísalo a tréner môže hneď zadávať ďalšie.
      confirmationRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      setJustConfirmed(true);
      const timeout = setTimeout(() => setJustConfirmed(false), 1200);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleCategoryChange(value: string) {
    setCategory(value);
    setDrillCode(drillsByCategory[value]?.[0] ?? "");
  }

  function handleDurationChange(value: string) {
    setDuration(value);
    if (value) {
      formRef.current?.requestSubmit();
    }
  }

  function handleUndo() {
    if (!lastAdded) return;
    const toRemove = lastAdded;
    startRemoveTransition(async () => {
      await removeDrill(sessionId, toRemove.id);
    });
    // vrátiť sa pred krok zadania trvania — zameranie/charakter/cvičenie
    // ostávajú vyplnené, len trvanie treba zadať znova
    setCategory(toRemove.category);
    setCharacter(toRemove.character);
    setDrillCode(toRemove.drillCode);
    setDuration("");
    setLastAdded(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {lastAdded && (
        <div
          ref={confirmationRef}
          className={`flex items-center justify-between rounded-xl border p-3 text-sm transition-shadow duration-300 border-emerald-800 bg-emerald-950 ${
            justConfirmed ? "ring-2 ring-emerald-600" : ""
          }`}
        >
          <span className=" text-emerald-200">
            <span aria-hidden="true">✓</span> {t("addedPrefix")}{" "}
            {lastAdded.category} · {lastAdded.drillCode}
          </span>
          <button
            type="button"
            onClick={handleUndo}
            disabled={isRemoving}
            className="rounded-lg border px-3 py-1 text-xs font-medium disabled:opacity-50 border-emerald-700 text-emerald-200"
          >
            {t("undo")}
          </button>
        </div>
      )}

      <form
        ref={formRef}
        action={formAction}
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 "
      >
        <h2 className="text-sm font-medium text-muted ">
          {t("heading")}
        </h2>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="category"
            className="text-sm font-medium text-foreground "
          >
            {t("categoryLabel")}
          </label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(event) => handleCategoryChange(event.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
          >
            {DISCIPLINE.categories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {DISCIPLINE.character && (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="character"
              className="text-sm font-medium text-foreground "
            >
              {t("characterLabel")}
            </label>
            <select
              id="character"
              name="character"
              value={character}
              onChange={(event) => setCharacter(event.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
            >
              {DISCIPLINE.character.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label
            htmlFor="drill_code"
            className="text-sm font-medium text-foreground "
          >
            {t("drillLabel")}
          </label>
          {drillOptions && drillOptions.length > 0 ? (
            <select
              id="drill_code"
              name="drill_code"
              value={drillCode}
              onChange={(event) => setDrillCode(event.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
            >
              {drillOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="drill_code"
              name="drill_code"
              type="text"
              required
              value={drillCode}
              onChange={(event) => setDrillCode(event.target.value)}
              placeholder={t("drillPlaceholder")}
              className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
            />
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="duration_minutes"
            className="text-sm font-medium text-foreground "
          >
            {t("durationLabel")}
          </label>
          <select
            id="duration_minutes"
            name="duration_minutes"
            value={duration}
            onChange={(event) => handleDurationChange(event.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm bg-input"
          >
            <option value="" disabled>
              {t("selectDuration")}
            </option>
            {DISCIPLINE.durations.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min
              </option>
            ))}
          </select>
        </div>

        {state?.error && (
          <p className="text-sm text-red-400">{state.error}</p>
        )}
      </form>
    </div>
  );
}
