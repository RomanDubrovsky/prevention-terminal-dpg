import { getTerminalEdition } from "../lib/terminal_edition.ts";
export interface RiskItem {
  key: string;
  label: string;
}

export interface RiskSphere {
  id: string;
  title: string;
  items: RiskItem[];
}

export const CONTACT_RISK_SPHERES: RiskSphere[] = [
  {
    id: "1.3_housing",
    title: "1.3. Условия проживания",
    items: [
      { key: "unsanitary", label: "1.3.3. Неудовлетворительное санитарно-гигиеническое состояние жилья" },
      { key: "no_study_space", label: "1.3.4. Отсутствие места для учёбы (стол, стул)" },
      { key: "no_personal_things", label: "1.3.4. Отсутствие личных вещей (игры, книги)" },
      { key: "no_bed", label: "1.3.4. Отсутствие места для отдыха (сна, кровать)" },
      { key: "no_phone", label: "1.3.4. Отсутствие сотового телефона" },
      { key: "no_computer", label: "1.3.4. Отсутствие компьютера" },
      { key: "no_internet", label: "1.3.4. Отсутствие доступа в Интернет" },
      { key: "poverty", label: "1.3.6. Отсутствие денег на необходимый минимум (проезд, еда)" },
    ],
  },
  {
    id: "1.4_family",
    title: "1.4. Данные о семье",
    items: [
      { key: "single_parent", label: "1.4.2. Родитель в разводе / ребенок живет с одним из родителей" },
      { key: "extended_family", label: "1.4.2. Расширенная семья (бабушки, дедушки влияют на воспитание)" },
      { key: "relatives_raised", label: "1.4.2. Воспитывается родственниками, мало контактирует с родителями" },
      { key: "parent_death", label: "1.4.2. Пережил смерть родителя(ей)" },
      { key: "parent_divorce_state", label: "1.4.3. Родители в состоянии развода" },
      { key: "parent_illness", label: "1.4.3. Родители имеют тяжелые заболевания / стационар" },
      { key: "parent_alcohol", label: "1.4.3. Родители злоупотребляют алкоголем / лечились от алкоголизма" },
      { key: "parent_drugs", label: "1.4.3. Родители употребляют наркотики / лечились от наркомании" },
      { key: "parent_unemployed", label: "1.4.3. Родители не трудоустроены (в поиске работы)" },
      { key: "parent_disabled", label: "1.4.3. Родители нетрудоспособны (по инвалидности)" },
      { key: "parent_deprived_rights", label: "1.4.3. Родители лишены родительских прав" },
      { key: "parent_prison", label: "1.4.3. Родители находятся (находились) в местах лишения свободы" },
      { key: "parent_convicted", label: "1.4.3. Родители имеют(ли) судимость" },
      { key: "sibling_arrested", label: "1.4.4. Были задержания полицией братьев/сестер" },
      { key: "sibling_antisocial", label: "1.4.4. Старшие братья/сестры поощряют антиобщественное поведение" },
      { key: "sibling_illness", label: "1.4.4. Братья/сестры имеют тяжелые заболевания" },
      { key: "sibling_alcohol", label: "1.4.4. Братья/сестры злоупотребляют алкоголем / лечились от алкоголизма" },
      { key: "sibling_drugs", label: "1.4.4. Братья/сестры употребляют наркотики / лечились от наркомании" },
      { key: "sibling_prison", label: "1.4.4. Братья/сестры в тюрьме / судимы / опыт задержаний" },
      { key: "sibling_accompanied", label: "1.4.4. Брат/сестра были или находятся на социальном сопровождении" },
      { key: "parent_work_limit", label: "1.4.6. Режим работы родителей не позволяет полноценно заботиться о ребенке" },
      { key: "permissive_parenting", label: "1.4.7. В семье не практикуются наказания из-за попустительского стиля воспитания" },
      { key: "emotional_abuse", label: "1.4.7. Эмоциональное насилие (оскорбления, игнорирование, запугивание, унижения)" },
      { key: "physical_abuse", label: "1.4.7. Физическое наказание (ремень, удары, шлепки)" },
      { key: "passive_leisure", label: "1.4.8. Исключительно пассивный совместный досуг (телевизор, компьютер)" },
      { key: "no_leisure", label: "1.4.8. Нет совместного досуга родителей с ребенком" },
      { key: "overprotection", label: "1.4.9. Гиперопека, гиперконтроль" },
      { key: "no_discipline", label: "1.4.9. Попустительский стиль, отсутствие или недостаток дисциплины и домашних правил" },
      { key: "neglect", label: "1.4.9. Безнадзорность, отсутствие участия родителей в жизни ребенка" },
      { key: "inconsistent_rules", label: "1.4.9. Непоследовательные требования к дисциплине, противоречивость правил" },
      { key: "no_control", label: "1.4.9. Трудности в осуществлении контроля над поведением (агрессия на указания)" },
      { key: "inadequate_discipline", label: "1.4.9. Применение неприемлемых и неадекватных дисциплинарных методов" },
      { key: "lives_outside", label: "1.4.9. Ребенок периодически живет вне семьи из-за ссор с родителями" },
    ],
  },
  {
    id: "1.5_health",
    title: "1.5. Здоровье (заполняет только психолог)",
    items: [
      { key: "poor_nutrition", label: "1.5.1. Неудовлетворительное питание" },
      { key: "chronic_disease", label: "1.5.2. Есть хронические заболевания (влияющие на качество жизни)" },
      { key: "frequent_infections", label: "1.5.2. Частые инфекционные заболевания или острые состояния" },
      { key: "pain_skips", label: "1.5.2. Болезненное состояние неустановленной этиологии, пропуски по болезни" },
      { key: "med_treatment", label: "1.5.2. Заболевания, требующие регулярного приёма препаратов / стационара" },
      { key: "disabled_person", label: "1.5.2. Относится к лицам с ОВЗ" },
      { key: "intellect_limit", label: "1.5.3. Сниженные умственные способности, задержка / отставание в развитии" },
      { key: "affective_disorder", label: "1.5.3. Аффективные расстройства, эмоциональная нестабильность, депрессия / БАР" },
      { key: "anxiety_disorder", label: "1.5.3. Признаки тревожных расстройств, опыт панических атак" },
      { key: "adhd", label: "1.5.3. Гиперактивность, нарушения внимания, СДВГ" },
      { key: "schizoid_features", label: "1.5.3. Признаки шизоидного расстройства личности, галлюцинации" },
      { key: "autism_spectrum", label: "1.5.3. Признаки аутистического спектра" },
      { key: "suicide_experience", label: "1.5.3. Есть опыт или признаки самоповреждения / попыток суицида" },
      { key: "eating_disorder", label: "1.5.3. Нарушения пищевого поведения (переедание / отказ от еды)" },
      { key: "sleep_disorder", label: "1.5.3. Выраженные нарушения сна" },
      { key: "gadget_addiction", label: "1.5.4. Зависимость от гаджетов, интернета и соцсетей" },
      { key: "game_addiction", label: "1.5.4. Игровая зависимость" },
      { key: "smoking_habit", label: "1.5.4. Признаки систематического курения" },
      { key: "alcohol_habit", label: "1.5.4. Актуальные признаки употребления алкоголя" },
      { key: "drugs_habit", label: "1.5.4. Актуальные признаки употребления наркотиков" },
      { key: "toxic_habit", label: "1.5.4. Актуальные признаки употребления токсических веществ" },
    ],
  },
  {
    id: "1.6_personality",
    title: "1.6. Личность (заполняет только психолог)",
    items: [
      { key: "low_self_esteem", label: "1.6.1. Низкая самооценка, обесценивание, неприятие себя" },
      { key: "no_daily_planning", label: "1.6.1. Неспособность организовать быт, планировать повседневные дела" },
      { key: "no_comm_skills", label: "1.6.1. Недостаток коммуникативных навыков, неуверенность в общении" },
      { key: "relationship_problems", label: "1.6.1. Проблемы с дружбой/любовью, зависимые отношения, измена, ревность" },
      { key: "extreme_leisure", label: "1.6.1. Склонность к рискованному поведению (паркур, руфинг, экстремальный досуг)" },
      { key: "physical_aggression", label: "1.6.1. Склонность к физической агрессии" },
      { key: "verbal_aggression", label: "1.6.1. Склонность к вербальной агрессии" },
      { key: "abuse_victim", label: "1.6.1. Жертва физического / сексуального насилия" },
      { key: "sexual_deviations", label: "1.6.1. Проблемы сексуального поведения (промискуитет, проституция и др.)" },
      { key: "grief_loss", label: "1.6.1. Переживание горя, потеря близкого человека" },
      { key: "trauma_ptsd", label: "1.6.1. Актуальное переживание психотравмы, ПТСР" },
      { key: "low_social_skills", label: "1.6.2. Низкий уровень социальных навыков, плохо справляется с соц. ситуациями" },
      { key: "rejects_help", label: "1.6.2. Не обращается за личной или профессиональной помощью, или отвергает ее" },
      { key: "no_authorities", label: "1.6.2. Не признает авторитеты (родителей, учителей, МВД)" },
      { key: "criminal_romance", label: "1.6.2. Подвежен «криминальной романтике», ассоциирует себя с крим. культурой" },
    ],
  },
  {
    id: "1.7_learning",
    title: "1.7. Обучение",
    items: [
      { key: "low_academic", label: "1.7.2. Низкая успеваемость" },
      { key: "lost_interest", label: "1.7.3. Потеря интереса к обучению" },
      { key: "learning_rejection", label: "1.7.3. Отказ от продолжения обучения" },
      { key: "skips_illness_system", label: "1.7.4. Систематические пропуски занятий по болезни" },
      { key: "skips_illness_no_school", label: "1.7.4. Длительное время не посещает образовательную организацию по болезни" },
      { key: "truancy_periodic", label: "1.7.5. Периодические прогулы (без уважительных причин)" },
      { key: "truancy_systemic", label: "1.7.5. Систематические прогулы всех занятий" },
      { key: "truancy_subject", label: "1.7.5. Систематический пропуск определенного предмета(тов)" },
      { key: "truancy_no_school", label: "1.7.5. Длительное время не посещает ОО (прогулы)" },
      { key: "peer_conflict_oo", label: "1.7.6. Проблемы в отношениях со сверстниками (замкнут, конфликтует)" },
      { key: "bullying_victim", label: "1.7.6. Вербальное или физическое насилие, травля (жертва)" },
      { key: "teacher_conflict_oo", label: "1.7.6. Проблемы во взаимоотношениях с преподавателями (конфликты, травля)" },
      { key: "pedagogical_neglect", label: "1.7.6. Педагогическая запущенность, хроническая неуспеваемость" },
      { key: "bad_behavior_class", label: "1.7.6. Плохое поведение в классе на уроке" },
      { key: "bad_behavior_school", label: "1.7.6. Плохое поведение в школе (агрессивные/противоправные поступки)" },
      { key: "expelled", label: "1.7.6. Отстранение от занятий или отчисление из ОО" },
    ],
  },
  {
    id: "1.8_leisure",
    title: "1.8. Занятость и досуг",
    items: [
      { key: "no_organized_leisure", label: "1.8.3. Нет организованного досуга" },
      { key: "no_personal_interests", label: "1.8.3. Отсутствие личных интересов (спорта, хобби, чтения)" },
      { key: "periodic_leisure", label: "1.8.3. Эпизодически посещает занятия/кружки" },
    ],
  },
  {
    id: "1.9_peers",
    title: "1.9. Отношения со сверстниками",
    items: [
      { key: "no_communication", label: "1.9.1. Испытывает острый недостаток общения" },
      { key: "shy_new_people", label: "1.9.1. Испытывает стеснение и страх перед новыми знакомствами" },
      { key: "isolated_area", label: "1.9.1. Проживает в среде с ограниченными возможностями общения" },
      { key: "criminal_peer_group", label: "1.9.2. Участие в криминальных группах" },
      { key: "addicted_peer_group", label: "1.9.2. Употребление алкоголя и наркотиков среди сверстников" },
      { key: "antisocial_partner", label: "1.9.2. Антисоциальный романтический партнер" },
      { key: "antisocial_friends", label: "1.9.2. Есть друзья с антисоциальными взглядами/установками" },
      { key: "older_friends", label: "1.9.2. Наличие друзей с большой разницей в возрасте" },
      { key: "unadapted_friends", label: "1.9.2. Много социально неадаптированных друзей" },
      { key: "cruel_friends", label: "1.9.2. Жестокие друзья" },
    ],
  },
  {
    id: "1.10_virtual",
    title: "1.10. Факторы риска в виртуальном пространстве",
    items: [
      { key: "graffiti_vandalism", label: "1.10.1. Граффити, стрит-арт / опасность вандализма" },
      { key: "online_betting", label: "1.10.1. Онлайн-беттинг (ставки в интернете)" },
      { key: "roofing", label: "1.10.1. Руф-практики (посещение городских крыш, высоток)" },
      { key: "snus", label: "1.10.1. Снюс контент" },
      { key: "party_14", label: "1.10.1. Вечеринки 14+" },
      { key: "mmog", label: "1.10.1. Многопользовательские сетевые игры (MMOG)" },
      { key: "street_racing", label: "1.10.1. Стритрейсинг" },
      { key: "anime_extreme", label: "1.10.1. Активный интерес к Аниме-культуре" },
      { key: "train_hop", label: "1.10.1. Зацепинг, трейнхоп" },
      { key: "pornography", label: "1.10.1. Обнаружены материалы с признаками порнографии" },
      { key: "lgbt_propaganda", label: "1.10.1. Признаки пропаганды нетрадиционных отношений" },
      { key: "ultra_right", label: "1.10.2. Ультраправые идеологии" },
      { key: "extremism", label: "1.10.2. Экстремистские материалы / экстремизм" },
      { key: "anarchism", label: "1.10.2. Анархистские идеологии" },
      { key: "hools", label: "1.10.2. Хулсы (футбольные хулиганы)" },
      { key: "ofniks", label: "1.10.2. Офники" },
      { key: "patriot_crim", label: "1.10.2. Интерес к «пацанской» культуре" },
      { key: "aue", label: "1.10.2. А.У.Е." },
      { key: "weapons", label: "1.10.2. Интерес к оружию" },
      { key: "protests", label: "1.10.2. Вовлеченность в протестные акции" },
      { key: "school_shooting_disc", label: "1.10.2. Дискурс о вооруженном нападении на ОО" },
      { key: "suicide_online", label: "1.10.3. Суицидальные практики" },
      { key: "selfharm_online", label: "1.10.3. Селфхарм (саморазрушающие практики)" },
      { key: "depressive_online", label: "1.10.3. Деструктивный контент с признаками нарушения эмоционального состояния" },
      { key: "drug_online", label: "1.10.3. Признаки пропаганды потребления/хранения запрещенных веществ" },
      { key: "cyberbullying_victim", label: "1.10.3. Буллинг: пользователь — жертва" },
      { key: "cyberbullying_aggressor", label: "1.10.3. Буллинг: пользователь — агрессор" },
    ],
  },
  {
    id: "1.11_offense_eval",
    title: "1.11. Оценка правонарушения, установок и критических рисков",
    items: [
      { key: "client_no_coop", label: "1.11.3. Ребенок: Демонстративный отказ от сотрудничества со службой / куратором" },
      { key: "client_no_action", label: "1.11.3. Ребенок: Надеется, что все решится само собой, пассивен" },
      { key: "criminal_mindset_justification", label: "1.11.3. Оправдывает нарушения закона / считает преступление нормой" },
      { key: "lack_of_remorse_victim_blame", label: "1.11.3. Дефицит эмпатии: не признает вину, обвиняет жертву / потерпевшего" },
      { key: "pyromania_fire_setting", label: "1.11.3. 🚨 Поджоги, опыты с огнем / взрывчатыми веществами (пиромания)" },
      { key: "violence_against_authority", label: "1.11.3. 🚨 Насилие / угрозы в отношении педагогов и статусных взрослых" },
      { key: "chronic_runaway_vagabondage", label: "1.11.3. 🚨 Систематические побеги из дома/интерната, бродяжничество (>48 ч)" },
      { key: "sexualized_deviance", label: "1.11.3. 🚨 Сексуализированное девиантное поведение / насилие (в т.ч. к младшим)" },
      { key: "family_no_coop", label: "1.11.4. Семья: Нежелание сотрудничать со службой профилактики / куратором" },
      { key: "family_aggress", label: "1.11.4. Семья: Агрессивно высказываются, хотят, чтобы наказала «сама жизнь»" },
      { key: "family_no_resp", label: "1.11.4. Семья: Снимают с себя ответственность" },
      { key: "family_no_action", label: "1.11.4. Семья: Считают, что само собой решится со временем" },
    ],
  },
];

