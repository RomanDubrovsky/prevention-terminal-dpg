import { t } from "../lib/i18n.ts";

/** Shared UX copy: journal of plans with editable rows (free) + optional AI fill. */

export const PLAN_JOURNAL_INTRO = t(
  "Журнал планов групповых занятий и циклов. В каждом плане — таблица строк (мероприятия, этапы, сроки): добавляйте их вручную бесплатно или подставляйте из текста, сгенерированного с ИИ, затем сохраняйте и выгружайте в Word.",
  "Journal of plans for group sessions and cycles. Each plan has a row table (activities, stages, deadlines): add them manually for free or insert from text generated with AI, then save and export to Word.",
);

export const PLAN_JOURNAL_EMPTY = t(
  "Пока нет планов. Создайте первый — укажите название и заполните таблицу строк.",
  "No plans yet. Create the first one — specify a name and fill out the row table.",
);

export const PLAN_ROWS_FREE_HINT = t(
  "Строки можно добавлять, менять и удалять вручную — подписка ИИ не нужна.",
  "Rows can be added, modified, and deleted manually — no AI subscription required.",
);

export const PLAN_AI_PATH_HINT = t(
  "Или сгенерируйте текст плана с ИИ (по подписке), сохраните в карточку и нажмите «Заполнить из ИИ-плана».",
  "Or generate the plan text with AI (via subscription), save to card, and click 'Fill from AI plan'.",
);

export const GROUP_PLAN_AI_INTRO = t(
  "По подписке ИИ: опишите группу и цель — помощник предложит текст плана. Сохраните его в карточку и при необходимости перенесите строки в таблицу выше.",
  "With AI subscription: describe the group and goal — the assistant will suggest the plan text. Save it to the card and copy the rows into the table above if necessary.",
);
