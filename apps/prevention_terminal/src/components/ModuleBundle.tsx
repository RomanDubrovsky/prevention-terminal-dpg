import { Component, Suspense, type ErrorInfo, type ReactNode } from "react";

import { lazyModules, type ModuleBundleId } from "../lib/module_bundles.ts";
import { requestOpenFeedbackSettings } from "../lib/workspace_navigation.ts";

interface ModuleBundleProps {
  id: ModuleBundleId;
  enabled?: boolean;
  fallback?: ReactNode;
  children?: ReactNode;
  [key: string]: unknown;
}

interface ModuleErrorBoundaryState {
  error: Error | null;
}

class ModuleErrorBoundary extends Component<{ fallback?: ReactNode; children: ReactNode }, ModuleErrorBoundaryState> {
  state: ModuleErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ModuleErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Module load/render failed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <section className="card">
            <h3>Не удалось открыть модуль</h3>
            <p className="error">{this.state.error.message}</p>
            <p className="muted tiny">
              Обновите страницу или сообщите об ошибке через{" "}
              <button type="button" className="linkish" onClick={() => requestOpenFeedbackSettings()}>
                Настройки → Обратная связь
              </button>
              .
            </p>
          </section>
        )
      );
    }
    return this.props.children;
  }
}

export default function ModuleBundle(props: ModuleBundleProps) {
  const { id, enabled = true, fallback, children, ...rest } = props;
  if (!enabled) return null;
  const Comp = lazyModules[id];
  return (
    <ModuleErrorBoundary fallback={fallback as ReactNode | undefined}>
      <Suspense fallback={fallback ?? <section className="card"><p className="muted">Загрузка модуля…</p></section>}>
        <Comp {...rest}>{children}</Comp>
      </Suspense>
    </ModuleErrorBoundary>
  );
}