export const CONTACT_ACTION_TAXONOMY = [
  {
    id: "2.1_family",
    title: "2.1. Сопровождение семьи",
    actions: [
      "Беседа с ребенком",
      "Беседа с родителями",
      "Выход в адрес",
      "Направление писем в субъекты системы профилактики",
      "Семейный совет",
      "Медиация",
      "Содействие в получении льгот, компенсаций",
      "Помощь в оформлении документов",
    ],
  },
  {
    id: "2.2_legal",
    title: "2.2. Правовое сопровождение",
    actions: [
      "Участие в заседаниях КДНиЗП, ЭС, МРГ",
      "Взаимодействие с ОДН",
      "Участие в следственных мероприятиях",
      "Взаимодействие с уголовно-исполнительной инспекцией",
      "Участие в судебных заседаниях",
      "Индивидуальная консультация юриста",
      "Групповое занятие с юрисконсультом",
      "Содействие в получении пособий",
    ],
  },
  {
    id: "2.3_education",
    title: "2.3. Стабилизация / восстановление в ОО",
    actions: [
      "Посещение ОО с целью контроля / бесед с преподавателями",
      "Содействие в восстановлении в ОО",
      "Содействие в устройстве в ОО",
      "Содействие в переводе в другую ОО",
      "Содействие в организации помощи в обучении (репетиторы)",
      "Контроль за посещением ОО",
      "Контроль образовательного процесса (сдача задолженностей)",
    ],
  },
  {
    id: "2.4_employment",
    title: "2.4. Профориентация и трудоустройство",
    actions: [
      "Содействие в трудоустройстве на постоянной основе",
      "Содействие во временном трудоустройстве",
      "Содействие в профориентации через АЗН",
      "Содействие в обучении / ДПО через Центр занятости",
      "Содействие в профориентации сторонними специалистами («Вектор»)",
      "Содействие в прохождении профтестирования («Вектор»)",
      "Содействие в получении пособия по безработице",
      "Помощь в регистрации на ЕЦП «Работа в России»",
    ],
  },
  {
    id: "2.5_medical",
    title: "2.5. Медицинские услуги",
    actions: [
      "Содействие в получении консультации врача-специалиста",
      "Содействие в получении консультации врача-нарколога",
      "Содействие в прохождении медобследования",
      "Содействие в прохождении диспансеризации",
      "Содействие в устройстве в учреждения здравоохранения",
      "Содействие в получении путевок на санаторно-курортное лечение",
      "Содействие в госпитализации",
      "Направление в оздоровительный лагерь / ДОУ",
      "Содействие в получении медицинских документов",
    ],
  },
  {
    id: "2.6_leisure",
    title: "2.6. Организация досуга",
    actions: [
      "Посещение досуговых учреждений (сбор документов, контроль)",
      "Содействие в организации системного досуга",
      "Организация эпизодического досуга (театры, экскурсии)",
      "Проведение досуговых и развивающих мероприятий",
      "Профилактические интерактивные тренинги и мастер-классы",
      "Участие в патриотических мероприятиях",
      "Участие в спортивных мероприятиях",
      "Участие в культурно-просветительских мероприятиях",
    ],
  },
  {
    id: "2.7_summer",
    title: "2.7. Организация летнего отдыха",
    actions: [
      "Получение информации о месте летнего отдыха",
      "Содействие в отправке в летний лагерь",
    ],
  },
  {
    id: "2.8_prevention_links",
    title: "2.8. Взаимодействие с органами профилактики",
    actions: [
      "Участие в круглых столах, комиссионных совещаниях",
      "Направление писем в субъекты системы профилактики",
      "Посещение других субъектов системы профилактики",
    ],
  },
  {
    id: "2.9_social_shelter",
    title: "2.9. Помещение в социозащитные учреждения",
    actions: [
      "Помещение в социозащитные учреждения",
    ],
  },
];

