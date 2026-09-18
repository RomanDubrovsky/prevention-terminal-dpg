# Prevention Terminal — CHANGELOG

История изменений десктоп-приложения (Tauri 2 + React 18 + SQLCipher).
Ведётся вручную для feature/terminal-core; production-релизы тегируются
отдельно (Phase 4+).

## Unreleased — Sprint 1 (Phase A kick-off)

Sprint 1 (см. `docs/terminal/sprint-1-plan.md` на ветке `main`) закрывает
шаги 1..4 reconciliation §7: Python-зеркало Phase A enum'ов, drift-test,
IPC и расширение InstallationWizard. Миграции 0007..0010 были
зафиксированы более ранними коммитами; этот спринт лишь подвязывает к
ним фронт и серверный Python-канон.

### Added

- **Python зеркало Phase A enum'ов.** `core/taxonomy_engine.py` теперь
  экспортирует `TASK_KIND_VALUES`, `ACTIVITY_KIND_VALUES`,
  `ACTIVITY_KIND_DEFAULT_MINUTES`, `SUBJECT_CATEGORY_VALUES`,
  `SECTION_KIND_VALUES`, `ORG_KIND_VALUES`, `ISCED_LEVEL_VALUES`.
- **`core/phase_a_validators.py`** — мини-валидаторы для Terminal-обмена
  (validate_task_kind, validate_activity_kind, default_minutes_for_activity_kind).
- **Drift-test `tests/test_taxonomy_sync.py`** читает
  `apps/prevention_terminal/src/lib/taxonomy.ts` как текст и падает при
  любом расхождении канонов. `EXECUTOR_ROLE_VALUES_TERMINAL` явно
  whitelisted до отдельного ADR-019 (см. §6 sprint-1-plan).
- **Новые IPC-команды**: `db_get_org_profile`, `db_save_org_profile`,
  `db_get_specialist_profile`, `db_save_specialist_profile`. Пишут в
  таблицы `org_profile` / `specialist_profile`, созданные миграцией
  0009. Валидация значений (`org_kind`, `isced_level`,
  `weekly_contract_minutes`) — на стороне Rust.
- **`src/lib/terminal_profiles.ts`** — типы и валидаторы для UI,
  завязанные на каноны `taxonomy.ts`.
- **InstallationWizard** теперь двух-шаговый: «Организация» →
  «Специалист». Сохраняет старый `installation_meta.json` (рост каталога
  школ), а параллельно пишет нормальные SQLCipher-профили. Если профили
  уже есть, форма открывает их «как есть» — можно отредактировать.
- **App.tsx** считает onboarding завершённым только если есть и
  installation meta, и `org_profile`, и `specialist_profile`. Все три
  артефакта пробрасываются в основной экран.

### Notes for future sprints

- `pnpm test` для `taxonomy.test.ts` подтверждает 13/13 type-guard тестов
  на Phase A enum'ах (зелёный).
- `pytest tests/test_taxonomy_sync.py` подтверждает 3/3 синхронности
  Python ↔ TS (зелёный).
- `cargo test` для SQLCipher-миграций требует `rustfmt`-компонента и
  тяжёлого Argon2 (m=64MiB); ручной прогон на свежей машине добавим в
  sprint 2.
- `EXECUTOR_ROLE` drift (3 Python vs 5 TS) намеренно НЕ закрыт. Решение
  откладывается до ADR-019 в спринтах 2–3, до начала Phase B.

