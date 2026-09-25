"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Gift,
  Medal,
  ShoppingBag,
  Sparkles,
  Send,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useJornadas } from "@/components/provider";
import FarmaArenaStamp from "@/components/farma-arena-stamp";
import { readApiResponse } from "@/lib/api-response";
import "./arena.css";

export function useArena() {
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
  if (page === "ranking")
    return (
      <RankingReleaseGate arena={state.arena} onRelease={state.load}>
        <ArenaRanking arena={state.arena} />
      </RankingReleaseGate>
    );
  if (page === "desafios" && id)
    return <ArenaChallengeDetail arena={state.arena} id={id} />;
  if (page === "desafios") return <ArenaChallenges arena={state.arena} />;
  if (page === "desempenho") return <ArenaPerformance arena={state.arena} />;
  if (page === "ponto-extra")
    return <ArenaCreditChoice arena={state.arena} run={state.run} />;
  if (page === "loja") return <ArenaStoreRedirect />;
  return <ArenaHome arena={state.arena} />;
}

function RankingReleaseGate({
  arena,
  children,
  onRelease,
}: {
  arena: any;
  children: ReactNode;
  onRelease: () => Promise<void>;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const refreshed = useRef(false);
  const releaseAt = new Date(
    arena.rankingRevealAt || arena.config?.rankingRevealAt || 0,
  ).getTime();
  const [serverOffset, setServerOffset] = useState(0);
  useEffect(() => {
    const serverNow = new Date(arena.serverNow || 0).getTime();
    setServerOffset(
      Number.isFinite(serverNow) && serverNow > 0 ? serverNow - Date.now() : 0,
    );
  }, [arena.serverNow]);

  useEffect(() => {
    if (!arena.rankingLocked || !Number.isFinite(releaseAt) || releaseAt <= 0) {
      setRemaining(0);
      return;
    }
    refreshed.current = false;
    const update = () => {
      const next = Math.max(0, releaseAt - (Date.now() + serverOffset));
      setRemaining(next);
      if (next === 0 && !refreshed.current) {
        refreshed.current = true;
        void onRelease();
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [arena.rankingLocked, onRelease, releaseAt, serverOffset]);

  if (!arena.rankingLocked) return children;

  const totalSeconds = Math.floor((remaining || 0) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const unit = (value: number) => String(value).padStart(2, "0");
  const releaseLabel = Number.isFinite(releaseAt)
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Manaus",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(releaseAt))
    : "no horário definido pela organização";

  return (
    <div className="arena-surface ranking-page">
      <section className="arena-ranking-countdown" aria-live="polite">
        <div className="arena-ranking-countdown__seal" aria-hidden="true">
          <img src="/assets/navigation/nav-ranking-hygia.webp" alt="" />
          <i />
        </div>
        <span className="arena-ranking-countdown__eyebrow">
          CLASSIFICAÇÃO EM PREPARAÇÃO
        </span>
        <h1>As posições ainda estão em segredo</h1>
        <p>
          A classificação será revelada em {releaseLabel}, no horário de Boa
          Vista. Até lá, você acompanha apenas o seu XP.
        </p>
        <div className="arena-ranking-countdown__xp">
          <span>SEU XP ATUAL</span>
          <strong>{arena.myXpTotal || 0} XP</strong>
          <small>Sua posição permanece oculta durante a contagem.</small>
        </div>
        <div
          className="arena-ranking-countdown__timer"
          aria-label={`${hours} horas, ${minutes} minutos e ${seconds} segundos para a abertura do ranking`}
        >
          <span>
            <strong>{remaining === null ? "--" : unit(hours)}</strong>
            <small>horas</small>
          </span>
          <b aria-hidden="true">:</b>
          <span>
            <strong>{remaining === null ? "--" : unit(minutes)}</strong>
            <small>minutos</small>
          </span>
          <b aria-hidden="true">:</b>
          <span>
            <strong>{remaining === null ? "--" : unit(seconds)}</strong>
            <small>segundos</small>
          </span>
        </div>
        <div className="arena-ranking-countdown__note">
          <Clock3 aria-hidden="true" />
          <span>
            {remaining === 0
              ? "Liberando a classificação…"
              : "O ranking abrirá automaticamente quando o contador zerar."}
          </span>
        </div>
        <Link
          href="/app/arena/desempenho"
          className="arena-ranking-countdown__history"
        >
          <CheckCircle2 aria-hidden="true" />
          <span>
            <strong>Minhas atividades concluídas</strong>
            <small>
              Consulte seu histórico individual sem revelar posições.
            </small>
          </span>
          <ChevronRight aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

function ArenaHome({ arena }: { arena: any }) {
  const allChallenges = arena.challenges || [];
  const challengeById = new Map(
    (arena.challenges || []).map((challenge: any) => [challenge.id, challenge]),
  );
  const completed = Array.from(
    (arena.completions || [])
      .filter((item: any) => item.status === "VALID")
      .reduce((items: Map<string, any>, item: any) => {
        const current = items.get(item.challengeId);
        if (
          !current ||
          new Date(item.completedAt).getTime() >
            new Date(current.completedAt).getTime()
        )
          items.set(item.challengeId, item);
        return items;
      }, new Map<string, any>())
      .values(),
  ).sort(
    (a: any, b: any) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );
  const completedIds = new Set(
    completed.map((item: any) => String(item.challengeId)),
  );
  const nextChallenges = allChallenges
    .filter((challenge: any) => !completedIds.has(String(challenge.id)))
    .slice(0, 3);
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
          label="Ranking"
          value={
            arena.rankingLocked
              ? "Oculta"
              : arena.myRank
                ? `#${arena.myRank}`
                : "—"
          }
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
        <Link href="/app/brindes">
          <Gift /> Loja da Jornada <ChevronRight />
        </Link>
        <Link href="/app/arena/desempenho">
          <Medal /> Desempenho <ChevronRight />
        </Link>
        {arena.disciplineBenefit?.eligible && (
          <Link href="/app/arena/ponto-extra" className="arena-benefit-link">
            <BookOpen /> Ponto em disciplina <ChevronRight />
          </Link>
        )}
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
      <section className="arena-section arena-section--completed">
        <div className="arena-section__title">
          <div>
            <span>MINHAS CONQUISTAS</span>
            <h2>Atividades concluídas</h2>
          </div>
          {completed.length > 0 && (
            <Link href="/app/arena/desempenho">Ver histórico</Link>
          )}
        </div>
        {completed.length ? (
          <div className="arena-completions arena-completions--home">
            {completed.slice(0, 6).map((item: any) => {
              const challenge: any = challengeById.get(item.challengeId);
              return (
                <article key={item.id}>
                  <span className="arena-completion-check">
                    <CheckCircle2 />
                  </span>
                  <div>
                    <strong>{challenge?.title || "Desafio concluído"}</strong>
                    <small>
                      {new Date(item.completedAt).toLocaleDateString("pt-BR")}
                    </small>
                  </div>
                  <b>+{item.xpAwarded} XP</b>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="arena-completions-empty">
            <Sparkles />
            <div>
              <strong>Sua primeira conquista começa aqui.</strong>
              <span>
                Ao concluir um desafio, ele aparecerá neste painel com o XP
                recebido.
              </span>
            </div>
          </div>
        )}
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
          {done ? (
            <>
              <CheckCircle2 /> Concluído
            </>
          ) : challenge.mode === "TEAM" ? (
            <>
              <Users /> Equipe
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
          <>
            <div className="arena-done">
              <CheckCircle2 /> Resultado validado{" "}
              {completions.length > 1 ? `${completions.length} vezes` : ""}
            </div>
            {arena.disciplineBenefit?.challengeId === challenge.id && (
              <Link className="arena-credit-cta" href="/app/arena/ponto-extra">
                <BookOpen />
                {arena.disciplineBenefit.submitted
                  ? "Ver disciplina escolhida"
                  : "Escolher disciplina para o ponto"}
                <ChevronRight />
              </Link>
            )}
          </>
        ) : (
          <div className="arena-operator-note">
            <Clock3 /> A conclusão é registrada pela equipe da Jornada.
          </div>
        )}
      </section>
    </div>
  );
}

function ArenaCreditChoice({ arena, run }: { arena: any; run: any }) {
  const benefit = arena.disciplineBenefit || {};
  const [discipline, setDiscipline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!benefit.eligible) {
    return (
      <div className="arena-error">
        <BookOpen />
        <h2>Benefício ainda bloqueado</h2>
        <p>
          Conclua o desafio Convite de egressos para escolher uma disciplina.
        </p>
        <Link href="/app/arena/desafios">Ver desafios</Link>
      </div>
    );
  }
  if (benefit.submitted) {
    return (
      <div className="arena-surface">
        <ArenaHeader
          eyebrow="CONQUISTA ESPECIAL"
          title="Disciplina escolhida"
          description="Sua escolha foi registrada e encaminhada à organização."
        />
        <section className="arena-credit-confirmed">
          <span>
            <CheckCircle2 /> Enviado com sucesso
          </span>
          <BookOpen />
          <small>DISCIPLINA</small>
          <h2>{benefit.submission?.discipline}</h2>
          <p>
            Cada participante pode enviar somente uma disciplina, por isso esta
            escolha não pode ser alterada.
          </p>
          <Link href="/app/arena">Voltar para a Arena</Link>
        </section>
      </div>
    );
  }
  return (
    <div className="arena-surface">
      <ArenaHeader
        eyebrow="CONQUISTA ESPECIAL"
        title="Escolha sua disciplina"
        description="Você concluiu o Convite de egressos e conquistou o direito de indicar uma disciplina para receber o ponto."
      />
      <section className="arena-credit-form-card">
        <div className="arena-credit-emblem">
          <BookOpen />
        </div>
        <div>
          <span>UMA ÚNICA ESCOLHA</span>
          <h2>Em qual disciplina você deseja receber o ponto?</h2>
          <p>
            Digite o nome como você reconhece a disciplina. Depois do envio, a
            escolha será definitiva e ficará disponível para a organização.
          </p>
        </div>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const value = discipline.trim();
            if (!value) return;
            if (
              !window.confirm(
                `Confirmar “${value}”? Esta escolha não poderá ser alterada.`,
              )
            )
              return;
            setBusy(true);
            setError("");
            try {
              await run("arena.credit.submit", { discipline: value });
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Não foi possível registrar sua escolha.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            <span>Disciplina</span>
            <input
              value={discipline}
              onChange={(event) => setDiscipline(event.target.value)}
              maxLength={120}
              placeholder="Ex.: Farmacologia Clínica"
              autoComplete="off"
              required
            />
            <small>{discipline.length}/120</small>
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="button" disabled={busy || !discipline.trim()}>
            <Send /> {busy ? "Enviando…" : "Confirmar escolha definitiva"}
          </button>
        </form>
      </section>
    </div>
  );
}

function ArenaRanking({ arena }: { arena: any }) {
  const ranking = arena.ranking || [];
  const top = ranking.slice(0, 3);
  const introStarted = useRef(false);
  const [introRanking, setIntroRanking] = useState<any[]>([]);
  const [showIntro, setShowIntro] = useState(false);
  const [fullRanking, setFullRanking] = useState<any[] | null>(null);
  const [fullVisible, setFullVisible] = useState(false);
  const [loadingFull, setLoadingFull] = useState(false);
  const [rankingError, setRankingError] = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null);
  const [xpBreakdown, setXpBreakdown] = useState<any>(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [breakdownError, setBreakdownError] = useState("");
  useEffect(() => {
    if (
      introStarted.current ||
      arena.rankingLocked ||
      !arena.rankingIntro?.shouldShow
    )
      return;
    introStarted.current = true;
    const controller = new AbortController();
    const editionId = arena.config?.editionId;
    fetch(
      `/api/arena/ranking?full=1&editionId=${encodeURIComponent(editionId || "")}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then((response) =>
        readApiResponse<any>(
          response,
          "Não foi possível preparar a apresentação do ranking.",
        ),
      )
      .then((payload) => {
        const rows = payload.ranking || [];
        if (!rows.length) return;
        setFullRanking(rows);
        setIntroRanking(rows);
        setShowIntro(true);
        void fetch("/api/arena/ranking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editionId }),
          keepalive: true,
        });
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") introStarted.current = false;
      });
    return () => controller.abort();
  }, [
    arena.config?.editionId,
    arena.rankingIntro?.shouldShow,
    arena.rankingLocked,
  ]);
  useEffect(() => {
    if (!selectedParticipant) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedParticipant(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedParticipant]);
  const showXpBreakdown = async (participant: any) => {
    setSelectedParticipant(participant);
    setXpBreakdown(null);
    setBreakdownError("");
    setLoadingBreakdown(true);
    try {
      const editionId = arena.config?.editionId;
      const response = await fetch(
        `/api/arena/ranking?participantId=${encodeURIComponent(participant.participantId)}&editionId=${encodeURIComponent(editionId || "")}`,
        { cache: "no-store" },
      );
      setXpBreakdown(
        await readApiResponse<any>(
          response,
          "Não foi possível carregar a origem deste XP.",
        ),
      );
    } catch (reason) {
      setBreakdownError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível carregar a origem deste XP.",
      );
    } finally {
      setLoadingBreakdown(false);
    }
  };
  const keyboardOpenBreakdown = (event: ReactKeyboardEvent, row: any) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    void showXpBreakdown(row);
  };
  const showFullRanking = async () => {
    if (fullRanking) {
      setFullVisible((current) => !current);
      return;
    }
    setLoadingFull(true);
    setRankingError("");
    try {
      const editionId = arena.config?.editionId;
      const response = await fetch(
        `/api/arena/ranking?full=1&editionId=${encodeURIComponent(editionId || "")}`,
        { cache: "no-store" },
      );
      const payload = await readApiResponse<any>(
        response,
        "Não foi possível abrir o ranking completo.",
      );
      setFullRanking(payload.ranking || []);
      setFullVisible(true);
    } catch (reason) {
      setRankingError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível abrir o ranking completo.",
      );
    } finally {
      setLoadingFull(false);
    }
  };
  return (
    <div className="arena-surface ranking-page">
      {showIntro && (
        <ParticipantRankingReveal
          ranking={introRanking}
          onClose={() => setShowIntro(false)}
        />
      )}
      <ArenaHeader
        eyebrow="CLASSIFICAÇÃO"
        title="Ranking da Arena"
        description="Compras usam o XP disponível e nunca reduzem sua posição. Toque em uma pessoa para conferir a origem do XP."
      />
      <div className="arena-podium">
        {top.map((row: any) => (
          <article
            key={row.participantId}
            className={`place-${row.rank} arena-ranking-person`}
            role="button"
            tabIndex={0}
            aria-haspopup="dialog"
            aria-label={`Ver origem dos ${row.xpTotal} XP de ${row.displayName}`}
            onClick={() => void showXpBreakdown(row)}
            onKeyDown={(event) => keyboardOpenBreakdown(event, row)}
          >
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
      <section
        className="arena-my-rank arena-ranking-person"
        aria-label="Sua classificação. Toque para ver a origem do seu XP."
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        onClick={() => arena.myRanking && void showXpBreakdown(arena.myRanking)}
        onKeyDown={(event) =>
          arena.myRanking && keyboardOpenBreakdown(event, arena.myRanking)
        }
      >
        <span className="arena-avatar small">
          {arena.myRanking?.photoUrl ? (
            <img src={arena.myRanking.photoUrl} alt="" />
          ) : (
            (arena.myRanking?.displayName || "V").slice(0, 1)
          )}
        </span>
        <div className="arena-my-rank__identity">
          <small>SUA CLASSIFICAÇÃO</small>
          <b>{arena.myRanking?.displayName || "Você"}</b>
          <span>{arena.myRanking?.semester || "—"}º semestre</span>
        </div>
        <strong>{arena.myRank ? `#${arena.myRank}` : "—"}</strong>
        <div className="arena-my-rank__xp">
          <b>{arena.myXpTotal} XP</b>
          <small>{arena.myXpAvailable} disponíveis</small>
        </div>
      </section>
      <button
        type="button"
        className="arena-ranking-toggle"
        onClick={() => void showFullRanking()}
        disabled={loadingFull}
        aria-expanded={fullVisible}
      >
        {loadingFull
          ? "Carregando classificação…"
          : fullVisible
            ? "Ocultar ranking completo"
            : "Ver ranking completo"}
        {!loadingFull && <ChevronRight aria-hidden="true" />}
      </button>
      {rankingError && <p className="arena-ranking-error">{rankingError}</p>}
      {fullVisible && fullRanking && (
        <div className="arena-ranking-list" aria-label="Ranking completo">
          {fullRanking.slice(3).map((row: any) => (
            <article
              key={row.participantId}
              className={
                row.participantId === arena.myRanking?.participantId
                  ? "is-current arena-ranking-person"
                  : "arena-ranking-person"
              }
              role="button"
              tabIndex={0}
              aria-haspopup="dialog"
              aria-label={`Ver origem dos ${row.xpTotal} XP de ${row.displayName}`}
              onClick={() => void showXpBreakdown(row)}
              onKeyDown={(event) => keyboardOpenBreakdown(event, row)}
            >
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
      )}
      {selectedParticipant && (
        <div
          className="arena-xp-audit-backdrop"
          onMouseDown={() => setSelectedParticipant(null)}
        >
          <section
            className="arena-xp-audit"
            role="dialog"
            aria-modal="true"
            aria-labelledby="arena-xp-audit-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div className="arena-xp-audit__identity">
                <span className="arena-avatar small">
                  {selectedParticipant.photoUrl ? (
                    <img src={selectedParticipant.photoUrl} alt="" />
                  ) : (
                    selectedParticipant.displayName.slice(0, 1)
                  )}
                </span>
                <div>
                  <small>TRANSPARÊNCIA DO RANKING</small>
                  <h2 id="arena-xp-audit-title">
                    {selectedParticipant.displayName}
                  </h2>
                  <span>
                    #{selectedParticipant.rank} · {selectedParticipant.xpTotal}{" "}
                    XP
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedParticipant(null)}
                aria-label="Fechar detalhamento"
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <div className="arena-xp-audit__summary">
              <span>XP auditado</span>
              <strong>
                {xpBreakdown?.xpTotal ?? selectedParticipant.xpTotal} XP
              </strong>
              <small>Soma de carimbos, desafios e ajustes registrados.</small>
            </div>
            {loadingBreakdown ? (
              <div className="arena-xp-audit__loading" role="status">
                <i />
                <span>Carregando lançamentos…</span>
              </div>
            ) : breakdownError ? (
              <p className="arena-xp-audit__error" role="alert">
                {breakdownError}
              </p>
            ) : (
              <div className="arena-xp-audit__ledger">
                {(xpBreakdown?.entries || []).map((entry: any) => (
                  <article key={entry.id}>
                    <span
                      className={
                        entry.amount >= 0 ? "is-positive" : "is-negative"
                      }
                    >
                      {entry.amount > 0 ? "+" : ""}
                      {entry.amount} XP
                    </span>
                    <div>
                      <strong>{entry.label}</strong>
                      <small>
                        {entry.source === "PASSPORT_STAMP"
                          ? "Passaporte"
                          : entry.source === "ARENA_AWARD"
                            ? "Farma Arena"
                            : "Ajuste da organização"}
                        {" · "}
                        {new Date(entry.createdAt).toLocaleString("pt-BR")}
                      </small>
                    </div>
                  </article>
                ))}
                {xpBreakdown && !xpBreakdown.entries?.length && (
                  <p>Nenhum lançamento de XP foi encontrado.</p>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ParticipantRankingReveal({
  ranking,
  onClose,
}: {
  ranking: any[];
  onClose: () => void;
}) {
  const rows = useMemo(() => [...ranking].reverse(), [ranking]);
  const [countdown, setCountdown] = useState(5);
  const [current, setCurrent] = useState(0);
  const [finished, setFinished] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const active = rows[current] || rows[0];
  const countdownComplete = countdown === 0;
  const windowStart = Math.max(0, current - 3);
  const visibleRows = rows.slice(windowStart, current + 4);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      media.removeEventListener("change", update);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (!reducedMotion) return;
    setCountdown(0);
    setCurrent(Math.max(0, rows.length - 1));
    setFinished(true);
  }, [reducedMotion, rows.length]);

  useEffect(() => {
    if (countdownComplete || reducedMotion) return;
    const timer = window.setTimeout(
      () => setCountdown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [countdown, countdownComplete, reducedMotion]);

  useEffect(() => {
    if (!countdownComplete || reducedMotion || finished || !rows.length) return;
    const rank = Number(rows[current]?.rank || rows.length);
    const fastStep = Math.max(55, Math.min(170, 9000 / rows.length));
    const delay = rank <= 3 ? 1100 : rank <= 10 ? 480 : fastStep;
    const timer = window.setTimeout(() => {
      if (current >= rows.length - 1) setFinished(true);
      else setCurrent((value) => value + 1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [countdownComplete, current, finished, reducedMotion, rows]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !countdownComplete || reducedMotion) return;
    audio.volume = 0.42;
    void audio.play().catch(() => undefined);
    return () => audio.pause();
  }, [countdownComplete, reducedMotion]);

  return (
    <section
      className="arena-participant-reveal"
      role="dialog"
      aria-modal="true"
      aria-label="Apresentação do ranking da Farma Arena"
    >
      {!reducedMotion && (
        <audio
          ref={audioRef}
          src="/assets/effects/farma-arena-ranking-reveal.m4a"
          preload="metadata"
        />
      )}
      <div className="arena-participant-reveal__sky" aria-hidden="true" />
      {!countdownComplete && (
        <div
          className="arena-participant-reveal__countdown"
          role="status"
          aria-live="assertive"
        >
          <FarmaArenaStamp />
          <small>PREPARE-SE</small>
          <strong key={countdown}>{countdown}</strong>
          <span>O ranking vai começar</span>
        </div>
      )}
      <header>
        <div>
          <span>FARMA ARENA</span>
          <strong>Rumo ao topo</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Pular apresentação">
          <X aria-hidden="true" />
        </button>
      </header>
      <main>
        <span className="arena-participant-reveal__eyebrow">
          {finished ? "O TOPO DA JORNADA" : "CLASSIFICAÇÃO EM MOVIMENTO"}
        </span>
        <div className="arena-participant-reveal__viewport" aria-live="polite">
          {visibleRows.map((row: any, index: number) => {
            const absoluteIndex = windowStart + index;
            const distance = absoluteIndex - current;
            return (
              <article
                key={row.participantId}
                className={distance === 0 ? "is-active" : ""}
                style={{
                  transform: `translate3d(0, ${distance * 66}px, 0) scale(${distance === 0 ? 1 : 0.94})`,
                  opacity: Math.max(0.14, 1 - Math.abs(distance) * 0.26),
                }}
              >
                <b>#{row.rank}</b>
                <span>{row.displayName}</span>
                <strong>{row.xpTotal} XP</strong>
              </article>
            );
          })}
        </div>
        {active && (
          <div
            className={`arena-participant-reveal__focus ${finished ? "is-winner" : ""}`}
          >
            <small>{finished ? "LIDERANÇA ATUAL" : "SUBINDO"}</small>
            <b>#{active.rank}</b>
            <h2>{active.displayName}</h2>
            <strong>{active.xpTotal} XP</strong>
          </div>
        )}
      </main>
      <footer>
        <div className="arena-participant-reveal__progress" aria-hidden="true">
          <i
            style={{
              transform: `scaleX(${rows.length ? (current + 1) / rows.length : 0})`,
            }}
          />
        </div>
        <button type="button" onClick={onClose}>
          {finished ? "Ver ranking" : "Pular apresentação"}
          <ChevronRight aria-hidden="true" />
        </button>
      </footer>
    </section>
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
          value={
            arena.rankingLocked
              ? "Oculta"
              : arena.myRank
                ? `#${arena.myRank}`
                : "—"
          }
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

function ArenaStoreRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/brindes");
  }, [router]);
  return <LoadingArena />;
}

export function ArenaAwardRevealQueue() {
  const { data, action } = useJornadas();
  const [queue, setQueue] = useState<any[]>([]);
  const arena = data?.arenaPending;
  useEffect(() => {
    setQueue(
      [...(arena?.pendingRevealAwards || [])].sort(
        (a: any, b: any) =>
          new Date(a.releasedAt).getTime() - new Date(b.releasedAt).getTime(),
      ),
    );
  }, [arena?.pendingRevealAwards]);
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
      {current.animationVariant?.startsWith("TOP_") && rank && (
        <div className="arena-reveal__title">
          <Trophy /> NOVO TÍTULO CONQUISTADO
          <br />
          <b>{rank?.title}</b>
        </div>
      )}
    </div>
  );
}