/* ───────────────────────────────────────────────────────────────────────────
   СПРАВОЧНИК СТАТЕЙ ПРАВОНАРУШЕНИЙ (КоАП РФ и УК РФ)
   ─────────────────────────────────────────────────────────────────────────── */

export interface OffenseArticleItem {
  code: string;
  law: "КоАП РФ" | "УК РФ";
  shortLabel: string;
  title: string;
  description: string;
  category: "admin" | "property" | "violence" | "drugs" | "public_order" | "extremism";
}

export const CONTACT_OFFENSE_ARTICLES: OffenseArticleItem[] = [
  // КоАП РФ
  {
    code: "ст. 7.27 ч. 1, 2 КоАП РФ",
    law: "КоАП РФ",
    shortLabel: "ст. 7.27 КоАП — Мелкое хищение",
    title: "ст. 7.27 КоАП РФ. Мелкое хищение (до 2500 руб.)",
    description: "Хищение чужого имущества путем кражи, мошенничества, присвоения или растраты при отсутствии признаков преступления.",
    category: "property",
  },
  {
    code: "ст. 6.9 КоАП РФ",
    law: "КоАП РФ",
    shortLabel: "ст. 6.9 КоАП — Потребление наркотиков/ПАВ",
    title: "ст. 6.9 КоАП РФ. Потребление наркотических средств или психотропных веществ без назначения врача",
    description: "Потребление наркотических средств, психотропных веществ либо новых потенциально опасных ПАВ.",
    category: "drugs",
  },
  {
    code: "ст. 20.20 ч. 1, 2 КоАП РФ",
    law: "КоАП РФ",
    shortLabel: "ст. 20.20 КоАП — Распитие алкоголя в общ. местах",
    title: "ст. 20.20 КоАП РФ. Распитие алкоголя в запрещенных местах",
    description: "Потребление (распитие) алкогольной продукции на улицах, стадионах, в скверах, парках, общественном транспорте.",
    category: "admin",
  },
  {
    code: "ст. 20.21 КоАП РФ",
    law: "КоАП РФ",
    shortLabel: "ст. 20.21 КоАП — Появление в опьянении",
    title: "ст. 20.21 КоАП РФ. Появление в общественных местах в состоянии опьянения",
    description: "Появление в общественных местах в состоянии опьянения, оскорбляющем человеческое достоинство и общественную нравственность.",
    category: "admin",
  },
  {
    code: "ст. 20.1 ч. 1 КоАП РФ",
    law: "КоАП РФ",
    shortLabel: "ст. 20.1 КоАП — Мелкое хулиганство",
    title: "ст. 20.1 КоАП РФ. Мелкое хулиганство",
    description: "Нарушение общественного порядка, выражающее явное неуважение к обществу, с нецензурной бранью или порчей имущества.",
    category: "public_order",
  },
  {
    code: "ст. 6.1.1 КоАП РФ",
    law: "КоАП РФ",
    shortLabel: "ст. 6.1.1 КоАП — Побои",
    title: "ст. 6.1.1 КоАП РФ. Побои",
    description: "Нанесение побоев или иных насильственных действий, причинивших физическую боль (без вреда здоровью).",
    category: "violence",
  },
  {
    code: "ст. 20.22 КоАП РФ",
    law: "КоАП РФ",
    shortLabel: "ст. 20.22 КоАП — Опьянение до 16 лет",
    title: "ст. 20.22 КоАП РФ. Нахождение в опьянении несовершеннолетних до 16 лет",
    description: "Нахождение в состоянии опьянения несовершеннолетних в возрасте до 16 лет либо распитие ими алкоголя/ПАВ.",
    category: "admin",
  },
  // УК РФ
  {
    code: "ст. 158 ч. 1, 2 УК РФ",
    law: "УК РФ",
    shortLabel: "ст. 158 УК — Кража",
    title: "ст. 158 УК РФ. Кража",
    description: "Тайное хищение чужого имущества (в том числе группой лиц по предварительному сговору или с банковского счета).",
    category: "property",
  },
  {
    code: "ст. 161 ч. 1, 2 УК РФ",
    law: "УК РФ",
    shortLabel: "ст. 161 УК — Грабеж",
    title: "ст. 161 УК РФ. Грабеж",
    description: "Открытое хищение чужого имущества, в том числе с применением насилия, не опасного для жизни или здоровья.",
    category: "property",
  },
  {
    code: "ст. 166 ч. 1, 2 УК РФ",
    law: "УК РФ",
    shortLabel: "ст. 166 УК — Угон автотранспорта",
    title: "ст. 166 УК РФ. Неправомерное завладение ТС без цели хищения (угон)",
    description: "Неправомерное завладение транспортным средством без цели хищения (угон).",
    category: "property",
  },
  {
    code: "ст. 228 ч. 1 УК РФ",
    law: "УК РФ",
    shortLabel: "ст. 228 УК — Хранение/приобретение наркотиков",
    title: "ст. 228 УК РФ. Незаконные приобретение, хранение, перевозка наркотических средств",
    description: "Оборот наркотических средств, психотропных веществ или их аналогов в значительном/крупном размере без цели сбыта.",
    category: "drugs",
  },
  {
    code: "ст. 228.1 УК РФ",
    law: "УК РФ",
    shortLabel: "ст. 228.1 УК — Сбыт наркотиков («закладки»)",
    title: "ст. 228.1 УК РФ. Незаконные производство, сбыт или пересылка наркотических средств",
    description: "Сбыт наркотических средств через интернет/тайники (высокий риск вовлечения несовершеннолетних кураторами из сети).",
    category: "drugs",
  },
  {
    code: "ст. 213 УК РФ",
    law: "УК РФ",
    shortLabel: "ст. 213 УК — Хулиганство",
    title: "ст. 213 УК РФ. Хулиганство",
    description: "Грубое нарушение общественного порядка с применением оружия, предметов или группой лиц.",
    category: "public_order",
  },
  {
    code: "ст. 111/112/115 УК РФ",
    law: "УК РФ",
    shortLabel: "ст. 111-115 УК — Причинение вреда здоровью",
    title: "ст. 111, 112, 115 УК РФ. Умышленное причинение вреда здоровью",
    description: "Причинение легкого, средней тяжести или тяжкого вреда здоровью в ходе конфликтов или уличных драк.",
    category: "violence",
  },
  {
    code: "ст. 207 ч. 1, 2 УК РФ",
    law: "УК РФ",
    shortLabel: "ст. 207 УК — Сваттинг (ложное минирование)",
    title: "ст. 207 УК РФ. Заведомо ложное сообщение об акте терроризма",
    description: "Ложные сообщения о минировании учебных заведений и торговых комплексов из хулиганских побуждений.",
    category: "public_order",
  },
  {
    code: "ст. 280/282 УК РФ",
    law: "УК РФ",
    shortLabel: "ст. 280/282 УК — Экстремизм / разжигание ненависти",
    title: "ст. 280, 282 УК РФ. Публичные призывы к экстремизму / возбуждение ненависти",
    description: "Публичные призывы к осуществлению экстремистской деятельности в социальных сетях и мессенджерах.",
    category: "extremism",
  },
];

