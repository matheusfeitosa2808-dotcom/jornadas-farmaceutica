"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useJornadas } from "@/components/provider";
export default function Landing() {
  const { data } = useJornadas();
  const router = useRouter();
  const [editionId, setEditionId] = useState("");
  const [busy, setBusy] = useState<"participant" | "admin" | "">("");
  const [error, setError] = useState("");
  const selectedEditionId = editionId || data?.edition?.id || "";

  async function enterTest(kind: "participant" | "admin") {
    setBusy(kind);
    setError("");
    try {
      const credentials =
        kind === "admin"
          ? {
              kind,
              email: "admin@jornadas.dev",
              password: "Jornada@2026!",
            }
          : {
              kind,
              editionId: selectedEditionId,
              firstName: "Lívia",
              ra: "48884",
            };
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Não foi possível abrir o teste.");
      router.push(kind === "admin" ? "/admin" : "/app");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Não foi possível entrar.",
      );
      setBusy("");
    }
  }
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
        {data?.devMode && (
          <section className="landing-test-access">
            <span>TESTE RÁPIDO · DADOS FICTÍCIOS</span>
            <div>
              <button
                type="button"
                onClick={() => enterTest("participant")}
                disabled={Boolean(busy) || !selectedEditionId}
              >
                <UserRound size={16} />
                {busy === "participant"
                  ? "Abrindo…"
                  : "Testar como participante"}
              </button>
              <button
                type="button"
                onClick={() => enterTest("admin")}
                disabled={Boolean(busy)}
              >
                <ShieldCheck size={16} />
                {busy === "admin" ? "Abrindo…" : "Testar administração"}
              </button>
            </div>
          </section>
        )}
        {error && <p className="landing-error">{error}</p>}
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
