//! Local HTTP API for IDA embed leads (`POST /api/inbox`) and inbox viewer page.

use std::io::Read;
use std::sync::{Arc, Mutex};

use base64::Engine;
use serde::Deserialize;
use serde_json::{json, Value};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

use crate::db::EncryptedDb;

pub const DEFAULT_INBOX_PORT: u16 = 47831;

const INBOX_VIEWER_HTML: &str = include_str!("../../../embed_widget/inbox-viewer.html");

#[derive(Debug, Deserialize)]
struct InboxBody {
    name: Option<String>,
    contact: Option<String>,
    center_id: Option<String>,
    #[serde(default)]
    matched_specialist_id: Option<String>,
    #[serde(default)]
    intake_summary: Option<Value>,
    #[serde(default)]
    history: Option<String>,
    #[serde(default)]
    source: Option<String>,
    #[serde(default, alias = "userId")]
    user_id: Option<String>,
}

fn cors_headers() -> Vec<Header> {
    vec![
        Header::from_bytes(b"Access-Control-Allow-Origin", b"*").unwrap(),
        Header::from_bytes(b"Access-Control-Allow-Methods", b"POST, OPTIONS, GET").unwrap(),
        Header::from_bytes(
            b"Access-Control-Allow-Headers",
            b"Content-Type, Accept, Authorization",
        )
        .unwrap(),
    ]
}

fn json_response(status: u16, body: Value) -> Response<std::io::Cursor<Vec<u8>>> {
    let mut headers = cors_headers();
    headers.push(Header::from_bytes(b"Content-Type", b"application/json").unwrap());
    let mut res = Response::from_string(body.to_string())
        .with_status_code(StatusCode(status));
    for h in headers {
        res = res.with_header(h);
    }
    res
}

fn read_body(request: &mut Request) -> Result<String, String> {
    let mut buf = String::new();
    request
        .as_reader()
        .read_to_string(&mut buf)
        .map_err(|e| format!("read body: {e}"))?;
    Ok(buf)
}

fn validate_inbox(body: &InboxBody) -> Result<(String, String, String, Option<String>, String, Option<String>, Option<String>), &'static str> {
    let name = body.name.as_deref().unwrap_or("").trim();
    let contact = body.contact.as_deref().unwrap_or("").trim();
    let center_id = body.center_id.as_deref().unwrap_or("").trim();
    if name.is_empty() {
        return Err("name_required");
    }
    if contact.is_empty() {
        return Err("contact_required");
    }
    if center_id.is_empty() {
        return Err("center_id_required");
    }
    if name.len() > 120 {
        return Err("name_too_long");
    }
    if contact.len() > 240 {
        return Err("contact_too_long");
    }
    if !center_id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        || center_id.len() > 64
    {
        return Err("invalid_center_id");
    }

    let mut intake = body.intake_summary.clone().unwrap_or(json!({}));
    if intake.is_null() {
        intake = json!({});
    }
    if let Some(h) = body.history.as_deref() {
        if !h.trim().is_empty() {
            if let Some(obj) = intake.as_object_mut() {
                obj.insert("history".to_string(), json!(h.trim()));
            } else {
                intake = json!({ "history": h.trim() });
            }
        }
    }
    let intake_json = intake.to_string();
    let specialist = body
        .matched_specialist_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    let source = body
        .source
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    let user_id = body
        .user_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);

    Ok((
        name.to_string(),
        contact.to_string(),
        center_id.to_string(),
        specialist,
        intake_json,
        source,
        user_id,
    ))
}

fn insert_lead(
    db: &EncryptedDb,
    lead_id: &str,
    center_id: &str,
    name: &str,
    contact: &str,
    specialist_id: Option<&str>,
    intake_json: &str,
    source: Option<&str>,
    user_id: Option<&str>,
) -> Result<(), String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
        .to_string();
    db.connection()
        .execute(
            "INSERT INTO leads (
                id, center_id, name, contact, specialist_id,
                intake_json, source, user_id, status, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'new', ?9)",
            rusqlite::params![
                lead_id,
                center_id,
                name,
                contact,
                specialist_id,
                intake_json,
                source,
                user_id,
                now,
            ],
        )
        .map_err(|e| format!("insert lead: {e}"))?;
    Ok(())
}