/* ───────────────────────────────────────────────────────────────────────────
   ФАКТОРЫ ЗАЩИТЫ (ЗЕЛЕНЫЕ РЕСУРСЫ) ПО 9 СФЕРАМ ЖИЗНЕДЕЯТЕЛЬНОСТИ
   ─────────────────────────────────────────────────────────────────────────── */

export interface ProtectiveItem {
  key: string;
  label: string;
}

export interface ProtectiveSphere {
  id: string;
  title: string;
  items: ProtectiveItem[];
}

export const CONTACT_PROTECTIVE_SPHERES: ProtectiveSphere[] = [
  {
    id: "1.3_housing",
    title: "1.3. Условия проживания (Защитные ресурсы)",
    items: [
      { key: "adequate_housing", label: "Обустроенное спальное и учебное место (своя комната или выделенная зона)" },
      { key: "basic_needs_met", label: "Семья материально обеспечена, базовые потребности в питании и одежде закрыты" },
      { key: "safe_neighbourhood", label: "Безопасное окружение по месту фактического проживания" },
    ],
  },
  {
    id: "1.4_family",
    title: "1.4. Данные о семье (Защитные ресурсы)",
    items: [
      { key: "supportive_adult", label: "Наличие хотя бы одного устойчивого, поддерживающего взрослого в семье" },
      { key: "family_cooperation", label: "Родители признают трудности и открыто сотрудничают со специалистами Центра" },
      { key: "warm_emotional_climate", label: "Теплый эмоциональный контакт ребенка с матерью/отцом/бабушкой" },
      { key: "clear_family_rules", label: "Последовательные и доброжелательные правила дисциплины дома" },
      { key: "joint_family_leisure", label: "Регулярный совместный развивающий досуг (поездки, прогулки, праздники)" },
    ],
  },
  {
    id: "1.5_health",
    title: "1.5. Здоровье (Защитные ресурсы)",
    items: [
      { key: "no_substance_addiction", label: "Стойкое отрицательное отношение к алкоголю, никотину и ПАВ" },
      { key: "active_sports", label: "Регулярные занятия физкультурой, спортом, подвижный образ жизни" },
      { key: "good_sleep_regime", label: "Стабильный режим сна и бодрствования" },
      { key: "medical_compliance", label: "Выполняет медицинские назначения, готов к консультациям врачей" },
    ],
  },
  {
    id: "1.6_personality",
    title: "1.6. Личность (Защитные ресурсы)",
    items: [
      { key: "critical_thinking", label: "Критическое отношение к правонарушению / поступку, осознание последствий" },
      { key: "empathy_developed", label: "Развитая способность к сопереживанию и эмпатии" },
      { key: "future_life_goals", label: "Наличие позитивных жизненных целей и планов на получение профессии" },
      { key: "accepts_specialist_help", label: "Доброжелателен к куратору, охотно идет на контакт и принимает помощь" },
      { key: "prosocial_values", label: "Уважение к закону и социальным нормам, неприятие криминальной субкультуры" },
    ],
  },
  {
    id: "1.7_learning",
    title: "1.7. Обучение (Защитные ресурсы)",
    items: [
      { key: "positive_teacher_bond", label: "Наличие поддерживающего педагога / классного руководителя в ОО" },
      { key: "learning_motivation", label: "Мотивация окончить школу / поступить в колледж (техникум)" },
      { key: "stable_school_attendance", label: "Регулярное посещение уроков без систематических прогулов" },
      { key: "favorite_subjects", label: "Наличие любимых учебных предметов или интереса к практике" },
    ],
  },
  {
    id: "1.8_leisure",
    title: "1.8. Занятость и досуг (Защитные ресурсы)",
    items: [
      { key: "organized_club_activity", label: "Системное посещение ПМК, секции, кружка (спорт, автодело, творчество)" },
      { key: "work_experience_desire", label: "Опыт официальной подработки или сильное желание работать через АЗН" },
      { key: "constructive_hobbies", label: "Наличие конструктивных увлечений (музыка, техника, рисование, ремесло)" },
    ],
  },
  {
    id: "1.9_peers",
    title: "1.9. Отношения со сверстниками (Защитные ресурсы)",
    items: [
      { key: "prosocial_friends", label: "Круг общения состоит из законопослушных, социально адаптированных сверстников" },
      { key: "no_gang_links", label: "Полное отсутствие связей с уличными криминальными группировками" },
      { key: "healthy_peer_support", label: "Друзья поддерживают позитивные изменения и отговаривают от рисков" },
    ],
  },
  {
    id: "1.10_virtual",
    title: "1.10. Виртуальное пространство (Защитные ресурсы)",
    items: [
      { key: "digital_hygiene_norm", label: "Конструктивное использование сети (учеба, познавательный контент, друзья)" },
      { key: "no_deviant_subs", label: "Отсутствие подписок на деструктивные, суицидальные или экстремистские паблики" },
      { key: "critical_media_literacy", label: "Понимает риски вербовки, мошенничества и «легкого заработка» в мессенджерах" },
    ],
  },
  {
    id: "1.11_offense_eval",
    title: "1.11. Оценка правонарушения / ситуации (Защитные ресурсы)",
    items: [
      { key: "admits_mistake", label: "Искренне признает вину, выражает раскаяние и готовность загладить ущерб" },
      { key: "active_cooperation_contact", label: "Подросток и родители добровольно сотрудничают со службой профилактики / куратором" },
      { key: "ready_for_restitution", label: "Готовность компенсировать вред потерпевшему / извиниться" },
      { key: "family_responsibility", label: "Семья занимает активную воспитательную позицию, контролирует подростка" },
    ],
  },
];

