/**
 * Short step-by-step copy for registry setup wizard (journal workspace).
 * Full reference: registry_security.ts / TERMINAL_REGISTRY_USER_GUIDE.ru.md
 */
import { applyRegistryBrand } from "./registry_branding.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";

export interface RegistryWizardStep {
  id: string;
  title: string;
  lead: string;
  bullets: string[];
  confirmLabel: string;
  tip?: string;
}

export interface RegistryKeyStorageOption {
  id: string;
  label: string;
  hint: string;
}

export interface RegistryWizardContent {
  introTitle: string;
  introLead: string;
  withoutRegistry: string[];
  withRegistry: string[];
  dismissLabel: string;
  continueLabel: string;
  steps: RegistryWizardStep[];
  keyStorageOptions: RegistryKeyStorageOption[];
  createTitle: string;
  createLead: string;
  createConfirmLabel: string;
  createButtonLabel: string;
  fullGuideLabel: string;
  backLabel: string;
  nextLabel: string;
  hideGuideLabel: string;
  activeReminderLead: string;
  stepAckRequiredHint: string;
  keyStorageRequiredHint: string;
  createAckRequiredHint: string;
}

const RU: RegistryWizardContent = {
  introTitle: "Нужен ли реестр с именами?",
  introLead:
    "Консультации можно вести и без него — на условных обозначениях, без ФИО. Реестр подключают, когда нужен приём с полными именами, телефонами и заявками с сайта.",
  withoutRegistry: [
    "Консультации и кейсы — без полных имён",
    "ИИ и документы — как обычно",
    "Руководитель видит только обезличенные сводки",
  ],
  withRegistry: [
    "Карточки с ФИО и формальными полями; приём и жалобы — в «Консультациях»",
    "Данные только на этом компьютере — не у нас в облаке",
    "Ключ восстановления + резервная копия .vault.enc в разделе «Реестр»",
  ],
  dismissLabel: "Пока не нужен",
  continueLabel: "Настроить реестр",
  steps: [
    {
      id: "master-pc",
      title: "Шаг 1. Этот компьютер — главный",
      lead: "Реестр создаётся на одном главном компьютере — обычно в кабинете психолога. С него делают резервную копию и выдают доступ помощникам.",
      bullets: [
        "Не ставьте реестр на общий компьютер в учительской или на компьютер директора.",
        "Если смените компьютер — понадобится файл резервной копии и ключ восстановления (об этом на шагах 2–3).",
      ],
      confirmLabel: "Да, реестр будет на этом компьютере",
    },
    {
      id: "two-secrets",
      title: "Шаг 2. Два секрета: пароль и ключ",
      lead: "Prevention не хранит их на серверах (ни Supabase, ни cloud.ru) и не сможет прислать вам пароль по почте.",
      bullets: [
        "Мастер-пароль — при входе в терминал; им защищена локальная база на этом компьютере.",
        "Ключ восстановления — длинный код для файла .vault.enc. Сгенерируете в «Реестр» → «Настроить ключ восстановления».",
        "Пароль и ключ — разные вещи. Ключ храните отдельно от файла копии.",
      ],
      confirmLabel: "Понятно: мастер-пароль на вход, ключ — для .vault.enc",
      tip: "Не отправляйте пароль и ключ в мессенджеры.",
    },
    {
      id: "what-is-backup",
      title: "Шаг 3. Что такое резервная копия",
      lead: "Файл .vault.enc — полная зашифрованная копия реестра. Без ключа из шага 2 не открыть.",
      bullets: [
        "Создание: «Реестр» → ключ → «Создать .vault.enc».",
        "Excel — для CRM; .vault.enc — для переноса на другой ПК.",
        "Восстановление: «Восстановить из копии» + тот же ключ.",
        "Файл храните на флешке или в облаке организации.",
      ],
      confirmLabel: "Понятно: .vault.enc — запасной сейф с реестром",
    },
    {
      id: "save-key",
      title: "Шаг 4. Где хранить ключ",
      lead: "Решите до или сразу после настройки ключа в реестре.",
      bullets: [
        "Менеджер паролей, KeePass на флешке или запечатанный конверт у заместителя.",
        "Ключ — отдельно от файла .vault.enc.",
      ],
      confirmLabel: "Выбрал(а) способ хранения ключа",
    },
    {
      id: "backup-plan",
      title: "Шаг 5. План резервной копии",
      lead: "После настройки ключа — первая копия, затем раз в месяц.",
      bullets: [
        "Сразу после настройки ключа создайте первый .vault.enc.",
        "Раз в месяц: «Проверить копию» в реестре.",
        "Для CRM — Excel; для смены компьютера — .vault.enc.",
      ],
      confirmLabel: "Запомнил(а): файл копии и ключ — в разных местах",
    },
  ],
  keyStorageOptions: [
    { id: "pm", label: "Менеджер паролей организации", hint: "Passwork, Kaspersky PM, Bitwarden — отдельная заметка «Ключ реестра»." },
    { id: "keepass", label: "KeePass на флешке / сервере школы", hint: "Без облака; файл .kdbx в сейфе." },
    { id: "paper", label: "Бумага в сейфе + второй человек", hint: "Запечатанный конверт у директора или зама." },
  ],
  createTitle: "Шаг 6. Создать реестр",
  createLead:
    "После нажатия кнопки терминал включит карточки реестра с ФИО на этом устройстве. Приём, жалобы и протоколы — в разделе «Консультации».",
  createConfirmLabel:
    "Готов(а) создать реестр: понимаю ответственность за пароль, ключ и резервную копию",
  createButtonLabel: "Создать реестр",
  fullGuideLabel: "Полная инструкция (менеджеры паролей, 152-ФЗ, FAQ)",
  backLabel: "Назад",
  nextLabel: "Далее",
  hideGuideLabel: "Скрыть полную инструкцию",
  activeReminderLead:
    "Карточки реестра — ниже. Регулярно делайте «Создать .vault.enc» и храните ключ отдельно от файла.",
  stepAckRequiredHint: "Отметьте галочку с подтверждением — без неё шаг не засчитывается.",
  keyStorageRequiredHint: "Выберите, где будете хранить резервные копии.",
  createAckRequiredHint: "Подтвердите галочкой, что готовы создать реестр.",
};

