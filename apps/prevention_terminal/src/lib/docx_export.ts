/**
 * Phase 3.9 — клиентская сборка DOCX из структурированного JSON.
 *
 * Важно: здесь нет парсинга Word-документов. Это только экспорт готового
 * результата Архитектора (пока mock JSON) в .docx на стороне клиента.
 */

import {
  AlignmentType,
  BorderStyle,
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

import type { IprDocumentData, IprRecommendation, IprRiskSignal } from "./ipr_mock.ts";

const FONT = "Arial";

export function buildIprDocument(data: IprDocumentData): Document {
  return new Document({
    creator: "Prevention Terminal",
    description: "Demo IPR generated locally from structured Architect mock data.",
    title: data.title,
    sections: [
      {
        properties: {},
        children: [
          title(data.title),
          metaLine("Кейс", data.caseId),
          metaLine("Дата формирования", data.generatedAt),
          metaLine("Режим", "demo / mock, без обращения к ИИ API"),
          space(),
          sectionHeading("1. Краткий контекст"),
          ...bullets(data.contextSummary),
          sectionHeading("2. Цели сопровождения"),
          ...bullets(data.goals),
          sectionHeading("3. Сигналы риска"),
          riskTable(data.riskSignals),
          sectionHeading("4. Рекомендованный план действий"),
          ...data.recommendations.flatMap((item, index) => recommendationBlock(item, index + 1)),
          sectionHeading("5. Мониторинг динамики"),
          ...bullets(data.monitoringPlan),
          sectionHeading("6. Приватность и ограничения"),
          paragraph(data.privacyNote),
          paragraph(data.disclaimer, { italics: true }),
        ],
      },
    ],
  });
}

export async function packIprDocx(data: IprDocumentData): Promise<ArrayBuffer> {
  const blob = await Packer.toBlob(buildIprDocument(data));
  return blob.arrayBuffer();
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function buildIprFileName(caseId: string): string {
  const safeCaseId = caseId.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 48) || "case";
  return `IPR_${safeCaseId}_demo.docx`;
}

function title(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [run(text, { bold: true, size: 32 })],
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 120 },
    children: [run(text, { bold: true, size: 24 })],
  });
}

function metaLine(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [run(`${label}: `, { bold: true }), run(value)],
  });
}

function paragraph(text: string, options: { italics?: boolean } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [run(text, { italics: options.italics })],
  });
}

function bullets(items: readonly string[]): Paragraph[] {
  return items.map(
    (item) =>
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 80 },
        children: [run(item)],
      }),
  );
}

function recommendationBlock(item: IprRecommendation, number: number): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 140, after: 80 },
      children: [run(`${number}. ${item.title}`, { bold: true, size: 22 })],
    }),
    paragraph(item.rationale),
    metaLine("Ответственный", item.owner),
    metaLine("Срок", item.due),
    ...bullets(item.steps),
  ];
}

function riskTable(signals: readonly IprRiskSignal[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders(),
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell("Сигнал"),
          headerCell("Уровень"),
          headerCell("Описание"),
        ],
      }),
      ...signals.map(
        (signal) =>
          new TableRow({
            children: [
              bodyCell(signal.label),
              bodyCell(riskLevelLabel(signal.level)),
              bodyCell(signal.description),
            ],
          }),
      ),
    ],
  });
}

function headerCell(text: string): TableCell {
  return new TableCell({
    shading: { fill: "EFF6FF" },
    margins: cellMargins(),
    children: [new Paragraph({ children: [run(text, { bold: true })] })],
  });
}

function bodyCell(text: string): TableCell {
  return new TableCell({
    margins: cellMargins(),
    children: [paragraph(text)],
  });
}

function riskLevelLabel(level: IprRiskSignal["level"]): string {
  if (level === "high") return "Высокий";
  if (level === "medium") return "Средний";
  return "Низкий";
}

function run(
  text: string,
  options: { bold?: boolean; italics?: boolean; size?: number } = {},
): TextRun {
  return new TextRun({
    text,
    font: FONT,
    bold: options.bold,
    italics: options.italics,
    size: options.size ?? 21,
  });
}

function space(): Paragraph {
  return new Paragraph({ children: [run("")], spacing: { after: 120 } });
}

function cellMargins() {
  return { top: 100, bottom: 100, left: 120, right: 120 };
}

function tableBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
  };
}