/* ───────────────────────────────────────────────────────────────────────────
   МОДЕЛЬ БАЛЛЬНОЙ ОЦЕНКИ И РАСЧЕТА ИНДЕКСА РИСКА (0–100%) ПО 9 СФЕРАМ
   ─────────────────────────────────────────────────────────────────────────── */

export interface SphereRiskScore {
  sphereId: string;
  title: string;
  riskCount: number;
  protectiveCount: number;
  rawScore: number; // 0..100
  level: "norm" | "moderate" | "elevated" | "critical";
  levelLabel: string;
  color: string;
}

export interface CriticalRiskAlert {
  active: boolean;
  reasons: string[];
}

export interface SpecializedRiskProfilesInput {
  suicideRisk?: {
    enabled?: boolean;
    riskLevel?: string;
    indicators?: string[];
    safetyPlanAgreed?: boolean;
    consultedPsychiatrist?: boolean;
  };
  eatingDisorderRisk?: {
    enabled?: boolean;
    riskLevel?: string;
    indicators?: string[];
    weightDynamics?: string;
  };
  bullyingRisk?: {
    enabled?: boolean;
    role?: string;
    forms?: string[];
    intensity?: string;
  };
  schoolAnxietyRisk?: {
    enabled?: boolean;
    riskLevel?: string;
    indicators?: string[];
  };
  cyberRisk?: {
    enabled?: boolean;
    riskLevel?: string;
    indicators?: string[];
  };
  runawayRisk?: {
    enabled?: boolean;
    frequency?: string;
    indicators?: string[];
  };
  familyViolenceRisk?: {
    enabled?: boolean;
    indicators?: string[];
    cpsInvolved?: boolean;
  };
  gadgetAddictionRisk?: {
    enabled?: boolean;
    screenTimeHoursDaily?: number;
    indicators?: string[];
    sleepDisruption?: boolean;
  };
  narcology?: {
    enabled?: boolean;
    substance?: string;
    dispensaryStatus?: string;
    cleanTestsCount?: number;
  };
}

export interface SubscaleScore {
  name: string;
  category: "criminogenic" | "family_environment" | "psychoemotional";
  riskCount: number;
  protectiveCount: number;
  rawScore: number; // 0..100%
  level: "norm" | "moderate" | "elevated" | "critical";
  levelLabel: string;
  color: string;
  targetAgency: string; // Ведомственный адресат (КДНиЗП/МВД, Соцзащита, Психологическая служба)
}

export interface CumulativeRiskProfile {
  totalRiskCount: number;
  totalProtectiveCount: number;
  cumulativeIndex: number; // 0..100% (расчетный)
  effectiveIndex: number; // с учетом Override
  overallLevel: "norm" | "moderate" | "elevated" | "critical";
  levelLabel: string;
  normBadgeClass: string;
  normExplanation: string;
  sphereScores: Record<string, SphereRiskScore>;
  subscales: {
    criminogenic: SubscaleScore;
    familyEnvironment: SubscaleScore;
    psychoemotional: SubscaleScore;
  };
  criticalAlert?: CriticalRiskAlert;
}

