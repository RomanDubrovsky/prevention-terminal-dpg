import { useState } from "react";
import ModuleGuideModal from "./LazyModuleGuideModal.tsx";
import { isCommercialOrg } from "../lib/case_meta.ts";

import type { TerminalConfig } from "../lib/terminal_config.ts";

interface GlobalGuideButtonProps {
  activeView: string;
  cfg: TerminalConfig;
}

export default function GlobalGuideButton({ activeView, cfg }: GlobalGuideButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isDomainCommercial = typeof window !== "undefined" && (
    window.location.hostname.includes("ida-psy") || 
    window.location.hostname.includes("corporate-health")
  );
  const isCommercial = isCommercialOrg(cfg) || isDomainCommercial;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background: "var(--violet, #7c3aed)",
          color: "#fff",
          border: "none",
          boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)",
          fontSize: "24px",
          fontWeight: "bold",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 9999,
          transition: "transform 0.2s"
        }}
        title="Справка по этому разделу"
        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
      >
        ?
      </button>

      <ModuleGuideModal
        moduleId={activeView}
        isCommercial={isCommercial}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
