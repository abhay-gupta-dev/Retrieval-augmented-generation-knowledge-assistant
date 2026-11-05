import { useEffect, useRef, useState } from "react";
import { AudioLines, Mic } from "lucide-react";

type RecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type RecognitionEvent = {
  results: ArrayLike<RecognitionResult>;
};

type RecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onnomatch: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

type RecognitionConstructor = new () => RecognitionInstance;

type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

type VoiceInputButtonProps = {
  disabled?: boolean;
  onTranscript: (transcript: string) => void;
};

let activeUtterance: SpeechSynthesisUtterance | null = null;

export function VoiceInputButton({ disabled = false, onTranscript }: Readonly<VoiceInputButtonProps>) {
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const transcriptRef = useRef("");
  const [state, setState] = useState<"idle" | "listening" | "stopped" | "error">("idle");
  const [message, setMessage] = useState("");
  const recognitionConstructor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
  const Recognition = recognitionConstructor;

  useEffect(() => () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  if (!Recognition) {
    return <output className="hidden self-center text-xs text-slate-500 sm:block">Voice input unavailable</output>;
  }

  function toggleListening() {
    if (state === "listening") {
      recognitionRef.current?.stop();
      return;
    }
    if (!Recognition) return;

    recognitionRef.current?.stop();
    const recognition = new Recognition();
    transcriptRef.current = "";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const results = Array.from({ length: event.results.length }, (_, index) => event.results[index][0].transcript);
      transcriptRef.current = results.join(" ").trim();
    };
    recognition.onerror = (event) => {
      setState("error");
      const messages: Record<string, string> = {
        "audio-capture": "No microphone was found or it is already in use.",
        "network": "Speech recognition needs a network connection.",
        "not-allowed": "Microphone permission was denied.",
        "no-speech": "No speech detected. Try again.",
        "service-not-allowed": "Speech recognition is not allowed in this browser.",
      };
      setMessage(messages[event.error ?? ""] ?? "Speech recognition failed. Try again.");
    };
    recognition.onnomatch = () => {
      setState("error");
      setMessage("No speech detected. Try again.");
    };
    recognition.onend = () => {
      const transcript = transcriptRef.current.trim();
      if (transcript) {
        onTranscript(transcript);
      }
      setState((current) => current === "error" ? current : "stopped");
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setMessage("");
    setState("listening");
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setState("error");
      setMessage("Could not start the microphone. Try again.");
    }
  }

  return <span className="inline-flex items-center gap-2">
    <button type="button" onClick={toggleListening} disabled={disabled} aria-label={state === "listening" ? "Stop listening" : "Start voice input"} title={state === "listening" ? "Stop listening" : "Start voice input"} className={`grid size-10 place-items-center rounded-full transition disabled:opacity-50 sm:size-12 ${state === "listening" ? "bg-rose-600 text-white shadow-md shadow-rose-900/20" : "bg-[#163a32] text-white hover:bg-[#1d4b40]"}`}>
      {state === "listening" ? <AudioLines className="size-5 animate-pulse" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
    </button>
    {message && <output className="text-xs text-rose-600">{message}</output>}
  </span>;
}

type VoiceSpeakerButtonProps = {
  text: string;
};

export function VoiceSpeakerButton({ text }: Readonly<VoiceSpeakerButtonProps>) {
  const [state, setState] = useState<"idle" | "speaking" | "stopped">("idle");
  const supported = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

  useEffect(() => () => {
    if (activeUtterance) {
      window.speechSynthesis?.cancel();
      activeUtterance = null;
    }
  }, []);

  if (!supported) return null;

  function toggleSpeech() {
    if (state === "speaking") {
      window.speechSynthesis.cancel();
      activeUtterance = null;
      setState("stopped");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => {
      if (activeUtterance === utterance) activeUtterance = null;
      setState("stopped");
    };
    utterance.onerror = () => {
      if (activeUtterance === utterance) activeUtterance = null;
      setState("stopped");
    };
    window.speechSynthesis.cancel();
    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    setState("speaking");
  }

  return <button type="button" onClick={toggleSpeech} aria-label={state === "speaking" ? "Stop speaking" : "Read answer aloud"} title={state === "speaking" ? "Stop speaking" : "Read answer aloud"} className="mt-3 rounded-lg p-1 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700">
    <span aria-hidden="true">{state === "speaking" ? "■" : "🔊"}</span>
  </button>;
}
