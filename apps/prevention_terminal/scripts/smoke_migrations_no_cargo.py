"""SQL-only smoke test for `MIGRATIONS_SQL` in `db.rs`.

Purpose
-------
On Windows hosts without the MSVC toolchain we can't run ``cargo test``,
but we can still verify the migration logic. SQLCipher is *not* required
for that — the schema and data migration are plain SQLite. This script:

1. Reads ``apps/prevention_terminal/src-tauri/src/db.rs``.
2. Extracts every raw-string entry of ``MIGRATIONS_SQL`` in order.
3. Applies them to a fresh in-memory SQLite database.
4. Seeds representative rows into ``cases``, ``work_log_entries`` and
   ``session_records`` (before the 0007 migration is applied — this
   mirrors the real upgrade path where an old terminal contains those
   rows and the new build runs 0007 on first launch).
5. Re-runs migrations idempotently to confirm 0007+ schema/data migrations
   don't blow up on a second pass and produce exactly the rows we expect in
   ``case_touches`` and the Phase A case/config tables.

Run:

    python apps/prevention_terminal/scripts/smoke_migrations_no_cargo.py

Exit code is non-zero on any assertion failure. Output is human-readable
and intended for manual review.

This is a developer convenience script. The Rust tests in ``db.rs``
remain the source of truth; this one only complements them when the
Rust build environment is unavailable.
"""

from __future__ import annotations

import re
import sqlite3
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

THIS_FILE = Path(__file__).resolve()
REPO_ROOT = THIS_FILE.parents[3]
DB_RS = REPO_ROOT / "apps" / "prevention_terminal" / "src-tauri" / "src" / "db.rs"


def extract_migrations(db_rs_text: str) -> list[str]:
    """Pull every ``r#" ... "#`` block from the MIGRATIONS_SQL constant.

    The Rust constant uses ``r#" ... "#`` raw strings, with one entry per
    migration. We do not try to be a full Rust parser — we just find the
    constant body and take the raw strings inside.
    """
    array_match = re.search(
        r"MIGRATIONS_SQL[^=]*=\s*&\[(.+?)^\];",
        db_rs_text,
        re.MULTILINE | re.DOTALL,
    )
    if array_match is None:
        raise RuntimeError("Couldn't find MIGRATIONS_SQL definition in db.rs")
    body = array_match.group(1)
    raw_strings = re.findall(r'r#"(.+?)"#', body, re.DOTALL)
    if not raw_strings:
        raise RuntimeError("MIGRATIONS_SQL has no raw-string entries")
    return raw_strings


