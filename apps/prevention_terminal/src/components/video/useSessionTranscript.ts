import { useState, useEffect, useCallback, useRef } from 'react';

export interface TranscriptTurn {
  role: "specialist" | "client" | "unknown";
  text: string;
  ts: number;
}

export function useSessionTranscript() {
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const accumulatedRef = useRef<TranscriptTurn[]>([]);

  const stopTranscription = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
  }, []);

  const startTranscription = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Web Speech API не поддерживается вашим браузером.');
      return;
    }
    if (isListeningRef.current) return;

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'ru-RU';

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        if (!event.results || !event.results[current]) return;
        const transcriptText = event.results[current][0].transcript;
        
        const newTurn: TranscriptTurn = {
          role: "specialist",
          text: transcriptText.trim(),
          ts: Date.now()
        };
        
        if (newTurn.text.length > 0) {
          accumulatedRef.current = [...accumulatedRef.current, newTurn];
          setTranscript([...accumulatedRef.current]);
        }
      };

      recognition.onerror = (event: any) => {
        const errType = event.error;
        if (errType === 'no-speech' || errType === 'aborted') {
          // Normal lifecycle events, ignore
          return;
        }
        if (errType === 'not-allowed' || errType === 'service-not-allowed') {
          isListeningRef.current = false;
          setIsListening(false);
          setError('Доступ к микрофону заблокирован в настройках браузера.');
          return;
        }
        console.warn('Speech recognition notice:', errType);
        setError(`Распознавание: ${errType}`);
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          try {
            recognition.start();
          } catch (_) {
            isListeningRef.current = false;
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      isListeningRef.current = false;
      setIsListening(false);
      setError(e.message || 'Ошибка запуска транскрипции');
    }
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript([]);
    accumulatedRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
    };
  }, []);

  return {
    transcript,
    isListening,
    error,
    startTranscription,
    stopTranscription,
    clearTranscript,
    rawTranscriptText: transcript.map(t => `${t.role === 'specialist' ? 'Психолог' : 'Клиент'}: ${t.text}`).join('\n')
  };
}

