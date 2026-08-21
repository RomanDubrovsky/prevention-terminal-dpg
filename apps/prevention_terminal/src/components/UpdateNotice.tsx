import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import {
  checkForTerminalUpdate,
  type UpdateCheckResult,
} from "../lib/update_notifier.ts";
import { t } from "../lib/i18n.ts";

type VersionState =
  | { kind: "loading" }
  | { kind: "ready"; version: string }
  | { kind: "error"; message: string };

export default function UpdateNotice() {
  const [versionState, setVersionState] = useState<VersionState>({
    kind: "loading",
  });
  const [checkState, setCheckState] = useState<
    { kind: "idle" } | { kind: "checking" } | { kind: "done"; result: UpdateCheckResult }
  >({ kind: "idle" });

  useEffect(() => {
    let alive = true;
    invoke<string>("app_version")
      .then((version) => {
        if (alive) setVersionState({ kind: "ready", version });
      })
      .catch((err) => {
        if (alive) {
          setVersionState({
            kind: "error",
            message: t(`Не удалось определить версию: ${String(err)}`, `Could not determine version: ${String(err)}`),
          });
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleCheck = useCallback(async () => {
    if (versionState.kind !== "ready") return;
    setCheckState({ kind: "checking" });
    const result = await checkForTerminalUpdate(versionState.version);
    setCheckState({ kind: "done", result });
  }, [versionState]);

  const currentVersion =
    versionState.kind === "ready" ? versionState.version : t("определяется...", "detecting...");
  const isChecking = checkState.kind === "checking";

  return (
    <section className="card update-notice">
      <div>
        <h2>{t("Обновления", "Updates")}</h2>
        <p className="muted">
          {t("Текущая версия: ", "Current version: ")}<code>{currentVersion}</code>. {t("Проверка делает только один запрос к публичному ", "Check only makes a single request to the public ")}<code>latest.json</code> {t(" и не отправляет на сервер каких-либо пользовательских данных.", " and does not send any user data to the server.")}
        </p>
      </div>

      <button
        type="button"
        className="secondary"
        onClick={handleCheck}
        disabled={versionState.kind !== "ready" || isChecking}
      >
        {isChecking ? t("Проверяем...", "Checking...") : t("Проверить обновления", "Check for Updates")}
      </button>

      {versionState.kind === "error" && <p className="error">{versionState.message}</p>}
      {checkState.kind === "done" && <UpdateCheckMessage result={checkState.result} />}

      <details className="forgot-password-details" style={{ marginTop: '24px', fontSize: '0.85rem', color: 'var(--muted)', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 'bold' }}>
          {t("Как перенести свой профиль на другой компьютер?", "How to transfer your profile to another computer?")}
        </summary>
        <div style={{ marginTop: '8px', lineHeight: '1.45' }}>
          <p style={{ margin: '4px 0' }}>
            {t("Все данные Терминала хранятся строго локально на вашем компьютере. Для переноса профиля:", "All Terminal data is stored strictly locally on your computer. To transfer your profile:")}
          </p>
          <ol style={{ paddingLeft: '20px', margin: '6px 0' }}>
            <li>{t("Нажмите комбинацию клавиш ", "Press the key combination ")}<code>Win + R</code>{t(", введите ", ", type ")}<code>%APPDATA%</code>{t(" и нажмите Enter.", " and press Enter.")}</li>
            <li>{t("Перейдите в папку ", "Go to the directory ")}<code>school.prevention.terminal/profiles/</code>.</li>
            <li>{t("Скопируйте папку вашего профиля (например, ", "Copy your profile folder (for example, ")}<code>default</code>{t("), содержащую файлы базы данных ", "), containing database file ")}<code>cases.sqlite</code>{t(", соли ", ", salt ")}<code>cases.sqlite.salt</code>{t(" и метаданных ", " and metadata ")}<code>profile.json</code>.</li>
            <li>{t("Вставьте скопированную папку по аналогичному пути на новой машине. При входе введите тот же мастер-пароль.", "Paste the copied folder into the same path on the new machine. Enter the same master password upon launch.")}</li>
          </ol>
        </div>
      </details>
    </section>
  );
}

function UpdateCheckMessage({ result }: { result: UpdateCheckResult }) {
  if (result.status === "update-available" && result.latest) {
    return (
      <div className="update-result update-result-available">
        <strong>{t(`Доступна версия ${result.latest.version}`, `Version ${result.latest.version} is available`)}</strong>
        <p>
          {result.latest.message ??
            t("Новая сборка Терминала доступна для ручного скачивания.", "A new Terminal build is available for manual download.")}
        </p>
        <div className="update-links">
          <a href={result.latest.download_url} target="_blank" rel="noreferrer">
            {t("Скачать установщик", "Download Installer")}
          </a>
          {result.latest.notes_url && (
            <a href={result.latest.notes_url} target="_blank" rel="noreferrer">
              {t("Что изменилось", "What's New")}
            </a>
          )}
        </div>
      </div>
    );
  }

  if (result.status === "up-to-date") {
    return <p className="ok">{t("Установлена актуальная версия.", "The latest version is installed.")}</p>;
  }

  return (
    <p className="warn">
      {t("Не удалось проверить обновления. Терминал продолжает работать офлайн.", "Could not check for updates. Terminal continues to work offline.")}
      {result.notice ? ` ${result.notice}` : ""}
    </p>
  );
}
