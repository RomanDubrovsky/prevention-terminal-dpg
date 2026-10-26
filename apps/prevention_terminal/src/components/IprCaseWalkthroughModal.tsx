import { useState, useEffect } from "react";
import "./IprCaseWalkthroughModal.css";

interface IprCaseWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectKirillDemo?: () => void;
}

interface StepSlide {
  id: number;
  timeRange: string;
  tabLabel: string;
  badge: string;
  formStage: "form1" | "form2" | "form3";
  formBadge: string;
  title: string;
  caseSummary: string;
  signposts: {
    icon: string;
    label: string;
  }[];
  points: {
    icon: string;
    text: string;
  }[];
  callout: string;
  mockupTitle: string;
  renderMockup: () => JSX.Element;
}

export default function IprCaseWalkthroughModal({
  isOpen,
  onClose,
  onSelectKirillDemo,
}: IprCaseWalkthroughModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === "Escape") {
        if (fullscreenOpen) {
          setFullscreenOpen(false);
        } else {
          onClose();
        }
      }
      if (e.key === "ArrowRight") {
        setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
      }
      if (e.key === "ArrowLeft") {
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, fullscreenOpen]);

  if (!isOpen) return null;

  const slides: StepSlide[] = [
    {
      id: 1,
      timeRange: "⏱️ 00:00 – 02:00",
      tabLabel: "1. Основания учета",
      badge: "Шаг 1 из 5 · Входные данные",
      formStage: "form1",
      formBadge: "📁 Форма №1 · Личное дело",
      title: "Регистрация подростка и юридические основания учета",
      caseSummary:
        "Кирилл Соколов, 15 лет (9 «В» класс). Постановление КДНиЗП от 14.10.2025: совершен проступок по ст. 7.27 ч. 2 КоАП РФ (мелкое хищение в ТЦ), отказной материал по ст. 158 УК РФ в связи с недостижением 16 лет.",
      signposts: [
        { icon: "🏛️", label: "Постановление КДНиЗП № 42/18" },
        { icon: "⚖️", label: "ст. 7.27 ч. 2 КоАП РФ" },
        { icon: "📜", label: "КУСП отказной ст. 158 УК РФ" },
        { icon: "📂", label: "Категория: СОП (120-ФЗ)" },
        { icon: "👤", label: "Куратор: психолог + соцпедагог" },
      ],
      points: [
        {
          icon: "⚡",
          text: "Данные подростка подтягиваются из Единого реестра или заводятся за 60 секунд без дублирования бумажных формуляров.",
        },
        {
          icon: "⚖️",
          text: "Выбор статьи правонарушения (КоАП/УК РФ) автоматически включает блок юридических требований и привязывает профильные задачи сопровождения.",
        },
        {
          icon: "📂",
          text: "Фиксируется орган постановки (КДНиЗП / ОДН МВД) и официальный номер решения комиссии для будущей межведомственной отчетности.",
        },
      ],
      callout:
        "💡 Специалисту не нужно вручную составлять шапку дела: система формирует юридически корректную карточку по стандартам 120-ФЗ.",
      mockupTitle: "Prevention Terminal · Карточка личного дела (Форма №1)",
      renderMockup: () => (
        <div className="ipr-mockup-screen">
          <div className="ipr-mockup-card-header">
            <div className="ipr-mockup-profile-info">
              <div className="ipr-mockup-avatar">КС</div>
              <div>
                <div className="ipr-mockup-name">Соколов Кирилл Дмитриевич</div>
                <div className="ipr-mockup-sub">15 лет · 14.05.2010 г.р. · Школа № 245, 9 «В» класс</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <span className="ipr-mockup-tag danger">Учет КДНиЗП</span>
              <span className="ipr-mockup-tag warning">СОП / Девиантное</span>
            </div>
          </div>

          <div className="ipr-mockup-fields-grid">
            <div className="ipr-mockup-field">
              <span className="ipr-mockup-field-label">Орган постановки</span>
              <span className="ipr-mockup-field-val">КДНиЗП Адмиралтейского района (Пост. № 42/18)</span>
            </div>
            <div className="ipr-mockup-field">
              <span className="ipr-mockup-field-label">Категория учета</span>
              <span className="ipr-mockup-field-val">Социально опасное положение (120-ФЗ)</span>
            </div>
            <div className="ipr-mockup-field highlighted">
              <span className="ipr-mockup-field-label">Квалификация правонарушения</span>
              <span className="ipr-mockup-field-val">ст. 7.27 ч. 2 КоАП РФ · КУСП ст. 158 УК РФ</span>
            </div>
            <div className="ipr-mockup-field">
              <span className="ipr-mockup-field-label">Ответственный куратор</span>
              <span className="ipr-mockup-field-val">Психолог Смирнова Е.А. / Соцпедагог Ильин</span>
            </div>
          </div>

          <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
              Фабула первичного обращения:
            </div>
            <div style={{ fontSize: "11.5px", color: "#1e293b", lineHeight: 1.4 }}>
              Задержание службой безопасности ТРК при попытке выноса электроники. Ранее на учете не состоял. Отчим отказывается участвовать в воспитании, мать работает посменно. Высокий риск повторения в уличной группе.
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 2,
      timeRange: "⏱️ 02:00 – 05:00",
      tabLabel: "2. Диагностика 9 сфер",
      badge: "Шаг 2 из 5 · Экспресс-оценка рисков",
      formStage: "form1",
      formBadge: "📁 Форма №1 · Оценка рисков (ОРВ)",
      title: "Таблица индикаторов: галочки факторов риска и ресурсов по 9 сферам",
      caseSummary:
        "Специалист отмечает факторы риска (красные маркеры) и защитные ресурсы (зеленые опоры) привычными галочками. Индекс риска Кирилла: 62% (Оранжевая зона / Высокое внимание).",
      signposts: [
        { icon: "📊", label: "Индекс риска 62% (Оранжевая зона)" },
        { icon: "☑️", label: "Таблица чекбоксов по сферам" },
        { icon: "🔴", label: "Риски: уходы, 18 прогулов, среда" },
        { icon: "🟢", label: "Ресурс 1: контакт с дедушкой (опора)" },
        { icon: "🟢", label: "Ресурс 2: страсть к картингу и моторам" },
      ],
      points: [
        {
          icon: "☑️",
          text: "Привычная матрица чекбоксов: психолог и педагог отмечают галочками конкретные жизненные индикаторы без птичьего языка.",
        },
        {
          icon: "🔴",
          text: "Выявленные риски (красные маркеры): уходы до ночи (семья), 18 прогулов уроков (школа), старшая уличная группа (среда), бравада проступком.",
        },
        {
          icon: "🟢",
          text: "Защитные ресурсы (зеленые опоры): авторитет дедушки (ветеран труда, автомеханик) и личный интерес подростка к картингу и автоделу.",
        },
        {
          icon: "📊",
          text: "Система мгновенно считает кумулятивный индекс риска (62%) и выводит нормативное обоснование для межведомственной комиссии.",
        },
      ],
      callout:
        "💡 Зеленые опоры — фундамент реабилитации. Программа строится не на запретах, а на переключении энергии подростка через автодело и дедушку.",
      mockupTitle: "Prevention Terminal · Форма №1: Заполненная матрица индикаторов по 9 сферам",
      renderMockup: () => (
        <div className="ipr-mockup-screen">
          <div className="ipr-risk-meter-box">
            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>Кумулятивный индекс риска (9 сфер)</div>
              <div className="ipr-risk-score-badge">
                <span className="ipr-risk-score-num">62%</span>
                <span className="ipr-risk-score-total">/ 100% · Оранжевая зона (Внимание)</span>
              </div>
            </div>
            <div className="ipr-risk-meter-bar-track">
              <div className="ipr-risk-meter-bar-fill" style={{ width: "62%", background: "linear-gradient(90deg, #f59e0b, #ea580c)" }} />
            </div>
            <span className="ipr-mockup-tag warning">Требуется ИПР</span>
          </div>

          {/* Привычная специалисту заполненная таблица с галочками */}
          <div className="ipr-indicators-table-wrapper">
            <div className="ipr-indicators-table-header">
              <span style={{ flex: "1 1 140px", fontWeight: 700 }}>Жизненная сфера</span>
              <span style={{ flex: "2 1 220px", fontWeight: 700, color: "#dc2626" }}>🔴 Факторы риска (отмечено ✓)</span>
              <span style={{ flex: "2 1 220px", fontWeight: 700, color: "#16a34a" }}>🟢 Защитные ресурсы (отмечено ✓)</span>
              <span style={{ width: "65px", textAlign: "right", fontWeight: 700 }}>Балл</span>
            </div>

            <div className="ipr-indicators-table-row">
              <div style={{ flex: "1 1 140px", fontWeight: 600 }}>1. Семья и быт</div>
              <div style={{ flex: "2 1 220px", display: "flex", flexDirection: "column", gap: "2px" }}>
                <span className="ipr-check-item checked-risk">☑ Уходы из дома до ночи после ссор</span>
                <span className="ipr-check-item checked-risk">☑ Конфликтный отчим, мать на сменах</span>
                <span className="ipr-check-item muted-risk">☐ Неудовлетворительные условия жилья</span>
              </div>
              <div style={{ flex: "2 1 220px", display: "flex", flexDirection: "column", gap: "2px" }}>
                <span className="ipr-check-item checked-asset">☑ Теплый контакт с дедушкой (опора)</span>
                <span className="ipr-check-item muted-asset">☐ Открытый диалог с матерью</span>
              </div>
              <div style={{ width: "65px", textAlign: "right", fontWeight: 800, color: "#ea580c" }}>70% 🔴</div>
            </div>

            <div className="ipr-indicators-table-row">
              <div style={{ flex: "1 1 140px", fontWeight: 600 }}>2. Школа и учеба</div>
              <div style={{ flex: "2 1 220px", display: "flex", flexDirection: "column", gap: "2px" }}>
                <span className="ipr-check-item checked-risk">☑ 18 прогулов без уважительной причины</span>
                <span className="ipr-check-item checked-risk">☑ Академическая задолженность по физике</span>
              </div>
              <div style={{ flex: "2 1 220px", display: "flex", flexDirection: "column", gap: "2px" }}>
                <span className="ipr-check-item checked-asset">☑ Сохранный интеллект, учится при контроле</span>
                <span className="ipr-check-item muted-asset">☐ Участие в олимпиадах</span>
              </div>
              <div style={{ width: "65px", textAlign: "right", fontWeight: 800, color: "#ea580c" }}>65% 🔴</div>
            </div>

            <div className="ipr-indicators-table-row">
              <div style={{ flex: "1 1 140px", fontWeight: 600 }}>3. Окружение и среда</div>
              <div style={{ flex: "2 1 220px", display: "flex", flexDirection: "column", gap: "2px" }}>
                <span className="ipr-check-item checked-risk">☑ Старшая дворовая группа у ТЦ</span>
                <span className="ipr-check-item checked-risk">☑ Романтизация криминальных проступков</span>
              </div>
              <div style={{ flex: "2 1 220px", display: "flex", flexDirection: "column", gap: "2px" }}>
                <span className="ipr-check-item checked-asset">☑ Нет устойчивой криминальной субкультуры</span>
              </div>
              <div style={{ width: "65px", textAlign: "right", fontWeight: 800, color: "#ea580c" }}>75% 🔴</div>
            </div>

            <div className="ipr-indicators-table-row">
              <div style={{ flex: "1 1 140px", fontWeight: 600 }}>4. Досуг и увлечения</div>
              <div style={{ flex: "2 1 220px", display: "flex", flexDirection: "column", gap: "2px" }}>
                <span className="ipr-check-item checked-risk">☑ Бесцельное времяпрепровождение в ТЦ</span>
              </div>
              <div style={{ flex: "2 1 220px", display: "flex", flexDirection: "column", gap: "2px" }}>
                <span className="ipr-check-item checked-asset">☑ Выраженный интерес к автоделу и картингу</span>
                <span className="ipr-check-item checked-asset">☑ Опыт помощи дедушке в ремонте авто</span>
              </div>
              <div style={{ width: "65px", textAlign: "right", fontWeight: 800, color: "#16a34a" }}>30% 🟢</div>
            </div>

            <div className="ipr-indicators-table-row">
              <div style={{ flex: "1 1 140px", fontWeight: 600 }}>5. Здоровье и ПАВ</div>
              <div style={{ flex: "2 1 220px", display: "flex", flexDirection: "column", gap: "2px" }}>
                <span className="ipr-check-item muted-risk">☐ Употребление алкоголя / наркотиков</span>
              </div>
              <div style={{ flex: "2 1 220px", display: "flex", flexDirection: "column", gap: "2px" }}>
                <span className="ipr-check-item checked-asset">☑ ПАВ не употребляет, физически развит</span>
                <span className="ipr-check-item checked-asset">☑ Нет хронических тяжелых заболеваний</span>
              </div>
              <div style={{ width: "65px", textAlign: "right", fontWeight: 800, color: "#16a34a" }}>10% 🟢</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      timeRange: "⏱️ 05:00 – 07:00",
      tabLabel: "3. План на 6 месяцев",
      badge: "Шаг 3 из 5 · Автосборка маршрута",
      formStage: "form2",
      formBadge: "🤝 Форма №2 · План ИПР",
      title: "1 клик: Автосборка межведомственного плана на 6 месяцев",
      caseSummary:
        "Нажатием кнопки «⚡ Сформировать маршрут» система формирует согласованный план по 3 фазам с распределением ролей специалистов и нормативными обоснованиями под 120-ФЗ.",
      signposts: [
        { icon: "📅", label: "3 фазы сопровождения на 6 месяцев" },
        { icon: "🤝", label: "Межведомственные роли: психолог, соцпедагог, АЗН" },
        { icon: "⚡", label: "Автосборка мероприятий в 1 клик" },
        { icon: "🏎️", label: "Секция картинга (просоциальный досуг)" },
        { icon: "⚖️", label: "Правовой лекторий об ответственности с 16 лет" },
      ],
      points: [
        {
          icon: "1️⃣",
          text: "Фаза I (1–2 мес: Контакт и стабилизация): 4 консультации психолога (снижение агрессии, работа с дедушкой), урегулирование графика посещения школы.",
        },
        {
          icon: "2️⃣",
          text: "Фаза II (3–4 мес: Профориентация и занятость): запись в картинг-клуб при молодежном центре, экспресс-курс автодела, правовой лекторий юриста.",
        },
        {
          icon: "3️⃣",
          text: "Фаза III (5–6 мес: Закрепление и КДНиЗП): контрольный срез факторов риска, подготовка ходатайства о снятии с учета на комиссию.",
        },
      ],
      callout:
        "💡 Никакой головной боли с согласованием ведомств: у каждого действия четко указаны исполнитель, срок и контрольный результат.",
      mockupTitle: "Prevention Terminal · Форма №2: Межведомственный план сопровождения",
      renderMockup: () => (
        <div className="ipr-mockup-screen">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
              Маршрут сопровождения: 3 фазы · 12 мероприятий
            </span>
            <span className="ipr-mockup-tag info">⚡ Автосборка по 9 сферам</span>
          </div>

          <div className="ipr-plan-mockup-phases">
            <div className="ipr-plan-phase-card" style={{ borderLeft: "4px solid #6366f1" }}>
              <div className="ipr-plan-phase-head">
                <span className="ipr-plan-phase-title">Фаза I (1–2 мес.): Встреча, контакт и стабилизация</span>
                <span className="ipr-mockup-tag success">В работе</span>
              </div>
              <div className="ipr-plan-action-row">
                <span>1. Диагностика установок, 4 очные сессии с привлечением дедушки</span>
                <span className="ipr-plan-role-chip">Педагог-психолог</span>
              </div>
              <div className="ipr-plan-action-row">
                <span>2. Индивидуальный график ликвидации академических задолженностей</span>
                <span className="ipr-plan-role-chip">Соцпедагог школы</span>
              </div>
            </div>

            <div className="ipr-plan-phase-card" style={{ borderLeft: "4px solid #f59e0b" }}>
              <div className="ipr-plan-phase-head">
                <span className="ipr-plan-phase-title">Фаза II (3–4 мес.): Профориентация, АЗН и позитивный досуг</span>
                <span className="ipr-mockup-tag warning">Запланировано</span>
              </div>
              <div className="ipr-plan-action-row">
                <span>1. Зачисление в картинг-клуб / секцию автодела при ПМК (бесплатно)</span>
                <span className="ipr-plan-role-chip">Специалист по труду</span>
              </div>
              <div className="ipr-plan-action-row">
                <span>2. Индивидуальная правовая беседа об ответственности с 16 лет</span>
                <span className="ipr-plan-role-chip">Юрисконсульт</span>
              </div>
            </div>

            <div className="ipr-plan-phase-card" style={{ borderLeft: "4px solid #10b981" }}>
              <div className="ipr-plan-phase-head">
                <span className="ipr-plan-phase-title">Фаза III (5–6 мес.): Закрепление результатов и КДНиЗП</span>
                <span className="ipr-mockup-tag info">Контроль</span>
              </div>
              <div className="ipr-plan-action-row">
                <span>1. Итоговый мониторинг динамики дезадаптации и снятия факторов риска</span>
                <span className="ipr-plan-role-chip">Куратор ИПР</span>
              </div>
              <div className="ipr-plan-action-row">
                <span>2. Заседание КДНиЗП: ходатайство о снятии с учета в связи с исправлением</span>
                <span className="ipr-plan-role-chip">Комиссия КДНиЗП</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 4,
      timeRange: "⏱️ 07:00 – 10:00",
      tabLabel: "4. Проведение встреч",
      badge: "Шаг 4 из 5 · Практика и документы",
      formStage: "form3",
      formBadge: "📊 Форма №3 · Мониторинг и документы",
      title: "Голосовая фиксация консультаций и сквозные документы в 1 клик",
      caseSummary:
        "Специалист проводит встречу с Кириллом и дедушкой. Заметки надиктовываются голосом в микрофон (🎙️), а все сопутствующие документы вызываются прямо из карточки.",
      signposts: [
        { icon: "🎙️", label: "Голосовой ввод сессии (микрофон)" },
        { icon: "📄", label: "Характеристика в 1 клик" },
        { icon: "📋", label: "Справка 025/у" },
        { icon: "🔍", label: "Бланки ФАП, BIP, ППк" },
        { icon: "📉", label: "Срез динамики риска: 62% ➔ 38% ↓" },
      ],
      points: [
        {
          icon: "🎙️",
          text: "Надиктовка без канцелярита: специалист говорит своими словами, система автоматически структурирует протокол встречи и задачи.",
        },
        {
          icon: "📑",
          text: "Единый профиль документов: бейджи «Характеристика», «025/у», «ФАП», «BIP», «ППк» открывают готовые формы без повторного ввода ФИО.",
        },
        {
          icon: "📉",
          text: "Фиксация позитивной динамики: Кирилл начал заниматься в секции картинга, восстановил учебу, индекс риска снизился до 38%.",
        },
      ],
      callout:
        "💡 Вся история встреч, явок и решений хранится в едином защищенном журнале. Никаких потерянных бумажек и блокнотов.",
      mockupTitle: "Prevention Terminal · Консультирование и сквозные документы",
      renderMockup: () => (
        <div className="ipr-mockup-screen">
          <div className="ipr-consult-mockup-box">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                🎙️ Сессия №2: Кирилл и дедушка (Виктор Сергеевич)
              </span>
              <span className="ipr-mockup-tag success">00:42 ⏺ Голосовой ввод</span>
            </div>

            <div className="ipr-speech-bubble">
              «...Кирилл пришел с дедушкой вовремя. Настрой деловой. Оформили заявление в секцию картинга при клубе "Вираж", дедушка взял на себя сопровождение по субботам. Кирилл признает, что история в ТЦ была ошибкой из-за желания произвести впечатление на старших...»
            </div>

            <div>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>
                Связанные документы по Кириллу (доступны в 1 клик):
              </div>
              <div className="ipr-docs-badges-row">
                <span className="ipr-doc-chip">📄 Характеристика</span>
                <span className="ipr-doc-chip">📋 Справка 025/у</span>
                <span className="ipr-doc-chip">🔍 Анализ ФАП</span>
                <span className="ipr-doc-chip">🎯 План BIP</span>
                <span className="ipr-doc-chip">👥 Протокол ППк</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "11.5px", color: "#475569" }}>Промежуточный срез (2-й месяц):</span>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "#059669" }}>Индекс риска снизился: 62% ➔ 38% ↓</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 5,
      timeRange: "⏱️ 10:00 – 12:00",
      tabLabel: "5. Итоговый протокол и Word",
      badge: "Шаг 5 из 5 · Финал и выгрузка",
      formStage: "form3",
      formBadge: "📊 Форма №3 · Протокол и итоги",
      title: "Форма №3: Официальный протокол оценки динамики и экспорт отчета в Word",
      caseSummary:
        "На 6-м месяце сформирован официальный итоговый протокол: индекс риска снижен с 62% до 22% (Норма), план выполнен на 100%, подготовлено ходатайство о снятии с учета для КДНиЗП.",
      signposts: [
        { icon: "📋", label: "Протокол оценки динамики (вход ➔ итог)" },
        { icon: "🏆", label: "Индекс риска снижен до 22% (Норма)" },
        { icon: "🏛️", label: "Решение комиссии: завершить в связи с успехом" },
        { icon: "📝", label: "Ходатайство в КДНиЗП о снятии с учета" },
        { icon: "💾", label: "Экспорт в Word (DOCX) за 1 клик" },
      ],
      points: [
        {
          icon: "📋",
          text: "Официальный бланк протокола: сравнительная таблица стартового (62%) и итогового (22%) индекса риска по всем жизненным сферам.",
        },
        {
          icon: "✓",
          text: "100% выполнение плана: посещение секции картинга, ликвидация двоек по физике, отсутствие правонарушений за весь период сопровождения.",
        },
        {
          icon: "🏛️",
          text: "Фиксация решения: «Завершить индивидуальное сопровождение в связи с выполнением плана ИПР и устранением причин дезадаптации».",
        },
        {
          icon: "📄",
          text: "Выгрузка в Word (DOCX): одним кликом формируется юридически выверенный отчет с гербом, подписями и ходатайством о снятии с учета.",
        },
      ],
      callout:
        "💡 Экономия: вместо 3–4 часов составления отчетов перед комиссией специалист тратит ровно 1 клик. Все нормативные требования 120-ФЗ соблюдены.",
      mockupTitle: "Prevention Terminal · Форма №3: Итоговый протокол и экспертное заключение",
      renderMockup: () => (
        <div className="ipr-mockup-screen">
          {/* Официальный бланк итогового протокола мониторинга */}
          <div className="ipr-protocol-sheet">
            <div className="ipr-protocol-header">
              <div className="ipr-protocol-title">ПРОТОКОЛ ИТОГОВОЙ ОЦЕНКИ И ДИНАМИКИ ИПР</div>
              <div className="ipr-protocol-sub">Несовершеннолетний: Соколов Кирилл Дмитриевич (15 лет) · Период: 6 месяцев</div>
            </div>

            {/* Сравнительная шкала входа и выхода */}
            <div className="ipr-protocol-compare-row">
              <div className="ipr-protocol-stat-box before">
                <span className="ipr-protocol-stat-label">Первичный индекс риска</span>
                <span className="ipr-protocol-stat-val">62%</span>
                <span className="ipr-protocol-stat-sub">Оранжевая зона (Внимание)</span>
              </div>
              <div className="ipr-protocol-arrow">➔ 40% ↓</div>
              <div className="ipr-protocol-stat-box after">
                <span className="ipr-protocol-stat-label">Итоговый индекс риска</span>
                <span className="ipr-protocol-stat-val">22%</span>
                <span className="ipr-protocol-stat-sub">Зеленая зона (Благоприятная норма)</span>
              </div>
              <div className="ipr-protocol-stat-box done">
                <span className="ipr-protocol-stat-label">Выполнение плана</span>
                <span className="ipr-protocol-stat-val">100%</span>
                <span className="ipr-protocol-stat-sub">12 из 12 действий завершено</span>
              </div>
            </div>

            {/* Экспертное заключение и решение */}
            <div className="ipr-protocol-section">
              <div className="ipr-protocol-sec-title">⚖️ Итоговое экспертное заключение куратора и ППк:</div>
              <div className="ipr-protocol-sec-text">
                «За период сопровождения (ноябрь 2025 – апрель 2026) повторных правонарушений не допущено. Прогулы уроков полностью ликвидированы, задолженность по физике погашена (итоговая оценка: «хорошо»). Кирилл зачислен в картинг-клуб "Вираж", стал помощником инструктора. Конфликтность в семье снижена, налажен контакт дедушки со школой. Уличная группа покинута.»
              </div>
            </div>

            <div className="ipr-protocol-decision-box">
              <div style={{ fontWeight: 800, color: "#166534", fontSize: "11.5px" }}>
                ✓ Решение: Завершить сопровождение в связи с выполнением плана ИПР и исправлением.
              </div>
              <div style={{ fontSize: "10.5px", color: "#15803d", marginTop: "2px" }}>
                Ходатайство: Рекомендовано снять с профилактического учета КДНиЗП Адмиралтейского района.
              </div>
            </div>

            {/* Выгрузка Word */}
            <div className="ipr-export-action-bar" style={{ marginTop: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>📄</span>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#1e3a8a" }}>Отчет_ИПР_Соколов_КДНиЗП.docx</div>
                  <div style={{ fontSize: "10px", color: "#64748b" }}>Сформирован официальный документ с таблицами и подписями</div>
                </div>
              </div>
              <span className="ipr-mockup-tag info" style={{ background: "#2563eb", color: "#ffffff", padding: "4px 10px" }}>
                Скачать Word
              </span>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const current = slides[currentSlide];

  return (
    <>
      <div className="ipr-walkthrough-backdrop" onClick={onClose}>
        <div className="ipr-walkthrough-container" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="ipr-walkthrough-head">
            <div className="ipr-walkthrough-head-meta">
              <span className="ipr-walkthrough-badge">
                🎞️ Обучающая презентация · Сквозная цепочка
              </span>
              <h2 className="ipr-walkthrough-title">
                1 подросток за 10–12 минут
                <span className="ipr-walkthrough-title-sub">
                  (Практический разбор на кейсе Кирилла Соколова, 15 лет)
                </span>
              </h2>
            </div>
            <button
              type="button"
              className="ipr-walkthrough-close-btn"
              onClick={onClose}
              title="Закрыть презентацию (Esc)"
            >
              ✕ Закрыть
            </button>
          </div>

          {/* 3-Forms Pipeline Bar (Быстрый переход к этапам) */}
          <div className="ipr-forms-pipeline">
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase" }}>
              Архитектура форм:
            </span>
            <button
              type="button"
              className={`ipr-pipeline-stage${current.formStage === "form1" ? " active" : ""}`}
              onClick={() => setCurrentSlide(0)}
              title="Перейти к Форме №1 (Личное дело и оценка 9 сфер)"
            >
              📁 Форма №1: Личное дело и 9 сфер
            </button>
            <span className="ipr-pipeline-arrow">➔</span>
            <button
              type="button"
              className={`ipr-pipeline-stage${current.formStage === "form2" ? " active" : ""}`}
              onClick={() => setCurrentSlide(2)}
              title="Перейти к Форме №2 (План ИПР на 6 месяцев)"
            >
              🤝 Форма №2: План ИПР (3 фазы)
            </button>
            <span className="ipr-pipeline-arrow">➔</span>
            <button
              type="button"
              className={`ipr-pipeline-stage${current.formStage === "form3" ? " active" : ""}`}
              onClick={() => setCurrentSlide(4)}
              title="Перейти к Форме №3 (Итоги и экспорт Word)"
            >
              📊 Форма №3: Итоги и Word для КДНиЗП
            </button>
          </div>

          {/* Timeline Navigation Tabs */}
          <div className="ipr-walkthrough-nav-bar">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                className={`ipr-walkthrough-tab-btn${idx === currentSlide ? " active" : ""}`}
                onClick={() => setCurrentSlide(idx)}
              >
                <span className="ipr-walkthrough-tab-time">{s.timeRange}</span>
                <span className="ipr-walkthrough-tab-label">{s.tabLabel}</span>
              </button>
            ))}
          </div>

          {/* Main Body: Step-by-Step Slide View */}
          <div className="ipr-walkthrough-body">
            <div className="ipr-walkthrough-grid">
              {/* Left Narrative Column */}
              <div className="ipr-walkthrough-narrative">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span className="ipr-narrative-step-badge">{current.badge}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      background: "#f1f5f9",
                      color: "#334155",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    {current.formBadge}
                  </span>
                </div>

                <h3 className="ipr-narrative-h3">{current.title}</h3>

                <div className="ipr-narrative-case-box">
                  <strong>Ситуация подростка:</strong> {current.caseSummary}
                </div>

                {/* Знаковые реквизиты для специалистов */}
                <div className="ipr-signposts-box">
                  <span className="ipr-signposts-title">
                    📌 Знаковые реквизиты формы:
                  </span>
                  <div className="ipr-signposts-tags">
                    {current.signposts.map((sp, idx) => (
                      <span key={idx} className="ipr-signpost-tag">
                        <span>{sp.icon}</span>
                        <span>{sp.label}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <ul className="ipr-narrative-points">
                  {current.points.map((p, i) => (
                    <li key={i} className="ipr-narrative-point">
                      <span className="ipr-narrative-point-icon">{p.icon}</span>
                      <span>{p.text}</span>
                    </li>
                  ))}
                </ul>

                <div className="ipr-narrative-callout">{current.callout}</div>
              </div>

              {/* Right Mockup Column */}
              <div className="ipr-mockup-frame">
                <div className="ipr-mockup-topbar">
                  <div className="ipr-mockup-dots">
                    <span className="ipr-mockup-dot red" />
                    <span className="ipr-mockup-dot yellow" />
                    <span className="ipr-mockup-dot green" />
                  </div>
                  <span className="ipr-mockup-title">{current.mockupTitle}</span>
                  <div className="ipr-mockup-top-actions">
                    <button
                      type="button"
                      className="ipr-mockup-fullscreen-btn"
                      onClick={() => setFullscreenOpen(true)}
                      title="Развернуть скриншот во весь экран"
                    >
                      🔍 Во весь экран
                    </button>
                    <span style={{ fontSize: "10.5px", color: "#94a3b8" }}>
                      {currentSlide + 1} / {slides.length}
                    </span>
                  </div>
                </div>

                {/* Clickable Mockup Screen */}
                <div
                  className="ipr-mockup-clickable-wrapper"
                  onClick={() => setFullscreenOpen(true)}
                  title="Нажмите, чтобы открыть в максимальном масштабе во весь экран"
                >
                  <span className="ipr-mockup-zoom-hint">🔍 Нажмите для полноэкранного просмотра</span>
                  {current.renderMockup()}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="ipr-walkthrough-footer">
            <div className="ipr-walkthrough-dots-nav">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`ipr-walkthrough-nav-dot${idx === currentSlide ? " active" : ""}`}
                  onClick={() => setCurrentSlide(idx)}
                  title={`Перейти к шагу ${idx + 1}`}
                />
              ))}
              <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "6px" }}>
                Шаг {currentSlide + 1} из {slides.length}
              </span>
            </div>

            <div className="ipr-walkthrough-btn-group">
              <button
                type="button"
                className="ipr-walkthrough-btn secondary"
                disabled={currentSlide === 0}
                onClick={() => setCurrentSlide((prev) => Math.max(prev - 1, 0))}
                style={{ opacity: currentSlide === 0 ? 0.5 : 1 }}
              >
                ← Назад
              </button>

              {currentSlide < slides.length - 1 ? (
                <button
                  type="button"
                  className="ipr-walkthrough-btn primary"
                  onClick={() => setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1))}
                >
                  Следующий шаг →
                </button>
              ) : (
                <button
                  type="button"
                  className="ipr-walkthrough-btn primary"
                  onClick={() => {
                    if (onSelectKirillDemo) {
                      onSelectKirillDemo();
                    }
                    onClose();
                  }}
                >
                  ✓ Начать работу в ИПР
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox Overlay */}
      {fullscreenOpen && (
        <div className="ipr-fullscreen-overlay" onClick={() => setFullscreenOpen(false)}>
          <div className="ipr-fullscreen-head" onClick={(e) => e.stopPropagation()}>
            <div className="ipr-fullscreen-title">
              <span>🔍 {current.mockupTitle}</span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  background: "rgba(255, 255, 255, 0.15)",
                  padding: "3px 10px",
                  borderRadius: "9999px",
                }}
              >
                {current.formBadge}
              </span>
            </div>

            <div className="ipr-fullscreen-actions">
              <button
                type="button"
                className="ipr-fullscreen-close-btn"
                disabled={currentSlide === 0}
                onClick={() => setCurrentSlide((prev) => Math.max(prev - 1, 0))}
                style={{ opacity: currentSlide === 0 ? 0.4 : 1 }}
              >
                ← Назад
              </button>
              <button
                type="button"
                className="ipr-fullscreen-close-btn"
                disabled={currentSlide === slides.length - 1}
                onClick={() => setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1))}
                style={{ opacity: currentSlide === slides.length - 1 ? 0.4 : 1 }}
              >
                Вперед →
              </button>
              <button
                type="button"
                className="ipr-fullscreen-close-btn"
                onClick={() => setFullscreenOpen(false)}
                title="Закрыть полноэкранный режим (Esc)"
              >
                ✕ Закрыть просмотр (Esc)
              </button>
            </div>
          </div>

          <div className="ipr-fullscreen-body" onClick={(e) => e.stopPropagation()}>
            <div className="ipr-fullscreen-card-container">
              {current.renderMockup()}
            </div>

            <div className="ipr-fullscreen-legend">
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, color: "#ffffff" }}>Знаковые элементы:</span>
                {current.signposts.map((sp, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: "rgba(255, 255, 255, 0.12)",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      border: "1px solid rgba(255, 255, 255, 0.18)",
                    }}
                  >
                    {sp.icon} {sp.label}
                  </span>
                ))}
              </div>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                Слайд {currentSlide + 1} из {slides.length} · Для закрытия нажмите Esc
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