def run_migrations(conn: sqlite3.Connection, migrations: Sequence[str]) -> None:
    """Mirror the Rust ``run_migrations`` invariant on the python side."""
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version    INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );
        """
    )
    for idx, sql in enumerate(migrations, start=1):
        already = conn.execute(
            "SELECT count(*) FROM schema_migrations WHERE version = ?",
            (idx,),
        ).fetchone()[0]
        if already:
            continue
        conn.executescript(sql)
        conn.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (?, '0')",
            (idx,),
        )
    conn.commit()


@dataclass
class Expectation:
    label: str
    activity_kind: str
    minutes_planned: int
    minutes_actual: int
    beneficiaries_count: int
    case_id: str


def seed_legacy_data(conn: sqlite3.Connection) -> list[Expectation]:
    """Insert one row of every legacy variant before 0007 runs."""
    # cases must exist first because work_log/session_records FK them.
    conn.executemany(
        """
        INSERT INTO cases (
            case_id, shadow_id, x_stage, y_level, m_modality,
            executor_role, org_scale, topic_tags, passport_json,
            notes_sanitized, created_at, updated_at
        ) VALUES (?, ?, 'X2_Diag', 'Y1_Normal', '[]',
                  'Психолог', 'Individual', '[]', '{}', '', '0', '0')
        """,
        [(f"case-{n}", f"case-{n}") for n in range(1, 8)],
    )

    # `created_at` controls the resulting `occurred_on` / `week_bucket` —
    # use ISO 'YYYY-MM-DD HH:MM:SS' so strftime parses it.
    work_log_rows = [
        ("e-1", "case-1", "consultation", 60, "indiv #1"),
        ("e-2", "case-2", "call",         30, "phone"),
        ("e-3", "case-3", "observation",  20, "class watch"),
        ("e-4", "case-4", "document",     15, "wrote letter"),
        ("e-5", "case-5", "other",        12, "misc"),
    ]
    conn.executemany(
        """
        INSERT INTO work_log_entries (
            entry_id, case_id, action_kind, minutes, note, created_at
        ) VALUES (?, ?, ?, ?, ?, '2026-05-12 10:00:00')
        """,
        work_log_rows,
    )

    # session_records: one intake (session_no=0, MUST NOT migrate) and
    # two later sessions on case-6 / case-7 (each MUST migrate as 45 min).
    session_rows = [
        ("s-intake", "case-6", 0, '{"k":"intake"}', "2026-05-10 10:00:00"),
        ("s-1",      "case-6", 1, '{"k":"session"}', "2026-05-12 10:00:00"),
        ("s-2",      "case-7", 1, '{"k":"session"}', "2026-05-15 10:00:00"),
    ]
    conn.executemany(
        """
        INSERT INTO session_records (
            record_id, case_id, session_no, content_json, recorded_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        [(r[0], r[1], r[2], r[3], r[4], r[4]) for r in session_rows],
    )

    expectations = [
        Expectation("work_log consultation", "individual_session", 60, 60, 1, "case-1"),
        Expectation("work_log call",         "individual_session", 30, 30, 1, "case-2"),
        Expectation("work_log observation",  "assessment", 20, 20, 1, "case-3"),
        Expectation("work_log document",     "admin_other", 15, 15, 1, "case-4"),
        Expectation("work_log other",        "admin_other", 12, 12, 1, "case-5"),
        Expectation("session_records #1",    "individual_session", 45, 45, 1, "case-6"),
        Expectation("session_records #2",    "individual_session", 45, 45, 1, "case-7"),
    ]
    return expectations


def collect_case_touches(conn: sqlite3.Connection) -> list[dict]:
    cur = conn.execute(
        """
        SELECT id, occurred_on, week_bucket, activity_kind, status,
               minutes_planned, minutes_actual, beneficiaries_count,
               notes_local, case_id,
               ipr_id, ipr_step_id, task_id, program_id, request_id
        FROM case_touches
        ORDER BY case_id
        """
    )
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def assert_eq(label: str, actual, expected) -> None:
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


