import React, { useState, useMemo } from "react";
import {
  FinanceTransaction,
  PartnerAgent,
  UnitEconomicsModel,
  getFinanceTransactions,
  saveFinanceTransaction,
  deleteFinanceTransaction,
  getPartnerAgents,
  savePartnerAgent,
  payPartnerAgent,
  getUnitEconomicsModels,
  saveUnitEconomicsModel,
} from "../../lib/center_finances_store.ts";
import { t } from "../../lib/i18n.ts";
import { isCorporateProduct } from "../../lib/terminal_product.ts";
import type { TerminalConfig } from "../../lib/terminal_config.ts";

interface CenterFinancesWorkspaceProps {
  terminalConfig?: TerminalConfig;
  orgDisplayName?: string;
}

export default function CenterFinancesWorkspace(props: CenterFinancesWorkspaceProps) {
  const isCorp = typeof window !== "undefined" && (window.location.hostname.includes("corporate-health") || isCorporateProduct());
  const { orgDisplayName = isCorp ? "Корпоративная служба психологической поддержки" : "Психологический центр / Академия" } = props;

  const [activeTab, setActiveTab] = useState<"dds" | "pnl" | "unit" | "partners" | "alerts">("dds");
  const [transactions, setTransactions] = useState<FinanceTransaction[]>(() => getFinanceTransactions());
  const [agents, setAgents] = useState<PartnerAgent[]>(() => getPartnerAgents());
  const [models, setModels] = useState<UnitEconomicsModel[]>(() => getUnitEconomicsModels());

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "in" | "out">("all");

  // Add Transaction Modal
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [txType, setTxType] = useState<"in" | "out">("out");
  const [txCategory, setTxCategory] = useState(
    isCorp ? "Выплаты корпоративным психологам" : "Выплаты специалистам (гонорары)"
  );
  const [txAmount, setTxAmount] = useState(15000);
  const [txDesc, setTxDesc] = useState("");
  const [txPaymentMethod, setTxPaymentMethod] = useState<"card" | "sbp" | "invoice" | "cash">("invoice");

  // Add Partner Modal
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentContact, setAgentContact] = useState("");
  const [agentPromo, setAgentPromo] = useState("");
  const [agentRate, setAgentRate] = useState(10); // %

  // Unit Economics Interactive Calculator State
  const [selectedModelId, setSelectedModelId] = useState<string>(() => models[0]?.id || "ue_1");
  const currentModel = useMemo(() => {
    return models.find((m) => m.id === selectedModelId) || models[0];
  }, [models, selectedModelId]);

  const [calcPrice, setCalcPrice] = useState<number>(() => currentModel?.clientPrice || 5000);
  const [calcVarCost, setCalcVarCost] = useState<number>(() => currentModel?.variableCost || 1500);
  const [calcFixedCost, setCalcFixedCost] = useState<number>(() => currentModel?.fixedCost || 30000);
  const [calcPlanUnits, setCalcPlanUnits] = useState<number>(() => currentModel?.plannedUnits || 15);

  const handleSelectModel = (m: UnitEconomicsModel) => {
    setSelectedModelId(m.id);
    setCalcPrice(m.clientPrice);
    setCalcVarCost(m.variableCost);
    setCalcFixedCost(m.fixedCost);
    setCalcPlanUnits(m.plannedUnits);
  };

  // Calculations
  const kpis = useMemo(() => {
    const totalIn = transactions.filter((t) => t.type === "in").reduce((sum, t) => sum + t.amount, 0);
    const totalOut = transactions.filter((t) => t.type === "out").reduce((sum, t) => sum + t.amount, 0);
    const netCashFlow = totalIn - totalOut;

    // P&L Split
    const cogsCategories = [
      "Выплаты специалистам (гонорары)",
      "Выплаты корпоративным психологам",
      "Воркшопы и тренинги для тимлидов",
      "Эквайринг и софт (CRM / Облако)",
      "Платформа EAP / Лицензии ПО и скрининг",
      "Расходные материалы центра",
      "Выплата партнерской комиссии",
      "Взаиморасчеты с партнерами и провайдерами",
    ];
    const variableCosts = transactions
      .filter((t) => t.type === "out" && cogsCategories.includes(t.category))
      .reduce((sum, t) => sum + t.amount, 0);

    const fixedCosts = totalOut - variableCosts;
    const grossMargin = totalIn - variableCosts;
    const marginPercent = totalIn > 0 ? (grossMargin / totalIn) * 100 : 0;
    const netProfit = totalIn - totalOut;
    const profitMargin = totalIn > 0 ? (netProfit / totalIn) * 100 : 0;

    const specialistPayouts = transactions
      .filter((t) => t.type === "out" && (t.category.includes("специалист") || t.category.includes("психолог")))
      .reduce((sum, t) => sum + t.amount, 0);

    const b2cRevenue = transactions
      .filter((t) => t.type === "in" && (t.category.includes("B2C") || t.category.includes("Wellbeing") || t.category.includes("бюджет")))
      .reduce((sum, t) => sum + t.amount, 0);

    const specialistPayoutRatio = b2cRevenue > 0 ? (specialistPayouts / b2cRevenue) * 100 : (totalIn > 0 ? (specialistPayouts / totalIn) * 100 : 0);

    // Group breakdown of variable and fixed costs
    const catBreakdown = transactions
      .filter((t) => t.type === "out")
      .reduce<Record<string, number>>((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {});

    return {
      totalIn,
      totalOut,
      netCashFlow,
      variableCosts,
      fixedCosts,
      grossMargin,
      marginPercent,
      netProfit,
      profitMargin,
      specialistPayouts,
      b2cRevenue,
      specialistPayoutRatio,
      catBreakdown,
    };
  }, [transactions]);

  // Unit Economics calculation
  const unitMargin = calcPrice - calcVarCost;
  const unitMarginPercent = calcPrice > 0 ? (unitMargin / calcPrice) * 100 : 0;
  const breakEvenUnits = unitMargin > 0 ? Math.ceil(calcFixedCost / unitMargin) : 0;
  const plannedRevenue = calcPrice * calcPlanUnits;
  const plannedTotalCost = calcFixedCost + calcVarCost * calcPlanUnits;
  const plannedProfit = plannedRevenue - plannedTotalCost;

  // Handlers
  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || txAmount <= 0) return;
    const newTx: FinanceTransaction = {
      id: `tx_${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      type: txType,
      category: txCategory,
      amount: Number(txAmount),
      description: txDesc.trim() || (txType === "in" ? "Поступление оплаты" : "Операционный расход"),
      paymentMethod: txPaymentMethod,
    };
    saveFinanceTransaction(newTx);
    setTransactions(getFinanceTransactions());
    setIsAddTxOpen(false);
    setTxDesc("");
  };

  const handleDeleteTx = (id: string) => {
    if (confirm("Удалить эту финансовую операцию?")) {
      deleteFinanceTransaction(id);
      setTransactions(getFinanceTransactions());
    }
  };

  const handleSaveAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName.trim() || !agentPromo.trim()) return;
    const newAg: PartnerAgent = {
      id: `ag_${Date.now()}`,
      name: agentName.trim(),
      contact: agentContact.trim(),
      promoCode: agentPromo.trim().toUpperCase(),
      commissionRate: agentRate / 100,
      totalReferred: 0,
      totalSales: 0,
      currentBalance: 0,
    };
    savePartnerAgent(newAg);
    setAgents(getPartnerAgents());
    setIsAddAgentOpen(false);
    setAgentName("");
    setAgentContact("");
    setAgentPromo("");
  };

  const handlePayAgent = (agent: PartnerAgent) => {
    if (agent.currentBalance <= 0) return;
    if (confirm(`Выплатить комиссию / вознаграждение ${agent.currentBalance.toLocaleString("ru-RU")} ₽ контрагенту «${agent.name}»? Операция автоматически добавится в журнал ДДС.`)) {
      payPartnerAgent(agent.id, agent.currentBalance);
      setAgents(getPartnerAgents());
      setTransactions(getFinanceTransactions());
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.category.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.specialistName && t.specialistName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [transactions, filterType, searchQuery]);

  return (
    <div style={{ padding: "24px", maxWidth: "1280px", margin: "0 auto", color: "#1e293b" }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "1.4rem" }}>💼</span>
            <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 800, color: "#0f172a" }}>
              {isCorp
                ? t("Финансы и бюджет Wellbeing-службы", "Wellbeing & EAP Finances")
                : t("Финансы и экономика центра", "Center Finances & Management")}
            </h1>
            <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700 }}>
              {orgDisplayName}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#64748b" }}>
            {isCorp
              ? t(
                  "Управленческий учет (ДДС, P&L), юнит-экономика программ EAP, взаиморасчеты с подрядчиками и ДМС-партнерами",
                  "Corporate Health management accounting (Cash Flow, P&L), EAP unit economics, insurance & coaching partners"
                )
              : t(
                  "Управленческий учет (ДДС, P&L), юнит-экономика курсов и сессий, партнерская реферальная сеть",
                  "Management accounting (Cash Flow, P&L), unit economics, and partner referral network"
                )}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={() => setIsAddTxOpen(true)}
            style={{
              background: "#4f46e5",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 18px",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.2)",
            }}
          >
            ➕ {t("Добавить операцию", "Add Transaction")}
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "24px", overflowX: "auto" }}>
        <button
          type="button"
          onClick={() => setActiveTab("dds")}
          style={{
            padding: "8px 18px",
            borderRadius: "8px",
            border: "none",
            fontWeight: 700,
            fontSize: "0.88rem",
            cursor: "pointer",
            background: activeTab === "dds" ? "#1e293b" : "#f1f5f9",
            color: activeTab === "dds" ? "#ffffff" : "#475569",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          💵 {t("Отчет ДДС (Cash Flow)", "Cash Flow Statement")}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("pnl")}
          style={{
            padding: "8px 18px",
            borderRadius: "8px",
            border: "none",
            fontWeight: 700,
            fontSize: "0.88rem",
            cursor: "pointer",
            background: activeTab === "pnl" ? "#1e293b" : "#f1f5f9",
            color: activeTab === "pnl" ? "#ffffff" : "#475569",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          📊 {t("Отчет ОПиУ (P&L)", "Profit & Loss (P&L)")}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("unit")}
          style={{
            padding: "8px 18px",
            borderRadius: "8px",
            border: "none",
            fontWeight: 700,
            fontSize: "0.88rem",
            cursor: "pointer",
            background: activeTab === "unit" ? "#1e293b" : "#f1f5f9",
            color: activeTab === "unit" ? "#ffffff" : "#475569",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          🎯 {isCorp ? t("Юнит-экономика EAP и окупаемость", "EAP Unit Economics & ROI") : t("Юнит-экономика и окупаемость", "Unit Economics & Break-Even")}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("partners")}
          style={{
            padding: "8px 18px",
            borderRadius: "8px",
            border: "none",
            fontWeight: 700,
            fontSize: "0.88rem",
            cursor: "pointer",
            background: activeTab === "partners" ? "#1e293b" : "#f1f5f9",
            color: activeTab === "partners" ? "#ffffff" : "#475569",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          🤝 {isCorp ? t("Провайдеры, ДМС и коучи", "Providers & Insurance Partners") : t("Партнеры и рефералы", "Partners & Referral Agents")}
          {agents.some((a) => a.currentBalance > 0) && (
            <span style={{ background: "#ef4444", color: "#fff", fontSize: "0.7rem", padding: "1px 6px", borderRadius: "10px" }}>
              {agents.filter((a) => a.currentBalance > 0).length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("alerts")}
          style={{
            padding: "8px 18px",
            borderRadius: "8px",
            border: "none",
            fontWeight: 700,
            fontSize: "0.88rem",
            cursor: "pointer",
            background: activeTab === "alerts" ? "#1e293b" : "#f1f5f9",
            color: activeTab === "alerts" ? "#ffffff" : "#475569",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          ⚠️ {isCorp ? t("Финансовое здоровье Wellbeing-программы", "Wellbeing Financial Health") : t("Точки внимания и здоровье центра", "Center Health & Alerts")}
        </button>
      </div>

      {/* ─── TAB 1: ДДС (CASH FLOW) ──────────────────────────────── */}
      {activeTab === "dds" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* KPI CARDS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{t("Поступления (Cash In)", "Cash Inflows")}</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#10b981", margin: "6px 0" }}>
                +{kpis.totalIn.toLocaleString("ru-RU")} ₽
              </div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                {isCorp ? "Бюджет HR, софинансирование ДМС, спецпроекты" : "Консультации, курсы Академии, B2B"}
              </div>
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{t("Выплаты (Cash Out)", "Cash Outflows")}</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#ef4444", margin: "6px 0" }}>
                -{kpis.totalOut.toLocaleString("ru-RU")} ₽
              </div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                {isCorp ? "Психологи, воркшопы, ПО/скрининг, медиации" : "Гонорары психологов, аренда, маркетинг"}
              </div>
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{t("Чистый денежный поток (Net Flow)", "Net Cash Flow")}</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: kpis.netCashFlow >= 0 ? "#2563eb" : "#ef4444", margin: "6px 0" }}>
                {kpis.netCashFlow >= 0 ? "+" : ""}{kpis.netCashFlow.toLocaleString("ru-RU")} ₽
              </div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                {isCorp ? "Остаток нераспределенного бюджета службы" : "Свободное сальдо центра"}
              </div>
            </div>
          </div>

          {/* FILTER BAR */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setFilterType("all")}
                style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: filterType === "all" ? "#334155" : "#fff", color: filterType === "all" ? "#fff" : "#334155", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
              >
                Все операции
              </button>
              <button
                type="button"
                onClick={() => setFilterType("in")}
                style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: filterType === "in" ? "#10b981" : "#fff", color: filterType === "in" ? "#fff" : "#10b981", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
              >
                + Поступления
              </button>
              <button
                type="button"
                onClick={() => setFilterType("out")}
                style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: filterType === "out" ? "#ef4444" : "#fff", color: filterType === "out" ? "#fff" : "#ef4444", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
              >
                - Выплаты
              </button>
            </div>

            <input
              type="text"
              placeholder="🔍 Поиск по статье или описанию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.82rem", width: "260px" }}
            />
          </div>

          {/* TRANSACTIONS TABLE */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontWeight: 700 }}>
                  <th style={{ padding: "12px 16px" }}>Дата</th>
                  <th style={{ padding: "12px 16px" }}>Тип</th>
                  <th style={{ padding: "12px 16px" }}>Статья / Категория</th>
                  <th style={{ padding: "12px 16px" }}>Сумма</th>
                  <th style={{ padding: "12px 16px" }}>Описание и комментарий</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: "1px solid #f1f5f9", background: tx.type === "in" ? "rgba(16, 185, 129, 0.02)" : "#ffffff" }}>
                    <td style={{ padding: "12px 16px", color: "#64748b", whiteSpace: "nowrap" }}>{tx.date}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          background: tx.type === "in" ? "#d1fae5" : "#fee2e2",
                          color: tx.type === "in" ? "#065f46" : "#991b1b",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontWeight: 700,
                          fontSize: "0.75rem",
                        }}
                      >
                        {tx.type === "in" ? "Поступление" : "Расход"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: "#1e293b" }}>{tx.category}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: "0.95rem", color: tx.type === "in" ? "#10b981" : "#ef4444", whiteSpace: "nowrap" }}>
                      {tx.type === "in" ? "+" : "-"}{tx.amount.toLocaleString("ru-RU")} ₽
                    </td>
                    <td style={{ padding: "12px 16px", color: "#475569" }}>
                      {tx.description}
                      {tx.specialistName && <span style={{ display: "block", fontSize: "0.75rem", color: "#6366f1" }}>👤 {tx.specialistName}</span>}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteTx(tx.id)}
                        style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "0.85rem" }}
                        title="Удалить операцию"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 2: ОПиУ (P&L) ────────────────────────────────────── */}
      {activeTab === "pnl" && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "28px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>
              {isCorp
                ? t("Отчет об исполнении бюджета и эффективности (P&L / ROI)", "Wellbeing Budget & Efficiency (P&L)")
                : t("Отчет о финансовых результатах (P&L)", "Profit & Loss Statement (P&L)")}
            </h3>
            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
              {isCorp ? "Эффективность освоения бюджета:" : "Рентабельность бизнеса:"}{" "}
              <strong style={{ color: kpis.profitMargin >= 0 ? "#10b981" : "#ef4444" }}>{kpis.profitMargin.toFixed(1)}%</strong>
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "880px" }}>
            {/* 1. Выручка / Бюджет */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px", background: "rgba(59, 130, 246, 0.08)", borderRadius: "10px", fontWeight: 800, fontSize: "1.05rem", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
              <span>{isCorp ? "1. Выделенный бюджет Wellbeing & EAP (Inflow)" : "1. Выручка центра (Gross Revenue)"}</span>
              <span style={{ color: "#10b981" }}>+{kpis.totalIn.toLocaleString("ru-RU")} ₽</span>
            </div>

            {/* 2. Прямые расходы на сервис */}
            <div style={{ padding: "18px 20px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, color: "#ef4444", marginBottom: "10px", fontSize: "0.95rem" }}>
                <span>{isCorp ? "2. Прямые затраты на психологическую поддержку сотрудников (COGS)" : "2. Переменные затраты (COGS / Прямые расходы на услуги)"}</span>
                <span>-{kpis.variableCosts.toLocaleString("ru-RU")} ₽</span>
              </div>
              <div style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.85rem", color: "#475569" }}>
                {isCorp ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>• Выплаты корпоративным психологам (сессии и дежурства)</span>
                      <span style={{ fontWeight: 600 }}>{(kpis.catBreakdown["Выплаты корпоративным психологам"] || 0).toLocaleString("ru-RU")} ₽</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>• Воркшопы и тренинги эмоциональной устойчивости для команд</span>
                      <span style={{ fontWeight: 600 }}>{(kpis.catBreakdown["Воркшопы и тренинги для тимлидов"] || 0).toLocaleString("ru-RU")} ₽</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>• Платформа EAP, скрининг выгорания и видео-инфраструктура</span>
                      <span style={{ fontWeight: 600 }}>{(kpis.catBreakdown["Платформа EAP / Лицензии ПО и скрининг"] || 0).toLocaleString("ru-RU")} ₽</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>• Взаиморасчеты с коучами и провайдерами ДМС</span>
                      <span style={{ fontWeight: 600 }}>{(kpis.catBreakdown["Взаиморасчеты с партнерами и провайдерами"] || 0).toLocaleString("ru-RU")} ₽</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>• Гонорары психологам за проведенные сессии (сдельная доля)</span>
                      <span style={{ fontWeight: 600 }}>{(kpis.catBreakdown["Выплаты специалистам (гонорары)"] || 0).toLocaleString("ru-RU")} ₽</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>• Банковский эквайринг и софт (CRM / Облако)</span>
                      <span style={{ fontWeight: 600 }}>{(kpis.catBreakdown["Эквайринг и софт (CRM / Облако)"] || 0).toLocaleString("ru-RU")} ₽</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>• Партнерские и реферальные выплаты врачам/школам</span>
                      <span style={{ fontWeight: 600 }}>
                        {(kpis.catBreakdown["Выплата партнерской комиссии"] || 0).toLocaleString("ru-RU")} ₽
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>• Расходные материалы центра</span>
                      <span style={{ fontWeight: 600 }}>{(kpis.catBreakdown["Расходные материалы центра"] || 0).toLocaleString("ru-RU")} ₽</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 3. Маржинальный остаток */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "10px", fontWeight: 800, fontSize: "1.05rem", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
              <span>{isCorp ? "3. Маржинальный фонд программы (Gross Margin / Coverage)" : "3. Маржинальная прибыль (Gross Margin)"}</span>
              <span style={{ color: "#059669" }}>
                +{kpis.grossMargin.toLocaleString("ru-RU")} ₽ ({kpis.marginPercent.toFixed(1)}%)
              </span>
            </div>

            {/* 4. Постоянные расходы */}
            <div style={{ padding: "18px 20px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, color: "#ef4444", marginBottom: "10px", fontSize: "0.95rem" }}>
                <span>{isCorp ? "4. Сопутствующие и инфраструктурные расходы службы (OPEX)" : "4. Постоянные расходы (OPEX / Содержание центра)"}</span>
                <span>-{kpis.fixedCosts.toLocaleString("ru-RU")} ₽</span>
              </div>
              <div style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.85rem", color: "#475569" }}>
                {isCorp ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>• Кризисные интервенции, супервизии и медиации команд</span>
                      <span style={{ fontWeight: 600 }}>{(kpis.catBreakdown["Кризисные интервенции и медиации"] || 0).toLocaleString("ru-RU")} ₽</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>• Программа Wellbeing в офисах (Релакс-зоны и инвентарь)</span>
                      <span style={{ fontWeight: 600 }}>{(kpis.catBreakdown["Программа Wellbeing в офисах (Релакс-зоны)"] || 0).toLocaleString("ru-RU")} ₽</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>• Аренда кабинетов центра</span>
                      <span style={{ fontWeight: 600 }}>{(kpis.catBreakdown["Аренда кабинетов центра"] || 0).toLocaleString("ru-RU")} ₽</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>• Оклады администраторов</span>
                      <span style={{ fontWeight: 600 }}>{(kpis.catBreakdown["Оклады администраторов"] || 0).toLocaleString("ru-RU")} ₽</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>• Маркетинг и реклама</span>
                      <span style={{ fontWeight: 600 }}>{(kpis.catBreakdown["Маркетинг и реклама"] || 0).toLocaleString("ru-RU")} ₽</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 5. Чистый экономический эффект / Сальдо */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "18px 20px",
                background: kpis.netProfit >= 0 ? "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(16,185,129,0.15))" : "rgba(239,68,68,0.15)",
                borderRadius: "12px",
                fontWeight: 800,
                fontSize: "1.2rem",
                border: "2px solid " + (kpis.netProfit >= 0 ? "#10b981" : "#ef4444"),
              }}
            >
              <span>{isCorp ? "5. Экономический остаток бюджета / Чистый баланс службы" : "5. Чистая операционная прибыль центра (Net Profit / EBITDA)"}</span>
              <span style={{ color: kpis.netProfit >= 0 ? "#10b981" : "#ef4444" }}>
                {kpis.netProfit >= 0 ? "+" : ""}{kpis.netProfit.toLocaleString("ru-RU")} ₽
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: ЮНИТ-ЭКОНОМИКА И ОКУПАЕМОСТЬ ──────────────────── */}
      {activeTab === "unit" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px" }}>
          {/* Preset list */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px", height: "fit-content" }}>
            <h4 style={{ margin: "0 0 14px", fontSize: "0.95rem", fontWeight: 700, color: "#1e293b" }}>
              {isCorp ? t("Программы и форматы Wellbeing:", "Wellbeing Programs & Formats:") : t("Выберите направление / продукт:", "Select Product / Direction:")}
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectModel(m)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    background: selectedModelId === m.id ? "#4f46e5" : "#f8fafc",
                    color: selectedModelId === m.id ? "#ffffff" : "#1e293b",
                    boxShadow: selectedModelId === m.id ? "0 4px 12px rgba(79, 70, 229, 0.25)" : "none",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{m.title}</div>
                  <div style={{ fontSize: "0.75rem", opacity: 0.85, marginTop: "2px" }}>
                    {isCorp ? "Стоимость на сотрудника" : "Цена"}: {m.clientPrice.toLocaleString("ru-RU")} ₽ • План: {m.plannedUnits} шт.
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Calculator */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>
                  {isCorp
                    ? t("Калькулятор себестоимости и эффективности EAP (Unit Economics & Break-Even)", "EAP Cost & ROI Calculator")
                    : t("Калькулятор окупаемости и точки безубыточности (Break-Even)", "Break-Even & Margin Calculator")}
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                  {currentModel?.title}
                </p>
              </div>
              <span
                style={{
                  background: plannedProfit >= 0 ? "#d1fae5" : "#fee2e2",
                  color: plannedProfit >= 0 ? "#065f46" : "#991b1b",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                }}
              >
                {plannedProfit >= 0 ? (isCorp ? "✓ Бюджет сбалансирован" : "✓ Проект прибыльный") : (isCorp ? "⚠️ Дефицит бюджета" : "⚠️ Проект в зоне убытка")}
              </span>
            </div>

            {/* Inputs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "24px", background: "#f8fafc", padding: "18px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  {isCorp ? "Стоимость пакета / услуги (₽)" : "Цена для клиента (₽)"}
                </label>
                <input
                  type="number"
                  value={calcPrice}
                  onChange={(e) => setCalcPrice(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  Переменные расходы на 1 шт. (₽)
                </label>
                <input
                  type="number"
                  value={calcVarCost}
                  onChange={(e) => setCalcVarCost(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontWeight: 700 }}
                />
                <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{isCorp ? "Гонорар психолога + скрининг" : "Доля специалиста + эквайринг"}</span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  Постоянные затраты на запуск (₽)
                </label>
                <input
                  type="number"
                  value={calcFixedCost}
                  onChange={(e) => setCalcFixedCost(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontWeight: 700 }}
                />
                <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{isCorp ? "Лицензии платформы + супервизия" : "Реклама + аренда/сервисы"}</span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  {isCorp ? "План охвата (сотрудники / группы)" : "План продаж (участники / сессии)"}
                </label>
                <input
                  type="number"
                  value={calcPlanUnits}
                  onChange={(e) => setCalcPlanUnits(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontWeight: 700 }}
                />
              </div>
            </div>

            {/* Calculations Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "16px", borderRadius: "10px" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#1e40af" }}>
                  {isCorp ? "МАРЖИНАЛЬНЫЙ ВКЛАД НА 1 СОТР." : "МАРЖА С 1 КЛИЕНТА"}
                </div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1e3a8a", margin: "4px 0" }}>
                  +{unitMargin.toLocaleString("ru-RU")} ₽
                </div>
                <div style={{ fontSize: "0.75rem", color: "#3b82f6" }}>Рентабельность / Доля покрытия: {unitMarginPercent.toFixed(1)}%</div>
              </div>

              <div style={{ background: "#fef3c7", border: "1px solid #fde68a", padding: "16px", borderRadius: "10px" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#92400e" }}>ТОЧКА БЕЗУБЫТОЧНОСТИ</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#78350f", margin: "4px 0" }}>
                  {breakEvenUnits} чел.
                </div>
                <div style={{ fontSize: "0.75rem", color: "#b45309" }}>
                  {isCorp ? "Минимальный охват сотрудников для окупаемости фиксированных затрат" : "Нужно продать, чтобы выйти в ноль"}
                </div>
              </div>

              <div style={{ background: plannedProfit >= 0 ? "#d1fae5" : "#fee2e2", border: "1px solid " + (plannedProfit >= 0 ? "#a7f3d0" : "#fecaca"), padding: "16px", borderRadius: "10px" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: plannedProfit >= 0 ? "#065f46" : "#991b1b" }}>
                  {isCorp ? "ЭКОНОМИЧЕСКИЙ ЭФФЕКТ" : "ПЛАНОВАЯ ПРИБЫЛЬ"}
                </div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: plannedProfit >= 0 ? "#047857" : "#b91c1c", margin: "4px 0" }}>
                  {plannedProfit >= 0 ? "+" : ""}{plannedProfit.toLocaleString("ru-RU")} ₽
                </div>
                <div style={{ fontSize: "0.75rem", color: plannedProfit >= 0 ? "#059669" : "#dc2626" }}>При охвате {calcPlanUnits} чел.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: ПАРТНЕРЫ И РЕФЕРАЛЫ ──────────────────────────── */}
      {activeTab === "partners" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>
                {isCorp ? t("Провайдеры ДМС, внешние коучи и консалтинг", "Corporate Wellbeing Providers & Insurance") : t("Партнерская сеть и реферальные агенты", "Partners & Referral Network")}
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                {isCorp
                  ? "Страховые компании по ДМС, внешние тренеры, эксперты по медиации и фасилитации"
                  : "Врачи, частные школы, клиники и HR-консультанты, направляющие клиентов в центр"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddAgentOpen(true)}
              style={{
                background: "#059669",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 16px",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              ➕ {isCorp ? t("Подключить контрагента / ДМС", "Add Provider / Insurer") : t("Подключить партнера", "Add Partner")}
            </button>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontWeight: 700 }}>
                  <th style={{ padding: "12px 16px" }}>{isCorp ? "Контрагент / Страховая / Провайдер" : "Партнер / Организация"}</th>
                  <th style={{ padding: "12px 16px" }}>Код договора / Промокод</th>
                  <th style={{ padding: "12px 16px" }}>{isCorp ? "Ставка / Доля софинансирования" : "Ставка комиссии"}</th>
                  <th style={{ padding: "12px 16px" }}>{isCorp ? "Охвачено сотрудников" : "Привлечено клиентов"}</th>
                  <th style={{ padding: "12px 16px" }}>Объем услуг / Бюджет</th>
                  <th style={{ padding: "12px 16px" }}>Баланс к выплате</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((ag) => (
                  <tr key={ag.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 700, color: "#1e293b" }}>{ag.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{ag.contact}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ background: "#f1f5f9", padding: "4px 8px", borderRadius: "4px", fontFamily: "monospace", fontWeight: 700, color: "#4338ca" }}>
                        {ag.promoCode}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: "#1e293b" }}>
                      {(ag.commissionRate * 100).toFixed(0)}%
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: "#2563eb" }}>
                      {ag.totalReferred} чел.
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: "#10b981" }}>
                      {ag.totalSales.toLocaleString("ru-RU")} ₽
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontWeight: 800, color: ag.currentBalance > 0 ? "#ef4444" : "#64748b", fontSize: "0.95rem" }}>
                        {ag.currentBalance.toLocaleString("ru-RU")} ₽
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => handlePayAgent(ag)}
                        disabled={ag.currentBalance <= 0}
                        style={{
                          background: ag.currentBalance > 0 ? "#4f46e5" : "#e2e8f0",
                          color: ag.currentBalance > 0 ? "#fff" : "#94a3b8",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontWeight: 700,
                          fontSize: "0.78rem",
                          cursor: ag.currentBalance > 0 ? "pointer" : "default",
                        }}
                      >
                        💸 {t("Выплатить", "Payout")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 5: ТОЧКИ ВНИМАНИЯ И АЛЕРТЫ ──────────────────────── */}
      {activeTab === "alerts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "24px" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
              💡 {isCorp ? t("Индикаторы финансовой эффективности Wellbeing-службы", "Wellbeing Financial Performance Indicators") : t("Индикаторы финансовой устойчивости центра", "Center Financial Health Indicators")}
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Alert 1 */}
              <div style={{ padding: "16px", background: kpis.netProfit >= 0 ? "rgba(16, 185, 129, 0.08)" : "#fef2f2", borderLeft: "4px solid " + (kpis.netProfit >= 0 ? "#10b981" : "#ef4444"), borderRadius: "8px" }}>
                <div style={{ fontWeight: 800, color: kpis.netProfit >= 0 ? "#065f46" : "#991b1b", marginBottom: "2px" }}>
                  {isCorp
                    ? (kpis.netProfit >= 0 ? "✓ Бюджет службы исполняется в рамках запланированного лимита" : "⚠️ Превышение лимита бюджета Wellbeing")
                    : (kpis.netProfit >= 0 ? "✓ Чистый операционный поток положительный" : "⚠️ Центр работает в операционный минус")}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#334155" }}>
                  {isCorp ? (
                    <>
                      Остаток нераспределенного квартального фонда составляет <strong>{kpis.netProfit.toLocaleString("ru-RU")} ₽</strong>. Расходы на психологическую помощь сотрудникам полностью покрываются бюджетом HR и софинансированием ДМС.
                    </>
                  ) : (
                    <>
                      Текущее сальдо составляет <strong>{kpis.netProfit.toLocaleString("ru-RU")} ₽</strong>. Постоянные затраты окупаются за счет текущего потока консультаций и курсов.
                    </>
                  )}
                </div>
              </div>

              {/* Alert 2 */}
              <div style={{ padding: "16px", background: "#eff6ff", borderLeft: "4px solid #3b82f6", borderRadius: "8px" }}>
                <div style={{ fontWeight: 800, color: "#1e40af", marginBottom: "2px" }}>
                  💡 {isCorp ? "Доля затрат на прямую помощь сотрудникам:" : "Доля гонораров специалистов:"} {kpis.specialistPayoutRatio.toFixed(1)}% {kpis.specialistPayoutRatio > 0 && kpis.specialistPayoutRatio <= 70 ? "(в норме)" : ""}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#334155" }}>
                  {isCorp ? (
                    <>
                      Сумма прямых выплат психологам и тренерам составляет <strong>{kpis.specialistPayouts.toLocaleString("ru-RU")} ₽</strong> из <strong>{(kpis.b2cRevenue || kpis.totalIn).toLocaleString("ru-RU")} ₽</strong> выделенного бюджета. Это оптимальная структура расходов для корпоративной службы.
                    </>
                  ) : (
                    <>
                      Сумма выплат специалистам составляет <strong>{kpis.specialistPayouts.toLocaleString("ru-RU")} ₽</strong> из <strong>{(kpis.b2cRevenue || kpis.totalIn).toLocaleString("ru-RU")} ₽</strong> выручки. Это здоровый рыночный баланс между мотивацией психолога и покрытием расходов центра.
                    </>
                  )}
                </div>
              </div>

              {/* Alert 3 */}
              <div style={{ padding: "16px", background: "#fffbeb", borderLeft: "4px solid #f59e0b", borderRadius: "8px" }}>
                <div style={{ fontWeight: 800, color: "#92400e", marginBottom: "2px" }}>
                  🤝 {isCorp ? "Взаиморасчеты с внешними провайдерами:" : "Очередь партнерских выплат:"} {agents.filter((a) => a.currentBalance > 0).length} контрагента
                </div>
                <div style={{ fontSize: "0.85rem", color: "#334155" }}>
                  {isCorp ? (
                    <>
                      Общая сумма к выплате внешним экспертам и страховым провайдерам составляет{" "}
                      <strong>{agents.reduce((sum, a) => sum + a.currentBalance, 0).toLocaleString("ru-RU")} ₽</strong>. Расчеты производятся по закрывающим актам в конце месяца.
                    </>
                  ) : (
                    <>
                      Общая задолженность по реферальной программе составляет{" "}
                      <strong>{agents.reduce((sum, a) => sum + a.currentBalance, 0).toLocaleString("ru-RU")} ₽</strong>. Рекомендуется закрывать партнерские выплаты до 15 числа каждого месяца.
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD TRANSACTION MODAL ───────────────────────────────── */}
      {isAddTxOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15, 23, 42, 0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "520px", padding: "24px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>➕ Добавить финансовую операцию</h3>
              <button type="button" onClick={() => setIsAddTxOpen(false)} style={{ background: "#f1f5f9", border: "none", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontWeight: 700 }}>✕</button>
            </div>

            <form onSubmit={handleSaveTransaction} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Тип операции</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => { setTxType("in"); setTxCategory(isCorp ? "Квартальный бюджет Wellbeing & HR" : "Индивидуальные консультации B2C"); }}
                    style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "none", background: txType === "in" ? "#10b981" : "#f1f5f9", color: txType === "in" ? "#fff" : "#334155", fontWeight: 700, cursor: "pointer" }}
                  >
                    + Поступление (Доход/Бюджет)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTxType("out"); setTxCategory(isCorp ? "Выплаты корпоративным психологам" : "Выплаты специалистам (гонорары)"); }}
                    style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "none", background: txType === "out" ? "#ef4444" : "#f1f5f9", color: txType === "out" ? "#fff" : "#334155", fontWeight: 700, cursor: "pointer" }}
                  >
                    - Выплата (Расход)
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Статья / Категория</label>
                <select
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                >
                  {txType === "in" ? (
                    isCorp ? (
                      <>
                        <option value="Квартальный бюджет Wellbeing & HR">Квартальный бюджет Wellbeing & HR</option>
                        <option value="Софинансирование ДМС / EAP-пакет">Софинансирование ДМС / EAP-пакет</option>
                        <option value="Спецпроекты антикризисной устойчивости">Спецпроекты антикризисной устойчивости</option>
                        <option value="Прочие поступления">Прочие поступления</option>
                      </>
                    ) : (
                      <>
                        <option value="Индивидуальные консультации B2C">Индивидуальные консультации B2C</option>
                        <option value="Курсы и программы Академии">Курсы и программы Академии</option>
                        <option value="Корпоративный B2B контракт">Корпоративный B2B контракт</option>
                        <option value="Вебинары и мастер-классы">Вебинары и мастер-классы</option>
                        <option value="Прочие доходы">Прочие доходы</option>
                      </>
                    )
                  ) : (
                    isCorp ? (
                      <>
                        <option value="Выплаты корпоративным психологам">Выплаты корпоративным психологам</option>
                        <option value="Воркшопы и тренинги для тимлидов">Воркшопы и тренинги для тимлидов</option>
                        <option value="Платформа EAP / Лицензии ПО и скрининг">Платформа EAP / Лицензии ПО и скрининг</option>
                        <option value="Кризисные интервенции и медиации">Кризисные интервенции и медиации</option>
                        <option value="Программа Wellbeing в офисах (Релакс-зоны)">Программа Wellbeing в офисах (Релакс-зоны)</option>
                        <option value="Взаиморасчеты с партнерами и провайдерами">Взаиморасчеты с партнерами и провайдерами</option>
                        <option value="Налоги и сборы">Налоги и сборы</option>
                      </>
                    ) : (
                      <>
                        <option value="Выплаты специалистам (гонорары)">Выплаты специалистам (гонорары)</option>
                        <option value="Аренда кабинетов центра">Аренда кабинетов центра</option>
                        <option value="Оклады администраторов">Оклады администраторов</option>
                        <option value="Маркетинг и реклама">Маркетинг и реклама</option>
                        <option value="Эквайринг и софт (CRM / Облако)">Эквайринг и софт (CRM / Облако)</option>
                        <option value="Расходные материалы центра">Расходные материалы центра</option>
                        <option value="Налоги и сборы">Налоги и сборы</option>
                      </>
                    )
                  )}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Сумма (₽)</label>
                <input
                  type="number"
                  required
                  value={txAmount}
                  onChange={(e) => setTxAmount(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.95rem", fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Описание / Назначение</label>
                <input
                  type="text"
                  placeholder={isCorp ? "Например: Проведение тренинга для лидов разработки" : "Например: Аренда кабинета №2 за октябрь"}
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setIsAddTxOpen(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>Отмена</button>
                <button type="submit" style={{ padding: "8px 18px", borderRadius: "6px", border: "none", background: "#4f46e5", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Сохранить операцию</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── ADD PARTNER MODAL ──────────────────────────────────── */}
      {isAddAgentOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15, 23, 42, 0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "480px", padding: "24px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>
                {isCorp ? "➕ Подключить провайдера / страховую компанию" : "➕ Подключить партнера-реферала"}
              </h3>
              <button type="button" onClick={() => setIsAddAgentOpen(false)} style={{ background: "#f1f5f9", border: "none", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontWeight: 700 }}>✕</button>
            </div>

            <form onSubmit={handleSaveAgent} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  {isCorp ? "Название организации / Страховая / Провайдер" : "Название партнера / Врач / Организация"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isCorp ? "Например: АльфаСтрахование (ДМС Wellbeing)" : "Например: Клиника Неврологии «Апекс»"}
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Контакты (телефон / email)</label>
                <input
                  type="text"
                  placeholder="+7 (999) 000-00-00, partner@clinic.ru"
                  value={agentContact}
                  onChange={(e) => setAgentContact(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  {isCorp ? "Код контракта / Идентификатор программы" : "Промокод для клиентов"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isCorp ? "CORP_EAP_2026" : "APEX10"}
                  value={agentPromo}
                  onChange={(e) => setAgentPromo(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem", fontWeight: 700, fontFamily: "monospace" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  {isCorp ? "Размер софинансирования / комиссии (%)" : "Размер комиссии (%)"}
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={agentRate}
                  onChange={(e) => setAgentRate(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.95rem", fontWeight: 700 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setIsAddAgentOpen(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>Отмена</button>
                <button type="submit" style={{ padding: "8px 18px", borderRadius: "6px", border: "none", background: "#059669", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                  {isCorp ? "Сохранить контрагента" : "Создать партнера"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

