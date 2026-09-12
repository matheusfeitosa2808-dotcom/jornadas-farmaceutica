"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Gift,
  Leaf,
  LogOut,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  Upload,
  WifiOff,
} from "lucide-react";
import { useJornadas } from "./provider";
import {
  ActivityMeta,
  Avatar,
  Badge,
  Empty,
  ExternalLink,
  formatDate,
  formatTime,
  Modal,
} from "./ui";

const navigation = [
  { path: "", label: "Início", icon: "/assets/navigation/nav-inicio.png" },
  {
    path: "programacao",
    label: "Programação",
    icon: "/assets/navigation/nav-programacao.png",
  },
  {
    path: "passaporte",
    label: "Passaporte",
    icon: "/assets/navigation/nav-passaporte.png",
  },
  {
    path: "brindes",
    label: "Brindes",
    icon: "/assets/navigation/nav-brindes.png",
  },
  {
    path: "perfil",
    label: "Perfil",
    icon: "/assets/navigation/nav-perfil.png",
  },
];
function ownEnrollment(data: any, activityId: string) {
  return (data.enrollments || []).find(
    (e: any) =>
      e.activityId === activityId && ["ACTIVE", "COMPLETED"].includes(e.status),
  );
}
function ownAttendance(data: any, activityId: string) {
  return (data.attendances || []).find(
    (e: any) =>
      e.activityId === activityId &&
      e.checkinAt &&
      !["CANCELLED", "INVALIDATED"].includes(e.status),
  );
}
function validStamps(data: any) {
  return (data.stamps || []).filter(
    (s: any) => !["CANCELLED", "INVALIDATED", "REVOKED"].includes(s.status),
  );
}
function categoryOf(data: any, activity: any) {
  return (
    activity.category ||
    (data.categories || []).find((c: any) => c.id === activity.categoryId) ||
    {}
  );
}
function speakersOf(data: any, activity: any) {
  return (
    activity.speakers?.map((s: any) => s.speaker || s) ||
    (data.speakers || []).filter((s: any) =>
      activity.speakerIds?.includes(s.id),
    )
  );
}
function isLive(data: any, activity: any) {
  return (
    new Date(data.serverNow).getTime() >=
      new Date(activity.startAt).getTime() &&
    new Date(data.serverNow).getTime() <= new Date(activity.endAt).getTime() &&
    activity.status !== "CANCELLED"
  );
}