export function calculateRiskProfile(
  risks: Record<string, string[]> = {},
  protectiveFactors: Record<string, string[]> = {},
  options?: {
    isCriminalCategory?: boolean;
    isSop?: boolean;
    specialized?: SpecializedRiskProfilesInput;
    professionalOverride?: {
      enabled?: boolean;
      overriddenLevel?: "norm" | "moderate" | "elevated" | "critical";
      justification?: string;
    };
  }
): CumulativeRiskProfile {
  let totalRiskCount = 0;
  let totalProtectiveCount = 0;
  let weightedRiskSum = 0;
  let totalWeight = 0;

  // Веса критичности отдельных маркеров (Критические красные флаги = вес 3, поведенческие = 2, средовые = 1)
  const criticalMarkerKeys = new Set([
    "pyromania_fire_setting",
    "violence_against_authority",
    "chronic_runaway_vagabondage",
    "sexualized_deviance",
    "criminal_peer_group",
    "school_shooting_disc",
    "weapons",
    "aue",
    "suicide_online",
    "selfharm_online",
    "drug_online",
    "abuse_victim",
    "physical_aggression",
  ]);

  // Веса сфер в оценке делинквентного риска (методика ОРВ / 9 сфер)
  const sphereWeights: Record<string, number> = {
    "1.3_housing": 0.8,
    "1.4_family": 1.2,
    "1.5_health": 1.1,
    "1.6_personality": 1.3,
    "1.7_learning": 1.0,
    "1.8_leisure": 0.9,
    "1.9_peers": 1.3,
    "1.10_virtual": 1.1,
    "1.11_offense_eval": 1.5,
  };

  const sphereScores: Record<string, SphereRiskScore> = {};

  for (const sphere of CONTACT_RISK_SPHERES) {
    const rItems = risks[sphere.id] || [];
    const pItems = protectiveFactors[sphere.id] || [];
    const rCount = rItems.length;
    const pCount = pItems.length;
    totalRiskCount += rCount;
    totalProtectiveCount += pCount;

    // Взвешенный расчет внутри сферы с учетом весов маркеров
    let weightedSphereRisk = 0;
    for (const key of rItems) {
      if (criticalMarkerKeys.has(key)) {
        weightedSphereRisk += 35; // Критический маркер высокой опасности
      } else {
        weightedSphereRisk += 20; // Стандартный маркер риска
      }
    }
    const protectiveDiscount = pCount * 15;
    let raw = weightedSphereRisk - protectiveDiscount;
    if (raw < 0) raw = 0;
    if (raw > 100) raw = 100;

    let level: "norm" | "moderate" | "elevated" | "critical" = "norm";
    let levelLabel = "Норма (0–25%)";
    let color = "#10b981";

    if (raw > 75) {
      level = "critical";
      levelLabel = "Критический риск (76–100%)";
      color = "#ef4444";
    } else if (raw > 50) {
      level = "elevated";
      levelLabel = "Повышенный риск (51–75%)";
      color = "#f97316";
    } else if (raw > 25) {
      level = "moderate";
      levelLabel = "Умеренный риск (26–50%)";
      color = "#f59e0b";
    }

    sphereScores[sphere.id] = {
      sphereId: sphere.id,
      title: sphere.title,
      riskCount: rCount,
      protectiveCount: pCount,
      rawScore: raw,
      level,
      levelLabel,
      color,
    };

    const weight = sphereWeights[sphere.id] || 1.0;
    weightedRiskSum += raw * weight;
    totalWeight += weight;
  }

  // ── РАСЧЕТ 3 РАЗДЕЛЬНЫХ СУБШКАЛ ДЛЯ ВЕДОМСТВ ────────────────────────────────
  // 1. Криминогенный / Делинквентный риск (1.9 Сверстники, 1.10 Сеть/АУЕ/Оружие, 1.11 Правонарушения/Установки)
  const crimRisks = (risks["1.9_peers"] || []).length + (risks["1.10_virtual"] || []).length + (risks["1.11_offense_eval"] || []).length;
  const crimProts = (protectiveFactors["1.9_peers"] || []).length + (protectiveFactors["1.10_virtual"] || []).length + (protectiveFactors["1.11_offense_eval"] || []).length;
  let crimRaw = Math.min(100, Math.max(0, crimRisks * 22 - crimProts * 14));

  // 2. Семейно-средовое неблагополучие (1.3 Условия проживания, 1.4 Семья/Надзор, 1.8 Досуг)
  const famRisks = (risks["1.3_housing"] || []).length + (risks["1.4_family"] || []).length + (risks["1.8_leisure"] || []).length;
  const famProts = (protectiveFactors["1.3_housing"] || []).length + (protectiveFactors["1.4_family"] || []).length + (protectiveFactors["1.8_leisure"] || []).length;
  let famRaw = Math.min(100, Math.max(0, famRisks * 18 - famProts * 12));

  // 3. Психоэмоциональное благополучие и аутоагрессия (1.5 Здоровье/ПАВ, 1.6 Личность, 1.7 Обучение/Травля)
  const psychoRisks = (risks["1.5_health"] || []).length + (risks["1.6_personality"] || []).length + (risks["1.7_learning"] || []).length;
  const psychoProts = (protectiveFactors["1.5_health"] || []).length + (protectiveFactors["1.6_personality"] || []).length + (protectiveFactors["1.7_learning"] || []).length;
  let psychoRaw = Math.min(100, Math.max(0, psychoRisks * 18 - psychoProts * 12));

  // Базовый расчет взвешенного индекса 0..100
  let cumulative = totalWeight > 0 ? Math.round(weightedRiskSum / totalWeight) : 0;

  // Отягощающие статусы
  if (options?.isSop) {
    cumulative = Math.min(100, cumulative + 8);
    famRaw = Math.min(100, famRaw + 15);
  }
  if (options?.isCriminalCategory) {
    cumulative = Math.min(100, cumulative + 10);
    crimRaw = Math.min(100, crimRaw + 20);
  }

  // ── УЧЕТ СПЕЦИАЛИЗИРОВАННЫХ ШКАЛ РИСКА ──────────────────────────────────────
  const criticalReasons: string[] = [];
  const spec = options?.specialized;

  // Проверка критических маркеров в форме 1.11
  const offenseRisks = risks["1.11_offense_eval"] || [];
  if (offenseRisks.includes("pyromania_fire_setting")) criticalReasons.push("Пиромания / опыт поджогов");
  if (offenseRisks.includes("violence_against_authority")) criticalReasons.push("Насилие в отношении педагогов / статусных взрослых");
  if (offenseRisks.includes("chronic_runaway_vagabondage")) criticalReasons.push("Систематические побеги / бродяжничество (>48 ч)");
  if (offenseRisks.includes("sexualized_deviance")) criticalReasons.push("Сексуализированное девиантное поведение / насилие");

  if (spec) {
    // 1. Суицидальный риск / самоповреждения (C-SSRS / NSSI)
    if (spec.suicideRisk?.enabled) {
      const sLvl = spec.suicideRisk.riskLevel;
      const sInds = spec.suicideRisk.indicators || [];
      totalRiskCount += sInds.length;

      if (sLvl === "critical") {
        cumulative = Math.max(cumulative + 25, 80);
        psychoRaw = Math.max(psychoRaw + 35, 85);
        criticalReasons.push("Критический суицидальный риск (C-SSRS)");
      } else if (sLvl === "high") {
        cumulative = Math.max(cumulative + 18, 55);
        psychoRaw = Math.max(psychoRaw + 25, 65);
      } else if (sLvl === "moderate") {
        cumulative = Math.min(100, cumulative + 10);
        psychoRaw = Math.min(100, psychoRaw + 15);
      }
      cumulative = Math.min(100, cumulative + sInds.length * 2);

      if (spec.suicideRisk.safetyPlanAgreed) {
        totalProtectiveCount += 1;
        cumulative = Math.max(0, cumulative - 5);
      }
      if (spec.suicideRisk.consultedPsychiatrist) {
        totalProtectiveCount += 1;
        cumulative = Math.max(0, cumulative - 3);
      }
    }

    // 2. Нарушения пищевого поведения (SCOFF / EAT-26)
    if (spec.eatingDisorderRisk?.enabled) {
      const eLvl = spec.eatingDisorderRisk.riskLevel;
      const eInds = spec.eatingDisorderRisk.indicators || [];
      totalRiskCount += eInds.length;

      if (eLvl === "high") {
        cumulative = Math.min(100, cumulative + 16);
        psychoRaw = Math.min(100, psychoRaw + 20);
      } else if (eLvl === "moderate") {
        cumulative = Math.min(100, cumulative + 8);
        psychoRaw = Math.min(100, psychoRaw + 10);
      }
      cumulative = Math.min(100, cumulative + eInds.length * 2);
    }

    // 3. Буллинг / травля (Olweus / Бочавер)
    if (spec.bullyingRisk?.enabled) {
      const bRole = spec.bullyingRisk.role;
      const bForms = spec.bullyingRisk.forms || [];
      totalRiskCount += bForms.length;

      if (bRole === "aggressor" || bRole === "victim") {
        const bonus = spec.bullyingRisk.intensity === "systematic" ? 16 : 10;
        cumulative = Math.min(100, cumulative + bonus);
        if (bRole === "aggressor") crimRaw = Math.min(100, crimRaw + bonus);
        if (bRole === "victim") psychoRaw = Math.min(100, psychoRaw + bonus);
      } else if (bRole === "defender") {
        totalProtectiveCount += 1;
        cumulative = Math.max(0, cumulative - 5);
      }
      cumulative = Math.min(100, cumulative + bForms.length * 2);
    }

    // 4. Школьная тревожность и отказ от школы (PHQ-A / GAD-7 / SRAS-R)
    if (spec.schoolAnxietyRisk?.enabled) {
      const aLvl = spec.schoolAnxietyRisk.riskLevel;
      const aInds = spec.schoolAnxietyRisk.indicators || [];
      totalRiskCount += aInds.length;

      if (aLvl === "severe") {
        cumulative = Math.min(100, cumulative + 15);
        psychoRaw = Math.min(100, psychoRaw + 20);
      } else if (aLvl === "moderate") {
        cumulative = Math.min(100, cumulative + 8);
        psychoRaw = Math.min(100, psychoRaw + 10);
      }
      cumulative = Math.min(100, cumulative + aInds.length * 2);
    }

    // 5. Экранная и интернет-зависимость (IAT / CIAS)
    if (spec.gadgetAddictionRisk?.enabled) {
      const gHours = spec.gadgetAddictionRisk.screenTimeHoursDaily || 0;
      const gInds = spec.gadgetAddictionRisk.indicators || [];
      totalRiskCount += gInds.length;

      if (gHours >= 8) cumulative = Math.min(100, cumulative + 10);
      else if (gHours >= 5) cumulative = Math.min(100, cumulative + 5);

      if (spec.gadgetAddictionRisk.sleepDisruption) cumulative = Math.min(100, cumulative + 4);
      cumulative = Math.min(100, cumulative + gInds.length * 2);
    }

    // 6. Самовольные уходы и бродяжничество (Runaway Risk)
    if (spec.runawayRisk?.enabled) {
      const rFreq = spec.runawayRisk.frequency;
      const rInds = spec.runawayRisk.indicators || [];
      totalRiskCount += rInds.length;

      if (rFreq === "systemic") {
        cumulative = Math.max(cumulative + 20, 60);
        crimRaw = Math.max(crimRaw + 25, 60);
      } else if (rFreq === "repeated") {
        cumulative = Math.min(100, cumulative + 12);
        crimRaw = Math.min(100, crimRaw + 15);
      } else if (rFreq === "single") {
        cumulative = Math.min(100, cumulative + 6);
      }
      cumulative = Math.min(100, cumulative + rInds.length * 2);
    }

    // 7. Семейное неблагополучие и насилие (ACEs / СОП)
    if (spec.familyViolenceRisk?.enabled) {
      const fInds = spec.familyViolenceRisk.indicators || [];
      totalRiskCount += fInds.length;

      if (fInds.length > 0) {
        cumulative = Math.max(cumulative + 18, 55);
        famRaw = Math.max(famRaw + 25, 60);
      }
      if (fInds.some((i) => i.includes("physical") || i.includes("sexual") || i.includes("насилие"))) {
        criticalReasons.push("Маркеры жестокого обращения в семье (ACEs)");
      }
      if (spec.familyViolenceRisk.cpsInvolved) {
        totalProtectiveCount += 1;
      }
    }

    // 8. Деструктивные группы и киберугрозы (CSTAG)
    if (spec.cyberRisk?.enabled) {
      const cLvl = spec.cyberRisk.riskLevel;
      const cInds = spec.cyberRisk.indicators || [];
      totalRiskCount += cInds.length;

      if (cLvl === "high") {
        cumulative = Math.max(cumulative + 25, 76);
        crimRaw = Math.max(crimRaw + 30, 80);
        criticalReasons.push("Высокая угроза вовлечения / деструктивных действий (CSTAG)");
      } else if (cLvl === "moderate") {
        cumulative = Math.min(100, cumulative + 12);
        crimRaw = Math.min(100, crimRaw + 15);
      }
      cumulative = Math.min(100, cumulative + cInds.length * 3);
    }

    // 9. Антинаркотический блок (ПАВ)
    if (spec.narcology?.enabled) {
      const substance = spec.narcology.substance;
      const dispStatus = spec.narcology.dispensaryStatus;
      const cleanTests = spec.narcology.cleanTestsCount || 0;

      if (substance && substance !== "none") {
        totalRiskCount += 1;
        cumulative = Math.min(100, cumulative + 16);
        crimRaw = Math.min(100, crimRaw + 18);
        psychoRaw = Math.min(100, psychoRaw + 15);
      }
      if (dispStatus === "registered" || dispStatus === "evading") {
        totalRiskCount += 1;
        cumulative = Math.min(100, cumulative + 10);
      }
      if (cleanTests >= 2) {
        totalProtectiveCount += 2;
        cumulative = Math.max(0, cumulative - 12);
        crimRaw = Math.max(0, crimRaw - 15);
      }
    }
  }

  // Вспомогательный хелпер классификации уровня по сырому баллу
  const classify = (score: number): { level: "norm" | "moderate" | "elevated" | "critical"; label: string; color: string } => {
    if (score > 75) return { level: "critical", label: "Критический", color: "#ef4444" };
    if (score > 50) return { level: "elevated", label: "Повышенный", color: "#f97316" };
    if (score > 25) return { level: "moderate", label: "Умеренный", color: "#f59e0b" };
    return { level: "norm", label: "Норма", color: "#10b981" };
  };

  const crimClass = classify(crimRaw);
  const famClass = classify(famRaw);
  const psychoClass = classify(psychoRaw);

  const subscales = {
    criminogenic: {
      name: "🎯 Криминогенный / делинквентный риск",
      category: "criminogenic" as const,
      riskCount: crimRisks,
      protectiveCount: crimProts,
      rawScore: crimRaw,
      level: crimClass.level,
      levelLabel: crimClass.label,
      color: crimClass.color,
      targetAgency: "КДНиЗП, ОДН МВД, УИИ (ст. 158, 228, хулиганство, делинквентные установки)",
    },
    familyEnvironment: {
      name: "🏠 Семейно-средовое неблагополучие",
      category: "family_environment" as const,
      riskCount: famRisks,
      protectiveCount: famProts,
      rawScore: famRaw,
      level: famClass.level,
      levelLabel: famClass.label,
      color: famClass.color,
      targetAgency: "Органы опеки, соцзащита, ЦСПСД (жилищные условия, надзор, бедность)",
    },
    psychoemotional: {
      name: "🧠 Психоэмоциональное благополучие и аутоагрессия",
      category: "psychoemotional" as const,
      riskCount: psychoRisks,
      protectiveCount: psychoProts,
      rawScore: psychoRaw,
      level: psychoClass.level,
      levelLabel: psychoClass.label,
      color: psychoClass.color,
      targetAgency: "ППМС-центры, психологи ОО, наркология, ПНД (тревога, суицид, ПАВ, травля)",
    },
  };

  // Общий уровень
  let overallLevel: "norm" | "moderate" | "elevated" | "critical" = "norm";
  let levelLabel = "🟢 Зона нормы / Минимальный риск";
  let normBadgeClass = "badge-norm";
  let normExplanation =
    "Защитные ресурсы преобладают над факторами риска. Показаны базовые меры первичной профилактики и организация развивающего досуга.";

  if (cumulative > 75 || criticalReasons.length > 0) {
    overallLevel = "critical";
    levelLabel = "🔴 Критический риск рецидива / Кризис";
    normBadgeClass = "badge-critical";
    normExplanation =
      "Высокая степень дезадаптации или критические маркеры безопасности. Требуется интенсивный межведомственный контроль КДНиЗП, плотное кураторство специалистов службы сопровождения и антикризисный план.";
  } else if (cumulative > 50) {
    overallLevel = "elevated";
    levelLabel = "🟠 Повышенный риск (СОП / Учет)";
    normBadgeClass = "badge-elevated";
    normExplanation =
      "Выраженный дисбаланс факторов риска. Необходима реализация регламентного полугодового маршрута ИПР специалистами службы сопровождения во взаимодействии со школой и ОДН.";
  } else if (cumulative > 25) {
    overallLevel = "moderate";
    levelLabel = "🟡 Умеренный риск (Группа внимания)";
    normBadgeClass = "badge-moderate";
    normExplanation =
      "Отдельные признаки уязвимости (прогулы, деструктивный досуг или конфликты). Рекомендована вторичная профилактика, психолого-педагогическая поддержка и профориентация.";
  }

  // Применение профессиональной коррекции (Override специалиста)
  let effectiveIndex = cumulative;
  if (options?.professionalOverride?.enabled && options.professionalOverride.overriddenLevel) {
    const oLevel = options.professionalOverride.overriddenLevel;
    overallLevel = oLevel;
    if (oLevel === "critical") {
      levelLabel = isIntl ? "🔴 Critical Risk (Specialist Override)" : "🔴 Критический риск (Скорректировано специалистом)";
      normBadgeClass = "badge-critical";
      effectiveIndex = Math.max(80, cumulative);
    } else if (oLevel === "elevated") {
      levelLabel = isIntl ? "🟠 Elevated Risk (Specialist Override)" : "🟠 Повышенный риск (Скорректировано специалистом)";
      normBadgeClass = "badge-elevated";
      effectiveIndex = Math.max(55, Math.min(75, cumulative));
    } else if (oLevel === "moderate") {
      levelLabel = isIntl ? "🟡 Moderate Risk (Specialist Override)" : "🟡 Умеренный риск (Скорректировано специалистом)";
      normBadgeClass = "badge-moderate";
      effectiveIndex = Math.max(30, Math.min(50, cumulative));
    } else {
      levelLabel = isIntl ? "🟢 Normal Zone (Specialist Override)" : "🟢 Зона нормы (Скорректировано специалистом)";
      normBadgeClass = "badge-norm";
      effectiveIndex = Math.min(20, cumulative);
    }
  }

  return {
    totalRiskCount,
    totalProtectiveCount,
    cumulativeIndex: cumulative,
    effectiveIndex,
    overallLevel,
    levelLabel,
    normBadgeClass,
    normExplanation,
    sphereScores,
    subscales,
    criticalAlert: {
      active: criticalReasons.length > 0,
      reasons: criticalReasons,
    },
  };
}

