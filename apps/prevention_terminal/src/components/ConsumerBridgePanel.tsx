import { useEffect, useState } from "react";

import { fetchConsumerBridge } from "../lib/ai_workspace.ts";
import {
  fetchSharedCaseHandoff,
  importSharedCaseToRequest,
} from "../lib/consumer_bridge_client.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";

interface ConsumerBridgePanelProps {
  terminalConfig: TerminalConfig;
}

export default function ConsumerBridgePanel(props: ConsumerBridgePanelProps) {
  const { terminalConfig } = props;
  const app = terminalConfig.consumer_app;
  const [bridge, setBridge] = useState<{ pwa_url: string; bridge_code: string } | null>(null);
  const [token, setToken] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!app) return;
    fetchConsumerBridge({
      consumerApp: app,
      childInviteCode: terminalConfig.child_invite_code,
      terminalUserId: terminalConfig.terminal_user_id,
    })
      .then(setBridge)
      .catch(() => setBridge(null));
  }, [app, terminalConfig.child_invite_code, terminalConfig.terminal_user_id]);

  async function handleImport() {
    if (!token.trim() || busy) return;
    setBusy(true);
    setImportMsg("");
    try {
      const handoff = await fetchSharedCaseHandoff({
        terminalUserId: terminalConfig.terminal_user_id,
        bridgeCode: terminalConfig.child_invite_code,
        sharedCaseToken: token.trim(),
      });
      const requestId = await importSharedCaseToRequest(handoff);
      setImportMsg(`Заявка создана: ${requestId}. Откройте журнал приёма.`);
      setToken("");
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!app) {
    return (
      <section className="card">
        <h2>Пользовательское приложение</h2>
        <p className="muted">Не подключено. Настройте в onboarding (Teenology / IDA).</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Мост с {app === "teenology" ? "Teenology" : "IDA"}</h2>
      <p className="muted">
        Дочерняя ссылка: <code>{terminalConfig.child_invite_code}</code>
      </p>
      {bridge && (
        <p>
          <a href={bridge.pwa_url} target="_blank" rel="noreferrer">
            Открыть consumer PWA
          </a>
        </p>
      )}
      <label className="field">
        <span>Токен shared_case из Teenology</span>
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="12-символьный токен ссылки"
          maxLength={16}
        />
      </label>
      <button type="button" className="ob-btn" disabled={busy || !token.trim()} onClick={() => void handleImport()}>
        {busy ? "…" : "Импорт в локальный журнал"}
      </button>
      {importMsg && <p className="muted">{importMsg}</p>}
    </section>
  );
}
