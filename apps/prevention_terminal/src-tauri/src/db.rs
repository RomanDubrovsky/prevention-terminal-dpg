//! Локальная зашифрованная БД для Prevention Terminal.
//!
//! Контур безопасности (Phase 2):
//!   * SQLite-файл шифруется SQLCipher 4 (AES-256-CBC + HMAC-SHA512).
//!   * Ключ БД (32 байта) derive'ится из мастер-пароля пользователя через
//!     Argon2id с OWASP-параметрами «sensitive» (m=64 MiB, t=3, p=4).
//!   * Соль — публичный 16-байтовый файл рядом с БД, генерируется один раз.
//!   * Сам ключ живёт в `Zeroizing`-обёртке и зачищается при Drop.
//!   * Через сеть НИЧЕГО из этого модуля не уходит — это локальный контур.
//!
//! Высокоуровневый API:
//! ```ignore
//! use prevention_terminal_lib::db::EncryptedDb;
//! let mut db = EncryptedDb::open("cases.sqlite", master_password)?;
//! db.connection().execute("INSERT INTO cases ...", [])?;
//! ```
//! После открытия БД автоматически применяет идемпотентные миграции.

use std::fs;
use std::path::{Path, PathBuf};

use argon2::{Algorithm, Argon2, Params, Version};
use rand::RngCore;
use rusqlite::{Connection, ErrorCode};
use thiserror::Error;
use zeroize::Zeroizing;

// --- Константы безопасности ----------------------------------------------

/// Длина соли в байтах. 16 — рекомендация OWASP для Argon2 KDF.
pub const SALT_LEN: usize = 16;

/// Длина выходного ключа для SQLCipher (AES-256).
pub const KEY_LEN: usize = 32;

/// OWASP «sensitive» профиль Argon2id (long-term secrets, локальная БД).
///
/// При изменении параметров **старые БД перестают открываться** — нужна
/// миграция KDF: открыть со старыми параметрами, выполнить `PRAGMA rekey`
/// с новым ключом (вне scope этого файла).
pub const ARGON2_M_COST_KIB: u32 = 65_536; // 64 MiB
pub const ARGON2_T_COST: u32 = 3;
pub const ARGON2_P_COST: u32 = 4;

/// Suffix для соляного файла рядом с БД (`cases.sqlite` -> `cases.sqlite.salt`).
pub const DEFAULT_SALT_SUFFIX: &str = ".salt";

// --- Ошибки --------------------------------------------------------------

#[derive(Debug, Error)]
pub enum DbError {
    #[error("invalid master password")]
    InvalidPassword,

    #[error("salt file IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("malformed salt file (expected {expected} bytes, got {found})")]
    MalformedSalt { expected: usize, found: usize },

    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("argon2 error: {0}")]
    Argon2(String),
}

// --- Тип ключа -----------------------------------------------------------

/// 256-битный ключ БД. Содержимое зачищается при Drop через `Zeroizing`.
///
/// Намеренно не реализуем `Debug`/`Display`/`Clone` — ключ не должен
/// попадать в логи и не должен копироваться без причины.
pub struct DbKey(Zeroizing<[u8; KEY_LEN]>);

impl DbKey {
    /// Hex-представление ключа для подачи в SQLCipher PRAGMA.
    ///
    /// Эта строка живёт ровно столько, сколько нужно для `execute_batch`
    /// в `open_encrypted`. SQLCipher после этого хранит ключ в своей
    /// внутренней (нативной) репрезентации, и `String` можно отпустить.
    fn to_hex(&self) -> String {
        use std::fmt::Write as _;
        let mut s = String::with_capacity(KEY_LEN * 2);
        for b in self.0.iter() {
            let _ = write!(&mut s, "{:02x}", b);
        }
        s
    }

    #[cfg(test)]
    fn as_bytes(&self) -> &[u8; KEY_LEN] {
        &self.0
    }
}

// --- KDF и соль ----------------------------------------------------------

/// Прочитать соль из файла или сгенерировать новую и сохранить.
///
/// Соль публична (атакующий с доступом к файлу БД обычно имеет и соль).
/// Стойкость даёт сам Argon2id с OWASP-параметрами.
pub fn load_or_init_salt(salt_path: &Path) -> Result<[u8; SALT_LEN], DbError> {
    if salt_path.exists() {
        let bytes = fs::read(salt_path)?;
        if bytes.len() != SALT_LEN {
            return Err(DbError::MalformedSalt {
                expected: SALT_LEN,
                found: bytes.len(),
            });
        }
        let mut out = [0u8; SALT_LEN];
        out.copy_from_slice(&bytes);
        Ok(out)
    } else {
        if let Some(parent) = salt_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut salt = [0u8; SALT_LEN];
        rand::thread_rng().fill_bytes(&mut salt);
        fs::write(salt_path, salt)?;
        Ok(salt)
    }
}

/// Derive 256-битный ключ из мастер-пароля + публичной соли.
///
/// Параметры Argon2id зафиксированы константами `ARGON2_*`. Это критический
/// инвариант: при смене параметров требуется миграция KDF (см. docstring модуля).
pub fn derive_key(master_password: &str, salt: &[u8; SALT_LEN]) -> Result<DbKey, DbError> {
    let params = Params::new(
        ARGON2_M_COST_KIB,
        ARGON2_T_COST,
        ARGON2_P_COST,
        Some(KEY_LEN),
    )
    .map_err(|e| DbError::Argon2(e.to_string()))?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = Zeroizing::new([0u8; KEY_LEN]);
    argon
        .hash_password_into(master_password.as_bytes(), salt, key.as_mut_slice())
        .map_err(|e| DbError::Argon2(e.to_string()))?;
    Ok(DbKey(key))
}

// --- SQLCipher ----------------------------------------------------------

/// Открыть зашифрованное соединение к БД и проверить пароль.
///
/// Контракт:
///   1. Создаёт `db_path.parent()` при необходимости.
///   2. Открывает соединение через `rusqlite::Connection::open`.
///   3. Применяет `PRAGMA key` в формате SQLCipher binary key (`x'<hex>'`).
///   4. Делает smoke-чтение `sqlite_master`. Если ключ неверен — SQLCipher
///      возвращает `SQLITE_NOTADB` (код 26), что мы преобразуем в
///      `DbError::InvalidPassword` — единственный безопасный сигнал для UI.
///
/// SQLCipher 4 дефолты (HMAC-SHA512, kdf_iter=256000, cipher_page_size=4096)
/// — современные и безопасные; не переопределяем их, чтобы автоматически
/// получать улучшения в будущих версиях.
pub fn open_encrypted(db_path: &Path, key: &DbKey) -> Result<Connection, DbError> {
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(db_path)?;

    let hex = key.to_hex();
    let pragma_key = format!("PRAGMA key = \"x'{}'\";", hex);
    conn.execute_batch(&pragma_key)?;
    // `hex` (и `pragma_key`) живут только до конца этой функции; SQLCipher
    // уже захватил ключ в свою репрезентацию. Полная гарантия очистки
    // байтов в куче от Rust String недостижима (String не Zeroize), но
    // критическое значение хранится в DbKey (Zeroizing).

    // Smoke-чтение триггерит расшифровку первой страницы — единственный
    // надёжный способ проверить, что пароль верен.
    match conn.query_row("SELECT count(*) FROM sqlite_master", [], |row| {
        row.get::<_, i64>(0)
    }) {
        Ok(_) => {
            // SQLite/SQLCipher по умолчанию не применяет FOREIGN KEY
            // ограничения. Включаем явно для каждого соединения, иначе
            // `ON DELETE CASCADE` в `pd_aliases` будет только декларацией.
            conn.execute_batch("PRAGMA foreign_keys = ON;")?;
            Ok(conn)
        }
        Err(rusqlite::Error::SqliteFailure(err, _)) if err.code == ErrorCode::NotADatabase => {
            Err(DbError::InvalidPassword)
        }
        Err(e) => Err(DbError::Sqlite(e)),
    }
}

// --- Высокоуровневый API ------------------------------------------------

/// Высокоуровневая обёртка над открытым зашифрованным соединением.
/// Используется из Tauri-команд (см. `lib.rs` — Phase 2 todo).
pub struct EncryptedDb {
    conn: Connection,
    db_path: PathBuf,
}

