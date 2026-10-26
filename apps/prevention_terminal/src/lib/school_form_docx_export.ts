/**
 * Экспорт школьных форм (журналы 4А–Ж, планы, циклограмма) в DOCX
 * через единый 4-колоночный DATA_STREAM.
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

import {
  buildSchoolFormDataStream,
  getSchoolForm,
  type SchoolFormId,
} from "./school_psychologist_forms.ts";

const FONT = "Arial";

export interface SchoolFormExportOptions {
  formId: SchoolFormId;
  /** Строки в порядке sourceColumns формы (до упаковки в 4 колонки). */
  sourceRows: string[][];
  passport?: string;
  justification?: string;
  conclusion?: string;
  specialistName?: string;
  orgName?: string;
  periodLabel?: string;
}

export function buildSchoolFormPassport(opts: SchoolFormExportOptions): string {
  const def = getSchoolForm(opts.formId);
  const lines = [
    `Форма № ${def.number}: ${def.title}`,
    opts.orgName ? `Организация: ${opts.orgName}` : "",
    opts.specialistName ? `Педагог-психолог: ${opts.specialistName}` : "",
    opts.periodLabel ? `Период: ${opts.periodLabel}` : "",
    def.notes ? `Примечание: ${def.notes}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildSchoolFormDocument(opts: SchoolFormExportOptions): Document {
  const def = getSchoolForm(opts.formId);
  const { headers, body } = buildSchoolFormDataStream(opts.formId, opts.sourceRows);
  const tableRows = [headers, ...parseDataStreamRows(body)];

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Форма № ${def.number}. ${def.title}`,
          font: FONT,
          bold: true,
          size: 32,
        }),
      ],
    }),
  ];

  const passport = opts.passport ?? buildSchoolFormPassport(opts);
  if (passport) {
    children.push(sectionHeading("Реквизиты"));
    children.push(bodyParagraph(passport));
  }

  if (opts.justification) {
    children.push(sectionHeading("Обоснование"));
    children.push(bodyParagraph(opts.justification));
  }

  children.push(sectionHeading("Таблица"));
  children.push(tableFromRows(tableRows, def.fourCol.widths));

  if (opts.conclusion) {
    children.push(sectionHeading("Заключение"));
    children.push(bodyParagraph(opts.conclusion));
  }

  return new Document({
    creator: "Prevention Terminal",
    title: def.title,
    sections: [{ properties: {}, children }],
  });
}

export async function packSchoolFormDocx(opts: SchoolFormExportOptions): Promise<ArrayBuffer> {
  const blob = await Packer.toBlob(buildSchoolFormDocument(opts));
  return blob.arrayBuffer();
}

export function buildSchoolFormFileName(formId: SchoolFormId): string {
  const def = getSchoolForm(formId);
  const safe = def.id.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10);
  return `Form_${def.number}_${safe}_${stamp}.docx`;
}

function parseDataStreamRows(dataStream: string): string[][] {
  const rows: string[][] = [];
  const re = /\[ROW\](.*?)\[\/ROW\]/gis;
  let m: RegExpExecArray | null;
  while ((m = re.exec(dataStream)) !== null) {
    const cells = m[1].split("|").map((c) => c.trim());
    if (cells.some(Boolean)) rows.push(cells);
  }
  return rows;
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, font: FONT, bold: true, size: 24 })],
  });
}

function bodyParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, font: FONT, size: 21 })],
  });
}

function tableFromRows(
  rows: string[][],
  widths?: [number, number, number, number],
): Table {
  const colWidths = widths ?? [1, 1, 1, 1];
  const total = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((cells, rowIdx) =>
      new TableRow({
        children: cells.map((c, colIdx) =>
          new TableCell({
            width: {
              size: Math.round((colWidths[colIdx]! / total) * 100),
              type: WidthType.PERCENTAGE,
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: c,
                    font: FONT,
                    bold: rowIdx === 0,
                    size: 21,
                  }),
                ],
              }),
            ],
          }),
        ),
      }),
    ),
  });
}
