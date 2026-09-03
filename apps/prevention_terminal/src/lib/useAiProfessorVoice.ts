import { useCallback, useRef, useState, useEffect } from "react";
import { getTerminalEdition } from "./terminal_edition.ts";
import { platformApiBase } from "./platform_api.ts";

function getVoiceScore(v: SpeechSynthesisVoice): number {
  let score = 0;
  const name = v.name.toLowerCase();
  if (name.includes("natural") || name.includes("neural") || name.includes("online")) score += 10;
  if (name.includes("google") || name.includes("microsoft") || name.includes("apple") || name.includes("yandex")) score += 5;
  if (v.default) score += 1;
  return score;
}

export function useAiProfessorVoice(onSpeakStateChange?: (speaking: boolean) => void) {
  const [isSupported, setIsSupported] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("ai_prof_voice_muted") === "true";
    }
    return false;
  });

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);
  const lastTextRef = useRef<{ text: string; lang: string } | null>(null);
  const currentModeRef = useRef<"server" | "native" | null>(null);
  const serverUnavailableRef = useRef<boolean>(false);
  const speechQueueRef = useRef<string[]>([]);
  const queueIndexRef = useRef<number>(0);
  const isCancelledRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.speechSynthesis) {
        synthRef.current = window.speechSynthesis;
      }
      setIsSupported(true);
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    isCancelledRef.current = true;
    speechQueueRef.current = [];
    queueIndexRef.current = 0;
    cleanupAudio();
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    currentModeRef.current = null;
    setIsPlaying(false);
    setIsPaused(false);
    onSpeakStateChange?.(false);
  }, [cleanupAudio, onSpeakStateChange]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("ai_prof_voice_muted", String(next));
      }
      if (next) {
        stop();
      }
      return next;
    });
  }, [stop]);

  const speakNextInQueue = useCallback((lang: string) => {
    if (!synthRef.current || isCancelledRef.current) {
      setIsPlaying(false);
      setIsPaused(false);
      onSpeakStateChange?.(false);
      return;
    }

    if (queueIndexRef.current >= speechQueueRef.current.length) {
      setIsPlaying(false);
      setIsPaused(false);
      currentModeRef.current = null;
      onSpeakStateChange?.(false);
      return;
    }

    const chunk = speechQueueRef.current[queueIndexRef.current];
    const utterance = new SpeechSynthesisUtterance(chunk);
    utteranceRef.current = utterance;
    utterance.lang = lang;

    const allVoices = synthRef.current.getVoices();
    const langPrefix = lang.split("-")[0].toLowerCase();
    const matchingVoices = allVoices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));

    if (matchingVoices.length > 0) {
      matchingVoices.sort((a, b) => getVoiceScore(b) - getVoiceScore(a));
      utterance.voice = matchingVoices[0];
    }

    utterance.onstart = () => {
      if (!isCancelledRef.current) {
        setIsPlaying(true);
        setIsPaused(false);
        onSpeakStateChange?.(true);
      }
    };
    utterance.onpause = () => {
      setIsPlaying(false);
      setIsPaused(true);
      onSpeakStateChange?.(false);
    };
    utterance.onresume = () => {
      setIsPlaying(true);
      setIsPaused(false);
      onSpeakStateChange?.(true);
    };
    utterance.onend = () => {
      if (!isCancelledRef.current) {
        queueIndexRef.current += 1;
        speakNextInQueue(lang);
      }
    };
    utterance.onerror = (e) => {
      if (e.error !== "canceled" && !isCancelledRef.current) {
        queueIndexRef.current += 1;
        speakNextInQueue(lang);
      } else {
        setIsPlaying(false);
        setIsPaused(false);
        currentModeRef.current = null;
        onSpeakStateChange?.(false);
      }
    };

    synthRef.current.speak(utterance);
  }, [onSpeakStateChange]);

  const playNativeSpeech = useCallback(
    (cleanText: string, lang: string) => {
      if (!synthRef.current) {
        setIsPlaying(false);
        setIsPaused(false);
        onSpeakStateChange?.(false);
        return;
      }
      isCancelledRef.current = false;
      synthRef.current.cancel();

      // Split text into natural sentence chunks (up to ~180 chars) to prevent browser speech synthesis timeouts
      const sentences = cleanText
        .split(/(?<=[.!?…\n])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      speechQueueRef.current = sentences.length > 0 ? sentences : [cleanText];
      queueIndexRef.current = 0;
      currentModeRef.current = "native";

      speakNextInQueue(lang);
    },
    [onSpeakStateChange, speakNextInQueue]
  );

  const speak = useCallback(
    async (text: string, lang = getTerminalEdition() === "intl" ? "en-US" : "ru-RU") => {
      if (!isSupported || isMuted) return;

      stop();
      isCancelledRef.current = false;

      const cleanText = text
        .replace(/[*_#`~]/g, "")
        .replace(/\[.*?\]\(.*?\)/g, "")
        .replace(/<[^>]+>/g, " ")
        .trim();

      if (!cleanText) return;
      lastTextRef.current = { text: cleanText, lang };

      // Try server-side Author Voice first if not marked unavailable
      if (!serverUnavailableRef.current) {
        try {
          const url = `${platformApiBase()}/api/tts/voice-clone?text=${encodeURIComponent(cleanText)}&lang=${lang.split("-")[0]}`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          
          const resp = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
          }

          const blob = await resp.blob();
          if (blob.size < 200) {
            throw new Error("Audio too short / empty");
          }

          if (isCancelledRef.current) return;

          const blobUrl = URL.createObjectURL(blob);
          currentBlobUrlRef.current = blobUrl;
          const audio = new Audio(blobUrl);
          audioRef.current = audio;
          currentModeRef.current = "server";

          audio.onplay = () => {
            setIsPlaying(true);
            setIsPaused(false);
            onSpeakStateChange?.(true);
          };
          audio.onpause = () => {
            if (!audio.ended) {
              setIsPlaying(false);
              setIsPaused(true);
              onSpeakStateChange?.(false);
            }
          };
          audio.onended = () => {
            setIsPlaying(false);
            setIsPaused(false);
            currentModeRef.current = null;
            onSpeakStateChange?.(false);
          };
          audio.onerror = () => {
            serverUnavailableRef.current = true;
            playNativeSpeech(cleanText, lang);
          };

          await audio.play();
          return;
        } catch (err) {
          serverUnavailableRef.current = true;
          // Fall through to native speech without blocking
        }
      }

      if (isCancelledRef.current) return;
      playNativeSpeech(cleanText, lang);
    },
    [isSupported, isMuted, stop, playNativeSpeech, onSpeakStateChange]
  );

  const togglePause = useCallback(() => {
    if (isPlaying) {
      // Pause
      if (currentModeRef.current === "server" && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      } else if (currentModeRef.current === "native" && synthRef.current) {
        synthRef.current.pause();
      }
      setIsPlaying(false);
      setIsPaused(true);
      onSpeakStateChange?.(false);
    } else if (isPaused) {
      // Resume
      if (currentModeRef.current === "server" && audioRef.current && audioRef.current.src) {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
          setIsPaused(false);
          onSpeakStateChange?.(true);
        }).catch(() => {});
      } else if (currentModeRef.current === "native" && synthRef.current) {
        if (synthRef.current.paused) {
          synthRef.current.resume();
          setIsPlaying(true);
          setIsPaused(false);
          onSpeakStateChange?.(true);
        } else if (lastTextRef.current) {
          speakNextInQueue(lastTextRef.current.lang);
        }
      }
    } else if (lastTextRef.current) {
      // Idle — replay last spoken message
      speak(lastTextRef.current.text, lastTextRef.current.lang);
    }
  }, [isPlaying, isPaused, speak, speakNextInQueue, onSpeakStateChange]);

  return {
    isSupported,
    isPlaying,
    isPaused,
    speak,
    stop,
    togglePause,
    isMuted,
    toggleMute,
  };
}