fn parse_basic_auth(request: &Request) -> Option<(String, String)> {
    let auth = request
        .headers()
        .iter()
        .find(|h| h.field.equiv("Authorization"))?;
    let val = auth.value.as_str();
    let encoded = val.strip_prefix("Basic ")?;
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(encoded.trim())
        .ok()?;
    let pair = String::from_utf8(decoded).ok()?;
    let (user, pass) = pair.split_once(':')?;
    Some((user.to_string(), pass.to_string()))
}

fn site_portal_credentials(db: &EncryptedDb) -> Result<(String, String), String> {
    db.connection()
        .query_row(
            "SELECT inbox_login, inbox_password FROM site_portal WHERE id = 1",
            [],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .map_err(|e| format!("site portal: {e}"))
}

fn list_leads_json(db: &EncryptedDb, center_filter: &str, limit: i64) -> Result<Value, String> {
    let lim = limit.clamp(1, 200);
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

    let rows: Vec<Value> = if center_filter.trim().is_empty() {
        stmt.query_map([lim], map_lead_row)
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect()
    } else {
        stmt.query_map(rusqlite::params![center_filter, lim], map_lead_row)
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect()
    };
    Ok(json!({ "ok": true, "leads": rows }))
}

fn map_lead_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    Ok(json!({
        "id": row.get::<_, String>(0)?,
        "center_id": row.get::<_, String>(1)?,
        "name": row.get::<_, String>(2)?,
        "contact": row.get::<_, String>(3)?,
        "specialist_id": row.get::<_, Option<String>>(4)?,
        "intake_json": row.get::<_, String>(5)?,
        "source": row.get::<_, Option<String>>(6)?,
        "user_id": row.get::<_, Option<String>>(7)?,
        "status": row.get::<_, String>(8)?,
        "created_at": row.get::<_, String>(9)?,
    }))
}

fn html_response(body: &str) -> Response<std::io::Cursor<Vec<u8>>> {
    let mut headers = cors_headers();
    headers.push(Header::from_bytes(b"Content-Type", b"text/html; charset=utf-8").unwrap());
    let mut res = Response::from_string(body.to_string())
        .with_status_code(StatusCode(200));
    for h in headers {
        res = res.with_header(h);
    }
    res
}

