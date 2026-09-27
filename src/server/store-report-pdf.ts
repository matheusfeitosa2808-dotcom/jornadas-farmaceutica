import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type StoreReportData = {
  edition: { name: string; timezone: string };
  generatedAt: Date;
  rewards: any[];
  reservations: any[];
  deliveries: any[];
  draws: any[];
  transactions: any[];
  participants: any[];
};

const A4 = { width: 595.28, height: 841.89 };
const palette = {
  ink: rgb(0.05, 0.2, 0.26),
  teal: rgb(0.05, 0.32, 0.38),
  gold: rgb(0.72, 0.52, 0.2),
  paper: rgb(0.98, 0.97, 0.94),
  pale: rgb(0.93, 0.95, 0.93),
  line: rgb(0.84, 0.87, 0.85),
  muted: rgb(0.37, 0.43, 0.44),
  white: rgb(1, 1, 1),
  warning: rgb(0.67, 0.25, 0.18),
};

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function labelStatus(value: unknown) {
  const labels: Record<string, string> = {
    AWAITING_DRAW: "Aguardando distribuição",
    AWAITING_CONFIRMATION: "Aguardando confirmação",
    RESERVED: "Reservado",
    CONFIRMED: "Confirmado",
    DELIVERED: "Entregue",
    EXPIRED: "Cancelado/reembolsado",
    REVERSED: "Entrega revertida",
    EXECUTED: "Executado",
    CANCELLED: "Cancelado",
  };
  return labels[String(value)] || clean(value);
}

