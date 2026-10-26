import SessionTagsEditor from "./SessionTagsEditor.tsx";
import type { ConsultationSessionTags } from "../lib/session_tagging.ts";

interface ConsultationSessionTagsEditorProps {
  commercial: boolean;
  value: ConsultationSessionTags;
  onChange: (value: ConsultationSessionTags) => void;
  disabled?: boolean;
  aiAction?: React.ReactNode;
  hideThemes?: boolean;
  hideFormatsAndMethods?: boolean;
}

export default function ConsultationSessionTagsEditor(props: ConsultationSessionTagsEditorProps) {
  return <SessionTagsEditor profile="consultation" {...props} />;
}
