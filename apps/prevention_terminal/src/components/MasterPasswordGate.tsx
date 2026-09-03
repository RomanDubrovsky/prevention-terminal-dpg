/**
 * Экран авторизации: создание мастер-пароля или вход в существующую БД.
 *
 * Контракт с Rust (см. `src-tauri/src/lib.rs`):
 *   * `db_list_profiles()` — какие локальные профили есть на устройстве.
 *   * `db_create_profile(displayName)` — создать профильную папку.
 *   * `db_profile_is_initialized(profileSlug)` — есть ли соль в профиле.
 *   * `db_unlock_profile(profileSlug, password)` — открыть профильную БД.
 *   * `db_lock()` — выключить сессию (используется снаружи, в App.tsx).
 *
 * Все ошибки от Rust здесь маппятся в один из двух UI-сценариев:
 *   - `Invalid password` → корректное сообщение «Неверный мастер-пароль».
 *   - всё остальное → нейтральное «Не удалось разблокировать БД».
 * Никаких raw-сообщений от SQLite или filesystem наружу не показываем.
 */

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type GateMode = "loading" | "profile-required" | "register" | "login";

interface ProfileInfo {
  slug: string;
  display_name: string;
  is_initialized: boolean;
}

interface MasterPasswordGateProps {
  onAuthorized: () => void;
}