function formatDate(value: Date | string, zone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: zone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = clean(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function buildStoreReportPdf(data: StoreReportData) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 38;
  const contentWidth = A4.width - margin * 2;
  let page: PDFPage;
  let y = 0;
  let pageNumber = 0;

  const addPage = () => {
    page = pdf.addPage([A4.width, A4.height]);
    pageNumber += 1;
    page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: palette.paper });
    page.drawRectangle({ x: 0, y: A4.height - 15, width: A4.width, height: 15, color: palette.teal });
    page.drawText("JORNADAS  |  GESTÃO DA LOJA", { x: margin, y: A4.height - 34, size: 7.5, font: bold, color: palette.gold });
    page.drawText(clean(data.edition.name), { x: margin, y: A4.height - 50, size: 8.5, font: regular, color: palette.muted });
    page.drawLine({ start: { x: margin, y: 35 }, end: { x: A4.width - margin, y: 35 }, thickness: 0.7, color: palette.line });
    page.drawText(`Relatório gerado em ${formatDate(data.generatedAt, data.edition.timezone)}`, { x: margin, y: 20, size: 7, font: regular, color: palette.muted });
    const number = `Página ${pageNumber}`;
    page.drawText(number, { x: A4.width - margin - regular.widthOfTextAtSize(number, 7), y: 20, size: 7, font: regular, color: palette.muted });
    y = A4.height - 72;
  };

  const ensure = (height: number) => {
    if (y - height < 48) addPage();
  };

  const heading = (title: string, subtitle?: string) => {
    // Reserve enough room for the heading and the first table header/row so
    // section titles never become orphaned at the bottom of a page.
    ensure(subtitle ? 88 : 72);
    page.drawText(clean(title), { x: margin, y, size: 15, font: bold, color: palette.ink });
    y -= 17;
    if (subtitle) {
      const lines = wrap(subtitle, regular, 8, contentWidth);
      for (const line of lines) {
        page.drawText(line, { x: margin, y, size: 8, font: regular, color: palette.muted });
        y -= 11;
      }
    }
    y -= 8;
  };

  const table = (
    columns: { label: string; width: number; align?: "left" | "right" }[],
    rows: string[][],
    empty: string,
  ) => {
    const headerHeight = 24;
    const drawHeader = () => {
      ensure(headerHeight + 24);
      page.drawRectangle({ x: margin, y: y - headerHeight + 6, width: contentWidth, height: headerHeight, color: palette.teal });
      let x = margin + 7;
      columns.forEach((column) => {
        page.drawText(column.label, { x, y: y - 9, size: 6.6, font: bold, color: palette.white });
        x += column.width;
      });
      y -= headerHeight;
    };
    drawHeader();
    if (!rows.length) {
      page.drawText(empty, { x: margin + 7, y: y - 8, size: 8, font: regular, color: palette.muted });
      y -= 28;
      return;
    }
    rows.forEach((row, rowIndex) => {
      const wrapped = columns.map((column, index) => wrap(row[index] || "-", regular, 7, column.width - 12));
      const rowHeight = Math.max(25, Math.max(...wrapped.map((lines) => lines.length)) * 9 + 10);
      if (y - rowHeight < 48) {
        addPage();
        y = A4.height - 88;
        page.drawText("CONTINUAÇÃO DO RELATÓRIO", {
          x: margin,
          y,
          size: 8,
          font: bold,
          color: palette.gold,
        });
        y -= 18;
        drawHeader();
      }
      if (rowIndex % 2 === 0) page.drawRectangle({ x: margin, y: y - rowHeight + 6, width: contentWidth, height: rowHeight, color: palette.white, opacity: 0.62 });
      let x = margin + 7;
      wrapped.forEach((lines, index) => {
        lines.forEach((line, lineIndex) => {
          let textX = x;
          if (columns[index].align === "right") textX = x + columns[index].width - 12 - regular.widthOfTextAtSize(line, 7);
          page.drawText(line, { x: textX, y: y - 8 - lineIndex * 9, size: 7, font: regular, color: palette.ink });
        });
        x += columns[index].width;
      });
      page.drawLine({ start: { x: margin, y: y - rowHeight + 6 }, end: { x: margin + contentWidth, y: y - rowHeight + 6 }, thickness: 0.4, color: palette.line });
      y -= rowHeight;
    });
    y -= 14;
  };

  const participantById = new Map(data.participants.map((participant) => [participant.id, participant]));
  const rewardById = new Map(data.rewards.map((reward) => [reward.id, reward]));
  const ledger = new Map<string, number>();
  data.transactions.forEach((transaction) => {
    ledger.set(transaction.sourceId, (ledger.get(transaction.sourceId) || 0) + Number(transaction.balanceDelta || 0));
  });
  const xpRewardIds = new Set(data.rewards.filter((reward) => reward.redemptionMode === "XP_STORE").map((reward) => reward.id));
  const activePurchaseStatuses = new Set([
    "AWAITING_DRAW",
    "AWAITING_CONFIRMATION",
    "RESERVED",
    "CONFIRMED",
    "DELIVERED",
  ]);
  const activePurchases = data.reservations.filter(
    (reservation) => xpRewardIds.has(reservation.rewardId) && activePurchaseStatuses.has(reservation.status),
  );
  const activeDeliveries = data.deliveries.filter((delivery) => delivery.status === "DELIVERED");
  const pending = data.reservations.filter((reservation) => reservation.status === "AWAITING_DRAW" && xpRewardIds.has(reservation.rewardId));
  const ready = data.reservations.filter((reservation) => ["RESERVED", "CONFIRMED"].includes(reservation.status));
  const netSpent = data.transactions.reduce((sum, transaction) => sum + Number(transaction.balanceDelta || 0), 0);
  const refunded = data.transactions.filter((transaction) => Number(transaction.balanceDelta || 0) > 0).reduce((sum, transaction) => sum + Number(transaction.balanceDelta || 0), 0);

  addPage();
  page.drawText("RELATÓRIO DA LOJA", { x: margin, y, size: 8, font: bold, color: palette.gold });
  y -= 32;
  page.drawText("Prêmios, XP e retiradas", { x: margin, y, size: 27, font: bold, color: palette.ink });
  y -= 25;
  page.drawText("Visão consolidada para distribuição e prestação de contas.", { x: margin, y, size: 10, font: regular, color: palette.muted });
  y -= 30;

  const metrics = [
    ["XP comprometido", `${Math.max(0, -netSpent)} XP`],
    ["XP devolvido", `${refunded} XP`],
    ["Compras ativas", String(activePurchases.length)],
    ["Pedidos pendentes", String(pending.length)],
    ["Prontos para retirada", String(ready.length)],
    ["Itens entregues", String(activeDeliveries.length)],
  ];
  metrics.forEach(([label, value], index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const width = (contentWidth - 16) / 3;
    const x = margin + column * (width + 8);
    const top = y - row * 62;
    page.drawRectangle({ x, y: top - 47, width, height: 50, color: palette.white, borderColor: palette.line, borderWidth: 0.7 });
    page.drawText(label, { x: x + 10, y: top - 14, size: 7, font: regular, color: palette.muted });
    page.drawText(value, { x: x + 10, y: top - 34, size: 14, font: bold, color: palette.teal });
  });
  y -= 135;

  heading("Regras de distribuição");
  const rules = [
    "1º lugar: Ecobag + Scrubs, sem gasto de XP.",
    "2º ao 21º: Copo e direito a uma compra na loja.",
    "22º ao 45º: Ecobag e direito a uma compra na loja.",
    "46º em diante: até duas compras na loja com XP.",
    "A compra reduz o saldo disponível, mas não altera o XP acumulado nem a posição no ranking.",
  ];
  rules.forEach((rule) => {
    ensure(17);
    page.drawCircle({ x: margin + 4, y: y + 3, size: 2.2, color: palette.gold });
    page.drawText(rule, { x: margin + 13, y, size: 8.2, font: regular, color: palette.ink });
    y -= 16;
  });
  y -= 8;

  heading("Estoque e distribuição", "Compraram reúne os pedidos ativos. Só há sorteio quando Aguardando supera o Estoque livre.");
  table(
    [
      { label: "ITEM", width: 103 },
      { label: "TIPO", width: 61 },
      { label: "TOTAL", width: 42, align: "right" },
      { label: "COMPR.", width: 50, align: "right" },
      { label: "AGUARD.", width: 53, align: "right" },
      { label: "RESERV.", width: 53, align: "right" },
      { label: "ENTREG.", width: 53, align: "right" },
      { label: "LIVRE", width: 50, align: "right" },
      { label: "XP", width: 34, align: "right" },
    ],
    data.rewards.map((reward) => {
      const awaiting = data.reservations.filter((reservation) => reservation.rewardId === reward.id && reservation.status === "AWAITING_DRAW").reduce((sum, reservation) => sum + Number(reservation.quantity || 1), 0);
      const reserved = data.reservations.filter((reservation) => reservation.rewardId === reward.id && ["RESERVED", "CONFIRMED"].includes(reservation.status)).reduce((sum, reservation) => sum + Number(reservation.quantity || 1), 0);
      const delivered = activeDeliveries.filter((delivery) => delivery.rewardId === reward.id).reduce((sum, delivery) => sum + Number(delivery.quantity || 1), 0);
      const bought = activePurchases.filter((reservation) => reservation.rewardId === reward.id).reduce((sum, reservation) => sum + Number(reservation.quantity || 1), 0);
      const type = reward.exclusiveGroup === "RANKING_POSITION" ? "Ranking" : reward.redemptionMode === "XP_STORE" ? "Loja XP" : "Carimbo";
      return [reward.name, type, reward.total, bought, awaiting, reserved, delivered, Math.max(0, reward.total - reserved - delivered), reward.redemptionMode === "XP_STORE" ? reward.xpCost : "-"] .map(String);
    }),
    "Nenhum item cadastrado.",
  );

  heading("Decisão de sorteio", "A conta usa somente pedidos aguardando e estoque livre. Reservas e entregas já foram descontadas do estoque.");
  table(
    [
      { label: "ITEM", width: 180 },
      { label: "AGUARDANDO", width: 88, align: "right" },
      { label: "ESTOQUE LIVRE", width: 96, align: "right" },
      { label: "DECISÃO", width: 155 },
    ],
    data.rewards
      .filter((reward) => reward.redemptionMode === "XP_STORE")
      .map((reward) => {
        const awaiting = data.reservations.filter((reservation) => reservation.rewardId === reward.id && reservation.status === "AWAITING_DRAW").reduce((sum, reservation) => sum + Number(reservation.quantity || 1), 0);
        const reserved = data.reservations.filter((reservation) => reservation.rewardId === reward.id && ["RESERVED", "CONFIRMED"].includes(reservation.status)).reduce((sum, reservation) => sum + Number(reservation.quantity || 1), 0);
        const delivered = activeDeliveries.filter((delivery) => delivery.rewardId === reward.id).reduce((sum, delivery) => sum + Number(delivery.quantity || 1), 0);
        const available = Math.max(0, Number(reward.total || 0) - reserved - delivered);
        return [reward.name, String(awaiting), String(available), awaiting > available ? "Sorteio necessário" : awaiting ? "Todos cabem" : "Sem pedidos"];
      }),
    "Nenhum item da loja com XP cadastrado.",
  );

  addPage();
  heading("Quem comprou", "A lista identifica participante, RA, item e situação. Cancelamentos permanecem no histórico para auditoria.");
  table(
    [
      { label: "PARTICIPANTE", width: 167 },
      { label: "RA", width: 58 },
      { label: "ITEM", width: 112 },
      { label: "XP LÍQ.", width: 55, align: "right" },
      { label: "SITUAÇÃO", width: 127 },
    ],
    data.reservations
      .filter((reservation) => xpRewardIds.has(reservation.rewardId))
      .map((reservation) => {
        const participant = participantById.get(reservation.participantId) || {};
        return [participant.name || "Participante", participant.ra || "-", rewardById.get(reservation.rewardId)?.name || "Item", `${Math.max(0, -(ledger.get(reservation.id) || 0))} XP`, labelStatus(reservation.status)];
      }),
    "Nenhuma compra com XP registrada.",
  );

  heading("Retiradas", "Itens entregues e reversões registradas pela organização.");
  table(
    [
      { label: "PARTICIPANTE", width: 170 },
      { label: "RA", width: 58 },
      { label: "ITEM", width: 120 },
      { label: "DATA", width: 94 },
      { label: "SITUAÇÃO", width: 77 },
    ],
    data.deliveries.map((delivery) => {
      const participant = participantById.get(delivery.participantId) || {};
      return [participant.name || "Participante", participant.ra || "-", rewardById.get(delivery.rewardId)?.name || "Item", formatDate(delivery.deliveredAt, data.edition.timezone), labelStatus(delivery.status)];
    }),
    "Nenhuma retirada registrada.",
  );

  heading("Histórico de distribuições", "Rodadas da loja com a decisão entre contemplação direta e sorteio.");
  table(
    [
      { label: "ITEM", width: 150 },
      { label: "RODADA", width: 52, align: "right" },
      { label: "DECISÃO", width: 95 },
      { label: "PEDIDOS", width: 58, align: "right" },
      { label: "ESTOQUE", width: 60, align: "right" },
      { label: "DATA", width: 104 },
    ],
    data.draws.map((draw) => [rewardById.get(draw.rewardId)?.name || "Item", draw.round, draw.mode === "DRAW" ? "Sorteio" : "Todos contemplados", draw.eligibleCount, draw.stockSnapshot, formatDate(draw.createdAt, data.edition.timezone)].map(String)),
    "Nenhuma distribuição finalizada.",
  );

  const pages = pdf.getPages();
  pages.forEach((currentPage, index) => {
    const number = `Página ${index + 1} de ${pages.length}`;
    currentPage.drawRectangle({ x: A4.width - margin - 70, y: 15, width: 72, height: 14, color: palette.paper });
    currentPage.drawText(number, { x: A4.width - margin - regular.widthOfTextAtSize(number, 7), y: 20, size: 7, font: regular, color: palette.muted });
  });
  pdf.setTitle(`Relatório da Loja - ${clean(data.edition.name)}`);
  pdf.setAuthor("Jornadas");
  pdf.setSubject("Prêmios, compras com XP, sorteios e retiradas");
  return pdf.save();
}