const EN: RegistryWizardContent = {
  introTitle: "Do you need a named reception journal?",
  introLead:
    "Consultation journal works on markers without full names. Enable the registry only if you need reception with PII.",
  withoutRegistry: ["Cases without student names", "AI and documents as usual", "Manager sees rollups only"],
  withRegistry: ["Reception with names and phones", "Data stays on this PC only", "Password, recovery key, and backup required"],
  dismissLabel: "Not now — journal without names only",
  continueLabel: "Yes, set up registry",
  steps: [
    {
      id: "master-pc",
      title: "Step 1. This PC is the master",
      lead: "Registry lives on one master device — usually the specialist office PC.",
      bullets: ["Not a shared teacher PC or director dashboard.", "New PC needs backup file + recovery key."],
      confirmLabel: "Yes, registry will be on this computer",
    },
    {
      id: "two-secrets",
      title: "Step 2. Two secrets: password and key",
      lead: "Prevention cannot reset your password or email it to you.",
      bullets: [
        "Registry password — short; enter it daily to open the named journal on this computer.",
        "Recovery key — long code (or word list). Needed if you forget the password or the computer fails. Store it separately from the backup file — password manager, school safe, or sealed envelope (step 4) — not on this computer.",
        "Password and key are different: password for every day, key for emergencies.",
      ],
      confirmLabel: "I understand: daily password, emergency key",
    },
    {
      id: "what-is-backup",
      title: "Step 3. What a backup file is",
      lead: "A backup is one file with a full copy of your journal: names, phones, website leads. Like a school album on disk — but locked so strangers cannot read it.",
      bullets: [
        "How to create: on this master PC open Settings → Registry → Create backup. The app packs all registry entries into one protected file (name usually ends with .vault.enc).",
        "What is inside: a full copy of personal data in the registry. The file is locked — double-click cannot open it; even Prevention cannot read it without your key.",
        "How to restore: only on a new master PC — install the terminal, choose Restore from backup, pick the file from USB or school storage, and enter the recovery key from step 2.",
        "Where to keep the file: USB in a safe, school disk folder, or org cloud (per school policy). Prevention never receives this file.",
        "Why file and key live apart: stolen file without key is useless; stolen key without file cannot restore anything.",
      ],
      confirmLabel: "I understand: backup is a locked copy of the journal",
    },
    {
      id: "save-key",
      title: "Step 4. Where to store the key",
      lead: "Decide before or right after creating the registry.",
      bullets: ["Password manager, KeePass on USB, or sealed envelope with a deputy.", "Keep backup file separate from the key."],
      confirmLabel: "I chose how to store the key",
    },
    {
      id: "backup-plan",
      title: "Step 5. Backup routine",
      lead: "Create once, then keep the habit.",
      bullets: [
        "Right after creating the registry, make the first backup and copy the file to USB or org storage.",
        "Monthly: check the file is still there and opens with the key.",
        "After many new entries, make a fresh backup — the old one is incomplete.",
      ],
      confirmLabel: "I remember: file and key in different places",
    },
  ],
  keyStorageOptions: [
    { id: "pm", label: "Org password manager", hint: "Secure note «Registry recovery key»." },
    { id: "keepass", label: "KeePass on USB", hint: "Offline .kdbx in a safe." },
    { id: "paper", label: "Paper in safe + deputy", hint: "Sealed envelope for leadership." },
  ],
  createTitle: "Step 6. Create registry",
  createLead: "This enables the named reception journal on this device.",
  createConfirmLabel: "I accept responsibility for password, key, and backup",
  createButtonLabel: "Create registry",
  fullGuideLabel: "Full guide (password managers, legal, FAQ)",
  backLabel: "Back",
  nextLabel: "Next",
  hideGuideLabel: "Hide full guide",
  activeReminderLead:
    "IPR and named reception journal — per person in the list below. PII stays on this computer only; only you can read it. Store backup file and recovery key separately.",
  stepAckRequiredHint: "Check the confirmation box above to continue.",
  keyStorageRequiredHint: "Choose where you will store the recovery key.",
  createAckRequiredHint: "Confirm with the checkbox that you are ready to create the registry.",
};

export function getRegistryWizardContent(commercial = false): RegistryWizardContent {
  const base = getTerminalEdition() === "ru" ? RU : EN;
  if (!commercial || getTerminalEdition() !== "ru") return base;
  return {
    ...base,
    steps: base.steps.map((step) => ({
      ...step,
      lead: applyRegistryBrand(step.lead, true),
      bullets: step.bullets.map((b) => applyRegistryBrand(b, true)),
      tip: step.tip ? applyRegistryBrand(step.tip, true) : undefined,
      confirmLabel: applyRegistryBrand(step.confirmLabel, true),
    })),
    keyStorageOptions: base.keyStorageOptions.map((opt) =>
      opt.id === "paper"
        ? {
            ...opt,
            label: "Бумага в сейфе + второй человек",
            hint: "Запечатанный конверт у руководителя центра.",
          }
        : opt,
    ),
    createLead: applyRegistryBrand(base.createLead, true),
  };
}