export default function MasterPasswordGate(props: MasterPasswordGateProps) {
  const { onAuthorized } = props;
  const [mode, setMode] = useState<GateMode>("loading");
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ProfileInfo | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // На монтировании спрашиваем у Rust, какие локальные профили уже есть.
  useEffect(() => {
    let cancelled = false;
    invoke<ProfileInfo[]>("db_list_profiles")
      .then((rows) => {
        if (cancelled) return;
        setProfiles(rows);
        if (rows.length === 0) {
          setMode("profile-required");
          return;
        }
        const first = rows[0];
        setSelectedProfile(first);
        setMode(first.is_initialized ? "login" : "register");
      })
      .catch(() => {
        if (cancelled) return;
        // Off-Tauri (например, `npm run dev` в браузере): фолбэк в register,
        // чтобы UI можно было хотя бы посмотреть. db_unlock всё равно упадёт.
        const previewProfile = {
          slug: "preview",
          display_name: "Предпросмотр",
          is_initialized: false,
        };
        setProfiles([previewProfile]);
        setSelectedProfile(previewProfile);
        setMode("register");
        setError("Tauri-рантайм недоступен — это режим предпросмотра UI.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshModeForProfile = useCallback(async (profile: ProfileInfo) => {
    setSelectedProfile(profile);
    setPassword("");
    setConfirm("");
    setError(null);
    setMode("loading");
    try {
      const ok = await invoke<boolean>("db_profile_is_initialized", {
        profileSlug: profile.slug,
      });
      const updated = { ...profile, is_initialized: ok };
      setProfiles((prev) =>
        prev.map((item) => (item.slug === updated.slug ? updated : item)),
      );
      setSelectedProfile(updated);
      setMode(ok ? "login" : "register");
    } catch {
      setMode(profile.is_initialized ? "login" : "register");
      setError("Не удалось проверить состояние профиля.");
    }
  }, []);

  const handleDeleteProfile = useCallback(
    async (slug: string) => {
      if (!window.confirm("Вы действительно хотите полностью удалить этот рабочий профиль и все его зашифрованные данные на этом компьютере? Восстановить их будет невозможно.")) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await invoke("db_delete_profile", { profileSlug: slug });
        const updatedList = profiles.filter((p) => p.slug !== slug);
        setProfiles(updatedList);
        if (updatedList.length === 0) {
          setSelectedProfile(null);
          setMode("profile-required");
        } else {
          const next = updatedList[0];
          await refreshModeForProfile(next);
        }
      } catch (err) {
        setError(`Не удалось удалить профиль: ${String(err)}`);
      } finally {
        setBusy(false);
      }
    },
    [profiles, refreshModeForProfile],
  );

  const handleCreateProfile = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (newProfileName.trim().length < 2) {
        setError("Введите имя профиля, минимум 2 символа.");
        return;
      }
      setBusy(true);
      try {
        const profile = await invoke<ProfileInfo>("db_create_profile", {
          displayName: newProfileName,
        });
        setProfiles((prev) => [...prev, profile]);
        setNewProfileName("");
        await refreshModeForProfile(profile);
      } catch (err) {
        setError(`Не удалось создать профиль: ${String(err)}`);
      } finally {
        setBusy(false);
      }
    },
    [newProfileName, refreshModeForProfile],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!selectedProfile) {
        setError("Сначала выберите или создайте профиль.");
        return;
      }

      if (!password) {
        setError("Введите мастер-пароль.");
        return;
      }
      if (mode === "register") {
        if (password.length < 10) {
          setError("Пароль должен быть не короче 10 символов.");
          return;
        }
        if (password !== confirm) {
          setError("Пароли не совпадают.");
          return;
        }
      }

      setBusy(true);
      try {
        await invoke("db_unlock_profile", {
          profileSlug: selectedProfile.slug,
          password,
        });
        // Чистим пароль из памяти компонента (полную зачистку всё равно
        // не гарантирует GC, но строки в state сразу обнулим).
        setPassword("");
        setConfirm("");
        onAuthorized();
      } catch (err) {
        const msg = typeof err === "string" ? err : String(err);
        if (msg.includes("Invalid password")) {
          setError("Неверный мастер-пароль.");
        } else {
          setError("Не удалось разблокировать БД. Проверьте права доступа.");
        }
      } finally {
        setBusy(false);
      }
    },
    [mode, password, confirm, selectedProfile, onAuthorized],
  );

  if (mode === "loading") {
    return (
      <section className="card gate">
        <p className="muted">Проверяем состояние локальной базы…</p>
      </section>
    );
  }

  return (
    <section className="card gate">
      <div className="profile-panel">
        <h2>Рабочий профиль</h2>
        <p className="muted">
          Профиль — это личная учетная запись специалиста (как логин). Если за одним компьютером работают несколько психологов, у каждого будет свой профиль и своя зашифрованная база, скрытая от коллег.
        </p>

        {profiles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
            <label className="field" style={{ marginBottom: 0 }}>
              <span>Выберите профиль для входа</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={selectedProfile?.slug ?? ""}
                  onChange={(e) => {
                    const profile = profiles.find((item) => item.slug === e.target.value);
                    if (profile) void refreshModeForProfile(profile);
                  }}
                  disabled={busy}
                  style={{ flex: 1 }}
                >
                  {profiles.map((profile) => (
                    <option key={profile.slug} value={profile.slug}>
                      {profile.display_name}
                    </option>
                  ))}
                </select>
                {selectedProfile && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void handleDeleteProfile(selectedProfile.slug)}
                    disabled={busy}
                    style={{
                      padding: '0 12px',
                      color: 'var(--red)',
                      borderColor: 'var(--line)',
                      background: 'rgba(239, 68, 68, 0.05)',
                      fontSize: '0.85rem'
                    }}
                    title="Удалить выбранный профиль с компьютера"
                  >
                    Удалить
                  </button>
                )}
              </div>
            </label>
          </div>
        )}

        <form className="profile-create-form" onSubmit={handleCreateProfile}>
          <label className="field">
            <span>{profiles.length === 0 ? "Создайте ваш профиль (ФИО специалиста)" : "Создать новый профиль (для коллеги)"}</span>
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Например: Иванова Ирина"
              disabled={busy}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>
              💡 Это не логин в обычном смысле: имя профиля нужно только для отображения на компьютере, его можно писать на русском языке и оно не обязано быть уникальным.
            </span>
          </label>
          <button type="submit" className="secondary" disabled={busy}>
            Создать профиль
          </button>
        </form>
      </div>

      {mode === "profile-required" ? (
        <>
          {error && <p className="error">{error}</p>}
          <p className="muted tiny">
            Создайте профиль, а затем задайте пароль для защиты ваших данных.
          </p>
        </>
      ) : (
        <>
      <h2>
        {mode === "register"
          ? "Создайте пароль для входа"
          : "Вход в систему"}
      </h2>
      <p className="muted">
        {mode === "register" ? (
          <>
            Этот пароль шифрует базу данных на жестком диске вашего компьютера. Чтобы полностью исключить утечки конфиденциальной информации клиентов и соблюсти ФЗ-152, мы не храним ваши пароли на серверах. Восстановить пароль невозможно — если вы его забудете, доступ к данным будет утерян навсегда. Пожалуйста, запишите его.
          </>
        ) : (
          <>
            Введите пароль профиля{" "}
            <strong>{selectedProfile?.display_name}</strong> для разблокировки данных.
          </>
        )}
      </p>

      <form onSubmit={handleSubmit} className="gate-form" autoComplete="off">
        <label className="field">
          <span>Пароль для входа</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            autoFocus
          />
        </label>

        {mode === "register" && (
          <label className="field">
            <span>Повторите пароль</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy}
            />
          </label>
        )}

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={busy}>
          {busy
            ? "Открываем…"
            : mode === "register"
              ? "Создать и войти"
              : "Войти"}
        </button>
      </form>

      <details className="forgot-password-details" style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--muted)' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 'bold' }}>
          Что делать, если пароль утерян?
        </summary>
        <div style={{ marginTop: '8px', lineHeight: '1.4' }}>
          {mode === "register" ? (
            <p style={{ margin: '4px 0' }}>
              База данных шифруется локально. Если вы забудете пароль, расшифровать ваши файлы не получится. 
              Однако, если вы работаете в Центре, администратор сможет выдать вам новое приглашение, 
              и все ваши данные (календарь, реестр) восстановятся из резервной копии Центра.
            </p>
          ) : (
            <p style={{ margin: '4px 0' }}>
              Если вы забыли пароль от профиля, вы можете заново подключить Терминал. 
              Для специалистов Центров администратор может выдать новую ссылку-приглашение, 
              которая автоматически восстановит вашу историю и клиентов в новом профиле.
            </p>
          )}
          <p style={{ margin: '8px 0 0', fontWeight: 'bold' }}>
            ℹ️ Вы можете получить консультацию по восстановлению пароля, написав вашему администратору.
          </p>
        </div>
      </details>

      <details className="forgot-password-details" style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--muted)' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 'bold' }}>
          Как перенести свой профиль на другой компьютер?
        </summary>
        <div style={{ marginTop: '8px', lineHeight: '1.45' }}>
          <p style={{ margin: '4px 0' }}>
            Все данные Терминала хранятся строго локально на вашем компьютере. Для переноса профиля:
          </p>
          <ol style={{ paddingLeft: '20px', margin: '6px 0' }}>
            <li>Нажмите комбинацию клавиш <code>Win + R</code>, введите <code>%APPDATA%</code> и нажмите Enter.</li>
            <li>Перейдите в папку <code>school.prevention.terminal/profiles/</code>.</li>
            <li>Скопируйте папку вашего профиля (например, <code>default</code>), содержащую файлы базы данных <code>cases.sqlite</code>, соли <code>cases.sqlite.salt</code> и метаданных <code>profile.json</code>.</li>
            <li>Вставьте скопированную папку по аналогичному пути на новой машине. При входе введите тот же мастер-пароль.</li>
          </ol>
        </div>
      </details>

      {mode === "register" && (
        <p className="muted tiny">
          Защита базы данных выполняется локально на вашем компьютере. Первый вход после создания пароля может занять 1–2 секунды — это необходимо для предотвращения автоматического подбора паролей.
        </p>
      )}
        </>
      )}
    </section>
  );
}
