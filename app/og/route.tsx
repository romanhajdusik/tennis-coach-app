// Kreslí náhľadový obrázok odkazu (1200 × 630). Dôvody, prečo sa kreslí
// a neukladá ako súbor, sú v `lib/og.ts`.
import { ImageResponse } from "next/og";
import { OG_FACE_STYLE, type OgFace } from "@/lib/og";
import { FITNESS_DISCIPLINE } from "@/lib/disciplines/fitness";
import {
  loadLandingHracMessages,
  loadLandingMessages,
  loadRozcestnikMessages,
  loadSportsHubMessages,
} from "@/lib/landing-locale";

const FACES = new Set<OgFace>(["coach", "parent", "org", "fitness", "hub"]);

/** Rozpis skratky sa neprekladá — je viazaný na písmená P-L-A-W. */
const ACRONYM = "Plan. Log. Analyze. Win.";

/**
 * Text na obrázku sa ČÍTA Z TÝCH ISTÝCH SÚBOROV ako stránka a nevymýšľa sa.
 * Vlastná marketingová veta by sa po prvej úprave nadpisu ticho rozišla
 * s webom a nikto by si toho nevšimol — obrázok sa nepozerá tak často.
 *
 * Preto ani „For tennis coaches": ten štítok user 2026-09-21 vedome zmenil
 * na „Tennis" (commit `f796815`) a obrázok ho nemá vracať zadnými dverami.
 */
async function faceText(face: OgFace): Promise<{ eyebrow?: string; title: string }> {
  if (face === "parent") {
    const t = await loadLandingHracMessages();
    return { eyebrow: t.eyebrow, title: t.heroTitle };
  }
  if (face === "org") {
    // Rozcestník nemá štítok — jeho nadpis je samotný rozpis skratky a na
    // karte unesie celú plochu sám.
    const t = await loadRozcestnikMessages();
    return { title: t.title };
  }
  if (face === "hub") {
    // Rozcestník športov — štítok je značka, nadpis výzva na výber.
    const t = await loadSportsHubMessages();
    return { eyebrow: "P.L.A.W Sports", title: t.title };
  }
  if (face === "fitness") {
    // Kondička nemá marketingový text; jej úvodná obrazovka ukazuje presne
    // toto — rozpis skratky a štítok disciplíny. `Common.appDescription` sa
    // použiť NEDÁ, hovorí „for tennis coaches".
    return { eyebrow: FITNESS_DISCIPLINE.label, title: ACRONYM };
  }
  const t = await loadLandingMessages();
  return { eyebrow: t.eyebrow, title: t.heroTitle };
}

export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get("face");
  const face: OgFace = FACES.has(asked as OgFace) ? (asked as OgFace) : "coach";
  const style = OG_FACE_STYLE[face];
  const { eyebrow, title } = await faceText(face);

  // Bodky v „P.L.A.W" nesú primárnu farbu VŠADE (pravidlo značky, viď
  // `components/wordmark.tsx`) — aj tu, hoci sa to kreslí mimo appky.
  const wordmark = ["P", "L", "A", "W"];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: style.background,
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline" }}>
          {wordmark.map((letter, i) => (
            <div key={letter} style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ color: "#ffffff", fontSize: 64, fontWeight: 700, letterSpacing: "-0.02em" }}>
                {letter}
              </span>
              {i < wordmark.length - 1 ? (
                <span style={{ color: style.accent, fontSize: 64, fontWeight: 700 }}>.</span>
              ) : null}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {eyebrow ? (
            <span
              style={{
                color: style.accent,
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: 20,
              }}
            >
              {eyebrow}
            </span>
          ) : null}
          {/* Bez štítku unesie nadpis väčší stupeň — rozcestník má krátky. */}
          <span
            style={{
              color: "#ffffff",
              fontSize: eyebrow ? 58 : 76,
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            {title}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 44, height: 4, background: style.accent, marginRight: 22 }} />
          <span style={{ color: style.muted, fontSize: 30 }}>{style.domain}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