fn handle_request(request: Request, db_state: &Arc<Mutex<Option<EncryptedDb>>>) {
    let method = request.method().clone();
    let url = request.url().to_string();

    if method == Method::Options {
        let mut res = Response::empty(StatusCode(204));
        for h in cors_headers() {
            res = res.with_header(h);
        }
        let _ = request.respond(res);
        return;
    }

    if method == Method::Get && (url == "/api/inbox/health" || url.starts_with("/api/inbox/health?")) {
        let locked = db_state.lock().map(|g| g.is_none()).unwrap_or(true);
        let body = json!({
            "ok": true,
            "service": "prevention-terminal-inbox",
            "db_unlocked": !locked,
        });
        let _ = request.respond(json_response(200, body));
        return;
    }

    if method == Method::Get
        && (url == "/inbox-viewer.html" || url.starts_with("/inbox-viewer.html?"))
    {
        let _ = request.respond(html_response(INBOX_VIEWER_HTML));
        return;
    }

    if method == Method::Get && (url == "/api/inbox/leads" || url.starts_with("/api/inbox/leads?")) {
        let guard = match db_state.lock() {
            Ok(g) => g,
            Err(_) => {
                let _ = request.respond(json_response(503, json!({"ok": false, "error": "db_state_poisoned"})));
                return;
            }
        };
        let Some(db) = guard.as_ref() else {
            let _ = request.respond(json_response(503, json!({"ok": false, "error": "db_locked"})));
            return;
        };
        let creds = match site_portal_credentials(db) {
            Ok(v) => v,
            Err(e) => {
                let _ = request.respond(json_response(500, json!({"ok": false, "error": e})));
                return;
            }
        };
        let (expected_login, expected_password) = creds;
        if expected_login.trim().is_empty() || expected_password.trim().is_empty() {
            let _ = request.respond(json_response(503, json!({"ok": false, "error": "inbox_credentials_not_configured"})));
            return;
        }
        let Some((login, password)) = parse_basic_auth(&request) else {
            let _ = request.respond(json_response(401, json!({"ok": false, "error": "auth_required"})));
            return;
        };
        if login != expected_login || password != expected_password {
            let _ = request.respond(json_response(401, json!({"ok": false, "error": "invalid_credentials"})));
            return;
        }
        let center_filter = if url.contains('?') {
            url.split('?').nth(1).unwrap_or("").split('&').find_map(|pair| {
                let mut parts = pair.splitn(2, '=');
                let key = parts.next()?;
                if key == "center_id" {
                    Some(parts.next().unwrap_or("").to_string())
                } else {
                    None
                }
            }).unwrap_or_default()
        } else {
            String::new()
        };
        match list_leads_json(db, &center_filter, 100) {
            Ok(body) => {
                let _ = request.respond(json_response(200, body));
            }
            Err(e) => {
                let _ = request.respond(json_response(500, json!({"ok": false, "error": e})));
            }
        }
        return;
    }

    if method != Method::Post || !url.starts_with("/api/inbox") {
        let _ = request.respond(json_response(404, json!({"ok": false, "error": "not_found"})));
        return;
    }

    let mut req = request;
    let raw = match read_body(&mut req) {
        Ok(s) => s,
        Err(e) => {
            let _ = req.respond(json_response(400, json!({"ok": false, "error": e})));
            return;
        }
    };

    let parsed: InboxBody = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => {
            let _ = req.respond(json_response(400, json!({"ok": false, "error": "invalid_json"})));
            return;
        }
    };

    let validated = match validate_inbox(&parsed) {
        Ok(v) => v,
        Err(code) => {
            let _ = req.respond(json_response(400, json!({"ok": false, "error": code})));
            return;
        }
    };

    let (name, contact, center_id, specialist, intake_json, source, user_id) = validated;
    let lead_id = uuid_v4();

    let guard = match db_state.lock() {
        Ok(g) => g,
        Err(_) => {
            let _ = req.respond(json_response(503, json!({"ok": false, "error": "db_state_poisoned"})));
            return;
        }
    };
    let Some(db) = guard.as_ref() else {
        let _ = req.respond(json_response(503, json!({"ok": false, "error": "db_locked"})));
        return;
    };

    if let Err(e) = insert_lead(
        db,
        &lead_id,
        &center_id,
        &name,
        &contact,
        specialist.as_deref(),
        &intake_json,
        source.as_deref(),
        user_id.as_deref(),
    ) {
        let _ = req.respond(json_response(500, json!({"ok": false, "error": e})));
        return;
    }

    let _ = req.respond(json_response(
        200,
        json!({"ok": true, "lead_id": lead_id}),
    ));
}

fn uuid_v4() -> String {
    let mut bytes = [0u8; 16];
    rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0],
        bytes[1],
        bytes[2],
        bytes[3],
        bytes[4],
        bytes[5],
        bytes[6],
        bytes[7],
        bytes[8],
        bytes[9],
        bytes[10],
        bytes[11],
        bytes[12],
        bytes[13],
        bytes[14],
        bytes[15],
    )
}

pub fn start_inbox_server(
    db_state: Arc<Mutex<Option<EncryptedDb>>>,
    port: u16,
) -> Result<std::thread::JoinHandle<()>, String> {
    let addr = format!("0.0.0.0:{port}");
    let server = Server::http(&addr).map_err(|e| format!("inbox server bind {addr}: {e}"))?;
    Ok(std::thread::spawn(move || {
        for request in server.incoming_requests() {
            handle_request(request, &db_state);
        }
    }))
}

pub fn inbox_public_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}/api/inbox")
}

pub fn inbox_viewer_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}/inbox-viewer.html")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_inbox_requires_center() {
        let body = InboxBody {
            name: Some("Ann".into()),
            contact: Some("+7".into()),
            center_id: None,
            matched_specialist_id: None,
            intake_summary: None,
            history: None,
            source: None,
            user_id: None,
        };
        assert_eq!(validate_inbox(&body).unwrap_err(), "center_id_required");
    }
}
