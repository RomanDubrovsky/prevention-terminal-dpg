import re

file_path = r"c:\Prevention_V3\apps\prevention_terminal\src\components\ManagerDashboard.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add import
if 'import { t } from "../lib/i18n.ts";' not in content:
    content = content.replace(
        'import { useCallback, useEffect, useMemo, useState } from "react";',
        'import { useCallback, useEffect, useMemo, useState } from "react";\nimport { t } from "../lib/i18n.ts";'
    )

replacements = [
    (r'"Дашборд сети центров"', r't("Дашборд сети центров", "Network dashboard")'),
    (r'"Дашборд руководителя центра"', r't("Дашборд руководителя центра", "Center manager dashboard")'),
    (r'"Дашборд руководителя"', r't("Дашборд руководителя", "Manager dashboard")'),
    (r' \+ " — сводка по филиалам без персональных данных клиентов\."', r' + t(" — сводка по филиалам без персональных данных клиентов.", " — branches summary without client personal data.")'),
    (r' \+ " — объём работы команды, воронка заявок и облачный rollup\."', r' + t(" — объём работы команды, воронка заявок и облачный rollup.", " — team workload, request funnel, and cloud rollup.")'),
    (r' \+ " — угрозы, 5 звеньев профилактики и план/факт по локальным данным\."', r' + t(" — угрозы, 5 звеньев профилактики и план/факт по локальным данным.", " — threats, 5 prevention levels, and local plan/actuals.")'),
    (r' \+ " · сравнение филиалов"', r' + t(" · сравнение филиалов", " · branches comparison")'),
    (r' \+ " · операционная сводка центра"', r' + t(" · операционная сводка центра", " · center operational summary")'),
    (r' \+ " · уч\. год " \+', r' + t(" · уч. год ", " · academic year ") +'),
    (r'>Бесплатно<', r'>{t("Бесплатно", "Free")}<'),
    (r'>Загружаем сводку организации…<', r'>{t("Загружаем сводку организации…", "Loading organization summary...")}<'),
    (r'Не удалось загрузить дашборд: \{error\}', r'{t("Не удалось загрузить дашборд: ", "Failed to load dashboard: ")}{error}'),
    (r'\{territorial \? "Сводка сети: " : "Сводка центра: "\}', r'{territorial ? t("Сводка сети: ", "Network summary: ") : t("Сводка центра: ", "Center summary: ")}'),
    (r'>\s*Операционный ИИ-мониторинг в реальном времени\s*<', r'>\n                    {t("Операционный ИИ-мониторинг в реальном времени", "Real-time operational AI monitoring")}\n                  <'),
    (r'>\s*Режим: Безопасный \(ПДн скрыты\)\s*<', r'>\n                  {t("Режим: Безопасный (ПДн скрыты)", "Mode: Safe (PII hidden)")}\n                <'),
    (r'>\s*Безопасность и Кризисы\s*<', r'>\n                    {t("Безопасность и Кризисы", "Security & Crises")}\n                  <'),
    (r'>\s*активных угроз\s*<', r'>\n                      {t("активных угроз", "active threats")}\n                    <'),
    (r'\{dash\.totals\.crisis_requests > 0\s*\?\s*"Внимание: зафиксированы кризисные обращения\. Проверьте Hot-Route\."\s*:\s*"Авто-маршрутизация Hot-Route работает в штатном режиме\."\}', r'{dash.totals.crisis_requests > 0 ? t("Внимание: зафиксированы кризисные обращения. Проверьте Hot-Route.", "Warning: crisis requests detected. Check Hot-Route.") : t("Авто-маршрутизация Hot-Route работает в штатном режиме.", "Hot-Route auto-routing is operating normally.")}'),
    (r'>\s*Сэкономлено времени\s*<', r'>\n                    {t("Сэкономлено времени", "Time saved")}\n                  <'),
    (r'>\s*в этом цикле\s*<', r'>\n                      {t("в этом цикле", "in this cycle")}\n                    <'),
    (r'>\s*Благодаря ИИ-диагностике и готовым анамнезам до сессий\.\s*<', r'>\n                    {t("Благодаря ИИ-диагностике и готовым анамнезам до сессий.", "Thanks to AI diagnostics and pre-prepared anamneses before sessions.")}\n                  <'),
    (r'>\s*Конверсия ИИ-приёмной\s*<', r'>\n                    {t("Конверсия ИИ-приёмной", "AI reception conversion")}\n                  <'),
    (r'Посетителей сайта успешно проходят скрининг и записываются \(\{inbox\?\.converted\}\{" "\}\s*из \{inbox\?\.total\}\)\.', r'{t("Посетителей сайта успешно проходят скрининг и записываются (", "Site visitors successfully pass screening and sign up (")}{inbox?.converted} {t("из", "of")} {inbox?.total}).'),
    (r'>\s*ИИ-АНАЛИТИК\s*<', r'>\n                    {t("ИИ-АНАЛИТИК", "AI ANALYST")}\n                  <'),
    (r'>\s*Сводный инсайт по центру:\s*<', r'>\n                    {t("Сводный инсайт по центру:", "Center summary insight:")}\n                  <'),
    (r'«Внимание: В центре \{dash\.totals\.active_cases\} активных дел\.\{" "\}\s*\{inbox && inbox\.open > 0\s*\?\s*`Обнаружено \$\{inbox\.open\} необработанных первичных заявок, требующих распределения\.`\s*:\s*"Все заявки распределены, узких горлышек в воронке нет\."\}\{" "\}\s*Рекомендуем перенаправить новый трафик на специалистов с минимальной загрузкой\.»', r'{t("«Внимание: В центре ", "«Attention: The center has ")}{dash.totals.active_cases}{t(" активных дел. ", " active cases. ")} {inbox && inbox.open > 0 ? `${t("Обнаружено", "Found")} ${inbox.open} ${t("необработанных первичных заявок, требующих распределения.", "unprocessed primary requests requiring distribution.")}` : t("Все заявки распределены, узких горлышек в воронке нет.", "All requests distributed, no bottlenecks in funnel.")} {t("Рекомендуем перенаправить новый трафик на специалистов с минимальной загрузкой.»", "We recommend redirecting new traffic to specialists with minimum workload.»")}'),
    (r'>\s*Подготовить рекомендации\s*<', r'>\n                    {t("Подготовить рекомендации", "Prepare recommendations")}\n                  <'),
    (r'>\s*Сформировать отчет директору\s*<', r'>\n                    {t("Сформировать отчет директору", "Generate director report")}\n                  <'),
    (r'>Уровни профилактики \(MTSS / UNICEF\)<', r'>{t("Уровни профилактики (MTSS / UNICEF)", "Prevention Levels (MTSS / UNICEF)")}<'),
    (r'>\s*Распределение нагрузки организации по международным стандартам профилактической работы\. Нагрузка по подключённым психологам — в rollup\.\s*<', r'>\n                {t("Распределение нагрузки организации по международным стандартам профилактической работы. Нагрузка по подключённым психологам — в rollup.", "Organization workload distribution according to international prevention standards. Connected psychologists\' workload is in the rollup.")}\n              <'),
    (r'>Универсальная<', r'>{t("Универсальная", "Universal")}<'),
    (r'>Профилактика для всех<', r'>{t("Профилактика для всех", "Prevention for all")}<'),
    (r'>Открытые заявки<', r'>{t("Открытые заявки", "Open requests")}<'),
    (r'>Программы среды \(год\)<', r'>{t("Программы среды (год)", "Environment programs (year)")}<'),
    (r'>Селективная<', r'>{t("Селективная", "Selective")}<'),
    (r'>Группы риска<', r'>{t("Группы риска", "At-risk groups")}<'),
    (r'>Групповые занятия \(год\)<', r'>{t("Групповые занятия (год)", "Group sessions (year)")}<'),
    (r'>Индикативная<', r'>{t("Индикативная", "Indicative")}<'),
    (r'>Кризис и сопровождение<', r'>{t("Кризис и сопровождение", "Crisis and support")}<'),
    (r'>Активные дела<', r'>{t("Активные дела", "Active cases")}<'),
    (r'>Кризисные заявки<', r'>{t("Кризисные заявки", "Crisis requests")}<'),
    (r'Сводка школы: \{org\}', r'{t("Сводка школы: ", "School summary: ")}{org}'),
    (r'>\s*Радар благополучия и безопасности \(Учебный год \{dash\.school_year\}\)\s*<', r'>\n                    {t("Радар благополучия и безопасности (Учебный год ", "Well-being and safety radar (Academic year ")}{dash.school_year})\n                  <'),
    (r'>\s*Стандарт FERPA / ФЗ-152 \(Без ФИО\)\s*<', r'>\n                  {t("Стандарт FERPA / ФЗ-152 (Без ФИО)", "FERPA / FZ-152 Standard (No PII)")}\n                <'),
    (r'>\s*Зона безопасности \(Критические риски\)\s*<', r'>\n                      {t("Зона безопасности (Критические риски)", "Security zone (Critical risks)")}\n                    <'),
    (r'>активных Hot-Route сигналов<', r'>{t("активных Hot-Route сигналов", "active Hot-Route signals")}<'),
    (r'>\s*Требует внимания!\s*<', r'>\n                       {t("Требует внимания!", "Requires attention!")}\n                     <'),
    (r'\{dash\.totals\.crisis_requests > 0\s*\?\s*`Зафиксировано \$\{dash\.totals\.crisis_requests\} кризисных инцидентов \(буллинг/насилие\)\. Сигналы переданы специалисту, статус: в работе\.`\s*:\s*"Критических инцидентов не зафиксировано\. Школьный климат стабилен\."\}', r'{dash.totals.crisis_requests > 0 ? `${t("Зафиксировано", "Recorded")} ${dash.totals.crisis_requests} ${t("кризисных инцидентов (буллинг/насилие). Сигналы переданы специалисту, статус: в работе.", "crisis incidents (bullying/violence). Signals escalated to specialist, status: in progress.")}` : t("Критических инцидентов не зафиксировано. Школьный климат стабилен.", "No critical incidents recorded. School climate is stable.")}'),
    (r'>Пирамида профилактики \(MTSS\)<', r'>{t("Пирамида профилактики (MTSS)", "Prevention Pyramid (MTSS)")}<'),
    (r'>\s*Многоуровневая система поддержки CASEL\. Как работает фильтр школьной психологической службы:\s*<', r'>\n                  {t("Многоуровневая система поддержки CASEL. Как работает фильтр школьной психологической службы:", "CASEL multi-tiered support system. How the school psychological service filter works:")}\n                <'),
    (r'>Tier 1 \(Универсальный\)<', r'>{t("Tier 1 (Универсальный)", "Tier 1 (Universal)")}<'),
    (r'>Массовый охват профилактикой \(Программы среды \+ Группы\)<', r'>{t("Массовый охват профилактикой (Программы среды + Группы)", "Mass prevention coverage (Environment programs + Groups)")}<'),
    (r'>мероприятий<', r'>{t("мероприятий", "events")}<'),
    (r'>Tier 2 \(Целевой\)<', r'>{t("Tier 2 (Целевой)", "Tier 2 (Targeted)")}<'),
    (r'>Группы риска \(Активные дела в работе специалиста\)<', r'>{t("Группы риска (Активные дела в работе специалиста)", "At-risk groups (Active cases in specialist\'s workload)")}<'),
    (r'>кейсов<', r'>{t("кейсов", "cases")}<'),
    (r'>Tier 3 \(Интенсивный\)<', r'>{t("Tier 3 (Интенсивный)", "Tier 3 (Intensive)")}<'),
    (r'>Острые кризисы \(Hot-Route\)<', r'>{t("Острые кризисы (Hot-Route)", "Acute crises (Hot-Route)")}<'),
    (r'>сигналов<', r'>{t("сигналов", "signals")}<'),
    (r'>Топография стресса \(Карта угроз\)<', r'>{t("Топография стресса (Карта угроз)", "Stress topography (Threat map)")}<'),
    (r'>\s*Агрегированный срез проблемных зон по PIE-осям\. Цвет ячейки — интенсивность проблемы по месяцам\.\s*<', r'>\n                    {t("Агрегированный срез проблемных зон по PIE-осям. Цвет ячейки — интенсивность проблемы по месяцам.", "Aggregated snapshot of problem areas along PIE axes. Cell color represents problem intensity by month.")}\n                  <'),
    (r'>Категория \(PIE\)<', r'>{t("Категория (PIE)", "Category (PIE)")}<'),
    (r'title=\{"Событий: " \+ cell\.incidents \+ ", тяжёлых: " \+ cell\.severe\}', r'title={t("Событий: ", "Events: ") + cell.incidents + t(", тяжёлых: ", ", severe: ") + cell.severe}'),
    (r'>\s*Резюме и Отчетность:\s*<', r'>\n                    {t("Резюме и Отчетность:", "Summary and Reporting:")}\n                  <'),
    (r'«Анализ школьного климата завершен\. Выявлено повышение учебной тревожности в \{dash\.threats\.length > 0 \? "старших классах" : "школе"\} на фоне предстоящих экзаменов \(Tier 2\)\. Рекомендуется направить штатного психолога на проведение тренингов по снижению стресса \(Tier 1\)\.»', r'{t("«Анализ школьного климата завершен. Выявлено повышение учебной тревожности в ", "«School climate analysis completed. Detected an increase in academic anxiety in ")}{dash.threats.length > 0 ? t("старших классах", "high school grades") : t("школе", "the school")}{t(" на фоне предстоящих экзаменов (Tier 2). Рекомендуется направить штатного психолога на проведение тренингов по снижению стресса (Tier 1).»", " against the background of upcoming exams (Tier 2). It is recommended to assign the staff psychologist to conduct stress reduction training (Tier 1).»")}'),
    (r'>\s*Сгенерировать отчет \(Word/PDF\)\s*<', r'>\n                    {t("Сгенерировать отчет (Word/PDF)", "Generate report (Word/PDF)")}\n                  <'),
    (r'>\s*Рекомендации педсовету\s*<', r'>\n                    {t("Рекомендации педсовету", "Recommendations for the pedagogical council")}\n                  <'),
    (r'\{commercial\s*\?\s*territorial\s*\?\s*"Сравнение филиалов"\s*:\s*"Команда психологов"\s*:\s*"Облачный rollup"\}', r'{commercial ? territorial ? t("Сравнение филиалов", "Branches comparison") : t("Команда психологов", "Psychologists team") : t("Облачный rollup", "Cloud rollup")}'),
    (r'\{commercial\s*\?\s*territorial\s*\?\s*"Агрегаты по подключённым филиалам \(CHILD от директоров центров\)\. Без ФИО клиентов; мелкие ячейки скрываются \(k-anonymity\)\."\s*:\s*"Агрегированная нагрузка по подключённым специалистам — без имён клиентов\. Подключайте CHILD-… или раздайте PARENT-…\."\s*:\s*"Агрегированная статистика по подключённым специалистам — без ФИО \(k-anonymity\)\."\}', r'{commercial ? territorial ? t("Агрегаты по подключённым филиалам (CHILD от директоров центров). Без ФИО клиентов; мелкие ячейки скрываются (k-anonymity).", "Aggregations for connected branches (CHILD from center directors). No client PII; small cells are hidden (k-anonymity).") : t("Агрегированная нагрузка по подключённым специалистам — без имён клиентов. Подключайте CHILD-… или раздайте PARENT-….", "Aggregated workload across connected specialists — no client names. Connect CHILD-… or distribute PARENT-….") : t("Агрегированная статистика по подключённым специалистам — без ФИО (k-anonymity).", "Aggregated statistics on connected specialists — no PII (k-anonymity).")}')
]

for pattern, repl in replacements:
    content = re.sub(pattern, repl, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
