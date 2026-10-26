import { useCallback, useEffect, useRef, useState } from "react";

export function speechDictationSupported(): boolean {
  return typeof window !== "undefined" && !!navigator.mediaDevices && typeof window.MediaRecorder !== "undefined";
}

export function useSpeechDictation(onText: (text: string) => void, lang = "ru-RU") {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const workerRef = useRef<Worker | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const ensureWorker = useCallback(() => {
    if (!workerRef.current) {
      const worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
      worker.postMessage({ type: "load" });
      worker.onmessage = (e) => {
        if (e.data.type === "result") {
          onText(e.data.text);
          setIsProcessing(false);
        } else if (e.data.type === "error") {
          setError(e.data.error || "Ошибка распознавания (Whisper).");
          setIsProcessing(false);
        }
      };
      workerRef.current = worker;
    }
    return workerRef.current;
  }, [onText]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setListening(false);
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      stop();
    };
  }, [stop]);

  const start = useCallback(async () => {
    if (listening) {
      stop();
      return;
    }
    setError(null);
    audioChunksRef.current = [];
    
    try {
      ensureWorker();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const arrayBuffer = await blob.arrayBuffer();
        
        try {
          const audioContext = new AudioContext({ sampleRate: 16000 });
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const offlineContext = new OfflineAudioContext(1, audioBuffer.length, 16000);
          const source = offlineContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(offlineContext.destination);
          source.start();
          const renderedBuffer = await offlineContext.startRendering();
          const float32Array = renderedBuffer.getChannelData(0);
          
          const worker = ensureWorker();
          worker.postMessage({ type: "transcribe", audio: float32Array });
        } catch (err) {
          setError("Ошибка обработки аудио.");
          setIsProcessing(false);
        }
      };
      
      mediaRecorder.start();
      setListening(true);
    } catch (err) {
      setError("Не удалось получить доступ к микрофону.");
      setListening(false);
    }
  }, [ensureWorker, listening, stop]);

  return { listening, error, start, stop, supported: speechDictationSupported(), isProcessing };
}