impl EncryptedDb {
    /// Полный happy-path Phase 2:
    ///   1. Найти или создать соль рядом с БД (`<db_path>.salt`).
    ///   2. Derive ключа через Argon2id.
    ///   3. Открыть зашифрованное соединение, проверить пароль smoke-запросом.
    ///   4. Прогнать миграции (`run_migrations`).
    pub fn open(db_path: impl AsRef<Path>, master_password: &str) -> Result<Self, DbError> {
        let db_path = db_path.as_ref().to_path_buf();
        let salt_path = default_salt_path(&db_path);
        let salt = load_or_init_salt(&salt_path)?;
        let key = derive_key(master_password, &salt)?;
        let mut conn = open_encrypted(&db_path, &key)?;
        run_migrations(&mut conn)?;
        Ok(Self { conn, db_path })
    }

    /// Иммутабельная ссылка на соединение — для read-only запросов.
    pub fn connection(&self) -> &Connection {
        &self.conn
    }

    /// Мутабельная ссылка — для транзакций и write-операций.
    pub fn connection_mut(&mut self) -> &mut Connection {
        &mut self.conn
    }

    /// Путь к файлу БД (для повторного открытия / re-key).
    pub fn db_path(&self) -> &Path {
        &self.db_path
    }
}

/// Стандартное расположение соляного файла относительно файла БД.
/// Пример: `cases.sqlite` -> `cases.sqlite.salt`.
pub fn default_salt_path(db_path: &Path) -> PathBuf {
    let mut p = db_path.as_os_str().to_owned();
    p.push(DEFAULT_SALT_SUFFIX);
    PathBuf::from(p)
}

// --- Миграции -----------------------------------------------------------

/// Применить миграции локальной БД.
///
/// Контракт идемпотентности (Phase 3.7+):
///   * Версии отслеживаются в служебной таблице `schema_migrations`.
///   * Каждая запись `MIGRATIONS_SQL` применяется ровно ОДИН раз. Это
///     критично для миграций, которые делают `DROP TABLE` / `ALTER TABLE`
///     — простой `IF NOT EXISTS`-подход уничтожал бы данные при перезапуске.
///   * Все миграции — внутри одной транзакции; если падает любая, изменения
///     всей серии откатываются, и БД остаётся в согласованном состоянии.
///
/// Совместимость с БД, открывавшимися старой версией приложения:
///   на первом запуске после апгрейда таблица `schema_migrations` пуста,
///   значит ВСЕ миграции будут перепрогнаны. Это допустимо при условии,
///   что каждая миграция написана так, чтобы безопасно лечь поверх своего
///   же предшествующего состояния (например, использует `DROP TABLE IF EXISTS`
///   для тех таблиц, которые она пересоздаёт). См. комментарий к миграции 0002.
pub fn run_migrations(conn: &mut Connection) -> Result<(), DbError> {
    let tx = conn.transaction()?;

    // Внутренняя книга учёта применённых миграций. Создаётся первой и сама
    // не считается «миграцией», чтобы не плодить рекурсивный bootstrap.
    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version    INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );",
    )?;

    for (idx, sql) in MIGRATIONS_SQL.iter().enumerate() {
        // Версии нумеруются с 1, чтобы соответствовать комментариям «0001…».
        let version = (idx as i64) + 1;
        let already: i64 = tx.query_row(
            "SELECT count(*) FROM schema_migrations WHERE version = ?1",
            [version],
            |row| row.get(0),
        )?;
        if already > 0 {
            continue;
        }
        tx.execute_batch(sql)?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
            .to_string();
        tx.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
            rusqlite::params![version, now],
        )?;
    }
    tx.commit()?;
    Ok(())
}

