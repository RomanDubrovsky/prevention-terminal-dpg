import type { OnboardingProfileRole, OrgTypePreset, WorkspacePreset } from "../../lib/terminal_config.ts";
import { t } from "../../lib/i18n.ts";

export interface FederationCopyContext {
  orgType: OrgTypePreset;
  profileRole: OnboardingProfileRole;
  preset: WorkspacePreset;
  isManager: boolean;
  territorial: boolean;
}

export interface FederationStepIntro {
  lead: string;
  paragraphs: string[];
}

/** Пояснение для всех ролей: коды связи уходят в облако, персональные данные клиентов — нет. */
export const FEDERATION_CONNECTIVITY_NOTE = () =>
  t(
    "Чтобы связать рабочие места, нужен интернет: при сохранении настроек терминал отправляет код приглашения на сервер связи. Без сети привязка не установится — передайте код руководителю или специалисту любым удобным способом (мессенджер, почта, лично).",
    "Internet connection is required to link workspaces. When saving settings, the terminal sends the invite code to the connection server. Share the code with your manager or specialist via email, chat, or in person."
  );

export const FEDERATION_CLIENT_PD_NOTE = () =>
  t(
    "Персональные данные клиентов (ФИО, контакты, записи реестра) в облако не передаются — они остаются на вашем устройстве. В облако попадают только коды связи и обезличенные сводки (счётчики работы).",
    "Personal client data (names, contacts, registry records) is never transmitted to the cloud — it stays on your local device. Only connection codes and anonymized counts are synced."
  );

export function federationStepIntro(ctx: FederationCopyContext): FederationStepIntro {
  const { orgType, profileRole, preset, isManager, territorial } = ctx;

  if (preset === "educator_lite") {
    return {
      lead: t("Здесь настраивается сетевое окружение вашего рабочего места.", "Configure your workspace network environment."),
      paragraphs: [
        t(
          "Связь с панелью руководителя школы необязательна. Если директор прислал код — вставьте только PARENT-… от его рабочего места.",
          "Connection to the school director panel is optional. If your director provided a code, enter only the PARENT-... code from their workspace."
        ),
      ],
    };
  }

  if (preset === "specialist" && orgType === "commercial") {
    return {
      lead: t("Сетевое окружение рабочего места специалиста.", "Specialist workspace network environment."),
      paragraphs: [
        t(
          "Подключитесь к кабинету руководителя центра: вставьте его код PARENT-… или отправьте ему свой дочерний код CHILD-… (мессенджер, почта, лично).",
          "Connect to your center manager: enter their PARENT-... code or send them your CHILD-... code."
        ),
        t(
          "В поле «код руководителя» принимается только PARENT-… — не вставляйте сюда дочерние коды других специалистов.",
          "Only PARENT-... codes are accepted in the manager code field."
        ),
      ],
    };
  }

  if (preset === "specialist" && orgType === "education") {
    return {
      lead: t("Здесь настраивается сетевое окружение вашего рабочего места.", "Configure your workspace network environment."),
      paragraphs: [
        t(
          "Вы можете подключить своё рабочее место к рабочему месту непосредственного руководителя — например, директора школы: примите код от него или отправьте ему свой (мессенджер, почта, бумажная записка).",
          "You can connect your workspace to your direct manager (e.g. school principal): enter their PARENT-... code or share your CHILD-... code."
        ),
        t(
          "В поле подключения к руководителю вставляйте только код формата PARENT-… от директора вашей организации. Код органа управления (муниципалитета, региона, ведомства) сюда вставлять нельзя — уровни панелей не смешиваются.",
          "Enter only PARENT-... codes from your organization's director."
        ),
      ],
    };
  }

  if (isManager && territorial && orgType === "education") {
    return {
      lead: t("Управленческая панель на территории — без привычной «бумажной» отчётности сверху.", "Territorial management panel without manual paper reporting."),
      paragraphs: [
        t(
          "Эта система не требует раздавать приказы вниз и собирать отчёты вверх. Подотчётные организации сами подключаются к вашей панели: директор школы присылает вам свою дочернюю ссылку (CHILD-…), вы её принимаете — и агрегированные сводки по профилактической работе появляются у вас автоматически.",
          "Accountable organizations connect to your panel using CHILD-... codes. Aggregated statistical summaries update automatically."
        ),
        t(
          "Принимайте только CHILD-… от руководителей организаций. Ссылки специалистов (психологов, соцпедагогов) сюда не подходят — они работают на уровень ниже, через директора.",
          "Accept only CHILD-... codes from organization heads."
        ),
      ],
    };
  }

  if (isManager && territorial && orgType === "commercial") {
    return {
      lead: t("Панель управления сетью центров.", "Center network management panel."),
      paragraphs: [
        t(
          "Подключайте филиалы и центры по дочерним ссылкам (CHILD-…) от их руководителей. Сводные показатели собираются на вашей панели без персональных данных клиентов.",
          "Connect branches and centers using CHILD-... codes from their directors. Aggregated metrics are collected without personal client data."
        ),
      ],
    };
  }

  if (isManager && !territorial && orgType === "commercial") {
    return {
      lead: t("Сетевое окружение руководителя центра.", "Center director network environment."),
      paragraphs: [
        t(
          "Передайте родительскую ссылку (PARENT-…) специалистам — они подключат к вам обобщённые сводки без персональных данных.",
          "Share the PARENT-... code with your specialists to link their reporting without personal client data."
        ),
        t(
          "Дочерние ссылки (CHILD-…) от специалистов вставляйте в поле подключения, если они прислали их вам первыми.",
          "Enter CHILD-... codes from specialists if they sent theirs first."
        ),
      ],
    };
  }

  if (isManager && !territorial && profileRole === "director" && orgType === "education") {
    return {
      lead: t("Сетевое окружение руководителя организации.", "Organization director network environment."),
      paragraphs: [
        t(
          "Ваше сетевое окружение состоит из связей между подчинёнными специалистами и вышестоящим уровнем управления.",
          "Your network connects subordinate specialists and upstream coordinators."
        ),
        t(
          "Передайте специалистам родительскую ссылку (PARENT-…). Дочерние ссылки (CHILD-…) от них вставляйте в поле подключения специалиста.",
          "Share the PARENT-... code with your specialists. Enter CHILD-... codes from specialists if provided."
        ),
      ],
    };
  }

  // Fallback for manager presets
  return {
    lead: t("Здесь настраивается сетевое окружение вашего рабочего места.", "Configure your workspace network environment."),
    paragraphs: [
      t(
        "Связи строятся по ссылкам PARENT-… (от руководителя к подчинённому) и CHILD-… (от подчинённого к руководителю). Не смешивайте типы ссылок в полях ввода.",
        "Connections use PARENT-... and CHILD-... codes. Do not mix link types in input fields."
      ),
    ],
  };
}
