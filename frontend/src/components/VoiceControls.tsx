import { useEffect, useRef, useState } from "react";

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
    return <output className="self-center text-xs text-slate-500">Voice input unavailable</output>;
  }

  function toggleListening() {
    if (state === "listening") {
      recognitionRef.current?.stop();
      return;
    }
    if (!Recognition) return;

    recognitionRef.current?.stop();
    const recognition = new Recognition();
    console.debug("[voice] recognition created", { constructor: Recognition.name });
    transcriptRef.current = "";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      console.debug("[voice] recognition onstart", { lang: recognition.lang, interimResults: recognition.interimResults });
    };
    recognition.onresult = (event) => {
      const results = Array.from({ length: event.results.length }, (_, index) => event.results[index][0].transcript);
      transcriptRef.current = results.join(" ").trim();
      console.debug("[voice] recognition onresult", { resultCount: event.results.length, transcript: transcriptRef.current });
    };
    recognition.onerror = (event) => {
      console.debug("[voice] recognition onerror", { error: event.error });
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
      console.debug("[voice] recognition onend", { transcript });
      if (transcript) {
        console.debug("[voice] transcript received", { transcript });
        onTranscript(transcript);
      }
      setState((current) => current === "error" ? current : "stopped");
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setMessage("");
    setState("listening");
    try {
      console.debug("[voice] recognition.start()", { lang: recognition.lang });
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setState("error");
      setMessage("Could not start the microphone. Try again.");
    }
  }

  return <span className="inline-flex items-center gap-2">
    <button type="button" onClick={toggleListening} disabled={disabled} aria-label={state === "listening" ? "Stop listening" : "Start voice input"} title={state === "listening" ? "Stop listening" : "Start voice input"} className="rounded-lg border p-3 text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
      <span aria-hidden="true">{state === "listening" ? "■" : "◉"}</span>
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
