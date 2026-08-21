//! Tauri 2 entry-point для приложения «Терминал Специалиста».
//!
//! Архитектурные принципы:
//!   * Никаких сетевых вызовов без явного user consent.
//!   * Все персональные данные учащихся живут только в локальной SQLite-БД (SQLCipher AES-256).
//!   * Ключ БД derive'ится из мастер-пароля пользователя через Argon2id
//!     при первом запуске и держится в памяти процесса (никогда на диске).
//!   * Команды Tauri (`#[tauri::command]`) — единственный канал между
//!     фронтендом и Rust-стороной.
//!   * IPC-мост (Phase 2.5): см. блок «Канонические команды БД» ниже.

mod db;
mod local_api;
mod registry_vault;

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

use rand::{Rng, RngCore};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use db::{default_salt_path, EncryptedDb};
use local_api::{inbox_public_url, inbox_viewer_url, start_inbox_server, DEFAULT_INBOX_PORT};

// ============================================================================
// Базовые диагностические команды
// ============================================================================

#[derive(Debug, Serialize)]
struct AppMeta {
    name: &'static str,
    version: &'static str,
    crate_built: &'static str,
}

/// Простейшая команда для smoke-теста IPC: возвращает версию приложения.
#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Метаинформация для UI / диагностики.
#[tauri::command]
fn app_meta() -> AppMeta {
    AppMeta {
        name: env!("CARGO_PKG_NAME"),
        version: env!("CARGO_PKG_VERSION"),
        crate_built: env!("CARGO_PKG_DESCRIPTION"),
    }
}

// ============================================================================
// Phase 2.5 — Tauri IPC-мост к зашифрованной БД (in-memory key-holder)
// ============================================================================
//
// Контракт безопасности:
//   * `DbState` инициализируется как `None` при старте приложения.
//   * `EncryptedDb` (а вместе с ним и derive'нутый ключ) появляется
//     в памяти процесса ТОЛЬКО после успешного `db_unlock`.
//   * При `db_lock` мьютекс сбрасывается в `None`, что триггерит Drop
//     для `EncryptedDb`. `rusqlite::Connection` закрывается, а `DbKey`
//     с `Zeroizing<[u8; 32]>` зачищает ключ нулями.
//   * Ни одна команда не возвращает наружу сам ключ, hex-ключ, или
//     путь к соли — UI оперирует только семафорами «инициализировано
//     / разблокировано / заблокировано».
//
// Имя файла БД и его расположение:
//   * `<app_data_dir>/profiles/<slug>/cases.sqlite`
//     (Win: %APPDATA%\school.prevention.terminal\profiles\<slug>\)
//   * Соль рядом: `<profile_dir>/cases.sqlite.salt`.
//   * Фронтенд выбирает только profile_slug из списка, а Rust валидирует
//     slug и полностью владеет реальными путями.

/// Имя файла локальной БД внутри `app_data_dir`.
const DB_FILE_NAME: &str = "cases.sqlite";
const PROFILES_DIR_NAME: &str = "profiles";
const PROFILE_META_FILE_NAME: &str = "profile.json";
const INSTALLATION_META_FILE_NAME: &str = "installation_meta.json";
const TERMINAL_CONFIG_FILE_NAME: &str = "terminal_config.json";
const DEFAULT_PROFILE_SLUG: &str = "default";

/// Потокобезопасный контейнер активной сессии БД.
/// `None` означает «БД не разблокирована» — это начальное и безопасное состояние.
pub struct DbState(pub Arc<Mutex<Option<EncryptedDb>>>);

impl DbState {
    fn empty() -> Self {
        Self(Arc::new(Mutex::new(None)))
    }

    pub fn inner(&self) -> Arc<Mutex<Option<EncryptedDb>>> {
        self.0.clone()
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct ProfileMeta {
    display_name: String,
}

#[derive(Debug, Serialize)]
struct ProfileInfo {
    slug: String,
    display_name: String,
    is_initialized: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct InstallationMeta {
    install_id: String,
    country: String,
    region: String,
    municipality: String,
    settlement: String,
    #[serde(default)]
    lat: Option<f64>,
    #[serde(default)]
    lng: Option<f64>,
    organization_type: String,
    organization_label: String,
    org_unit_id: Option<String>,
    org_unit_status: String,
    telemetry_consent: bool,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct InstallationMetaInput {
    country: String,
    region: String,
    municipality: String,
    settlement: String,
    #[serde(default)]
    lat: Option<f64>,
    #[serde(default)]
    lng: Option<f64>,
    organization_type: String,
    organization_label: String,
    telemetry_consent: bool,
}

fn default_workspace_preset() -> String {
    "specialist".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct TerminalConfig {
    terminal_user_id: String,
    edition: String,
    mode: String,
    #[serde(default = "default_workspace_preset")]
    workspace_preset: String,
    org_type: Option<String>,
    #[serde(default)]
    manager_scope: Option<String>,
    job_title: String,
    child_invite_code: String,
    parent_invite_code: Option<String>,
    parent_invite_in: Option<String>,
    child_invite_in: Option<String>,
    consumer_app: Option<String>,
    enabled_modules: std::collections::BTreeMap<String, bool>,
    #[serde(default)]
    registry_enabled: bool,
    #[serde(default)]
    research_contribution_enabled: bool,
    #[serde(default)]
    research_contribution_consented_at: Option<String>,
    #[serde(default)]
    research_contribution_consent_version: Option<String>,
    #[serde(default)]
    research_contribution_last_period_key: Option<String>,
    #[serde(default)]
    registry_vault_initialized: bool,
    #[serde(default)]
    registry_recovery_key_hash: Option<String>,
    onboarding_complete: bool,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct TerminalConfigInput {
    edition: String,
    mode: String,
    workspace_preset: Option<String>,
    org_type: Option<String>,
    manager_scope: Option<String>,
    job_title: String,
    child_invite_code: String,
    parent_invite_code: Option<String>,
    parent_invite_in: Option<String>,
    child_invite_in: Option<String>,
    consumer_app: Option<String>,
    enabled_modules: std::collections::BTreeMap<String, bool>,
    #[serde(default)]
    registry_enabled: bool,
    #[serde(default)]
    research_contribution_enabled: Option<bool>,
    #[serde(default)]
    research_contribution_consented_at: Option<String>,
    #[serde(default)]
    research_contribution_consent_version: Option<String>,
    #[serde(default)]
    research_contribution_last_period_key: Option<String>,
    #[serde(default)]
    registry_vault_initialized: Option<bool>,
    #[serde(default)]
    registry_recovery_key_hash: Option<String>,
}

#[derive(Debug, Serialize)]
struct OrgProfile {
    display_name: String,
    isced_level: i64,
    org_kind: String,
    normative_overrides: String,
    #[serde(default)]
    approx_learner_count: Option<i64>,
    #[serde(default)]
    org_sphere: String,
    #[serde(default)]
    org_sphere_other: String,
    #[serde(default)]
    education_org_type: Option<String>,
    #[serde(default)]
    approx_learner_ovz_count: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct OrgProfileInput {
    display_name: String,
    isced_level: i64,
    org_kind: String,
    #[serde(default)]
    normative_overrides: Option<String>,
    #[serde(default)]
    approx_learner_count: Option<i64>,
    #[serde(default = "default_org_sphere")]
    org_sphere: String,
    #[serde(default)]
    org_sphere_other: Option<String>,
    #[serde(default)]
    education_org_type: Option<String>,
    #[serde(default)]
    approx_learner_ovz_count: Option<i64>,
}

fn default_org_sphere() -> String {
    "education_system".to_string()
}

#[derive(Debug, Serialize)]
struct SpecialistProfile {
    display_name: String,
    role_text: String,
    weekly_contract_minutes: i64,
    rate_type: String,
    rate_value: f64,
}

#[derive(Debug, Deserialize)]
struct SpecialistProfileInput {
    display_name: String,
    role_text: String,
    weekly_contract_minutes: i64,
    rate_type: String,
    rate_value: f64,
}

// ----------------------------------------------------------------------------
// Phase A Sprint 2 — IPR (Individual Prevention Plan) DTOs
// ----------------------------------------------------------------------------
//
// Контракт безопасности: title/description могут содержать локально
// набранный текст психолога. Они НИКОГДА не уходят в сетевой контур
// (см. ADR-002 — наружу могут отправляться только агрегаты, не raw text).
// Длины ограничены, чтобы UI/БД не давились мегабайтным мусором.

const IPR_STATUS_VALUES: &[&str] = &["draft", "active", "completed", "archived"];
const PREVENTION_LINK_VALUES: &[&str] = &[
    "L1_universal",
    "L2_selective",
    "L3_indicated",
    "L4_secondary",
    "L5_tertiary",
];
const IPR_STEP_STATUS_VALUES: &[&str] =
    &["planned", "in_progress", "completed", "skipped"];

const YEAR_PLAN_TASK_KIND_VALUES: &[&str] = &[
    "prevention_campaign",
    "screening",
    "training_program",
    "consultation_program",
    "methodology_work",
    "admin_other",
];
const YEAR_PLAN_TASK_STATUS_VALUES: &[&str] =
    &["planned", "in_progress", "completed", "cancelled"];

const REQUEST_SOURCE_VALUES: &[&str] = &[
    "parent",
    "teacher",
    "administration",
    "student",
    "external_specialist",
    "self_initiated",
    "other",
];
const REQUEST_URGENCY_VALUES: &[&str] = &["normal", "high", "crisis"];
const REQUEST_STATUS_VALUES: &[&str] = &[
    "open",
    "in_triage",
    "converted_to_case",
    "closed_without_case",
];

const REFERRAL_TARGET_VALUES: &[&str] = &[
    "psychiatric_dispensary",
    "private_psychologist",
    "crisis_center",
    "social_services",
    "medical_clinic",
    "other",
];
const REFERRAL_STATUS_VALUES: &[&str] = &[
    "pending",
    "sent",
    "acknowledged",
    "completed",
    "cancelled",
];
const AUDIT_ACTION_VALUES: &[&str] = &["insert", "update", "delete", "status_change"];

const CASE_PRIMARY_TASK_KIND_VALUES: &[&str] = &[
    "bullying_victim",
    "bullying_aggressor",
    "self_harm_suicidal",
    "academic_motivation",
    "family_conflict",
    "family_crisis",
    "addiction_substance",
    "addiction_screen",
    "anxiety_fears",
    "depressive_state",
    "loneliness_isolation",
    "identity_self_esteem",
    "trauma_experience",
    "criminal_behavior",
    "other",
];

const IPR_TITLE_MAX: usize = 200;
const IPR_DESCRIPTION_MAX: usize = 4000;
const IPR_STEP_TITLE_MAX: usize = 200;
const IPR_STEP_DESCRIPTION_MAX: usize = 4000;

const YEAR_PLAN_TITLE_MAX: usize = 200;
const YEAR_PLAN_DESCRIPTION_MAX: usize = 4000;
const YEAR_PLAN_SCHOOL_YEAR_MAX: usize = 16;
const YEAR_PLAN_TARGET_GROUPS_MAX: usize = 8000;

const REQUEST_TOPIC_MAX: usize = 4000;
const REQUEST_SUBJECT_SHADOW_MAX: usize = 120;
const REQUEST_NOTES_MAX: usize = 4000;
const REQUEST_CLOSE_REASON_MAX: usize = 500;

const CASE_NOTES_MAX: usize = 8000;
const CASE_CHILD_NAME_MAX: usize = 256;

const REFERRAL_REASON_MAX: usize = 4000;
const REFERRAL_NAME_MAX: usize = 256;
const REFERRAL_NOTES_MAX: usize = 4000;

#[derive(Debug, Serialize)]
struct Ipr {
    id: String,
    case_id: String,
    title: String,
    description: String,
    status: String,
    plan_text: String,
    report_text: String,
    artifacts_json: String,
    audience_json: String,
    session_tags_json: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
struct IprStep {
    id: String,
    ipr_id: String,
    order_no: i64,
    title: String,
    description: String,
    target_date: Option<String>,
    status: String,
    notes: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct IprCreateInput {
    case_id: String,
    title: String,
    #[serde(default)]
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct IprUpdateInput {
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    plan_text: Option<String>,
    #[serde(default)]
    report_text: Option<String>,
    #[serde(default)]
    artifacts_json: Option<String>,
    #[serde(default)]
    audience_json: Option<String>,
    #[serde(default)]
    session_tags_json: Option<String>,
}

#[derive(Debug, Deserialize)]
struct IprStepCreateInput {
    ipr_id: String,
    title: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    target_date: Option<String>,
}

#[derive(Debug, Deserialize)]
struct IprStepUpdateInput {
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    target_date: Option<String>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    notes: Option<String>,
    #[serde(default)]
    order_no: Option<i64>,
}

#[derive(Debug, Serialize)]
struct YearPlanTask {
    id: String,
    title: String,
    task_kind: String,
    description: String,
    target_groups: String,
    planned_minutes: i64,
    school_year: String,
    status: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct YearPlanTaskCreateInput {
    title: String,
    task_kind: String,
    school_year: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    target_groups: Option<String>,
    #[serde(default)]
    planned_minutes: Option<i64>,
    #[serde(default)]
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct YearPlanTaskUpdateInput {
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    task_kind: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    target_groups: Option<String>,
    #[serde(default)]
    planned_minutes: Option<i64>,
    #[serde(default)]
    school_year: Option<String>,
    #[serde(default)]
    status: Option<String>,
}

#[derive(Debug, Serialize)]
struct RequestLogEntry {
    id: String,
    received_at: String,
    week_bucket: String,
    source: String,
    subject_shadow_id: String,
    topic_text: String,
    urgency: String,
    status: String,
    case_id: Option<String>,
    closed_at: Option<String>,
    close_reason: Option<String>,
    notes_local: String,
}

#[derive(Debug, Deserialize)]
struct RequestCreateInput {
    source: String,
    topic_text: String,
    #[serde(default)]
    subject_shadow_id: Option<String>,
    #[serde(default)]
    urgency: Option<String>,
    #[serde(default)]
    notes_local: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RequestListFilter {
    #[serde(default)]
    statuses: Option<Vec<String>>,
    #[serde(default)]
    urgencies: Option<Vec<String>>,
    #[serde(default)]
    received_after: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RequestStatusUpdateInput {
    status: String,
    #[serde(default)]
    close_reason: Option<String>,
    #[serde(default)]
    case_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CaseFromRequestInput {
    #[serde(default)]
    primary_task_kind: Option<String>,
    #[serde(default)]
    notes_local: Option<String>,
    #[serde(default)]
    child_full_name_enc: Option<String>,
}

#[derive(Debug, Serialize)]
struct RequestPreview {
    id: String,
    received_at: String,
    source: String,
    subject_shadow_id: String,
    topic_text: String,
    urgency: String,
    status: String,
}

#[derive(Debug, Serialize)]
struct CasePreview {
    case_id: String,
    primary_task_kind: String,
    overdue_steps: i64,
}

#[derive(Debug, Serialize)]
struct YearPlanTaskProgress {
    task_id: String,
    title: String,
    planned_minutes: i64,
    actual_minutes: i64,
    progress_pct: i64,
}

#[derive(Debug, Serialize)]
struct DashboardL1 {
    specialist_name: String,
    org_name: String,
    school_year: String,
    week_planned_minutes: i64,
    week_actual_minutes: i64,
    week_contract_minutes: i64,
    week_load_pct: i64,
    week_consultation_count: i64,
    week_consultation_minutes: i64,
    total_consultation_count: i64,
    elevated_risk_sessions: i64,
    open_requests_count: i64,
    crisis_requests_count: i64,
    oldest_open_requests: Vec<RequestPreview>,
    active_cases_count: i64,
    cases_with_overdue_steps: Vec<CasePreview>,
    year_plan_progress: Vec<YearPlanTaskProgress>,
    group_sessions_count: i64,
}

#[derive(Debug, Serialize)]
struct ThreatCategoryRow {
    category_key: String,
    month: String,
    incidents: i64,
    severe_incidents: i64,
    avg_severity: f64,
}

#[derive(Debug, Serialize)]
struct PreventionLevelRow {
    prevention_link: String,
    month: String,
    planned_hours: i64,
    planned_reach: i64,
    actual_hours: i64,
    actual_reach: i64,
}

#[derive(Debug, Serialize)]
struct MonthlySevereRow {
    month: String,
    severe_incidents: i64,
    elevated_consultations: i64,
}

#[derive(Debug, Serialize)]
struct ManagerDashboardTotals {
    active_cases: i64,
    open_requests: i64,
    crisis_requests: i64,
    group_sessions_year: i64,
    organization_programs_year: i64,
}

#[derive(Debug, Serialize)]
struct ManagerDashboardL1 {
    org_name: String,
    school_year: String,
    threats: Vec<ThreatCategoryRow>,
    prevention_levels: Vec<PreventionLevelRow>,
    monthly_severe: Vec<MonthlySevereRow>,
    year_plan_progress: Vec<YearPlanTaskProgress>,
    totals: ManagerDashboardTotals,
}

#[derive(Debug, Serialize)]
struct Referral {
    id: String,
    case_id: String,
    request_id: Option<String>,
    referred_to: String,
    referred_to_name: String,
    reason_text: String,
    urgency: String,
    status: String,
    referred_at: String,
    follow_up_at: Option<String>,
    notes_local: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct ReferralCreateInput {
    case_id: String,
    referred_to: String,
    reason_text: String,
    #[serde(default)]
    request_id: Option<String>,
    #[serde(default)]
    referred_to_name: Option<String>,
    #[serde(default)]
    urgency: Option<String>,
    #[serde(default)]
    follow_up_at: Option<String>,
    #[serde(default)]
    notes_local: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ReferralStatusUpdateInput {
    status: String,
    #[serde(default)]
    notes_local: Option<String>,
}

#[derive(Debug, Serialize)]
struct AuditLogEntry {
    id: String,
    occurred_at: String,
    actor_id: i64,
    action: String,
    table_name: String,
    record_id: String,
    changed_fields: String,
    ip_hash: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AuditLogListFilter {
    #[serde(default)]
    table_name: Option<String>,
    #[serde(default)]
    record_id: Option<String>,
    #[serde(default)]
    limit: Option<i64>,
}

/// Резолвит канонический путь к локальной БД через Tauri path-resolver.
/// Создаёт каталог `app_data_dir`, если его ещё нет.
fn resolve_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?;
    Ok(dir.join(DB_FILE_NAME))
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    // 1. Проверяем Portable-режим: наличие portable.lock в текущей директории запуска
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            if exe_dir.join("portable.lock").exists() || exe_dir.join(".data").exists() {
                let p_dir = exe_dir.join(".data");
                let _ = std::fs::create_dir_all(&p_dir);
                return Ok(p_dir);
            }
        }
    }

    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("cannot resolve app_data_dir: {e}"))?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("cannot create app_data_dir {}: {e}", dir.display()))?;
    Ok(dir)
}

fn profiles_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?.join(PROFILES_DIR_NAME);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("cannot create profiles dir {}: {e}", dir.display()))?;
    Ok(dir)
}

fn installation_meta_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(INSTALLATION_META_FILE_NAME))
}

fn terminal_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(TERMINAL_CONFIG_FILE_NAME))
}

fn validate_profile_slug(slug: &str) -> Result<(), String> {
    if slug.is_empty() || slug.len() > 64 {
        return Err("invalid profile slug length".to_string());
    }
    if !slug
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
    {
        return Err("invalid profile slug".to_string());
    }
    Ok(())
}

fn profile_dir(app: &AppHandle, profile_slug: &str) -> Result<PathBuf, String> {
    validate_profile_slug(profile_slug)?;
    Ok(profiles_dir(app)?.join(profile_slug))
}

fn resolve_profile_db_path(app: &AppHandle, profile_slug: &str) -> Result<PathBuf, String> {
    let dir = profile_dir(app, profile_slug)?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("cannot create profile dir {}: {e}", dir.display()))?;
    Ok(dir.join(DB_FILE_NAME))
}

fn profile_meta_path(profile_dir: &Path) -> PathBuf {
    profile_dir.join(PROFILE_META_FILE_NAME)
}

fn read_profile_meta(profile_dir: &Path, fallback_slug: &str) -> ProfileMeta {
    let path = profile_meta_path(profile_dir);
    match std::fs::read_to_string(path) {
        Ok(raw) => serde_json::from_str::<ProfileMeta>(&raw).unwrap_or(ProfileMeta {
            display_name: fallback_slug.to_string(),
        }),
        Err(_) => ProfileMeta {
            display_name: fallback_slug.to_string(),
        },
    }
}

fn write_profile_meta(profile_dir: &Path, display_name: &str) -> Result<(), String> {
    let meta = ProfileMeta {
        display_name: display_name.trim().to_string(),
    };
    let raw = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("cannot serialize profile meta: {e}"))?;
    std::fs::write(profile_meta_path(profile_dir), raw)
        .map_err(|e| format!("cannot write profile meta: {e}"))?;
    Ok(())
}

fn profile_info_from_dir(dir: &Path, slug: &str) -> ProfileInfo {
    let meta = read_profile_meta(dir, slug);
    let db_path = dir.join(DB_FILE_NAME);
    let salt_path = default_salt_path(&db_path);
    ProfileInfo {
        slug: slug.to_string(),
        display_name: meta.display_name,
        is_initialized: salt_path.exists(),
    }
}

fn slug_from_timestamp() -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("profile-{nanos:x}")
}

fn random_hex_id(prefix: &str) -> String {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    let mut out = String::with_capacity(prefix.len() + 32);
    out.push_str(prefix);
    for byte in bytes {
        use std::fmt::Write as _;
        let _ = write!(&mut out, "{byte:02x}");
    }
    out
}

fn validate_meta_text(value: &str, field: &str, max_len: usize) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{field} is required"));
    }
    if trimmed.len() > max_len {
        return Err(format!("{field} is too long"));
    }
    Ok(trimmed.to_string())
}

fn migrate_legacy_default_profile(app: &AppHandle) -> Result<(), String> {
    let legacy_db = resolve_db_path(app)?;
    let legacy_salt = default_salt_path(&legacy_db);
    if !legacy_db.exists() && !legacy_salt.exists() {
        return Ok(());
    }

    let default_dir = profile_dir(app, DEFAULT_PROFILE_SLUG)?;
    std::fs::create_dir_all(&default_dir)
        .map_err(|e| format!("cannot create default profile dir: {e}"))?;
    let target_db = default_dir.join(DB_FILE_NAME);
    let target_salt = default_salt_path(&target_db);

    if legacy_db.exists() && !target_db.exists() {
        std::fs::rename(&legacy_db, &target_db)
            .map_err(|e| format!("cannot migrate legacy db: {e}"))?;
    }
    if legacy_salt.exists() && !target_salt.exists() {
        std::fs::rename(&legacy_salt, &target_salt)
            .map_err(|e| format!("cannot migrate legacy salt: {e}"))?;
    }
    if !profile_meta_path(&default_dir).exists() {
        write_profile_meta(&default_dir, "Основной профиль")?;
    }
    Ok(())
}

#[tauri::command]
fn db_list_profiles(app: AppHandle) -> Result<Vec<ProfileInfo>, String> {
    migrate_legacy_default_profile(&app)?;
    let root = profiles_dir(&app)?;
    let entries = std::fs::read_dir(&root)
        .map_err(|e| format!("cannot read profiles dir {}: {e}", root.display()))?;
    let mut profiles = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("cannot read profile entry: {e}"))?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(slug) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if validate_profile_slug(slug).is_ok() {
            profiles.push(profile_info_from_dir(&path, slug));
        }
    }
    profiles.sort_by(|a, b| a.display_name.cmp(&b.display_name));
    Ok(profiles)
}