def main() -> int:
    if not DB_RS.exists():
        print(f"[smoke] db.rs not found at {DB_RS}", file=sys.stderr)
        return 2

    text = DB_RS.read_text(encoding="utf-8")
    migrations = extract_migrations(text)
    if len(migrations) < 7:
        print(
            f"[smoke] expected ≥ 7 migrations, got {len(migrations)}",
            file=sys.stderr,
        )
        return 2
    print(f"[smoke] migrations found in db.rs: {len(migrations)}")

    conn = sqlite3.connect(":memory:")
    conn.execute("PRAGMA foreign_keys = ON;")

    # Apply migrations 0001..0006 first (mirrors real upgrade path).
    run_migrations(conn, migrations[:6])
    expectations = seed_legacy_data(conn)
    conn.commit()

    # Verify legacy data was actually planted before 0007 fires.
    pre_work_log = conn.execute("SELECT count(*) FROM work_log_entries").fetchone()[0]
    pre_sessions = conn.execute(
        "SELECT count(*) FROM session_records"
    ).fetchone()[0]
    assert_eq("seed work_log_entries count", pre_work_log, 5)
    assert_eq("seed session_records count", pre_sessions, 3)

    # Apply 0007 (and any later migrations if they appear).
    run_migrations(conn, migrations)

    rows = collect_case_touches(conn)
    print(f"[smoke] case_touches rows after 0007+: {len(rows)}")
    for row in rows:
        print(f"  - {row}")

    assert_eq("case_touches row count", len(rows), 7)

    # Sort expectations by case_id like the query does.
    expectations_by_case = {exp.case_id: exp for exp in expectations}
    for row in rows:
        exp = expectations_by_case[row["case_id"]]
        assert_eq(f"{exp.label} :: activity_kind", row["activity_kind"], exp.activity_kind)
        assert_eq(f"{exp.label} :: minutes_planned", row["minutes_planned"], exp.minutes_planned)
        assert_eq(f"{exp.label} :: minutes_actual", row["minutes_actual"], exp.minutes_actual)
        assert_eq(
            f"{exp.label} :: beneficiaries_count",
            row["beneficiaries_count"],
            exp.beneficiaries_count,
        )
        assert_eq(f"{exp.label} :: status", row["status"], "completed")
        for nullable in (
            "ipr_id",
            "ipr_step_id",
            "task_id",
            "program_id",
            "request_id",
        ):
            assert_eq(f"{exp.label} :: {nullable} is NULL", row[nullable], None)
        # week_bucket: ISO 'YYYY-Www' from strftime('%Y-W%W'), which uses
        # week numbers 00..53. Don't assert an exact value — just sanity.
        if not re.match(r"^\d{4}-W\d{2}$", row["week_bucket"]):
            raise AssertionError(
                f"{exp.label} :: week_bucket has wrong shape: {row['week_bucket']!r}"
            )
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", row["occurred_on"]):
            raise AssertionError(
                f"{exp.label} :: occurred_on has wrong shape: {row['occurred_on']!r}"
            )

    # The intake row (session_no = 0) must NOT have migrated.
    intake_in_touches = conn.execute(
        "SELECT count(*) FROM case_touches WHERE case_id = 'case-6' AND minutes_actual = 0"
    ).fetchone()[0]
    if intake_in_touches:
        raise AssertionError("intake row leaked into case_touches")

    # Idempotency: running migrations again must NOT duplicate rows.
    run_migrations(conn, migrations)
    rows_after_rerun = conn.execute(
        "SELECT count(*) FROM case_touches"
    ).fetchone()[0]
    assert_eq("idempotency :: case_touches count unchanged", rows_after_rerun, 7)

    # CHECK constraint: a forbidden activity_kind must be rejected.
    try:
        conn.execute(
            """
            INSERT INTO case_touches (
                id, occurred_on, week_bucket, activity_kind, status,
                minutes_planned, minutes_actual, beneficiaries_count, notes_local, case_id,
                ipr_id, ipr_step_id, task_id, program_id, request_id
            ) VALUES ('check-1', '2026-05-20', '2026-W20', 'mythical_kind',
                      'completed', 30, 30, 1, NULL, 'case-1',
                      NULL, NULL, NULL, NULL, NULL)
            """
        )
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError("CHECK on activity_kind didn't reject 'mythical_kind'")

    # CHECK constraint: a canonical Phase A §5.0 value added after 0007
    # must be accepted by the rebuilt 0008 schema.
    conn.execute(
        """
        INSERT INTO case_touches (
            id, occurred_on, week_bucket, activity_kind, status,
            minutes_planned, minutes_actual, beneficiaries_count, notes_local, case_id,
            ipr_id, ipr_step_id, task_id, program_id, request_id
        ) VALUES ('check-allowed-methodology', '2026-05-20', '2026-W20', 'methodology_work',
                  'planned', 60, 0, 1, NULL, NULL,
                  NULL, NULL, 'year-task-1', NULL, NULL)
        """
    )

    # CHECK constraint: at least one of case_id / program_id / task_id must be set.
    try:
        conn.execute(
            """
            INSERT INTO case_touches (
                id, occurred_on, week_bucket, activity_kind, status,
                minutes_planned, minutes_actual, beneficiaries_count, notes_local, case_id,
                ipr_id, ipr_step_id, task_id, program_id, request_id
            ) VALUES ('check-2', '2026-05-20', '2026-W20', 'individual_session',
                      'completed', 30, 30, 1, NULL, NULL,
                      NULL, NULL, NULL, NULL, NULL)
            """
        )
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError(
            "CHECK on case_id/program_id/task_id didn't reject all-NULL row"
        )

    # Phase A identity/config singleton tables.
    app_config = conn.execute(
        "SELECT schema_version, locale, length(installation_id) FROM app_config WHERE id = 1"
    ).fetchone()
    assert_eq("app_config.schema_version", app_config[0], len(migrations))
    assert_eq("app_config.locale", app_config[1], "ru")
    assert_eq("app_config.installation_id hex length", app_config[2], 32)

    org_profile = conn.execute(
        "SELECT isced_level, org_kind, normative_overrides FROM org_profile WHERE id = 1"
    ).fetchone()
    assert_eq("org_profile.default isced_level", org_profile[0], 2)
    assert_eq("org_profile.default org_kind", org_profile[1], "other")
    assert_eq("org_profile.default normative_overrides", org_profile[2], "{}")

    specialist = conn.execute(
        "SELECT role_text, weekly_contract_minutes FROM specialist_profile WHERE id = 1"
    ).fetchone()
    assert_eq("specialist_profile.default role", specialist[0], "school psychologist")
    assert_eq("specialist_profile.default weekly minutes", specialist[1], 1800)

    # Phase A case lifecycle bridge rows from legacy `cases` / `pd_aliases`.
    assert_eq(
        "case_files migrated count",
        conn.execute("SELECT count(*) FROM case_files").fetchone()[0],
        7,
    )
    assert_eq(
        "case_pii migrated count",
        conn.execute("SELECT count(*) FROM case_pii").fetchone()[0],
        7,
    )
    assert_eq(
        "case_problems migrated count",
        conn.execute("SELECT count(*) FROM case_problems").fetchone()[0],
        7,
    )
    assert_eq(
        "case_subject_categories migrated count",
        conn.execute("SELECT count(*) FROM case_subject_categories").fetchone()[0],
        7,
    )

    # Legacy session_no=0 intake is intentionally not split into 13 sections yet.
    assert_eq(
        "case_intake_sections stays empty until typed split migration",
        conn.execute("SELECT count(*) FROM case_intake_sections").fetchone()[0],
        0,
    )

    # Phase A Sprint 2 (migration 0011): iprs / ipr_steps schema sanity.
    # Both tables are additive and empty after migrations — no data migration
    # from legacy. The smoke test verifies the schema exists, accepts canonical
    # status values, and enforces CHECK / UNIQUE / FK constraints.
    if len(migrations) >= 11:
        assert_eq(
            "iprs table starts empty",
            conn.execute("SELECT count(*) FROM iprs").fetchone()[0],
            0,
        )
        assert_eq(
            "ipr_steps table starts empty",
            conn.execute("SELECT count(*) FROM ipr_steps").fetchone()[0],
            0,
        )

        # Pick a real case_id from case_files to satisfy the FK.
        sample_case_id = conn.execute(
            "SELECT id FROM case_files LIMIT 1"
        ).fetchone()[0]

        # Happy path: insert one ipr with a valid case_id and three steps.
        conn.execute(
            """
            INSERT INTO iprs (id, case_id, title, description, status, created_at, updated_at)
            VALUES ('ipr-1', ?, 'Sample plan', '', 'draft', '0', '0')
            """,
            (sample_case_id,),
        )
        for idx, status in enumerate(("planned", "in_progress", "completed")):
            conn.execute(
                """
                INSERT INTO ipr_steps (
                    id, ipr_id, order_no, title, description, target_date,
                    status, created_at, updated_at
                ) VALUES (?, 'ipr-1', ?, ?, '', NULL, ?, '0', '0')
                """,
                (f"step-{idx}", idx, f"Step {idx}", status),
            )

        # FK reject: case_id that doesn't exist.
        try:
            conn.execute(
                """
                INSERT INTO iprs (id, case_id, title, description, status, created_at, updated_at)
                VALUES ('ipr-bad', 'nonexistent-case', '', '', 'draft', '0', '0')
                """
            )
        except sqlite3.IntegrityError:
            pass
        else:
            raise AssertionError("FK on iprs.case_id didn't reject unknown case")

        # CHECK reject: unknown ipr status.
        try:
            conn.execute(
                """
                INSERT INTO iprs (id, case_id, title, description, status, created_at, updated_at)
                VALUES ('ipr-2', ?, '', '', 'pending_review', '0', '0')
                """,
                (sample_case_id,),
            )
        except sqlite3.IntegrityError:
            pass
        else:
            raise AssertionError("CHECK on iprs.status didn't reject 'pending_review'")

        # CHECK reject: unknown ipr_step status.
        try:
            conn.execute(
                """
                INSERT INTO ipr_steps (
                    id, ipr_id, order_no, title, description, target_date,
                    status, created_at, updated_at
                ) VALUES ('step-x', 'ipr-1', 99, '', '', NULL, 'paused', '0', '0')
                """
            )
        except sqlite3.IntegrityError:
            pass
        else:
            raise AssertionError("CHECK on ipr_steps.status didn't reject 'paused'")

        # UNIQUE reject: duplicate (ipr_id, order_no).
        try:
            conn.execute(
                """
                INSERT INTO ipr_steps (
                    id, ipr_id, order_no, title, description, target_date,
                    status, created_at, updated_at
                ) VALUES ('step-dup', 'ipr-1', 0, '', '', NULL, 'planned', '0', '0')
                """
            )
        except sqlite3.IntegrityError:
            pass
        else:
            raise AssertionError("UNIQUE(ipr_id, order_no) didn't reject duplicate order")

        # CASCADE: deleting the ipr removes its steps.
        conn.execute("DELETE FROM iprs WHERE id = 'ipr-1'")
        remaining_steps = conn.execute(
            "SELECT count(*) FROM ipr_steps WHERE ipr_id = 'ipr-1'"
        ).fetchone()[0]
        assert_eq("ipr_steps cascade delete", remaining_steps, 0)

    # Phase A Sprint 3 (migrations 0012–0013): year_plan_tasks + request_log.
    if len(migrations) >= 12:
        assert_eq(
            "year_plan_tasks table starts empty",
            conn.execute("SELECT count(*) FROM year_plan_tasks").fetchone()[0],
            0,
        )
        conn.execute(
            """
            INSERT INTO year_plan_tasks (
                id, title, task_kind, description, target_groups,
                planned_minutes, school_year, status, created_at, updated_at
            ) VALUES (
                'ypt-1', 'Bullying prevention', 'prevention_campaign', '',
                '[]', 120, '2025-2026', 'planned', '0', '0'
            )
            """
        )
        try:
            conn.execute(
                """
                INSERT INTO year_plan_tasks (
                    id, title, task_kind, description, target_groups,
                    planned_minutes, school_year, status, created_at, updated_at
                ) VALUES (
                    'ypt-bad', '', 'unknown_kind', '', '[]',
                    10, '2025-2026', 'planned', '0', '0'
                )
                """
            )
        except sqlite3.IntegrityError:
            pass
        else:
            raise AssertionError("CHECK on year_plan_tasks.task_kind didn't reject unknown kind")

    if len(migrations) >= 13:
        assert_eq(
            "request_log table starts empty",
            conn.execute("SELECT count(*) FROM request_log").fetchone()[0],
            0,
        )
        sample_case_id = conn.execute("SELECT id FROM case_files LIMIT 1").fetchone()[0]
        conn.execute(
            """
            INSERT INTO request_log (
                id, received_at, week_bucket, source, subject_shadow_id,
                topic_text, urgency, status, notes_local
            ) VALUES (
                'req-1', '100', '1970-W00', 'teacher', '7B shadow',
                'Need consultation', 'normal', 'open', ''
            )
            """
        )
        conn.execute(
            """
            UPDATE request_log
            SET status = 'converted_to_case', case_id = ?, closed_at = '200'
            WHERE id = 'req-1'
            """,
            (sample_case_id,),
        )
        try:
            conn.execute(
                """
                INSERT INTO request_log (
                    id, received_at, week_bucket, source, subject_shadow_id,
                    topic_text, urgency, status, notes_local
                ) VALUES (
                    'req-bad', '0', '1970-W00', 'teacher', '', 'x', 'urgent', 'open', ''
                )
                """
            )
        except sqlite3.IntegrityError:
            pass
        else:
            raise AssertionError("CHECK on request_log.urgency didn't reject 'urgent'")

        # FK + ON DELETE SET NULL: removing case clears request_log.case_id.
        conn.execute("DELETE FROM case_files WHERE id = ?", (sample_case_id,))
        case_id_after = conn.execute(
            "SELECT case_id FROM request_log WHERE id = 'req-1'"
        ).fetchone()[0]
        assert_eq("request_log.case_id SET NULL on case delete", case_id_after, None)

    if len(migrations) >= 14:
        assert_eq(
            "referrals table starts empty",
            conn.execute("SELECT count(*) FROM referrals").fetchone()[0],
            0,
        )
        case_id = conn.execute("SELECT id FROM case_files LIMIT 1").fetchone()[0]
        conn.execute(
            """
            INSERT INTO referrals (
                id, case_id, request_id, referred_to, referred_to_name,
                reason_text, urgency, status, referred_at, follow_up_at,
                notes_local, created_at, updated_at
            ) VALUES (
                'ref-1', ?, NULL, 'crisis_center', 'Crisis line',
                'Urgent referral', 'high', 'pending', '0', NULL, '', '0', '0'
            )
            """,
            (case_id,),
        )
        try:
            conn.execute(
                """
                INSERT INTO referrals (
                    id, case_id, request_id, referred_to, referred_to_name,
                    reason_text, urgency, status, referred_at, follow_up_at,
                    notes_local, created_at, updated_at
                ) VALUES (
                    'ref-bad', ?, NULL, 'unknown_target', '', 'x', 'normal',
                    'pending', '0', NULL, '', '0', '0'
                )
                """,
                (case_id,),
            )
        except sqlite3.IntegrityError:
            pass
        else:
            raise AssertionError("CHECK on referrals.referred_to didn't reject unknown target")

    if len(migrations) >= 15:
        assert_eq(
            "audit_log table starts empty",
            conn.execute("SELECT count(*) FROM audit_log").fetchone()[0],
            0,
        )
        assert_eq(
            "aggregate_runs table starts empty",
            conn.execute("SELECT count(*) FROM aggregate_runs").fetchone()[0],
            0,
        )
        conn.execute(
            """
            INSERT INTO audit_log (
                id, occurred_at, actor_id, action, table_name, record_id, changed_fields
            ) VALUES ('aud-1', '0', 1, 'insert', 'referrals', 'ref-1', '{}')
            """
        )
        try:
            conn.execute(
                """
                INSERT INTO audit_log (
                    id, occurred_at, actor_id, action, table_name, record_id, changed_fields
                ) VALUES ('aud-bad', '0', 1, 'purge', 'referrals', 'ref-1', '{}')
                """
            )
        except sqlite3.IntegrityError:
            pass
        else:
            raise AssertionError("CHECK on audit_log.action didn't reject 'purge'")

    print("[smoke] OK — all assertions passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
