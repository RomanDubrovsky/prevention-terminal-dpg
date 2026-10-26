import { t } from '../lib/i18n.ts';

export interface ClusterDef {
  id: string;
  title_ru: string;
  path: string;
}

interface ClusterGridProps {
  clusters: ClusterDef[];
  onSelectCluster: (cluster: ClusterDef) => void;
}

export default function ClusterGrid({ clusters, onSelectCluster }: ClusterGridProps) {
  if (!clusters || clusters.length === 0) return null;

  return (
    <div className="cluster-grid-container" style={{ marginTop: '32px' }}>
      <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', color: 'var(--text-main)' }}>
        {t("Структура модуля (глубокое погружение)", "Module structure (deep dive)")}
      </h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem' }}>
        {t("Выберите кластер для изучения связанных карточек знаний, протоколов и методов.", "Select a cluster to explore related knowledge cards, protocols, and methods.")}
      </p>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', 
        gap: '16px' 
      }}>
        {clusters.map(c => (
          <div 
            key={c.id} 
            onClick={() => onSelectCluster(c)}
            style={{ 
              padding: '20px', 
              background: 'var(--bg-card, #ffffff)', 
              borderRadius: '12px', 
              border: '1px solid var(--border-color, #e5e7eb)', 
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.08)';
              e.currentTarget.style.borderColor = 'var(--primary-light, #93c5fd)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
              e.currentTarget.style.borderColor = 'var(--border-color, #e5e7eb)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ 
                fontSize: '1.5rem', 
                background: 'var(--primary-light, #eff6ff)', 
                width: '40px', 
                height: '40px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                borderRadius: '8px' 
              }}>
                🗂️
              </div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', lineHeight: '1.3' }}>
                {c.title_ru}
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{t("Исследовать базу знаний", "Explore knowledge base")}</span>
              <span style={{ color: 'var(--primary, #3b82f6)' }}>→</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