#[tauri::command]
fn db_create_profile(display_name: String, app: AppHandle) -> Result<ProfileInfo, String> {
    let clean_name = display_name.trim();
    if clean_name.len() < 2 {
        return Err("profile display name is too short".to_string());
    }
    if clean_name.len() > 80 {
        return Err("profile display name is too long".to_string());
    }

    let slug = slug_from_timestamp();
    let dir = profile_dir(&app, &slug)?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("cannot create profile dir {}: {e}", dir.display()))?;
    write_profile_meta(&dir, clean_name)?;
    Ok(profile_info_from_dir(&dir, &slug))
}

#[tauri::command]
fn installation_get_meta(app: AppHandle) -> Result<Option<InstallationMeta>, String> {
    let path = installation_meta_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("cannot read installation meta {}: {e}", path.display()))?;
    let meta = serde_json::from_str::<InstallationMeta>(&raw)
        .map_err(|e| format!("cannot parse installation meta: {e}"))?;
    Ok(Some(meta))
}

#[tauri::command]
fn installation_save_meta(
    input: InstallationMetaInput,
    app: AppHandle,
) -> Result<InstallationMeta, String> {
    let existing = installation_get_meta(app.clone())?;
    let now = now_epoch_string();
    let country = validate_meta_text(&input.country, "country", 64)?;
    let region = validate_meta_text(&input.region, "region", 120)?;
    let municipality = validate_meta_text(&input.municipality, "municipality", 120)?;
    let settlement = validate_meta_text(&input.settlement, "settlement", 120)?;
    let organization_type =
        validate_meta_text(&input.organization_type, "organization_type", 80)?;
    let organization_label =
        validate_meta_text(&input.organization_label, "organization_label", 160)?;

    let meta = InstallationMeta {
        install_id: existing
            .as_ref()
            .map(|m| m.install_id.clone())
            .unwrap_or_else(|| random_hex_id("install_")),
        country,
        region,
        municipality,
        settlement,
        lat: input.lat,
        lng: input.lng,
        organization_type,
        organization_label,
        // Phase 3.12c does not depend on the real org_units catalog yet.
        // Phase 3.17 will replace this null with a reviewed org_unit_id.
        org_unit_id: existing.and_then(|m| m.org_unit_id),
        org_unit_status: "manual_pending_review".to_string(),
        telemetry_consent: input.telemetry_consent,
        created_at: installation_get_meta(app.clone())?
            .map(|m| m.created_at)
            .unwrap_or_else(|| now.clone()),
        updated_at: now,
    };

    let raw = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("cannot serialize installation meta: {e}"))?;
    let path = installation_meta_path(&app)?;
    std::fs::write(&path, raw)
        .map_err(|e| format!("cannot write installation meta {}: {e}", path.display()))?;
    Ok(meta)
}

#[tauri::command]
fn terminal_get_config(app: AppHandle) -> Result<Option<TerminalConfig>, String> {
    let path = terminal_config_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("cannot read terminal config {}: {e}", path.display()))?;
    let cfg = serde_json::from_str::<TerminalConfig>(&raw)
        .map_err(|e| format!("cannot parse terminal config: {e}"))?;
    Ok(Some(cfg))
}

#[tauri::command]
fn terminal_save_config(
    input: TerminalConfigInput,
    app: AppHandle,
) -> Result<TerminalConfig, String> {
    let existing = terminal_get_config(app.clone())?;
    let now = now_epoch_string();
    let mode = validate_meta_text(&input.mode, "mode", 32)?;
    if mode != "specialist" && mode != "manager" {
        return Err("mode must be specialist or manager".to_string());
    }
    let child_invite_code =
        validate_meta_text(&input.child_invite_code, "child_invite_code", 64)?;
    let job_title = validate_meta_text(&input.job_title, "job_title", 120)?;
    let edition = validate_meta_text(&input.edition, "edition", 16)?;
    let workspace_preset = input
        .workspace_preset
        .as_ref()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| {
            if mode == "manager" {
                "manager".to_string()
            } else {
                "specialist".to_string()
            }
        });
    if workspace_preset != "manager"
        && workspace_preset != "specialist"
        && workspace_preset != "educator_lite"
    {
        return Err("workspace_preset must be manager, specialist, or educator_lite".to_string());
    }

    let research_contribution_enabled = match input.research_contribution_enabled {
        Some(v) => v,
        None => existing
            .as_ref()
            .map(|c| c.research_contribution_enabled)
            .unwrap_or(false),
    };
    let (research_contribution_consented_at, research_contribution_consent_version, research_contribution_last_period_key) =
        if input.research_contribution_enabled == Some(false) {
            (None, None, None)
        } else {
            (
                input
                    .research_contribution_consented_at
                    .clone()
                    .or_else(|| {
                        existing
                            .as_ref()
                            .and_then(|c| c.research_contribution_consented_at.clone())
                    }),
                input
                    .research_contribution_consent_version
                    .clone()
                    .or_else(|| {
                        existing
                            .as_ref()
                            .and_then(|c| c.research_contribution_consent_version.clone())
                    }),
                input
                    .research_contribution_last_period_key
                    .clone()
                    .or_else(|| {
                        existing
                            .as_ref()
                            .and_then(|c| c.research_contribution_last_period_key.clone())
                    }),
            )
        };

    let registry_vault_initialized = match input.registry_vault_initialized {
        Some(v) => v,
        None => existing
            .as_ref()
            .map(|c| c.registry_vault_initialized)
            .unwrap_or(false),
    };
    let registry_recovery_key_hash = if input.registry_recovery_key_hash.is_some() {
        input
            .registry_recovery_key_hash
            .clone()
            .filter(|v| !v.trim().is_empty())
    } else {
        existing
            .as_ref()
            .and_then(|c| c.registry_recovery_key_hash.clone())
    };

    let cfg = TerminalConfig {
        terminal_user_id: existing
            .as_ref()
            .map(|c| c.terminal_user_id.clone())
            .unwrap_or_else(|| random_hex_id("term_")),
        edition,
        mode,
        workspace_preset,
        org_type: input
            .org_type
            .as_ref()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty()),
        manager_scope: input
            .manager_scope
            .as_ref()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty()),
        job_title,
        child_invite_code,
        parent_invite_code: input
            .parent_invite_code
            .as_ref()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty()),
        parent_invite_in: input
            .parent_invite_in
            .as_ref()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty()),
        child_invite_in: input
            .child_invite_in
            .as_ref()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty()),
        consumer_app: input
            .consumer_app
            .as_ref()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty()),
        enabled_modules: input.enabled_modules,
        registry_enabled: input.registry_enabled,
        research_contribution_enabled,
        research_contribution_consented_at,
        research_contribution_consent_version,
        research_contribution_last_period_key,
        registry_vault_initialized,
        registry_recovery_key_hash,
        onboarding_complete: true,
        created_at: existing
            .as_ref()
            .map(|c| c.created_at.clone())
            .unwrap_or_else(|| now.clone()),
        updated_at: now,
    };

    let raw = serde_json::to_string_pretty(&cfg)
        .map_err(|e| format!("cannot serialize terminal config: {e}"))?;
    let path = terminal_config_path(&app)?;
    std::fs::write(&path, raw)
        .map_err(|e| format!("cannot write terminal config {}: {e}", path.display()))?;
    Ok(cfg)
}

/// Проверка, инициализирована ли локальная БД на этом устройстве.
///
/// UI должен звать эту команду на старте:
///   * `false` → показать экран «Создание мастер-пароля».
///   * `true`  → показать экран «Вход в систему».
///
/// Признак инициализации — наличие **соляного файла** (`<db>.salt`).
/// Соль создаётся самым первым шагом в `EncryptedDb::open`, и без неё
/// `db_unlock` обязательно завершился бы созданием нового. Поэтому факт
/// её наличия — однозначный сигнал «здесь уже жил какой-то мастер-пароль».
#[tauri::command]
fn db_is_initialized(app: AppHandle) -> Result<bool, String> {
    let db_path = resolve_db_path(&app)?;
    let salt_path = default_salt_path(&db_path);
    Ok(salt_path.exists())
}

#[tauri::command]
fn db_profile_is_initialized(profile_slug: String, app: AppHandle) -> Result<bool, String> {
    let db_path = resolve_profile_db_path(&app, &profile_slug)?;
    let salt_path = default_salt_path(&db_path);
    Ok(salt_path.exists())
}

/// Разблокировать БД мастер-паролем (или создать БД при первом входе).
///
/// Семантика:
///   * Если соли нет — это первичная регистрация: команда создаст соль,
///     сгенерирует ключ из пароля и заведёт пустую БД с миграциями.
///   * Если соль есть — пароль проверяется через smoke-чтение SQLCipher.
///     Неверный пароль → `Err("Invalid password")`. Это единственный
///     сигнал для UI; никакие подробности SQLCipher наружу не уходят.
///   * Успех → `Ok(())`, состояние внутри мьютекса становится `Some(db)`.
///   * Повторный вызов при уже разблокированной БД — атомарно заменяет
///     старую сессию новой (старая Drop'ается, ключ зачищается).
#[tauri::command]
fn db_unlock(
    password: String,
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let db_path = resolve_db_path(&app)?;
    let db = EncryptedDb::open(&db_path, &password).map_err(|e| match e {
        db::DbError::InvalidPassword => "Invalid password".to_string(),
        other => other.to_string(),
    })?;
    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    *guard = Some(db); // прежний Some, если был, дропается здесь же
    ensure_inbox_server(&app, &state)?;
    Ok(())
}

#[tauri::command]
fn db_unlock_profile(
    profile_slug: String,
    password: String,
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let db_path = resolve_profile_db_path(&app, &profile_slug)?;
    let db = EncryptedDb::open(&db_path, &password).map_err(|e| match e {
        db::DbError::InvalidPassword => "Invalid password".to_string(),
        other => other.to_string(),
    })?;
    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    *guard = Some(db);
    ensure_inbox_server(&app, &state)?;
    Ok(())
}

#[tauri::command]
fn db_delete_profile(profile_slug: String, app: AppHandle) -> Result<(), String> {
    validate_profile_slug(&profile_slug)?;
    let dir = profile_dir(&app, &profile_slug)?;
    if dir.exists() {
        std::fs::remove_dir_all(&dir)
            .map_err(|e| format!("cannot delete profile dir {}: {e}", dir.display()))?;
    }
    Ok(())
}

/// Экстренная блокировка экрана: освобождает ключ и закрывает соединение.
///
/// После вызова любая команда, требующая открытой БД, должна звать
/// `db_unlock` заново. Идемпотентна: вызов на уже-заблокированном
/// состоянии — no-op, возвращает `Ok(())`.
#[tauri::command]
fn db_lock(state: State<'_, DbState>, app: AppHandle) -> Result<(), String> {
    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    *guard = None; // Drop → Connection close + DbKey zeroize
    stop_inbox_server(&app);
    Ok(())
}

// ============================================================================
// Local inbox API (T4) — HTTP server + IPC list/update
// ============================================================================

struct InboxServerState(Mutex<Option<JoinHandle<()>>>);

#[derive(Debug, Serialize)]
struct InboxServerStatus {
    running: bool,
    port: u16,
    inbox_url: String,
    health_url: String,
    inbox_viewer_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct SitePortalConfig {
    center_id: String,
    setup_token: String,
    inbox_login: String,
    inbox_password: String,
    iconostasis_columns: i64,
    consult_booking_url: String,
    booking_mode: String,
    public_site_origin: String,
    site_page_paths_json: String,
    leads_export_webhook_url: String,
}

fn random_portal_secret(len: usize) -> String {
    const ALPHABET: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut out = String::with_capacity(len);
    let mut rng = rand::thread_rng();
    for _ in 0..len {
        let idx = rand::Rng::gen_range(&mut rng, 0..ALPHABET.len());
        out.push(ALPHABET[idx] as char);
    }
    out
}

fn ensure_site_portal_table(conn: &rusqlite::Connection) {
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS site_portal (
            id                      INTEGER PRIMARY KEY CHECK (id = 1),
            center_id               TEXT NOT NULL DEFAULT '',
            setup_token             TEXT NOT NULL DEFAULT '',
            inbox_login             TEXT NOT NULL DEFAULT '',
            inbox_password          TEXT NOT NULL DEFAULT '',
            iconostasis_columns     INTEGER NOT NULL DEFAULT 3
        )",
        [],
    );
    let _ = conn.execute("ALTER TABLE site_portal ADD COLUMN consult_booking_url TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE site_portal ADD COLUMN booking_mode TEXT NOT NULL DEFAULT 'prevention'", []);
    let _ = conn.execute("ALTER TABLE site_portal ADD COLUMN public_site_origin TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE site_portal ADD COLUMN site_page_paths_json TEXT NOT NULL DEFAULT ''", []);
    let _ = conn.execute("ALTER TABLE site_portal ADD COLUMN leads_export_webhook_url TEXT NOT NULL DEFAULT ''", []);
}

fn read_site_portal(db: &EncryptedDb) -> Result<SitePortalConfig, String> {
    let conn = db.connection();
    ensure_site_portal_table(conn);
    let res = conn.query_row(
        "SELECT center_id, setup_token, inbox_login, inbox_password, iconostasis_columns,
                consult_booking_url, booking_mode, public_site_origin, site_page_paths_json,
                leads_export_webhook_url
         FROM site_portal WHERE id = 1",
        [],
        |row| {
            Ok(SitePortalConfig {
                center_id: row.get(0)?,
                setup_token: row.get(1)?,
                inbox_login: row.get(2)?,
                inbox_password: row.get(3)?,
                iconostasis_columns: row.get(4)?,
                consult_booking_url: row.get(5)?,
                booking_mode: row.get(6)?,
                public_site_origin: row.get(7)?,
                site_page_paths_json: row.get(8)?,
                leads_export_webhook_url: row.get(9)?,
            })
        },
    );

    match res {
        Ok(cfg) => Ok(cfg),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            let default_cfg = SitePortalConfig {
                center_id: "".to_string(),
                setup_token: "".to_string(),
                inbox_login: "".to_string(),
                inbox_password: "".to_string(),
                iconostasis_columns: 3,
                consult_booking_url: "".to_string(),
                booking_mode: "prevention".to_string(),
                public_site_origin: "".to_string(),
                site_page_paths_json: "".to_string(),
                leads_export_webhook_url: "".to_string(),
            };
            write_site_portal(db, &default_cfg)?;
            Ok(default_cfg)
        }
        Err(e) => Err(format!("site portal read: {e}")),
    }
}

fn write_site_portal(db: &EncryptedDb, cfg: &SitePortalConfig) -> Result<(), String> {
    let conn = db.connection();
    ensure_site_portal_table(conn);
    let cols = cfg.iconostasis_columns.clamp(1, 6);
    conn.execute(
        "INSERT OR REPLACE INTO site_portal (
            id, center_id, setup_token, inbox_login, inbox_password,
            iconostasis_columns, consult_booking_url, booking_mode,
            public_site_origin, site_page_paths_json, leads_export_webhook_url
         ) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            cfg.center_id,
            cfg.setup_token,
            cfg.inbox_login,
            cfg.inbox_password,
            cols,
            cfg.consult_booking_url,
            cfg.booking_mode,
            cfg.public_site_origin,
            cfg.site_page_paths_json,
            cfg.leads_export_webhook_url,
        ],
    )
    .map_err(|e| format!("site portal write: {e}"))?;
    Ok(())
}

#[derive(Debug, Serialize)]
struct LeadRow {
    id: String,
    center_id: String,
    name: String,
    contact: String,
    specialist_id: Option<String>,
    intake_json: String,
    source: Option<String>,
    user_id: Option<String>,
    status: String,
    created_at: String,
}

fn ensure_inbox_server(app: &AppHandle, db_state: &DbState) -> Result<(), String> {
    let inbox_state = app.state::<InboxServerState>();
    let mut guard = inbox_state
        .0
        .lock()
        .map_err(|_| "inbox server mutex poisoned".to_string())?;
    if guard.is_some() {
        return Ok(());
    }
    let handle = start_inbox_server(db_state.inner(), DEFAULT_INBOX_PORT)?;
    *guard = Some(handle);
    Ok(())
}

fn stop_inbox_server(app: &AppHandle) {
    if let Some(inbox_state) = app.try_state::<InboxServerState>() {
        if let Ok(mut guard) = inbox_state.0.lock() {
            if let Some(handle) = guard.take() {
                drop(handle);
            }
        }
    }
}

#[tauri::command]
fn inbox_server_status(app: AppHandle) -> Result<InboxServerStatus, String> {
    let running = if let Some(inbox_state) = app.try_state::<InboxServerState>() {
        inbox_state.0.lock().map(|g| g.is_some()).unwrap_or(false)
    } else {
        false
    };
    let port = DEFAULT_INBOX_PORT;
    Ok(InboxServerStatus {
        running,
        port,
        inbox_url: inbox_public_url(port),
        health_url: format!("http://127.0.0.1:{port}/api/inbox/health"),
        inbox_viewer_url: inbox_viewer_url(port),
    })
}

#[tauri::command]
fn site_portal_get(state: State<'_, DbState>) -> Result<SitePortalConfig, String> {
    let guard = state.0.lock().map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard.as_ref().ok_or_else(|| "DB is locked".to_string())?;
    read_site_portal(db)
}

#[tauri::command]
fn site_portal_ensure(
    state: State<'_, DbState>,
    organization_name: String,
    #[allow(non_snake_case)] centerId: String,
) -> Result<SitePortalConfig, String> {
    let guard = state.0.lock().map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard.as_ref().ok_or_else(|| "DB is locked".to_string())?;
    let mut cfg = read_site_portal(db)?;
    let cid = centerId.trim();
    if !cid.is_empty() && cfg.center_id.trim().is_empty() {
        cfg.center_id = cid.to_string();
    }
    if cfg.center_id.trim().is_empty() {
        let fallback = organization_name.trim();
        cfg.center_id = if fallback.is_empty() {
            "center".to_string()
        } else {
            fallback
                .chars()
                .map(|c| if c.is_ascii_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
                .collect::<String>()
                .replace("--", "-")
        };
    }
    if cfg.setup_token.trim().len() < 16 {
        cfg.setup_token = random_portal_secret(32);
    }
    if cfg.inbox_login.trim().is_empty() {
        cfg.inbox_login = format!("inbox-{}", &random_portal_secret(6).to_lowercase());
    }
    if cfg.inbox_password.trim().len() < 8 {
        cfg.inbox_password = random_portal_secret(14);
    }
    if cfg.iconostasis_columns < 1 || cfg.iconostasis_columns > 6 {
        cfg.iconostasis_columns = 3;
    }
    write_site_portal(db, &cfg)?;
    Ok(cfg)
}

#[tauri::command]
fn site_portal_update(
    state: State<'_, DbState>,
    #[allow(non_snake_case)] inboxLogin: Option<String>,
    #[allow(non_snake_case)] inboxPassword: Option<String>,
    #[allow(non_snake_case)] iconostasisColumns: Option<i64>,
    #[allow(non_snake_case)] consultBookingUrl: Option<String>,
    #[allow(non_snake_case)] bookingMode: Option<String>,
    #[allow(non_snake_case)] publicSiteOrigin: Option<String>,
    #[allow(non_snake_case)] sitePagePathsJson: Option<String>,
    #[allow(non_snake_case)] leadsExportWebhookUrl: Option<String>,
    #[allow(non_snake_case)] centerId: Option<String>,
    #[allow(non_snake_case)] setupToken: Option<String>,
) -> Result<SitePortalConfig, String> {
    fn normalize_booking_mode(raw: &str) -> String {
        if raw.trim() == "external" {
            "external".to_string()
        } else {
            "prevention".to_string()
        }
    }

    let guard = state.0.lock().map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard.as_ref().ok_or_else(|| "DB is locked".to_string())?;
    let mut cfg = read_site_portal(db)?;
    if let Some(login) = inboxLogin {
        let trimmed = login.trim();
        if trimmed.len() < 3 {
            return Err("inbox_login_too_short".into());
        }
        cfg.inbox_login = trimmed.to_string();
    }
    if let Some(pass) = inboxPassword {
        let trimmed = pass.trim();
        if trimmed.len() < 8 {
            return Err("inbox_password_too_short".into());
        }
        cfg.inbox_password = trimmed.to_string();
    }
    if let Some(cols) = iconostasisColumns {
        cfg.iconostasis_columns = cols.clamp(1, 6);
    }
    if let Some(url) = consultBookingUrl {
        let mut trimmed = url.trim().to_string();
        if !trimmed.is_empty() && !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
            trimmed = format!("https://{trimmed}");
        }
        cfg.consult_booking_url = trimmed;
    }
    if let Some(mode) = bookingMode {
        cfg.booking_mode = normalize_booking_mode(&mode);
    }
    if let Some(origin) = publicSiteOrigin {
        let mut trimmed = origin.trim().trim_end_matches('/').to_string();
        if !trimmed.is_empty() && !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
            trimmed = format!("https://{trimmed}");
        }
        cfg.public_site_origin = trimmed;
    }
    if let Some(paths_json) = sitePagePathsJson {
        cfg.site_page_paths_json = paths_json.trim().to_string();
    }
    if let Some(hook) = leadsExportWebhookUrl {
        let mut trimmed = hook.trim().to_string();
        if !trimmed.is_empty() && !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
            trimmed = format!("https://{trimmed}");
        }
        cfg.leads_export_webhook_url = trimmed;
    }
    if cfg.booking_mode == "external" && cfg.consult_booking_url.trim().is_empty() {
        cfg.consult_booking_url = format!("{}/consultants", cfg.public_site_origin.trim_end_matches('/'));
    }
    if let Some(cid) = centerId {
        cfg.center_id = cid.trim().to_string();
    }
    if let Some(token) = setupToken {
        cfg.setup_token = token.trim().to_string();
    }
    write_site_portal(db, &cfg)?;
    Ok(cfg)
}

