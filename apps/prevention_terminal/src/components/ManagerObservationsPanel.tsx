import React, { useState, useEffect } from "react";
import { TerminalConfig } from "../lib/terminal_config";
import { t } from "../lib/i18n";

interface ManagerObservationsPanelProps {
  cfg: TerminalConfig;
  orgDisplayName: string;
}

interface ClassStat {
  className: string;
  totalObserved: number;
  atRisk: number;
  criticalCases: number;
  metricsBreakdown: Record<string, number>;
}

export default function ManagerObservationsPanel({ cfg, orgDisplayName }: ManagerObservationsPanelProps) {
  const [stats, setStats] = useState<ClassStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock fetching aggregated data
    setTimeout(() => {
      setStats([
        {
          className: "7А",
          totalObserved: 28,
          atRisk: 3,
          criticalCases: 1,
          metricsBreakdown: {
            "Резкое снижение успеваемости": 2,
            "Изоляция от сверстников": 4,
            "Агрессия": 1
          }
        },
        {
          className: "8Б",
          totalObserved: 25,
          atRisk: 5,
          criticalCases: 0,
          metricsBreakdown: {
            "Резкое снижение успеваемости": 5,
            "Изоляция от сверстников": 2,
            "Агрессия": 0
          }
        },
        {
          className: "9В",
          totalObserved: 30,
          atRisk: 2,
          criticalCases: 2,
          metricsBreakdown: {
            "Резкое снижение успеваемости": 1,
            "Изоляция от сверстников": 1,
            "Агрессия": 3
          }
        }
      ]);
      setLoading(false);
    }, 800);
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="spinner mb-4 inline-block"></div>
        <p>{t("Сбор аналитики...", "Gathering analytics...")}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {t("Сводка по журналу наблюдений", "Observation Journal Summary")}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {t("Агрегированные данные без персональных имен (ФЗ-152).", "Aggregated data without personal names (FZ-152).")}
          </p>
        </div>
      </div>

      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-700 text-sm border-b border-gray-200">
                <th className="py-3 px-4 font-medium">{t("Класс", "Class")}</th>
                <th className="py-3 px-4 font-medium">{t("Охвачено", "Observed")}</th>
                <th className="py-3 px-4 font-medium">{t("В зоне риска", "At Risk")}</th>
                <th className="py-3 px-4 font-medium">{t("Критичные (SOS)", "Critical (SOS)")}</th>
                <th className="py-3 px-4 font-medium">{t("Частые факторы", "Frequent Factors")}</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={row.className} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                  <td className="py-4 px-4 font-semibold text-gray-900">{row.className}</td>
                  <td className="py-4 px-4 text-gray-700">{row.totalObserved}</td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.atRisk > 0 ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800"}`}>
                      {row.atRisk}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.criticalCases > 0 ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>
                      {row.criticalCases}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-600">
                    {Object.entries(row.metricsBreakdown)
                      .filter(([_, count]) => count > 0)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 2)
                      .map(([factor, count]) => (
                        <div key={factor}>{factor} <span className="text-gray-400">({count})</span></div>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {stats.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {t("Нет данных за текущий период.", "No data for the current period.")}
          </div>
        )}
      </div>
    </div>
  );
}
