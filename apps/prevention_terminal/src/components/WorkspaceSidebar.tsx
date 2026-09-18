import { useEffect, useState } from "react";

import type { WorkspaceNavItem } from "../lib/workspace_nav.ts";
import WorkspaceNavIcon from "./WorkspaceNavIcon.tsx";
import { t } from "../lib/i18n.ts";

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

  const topItems = items.filter(
    (i) =>
      !i.purpleCluster &&
      i.tier !== "system" &&
      i.id !== "analytical_report" &&
      i.id !== "workload" &&
      i.id !== "academy" &&
      i.id !== "feedback" &&
      i.id !== "settings" &&
      i.id !== "my_profile",
  );

  const purpleItems = items.filter((i) => i.purpleCluster);

  const reportItems = items.filter(
    (i) =>
      (i.id === "analytical_report" || i.id === "workload" || i.id === "academy") &&
      !i.purpleCluster,
  );

  const systemItems = items.filter(
    (i) =>
      i.tier === "system" ||
      i.id === "feedback" ||
      i.id === "settings",
  );

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
        {topItems.map(renderItem)}

        {purpleItems.length > 0 && (
          <div className="workspace-nav-cluster workspace-nav-cluster--purple">
            {purpleItems.map(renderItem)}
          </div>
        )}

        {reportItems.map(renderItem)}

        {systemItems.length > 0 && (
          <>
            <div key="nav-divider-system" className="workspace-nav-divider" role="separator" />
            {systemItems.map(renderItem)}
          </>
        )}
      </nav>
    </aside>
  );
}