#[tauri::command]
fn inbox_list_leads(
    state: State<'_, DbState>,
    #[allow(non_snake_case)] centerId: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<LeadRow>, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;
    let lim = limit.unwrap_or(50).clamp(1, 200);
    let center_filter = centerId.unwrap_or_default();
    let mut stmt = if center_filter.trim().is_empty() {
        db.connection()
            .prepare(
                "SELECT id, center_id, name, contact, specialist_id, intake_json,
                        source, user_id, status, created_at
                 FROM leads ORDER BY created_at DESC LIMIT ?1",
            )
            .map_err(|e| e.to_string())?
    } else {
        db.connection()
            .prepare(
                "SELECT id, center_id, name, contact, specialist_id, intake_json,
                        source, user_id, status, created_at
                 FROM leads WHERE center_id = ?1
                 ORDER BY created_at DESC LIMIT ?2",
            )
            .map_err(|e| e.to_string())?
    };

    let map_row = |row: &rusqlite::Row<'_>| -> rusqlite::Result<LeadRow> {
        Ok(LeadRow {
            id: row.get(0)?,
            center_id: row.get(1)?,
            name: row.get(2)?,
            contact: row.get(3)?,
            specialist_id: row.get(4)?,
            intake_json: row.get(5)?,
            source: row.get(6)?,
            user_id: row.get(7)?,
            status: row.get(8)?,
            created_at: row.get(9)?,
        })
    };

    let rows = if center_filter.trim().is_empty() {
        stmt.query_map([lim], map_row)
    } else {
        stmt.query_map(rusqlite::params![center_filter, lim], map_row)
    }
    .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
fn inbox_update_lead_status(
    lead_id: String,
    status: String,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let allowed = ["new", "contacted", "converted", "closed"];
    if !allowed.contains(&status.as_str()) {
        return Err("invalid_status".to_string());
    }
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;
    let changed = db
        .connection()
        .execute(
            "UPDATE leads SET status = ?1 WHERE id = ?2",
            rusqlite::params![status, lead_id],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("lead_not_found".to_string());
    }
    Ok(())
}

#[tauri::command]
fn db_get_org_profile(state: State<'_, DbState>) -> Result<Option<OrgProfile>, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let result = db.connection().query_row(
        "SELECT display_name, isced_level, org_kind, normative_overrides, approx_learner_count,
                org_sphere, org_sphere_other, education_org_type, approx_learner_ovz_count
         FROM org_profile WHERE id = 1",
        [],
        |row| {
            Ok(OrgProfile {
                display_name: row.get(0)?,
                isced_level: row.get(1)?,
                org_kind: row.get(2)?,
                normative_overrides: row.get(3)?,
                approx_learner_count: row.get(4)?,
                org_sphere: row.get(5)?,
                org_sphere_other: row.get(6)?,
                education_org_type: row.get(7)?,
                approx_learner_ovz_count: row.get(8)?,
            })
        },
    );

    match result {
        Ok(profile) => Ok(Some(profile)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("sqlite get org_profile failed: {e}")),
    }
}

#[tauri::command]
fn db_get_specialist_profile(
    state: State<'_, DbState>,
) -> Result<Option<SpecialistProfile>, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let result = db.connection().query_row(
        "SELECT display_name, role_text, weekly_contract_minutes, rate_type, rate_value
         FROM specialist_profile WHERE id = 1",
        [],
        |row| {
            Ok(SpecialistProfile {
                display_name: row.get(0)?,
                role_text: row.get(1)?,
                weekly_contract_minutes: row.get(2)?,
                rate_type: row.get(3)?,
                rate_value: row.get(4)?,
            })
        },
    );

    match result {
        Ok(profile) => Ok(Some(profile)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("sqlite get specialist_profile failed: {e}")),
    }
}

#[tauri::command]
fn db_save_org_profile(payload: OrgProfileInput, state: State<'_, DbState>) -> Result<(), String> {
    let display_name = validate_meta_text(&payload.display_name, "display_name", 160)?;
    if !(0..=8).contains(&payload.isced_level) {
        return Err("isced_level must be between 0 and 8".to_string());
    }
    if !ALLOWED_ORG_KINDS.contains(&payload.org_kind.as_str()) {
        return Err(format!("unknown org_kind: {}", payload.org_kind));
    }
    if let Some(count) = payload.approx_learner_count {
        if count < 0 {
            return Err("approx_learner_count must be >= 0".to_string());
        }
    }
    if !ALLOWED_ORG_SPHERE.contains(&payload.org_sphere.as_str()) {
        return Err(format!("unknown org_sphere: {}", payload.org_sphere));
    }
    let org_sphere_other = payload.org_sphere_other.unwrap_or_default();
    if payload.org_sphere == "other" && org_sphere_other.trim().is_empty() {
        return Err("org_sphere_other required when org_sphere is other".to_string());
    }
    if let Some(ref edu_type) = payload.education_org_type {
        if !ALLOWED_EDUCATION_ORG_TYPE.contains(&edu_type.as_str()) {
            return Err(format!("unknown education_org_type: {edu_type}"));
        }
    }
    if payload.org_sphere == "education_system" && payload.education_org_type.is_none() {
        return Err("education_org_type required for education_system sphere".to_string());
    }
    if let Some(count) = payload.approx_learner_ovz_count {
        if count < 0 {
            return Err("approx_learner_ovz_count must be >= 0".to_string());
        }
    }
    if let (Some(total), Some(ovz)) = (payload.approx_learner_count, payload.approx_learner_ovz_count) {
        if ovz > total {
            return Err("approx_learner_ovz_count cannot exceed approx_learner_count".to_string());
        }
    }
    let normative_overrides = payload.normative_overrides.unwrap_or_else(|| "{}".to_string());
    serde_json::from_str::<serde_json::Value>(&normative_overrides)
        .map_err(|e| format!("invalid normative_overrides JSON: {e}"))?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    db.connection()
        .execute(
            "INSERT INTO org_profile (
                id, display_name, isced_level, org_kind, normative_overrides, approx_learner_count,
                org_sphere, org_sphere_other, education_org_type, approx_learner_ovz_count
             ) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(id) DO UPDATE SET
                display_name = excluded.display_name,
                isced_level = excluded.isced_level,
                org_kind = excluded.org_kind,
                normative_overrides = excluded.normative_overrides,
                approx_learner_count = excluded.approx_learner_count,
                org_sphere = excluded.org_sphere,
                org_sphere_other = excluded.org_sphere_other,
                education_org_type = excluded.education_org_type,
                approx_learner_ovz_count = excluded.approx_learner_ovz_count",
            rusqlite::params![
                display_name.as_str(),
                payload.isced_level,
                payload.org_kind.as_str(),
                normative_overrides.as_str(),
                payload.approx_learner_count,
                payload.org_sphere.as_str(),
                org_sphere_other.as_str(),
                payload.education_org_type,
                payload.approx_learner_ovz_count,
            ],
        )
        .map_err(|e| format!("sqlite save org_profile failed: {e}"))?;
    audit_log_write(
        db.connection(),
        "update",
        "org_profile",
        "1",
        &serde_json::json!({}),
    )?;
    Ok(())
}

#[tauri::command]
fn db_save_specialist_profile(
    payload: SpecialistProfileInput,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let display_name = validate_meta_text(&payload.display_name, "display_name", 120)?;
    let role_text = validate_meta_text(&payload.role_text, "role_text", 120)?;
    if payload.weekly_contract_minutes < 0 || payload.weekly_contract_minutes > 10_080 {
        return Err("weekly_contract_minutes is out of range".to_string());
    }

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    db.connection()
        .execute(
            "INSERT INTO specialist_profile (
                id, display_name, role_text, weekly_contract_minutes, rate_type, rate_value
             ) VALUES (1, ?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
                display_name = excluded.display_name,
                role_text = excluded.role_text,
                weekly_contract_minutes = excluded.weekly_contract_minutes,
                rate_type = excluded.rate_type,
                rate_value = excluded.rate_value",
            rusqlite::params![
                display_name.as_str(),
                role_text.as_str(),
                payload.weekly_contract_minutes,
                payload.rate_type.as_str(),
                payload.rate_value,
            ],
        )
        .map_err(|e| format!("sqlite save specialist_profile failed: {e}"))?;
    audit_log_write(
        db.connection(),
        "update",
        "specialist_profile",
        "1",
        &serde_json::json!({}),
    )?;
    Ok(())
}

// ============================================================================
// Phase A Sprint 2 — IPR commands
// ============================================================================
//
// `case_id` валидируется только тем, что INSERT с несуществующим case_id
// упадёт по FK constraint. Бросаем человекочитаемую ошибку.
//
// Все операции — single-statement, без транзакций. Их атомарность гарантирует
// сам rusqlite (single-statement = single tx implicitly).

fn validate_optional_text(
    value: &Option<String>,
    field: &str,
    max_len: usize,
) -> Result<String, String> {
    let raw = value.as_deref().unwrap_or("").trim();
    if raw.len() > max_len {
        return Err(format!("{field} is too long"));
    }
    Ok(raw.to_string())
}

fn validate_required_text(
    value: &str,
    field: &str,
    max_len: usize,
) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{field} is required"));
    }
    if trimmed.len() > max_len {
        return Err(format!("{field} is too long"));
    }
    Ok(trimmed.to_string())
}

fn validate_enum_value(
    value: &str,
    allowed: &[&str],
    field: &str,
) -> Result<String, String> {
    if !allowed.contains(&value) {
        return Err(format!("unknown {field}: {value}"));
    }
    Ok(value.to_string())
}

fn validate_target_date(value: &Option<String>) -> Result<Option<String>, String> {
    match value {
        None => Ok(None),
        Some(s) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                return Ok(None);
            }
            // Принимаем строгий ISO `YYYY-MM-DD`. Не пытаемся парсить чем-то
            // тяжёлым — нам нужна стабильная сортируемая строка, а проверку
            // календарной валидности делает UI и/или Phase B.
            let ok = trimmed.len() == 10
                && trimmed.chars().enumerate().all(|(i, c)| match i {
                    4 | 7 => c == '-',
                    _ => c.is_ascii_digit(),
                });
            if !ok {
                return Err("target_date must be YYYY-MM-DD".to_string());
            }
            Ok(Some(trimmed.to_string()))
        }
    }
}

/// Создать новую запись ИПР, привязанную к существующему case_files.id.
///
/// Возвращает сгенерированный `ipr_id` (32-символьная hex-строка).
/// `status` стартует в `'draft'`. UI потом переводит в `'active'`, когда
/// психолог завершил черновик.
#[tauri::command]
fn db_create_ipr(
    payload: IprCreateInput,
    state: State<'_, DbState>,
) -> Result<String, String> {
    let title = validate_required_text(&payload.title, "title", IPR_TITLE_MAX)?;
    let description = validate_optional_text(&payload.description, "description", IPR_DESCRIPTION_MAX)?;
    let case_id = validate_required_text(&payload.case_id, "case_id", 128)?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    let ipr_id = random_hex_id("");
    let now = now_epoch_string();

    db.connection()
        .execute(
            "INSERT INTO iprs (id, case_id, title, description, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, 'draft', ?5, ?5)",
            rusqlite::params![
                ipr_id.as_str(),
                case_id.as_str(),
                title.as_str(),
                description.as_str(),
                now.as_str(),
            ],
        )
        .map_err(|e| {
            // FK violation = «case_id не существует». Любая другая ошибка
            // имеет смысл только в логах разработчика, не в UI.
            if e.to_string().contains("FOREIGN KEY") {
                "case_id does not exist".to_string()
            } else {
                format!("sqlite insert iprs failed: {e}")
            }
        })?;

    audit_log_write(
        db.connection(),
        "insert",
        "iprs",
        &ipr_id,
        &serde_json::json!({}),
    )?;
    Ok(ipr_id)
}

/// Список ИПР конкретного кейса, отсортированный по убыванию updated_at.
/// UI обычно показывает первую запись как «текущий ИПР».
#[tauri::command]
fn db_list_iprs(case_id: String, state: State<'_, DbState>) -> Result<Vec<Ipr>, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let mut stmt = db
        .connection()
        .prepare(
            "SELECT id, case_id, title, description, status, plan_text, report_text, artifacts_json,
                    audience_json, session_tags_json, created_at, updated_at
             FROM iprs WHERE case_id = ?1
             ORDER BY updated_at DESC, id",
        )
        .map_err(|e| format!("sqlite prepare list_iprs failed: {e}"))?;
    let rows = stmt
        .query_map([case_id.as_str()], |row| {
            Ok(Ipr {
                id: row.get(0)?,
                case_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                status: row.get(4)?,
                plan_text: row.get(5)?,
                report_text: row.get(6)?,
                artifacts_json: row.get(7)?,
                audience_json: row.get(8)?,
                session_tags_json: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| format!("sqlite list_iprs query failed: {e}"))?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| format!("sqlite list_iprs row failed: {e}"))?);
    }
    Ok(out)
}

/// Изменить заголовок / описание / статус ИПР. Поля, переданные как `None`,
/// остаются без изменений. Пустая строка в `title` отвергается, потому что
/// title required по контракту таблицы — UI всегда должен заполнить его.
#[tauri::command]
fn db_update_ipr(
    ipr_id: String,
    payload: IprUpdateInput,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let title = match &payload.title {
        Some(t) => Some(validate_required_text(t, "title", IPR_TITLE_MAX)?),
        None => None,
    };
    let description = match &payload.description {
        Some(_) => Some(validate_optional_text(&payload.description, "description", IPR_DESCRIPTION_MAX)?),
        None => None,
    };
    let status = match &payload.status {
        Some(s) => Some(validate_enum_value(s, IPR_STATUS_VALUES, "ipr status")?),
        None => None,
    };
    let plan_text = payload.plan_text.as_deref();
    let report_text = payload.report_text.as_deref();
    let artifacts_json = payload.artifacts_json.as_deref();
    let audience_json = payload.audience_json.as_deref();
    let session_tags_json = payload.session_tags_json.as_deref();
    if title.is_none()
        && description.is_none()
        && status.is_none()
        && plan_text.is_none()
        && report_text.is_none()
        && artifacts_json.is_none()
        && audience_json.is_none()
        && session_tags_json.is_none()
    {
        return Ok(());
    }

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    // Чтобы не плодить N подготовленных SQL-вариантов под все комбинации,
    // используем COALESCE(?, current_column) на стороне Postgres-style
    // (SQLite поддерживает COALESCE так же).
    let now = now_epoch_string();
    let updated = db
        .connection()
        .execute(
            "UPDATE iprs SET
                title           = COALESCE(?1, title),
                description     = COALESCE(?2, description),
                status          = COALESCE(?3, status),
                plan_text       = COALESCE(?4, plan_text),
                report_text     = COALESCE(?5, report_text),
                artifacts_json  = COALESCE(?6, artifacts_json),
                audience_json   = COALESCE(?7, audience_json),
                session_tags_json = COALESCE(?8, session_tags_json),
                updated_at      = ?9
             WHERE id = ?10",
            rusqlite::params![
                title.as_deref(),
                description.as_deref(),
                status.as_deref(),
                plan_text,
                report_text,
                artifacts_json,
                audience_json,
                session_tags_json,
                now.as_str(),
                ipr_id.as_str(),
            ],
        )
        .map_err(|e| format!("sqlite update iprs failed: {e}"))?;
    if updated == 0 {
        return Err("ipr not found".to_string());
    }
    audit_log_write(
        db.connection(),
        if status.is_some() { "status_change" } else { "update" },
        "iprs",
        &ipr_id,
        &serde_json::json!({}),
    )?;
    Ok(())
}

/// Добавить шаг ИПР. `order_no` высчитывается автоматически как
/// max(order_no)+1 в рамках одного ipr; UI может потом перенумеровать через
/// `db_update_ipr_step`.
#[tauri::command]
fn db_add_ipr_step(
    payload: IprStepCreateInput,
    state: State<'_, DbState>,
) -> Result<String, String> {
    let ipr_id = validate_required_text(&payload.ipr_id, "ipr_id", 128)?;
    let title = validate_required_text(&payload.title, "title", IPR_STEP_TITLE_MAX)?;
    let description = validate_optional_text(&payload.description, "description", IPR_STEP_DESCRIPTION_MAX)?;
    let target_date = validate_target_date(&payload.target_date)?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    let step_id = random_hex_id("");
    let now = now_epoch_string();

    let conn = db.connection_mut();
    let tx = conn
        .transaction()
        .map_err(|e| format!("sqlite tx begin failed: {e}"))?;

    let next_order: i64 = tx
        .query_row(
            "SELECT COALESCE(MAX(order_no), -1) + 1 FROM ipr_steps WHERE ipr_id = ?1",
            [ipr_id.as_str()],
            |row| row.get(0),
        )
        .map_err(|e| format!("sqlite next order failed: {e}"))?;

    tx.execute(
        "INSERT INTO ipr_steps (
            id, ipr_id, order_no, title, description, target_date, status, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'planned', ?7, ?7)",
        rusqlite::params![
            step_id.as_str(),
            ipr_id.as_str(),
            next_order,
            title.as_str(),
            description.as_str(),
            target_date.as_deref(),
            now.as_str(),
        ],
    )
    .map_err(|e| {
        if e.to_string().contains("FOREIGN KEY") {
            "ipr_id does not exist".to_string()
        } else {
            format!("sqlite insert ipr_steps failed: {e}")
        }
    })?;

    // Bump parent ipr.updated_at — тогда `db_list_iprs` сразу выведет
    // изменённый план первым.
    tx.execute(
        "UPDATE iprs SET updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now.as_str(), ipr_id.as_str()],
    )
    .map_err(|e| format!("sqlite bump ipr updated_at failed: {e}"))?;

    audit_log_write(
        &*tx,
        "insert",
        "ipr_steps",
        &step_id,
        &serde_json::json!({}),
    )?;

    tx.commit()
        .map_err(|e| format!("sqlite tx commit failed: {e}"))?;

    Ok(step_id)
}

/// Изменить шаг ИПР. Любые комбинации полей могут быть `None`. Если изменили
/// `order_no` — может встать конфликт UNIQUE(ipr_id, order_no) при попытке
/// поставить «2» туда, где уже есть «2». UI должен либо перенумеровывать
/// последовательно, либо ловить эту ошибку и пересчитывать.
#[tauri::command]
fn db_update_ipr_step(
    step_id: String,
    payload: IprStepUpdateInput,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let title = match &payload.title {
        Some(t) => Some(validate_required_text(t, "title", IPR_STEP_TITLE_MAX)?),
        None => None,
    };
    let description = match &payload.description {
        Some(_) => Some(validate_optional_text(
            &payload.description,
            "description",
            IPR_STEP_DESCRIPTION_MAX,
        )?),
        None => None,
    };
    let status = match &payload.status {
        Some(s) => Some(validate_enum_value(s, IPR_STEP_STATUS_VALUES, "ipr step status")?),
        None => None,
    };
    let target_date = match &payload.target_date {
        // Пустая строка из UI значит «очистить дату».
        Some(s) if s.trim().is_empty() => Some(None),
        Some(_) => Some(validate_target_date(&payload.target_date)?),
        None => None,
    };
    let notes = match &payload.notes {
        Some(_) => Some(validate_optional_text(&payload.notes, "notes", 10000)?),
        None => None,
    };
    if title.is_none()
        && description.is_none()
        && status.is_none()
        && target_date.is_none()
        && notes.is_none()
        && payload.order_no.is_none()
    {
        return Ok(());
    }
    if let Some(order) = payload.order_no {
        if order < 0 {
            return Err("order_no must be >= 0".to_string());
        }
    }

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    let now = now_epoch_string();
    // target_date: Some(None) → выставить NULL; Some(Some(s)) → выставить s;
    // None → не трогать. rusqlite принимает Option<&str>, поэтому распаковка
    // через `flatten`.
    let td_for_set: Option<&str> = target_date.as_ref().and_then(|inner| inner.as_deref());
    let td_was_provided: bool = target_date.is_some();

    let conn = db.connection_mut();
    let tx = conn
        .transaction()
        .map_err(|e| format!("sqlite tx begin failed: {e}"))?;

    // У SQLite нет «conditional SET col = ? else keep» в одной строке для
    // NULL-перехода; делаем два варианта SQL в зависимости от того, передан
    // target_date или нет. Это проще, чем хитрый CASE на стороне SQL.
    let updated = if td_was_provided {
        tx.execute(
            "UPDATE ipr_steps SET
                title       = COALESCE(?1, title),
                description = COALESCE(?2, description),
                status      = COALESCE(?3, status),
                target_date = ?4,
                notes       = COALESCE(?5, notes),
                order_no    = COALESCE(?6, order_no),
                updated_at  = ?7
             WHERE id = ?8",
            rusqlite::params![
                title.as_deref(),
                description.as_deref(),
                status.as_deref(),
                td_for_set,
                notes.as_deref(),
                payload.order_no,
                now.as_str(),
                step_id.as_str(),
            ],
        )
    } else {
        tx.execute(
            "UPDATE ipr_steps SET
                title       = COALESCE(?1, title),
                description = COALESCE(?2, description),
                status      = COALESCE(?3, status),
                notes       = COALESCE(?4, notes),
                order_no    = COALESCE(?5, order_no),
                updated_at  = ?6
             WHERE id = ?7",
            rusqlite::params![
                title.as_deref(),
                description.as_deref(),
                status.as_deref(),
                notes.as_deref(),
                payload.order_no,
                now.as_str(),
                step_id.as_str(),
            ],
        )
    }
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "order_no conflicts with another step in the same ipr".to_string()
        } else {
            format!("sqlite update ipr_steps failed: {e}")
        }
    })?;
    if updated == 0 {
        return Err("ipr_step not found".to_string());
    }

    // Bump parent ipr.updated_at для сортировки в Home.
    tx.execute(
        "UPDATE iprs SET updated_at = ?1
         WHERE id = (SELECT ipr_id FROM ipr_steps WHERE id = ?2)",
        rusqlite::params![now.as_str(), step_id.as_str()],
    )
    .map_err(|e| format!("sqlite bump ipr updated_at failed: {e}"))?;

    audit_log_write(
        &*tx,
        if status.is_some() { "status_change" } else { "update" },
        "ipr_steps",
        &step_id,
        &serde_json::json!({}),
    )?;

    tx.commit()
        .map_err(|e| format!("sqlite tx commit failed: {e}"))?;

    Ok(())
}

