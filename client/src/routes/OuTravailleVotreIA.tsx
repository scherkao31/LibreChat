import { useEffect, useRef } from 'react';

/**
 * Page marketing autonome (publique) : "Votre IA travaille pour vous. Mais ou
 * travaille-t-elle ?". Compteurs en direct (estimations prudentes, sources affichees),
 * visuel du flux Geneve -> Etats-Unis, et argument juridiction + entrainement. Plein
 * ecran sombre, independante du theme de l'app. Route : /ou-travaille-votre-ia
 *
 * Toutes les valeurs sont des ESTIMATIONS, methode et sources dans le depliant en bas.
 */

const RREQ = 5_000_000 / 86400; // ~5 mio de requetes/jour depuis la Suisse
const RCHF = 1_892_000_000 / (365 * 86400); // ~2,15 mia USD/an -> CHF/seconde
const nf = new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 0 });

export default function OuTravailleVotreIA() {
  const mainRef = useRef<HTMLSpanElement>(null);
  const moneyRef = useRef<HTMLSpanElement>(null);
  const sinceRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const start = Date.now();
    const introStart = performance.now();
    const INTRO = 1800;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const midSecs = () => {
      const n = new Date();
      return n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds() + n.getMilliseconds() / 1000;
    };
    let raf = 0;
    const set = (el: HTMLSpanElement | null, v: number) => {
      if (el) {
        el.textContent = nf.format(Math.round(v));
      }
    };
    const tick = () => {
      const ms = midSecs();
      const k = ease(Math.min(1, (performance.now() - introStart) / INTRO));
      set(mainRef.current, RREQ * ms * k);
      set(moneyRef.current, RCHF * ms * k);
      set(sinceRef.current, (RREQ * (Date.now() - start)) / 1000);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('ot-in')),
      { threshold: 0.15 },
    );
    document.querySelectorAll('.ot-reveal').forEach((el) => io.observe(el));

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  return (
    <div className="ot-root">
      <style>{`
        .ot-root{min-height:100vh;background:#FBF7EF;color:#161616;overflow-x:hidden;
          font-family:-apple-system,"Segoe UI","Helvetica Neue",Helvetica,Arial,sans-serif;
          background-image:radial-gradient(rgba(0,0,0,.06) 1px,transparent 1px);background-size:26px 26px}
        .ot-wrap{max-width:920px;margin:0 auto;padding:0 24px}
        .ot-sec{min-height:62vh;display:flex;flex-direction:column;justify-content:center;padding:48px 0}
        .ot-hero{min-height:94vh}
        .ot-kick{display:inline-flex;align-items:center;gap:9px;font-size:14px;color:#8a8275;letter-spacing:.06em}
        .ot-dot{width:9px;height:9px;border-radius:50%;background:#DA291C;animation:ot-blink 1.4s infinite}
        .ot-big{font-size:clamp(56px,13vw,150px);font-weight:600;color:#DA291C;font-variant-numeric:tabular-nums;line-height:1;margin:14px 0 10px;letter-spacing:-.02em}
        .ot-sub{font-size:clamp(15px,2vw,19px);color:#6b6459;max-width:560px}
        .ot-pill{display:inline-block;font-size:12px;padding:3px 10px;border-radius:999px;background:rgba(0,0,0,.06);color:#6b6459;margin-left:8px;vertical-align:middle}
        .ot-h1{font-size:clamp(30px,5.4vw,60px);font-weight:500;line-height:1.08;margin:36px 0 0;letter-spacing:-.02em;color:#161616}
        .ot-h1 em{color:#DA291C;font-style:normal}
        .ot-mid{font-size:clamp(40px,9vw,100px);font-weight:600;color:#161616;font-variant-numeric:tabular-nums;line-height:1;letter-spacing:-.02em}
        .ot-lead{font-size:clamp(20px,3.4vw,34px);font-weight:500;line-height:1.25;max-width:720px;letter-spacing:-.01em;color:#161616}
        .ot-lead em{color:#DA291C;font-style:normal}
        .ot-muted{color:#8a8275}
        .ot-bars{margin-top:22px;max-width:460px}
        .ot-barrow{display:flex;align-items:center;gap:14px;margin:12px 0;font-size:15px;color:#3a352e}
        .ot-barrow span:first-child{width:96px}
        .ot-track{flex:1;height:9px;border-radius:6px;background:rgba(0,0,0,.07);overflow:hidden}
        .ot-fill{height:100%;border-radius:6px;background:#DA291C}
        .ot-cta{display:inline-flex;align-items:center;gap:10px;background:#DA291C;color:#fff;border-radius:14px;padding:16px 30px;font-size:18px;font-weight:500;text-decoration:none;transition:transform .15s ease}
        .ot-cta:hover{transform:translateY(-2px)}
        .ot-details{margin-top:40px;border-top:1px solid rgba(0,0,0,.1);padding-top:24px;max-width:760px}
        .ot-details summary{cursor:pointer;font-size:15px;color:#3a352e}
        .ot-meth{font-size:14px;color:#6b6459;line-height:1.7;margin-top:14px}
        .ot-foot{padding:40px 0 64px;color:#8a8275;font-size:14px}
        .ot-reveal{opacity:0;transform:translateY(24px);transition:opacity .7s ease,transform .7s ease}
        .ot-in{opacity:1;transform:none}
        .ot-hint{margin-top:54px;color:#8a8275;font-size:13px;letter-spacing:.08em}
        @keyframes ot-blink{0%,100%{opacity:1}50%{opacity:.2}}
        @media(prefers-reduced-motion:reduce){.ot-root *{animation:none!important;transition:none!important}.ot-reveal{opacity:1;transform:none}}
      `}</style>

      <section className="ot-hero ot-sec">
        <div className="ot-wrap">
          <div className="ot-kick"><span className="ot-dot" />en direct, en Suisse</div>
          <div className="ot-big"><span ref={mainRef}>0</span></div>
          <div className="ot-sub">
            requêtes IA parties à l&apos;étranger aujourd&apos;hui<span className="ot-pill">estimation</span>
          </div>

          <h1 className="ot-h1">
            Votre IA travaille pour vous.
            <br />
            <em>Mais où travaille-t-elle ?</em>
          </h1>

          <svg width="100%" viewBox="0 0 1000 220" style={{ marginTop: 28, maxWidth: 880 }} aria-hidden="true">
            <path d="M210 140 Q500 30 790 140" fill="none" stroke="rgba(0,0,0,.2)" strokeWidth="1.4" strokeDasharray="2 9" strokeLinecap="round">
              <animate attributeName="stroke-dashoffset" values="22;0" dur="0.9s" repeatCount="indefinite" />
            </path>
            <circle cx="120" cy="140" r="8" fill="none" stroke="#DA291C" strokeWidth="1.5">
              <animate attributeName="r" values="10;40" dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.55;0" dur="2.2s" repeatCount="indefinite" />
            </circle>
            <circle cx="880" cy="140" r="8" fill="none" stroke="#DA291C" strokeWidth="1.5">
              <animate attributeName="r" values="8;28" dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0" dur="2.2s" repeatCount="indefinite" />
            </circle>
            <rect x="78" y="116" width="118" height="48" rx="10" fill="#fff" stroke="rgba(0,0,0,.12)" />
            <rect x="92" y="130" width="20" height="20" rx="3" fill="#DA291C" />
            <rect x="99" y="133" width="6" height="14" fill="#fff" /><rect x="95" y="137" width="14" height="6" fill="#fff" />
            <text x="120" y="145" fill="#161616" fontSize="15" fontFamily="inherit">Genève</text>
            <rect x="804" y="116" width="132" height="48" rx="10" fill="#fff" stroke="rgba(0,0,0,.12)" />
            <text x="820" y="136" fill="#161616" fontSize="15" fontFamily="inherit">Serveurs aux</text>
            <text x="820" y="153" fill="#8a8275" fontSize="13" fontFamily="inherit">États-Unis</text>
            {[0, 0.5, 1, 1.5, 2].map((b, i) => (
              <circle key={i} r={i % 2 ? 4 : 6} fill="#DA291C">
                <animateMotion dur="2.6s" repeatCount="indefinite" path="M210 140 Q500 30 790 140" begin={`${b}s`} />
                <animate attributeName="opacity" values="0;1;1;0" dur="2.6s" repeatCount="indefinite" begin={`${b}s`} />
              </circle>
            ))}
          </svg>

          <div className="ot-hint">défilez</div>
        </div>
      </section>

      <section className="ot-sec ot-reveal">
        <div className="ot-wrap">
          <div className="ot-muted ot-sub">Depuis que vous lisez cette page</div>
          <div className="ot-mid"><span ref={sinceRef}>0</span></div>
          <div className="ot-lead">requêtes suisses sont déjà parties à l&apos;étranger.</div>
        </div>
      </section>

      <section className="ot-sec ot-reveal">
        <div className="ot-wrap">
          <div className="ot-muted ot-sub">Chaque jour, la Suisse dépense</div>
          <div className="ot-mid">
            <span ref={moneyRef}>0</span> <span style={{ fontSize: '0.4em' }}>CHF</span>
          </div>
          <div className="ot-lead">en intelligence artificielle. La plus grande partie part à l&apos;étranger.</div>
        </div>
      </section>

      <section className="ot-sec ot-reveal">
        <div className="ot-wrap">
          <div className="ot-lead">
            Où atterrissent ces requêtes <span className="ot-pill">illustratif</span>
          </div>
          <div className="ot-bars">
            <div className="ot-barrow"><span>États-Unis</span><span className="ot-track"><span className="ot-fill" style={{ width: '100%' }} /></span></div>
            <div className="ot-barrow"><span>France</span><span className="ot-track"><span className="ot-fill" style={{ width: '12%' }} /></span></div>
            <div className="ot-barrow"><span>Chine</span><span className="ot-track"><span className="ot-fill" style={{ width: '10%' }} /></span></div>
          </div>
        </div>
      </section>

      <section className="ot-sec ot-reveal">
        <div className="ot-wrap">
          <div className="ot-lead" style={{ marginBottom: 20 }}>Le problème n&apos;est pas que la distance.</div>
          <div className="ot-sub" style={{ fontSize: 19, maxWidth: 720, marginBottom: 14 }}>
            Un serveur américain, c&apos;est la juridiction américaine (Cloud Act). Et vos données peuvent servir
            à entraîner leurs modèles.
          </div>
          <div className="ot-lead">
            <em>Lancya</em> change ça : votre IA tourne en Suisse, vos fichiers y restent, et vos données
            n&apos;entraînent aucun modèle.
          </div>
        </div>
      </section>

      <section className="ot-sec ot-reveal" style={{ minHeight: '50vh' }}>
        <div className="ot-wrap">
          <a className="ot-cta" href="/register">
            Essayer Lancya
            <span aria-hidden="true">&rarr;</span>
          </a>

          <details className="ot-details">
            <summary>Comment on calcule ces chiffres</summary>
            <div className="ot-meth">
              Requêtes : environ 7,4 mio de résidents de 15 ans et plus, dont 43% utilisent une IA générative
              (Office fédéral de la statistique, printemps 2025), soit environ 3,2 mio d&apos;utilisateurs. 36%
              s&apos;en servent chaque jour, à raison d&apos;environ 4 requêtes (moyenne mondiale, OpenAI 2025),
              soit près de 5 mio de requêtes par jour. La plupart sont traitées aux États-Unis (ChatGPT, Gemini,
              Claude).
              <br />
              <br />
              Argent : marché suisse de l&apos;IA estimé à environ 2,15 mia USD par an (Deloitte / Statista,
              2025), soit près de 3 600 CHF par minute. La couche modèle et le cloud sont majoritairement à
              l&apos;étranger.
              <br />
              <br />
              Répartition par pays : parts illustratives d&apos;après la domination des fournisseurs américains, à
              affiner. Toutes ces valeurs sont des estimations, volontairement prudentes.
            </div>
          </details>

          <div className="ot-foot">Lancya. Votre IA pense en Suisse.</div>
        </div>
      </section>
    </div>
  );
}
