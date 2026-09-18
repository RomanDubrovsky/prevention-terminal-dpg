import { useState, useEffect } from 'react';
import { t } from '../lib/i18n.ts';
import { platformApiBase } from "../lib/platform_api.ts";
// @ts-ignore
import { getAuthHeaders } from "../lib/auth.ts";

interface KBCard {
  id: string;
  title?: string;
  content?: string;
  problem_key?: string;
  x_stage?: string;
  category_key?: string;
  m_modality?: string;
}

export default function KBCardList({ clusterId }: { clusterId: string }) {
  const [cards, setCards] = useState<KBCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    
    const encoded = encodeURIComponent(clusterId);
    // Make sure we pass auth headers since the endpoint might require it (it's under /api/v1/)
    fetch(`${platformApiBase}/api/v1/academy/clusters/${encoded}/cards`, {
      headers: getAuthHeaders()
    })
      .then(async res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (active && data.cards) {
          setCards(data.cards);
        }
      })
      .catch(err => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
      
    return () => { active = false; };
  }, [clusterId]);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '16px', animation: 'spin 2s linear infinite' }}>⏳</div>
        {t("Загрузка карточек знаний...", "Loading knowledge cards...")}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', background: 'var(--bg-error, #fef2f2)', color: 'var(--text-error, #b91c1c)', borderRadius: '8px', border: '1px solid var(--border-error, #f87171)' }}>
        {t("Ошибка загрузки:", "Error loading:")} {error}
      </div>
    );
  }

  return (
    <div className="kb-card-list">
      <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>📑</span> {t("Материалы кластера", "Cluster materials")} ({cards.length})
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {cards.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
            {t("В этом кластере пока нет карточек", "No cards in this cluster yet")}
          </div>
        ) : (
          cards.map(c => (
            <div key={c.id} style={{ 
              padding: '20px', 
              background: 'var(--bg-card)', 
              borderRadius: '12px', 
              border: '1px solid var(--border-color)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                {c.title || t("Без названия", "Untitled")}
              </h4>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                {c.problem_key && (
                  <span style={{ background: 'var(--bg-hover, #f3f4f6)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {c.problem_key}
                  </span>
                )}
                {c.x_stage && (
                  <span style={{ background: 'var(--bg-hover, #f3f4f6)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {c.x_stage}
                  </span>
                )}
                {c.m_modality && (
                  <span style={{ background: 'var(--bg-hover, #f3f4f6)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {c.m_modality}
                  </span>
                )}
                {c.category_key && (
                  <span style={{ background: 'var(--bg-hover, #f3f4f6)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {c.category_key}
                  </span>
                )}
              </div>
              
              <div style={{ 
                fontSize: '0.95rem', 
                lineHeight: '1.6', 
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                background: 'var(--bg-body, #fafafa)',
                padding: '16px',
                borderRadius: '8px',
                borderLeft: '3px solid var(--primary-light, #93c5fd)'
              }}>
                {c.content ? c.content : <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>{t("Нет описания", "No description")}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