/// Список шагов ИПР по возрастанию order_no.
#[tauri::command]
fn db_list_ipr_steps(
    ipr_id: String,
    state: State<'_, DbState>,
) -> Result<Vec<IprStep>, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let mut stmt = db
        .connection()
        .prepare(
            "SELECT id, ipr_id, order_no, title, description, target_date,
                    status, notes, created_at, updated_at
             FROM ipr_steps WHERE ipr_id = ?1
             ORDER BY order_no, id",
        )
        .map_err(|e| format!("sqlite prepare list_ipr_steps failed: {e}"))?;
    let rows = stmt
        .query_map([ipr_id.as_str()], |row| {
            Ok(IprStep {
                id: row.get(0)?,
                ipr_id: row.get(1)?,
                order_no: row.get(2)?,
                title: row.get(3)?,
                description: row.get(4)?,
                target_date: row.get(5)?,
                status: row.get(6)?,
                notes: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| format!("sqlite list_ipr_steps query failed: {e}"))?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| format!("sqlite list_ipr_steps row failed: {e}"))?);
    }
    Ok(out)
}

/// Удалить шаг ИПР. Используется при отмене незавершённого черновика. Если
/// нужно «отметить как невыполненный», вместо удаления ставится status
/// `'skipped'` через `db_update_ipr_step`.
#[tauri::command]
fn db_delete_ipr_step(step_id: String, state: State<'_, DbState>) -> Result<(), String> {
    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    let now = now_epoch_string();
    let conn = db.connection_mut();
    let tx = conn
        .transaction()
        .map_err(|e| format!("sqlite tx begin failed: {e}"))?;

    // Сохраняем parent ipr_id до удаления, чтобы потом обновить updated_at.
    let parent_ipr: Option<String> = tx
        .query_row(
            "SELECT ipr_id FROM ipr_steps WHERE id = ?1",
            [step_id.as_str()],
            |row| row.get(0),
        )
        .ok();

    let removed = tx
        .execute(
            "DELETE FROM ipr_steps WHERE id = ?1",
            [step_id.as_str()],
        )
        .map_err(|e| format!("sqlite delete ipr_steps failed: {e}"))?;
    if removed == 0 {
        return Err("ipr_step not found".to_string());
    }
    if let Some(ipr_id) = parent_ipr {
        tx.execute(
            "UPDATE iprs SET updated_at = ?1 WHERE id = ?2",
            rusqlite::params![now.as_str(), ipr_id.as_str()],
        )
        .map_err(|e| format!("sqlite bump ipr updated_at failed: {e}"))?;
    }
    audit_log_write(
        &*tx,
        "delete",
        "ipr_steps",
        &step_id,
        &serde_json::json!({}),
    )?;
    tx.commit()
        .map_err(|e| format!("sqlite tx commit failed: {e}"))?;
    Ok(())
}

// ============================================================================
// Phase A Sprint 3 — year plan, request log, Dashboard L1
// ============================================================================

fn sql_week_bucket(conn: &rusqlite::Connection, epoch_secs: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT strftime('%Y-W%W', datetime(?1, 'unixepoch'))",
        [epoch_secs],
        |row| row.get(0),
    )
    .map_err(|e| format!("sqlite week_bucket failed: {e}"))
}

fn sql_current_week_bucket(conn: &rusqlite::Connection) -> Result<String, String> {
    conn.query_row("SELECT strftime('%Y-W%W', 'now')", [], |row| row.get(0))
        .map_err(|e| format!("sqlite current week_bucket failed: {e}"))
}

fn sql_current_school_year(conn: &rusqlite::Connection) -> Result<String, String> {
    conn.query_row(
        "SELECT CASE
            WHEN cast(strftime('%m', 'now') AS INTEGER) >= 9
            THEN strftime('%Y', 'now') || '-' || cast(cast(strftime('%Y', 'now') AS INTEGER) + 1 AS TEXT)
            ELSE cast(cast(strftime('%Y', 'now') AS INTEGER) - 1 AS TEXT) || '-' || strftime('%Y', 'now')
         END",
        [],
        |row| row.get(0),
    )
    .map_err(|e| format!("sqlite school_year failed: {e}"))
}


fn audience_reach_from_json(raw_json: &str) -> i64 {
    let trimmed = raw_json.trim();
    if trimmed.is_empty() || trimmed == "{}" {
        return 0;
    }
    let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) else {
        return 0;
    };
    let Some(groups) = value.get("groups").and_then(|g| g.as_array()) else {
        return 0;
    };
    let mut total = 0i64;
    for item in groups {
        if !item
            .get("enabled")
            .and_then(|enabled| enabled.as_bool())
            .unwrap_or(false)
        {
            continue;
        }
        if let Some(count) = item.get("count").and_then(|c| c.as_i64()) {
            if count > 0 {
                total += count;
            }
        }
    }
    total
}

fn year_plan_task_prevention_link(task_kind: &str) -> &'static str {
    match task_kind {
        "prevention_campaign" => "L1_universal",
        "screening" => "L2_selective",
        "training_program" => "L2_selective",
        "consultation_program" => "L3_indicated",
        "methodology_work" => "L1_universal",
        _ => "L1_universal",
    }
}

fn normalize_prevention_link(raw: &str, fallback: &str) -> String {
    let trimmed = raw.trim();
    if PREVENTION_LINK_VALUES.contains(&trimmed) {
        trimmed.to_string()
    } else {
        fallback.to_string()
    }
}

fn validate_target_groups_json(raw: &str) -> Result<(), String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(());
    }
    let parsed: serde_json::Value =
        serde_json::from_str(trimmed).map_err(|_| "target_groups must be JSON array".to_string())?;
    if !parsed.is_array() {
        return Err("target_groups must be JSON array".to_string());
    }
    Ok(())
}

fn validate_status_filter(values: &[String], allowed: &[&str], field: &str) -> Result<(), String> {
    for v in values {
        validate_enum_value(v, allowed, field)?;
    }
    Ok(())
}

/// Application-level audit trail (Sprint 4). Called after successful mutations
/// on Phase A tables. `changed_fields` is a JSON object; empty `{}` is fine
/// for inserts when the UI does not compute a field-level diff yet.
fn audit_log_write(
    conn: &rusqlite::Connection,
    action: &str,
    table_name: &str,
    record_id: &str,
    changed_fields: &serde_json::Value,
) -> Result<(), String> {
    validate_enum_value(action, AUDIT_ACTION_VALUES, "audit action")?;
    let fields_json = serde_json::to_string(changed_fields)
        .map_err(|e| format!("audit changed_fields serialize: {e}"))?;
    let id = random_hex_id("");
    let now = now_epoch_string();
    conn.execute(
        "INSERT INTO audit_log (
            id, occurred_at, actor_id, action, table_name, record_id, changed_fields
         ) VALUES (?1, ?2, 1, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            id.as_str(),
            now.as_str(),
            action,
            table_name,
            record_id,
            fields_json.as_str(),
        ],
    )
    .map_err(|e| format!("sqlite insert audit_log failed: {e}"))?;
    Ok(())
}

#[tauri::command]
fn db_create_year_plan_task(
    payload: YearPlanTaskCreateInput,
    state: State<'_, DbState>,
) -> Result<String, String> {
    let title = validate_required_text(&payload.title, "title", YEAR_PLAN_TITLE_MAX)?;
    let task_kind = validate_enum_value(&payload.task_kind, YEAR_PLAN_TASK_KIND_VALUES, "task_kind")?;
    let school_year =
        validate_required_text(&payload.school_year, "school_year", YEAR_PLAN_SCHOOL_YEAR_MAX)?;
    let description =
        validate_optional_text(&payload.description, "description", YEAR_PLAN_DESCRIPTION_MAX)?;
    let target_groups = validate_optional_text(
        &payload.target_groups,
        "target_groups",
        YEAR_PLAN_TARGET_GROUPS_MAX,
    )?;
    let target_groups = if target_groups.is_empty() {
        "[]".to_string()
    } else {
        validate_target_groups_json(&target_groups)?;
        target_groups
    };
    let planned_minutes = payload.planned_minutes.unwrap_or(0);
    if planned_minutes < 0 || planned_minutes > 1_000_000 {
        return Err("planned_minutes is out of range".to_string());
    }
    let status = match &payload.status {
        Some(s) => validate_enum_value(s, YEAR_PLAN_TASK_STATUS_VALUES, "year_plan status")?,
        None => "planned".to_string(),
    };

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    let task_id = random_hex_id("");
    let now = now_epoch_string();
    db.connection()
        .execute(
            "INSERT INTO year_plan_tasks (
                id, title, task_kind, description, target_groups,
                planned_minutes, school_year, status, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
            rusqlite::params![
                task_id.as_str(),
                title.as_str(),
                task_kind.as_str(),
                description.as_str(),
                target_groups.as_str(),
                planned_minutes,
                school_year.as_str(),
                status.as_str(),
                now.as_str(),
            ],
        )
        .map_err(|e| format!("sqlite insert year_plan_tasks failed: {e}"))?;
    audit_log_write(
        db.connection(),
        "insert",
        "year_plan_tasks",
        &task_id,
        &serde_json::json!({}),
    )?;
    Ok(task_id)
}

#[tauri::command]
fn db_list_year_plan_tasks(
    school_year: String,
    status_filter: Option<String>,
    state: State<'_, DbState>,
) -> Result<Vec<YearPlanTask>, String> {
    let school_year =
        validate_required_text(&school_year, "school_year", YEAR_PLAN_SCHOOL_YEAR_MAX)?;
    let status = match status_filter {
        Some(s) if !s.trim().is_empty() => {
            Some(validate_enum_value(&s, YEAR_PLAN_TASK_STATUS_VALUES, "year_plan status")?)
        }
        _ => None,
    };

    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let sql = if status.is_some() {
        "SELECT id, title, task_kind, description, target_groups, planned_minutes,
                school_year, status, created_at, updated_at
         FROM year_plan_tasks
         WHERE school_year = ?1 AND status = ?2
         ORDER BY updated_at DESC, id"
    } else {
        "SELECT id, title, task_kind, description, target_groups, planned_minutes,
                school_year, status, created_at, updated_at
         FROM year_plan_tasks
         WHERE school_year = ?1
         ORDER BY updated_at DESC, id"
    };

    let mut stmt = db
        .connection()
        .prepare(sql)
        .map_err(|e| format!("sqlite prepare list_year_plan_tasks failed: {e}"))?;

    let map_row = |row: &rusqlite::Row<'_>| {
        Ok(YearPlanTask {
            id: row.get(0)?,
            title: row.get(1)?,
            task_kind: row.get(2)?,
            description: row.get(3)?,
            target_groups: row.get(4)?,
            planned_minutes: row.get(5)?,
            school_year: row.get(6)?,
            status: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    };

    let rows = if let Some(st) = status.as_deref() {
        stmt.query_map(rusqlite::params![school_year.as_str(), st], map_row)
    } else {
        stmt.query_map([school_year.as_str()], map_row)
    }
    .map_err(|e| format!("sqlite list_year_plan_tasks query failed: {e}"))?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| format!("sqlite list_year_plan_tasks row failed: {e}"))?);
    }
    Ok(out)
}

#[tauri::command]
fn db_update_year_plan_task(
    task_id: String,
    payload: YearPlanTaskUpdateInput,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let title = match &payload.title {
        Some(t) => Some(validate_required_text(t, "title", YEAR_PLAN_TITLE_MAX)?),
        None => None,
    };
    let task_kind = match &payload.task_kind {
        Some(k) => Some(validate_enum_value(k, YEAR_PLAN_TASK_KIND_VALUES, "task_kind")?),
        None => None,
    };
    let description = match &payload.description {
        Some(_) => Some(validate_optional_text(
            &payload.description,
            "description",
            YEAR_PLAN_DESCRIPTION_MAX,
        )?),
        None => None,
    };
    let target_groups = match &payload.target_groups {
        Some(_) => {
            let raw = validate_optional_text(
                &payload.target_groups,
                "target_groups",
                YEAR_PLAN_TARGET_GROUPS_MAX,
            )?;
            let normalized = if raw.is_empty() { "[]".to_string() } else { raw };
            validate_target_groups_json(&normalized)?;
            Some(normalized)
        }
        None => None,
    };
    let school_year = match &payload.school_year {
        Some(y) => Some(validate_required_text(y, "school_year", YEAR_PLAN_SCHOOL_YEAR_MAX)?),
        None => None,
    };
    let status = match &payload.status {
        Some(s) => Some(validate_enum_value(s, YEAR_PLAN_TASK_STATUS_VALUES, "year_plan status")?),
        None => None,
    };
    let planned_minutes = payload.planned_minutes;
    if let Some(pm) = planned_minutes {
        if pm < 0 || pm > 1_000_000 {
            return Err("planned_minutes is out of range".to_string());
        }
    }
    if title.is_none()
        && task_kind.is_none()
        && description.is_none()
        && target_groups.is_none()
        && planned_minutes.is_none()
        && school_year.is_none()
        && status.is_none()
    {
        return Ok(());
    }

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    let now = now_epoch_string();
    let updated = db
        .connection()
        .execute(
            "UPDATE year_plan_tasks SET
                title           = COALESCE(?1, title),
                task_kind       = COALESCE(?2, task_kind),
                description     = COALESCE(?3, description),
                target_groups   = COALESCE(?4, target_groups),
                planned_minutes = COALESCE(?5, planned_minutes),
                school_year     = COALESCE(?6, school_year),
                status          = COALESCE(?7, status),
                updated_at      = ?8
             WHERE id = ?9",
            rusqlite::params![
                title.as_deref(),
                task_kind.as_deref(),
                description.as_deref(),
                target_groups.as_deref(),
                planned_minutes,
                school_year.as_deref(),
                status.as_deref(),
                now.as_str(),
                task_id.as_str(),
            ],
        )
        .map_err(|e| format!("sqlite update year_plan_tasks failed: {e}"))?;
    if updated == 0 {
        return Err("year_plan_task not found".to_string());
    }
    audit_log_write(
        db.connection(),
        "update",
        "year_plan_tasks",
        &task_id,
        &serde_json::json!({}),
    )?;
    Ok(())
}

#[tauri::command]
fn db_delete_year_plan_task(task_id: String, state: State<'_, DbState>) -> Result<(), String> {
    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    let touch_count: i64 = db
        .connection()
        .query_row(
            "SELECT count(*) FROM case_touches WHERE task_id = ?1",
            [task_id.as_str()],
            |row| row.get(0),
        )
        .map_err(|e| format!("sqlite count touches for task failed: {e}"))?;
    if touch_count > 0 {
        return Err("cannot delete year_plan_task with linked touches".to_string());
    }

    let removed = db
        .connection()
        .execute(
            "DELETE FROM year_plan_tasks WHERE id = ?1",
            [task_id.as_str()],
        )
        .map_err(|e| format!("sqlite delete year_plan_tasks failed: {e}"))?;
    if removed == 0 {
        return Err("year_plan_task not found".to_string());
    }
    audit_log_write(
        db.connection(),
        "delete",
        "year_plan_tasks",
        &task_id,
        &serde_json::json!({}),
    )?;
    Ok(())
}

#[tauri::command]
fn db_create_request(
    payload: RequestCreateInput,
    state: State<'_, DbState>,
) -> Result<String, String> {
    let source = validate_enum_value(&payload.source, REQUEST_SOURCE_VALUES, "request source")?;
    let topic_text = validate_required_text(&payload.topic_text, "topic_text", REQUEST_TOPIC_MAX)?;
    let subject_shadow_id = validate_optional_text(
        &payload.subject_shadow_id,
        "subject_shadow_id",
        REQUEST_SUBJECT_SHADOW_MAX,
    )?;
    let urgency = match &payload.urgency {
        Some(u) => validate_enum_value(u, REQUEST_URGENCY_VALUES, "request urgency")?,
        None => "normal".to_string(),
    };
    let notes_local =
        validate_optional_text(&payload.notes_local, "notes_local", REQUEST_NOTES_MAX)?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    let request_id = random_hex_id("");
    let now = now_epoch_string();
    let week_bucket = sql_week_bucket(db.connection(), now.as_str())?;

    db.connection()
        .execute(
            "INSERT INTO request_log (
                id, received_at, week_bucket, source, subject_shadow_id,
                topic_text, urgency, status, notes_local
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'open', ?8)",
            rusqlite::params![
                request_id.as_str(),
                now.as_str(),
                week_bucket.as_str(),
                source.as_str(),
                subject_shadow_id.as_str(),
                topic_text.as_str(),
                urgency.as_str(),
                notes_local.as_str(),
            ],
        )
        .map_err(|e| format!("sqlite insert request_log failed: {e}"))?;
    audit_log_write(
        db.connection(),
        "insert",
        "request_log",
        &request_id,
        &serde_json::json!({}),
    )?;
    Ok(request_id)
}

#[tauri::command]
fn db_list_requests(
    filter: Option<RequestListFilter>,
    state: State<'_, DbState>,
) -> Result<Vec<RequestLogEntry>, String> {
    let mut clauses: Vec<String> = Vec::new();
    let mut params: Vec<String> = Vec::new();

    if let Some(f) = filter {
        if let Some(statuses) = f.statuses {
            if !statuses.is_empty() {
                validate_status_filter(&statuses, REQUEST_STATUS_VALUES, "request status")?;
                let placeholders = statuses
                    .iter()
                    .enumerate()
                    .map(|(i, _)| format!("?{}", params.len() + i + 1))
                    .collect::<Vec<_>>()
                    .join(", ");
                clauses.push(format!("status IN ({placeholders})"));
                params.extend(statuses);
            }
        }
        if let Some(urgencies) = f.urgencies {
            if !urgencies.is_empty() {
                validate_status_filter(&urgencies, REQUEST_URGENCY_VALUES, "request urgency")?;
                let placeholders = urgencies
                    .iter()
                    .enumerate()
                    .map(|(i, _)| format!("?{}", params.len() + i + 1))
                    .collect::<Vec<_>>()
                    .join(", ");
                clauses.push(format!("urgency IN ({placeholders})"));
                params.extend(urgencies);
            }
        }
        if let Some(after) = f.received_after {
            let trimmed = after.trim();
            if !trimmed.is_empty() {
                params.push(trimmed.to_string());
                clauses.push(format!("received_at >= ?{}", params.len()));
            }
        }
    }

    let sql = if clauses.is_empty() {
        "SELECT id, received_at, week_bucket, source, subject_shadow_id, topic_text,
                urgency, status, case_id, closed_at, close_reason, notes_local
         FROM request_log
         ORDER BY received_at DESC, id".to_string()
    } else {
        format!(
            "SELECT id, received_at, week_bucket, source, subject_shadow_id, topic_text,
                    urgency, status, case_id, closed_at, close_reason, notes_local
             FROM request_log
             WHERE {}
             ORDER BY received_at DESC, id",
            clauses.join(" AND ")
        )
    };

    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let mut stmt = db
        .connection()
        .prepare(&sql)
        .map_err(|e| format!("sqlite prepare list_requests failed: {e}"))?;

    let map_row = |row: &rusqlite::Row<'_>| {
        Ok(RequestLogEntry {
            id: row.get(0)?,
            received_at: row.get(1)?,
            week_bucket: row.get(2)?,
            source: row.get(3)?,
            subject_shadow_id: row.get(4)?,
            topic_text: row.get(5)?,
            urgency: row.get(6)?,
            status: row.get(7)?,
            case_id: row.get(8)?,
            closed_at: row.get(9)?,
            close_reason: row.get(10)?,
            notes_local: row.get(11)?,
        })
    };

    let param_refs: Vec<&str> = params.iter().map(|s| s.as_str()).collect();
    let rows = stmt
        .query_map(rusqlite::params_from_iter(param_refs.iter().copied()), map_row)
        .map_err(|e| format!("sqlite list_requests query failed: {e}"))?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| format!("sqlite list_requests row failed: {e}"))?);
    }
    Ok(out)
}

#[tauri::command]
fn db_update_request_status(
    request_id: String,
    payload: RequestStatusUpdateInput,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let status = validate_enum_value(&payload.status, REQUEST_STATUS_VALUES, "request status")?;
    let close_reason = validate_optional_text(
        &payload.close_reason,
        "close_reason",
        REQUEST_CLOSE_REASON_MAX,
    )?;
    let case_id = match &payload.case_id {
        Some(c) if !c.trim().is_empty() => Some(validate_required_text(c, "case_id", 128)?),
        _ => None,
    };

    if status == "converted_to_case" && case_id.is_none() {
        return Err("case_id is required when status is converted_to_case".to_string());
    }
    if (status == "open" || status == "in_triage") && !close_reason.is_empty() {
        // close_reason is optional noise on reopen paths — ignore rather than fail.
    }

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    let now = now_epoch_string();
    let closed_at = if status == "open" || status == "in_triage" {
        None
    } else {
        Some(now.as_str())
    };

    let updated = db
        .connection()
        .execute(
            "UPDATE request_log SET
                status       = ?1,
                case_id      = COALESCE(?2, case_id),
                closed_at    = COALESCE(?3, closed_at),
                close_reason = CASE WHEN ?1 IN ('open', 'in_triage') THEN NULL ELSE COALESCE(?4, close_reason) END
             WHERE id = ?5",
            rusqlite::params![
                status.as_str(),
                case_id.as_deref(),
                closed_at,
                if close_reason.is_empty() {
                    None
                } else {
                    Some(close_reason.as_str())
                },
                request_id.as_str(),
            ],
        )
        .map_err(|e| format!("sqlite update request_log failed: {e}"))?;
    if updated == 0 {
        return Err("request not found".to_string());
    }
    let audit_action = if status == "converted_to_case" || status == "closed_without_case" {
        "status_change"
    } else {
        "update"
    };
    audit_log_write(
        db.connection(),
        audit_action,
        "request_log",
        &request_id,
        &serde_json::json!({ "status": { "new": status } }),
    )?;
    Ok(())
}

