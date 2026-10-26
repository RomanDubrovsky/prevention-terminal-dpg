/**
 * Certificate Generator & Batch Packaging for Webinars and Courses
 * Renders high-resolution certificates (2000x1414, A4 landscape) on HTML5 Canvas.
 * Supports built-in styles (Classic Gold, Modern Emerald, Minimal Clean) and custom author background uploads.
 * Includes client-side non-compressed ZIP packaging and mailing list export.
 */

import { type CourseStudent, buildStudentLink } from "./course_students_store.ts";

export type CertificateTemplateStyle = "classic_gold" | "modern_emerald" | "minimal_clean" | "custom";

export interface CertificateConfig {
  templateStyle: CertificateTemplateStyle;
  customBackgroundDataUrl?: string; // Uploaded custom PNG/JPG
  title: string; // e.g. "СЕРТИФИКАТ УЧАСТНИКА"
  subtitle: string; // e.g. "Настоящим подтверждается, что"
  studentName: string; // ФИО
  courseTitle: string; // Название курса / вебинара
  descriptionText: string; // e.g. "успешно освоил(а) практическую программу и принял(а) активное участие в разборах кейсов"
  hoursText: string; // e.g. "Объем: 16 академических часов"
  authorName: string; // e.g. "Ведущий программы: Роман Иванов"
  organizationText: string; // e.g. "Институт Динамической Психотерапии и Академия Prevention"
  issueDate: string; // e.g. "15 октября 2026 г."
  certificateNumber: string; // e.g. "IDA-2026-9841"
  showStamp: boolean;
  showQrBadge: boolean;
}

export const DEFAULT_CERTIFICATE_CONFIG: CertificateConfig = {
  templateStyle: "classic_gold",
  title: "СЕРТИФИКАТ УЧАСТНИКА",
  subtitle: "Настоящим подтверждается, что",
  studentName: "Елена Смирнова",
  courseTitle: "Практикум по работе с тревожными состояниями",
  descriptionText: "успешно освоил(а) программу вебинара, изучил(а) практические протоколы и принял(а) участие в разборе клинических кейсов",
  hoursText: "В объеме 8 академических часов",
  authorName: "Ведущий: к.псх.н., супервизор Роман Иванов",
  organizationText: "Академия прикладной психологии и супервизии (IDA Academy)",
  issueDate: new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) + " г.",
  certificateNumber: "IDA-2026-001",
  showStamp: true,
  showQrBadge: true,
};

