import { disciplineConfig, isDisciplineId } from "@/lib/disciplines/registry";
import { LoginForm } from "./login-form";

/**
 * Prihlásenie trénera. `?account=<disciplína>` sem posiela `proxy.ts`, keď sa
 * niekto prihlásil účtom inej appky (jeden šport = jeden účet, docs §1.1) —
 * session mu tu zahodila a stránka mu povie, kam jeho účet patrí.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const { account } = await searchParams;
  const otherApp = isDisciplineId(account)
    ? (() => {
        const config = disciplineConfig(account);
        return {
          name: config.label,
          domain: config.domain,
          href: `https://${config.domain}/login`,
        };
      })()
    : null;

  return <LoginForm otherApp={otherApp} />;
}
