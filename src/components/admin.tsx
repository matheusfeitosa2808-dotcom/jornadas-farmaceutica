"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  Award,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Gift,
  Home,
  Layers3,
  ListFilter,
  LogOut,
  Menu,
  Package,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trash2,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useJornadas } from "@/components/provider";
import LoadingScreen from "@/components/loading-screen";
import FarmaArenaStamp from "@/components/farma-arena-stamp";
import {
  FARMA_ARENA_STAMP_URL,
  isFarmaArena,
  isLegacyFarmaArenaStamp,
} from "@/lib/farma-arena";
import { readApiResponse } from "@/lib/api-response";
import "./admin.css";
import "./admin-motion.css";

type Row = Record<string, any>;
type Option = { value: string; label: string };
type Field = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: Option[];
  source?: string;
  help?: string;
  default?: any;
  wide?: boolean;
  min?: number;
  max?: number;
  step?: number;
  accept?: string;
};
type EntityConfig = {
  entity: string;
  collection: string;
  singular: string;
  title: string;
  description: string;
  fields: Field[];
  columns: {
    key: string;
    label: string;
    render?: (r: Row, d: Row) => ReactNode;
  }[];
};
const labels: Record<string, string> = {
  ACTIVE: "Ativo",
  OPEN: "Inscrições abertas",
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  FINISHED: "Encerrado",
  ARCHIVED: "Arquivado",
  CANCELLED: "Cancelado",
  COMPLETED: "Concluído",
  NO_SHOW: "Ausente",
  WAITING: "Na fila",
  PROMOTED: "Promovido",
  REMOVED: "Removido",
  FULL: "Lotado",
  WAITLIST: "Lista de espera",
  IN_PROGRESS: "Em andamento",
  VALID: "Válido",
  PRESENT: "Presente",
  PENDING: "Pendente",
  ELIGIBLE: "Elegível",
  GENERATED: "Gerado",
  RELEASED: "Disponível",
  INVALIDATED: "Invalidado",
  AWAITING_CONFIRMATION: "Aguardando confirmação",
  RESERVED: "Reservado",
  DELIVERED: "Entregue",
  EXPIRED: "Expirado",
  REVERSED: "Revertido",
  ADMIN_GENERAL: "Administrador geral",
  ORGANIZATION: "Organização",
  OPERATOR: "Operador",
  MIN_CHECKINS: "Mínimo de check-ins",
  CATEGORY: "Categoria concluída",
  ACTIVITY: "Atividade específica",
  FULL_JOURNEY: "Jornada completa",
  SPECIAL: "Regra especial",
};
const opts = (...values: string[]): Option[] =>
  values.map((value) => ({ value, label: labels[value] || value }));
const all = (data: Row | null | undefined, key: string): Row[] =>
  Array.isArray(data?.[key]) ? data[key] : [];
const find = (data: Row, key: string, id: string): Row =>
  all(data, key).find((r) => r.id === id) || {};
const person = (data: Row, id: string) =>
  find(data, "participants", id).fullName ||
  find(data, "participants", id).name ||
  "Participante";
const title = (data: Row, id: string) =>
  find(data, "activities", id).title || "Atividade";
const name = (r: Row) => r.fullName || r.name || r.title || r.id || "—";
const validAttendance = (r: Row) =>
  Boolean(r.checkinAt || r.checkInAt) &&
  !["CANCELLED", "INVALIDATED"].includes(r.status);
