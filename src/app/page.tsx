"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useJornadas } from "@/components/provider";

export default function Landing() {
  const { data, loading, error, refresh } = useJornadas();
  const [editionId, setEditionId] = useState("");
  const selectedEditionId = editionId || data?.edition?.id || "";

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
          className="landing-logo"
          src="/assets/brand/logo-jornadas-optimized.webp"
          alt="Jornadas"
        />
      </header>
      <main id="main" className="landing-main">
        <div className="landing-kicker">
          <Sparkles size={16} /> INICIAR
        </div>
        <h1>
          Encontre sua jornada.
          <em> Viva cada conquista.</em>
        </h1>
        <p>
          Escolha a edição e entre para acompanhar programação, passaporte e
          benefícios.
        </p>
        <label className="landing-edition-picker">
          <span>Edição</span>
          <select
            value={selectedEditionId}
            onChange={(event) => setEditionId(event.target.value)}
            disabled={!data?.editions?.length}
          >
            {data?.editions?.length ? (
              data.editions.map((edition: any) => (
                <option value={edition.id} key={edition.id}>
                  {edition.name}
                </option>
              ))
            ) : loading ? (
              <option value="">Carregando edições…</option>
            ) : (
              <option value="">Nenhuma edição disponível</option>
            )}
          </select>
        </label>
        {!loading && error && (
          <div className="landing-edition-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void refresh()}>
              Tentar novamente
            </button>
          </div>
        )}
        <div className="entry-actions">
          <Link className="button" href="/login/participante">
            <UserRound size={19} /> Participante <ArrowRight size={18} />
          </Link>
          <Link className="button secondary" href="/login/admin">
            <ShieldCheck size={19} /> Administração <ArrowRight size={18} />
          </Link>
        </div>
      </main>
      <section className="landing-partners" aria-label="Criação e apoiadores">
        <article className="landing-partner-group landing-created-by">
          <span>CRIADO POR</span>
          <div className="landing-partner-logos">
            <img
              src="/assets/partners/logo-matheus-feitosa-optimized.webp"
              alt="Matheus Feitosa — designer gráfico"
              loading="lazy"
              decoding="async"
            />
          </div>
        </article>
        <article className="landing-partner-group landing-supporters">
          <span>APOIADORES</span>
          <div className="landing-partner-logos">
            <img
              src="/assets/partners/logo-candido-optimized.webp"
              alt="Cândido"
              loading="lazy"
              decoding="async"
            />
            <img
              src="/assets/partners/logo-heloisa-optimized.webp"
              alt="HLA Beleza Integrativa"
              loading="lazy"
              decoding="async"
            />
            <img
              src="/assets/partners/logo-prosserv-optimized.webp"
              alt="Prosserv"
              loading="lazy"
              decoding="async"
            />
            <img
              className="landing-partner-logo--on-ok"
              src="/assets/partners/logo-on-ok-optimized.webp"
              alt="On Ok Marketing e Vendas"
              loading="lazy"
              decoding="async"
            />
            <img
              className="landing-partner-logo--blue"
              src="/assets/partners/logo-blue-uniformes-optimized.webp"
              alt="Blue Uniformes Profissionais"
              loading="lazy"
              decoding="async"
            />
            <img
              className="landing-partner-logo--lady9"
              src="/assets/partners/logo-lady9-confeccoes-optimized.webp"
              alt="Lady9 Confecções"
              loading="lazy"
              decoding="async"
            />
          </div>
        </article>
      </section>
      <div className="landing-campus" aria-hidden="true">
        <img
          src="/assets/brand/cathedral-fachada-trimmed-optimized.webp"
          alt=""
          loading="lazy"
          decoding="async"
        />
      </div>
      <footer className="landing-footer">
        <span>
          Jornadas · experiências que conectam conhecimento e pessoas.
        </span>
      </footer>
    </div>
  );
}