// --- CRC32 for ZIP generation ---
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Simple ZIP packaging (STORE method - 0 compression, ideal for pre-compressed PNGs)
export function createZipArchive(files: { name: string; data: Uint8Array }[]): Blob {
  const fileRecords: {
    nameBytes: Uint8Array;
    data: Uint8Array;
    crc: number;
    offset: number;
  }[] = [];

  const parts: Uint8Array[] = [];
  let currentOffset = 0;
  const encoder = new TextEncoder();

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const fileCrc = crc32(file.data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true); // Local file header signature
    view.setUint16(4, 20, true); // Version needed to extract
    view.setUint16(6, 0, true); // General purpose bit flag
    view.setUint16(8, 0, true); // Compression method: 0 (STORE)
    view.setUint16(10, 0, true); // Last mod file time
    view.setUint16(12, 0, true); // Last mod file date
    view.setUint32(14, fileCrc, true); // CRC-32
    view.setUint32(18, file.data.length, true); // Compressed size
    view.setUint32(22, file.data.length, true); // Uncompressed size
    view.setUint16(26, nameBytes.length, true); // File name length
    view.setUint16(28, 0, true); // Extra field length

    localHeader.set(nameBytes, 30);

    parts.push(localHeader);
    parts.push(file.data);

    fileRecords.push({
      nameBytes,
      data: file.data,
      crc: fileCrc,
      offset: currentOffset,
    });

    currentOffset += localHeader.length + file.data.length;
  }

  const centralDirStart = currentOffset;
  let centralDirSize = 0;

  for (const rec of fileRecords) {
    const cdHeader = new Uint8Array(46 + rec.nameBytes.length);
    const view = new DataView(cdHeader.buffer);

    view.setUint32(0, 0x02014b50, true); // Central directory file header signature
    view.setUint16(4, 20, true); // Version made by
    view.setUint16(6, 20, true); // Version needed to extract
    view.setUint16(8, 0, true); // Bit flag
    view.setUint16(10, 0, true); // Compression method (STORE)
    view.setUint16(12, 0, true); // Mod time
    view.setUint16(14, 0, true); // Mod date
    view.setUint32(16, rec.crc, true); // CRC-32
    view.setUint32(20, rec.data.length, true); // Compressed size
    view.setUint32(24, rec.data.length, true); // Uncompressed size
    view.setUint16(28, rec.nameBytes.length, true); // File name length
    view.setUint16(30, 0, true); // Extra field length
    view.setUint16(32, 0, true); // File comment length
    view.setUint16(34, 0, true); // Disk number start
    view.setUint16(36, 0, true); // Internal file attributes
    view.setUint32(38, 0, true); // External file attributes
    view.setUint32(42, rec.offset, true); // Relative offset of local header

    cdHeader.set(rec.nameBytes, 46);

    parts.push(cdHeader);
    centralDirSize += cdHeader.length;
  }

  // End of central directory record
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // Signature
  eocdView.setUint16(4, 0, true); // Number of this disk
  eocdView.setUint16(6, 0, true); // Disk where central directory starts
  eocdView.setUint16(8, fileRecords.length, true); // Number of central directory records on this disk
  eocdView.setUint16(10, fileRecords.length, true); // Total number of central directory records
  eocdView.setUint32(12, centralDirSize, true); // Size of central directory
  eocdView.setUint32(16, centralDirStart, true); // Offset of start of central directory
  eocdView.setUint16(20, 0, true); // Comment length

  parts.push(eocd);

  return new Blob(parts, { type: "application/zip" });
}

// Canvas rendering helper functions
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = ctx.measureText(testLine).width;
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Draws the certificate on a provided HTML5 Canvas element
 */
export async function renderCertificateToCanvas(
  canvas: HTMLCanvasElement,
  config: CertificateConfig
): Promise<void> {
  const width = 2000;
  const height = 1414; // A4 landscape aspect ratio approx 1.414

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // If custom background is provided
  if (config.templateStyle === "custom" && config.customBackgroundDataUrl) {
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = config.customBackgroundDataUrl!;
      });
      ctx.drawImage(img, 0, 0, width, height);
    } catch (e) {
      console.warn("Failed to draw custom background, fallback to classic", e);
      drawClassicBackground(ctx, width, height);
    }
  } else if (config.templateStyle === "modern_emerald") {
    drawModernEmeraldBackground(ctx, width, height);
  } else if (config.templateStyle === "minimal_clean") {
    drawMinimalCleanBackground(ctx, width, height);
  } else {
    // Default: classic_gold
    drawClassicBackground(ctx, width, height);
  }

  // Draw Typography and Content
  drawCertificateContent(ctx, width, height, config);

  // Optional Stamp
  if (config.showStamp) {
    drawOfficialStamp(ctx, width - 360, height - 340);
  }

  // Optional Verification / QR Badge
  if (config.showQrBadge) {
    drawVerificationBadge(ctx, 160, height - 240, config.certificateNumber);
  }
}

function drawClassicBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Rich ivory parchment background
  const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 200, w / 2, h / 2, w * 0.7);
  bgGrad.addColorStop(0, "#ffffff");
  bgGrad.addColorStop(0.7, "#faf8f5");
  bgGrad.addColorStop(1, "#f3efe8");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Outer decorative border
  ctx.strokeStyle = "#b45309";
  ctx.lineWidth = 6;
  ctx.strokeRect(60, 60, w - 120, h - 120);

  // Inner subtle border
  ctx.strokeStyle = "rgba(180, 83, 9, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(74, 74, w - 148, h - 148);

  // Thin interior border
  ctx.strokeStyle = "rgba(180, 83, 9, 0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(90, 90, w - 180, h - 180);

  // Decorative Corner Flourishes
  const cornerSize = 40;
  const corners = [
    { x: 90, y: 90, dx: 1, dy: 1 },
    { x: w - 90, y: 90, dx: -1, dy: 1 },
    { x: 90, y: h - 90, dx: 1, dy: -1 },
    { x: w - 90, y: h - 90, dx: -1, dy: -1 },
  ];

  ctx.strokeStyle = "#d97706";
  ctx.lineWidth = 3;
  for (const c of corners) {
    ctx.beginPath();
    ctx.moveTo(c.x, c.y + c.dy * cornerSize);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(c.x + c.dx * cornerSize, c.y);
    ctx.stroke();

    // Small dot in corner
    ctx.fillStyle = "#b45309";
    ctx.beginPath();
    ctx.arc(c.x + c.dx * 12, c.y + c.dy * 12, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawModernEmeraldBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Modern subtle pearl white
  ctx.fillStyle = "#fcfdfd";
  ctx.fillRect(0, 0, w, h);

  // Emerald gradient top bar
  const topGrad = ctx.createLinearGradient(0, 0, w, 0);
  topGrad.addColorStop(0, "#0f766e");
  topGrad.addColorStop(0.5, "#0d9488");
  topGrad.addColorStop(1, "#14b8a6");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, w, 24);

  // Emerald gradient bottom bar
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, h - 24, w, 24);

  // Clean modern thin frame
  ctx.strokeStyle = "#ccfbf1";
  ctx.lineWidth = 2;
  ctx.strokeRect(80, 80, w - 160, h - 160);

  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 4;
  ctx.strokeRect(96, 96, w - 192, h - 192);

  // Geometric subtle corner accents
  ctx.fillStyle = "rgba(15, 118, 110, 0.08)";
  ctx.fillRect(96, 96, 60, 60);
  ctx.fillRect(w - 96 - 60, 96, 60, 60);
  ctx.fillRect(96, h - 96 - 60, 60, 60);
  ctx.fillRect(w - 96 - 60, h - 96 - 60, 60, 60);
}

function drawMinimalCleanBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Pure modern minimalist white
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  // Very crisp subtle dual border
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(60, 60, w - 120, h - 120);

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2;
  ctx.strokeRect(84, 84, w - 168, h - 168);
}

function drawCertificateContent(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  c: CertificateConfig
) {
  const isEmerald = c.templateStyle === "modern_emerald";
  const primaryColor = isEmerald ? "#0f766e" : "#0f172a";
  const accentColor = isEmerald ? "#0d9488" : "#b45309";
  const secondaryColor = "#475569";

  ctx.textAlign = "center";

  // 1. Organization Header
  ctx.font = "bold 24px 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = accentColor;
  ctx.letterSpacing = "2px";
  ctx.fillText(c.organizationText.toUpperCase(), w / 2, 170);

  // 2. Small decorative emblem / line
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 120, 205);
  ctx.lineTo(w / 2 + 120, 205);
  ctx.stroke();

  // 3. Main Title (СЕРТИФИКАТ)
  ctx.font = "bold 68px 'Times New Roman', 'Georgia', serif";
  ctx.fillStyle = primaryColor;
  ctx.letterSpacing = "6px";
  ctx.fillText(c.title.toUpperCase(), w / 2, 300);

  // 4. Subtitle (Настоящим подтверждается, что)
  ctx.font = "italic 30px 'Georgia', serif";
  ctx.fillStyle = secondaryColor;
  ctx.letterSpacing = "1px";
  ctx.fillText(c.subtitle, w / 2, 380);

  // 5. Student Full Name (Hero Element)
  ctx.font = "bold 64px 'Times New Roman', 'Georgia', serif";
  ctx.fillStyle = primaryColor;
  ctx.letterSpacing = "1px";
  ctx.fillText(c.studentName, w / 2, 490);

  // Gold/Emerald separator under student name
  const nameWidth = Math.min(ctx.measureText(c.studentName).width + 80, 900);
  const sepGrad = ctx.createLinearGradient(w / 2 - nameWidth / 2, 0, w / 2 + nameWidth / 2, 0);
  sepGrad.addColorStop(0, "transparent");
  sepGrad.addColorStop(0.5, accentColor);
  sepGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = sepGrad;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w / 2 - nameWidth / 2, 530);
  ctx.lineTo(w / 2 + nameWidth / 2, 530);
  ctx.stroke();

  // 6. Achievement text
  ctx.font = "30px 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = secondaryColor;
  ctx.letterSpacing = "0px";
  const descLines = wrapText(ctx, c.descriptionText, 1300);
  let curY = 610;
  for (const line of descLines) {
    ctx.fillText(line, w / 2, curY);
    curY += 46;
  }

  // 7. Course / Webinar Title
  curY += 15;
  ctx.font = "bold 44px 'Times New Roman', 'Georgia', serif";
  ctx.fillStyle = accentColor;
  const courseLines = wrapText(ctx, `«${c.courseTitle}»`, 1400);
  for (const line of courseLines) {
    ctx.fillText(line, w / 2, curY);
    curY += 56;
  }

  // 8. Hours
  if (c.hoursText.trim()) {
    curY += 10;
    ctx.font = "bold 26px 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = secondaryColor;
    ctx.fillText(c.hoursText, w / 2, curY);
  }

  // 9. Signatures and Date Footer
  const footerY = h - 200;

  // Author / Instructor (Right-aligned / Center-right)
  ctx.textAlign = "right";
  ctx.font = "bold 26px 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = primaryColor;
  ctx.fillText(c.authorName, w - 240, footerY);

  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w - 560, footerY + 15);
  ctx.lineTo(w - 240, footerY + 15);
  ctx.stroke();

  ctx.font = "italic 20px 'Georgia', serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("Подпись ведущего / эксперта программы", w - 240, footerY + 45);

  // Issue Date (Left / Center-left)
  ctx.textAlign = "left";
  ctx.font = "bold 24px 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = primaryColor;
  ctx.fillText(`Дата выдачи: ${c.issueDate}`, 240, footerY);

  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(240, footerY + 15);
  ctx.lineTo(540, footerY + 15);
  ctx.stroke();

  ctx.font = "20px 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(`Рег. номер: ${c.certificateNumber}`, 240, footerY + 45);
}

