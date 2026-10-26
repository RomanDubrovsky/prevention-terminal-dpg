import { t } from '../lib/i18n.ts';
import { useAcademyProgress, getRank } from '../lib/academy_progress.ts';

export default function AcademyProgressBar() {
  const progress = useAcademyProgress();
  
  // Total lectures (0 to 20 = 21, let's say 20 core lectures)
  const TOTAL_LECTURES = 20;
  
  // Count only numeric lecture IDs that are > 0 for calculation
  const completedCount = progress.readLectures.filter(id => {
    const num = Number(id);
    return !isNaN(num) && num > 0 && num <= TOTAL_LECTURES;
  }).length;
  
  const percentage = Math.min(100, Math.round((completedCount / TOTAL_LECTURES) * 100));
  const rank = getRank(progress.points);

  return (
    <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-card, #fff)', borderRadius: '12px', border: '1px solid var(--border-color, #e5e7eb)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
          {t("Прогресс обучения", "Learning Progress")}
        </div>
        <div style={{ fontWeight: 700, color: 'var(--primary, #3b82f6)', fontSize: '0.9rem' }}>
          {percentage}%
        </div>
      </div>
      
      <div style={{ height: '8px', background: 'var(--bg-hover, #f3f4f6)', borderRadius: '4px', overflow: 'hidden' }}>
        <div 
          style={{ 
            height: '100%', 
            width: `${percentage}%`, 
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', 
            transition: 'width 0.5s ease-out' 
          }} 
        />
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>{completedCount} {t("из", "of")} {TOTAL_LECTURES} {t("тем", "topics")}</span>
        {progress.exploredClusters.length > 0 && (
          <span>{progress.exploredClusters.length} {t("кластеров изучено", "clusters explored")}</span>
        )}
      </div>

      {/* Gamification Area */}
      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed var(--border-color, #e5e7eb)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>{rank.icon}</span>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t("Ранг исследователя", "Researcher Rank")}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {t(rank.title, rank.en)}
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--primary-light, #eff6ff)', padding: '4px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary, #3b82f6)' }}>{progress.points}</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--primary, #3b82f6)' }}>DP</span>
          </div>
        </div>
      </div>
    </div>
  );
}
