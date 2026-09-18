import { useEffect, useRef, useState } from "react";

interface TerminalAppMenuProps {
  onOpenSettings: () => void;
}

export default function TerminalAppMenu(props: TerminalAppMenuProps) {
  const { onOpenSettings } = props;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="terminal-app-menu" ref={rootRef}>
      <button
        type="button"
        className="terminal-app-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Меню
      </button>
      {open && (
        <div className="terminal-app-menu-popover" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
          >
            Настройки
          </button>
        </div>
      )}
    </div>
  );
}