function drawOfficialStamp(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.08); // Slight organic stamp tilt

  // Golden / Blue embossed circle
  ctx.strokeStyle = "rgba(180, 83, 9, 0.75)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 85, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(180, 83, 9, 0.4)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, 75, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Stamp center text
  ctx.textAlign = "center";
  ctx.font = "bold 15px 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "rgba(180, 83, 9, 0.85)";
  ctx.fillText("IDA ACADEMY", 0, -22);

  ctx.font = "bold 22px 'Times New Roman', serif";
  ctx.fillText("★ ★ ★", 0, 5);

  ctx.font = "bold 14px 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("ПОДТВЕРЖДЕНО", 0, 28);

  ctx.font = "11px 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("VERIFIED CREATOR", 0, 46);

  ctx.restore();
}

function drawVerificationBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  code: string
) {
  ctx.save();
  ctx.translate(x, y);

  // Security badge background
  ctx.fillStyle = "rgba(241, 245, 249, 0.9)";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(0, 0, 260, 68, 8);
  ctx.fill();
  ctx.stroke();

  // Shield icon representation
  ctx.font = "24px 'Segoe UI Emoji', sans-serif";
  ctx.fillText("🛡️", 14, 42);

  // Verification text
  ctx.textAlign = "left";
  ctx.font = "bold 12px 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.fillText("ЦИФРОВОЙ СЕРТИФИКАТ", 52, 28);

  ctx.font = "11px monospace";
  ctx.fillStyle = "#64748b";
  ctx.fillText(`ID: ${code}`, 52, 48);

  ctx.restore();
}

/**
 * Generates PNG Data URL of certificate
 */
export async function generateCertificateDataUrl(
  config: CertificateConfig
): Promise<string> {
  const canvas = document.createElement("canvas");
  await renderCertificateToCanvas(canvas, config);
  return canvas.toDataURL("image/png", 0.95);
}

/**
 * Downloads a single certificate PNG
 */
