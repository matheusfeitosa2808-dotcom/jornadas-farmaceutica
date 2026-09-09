"use client";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useJornadas } from "@/components/provider";
export default function Landing() {
  const { data } = useJornadas();
  return (
    <div className="landing">
      <img
        className="landing-ornament landing-ornament-left"
        src="/assets/stamps/selo-5.webp"
        alt=""
        aria-hidden="true"
      />
      <img
        className="landing-ornament landing-ornament-right"
        src="/assets/stamps/selo-6.webp"
        alt=""
        aria-hidden="true"
      />
      <header className="landing-top">
        <img
          className="official-logo landing-logo"
          src={
            data?.edition?.logoUrl ||
            "/assets/brand/logo-jornada-2026-trimmed.webp"
          }
          alt="Jornada Farmacêutica — farmácia em movimento"
        />
      </header>
      <main id="main" className="landing-main">
        <div className="landing-kicker">
          <Sparkles size={16} /> CONHECIMENTO · CONEXÕES · FUTURO
        </div>
        <h1>
          Seu passaporte para novos encontros.
          <br />
          <em>Conhecimento que acompanha você.</em>
        </h1>
        <p>
          Consulte a programação, registre suas conquistas e acompanhe cada
          etapa da experiência.
        </p>
        <div className="entry-actions">
          <Link className="button" href="/login/participante">
            <UserRound size={19} /> Participante <ArrowRight size={18} />
          </Link>
          <Link className="button secondary" href="/login/admin">
            <ShieldCheck size={19} /> Administração <ArrowRight size={18} />
          </Link>
        </div>
        {data?.devMode && (
          <div className="dev-note">
            AMBIENTE DE DESENVOLVIMENTO · DADOS FICTÍCIOS
          </div>
        )}
      </main>
      <div className="landing-campus" aria-hidden="true">
        <img src="/assets/brand/cathedral-fachada-trimmed.webp" alt="" />
      </div>
      <footer className="landing-footer">
        {data?.sponsors?.filter((s: any) => s.active).length > 0 && (
          <div className="sponsors">
            <span className="eyebrow">PATROCINADORES</span>
            <div>
              {data.sponsors
                .filter((s: any) => s.active)
                .map((s: any) => (
                  <a
                    key={s.id}
                    href={s.link || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.logoUrl ? <img src={s.logoUrl} alt={s.name} /> : s.name}
                  </a>
                ))}
            </div>
          </div>
        )}
        <div className="footer-line">
          <span>
            Site por <strong>Matheus Feitosa</strong>
          </span>
          <span>Auxílio financeiro: Candido e Heloisa</span>
        </div>
      </footer>
    </div>
  );
}
