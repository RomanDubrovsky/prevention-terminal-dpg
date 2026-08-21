// p2p_discovery.ts
// Simple mDNS service discovery for local peers.
// Uses the 'mdns' npm package (already a dependency of the Tauri app).

// @ts-ignore
import { createBrowser } from "mdns-browser";

export type PeerInfo = {
  id: string; // unique identifier for the peer (e.g., terminal_user_id)
  address: string; // http://ip:port
};

let peers: Record<string, PeerInfo> = {};

export function startDiscovery(onPeerFound: (peer: PeerInfo) => void) {
  // "_prevention._tcp.local" is a custom service type.
  const browser = createBrowser({ service: "_prevention._tcp.local" });
  browser.on("serviceUp", (service: any) => {
    const addr = `http://${service.host}:${service.port}`;
    const peer: PeerInfo = { id: service.name, address: addr };
    peers[service.name] = peer;
    onPeerFound(peer);
  });
  browser.on("serviceDown", (service: any) => {
    delete peers[service.name];
  });
  browser.start();
}

export function getPeers(): PeerInfo[] {
  return Object.values(peers);
}
