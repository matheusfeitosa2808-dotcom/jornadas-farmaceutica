import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, rgb } from "pdf-lib";

export type CertificatePdfData = {
  participantName: string;
  activityTitle: string;
  speakerNames: string[];
  workload: number;
  issuedAt: Date;
  timezone: string;
  code: string;
  validationUrl: string;
};

type CertificatePdfAssets = {
  template: Uint8Array;
  regularFont: Uint8Array;
  boldFont: Uint8Array;
};

function centeredX(font: PDFFont, text: string, size: number, width: number) {
  return (width - font.widthOfTextAtSize(text, size)) / 2;
}

function fittedSize(
  font: PDFFont,
  text: string,
  preferred: number,
  maxWidth: number,
  minimum: number,
) {
  const measured = font.widthOfTextAtSize(text, preferred);
  return measured > maxWidth
    ? Math.max(minimum, (preferred * maxWidth) / measured)
    : preferred;
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function workloadLabel(workload: number) {
  const amount = Number.isInteger(workload)
    ? String(workload)
    : String(workload).replace(".", ",");
  return `${amount} ${workload === 1 ? "hora" : "horas"}`;
}

export async function buildCertificatePdf(
  data: CertificatePdfData,
  assets: CertificatePdfAssets,
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Certificado - ${data.activityTitle}`);
  pdf.setAuthor("Faculdade Cathedral");
  pdf.setSubject(`Participação de ${data.participantName}`);
  pdf.setCreator("Jornadas");
  const [regular, bold, template] = await Promise.all([
    pdf.embedFont(assets.regularFont, { subset: true }),
    pdf.embedFont(assets.boldFont, { subset: true }),
    pdf.embedPng(assets.template),
  ]);
  const page = pdf.addPage([842, 595]);
  const { width, height } = page.getSize();

  page.drawImage(template, { x: 0, y: 0, width, height });

  // Limpa somente os campos variáveis do arquivo original. A identidade,
  // moldura, título e assinaturas permanecem como no modelo enviado.
  page.drawRectangle({
    x: 88,
    y: 244,
    width: 746,
    height: 190,
    color: rgb(1, 1, 1),
  });

  const ink = rgb(0.045, 0.045, 0.045);
  const muted = rgb(0.26, 0.28, 0.28);
  const drawCentered = (
    text: string,
    y: number,
    size: number,
    font: PDFFont = regular,
    color = ink,
  ) =>
    page.drawText(text, {
      x: centeredX(font, text, size, width),
      y,
      size,
      font,
      color,
    });

  drawCentered("Certificamos que", 402, 12, regular, muted);
  const participantSize = fittedSize(
    bold,
    data.participantName,
    25,
    width - 190,
    15,
  );
  drawCentered(data.participantName, 363, participantSize, bold);

  const speakers = data.speakerNames.filter(Boolean).join(" e ");
  const participation = speakers
    ? `participou da palestra “${data.activityTitle}”, ministrada por ${speakers}, durante a Jornada Farmacêutica 2026, promovida pelo curso de Farmácia da Faculdade Cathedral.`
    : `participou da palestra “${data.activityTitle}”, durante a Jornada Farmacêutica 2026, promovida pelo curso de Farmácia da Faculdade Cathedral.`;
  let bodySize = 11.5;
  let bodyLines = wrapText(regular, participation, bodySize, width - 190);
  while (bodyLines.length > 3 && bodySize > 8.5) {
    bodySize -= 0.5;
    bodyLines = wrapText(regular, participation, bodySize, width - 190);
  }
  const bodyLeading = bodySize + 6.5;
  bodyLines.slice(0, 3).forEach((line, index) =>
    drawCentered(line, 326 - index * bodyLeading, bodySize, regular),
  );
  const workloadY =
    326 - Math.min(bodyLines.length, 3) * bodyLeading - 5;
  drawCentered(
    `Certifica-se sua participação com carga horária total de ${workloadLabel(data.workload)}.`,
    workloadY,
    11.5,
    regular,
  );
  const date = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: data.timezone,
  }).format(data.issuedAt);
  drawCentered(`Boa Vista - RR, ${date}.`, workloadY - 23, 11.5, regular);

  drawCentered(`Código de validação: ${data.code}`, 185, 8, bold, muted);
  const validationSize = fittedSize(
    regular,
    data.validationUrl,
    7.2,
    390,
    5.8,
  );
  drawCentered(data.validationUrl, 172, validationSize, regular, muted);

  return pdf.save();
}
