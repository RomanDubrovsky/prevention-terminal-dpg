import { lazy, Suspense } from "react";
import type { ComponentProps } from "react";
import type ModuleGuideModalType from "./ModuleGuideModal.tsx";

const ModuleGuideModalInternal = lazy(() => import("./ModuleGuideModal.tsx"));

export function LazyModuleGuideModal(props: ComponentProps<typeof ModuleGuideModalType>) {
  if (!props.isOpen) return null;
  return (
    <Suspense fallback={null}>
      <ModuleGuideModalInternal {...props} />
    </Suspense>
  );
}

export default LazyModuleGuideModal;
