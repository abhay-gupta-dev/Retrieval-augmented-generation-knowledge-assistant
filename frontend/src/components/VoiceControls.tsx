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
  const segmentRef = useRef("");
  const shouldListenRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const [state, setState] = useState<"idle" | "listening" | "error">("idle");
  const [message, setMessage] = useState("");
  const recognitionConstructor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
  const Recognition = recognitionConstructor;

  useEffect(() => () => {
    shouldListenRef.current = false;
    if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  if (!Recognition) {
    return <output className="hidden self-center text-xs text-slate-500 sm:block">Voice input unavailable</output>;
  }

  function startRecognition() {
    if (!Recognition || !shouldListenRef.current) return;
    const recognition = new Recognition();
    segmentRef.current = "";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const results = Array.from({ length: event.results.length }, (_, index) => event.results[index][0].transcript);
      segmentRef.current = results.join(" ").trim();
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      shouldListenRef.current = false;
      setState("error");
      const messages: Record<string, string> = {
        "audio-capture": "No microphone was found or it is already in use.",
        "network": "Speech recognition needs a network connection.",
        "not-allowed": "Microphone permission was denied.",
        "service-not-allowed": "Speech recognition is not allowed in this browser.",
      };
      setMessage(messages[event.error ?? ""] ?? "Speech recognition failed. Try again.");
    };
    recognition.onnomatch = () => {};
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      const transcript = segmentRef.current.trim();
      segmentRef.current = "";
      if (transcript) {
        shouldListenRef.current = false;
        transcriptRef.current = "";
        onTranscript(transcript);
        setState("idle");
        return;
      }
      if (shouldListenRef.current) {
        restartTimerRef.current = window.setTimeout(startRecognition, 250);
        return;
      }
      transcriptRef.current = "";
      setState((current) => current === "error" ? current : "idle");
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      shouldListenRef.current = false;
      setState("error");
      setMessage("Could not start the microphone. Try again.");
    }
  }

  function toggleListening() {
    if (state === "listening") {
      shouldListenRef.current = false;
      if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      } else {
        const transcript = [transcriptRef.current, segmentRef.current].filter(Boolean).join(" ").trim();
        if (transcript) onTranscript(transcript);
        transcriptRef.current = "";
        segmentRef.current = "";
        setState("idle");
      }
      return;
    }
    if (!Recognition) return;
    transcriptRef.current = "";
    segmentRef.current = "";
    shouldListenRef.current = true;
    setMessage("");
    setState("listening");
    startRecognition();
  }

  return <span className="inline-flex items-center gap-2">
    <button type="button" onClick={toggleListening} disabled={disabled} aria-label={state === "listening" ? "Stop listening" : "Start voice input"} title={state === "listening" ? "Stop listening" : "Start voice input"} className={`grid size-10 place-items-center rounded-full transition disabled:opacity-50 sm:size-12 ${state === "listening" ? "bg-rose-600 text-white shadow-md shadow-rose-900/20" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
      {state === "listening" ? <AudioLines className="size-5" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
    </button>
    {state === "listening" && <span role="status" aria-label="Listening" className="inline-flex h-8 items-center gap-0.5 px-1">
      {[10, 18, 12, 22, 14, 8].map((height, index) => <span key={`${height}-${index}`} className="w-1 animate-pulse rounded-full bg-teal-600 dark:bg-teal-300" style={{ height, animationDelay: `${index * 90}ms` }} />)}
    </span>}
    {message && <output className="max-w-28 truncate text-[10px] leading-tight text-rose-600" title={message}>{message}</output>}
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

  return <button type="button" onClick={toggleSpeech} aria-label={state === "speaking" ? "Stop speaking" : "Read answer aloud"} title={state === "speaking" ? "Stop speaking" : "Read answer aloud"} className="inline-grid place-items-center rounded-lg p-0 text-slate-500 dark:text-slate-400">
    <span aria-hidden="true">{state === "speaking" ? "■" : "🔊"}</span>
  </button>;
}
