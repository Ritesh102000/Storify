"use client";

import { useEffect, useRef, useState } from "react";
import {
  audioExtension,
  chooseRecorderMimeType,
} from "@/lib/forge/audio";

const MAX_RECORDING_MS = 60_000;

/**
 * Records from the mic and sends the clip to gpt-4o-transcribe. The result is
 * always dropped into the field as editable text — it never auto-advances, and
 * it never overwrites what the user already typed without appending.
 */
export function MicButton({
  onText,
  disabled,
}: {
  onText: (text: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<"idle" | "recording" | "working">("idle");
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearStopTimer();
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      stopTracks();
    };
  }, []);

  async function start() {
    setError("");
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError(
        window.isSecureContext
          ? "This browser cannot record audio."
          : "Open the app through HTTPS or localhost to use the microphone.",
      );
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;
      const preferredMime = chooseRecorderMimeType(
        typeof MediaRecorder.isTypeSupported === "function"
          ? MediaRecorder.isTypeSupported.bind(MediaRecorder)
          : undefined,
      );
      let recorder: MediaRecorder;
      try {
        recorder = preferredMime
          ? new MediaRecorder(stream, { mimeType: preferredMime })
          : new MediaRecorder(stream);
      } catch {
        // Some Safari versions report a codec as supported but reject it when
        // recording starts. Let the browser choose its native container.
        recorder = new MediaRecorder(stream);
      }
      chunksRef.current = [];
      let recorderFailed = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        recorderFailed = true;
        clearStopTimer();
        stopTracks();
        recorderRef.current = null;
        if (mountedRef.current) {
          setError("The browser stopped the recording. Try the microphone again.");
          setState("idle");
        }
      };
      recorder.onstop = () => {
        clearStopTimer();
        stopTracks();
        recorderRef.current = null;
        if (recorderFailed || !mountedRef.current) return;
        void uploadRecording(recorder, preferredMime);
      };
      recorder.start(500);
      recorderRef.current = recorder;
      stopTimerRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") stop();
      }, MAX_RECORDING_MS);
      setState("recording");
    } catch (reason) {
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError(microphoneError(reason));
      setState("idle");
    }
  }

  async function uploadRecording(
    recorder: MediaRecorder,
    preferredMime?: string,
  ) {
    setState("working");
    try {
      const recordedMime =
        recorder.mimeType ||
        chunksRef.current.find((chunk) => chunk.type)?.type ||
        preferredMime ||
        "audio/webm";
      const blob = new Blob(chunksRef.current, { type: recordedMime });
      chunksRef.current = [];
      if (!blob.size) {
        throw new Error("No audio was captured. Record for a moment, then stop.");
      }

      const form = new FormData();
      form.append(
        "audio",
        blob,
        `clip.${audioExtension(recordedMime)}`,
      );
      const response = await fetch("/api/forge/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await response.json().catch(() => ({}))) as {
        text?: string;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(data.error?.message ?? "Transcription failed.");
      }
      const text = data.text?.trim();
      if (!text) {
        throw new Error("No speech was detected. Try again and speak a little longer.");
      }
      onText(text);
    } catch (reason) {
      if (mountedRef.current) {
        setError(
          reason instanceof Error ? reason.message : "Could not transcribe.",
        );
      }
    } finally {
      if (mountedRef.current) setState("idle");
    }
  }

  function stop() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    clearStopTimer();
    setState("working");
    try {
      recorder.stop();
    } catch {
      stopTracks();
      recorderRef.current = null;
      setState("idle");
      setError("The recording could not be completed. Please try again.");
    }
  }

  function clearStopTimer() {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function microphoneError(reason: unknown): string {
    if (reason instanceof DOMException) {
      if (reason.name === "NotAllowedError" || reason.name === "SecurityError") {
        return "Microphone permission is blocked. Allow it in your browser settings and try again.";
      }
      if (reason.name === "NotFoundError") {
        return "No microphone was found on this device.";
      }
      if (reason.name === "NotReadableError") {
        return "The microphone is busy in another app. Close it there and try again.";
      }
    }
    return "The microphone could not start. Check browser permission and try again.";
  }

  return (
    <span className="forge-mic-wrap">
      <button
        type="button"
        className={`forge-mic ${state === "recording" ? "is-recording" : ""}`}
        onClick={state === "recording" ? stop : start}
        disabled={disabled || state === "working"}
        aria-label={state === "recording" ? "Stop recording" : "Speak your answer"}
        title={state === "recording" ? "Stop recording" : "Speak your answer"}
      >
        {state === "working" ? "…" : state === "recording" ? "■" : "🎤"}
      </button>
      {state !== "idle" ? (
        <span className="forge-mic-status" aria-live="polite">
          {state === "recording" ? "Recording — tap to stop" : "Transcribing…"}
        </span>
      ) : null}
      {error ? (
        <span className="forge-mic-error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
