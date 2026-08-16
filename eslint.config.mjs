import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Podčiarkovník = „vieme, že sa nepoužíva". Server actions vo vzore
      // `useActionState` musia prijať (prevState, formData) aj vtedy, keď ich
      // nepotrebujú — inak ich React nevie zavolať.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // scripts/ sú samostatné Node skripty (spúšťané cez `node`), nie súčasť
    // buildu appky — bežia v CommonJS, takže `require()` je tam namieste.
    files: ["scripts/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Pracovné súbory lokálnej Supabase (`supabase start` si sem generuje
    // vlastný minifikovaný edge runtime). Nie je to náš kód a lint na ňom hlási
    // stovky nálezov, takže sa po každom spustení DB tvárilo, že je repo pokazené.
    "supabase/.temp/**",
  ]),
]);

export default eslintConfig;
