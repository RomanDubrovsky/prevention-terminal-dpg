// sync_manager.ts
// Core offline‑first synchronisation manager for the Prevention terminal.
// It pulls pending requests from the local SQLite queue, attempts to POST them
// to the primary API endpoints defined in the terminal configuration, and if
// those fail it falls back to peer terminals discovered via mDNS.

// @ts-ignore
import { getConfig } from "./terminal_config";
import { getQueuedRequests, updateRequestStatus, purgeProcessed } from "./offline_queue";
import { getPeers } from "./p2p_discovery";

// Helper to POST a single request to a given URL with the shared secret.
async function postRequest(url: string, request: any, secret: string) {
  try {
    const response = await fetch(`${url}/api/sync/pending`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-P2P-Secret": secret,
      },
      body: JSON.stringify([request]), // server expects an array of pending requests
    });
    if (!response.ok) {
      console.warn(`Sync failed to ${url}: ${response.status}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(`Network error syncing to ${url}:`, e);
    return false;
  }
}

// Attempt to sync a batch of pending requests to the list of primary endpoints.
async function syncToPrimaryEndpoints(requests: any[], config: any) {
  const { sync_endpoints, p2p_secret } = config;
  for (const endpoint of sync_endpoints) {
    const success = await postRequest(endpoint, requests, p2p_secret);
    if (success) {
      return true; // at least one primary endpoint succeeded
    }
  }
  return false;
}

// If primary sync fails, try each discovered peer.
async function syncToPeers(requests: any[], config: any) {
  const { p2p_secret } = config;
  const peers = getPeers();
  for (const peer of peers) {
    const success = await postRequest(peer.address, requests, p2p_secret);
    if (success) {
      return true;
    }
  }
  return false;
}

// Main loop – runs periodically (default every 30 seconds).
export function startSyncLoop(intervalMs: number = 30_000) {
  const config = getConfig();
  if (!config) {
    console.error("Terminal config not loaded – cannot start sync loop.");
    return;
  }

  const loop = async () => {
    const pending = await getQueuedRequests();
    if (pending.length === 0) {
      return;
    }
    // Try primary endpoints first.
    let synced = await syncToPrimaryEndpoints(pending, config);
    // Fallback to peers if needed.
    if (!synced) {
      synced = await syncToPeers(pending, config);
    }
    if (synced) {
      // Mark all as sent and purge.
      for (const req of pending) {
        await updateRequestStatus(req.id, "sent");
      }
      await purgeProcessed();
    } else {
      console.warn("All sync attempts failed – will retry on next interval.");
    }
  };

  // Initial run then schedule.
  loop();
  setInterval(loop, intervalMs);
}