#[tauri::command]
fn db_convert_request_to_case(
    request_id: String,
    case_payload: CaseFromRequestInput,
    state: State<'_, DbState>,
) -> Result<String, String> {
    let primary_task_kind = match &case_payload.primary_task_kind {
        Some(k) => validate_enum_value(k, CASE_PRIMARY_TASK_KIND_VALUES, "primary_task_kind")?,
        None => "other".to_string(),
    };
    let notes_local =
        validate_optional_text(&case_payload.notes_local, "notes_local", CASE_NOTES_MAX)?;
    let child_name = validate_optional_text(
        &case_payload.child_full_name_enc,
        "child_full_name_enc",
        CASE_CHILD_NAME_MAX,
    )?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    let conn = db.connection_mut();
    let tx = conn
        .transaction()
        .map_err(|e| format!("sqlite tx begin failed: {e}"))?;

    let (current_status, subject_shadow): (String, String) = tx
        .query_row(
            "SELECT status, subject_shadow_id FROM request_log WHERE id = ?1",
            [request_id.as_str()],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "request not found".to_string())?;

    if current_status == "converted_to_case" {
        return Err("request already converted to case".to_string());
    }
    if current_status == "closed_without_case" {
        return Err("request is closed without case".to_string());
    }

    let case_id = random_hex_id("");
    let now = now_epoch_string();
    let child_full_name_enc = if child_name.is_empty() {
        subject_shadow
    } else {
        child_name
    };

    tx.execute(
        "INSERT INTO case_files (
            id, opened_at, archived_at, status, locale,
            lead_specialist_id, primary_task_kind, notes_local
         ) VALUES (?1, ?2, NULL, 'active', 'ru', 1, ?3, ?4)",
        rusqlite::params![
            case_id.as_str(),
            now.as_str(),
            primary_task_kind.as_str(),
            notes_local.as_str(),
        ],
    )
    .map_err(|e| format!("sqlite insert case_files failed: {e}"))?;

    tx.execute(
        "INSERT INTO case_pii (
            case_id, child_full_name_enc, child_dob, child_sex,
            contacts, addresses, parents, documents
         ) VALUES (?1, ?2, NULL, 'unspecified', '[]', '[]', '[]', '[]')",
        rusqlite::params![case_id.as_str(), child_full_name_enc.as_str()],
    )
    .map_err(|e| format!("sqlite insert case_pii failed: {e}"))?;

    let problem_id = random_hex_id("");
    tx.execute(
        "INSERT INTO case_problems (
            id, case_id, task_kind, since, until, notes_local
         ) VALUES (?1, ?2, ?3, ?4, NULL, '')",
        rusqlite::params![
            problem_id.as_str(),
            case_id.as_str(),
            primary_task_kind.as_str(),
            now.as_str(),
        ],
    )
    .map_err(|e| format!("sqlite insert case_problems failed: {e}"))?;

    tx.execute(
        "INSERT INTO case_subject_categories (case_id, category, is_primary)
         VALUES (?1, 'normal', 1)",
        [case_id.as_str()],
    )
    .map_err(|e| format!("sqlite insert case_subject_categories failed: {e}"))?;

    tx.execute(
        "UPDATE request_log SET
            status = 'converted_to_case',
            case_id = ?1,
            closed_at = ?2,
            close_reason = NULL
         WHERE id = ?3",
        rusqlite::params![case_id.as_str(), now.as_str(), request_id.as_str()],
    )
    .map_err(|e| format!("sqlite update request_log on convert failed: {e}"))?;

    audit_log_write(
        &*tx,
        "insert",
        "case_files",
        &case_id,
        &serde_json::json!({ "request_id": request_id }),
    )?;
    audit_log_write(
        &*tx,
        "status_change",
        "request_log",
        &request_id,
        &serde_json::json!({ "status": { "new": "converted_to_case" }, "case_id": { "new": case_id } }),
    )?;

    tx.commit()
        .map_err(|e| format!("sqlite tx commit failed: {e}"))?;
    Ok(case_id)
}

// ============================================================================
// Phase A Sprint 4 — referrals + audit log read API
// ============================================================================

#[tauri::command]
fn db_create_referral(
    payload: ReferralCreateInput,
    state: State<'_, DbState>,
) -> Result<String, String> {
    let case_id = validate_required_text(&payload.case_id, "case_id", 128)?;
    let referred_to =
        validate_enum_value(&payload.referred_to, REFERRAL_TARGET_VALUES, "referred_to")?;
    let reason_text = validate_required_text(&payload.reason_text, "reason_text", REFERRAL_REASON_MAX)?;
    let referred_to_name = validate_optional_text(
        &payload.referred_to_name,
        "referred_to_name",
        REFERRAL_NAME_MAX,
    )?;
    let urgency = match &payload.urgency {
        Some(u) => validate_enum_value(u, REQUEST_URGENCY_VALUES, "referral urgency")?,
        None => "normal".to_string(),
    };
    let follow_up_at = validate_target_date(&payload.follow_up_at)?;
    let notes_local =
        validate_optional_text(&payload.notes_local, "notes_local", REFERRAL_NOTES_MAX)?;
    let request_id = match &payload.request_id {
        Some(r) if !r.trim().is_empty() => Some(validate_required_text(r, "request_id", 128)?),
        _ => None,
    };

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    let referral_id = random_hex_id("");
    let now = now_epoch_string();

    db.connection()
        .execute(
            "INSERT INTO referrals (
                id, case_id, request_id, referred_to, referred_to_name, reason_text,
                urgency, status, referred_at, follow_up_at, notes_local, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?9, ?10, ?8, ?8)",
            rusqlite::params![
                referral_id.as_str(),
                case_id.as_str(),
                request_id.as_deref(),
                referred_to.as_str(),
                referred_to_name.as_str(),
                reason_text.as_str(),
                urgency.as_str(),
                now.as_str(),
                follow_up_at.as_deref(),
                notes_local.as_str(),
            ],
        )
        .map_err(|e| {
            if e.to_string().contains("FOREIGN KEY") {
                "case_id or request_id does not exist".to_string()
            } else {
                format!("sqlite insert referrals failed: {e}")
            }
        })?;

    audit_log_write(
        db.connection(),
        "insert",
        "referrals",
        &referral_id,
        &serde_json::json!({}),
    )?;
    Ok(referral_id)
}

#[tauri::command]
fn db_list_referrals(
    case_id: Option<String>,
    state: State<'_, DbState>,
) -> Result<Vec<Referral>, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let (sql, filter_case) = if let Some(cid) = case_id {
        let validated = validate_required_text(&cid, "case_id", 128)?;
        (
            "SELECT id, case_id, request_id, referred_to, referred_to_name, reason_text,
                    urgency, status, referred_at, follow_up_at, notes_local, created_at, updated_at
             FROM referrals WHERE case_id = ?1
             ORDER BY referred_at DESC, id",
            Some(validated),
        )
    } else {
        (
            "SELECT id, case_id, request_id, referred_to, referred_to_name, reason_text,
                    urgency, status, referred_at, follow_up_at, notes_local, created_at, updated_at
             FROM referrals
             ORDER BY referred_at DESC, id",
            None,
        )
    };

    let mut stmt = db
        .connection()
        .prepare(sql)
        .map_err(|e| format!("sqlite prepare list_referrals failed: {e}"))?;

    let map_row = |row: &rusqlite::Row<'_>| {
        Ok(Referral {
            id: row.get(0)?,
            case_id: row.get(1)?,
            request_id: row.get(2)?,
            referred_to: row.get(3)?,
            referred_to_name: row.get(4)?,
            reason_text: row.get(5)?,
            urgency: row.get(6)?,
            status: row.get(7)?,
            referred_at: row.get(8)?,
            follow_up_at: row.get(9)?,
            notes_local: row.get(10)?,
            created_at: row.get(11)?,
            updated_at: row.get(12)?,
        })
    };

    let rows = if let Some(cid) = filter_case.as_deref() {
        stmt.query_map([cid], map_row)
    } else {
        stmt.query_map([], map_row)
    }
    .map_err(|e| format!("sqlite list_referrals query failed: {e}"))?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| format!("sqlite list_referrals row failed: {e}"))?);
    }
    Ok(out)
}

#[tauri::command]
fn db_update_referral_status(
    referral_id: String,
    payload: ReferralStatusUpdateInput,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let status = validate_enum_value(&payload.status, REFERRAL_STATUS_VALUES, "referral status")?;
    let notes_local =
        validate_optional_text(&payload.notes_local, "notes_local", REFERRAL_NOTES_MAX)?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    let now = now_epoch_string();
    let updated = db
        .connection()
        .execute(
            "UPDATE referrals SET
                status = ?1,
                notes_local = CASE WHEN ?2 = '' THEN notes_local ELSE ?2 END,
                updated_at = ?3
             WHERE id = ?4",
            rusqlite::params![
                status.as_str(),
                notes_local.as_str(),
                now.as_str(),
                referral_id.as_str(),
            ],
        )
        .map_err(|e| format!("sqlite update referrals failed: {e}"))?;
    if updated == 0 {
        return Err("referral not found".to_string());
    }
    audit_log_write(
        db.connection(),
        "status_change",
        "referrals",
        &referral_id,
        &serde_json::json!({ "status": { "new": status } }),
    )?;
    Ok(())
}

#[tauri::command]
fn db_list_audit_log(
    filter: Option<AuditLogListFilter>,
    state: State<'_, DbState>,
) -> Result<Vec<AuditLogEntry>, String> {
    let limit = filter
        .as_ref()
        .and_then(|f| f.limit)
        .unwrap_or(100)
        .clamp(1, 500);
    let table_name = filter
        .as_ref()
        .and_then(|f| f.table_name.as_ref())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    let record_id = filter
        .as_ref()
        .and_then(|f| f.record_id.as_ref())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let mut clauses = Vec::new();
    let mut params: Vec<String> = Vec::new();
    if let Some(t) = table_name {
        params.push(t);
        clauses.push(format!("table_name = ?{}", params.len()));
    }
    if let Some(r) = record_id {
        params.push(r);
        clauses.push(format!("record_id = ?{}", params.len()));
    }
    let where_sql = if clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", clauses.join(" AND "))
    };
    let sql = format!(
        "SELECT id, occurred_at, actor_id, action, table_name, record_id, changed_fields, ip_hash
         FROM audit_log
         {where_sql}
         ORDER BY occurred_at DESC, id
         LIMIT {limit}"
    );

    let mut stmt = db
        .connection()
        .prepare(&sql)
        .map_err(|e| format!("sqlite prepare list_audit_log failed: {e}"))?;
    let param_refs: Vec<&str> = params.iter().map(|s| s.as_str()).collect();
    let rows = stmt
        .query_map(rusqlite::params_from_iter(param_refs.iter().copied()), |row| {
            Ok(AuditLogEntry {
                id: row.get(0)?,
                occurred_at: row.get(1)?,
                actor_id: row.get(2)?,
                action: row.get(3)?,
                table_name: row.get(4)?,
                record_id: row.get(5)?,
                changed_fields: row.get(6)?,
                ip_hash: row.get(7)?,
            })
        })
        .map_err(|e| format!("sqlite list_audit_log query failed: {e}"))?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| format!("sqlite list_audit_log row failed: {e}"))?);
    }
    Ok(out)
}

#[derive(Debug, Serialize)]
struct ResearchMonthlyMetricsResponse {
    metrics: std::collections::BTreeMap<String, i64>,
}

fn research_metric_key(prefix: &str, value: &str) -> String {
    let slug = value
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect::<String>();
    format!("{prefix}{slug}")
}

#[tauri::command]
fn db_research_monthly_metrics(
    period_start: String,
    period_end: String,
    state: State<'_, DbState>,
) -> Result<ResearchMonthlyMetricsResponse, String> {
    let period_start = period_start.trim().to_string();
    let period_end = period_end.trim().to_string();
    if period_start.is_empty() || period_end.is_empty() {
        return Err("period_start and period_end required".to_string());
    }

    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;
    let conn = db.connection();
    let mut metrics = std::collections::BTreeMap::<String, i64>::new();

    let consultation_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM work_log_entries
             WHERE action_kind = 'consultation'
               AND date(datetime(cast(created_at AS integer), 'unixepoch')) >= date(?1)
               AND date(datetime(cast(created_at AS integer), 'unixepoch')) <= date(?2)",
            rusqlite::params![period_start.as_str(), period_end.as_str()],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let work_minutes: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(minutes), 0) FROM work_log_entries
             WHERE date(datetime(cast(created_at AS integer), 'unixepoch')) >= date(?1)
               AND date(datetime(cast(created_at AS integer), 'unixepoch')) <= date(?2)",
            rusqlite::params![period_start.as_str(), period_end.as_str()],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let group_session_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM group_sessions
             WHERE session_date >= ?1 AND session_date <= ?2",
            rusqlite::params![period_start.as_str(), period_end.as_str()],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let active_cases: i64 = conn
        .query_row(
            "SELECT count(DISTINCT case_id) FROM work_log_entries
             WHERE case_id IS NOT NULL AND trim(case_id) != ''
               AND date(datetime(cast(created_at AS integer), 'unixepoch')) >= date(?1)
               AND date(datetime(cast(created_at AS integer), 'unixepoch')) <= date(?2)",
            rusqlite::params![period_start.as_str(), period_end.as_str()],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let elevated_risk_sessions: i64 = conn
        .query_row(
            "SELECT count(*) FROM work_log_entries
             WHERE action_kind = 'consultation'
               AND (
                 note LIKE '%\"riskLevel\":\"moderate\"%'
                 OR note LIKE '%\"riskLevel\":\"high\"%'
                 OR note LIKE '%\"riskLevel\":\"crisis\"%'
               )
               AND date(datetime(cast(created_at AS integer), 'unixepoch')) >= date(?1)
               AND date(datetime(cast(created_at AS integer), 'unixepoch')) <= date(?2)",
            rusqlite::params![period_start.as_str(), period_end.as_str()],
            |row| row.get(0),
        )
        .unwrap_or(0);

    metrics.insert("consultation_count".to_string(), consultation_count);
    metrics.insert("work_minutes".to_string(), work_minutes);
    metrics.insert("group_session_count".to_string(), group_session_count);
    metrics.insert("active_cases".to_string(), active_cases);
    metrics.insert("elevated_risk_sessions".to_string(), elevated_risk_sessions);

    let mut y_stmt = conn
        .prepare(
            "SELECT risk.y_level, count(DISTINCT risk.case_id) AS cnt
             FROM (
                SELECT crs.case_id, crs.y_level
                FROM case_risk_scores crs
                INNER JOIN (
                    SELECT case_id, MAX(computed_at) AS max_at
                    FROM case_risk_scores
                    GROUP BY case_id
                ) latest ON latest.case_id = crs.case_id AND latest.max_at = crs.computed_at
             ) risk
             INNER JOIN work_log_entries w ON w.case_id = risk.case_id
             WHERE date(datetime(cast(w.created_at AS integer), 'unixepoch')) >= date(?1)
               AND date(datetime(cast(w.created_at AS integer), 'unixepoch')) <= date(?2)
             GROUP BY risk.y_level",
        )
        .map_err(|e| format!("sqlite prepare research y_level failed: {e}"))?;
    let y_rows = y_stmt
        .query_map(
            rusqlite::params![period_start.as_str(), period_end.as_str()],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                ))
            },
        )
        .map_err(|e| format!("sqlite research y_level query failed: {e}"))?;
    for row in y_rows {
        let (y_level, cnt) = row.map_err(|e| format!("sqlite research y_level row failed: {e}"))?;
        if !y_level.trim().is_empty() {
            metrics.insert(research_metric_key("y_level_", &y_level), cnt);
        }
    }

    let mut x_stmt = conn
        .prepare(
            "SELECT c.x_stage, count(DISTINCT c.case_id) AS cnt
             FROM cases c
             INNER JOIN work_log_entries w ON w.case_id = c.case_id
             WHERE date(datetime(cast(w.created_at AS integer), 'unixepoch')) >= date(?1)
               AND date(datetime(cast(w.created_at AS integer), 'unixepoch')) <= date(?2)
             GROUP BY c.x_stage",
        )
        .map_err(|e| format!("sqlite prepare research x_stage failed: {e}"))?;
    let x_rows = x_stmt
        .query_map(
            rusqlite::params![period_start.as_str(), period_end.as_str()],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                ))
            },
        )
        .map_err(|e| format!("sqlite research x_stage query failed: {e}"))?;
    for row in x_rows {
        let (x_stage, cnt) = row.map_err(|e| format!("sqlite research x_stage row failed: {e}"))?;
        if !x_stage.trim().is_empty() {
            metrics.insert(research_metric_key("x_stage_", &x_stage), cnt);
        }
    }

    Ok(ResearchMonthlyMetricsResponse { metrics })
}