export default function ParticipantApp({
  section,
  id,
}: {
  section: string;
  id?: string;
}) {
  const { data, loading, error, refresh } = useJornadas();
  if (loading && !data)
    return (
      <main className="app-loading" aria-busy="true">
        <Leaf className="loading-leaf" />
        <p>Preparando sua jornada…</p>
      </main>
    );
  if (!data?.actor || data.actor.type !== "participant")
    return (
      <main id="main" className="empty page">
        <BookOpen size={36} />
        <h1>Entre para continuar sua jornada.</h1>
        {error && <p role="alert">{error}</p>}
        <Link className="button" href="/login/participante">
          Entrar como participante <ArrowRight size={18} />
        </Link>
      </main>
    );
  const person =
    data.participant ||
    data.participants?.find((p: any) => p.id === data.actor.id) ||
    data.actor;
  const unread = (data.notifications || []).filter(
    (n: any) => !n.readAt && !n.read,
  ).length;
  return (
    <div className={`participant-shell participant-${section || "home"}`}>
      <header className="participant-header">
        <Link href="/app" className="wordmark">
          <Leaf size={22} /> jornadas
          <span className="wordmark-edition">{data.edition?.year}</span>
        </Link>
        <div className="participant-head-actions">
          <span className="edition-name">{data.edition?.name}</span>
          <Link
            href="/app/notificacoes"
            className={`icon-button notification-bell ${unread ? "unread" : ""}`}
            aria-label={`Notificações${unread ? `, ${unread} não lidas` : ""}`}
          >
            <Bell size={21} />
            {unread > 0 && <i />}
          </Link>
          <Link href="/app/perfil" aria-label="Meu perfil">
            <Avatar name={person.name} url={person.photoUrl} />
          </Link>
        </div>
      </header>
      <div className="participant-body">
        {data.devMode && (
          <div className="dev-ribbon">
            DEV <span>Ambiente de demonstração · participantes fictícios</span>
          </div>
        )}
        {error && (
          <div className="connection-error" role="alert">
            <WifiOff size={18} />
            {error}
            <button onClick={refresh}>Tentar novamente</button>
          </div>
        )}
        <main
          id="main"
          className="participant-content page-enter"
          key={section + id}
        >
          <ParticipantMasthead section={section} compact={Boolean(id)} />
          {section === "" ? (
            <ParticipantHome person={person} />
          ) : section === "programacao" ? (
            id ? (
              <ActivityDetail id={id} />
            ) : (
              <Programacao />
            )
          ) : section === "inscricoes" ? (
            <Programacao onlyMine />
          ) : section === "passaporte" ? (
            <Passport person={person} />
          ) : section === "brindes" ? (
            <Rewards id={id} />
          ) : section === "perfil" ? (
            <Profile person={person} />
          ) : section === "notificacoes" ? (
            <Notifications />
          ) : section === "certificados" ? (
            <Certificates />
          ) : (
            <Empty title="Página não encontrada">
              <Link href="/app">Voltar ao início</Link>
            </Empty>
          )}
        </main>
        <footer className="participant-footer">
          {data.edition?.name} <span>·</span> Faculdade Cathedral
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Navegação principal">
        {navigation.map(({ path, label, icon }) => (
          <Link
            key={path}
            href={`/app${path ? "/" + path : ""}`}
            aria-current={section === path ? "page" : undefined}
            className={section === path ? "selected" : ""}
          >
            <span className="nav-icon-frame" aria-hidden="true">
              <img className="nav-stamp-icon" src={icon} alt="" />
            </span>
            <span>{label}</span>
            {section === path && <i />}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function ParticipantMasthead({
  section,
  compact,
}: {
  section: string;
  compact?: boolean;
}) {
  const { data } = useJornadas();
  const headings: Record<string, [string, string]> = {
    programacao: ["Programação", "Organize sua participação na Jornada."],
    inscricoes: [
      "Minhas inscrições",
      "Seus encontros confirmados e em espera.",
    ],
    passaporte: ["Passaporte Digital", "Conhecimento  ·  Conexões  ·  Futuro"],
    brindes: ["Brindes", "Acompanhe sua elegibilidade e sua retirada."],
    perfil: ["Perfil", "Ciência hoje. Saúde sempre."],
    notificacoes: ["Notificações", "Avisos importantes da organização."],
    certificados: ["Certificados", "O registro das suas conquistas."],
  };
  const heading = headings[section];
  return (
    <section className={`reference-masthead ${compact ? "compact" : ""}`}>
      <img
        className="masthead-ornament left"
        src="/assets/stamps/selo-5.webp"
        alt=""
        aria-hidden="true"
      />
      <img
        className="masthead-ornament right"
        src="/assets/stamps/selo-6.webp"
        alt=""
        aria-hidden="true"
      />
      <img
        className="masthead-logo"
        src={
          data.edition?.logoUrl ||
          "/assets/brand/logo-jornada-2026-trimmed.webp"
        }
        alt={data.edition?.name || "Jornada Farmacêutica"}
      />
      {!compact && heading && (
        <>
          <span className="masthead-spark" aria-hidden="true">
            ✦
          </span>
          <h1>{heading[0]}</h1>
          <p>{heading[1]}</p>
        </>
      )}
    </section>
  );
}

function ParticipantHome({ person }: { person: any }) {
  const { data } = useJornadas();
  const stamps = validStamps(data);
  const now = new Date(data.serverNow).getTime();
  const booked = (data.activities || [])
    .filter(
      (a: any) =>
        ownEnrollment(data, a.id) &&
        new Date(a.endAt).getTime() >= now &&
        a.status !== "CANCELLED",
    )
    .sort((a: any, b: any) => a.startAt.localeCompare(b.startAt));
  const next = booked[0];
  const count = stamps.length;
  const total = data.edition.maxCheckins;
  const firstName =
    person.firstName || person.name?.split(" ")[0] || "participante";
  return (
    <>
      <div className="greeting">
        <div>
          <h1>
            Olá, {firstName} <span className="greeting-dot">✦</span>
          </h1>
          <p>Seja bem-vinda à sua jornada acadêmica.</p>
        </div>
        <div className="greeting-date">
          <CalendarDays size={18} />
          {formatDate(data.serverNow, data.edition.timezone, true)}
        </div>
      </div>
      <div className="home-main-grid">
        <section className="next-activity passport-frame">
          {next ? (
            <>
              <div className="row-between">
                <span className="eyebrow">
                  {isLive(data, next)
                    ? "ACONTECENDO AGORA"
                    : "SUA PRÓXIMA ATIVIDADE"}
                </span>
                <img
                  className="next-stamp"
                  src={next.stampUrl || categoryOf(data, next).stampUrl}
                  alt={`Carimbo de ${categoryOf(data, next).name}`}
                />
              </div>
              <h2>{next.title}</h2>
              <p>
                {speakersOf(data, next)
                  .map((s: any) => s.name)
                  .join(" · ") || "Um novo encontro com o conhecimento."}
              </p>
              <ActivityMeta activity={next} timezone={data.edition.timezone} />
              <div className="next-bottom">
                <Link
                  href={`/app/programacao/${next.id}`}
                  className="button light"
                >
                  Ver detalhes <ArrowUpRight size={17} />
                </Link>
                <span>
                  <Ticket size={15} /> Sua vaga está confirmada
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="row-between">
                <span className="eyebrow">SEU PRÓXIMO ENCONTRO</span>
                <CalendarDays size={22} />
              </div>
              <h2>
                O conhecimento
                <br />
                espera por você.
              </h2>
              <p>
                Explore as atividades da edição e escolha seu próximo encontro.
              </p>
              <Link href="/app/programacao" className="button light">
                Explorar programação <ArrowRight size={17} />
              </Link>
            </>
          )}
        </section>
        <section className="journey-progress card passport-frame">
          <div className="row-between">
            <span className="eyebrow">MINHA JORNADA</span>
            <Sparkles size={19} />
          </div>
          <div className="progress-numbers">
            <strong>{count.toString().padStart(2, "0")}</strong>
            <span>/ {total.toString().padStart(2, "0")}</span>
          </div>
          <p>atividades concluídas</p>
          <div
            className="progress-track"
            role="progressbar"
            aria-valuenow={count}
            aria-valuemin={0}
            aria-valuemax={total}
          >
            <span
              style={{
                width: `${Math.min((count / Math.max(total, 1)) * 100, 100)}%`,
              }}
            />
          </div>
          <div className="progress-dots">
            {Array.from({ length: Math.min(total, 12) }, (_, i) => (
              <span key={i} className={i < count ? "complete" : ""}>
                {i < count ? <Check size={13} /> : i + 1}
              </span>
            ))}
          </div>
          <Link href="/app/passaporte" className="text-link">
            Abrir meu passaporte <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <div className="home-stat-grid">
        <Link className="home-stat card" href="/app/inscricoes">
          <span className="shortcut-icon">
            <Ticket />
          </span>
          <span>
            <small>Minhas inscrições</small>
            <strong>
              {
                (data.enrollments || []).filter((e: any) =>
                  ["ACTIVE", "COMPLETED"].includes(e.status),
                ).length
              }{" "}
              atividades
            </strong>
          </span>
          <ChevronRight />
        </Link>
        <Link className="home-stat card" href="/app/passaporte">
          <span className="shortcut-icon gold">
            <MapPin />
          </span>
          <span>
            <small>Check-ins realizados</small>
            <strong>
              {count} de {total}
            </strong>
          </span>
          <ChevronRight />
        </Link>
      </div>
      <div className="section-heading">
        <h2>
          Últimos carimbos <span aria-hidden="true">✦</span>
        </h2>
        <Link className="text-link" href="/app/passaporte">
          Ver todos <ChevronRight size={16} />
        </Link>
      </div>
      <div className="recent-stamps passport-frame">
        {stamps.slice(-3).map((stamp: any) => {
          const activity = data.activities.find(
            (a: any) => a.id === stamp.activityId,
          );
          const category = categoryOf(data, activity || {});
          return (
            <Link href="/app/passaporte" key={stamp.id}>
              <img
                src={activity?.stampUrl || category.stampUrl}
                alt={`Carimbo ${category.name}`}
              />
              <strong>{category.name}</strong>
              <span>
                {activity
                  ? formatDate(activity.startAt, data.edition.timezone)
                  : "Concluído"}
              </span>
            </Link>
          );
        })}
        {!stamps.length && <p>Seus carimbos conquistados aparecerão aqui.</p>}
      </div>
      <div className="home-action-grid">
        <Link className="home-action card" href="/app/certificados">
          <span className="shortcut-icon">
            <BookOpen />
          </span>
          <span>
            <strong>Certificados disponíveis</strong>
            <small>{data.certificates?.length || 0} certificados</small>
          </span>
          <ChevronRight />
        </Link>
        <Link className="home-action card" href="/app/brindes">
          <span className="shortcut-icon gold">
            <Gift />
          </span>
          <span>
            <strong>Brindes elegíveis</strong>
            <small>Acompanhar benefícios</small>
          </span>
          <ChevronRight />
        </Link>
      </div>
      <div className="cathedral-story">
        <p>“ Sua presença constrói conhecimento. ”</p>
        <img
          src="/assets/brand/cathedral-fachada-trimmed.webp"
          alt="Fachada da Faculdade Cathedral"
        />
        <span>
          Saúde
          <br />
          em movimento.
        </span>
      </div>
    </>
  );
}

function Programacao({ onlyMine = false }: { onlyMine?: boolean }) {
  const { data } = useJornadas();
  const [category, setCategory] = useState(""),
    [search, setSearch] = useState(""),
    [date, setDate] = useState("");
  const dates: Array<string> = Array.from(
    new Set((data.activities || []).map((a: any) => a.startAt.slice(0, 10))),
  );
  const activities = (data.activities || [])
    .filter(
      (a: any) =>
        a.status !== "DRAFT" &&
        (!onlyMine ||
          ownEnrollment(data, a.id) ||
          (data.waitlist || []).some(
            (w: any) => w.activityId === a.id && w.status === "WAITING",
          )) &&
        (!category || a.categoryId === category) &&
        (!date || a.startAt.slice(0, 10) === date) &&
        (!search || a.title.toLowerCase().includes(search.toLowerCase())),
    )
    .sort((a: any, b: any) => a.startAt.localeCompare(b.startAt));
  return (
    <>
      <PageHeading
        eyebrow="ESCOLHA SEU PRÓXIMO ENCONTRO"
        title={onlyMine ? "Minhas inscrições" : "Programação"}
        description={
          onlyMine
            ? "Organize seus encontros e acompanhe suas vagas."
            : "Encontros que conectam ciência, prática e novas possibilidades."
        }
      />
      <div className="schedule-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Buscar atividade"
            placeholder="Buscar uma atividade"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Filtrar por data"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        >
          <option value="">Todas as datas</option>
          {dates.map((d) => (
            <option key={d} value={d}>
              {formatDate(d + "T12:00:00Z", data.edition.timezone, true)}
            </option>
          ))}
        </select>
        {!onlyMine && (
          <Link href="/app/inscricoes" className="button secondary small">
            <Ticket size={16} />
            Minhas inscrições
          </Link>
        )}
      </div>
      <div className="filter-chips" role="group" aria-label="Categorias">
        <button
          className={!category ? "active" : ""}
          onClick={() => setCategory("")}
        >
          Todas
        </button>
        {data.categories
          ?.filter((c: any) => c.active)
          .map((c: any) => (
            <button
              key={c.id}
              className={category === c.id ? "active" : ""}
              onClick={() => setCategory(c.id)}
            >
              <span style={{ background: c.color }} />
              {c.name}
            </button>
          ))}
      </div>
      <div className="results-meta">
        {activities.length}{" "}
        {activities.length === 1 ? "atividade" : "atividades"}
        {onlyMine ? " na sua jornada" : " nesta seleção"}
      </div>
      {activities.length ? (
        <div className="activity-grid">
          {activities.map((a: any) => (
            <ActivityCard key={a.id} activity={a} />
          ))}
        </div>
      ) : (
        <Empty
          title={
            onlyMine
              ? "Sua jornada está esperando o primeiro encontro."
              : "Nenhuma atividade nesta seleção."
          }
        >
          {onlyMine ? (
            <Link className="button secondary" href="/app/programacao">
              Explorar programação
            </Link>
          ) : (
            "Tente outra categoria ou data."
          )}
        </Empty>
      )}
    </>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );
}
function ActivityCard({ activity }: { activity: any }) {
  const { data } = useJornadas();
  const c = categoryOf(data, activity),
    speakers = speakersOf(data, activity),
    enrollment = ownEnrollment(data, activity.id),
    attendance = ownAttendance(data, activity.id),
    waiting = data.waitlist?.find(
      (w: any) => w.activityId === activity.id && w.status === "WAITING",
    );
  const seats = Math.max(0, activity.capacity - (activity.enrolledCount || 0));
  const ended = new Date(data.serverNow) > new Date(activity.endAt);
  return (
    <article
      className="activity-card card"
      style={
        { "--category-color": c.color || "var(--teal)" } as React.CSSProperties
      }
    >
      <div className="activity-stamp">
        <img
          src={activity.stampUrl || c.stampUrl}
          alt={`Carimbo de ${c.name}`}
        />
      </div>
      <div className="row-between">
        <span className="category-label">
          <i />
          {c.name}
        </span>
        {attendance ? (
          <Badge tone="success">
            <Check size={12} />
            Presença confirmada
          </Badge>
        ) : activity.status === "CANCELLED" ? (
          <Badge tone="danger">Cancelada</Badge>
        ) : isLive(data, activity) ? (
          <Badge tone="live">Acontecendo agora</Badge>
        ) : enrollment ? (
          <Badge tone="success">Inscrito</Badge>
        ) : waiting ? (
          <Badge tone="warning">Na lista de espera</Badge>
        ) : ended ? (
          <Badge>Encerrada</Badge>
        ) : seats === 0 ? (
          <Badge>Lotado</Badge>
        ) : seats <= 3 ? (
          <Badge tone="warning">Últimas vagas</Badge>
        ) : null}
      </div>
      <Link href={`/app/programacao/${activity.id}`} className="activity-title">
        <h2>{activity.title}</h2>
      </Link>
      {speakers.length > 0 ? (
        <div className="speaker-mini">
          <Avatar
            name={speakers[0].name}
            url={speakers[0].photoUrl}
            size="tiny"
          />
          <span>{speakers.map((s: any) => s.name).join(" · ")}</span>
        </div>
      ) : (
        <p className="activity-excerpt">{activity.description}</p>
      )}
      <ActivityMeta activity={activity} timezone={data.edition.timezone} />
      <div className="activity-card-bottom">
        <span>
          {seats} de {activity.capacity} vagas
        </span>
        <Link href={`/app/programacao/${activity.id}`} className="text-link">
          Ver detalhes <ArrowRight size={17} />
        </Link>
      </div>
    </article>
  );
}
function ActivityDetail({ id }: { id: string }) {
  const { data, action } = useJornadas();
  const [busy, setBusy] = useState(false),
    [swap, setSwap] = useState(false),
    [swapId, setSwapId] = useState("");
  const activity = data.activities?.find((a: any) => a.id === id);
  if (!activity) return <Empty title="Atividade não encontrada" />;
  const c = categoryOf(data, activity),
    enrollment = ownEnrollment(data, id),
    attendance = ownAttendance(data, id),
    waiting = data.waitlist?.find(
      (w: any) => w.activityId === id && w.status === "WAITING",
    );
  const seats = Math.max(0, activity.capacity - (activity.enrolledCount || 0));
  const closed =
    ["CANCELLED", "DRAFT", "FINISHED"].includes(activity.status) ||
    new Date(data.serverNow) >
      new Date(
        activity.enrollmentDeadline ||
          new Date(
            new Date(activity.startAt).getTime() +
              data.edition.lateMinutes * 60000,
          ).toISOString(),
      ) ||
    activity.enrollmentOpen === false;
  async function run(name: string, payload: any) {
    setBusy(true);
    try {
      await action(name, payload);
      setSwap(false);
    } catch {
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" href="/app/programacao">
        <ArrowLeft size={17} /> Programação
      </Link>
      <section className="detail-hero">
        <span className="category-label">
          <i style={{ background: c.color }} />
          {c.name}
        </span>
        <h1>{activity.title}</h1>
        <ActivityMeta activity={activity} timezone={data.edition.timezone} />
        {isLive(data, activity) && <Badge tone="live">Acontecendo agora</Badge>}
      </section>
      <div className="detail-grid">
        <div className="stack">
          <section className="card detail-section">
            <h2>Sobre este encontro</h2>
            <p className="preserve-lines">
              {activity.description ||
                "Uma atividade da sua Jornada Farmacêutica."}
            </p>
            <div className="detail-facts">
              <div>
                <Clock3 size={19} />
                <span>
                  Carga horária<strong>{activity.workload} horas</strong>
                </span>
              </div>
              <div>
                <MapPin size={19} />
                <span>
                  Local
                  <strong>
                    {activity.block} · {activity.room}
                  </strong>
                </span>
              </div>
            </div>
          </section>
          {speakersOf(data, activity).map((s: any) => (
            <section className="card speaker-profile" key={s.id}>
              <Avatar name={s.name} url={s.photoUrl} size="large" />
              <div>
                <span className="eyebrow">QUEM CONDUZ O ENCONTRO</span>
                <h2>{s.name}</h2>
                <p>{s.institution}</p>
                <p>{s.bio}</p>
                {s.curriculumUrl && (
                  <ExternalLink href={s.curriculumUrl}>
                    Ver currículo
                  </ExternalLink>
                )}
              </div>
            </section>
          ))}
          {c.requiresCheckout && (
            <div className="info-note">
              <ShieldCheck size={21} />
              <p>
                Esta atividade exige entrada e saída registradas pela equipe. O
                check-out abre {data.edition.checkoutMinutes} minutos antes do
                fim. Certificados ficam disponíveis após o encerramento da
                edição.
              </p>
            </div>
          )}
        </div>
        <aside className="card enrollment-panel">
          <span className="eyebrow">SUA PARTICIPAÇÃO</span>
          {attendance ? (
            <>
              <span className="big-check">
                <CheckCircle2 size={38} />
              </span>
              <h2>Presença confirmada</h2>
              <p>
                Entrada registrada às{" "}
                {formatTime(attendance.checkinAt, data.edition.timezone)}.
              </p>
              {attendance.checkoutAt && (
                <Badge tone="success">
                  Saída confirmada às{" "}
                  {formatTime(attendance.checkoutAt, data.edition.timezone)}
                </Badge>
              )}
              <Link href="/app/passaporte" className="button full">
                Ver meu carimbo <BookOpen size={17} />
              </Link>
            </>
          ) : enrollment ? (
            <>
              <h2>Sua vaga está confirmada.</h2>
              <p>Apresente seu RA à equipe ao chegar.</p>
              <Badge status={enrollment.status} />
              <button
                disabled={busy || closed}
                className="button secondary full"
                onClick={() => setSwap(true)}
              >
                Trocar atividade
              </button>
              <button
                disabled={busy || closed}
                className="button ghost full"
                onClick={() =>
                  run("enrollment.cancel", { enrollmentId: enrollment.id })
                }
              >
                Cancelar inscrição
              </button>
            </>
          ) : waiting ? (
            <>
              <h2>Você está na lista de espera.</h2>
              <p>
                Quando uma vaga for liberada, o primeiro participante elegível
                será inscrito automaticamente.
              </p>
              <Badge tone="warning">
                Posição {waiting.position || "na fila"}
              </Badge>
              <button
                disabled={busy}
                className="button secondary full"
                onClick={() => run("waitlist.leave", { activityId: id })}
              >
                Sair da lista de espera
              </button>
            </>
          ) : (
            <>
              <div className="seat-number">
                {seats}
                <span>vagas disponíveis</span>
              </div>
              <p>Capacidade: {activity.capacity} participantes</p>
              {closed ? (
                <Badge>
                  {activity.status === "CANCELLED"
                    ? "Atividade cancelada"
                    : "Inscrições encerradas"}
                </Badge>
              ) : seats > 0 ? (
                <button
                  disabled={busy}
                  className="button full"
                  onClick={() => run("enrollment.create", { activityId: id })}
                >
                  {busy ? "Confirmando…" : "Inscrever-se"}
                  <ArrowRight size={17} />
                </button>
              ) : activity.allowWaitlist ? (
                <button
                  disabled={busy}
                  className="button secondary full"
                  onClick={() => run("waitlist.join", { activityId: id })}
                >
                  {busy ? "Entrando…" : "Entrar na lista de espera"}
                </button>
              ) : (
                <Badge>Lotado</Badge>
              )}
            </>
          )}
          <p className="fine-print">
            As vagas e os horários são validados pela organização em cada
            confirmação.
          </p>
        </aside>
      </div>
      {swap && (
        <Modal title="Trocar atividade" onClose={() => setSwap(false)}>
          <p>
            Sua inscrição atual será mantida se a nova vaga não puder ser
            confirmada.
          </p>
          <label className="field">
            Nova atividade
            <select value={swapId} onChange={(e) => setSwapId(e.target.value)}>
              <option value="">Selecione uma atividade</option>
              {data.activities
                .filter(
                  (a: any) =>
                    a.id !== id &&
                    a.status !== "CANCELLED" &&
                    a.status !== "DRAFT",
                )
                .map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.title} · {formatTime(a.startAt, data.edition.timezone)}
                  </option>
                ))}
            </select>
          </label>
          <button
            disabled={busy || !swapId}
            className="button full"
            onClick={() =>
              run("enrollment.swap", {
                enrollmentId: enrollment.id,
                activityId: swapId,
              })
            }
          >
            Confirmar troca
          </button>
        </Modal>
      )}
    </>
  );
}

function Passport({ person }: { person: any }) {
  const { data } = useJornadas();
  const stamps = validStamps(data),
    stampSignature = stamps.map((stamp: any) => stamp.id).join(","),
    seen = useRef<Set<string> | null>(null),
    [newIds, setNewIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const current = new Set<string>(
      stampSignature ? stampSignature.split(",") : [],
    );
    if (seen.current) {
      const added = new Set<string>(
        [...current].filter((id) => !seen.current!.has(id)),
      );
      if (added.size) setNewIds(added);
    }
    seen.current = current;
  }, [stampSignature]);
  const activities = (data.activities || [])
    .filter(
      (a: any) =>
        a.status !== "DRAFT" && categoryOf(data, a).generatesStamp !== false,
    )
    .sort(
      (a: any, b: any) =>
        Number(!!ownAttendance(data, b.id)) -
          Number(!!ownAttendance(data, a.id)) ||
        a.startAt.localeCompare(b.startAt),
    );
  return (
    <>
      <div className="passport-page-heading">
        <PageHeading
          eyebrow="CADA ENCONTRO DEIXA UMA MARCA"
          title="Passaporte Digital"
          description="Suas experiências, guardadas em cada carimbo."
        />
        <span className="passport-edition-tag">EDIÇÃO {data.edition.year}</span>
      </div>
      <section className="passport">
        <div className="passport-brand">
          <img
            src={
              data.edition.logoUrl ||
              "/assets/brand/logo-jornada-2026-trimmed.webp"
            }
            alt={data.edition.name}
          />
          <span>CONHECIMENTO · CONEXÕES · FUTURO</span>
        </div>
        <div className="passport-identity">
          <Avatar name={person.name} url={person.photoUrl} />
          <div>
            <h2>{person.name}</h2>
            <span>
              RA {person.ra}
              <i /> {person.semester}º semestre
            </span>
          </div>
          <span className="identity-label">PARTICIPANTE</span>
        </div>
        <div className="passport-progress">
          <div>
            <BookOpen size={20} />
            <h3>Carimbos da Jornada</h3>
          </div>
          <span className="passport-progress-summary">
            <strong>
              {stamps.length} de {data.edition.maxCheckins}
            </strong>
            <small>atividades concluídas</small>
          </span>
        </div>
        <div className="stamp-grid">
          {activities.map((a: any) => {
            const stamp = stamps.find((s: any) => s.activityId === a.id);
            const c = categoryOf(data, a);
            const image = a.stampUrl || c.stampUrl;
            const repeatsCategory = a.title
              .toLocaleLowerCase("pt-BR")
              .startsWith(c.name.toLocaleLowerCase("pt-BR"));
            const stampTitle = repeatsCategory
              ? a.title.slice(c.name.length).replace(/^[\s·:–—-]+/, "") ||
                a.title
              : a.title;
            return (
              <Link
                href={`/app/programacao/${a.id}`}
                className={`stamp-cell ${stamp ? "earned" : "unearned"} ${stamp && newIds.has(stamp.id) ? "stamp-arrived" : ""}`}
                key={a.id}
              >
                {stamp ? (
                  <div className="stamp-art">
                    {image ? (
                      <img
                        src={image}
                        alt={`Carimbo de ${c.name}`}
                        loading="lazy"
                      />
                    ) : (
                      <BookOpen size={48} />
                    )}
                    <span className="stamp-check">
                      <Check size={12} />
                    </span>
                  </div>
                ) : (
                  <div className="stamp-placeholder">
                    {image ? (
                      <img src={image} alt="" loading="lazy" />
                    ) : (
                      <BookOpen size={48} />
                    )}
                    <span>A CONQUISTAR</span>
                  </div>
                )}
                <span className="stamp-category">{c.name}</span>
                <h3>{stampTitle}</h3>
                <span className="stamp-date">
                  {formatDate(a.startAt, data.edition.timezone)} ·{" "}
                  {formatTime(a.startAt, data.edition.timezone)}
                </span>
                {stamp && (
                  <span className="stamp-record">Presença confirmada</span>
                )}
              </Link>
            );
          })}
        </div>
        {activities.length === 0 && (
          <Empty title="Os próximos carimbos estão a caminho.">
            As atividades desta edição aparecerão aqui.
          </Empty>
        )}
        <div className="passport-note">
          <ShieldCheck size={18} />
          <span>
            Este passaporte é a referência digital da sua presença.
            <br />
            Apresente-o à equipe para solicitar o carimbo físico.
          </span>
        </div>
        <div className="passport-institution">
          <img
            src="/assets/brand/cathedral-fachada-trimmed.webp"
            alt="Fachada da Faculdade Cathedral"
          />
          <span>
            Ciência hoje.
            <br />
            <em>Saúde sempre.</em>
          </span>
        </div>
      </section>
    </>
  );
}

function rewardImage(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("chave")) return "/assets/rewards/chaveiro.webp";
  if (normalized.includes("caneta")) return "/assets/rewards/caneta.webp";
  if (normalized.includes("bloco")) return "/assets/rewards/bloco.webp";
  if (normalized.includes("bot")) return "/assets/rewards/botton.webp";
  if (normalized.includes("eco")) return "/assets/rewards/ecobag.webp";
  if (normalized.includes("garrafa")) return "/assets/rewards/garrafa.webp";
  return "";
}

function Rewards({ id }: { id?: string }) {
  const { data, action } = useJornadas();
  const [busy, setBusy] = useState("");
  const count = validStamps(data).length;
  const items = (data.rewards || []).filter(
    (r: any) => r.active !== false && (!id || r.id === id),
  );
  return (
    <>
      <PageHeading
        eyebrow="PEQUENAS CONQUISTAS, GRANDES LEMBRANÇAS"
        title="Brindes e resgates"
        description="Acompanhe sua elegibilidade e os brindes da edição."
      />
      <div className="reward-progress-strip">
        <Gift size={23} />
        <span>
          <strong>
            {count} {count === 1 ? "check-in" : "check-ins"}
          </strong>{" "}
          na sua jornada
        </span>
        <span>
          {count} de {data.edition.maxCheckins} atividades concluídas
        </span>
      </div>
      <div className="reward-grid">
        {items.map((r: any) => {
          const rule = (data.rules || []).find(
            (rule: any) => rule.rewardId === r.id,
          );
          const reservation = (data.reservations || [])
            .filter((x: any) => x.rewardId === r.id)
            .sort((a: any, b: any) =>
              b.createdAt?.localeCompare(a.createdAt),
            )[0];
          const eligibility = (data.eligibilities || []).find(
            (e: any) => e.rewardId === r.id,
          );
          const status =
            reservation?.status ||
            r.eligibilityStatus ||
            eligibility?.status ||
            (count >= (rule?.minCheckins ?? Infinity)
              ? "ELIGIBLE"
              : "NOT_ELIGIBLE");
          const needsConfirm =
            reservation &&
            ["PENDING", "AWAITING_CONFIRMATION", "SELECTED"].includes(status);
          const imageUrl = r.imageUrl || rewardImage(r.name);
          const required = rule?.minCheckins ?? data.edition.maxCheckins;
          const c = rule?.categoryId
            ? data.categories.find((c: any) => c.id === rule.categoryId)
            : null;
          const a = rule?.activityId
            ? data.activities.find((a: any) => a.id === rule.activityId)
            : null;
          return (
            <article className="reward-card card" key={r.id}>
              <div className={`reward-image ${!imageUrl ? "no-image" : ""}`}>
                {imageUrl ? (
                  <img src={imageUrl} alt={r.name} loading="lazy" />
                ) : (
                  <>
                    <Gift size={44} strokeWidth={1.2} />
                    <span>Imagem a ser cadastrada</span>
                  </>
                )}
                <span className="reward-stock">
                  {r.total} unidades na edição
                </span>
              </div>
              <div className="reward-card-content">
                <div className="row-between">
                  <h2>{r.name}</h2>
                  <Badge status={status} />
                </div>
                <p>{r.description}</p>
                <div className="reward-rule">
                  <CheckCircle2 size={15} />
                  <span>
                    {rule?.completeJourney
                      ? "Jornada completa"
                      : `Mínimo de ${rule?.minCheckins ?? 0} ${rule?.minCheckins === 1 ? "check-in" : "check-ins"}`}
                    {c ? ` · ${c.name}` : ""}
                    {a ? ` · ${a.title}` : ""}
                  </span>
                </div>
                <div
                  className="reward-progress"
                  aria-label={`${Math.min(count, required)} de ${required} requisitos concluídos`}
                >
                  <span
                    style={{
                      width: `${Math.min(100, (count / Math.max(1, required)) * 100)}%`,
                    }}
                  />
                </div>
                <div className="reward-availability">
                  <span>
                    Disponíveis:{" "}
                    <b>{r.available ?? r.availableStock ?? r.total}</b>
                  </span>
                  <span>A quantidade pode variar.</span>
                </div>
                {needsConfirm && (
                  <>
                    <p className="reward-deadline">
                      Confirme até{" "}
                      {formatTime(reservation.expiresAt, data.edition.timezone)}{" "}
                      de{" "}
                      {formatDate(reservation.expiresAt, data.edition.timezone)}
                      .
                    </p>
                    <button
                      className="button full"
                      disabled={busy === r.id}
                      onClick={async () => {
                        setBusy(r.id);
                        try {
                          await action("reservation.confirm", {
                            reservationId: reservation.id,
                          });
                        } catch {
                        } finally {
                          setBusy("");
                        }
                      }}
                    >
                      {busy === r.id ? "Confirmando…" : "Confirmar brinde"}
                      <Check size={17} />
                    </button>
                  </>
                )}
                {["CONFIRMED", "RESERVED", "AVAILABLE"].includes(status) &&
                  reservation && (
                    <div className="reward-ready">
                      <CheckCircle2 size={18} />
                      Seu brinde está confirmado. Apresente seu RA à equipe de
                      retirada.
                    </div>
                  )}
                {status === "DELIVERED" && (
                  <div className="reward-ready">
                    <Check size={18} />
                    Brinde entregue. Leve esta lembrança com você!
                  </div>
                )}
                {status === "EXPIRED" && (
                  <p className="fine-print">
                    O prazo de confirmação terminou. Acompanhe as próximas
                    rodadas.
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!items.length && (
        <Empty title="Novas lembranças estão a caminho.">
          Os brindes cadastrados pela organização aparecerão aqui.
        </Empty>
      )}
      <div className="info-note">
        <ShieldCheck size={20} />
        <p>
          Quando o número de elegíveis superar o estoque, haverá sorteio. Sua
          participação nas atividades continua independente dos brindes.
        </p>
      </div>
    </>
  );
}

function Profile({ person }: { person: any }) {
  const { data, action, toast } = useJornadas();
  const router = useRouter();
  const [uploading, setUploading] = useState(false),
    [pushStatus, setPushStatus] = useState("");
  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", "avatar");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      await action("participant.photo", { photoUrl: result.url });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  async function enablePush() {
    try {
      if (!("Notification" in window) || !("PushManager" in window))
        throw new Error(
          "Este navegador não oferece notificações push. Seus avisos continuam disponíveis no aplicativo.",
        );
      const config = await fetch("/api/push").then((r) => r.json());
      if (!config.publicKey)
        throw new Error(
          "O envio push será ativado quando a organização configurar o serviço. Os avisos no aplicativo já estão disponíveis.",
        );
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw new Error("Permissão de notificações não concedida.");
      const registration = await navigator.serviceWorker.ready;
      const padding = "=".repeat((4 - (config.publicKey.length % 4)) % 4);
      const raw = atob(
        (config.publicKey + padding).replace(/-/g, "+").replace(/_/g, "/"),
      );
      const applicationServerKey = Uint8Array.from(raw, (c: string) =>
        c.charCodeAt(0),
      );
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!res.ok) throw new Error("Não foi possível ativar as notificações.");
      setPushStatus("Notificações ativadas.");
    } catch (e) {
      setPushStatus((e as Error).message);
    }
  }
  return (
    <>
      <PageHeading eyebrow="SEU ESPAÇO NA JORNADA" title="Meu perfil" />
      <section className="profile-card card">
        <div className="profile-top">
          <Avatar name={person.name} url={person.photoUrl} size="large" />
          <div>
            <h2>{person.name}</h2>
            <p>{data.edition.name}</p>
            <label className="text-link photo-upload">
              <Upload size={15} />
              {uploading ? "Enviando…" : "Alterar foto"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploading}
                onChange={(e) =>
                  e.target.files?.[0] && upload(e.target.files[0])
                }
              />
            </label>
          </div>
        </div>
        <dl className="profile-data">
          <div>
            <dt>Nome completo</dt>
            <dd>{person.name}</dd>
          </div>
          <div>
            <dt>Registro acadêmico</dt>
            <dd>{person.ra}</dd>
          </div>
          <div>
            <dt>Semestre</dt>
            <dd>{person.semester}º semestre</dd>
          </div>
          <div>
            <dt>Participação</dt>
            <dd>
              <Badge tone="success">
                {person.active === false
                  ? "Inativo"
                  : "Participante cadastrado"}
              </Badge>
            </dd>
          </div>
        </dl>
        <p className="fine-print">
          Para corrigir nome, RA ou semestre, procure a organização.
        </p>
      </section>
      <div className="profile-metrics">
        <article className="card">
          <span className="shortcut-icon">
            <Ticket />
          </span>
          <small>Atividades inscritas</small>
          <strong>
            {
              (data.enrollments || []).filter((e: any) =>
                ["ACTIVE", "COMPLETED"].includes(e.status),
              ).length
            }
          </strong>
        </article>
        <article className="card">
          <span className="shortcut-icon gold">
            <CalendarDays />
          </span>
          <small>Presenças</small>
          <strong>
            {(data.attendances || []).filter((a: any) => a.checkinAt).length}
          </strong>
        </article>
        <article className="card">
          <span className="shortcut-icon">
            <Sparkles />
          </span>
          <small>Carimbos</small>
          <strong>{validStamps(data).length}</strong>
        </article>
        <article className="card">
          <span className="shortcut-icon sage">
            <BookOpen />
          </span>
          <small>Certificados</small>
          <strong>{data.certificates?.length || 0}</strong>
        </article>
      </div>
      <div className="profile-links">
        <Link href="/app/certificados" className="profile-link card">
          <span>
            <BookOpen size={21} />
            <strong>Meus certificados</strong>
          </span>
          <ChevronRight size={19} />
        </Link>
        <Link href="/app/notificacoes" className="profile-link card">
          <span>
            <Bell size={21} />
            <strong>Central de notificações</strong>
          </span>
          <ChevronRight size={19} />
        </Link>
        <button className="profile-link card" onClick={enablePush}>
          <span>
            <Bell size={21} />
            <strong>Ativar notificações no dispositivo</strong>
          </span>
          <ChevronRight size={19} />
        </button>
        {pushStatus && (
          <p className="info-note" role="status">
            {pushStatus}
          </p>
        )}
        <button
          className="profile-link card"
          onClick={async () => {
            await fetch("/api/auth?kind=participant", { method: "DELETE" });
            router.replace("/login/participante");
            router.refresh();
          }}
        >
          <span>
            <LogOut size={21} />
            <strong>Sair da minha conta</strong>
          </span>
          <ChevronRight size={19} />
        </button>
      </div>
    </>
  );
}
function Notifications() {
  const { data, action } = useJornadas();
  return (
    <>
      <PageHeading
        eyebrow="FIQUE POR DENTRO"
        title="Notificações"
        description="Atualizações da organização e da sua participação."
      />
      {data.notifications?.length ? (
        <div className="notification-list">
          {data.notifications.map((n: any) => (
            <article
              className={`notification-card card ${!n.readAt && !n.read ? "not-read" : ""}`}
              key={n.id}
            >
              <span className="notice-icon">
                <Bell size={20} />
              </span>
              <div>
                <div className="row-between">
                  <h2>{n.title}</h2>
                  <span className="fine-print">
                    {formatDate(n.createdAt, data.edition.timezone)} ·{" "}
                    {formatTime(n.createdAt, data.edition.timezone)}
                  </span>
                </div>
                <p>{n.message || n.body}</p>
                {!n.readAt && !n.read && (
                  <button
                    className="text-link"
                    onClick={() =>
                      action("notification.read", { id: n.id }).catch(() => {})
                    }
                  >
                    <Check size={14} />
                    Marcar como lida
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Tudo em dia por aqui.">
          Você receberá avisos sobre atividades, inscrições e conquistas.
        </Empty>
      )}
    </>
  );
}
function Certificates() {
  const { data } = useJornadas();
  const ended = new Date(data.serverNow) > new Date(data.edition.endAt);
  return (
    <>
      <PageHeading
        eyebrow="RECONHECIMENTO DO SEU CAMINHO"
        title="Meus certificados"
        description="O registro de cada experiência de aprendizado."
      />
      {!ended && (
        <div className="info-note">
          <Clock3 size={21} />
          <p>
            Os certificados serão liberados após o encerramento da edição, em{" "}
            {formatDate(data.edition.endAt, data.edition.timezone, true)}.
            Palestras exigem check-in e check-out válidos.
          </p>
        </div>
      )}
      {data.certificates?.length ? (
        <div className="stack">
          {data.certificates.map((c: any) => (
            <article key={c.id} className="card certificate-card">
              <span className="shortcut-icon gold">
                <BookOpen />
              </span>
              <div>
                <h2>
                  {data.activities.find((a: any) => a.id === c.activityId)
                    ?.title || "Certificado de participação"}
                </h2>
                <p>
                  {c.workload} horas · <Badge status={c.status} />
                </p>
                {c.validationCode && (
                  <span className="fine-print">
                    Validação: {c.validationCode}
                  </span>
                )}
              </div>
              {ended && ["RELEASED", "GENERATED"].includes(c.status) && (
                <a
                  className="button secondary"
                  href={`/api/certificates/${c.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download size={17} />
                  Baixar PDF
                </a>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Suas conquistas serão reconhecidas aqui.">
          A organização disponibilizará os certificados elegíveis após o evento.
        </Empty>
      )}
    </>
  );
}
