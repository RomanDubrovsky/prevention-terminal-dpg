import { useSpeechDictation } from "../lib/use_speech_dictation.ts";
import { t } from "../lib/i18n.ts";

interface SpeechDictationButtonProps {
  onText: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function SpeechDictationButton(props: SpeechDictationButtonProps) {
  const { onText, disabled = false, className = "ob-btn secondary" } = props;
  const { listening, error, start, stop, supported, isProcessing } = useSpeechDictation(onText);

  if (!supported) return null;

  return (
    <span className="speech-dictation-wrap">
      <button
        type="button"
        className={className}
        disabled={disabled || isProcessing}
        onClick={() => {
          if (listening) stop();
          else start();
        }}
        aria-pressed={listening}
      >
        {isProcessing ? t("Обработка...", "Processing...") : listening ? t("Остановить", "Stop") : t("Надиктовать", "Dictate")}
      </button>
      {error && <span className="muted tiny">{error}</span>}
    </span>
  );
}