#[tauri::command]
fn db_dashboard_l1(state: State<'_, DbState>) -> Result<DashboardL1, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;
    let conn = db.connection();

    let specialist_name: String = conn
        .query_row(
            "SELECT display_name FROM specialist_profile WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "Специалист".to_string());
    let org_name: String = conn
        .query_row(
            "SELECT display_name FROM org_profile WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "Организация".to_string());
    let week_contract_minutes: i64 = conn
        .query_row(
            "SELECT weekly_contract_minutes FROM specialist_profile WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let school_year = sql_current_school_year(conn)?;
    let week_bucket = sql_current_week_bucket(conn)?;

    let week_planned_minutes: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(minutes_planned), 0) FROM case_touches WHERE week_bucket = ?1",
            [week_bucket.as_str()],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let week_actual_minutes: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(minutes_actual), 0) FROM case_touches WHERE week_bucket = ?1",
            [week_bucket.as_str()],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let week_load_pct = if week_contract_minutes > 0 {
        (week_actual_minutes * 100) / week_contract_minutes
    } else {
        0
    };

    let week_consultation_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM work_log_entries
             WHERE action_kind = 'consultation'
               AND strftime('%Y-W%W', datetime(cast(created_at AS integer), 'unixepoch')) = ?1",
            [week_bucket.as_str()],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let week_consultation_minutes: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(minutes), 0) FROM work_log_entries
             WHERE action_kind = 'consultation'
               AND strftime('%Y-W%W', datetime(cast(created_at AS integer), 'unixepoch')) = ?1",
            [week_bucket.as_str()],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let total_consultation_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM work_log_entries WHERE action_kind = 'consultation'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let elevated_risk_sessions: i64 = conn
        .query_row(
            "SELECT count(*) FROM work_log_entries
             WHERE action_kind = 'consultation'
               AND (
                 note LIKE '%\"riskLevel\":\"moderate\"%'
                 OR note LIKE '%\"riskLevel\":\"high\"%'
                 OR note LIKE '%\"riskLevel\":\"crisis\"%'
               )",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let open_requests_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM request_log WHERE status IN ('open', 'in_triage')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let crisis_requests_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM request_log
             WHERE status IN ('open', 'in_triage') AND urgency = 'crisis'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let mut oldest_stmt = conn
        .prepare(
            "SELECT id, received_at, source, subject_shadow_id, topic_text, urgency, status
             FROM request_log
             WHERE status IN ('open', 'in_triage')
             ORDER BY received_at ASC, id
             LIMIT 3",
        )
        .map_err(|e| format!("sqlite prepare dashboard requests failed: {e}"))?;
    let oldest_rows = oldest_stmt
        .query_map([], |row| {
            Ok(RequestPreview {
                id: row.get(0)?,
                received_at: row.get(1)?,
                source: row.get(2)?,
                subject_shadow_id: row.get(3)?,
                topic_text: row.get(4)?,
                urgency: row.get(5)?,
                status: row.get(6)?,
            })
        })
        .map_err(|e| format!("sqlite dashboard requests query failed: {e}"))?;
    let mut oldest_open_requests = Vec::new();
    for r in oldest_rows {
        oldest_open_requests
            .push(r.map_err(|e| format!("sqlite dashboard requests row failed: {e}"))?);
    }

    let active_cases_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM case_files WHERE status = 'active'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let mut overdue_stmt = conn
        .prepare(
            "SELECT cf.id, cf.primary_task_kind, count(*) AS overdue_steps
             FROM case_files cf
             JOIN iprs i ON i.case_id = cf.id AND i.status = 'active'
             JOIN ipr_steps s ON s.ipr_id = i.id
             WHERE cf.status = 'active'
               AND s.status IN ('planned', 'in_progress')
               AND s.target_date IS NOT NULL
               AND s.target_date < date('now')
             GROUP BY cf.id, cf.primary_task_kind
             ORDER BY overdue_steps DESC, cf.id
             LIMIT 5",
        )
        .map_err(|e| format!("sqlite prepare dashboard overdue failed: {e}"))?;
    let overdue_rows = overdue_stmt
        .query_map([], |row| {
            Ok(CasePreview {
                case_id: row.get(0)?,
                primary_task_kind: row.get(1)?,
                overdue_steps: row.get(2)?,
            })
        })
        .map_err(|e| format!("sqlite dashboard overdue query failed: {e}"))?;
    let mut cases_with_overdue_steps = Vec::new();
    for r in overdue_rows {
        cases_with_overdue_steps
            .push(r.map_err(|e| format!("sqlite dashboard overdue row failed: {e}"))?);
    }

    let mut yp_stmt = conn
        .prepare(
            "SELECT ypt.id, ypt.title, ypt.planned_minutes,
                    COALESCE(SUM(ct.minutes_actual), 0) AS actual_minutes
             FROM year_plan_tasks ypt
             LEFT JOIN case_touches ct ON ct.task_id = ypt.id
             WHERE ypt.school_year = ?1 AND ypt.status != 'cancelled'
             GROUP BY ypt.id, ypt.title, ypt.planned_minutes
             ORDER BY ypt.updated_at DESC, ypt.id",
        )
        .map_err(|e| format!("sqlite prepare dashboard year_plan failed: {e}"))?;
    let yp_rows = yp_stmt
        .query_map([school_year.as_str()], |row| {
            let planned: i64 = row.get(2)?;
            let actual: i64 = row.get(3)?;
            let progress_pct = if planned > 0 {
                (actual * 100) / planned
            } else {
                0
            };
            Ok(YearPlanTaskProgress {
                task_id: row.get(0)?,
                title: row.get(1)?,
                planned_minutes: planned,
                actual_minutes: actual,
                progress_pct,
            })
        })
        .map_err(|e| format!("sqlite dashboard year_plan query failed: {e}"))?;
    let mut year_plan_progress = Vec::new();
    for r in yp_rows {
        year_plan_progress
            .push(r.map_err(|e| format!("sqlite dashboard year_plan row failed: {e}"))?);
    }

    let group_sessions_count: i64 = conn
        .query_row("SELECT count(*) FROM group_sessions", [], |row| row.get(0))
        .unwrap_or(0);

    Ok(DashboardL1 {
        specialist_name,
        org_name,
        school_year,
        week_planned_minutes,
        week_actual_minutes,
        week_contract_minutes,
        week_load_pct,
        week_consultation_count,
        week_consultation_minutes,
        total_consultation_count,
        elevated_risk_sessions,
        open_requests_count,
        crisis_requests_count,
        oldest_open_requests,
        active_cases_count,
        cases_with_overdue_steps,
        year_plan_progress,
        group_sessions_count,
    })
}

#[tauri::command]
fn db_manager_dashboard_l1(state: State<'_, DbState>) -> Result<ManagerDashboardL1, String> {
    use std::collections::HashMap;

    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;
    let conn = db.connection();

    let org_name: String = conn
        .query_row(
            "SELECT display_name FROM org_profile WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "Организация".to_string());
    let school_year = sql_current_school_year(conn)?;

    let mut threats = Vec::new();

    let mut threat_stmt = conn
        .prepare(
            "SELECT
                strftime('%Y-%m', cf.opened_at) AS month,
                cf.primary_task_kind AS category_key,
                count(*) AS incidents,
                sum(CASE WHEN risk.y_level IN ('Y3_Problem', 'Y4_Crisis_Clinical') THEN 1 ELSE 0 END) AS severe_incidents,
                avg(
                    CASE risk.y_level
                        WHEN 'Y1_Normal' THEN 1.0
                        WHEN 'Y2_Risk' THEN 2.0
                        WHEN 'Y3_Problem' THEN 3.0
                        WHEN 'Y4_Crisis_Clinical' THEN 4.0
                        ELSE 2.0
                    END
                ) AS avg_severity
             FROM case_files cf
             LEFT JOIN (
                SELECT crs.case_id, crs.y_level
                FROM case_risk_scores crs
                INNER JOIN (
                    SELECT case_id, MAX(computed_at) AS max_at
                    FROM case_risk_scores
                    GROUP BY case_id
                ) latest ON latest.case_id = crs.case_id AND latest.max_at = crs.computed_at
             ) risk ON risk.case_id = cf.id
             WHERE cf.opened_at >= date('now', '-12 months')
             GROUP BY month, category_key
             HAVING month IS NOT NULL AND month != ''
             ORDER BY month DESC, category_key",
        )
        .map_err(|e| format!("sqlite prepare manager threats failed: {e}"))?;
    let threat_rows = threat_stmt
        .query_map([], |row| {
            Ok(ThreatCategoryRow {
                category_key: row.get(1)?,
                month: row.get(0)?,
                incidents: row.get(2)?,
                severe_incidents: row.get(3)?,
                avg_severity: row.get(4)?,
            })
        })
        .map_err(|e| format!("sqlite manager threats query failed: {e}"))?;
    for row in threat_rows {
        threats.push(row.map_err(|e| format!("sqlite manager threats row failed: {e}"))?);
    }

    let mut consult_stmt = conn
        .prepare(
            "SELECT
                strftime('%Y-%m', datetime(cast(created_at AS integer), 'unixepoch')) AS month,
                count(*) AS incidents
             FROM work_log_entries
             WHERE action_kind = 'consultation'
               AND (
                 note LIKE '%\"riskLevel\":\"moderate\"%'
                 OR note LIKE '%\"riskLevel\":\"high\"%'
                 OR note LIKE '%\"riskLevel\":\"crisis\"%'
               )
               AND datetime(cast(created_at AS integer), 'unixepoch') >= date('now', '-12 months')
             GROUP BY month
             HAVING month IS NOT NULL AND month != ''
             ORDER BY month DESC",
        )
        .map_err(|e| format!("sqlite prepare manager elevated consults failed: {e}"))?;
    let consult_rows = consult_stmt
        .query_map([], |row| {
            let month: String = row.get(0)?;
            let incidents: i64 = row.get(1)?;
            Ok(ThreatCategoryRow {
                category_key: "elevated_consultation".to_string(),
                month,
                incidents,
                severe_incidents: incidents,
                avg_severity: 3.0,
            })
        })
        .map_err(|e| format!("sqlite manager elevated consults query failed: {e}"))?;
    for row in consult_rows {
        threats.push(row.map_err(|e| format!("sqlite manager elevated consults row failed: {e}"))?);
    }

    let mut prevention_map: HashMap<(String, String), PreventionLevelRow> = HashMap::new();

    let mut yp_stmt = conn
        .prepare(
            "SELECT strftime('%Y-%m', created_at) AS month, task_kind, planned_minutes
             FROM year_plan_tasks
             WHERE school_year = ?1 AND status != 'cancelled'
               AND created_at >= date('now', '-12 months')",
        )
        .map_err(|e| format!("sqlite prepare manager year plan prevention failed: {e}"))?;
    let yp_rows = yp_stmt
        .query_map([school_year.as_str()], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })
        .map_err(|e| format!("sqlite manager year plan prevention query failed: {e}"))?;
    for row in yp_rows {
        let (month, task_kind, planned_minutes) =
            row.map_err(|e| format!("sqlite manager year plan prevention row failed: {e}"))?;
        if month.trim().is_empty() {
            continue;
        }
        let link = year_plan_task_prevention_link(task_kind.as_str()).to_string();
        let key = (link.clone(), month.clone());
        let entry = prevention_map.entry(key).or_insert(PreventionLevelRow {
            prevention_link: link,
            month,
            planned_hours: 0,
            planned_reach: 0,
            actual_hours: 0,
            actual_reach: 0,
        });
        entry.planned_hours += (planned_minutes + 59) / 60;
    }

    let mut gs_stmt = conn
        .prepare(
            "SELECT strftime('%Y-%m', session_date) AS month, duration_minutes, audience_json
             FROM group_sessions
             WHERE session_date >= date('now', '-12 months')",
        )
        .map_err(|e| format!("sqlite prepare manager group sessions failed: {e}"))?;
    let gs_rows = gs_stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| format!("sqlite manager group sessions query failed: {e}"))?;
    for row in gs_rows {
        let (month, duration_minutes, audience_json) =
            row.map_err(|e| format!("sqlite manager group sessions row failed: {e}"))?;
        if month.trim().is_empty() {
            continue;
        }
        let link = "L2_selective".to_string();
        let reach = audience_reach_from_json(audience_json.as_str());
        let key = (link.clone(), month.clone());
        let entry = prevention_map.entry(key).or_insert(PreventionLevelRow {
            prevention_link: link,
            month,
            planned_hours: 0,
            planned_reach: 0,
            actual_hours: 0,
            actual_reach: 0,
        });
        entry.actual_hours += (duration_minutes + 59) / 60;
        entry.actual_reach += reach;
    }

    let mut op_stmt = conn
        .prepare(
            "SELECT strftime('%Y-%m', created_at) AS month, prevention_link, audience_json
             FROM organization_programs
             WHERE created_at >= date('now', '-12 months')",
        )
        .map_err(|e| format!("sqlite prepare manager org programs failed: {e}"))?;
    let op_rows = op_stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| format!("sqlite manager org programs query failed: {e}"))?;
    for row in op_rows {
        let (month, prevention_link, audience_json) =
            row.map_err(|e| format!("sqlite manager org programs row failed: {e}"))?;
        if month.trim().is_empty() {
            continue;
        }
        let link = normalize_prevention_link(prevention_link.as_str(), "L1_universal");
        let reach = audience_reach_from_json(audience_json.as_str());
        let key = (link.clone(), month.clone());
        let entry = prevention_map.entry(key).or_insert(PreventionLevelRow {
            prevention_link: link,
            month,
            planned_hours: 0,
            planned_reach: 0,
            actual_hours: 0,
            actual_reach: 0,
        });
        entry.actual_hours += 1;
        entry.actual_reach += reach.max(1);
    }

    let mut prevention_levels: Vec<PreventionLevelRow> = prevention_map.into_values().collect();
    prevention_levels.sort_by(|a, b| b.month.cmp(&a.month).then(a.prevention_link.cmp(&b.prevention_link)));

    let mut monthly_map: HashMap<String, MonthlySevereRow> = HashMap::new();
    for threat in &threats {
        let entry = monthly_map
            .entry(threat.month.clone())
            .or_insert(MonthlySevereRow {
                month: threat.month.clone(),
                severe_incidents: 0,
                elevated_consultations: 0,
            });
        if threat.category_key == "elevated_consultation" {
            entry.elevated_consultations += threat.severe_incidents;
        } else {
            entry.severe_incidents += threat.severe_incidents;
        }
    }
    let mut monthly_severe: Vec<MonthlySevereRow> = monthly_map.into_values().collect();
    monthly_severe.sort_by(|a, b| b.month.cmp(&a.month));

    let mut year_plan_stmt = conn
        .prepare(
            "SELECT ypt.id, ypt.title, ypt.planned_minutes,
                    COALESCE(SUM(ct.minutes_actual), 0) AS actual_minutes
             FROM year_plan_tasks ypt
             LEFT JOIN case_touches ct ON ct.task_id = ypt.id
             WHERE ypt.school_year = ?1 AND ypt.status != 'cancelled'
             GROUP BY ypt.id, ypt.title, ypt.planned_minutes
             ORDER BY ypt.updated_at DESC, ypt.id",
        )
        .map_err(|e| format!("sqlite prepare manager year_plan failed: {e}"))?;
    let year_plan_rows = year_plan_stmt
        .query_map([school_year.as_str()], |row| {
            let planned: i64 = row.get(2)?;
            let actual: i64 = row.get(3)?;
            let progress_pct = if planned > 0 {
                (actual * 100) / planned
            } else {
                0
            };
            Ok(YearPlanTaskProgress {
                task_id: row.get(0)?,
                title: row.get(1)?,
                planned_minutes: planned,
                actual_minutes: actual,
                progress_pct,
            })
        })
        .map_err(|e| format!("sqlite manager year_plan query failed: {e}"))?;
    let mut year_plan_progress = Vec::new();
    for row in year_plan_rows {
        year_plan_progress
            .push(row.map_err(|e| format!("sqlite manager year_plan row failed: {e}"))?);
    }

    let active_cases: i64 = conn
        .query_row(
            "SELECT count(*) FROM case_files WHERE status = 'active'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let open_requests: i64 = conn
        .query_row(
            "SELECT count(*) FROM request_log WHERE status IN ('open', 'in_triage')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let crisis_requests: i64 = conn
        .query_row(
            "SELECT count(*) FROM request_log
             WHERE status IN ('open', 'in_triage') AND urgency = 'crisis'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let group_sessions_year: i64 = conn
        .query_row(
            "SELECT count(*) FROM group_sessions
             WHERE session_date >= date('now', 'start of year')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    let organization_programs_year: i64 = conn
        .query_row(
            "SELECT count(*) FROM organization_programs
             WHERE program_year = ?1 OR created_at >= date('now', 'start of year')",
            [school_year.as_str()],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(ManagerDashboardL1 {
        org_name,
        school_year,
        threats,
        prevention_levels,
        monthly_severe,
        year_plan_progress,
        totals: ManagerDashboardTotals {
            active_cases,
            open_requests,
            crisis_requests,
            group_sessions_year,
            organization_programs_year,
        },
    })
}

/// Денормализованная проекция TaxonomyPassport, нужная для INSERT в `cases`.
/// Эти же ключи UI обязан положить в JSON, который приходит снаружи.
/// Сам полный JSON хранится в колонке `passport_json` без изменений.
#[derive(Debug, Deserialize)]
struct PassportFields {
    x_stage: String,
    y_level: String,
    #[serde(default)]
    m_modality: Vec<String>,
    executor_role: String,
    org_scale: String,
    #[serde(default)]
    topic_tags: Vec<String>,
}

/// Phase 3.7 — описание одного локального ФИО-алиаса, который фронт хочет
/// сохранить вместе с кейсом. Вложенный payload передаётся из TypeScript уже
/// в snake_case (`alias_id` / `role_no` / `real_name`), поэтому отдельный
/// `serde(rename_all = "...")` здесь не нужен.
///
/// Семантика полей:
///   * `alias_id` — UUID, сгенерированный на клиенте (не сервером). Это
///     стабильный идентификатор записи, используемый позже для редактирования
///     или удаления конкретного алиаса.
///   * `role` — категория участника дела. Допустимые значения проверяются
///     в `db_insert_case` (см. `ALLOWED_ALIAS_ROLES`).
///   * `role_no` — порядковый номер внутри пары (case_id, role). Считается
///     на стороне фронта и инсертится в БД как есть. UNIQUE-констрейнт
///     `pd_aliases` гарантирует, что дубликат номера в одном кейсе не
///     пройдёт.
///   * `real_name` — реальное ФИО (или короткое имя), которое психолог
///     ввёл в шапке карточки. Хранится ТОЛЬКО в локальной зашифрованной
///     БД и никогда не уходит в сетевой контур.
#[derive(Debug, Deserialize)]
struct AliasInput {
    alias_id: String,
    role: String,
    role_no: i64,
    real_name: String,
}

#[derive(Debug, Serialize)]
struct SessionRecord {
    record_id: String,
    case_id: String,
    session_no: i64,
    content_json: String,
    recorded_at: String,
    created_at: String,
}

#[derive(Debug, Serialize)]
struct WorkLogEntry {
    entry_id: String,
    case_id: String,
    action_kind: String,
    minutes: i64,
    note: String,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct CalendarSlot {
    slot_id: String,
    case_id: String,
    specialist_id: String,
    start_time: i64,
    end_time: i64,
    buffer_minutes: i64,
    recurrence_weeks: i64,
    visit_status: String,
    client_name: String,
    notes: String,
}

/// Канонический whitelist ролей. Дублируется в `src/lib/case.ts`
/// (константа `ALIAS_ROLES`). При смене значений править ОБЕ стороны.
const ALLOWED_ALIAS_ROLES: &[&str] = &[
    "student", "parent", "teacher", "other", "client", "partner",
];

/// Phase 3.8 — whitelist типов действий в журнале.
/// Дублируется в `src/lib/worklog.ts` (`WORK_LOG_ACTIONS`).
const ALLOWED_WORK_LOG_ACTIONS: &[&str] = &[
    "consultation",
    "call",
    "document",
    "observation",
    "other",
];

const ALLOWED_ORG_KINDS: &[&str] = &[
    "combined_school",
    "special_education",
    "out_of_school",
    "psych_support_center",
    "private_practice",
    "other",
];

const ALLOWED_ORG_SPHERE: &[&str] = &[
    "education_system",
    "youth_policy",
    "social_work",
    "law_enforcement",
    "other",
];

const ALLOWED_EDUCATION_ORG_TYPE: &[&str] = &[
    "pre_primary",
    "primary",
    "lower_secondary",
    "upper_secondary",
    "supplementary",
    "correctional",
    "ppms_center",
    "bachelor",
    "master",
    "doctoral",
];

fn now_epoch_string() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
        .to_string()
}

/// Записать новый кейс в локальную зашифрованную БД.
///
/// Аргументы (Tauri 2 авто-конвертит camelCase в JS → snake_case в Rust):
///   * `caseId` (JS) → `case_id` (Rust): UUID, сгенерированный на клиенте.
///   * `taxonomyPassportJson` (JS) → `taxonomy_passport_json` (Rust):
///     сериализованный TaxonomyPassport (см. `src/lib/taxonomy.ts`).
///   * `notesSanitized` (JS) → `notes_sanitized` (Rust): свободный текст
///     заметок, **уже прогнанный** через локальный санитайзер
///     (`src/lib/sanitizer.ts`). Может быть пустой строкой.
///   * `aliases` (JS) → `aliases` (Rust): массив `AliasInput`. Может быть
///     пустым, если в карточке нет участников с ФИО. Phase 3.7 — впервые
///     поддерживается этот параметр; до этого фронт его не отправлял.
///
/// Контракт:
///   * Если БД заблокирована (`state` = `None`) — `Err("DB is locked")`.
///   * JSON `taxonomy_passport_json` парсится в `PassportFields`. Если
///     структура битая — `Err("invalid passport JSON: ...")`.
///   * Личные данные (ФИО, телефоны, СНИЛС, адреса) внутри
///     `notes_sanitized` передавать НЕЛЬЗЯ. Это инвариант UI: вызывать
///     команду можно только с текстом, который вернул санитайзер. Команда
///     сама не фильтрует контент, доверяет фронту.
///   * Поле `aliases[].real_name` — наоборот, должно содержать сырое ФИО,
///     потому что это ровно то значение, которое санитайзер на фронте
///     уже заменил в заметках на маркер. Здесь оно сохраняется локально
///     в зашифрованной БД, чтобы при следующем открытии кейса психолог
///     мог увидеть «кто за кем» скрыт.
///
/// Атомарность:
///   * Кейс + все его алиасы пишутся в одной транзакции. Если падает
///     любой INSERT (например, дублирующий `role_no` в `pd_aliases`),
///     откатывается ВСЯ операция и в БД не остаётся осиротевшего кейса.
#[tauri::command]
fn db_insert_case(
    case_id: String,
    taxonomy_passport_json: String,
    notes_sanitized: String,
    aliases: Vec<AliasInput>,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let fields: PassportFields = serde_json::from_str(&taxonomy_passport_json)
        .map_err(|e| format!("invalid passport JSON: {e}"))?;

    // Валидируем роли ДО открытия транзакции, чтобы при ошибке не делать
    // лишних обращений к БД и сразу вернуть осмысленное сообщение в UI.
    for a in &aliases {
        if !ALLOWED_ALIAS_ROLES.contains(&a.role.as_str()) {
            return Err(format!("unknown alias role: {}", a.role));
        }
    }

    // Денормализуем массивы в строки для индексируемых колонок.
    let m_modality_str = serde_json::to_string(&fields.m_modality)
        .map_err(|e| format!("m_modality serialize: {e}"))?;
    let topic_tags_str = serde_json::to_string(&fields.topic_tags)
        .map_err(|e| format!("topic_tags serialize: {e}"))?;

    // Unix epoch (секунды) как стабильное представление времени без chrono.
    let now = now_epoch_string();

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    let conn = db.connection_mut();
    let tx = conn
        .transaction()
        .map_err(|e| format!("sqlite tx begin failed: {e}"))?;

    tx.execute(
        "INSERT INTO cases (
            case_id, shadow_id, x_stage, y_level, m_modality,
            executor_role, org_scale, topic_tags, passport_json,
            notes_sanitized, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        rusqlite::params![
            case_id.as_str(),
            // shadow_id на этом шаге — это сам case_id; будущая статистика
            // может агрегировать поверх pd_aliases (count distinct case_id+role_no).
            case_id.as_str(),
            fields.x_stage.as_str(),
            fields.y_level.as_str(),
            m_modality_str.as_str(),
            fields.executor_role.as_str(),
            fields.org_scale.as_str(),
            topic_tags_str.as_str(),
            taxonomy_passport_json.as_str(),
            notes_sanitized.as_str(),
            now.as_str(),
            now.as_str(),
        ],
    )
    .map_err(|e| format!("sqlite insert cases failed: {e}"))?;

    for a in &aliases {
        let trimmed = a.real_name.trim();
        if trimmed.is_empty() {
            // Пустые имена — это «черновики» строк в UI, их не пишем.
            continue;
        }
        tx.execute(
            "INSERT INTO pd_aliases (
                alias_id, case_id, role, role_no, real_name, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                a.alias_id.as_str(),
                case_id.as_str(),
                a.role.as_str(),
                a.role_no,
                trimmed,
                now.as_str(),
            ],
        )
        .map_err(|e| format!("sqlite insert pd_aliases failed: {e}"))?;
    }

    tx.commit()
        .map_err(|e| format!("sqlite tx commit failed: {e}"))?;

    Ok(())
}

/// Phase 3.12a — добавить запись приёма в append-only журнал кейса.
///
/// `content_json` — JSON-снимок формы с фронта. Он хранится локально в
/// SQLCipher и не уходит в сетевой контур. `is_initial = true` создаёт
/// `session_no = 0` (первичный приём); повторные приёмы получают следующий
/// номер автоматически.
#[tauri::command]
fn db_add_session_record(
    record_id: String,
    case_id: String,
    content_json: String,
    is_initial: bool,
    state: State<'_, DbState>,
) -> Result<(), String> {
    // Минимальная проверка: это должен быть JSON-объект или массив, а не
    // произвольная строка. Семантика полей остаётся на TypeScript-стороне.
    serde_json::from_str::<serde_json::Value>(&content_json)
        .map_err(|e| format!("invalid session JSON: {e}"))?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;
    let now = now_epoch_string();

    let conn = db.connection();
    let session_no = if is_initial {
        0
    } else {
        let max_no: Option<i64> = conn
            .query_row(
                "SELECT MAX(session_no) FROM session_records WHERE case_id = ?1",
                [case_id.as_str()],
                |row| row.get(0),
            )
            .map_err(|e| format!("sqlite get session max failed: {e}"))?;
        max_no.unwrap_or(0) + 1
    };

    conn.execute(
        "INSERT INTO session_records (
            record_id, case_id, session_no, content_json, recorded_at, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            record_id.as_str(),
            case_id.as_str(),
            session_no,
            content_json.as_str(),
            now.as_str(),
            now.as_str(),
        ],
    )
    .map_err(|e| {
        if is_initial && e.to_string().contains("UNIQUE") {
            "initial session already exists".to_string()
        } else {
            format!("sqlite insert session record failed: {e}")
        }
    })?;

    Ok(())
}

/// Phase 3.12a — список приёмов кейса.
#[tauri::command]
fn db_list_session_records(
    case_id: String,
    state: State<'_, DbState>,
) -> Result<Vec<SessionRecord>, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let mut stmt = db
        .connection()
        .prepare(
            "SELECT record_id, case_id, session_no, content_json, recorded_at, created_at
             FROM session_records
             WHERE case_id = ?1
             ORDER BY session_no ASC, recorded_at ASC",
        )
        .map_err(|e| format!("sqlite prepare session list failed: {e}"))?;

    let rows = stmt
        .query_map([case_id.as_str()], |row| {
            Ok(SessionRecord {
                record_id: row.get(0)?,
                case_id: row.get(1)?,
                session_no: row.get(2)?,
                content_json: row.get(3)?,
                recorded_at: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("sqlite query session list failed: {e}"))?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| format!("sqlite read session row failed: {e}"))?);
    }
    Ok(out)
}

/// Phase 3.8 — добавить запись в журнал действий специалиста.
#[tauri::command]
fn db_add_work_log_entry(
    entry_id: String,
    case_id: String,
    action_kind: String,
    minutes: i64,
    note: String,
    state: State<'_, DbState>,
) -> Result<(), String> {
    if !ALLOWED_WORK_LOG_ACTIONS.contains(&action_kind.as_str()) {
        return Err(format!("unknown work log action: {action_kind}"));
    }
    if minutes <= 0 {
        return Err("minutes must be positive".to_string());
    }

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;
    let now = now_epoch_string();

    db.connection()
        .execute(
            "INSERT INTO work_log_entries (
                entry_id, case_id, action_kind, minutes, note, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                entry_id.as_str(),
                case_id.as_str(),
                action_kind.as_str(),
                minutes,
                note.trim(),
                now.as_str(),
            ],
        )
        .map_err(|e| format!("sqlite insert work log failed: {e}"))?;

    Ok(())
}