/* ───────────────────────────────────────────────────────────────────────────
   АВТОМАТИЧЕСКАЯ ГЕНЕРАЦИЯ ПОЛУГОДОВОГО ПРОФИЛАКТИЧЕСКОГО МАРШРУТА
   С ПОЛНЫМ ОБОСНОВАНИЕМ МЕРОПРИЯТИЙ (3 ФАЗЫ, 6 МЕСЯЦЕВ)
   ─────────────────────────────────────────────────────────────────────────── */

export interface GeneratedRouteAction {
  id: string;
  category: string;
  actionName: string;
  plannedDate: string;
  actualDate?: string;
  executor: string;
  notes: string;
}

export function generateSixMonthPreventionRoute(params: {
  adolescentName?: string;
  articles?: string;
  risks?: Record<string, string[]>;
  protectiveFactors?: Record<string, string[]>;
}): GeneratedRouteAction[] {
  const name = params.adolescentName || "Подросток";
  const art = params.articles || "";
  const now = new Date();

  const addDays = (d: Date, days: number): string => {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + days);
    return copy.toISOString().slice(0, 10);
  };

  const actions: GeneratedRouteAction[] = [];

  // ══════════════════════════════════════════════════════════════════════════
  // ФАЗА I (Месяцы 1–2): Встреча, первичная стабилизация и купирование острых рисков
  // ══════════════════════════════════════════════════════════════════════════
  actions.push({
    id: crypto.randomUUID(),
    category: "2.1_family",
    actionName: "Беседа с ребенком",
    plannedDate: addDays(now, 3),
    executor: "Педагог-психолог службы сопровождения / ППМС-центра",
    notes: `Обоснование: Первичный контакт, снятие защитной агрессии, диагностика ведущих мотивов и факторов риска подростка (${name}).`,
  });

  actions.push({
    id: crypto.randomUUID(),
    category: "2.1_family",
    actionName: "Беседа с родителями",
    plannedDate: addDays(now, 7),
    executor: "Специалист по социальной работе службы сопровождения",
    notes: "Обоснование: Оценка воспитательного ресурса семьи, готовности родителей к сотрудничеству и согласованию единых правил.",
  });

  if (art) {
    actions.push({
      id: crypto.randomUUID(),
      category: "2.2_legal",
      actionName: "Индивидуальная консультация юриста",
      plannedDate: addDays(now, 14),
      executor: "Юрисконсульт службы правовой помощи / центра профилактики",
      notes: `Обоснование: Правовое информирование по квалификации деяния (${art}), разъяснение неотвратимости ответственности при рецидиве и условий снятия с учета.`,
    });
  }

  actions.push({
    id: crypto.randomUUID(),
    category: "2.3_education",
    actionName: "Посещение ОО с целью контроля / бесед с преподавателями",
    plannedDate: addDays(now, 21),
    executor: "Социальный педагог / куратор случая",
    notes: "Обоснование: Согласование с администрацией школы графика ликвидации задолженностей и ежедневного контроля посещаемости.",
  });

  actions.push({
    id: crypto.randomUUID(),
    category: "2.1_family",
    actionName: "Семейный совет",
    plannedDate: addDays(now, 35),
    executor: "Медиатор службы примирения / медиации",
    notes: "Обоснование: Медиативная встреча для снижения внутрисемейной конфликтности и выработки бесконфликтного регламента общения.",
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ФАЗА II (Месяцы 3–4): Формирование замещающих паттернов и социальные пробы
  // ══════════════════════════════════════════════════════════════════════════
  actions.push({
    id: crypto.randomUUID(),
    category: "2.6_leisure",
    actionName: "Содействие в организации системного досуга",
    plannedDate: addDays(now, 65),
    executor: "Специалист по работе с молодежью / досуговый куратор",
    notes: "Обоснование: Переключение с деструктивной уличной компании на конструктивную деятельность (ПМК, автоклуб, единоборства или техническое творчество).",
  });

  actions.push({
    id: crypto.randomUUID(),
    category: "2.4_employment",
    actionName: "Содействие в профориентации через АЗН",
    plannedDate: addDays(now, 80),
    executor: "Специалист Агентства занятости населения (АЗН)",
    notes: "Обоснование: Прохождение профтестирования, выбор колледжа или организация официального временного трудоустройства в каникулярный период.",
  });

  actions.push({
    id: crypto.randomUUID(),
    category: "2.6_leisure",
    actionName: "Профилактические интерактивные тренинги и мастер-классы",
    plannedDate: addDays(now, 95),
    executor: "Специалисты службы профилактики и психологической помощи",
    notes: "Обоснование: Включение в интерактивные тренинги развития эмоционального интеллекта, навыков ненасильственного общения и сопротивления давлению группы.",
  });

  actions.push({
    id: crypto.randomUUID(),
    category: "2.8_prevention_links",
    actionName: "Взаимодействие с ОДН",
    plannedDate: addDays(now, 110),
    executor: "Инспектор ОДН УМВД / куратор случая",
    notes: "Обоснование: Межведомственная сверка данных о поведении подростка по месту жительства и учебы, отсутствие повторных приводов.",
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ФАЗА III (Месяцы 5–6): Закрепление устойчивой позитивной траектории
  // ══════════════════════════════════════════════════════════════════════════
  actions.push({
    id: crypto.randomUUID(),
    category: "2.3_education",
    actionName: "Контроль образовательного процесса (сдача задолженностей)",
    plannedDate: addDays(now, 135),
    executor: "Классный руководитель ОО / социальный педагог",
    notes: "Обоснование: Фиксация академической успеваемости за отчетный период, подтверждение отсутствия необоснованных пропусков занятий.",
  });

  actions.push({
    id: crypto.randomUUID(),
    category: "2.1_family",
    actionName: "Беседа с ребенком",
    plannedDate: addDays(now, 150),
    executor: "Педагог-психолог службы сопровождения",
    notes: "Обоснование: Контрольная психодиагностика динамики факторов риска, закрепление навыков саморегуляции и ценности законопослушного поведения.",
  });

  actions.push({
    id: crypto.randomUUID(),
    category: "2.2_legal",
    actionName: "Участие в заседаниях КДНиЗП, ЭС, МРГ",
    plannedDate: addDays(now, 170),
    executor: "Куратор случая / руководитель службы сопровождения",
    notes: "Обоснование: Представление итогового отчета (Форма № 3) на заседании КДНиЗП с ходатайством о снятии с учета в связи с успешным выполнением ИПР.",
  });

  return actions;
}

