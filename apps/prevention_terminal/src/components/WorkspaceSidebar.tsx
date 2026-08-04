import { useEffect, useState } from "react";

import type { WorkspaceNavItem } from "../lib/workspace_nav.ts";
import WorkspaceNavIcon from "./WorkspaceNavIcon.tsx";

interface WorkspaceSidebarProps {
  items: WorkspaceNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export default function WorkspaceSidebar(props: WorkspaceSidebarProps) {
  const { items, activeId, onSelect } = props;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 901px)");
    const sync = () => setExpanded(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const renderItem = (item: WorkspaceNavItem) => (
    <div key={item.id} className="workspace-nav-block">
      <button
        type="button"
        className={`workspace-nav-item${activeId === item.id ? " active" : ""}${item.id === "settings" ? " workspace-nav-item--settings" : ""}${item.locked ? " workspace-nav-item--locked" : ""}${item.highlightCluster ? " workspace-nav-item--cluster" : ""}${item.aiCluster ? " workspace-nav-item--ai-cluster" : ""}`}
        title={item.locked ? `${item.label} — по подписке ИИ` : item.label}
        aria-disabled={item.locked || undefined}
        onClick={() => {
          onSelect(item.id);
          if (window.matchMedia("(max-width: 900px)").matches) {
            setExpanded(false);
          }
        }}
      >
        <WorkspaceNavIcon id={item.icon} />
        <span className="workspace-nav-label">{item.label}</span>
        {item.locked ? <span className="workspace-nav-lock" aria-hidden="true">🔒</span> : null}
      </button>
    </div>
  );

  const renderedNav: React.ReactNode[] = [];
  let currentCluster: WorkspaceNavItem[] = [];
  let currentAiCluster: WorkspaceNavItem[] = [];

  const flushCluster = () => {
    if (currentCluster.length > 0) {
      const list = [...currentCluster];
      renderedNav.push(
        <div key={`cluster-${list[0].id}`} className="workspace-nav-cluster">
          {list.map(renderItem)}
        </div>
      );
      currentCluster = [];
    }
  };

  const flushAiCluster = () => {
    if (currentAiCluster.length > 0) {
      const list = [...currentAiCluster];
      renderedNav.push(
        <div key={`ai-cluster-${list[0].id}`} className="workspace-nav-cluster workspace-nav-cluster--ai">
          {list.map(renderItem)}
        </div>
      );
      currentAiCluster = [];
    }
  };

  items.forEach((item) => {
    if (item.highlightCluster) {
      currentCluster.push(item);
    } else if (item.aiCluster) {
      flushCluster();
      currentAiCluster.push(item);
    } else {
      flushCluster();
      flushAiCluster();
      renderedNav.push(renderItem(item));
    }
  });
  flushCluster();
  flushAiCluster();

  return (
    <aside
      className={`workspace-sidebar${expanded ? " workspace-sidebar--expanded" : ""}`}
      aria-label="Инструменты рабочего места"
    >
      <button
        type="button"
        className="workspace-sidebar-toggle"
        aria-label={expanded ? "Свернуть меню" : "Развернуть меню"}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="workspace-sidebar-toggle-bars" aria-hidden="true" />
      </button>

      <nav className="workspace-nav">
        {renderedNav}
      </nav>
    </aside>
  );
}
