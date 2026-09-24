"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  Flame,
  ListChecks,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Send,
  Settings2,
  ShoppingBag,
  SkipForward,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { useJornadas } from "@/components/provider";
import FarmaArenaStamp from "@/components/farma-arena-stamp";
import { readApiResponse } from "@/lib/api-response";
import "./admin.css";

const tabs = [
  ["configuracao", "Configuração", Settings2],
  ["desafios", "Desafios", ListChecks],
  ["validacao", "Validar resultados", CheckCircle2],
  ["liberacao", "Liberar XP", Zap],
  ["ranking", "Ranking", Trophy],
  ["beneficios", "Pontos em disciplina", BookOpen],
  ["ajustes", "Ajustar XP", Settings2],
  ["loja", "Loja e brindes", ShoppingBag],
] as const;

function Input({ label, ...props }: any) {
  return (
    <label className="arena-admin-field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

export function FarmaArenaAdmin() {
  const { data, action } = useJornadas();
  const [tab, setTab] = useState("desafios");
  const [arena, setArena] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [loadingView, setLoadingView] = useState(false);
  const requestRef = useRef(0);
  const activeEditionId = data?.edition?.id;
  const load = useCallback(
    async (view: string) => {
      if (!activeEditionId) return;
      const requestId = ++requestRef.current;
      setLoadingView(true);
      try {
        const response = await fetch(
          `/api/arena?scope=admin&view=${encodeURIComponent(view)}&editionId=${encodeURIComponent(activeEditionId)}`,
          { cache: "no-store" },
        );
        const next = await readApiResponse<any>(
          response,
          "Não foi possível carregar a Farma Arena.",
        );
        if (requestId !== requestRef.current) return;
        setArena((current: any) => (current ? { ...current, ...next } : next));
      } finally {
        if (requestId === requestRef.current) setLoadingView(false);
      }
    },
    [activeEditionId],
  );
  useEffect(() => {
    void load(tab);
  }, [load, tab]);
  const run = useCallback(
    async (name: string, payload?: any) => {
      setBusy(true);
      try {
        // Este módulo atualiza apenas o payload específico da Arena. Evita a
        // segunda recarga, muito maior, de todo o estado administrativo.
        const result = await action(name, payload, { refresh: false });
        await load(tab);
        return result;
      } finally {
        setBusy(false);
      }
    },
    [action, load, tab],
  );
  if (!arena)
    return (
      <div className="arena-admin-loading">
        <FarmaArenaStamp />
        <span>Preparando a central da Arena…</span>
      </div>
    );
  return (
    <div className="arena-admin">
      <header className="arena-admin-hero">
        <div>
          <span>
            <Flame /> FARMA ARENA
          </span>
          <h1>Central de competição</h1>
          <p>
            Crie desafios, valide resultados, libere XP e acompanhe a
            classificação.
          </p>
        </div>
        <FarmaArenaStamp />
      </header>
      <nav className="arena-admin-tabs" aria-label="Áreas da Farma Arena">
        {tabs.map(([key, label, Icon]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>
      {loadingView && arena && (
        <div className="arena-admin-view-loading" role="status">
          Atualizando esta área…
        </div>
      )}
      {tab === "desafios" && <Challenges arena={arena} run={run} busy={busy} />}
      {tab === "configuracao" && (
        <Configuration arena={arena} run={run} busy={busy} />
      )}
      {tab === "validacao" && (
        <Validation
          arena={arena}
          participants={data.participants || []}
          run={run}
          busy={busy}
        />
      )}
      {tab === "liberacao" && <Release arena={arena} run={run} busy={busy} />}
      {tab === "ranking" && <Ranking arena={arena} />}
      {tab === "beneficios" && <Benefits arena={arena} />}
      {tab === "ajustes" && (
        <Adjustment
          participants={data.participants || []}
          run={run}
          busy={busy}
        />
      )}
      {tab === "loja" && <Store arena={arena} />}
    </div>
  );
}

function Configuration({ arena, run, busy }: any) {
  const config = arena.config || {};
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run("entity.save", {
      entity: "arenaConfig",
      data: {
        enabled: form.get("enabled") === "on",
        rankingEnabled: form.get("rankingEnabled") === "on",
        xpReleaseMode: form.get("xpReleaseMode"),
        xpReleaseDelaySeconds: Number(form.get("xpReleaseDelaySeconds")),
        firstPlaceTitle: form.get("firstPlaceTitle"),
        secondPlaceTitle: form.get("secondPlaceTitle"),
        thirdPlaceTitle: form.get("thirdPlaceTitle"),
        combinePendingAwards: form.get("combinePendingAwards") === "on",
      },
    });
  };
  return (
    <section className="arena-admin-panel">
      <div className="arena-admin-title">
        <div>
          <span>REGRAS GERAIS</span>
          <h2>Configuração da Arena</h2>
          <p>
            Controle a exibição, a classificação e o momento de liberação do XP.
          </p>
        </div>
      </div>
      <form className="arena-admin-form-grid" onSubmit={save}>
        <label className="arena-admin-check">
          <input
            name="enabled"
            type="checkbox"
            defaultChecked={config.enabled}
          />{" "}
          Farma Arena ativa
        </label>
        <label className="arena-admin-check">
          <input
            name="rankingEnabled"
            type="checkbox"
            defaultChecked={config.rankingEnabled}
          />{" "}
          Ranking visível
        </label>
        <label className="arena-admin-field">
          <span>Liberação do XP</span>
          <select name="xpReleaseMode" defaultValue={config.xpReleaseMode}>
            <option value="MANUAL">Manual pela comissão</option>
            <option value="IMMEDIATE">Imediata após validação</option>
            <option value="SCHEDULED">Programada após validação</option>
          </select>
        </label>
        <Input
          name="xpReleaseDelaySeconds"
          label="Atraso programado (segundos)"
          type="number"
          min="0"
          defaultValue={config.xpReleaseDelaySeconds}
        />
        <Input
          name="firstPlaceTitle"
          label="Título do 1º lugar"
          defaultValue={config.firstPlaceTitle}
        />
        <Input
          name="secondPlaceTitle"
          label="Título do 2º lugar"
          defaultValue={config.secondPlaceTitle}
        />
        <Input
          name="thirdPlaceTitle"
          label="Título do 3º lugar"
          defaultValue={config.thirdPlaceTitle}
        />
        <label className="arena-admin-check">
          <input
            name="combinePendingAwards"
            type="checkbox"
            defaultChecked={config.combinePendingAwards}
          />{" "}
          Agrupar animações pendentes
        </label>
        <div>
          <button className="button" disabled={busy}>
            <Save /> Salvar configuração
          </button>
        </div>
      </form>
    </section>
  );
}

function Challenges({ arena, run, busy }: any) {
  const empty = {
    title: "",
    description: "",
    instructions: "",
    category: "CONHECIMENTO",
    mode: "INDIVIDUAL",
    xpReward: 100,
    minTeamSize: 2,
    maxTeamSize: 5,
    repeatable: false,
    maxCompletionsPerParticipant: 1,
    order: 0,
    active: true,
  };
  const [editing, setEditing] = useState<any>(null);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = {
      ...editing,
      title: form.get("title"),
      description: form.get("description"),
      instructions: form.get("instructions"),
      category: form.get("category"),
      mode: form.get("mode"),
      xpReward: Number(form.get("xpReward")),
      minTeamSize: Number(form.get("minTeamSize")),
      maxTeamSize: Number(form.get("maxTeamSize")),
      repeatable: form.get("repeatable") === "on",
      maxCompletionsPerParticipant: Number(
        form.get("maxCompletionsPerParticipant"),
      ),
      order: Number(form.get("order")),
      active: form.get("active") === "on",
    };
    await run("entity.save", { entity: "arenaChallenge", data: value });
    setEditing(null);
  };
  return (
    <section className="arena-admin-panel">
      <div className="arena-admin-title">
        <div>
          <span>CATÁLOGO</span>
          <h2>Desafios da edição</h2>
        </div>
        <button className="button" onClick={() => setEditing(empty)}>
          <Plus /> Novo desafio
        </button>
      </div>
      <div className="arena-admin-cards">
        {(arena.challenges || []).map((item: any) => (
          <article key={item.id} className={!item.active ? "inactive" : ""}>
            <span>{item.category}</span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <footer>
              <b>+{item.xpReward} XP</b>
              <small>{item.mode === "TEAM" ? "Equipe" : "Individual"}</small>
              <button onClick={() => setEditing(item)}>Editar</button>
            </footer>
          </article>
        ))}
      </div>
      {editing && (
        <div className="arena-admin-modal" role="dialog" aria-modal="true">
          <form onSubmit={save}>
            <div className="arena-admin-title">
              <h2>{editing.id ? "Editar desafio" : "Novo desafio"}</h2>
              <button type="button" onClick={() => setEditing(null)}>
                Fechar
              </button>
            </div>
            <div className="arena-admin-form-grid">
              <Input
                name="title"
                label="Título"
                defaultValue={editing.title}
                required
              />
              <Input
                name="xpReward"
                label="XP concedido"
                type="number"
                min="1"
                defaultValue={editing.xpReward}
                required
              />
              <label className="arena-admin-field">
                <span>Categoria</span>
                <select name="category" defaultValue={editing.category}>
                  <option>CONHECIMENTO</option>
                  <option>PRÁTICA</option>
                  <option>CRIATIVIDADE</option>
                  <option>ESTRATÉGIA</option>
                  <option>INTEGRAÇÃO</option>
                </select>
              </label>
              <label className="arena-admin-field">
                <span>Modalidade</span>
                <select name="mode" defaultValue={editing.mode}>
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="TEAM">Equipe</option>
                </select>
              </label>
              <label className="arena-admin-field wide">
                <span>Descrição</span>
                <textarea
                  name="description"
                  defaultValue={editing.description}
                  required
                />
              </label>
              <label className="arena-admin-field wide">
                <span>Instruções</span>
                <textarea
                  name="instructions"
                  defaultValue={editing.instructions}
                />
              </label>
              <Input
                name="minTeamSize"
                label="Mínimo na equipe"
                type="number"
                min="1"
                defaultValue={editing.minTeamSize}
              />
              <Input
                name="maxTeamSize"
                label="Máximo na equipe"
                type="number"
                min="1"
                defaultValue={editing.maxTeamSize}
              />
              <Input
                name="maxCompletionsPerParticipant"
                label="Limite de conclusões"
                type="number"
                min="1"
                defaultValue={editing.maxCompletionsPerParticipant}
              />
              <Input
                name="order"
                label="Ordem"
                type="number"
                defaultValue={editing.order}
              />
              <label className="arena-admin-check">
                <input
                  name="repeatable"
                  type="checkbox"
                  defaultChecked={editing.repeatable}
                />{" "}
                Pode repetir
              </label>
              <label className="arena-admin-check">
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={editing.active}
                />{" "}
                Desafio ativo
              </label>
            </div>
            <footer>
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <button className="button" disabled={busy}>
                <Save /> Salvar desafio
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}

function Validation({ arena, participants, run, busy }: any) {
  const [challengeId, setChallengeId] = useState(
    arena.challenges?.[0]?.id || "",
  );
  const [ras, setRas] = useState("");
  const challenge = arena.challenges.find((x: any) => x.id === challengeId);
  const [validationMode, setValidationMode] = useState<"individual" | "team">(
    "individual",
  );
  const isTeamBatch = challenge?.mode === "TEAM" && validationMode === "team";
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const list = ras.split(/[\s,;]+/).filter(Boolean);
    await run(
      isTeamBatch ? "arena.challenge.completeTeam" : "arena.challenge.complete",
      isTeamBatch ? { challengeId, ras: list } : { challengeId, ra: list[0] },
    );
    setRas("");
  };
  const typed = ras.split(/[\s,;]+/).filter(Boolean);
  const identified = typed
    .map((ra: string) => participants.find((p: any) => p.ra === ra))
    .filter(Boolean);
  return (
    <section className="arena-admin-panel">
      <div className="arena-admin-title">
        <div>
          <span>OPERAÇÃO</span>
          <h2>Validar resultado</h2>
        </div>
      </div>
      <form className="arena-validation" onSubmit={submit}>
        <label className="arena-admin-field">
          <span>Desafio</span>
          <select
            value={challengeId}
            onChange={(e) => setChallengeId(e.target.value)}
          >
            {arena.challenges
              .filter((x: any) => x.active)
              .map((x: any) => (
                <option value={x.id} key={x.id}>
                  {x.title} · {x.xpReward} XP
                </option>
              ))}
          </select>
        </label>
        {challenge?.mode === "TEAM" && (
          <div
            className="arena-validation-mode"
            role="group"
            aria-label="Forma de validação"
          >
            <button
              type="button"
              className={validationMode === "individual" ? "active" : ""}
              onClick={() => {
                setValidationMode("individual");
                setRas("");
              }}
            >
              Individual
            </button>
            <button
              type="button"
              className={validationMode === "team" ? "active" : ""}
              onClick={() => {
                setValidationMode("team");
                setRas("");
              }}
            >
              Equipe completa
            </button>
            <small>
              Individual libera o XP para uma pessoa sem exigir a formação do
              grupo.
            </small>
          </div>
        )}
        <label className="arena-admin-field wide">
          <span>
            {isTeamBatch
              ? "RAs da equipe (separados por vírgula)"
              : "RA do participante"}
          </span>
          <textarea
            value={ras}
            onChange={(e) => setRas(e.target.value)}
            placeholder={isTeamBatch ? "48884, 48885, 48886" : "48884"}
            required
          />
        </label>
        {typed.length > 0 && (
          <div className="arena-admin-identities">
            {identified.map((p: any) => (
              <span key={p.id}>
                <b>{p.name}</b>
                <small>
                  RA {p.ra} · {p.semester}º semestre
                </small>
              </span>
            ))}
            {identified.length !== typed.length && (
              <em>Há RA ainda não identificado.</em>
            )}
          </div>
        )}
        <button
          className="button"
          disabled={
            busy ||
            !challengeId ||
            identified.length !== typed.length ||
            (!isTeamBatch && typed.length !== 1)
          }
        >
          <CheckCircle2 /> Confirmar resultado · +{challenge?.xpReward || 0} XP
        </button>
      </form>
      <div className="arena-admin-log">
        <h3>Últimas validações</h3>
        {arena.completions.slice(0, 12).map((x: any) => (
          <article key={x.id}>
            <CheckCircle2 />
            <div>
              <strong>
                {
                  arena.challenges.find((c: any) => c.id === x.challengeId)
                    ?.title
                }
              </strong>
              <small>{new Date(x.completedAt).toLocaleString("pt-BR")}</small>
            </div>
            <b>+{x.xpAwarded} XP</b>
          </article>
        ))}
      </div>
    </section>
  );
}

function Release({ arena, run, busy }: any) {
  const pending = arena.awards.filter((x: any) => x.status === "PENDING");
  const scheduled = pending.filter(
    (x: any) => x.releaseMode === "SCHEDULED" && x.releaseAt,
  );
  const waiting = pending.filter(
    (x: any) => x.releaseMode !== "SCHEDULED" || !x.releaseAt,
  );
  const [selected, setSelected] = useState<string[]>([]);
  const recent = arena.awards
    .filter((x: any) => x.status === "RELEASED")
    .slice(0, 8);
  const release = (ids: string[]) =>
    run("arena.award.releaseBatch", { awardIds: ids }).then(() =>
      setSelected([]),
    );
  return (
    <section className="arena-admin-panel">
      <div className="arena-admin-title">
        <div>
          <span>CONTROLE DE PONTUAÇÃO</span>
          <h2>Liberação de XP</h2>
          <p>
            {waiting.length} aguardando · {scheduled.length} agendadas.
          </p>
        </div>
        <div className="arena-admin-release-actions">
          <button
            className="secondary"
            disabled={busy || !pending.length}
            onClick={() =>
              window.confirm(
                `Liberar ${pending.length} prêmio(s) pendente(s)?`,
              ) && release(pending.map((x: any) => x.id))
            }
          >
            Liberar todos
          </button>
          <button
            className="button"
            disabled={busy || !selected.length}
            onClick={() => release(selected)}
          >
            <Send /> Liberar selecionados
          </button>
        </div>
      </div>
      <div className="arena-admin-table">
        <div className="head">
          <span></span>
          <span>Participante</span>
          <span>Desafio</span>
          <span>XP</span>
          <span>Ações</span>
        </div>
        {waiting.map((x: any) => (
          <div className="award-row" key={x.id}>
            <input
              type="checkbox"
              checked={selected.includes(x.id)}
              onChange={(e) =>
                setSelected((v) =>
                  e.target.checked
                    ? [...v, x.id]
                    : v.filter((id) => id !== x.id),
                )
              }
            />
            <span className="award-identity">
              {x.participant?.photoUrl ? (
                <img src={x.participant.photoUrl} alt="" />
              ) : (
                <i>{String(x.participant?.name || "P").charAt(0)}</i>
              )}
              <span>
                <b>{x.participant?.name || x.participantId}</b>
                <small>
                  RA {x.participant?.ra || "—"} ·{" "}
                  {x.participant?.semester || "—"}º semestre
                </small>
                <small>
                  {new Date(x.validatedAt || x.createdAt).toLocaleString(
                    "pt-BR",
                  )}{" "}
                  · {x.validatedByName}
                </small>
              </span>
            </span>
            <span>
              {arena.challenges.find((c: any) => c.id === x.challengeId)?.title}
            </span>
            <b>+{x.amount}</b>
            <span className="row-buttons">
              <button onClick={() => release([x.id])}>Liberar</button>
              <button
                onClick={() => {
                  const at = window.prompt(
                    "Data/hora ISO para liberação:",
                    new Date(Date.now() + 3600000).toISOString(),
                  );
                  if (at)
                    run("arena.award.schedule", {
                      awardId: x.id,
                      releaseAt: at,
                    });
                }}
              >
                Agendar
              </button>
              <button
                onClick={() => {
                  const reason = window.prompt("Motivo do cancelamento:");
                  if (reason)
                    run("arena.award.cancel", { awardId: x.id, reason });
                }}
              >
                Cancelar
              </button>
            </span>
          </div>
        ))}
      </div>
      {!waiting.length && (
        <div className="arena-admin-empty">
          <CheckCircle2 /> Nenhum XP pendente de liberação.
        </div>
      )}
      <div className="arena-admin-log">
        <h3>Agendados</h3>
        {scheduled.length ? (
          scheduled.map((x: any) => (
            <article key={x.id}>
              <Clock3 />
              <div>
                <strong>{x.participant?.name}</strong>
                <small>
                  {
                    arena.challenges.find((c: any) => c.id === x.challengeId)
                      ?.title
                  }{" "}
                  · {new Date(x.releaseAt).toLocaleString("pt-BR")}
                </small>
              </div>
              <span className="row-buttons">
                <button onClick={() => release([x.id])}>Liberar agora</button>
                <button
                  onClick={() =>
                    run("arena.award.cancel", {
                      awardId: x.id,
                      reason: "Agendamento cancelado pela organização",
                    })
                  }
                >
                  Cancelar
                </button>
              </span>
            </article>
          ))
        ) : (
          <p className="arena-admin-muted">Nenhuma liberação agendada.</p>
        )}
      </div>
      <div className="arena-admin-log">
        <h3>Liberados recentemente</h3>
        {recent.map((x: any) => (
          <article key={x.id}>
            <CheckCircle2 />
            <div>
              <strong>{x.participant?.name}</strong>
              <small>
                {
                  arena.challenges.find((c: any) => c.id === x.challengeId)
                    ?.title
                }{" "}
                · {new Date(x.releasedAt).toLocaleString("pt-BR")}
              </small>
            </div>
            <b>+{x.amount} XP</b>
          </article>
        ))}
      </div>
    </section>
  );
}

function Ranking({ arena }: any) {
  const [presenting, setPresenting] = useState(false);
  return (
    <section className="arena-admin-panel">
      <div className="arena-admin-title">
        <div>
          <span>CLASSIFICAÇÃO</span>
          <h2>Ranking completo</h2>
          <p>O RA nunca é exibido na experiência do participante.</p>
        </div>
        <button
          className="button arena-ranking-present-button"
          onClick={() => setPresenting(true)}
          disabled={!arena.ranking?.length}
        >
          <Play /> Apresentar ranking
        </button>
      </div>
      <div className="arena-admin-ranking">
        {arena.ranking.map((x: any) => (
          <article key={x.participantId}>
            <b>#{x.rank}</b>
            <span>{x.displayName}</span>
            <small>{x.title}</small>
            <strong>{x.xpTotal} XP</strong>
          </article>
        ))}
      </div>
      {presenting && (
        <RankingReveal
          ranking={arena.ranking || []}
          onClose={() => setPresenting(false)}
        />
      )}
    </section>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

function RankingReveal({ ranking, onClose }: any) {
  const rows = [...ranking].reverse();
  const reducedMotion = useReducedMotion();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const audioRef = useRef<{
    context: AudioContext;
    timer: ReturnType<typeof setInterval>;
    drone: OscillatorNode;
  } | null>(null);
  const active = rows[current] || rows[0];

  useEffect(() => {
    if (reducedMotion) {
      setCurrent(Math.max(0, rows.length - 1));
      setFinished(true);
      return;
    }
    if (paused || finished || !rows.length) return;
    const rank = Number(rows[current]?.rank || rows.length);
    const delay = rank <= 3 ? 1450 : rank <= 10 ? 720 : 300;
    const timer = window.setTimeout(() => {
      if (current >= rows.length - 1) setFinished(true);
      else setCurrent((value) => value + 1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [current, finished, paused, reducedMotion, rows.length]);

  useEffect(() => {
    if (reducedMotion || !rows.length) return;
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    const drone = context.createOscillator();
    master.gain.value = 0.025;
    filter.type = "lowpass";
    filter.frequency.value = 420;
    drone.type = "triangle";
    drone.frequency.value = 55;
    drone.connect(filter).connect(master).connect(context.destination);
    drone.start();
    let step = 0;
    const notes = [82.41, 92.5, 98, 110];
    const timer = setInterval(() => {
      if (context.state !== "running") return;
      const now = context.currentTime;
      const pulse = context.createOscillator();
      const gain = context.createGain();
      pulse.type = "sine";
      pulse.frequency.setValueAtTime(notes[step % notes.length], now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
      pulse.connect(gain).connect(master);
      pulse.start(now);
      pulse.stop(now + 0.19);
      step += 1;
    }, 520);
    audioRef.current = { context, timer, drone };
    return () => {
      clearInterval(timer);
      drone.stop();
      void context.close();
      audioRef.current = null;
    };
  }, [reducedMotion, rows.length]);

  useEffect(() => {
    const context = audioRef.current?.context;
    if (!context) return;
    if (paused) void context.suspend();
    else void context.resume();
  }, [paused]);

  const skipToTop = () => {
    setCurrent(Math.max(0, rows.length - 1));
    setFinished(true);
  };

  return (
    <div className="arena-ranking-reveal" role="dialog" aria-modal="true">
      <div
        className="arena-ranking-reveal__constellations"
        aria-hidden="true"
      />
      <header>
        <span>FARMA ARENA · CLASSIFICAÇÃO AO VIVO</span>
        <button onClick={onClose} aria-label="Fechar apresentação">
          <X />
        </button>
      </header>
      <main>
        <div className="arena-ranking-reveal__eyebrow">SUBINDO ATÉ O TOPO</div>
        <div className="arena-ranking-reveal__viewport">
          <div
            className="arena-ranking-reveal__track"
            style={{ transform: `translate3d(0, ${152 - current * 76}px, 0)` }}
          >
            {rows.map((row: any, index: number) => (
              <article
                key={row.participantId}
                className={index === current ? "active" : ""}
              >
                <b>#{row.rank}</b>
                <span>{row.displayName}</span>
                <strong>{row.xpTotal} XP</strong>
              </article>
            ))}
          </div>
        </div>
        {active && (
          <div
            className={`arena-ranking-reveal__focus ${finished ? "winner" : ""}`}
          >
            <small>{finished ? "TOPO DO RANKING" : "POSIÇÃO ATUAL"}</small>
            <b>#{active.rank}</b>
            <h2>{active.displayName}</h2>
            <strong>{active.xpTotal} XP</strong>
          </div>
        )}
      </main>
      <footer>
        <div className="arena-ranking-reveal__progress">
          <i
            style={{
              transform: `scaleX(${rows.length ? (current + 1) / rows.length : 0})`,
            }}
          />
        </div>
        <button
          onClick={() => setPaused((value) => !value)}
          disabled={finished}
        >
          {paused ? <Play /> : <Pause />}
          {paused ? "Continuar" : "Pausar"}
        </button>
        <button onClick={skipToTop} disabled={finished}>
          <SkipForward /> Ir ao topo
        </button>
      </footer>
    </div>
  );
}

function Benefits({ arena }: any) {
  const choices = arena.creditChoices || [];
  return (
    <section className="arena-admin-panel">
      <div className="arena-admin-title">
        <div>
          <span>BENEFÍCIO DO DESAFIO</span>
          <h2>Pontos em disciplina</h2>
          <p>
            Cada participante pode enviar uma única disciplina após concluir o
            desafio Convite de egressos.
          </p>
        </div>
      </div>
      {choices.length ? (
        <div className="arena-admin-benefits">
          {choices.map((choice: any) => (
            <article key={choice.id}>
              <div>
                <strong>{choice.participant?.name}</strong>
                <small>RA {choice.participant?.ra}</small>
              </div>
              <span>{choice.discipline}</span>
              <time>{new Date(choice.createdAt).toLocaleString("pt-BR")}</time>
            </article>
          ))}
        </div>
      ) : (
        <div className="arena-admin-empty">
          <BookOpen />
          Nenhuma disciplina enviada até agora.
        </div>
      )}
    </section>
  );
}

function Adjustment({ participants, run, busy }: any) {
  const [participantId, setParticipantId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  return (
    <section className="arena-admin-panel">
      <div className="arena-admin-title">
        <div>
          <span>AUDITÁVEL</span>
          <h2>Ajuste manual de XP</h2>
          <p>Todo ajuste exige justificativa e entra no histórico.</p>
        </div>
      </div>
      <form
        className="arena-validation"
        onSubmit={async (e) => {
          e.preventDefault();
          await run("arena.xp.adjust", {
            participantId,
            amount: Number(amount),
            reason,
          });
          setAmount("");
          setReason("");
        }}
      >
        <label className="arena-admin-field">
          <span>Participante</span>
          <select
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
            required
          >
            <option value="">Selecione</option>
            {participants.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name} · RA {p.ra}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Quantidade de XP (+ ou −)"
          type="number"
          value={amount}
          onChange={(e: any) => setAmount(e.target.value)}
          required
        />
        <label className="arena-admin-field wide">
          <span>Justificativa</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={5}
            required
          />
        </label>
        <button className="button" disabled={busy}>
          <RotateCcw /> Registrar ajuste
        </button>
      </form>
    </section>
  );
}

function Store({ arena }: any) {
  return (
    <section className="arena-admin-panel">
      <div className="arena-admin-title">
        <div>
          <span>CATÁLOGO UNIFICADO</span>
          <h2>Loja da Jornada</h2>
          <p>
            Brindes por carimbo e itens por XP compartilham o mesmo estoque e a
            mesma retirada.
          </p>
        </div>
        <Link className="button" href="/admin/brindes">
          <Plus /> Gerenciar itens
        </Link>
      </div>
      <div className="arena-admin-cards">
        {arena.rewards.map((x: any) => (
          <article key={x.id}>
            {x.imageUrl && <img src={x.imageUrl} alt="" />}
            <span>RESGATE COM XP</span>
            <h3>{x.name}</h3>
            <p>{x.description}</p>
            <footer>
              <b>{x.xpCost} XP</b>
              <small>{x.stockAvailable ?? x.total} disponíveis</small>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
