import { trackVideoEvent } from "../../lib/analytics.ts";
import React, { useState } from 'react';
import { t } from '../../lib/i18n.ts';
import { platformApiBase } from '../../lib/platform_api.ts';

interface InSessionHelpPanelProps {
  transcriptText: string;
  terminalUserId?: string;
  onClose: () => void;
}

export const InSessionHelpPanel: React.FC<InSessionHelpPanelProps> = ({ transcriptText, terminalUserId, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ analysis: string; questions: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestHelp = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${platformApiBase()}/api/terminal/video/in-session-help`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptText || "",
          userId: terminalUserId,
        }),
      });
      const data = await res.json();
      if (!data.ok || !data.data) {
        throw new Error(data.error || "Failed to get help");
      }
      setResult(data.data);
    } catch (err: any) {
      setError(err.message || "Ошибка при запросе к AI");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: '80px',
      left: '16px',
      width: '320px',
      backgroundColor: 'rgba(30, 30, 30, 0.95)',
      backdropFilter: 'blur(10px)',
      border: '1px solid #4b5563',
      borderRadius: '8px',
      padding: '16px',
      color: 'white',
      zIndex: 50,
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: '1rem', color: '#60a5fa' }}>💡 Подсказка AI</h4>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
      </div>

      {!result && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#d1d5db' }}>
            Проанализировать текущий ход сессии и предложить интервенции или вопросы?
          </p>
          <button 
            onClick={requestHelp}
            style={{ padding: '8px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Получить совет
          </button>
        </div>
      )}

      {loading && (
        <div style={{ padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
          Анализирую диалог...
        </div>
      )}

      {error && (
        <div style={{ color: '#ef4444', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
          <div>
            <strong style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Анализ ситуации:</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', lineHeight: '1.4' }}>{result.analysis}</p>
          </div>
          <div>
            <strong style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Что спросить/сделать:</strong>
            <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', fontSize: '0.85rem', lineHeight: '1.4' }}>
              {result.questions?.map((q, i) => <li key={i} style={{ marginBottom: '4px' }}>{q}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
