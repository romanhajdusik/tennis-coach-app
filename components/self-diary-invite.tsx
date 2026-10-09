import Link from "next/link";
import { SELF_DIARY_PRICE, formatEur } from "@/lib/landing-pricing";
import type { SelfDiaryInviteMessages } from "@/lib/landing-locale";

/**
 * Ponuka HRÁČSKEHO DENNÍKA na verejných landingoch (docs/roadmap-buduce-smery.md
 * §6.4 bod 6): hráč, ktorého tréner P.L.A.W nepoužíva, si môže zapisovať sám.
 *
 * Stavebná kocka ako cenník — zdieľa sa vzhľad a cena, nie texty. Suma sa
 * NEOPISUJE do textov: ide z `SELF_DIARY_PRICE`, toho istého miesta, z ktorého
 * berie cenu pokladňa, aby sa web a Stripe nerozišli.
 *
 * Tlačidlo vedie na registráciu s predvolenou voľbou (`?role=self`). Odkaz je
 * relatívny: na `plaw.click` ho proxy presmeruje na appku (`plaw.win`) aj
 * s parametrom, na nasadení športu ostáva v tej istej appke.
 */
export function SelfDiaryInvite({
  t,
  id,
}: {
  t: SelfDiaryInviteMessages;
  /** Kotva, keď na ponuku odkazuje tlačidlo vyššie na stránke (plaw.click). */
  id?: string;
}) {
  const price = t.price
    .replace("{monthly}", formatEur(SELF_DIARY_PRICE.monthly))
    .replace("{yearly}", formatEur(SELF_DIARY_PRICE.yearly));

  return (
    <section
      id={id}
      className="w-full max-w-3xl scroll-mt-20 px-4 py-10 sm:px-6 sm:py-14"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
          {t.title}
        </h2>
        <p className="max-w-xl text-base text-balance text-muted">{t.text}</p>
        <p className="text-sm text-foreground">{price}</p>
        <Link
          href="/register?role=self"
          className="mt-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
        >
          {t.cta}
        </Link>
        {/* Návod pre hráčsky denník — relatívne z rovnakého dôvodu ako
            registrácia vyššie (na plaw.click ho proxy pošle na appku). */}
        <Link
          href="/navod-self"
          className="text-sm font-medium text-muted underline underline-offset-2 transition-colors hover:text-foreground"
        >
          {t.guideLink}
        </Link>
      </div>
    </section>
  );
}
