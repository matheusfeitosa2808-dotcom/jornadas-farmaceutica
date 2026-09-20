"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Gift,
  Medal,
  ShoppingBag,
  Sparkles,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useJornadas } from "@/components/provider";
import FarmaArenaStamp from "@/components/farma-arena-stamp";
import { readApiResponse } from "@/lib/api-response";
import "./arena.css";

function useArena() {
  const { data, action } = useJornadas();
  const [arena, setArena] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    // serverNow muda quando o Provider recebe um evento SSE e invalida esta consulta.
    void data?.serverNow;
    if (!data?.edition?.id || data?.actor?.type !== "participant") return;
    try {
      const response = await fetch(
        `/api/arena?editionId=${encodeURIComponent(data.edition.id)}`,
        { cache: "no-store" },
      );
      setArena(
        await readApiResponse<any>(
          response,
          "Não foi possível carregar a Arena.",
        ),
      );
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }, [data?.actor?.type, data?.edition?.id, data?.serverNow]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);
  const run = useCallback(
    async (name: string, payload?: any) => {
      const result = await action(name, payload);
      await load();
      return result;
    },
    [action, load],
  );
  return { arena, loading, error, load, run };
}

export function ArenaTransitionLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  return (
    <>
      <Link
        href={href}
        className={className}
        onClick={(event) => {
          event.preventDefault();
          const reduced = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;
          setActive(true);
          window.setTimeout(() => router.push(href), reduced ? 80 : 620);
        }}
      >
        {children}
      </Link>
      {active && (
        <div
          className="arena-transition"
          role="status"
          aria-label="Entrando na Farma Arena"
        >
          <div className="arena-transition__ember" />
          <FarmaArenaStamp className="arena-transition__stamp" />
          <strong>Entrando na Arena</strong>
        </div>
      )}
    </>
  );
}

function ArenaHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="arena-page-heading">
      {eyebrow && <span>{eyebrow}</span>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: ReactNode;
}) {
  return (
    <article className="arena-stat">
      <Icon aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function LoadingArena() {
  return (
    <div className="arena-loading">
      <FarmaArenaStamp />
      <span>Preparando a Arena…</span>
    </div>
  );
}

export function ArenaRouter({ page, id }: { page: string; id?: string }) {
  const state = useArena();
  if (state.loading && !state.arena) return <LoadingArena />;
  if (state.error && !state.arena)
    return (
      <div className="arena-error">
        <p>{state.error}</p>
        <button onClick={state.load}>Tentar novamente</button>
      </div>
    );
  if (!state.arena?.config?.enabled)
    return (
      <div className="arena-error">
        <FarmaArenaStamp />
        <h2>A Arena está se preparando</h2>
        <p>A organização avisará quando os desafios forem liberados.</p>
        <Link href="/app">Voltar ao início</Link>
      </div>
    );
  if (page === "ranking") return <ArenaRanking arena={state.arena} />;
  if (page === "desafios" && id)
    return <ArenaChallengeDetail arena={state.arena} id={id} />;
  if (page === "desafios") return <ArenaChallenges arena={state.arena} />;
  if (page === "desempenho") return <ArenaPerformance arena={state.arena} />;
  if (page === "loja")
    return <ArenaStore arena={state.arena} run={state.run} />;
  return <ArenaHome arena={state.arena} />;
}

function ArenaHome({ arena }: { arena: any }) {
  const nextChallenges = (arena.challenges || []).slice(0, 3);
  return (
    <div className="arena-surface">
      <section className="arena-hero">
        <div>
          <span className="arena-kicker">
            <Flame /> FARMA ARENA
          </span>
          <h1>Desafios que transformam conhecimento em conquista.</h1>
          <p>
            Participe com a equipe, acumule XP e acompanhe sua evolução em tempo
            real.
          </p>
        </div>
        <FarmaArenaStamp className="arena-hero__stamp" />
      </section>
      <div className="arena-stats">
        <Stat icon={Zap} label="XP total" value={arena.myXpTotal} />
        <Stat
          icon={ShoppingBag}
          label="XP disponível"
          value={arena.myXpAvailable}
        />
        <Stat
          icon={Trophy}
          label="Posição"
          value={arena.myRank ? `#${arena.myRank}` : "—"}
        />
        <Stat
          icon={CheckCircle2}
          label="Desafios"
          value={arena.completedChallenges}
        />
      </div>
      <div className="arena-actions">
        <Link href="/app/arena/desafios">
          <Sparkles /> Desafios <ChevronRight />
        </Link>
        <Link href="/app/ranking">
          <Trophy /> Ranking <ChevronRight />
        </Link>
        <Link href="/app/arena/loja">
          <Gift /> Loja XP <ChevronRight />
        </Link>
        <Link href="/app/arena/desempenho">
          <Medal /> Desempenho <ChevronRight />
        </Link>
      </div>
      <section className="arena-section">
        <div className="arena-section__title">
          <div>
            <span>EM DESTAQUE</span>
            <h2>Próximos desafios</h2>
          </div>
          <Link href="/app/arena/desafios">Ver todos</Link>
        </div>
        <div className="arena-challenge-grid compact">
          {nextChallenges.map((challenge: any) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              arena={arena}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ChallengeCard({ challenge, arena }: { challenge: any; arena: any }) {
  const done = (arena.completions || []).some(
    (item: any) => item.challengeId === challenge.id && item.status === "VALID",
  );
  return (
    <Link
      href={`/app/arena/desafios/${challenge.id}`}
      className="arena-challenge-card"
    >
      <span className="arena-challenge-card__icon">
        {challenge.iconUrl ? (
          <img src={challenge.iconUrl} alt="" />
        ) : (
          <Sparkles />
        )}
      </span>
      <span className="arena-challenge-card__category">
        {challenge.category}
      </span>
      <h3>{challenge.title}</h3>
      <p>{challenge.description}</p>
      <footer>
        <strong>+{challenge.xpReward} XP</strong>
        <span>
          {challenge.mode === "TEAM" ? (
            <>
              <Users /> Equipe
            </>
          ) : done ? (
            <>
              <CheckCircle2 /> Concluído
            </>
          ) : (
            "Individual"
          )}
        </span>
      </footer>
    </Link>
  );
}

function ArenaChallenges({ arena }: { arena: any }) {
  const [filter, setFilter] = useState("TODOS");
  const filters = ["TODOS", "CONHECIMENTO", "PRÁTICA", "EQUIPE"];
  const challenges = (arena.challenges || []).filter((challenge: any) =>
    filter === "TODOS"
      ? true
      : filter === "EQUIPE"
        ? challenge.mode === "TEAM"
        : challenge.category === filter,
  );
  return (
    <div className="arena-surface">
      <ArenaHeader
        eyebrow="FARMA ARENA"
        title="Desafios"
        description="Escolha onde colocar seu conhecimento em movimento."
      />
      <div className="arena-filters" role="group" aria-label="Filtrar desafios">
        {filters.map((item) => (
          <button
            key={item}
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
          >
            {item === "PRÁTICA"
              ? "Prática"
              : item[0] + item.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <div className="arena-challenge-grid">
        {challenges.map((challenge: any) => (
          <ChallengeCard
            key={challenge.id}
            challenge={challenge}
            arena={arena}
          />
        ))}
      </div>
    </div>
  );
}

function ArenaChallengeDetail({ arena, id }: { arena: any; id: string }) {
  const challenge = (arena.challenges || []).find(
    (item: any) => item.id === id,
  );
  if (!challenge)
    return (
      <div className="arena-error">
        <h2>Desafio não encontrado</h2>
        <Link href="/app/arena/desafios">Voltar aos desafios</Link>
      </div>
    );
  const completions = (arena.completions || []).filter(
    (item: any) => item.challengeId === id && item.status === "VALID",
  );
  return (
    <div className="arena-surface">
      <Link className="arena-back" href="/app/arena/desafios">
        ← Todos os desafios
      </Link>
      <section className="arena-detail">
        <span className="arena-detail__icon">
          {challenge.iconUrl ? (
            <img src={challenge.iconUrl} alt="" />
          ) : (
            <Sparkles />
          )}
        </span>
        <span className="arena-kicker">{challenge.category}</span>
        <h1>{challenge.title}</h1>
        <p>{challenge.description}</p>
        <div className="arena-detail__meta">
          <strong>+{challenge.xpReward} XP</strong>
          <span>
            {challenge.mode === "TEAM"
              ? `Equipe de ${challenge.minTeamSize} a ${challenge.maxTeamSize}`
              : "Individual"}
          </span>
        </div>
        <div className="arena-instructions">
          <h2>Como funciona</h2>
          <p>
            {challenge.instructions ||
              "A organização explicará as regras no local. Ao concluir, um operador validará seu resultado."}
          </p>
        </div>
        {completions.length ? (
          <div className="arena-done">
            <CheckCircle2 /> Resultado validado{" "}
            {completions.length > 1 ? `${completions.length} vezes` : ""}
          </div>
        ) : (
          <div className="arena-operator-note">
            <Clock3 /> A conclusão é registrada pela equipe da Jornada.
          </div>
        )}
      </section>
    </div>
  );
}

function ArenaRanking({ arena }: { arena: any }) {
  const ranking = arena.ranking || [];
  const top = ranking.slice(0, 3);
  const rest = ranking.slice(3);
  return (
    <div className="arena-surface ranking-page">
      <ArenaHeader
        eyebrow="CLASSIFICAÇÃO"
        title="Ranking da Arena"
        description="Compras usam o XP disponível e nunca reduzem sua posição."
      />
      <section className="arena-my-rank">
        <span>Sua posição</span>
        <strong>{arena.myRank ? `#${arena.myRank}` : "—"}</strong>
        <div>
          <b>{arena.myXpTotal} XP</b>
          <small>{arena.myXpAvailable} disponíveis</small>
        </div>
      </section>
      <div className="arena-podium">
        {top.map((row: any) => (
          <article key={row.participantId} className={`place-${row.rank}`}>
            <div className="arena-crown">
              <Trophy />
              <i />
            </div>
            <span className="arena-avatar">
              {row.photoUrl ? (
                <img src={row.photoUrl} alt="" />
              ) : (
                row.displayName.slice(0, 1)
              )}
            </span>
            <b>#{row.rank}</b>
            <h2>{row.displayName}</h2>
            <p>{row.title}</p>
            <strong>{row.xpTotal} XP</strong>
          </article>
        ))}
      </div>
      <div className="arena-ranking-list">
        {rest.map((row: any) => (
          <article key={row.participantId}>
            <b>#{row.rank}</b>
            <span className="arena-avatar small">
              {row.photoUrl ? (
                <img src={row.photoUrl} alt="" />
              ) : (
                row.displayName.slice(0, 1)
              )}
            </span>
            <div>
              <strong>{row.displayName}</strong>
              <small>{row.semester}º semestre</small>
            </div>
            <span>{row.xpTotal} XP</span>
          </article>
        ))}
      </div>
    </div>
  );
}

function ArenaPerformance({ arena }: { arena: any }) {
  const challenges = new Map(
    (arena.challenges || []).map((item: any) => [item.id, item]),
  );
  return (
    <div className="arena-surface">
      <ArenaHeader
        eyebrow="MINHA ARENA"
        title="Desempenho"
        description="Seu histórico de conquistas e movimentações de XP."
      />
      <div className="arena-stats">
        <Stat icon={Zap} label="XP total" value={arena.myXpTotal} />
        <Stat
          icon={ShoppingBag}
          label="Disponível"
          value={arena.myXpAvailable}
        />
        <Stat
          icon={Trophy}
          label="Ranking"
          value={arena.myRank ? `#${arena.myRank}` : "—"}
        />
        <Stat
          icon={CheckCircle2}
          label="Concluídos"
          value={arena.completedChallenges}
        />
      </div>
      <section className="arena-section">
        <div className="arena-section__title">
          <div>
            <span>HISTÓRICO</span>
            <h2>Movimentações recentes</h2>
          </div>
        </div>
        <div className="arena-ledger">
          {(arena.transactions || []).map((item: any) => (
            <article key={item.id}>
              <span className={item.balanceDelta >= 0 ? "gain" : "spend"}>
                {item.balanceDelta >= 0 ? "+" : ""}
                {item.balanceDelta} XP
              </span>
              <div>
                <strong>{item.description}</strong>
                <small>
                  {new Date(item.createdAt).toLocaleString("pt-BR")}
                </small>
              </div>
              <em>
                {item.rankingDelta ? "Conta no ranking" : "Saldo disponível"}
              </em>
            </article>
          ))}
        </div>
      </section>
      <section className="arena-section">
        <div className="arena-section__title">
          <div>
            <span>CONQUISTAS</span>
            <h2>Desafios concluídos</h2>
          </div>
        </div>
        <div className="arena-completions">
          {(arena.completions || [])
            .filter((item: any) => item.status === "VALID")
            .map((item: any) => (
              <article key={item.id}>
                <CheckCircle2 />
                <div>
                  <strong>
                    {(challenges.get(item.challengeId) as any)?.title ||
                      "Desafio"}
                  </strong>
                  <small>
                    {new Date(item.completedAt).toLocaleDateString("pt-BR")}
                  </small>
                </div>
                <b>+{item.xpAwarded} XP</b>
              </article>
            ))}
        </div>
      </section>
    </div>
  );
}

function ArenaStore({
  arena,
  run,
}: {
  arena: any;
  run: (name: string, payload?: any) => Promise<any>;
}) {
  const [busy, setBusy] = useState("");
  const ownReservations = new Set(
    (arena.reservations || [])
      .filter((item: any) =>
        ["RESERVED", "CONFIRMED", "DELIVERED"].includes(item.status),
      )
      .map((item: any) => item.rewardId),
  );
  return (
    <div className="arena-surface">
      <ArenaHeader
        eyebrow="LOJA XP"
        title="Troque conquistas por lembranças"
        description="Seu XP total mantém sua posição. Apenas o saldo disponível é usado no resgate."
      />
      <div className="arena-balance">
        <Zap />
        <span>Saldo disponível</span>
        <strong>{arena.myXpAvailable} XP</strong>
      </div>
      <div className="arena-store-grid">
        {(arena.rewards || []).map((reward: any) => {
          const owned = ownReservations.has(reward.id);
          const affordable = arena.myXpAvailable >= reward.xpCost;
          return (
            <article key={reward.id} className="arena-store-card">
              {reward.imageUrl ? (
                <img src={reward.imageUrl} alt={reward.name} />
              ) : (
                <span className="arena-store-card__fallback">
                  <Gift />
                </span>
              )}
              <div>
                <span className="arena-kicker">LOJA FARMA ARENA</span>
                <h2>{reward.name}</h2>
                <p>{reward.description}</p>
                <div className="arena-store-meta">
                  <strong>{reward.xpCost} XP</strong>
                  <span>
                    {reward.stockAvailable ?? reward.available ?? reward.total}{" "}
                    disponíveis
                  </span>
                </div>
                <button
                  disabled={owned || !affordable || busy === reward.id}
                  onClick={async () => {
                    setBusy(reward.id);
                    try {
                      await run("reward.purchase", { rewardId: reward.id });
                    } catch {
                      // O Provider já exibe a mensagem funcional da API.
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  {owned
                    ? "Já resgatado"
                    : busy === reward.id
                      ? "Reservando…"
                      : affordable
                        ? "Resgatar"
                        : "XP insuficiente"}
                  <ArrowRight />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function ArenaAwardRevealQueue() {
  const { data, action } = useJornadas();
  const [queue, setQueue] = useState<any[]>([]);
  const [arena, setArena] = useState<any>(null);
  const load = useCallback(async () => {
    // Mantém a fila sincronizada após uma atualização SSE do estado principal.
    void data?.serverNow;
    if (data?.actor?.type !== "participant" || !data?.edition?.id) return;
    try {
      const response = await fetch(
        `/api/arena?editionId=${encodeURIComponent(data.edition.id)}`,
        { cache: "no-store" },
      );
      const body = await readApiResponse<any>(
        response,
        "Não foi possível carregar conquistas.",
      );
      setArena(body);
      setQueue(
        (body.pendingRevealAwards || []).sort(
          (a: any, b: any) =>
            new Date(a.releasedAt).getTime() - new Date(b.releasedAt).getTime(),
        ),
      );
    } catch {
      // A fila persiste no servidor e será buscada novamente na reconexão.
    }
  }, [data?.actor?.type, data?.edition?.id, data?.serverNow]);
  useEffect(() => {
    void load();
  }, [load]);
  const current = queue[0];
  const revealGroup = useMemo(
    () =>
      arena?.config?.combinePendingAwards ? queue : current ? [current] : [],
    [arena?.config?.combinePendingAwards, current, queue],
  );
  const challenge = useMemo(
    () =>
      (arena?.challenges || []).find(
        (item: any) => item.id === current?.challengeId,
      ),
    [arena, current],
  );
  const close = useCallback(async () => {
    if (!current) return;
    const ids = revealGroup.map((item: any) => item.id);
    setQueue((items) => items.filter((item: any) => !ids.includes(item.id)));
    for (const award of revealGroup) {
      try {
        await action("arena.award.seen", { awardId: award.id });
      } catch {
        /* volta na próxima carga se não confirmou */
      }
    }
  }, [action, current, revealGroup]);
  useEffect(() => {
    if (!current) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;
    const timer = setTimeout(() => void close(), 2900);
    return () => clearTimeout(timer);
  }, [close, current]);
  if (!current) return null;
  const rank = arena?.ranking?.find(
    (row: any) => row.participantId === data.actor.id,
  );
  return (
    <div
      className={`arena-reveal ${String(current.animationVariant || "").toLowerCase()}`}
      role="dialog"
      aria-modal="true"
      aria-label="XP conquistado"
    >
      <button className="arena-reveal__skip" onClick={close}>
        Pular <X />
      </button>
      <div className="arena-reveal__fire" aria-hidden="true" />
      <FarmaArenaStamp className="arena-reveal__stamp" />
      <span>
        {revealGroup.length > 1
          ? `${revealGroup.length} DESAFIOS CONCLUÍDOS`
          : "DESAFIO CONCLUÍDO"}
      </span>
      <h2>
        {revealGroup.length > 1
          ? "Sequência de conquistas"
          : challenge?.title || "Farma Arena"}
      </h2>
      <strong>
        +
        {revealGroup.reduce(
          (sum: number, item: any) => sum + Number(item.amount),
          0,
        )}{" "}
        XP
      </strong>
      <p>
        {arena.myXpTotal} XP acumulados
        {arena.myRank ? ` · #${arena.myRank} no ranking` : ""}
      </p>
      {current.animationVariant?.startsWith("TOP_") && (
        <div className="arena-reveal__title">
          <Trophy /> NOVO TÍTULO CONQUISTADO
          <br />
          <b>{rank?.title}</b>
        </div>
      )}
    </div>
  );
}
