/**
 * User-facing copy: registry security, backup, password managers.
 * Edition-aware: RU vs intl; org-aware: school vs commercial (IDA).
 */
import { registryProductName } from "./registry_branding.ts";
import { getTerminalEdition, type TerminalEditionId } from "../lib/terminal_edition.ts";

export interface PasswordManagerOption {
  id: string;
  name: string;
  url: string;
  tags: string[];
  description: string;
  howTo: string;
}

export interface RegistryGuideSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface RegistrySecurityGuideContent {
  edition: TerminalEditionId;
  commercial: boolean;
  productName: string;
  title: string;
  intro: string;
  pmIntegratorNote: string;
  sections: RegistryGuideSection[];
  passwordManagers: PasswordManagerOption[];
  backupSteps: string[];
  legalNote: string;
  supportFaq: { q: string; a: string }[];
}

const TAG_LABELS: Record<string, string> = {
  corporate: "для организации",
  "self-hosted": "на своём сервере",
  offline: "без облака",
  "ru-vendor": "российский вендор",
  free: "бесплатно",
  international: "международный",
};

export function tagLabel(tag: string): string {
  return TAG_LABELS[tag] || tag;
}

const INTL_PASSWORD_MANAGERS: PasswordManagerOption[] = [
  {
    id: "bitwarden",
    name: "Bitwarden",
    url: "https://bitwarden.com/",
    tags: ["corporate", "international", "self-hosted"],
    description:
      "Corporate vault with audit log. Self-hosted option for schools and clinics that want keys on their own infrastructure.",
    howTo:
      "Create a Secure Note named «Prevention Terminal — registry recovery key». Paste the recovery key only — not the daily registry password in the same note as the backup file path.",
  },
  {
    id: "1password",
    name: "1Password Business",
    url: "https://1password.com/",
    tags: ["corporate", "international"],
    description:
      "Team vaults, emergency access for a deputy director, strong 2FA. Common in international NGOs and private clinics.",
    howTo:
      "Use a dedicated vault «Prevention Registry». Store recovery key in a Secure Note; enable Emergency Access for a second responsible person.",
  },
  {
    id: "keepass",
    name: "KeePass / KeePassXC",
    url: "https://keepassxc.org/",
    tags: ["offline", "free"],
    description:
      "Offline database file — nothing leaves your PC unless you copy the file yourself. Good when cloud password managers are not allowed.",
    howTo:
      "Create entry «Prevention registry recovery». Keep the .kdbx on an encrypted USB or internal file share; backup the database separately from the key.",
  },
];

function ruPasswordManagers(commercial: boolean): PasswordManagerOption[] {
  const brand = registryProductName(commercial);
  return [
    {
      id: "passwork",
      name: "Passwork",
      url: "https://passwork.ru/",
      tags: ["corporate", "ru-vendor", "self-hosted"],
      description:
        "Корпоративный менеджер паролей российской компании. Можно развернуть на сервере организации в РФ — удобно при требованиях 152-ФЗ и политике «данные не уходят за контур».",
      howTo: commercial
        ? `Создайте сейф «${brand} — реестр». В карточке «Заметка» сохраните ключ восстановления. Доступ — руководителю центра и ответственному сотруднику, не всем специалистам.`
        : `Создайте сейф «${brand} — реестр». В карточке «Заметка» сохраните ключ восстановления. Доступ — директору и одному заместителю, не всем сотрудникам.`,
    },
    {
      id: "kaspersky-pm",
      name: "Kaspersky Password Manager",
      url: "https://www.kaspersky.ru/password-manager",
      tags: ["ru-vendor", "corporate"],
      description:
        "Менеджер паролей российского вендора. Для организаций уточните корпоративную лицензию у IT-отдела.",
      howTo: `Запись «Ключ восстановления реестра ${brand}». Включите 2FA на аккаунте. Не ставьте на личные телефоны без решения организации.`,
    },
    {
      id: "keepass",
      name: "KeePass / KeePassXC",
      url: "https://keepassxc.org/",
      tags: ["offline", "free"],
      description:
        "Файл базы остаётся у вас — флешка, NAS или папка на сервере организации. Облако не обязательно; персональные данные не уходят на зарубежные сервисы.",
      howTo: `Запись «${brand} — ключ реестра». Храните .kdbx на защищённом носителе; копию базы делайте отдельно от бумажного ключа.`,
    },
    {
      id: "bitwarden-selfhost",
      name: "Bitwarden (свой сервер)",
      url: "https://bitwarden.com/help/install-on-premise/",
      tags: ["corporate", "self-hosted", "international"],
      description:
        "Международный продукт с установкой на ваш сервер в РФ. Подходит, если IT уже разворачивает on-prem и нужен журнал доступа.",
      howTo: "Secure Note в корпоративном сейфе. Ключ восстановления — только для роли «администратор реестра».",
    },
  ];
}