export async function downloadCertificatePng(
  config: CertificateConfig,
  filename?: string
): Promise<void> {
  const dataUrl = await generateCertificateDataUrl(config);
  const cleanName = config.studentName.replace(/[^\wа-яА-ЯёЁ0-9_-]/g, "_").slice(0, 40);
  const finalFilename = filename || `sertifikat_${cleanName}.png`;

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports batch certificates for all selected students as a single ZIP archive
 */
export async function exportCertificateBatchZip(
  students: CourseStudent[],
  baseConfig: CertificateConfig,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const files: { name: string; data: Uint8Array }[] = [];
  const canvas = document.createElement("canvas");

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const studentConfig: CertificateConfig = {
      ...baseConfig,
      studentName: student.fullName,
      certificateNumber: `IDA-${new Date().getFullYear()}-${student.accessCode || (i + 1).toString().padStart(4, "0")}`,
    };

    await renderCertificateToCanvas(canvas, studentConfig);

    // Convert canvas to blob, then to Uint8Array
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png", 0.95));
    if (blob) {
      const buffer = await blob.arrayBuffer();
      const cleanFio = student.fullName.replace(/[^\wа-яА-ЯёЁ0-9_-]/g, "_").slice(0, 30);
      files.push({
        name: `sertifikat_${cleanFio}_${student.accessCode}.png`,
        data: new Uint8Array(buffer),
      });
    }

    if (onProgress) {
      onProgress(i + 1, students.length);
    }
  }

  const zipBlob = createZipArchive(files);
  const url = URL.createObjectURL(zipBlob);
  const now = new Date().toISOString().slice(0, 10);
  const safeTitle = baseConfig.courseTitle.replace(/[^\wа-яА-ЯёЁ0-9_-]/g, "_").slice(0, 30);

  const link = document.createElement("a");
  link.href = url;
  link.download = `sertifikaty_${safeTitle}_${now}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports mailing spreadsheet (CSV) with personal video recording links,
 * access codes, certificate numbers, and pre-formatted email text.
 */
export function exportMailingSheetCsv(
  students: CourseStudent[],
  options: {
    courseOrWebinarTitle: string;
    webinarId?: string;
    courseId?: string;
  }
): void {
  function csvCell(raw: string | number | null | undefined): string {
    const v = String(raw ?? "").replace(/"/g, '""');
    return `"${v}"`;
  }

  const headers = [
    "ФИО студента",
    "Email",
    "Телефон",
    "Telegram",
    "Программа / Вебинар",
    "Код доступа",
    "Ссылка на курс / кабинет",
    "Персональная ссылка на видеозапись",
    "Номер сертификата",
    "Готовый текст для отправки (Email / Telegram)",
  ];

  const lines = [headers.map(csvCell).join(";")];
  const origin = typeof window !== "undefined" && window.location.origin.includes("academy.ida-psy")
    ? window.location.origin
    : "https://academy.ida-psy.ru";

  for (const s of students) {
    const certNum = `IDA-${new Date().getFullYear()}-${s.accessCode}`;
    const studentCabinetLink = buildStudentLink(s, options.courseId);

    // Personal protected video link with access code
    const personalVideoLink = options.webinarId
      ? `${origin}/?webinar=${encodeURIComponent(options.webinarId)}&viewer=${encodeURIComponent(s.accessCode)}&email=${encodeURIComponent(s.email || "")}`
      : studentCabinetLink;

    const emailTemplate = `Здравствуйте, ${s.fullName.split(" ")[1] || s.fullName}!

Благодарим вас за участие в программе «${options.courseOrWebinarTitle}».

Ваш персональный доступ:
🎥 Просмотр защищенной записи: ${personalVideoLink}
🔑 Ваш персональный код доступа: ${s.accessCode}
🎓 Номер вашего именного сертификата: ${certNum}

(Именной сертификат в высоком качестве прикреплен к этому сообщению).

С уважением,
Команда проекта`;

    const row = [
      s.fullName,
      s.email,
      s.phone || "",
      s.telegram || "",
      options.courseOrWebinarTitle,
      s.accessCode,
      studentCabinetLink,
      personalVideoLink,
      certNum,
      emailTemplate,
    ];
    lines.push(row.map(csvCell).join(";"));
  }

  const csvContent = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const now = new Date().toISOString().slice(0, 10);
  const safeTitle = options.courseOrWebinarTitle.replace(/[^\wа-яА-ЯёЁ0-9_-]/g, "_").slice(0, 25);

  const link = document.createElement("a");
  link.href = url;
  link.download = `reestr-rassylki-${safeTitle}-${now}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