function dt(value: any, zone = "America/Manaus", timeOnly = false) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: zone,
    ...(timeOnly ? {} : { day: "2-digit", month: "short" }),
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
function localDate(value: any, zone: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return parts.replace(" ", "T");
}
function utcDate(value: string, zone: string) {
  if (!value) return null;
  const initial = Date.parse(value + "Z");
  let result = initial;
  for (let i = 0; i < 2; i++) {
    const rendered = localDate(new Date(result).toISOString(), zone);
    result += initial - Date.parse(rendered + "Z");
  }
  return new Date(result).toISOString();
}
function Badge({ value }: { value: any }) {
  const v =
    value === true
      ? "ACTIVE"
      : value === false
        ? "Inativo"
        : String(value || "PENDING");
  return (
    <span className={`a-badge a-status-${v.toLowerCase()}`}>
      {labels[v] || v}
    </span>
  );
}
function Empty({
  children = "Nenhum registro por aqui ainda.",
}: {
  children?: ReactNode;
}) {
  return (
    <div className="a-empty">
      <Layers3 size={30} strokeWidth={1.4} />
      <p>{children}</p>
    </div>
  );
}
function Avatar({ row }: { row: Row }) {
  return row.photoUrl ? (
    <img className="a-avatar" src={row.photoUrl} alt={`Foto de ${name(row)}`} />
  ) : (
    <span className="a-avatar">
      <UserRound size={19} />
    </span>
  );
}
function Table({
  columns,
  rows,
  data,
  empty,
  rowKey = "id",
}: {
  columns: EntityConfig["columns"];
  rows: Row[];
  data: Row;
  empty?: ReactNode;
  rowKey?: string;
}) {
  return (
    <div className="a-table-wrap">
      <table className="a-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row[rowKey] || i}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.render ? c.render(row, data) : (row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty>{empty}</Empty>}
    </div>
  );
}
function Panel({
  title: heading,
  sub,
  children,
  actions,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="a-panel">
      <div className="a-panel-heading">
        <div>
          <h2>{heading}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
function PageTitle({
  title: heading,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="a-page-title">
      <div>
        <p className="a-eyebrow">ESPAÇO DA ORGANIZAÇÃO</p>
        <h1>{heading}</h1>
        <p>{description}</p>
      </div>
      <div className="a-actions">{children}</div>
    </div>
  );
}
function Dialog({
  title: heading,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`a-dialog ${wide ? "a-dialog-wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="a-dialog-heading">
        <h2>{heading}</h2>
        <button
          type="button"
          className="a-icon-button"
          aria-label="Fechar janela"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function RunButton({
  run,
  children,
  className = "button",
  disabled,
}: {
  run: () => Promise<any>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const { toast } = useJornadas();
  return (
    <button
      disabled={disabled || busy}
      className={className}
      onClick={async () => {
        setBusy(true);
        try {
          await run();
        } catch (e: any) {
          toast(e.message || "Não foi possível concluir.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <span className="a-spinner" /> : null}
      {children}
    </button>
  );
}
function ReasonButton({
  title: heading,
  children,
  run,
  className = "a-text-button",
  extra,
  confirmLabel = "Confirmar alteração",
}: {
  title: string;
  children: ReactNode;
  run: (reason: string) => Promise<any>;
  className?: string;
  extra?: ReactNode;
  confirmLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && (
        <Dialog title={heading} onClose={() => setOpen(false)}>
          <div className="a-form-body">
            {extra}
            <label className="field">
              Motivo obrigatório
              <textarea
                required
                minLength={5}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Descreva o motivo desta alteração"
              />
            </label>
            <p className="a-help">
              A alteração e seu motivo ficam registrados na auditoria.
            </p>
          </div>
          <div className="a-dialog-footer">
            <button className="secondary" onClick={() => setOpen(false)}>
              Voltar
            </button>
            <RunButton
              disabled={reason.trim().length < 5}
              run={async () => {
                await run(reason);
                setOpen(false);
              }}
            >
              {confirmLabel}
            </RunButton>
          </div>
        </Dialog>
      )}
    </>
  );
}

const permissions = [
  "participants.read",
  "participants.write",
  "participants.import",
  "activities.read",
  "activities.write",
  "attendance.register",
  "attendance.correct",
  "rewards.manage",
  "draws.execute",
  "reports.export",
  "audit.read",
  "users.manage",
  "editions.manage",
  "certificates.manage",
  "notifications.send",
];
const configs: Record<string, EntityConfig> = {
  edicoes: {
    entity: "edition",
    collection: "editions",
    singular: "edição",
    title: "Edições",
    description:
      "Cada jornada tem seu próprio calendário, participantes e configurações.",
    fields: [
      { key: "name", label: "Nome da edição", required: true, wide: true },
      { key: "slug", label: "Identificador (slug)", required: true },
      { key: "year", label: "Ano", type: "number", required: true },
      { key: "slogan", label: "Slogan", wide: true },
      { key: "description", label: "Descrição", type: "textarea", wide: true },
      {
        key: "startAt",
        label: "Início da edição",
        type: "datetime-local",
        required: true,
      },
      {
        key: "endAt",
        label: "Fim da edição",
        type: "datetime-local",
        required: true,
      },
      {
        key: "timezone",
        label: "Fuso horário",
        default: "America/Manaus",
        required: true,
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: opts("DRAFT", "PUBLISHED", "ACTIVE", "FINISHED", "ARCHIVED"),
        default: "DRAFT",
      },
      {
        key: "maxActivities",
        label: "Máximo de inscrições por participante",
        type: "number",
        min: 1,
        default: 5,
      },
      {
        key: "maxCheckins",
        label: "Máximo de check-ins",
        type: "number",
        min: 1,
        default: 5,
      },
      {
        key: "checkinMinutes",
        label: "Check-in normal (min após início)",
        type: "number",
        default: 15,
      },
      {
        key: "noShowMinutes",
        label: "Liberar ausentes (min após início)",
        type: "number",
        default: 20,
      },
      {
        key: "lateCheckinMinutes",
        label: "Check-in tardio (min após início)",
        type: "number",
        default: 25,
      },
      {
        key: "checkoutMinutes",
        label: "Check-out (min antes do fim)",
        type: "number",
        default: 24,
      },
      {
        key: "allowMultipleRewards",
        label: "Permitir mais de um brinde por participante",
        type: "checkbox",
        default: true,
      },
      {
        key: "reminderMinutes",
        label: "Lembretes antes da atividade (min, separados por vírgula)",
        type: "array",
        default: [30, 10],
        wide: true,
      },
      { key: "logoUrl", label: "Logo oficial", type: "upload" },
      { key: "iconUrl", label: "Ícone PWA", type: "upload" },
      {
        key: "primaryColor",
        label: "Cor primária",
        type: "color",
        default: "#174f58",
      },
      {
        key: "secondaryColor",
        label: "Cor de destaque",
        type: "color",
        default: "#b18a3b",
      },
      {
        key: "backgroundColor",
        label: "Cor de fundo",
        type: "color",
        default: "#f8f9f6",
      },
    ],
    columns: [
      { key: "name", label: "Edição" },
      { key: "year", label: "Ano" },
      {
        key: "startAt",
        label: "Período",
        render: (r) =>
          `${dt(r.startAt, r.timezone)} → ${dt(r.endAt, r.timezone)}`,
      },
      {
        key: "status",
        label: "Status",
        render: (r) => <Badge value={r.status} />,
      },
    ],
  },
  participantes: {
    entity: "participant",
    collection: "participants",
    singular: "participante",
    title: "Participantes",
    description:
      "Pessoas inscritas na edição e o acompanhamento de cada jornada.",
    fields: [
      { key: "fullName", label: "Nome completo", required: true, wide: true },
      {
        key: "ra",
        label: "RA",
        required: true,
        help: "Informe somente o registro acadêmico, sem espaços.",
      },
      {
        key: "semester",
        label: "Semestre",
        type: "number",
        required: true,
        min: 1,
        max: 20,
        step: 1,
        help: "Use apenas o número do semestre, por exemplo: 6.",
      },
      {
        key: "photoUrl",
        label: "Foto do participante",
        type: "upload",
        wide: true,
      },
      {
        key: "active",
        label: "Participante ativo",
        type: "checkbox",
        default: true,
      },
    ],
    columns: [
      {
        key: "fullName",
        label: "Participante",
        render: (r) => (
          <Link className="a-person" href={`/admin/participantes/${r.id}`}>
            <Avatar row={r} />
            <span>
              <strong>{name(r)}</strong>
              <small>RA {r.ra}</small>
            </span>
          </Link>
        ),
      },
      { key: "semester", label: "Semestre", render: (r) => `${r.semester}º` },
      {
        key: "activities",
        label: "Inscrições",
        render: (r, d) =>
          all(d, "enrollments").filter(
            (e) => e.participantId === r.id && e.status === "ACTIVE",
          ).length,
      },
      {
        key: "checkins",
        label: "Check-ins",
        render: (r, d) => (
          <span className="a-count-pill">
            {
              all(d, "attendances").filter(
                (e) => e.participantId === r.id && validAttendance(e),
              ).length
            }{" "}
            / {d.edition?.maxCheckins}
          </span>
        ),
      },
      {
        key: "certificate",
        label: "Certificado",
        render: (r, d) => (
          <Badge
            value={
              all(d, "certificates").find((e) => e.participantId === r.id)
                ?.status || "PENDING"
            }
          />
        ),
      },
      {
        key: "active",
        label: "Status",
        render: (r) => <Badge value={r.active} />,
      },
    ],
  },
  categorias: {
    entity: "category",
    collection: "categories",
    singular: "categoria",
    title: "Categorias",
    description:
      "Organize a programação e defina o comportamento de presença e certificação.",
    fields: [
      { key: "name", label: "Nome", required: true },
      { key: "slug", label: "Identificador (slug)", required: true },
      { key: "color", label: "Cor", type: "color", default: "#174f58" },
      { key: "order", label: "Ordem", type: "number", default: 0 },
      { key: "stampUrl", label: "Selo padrão", type: "stamp", wide: true },
      {
        key: "requiresEnrollment",
        label: "Exige inscrição",
        type: "checkbox",
        default: true,
      },
      {
        key: "requiresCheckin",
        label: "Exige check-in",
        type: "checkbox",
        default: true,
      },
      {
        key: "requiresCheckout",
        label: "Exige check-out",
        type: "checkbox",
        default: false,
      },
      {
        key: "generatesStamp",
        label: "Gera carimbo",
        type: "checkbox",
        default: true,
      },
      {
        key: "generatesCertificate",
        label: "Gera certificado",
        type: "checkbox",
        default: false,
      },
      {
        key: "active",
        label: "Categoria ativa",
        type: "checkbox",
        default: true,
      },
    ],
    columns: [
      {
        key: "name",
        label: "Categoria",
        render: (r) => (
          <span className="a-category">
            <i style={{ background: r.color }} />
            {r.name}
          </span>
        ),
      },
      {
        key: "stampUrl",
        label: "Selo",
        render: (r) =>
          isFarmaArena(r) ? (
            <FarmaArenaStamp
              className="a-stamp-mini"
              alt={`Selo especial ${r.name}`}
            />
          ) : r.stampUrl ? (
            <img
              className="a-stamp-mini"
              src={r.stampUrl}
              alt={`Selo ${r.name}`}
            />
          ) : (
            "Sem selo"
          ),
      },
      {
        key: "requiresCheckout",
        label: "Check-out",
        render: (r) => (r.requiresCheckout ? "Obrigatório" : "Não exige"),
      },
      {
        key: "generatesCertificate",
        label: "Certificado",
        render: (r) => (r.generatesCertificate ? "Sim" : "Não"),
      },
      {
        key: "active",
        label: "Status",
        render: (r) => <Badge value={r.active} />,
      },
    ],
  },
  palestrantes: {
    entity: "speaker",
    collection: "speakers",
    singular: "palestrante",
    title: "Palestrantes",
    description: "Os profissionais que compartilham conhecimento nesta edição.",
    fields: [
      { key: "name", label: "Nome completo", required: true, wide: true },
      { key: "institution", label: "Instituição", wide: true },
      { key: "bio", label: "Biografia", type: "textarea", wide: true },
      { key: "photoUrl", label: "Foto", type: "upload" },
      { key: "curriculumUrl", label: "Link do currículo", type: "url" },
    ],
    columns: [
      {
        key: "name",
        label: "Palestrante",
        render: (r) => (
          <span className="a-person">
            <Avatar row={r} />
            <strong>{r.name}</strong>
          </span>
        ),
      },
      { key: "institution", label: "Instituição" },
      {
        key: "curriculumUrl",
        label: "Currículo",
        render: (r) =>
          r.curriculumUrl ? (
            <a
              className="a-text-button"
              target="_blank"
              rel="noreferrer"
              href={r.curriculumUrl}
            >
              Ver currículo <ExternalLink size={14} />
            </a>
          ) : (
            "Não informado"
          ),
      },
    ],
  },
  atividades: {
    entity: "activity",
    collection: "activities",
    singular: "atividade",
    title: "Atividades",
    description:
      "Planeje a programação e acompanhe vagas, inscrições e presença.",
    fields: [
      {
        key: "title",
        label: "Título da atividade",
        required: true,
        wide: true,
      },
      { key: "description", label: "Descrição", type: "textarea", wide: true },
      {
        key: "categoryId",
        label: "Categoria",
        type: "select",
        source: "categories",
        required: true,
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: opts("DRAFT", "OPEN", "IN_PROGRESS", "FINISHED", "CANCELLED"),
        default: "OPEN",
      },
      {
        key: "speakerIds",
        label: "Palestrantes",
        type: "multiselect",
        source: "speakers",
        wide: true,
      },
      {
        key: "startAt",
        label: "Início",
        type: "datetime-local",
        required: true,
      },
      { key: "endAt", label: "Fim", type: "datetime-local", required: true },
      { key: "block", label: "Bloco", required: true },
      { key: "room", label: "Sala", required: true },
      {
        key: "capacity",
        label: "Capacidade",
        type: "number",
        min: 1,
        required: true,
        default: 20,
      },
      {
        key: "workloadHours",
        label: "Carga horária (horas)",
        type: "number",
        min: 0,
        default: 1,
      },
      {
        key: "enrollmentDeadline",
        label: "Prazo de inscrição (opcional)",
        type: "datetime-local",
      },
      {
        key: "changeDeadline",
        label: "Prazo de troca (opcional)",
        type: "datetime-local",
      },
      {
        key: "enrollmentOpen",
        label: "Inscrições abertas",
        type: "checkbox",
        default: true,
      },
      {
        key: "allowWaitlist",
        label: "Permitir lista de espera",
        type: "checkbox",
        default: true,
      },
      {
        key: "stampUrl",
        label: "Selo específico (opcional)",
        type: "stamp",
        wide: true,
      },
    ],
    columns: [
      {
        key: "title",
        label: "Atividade",
        render: (r, d) => (
          <Link href={`/admin/atividades/${r.id}`} className="a-cell-title">
            <strong>{r.title}</strong>
            <small>
              {find(d, "categories", r.categoryId).name} ·{" "}
              {/\bbloco\b/i.test(String(r.block))
                ? r.block
                : `Bloco ${r.block}`}{" "}
              {" / "}
              {r.room}
            </small>
          </Link>
        ),
      },
      {
        key: "startAt",
        label: "Data e horário",
        render: (r, d) => dt(r.startAt, d.edition?.timezone),
      },
      {
        key: "capacity",
        label: "Ocupação",
        render: (r, d) => <Capacity row={r} data={d} />,
      },
      {
        key: "waitlist",
        label: "Espera",
        render: (r, d) =>
          all(d, "waitlist").filter(
            (w) => w.activityId === r.id && w.status === "WAITING",
          ).length,
      },
      {
        key: "status",
        label: "Status",
        render: (r) => <Badge value={r.status} />,
      },
    ],
  },
  brindes: {
    entity: "reward",
    collection: "rewards",
    singular: "brinde",
    title: "Brindes",
    description:
      "Um reconhecimento por cada conquista. Gerencie catálogo e condições de distribuição.",
    fields: [
      { key: "name", label: "Nome do brinde", required: true, wide: true },
      { key: "description", label: "Descrição", type: "textarea", wide: true },
      {
        key: "imageUrl",
        label: "Imagem do brinde",
        type: "upload",
        wide: true,
      },
      {
        key: "stockTotal",
        label: "Estoque total",
        type: "number",
        min: 0,
        default: 0,
        help: "Ao editar, mantenha ao menos a quantidade já reservada ou entregue.",
      },
      { key: "order", label: "Ordem de exibição", type: "number", default: 0 },
      {
        key: "confirmationMinutes",
        label: "Prazo para confirmar (minutos)",
        type: "number",
        min: 1,
        default: 30,
      },
      {
        key: "redemptionStartsAt",
        label: "Liberação para retirada",
        type: "datetime-local",
        wide: true,
        help: "Personalize o dia e o horário em que a equipe poderá entregar este brinde.",
      },
      { key: "exclusiveGroup", label: "Grupo de exclusividade (opcional)" },
      { key: "active", label: "Brinde ativo", type: "checkbox", default: true },
    ],
    columns: [
      {
        key: "name",
        label: "Brinde",
        render: (r) => (
          <span className="a-person">
            {r.imageUrl ? (
              <img className="a-reward-mini" src={r.imageUrl} alt={r.name} />
            ) : (
              <span className="a-avatar">
                <Gift size={20} />
              </span>
            )}
            <strong>{r.name}</strong>
          </span>
        ),
      },
      { key: "stockTotal", label: "Total" },
      { key: "stockAvailable", label: "Disponíveis" },
      { key: "stockReserved", label: "Reservados" },
      { key: "stockDelivered", label: "Entregues" },
      {
        key: "redemptionStartsAt",
        label: "Retirada",
        render: (r, d) =>
          r.redemptionStartsAt
            ? dt(r.redemptionStartsAt, d.edition.timezone)
            : "Imediata",
      },
      {
        key: "active",
        label: "Status",
        render: (r) => <Badge value={r.active} />,
      },
    ],
  },
  regras: {
    entity: "rule",
    collection: "rules",
    singular: "regra",
    title: "Regras de elegibilidade",
    description: "Configure os requisitos de cada brinde para esta edição.",
    fields: [
      {
        key: "rewardId",
        label: "Brinde",
        type: "select",
        source: "rewards",
        required: true,
      },
      {
        key: "type",
        label: "Tipo de regra",
        type: "select",
        options: opts(
          "MIN_CHECKINS",
          "CATEGORY",
          "ACTIVITY",
          "FULL_JOURNEY",
          "SPECIAL",
        ),
        default: "MIN_CHECKINS",
      },
      {
        key: "minCheckins",
        label: "Mínimo de check-ins",
        type: "number",
        min: 0,
        default: 1,
      },
      {
        key: "categoryId",
        label: "Categoria exigida",
        type: "select",
        source: "categories",
      },
      {
        key: "activityId",
        label: "Atividade exigida",
        type: "select",
        source: "activities",
      },
      {
        key: "description",
        label: "Descrição pública da regra",
        type: "textarea",
        wide: true,
      },
      {
        key: "participantIds",
        label: "Participantes da regra especial",
        type: "multiselect",
        source: "participants",
        wide: true,
      },
      { key: "active", label: "Regra ativa", type: "checkbox", default: true },
    ],
    columns: [
      {
        key: "rewardId",
        label: "Brinde",
        render: (r, d) => find(d, "rewards", r.rewardId).name,
      },
      { key: "type", label: "Regra", render: (r) => labels[r.type] || r.type },
      { key: "description", label: "Descrição" },
      { key: "minCheckins", label: "Mínimo de check-ins" },
      {
        key: "active",
        label: "Status",
        render: (r) => <Badge value={r.active} />,
      },
    ],
  },
  usuarios: {
    entity: "user",
    collection: "users",
    singular: "usuário",
    title: "Usuários e permissões",
    description:
      "Acessos da equipe, com permissões específicas para cada responsabilidade.",
    fields: [
      { key: "name", label: "Nome", required: true },
      { key: "email", label: "E-mail", type: "email", required: true },
      {
        key: "password",
        label: "Senha (obrigatória ao criar)",
        type: "password",
        help: "Ao editar, deixe vazio para manter a senha atual.",
      },
      {
        key: "role",
        label: "Perfil",
        type: "select",
        options: opts("ADMIN_GENERAL", "ORGANIZATION", "OPERATOR"),
        default: "OPERATOR",
      },
      {
        key: "permissions",
        label: "Permissões adicionais",
        type: "multiselect",
        options: permissions.map((value) => ({ value, label: value })),
        wide: true,
      },
      {
        key: "editionIds",
        label: "Edições permitidas (vazio = todas)",
        type: "multiselect",
        source: "editions",
        wide: true,
      },
      { key: "active", label: "Acesso ativo", type: "checkbox", default: true },
    ],
    columns: [
      {
        key: "name",
        label: "Usuário",
        render: (r) => (
          <span className="a-cell-title">
            <strong>{r.name}</strong>
            <small>{r.email}</small>
          </span>
        ),
      },
      { key: "role", label: "Perfil", render: (r) => <Badge value={r.role} /> },
      {
        key: "permissions",
        label: "Permissões adicionais",
        render: (r) => (r.permissions || []).length,
      },
      {
        key: "active",
        label: "Status",
        render: (r) => <Badge value={r.active} />,
      },
    ],
  },
  patrocinadores: {
    entity: "sponsor",
    collection: "sponsors",
    singular: "patrocinador",
    title: "Patrocinadores",
    description: "Marcas parceiras exibidas na entrada da edição.",
    fields: [
      { key: "name", label: "Nome do patrocinador", required: true },
      { key: "url", label: "Site", type: "url" },
      { key: "logoUrl", label: "Logo", type: "upload", wide: true },
      { key: "order", label: "Ordem de exibição", type: "number", default: 0 },
      {
        key: "active",
        label: "Patrocinador ativo",
        type: "checkbox",
        default: true,
      },
    ],
    columns: [
      { key: "name", label: "Patrocinador" },
      {
        key: "logoUrl",
        label: "Logo",
        render: (r) =>
          r.logoUrl ? (
            <img src={r.logoUrl} alt={r.name} className="a-sponsor-logo" />
          ) : (
            "Não enviada"
          ),
      },
      {
        key: "url",
        label: "Site",
        render: (r) =>
          r.url ? (
            <a href={r.url} target="_blank" rel="noreferrer">
              Visitar <ExternalLink size={13} />
            </a>
          ) : (
            "—"
          ),
      },
      {
        key: "active",
        label: "Status",
        render: (r) => <Badge value={r.active} />,
      },
    ],
  },
};

function Capacity({ row, data }: { row: Row; data: Row }) {
  const count =
    row.enrolledCount ??
    all(data, "enrollments").filter(
      (e) =>
        e.activityId === row.id && ["ACTIVE", "COMPLETED"].includes(e.status),
    ).length;
  return (
    <div className="a-capacity">
      <span>
        <strong>{count}</strong> / {row.capacity}
      </span>
      <div>
        <i
          style={{
            width: `${Math.min(100, (count / Math.max(1, row.capacity)) * 100)}%`,
          }}
        />
      </div>
    </div>
  );
}

function InputField({
  field,
  value,
  setValue,
  data,
  editionId,
  onUploadChange,
}: {
  field: Field;
  value: any;
  setValue: (v: any) => void;
  data: Row;
  editionId?: string;
  onUploadChange?: (uploading: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const id = `field-${field.key}`;
  const options =
    field.options ||
    all(data, field.source || "").map((r) => ({
      value: r.id,
      label: name(r) + (r.ra ? ` · RA ${r.ra}` : ""),
    }));
  if (field.type === "checkbox")
    return (
      <label className="a-checkbox" htmlFor={id}>
        <input
          type="checkbox"
          id={id}
          checked={!!value}
          onChange={(e) => setValue(e.target.checked)}
        />
        {field.label}
      </label>
    );
  return (
    <div className={`field ${field.wide ? "a-field-wide" : ""}`}>
      <label htmlFor={id}>
        {field.label}
        {field.required && <span aria-hidden="true"> *</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea
          id={id}
          value={value || ""}
          required={field.required}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
        />
      ) : field.type === "select" ? (
        <select
          id={id}
          value={value ?? ""}
          required={field.required}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="">Selecione</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.type === "multiselect" ? (
        <div className="a-multiselect" id={id}>
          {options.length ? (
            options.map((o) => (
              <label className="a-checkbox" key={o.value}>
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(o.value)}
                  onChange={(e) =>
                    setValue(
                      e.target.checked
                        ? [...(value || []), o.value]
                        : (value || []).filter((v: string) => v !== o.value),
                    )
                  }
                />
                {o.label}
              </label>
            ))
          ) : (
            <small>Nenhum cadastro disponível.</small>
          )}
        </div>
      ) : field.type === "stamp" ? (
        <div className="a-stamp-showcase">
          <div className="a-stamp-picker" role="group" aria-label={field.label}>
            <button
              type="button"
              aria-pressed={!value}
              className={!value ? "selected" : ""}
              onClick={() => setValue("")}
            >
              <span className="a-no-stamp">Sem selo específico</span>
            </button>
            {[
              [1, "Palestra"],
              [2, "Conexões"],
              [3, "FarmaArena"],
              [4, "Conhecimento"],
              [5, "Profissão"],
              [6, "Farmácia clínica"],
              [8, "Oficina"],
              [9, "Institucional"],
              [10, "Mobilidade"],
              [11, "Futuro"],
            ].map(([n, label]) => {
              const url =
                n === 3
                  ? FARMA_ARENA_STAMP_URL
                  : `/assets/stamps/selo-${n}.webp`;
              const selected =
                value === url || (n === 3 && isLegacyFarmaArenaStamp(value));
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`${label}, selo ${n}`}
                  aria-pressed={selected}
                  className={selected ? "selected" : ""}
                  onClick={() => setValue(url)}
                >
                  {n === 3 ? (
                    <FarmaArenaStamp alt={`Selo oficial ${label}`} />
                  ) : (
                    <img src={url} alt={`Selo oficial ${label}`} />
                  )}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <aside className="a-stamp-preview">
            <strong>Pré-visualização do carimbo selecionado</strong>
            {value ? (
              isLegacyFarmaArenaStamp(value) ? (
                <FarmaArenaStamp alt="Carimbo especial da Farma Arena" />
              ) : (
                <img src={value} alt="Carimbo selecionado" />
              )
            ) : (
              <div className="a-preview-empty">
                Use o selo padrão da categoria
              </div>
            )}
            <small>
              O carimbo aparece no passaporte após a presença ser confirmada.
            </small>
          </aside>
        </div>
      ) : field.type === "upload" ? (
        <div
          className={`a-upload-field ${field.key === "imageUrl" ? "a-reward-photo-editor" : ""}`}
        >
          {field.key === "imageUrl" ? (
            <div className="a-reward-photo-preview">
              {value ? (
                <img src={String(value)} alt="Foto atual do brinde" />
              ) : (
                <div className="a-reward-photo-empty" aria-hidden="true">
                  <Gift size={34} strokeWidth={1.4} />
                </div>
              )}
              <div className="a-reward-photo-details">
                <strong>
                  {value ? "Foto atual do brinde" : "Brinde sem foto"}
                </strong>
                <span>
                  PNG, JPEG ou WebP, até 5 MB. A imagem mantém suas proporções.
                </span>
                <div className="a-reward-photo-actions">
                  <label className="a-photo-upload-button" htmlFor={id}>
                    <Upload size={16} aria-hidden="true" />
                    {uploading
                      ? "Enviando foto…"
                      : value
                        ? "Trocar foto"
                        : "Adicionar foto"}
                  </label>
                  {value && (
                    <button
                      className="a-text-button"
                      type="button"
                      disabled={uploading}
                      onClick={() => setValue("")}
                    >
                      Remover foto
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            value && (
              <div className="a-upload-current">
                {!String(value).endsWith(".pdf") ? (
                  <img src={value} alt="Arquivo atual" />
                ) : (
                  <FileSpreadsheet size={28} />
                )}
                <a href={value} target="_blank" rel="noreferrer">
                  Abrir arquivo atual
                </a>
                <button
                  className="a-text-button"
                  type="button"
                  onClick={() => setValue("")}
                >
                  Remover
                </button>
              </div>
            )
          )}
          <input
            id={id}
            type="file"
            className={
              field.key === "imageUrl" ? "a-photo-file-input" : undefined
            }
            accept={field.accept || "image/png,image/jpeg,image/webp"}
            disabled={uploading}
            onChange={async (e) => {
              const input = e.currentTarget;
              const file = input.files?.[0];
              if (!file) return;
              setUploading(true);
              onUploadChange?.(true);
              setUploadError("");
              try {
                const form = new FormData();
                form.set("file", file);
                form.set("editionId", editionId || data.edition?.id || "");
                const response = await fetch("/api/upload", {
                  method: "POST",
                  body: form,
                });
                const result = await readApiResponse<any>(
                  response,
                  "Não foi possível enviar a imagem.",
                );
                setValue(result.url);
              } catch (e: any) {
                setUploadError(e.message);
              } finally {
                setUploading(false);
                onUploadChange?.(false);
                input.value = "";
              }
            }}
          />
          {uploading && field.key !== "imageUrl" && (
            <small>Enviando arquivo…</small>
          )}
          {uploadError && (
            <p className="error" role="alert">
              {uploadError}
            </p>
          )}
        </div>
      ) : (
        <input
          id={id}
          type={field.type === "array" ? "text" : field.type || "text"}
          value={
            field.type === "array"
              ? Array.isArray(value)
                ? value.join(", ")
                : value || ""
              : (value ?? "")
          }
          required={field.required}
          min={field.min}
          max={field.max}
          step={field.type === "number" ? (field.step ?? "any") : undefined}
          onChange={(e) =>
            setValue(
              field.type === "number"
                ? e.target.value === ""
                  ? ""
                  : Number(e.target.value)
                : e.target.value,
            )
          }
        />
      )}
      {field.help && <small className="a-help">{field.help}</small>}
    </div>
  );
}

function EntityForm({
  config,
  row,
  onClose,
}: {
  config: EntityConfig;
  row: Row;
  onClose: () => void;
}) {
  const { data, action, toast } = useJornadas();
  const zone = data?.edition?.timezone || "America/Manaus";
  const [values, setValues] = useState<Row>(() =>
    Object.fromEntries(
      config.fields.map((f) => [
        f.key,
        f.type === "datetime-local"
          ? localDate(row[f.key], row.timezone || zone)
          : (row[f.key] ??
            (f.key === "speakerIds"
              ? row.speakers?.map((s: Row) => s.id)
              : undefined) ??
            f.default ??
            (f.type === "multiselect" ? [] : "")),
      ]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState<Row[]>([]);
  async function save(force = false) {
    if (pendingUploads > 0) return;
    setBusy(true);
    setError("");
    try {
      const payload: Row = { ...values, ...(row.id ? { id: row.id } : {}) };
      config.fields.forEach((f) => {
        if (f.type === "datetime-local")
          payload[f.key] = utcDate(values[f.key], values.timezone || zone);
        if (f.type === "array")
          payload[f.key] = Array.isArray(values[f.key])
            ? values[f.key]
            : String(values[f.key])
                .split(",")
                .map((v) => Number(v.trim()))
                .filter(Number.isFinite);
      });
      if (!payload.password) delete payload.password;
      if (force) payload.confirmConflicts = true;
      const result = await action("entity.save", {
        entity: config.entity,
        data: payload,
        confirmConflicts: force,
      });
      if (result?.conflicts?.length && !force) {
        setConflicts(result.conflicts);
        return;
      }
      toast(
        `${config.singular[0].toUpperCase() + config.singular.slice(1)} ${row.id ? "atualizado" : "cadastrado"} com sucesso.`,
      );
      onClose();
    } catch (e: any) {
      setError(e.message || "Não foi possível salvar.");
      if (e.details?.conflicts) setConflicts(e.details.conflicts);
      if (e.conflicts) setConflicts(e.conflicts);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      wide
      title={`${row.id ? "Editar" : "Cadastrar"} ${config.singular}`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="a-form-body">
          <p className="a-help">
            {config.entity === "edition"
              ? "Identidade, calendário e regras desta edição."
              : `Dados da edição ${data?.edition?.name || "selecionada"}.`}
            {config.fields.some((f) => f.type === "datetime-local") &&
              ` Horários em ${zone}.`}
          </p>
          <div className="a-form-grid">
            {config.fields.map((f) => (
              <InputField
                key={f.key}
                field={f}
                value={values[f.key]}
                setValue={(v) => setValues((old) => ({ ...old, [f.key]: v }))}
                data={data || {}}
                onUploadChange={(uploading) =>
                  setPendingUploads((count) =>
                    Math.max(0, count + (uploading ? 1 : -1)),
                  )
                }
              />
            ))}
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {conflicts.length > 0 && (
            <div className="a-alert">
              <strong>Conflitos de horário encontrados</strong>
              <p>
                Revise as inscrições afetadas antes de confirmar esta alteração.
              </p>
              <ul>
                {conflicts.map((c, i) => (
                  <li key={i}>
                    {c.fullName ||
                      c.participantName ||
                      person(data, c.participantId)}{" "}
                    — {c.activityTitle || title(data, c.activityId)}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="secondary"
                disabled={busy || pendingUploads > 0}
                onClick={() => void save(true)}
              >
                Confirmar alteração com os conflitos apresentados
              </button>
            </div>
          )}
        </div>
        <div className="a-dialog-footer">
          <button className="secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button"
            type="submit"
            disabled={busy || pendingUploads > 0}
          >
            {busy
              ? "Salvando…"
              : pendingUploads > 0
                ? "Aguarde o envio…"
                : "Salvar"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function EntityManager({
  section,
  compact = false,
  query = "",
}: {
  section: string;
  compact?: boolean;
  query?: string;
}) {
  const { data, action, toast } = useJornadas();
  const config = configs[section];
  const [editing, setEditing] = useState<Row | null>(null);
  const [search, setSearch] = useState("");
  const [semester, setSemester] = useState("");
  const [presence, setPresence] = useState("");
  const [category, setCategory] = useState("");
  const filtered = all(data, config.collection).filter((r) => {
    const text =
      `${name(r)} ${r.ra || ""} ${r.description || ""}`.toLowerCase();
    if (!text.includes((search || query).toLowerCase())) return false;
    if (semester && String(r.semester) !== semester) return false;
    if (category && r.categoryId !== category) return false;
    if (presence) {
      const present = all(data, "attendances").some(
        (a) => a.participantId === r.id && validAttendance(a),
      );
      if ((presence === "yes") !== present) return false;
    }
    return true;
  });
  const columns = [
    ...config.columns,
    {
      key: "actions",
      label: "Ações",
      render: (r: Row) => (
        <div className="a-row-actions">
          <button
            className={
              config.entity === "reward" ? "a-edit-reward" : "a-icon-button"
            }
            aria-label={`Editar ${name(r)}`}
            onClick={() => setEditing(r)}
          >
            <Pencil size={16} />
            {config.entity === "reward" && <span>Editar</span>}
          </button>
          {config.entity === "edition" && <DuplicateEdition row={r} />}
          {config.entity === "activity" && r.status !== "CANCELLED" && (
            <ReasonButton
              title="Cancelar atividade"
              run={async (reason) => {
                await action("activity.cancel", { activityId: r.id, reason });
                toast("Atividade cancelada. Inscritos foram notificados.");
              }}
            >
              Cancelar
            </ReasonButton>
          )}
          {config.entity === "activity" && (
            <ReasonButton
              title={`Excluir atividade: ${r.title}`}
              className="a-text-button a-delete-action"
              confirmLabel="Excluir atividade"
              extra={
                <p className="a-delete-warning">
                  <Trash2 size={18} />A exclusão remove esta atividade da
                  programação. Se houver inscrições, presenças, certificados ou
                  regras de brinde vinculadas, use o cancelamento para preservar
                  o histórico.
                </p>
              }
              run={async (reason) => {
                await action("activity.delete", { activityId: r.id, reason });
              }}
            >
              <Trash2 size={15} /> Excluir
            </ReasonButton>
          )}
        </div>
      ),
    },
  ];
  return (
    <>
      {!compact && (
        <PageTitle title={config.title} description={config.description}>
          <button className="button" onClick={() => setEditing({})}>
            <Plus size={17} />
            Cadastrar {config.singular}
          </button>
        </PageTitle>
      )}
      <section className="a-panel">
        {compact && (
          <div className="a-panel-heading">
            <div>
              <h2>{config.title}</h2>
              <p>{config.description}</p>
            </div>
            <button className="secondary" onClick={() => setEditing({})}>
              <Plus size={16} />
              Adicionar
            </button>
          </div>
        )}
        <div className="a-toolbar">
          <label className="a-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                section === "participantes"
                  ? "Buscar por nome ou RA"
                  : `Buscar ${config.title.toLowerCase()}`
              }
              aria-label={`Buscar ${config.title.toLowerCase()}`}
            />
          </label>
          {section === "participantes" && (
            <>
              <select
                aria-label="Filtrar semestre"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
              >
                <option value="">Todos os semestres</option>
                {Array.from(
                  new Set(
                    all(data, "participants").map((r) => String(r.semester)),
                  ),
                )
                  .sort()
                  .map((v) => (
                    <option key={v}>{v}</option>
                  ))}
              </select>
              <select
                aria-label="Filtrar presença"
                value={presence}
                onChange={(e) => setPresence(e.target.value)}
              >
                <option value="">Todas as presenças</option>
                <option value="yes">Com presença</option>
                <option value="no">Sem presença</option>
              </select>
              <Link className="secondary" href="/admin/importacoes">
                <Upload size={16} />
                Importar
              </Link>
            </>
          )}
          {section === "atividades" && (
            <select
              aria-label="Filtrar categoria"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Todas as categorias</option>
              {all(data, "categories").map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <span className="a-result-count">{filtered.length} registros</span>
        </div>
        <Table
          rows={filtered}
          columns={columns}
          data={data || {}}
          empty={`Nenhum registro encontrado. Cadastre ${config.singular} para começar.`}
        />
      </section>
      {section === "brindes" && <EntityManager section="regras" compact />}
      {editing && (
        <EntityForm
          config={config}
          row={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function DuplicateEdition({ row }: { row: Row }) {
  const { action, toast } = useJornadas();
  const [open, setOpen] = useState(false);
  const [nextName, setNextName] = useState(`${row.name} — cópia`);
  const [year, setYear] = useState(Number(row.year) + 1);
  const [sponsors, setSponsors] = useState(true);
  return (
    <>
      <button
        className="a-icon-button"
        aria-label={`Duplicar ${row.name}`}
        onClick={() => setOpen(true)}
      >
        <Copy size={16} />
      </button>
      {open && (
        <Dialog title="Duplicar edição" onClose={() => setOpen(false)}>
          <div className="a-form-body">
            <p>
              Copie identidade, programação e configurações para começar uma
              nova jornada. Os registros de participantes e operações pertencem
              à edição original.
            </p>
            <label className="field">
              Nome da nova edição
              <input
                value={nextName}
                onChange={(e) => setNextName(e.target.value)}
                required
              />
            </label>
            <label className="field">
              Ano
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </label>
            <label className="a-checkbox">
              <input
                type="checkbox"
                checked={sponsors}
                onChange={(e) => setSponsors(e.target.checked)}
              />
              Copiar patrocinadores
            </label>
          </div>
          <div className="a-dialog-footer">
            <button className="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <RunButton
              run={async () => {
                await action("edition.duplicate", {
                  sourceEditionId: row.id,
                  name: nextName,
                  year,
                  copySponsors: sponsors,
                });
                toast("Edição duplicada em rascunho.");
                setOpen(false);
              }}
            >
              Duplicar edição
            </RunButton>
          </div>
        </Dialog>
      )}
    </>
  );
}

const menu = [
  ["", "Visão geral", Home],
  ["edicoes", "Edições", Layers3],
  ["participantes", "Participantes", Users],
  ["importacoes", "Importação", Upload],
  ["categorias", "Categorias", ListFilter],
  ["palestrantes", "Palestrantes", UserRound],
  ["atividades", "Atividades", CalendarDays],
  ["inscricoes", "Inscrições", Ticket],
  ["lista-espera", "Lista de espera", ClipboardList],
  ["operacao", "Operação", ClipboardCheck],
  ["presencas", "Presenças", CheckCheck],
  ["passaportes", "Passaportes", BookOpen],
  ["brindes", "Loja / Brindes", Gift],
  ["estoque", "Estoque", Package],
  ["elegibilidade", "Elegibilidade", Sparkles],
  ["sorteios", "Sorteios", Award],
  ["retiradas", "Retiradas", CheckCircle2],
  ["certificados", "Certificados", Award],
  ["notificacoes", "Notificações", Bell],
  ["relatorios", "Relatórios", FileSpreadsheet],
  ["usuarios", "Usuários", ShieldCheck],
  ["auditoria", "Auditoria", Activity],
  ["configuracoes", "Configurações", Settings2],
] as const;
function permitted(data: Row, section: string) {
  const actor = data?.actor;
  if (actor?.role === "ADMIN_GENERAL") return true;
  const map: Record<string, string> = {
    edicoes: "editions.write",
    participantes: "participants.read",
    importacoes: "participants.write",
    categorias: "activities.read",
    palestrantes: "activities.read",
    atividades: "activities.read",
    inscricoes: "activities.read",
    "lista-espera": "activities.read",
    operacao: "attendance.register",
    presencas: "attendance.register",
    passaportes: "participants.read",
    brindes: "rewards.manage",
    estoque: "rewards.manage",
    elegibilidade: "rewards.manage",
    sorteios: "draws.execute",
    retiradas: "deliveries.manage",
    certificados: "certificates.manage",
    notificacoes: "notifications.send",
    relatorios: "reports.export",
    usuarios: "users.manage",
    auditoria: "audit.read",
    configuracoes: "editions.write",
  };
  return !section || actor?.permissions?.includes(map[section]);
}
function Dashboard() {
  const { data } = useJornadas();
  const active = all(data, "enrollments").filter(
      (x) => x.status === "ACTIVE",
    ).length,
    present = all(data, "attendances").filter(validAttendance).length,
    waiting = all(data, "waitlist").filter(
      (x) => x.status === "WAITING",
    ).length,
    live = all(data, "activities").filter(
      (x) =>
        new Date(data.serverNow) >= new Date(x.startAt) &&
        new Date(data.serverNow) <= new Date(x.endAt),
    ).length;
  const rewards = all(data, "rewards");
  return (
    <>
      <PageTitle
        title="Visão geral"
        description="A operação da edição, em tempo real."
      >
        <Link className="button" href="/admin/operacao">
          <ClipboardCheck size={17} />
          Abrir modo operação
        </Link>
      </PageTitle>
      <div className="a-metrics">
        {[
          ["Participantes", all(data, "participants").length, Users],
          ["Inscrições", active, Ticket],
          ["Presentes", present, CheckCheck],
          ["Em espera", waiting, Clock3],
          ["Acontecendo", live, Activity],
          [
            "Entregues",
            rewards.reduce(
              (n, r) => n + (r.stockDelivered ?? r.delivered ?? 0),
              0,
            ),
            Gift,
          ],
        ].map(([label, value, Icon]: any) => (
          <article className="a-metric" key={label}>
            <span>
              <Icon size={20} />
            </span>
            <strong>{value}</strong>
            <small>{label}</small>
          </article>
        ))}
      </div>
      <div className="a-dashboard-grid">
        <Panel title="Atividades" sub="Ocupação e presença">
          <Table
            data={data}
            rows={all(data, "activities").slice(0, 6)}
            columns={[
              { key: "title", label: "Atividade" },
              {
                key: "capacity",
                label: "Ocupação",
                render: (r, d) => <Capacity row={r} data={d} />,
              },
              {
                key: "presence",
                label: "Presentes",
                render: (r) =>
                  all(data, "attendances").filter(
                    (a) => a.activityId === r.id && validAttendance(a),
                  ).length,
              },
              {
                key: "status",
                label: "Status",
                render: (r) => <Badge value={r.status} />,
              },
            ]}
          />
        </Panel>
        <Panel title="Estoque" sub="Disponível, reservado e entregue">
          <Table
            data={data}
            rows={rewards.slice(0, 6)}
            columns={[
              { key: "name", label: "Brinde" },
              {
                key: "available",
                label: "Disponível",
                render: (r) => r.stockAvailable ?? r.available ?? r.total,
              },
              {
                key: "reserved",
                label: "Reservado",
                render: (r) => r.stockReserved ?? r.reserved ?? 0,
              },
              {
                key: "delivered",
                label: "Entregue",
                render: (r) => r.stockDelivered ?? r.delivered ?? 0,
              },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
function Operation() {
  const { data, action } = useJornadas();
  const [activityId, setActivityId] = useState(
      all(data, "activities")[0]?.id || "",
    ),
    [ra, setRa] = useState(""),
    [found, setFound] = useState<Row | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const activity = find(data, "activities", activityId);
  useEffect(() => {
    const activities = all(data, "activities").filter(
      (item) => item.status !== "DRAFT" && item.status !== "CANCELLED",
    );
    if (!activities.some((item) => item.id === activityId))
      setActivityId(activities[0]?.id || "");
  }, [data, activityId]);
  useEffect(() => {
    input.current?.focus();
  }, [activityId]);
  function search() {
    setFound(
      all(data, "participants").find((p) => p.ra === ra.trim()) || {
        missing: true,
      },
    );
  }
  const enrollment =
    found && !found.missing
      ? all(data, "enrollments").find(
          (e) =>
            e.participantId === found.id &&
            e.activityId === activityId &&
            ["ACTIVE", "COMPLETED"].includes(e.status),
        )
      : null;
  const attendance =
    found && !found.missing
      ? all(data, "attendances").find(
          (e) => e.participantId === found.id && e.activityId === activityId,
        )
      : null;
  const rows: Row[] = all(data, "enrollments")
    .filter(
      (e) =>
        e.activityId === activityId &&
        ["ACTIVE", "COMPLETED"].includes(e.status),
    )
    .map((e) => ({
      ...find(data, "participants", e.participantId),
      enrollment: e,
      attendance: all(data, "attendances").find(
        (a) =>
          a.participantId === e.participantId && a.activityId === activityId,
      ),
    }));
  return (
    <>
      <PageTitle
        title="Modo Operação"
        description="Confirme entradas e saídas por RA, com retorno imediato."
      />
      <div className="a-operation">
        <section className="a-operation-console">
          <p className="a-eyebrow">ATIVIDADE EM OPERAÇÃO</p>
          <div className="field">
            <label htmlFor="operation-activity">Atividade</label>
            <select
              id="operation-activity"
              aria-label="Atividade"
              value={activityId}
              onChange={(e) => {
                setActivityId(e.target.value);
                setFound(null);
              }}
            >
              {all(data, "activities")
                .filter((a) => a.status !== "DRAFT" && a.status !== "CANCELLED")
                .map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.title} · {dt(a.startAt, data.edition.timezone, true)}
                  </option>
                ))}
            </select>
          </div>
          {activity && (
            <div className="a-operation-title">
              <h2>{activity.title}</h2>
              <p>
                {activity.block} · {activity.room} ·{" "}
                {dt(activity.startAt, data.edition.timezone)}
              </p>
              <strong>
                {rows.filter((r) => validAttendance(r.attendance || {})).length}{" "}
                / {activity.capacity} presentes
              </strong>
            </div>
          )}
          <div className="a-ra-search">
            <label className="field">
              RA do participante
              <input
                ref={input}
                value={ra}
                onChange={(e) => {
                  setRa(e.target.value);
                  setFound(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && search()}
                inputMode="numeric"
                placeholder="Digite o RA"
              />
            </label>
            <button className="button" onClick={search}>
              Buscar participante
            </button>
          </div>
          {found && (
            <div
              className={`a-operation-result ${found.missing ? "error" : ""}`}
            >
              {found.missing ? (
                <>
                  <X />
                  <div>
                    <h3>Participante não encontrado</h3>
                    <p>Confira o RA e tente novamente.</p>
                  </div>
                </>
              ) : (
                <>
                  <Avatar row={found} />
                  <div>
                    <h3>{name(found)}</h3>
                    <p>
                      RA {found.ra} · {found.semester}º semestre
                    </p>
                    <Badge
                      value={
                        attendance?.status ||
                        (enrollment ? "ACTIVE" : "NOT_ENROLLED")
                      }
                    />
                  </div>
                  <div className="a-operation-actions">
                    {!attendance?.checkinAt && (
                      <RunButton
                        disabled={!enrollment}
                        run={async () => {
                          await action("attendance.checkin", {
                            activityId,
                            ra,
                          });
                          setRa("");
                          setFound(null);
                          input.current?.focus();
                        }}
                      >
                        Confirmar check-in
                      </RunButton>
                    )}
                    {attendance?.checkinAt &&
                      !attendance.checkoutAt &&
                      find(data, "categories", activity.categoryId)
                        .requiresCheckout && (
                        <RunButton
                          run={async () => {
                            await action("attendance.checkout", {
                              activityId,
                              ra,
                            });
                            setFound(null);
                          }}
                        >
                          Confirmar check-out
                        </RunButton>
                      )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
        <Panel title="Presentes e pendentes" sub="Atualiza sem recarregar">
          <div className="a-people-list">
            {rows.map((r: Row) => (
              <div key={r.id}>
                <Avatar row={r} />
                <span>
                  <strong>{name(r)}</strong>
                  <small>RA {r.ra}</small>
                </span>
                <Badge
                  value={
                    validAttendance(r.attendance || {}) ? "PRESENT" : "PENDING"
                  }
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
function ListPage({ section }: { section: string }) {
  const { data, action } = useJornadas();
  const maps: Record<
    string,
    { title: string; description: string; collection: string; columns: any[] }
  > = {
    inscricoes: {
      title: "Inscrições",
      description: "Vagas confirmadas e histórico de alterações.",
      collection: "enrollments",
      columns: [
        {
          key: "participantId",
          label: "Participante",
          render: (r: Row) => person(data, r.participantId),
        },
        {
          key: "activityId",
          label: "Atividade",
          render: (r: Row) => title(data, r.activityId),
        },
        {
          key: "createdAt",
          label: "Inscrição",
          render: (r: Row) => dt(r.createdAt, data.edition.timezone),
        },
        {
          key: "status",
          label: "Status",
          render: (r: Row) => <Badge value={r.status} />,
        },
      ],
    },
    "lista-espera": {
      title: "Lista de espera",
      description: "Fila FIFO e promoções automáticas.",
      collection: "waitlist",
      columns: [
        {
          key: "participantId",
          label: "Participante",
          render: (r: Row) => person(data, r.participantId),
        },
        {
          key: "activityId",
          label: "Atividade",
          render: (r: Row) => title(data, r.activityId),
        },
        {
          key: "createdAt",
          label: "Entrada",
          render: (r: Row) => dt(r.createdAt, data.edition.timezone),
        },
        {
          key: "status",
          label: "Status",
          render: (r: Row) => <Badge value={r.status} />,
        },
      ],
    },
    presencas: {
      title: "Presenças",
      description: "Entradas, saídas e correções auditadas.",
      collection: "attendances",
      columns: [
        {
          key: "participantId",
          label: "Participante",
          render: (r: Row) => person(data, r.participantId),
        },
        {
          key: "activityId",
          label: "Atividade",
          render: (r: Row) => title(data, r.activityId),
        },
        {
          key: "checkinAt",
          label: "Check-in",
          render: (r: Row) => dt(r.checkinAt, data.edition.timezone),
        },
        {
          key: "checkoutAt",
          label: "Check-out",
          render: (r: Row) => dt(r.checkoutAt, data.edition.timezone),
        },
        {
          key: "status",
          label: "Status",
          render: (r: Row) => <Badge value={r.status} />,
        },
        {
          key: "actions",
          label: "Correção",
          render: (r: Row) =>
            r.checkinAt ? (
              <ReasonButton
                title="Cancelar check-in"
                run={(reason) =>
                  action("attendance.correct", {
                    attendanceId: r.id,
                    operation: "CANCEL_CHECK_IN",
                    reason,
                  })
                }
              >
                Corrigir
              </ReasonButton>
            ) : null,
        },
      ],
    },
    passaportes: {
      title: "Passaportes",
      description: "Carimbos emitidos a partir das presenças.",
      collection: "stamps",
      columns: [
        {
          key: "participantId",
          label: "Participante",
          render: (r: Row) => person(data, r.participantId),
        },
        {
          key: "activityId",
          label: "Atividade",
          render: (r: Row) => title(data, r.activityId),
        },
        {
          key: "issuedAt",
          label: "Emitido em",
          render: (r: Row) => dt(r.issuedAt, data.edition.timezone),
        },
        {
          key: "status",
          label: "Status",
          render: (r: Row) => <Badge value={r.status} />,
        },
      ],
    },
    elegibilidade: {
      title: "Elegibilidade",
      description: "Regras recalculadas a partir das presenças.",
      collection: "eligibilities",
      columns: [
        {
          key: "participantId",
          label: "Participante",
          render: (r: Row) => person(data, r.participantId),
        },
        {
          key: "rewardId",
          label: "Brinde",
          render: (r: Row) => find(data, "rewards", r.rewardId).name,
        },
        { key: "reason", label: "Motivo" },
        {
          key: "eligible",
          label: "Status",
          render: (r: Row) => (
            <Badge value={r.eligible ? "ELIGIBLE" : "NOT_ELIGIBLE"} />
          ),
        },
      ],
    },
    auditoria: {
      title: "Auditoria",
      description: "Histórico imutável de ações críticas.",
      collection: "audit",
      columns: [
        {
          key: "createdAt",
          label: "Data",
          render: (r: Row) => dt(r.createdAt, data.edition.timezone),
        },
        { key: "action", label: "Ação" },
        { key: "actorId", label: "Responsável" },
        { key: "entityType", label: "Entidade" },
        { key: "reason", label: "Motivo" },
      ],
    },
  };
  const map = maps[section];
  return (
    <>
      <PageTitle title={map.title} description={map.description} />
      <Panel title={`${all(data, map.collection).length} registros`}>
        <Table
          data={data}
          rows={all(data, map.collection)}
          columns={map.columns}
        />
      </Panel>
    </>
  );
}
function ImportPage() {
  const { data, action, toast } = useJornadas();
  const [file, setFile] = useState<File | null>(null),
    [job, setJob] = useState<Row | null>(null),
    [busy, setBusy] = useState(false);
  async function preview() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("editionId", data.edition.id);
      const res = await fetch("/api/import", { method: "POST", body: form });
      const body = await readApiResponse<any>(
        res,
        "Não foi possível analisar o arquivo.",
      );
      setJob(body);
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Importar participantes"
        description="Valide XLSX ou CSV antes de gravar qualquer linha."
      />
      <Panel
        title="Arquivo de participantes"
        sub="Colunas: Nome completo, RA e Semestre"
      >
        <div className="a-import">
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button className="button" disabled={!file || busy} onClick={preview}>
            {busy ? "Lendo…" : "Pré-visualizar"}
          </button>
        </div>
        {job && (
          <div className="a-import-result">
            <div className="a-metrics">
              <article className="a-metric">
                <strong>{job.valid}</strong>
                <small>Válidos</small>
              </article>
              <article className="a-metric">
                <strong>{job.errors ?? job.invalid}</strong>
                <small>Com erro</small>
              </article>
              <article className="a-metric">
                <strong>{job.duplicates}</strong>
                <small>Duplicados</small>
              </article>
            </div>
            <Table
              data={data}
              rows={job.rows || []}
              columns={[
                { key: "name", label: "Nome" },
                { key: "ra", label: "RA" },
                { key: "semester", label: "Semestre" },
                {
                  key: "status",
                  label: "Validação",
                  render: (r) => (
                    <Badge value={r.error ? "INVALID" : "VALID"} />
                  ),
                },
                { key: "error", label: "Detalhe" },
              ]}
            />
            <RunButton
              disabled={!job.id || !job.valid}
              run={async () => {
                await action("import.confirm", { jobId: job.id });
                setJob(null);
              }}
            >
              Confirmar {job.valid} participantes
            </RunButton>
          </div>
        )}
      </Panel>
    </>
  );
}
function Stock() {
  const { data } = useJornadas();
  return (
    <>
      <PageTitle
        title="Estoque"
        description="Acompanhe cada unidade disponível, reservada e entregue."
      />
      <Panel title="Posição atual">
        <Table
          data={data}
          rows={all(data, "rewards")}
          columns={[
            { key: "name", label: "Item" },
            {
              key: "stockTotal",
              label: "Total",
              render: (r) => r.stockTotal ?? r.total,
            },
            {
              key: "stockAvailable",
              label: "Disponível",
              render: (r) => r.stockAvailable ?? r.available,
            },
            {
              key: "stockReserved",
              label: "Reservado",
              render: (r) => r.stockReserved ?? r.reserved,
            },
            {
              key: "stockDelivered",
              label: "Entregue",
              render: (r) => r.stockDelivered ?? r.delivered,
            },
          ]}
        />
      </Panel>
    </>
  );
}
function Draws() {
  const { data, action } = useJornadas();
  return (
    <>
      <PageTitle
        title="Sorteios"
        description="Rodadas imparciais, com lista congelada e histórico preservado."
      />
      <div className="a-card-grid">
        {all(data, "rewards").map((r) => {
          const eligible = all(data, "eligibilities").filter(
              (e) => e.rewardId === r.id && e.eligible,
            ).length,
            stock = r.stockAvailable ?? r.available ?? r.total;
          return (
            <article className="a-panel" key={r.id}>
              <Gift />
              <h2>{r.name}</h2>
              <p>
                {eligible} elegíveis · {stock} unidades disponíveis
              </p>
              <Badge
                value={eligible > stock ? "DRAW_REQUIRED" : "GUARANTEED"}
              />
              <RunButton
                disabled={!eligible || !stock}
                run={() => action("draw.execute", { rewardId: r.id })}
              >
                Executar distribuição
              </RunButton>
            </article>
          );
        })}
      </div>
      <Panel title="Histórico de rodadas">
        <Table
          data={data}
          rows={all(data, "draws")}
          columns={[
            {
              key: "rewardId",
              label: "Brinde",
              render: (r) => find(data, "rewards", r.rewardId).name,
            },
            { key: "round", label: "Rodada" },
            { key: "eligibleCount", label: "Elegíveis" },
            { key: "stockSnapshot", label: "Unidades" },
            {
              key: "createdAt",
              label: "Executado em",
              render: (r) => dt(r.createdAt, data.edition.timezone),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge value={r.status} />,
            },
            {
              key: "actions",
              label: "Ação",
              render: (r) =>
                r.status === "EXECUTED" ? (
                  <ReasonButton
                    title="Cancelar sorteio"
                    run={(reason) =>
                      action("draw.cancel", { drawId: r.id, reason })
                    }
                  >
                    Cancelar
                  </ReasonButton>
                ) : null,
            },
          ]}
        />
      </Panel>
    </>
  );
}
function Deliveries() {
  const { data, action } = useJornadas();
  const [ra, setRa] = useState("");
  const p = all(data, "participants").find((x) => x.ra === ra);
  const reserv = all(data, "reservations").filter(
    (x) =>
      x.participantId === p?.id && ["RESERVED", "CONFIRMED"].includes(x.status),
  );
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <>
      <PageTitle
        title="Retiradas"
        description="Entregue vários brindes de uma vez, sempre com atualização do estoque."
      />
      <Panel title="Localizar participante">
        <div className="a-toolbar">
          <input
            aria-label="RA para retirada"
            value={ra}
            onChange={(e) => setRa(e.target.value)}
            placeholder="Digite o RA"
          />
          {p && <strong>{name(p)}</strong>}
        </div>
        {p && (
          <div className="a-people-list">
            {reserv.map((r) => {
              const reward = find(data, "rewards", r.rewardId);
              const locked =
                reward.redemptionStartsAt &&
                new Date(data.serverNow) < new Date(reward.redemptionStartsAt);
              return (
                <label key={r.id}>
                  <input
                    type="checkbox"
                    disabled={locked}
                    checked={selected.includes(r.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, r.id]
                          : selected.filter((x) => x !== r.id),
                      )
                    }
                  />
                  <span>
                    <strong>{reward.name}</strong>
                    <small>
                      {locked
                        ? `Retirada a partir de ${dt(reward.redemptionStartsAt, data.edition.timezone)}`
                        : labels[r.status] || r.status}
                    </small>
                  </span>
                </label>
              );
            })}
          </div>
        )}
        <RunButton
          disabled={!selected.length}
          run={async () => {
            await action("delivery.create", { reservationIds: selected });
            setSelected([]);
          }}
        >
          Confirmar entrega de {selected.length || ""}{" "}
          {selected.length === 1 ? "item" : "itens"}
        </RunButton>
      </Panel>
      <Panel title="Histórico">
        <Table
          data={data}
          rows={all(data, "deliveries")}
          columns={[
            {
              key: "participantId",
              label: "Participante",
              render: (r) => person(data, r.participantId),
            },
            {
              key: "rewardId",
              label: "Brinde",
              render: (r) => find(data, "rewards", r.rewardId).name,
            },
            {
              key: "deliveredAt",
              label: "Entrega",
              render: (r) => dt(r.deliveredAt, data.edition.timezone),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge value={r.status} />,
            },
            {
              key: "actions",
              label: "Ação",
              render: (r) =>
                r.status === "DELIVERED" ? (
                  <ReasonButton
                    title="Reverter entrega"
                    run={(reason) =>
                      action("delivery.reverse", { deliveryId: r.id, reason })
                    }
                  >
                    Reverter
                  </ReasonButton>
                ) : null,
            },
          ]}
        />
      </Panel>
    </>
  );
}
function Certificates() {
  const { data, action } = useJornadas();
  const candidates = all(data, "attendances").filter((attendance) => {
    const activity = find(data, "activities", attendance.activityId);
    const category = find(data, "categories", activity.categoryId);
    const alreadyIssued = all(data, "certificates").some(
      (certificate) =>
        certificate.participantId === attendance.participantId &&
        certificate.activityId === attendance.activityId &&
        certificate.status !== "INVALIDATED",
    );
    return (
      category.generatesCertificate &&
      attendance.checkinAt &&
      (!category.requiresCheckout || attendance.checkoutAt) &&
      !alreadyIssued
    );
  });
  return (
    <>
      <PageTitle
        title="Certificados"
        description="Emissão automática por palestra, validação e controle individual."
      />
      <Panel title="Elegíveis para emissão">
        {candidates.length > 0 && (
          <div className="a-row-actions" style={{ marginBottom: 14 }}>
            <RunButton
              run={async () => {
                for (const candidate of candidates) {
                  await action("certificate.issue", {
                    participantId: candidate.participantId,
                    activityId: candidate.activityId,
                  });
                }
              }}
            >
              Emitir todos ({candidates.length})
            </RunButton>
          </div>
        )}
        <Table
          data={data}
          rows={candidates}
          columns={[
            {
              key: "participantId",
              label: "Participante",
              render: (r) => person(data, r.participantId),
            },
            {
              key: "activityId",
              label: "Atividade",
              render: (r) => title(data, r.activityId),
            },
            {
              key: "actions",
              label: "Ação",
              render: (r) => (
                <RunButton
                  run={() =>
                    action("certificate.issue", {
                      participantId: r.participantId,
                      activityId: r.activityId,
                    })
                  }
                >
                  Emitir certificado
                </RunButton>
              ),
            },
          ]}
        />
      </Panel>
      <div style={{ height: 16 }} />
      <Panel title="Certificados da edição">
        <Table
          data={data}
          rows={all(data, "certificates")}
          columns={[
            {
              key: "participantId",
              label: "Participante",
              render: (r) => person(data, r.participantId),
            },
            {
              key: "activityId",
              label: "Atividade",
              render: (r) => title(data, r.activityId),
            },
            {
              key: "workload",
              label: "Carga horária",
              render: (r) => `${r.workload}h`,
            },
            { key: "code", label: "Validação" },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge value={r.status} />,
            },
            {
              key: "actions",
              label: "Ações",
              render: (r) => (
                <div className="a-row-actions">
                  <a
                    href={`/api/certificates/${r.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="a-icon-button"
                    aria-label="Baixar certificado"
                  >
                    <Download size={15} />
                  </a>
                  {r.status !== "INVALIDATED" && (
                    <ReasonButton
                      title="Invalidar certificado"
                      run={(reason) =>
                        action("certificate.invalidate", { id: r.id, reason })
                      }
                    >
                      Invalidar
                    </ReasonButton>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Panel>
      <p className="a-help">
        Novos certificados são emitidos automaticamente ao concluir a presença.
        Em palestras com saída obrigatória, o certificado é liberado após o
        check-out.
      </p>
    </>
  );
}
function Notifications() {
  const { data, action } = useJornadas();
  const [titleText, setTitle] = useState(""),
    [message, setMessage] = useState(""),
    [audience, setAudience] = useState("all");
  return (
    <>
      <PageTitle
        title="Notificações"
        description="Envie comunicados e acompanhe avisos automáticos."
      />
      <Panel title="Novo comunicado">
        <div className="a-form-grid">
          <label className="field">
            Título
            <input
              value={titleText}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="field">
            Público
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="activity">Atividade específica</option>
              <option value="category">Categoria</option>
              <option value="semester">Semestre</option>
            </select>
          </label>
          <label className="field a-field-wide">
            Mensagem
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
        </div>
        <RunButton
          disabled={!titleText || !message}
          run={async () => {
            await action("notification.send", {
              title: titleText,
              message,
              audience,
            });
            setTitle("");
            setMessage("");
          }}
        >
          Enviar comunicado
        </RunButton>
      </Panel>
      <Panel title="Enviadas">
        <Table
          data={data}
          rows={all(data, "notifications")}
          columns={[
            { key: "title", label: "Título" },
            { key: "message", label: "Mensagem" },
            { key: "audience", label: "Público" },
            {
              key: "createdAt",
              label: "Envio",
              render: (r) => dt(r.createdAt, data.edition.timezone),
            },
          ]}
        />
      </Panel>
    </>
  );
}
function Reports() {
  const { data } = useJornadas();
  return (
    <>
      <PageTitle
        title="Relatórios"
        description="Exporte a edição em um workbook completo para análise."
      />
      <Panel
        title="Exportação Excel"
        sub="14 abas com participação, presença, brindes e estoque"
      >
        <div className="a-export">
          <FileSpreadsheet size={48} />
          <div>
            <h3>Relatório consolidado · {data.edition.name}</h3>
            <p>
              Participantes, Atividades, Inscrições, Lista de Espera, Presenças,
              Matriz de Presença, Passaportes, Certificados, Brindes,
              Elegibilidade, Sorteios, Reservas, Entregas e Estoque Final.
            </p>
          </div>
          <a
            className="button"
            href={`/api/export?editionId=${data.edition.id}`}
          >
            <ArrowDownToLine size={17} />
            Baixar Excel
          </a>
        </div>
      </Panel>
    </>
  );
}
function ParticipantDetail({ id }: { id: string }) {
  const { data } = useJornadas();
  const p = find(data, "participants", id);
  if (!p.id) return <Empty>Participante não encontrado.</Empty>;
  return (
    <>
      <Link href="/admin/participantes" className="a-back">
        <ArrowLeft size={16} />
        Participantes
      </Link>
      <PageTitle
        title={name(p)}
        description={`RA ${p.ra} · ${p.semester}º semestre`}
      />
      <div className="a-tabs">
        {[
          "Dados",
          "Inscrições",
          "Lista de espera",
          "Presenças",
          "Passaporte",
          "Certificados",
          "Brindes",
          "Sorteios",
          "Retiradas",
          "Histórico",
        ].map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>
      <div className="a-dashboard-grid">
        <Panel title="Participação">
          <p>
            <strong>
              {
                all(data, "attendances").filter(
                  (a) => a.participantId === id && validAttendance(a),
                ).length
              }
            </strong>{" "}
            de {data.edition.maxCheckins} atividades concluídas
          </p>
          <div className="a-progress">
            <i
              style={{
                width: `${(all(data, "stamps").filter((s) => s.participantId === id && s.status === "VALID").length / Math.max(1, data.edition.maxCheckins)) * 100}%`,
              }}
            />
          </div>
        </Panel>
        <Panel title="Conquistas">
          <p>
            {
              all(data, "reservations").filter((r) => r.participantId === id)
                .length
            }{" "}
            brindes ·{" "}
            {
              all(data, "certificates").filter((c) => c.participantId === id)
                .length
            }{" "}
            certificados
          </p>
        </Panel>
      </div>
      <ListPage section="presencas" />
    </>
  );
}
function ActivityDetailPage({ id }: { id: string }) {
  const { data } = useJornadas();
  const a = find(data, "activities", id);
  return (
    <>
      <Link href="/admin/atividades" className="a-back">
        <ArrowLeft size={16} />
        Atividades
      </Link>
      <PageTitle
        title={a.title || "Atividade"}
        description={`${a.block} · ${a.room} · ${dt(a.startAt, data.edition.timezone)}`}
      />
      <div className="a-metrics">
        {[
          ["Capacidade", a.capacity],
          [
            "Inscritos",
            all(data, "enrollments").filter(
              (e) => e.activityId === id && e.status === "ACTIVE",
            ).length,
          ],
          [
            "Presentes",
            all(data, "attendances").filter(
              (x) => x.activityId === id && validAttendance(x),
            ).length,
          ],
          [
            "Em espera",
            all(data, "waitlist").filter(
              (x) => x.activityId === id && x.status === "WAITING",
            ).length,
          ],
        ].map(([l, v]) => (
          <article className="a-metric" key={l}>
            <strong>{v}</strong>
            <small>{l}</small>
          </article>
        ))}
      </div>
    </>
  );
}
function Settings() {
  return (
    <>
      <PageTitle
        title="Configurações"
        description="Identidade, patrocinadores e regras gerais da edição."
      />
      <EntityManager section="patrocinadores" compact />
      <div style={{ height: 16 }} />
      <EntityManager section="edicoes" compact />
    </>
  );
}
export default function AdminApp({
  section,
  id,
}: {
  section: string;
  id?: string;
}) {
  const { data, loading, error, setEditionId, editionId } = useJornadas();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (loading && !data)
    return <LoadingScreen message="Preparando a administração…" />;
  if (!data?.actor || data.actor.type !== "admin")
    return (
      <main className="empty page">
        <ShieldCheck size={36} />
        <h1>Acesso restrito à equipe.</h1>
        <Link className="button" href="/login/admin">
          Entrar na administração
        </Link>
      </main>
    );
  if (!permitted(data, section))
    return (
      <main className="empty page">
        <ShieldCheck />
        <h1>Sem permissão para esta área.</h1>
        <Link href="/admin">Voltar à visão geral</Link>
      </main>
    );
  let content: ReactNode;
  if (id && section === "participantes")
    content = <ParticipantDetail id={id} />;
  else if (id && section === "atividades")
    content = <ActivityDetailPage id={id} />;
  else if (!section) content = <Dashboard />;
  else if (configs[section]) content = <EntityManager section={section} />;
  else if (section === "importacoes") content = <ImportPage />;
  else if (section === "operacao") content = <Operation />;
  else if (
    [
      "inscricoes",
      "lista-espera",
      "presencas",
      "passaportes",
      "elegibilidade",
      "auditoria",
    ].includes(section)
  )
    content = <ListPage section={section} />;
  else if (section === "estoque") content = <Stock />;
  else if (section === "sorteios") content = <Draws />;
  else if (section === "retiradas") content = <Deliveries />;
  else if (section === "certificados") content = <Certificates />;
  else if (section === "notificacoes") content = <Notifications />;
  else if (section === "relatorios") content = <Reports />;
  else if (section === "configuracoes") content = <Settings />;
  else content = <Empty>Área em preparação.</Empty>;
  return (
    <div className="a-shell">
      <aside className={`a-sidebar ${open ? "open" : ""}`}>
        <div className="a-brand">
          <img
            src="/assets/brand/logo-jornada-2026-trimmed.webp"
            alt="Jornadas"
          />
          <button aria-label="Fechar menu" onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>
        <nav aria-label="Administração">
          {menu
            .filter(([key]) => permitted(data, key))
            .map(([key, label, Icon]) => (
              <Link
                key={key}
                href={`/admin${key ? "/" + key : ""}`}
                className={section === key ? "active" : ""}
                onClick={() => setOpen(false)}
              >
                <Icon size={17} />
                <span>{label}</span>
              </Link>
            ))}
        </nav>
        <div className="a-sidebar-story" aria-hidden="true">
          <p>
            Ciência hoje.
            <br />
            Saúde sempre.
          </p>
          <img src="/assets/brand/cathedral-fachada-trimmed.webp" alt="" />
        </div>
        <button
          className="a-logout"
          onClick={async () => {
            await fetch("/api/auth?kind=admin", { method: "DELETE" });
            router.replace("/login/admin");
            router.refresh();
          }}
        >
          <LogOut size={17} />
          Sair
        </button>
      </aside>
      <div className="a-main">
        <header className="a-header">
          <button
            className="a-menu"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu />
          </button>
          <div className="a-edition-picker">
            <label htmlFor="admin-edition">Edição ativa</label>
            <select
              id="admin-edition"
              aria-label="Edição ativa"
              value={editionId || data.edition.id}
              onChange={(e) => setEditionId(e.target.value)}
            >
              {all(data, "editions").map((e) => (
                <option value={e.id} key={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div className="a-header-user">
            <span className="a-header-bell">
              <Bell size={19} />
            </span>
            <span className="a-header-identity">
              <strong>{data.actor.name}</strong>
              <small>{labels[data.actor.role] || data.actor.role}</small>
            </span>
            <span className="a-avatar">
              <ShieldCheck size={19} />
            </span>
          </div>
        </header>
        {data.devMode && (
          <div className="a-dev">AMBIENTE DEV · dados fictícios</div>
        )}
        {error && <div className="error">{error}</div>}
        <main id="main" className="a-content page-enter">
          {content}
        </main>
      </div>
    </div>
  );
}