function ruWhoNeedsSection(commercial: boolean): RegistryGuideSection {
  if (commercial) {
    return {
      id: "who-needs-this",
      title: "Кому нужна эта инструкция",
      paragraphs: [
        "Повышенная секретность — если вы психолог центра и сами включили реестр с ФИО.",
        "Руководитель центра: дашборд со сводками, реестра нет — эта инструкция не для вас.",
      ],
      bullets: [
        "Специалист без реестра — обычный пароль профиля, без vault.",
        "Специалист с реестром — пароль реестра + ключ восстановления + резервная копия.",
      ],
    };
  }
  return {
    id: "who-needs-this",
    title: "Кому нужна эта инструкция",
    paragraphs: [
      "Повышенная секретность — только если вы школьный психолог или соцпедагог и сами включили реестр с ФИО.",
      "Директор и завуч: дашборд со сводками, реестра нет — эта инструкция не для вас.",
      "Обычный педагог (lite): бесплатно — ИИ-бот «просто спросить» и планы групповых занятий, реестра нет.",
    ],
    bullets: [
      "Специалист без реестра — обычный пароль профиля, без vault.",
      "Специалист с реестром — пароль реестра + ключ восстановления + резервная копия.",
    ],
  };
}

function ruSections(commercial: boolean): RegistryGuideSection[] {
  const brand = registryProductName(commercial);
  const orgWord = commercial ? "центра" : "школы";
  return [
    ruWhoNeedsSection(commercial),
    {
      id: "what-is-registry",
      title: "Что такое реестр (если вы его создали)",
      paragraphs: [
        commercial
          ? "Реестр — список карточек с ФИО клиентов и формальными полями (пол, возраст, дата рождения). Жалобы, приём и протоколы ведёте в разделе «Консультации»."
          : "Реестр — карточки с ФИО учеников и формальными полями. Жалобы, приём и протоколы — в разделе «Консультации».",
        "Он не обязателен: можно вести кейсы на маркерах без имён.",
        "Реестр хранится только на вашем мастер-устройстве.",
      ],
    },
    {
      id: "master-device",
      title: "Мастер-устройство реестра (не компьютер руководителя)",
      paragraphs: [
        "Мастер — компьютер специалиста, который создал реестр (обычно рабочее место психолога).",
        commercial
          ? "Руководитель центра видит только сводки в дашборде — без имён и без vault."
          : "Директор видит только rollup в своём дашборде — без имён и без vault.",
      ],
      bullets: ["На главном компьютере: полный реестр и резервная копия."],
    },
    {
      id: "passwords",
      title: "Два секрета: пароль реестра и ключ восстановления",
      paragraphs: [
        "Пароль реестра — для ежедневного входа на мастер-устройстве (открыть журнал с именами).",
        "Ключ восстановления — длинный код (или 24 слова). Нужен, если забыли пароль или сломался компьютер — чтобы открыть резервную копию.",
        `${brand} не хранит ни пароль, ни ключ на своих серверах. Без них и без файла резервной копии реестр восстановить нельзя.`,
      ],
      bullets: [
        "Не храните пароль и ключ в одном незащищённом файле на рабочем столе.",
        "Не отправляйте ключ в мессенджеры и общие чаты.",
        commercial
          ? "Для центров: руководитель и ответственный сотрудник — два разных носителя."
          : "Для организаций: директор + зам — два разных носителя.",
      ],
    },
    {
      id: "backup",
      title: "Что такое резервная копия и зачем она нужна",
      paragraphs: [
        "Резервная копия — один файл со всей копией реестра: фамилии и формальные поля карточек. Это запасной вариант, если сломался компьютер, его украли или переустановили Windows.",
        `Файл специально «заперт»: прочитать его без ключа восстановления нельзя — даже сотрудники ${brand} не могут. Поэтому файл копии и ключ хранят в разных местах: украли одно — второе всё равно защищает.`,
      ],
      bullets: [
        "Как создать: на главном компьютере «Настройки → Реестр → Создать резервную копию». Программа соберёт записи в один файл (имя обычно заканчивается на .vault.enc).",
        `Куда положить файл: флешка в сейфе, папка на диске ${orgWord}, облако организации (Яндекс.Диск, OneDrive) — по правилам вашей организации. В облако ${brand} файл не попадает.`,
        "Как восстановить: на новом главном компьютере установить терминал → «Восстановить из резервной копии» → указать файл с флешки или диска + ввести ключ восстановления.",
        "Раз в месяц проверяйте, что файл на месте и открывается ключом. После многих новых записей делайте свежую копию.",
      ],
    },
    {
      id: "152fz",
      title: "152-ФЗ и ответственность организации",
      paragraphs: [
        `Оператор персональных данных — ваш ${commercial ? "центр" : "школа"}, не ${brand}.`,
        "Реестр с ФИО не передаётся в наше облако. В облако уходят только обезличенные счётчики.",
        "Место хранения файла резервной копии и менеджера паролей выбирает организация с учётом локальных актов.",
      ],
    },
  ];
}