#[derive(Debug, Serialize)]
struct GroupSessionRow {
    session_id: String,
    title: String,
    session_date: String,
    duration_minutes: i64,
    theme: String,
    notes: String,
    plan_text: String,
    report_text: String,
    artifacts_json: String,
    audience_json: String,
    prevention_link: String,
    prevention_work_types_json: String,
    session_tags_json: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct GroupSessionUpdateInput {
    title: Option<String>,
    session_date: Option<String>,
    duration_minutes: Option<i64>,
    theme: Option<String>,
    notes: Option<String>,
    plan_text: Option<String>,
    report_text: Option<String>,
    audience_json: Option<String>,
    artifacts_json: Option<String>,
    prevention_link: Option<String>,
    prevention_work_types_json: Option<String>,
    session_tags_json: Option<String>,
}

#[tauri::command]
fn db_list_group_sessions(state: State<'_, DbState>) -> Result<Vec<GroupSessionRow>, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let mut stmt = db
        .connection()
        .prepare(
            "SELECT session_id, title, session_date, duration_minutes, theme, notes,
                    plan_text, report_text, audience_json, artifacts_json,
                    prevention_link, prevention_work_types_json, session_tags_json,
                    created_at, updated_at
             FROM group_sessions
             ORDER BY session_date DESC, updated_at DESC, created_at DESC",
        )
        .map_err(|e| format!("sqlite prepare group sessions failed: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(GroupSessionRow {
                session_id: row.get(0)?,
                title: row.get(1)?,
                session_date: row.get(2)?,
                duration_minutes: row.get(3)?,
                theme: row.get(4)?,
                notes: row.get(5)?,
                plan_text: row.get(6)?,
                report_text: row.get(7)?,
                audience_json: row.get(8)?,
                artifacts_json: row.get(9)?,
                prevention_link: row.get(10)?,
                prevention_work_types_json: row.get(11)?,
                session_tags_json: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })
        .map_err(|e| format!("sqlite query group sessions failed: {e}"))?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| format!("sqlite read group session row failed: {e}"))?);
    }
    Ok(out)
}

#[tauri::command]
fn db_add_group_session(
    session_id: String,
    title: String,
    session_date: String,
    duration_minutes: i64,
    theme: String,
    notes: String,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("title is required".to_string());
    }
    if duration_minutes <= 0 {
        return Err("duration_minutes must be positive".to_string());
    }
    let session_date = session_date.trim();
    if session_date.is_empty() {
        return Err("session_date is required".to_string());
    }

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;
    let now = now_epoch_string();

    db.connection()
        .execute(
            "INSERT INTO group_sessions (
                session_id, title, session_date, duration_minutes, theme, notes,
                plan_text, report_text, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, '', '', ?7, ?7)",
            rusqlite::params![
                session_id.as_str(),
                title,
                session_date,
                duration_minutes,
                theme.trim(),
                notes.trim(),
                now.as_str(),
            ],
        )
        .map_err(|e| format!("sqlite insert group session failed: {e}"))?;

    Ok(())
}

#[tauri::command]
fn db_update_group_session(
    session_id: String,
    payload: GroupSessionUpdateInput,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let session_id = session_id.trim();
    if session_id.is_empty() {
        return Err("session_id is required".to_string());
    }
    if let Some(ref title) = payload.title {
        if title.trim().is_empty() {
            return Err("title is required".to_string());
        }
    }
    if let Some(minutes) = payload.duration_minutes {
        if minutes <= 0 {
            return Err("duration_minutes must be positive".to_string());
        }
    }
    if let Some(ref link) = payload.prevention_link {
        if !link.trim().is_empty() {
            validate_enum_value(link, PREVENTION_LINK_VALUES, "prevention_link")?;
        }
    }

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;
    let now = now_epoch_string();

    let updated = db
        .connection()
        .execute(
            "UPDATE group_sessions SET
                title = COALESCE(?1, title),
                session_date = COALESCE(?2, session_date),
                duration_minutes = COALESCE(?3, duration_minutes),
                theme = COALESCE(?4, theme),
                notes = COALESCE(?5, notes),
                plan_text = COALESCE(?6, plan_text),
                report_text = COALESCE(?7, report_text),
                audience_json = COALESCE(?8, audience_json),
                artifacts_json = COALESCE(?9, artifacts_json),
                prevention_link = COALESCE(?10, prevention_link),
                prevention_work_types_json = COALESCE(?11, prevention_work_types_json),
                session_tags_json = COALESCE(?12, session_tags_json),
                updated_at = ?13
             WHERE session_id = ?14",
            rusqlite::params![
                payload.title.as_deref().map(str::trim),
                payload.session_date.as_deref().map(str::trim),
                payload.duration_minutes,
                payload.theme.as_deref(),
                payload.notes.as_deref(),
                payload.plan_text.as_deref(),
                payload.report_text.as_deref(),
                payload.audience_json.as_deref(),
                payload.artifacts_json.as_deref(),
                payload.prevention_link.as_deref().map(str::trim),
                payload.prevention_work_types_json.as_deref(),
                payload.session_tags_json.as_deref(),
                now.as_str(),
                session_id,
            ],
        )
        .map_err(|e| format!("sqlite update group session failed: {e}"))?;
    if updated == 0 {
        return Err("group session not found".to_string());
    }
    Ok(())
}

#[derive(Debug, Serialize)]
struct WorkEntryRow {
    entry_id: String,
    work_date: String,
    minutes_actual: i64,
    activity_kind: String,
    effort_phase: String,
    title: String,
    notes: String,
    subject_label: String,
    case_id: Option<String>,
    plan_id: Option<String>,
    audience_note: String,
    audience_contingent: String,
    time_start: String,
    time_end: String,
    referrer: String,
    visit_kind: String,
    anonymous_code: String,
    event_form: String,
    diagnostic_kind: String,
    co_executors_text: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct WorkEntryUpdateInput {
    work_date: Option<String>,
    minutes_actual: Option<i64>,
    activity_kind: Option<String>,
    effort_phase: Option<String>,
    title: Option<String>,
    notes: Option<String>,
    subject_label: Option<String>,
    case_id: Option<Option<String>>,
    plan_id: Option<Option<String>>,
    audience_note: Option<String>,
    audience_contingent: Option<String>,
    time_start: Option<String>,
    time_end: Option<String>,
    referrer: Option<String>,
    visit_kind: Option<String>,
    anonymous_code: Option<String>,
    event_form: Option<String>,
    diagnostic_kind: Option<String>,
    co_executors_text: Option<String>,
}

fn map_work_entry_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<WorkEntryRow> {
    Ok(WorkEntryRow {
        entry_id: row.get(0)?,
        work_date: row.get(1)?,
        minutes_actual: row.get(2)?,
        activity_kind: row.get(3)?,
        effort_phase: row.get(4)?,
        title: row.get(5)?,
        notes: row.get(6)?,
        subject_label: row.get(7)?,
        case_id: row.get(8)?,
        plan_id: row.get(9)?,
        audience_note: row.get(10)?,
        audience_contingent: row.get(11)?,
        time_start: row.get(12)?,
        time_end: row.get(13)?,
        referrer: row.get(14)?,
        visit_kind: row.get(15)?,
        anonymous_code: row.get(16)?,
        event_form: row.get(17)?,
        diagnostic_kind: row.get(18)?,
        co_executors_text: row.get(19)?,
        created_at: row.get(20)?,
        updated_at: row.get(21)?,
    })
}

const WORK_ENTRY_SELECT: &str = "SELECT entry_id, work_date, minutes_actual, activity_kind, effort_phase,
        title, notes, subject_label, case_id, plan_id, audience_note, audience_contingent,
        time_start, time_end, referrer, visit_kind, anonymous_code, event_form, diagnostic_kind,
        co_executors_text, created_at, updated_at
     FROM work_entries";

#[tauri::command]
fn db_list_work_entries(
    activity_kinds: Option<Vec<String>>,
    from_date: Option<String>,
    to_date: Option<String>,
    state: State<'_, DbState>,
) -> Result<Vec<WorkEntryRow>, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let kinds: Vec<String> = activity_kinds
        .unwrap_or_default()
        .into_iter()
        .map(|k| k.trim().to_string())
        .filter(|k| !k.is_empty())
        .collect();
    let from_date = from_date.map(|d| d.trim().to_string()).filter(|d| !d.is_empty());
    let to_date = to_date.map(|d| d.trim().to_string()).filter(|d| !d.is_empty());

    let mut sql = String::from(WORK_ENTRY_SELECT);
    let mut binds: Vec<String> = Vec::new();

    if !kinds.is_empty() {
        let placeholders: Vec<String> = kinds.iter().map(|_| "?".to_string()).collect();
        sql.push_str(" WHERE activity_kind IN (");
        sql.push_str(&placeholders.join(", "));
        sql.push(')');
        binds.extend(kinds);
    }

    if let Some(from) = from_date {
        if binds.is_empty() {
            sql.push_str(" WHERE work_date >= ?");
        } else {
            sql.push_str(" AND work_date >= ?");
        }
        binds.push(from);
    }
    if let Some(to) = to_date {
        if binds.is_empty() && !sql.contains("WHERE") {
            sql.push_str(" WHERE work_date <= ?");
        } else {
            sql.push_str(" AND work_date <= ?");
        }
        binds.push(to);
    }

    sql.push_str(" ORDER BY work_date DESC, updated_at DESC, created_at DESC");

    let mut stmt = db
        .connection()
        .prepare(&sql)
        .map_err(|e| format!("sqlite prepare work entries failed: {e}"))?;

    let rows = stmt
        .query_map(rusqlite::params_from_iter(binds.iter()), map_work_entry_row)
        .map_err(|e| format!("sqlite query work entries failed: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("sqlite map work entries failed: {e}"))?;

    Ok(rows)
}

#[tauri::command]
fn db_add_work_entry(
    entry_id: String,
    work_date: String,
    minutes_actual: i64,
    activity_kind: String,
    title: String,
    notes: String,
    subject_label: String,
    effort_phase: Option<String>,
    case_id: Option<String>,
    plan_id: Option<String>,
    audience_note: Option<String>,
    audience_contingent: Option<String>,
    time_start: Option<String>,
    time_end: Option<String>,
    referrer: Option<String>,
    visit_kind: Option<String>,
    anonymous_code: Option<String>,
    event_form: Option<String>,
    diagnostic_kind: Option<String>,
    co_executors_text: Option<String>,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let work_date = work_date.trim();
    if work_date.is_empty() {
        return Err("work_date is required".to_string());
    }
    if minutes_actual <= 0 {
        return Err("minutes_actual must be positive".to_string());
    }
    let activity_kind = activity_kind.trim();
    if activity_kind.is_empty() {
        return Err("activity_kind is required".to_string());
    }

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;
    let now = now_epoch_string();

    db.connection()
        .execute(
            "INSERT INTO work_entries (
                entry_id, work_date, minutes_actual, activity_kind, effort_phase,
                title, notes, subject_label, case_id, plan_id, audience_note, audience_contingent,
                time_start, time_end, referrer, visit_kind, anonymous_code, event_form,
                diagnostic_kind, co_executors_text, created_at, updated_at
             ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?21
             )",
            rusqlite::params![
                entry_id.as_str(),
                work_date,
                minutes_actual,
                activity_kind,
                effort_phase.unwrap_or_default().trim(),
                title.trim(),
                notes.trim(),
                subject_label.trim(),
                case_id.as_deref().map(str::trim).filter(|s| !s.is_empty()),
                plan_id.as_deref().map(str::trim).filter(|s| !s.is_empty()),
                audience_note.unwrap_or_default().trim(),
                audience_contingent.unwrap_or_default().trim(),
                time_start.unwrap_or_default().trim(),
                time_end.unwrap_or_default().trim(),
                referrer.unwrap_or_default().trim(),
                visit_kind.unwrap_or_default().trim(),
                anonymous_code.unwrap_or_default().trim(),
                event_form.unwrap_or_default().trim(),
                diagnostic_kind.unwrap_or_default().trim(),
                co_executors_text.unwrap_or_default().trim(),
                now.as_str(),
            ],
        )
        .map_err(|e| format!("sqlite insert work entry failed: {e}"))?;

    Ok(())
}

#[tauri::command]
fn db_update_work_entry(
    entry_id: String,
    payload: WorkEntryUpdateInput,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let entry_id = entry_id.trim();
    if entry_id.is_empty() {
        return Err("entry_id is required".to_string());
    }
    if let Some(minutes) = payload.minutes_actual {
        if minutes <= 0 {
            return Err("minutes_actual must be positive".to_string());
        }
    }

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;
    let now = now_epoch_string();

    let updated = db
        .connection()
        .execute(
            "UPDATE work_entries SET
                work_date = COALESCE(?1, work_date),
                minutes_actual = COALESCE(?2, minutes_actual),
                activity_kind = COALESCE(?3, activity_kind),
                effort_phase = COALESCE(?4, effort_phase),
                title = COALESCE(?5, title),
                notes = COALESCE(?6, notes),
                subject_label = COALESCE(?7, subject_label),
                case_id = CASE WHEN ?8 IS NULL THEN case_id ELSE ?8 END,
                plan_id = CASE WHEN ?9 IS NULL THEN plan_id ELSE ?9 END,
                audience_note = COALESCE(?10, audience_note),
                audience_contingent = COALESCE(?11, audience_contingent),
                time_start = COALESCE(?12, time_start),
                time_end = COALESCE(?13, time_end),
                referrer = COALESCE(?14, referrer),
                visit_kind = COALESCE(?15, visit_kind),
                anonymous_code = COALESCE(?16, anonymous_code),
                event_form = COALESCE(?17, event_form),
                diagnostic_kind = COALESCE(?18, diagnostic_kind),
                co_executors_text = COALESCE(?19, co_executors_text),
                updated_at = ?20
             WHERE entry_id = ?21",
            rusqlite::params![
                payload.work_date.as_deref().map(str::trim).filter(|s| !s.is_empty()),
                payload.minutes_actual,
                payload.activity_kind.as_deref().map(str::trim).filter(|s| !s.is_empty()),
                payload.effort_phase.as_deref().map(str::trim),
                payload.title.as_deref().map(str::trim),
                payload.notes.as_deref().map(str::trim),
                payload.subject_label.as_deref().map(str::trim),
                payload.case_id.as_ref().and_then(|v| v.as_deref().map(str::trim).filter(|s| !s.is_empty())),
                payload.plan_id.as_ref().and_then(|v| v.as_deref().map(str::trim).filter(|s| !s.is_empty())),
                payload.audience_note.as_deref().map(str::trim),
                payload.audience_contingent.as_deref().map(str::trim),
                payload.time_start.as_deref().map(str::trim),
                payload.time_end.as_deref().map(str::trim),
                payload.referrer.as_deref().map(str::trim),
                payload.visit_kind.as_deref().map(str::trim),
                payload.anonymous_code.as_deref().map(str::trim),
                payload.event_form.as_deref().map(str::trim),
                payload.diagnostic_kind.as_deref().map(str::trim),
                payload.co_executors_text.as_deref().map(str::trim),
                now.as_str(),
                entry_id,
            ],
        )
        .map_err(|e| format!("sqlite update work entry failed: {e}"))?;
    if updated == 0 {
        return Err("work entry not found".to_string());
    }
    Ok(())
}

#[tauri::command]
fn db_delete_work_entry(entry_id: String, state: State<'_, DbState>) -> Result<(), String> {
    let entry_id = entry_id.trim();
    if entry_id.is_empty() {
        return Err("entry_id is required".to_string());
    }

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    let deleted = db
        .connection()
        .execute(
            "DELETE FROM work_entries WHERE entry_id = ?1",
            rusqlite::params![entry_id],
        )
        .map_err(|e| format!("sqlite delete work entry failed: {e}"))?;
    if deleted == 0 {
        return Err("work entry not found".to_string());
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
struct WorkLogUpdateInput {
    #[serde(default)]
    minutes: Option<i64>,
    #[serde(default)]
    note: Option<String>,
}

/// Update an existing work log entry (consultation card edits).
#[tauri::command]
fn db_update_work_log_entry(
    entry_id: String,
    payload: WorkLogUpdateInput,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let entry_id = entry_id.trim();
    if entry_id.is_empty() {
        return Err("entry_id is required".to_string());
    }
    if let Some(minutes) = payload.minutes {
        if minutes <= 0 {
            return Err("minutes must be positive".to_string());
        }
    }
    if payload.minutes.is_none() && payload.note.is_none() {
        return Ok(());
    }

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    let updated = db
        .connection()
        .execute(
            "UPDATE work_log_entries SET
                minutes = COALESCE(?1, minutes),
                note = COALESCE(?2, note)
             WHERE entry_id = ?3",
            rusqlite::params![
                payload.minutes,
                payload.note.as_deref().map(str::trim),
                entry_id,
            ],
        )
        .map_err(|e| format!("sqlite update work log failed: {e}"))?;
    if updated == 0 {
        return Err("work log entry not found".to_string());
    }
    Ok(())
}

#[derive(Debug, Serialize)]
struct OrganizationProgramRow {
    program_id: String,
    title: String,
    program_year: String,
    scope: String,
    notes: String,
    plan_text: String,
    report_text: String,
    artifacts_json: String,
    audience_json: String,
    prevention_link: String,
    prevention_work_types_json: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct OrganizationProgramUpdateInput {
    title: Option<String>,
    program_year: Option<String>,
    scope: Option<String>,
    notes: Option<String>,
    plan_text: Option<String>,
    report_text: Option<String>,
    artifacts_json: Option<String>,
    audience_json: Option<String>,
    prevention_link: Option<String>,
    prevention_work_types_json: Option<String>,
}

#[tauri::command]
fn db_list_organization_programs(state: State<'_, DbState>) -> Result<Vec<OrganizationProgramRow>, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let mut stmt = db
        .connection()
        .prepare(
            "SELECT program_id, title, program_year, scope, notes,
                    plan_text, report_text, artifacts_json, audience_json, prevention_link,
                    prevention_work_types_json, created_at, updated_at
             FROM organization_programs
             ORDER BY program_year DESC, updated_at DESC, created_at DESC",
        )
        .map_err(|e| format!("sqlite prepare organization programs failed: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(OrganizationProgramRow {
                program_id: row.get(0)?,
                title: row.get(1)?,
                program_year: row.get(2)?,
                scope: row.get(3)?,
                notes: row.get(4)?,
                plan_text: row.get(5)?,
                report_text: row.get(6)?,
                artifacts_json: row.get(7)?,
                audience_json: row.get(8)?,
                prevention_link: row.get(9)?,
                prevention_work_types_json: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
        .map_err(|e| format!("sqlite query organization programs failed: {e}"))?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| format!("sqlite read organization program row failed: {e}"))?);
    }
    Ok(out)
}

#[tauri::command]
fn db_add_organization_program(
    program_id: String,
    title: String,
    program_year: String,
    scope: String,
    notes: String,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("title is required".to_string());
    }

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;
    let now = now_epoch_string();

    db.connection()
        .execute(
            "INSERT INTO organization_programs (
                program_id, title, program_year, scope, notes,
                plan_text, report_text, artifacts_json, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, '', '', '{}', ?6, ?6)",
            rusqlite::params![
                program_id.trim(),
                title,
                program_year.trim(),
                scope.trim(),
                notes.trim(),
                now.as_str(),
            ],
        )
        .map_err(|e| format!("sqlite insert organization program failed: {e}"))?;

    Ok(())
}

#[tauri::command]
fn db_update_organization_program(
    program_id: String,
    payload: OrganizationProgramUpdateInput,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let program_id = program_id.trim();
    if program_id.is_empty() {
        return Err("program_id is required".to_string());
    }
    if let Some(ref title) = payload.title {
        if title.trim().is_empty() {
            return Err("title is required".to_string());
        }
    }
    if let Some(ref link) = payload.prevention_link {
        if !link.trim().is_empty() {
            validate_enum_value(link, PREVENTION_LINK_VALUES, "prevention_link")?;
        }
    }

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;
    let now = now_epoch_string();

    let updated = db
        .connection()
        .execute(
            "UPDATE organization_programs SET
                title = COALESCE(?1, title),
                program_year = COALESCE(?2, program_year),
                scope = COALESCE(?3, scope),
                notes = COALESCE(?4, notes),
                plan_text = COALESCE(?5, plan_text),
                report_text = COALESCE(?6, report_text),
                artifacts_json = COALESCE(?7, artifacts_json),
                audience_json = COALESCE(?8, audience_json),
                prevention_link = COALESCE(?9, prevention_link),
                prevention_work_types_json = COALESCE(?10, prevention_work_types_json),
                updated_at = ?11
             WHERE program_id = ?12",
            rusqlite::params![
                payload.title.as_deref().map(str::trim),
                payload.program_year.as_deref().map(str::trim),
                payload.scope.as_deref(),
                payload.notes.as_deref(),
                payload.plan_text.as_deref(),
                payload.report_text.as_deref(),
                payload.artifacts_json.as_deref(),
                payload.audience_json.as_deref(),
                payload.prevention_link.as_deref().map(str::trim),
                payload.prevention_work_types_json.as_deref(),
                now.as_str(),
                program_id,
            ],
        )
        .map_err(|e| format!("sqlite update organization program failed: {e}"))?;
    if updated == 0 {
        return Err("organization program not found".to_string());
    }
    Ok(())
}

#[derive(Debug, Serialize)]
struct CaseAiContext {
    notes_sanitized: String,
    y_level: String,
    x_stage: String,
    topic_tags: String,
}

/// Sanitized case summary for journal AI (no PII aliases).
#[tauri::command]
fn db_get_case_ai_context(case_id: String, state: State<'_, DbState>) -> Result<Option<CaseAiContext>, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let mut stmt = db
        .connection()
        .prepare(
            "SELECT notes_sanitized, y_level, x_stage, topic_tags
             FROM cases
             WHERE case_id = ?1
             LIMIT 1",
        )
        .map_err(|e| format!("sqlite prepare case ai context failed: {e}"))?;

    let mut rows = stmt
        .query_map([case_id.as_str()], |row| {
            Ok(CaseAiContext {
                notes_sanitized: row.get(0)?,
                y_level: row.get(1)?,
                x_stage: row.get(2)?,
                topic_tags: row.get(3)?,
            })
        })
        .map_err(|e| format!("sqlite query case ai context failed: {e}"))?;

    Ok(rows.next().transpose().map_err(|e| format!("sqlite read case ai context failed: {e}"))?)
}

#[derive(Debug, Serialize)]
struct CaseSummaryRow {
    case_id: String,
    situation_title: String,
    situation_kind: String,
    participant_count: i64,
    y_level: String,
    x_stage: String,
    created_at: String,
    updated_at: String,
}

fn artifacts_meta_from_json(raw: &str) -> (String, String) {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "{}" {
        return (String::new(), String::new());
    }
    let Ok(v) = serde_json::from_str::<serde_json::Value>(trimmed) else {
        return (String::new(), String::new());
    };
    let title = v
        .get("situation_title")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let kind = v
        .get("situation_kind")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    (title, kind)
}

/// List local cases for workspace picker (titles from case_artifacts_json).
#[tauri::command]
fn db_list_case_summaries(state: State<'_, DbState>) -> Result<Vec<CaseSummaryRow>, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let mut stmt = db
        .connection()
        .prepare(
            "SELECT c.case_id, c.case_artifacts_json, c.y_level, c.x_stage, c.created_at, c.updated_at,
                    (SELECT COUNT(*) FROM pd_aliases pa WHERE pa.case_id = c.case_id) AS participant_count
             FROM cases c
             ORDER BY c.updated_at DESC, c.created_at DESC",
        )
        .map_err(|e| format!("sqlite prepare list cases failed: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            let artifacts_json: String = row.get(1)?;
            let (situation_title, situation_kind) = artifacts_meta_from_json(&artifacts_json);
            let case_id: String = row.get(0)?;
            let short_id = if case_id.len() > 8 {
                &case_id[..8]
            } else {
                case_id.as_str()
            };
            let display_title = if situation_title.is_empty() {
                format!("Дело {short_id}")
            } else {
                situation_title
            };
            Ok(CaseSummaryRow {
                case_id,
                situation_title: display_title,
                situation_kind,
                participant_count: row.get(6)?,
                y_level: row.get(2)?,
                x_stage: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("sqlite query list cases failed: {e}"))?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| format!("sqlite read list cases failed: {e}"))?);
    }
    Ok(out)
}

#[derive(Debug, Serialize)]
struct CaseParticipantRow {
    alias_id: String,
    role: String,
    role_no: i64,
}

#[tauri::command]
fn db_list_case_participants(case_id: String, state: State<'_, DbState>) -> Result<Vec<CaseParticipantRow>, String> {
    let case_id = case_id.trim();
    if case_id.is_empty() {
        return Err("case_id is required".to_string());
    }
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let mut stmt = db
        .connection()
        .prepare(
            "SELECT alias_id, role, role_no FROM pd_aliases WHERE case_id = ?1 ORDER BY role, role_no",
        )
        .map_err(|e| format!("sqlite prepare list participants failed: {e}"))?;

    let rows = stmt
        .query_map([case_id], |row| {
            Ok(CaseParticipantRow {
                alias_id: row.get(0)?,
                role: row.get(1)?,
                role_no: row.get(2)?,
            })
        })
        .map_err(|e| format!("sqlite query list participants failed: {e}"))?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| format!("sqlite read list participants failed: {e}"))?);
    }
    Ok(out)
}

