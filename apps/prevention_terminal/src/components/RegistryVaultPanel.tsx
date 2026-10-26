import { useState } from "react";
import { t } from "../lib/i18n.ts";

import {
  exportRegistryVaultBackup,
  generateRecoveryKeyDisplay,
  needsRegistryVaultSetup,
  restoreRegistryVaultBackup,
  saveRegistryVaultSetup,
  verifyRecoveryKeyAgainstConfig,
  verifyRegistryVaultBackupFile,
} from "../lib/registry_vault.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";

interface RegistryVaultPanelProps {
  cfg: TerminalConfig;
  onConfigChange: (cfg: TerminalConfig) => void;
  onReloadSubjects: () => void;
}

export default function RegistryVaultPanel(props: RegistryVaultPanelProps) {
  const { cfg, onConfigChange, onReloadSubjects } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recoveryKeyInput, setRecoveryKeyInput] = useState("");
  const [setupKey, setSetupKey] = useState<string | null>(null);
  const [setupAck, setSetupAck] = useState(false);
  const [showSetup, setShowSetup] = useState(() => needsRegistryVaultSetup(cfg));

  async function beginVaultSetup() {
    setBusy(true);
    setError(null);
    try {
      setSetupKey(await generateRecoveryKeyDisplay());
      setShowSetup(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmVaultSetup() {
    if (!setupKey || !setupAck) {
      setError("Скопируйте ключ и подтвердите галочкой.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await saveRegistryVaultSetup({ cfg, recoveryKey: setupKey });
      onConfigChange(next);
      setSetupKey(null);
      setShowSetup(false);
      setMessage("Ключ восстановления сохранён. Теперь можно создавать резервную копию .vault.enc");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function withRecoveryKey(action: (key: string) => Promise<void>): Promise<void> {
    const key = recoveryKeyInput.trim();
    if (!key) {
      setError("Введите ключ восстановления.");
      return;
    }
    if (needsRegistryVaultSetup(cfg)) {
      setError("Сначала настройте ключ восстановления.");
      return;
    }
    const ok = await verifyRecoveryKeyAgainstConfig(key, cfg);
    if (!ok) {
      setError("Неверный ключ восстановления.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    await withRecoveryKey(async (key) => {
      await exportRegistryVaultBackup(key);
      setMessage("Резервная копия сохранена (.vault.enc). Храните файл отдельно от ключа.");
    });
  }

  async function handleVerify() {
    await withRecoveryKey(async (key) => {
      const result = await verifyRegistryVaultBackupFile(key);
      setMessage(`Копия целая: ${result.subject_count} записей (экспорт ${result.exported_at}).`);
    });
  }

  async function handleRestore() {
    if (
      !window.confirm(
        "Восстановить реестр из файла? Существующие карточки с тем же ID будут пропущены.",
      )
    ) {
      return;
    }
    await withRecoveryKey(async (key) => {
      const result = await restoreRegistryVaultBackup(key);
      onReloadSubjects();
      setMessage(`Восстановлено: ${result.imported}, пропущено: ${result.skipped}.`);
    });
  }

  if (showSetup && setupKey) {
    return (
      <section className="card registry-vault-setup">
        <h3>Ключ восстановления реестра</h3>
        <p className="muted tiny">
          Сохраните этот ключ в менеджере паролей или на бумаге. Без него файл .vault.enc не
          открыть. Ключ и файл не хранятся на серверах Prevention (ни Supabase, ни cloud.ru) — только у
          вас.
          {t(
            "Сохраните этот ключ в менеджере паролей или на бумаге. Без него файл .vault.enc не открыть. Ключ и файл не хранятся на серверах Prevention (ни Supabase, ни cloud.ru) — только у вас.",
            "Save this key in a password manager or on paper. Without it, the .vault.enc file cannot be opened. The key and file are not stored on Prevention servers — they are yours only."
          )}
        </p>
        <pre className="registry-recovery-key-display" aria-label={t("Ключ восстановления", "Recovery Key")}>
          {setupKey}
        </pre>
        <label className="field inline registry-wizard-check">
          <input type="checkbox" checked={setupAck} onChange={(e) => setSetupAck(e.target.checked)} />
          <span>{t("Я сохранил(а) ключ в надёжном месте отдельно от будущих копий", "I have saved the key in a secure place, separate from future backups")}</span>
        </label>
        <div className="registry-toolbar-actions">
          <button
            type="button"
            className="ob-btn primary"
            disabled={busy}
            onClick={() => void confirmVaultSetup()}
          >
            {busy ? t("Сохраняем…", "Saving…") : t("Готово — включить резервное копирование", "Done — enable backup")}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  return (
    <section className="card registry-vault-panel">
      <h3>{t("Резервная копия реестра", "Registry Backup")}</h3>
      <p className="muted tiny">
        {t(
          "Зашифрованный файл .vault.enc — для переноса на другой компьютер. Сейчас персональные данные хранятся только в реестре на этом устройстве, кроме вас их больше никто не может увидеть.",
          "Encrypted file .vault.enc for moving to another computer. Personal data is currently stored only in the registry on this device; only you can see it."
        )}
      </p>

      {needsRegistryVaultSetup(cfg) ? (
        <button type="button" className="ob-btn primary" disabled={busy} onClick={() => void beginVaultSetup()}>
          {busy ? t("Генерируем ключ…", "Generating key...") : t("Настроить ключ восстановления", "Configure recovery key")}
        </button>
      ) : (
        <>
          <label className="field">
            <span>{t("Ключ восстановления", "Recovery Key")}</span>
            <input
              type="password"
              autoComplete="off"
              value={recoveryKeyInput}
              onChange={(e) => setRecoveryKeyInput(e.target.value)}
              placeholder="XXXX-XXXX-…"
            />
          </label>
          <div className="registry-toolbar-actions">
            <button type="button" className="ob-btn secondary" disabled={busy} onClick={() => void handleExport()}>
              {t("Создать .vault.enc", "Create .vault.enc")}
            </button>
            <button type="button" className="ob-btn secondary" disabled={busy} onClick={() => void handleVerify()}>
              {t("Проверить копию", "Verify backup")}
            </button>
            <button type="button" className="ob-btn secondary" disabled={busy} onClick={() => void handleRestore()}>
              {t("Восстановить из копии", "Restore backup")}
            </button>
          </div>
        </>
      )}

      {message && <p className="ok tiny">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