/// Каноническая лента миграций локальной БД. Порядок и индекс — стабильны:
/// добавлять только в конец массива, никогда не вставлять в середину.
pub const MIGRATIONS_SQL: &[&str] = &[
    // 0001: основная карточка случая (анонимный shadow_id, без персональных данных).
    //
    // passport_json — сериализованный TaxonomyPassport, который пришёл с фронта.
    // Денормализованные колонки (x_stage, y_level и т.д.) дублируют ключевые поля
    // паспорта, чтобы локальные дашборды могли фильтровать без JSON-парсинга.
    r#"
    CREATE TABLE IF NOT EXISTS cases (
        case_id        TEXT PRIMARY KEY,
        shadow_id      TEXT NOT NULL,          -- локальный псевдоним (Ученик №N)
        x_stage        TEXT NOT NULL,          -- X1..X5
        y_level        TEXT NOT NULL,          -- Y1..Y4
        m_modality     TEXT NOT NULL,          -- JSON array из M1..M5
        executor_role  TEXT NOT NULL,
        org_scale      TEXT NOT NULL,          -- Individual..Society
        topic_tags     TEXT NOT NULL DEFAULT '[]',
        passport_json  TEXT NOT NULL DEFAULT '{}',
        notes_sanitized TEXT NOT NULL DEFAULT '', -- очищенный санитайзером свободный текст
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
    );
    "#,
    // 0002: персональные алиасы ФИО → детерминированный маркер «[Ученик №N]».
    //
    // Phase 3.7 переработала схему. Предыдущая версия (HMAC-PK без связи с
    // кейсом) была заведена в Phase 2 как заглушка и НИ РАЗУ не наполнялась
    // данными в работающем терминале. Поэтому миграция выполняется через
    // `DROP TABLE IF EXISTS pd_aliases` + `CREATE TABLE` — это безопасно
    // именно потому, что мы знаем: реальных строк в старой таблице не было.
    //
    // Инвариант приватности: содержимое `real_name` НИКОГДА не уходит на
    // сервер. В сетевой контур уходит только результат санитайзера, где
    // имена уже заменены на нейтральные маркеры. Связь с `cases` через
    // `ON DELETE CASCADE` гарантирует, что удаление кейса не оставляет
    // осиротевших ФИО.
    //
    // role_no — порядковый номер внутри пары (case_id, role). Нумерация
    // 1-based и непрерывная для удобства чтения в DOCX-отчётах
    // («Ученик №2 ссорится с Учеником №3»). UNIQUE гарантирует, что фронт
    // не пришлёт дубликат номера в одном кейсе.
    r#"
    DROP TABLE IF EXISTS pd_aliases;
    CREATE TABLE pd_aliases (
        alias_id     TEXT PRIMARY KEY,        -- UUID, сгенерированный клиентом
        case_id      TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
        role         TEXT NOT NULL,           -- 'student' | 'parent' | 'teacher' | 'other'
        role_no      INTEGER NOT NULL,        -- 1, 2, 3... в рамках (case_id, role)
        real_name    TEXT NOT NULL,           -- реальное ФИО — только локально
        created_at   TEXT NOT NULL,
        UNIQUE(case_id, role, role_no)
    );
    CREATE INDEX IF NOT EXISTS idx_pd_aliases_case ON pd_aliases(case_id);
    "#,
    // 0003: журнал отправленных запросов в Архитектор (для офлайн-аудита).
    r#"
    CREATE TABLE IF NOT EXISTS architect_requests (
        request_id     TEXT PRIMARY KEY,
        case_id        TEXT NOT NULL,
        sent_at        TEXT NOT NULL,
        tokens_used    INTEGER NOT NULL DEFAULT 0,
        rag_used       TEXT NOT NULL DEFAULT '[]',
        digital_twin   TEXT NOT NULL DEFAULT '{}',
        markdown_sha   TEXT NOT NULL           -- sha256 от markdown-ответа (без хранения текста)
    );
    "#,
    // 0004: интейк (первичный приём) для одного локального кейса.
    //
    // В Phase 3.8 форма интейка хранится как JSON-снимок, чтобы UI мог
    // быстро эволюционировать без ALTER TABLE на каждое новое поле. Это
    // локальная SQLCipher-БД, поэтому raw-значения могут содержать персональные данные,
    // но в сетевой контур этот JSON не уходит без отдельного санитайзера.
    r#"
    CREATE TABLE IF NOT EXISTS intake_forms (
        case_id       TEXT PRIMARY KEY REFERENCES cases(case_id) ON DELETE CASCADE,
        intake_json   TEXT NOT NULL DEFAULT '{}',
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
    );
    "#,
    // 0005: журнал действий специалиста и учёт времени.
    //
    // Журнал нужен как школьным психологам (отчётность по нагрузке), так и
    // коммерческим специалистам (долгое сопровождение клиента). Записи
    // привязаны к кейсу и удаляются каскадом вместе с ним.
    r#"
    CREATE TABLE IF NOT EXISTS work_log_entries (
        entry_id      TEXT PRIMARY KEY,
        case_id       TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
        action_kind   TEXT NOT NULL,           -- consultation | call | document | observation | other
        minutes       INTEGER NOT NULL CHECK (minutes > 0),
        note          TEXT NOT NULL DEFAULT '',
        created_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_work_log_entries_case
        ON work_log_entries(case_id, created_at);
    "#,
    // 0006: append-only журнал приёмов вместо одного mutable intake.
    //
    // ADR-002 / Phase 3.12a: личное дело ребёнка может вестись месяцами,
    // поэтому первичный приём и последующие встречи должны фиксироваться
    // отдельными записями с датой внесения. Старый `intake_forms` переносим
    // в `session_records` как `session_no = 0`, после чего таблицу удаляем.
    r#"
    CREATE TABLE IF NOT EXISTS session_records (
        record_id     TEXT PRIMARY KEY,
        case_id       TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
        session_no    INTEGER NOT NULL CHECK (session_no >= 0),
        content_json  TEXT NOT NULL DEFAULT '{}',
        recorded_at   TEXT NOT NULL,
        created_at    TEXT NOT NULL,
        UNIQUE(case_id, session_no)
    );
    INSERT OR IGNORE INTO session_records (
        record_id, case_id, session_no, content_json, recorded_at, created_at
    )
    SELECT
        'intake-' || case_id,
        case_id,
        0,
        intake_json,
        updated_at,
        created_at
    FROM intake_forms;
    DROP TABLE IF EXISTS intake_forms;
    CREATE INDEX IF NOT EXISTS idx_session_records_case
        ON session_records(case_id, session_no);
    "#,
    // 0007: единая транзакционная строка учёта `case_touches` (Phase A kickoff).
    //
    // Спека Phase A § 2: одна запись = одно касание = и кусок кейса, и кусок
    // ИПР/годового плана, и кусок нагрузки специалиста. Это минимально жизне-
    // способный enum `activity_kind` из 5 значений по Q-R2: остальные значения
    // (Q4, 11 шт.) подъезжают позже вместе с sync `taxonomy.ts`.
    //
    // CHECK по `activity_kind` фиксирует контракт прямо в БД, не дожидаясь
    // TS-зеркала: если фронт пришлёт нечто за пределами Phase A kickoff-набора,
    // SQLCipher откажет на уровне строки.
    //
    // Второй CHECK (`case_id`/`program_id`/`task_id`) повторяет инвариант спеки
    // «как минимум одна ссылка должна быть не NULL». В Phase A исторические
    // записи всегда привязаны к `case_id`, поэтому миграционные INSERT'ы
    // проходят без модификации.
    //
    // Data-миграция переносит:
    //   * `work_log_entries` → `case_touches` с маппингом Q-R2
    //     (`consultation`/`call` → `individual_session`,
    //      `observation` → `environmental_intervention`,
    //      `document`/`other` → `administrative_work`).
    //     `minutes` копируется и в `minutes_planned`, и в `minutes_actual`
    //     (журнал нагрузки — постфактум, статус `completed`).
    //   * `session_records` с `session_no > 0` → `case_touches` с
    //     `activity_kind='individual_session'`. По Q-R4/Q-R5 жёсткая константа
    //     45 минут: в `session_records` нет колонки длительности, восстановить
    //     её невозможно, 45 = академический час. `session_no = 0` (intake) НЕ
    //     переносится — он уедет в `case_intake_sections` миграцией 0010.
    //
    // `beneficiaries_count = 1` для всех исторических строк (закрыто Q-R3:
    // старая база велась в контексте одного личного дела).
    //
    // `id` генерируется через `lower(hex(randomblob(16)))` — это 32-символьный
    // hex-строковый идентификатор, локально уникальный; формальный UUID без
    // дефисов нам в SQLCipher-БД не нужен.
    r#"
    CREATE TABLE IF NOT EXISTS case_touches (
        id                  TEXT PRIMARY KEY NOT NULL,
        occurred_on         TEXT NOT NULL,
        week_bucket         TEXT NOT NULL,
        activity_kind       TEXT NOT NULL CHECK (activity_kind IN (
                                'individual_session',
                                'group_session',
                                'environmental_intervention',
                                'diagnostic_session',
                                'administrative_work'
                            )),
        status              TEXT NOT NULL,
        minutes_planned     INTEGER NOT NULL,
        minutes_actual      INTEGER NOT NULL,
        beneficiaries_count INTEGER NOT NULL,
        notes_local         TEXT,
        case_id             TEXT,
        ipr_id              TEXT,
        ipr_step_id         TEXT,
        task_id             TEXT,
        program_id          TEXT,
        request_id          TEXT,
        CHECK (case_id IS NOT NULL OR program_id IS NOT NULL OR task_id IS NOT NULL)
    );

    INSERT INTO case_touches (
        id, occurred_on, week_bucket, activity_kind, status,
        minutes_planned, minutes_actual, beneficiaries_count, notes_local, case_id,
        ipr_id, ipr_step_id, task_id, program_id, request_id
    )
    SELECT
        lower(hex(randomblob(16))),
        strftime('%Y-%m-%d', created_at),
        strftime('%Y-W%W', created_at),
        CASE action_kind
            WHEN 'consultation' THEN 'individual_session'
            WHEN 'call'         THEN 'individual_session'
            WHEN 'observation'  THEN 'environmental_intervention'
            WHEN 'document'     THEN 'administrative_work'
            WHEN 'other'        THEN 'administrative_work'
            ELSE                     'administrative_work'
        END,
        'completed',
        minutes,
        minutes,
        1,
        note,
        case_id,
        NULL, NULL, NULL, NULL, NULL
    FROM work_log_entries;

    INSERT INTO case_touches (
        id, occurred_on, week_bucket, activity_kind, status,
        minutes_planned, minutes_actual, beneficiaries_count, notes_local, case_id,
        ipr_id, ipr_step_id, task_id, program_id, request_id
    )
    SELECT
        lower(hex(randomblob(16))),
        strftime('%Y-%m-%d', created_at),
        strftime('%Y-W%W', created_at),
        'individual_session',
        'completed',
        45,
        45,
        1,
        NULL,
        case_id,
        NULL, NULL, NULL, NULL, NULL
    FROM session_records
    WHERE session_no > 0;
    "#,
    // 0008: canonicalize `case_touches.activity_kind` to Phase A §5.0/Q4.
    //
    // Migration 0007 was intentionally conservative and used the temporary
    // five-value enum from reconciliation Q-R2. After the canon sync in
    // `taxonomy.ts` (commit 20350f5), the stable contract is the 11-value
    // `activity_kind` list from `service-management-model.md` §5.0/Q4.
    //
    // SQLite cannot alter a CHECK constraint in-place, so we rebuild the table:
    //   * `environmental_intervention` -> `assessment`
    //     (legacy "observation" is closest to assessment/diagnostic work);
    //   * `diagnostic_session` -> `assessment`;
    //   * `administrative_work` -> `admin_other`;
    //   * already-canonical values pass through unchanged.
    //
    // We still do not add FKs here because `case_files`, `iprs`,
    // `year_plan_tasks` and `request_log` are created later in Phase A.
    r#"
    CREATE TABLE IF NOT EXISTS case_touches_v2 (
        id                  TEXT PRIMARY KEY NOT NULL,
        occurred_on         TEXT NOT NULL,
        week_bucket         TEXT NOT NULL,
        activity_kind       TEXT NOT NULL CHECK (activity_kind IN (
                                'intake',
                                'individual_session',
                                'group_session',
                                'family_session',
                                'assessment',
                                'consultation',
                                'program_event',
                                'referral',
                                'evaluation',
                                'methodology_work',
                                'admin_other'
                            )),
        status              TEXT NOT NULL CHECK (status IN ('planned', 'completed', 'cancelled')),
        minutes_planned     INTEGER NOT NULL CHECK (minutes_planned >= 0),
        minutes_actual      INTEGER NOT NULL CHECK (minutes_actual >= 0),
        beneficiaries_count INTEGER NOT NULL CHECK (beneficiaries_count >= 1),
        notes_local         TEXT,
        case_id             TEXT,
        ipr_id              TEXT,
        ipr_step_id         TEXT,
        task_id             TEXT,
        program_id          TEXT,
        request_id          TEXT,
        CHECK (case_id IS NOT NULL OR program_id IS NOT NULL OR task_id IS NOT NULL)
    );

    INSERT OR IGNORE INTO case_touches_v2 (
        id, occurred_on, week_bucket, activity_kind, status,
        minutes_planned, minutes_actual, beneficiaries_count, notes_local, case_id,
        ipr_id, ipr_step_id, task_id, program_id, request_id
    )
    SELECT
        id,
        occurred_on,
        week_bucket,
        CASE activity_kind
            WHEN 'environmental_intervention' THEN 'assessment'
            WHEN 'diagnostic_session'         THEN 'assessment'
            WHEN 'administrative_work'        THEN 'admin_other'
            ELSE activity_kind
        END,
        CASE status
            WHEN 'planned'   THEN 'planned'
            WHEN 'cancelled' THEN 'cancelled'
            ELSE                  'completed'
        END,
        CASE WHEN minutes_planned < 0 THEN 0 ELSE minutes_planned END,
        CASE WHEN minutes_actual  < 0 THEN 0 ELSE minutes_actual  END,
        CASE WHEN beneficiaries_count < 1 THEN 1 ELSE beneficiaries_count END,
        notes_local,
        case_id,
        ipr_id,
        ipr_step_id,
        task_id,
        program_id,
        request_id
    FROM case_touches;

    DROP TABLE case_touches;
    ALTER TABLE case_touches_v2 RENAME TO case_touches;

    CREATE INDEX IF NOT EXISTS idx_case_touches_case
        ON case_touches(case_id, occurred_on);
    CREATE INDEX IF NOT EXISTS idx_case_touches_week_kind
        ON case_touches(week_bucket, activity_kind);
    CREATE INDEX IF NOT EXISTS idx_case_touches_task
        ON case_touches(task_id);
    "#,
    // 0009: Phase A identity/config singletons.
    //
    // These tables move runtime configuration into SQLCipher so future local
    // dashboards and migrations do not depend on sidecar JSON files. The
    // existing `installation_meta.json` file is kept for the current UI and
    // will be bridged by IPC in the next implementation step.
    r#"
    CREATE TABLE IF NOT EXISTS app_config (
        id              INTEGER PRIMARY KEY CHECK (id = 1),
        schema_version  INTEGER NOT NULL,
        locale          TEXT NOT NULL DEFAULT 'ru',
        db_locked_at    TEXT,
        installation_id TEXT NOT NULL,
        country         TEXT NOT NULL DEFAULT ''
    );

    INSERT OR IGNORE INTO app_config (
        id, schema_version, locale, db_locked_at, installation_id, country
    ) VALUES (
        1, 9, 'ru', NULL, lower(hex(randomblob(16))), ''
    );

    CREATE TABLE IF NOT EXISTS org_profile (
        id                  INTEGER PRIMARY KEY CHECK (id = 1),
        display_name        TEXT NOT NULL DEFAULT '',
        isced_level         INTEGER NOT NULL DEFAULT 2 CHECK (isced_level BETWEEN 0 AND 8),
        org_kind            TEXT NOT NULL DEFAULT 'other' CHECK (org_kind IN (
                                'combined_school',
                                'special_education',
                                'out_of_school',
                                'psych_support_center',
                                'private_practice',
                                'other'
                            )),
        normative_overrides TEXT NOT NULL DEFAULT '{}'
    );

    INSERT OR IGNORE INTO org_profile (
        id, display_name, isced_level, org_kind, normative_overrides
    ) VALUES (
        1, '', 2, 'other', '{}'
    );

    CREATE TABLE IF NOT EXISTS specialist_profile (
        id                      INTEGER PRIMARY KEY CHECK (id = 1),
        display_name            TEXT NOT NULL DEFAULT '',
        role_text               TEXT NOT NULL DEFAULT 'school psychologist',
        weekly_contract_minutes INTEGER NOT NULL DEFAULT 1800 CHECK (weekly_contract_minutes >= 0)
    );

    INSERT OR IGNORE INTO specialist_profile (
        id, display_name, role_text, weekly_contract_minutes
    ) VALUES (
        1, '', 'school psychologist', 1800
    );
    "#,
    // 0010: Phase A case lifecycle schema.
    //
    // New tables are additive. Legacy tables (`cases`, `pd_aliases`,
    // `session_records`) stay in place so the existing Phase 3 UI keeps
    // working while Phase A screens are implemented. We only seed minimal
    // bridge rows from legacy data:
    //   * one `case_files` row per legacy `cases` row;
    //   * one `case_pii` row per case using student alias #1 when available;
    //   * one primary `case_problems` row using the best matching topic tag;
    //   * one primary `case_subject_categories(normal)` row per case.
    //
    // Intake splitting into 13 `case_intake_sections` needs a typed TS mapper
    // from old JSON shape and is intentionally left to a later migration.
    r#"
    CREATE TABLE IF NOT EXISTS case_files (
        id                   TEXT PRIMARY KEY NOT NULL,
        opened_at            TEXT NOT NULL,
        archived_at          TEXT,
        status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'transferred')),
        locale               TEXT NOT NULL DEFAULT 'ru',
        lead_specialist_id   INTEGER NOT NULL DEFAULT 1 REFERENCES specialist_profile(id),
        primary_task_kind    TEXT NOT NULL DEFAULT 'other' CHECK (primary_task_kind IN (
                                 'bullying_victim',
                                 'bullying_aggressor',
                                 'self_harm_suicidal',
                                 'academic_motivation',
                                 'family_conflict',
                                 'family_crisis',
                                 'addiction_substance',
                                 'addiction_screen',
                                 'anxiety_fears',
                                 'depressive_state',
                                 'loneliness_isolation',
                                 'identity_self_esteem',
                                 'trauma_experience',
                                 'criminal_behavior',
                                 'other'
                             )),
        notes_local          TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS case_pii (
        case_id             TEXT PRIMARY KEY NOT NULL REFERENCES case_files(id) ON DELETE CASCADE,
        child_full_name_enc TEXT NOT NULL DEFAULT '',
        child_dob           TEXT,
        child_sex           TEXT NOT NULL DEFAULT 'unspecified' CHECK (child_sex IN ('m', 'f', 'unspecified')),
        contacts            TEXT NOT NULL DEFAULT '[]',
        addresses           TEXT NOT NULL DEFAULT '[]',
        parents             TEXT NOT NULL DEFAULT '[]',
        documents           TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS case_problems (
        id          TEXT PRIMARY KEY NOT NULL,
        case_id     TEXT NOT NULL REFERENCES case_files(id) ON DELETE CASCADE,
        task_kind   TEXT NOT NULL CHECK (task_kind IN (
                        'bullying_victim',
                        'bullying_aggressor',
                        'self_harm_suicidal',
                        'academic_motivation',
                        'family_conflict',
                        'family_crisis',
                        'addiction_substance',
                        'addiction_screen',
                        'anxiety_fears',
                        'depressive_state',
                        'loneliness_isolation',
                        'identity_self_esteem',
                        'trauma_experience',
                        'criminal_behavior',
                        'other'
                    )),
        since       TEXT NOT NULL,
        until       TEXT,
        notes_local TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS case_subject_categories (
        case_id    TEXT NOT NULL REFERENCES case_files(id) ON DELETE CASCADE,
        category   TEXT NOT NULL CHECK (category IN (
                       'normal',
                       'gifted',
                       'sen',
                       'hardship',
                       'migrant',
                       'other'
                   )),
        is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
        PRIMARY KEY (case_id, category)
    );

    CREATE TABLE IF NOT EXISTS case_risk_scores (
        id          TEXT PRIMARY KEY NOT NULL,
        case_id     TEXT NOT NULL REFERENCES case_files(id) ON DELETE CASCADE,
        period_week TEXT NOT NULL,
        m_modality  TEXT NOT NULL CHECK (m_modality IN (
                       'M1_Biology',
                       'M2_Psychophysiology',
                       'M3_Cognition',
                       'M4_Social',
                       'M5_Environment'
                   )),
        y_level     TEXT NOT NULL CHECK (y_level IN (
                       'Y1_Normal',
                       'Y2_Risk',
                       'Y3_Problem',
                       'Y4_Crisis_Clinical'
                   )),
        computed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS case_intake_sections (
        id           TEXT PRIMARY KEY NOT NULL,
        case_id      TEXT NOT NULL REFERENCES case_files(id) ON DELETE CASCADE,
        section_kind TEXT NOT NULL CHECK (section_kind IN (
                         'socio_demographics',
                         'housing',
                         'family',
                         'health',
                         'personality',
                         'learning',
                         'leisure_employment',
                         'peers',
                         'digital_risks',
                         'risk_blocks',
                         'protective_factors',
                         'referral_reasons',
                         'consents'
                     )),
        payload_json TEXT NOT NULL DEFAULT '{}',
        version      INTEGER NOT NULL CHECK (version > 0),
        edited_at    TEXT NOT NULL,
        edited_by    INTEGER NOT NULL DEFAULT 1 REFERENCES specialist_profile(id),
        UNIQUE (case_id, section_kind, version)
    );

    INSERT OR IGNORE INTO case_files (
        id, opened_at, archived_at, status, locale, lead_specialist_id,
        primary_task_kind, notes_local
    )
    SELECT
        case_id,
        created_at,
        NULL,
        'active',
        'ru',
        1,
        CASE
            WHEN instr(topic_tags, 'bullying_victim')      > 0 THEN 'bullying_victim'
            WHEN instr(topic_tags, 'bullying_aggressor')   > 0 THEN 'bullying_aggressor'
            WHEN instr(topic_tags, 'self_harm')            > 0 THEN 'self_harm_suicidal'
            WHEN instr(topic_tags, 'suicidal_ideation')    > 0 THEN 'self_harm_suicidal'
            WHEN instr(topic_tags, 'depressive_state')     > 0 THEN 'depressive_state'
            WHEN instr(topic_tags, 'low_self_esteem')      > 0 THEN 'identity_self_esteem'
            WHEN instr(topic_tags, 'substance_abuse')      > 0 THEN 'addiction_substance'
            WHEN instr(topic_tags, 'alcoholization')       > 0 THEN 'addiction_substance'
            WHEN instr(topic_tags, 'vaping_nicotine')      > 0 THEN 'addiction_substance'
            WHEN instr(topic_tags, 'pharma_abuse')         > 0 THEN 'addiction_substance'
            WHEN instr(topic_tags, 'gadget_addiction')     > 0 THEN 'addiction_screen'
            WHEN instr(topic_tags, 'ludomania_gambling')   > 0 THEN 'addiction_screen'
            WHEN instr(topic_tags, 'family_violence')      > 0 THEN 'family_crisis'
            WHEN instr(topic_tags, 'parent_divorce')       > 0 THEN 'family_crisis'
            WHEN instr(topic_tags, 'destructive_parenting') > 0 THEN 'family_conflict'
            WHEN instr(topic_tags, 'family_deviations')    > 0 THEN 'family_crisis'
            WHEN instr(topic_tags, 'criminal_peer_group')  > 0 THEN 'criminal_behavior'
            WHEN instr(topic_tags, 'cyberbullying')        > 0 THEN 'bullying_victim'
            ELSE 'other'
        END,
        notes_sanitized
    FROM cases;

    INSERT OR IGNORE INTO case_pii (
        case_id, child_full_name_enc, child_dob, child_sex,
        contacts, addresses, parents, documents
    )
    SELECT
        c.case_id,
        COALESCE((
            SELECT pa.real_name
            FROM pd_aliases pa
            WHERE pa.case_id = c.case_id
              AND pa.role = 'student'
              AND pa.role_no = 1
            LIMIT 1
        ), c.shadow_id, c.case_id),
        NULL,
        'unspecified',
        '[]',
        '[]',
        '[]',
        '[]'
    FROM cases c;

    INSERT OR IGNORE INTO case_problems (
        id, case_id, task_kind, since, until, notes_local
    )
    SELECT
        lower(hex(randomblob(16))),
        cf.id,
        cf.primary_task_kind,
        cf.opened_at,
        NULL,
        ''
    FROM case_files cf;

    INSERT OR IGNORE INTO case_subject_categories (
        case_id, category, is_primary
    )
    SELECT
        id,
        'normal',
        1
    FROM case_files;

    UPDATE app_config
    SET schema_version = 10
    WHERE id = 1 AND schema_version < 10;

    CREATE INDEX IF NOT EXISTS idx_case_files_status
        ON case_files(status, opened_at);
    CREATE INDEX IF NOT EXISTS idx_case_files_task
        ON case_files(primary_task_kind);
    CREATE INDEX IF NOT EXISTS idx_case_problems_case
        ON case_problems(case_id, task_kind);
    CREATE INDEX IF NOT EXISTS idx_case_subject_categories_category
        ON case_subject_categories(category, is_primary);
    CREATE INDEX IF NOT EXISTS idx_case_risk_scores_case_week
        ON case_risk_scores(case_id, period_week);
    CREATE INDEX IF NOT EXISTS idx_case_intake_sections_case
        ON case_intake_sections(case_id, section_kind, version);
    "#,
    // 0011: Phase A IPR (individual prevention plan) schema (Sprint 2).
    //
    // Two new tables, both additive, both bound to `case_files` by ON DELETE
    // CASCADE so closing a case cleans up the plan attached to it:
    //
    //   * `iprs`       — header of one prevention plan. A case can have
    //                    several plans over time (e.g. one per academic
    //                    year), so we don't enforce uniqueness on
    //                    (case_id, status); the UI / dashboard layer
    //                    decides which one is "current".
    //   * `ipr_steps`  — concrete actionable steps inside a plan, with
    //                    explicit ordering, target dates and lifecycle.
    //
    // `case_touches.ipr_id` and `case_touches.ipr_step_id` columns already
    // exist since 0007 but were intentionally not FK-constrained — adding
    // FKs after the fact requires a table rebuild and we want to leave
    // historical touches with NULL ipr_id alone. The check on those
    // columns is done at the IPC layer via `validate_ipr_*` helpers.
    //
    // Phase A spec § 2.6: IPR in Phase A is **manually filled by the
    // psychologist** — there is no auto-generation from the worker-mock
    // "Architect". `IprExportPanel.tsx` keeps its DOCX renderer, but
    // step text and ordering live here from now on.
    r#"
    CREATE TABLE IF NOT EXISTS iprs (
        id           TEXT PRIMARY KEY NOT NULL,
        case_id      TEXT NOT NULL REFERENCES case_files(id) ON DELETE CASCADE,
        title        TEXT NOT NULL DEFAULT '',
        description  TEXT NOT NULL DEFAULT '',
        status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                         'draft',
                         'active',
                         'completed',
                         'archived'
                     )),
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ipr_steps (
        id           TEXT PRIMARY KEY NOT NULL,
        ipr_id       TEXT NOT NULL REFERENCES iprs(id) ON DELETE CASCADE,
        order_no     INTEGER NOT NULL CHECK (order_no >= 0),
        title        TEXT NOT NULL DEFAULT '',
        description  TEXT NOT NULL DEFAULT '',
        target_date  TEXT,
        status       TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
                         'planned',
                         'in_progress',
                         'completed',
                         'skipped'
                     )),
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        UNIQUE (ipr_id, order_no)
    );

    CREATE INDEX IF NOT EXISTS idx_iprs_case_status
        ON iprs(case_id, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ipr_steps_ipr
        ON ipr_steps(ipr_id, order_no);

    UPDATE app_config
    SET schema_version = 11
    WHERE id = 1 AND schema_version < 11;
    "#,
    // 0012: Phase A year plan tasks (Sprint 3, reconciliation §7 step 9).
    //
    // Psychologist-level workload planning for the school year. Not tied to
    // a single child — progress is measured via `case_touches.task_id`.
    r#"
    CREATE TABLE IF NOT EXISTS year_plan_tasks (
        id                  TEXT PRIMARY KEY NOT NULL,
        title               TEXT NOT NULL,
        task_kind           TEXT NOT NULL CHECK (task_kind IN (
                                'prevention_campaign',
                                'screening',
                                'training_program',
                                'consultation_program',
                                'methodology_work',
                                'admin_other'
                            )),
        description         TEXT NOT NULL DEFAULT '',
        target_groups       TEXT NOT NULL DEFAULT '[]',
        planned_minutes     INTEGER NOT NULL DEFAULT 0 CHECK (planned_minutes >= 0),
        school_year         TEXT NOT NULL,
        status              TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
                                'planned',
                                'in_progress',
                                'completed',
                                'cancelled'
                            )),
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_year_plan_tasks_year_status
        ON year_plan_tasks(school_year, status, updated_at DESC);

    UPDATE app_config
    SET schema_version = 12
    WHERE id = 1 AND schema_version < 12;
    "#,
    // 0013: Phase A incoming request journal (Sprint 3, step 10a).
    //
    // Separates «incoming ask» from `case_files`. Conversion to a case is
    // explicit and traceable via `case_id` + status `converted_to_case`.
    r#"
    CREATE TABLE IF NOT EXISTS request_log (
        id                  TEXT PRIMARY KEY NOT NULL,
        received_at         TEXT NOT NULL,
        week_bucket         TEXT NOT NULL,
        source              TEXT NOT NULL CHECK (source IN (
                                'parent',
                                'teacher',
                                'administration',
                                'student',
                                'external_specialist',
                                'self_initiated',
                                'other'
                            )),
        subject_shadow_id   TEXT NOT NULL DEFAULT '',
        topic_text          TEXT NOT NULL,
        urgency             TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN (
                                'normal', 'high', 'crisis'
                            )),
        status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
                                'open',
                                'in_triage',
                                'converted_to_case',
                                'closed_without_case'
                            )),
        case_id             TEXT REFERENCES case_files(id) ON DELETE SET NULL,
        closed_at           TEXT,
        close_reason        TEXT,
        notes_local         TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_request_log_status_received
        ON request_log(status, received_at DESC);
    CREATE INDEX IF NOT EXISTS idx_request_log_case
        ON request_log(case_id);

    UPDATE app_config
    SET schema_version = 13
    WHERE id = 1 AND schema_version < 13;
    "#,
    // 0014: Phase A external referrals (Sprint 4, reconciliation step 11).
    r#"
    CREATE TABLE IF NOT EXISTS referrals (
        id                  TEXT PRIMARY KEY NOT NULL,
        case_id             TEXT NOT NULL REFERENCES case_files(id) ON DELETE CASCADE,
        request_id          TEXT REFERENCES request_log(id) ON DELETE SET NULL,
        referred_to         TEXT NOT NULL CHECK (referred_to IN (
                                'psychiatric_dispensary',
                                'private_psychologist',
                                'crisis_center',
                                'social_services',
                                'medical_clinic',
                                'other'
                            )),
        referred_to_name    TEXT NOT NULL DEFAULT '',
        reason_text         TEXT NOT NULL,
        urgency             TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN (
                                'normal', 'high', 'crisis'
                            )),
        status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                                'pending',
                                'sent',
                                'acknowledged',
                                'completed',
                                'cancelled'
                            )),
        referred_at         TEXT NOT NULL,
        follow_up_at        TEXT,
        notes_local         TEXT NOT NULL DEFAULT '',
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_referrals_case_status
        ON referrals(case_id, status, referred_at DESC);

    UPDATE app_config
    SET schema_version = 14
    WHERE id = 1 AND schema_version < 14;
    "#,
    // 0015: Phase A audit trail + aggregate run journal (Sprint 4, step 12).
    r#"
    CREATE TABLE IF NOT EXISTS audit_log (
        id              TEXT PRIMARY KEY NOT NULL,
        occurred_at     TEXT NOT NULL,
        actor_id        INTEGER NOT NULL DEFAULT 1,
        action          TEXT NOT NULL CHECK (action IN (
                            'insert', 'update', 'delete', 'status_change'
                        )),
        table_name      TEXT NOT NULL,
        record_id       TEXT NOT NULL,
        changed_fields  TEXT NOT NULL DEFAULT '{}',
        ip_hash         TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_audit_log_table_record
        ON audit_log(table_name, record_id, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_log_occurred
        ON audit_log(occurred_at DESC);

    CREATE TABLE IF NOT EXISTS aggregate_runs (
        id              TEXT PRIMARY KEY NOT NULL,
        started_at      TEXT NOT NULL,
        completed_at    TEXT,
        status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                            'pending', 'running', 'completed', 'failed'
                        )),
        records_sent    INTEGER NOT NULL DEFAULT 0,
        error_message   TEXT
    );

    UPDATE app_config
    SET schema_version = 15
    WHERE id = 1 AND schema_version < 15;
    "#,
    // 0016: IDA embed local inbox (CENTER_INBOX_API.md).
    r#"
    CREATE TABLE IF NOT EXISTS leads (
        id              TEXT PRIMARY KEY NOT NULL,
        center_id       TEXT NOT NULL,
        name            TEXT NOT NULL,
        contact         TEXT NOT NULL,
        specialist_id   TEXT,
        intake_json     TEXT NOT NULL DEFAULT '{}',
        source          TEXT,
        user_id         TEXT,
        status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
                            'new', 'contacted', 'converted', 'closed'
                        )),
        created_at      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_leads_center_status
        ON leads(center_id, status, created_at DESC);

    UPDATE app_config
    SET schema_version = 16
    WHERE id = 1 AND schema_version < 16;
    "#,
    // 0017: org profile — approximate learner count for rollup context.
    r#"
    ALTER TABLE org_profile ADD COLUMN approx_learner_count INTEGER
        CHECK (approx_learner_count IS NULL OR approx_learner_count >= 0);

    UPDATE app_config
    SET schema_version = 17
    WHERE id = 1 AND schema_version < 17;
    "#,
    // 0018: Site portal — embed credentials and center binding for director Site tab.
    r#"
    CREATE TABLE IF NOT EXISTS site_portal (
        id                      INTEGER PRIMARY KEY CHECK (id = 1),
        center_id               TEXT NOT NULL DEFAULT '',
        setup_token             TEXT NOT NULL DEFAULT '',
        inbox_login             TEXT NOT NULL DEFAULT '',
        inbox_password          TEXT NOT NULL DEFAULT '',
        iconostasis_columns     INTEGER NOT NULL DEFAULT 3
            CHECK (iconostasis_columns BETWEEN 1 AND 6)
    );

    INSERT OR IGNORE INTO site_portal (
        id, center_id, setup_token, inbox_login, inbox_password, iconostasis_columns
    ) VALUES (1, '', '', '', '', 3);

    UPDATE app_config
    SET schema_version = 18
    WHERE id = 1 AND schema_version < 18;
    "#,
    // 0019: org sphere, education org type, OVZ learner count (analytics / dashboards).
    r#"
    ALTER TABLE org_profile ADD COLUMN org_sphere TEXT NOT NULL DEFAULT 'education_system'
        CHECK (org_sphere IN (
            'education_system', 'youth_policy', 'social_work', 'law_enforcement', 'other'
        ));

    ALTER TABLE org_profile ADD COLUMN org_sphere_other TEXT NOT NULL DEFAULT '';

    ALTER TABLE org_profile ADD COLUMN education_org_type TEXT
        CHECK (education_org_type IS NULL OR education_org_type IN (
            'pre_primary', 'primary', 'lower_secondary', 'upper_secondary',
            'supplementary', 'correctional', 'ppms_center',
            'bachelor', 'master', 'doctoral'
        ));

    ALTER TABLE org_profile ADD COLUMN approx_learner_ovz_count INTEGER
        CHECK (approx_learner_ovz_count IS NULL OR approx_learner_ovz_count >= 0);

    UPDATE app_config
    SET schema_version = 19
    WHERE id = 1 AND schema_version < 19;
    "#,
    // 0020: journal of group prevention sessions (local-first, no PII).
    r#"
    CREATE TABLE IF NOT EXISTS group_sessions (
        session_id        TEXT PRIMARY KEY NOT NULL,
        title             TEXT NOT NULL,
        session_date      TEXT NOT NULL,
        duration_minutes  INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
        theme             TEXT NOT NULL DEFAULT '',
        notes             TEXT NOT NULL DEFAULT '',
        created_at        TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_group_sessions_date
        ON group_sessions(session_date DESC, created_at DESC);

    UPDATE app_config
    SET schema_version = 20
    WHERE id = 1 AND schema_version < 20;
    "#,
    // 0021: group session AI artifacts (plan/report text stored with card).
    r#"
    ALTER TABLE group_sessions ADD COLUMN plan_text TEXT NOT NULL DEFAULT '';
    ALTER TABLE group_sessions ADD COLUMN report_text TEXT NOT NULL DEFAULT '';
    ALTER TABLE group_sessions ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

    UPDATE group_sessions
    SET updated_at = created_at
    WHERE updated_at = '' OR updated_at IS NULL;

    UPDATE app_config
    SET schema_version = 21
    WHERE id = 1 AND schema_version < 21;
    "#,
    // 0022: IPR + organization program cards — AI artifacts (plan/report/expert JSON).
    r#"
    ALTER TABLE iprs ADD COLUMN plan_text TEXT NOT NULL DEFAULT '';
    ALTER TABLE iprs ADD COLUMN report_text TEXT NOT NULL DEFAULT '';
    ALTER TABLE iprs ADD COLUMN artifacts_json TEXT NOT NULL DEFAULT '{}';

    CREATE TABLE IF NOT EXISTS organization_programs (
        program_id        TEXT PRIMARY KEY NOT NULL,
        title             TEXT NOT NULL,
        program_year      TEXT NOT NULL DEFAULT '',
        scope             TEXT NOT NULL DEFAULT '',
        notes             TEXT NOT NULL DEFAULT '',
        plan_text         TEXT NOT NULL DEFAULT '',
        report_text       TEXT NOT NULL DEFAULT '',
        artifacts_json    TEXT NOT NULL DEFAULT '{}',
        created_at        TEXT NOT NULL,
        updated_at        TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_organization_programs_year
        ON organization_programs(program_year DESC, updated_at DESC);

    UPDATE app_config
    SET schema_version = 22
    WHERE id = 1 AND schema_version < 22;
    "#,
    // 0023: case-level artifacts (expertise digital twin, not tied to a visit).
    r#"
    ALTER TABLE cases ADD COLUMN case_artifacts_json TEXT NOT NULL DEFAULT '{}';

    UPDATE app_config
    SET schema_version = 23
    WHERE id = 1 AND schema_version < 23;
    "#,
    // 0024: target audience JSON + prevention link on program cards.
    r#"
    ALTER TABLE group_sessions ADD COLUMN audience_json TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE iprs ADD COLUMN audience_json TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE organization_programs ADD COLUMN audience_json TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE organization_programs ADD COLUMN prevention_link TEXT NOT NULL DEFAULT '';

    UPDATE app_config
    SET schema_version = 24
    WHERE id = 1 AND schema_version < 24;
    "#,
    // 0025: group session plan artifacts (plan_segments / expert JSON).
    r#"
    ALTER TABLE group_sessions ADD COLUMN artifacts_json TEXT NOT NULL DEFAULT '{}';

    UPDATE app_config
    SET schema_version = 25
    WHERE id = 1 AND schema_version < 25;
    "#,
    // 0026: prevention work types multi-select on organization programs.
    r#"
    ALTER TABLE organization_programs ADD COLUMN prevention_work_types_json TEXT NOT NULL DEFAULT '{}';

    UPDATE app_config
    SET schema_version = 26
    WHERE id = 1 AND schema_version < 26;
    "#,
    // 0027: prevention link + work types on group session plans.
    r#"
    ALTER TABLE group_sessions ADD COLUMN prevention_link TEXT NOT NULL DEFAULT 'L1_universal';
    ALTER TABLE group_sessions ADD COLUMN prevention_work_types_json TEXT NOT NULL DEFAULT '{}';

    UPDATE app_config
    SET schema_version = 27
    WHERE id = 1 AND schema_version < 27;
    "#,
    // 0028: thematic session tags on group plans and IPR.
    r#"
    ALTER TABLE group_sessions ADD COLUMN session_tags_json TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE iprs ADD COLUMN session_tags_json TEXT NOT NULL DEFAULT '{}';

    UPDATE app_config
    SET schema_version = 28
    WHERE id = 1 AND schema_version < 28;
    "#,
    // 0029: universal workload journal (work_entries) for school forms 4A–4G.
    r#"
    CREATE TABLE IF NOT EXISTS work_entries (
        entry_id            TEXT PRIMARY KEY NOT NULL,
        work_date           TEXT NOT NULL,
        minutes_actual      INTEGER NOT NULL CHECK (minutes_actual > 0),
        activity_kind       TEXT NOT NULL,
        effort_phase        TEXT NOT NULL DEFAULT '',
        title               TEXT NOT NULL DEFAULT '',
        notes               TEXT NOT NULL DEFAULT '',
        subject_label       TEXT NOT NULL DEFAULT '',
        case_id             TEXT,
        plan_id             TEXT,
        audience_note       TEXT NOT NULL DEFAULT '',
        audience_contingent TEXT NOT NULL DEFAULT '',
        time_start          TEXT NOT NULL DEFAULT '',
        time_end            TEXT NOT NULL DEFAULT '',
        referrer            TEXT NOT NULL DEFAULT '',
        visit_kind          TEXT NOT NULL DEFAULT '',
        anonymous_code      TEXT NOT NULL DEFAULT '',
        event_form          TEXT NOT NULL DEFAULT '',
        diagnostic_kind     TEXT NOT NULL DEFAULT '',
        co_executors_text   TEXT NOT NULL DEFAULT '',
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_work_entries_date
        ON work_entries(work_date DESC, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_work_entries_kind_date
        ON work_entries(activity_kind, work_date DESC);

    UPDATE app_config
    SET schema_version = 29
    WHERE id = 1 AND schema_version < 29;
    "#,
    // 0030: external booking URL for center embed (director Site tab).
    r#"
    ALTER TABLE site_portal ADD COLUMN consult_booking_url TEXT NOT NULL DEFAULT '';
    ALTER TABLE site_portal ADD COLUMN booking_mode TEXT NOT NULL DEFAULT 'prevention'
        CHECK (booking_mode IN ('prevention', 'external'));

    UPDATE app_config
    SET schema_version = 30
    WHERE id = 1 AND schema_version < 30;
    "#,
    // 0031: public site origin + per-page path overrides (director Site tab).
    r#"
    ALTER TABLE site_portal ADD COLUMN public_site_origin TEXT NOT NULL DEFAULT '';
    ALTER TABLE site_portal ADD COLUMN site_page_paths_json TEXT NOT NULL DEFAULT '{"consult":"/specialists","register":"/staff-register","iconostasis":"/specialists","chat":"/chat"}';

    UPDATE app_config
    SET schema_version = 31
    WHERE id = 1 AND schema_version < 31;
    "#,
    // 0032: optional HTTPS webhook for lead export (Google Sheets Apps Script).
    r#"
    ALTER TABLE site_portal ADD COLUMN leads_export_webhook_url TEXT NOT NULL DEFAULT '';

    UPDATE app_config
    SET schema_version = 32
    WHERE id = 1 AND schema_version < 32;
    "#,
    // 0033: calendar slots + specialist payroll settings.
    r#"
    CREATE TABLE IF NOT EXISTS calendar_slots (
        slot_id            TEXT PRIMARY KEY NOT NULL,
        case_id            TEXT NOT NULL,
        specialist_id      TEXT NOT NULL,
        start_time         INTEGER NOT NULL,
        end_time           INTEGER NOT NULL,
        buffer_minutes     INTEGER NOT NULL DEFAULT 0,
        recurrence_weeks   INTEGER NOT NULL DEFAULT 0,
        visit_status       TEXT NOT NULL DEFAULT 'scheduled',
        client_name        TEXT NOT NULL DEFAULT '',
        notes              TEXT NOT NULL DEFAULT ''
    );

    ALTER TABLE specialist_profile ADD COLUMN rate_type TEXT NOT NULL DEFAULT 'fixed';
    ALTER TABLE specialist_profile ADD COLUMN rate_value REAL NOT NULL DEFAULT 0.0;

    UPDATE app_config
    SET schema_version = 33
    WHERE id = 1 AND schema_version < 33;
    "#,
    r#"
    -- 0034: Notes for IPR steps
    ALTER TABLE ipr_steps ADD COLUMN notes TEXT NOT NULL DEFAULT '';

    UPDATE app_config
    SET schema_version = 34
    WHERE id = 1 AND schema_version < 34;
    "#,
];

// --- Тесты --------------------------------------------------------------
//
// Тесты подтверждают:
//   * derive_key детерминирован при одинаковых password + salt.
//   * Смена пароля или соли даёт другой ключ.
//   * Round-trip open → reopen с тем же паролем работает.
//   * Reopen с неверным паролем падает именно в InvalidPassword,
//     а не в произвольную SqliteFailure.
//
// Argon2id с m=64 MiB — операция тяжёлая, поэтому в CI запускаем тесты
// с `cargo test --release`. В обычном dev-run каждый derive занимает
// ~0.5–1.5 с — это намеренно (защита от брутфорса).

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_db_path(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("prevention_terminal_db_test_{name}_{nanos}"));
        fs::create_dir_all(&dir).expect("create tmp dir");
        dir.join(format!("{name}.sqlite"))
    }

    #[test]
    fn derive_key_is_deterministic() {
        let salt = [7u8; SALT_LEN];
        let k1 = derive_key("correct horse battery staple", &salt).unwrap();
        let k2 = derive_key("correct horse battery staple", &salt).unwrap();
        assert_eq!(k1.as_bytes(), k2.as_bytes());
    }

    #[test]
    fn derive_key_differs_on_password_change() {
        let salt = [7u8; SALT_LEN];
        let k1 = derive_key("alpha", &salt).unwrap();
        let k2 = derive_key("beta", &salt).unwrap();
        assert_ne!(k1.as_bytes(), k2.as_bytes());
    }

    #[test]
    fn derive_key_differs_on_salt_change() {
        let k1 = derive_key("same-password", &[1u8; SALT_LEN]).unwrap();
        let k2 = derive_key("same-password", &[2u8; SALT_LEN]).unwrap();
        assert_ne!(k1.as_bytes(), k2.as_bytes());
    }

    #[test]
    fn open_then_reopen_with_same_password_works() {
        let db_path = tmp_db_path("reopen_ok");
        let pwd = "T0p$ecret-Master-PA55";
        {
            // Первый открыть — создаёт БД, соль и применяет миграции.
            let _db = EncryptedDb::open(&db_path, pwd).unwrap();
        }
        // Соль уже на диске рядом с БД — повторно открываем с тем же паролем.
        let db = EncryptedDb::open(&db_path, pwd).unwrap();
        let n: i64 = db
            .connection()
            .query_row("SELECT count(*) FROM cases", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn reopen_with_wrong_password_fails_with_invalid_password() {
        let db_path = tmp_db_path("reopen_bad");
        {
            let _db = EncryptedDb::open(&db_path, "correct").unwrap();
        }
        let err = EncryptedDb::open(&db_path, "WRONG").err().unwrap();
        assert!(
            matches!(err, DbError::InvalidPassword),
            "expected InvalidPassword, got {err:?}"
        );
    }

    #[test]
    fn default_salt_path_appends_suffix() {
        let p = Path::new("cases.sqlite");
        assert_eq!(default_salt_path(p), PathBuf::from("cases.sqlite.salt"));
    }

    #[test]
    fn pd_aliases_schema_accepts_valid_insert() {
        // Контракт: после миграций таблица pd_aliases существует с новой
        // схемой (alias_id PK + case_id + role + role_no + real_name) и
        // принимает связную строку. Это страховка от регрессии при будущих
        // правках миграции 0002 — если кто-то случайно вернёт старую
        // HMAC-схему, этот тест упадёт на «no such column: case_id».
        let db_path = tmp_db_path("aliases_schema");
        let db = EncryptedDb::open(&db_path, "T0p$ecret").unwrap();
        let conn = db.connection();

        // Сначала вставляем родительский case, чтобы соблюсти REFERENCES.
        conn.execute(
            "INSERT INTO cases (
                case_id, shadow_id, x_stage, y_level, m_modality,
                executor_role, org_scale, topic_tags, passport_json,
                notes_sanitized, created_at, updated_at
            ) VALUES ('c1', 'c1', 'X2_Diag', 'Y1_Normal', '[]',
                      'Психолог', 'Individual', '[]', '{}', '', '0', '0')",
            [],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO pd_aliases (
                alias_id, case_id, role, role_no, real_name, created_at
            ) VALUES ('a1', 'c1', 'student', 1, 'Иван Иванов', '0')",
            [],
        )
        .unwrap();

        let n: i64 = conn
            .query_row(
                "SELECT count(*) FROM pd_aliases WHERE case_id = 'c1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(n, 1);
    }

    #[test]
    fn foreign_keys_are_enabled_for_opened_connection() {
        let db_path = tmp_db_path("fk_enabled");
        let db = EncryptedDb::open(&db_path, "T0p$ecret").unwrap();
        let enabled: i64 = db
            .connection()
            .query_row("PRAGMA foreign_keys", [], |r| r.get(0))
            .unwrap();
        assert_eq!(enabled, 1);
    }

    #[test]
    fn migrations_are_idempotent_across_reopens() {
        // Регрессионный тест на новую логику schema_migrations.
        // Сценарий: записали алиас → закрыли БД → открыли заново → данные целы.
        // Если миграция 0002 будет ошибочно выполнена дважды (DROP + CREATE),
        // строка из pd_aliases исчезнет и тест упадёт.
        let db_path = tmp_db_path("migrations_idempotent");
        let pwd = "T0p$ecret-Master-PA55";
        {
            let db = EncryptedDb::open(&db_path, pwd).unwrap();
            let conn = db.connection();
            conn.execute(
                "INSERT INTO cases (
                    case_id, shadow_id, x_stage, y_level, m_modality,
                    executor_role, org_scale, topic_tags, passport_json,
                    notes_sanitized, created_at, updated_at
                ) VALUES ('c-idem', 'c-idem', 'X2_Diag', 'Y1_Normal', '[]',
                          'Психолог', 'Individual', '[]', '{}', '', '0', '0')",
                [],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO pd_aliases (
                    alias_id, case_id, role, role_no, real_name, created_at
                ) VALUES ('alias-1', 'c-idem', 'student', 1, 'Петя', '0')",
                [],
            )
            .unwrap();
        }
        // Повторное открытие → run_migrations() снова отрабатывает. Раньше
        // он бы дропнул pd_aliases; теперь — пропустит уже применённую 0002.
        let db = EncryptedDb::open(&db_path, pwd).unwrap();
        let real_name: String = db
            .connection()
            .query_row(
                "SELECT real_name FROM pd_aliases WHERE alias_id = 'alias-1'",
                [],
                |r| r.get(0),
            )
            .expect("строка алиаса должна пережить повторный run_migrations");
        assert_eq!(real_name, "Петя");

        // И сам учётчик миграций должен видеть применённые версии.
        let applied: i64 = db
            .connection()
            .query_row("SELECT count(*) FROM schema_migrations", [], |r| r.get(0))
            .unwrap();
        assert_eq!(applied as usize, MIGRATIONS_SQL.len());
    }

    #[test]
    fn session_records_schema_accepts_initial_and_followup_sessions() {
        let db_path = tmp_db_path("session_records_schema");
        let db = EncryptedDb::open(&db_path, "T0p$ecret").unwrap();
        let conn = db.connection();

        conn.execute(
            "INSERT INTO cases (
                case_id, shadow_id, x_stage, y_level, m_modality,
                executor_role, org_scale, topic_tags, passport_json,
                notes_sanitized, created_at, updated_at
            ) VALUES ('c-session', 'c-session', 'X2_Diag', 'Y1_Normal', '[]',
                      'Психолог', 'Individual', '[]', '{}', '', '0', '0')",
            [],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO session_records (
                record_id, case_id, session_no, content_json, recorded_at, created_at
            ) VALUES ('s0', 'c-session', 0, '{\"goals\":\"старт\"}', '0', '0')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO session_records (
                record_id, case_id, session_no, content_json, recorded_at, created_at
            ) VALUES ('s1', 'c-session', 1, '{\"goals\":\"динамика\"}', '1', '1')",
            [],
        )
        .unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM session_records WHERE case_id = 'c-session'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn load_or_init_salt_reuses_existing_file() {
        let dir = std::env::temp_dir().join(format!(
            "prevention_terminal_salt_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        fs::create_dir_all(&dir).unwrap();
        let salt_path = dir.join("x.salt");
        let s1 = load_or_init_salt(&salt_path).unwrap();
        let s2 = load_or_init_salt(&salt_path).unwrap();
        assert_eq!(s1, s2, "salt должна быть стабильна между вызовами");
    }
}
