"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useJornadas } from "./provider";
export default function Login({ kind }: { kind: "participant" | "admin" }) {
  const router = useRouter();
  const { data } = useJornadas();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function authenticate(
    values: Record<string, FormDataEntryValue | string>,
  ) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...values }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Não foi possível entrar.");
      router.replace(kind === "admin" ? "/admin" : "/app");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await authenticate(Object.fromEntries(new FormData(e.currentTarget)));
  }
  async function enterAsDev() {
    await authenticate(
      kind === "admin"
        ? {
            kind: "admin",
            email: "admin@jornadas.dev",
            password: "Jornada@2026!",
          }
        : {
            kind: "participant",
            editionId: data?.edition?.id || data?.editions?.[0]?.id || "",
            firstName: "Lívia",
            ra: "48884",
          },
    );
  }
  return (
    <main id="main" className={`login-page login-${kind}`}>
      <div className="login-back-wrap">
        <Link className="back-link" href="/">
          <ArrowLeft size={18} /> Voltar ao início
        </Link>
      </div>
      <section className="login-stage">
        <aside className="login-visual">
          <img
            className="login-ornament"
            src="/assets/stamps/selo-5.webp"
            alt=""
            aria-hidden="true"
          />
          <img
            className="login-logo"
            src="/assets/brand/logo-jornada-2026-trimmed.webp"
            alt="Jornada Farmacêutica"
          />
          <div className="login-visual-copy">
            <span>CONHECIMENTO · CONEXÕES · FUTURO</span>
            <h2>
              {kind === "admin"
                ? "Tudo pronto para organizar a Jornada."
                : "Sua jornada começa com um novo encontro."}
            </h2>
            <p>
              {kind === "admin"
                ? "Gerencie atividades, presenças, carimbos e conquistas em um só lugar."
                : "Consulte a programação, acompanhe seus carimbos e descubra novas conquistas."}
            </p>
          </div>
          <img
            className="login-cathedral"
            src="/assets/brand/cathedral-fachada-trimmed.webp"
            alt="Fachada da Faculdade Cathedral"
          />
        </aside>
        <section className="login-panel">
          <div className="login-symbol">
            {kind === "admin" ? <ShieldCheck /> : <UserRound />}
          </div>
          <span className="eyebrow">
            {kind === "admin" ? "ÁREA DA EQUIPE" : "BEM-VINDO À SUA JORNADA"}
          </span>
          <h1>
            {kind === "admin"
              ? "Acesso à administração"
              : "Seu próximo passo começa aqui."}
          </h1>
          <p>
            {kind === "admin"
              ? "Entre com sua conta da organização."
              : "Use o primeiro nome e o RA cadastrados pela organização."}
          </p>
          <form onSubmit={submit} className="stack">
            {kind === "participant" ? (
              <>
                <div className="field">
                  <label htmlFor="participant-edition">Edição</label>
                  <select
                    id="participant-edition"
                    name="editionId"
                    required
                    defaultValue={data?.edition?.id || ""}
                  >
                    {data?.editions?.length ? (
                      data.editions.map((ed: any) => (
                        <option key={ed.id} value={ed.id}>
                          {ed.name}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>
                        Carregando edições…
                      </option>
                    )}
                  </select>
                </div>
                <label className="field">
                  Primeiro nome
                  <input
                    name="firstName"
                    autoComplete="given-name"
                    placeholder="Seu primeiro nome"
                    required
                    autoFocus
                  />
                </label>
                <label className="field">
                  RA
                  <input
                    name="ra"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Seu registro acadêmico"
                    required
                  />
                </label>
              </>
            ) : (
              <>
                <label className="field">
                  E-mail
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="seu.email@exemplo.com"
                    required
                    autoFocus
                  />
                </label>
                <label className="field">
                  Senha
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Sua senha"
                    required
                  />
                </label>
              </>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button full" disabled={busy}>
              {kind === "admin" ? (
                <ShieldCheck size={18} />
              ) : (
                <UserRound size={18} />
              )}
              <span>{busy ? "Entrando…" : "Entrar"}</span>
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="login-help">
            <LockKeyhole size={14} />
            {kind === "participant"
              ? "Acesso exclusivo a participantes cadastrados."
              : "Acesso restrito à equipe autorizada."}
          </p>
          {data?.devMode && (
            <aside className="dev-credentials">
              <strong>ACESSO DE DEMONSTRAÇÃO · DEV</strong>
              <button
                className="dev-access-button"
                type="button"
                onClick={enterAsDev}
                disabled={busy}
              >
                {kind === "admin" ? (
                  <ShieldCheck size={18} />
                ) : (
                  <UserRound size={18} />
                )}
                <span>
                  Acessar como DEV{" "}
                  {kind === "admin" ? "administrador" : "participante"}
                </span>
                <ArrowRight size={17} />
              </button>
            </aside>
          )}
        </section>
      </section>
    </main>
  );
}
