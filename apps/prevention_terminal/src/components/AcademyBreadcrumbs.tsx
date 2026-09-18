import { t } from '../lib/i18n.ts';

interface BreadcrumbsProps {
  lectureTitle: string;
  clusterTitle?: string | null;
  onNavigateHome: () => void;
  onNavigateLecture: () => void;
}

export default function AcademyBreadcrumbs({ lectureTitle, clusterTitle, onNavigateHome, onNavigateLecture }: BreadcrumbsProps) {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px', 
      padding: '12px 16px', 
      background: 'var(--card-alt, rgba(0,0,0,0.04))', 
      borderRadius: '12px', 
      border: '1px solid var(--border-color, #e5e7eb)', 
      marginBottom: '24px', 
      fontSize: '0.95rem', 
      color: 'var(--text-muted, #6b7280)',
      flexWrap: 'wrap'
    }}>
      <span 
        onClick={onNavigateHome} 
        style={{ cursor: 'pointer', transition: 'color 0.2s', padding: '2px 4px', borderRadius: '4px' }}
        onMouseOver={e => e.currentTarget.style.color = 'var(--text-main, #111827)'}
        onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted, #6b7280)'}
      >
        {t("Программа Академии", "Academy Program")}
      </span>
      <span>›</span>
      <span 
        onClick={clusterTitle ? onNavigateLecture : undefined} 
        style={{ 
          cursor: clusterTitle ? 'pointer' : 'default', 
          color: clusterTitle ? 'inherit' : 'var(--text-main, #111827)', 
          fontWeight: clusterTitle ? 'normal' : 600,
          transition: 'color 0.2s', 
          padding: '2px 4px', 
          borderRadius: '4px'
        }}
        onMouseOver={e => {
          if (clusterTitle) e.currentTarget.style.color = 'var(--text-main, #111827)';
        }}
        onMouseOut={e => {
          if (clusterTitle) e.currentTarget.style.color = 'var(--text-muted, #6b7280)';
        }}
      >
        {lectureTitle}
      </span>
      {clusterTitle && (
        <>
          <span>›</span>
          <span style={{ color: 'var(--text-main, #111827)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🗂️</span> {clusterTitle}
          </span>
        </>
      )}
    </div>
  );
}