/// Local-only: includes `real_name` for on-device matching / re-sanitize.
/// Must never be forwarded to cloud AI prompts — UI maps names to markers first.
#[derive(Debug, Serialize)]
struct CaseAliasLocalRow {
    alias_id: String,
    role: String,
    role_no: i64,
    real_name: String,
}

#[tauri::command]
fn db_list_case_aliases_local(case_id: String, state: State<'_, DbState>) -> Result<Vec<CaseAliasLocalRow>, String> {
    let case_id = case_id.trim();
    if case_id.is_empty() {
        return Err("case_id is required".to_string());
    }
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let mut stmt = db
        .connection()
        .prepare(
            "SELECT alias_id, role, role_no, real_name FROM pd_aliases WHERE case_id = ?1 ORDER BY role, role_no",
        )
        .map_err(|e| format!("sqlite prepare list aliases local failed: {e}"))?;

    let rows = stmt
        .query_map([case_id], |row| {
            Ok(CaseAliasLocalRow {
                alias_id: row.get(0)?,
                role: row.get(1)?,
                role_no: row.get(2)?,
                real_name: row.get(3)?,
            })
        })
        .map_err(|e| format!("sqlite query list aliases local failed: {e}"))?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| format!("sqlite read list aliases local failed: {e}"))?);
    }
    Ok(out)
}

/// Case-level artifacts (expertise, future digital twin) — not tied to a visit.
#[tauri::command]
fn db_get_case_artifacts(case_id: String, state: State<'_, DbState>) -> Result<String, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let json: String = db
        .connection()
        .query_row(
            "SELECT case_artifacts_json FROM cases WHERE case_id = ?1 LIMIT 1",
            [case_id.as_str()],
            |row| row.get(0),
        )
        .map_err(|e| format!("sqlite read case artifacts failed: {e}"))?;
    Ok(json)
}

#[derive(Debug, Deserialize)]
struct CaseArtifactsUpdateInput {
    case_artifacts_json: String,
}

#[tauri::command]
fn db_update_case_artifacts(
    case_id: String,
    payload: CaseArtifactsUpdateInput,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let case_id = case_id.trim();
    if case_id.is_empty() {
        return Err("case_id is required".to_string());
    }
    let json = payload.case_artifacts_json.trim();
    if json.is_empty() {
        return Err("case_artifacts_json is required".to_string());
    }

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;
    let now = now_epoch_string();

    let updated = db
        .connection()
        .execute(
            "UPDATE cases SET case_artifacts_json = ?1, updated_at = ?2 WHERE case_id = ?3",
            rusqlite::params![json, now.as_str(), case_id],
        )
        .map_err(|e| format!("sqlite update case artifacts failed: {e}"))?;
    if updated == 0 {
        return Err("case not found".to_string());
    }
    Ok(())
}

#[tauri::command]
fn db_delete_case(case_id: String, state: State<'_, DbState>) -> Result<(), String> {
    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;

    let conn = db.connection_mut();
    let tx = conn
        .transaction()
        .map_err(|e| format!("sqlite tx begin failed: {e}"))?;

    // Delete from cases (cascades session_records, pd_aliases, iprs, referrals, work_log_entries, etc.)
    tx.execute("DELETE FROM cases WHERE case_id = ?1", [case_id.as_str()])
        .map_err(|e| format!("sqlite delete cases failed: {e}"))?;

    // Delete from case_files (cascades case_pii, case_problems, case_subject_categories, etc.)
    tx.execute("DELETE FROM case_files WHERE id = ?1", [case_id.as_str()])
        .map_err(|e| format!("sqlite delete case_files failed: {e}"))?;

    audit_log_write(
        &*tx,
        "delete",
        "cases",
        &case_id,
        &serde_json::json!({}),
    )?;

    tx.commit()
        .map_err(|e| format!("sqlite tx commit failed: {e}"))?;

    Ok(())
}

/// Phase 3.8 — список записей журнала по кейсу.
#[tauri::command]
fn db_list_work_log_entries(
    case_id: String,
    state: State<'_, DbState>,
) -> Result<Vec<WorkLogEntry>, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let mut stmt = db
        .connection()
        .prepare(
            "SELECT entry_id, case_id, action_kind, minutes, note, created_at
             FROM work_log_entries
             WHERE case_id = ?1
             ORDER BY created_at DESC, entry_id DESC",
        )
        .map_err(|e| format!("sqlite prepare work log list failed: {e}"))?;

    let rows = stmt
        .query_map([case_id.as_str()], |row| {
            Ok(WorkLogEntry {
                entry_id: row.get(0)?,
                case_id: row.get(1)?,
                action_kind: row.get(2)?,
                minutes: row.get(3)?,
                note: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("sqlite query work log list failed: {e}"))?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| format!("sqlite read work log row failed: {e}"))?);
    }
    Ok(out)
}

#[tauri::command]
fn db_list_calendar_slots(
    case_id: Option<String>,
    start_epoch: Option<i64>,
    end_epoch: Option<i64>,
    state: State<'_, DbState>,
) -> Result<Vec<CalendarSlot>, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    let mut query = "SELECT slot_id, case_id, specialist_id, start_time, end_time, buffer_minutes, recurrence_weeks, visit_status, client_name, notes FROM calendar_slots WHERE 1=1".to_string();
    let mut params = Vec::new();

    if let Some(ref cid) = case_id {
        query.push_str(" AND case_id = ?");
        params.push(cid.clone());
    }

    let mut stmt = db
        .connection()
        .prepare(&query)
        .map_err(|e| format!("sqlite prepare calendar slots list failed: {e}"))?;

    let rows = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), |row| {
            Ok(CalendarSlot {
                slot_id: row.get(0)?,
                case_id: row.get(1)?,
                specialist_id: row.get(2)?,
                start_time: row.get(3)?,
                end_time: row.get(4)?,
                buffer_minutes: row.get(5)?,
                recurrence_weeks: row.get(6)?,
                visit_status: row.get(7)?,
                client_name: row.get(8)?,
                notes: row.get(9)?,
            })
        })
        .map_err(|e| format!("sqlite query calendar slots list failed: {e}"))?;

    let mut out = Vec::new();
    let start = start_epoch.unwrap_or(0);
    let end = end_epoch.unwrap_or(i64::MAX);

    for row in rows {
        let s = row.map_err(|e| format!("sqlite read calendar slot row failed: {e}"))?;
        if s.start_time >= start && s.start_time <= end {
            out.push(s);
        }
    }
    Ok(out)
}

#[tauri::command]
fn db_save_calendar_slot(
    slot: CalendarSlot,
    state: State<'_, DbState>,
) -> Result<CalendarSlot, String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    db.connection()
        .execute(
            "INSERT OR REPLACE INTO calendar_slots (
                slot_id, case_id, specialist_id, start_time, end_time,
                buffer_minutes, recurrence_weeks, visit_status, client_name, notes
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                slot.slot_id,
                slot.case_id,
                slot.specialist_id,
                slot.start_time,
                slot.end_time,
                slot.buffer_minutes,
                slot.recurrence_weeks,
                slot.visit_status,
                slot.client_name,
                slot.notes,
            ],
        )
        .map_err(|e| format!("sqlite save calendar slot failed: {e}"))?;

    Ok(slot)
}

#[tauri::command]
fn db_delete_calendar_slot(
    slot_id: String,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;

    db.connection()
        .execute(
            "DELETE FROM calendar_slots WHERE slot_id = ?1",
            [slot_id],
        )
        .map_err(|e| format!("sqlite delete calendar slot failed: {e}"))?;

    Ok(())
}


// ============================================================================
// Phase 3.9 — сохранение сгенерированного DOCX на диск
// ============================================================================
//
// Контракт безопасности:
//   * Команда работает только с полным абсолютным путём, который пришёл
//     из tauri-plugin-dialog `save()` (то есть явно подтверждён пользователем).
//   * Команда не пытается ничего «угадать» (домашняя папка и т.д.) и не
//     создаёт промежуточных директорий — все целевые пути уже существуют,
//     потому что их вернул нативный системный save-диалог.
//   * Содержимое приходит как base64-строка: это самый компактный способ
//     передать бинарь через стандартный JSON-IPC Tauri 2, не вводя
//     зависимости от raw-byte invoke API, которое ещё стабилизируется.

/// Сохранить DOCX-бинарь на диск.
///
/// Аргументы:
///   * `targetPath` (JS) → `target_path` (Rust): абсолютный путь к будущему
///     файлу, полученный из save-диалога. Если файл уже существует — он
///     перезаписывается (это намеренное поведение save-диалога).
///   * `base64Data` (JS) → `base64_data` (Rust): тело DOCX, упакованное
///     библиотекой `docx` на фронте и закодированное в base64.
///
/// Безопасность:
///   * Никаких сетевых вызовов. Никаких персональных данных в этом пути не появляется —
///     mock-ИПР генерируется из санитизированных кейса.
///   * Имя файла полностью контролирует пользователь через save-диалог.
#[tauri::command]
fn save_docx(target_path: String, base64_data: String) -> Result<(), String> {
    use base64::engine::general_purpose::STANDARD;
    use base64::Engine as _;

    if target_path.trim().is_empty() {
        return Err("target_path is empty".to_string());
    }

    let bytes = STANDARD
        .decode(base64_data.as_bytes())
        .map_err(|e| format!("invalid base64 payload: {e}"))?;

    if bytes.is_empty() {
        return Err("payload is empty".to_string());
    }

    // Минимальная проверка валидности DOCX: ZIP-сигнатура `PK\x03\x04`.
    // Это не криптографическая проверка, а защита от «случайно положили
    // не тот буфер» (например, текст или картинку).
    if bytes.len() < 4 || &bytes[..4] != b"PK\x03\x04" {
        return Err("payload is not a valid DOCX (ZIP signature missing)".to_string());
    }

    std::fs::write(&target_path, &bytes)
        .map_err(|e| format!("cannot write {target_path}: {e}"))?;
    Ok(())
}

const EMPTY_PASSPORT_JSON: &str = r#"{"x_stage":"X1_Intake","y_level":"Y1_Normal","m_modality":[],"executor_role":"psychologist","org_scale":"Individual","topic_tags":[]}"#;

fn collect_registry_subjects(db: &EncryptedDb) -> Result<Vec<registry_vault::RegistryVaultSubject>, String> {
    let conn = db.connection();
    let mut stmt = conn
        .prepare(
            "SELECT case_id, case_artifacts_json, created_at, updated_at FROM cases ORDER BY updated_at DESC",
        )
        .map_err(|e| format!("sqlite prepare registry export failed: {e}"))?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(|e| format!("sqlite registry export query failed: {e}"))?;

    let mut out = Vec::new();
    for row in rows {
        let (case_id, artifacts_json, created_at, updated_at) =
            row.map_err(|e| format!("sqlite registry export row failed: {e}"))?;
        let parsed: serde_json::Value = serde_json::from_str(&artifacts_json).unwrap_or(serde_json::json!({}));
        if parsed.get("record_kind").and_then(|v| v.as_str()) != Some("registry_subject") {
            continue;
        }
        let profile = parsed
            .get("registry_profile")
            .cloned()
            .unwrap_or_else(|| serde_json::json!({}));
        out.push(registry_vault::RegistryVaultSubject {
            case_id,
            created_at,
            updated_at,
            profile,
        });
    }
    Ok(out)
}

fn vault_err(e: registry_vault::VaultError) -> String {
    e.to_string()
}

#[tauri::command]
fn registry_generate_recovery_key() -> Result<String, String> {
    Ok(registry_vault::generate_recovery_key_display())
}

#[tauri::command]
fn registry_recovery_key_hash(recovery_key: String) -> Result<String, String> {
    let norm = registry_vault::normalize_recovery_key(&recovery_key);
    if norm.len() != 64 {
        return Err("invalid_recovery_key".to_string());
    }
    Ok(registry_vault::hash_recovery_key_hex(&norm))
}

#[tauri::command]
fn registry_export_backup(recovery_key: String, state: State<'_, DbState>) -> Result<String, String> {
    use base64::engine::general_purpose::STANDARD;
    use base64::Engine as _;

    let guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_ref()
        .ok_or_else(|| "DB is locked".to_string())?;
    let subjects = collect_registry_subjects(db)?;
    let exported_at = now_epoch_string();
    let plain = registry_vault::build_vault_payload(subjects, &exported_at).map_err(vault_err)?;
    let enc = registry_vault::encrypt_vault_bytes(&plain, &recovery_key).map_err(vault_err)?;
    Ok(STANDARD.encode(enc))
}

#[tauri::command]
fn registry_verify_backup(base64_data: String, recovery_key: String) -> Result<registry_vault::RegistryVaultVerifyResult, String> {
    use base64::engine::general_purpose::STANDARD;
    use base64::Engine as _;

    let bytes = STANDARD
        .decode(base64_data.as_bytes())
        .map_err(|e| format!("invalid base64 payload: {e}"))?;
    registry_vault::verify_vault_file(&bytes, &recovery_key).map_err(vault_err)
}

#[tauri::command]
fn registry_restore_backup(
    base64_data: String,
    recovery_key: String,
    state: State<'_, DbState>,
) -> Result<registry_vault::RegistryVaultRestoreResult, String> {
    use base64::engine::general_purpose::STANDARD;
    use base64::Engine as _;

    let bytes = STANDARD
        .decode(base64_data.as_bytes())
        .map_err(|e| format!("invalid base64 payload: {e}"))?;
    let plain = registry_vault::decrypt_vault_bytes(&bytes, &recovery_key).map_err(vault_err)?;
    let payload = registry_vault::parse_vault_payload(&plain).map_err(vault_err)?;

    let mut guard = state
        .0
        .lock()
        .map_err(|_| "db state mutex poisoned".to_string())?;
    let db = guard
        .as_mut()
        .ok_or_else(|| "DB is locked".to_string())?;
    let conn = db.connection_mut();

    let mut imported = 0usize;
    let mut skipped = 0usize;

    for subject in payload.subjects {
        let case_id = subject.case_id.trim();
        if case_id.is_empty() {
            skipped += 1;
            continue;
        }
        let exists: i64 = conn
            .query_row(
                "SELECT count(*) FROM cases WHERE case_id = ?1",
                [case_id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        if exists > 0 {
            skipped += 1;
            continue;
        }

        let full_name = subject
            .profile
            .get("full_name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        if full_name.is_empty() {
            skipped += 1;
            continue;
        }

        let artifacts = serde_json::json!({
            "record_kind": "registry_subject",
            "registry_profile": subject.profile,
            "situation_title": full_name,
        });
        let artifacts_str = serde_json::to_string(&artifacts)
            .map_err(|e| format!("artifacts serialize failed: {e}"))?;
        let created = if subject.created_at.trim().is_empty() {
            now_epoch_string()
        } else {
            subject.created_at.clone()
        };
        let updated = if subject.updated_at.trim().is_empty() {
            created.clone()
        } else {
            subject.updated_at.clone()
        };

        let fields: PassportFields = serde_json::from_str(EMPTY_PASSPORT_JSON)
            .map_err(|e| format!("default passport invalid: {e}"))?;
        let m_modality_str = serde_json::to_string(&fields.m_modality)
            .map_err(|e| format!("m_modality serialize: {e}"))?;
        let topic_tags_str = serde_json::to_string(&fields.topic_tags)
            .map_err(|e| format!("topic_tags serialize: {e}"))?;

        let tx = conn
            .transaction()
            .map_err(|e| format!("sqlite tx begin failed: {e}"))?;
        tx.execute(
            "INSERT INTO cases (
                case_id, shadow_id, x_stage, y_level, m_modality,
                executor_role, org_scale, topic_tags, passport_json,
                notes_sanitized, created_at, updated_at, case_artifacts_json
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            rusqlite::params![
                case_id,
                case_id,
                fields.x_stage.as_str(),
                fields.y_level.as_str(),
                m_modality_str.as_str(),
                fields.executor_role.as_str(),
                fields.org_scale.as_str(),
                topic_tags_str.as_str(),
                EMPTY_PASSPORT_JSON,
                "",
                created.as_str(),
                updated.as_str(),
                artifacts_str.as_str(),
            ],
        )
        .map_err(|e| format!("sqlite restore registry case failed: {e}"))?;
        tx.commit()
            .map_err(|e| format!("sqlite tx commit failed: {e}"))?;
        imported += 1;
    }

    Ok(registry_vault::RegistryVaultRestoreResult { imported, skipped })
}

#[tauri::command]
fn save_vault_backup(target_path: String, base64_data: String) -> Result<(), String> {
    use base64::engine::general_purpose::STANDARD;
    use base64::Engine as _;

    if target_path.trim().is_empty() {
        return Err("target_path is empty".to_string());
    }
    let bytes = STANDARD
        .decode(base64_data.as_bytes())
        .map_err(|e| format!("invalid base64 payload: {e}"))?;
    if bytes.len() < 8 || &bytes[..4] != registry_vault::VAULT_MAGIC {
        return Err("payload is not a valid registry vault backup".to_string());
    }
    std::fs::write(&target_path, &bytes)
        .map_err(|e| format!("cannot write {target_path}: {e}"))?;
    Ok(())
}

#[tauri::command]
fn read_vault_backup_file(source_path: String) -> Result<String, String> {
    use base64::engine::general_purpose::STANDARD;
    use base64::Engine as _;

    if source_path.trim().is_empty() {
        return Err("source_path is empty".to_string());
    }
    let bytes = std::fs::read(&source_path)
        .map_err(|e| format!("cannot read {source_path}: {e}"))?;
    Ok(STANDARD.encode(bytes))
}

// ============================================================================
// Tauri runtime bootstrap
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .manage(DbState::empty())
        .manage(InboxServerState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            app_version,
            app_meta,
            installation_get_meta,
            installation_save_meta,
            terminal_get_config,
            terminal_save_config,
            db_list_profiles,
            db_create_profile,
            db_delete_profile,
            db_is_initialized,
            db_profile_is_initialized,
            db_unlock,
            db_unlock_profile,
            db_lock,
            db_get_org_profile,
            db_get_specialist_profile,
            db_save_org_profile,
            db_save_specialist_profile,
            db_insert_case,
            db_add_session_record,
            db_list_session_records,
            db_add_work_log_entry,
            db_update_work_log_entry,
            db_list_calendar_slots,
            db_save_calendar_slot,
            db_delete_calendar_slot,
            db_list_work_log_entries,
            db_list_group_sessions,
            db_add_group_session,
            db_update_group_session,
            db_list_work_entries,
            db_add_work_entry,
            db_update_work_entry,
            db_delete_work_entry,
            db_list_organization_programs,
            db_add_organization_program,
            db_update_organization_program,
            db_get_case_ai_context,
            db_list_case_summaries,
            db_list_case_participants,
            db_list_case_aliases_local,
            db_get_case_artifacts,
            db_update_case_artifacts,
            db_delete_case,
            db_create_ipr,
            db_list_iprs,
            db_update_ipr,
            db_add_ipr_step,
            db_update_ipr_step,
            db_list_ipr_steps,
            db_delete_ipr_step,
            db_create_year_plan_task,
            db_list_year_plan_tasks,
            db_update_year_plan_task,
            db_delete_year_plan_task,
            db_create_request,
            db_list_requests,
            db_update_request_status,
            db_convert_request_to_case,
            db_research_monthly_metrics,
            db_dashboard_l1,
            db_manager_dashboard_l1,
            db_create_referral,
            db_list_referrals,
            db_update_referral_status,
            db_list_audit_log,
            inbox_server_status,
            inbox_list_leads,
            inbox_update_lead_status,
            site_portal_get,
            site_portal_ensure,
            site_portal_update,
            save_docx,
            registry_generate_recovery_key,
            registry_recovery_key_hash,
            registry_export_backup,
            registry_verify_backup,
            registry_restore_backup,
            save_vault_backup,
            read_vault_backup_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
