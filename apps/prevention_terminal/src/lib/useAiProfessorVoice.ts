import { useCallback, useRef, useState, useEffect } from "react";
import { getTerminalEdition } from "./terminal_edition.ts";

const getVoiceScore = (v: SpeechSynthesisVoice) => {
  const name = v.name.toLowerCase();
  let score = 0;
  // Highest bonus for Natural, Online, Neural, Premium cloud voices (sound 100% human and warm)
  if (name.includes("natural") || name.includes("neural") || name.includes("online") || name.includes("premium")) {
    score += 100;
  }
  // High bonus for Google or Apple voices (very clean and smooth)
  if (name.includes("google") || name.includes("yandex") || name.includes("siri") || name.includes("apple") || name.includes("samantha") || name.includes("daniel")) {
    score += 50;
  }
  // Bonus for authoritative / academic names or pleasant male voices for the Professor
  if (name.includes("dmitry") || name.includes("maxim") || name.includes("yuri") || name.includes("pavel") || name.includes("guy") || name.includes("christopher") || name.includes("george") || name.includes("oliver")) {
    score += 30;
  }
  // Penalty for old robotic SAPI desktop voices ("kingdom of the dead")
  if (name.includes("desktop") || name.includes("compact") || name.includes("irina") || name.includes("zira") || name.includes("david") || name.includes("hazel")) {
    score -= 50;
  }
  return score;
};

export function useAiProfessorVoice(onSpeakStateChange?: (speaking: boolean) => void) {
  const [isSupported, setIsSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>(() => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("ai_prof_voice_name") || "";
    }
    return "";
  });
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("ai_prof_voice_muted") === "true";
    }
    return false;
  });

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
      setIsSupported(true);

      const updateVoices = () => {
        if (!synthRef.current) return;
        const allVoices = synthRef.current.getVoices();
        const langCode = getTerminalEdition() === "intl" ? "en" : "ru";
        // Filter voices that match current language prefix (e.g. 'ru' or 'en')
        const filtered = allVoices.filter((v) => v.lang.toLowerCase().startsWith(langCode));
        // Sort by quality score so best natural voices appear first in UI selector
        filtered.sort((a, b) => getVoiceScore(b) - getVoiceScore(a));
        setAvailableVoices(filtered);
      };

      updateVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }, []);

  const stop = useCallback(() => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    onSpeakStateChange?.(false);
  }, [onSpeakStateChange]);

  const selectVoice = useCallback((name: string) => {
    setSelectedVoiceName(name);
    if (typeof localStorage !== "undefined") {
      if (name) {
        localStorage.setItem("ai_prof_voice_name", name);
      } else {
        localStorage.removeItem("ai_prof_voice_name");
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("ai_prof_voice_muted", String(next));
      }
      if (next && synthRef.current) {
        synthRef.current.cancel();
        onSpeakStateChange?.(false);
      }
      return next;
    });
  }, [onSpeakStateChange]);

  const speak = useCallback(
    (text: string, lang = getTerminalEdition() === "intl" ? "en-US" : "ru-RU") => {
      if (!synthRef.current || !isSupported || isMuted) return;

      // Cancel current speech before starting new
      synthRef.current.cancel();

      // Simple clean-up of markdown symbols before speaking
      const cleanText = text
        .replace(/[*_#`~]/g, "")
        .replace(/\[.*?\]\(.*?\)/g, "")
        .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utteranceRef.current = utterance;
      utterance.lang = lang;

      // Find suitable voice for the selected language
      const allVoices = synthRef.current.getVoices();
      const langPrefix = lang.split("-")[0].toLowerCase();
      const matchingVoices = allVoices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));

      if (matchingVoices.length > 0) {
        let chosenVoice: SpeechSynthesisVoice | undefined;

        // 1. Check if user selected a custom voice
        if (selectedVoiceName) {
          chosenVoice = matchingVoices.find((v) => v.name === selectedVoiceName) || allVoices.find((v) => v.name === selectedVoiceName);
        }

        // 2. Otherwise, pick the highest scoring natural/neural voice
        if (!chosenVoice) {
          matchingVoices.sort((a, b) => getVoiceScore(b) - getVoiceScore(a));
          chosenVoice = matchingVoices[0];
        }

        if (chosenVoice) {
          utterance.voice = chosenVoice;
        }
      }

      utterance.onstart = () => {
        onSpeakStateChange?.(true);
      };

      utterance.onend = () => {
        onSpeakStateChange?.(false);
      };

      utterance.onerror = () => {
        onSpeakStateChange?.(false);
      };

      synthRef.current.speak(utterance);
    },
    [isSupported, onSpeakStateChange, selectedVoiceName]
  );

  return {
    isSupported,
    speak,
    stop,
    voices: availableVoices,
    selectedVoiceName,
    selectVoice,
    isMuted,
    toggleMute,
  };
}
