import React from "react";
import { t } from "../lib/i18n.ts";

interface ArticleItem {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  readTime: string;
  url: string;
  description: string;
}

const ARTICLES: ArticleItem[] = [
  {
    id: "evolution-of-public-health-ai",
    title: "Эволюция системы общественного здравоохранения: от биомедицинской модели к доказательной профилактике",
    subtitle: "Часть 1. Исторический и методологический контекст",
    badge: "Методология",
    readTime: "12 мин",
    url: "https://prevention-ai.ru/articles/evolution-of-public-health-ai/",
    description:
      "Фундаментальный обзор перехода от традиционной парадигмы лечения соматических патологий к биопсихосоциальной модели и превентивным интервенциям в популяции. Анализ структуры факторов риска, резистентности и роли цифровых инструментов.",
  },
  {
    id: "mhpss-ai-exoskeleton",
    title: "Взросление MHPSS-AI: от стихийных промптов к когнитивному экзоскелету психолога",
    subtitle: "Часть 2. Архитектура и красные линии ассистивного ИИ",
    badge: "Технологии & Этика",
    readTime: "15 мин",
    url: "https://prevention-ai.ru/articles/mhpss-ai-exoskeleton/",
    description:
      "Методический разбор архитектуры гибридного ИИ для службы охраны психического здоровья. Принцип «экзоскелета специалиста», протокольный контроль, локальный защищенный контур (152-ФЗ) и защита от клинических галлюцинаций.",
  },
];

export default function ArticlesWorkspace(): React.ReactElement {
  return (
    <div style={{ padding: "32px 40px", maxWidth: "1100px", margin: "0 auto", color: "var(--foreground, #0f172a)" }}>
      <div style={{ marginBottom: "28px" }}>
        <span
          style={{
            fontSize: "0.78rem",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontWeight: 800,
            color: "#6366f1",
            background: "rgba(99, 102, 241, 0.1)",
            padding: "4px 12px",
            borderRadius: "999px",
            display: "inline-block",
            marginBottom: "10px",
          }}
        >
          {t("Библиотека и публикации", "Library & Publications")}
        </span>
        <h1 style={{ fontSize: "1.85rem", fontWeight: 900, margin: "0 0 8px 0", letterSpacing: "-0.02em" }}>
          {t("Научные и прикладные статьи", "Scientific & Applied Articles")}
        </h1>
        <p style={{ color: "var(--muted-foreground, #64748b)", fontSize: "0.95rem", margin: 0, lineHeight: 1.5 }}>
          {t(
            "Методические материалы, доказательная база и архитектура цифровой превентологии.",
            "Methodological papers, evidence base, and digital prevention architecture."
          )}
        </p>
      </div>

      <div style={{ display: "grid", gap: "20px" }}>
        {ARTICLES.map((art) => (
          <article
            key={art.id}
            style={{
              background: "var(--bg-card, #ffffff)",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: "14px",
              padding: "24px 28px",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.04)",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", gap: "12px", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#4f46e5",
                  background: "#eef2ff",
                  padding: "3px 10px",
                  borderRadius: "6px",
                }}
              >
                {art.badge}
              </span>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 600 }}>
                ⏱️ {art.readTime}
              </span>
            </div>

            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: "0 0 6px 0", lineHeight: 1.35 }}>
              {art.title}
            </h2>
            <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#6366f1", marginBottom: "12px" }}>
              {art.subtitle}
            </div>

            <p style={{ color: "var(--muted-foreground, #475569)", fontSize: "0.92rem", lineHeight: 1.6, margin: "0 0 20px 0" }}>
              {art.description}
            </p>

            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <a
                href={art.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#4f46e5",
                  color: "#ffffff",
                  padding: "9px 18px",
                  borderRadius: "8px",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                <span>{t("Читать статью", "Read Article")}</span>
                <span>↗</span>
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
