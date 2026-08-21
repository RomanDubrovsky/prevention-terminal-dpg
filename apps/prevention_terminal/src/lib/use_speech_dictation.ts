import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function speechDictationSupported(): boolean {
  return speechRecognitionCtor() !== null;
}

export function useSpeechDictation(onText: (text: string) => void, lang = "ru-RU") {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(() => {
    const Ctor = speechRecognitionCtor();
    if (!Ctor) {
      setError("Голосовой ввод не поддерживается в этом браузере.");
      return;
    }
    if (listening) {
      stop();
      return;
    }
    setError(null);
    try {
      const rec = new Ctor();
      recRef.current = rec;
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = false;
      rec.onstart = () => setListening(true);
      rec.onend = () => {
        setListening(false);
        recRef.current = null;
      };
      rec.onerror = () => {
        setError("Не удалось распознать речь. Проверьте микрофон.");
        setListening(false);
        recRef.current = null;
      };
      rec.onresult = (event) => {
        const text = Array.from(event.results || [])
          .map((result) => result?.[0]?.transcript)
          .filter(Boolean)
          .join(" ")
          .trim();
        if (text) onText(text);
      };
      rec.start();
    } catch {
      setError("Не удалось запустить микрофон.");
      setListening(false);
    }
  }, [lang, listening, onText, stop]);

  return { listening, error, start, stop, supported: speechDictationSupported() };
}