const SHARED_SECTIONS_EN: RegistryGuideSection[] = [
  {
    id: "what-is-registry",
    title: "What the registry is",
    paragraphs: [
      "Prevention Terminal is your daily workspace: consultations, documents, AI, leads, cloud rollups without names.",
      "The registry is a card list with formal fields only. Reception notes and complaints live in Consultations.",
      "It lives only on the master device, encrypted. Prevention cannot read it or reset your password.",
    ],
  },
  {
    id: "master-device",
    title: "Master device (not the manager PC)",
    paragraphs: [
      "The first PC where the specialist created the registry becomes the master device.",
      "The manager dashboard shows rollups only — no names, no vault.",
    ],
    bullets: ["Master: registry cards and backups."],
  },
  {
    id: "passwords",
    title: "Registry password and recovery key",
    paragraphs: [
      "Registry password — daily unlock.",
      "Recovery key — opens backup if PC dies or password is forgotten.",
      "We store neither.",
    ],
  },
  {
    id: "backup",
    title: "Backup when hardware fails",
    paragraphs: [
      "Export encrypted .vault.enc to USB or org cloud.",
      "Backup is useless without the recovery key.",
    ],
  },
];

export function getRegistrySecurityGuide(commercial = false): RegistrySecurityGuideContent {
  const edition = getTerminalEdition();
  const isRu = edition === "ru";
  const productName = registryProductName(commercial);

  return {
    edition,
    commercial,
    productName,
    title: isRu ? "Реестр, резервная копия и безопасное хранение ключей" : "Registry, backup, and safe key storage",
    intro: isRu
      ? commercial
        ? "Только для психолога центра, который включает реестр с ФИО. Руководитель центра этот режим не использует."
        : "Только для школьного психолога или соцпедагога, который включает реестр с ФИО. Руководитель организации этот режим не использует."
      : "For psychologists who enable the named registry only. Center managers do not use this flow.",
    pmIntegratorNote: isRu
      ? `${productName} не подключается к этим сервисам автоматически — вы сами создаёте запись и вставляете ключ. Ссылки ведут на официальные сайты.`
      : "Prevention does not auto-integrate — create a secure note and paste the key yourself. Official vendor links.",
    sections: isRu ? ruSections(commercial) : SHARED_SECTIONS_EN,
    passwordManagers: isRu ? ruPasswordManagers(commercial) : INTL_PASSWORD_MANAGERS,
    backupSteps: isRu
      ? [
          "На главном компьютере: «Настройки → Реестр → Создать резервную копию».",
          "Сохраните файл (окончание .vault.enc) на флешку или в хранилище организации.",
          "Сохраните ключ восстановления в менеджере паролей (см. ниже) или в сейфе на бумаге — отдельно от файла копии.",
          "Раз в месяц: убедитесь, что файл на месте и открывается ключом.",
          commercial
            ? "При смене ответственного — передайте доступ к сейфу и обновите резервную копию."
            : "При смене руководителя — передайте доступ к сейфу и обновите резервную копию.",
        ]
      : [
          "On master: Settings → Registry → Create backup (next update).",
          "Save .vault.enc to USB or org storage.",
          "Store recovery key in a password manager (below) or paper in a safe.",
          "Monthly: verify backup opens with the key.",
          "Leadership change: transfer vault access and refresh backup.",
        ],
    legalNote: isRu
      ? `${productName} не является оператором персональных данных в реестре. Выбор облака для резервной копии и менеджера паролей — решение вашей организации. Мы не получаем копию файла и не интегрируемся с перечисленными сервисами автоматически.`
      : "Prevention is not the data controller for registry PII. Cloud and password-manager choice is your organization's decision.",
    supportFaq: isRu
      ? [
          {
            q: commercial ? "Руководителю центра нужен пароль реестра?" : "Директору нужен пароль реестра?",
            a: "Нет. У дашборда только сводки, реестра нет.",
          },
          { q: "Можно восстановить пароль через поддержку?", a: "Нет. Zero-knowledge — ключ только у вас." },
          {
            q: "Где вести приём и жалобы?",
            a: "В разделе «Консультации». В реестре — только карточки с формальными полями.",
          },
          {
            q: "Где хранить ключ восстановления?",
            a: "В корпоративном менеджере паролей или сейфе организации — отдельно от файла резервной копии.",
          },
        ]
      : [
          { q: "Can support reset my password?", a: "No. Zero-knowledge." },
          { q: "No IT — where to put the key?", a: "KeePass on USB in a safe + paper with a deputy." },
          {
            q: "Where are reception notes?",
            a: "In Consultations. The registry is formal card fields only.",
          },
        ],
  };
}
