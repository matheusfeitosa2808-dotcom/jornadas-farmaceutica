"use client";
import { useEffect, useRef, ReactNode } from "react";
import {
  UserRound,
  X,
  ArrowUpRight,
  CalendarDays,
  MapPin,
  Clock3,
} from "lucide-react";
export function Avatar({
  name = "",
  url,
  size = "",
}: {
  name?: string;
  url?: string;
  size?: string;
}) {
  return (
    <span className={`avatar ${size}`} aria-label={name || "Participante"}>
      {url ? <img src={url} alt={name} /> : <UserRound size={22} />}
    </span>
  );
}
const labels: Record<string, string> = {
  ACTIVE: "Ativo",
  PUBLISHED: "Publicada",
  DRAFT: "Rascunho",
  FINISHED: "Encerrada",
  ARCHIVED: "Arquivada",
  OPEN: "Inscrições abertas",
  FULL: "Lotado",
  WAITLIST: "Lista de espera",
  IN_PROGRESS: "Acontecendo agora",
  CANCELLED: "Cancelado",
  COMPLETED: "Concluído",
  NO_SHOW: "Ausente",
  PRESENT: "Presença confirmada",
  VALID: "Válido",
  ELIGIBLE: "Elegível",
  GENERATED: "Gerado",
  RELEASED: "Disponível",
  INVALIDATED: "Invalidado",
  PENDING: "Aguardando confirmação",
  CONFIRMED: "Confirmado",
  RESERVED: "Reservado",
  AVAILABLE: "Disponível",
  DELIVERED: "Entregue",
  EXPIRED: "Expirado",
  WAITING: "Na lista de espera",
  PROMOTED: "Promovido",
  GUARANTEED: "Garantido",
  NOT_ELIGIBLE: "Não elegível",
  AWAITING_DRAW: "Aguardando sorteio",
  NOT_SELECTED: "Não contemplado",
  SELECTED: "Contemplado",
};
export function statusLabel(s: string) {
  return labels[s] || s || "—";
}
export function Badge({
  children,
  status,
  tone = "",
}: {
  children?: ReactNode;
  status?: string;
  tone?: string;
}) {
  const good = [
    "ACTIVE",
    "PRESENT",
    "COMPLETED",
    "VALID",
    "ELIGIBLE",
    "CONFIRMED",
    "RESERVED",
    "DELIVERED",
    "GUARANTEED",
  ].includes(status || "");
  return (
    <span className={`badge ${tone || (good ? "success" : "")}`}>
      {children || statusLabel(status || "")}
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      className="modal"
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Fechar" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <CalendarDays size={28} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function formatDate(
  value: string,
  timezone = "America/Boa_Vista",
  full = false,
) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: full ? "long" : "short",
        timeZone: timezone,
      }).format(new Date(value))
    : "—";
}
export function formatTime(value: string, timezone = "America/Boa_Vista") {
  return value
    ? new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      }).format(new Date(value))
    : "—";
}
export function ActivityMeta({
  activity,
  timezone,
}: {
  activity: any;
  timezone?: string;
}) {
  return (
    <div className="activity-meta">
      <span>
        <CalendarDays size={15} />
        {formatDate(activity.startAt, timezone)}
      </span>
      <span>
        <Clock3 size={15} />
        {formatTime(activity.startAt, timezone)} –{" "}
        {formatTime(activity.endAt, timezone)}
      </span>
      <span>
        <MapPin size={15} />
        {activity.block} · {activity.room}
      </span>
    </div>
  );
}
export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return /^https?:\/\//.test(href) ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-link"
    >
      {children}
      <ArrowUpRight size={16} />
    </a>
  ) : null;
}
