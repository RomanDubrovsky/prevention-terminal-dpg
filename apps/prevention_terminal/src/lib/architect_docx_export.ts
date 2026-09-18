/**
 * Export Architect/Expert structured AI output to DOCX (local, no network).
 */
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const FONT = "Arial";

export interface ArchitectSegments {
  title?: string;
  passport?: string;
  justification?: string;
  data_stream_body?: string;
  conclusion?: string;
}

export function parseArchitectRows(dataStream: string): string[][] {
  const rows: string[][] = [];
  const re = /\[ROW\](.*?)\[\/ROW\]/gis;
  let m: RegExpExecArray | null;
  while ((m = re.exec(dataStream)) !== null) {
    const cells = m[1].split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length) rows.push(cells);
  }
  return rows;
}

export function buildArchitectDocument(args: {
  title: string;
  segments: ArchitectSegments;
  rawFallback?: string;
}): Document {
  const { title, segments, rawFallback } = args;
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: segments.title || title, font: FONT, bold: true, size: 32 })],
    }),
  ];

  if (segments.passport) {
    children.push(heading("Паспорт"));
    children.push(body(segments.passport));
  }
  if (segments.justification) {
    children.push(heading("Обоснование"));
    children.push(body(segments.justification));
  }

  const rows = parseArchitectRows(segments.data_stream_body || "");
  if (rows.length) {
    children.push(heading("План мероприятий"));
    children.push(tableFromRows(rows));
  }

  if (segments.conclusion) {
    children.push(heading("Заключение"));
    children.push(body(segments.conclusion));
  }

  if (children.length <= 1 && rawFallback) {
    children.push(body(rawFallback.slice(0, 12000)));
  }

  return new Document({
    creator: "Prevention Terminal",
    title: segments.title || title,
    sections: [{ properties: {}, children }],
  });
}

export async function packArchitectDocx(args: {
  title: string;
  segments: ArchitectSegments;
  rawFallback?: string;
}): Promise<ArrayBuffer> {
  const blob = await Packer.toBlob(buildArchitectDocument(args));
  return blob.arrayBuffer();
}

export function buildArchitectFileName(docType: string): string {
  const safe = docType.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 32) || "document";
  const stamp = new Date().toISOString().slice(0, 10);
  return `Architect_${safe}_${stamp}.docx`;
}

function heading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, font: FONT, bold: true, size: 24 })],
  });
}

function body(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, font: FONT, size: 21 })],
  });
}

function tableFromRows(rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (cells) =>
        new TableRow({
          children: cells.map(
            (c) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: c, font: FONT })] })],
              }),
          ),
        }),
    ),
  });
}
