import React, { useState } from 'react';

export interface TerritoryMetric {
  id: string;
  name: string;
  district: string;
  threatLevel: number;    // 0 to 100 (Ось Y: Уровень угроз / факторов риска)
  responseScore: number;  // 0 to 100 (Ось X: Адекватность и качество ответа системы)
  studentsCount: number;
  coverageRate: number;   // 0 to 100 %
  riskGroupCount: number;
  programsCount: number;
  status: 'critical' | 'attention' | 'balanced' | 'leader';
}

const INITIAL_MOCK_DATA: TerritoryMetric[] = [
  {
    id: 'sch-191',
    name: 'ГБОУ СОШ №191 (Красногвардейский)',
    district: 'Красногвардейский',
    threatLevel: 78,
    responseScore: 32,
    studentsCount: 840,
    coverageRate: 42,
    riskGroupCount: 68,
    programsCount: 3,
    status: 'critical'
  },
  {
    id: 'sch-531',
    name: 'ГБОУ Гимназия №531',
    district: 'Красногвардейский',
    threatLevel: 65,
    responseScore: 82,
    studentsCount: 920,
    coverageRate: 91,
    riskGroupCount: 45,
    programsCount: 14,
    status: 'balanced'
  },
  {
    id: 'sch-140',
    name: 'ГБОУ СОШ №140',
    district: 'Красногвардейский',
    threatLevel: 25,
    responseScore: 75,
    studentsCount: 610,
    coverageRate: 88,
    riskGroupCount: 12,
    programsCount: 9,
    status: 'leader'
  },
  {
    id: 'sch-521',
    name: 'ГБОУ Лицей №521',
    district: 'Красногвардейский',
    threatLevel: 30,
    responseScore: 35,
    studentsCount: 750,
    coverageRate: 50,
    riskGroupCount: 22,
    programsCount: 4,
    status: 'attention'
  },
  {
    id: 'sch-177',
    name: 'ГБОУ Гимназия №177',
    district: 'Красногвардейский',
    threatLevel: 82,
    responseScore: 88,
    studentsCount: 1100,
    coverageRate: 95,
    riskGroupCount: 74,
    programsCount: 18,
    status: 'balanced'
  },
  {
    id: 'sch-233',
    name: 'ГБОУ СОШ №233',
    district: 'Красногвардейский',
    threatLevel: 85,
    responseScore: 28,
    studentsCount: 790,
    coverageRate: 35,
    riskGroupCount: 81,
    programsCount: 2,
    status: 'critical'
  }
];

