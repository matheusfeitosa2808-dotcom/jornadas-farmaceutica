"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useJornadas } from "@/components/provider";

export default function Landing() {
  const { data } = useJornadas();
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
          src="/assets/brand/logo-jornadas.png"
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
            ) : (
              <option value="">Carregando edições…</option>
            )}
          </select>
        </label>
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
              src="/assets/partners/logo-matheus-feitosa.png"
              alt="Matheus Feitosa — designer gráfico"
            />
          </div>
        </article>
        <article className="landing-partner-group landing-supporters">
          <span>APOIADORES</span>
          <div className="landing-partner-logos">
            <img src="/assets/partners/logo-candido.png" alt="Cândido" />
            <img
              src="/assets/partners/logo-heloisa.png"
              alt="HLA Beleza Integrativa"
            />
            <img src="/assets/partners/logo-prosserv.png" alt="Prosserv" />
          </div>
        </article>
      </section>
      <div className="landing-campus" aria-hidden="true">
        <img src="/assets/brand/cathedral-fachada-trimmed.webp" alt="" />
      </div>
      <footer className="landing-footer">
        <span>
          Jornadas · experiências que conectam conhecimento e pessoas.
        </span>
      </footer>
    </div>
  );
}