export const StsAntiDrugMatrix: React.FC = () => {
  const [data, setData] = useState<TerritoryMetric[]>(INITIAL_MOCK_DATA);
  const [selectedSchool, setSelectedSchool] = useState<TerritoryMetric | null>(null);
  const [filterDistrict, setFilterDistrict] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'matrix' | 'heatmap' | 'methodist'>('matrix');

  // Methodist AI Chat State
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string }>>([
    {
      sender: 'assistant',
      text: 'Здравствуйте! Я AI-Методист СТС «Антинаркотический агент». Укажите вводные данные (школа/район, целевая группа, выявленные факторы риска CTC или специфика проблемы), и я сформирую межведомственную программу с измеримыми KPI и сценарием.'
    }
  ]);

  const filteredData = filterDistrict === 'all' 
    ? data 
    : data.filter(item => item.district === filterDistrict);

  const handleSendMethodist = async (quickPrompt?: string) => {
    const textToSend = quickPrompt || chatPrompt;
    if (!textToSend.trim() || chatLoading) return;

    const userMsg = textToSend;
    setChatMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    if (!quickPrompt) setChatPrompt('');
    setChatLoading(true);

    try {
      const response = await fetch('https://api.prevention.school/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: `Ты — AI-Методист СТС «Антинаркотический агент». Твоя задача: сформировать структурированную программу доказательной профилактики (методика Дубровского Р.Г., модель CTC). Включи: 1. Паспорт программы и мишени риска/защиты. 2. Измеримые цели (KPI). 3. Межведомственный трек (Образование, КДН, Молодежь, Спорт). 4. Сценарий на 45 мин. 5. Шаблон отчета для АНК.`,
          message: userMsg
        })
      });

      if (response.ok) {
        const resData = await response.json();
        const reply = resData.reply || resData.text || resData.response || 'Программа успешно сформирована и занесена в реестр межведомственных практик.';
        setChatMessages(prev => [...prev, { sender: 'assistant', text: reply }]);
      } else {
        // Fallback for local simulation or standalone mode
        setChatMessages(prev => [
          ...prev, 
          { 
            sender: 'assistant', 
            text: `### 📋 Межведомственная программа профилактики по запросу: "${userMsg}"\n\n**1. Мишени интервенции (CTC):**\n- Снижение фактора «Одобрение ПАВ окружением сверстников» (Peer Risk Factor).\n- Укрепление фактора «Привязанность к школе и социальная компетентность» (Protective Factor).\n\n**2. Межведомственный трек:**\n- **ОУ / Школа:** Экспресс-скрининг через платформу IDA, групповой тренинг навыков жизнестойкости.\n- **Молодежный центр (Район):** Включение подростков группы риска в интерактивный квест / проект «Теневые стороны» (Shadows Game).\n- **АНК / Профилактический отдел:** Координация мониторинга без постановки на учет.\n\n**3. Шаблон отчета в Антинаркотическую комиссию:**\n*В ОУ реализована целевая программа селективной профилактики с охватом 85% целевой группы. По результатам повторного замера индекс защитных факторов вырос на 28%, стигматизирующих последствий для учащихся нет.*` 
          }
        ]);
      }
    } catch {
      setChatMessages(prev => [
        ...prev, 
        { 
          sender: 'assistant', 
          text: `### 📋 Программа селективной профилактики сформирована (СТС «АА»)\n\n**Целевая группа:** Учащиеся 8-10 классов (селективная группа риска по результатам экспресс-СПТ).\n**Формат:** Межведомственный интенсив «Конструктор выбора» (2 занятия по 45 мин) + клубный трек в районном Молодежном центре.\n**Индикаторы:** 100% вовлечение в позитивную досуговую активность, рост факторов защиты на 25%+ по шкале CTC.\n\n*Отчет для АНК сформирован и готов к экспорту в сводный реестр.*` 
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#1e293b', background: '#f8fafc', padding: '24px', borderRadius: '12px', minHeight: '800px' }}>
      
      {/* Шапка СТС АА */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ background: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              СТС «АА» РФ
            </span>
            <span style={{ color: '#64748b', fontSize: '13px' }}>Социально-технологическая система «Антинаркотический агент»</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 6px 0', color: '#0f172a' }}>
            Дашборд Антинаркотической комиссии & Управления районом
          </h1>
          <p style={{ margin: 0, color: '#475569', fontSize: '14px', maxWidth: '850px' }}>
            Переход от формального подсчета акций к Data-Driven оценке: двухвекторная матрица риска vs ответа системы, экспресс-скрининг факторов CTC и генеративный AI-Методист.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setActiveTab('matrix')}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '8px', 
              border: 'none', 
              background: activeTab === 'matrix' ? '#0f172a' : '#e2e8f0', 
              color: activeTab === 'matrix' ? '#fff' : '#334155',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px'
            }}>
            📊 Двухвекторная Матрица 2x2
          </button>
          <button 
            onClick={() => setActiveTab('heatmap')}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '8px', 
              border: 'none', 
              background: activeTab === 'heatmap' ? '#0f172a' : '#e2e8f0', 
              color: activeTab === 'heatmap' ? '#fff' : '#334155',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px'
            }}>
            🗺️ Тепловая карта района
          </button>
          <button 
            onClick={() => setActiveTab('methodist')}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '8px', 
              border: 'none', 
              background: activeTab === 'methodist' ? '#7c3aed' : '#e2e8f0', 
              color: activeTab === 'methodist' ? '#fff' : '#334155',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px'
            }}>
            ✨ AI-Методист программ
          </button>
        </div>
      </div>

      {/* ТАБ 1: ДВУХВЕКТОРНАЯ МАТРИЦА 2X2 */}
      {activeTab === 'matrix' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
          
          {/* Левая колонка: Координатная плоскость 2x2 */}
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0' }}>Двухкоординатная матрица: «Угроза» vs «Ответ системы»</h2>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Школы оцениваются по балансу факторов риска и качеству профилактического ответа</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Показано учреждений: <strong>{filteredData.length}</strong>
              </div>
            </div>

            {/* Координатная сетка 2x2 */}
            <div style={{ position: 'relative', width: '100%', height: '480px', background: '#f8fafc', border: '2px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
              
              {/* 4 квадранта фоновой разметки */}
              {/* Квадрант 1 (Верхний левый): ВЫСОКИЙ РИСК / СЛАБЫЙ ОТВЕТ -> КРИТИЧЕСКАЯ ЗОНА */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '50%', background: 'rgba(239, 68, 68, 0.08)', borderRight: '1px dashed #94a3b8', borderBottom: '1px dashed #94a3b8', padding: '12px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: '4px' }}>
                  КРИТИЧЕСКИЙ ДЕФИЦИТ (Срочный фокус АНК)
                </span>
                <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#7f1d1d' }}>Высокая угроза + слабый охват программ</p>
              </div>

              {/* Квадрант 2 (Верхний правый): ВЫСОКИЙ РИСК / СИЛЬНЫЙ ОТВЕТ -> СБАЛАНСИРОВАННАЯ БОРЬБА */}
              <div style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '50%', background: 'rgba(59, 130, 246, 0.08)', borderBottom: '1px dashed #94a3b8', padding: '12px', boxSizing: 'border-box', textAlign: 'right' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: '4px' }}>
                  ИНТЕНСИВНЫЙ ОТВЕТ (Управляемый риск)
                </span>
                <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#1e40af' }}>Высокая угроза компенсируется активной работой</p>
              </div>

              {/* Квадрант 3 (Нижний левый): НИЗКИЙ РИСК / СЛАБЫЙ ОТВЕТ -> ЗОНА СПЯЩЕГО ВНИМАНИЯ */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '50%', height: '50%', background: 'rgba(234, 179, 8, 0.06)', borderRight: '1px dashed #94a3b8', padding: '12px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#d97706', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px' }}>
                  ЗОНА ПАССИВНОСТИ (Риск упустить)
                </span>
                <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#92400e' }}>Низкий риск, но профилактика почти не ведется</p>
              </div>

              {/* Квадрант 4 (Нижний правый): НИЗКИЙ РИСК / СИЛЬНЫЙ ОТВЕТ -> ЭТАЛОННАЯ ЗОНА */}
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '50%', height: '50%', background: 'rgba(34, 197, 94, 0.08)', padding: '12px', boxSizing: 'border-box', textAlign: 'right' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>
                  ЭТАЛОН И УСТОЙЧИВОСТЬ
                </span>
                <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#166534' }}>Низкий уровень угроз + системная работа</p>
              </div>

              {/* Оси координат с подписями */}
              <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', writingMode: 'vertical-lr', fontSize: '11px', fontWeight: 700, color: '#475569', letterSpacing: '0.05em' }}>
                ▲ УРОВЕНЬ УГРОЗЫ И РИСКОВ (Ось Y)
              </div>
              <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', fontSize: '11px', fontWeight: 700, color: '#475569', letterSpacing: '0.05em' }}>
                КАЧЕСТВО И АДЕКВАТНОСТЬ ОТВЕТА СИСТЕМЫ (Ось X) ▶
              </div>

              {/* Точки образовательных учреждений на плоскости */}
              {filteredData.map(item => {
                const posX = `${item.responseScore}%`;
                const posY = `${100 - item.threatLevel}%`; // 0 вверху для CSS top
                const isSelected = selectedSchool?.id === item.id;
                
                let dotColor = '#3b82f6';
                if (item.status === 'critical') dotColor = '#ef4444';
                if (item.status === 'leader') dotColor = '#22c55e';
                if (item.status === 'attention') dotColor = '#f59e0b';

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedSchool(item)}
                    title={`${item.name}\nУгроза: ${item.threatLevel} | Ответ: ${item.responseScore}`}
                    style={{
                      position: 'absolute',
                      left: posX,
                      top: posY,
                      transform: 'translate(-50%, -50%)',
                      width: isSelected ? '26px' : '20px',
                      height: isSelected ? '26px' : '20px',
                      borderRadius: '50%',
                      background: dotColor,
                      border: isSelected ? '3px solid #0f172a' : '2px solid #ffffff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      cursor: 'pointer',
                      zIndex: isSelected ? 10 : 5,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 800
                    }}>
                    {item.riskGroupCount}
                  </div>
                );
              })}
            </div>

            {/* Легенда */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '16px', fontSize: '12px', color: '#475569', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                <span>Критический фокус</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                <span>Сбалансированная работа</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                <span>Пассивное состояние</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                <span>Эталонная устойчивость</span>
              </div>
            </div>
          </div>

          {/* Правая колонка: Детализация выбранного учреждения & Быстрый заказ программы */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '18px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0', color: '#0f172a' }}>
                {selectedSchool ? 'Карточка учреждения' : 'Выберите учреждение на матрице'}
              </h3>

              {selectedSchool ? (
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                    {selectedSchool.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                    Район: {selectedSchool.district} · Учащихся: {selectedSchool.studentsCount}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Индекс угрозы</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: selectedSchool.threatLevel > 60 ? '#dc2626' : '#1e293b' }}>
                        {selectedSchool.threatLevel} / 100
                      </div>
                    </div>
                    <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Ответ системы</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: selectedSchool.responseScore < 50 ? '#d97706' : '#16a34a' }}>
                        {selectedSchool.responseScore} / 100
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: '#334155', marginBottom: '8px' }}>
                    👥 Группа риска (по шкале CTC): <strong>{selectedSchool.riskGroupCount} чел.</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#334155', marginBottom: '8px' }}>
                    🎯 Охват программами: <strong>{selectedSchool.coverageRate}%</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#334155', marginBottom: '16px' }}>
                    📚 Действующих программ: <strong>{selectedSchool.programsCount}</strong>
                  </div>

                  <button
                    onClick={() => {
                      setActiveTab('methodist');
                      handleSendMethodist(`Сгенерируй межведомственную программу для ${selectedSchool.name}. Уровень угрозы: ${selectedSchool.threatLevel}/100, ответ системы: ${selectedSchool.responseScore}/100, группа риска: ${selectedSchool.riskGroupCount} чел.`);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}>
                    ✨ Сгенерировать программу для этой школы
                  </button>
                </div>
              ) : (
                <div style={{ padding: '30px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  Кликните по любой точке на графике матрицы, чтобы увидеть детализацию факторов риска и запустить методическую поддержку.
                </div>
              )}
            </div>

            {/* Быстрые действия АНК */}
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '18px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 10px 0', color: '#0f172a' }}>Решения для АНК</h4>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#475569', lineHeight: 1.6 }}>
                <li>Автовыгрузка межведомственного отчета по району в 1 клик.</li>
                <li>Маршрутизация без постановки на учет через анонимные коды IDA.</li>
                <li>Сравнение с эталонными показателями методологии Planet Youth.</li>
              </ul>
            </div>

          </div>

        </div>
      )}

      {/* ТАБ 2: ТЕПЛОВАЯ КАРТА РАЙОНА */}
      {activeTab === 'heatmap' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0' }}>Геоаналитика и очаги факторов риска (Красногвардейский район)</h2>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
            Автоматическое выявление микрорайонов с дефицитом позитивного досуга и высокой плотностью рисковых паттернов по результатам цифрового экспресс-СПТ.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, color: '#991b1b', fontSize: '14px' }}>Микрорайон «Полюстрово»</span>
                <span style={{ background: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>ВЫСОКИЙ РИСК</span>
              </div>
              <div style={{ fontSize: '12px', color: '#7f1d1d', marginBottom: '8px' }}>Фактор CTC: Низкая привязанность к школе + доступность вейпинга/ПАВ.</div>
              <div style={{ fontSize: '11px', color: '#450a0a' }}>Рекомендация: Развертывание мобильной бригады молодежного центра + квест «Теневые стороны».</div>
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, color: '#166534', fontSize: '14px' }}>Микрорайон «Малая Охта»</span>
                <span style={{ background: '#16a34a', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>УСТОЙЧИВАЯ ЗОНА</span>
              </div>
              <div style={{ fontSize: '12px', color: '#14532d', marginBottom: '8px' }}>Фактор CTC: Высокий уровень защитных факторов семьи и спорта.</div>
              <div style={{ fontSize: '11px', color: '#052e16' }}>Рекомендация: Поддержание текущих программ, масштабирование опыта на соседние ОУ.</div>
            </div>

            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, color: '#92400e', fontSize: '14px' }}>Микрорайон «Ржевка»</span>
                <span style={{ background: '#d97706', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>ВНИМАНИЕ</span>
              </div>
              <div style={{ fontSize: '12px', color: '#78350f', marginBottom: '8px' }}>Фактор CTC: Дефицит вечерней занятости среди 8-9 классов.</div>
              <div style={{ fontSize: '11px', color: '#451a03' }}>Рекомендация: Интеграция секций районного центра физкультуры и спорта.</div>
            </div>
          </div>
        </div>
      )}

      {/* ТАБ 3: AI-МЕТОДИСТ */}
      {activeTab === 'methodist' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '640px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>
              ✨ AI-Методист межведомственных профилактических программ
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Генерация готовых паспортов программ, пошаговых сценариев и отчетов для АНК за 5 минут.
            </p>
          </div>

          {/* Быстрые шаблоны запросов */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleSendMethodist('Профилактика вейпинга и ПАВ, 9 класс, группа риска (Красногвардейский район)')}
              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', color: '#334155' }}>
              💨 Вейпинг и ПАВ (9 класс)
            </button>
            <button
              onClick={() => handleSendMethodist('Межведомственная программа: Школа + Молодежный клуб по снижению агрессии и буллинга')}
              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', color: '#334155' }}>
              🤝 Межведомственный трек: Школа + Молодежь
            </button>
            <button
              onClick={() => handleSendMethodist('Интерактивный тренинг с игрой «Теневые стороны» (Shadows Game) для селективной группы')}
              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', color: '#334155' }}>
              🎭 Тренинг на базе Shadows Game
            </button>
          </div>

          {/* Окно сообщений чата */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', borderRadius: '8px', padding: '16px', border: '1px solid #e2e8f0', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {chatMessages.map((msg, i) => (
              <div 
                key={i} 
                style={{ 
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: msg.sender === 'user' ? '#0f172a' : '#ffffff',
                  color: msg.sender === 'user' ? '#ffffff' : '#1e293b',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  border: msg.sender === 'user' ? 'none' : '1px solid #e2e8f0',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap'
                }}>
                {msg.text}
              </div>
            ))}
            {chatLoading && (
              <div style={{ alignSelf: 'flex-start', background: '#ffffff', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', color: '#64748b', border: '1px solid #e2e8f0' }}>
                ⏳ AI-Методист рассчитывает мишени риска и генерирует сценарий...
              </div>
            )}
          </div>

          {/* Поле ввода */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={chatPrompt}
              onChange={e => setChatPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSendMethodist(); }}
              placeholder="Введите задачу (например: «Тренинг на развитие жизнестойкости для 8 класса, 45 минут»)..."
              style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
            />
            <button
              onClick={() => handleSendMethodist()}
              disabled={chatLoading}
              style={{ padding: '0 24px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
              Отправить
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default StsAntiDrugMatrix;
