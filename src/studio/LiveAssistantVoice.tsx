import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2 } from "lucide-react";
import { getVoiceStatus, recordingRequest, requestVoice } from "./voiceTransport";
import { useLiveAssistant } from "./liveAssistantState";

export function LiveAssistantVoice({ reply, onMessage }: { reply: string; onMessage: (text: string) => void }) {
  const [available, setAvailable] = useState(false), [state, setState] = useState("idle");
  const cleanup = useRef<() => void>(() => {}), generation = useRef(0);
  useEffect(() => {
    let active = true;
    getVoiceStatus().then(s => { if (active) setAvailable(s.available); }).catch(() => {});
    return () => { active = false; generation.current++; cleanup.current(); };
  }, []);
  const cancel = () => { generation.current++; cleanup.current(); cleanup.current = () => {}; setState("idle"); };
  async function record() {
    cancel(); const id = generation.current;
    setState("permission");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw Error("Microphone recording is unavailable in this browser.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (id !== generation.current) { stream.getTracks().forEach(t => t.stop()); return; }
      const mimeType = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].find(t => MediaRecorder.isTypeSupported(t));
      if (!mimeType) { stream.getTracks().forEach(t => t.stop()); throw Error("No supported microphone audio format."); }
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 });
      const chunks: Blob[] = []; let size = 0;
      const abort = new AbortController();
      const timer = window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 60000);
      let released = false;
      const release = () => { if (released) return; released = true; clearTimeout(timer); stream.getTracks().forEach(t => t.stop()); };
      cleanup.current = () => { recorder.onstop = null; if (recorder.state !== "inactive") recorder.stop(); release(); abort.abort(); };
      recorder.ondataavailable = e => { if (e.data.size) { chunks.push(e.data); size += e.data.size; if (size > 2 * 1024 * 1024 && recorder.state === "recording") recorder.stop(); } };
      recorder.onerror = () => { if (id === generation.current) { cancel(); onMessage("Microphone recording failed. Please try again."); } };
      recorder.onstop = async () => {
        release();
        if (id !== generation.current) return;
        setState("transcribing");
        try {
          const result = await requestVoice(await recordingRequest(new Blob(chunks, { type: mimeType })), abort.signal);
          if (id !== generation.current) return;
          if (!result.transcript?.trim()) { onMessage("No speech was detected. Try again closer to the microphone."); return; }
          const oldDraft = useLiveAssistant.getState().draft;
          const combined = [oldDraft.trim(), result.transcript.trim()].filter(Boolean).join(" ");
          useLiveAssistant.setState({ draft: combined.slice(0, 1500) });
          onMessage(combined.length > 1500 ? "Speech added up to the 1,500-character limit. Review the instructions before sending." : "Speech added to your instructions. Review them before preparing the drawing review.");
        } catch (e) { if (id === generation.current) onMessage(e instanceof Error ? e.message : "Speech transcription failed."); }
        finally { if (id === generation.current) setState("idle"); }
      };
      stopRecording.current = () => { if (recorder.state === "recording") recorder.stop(); };
      recorder.start(500); setState("recording");
    } catch (e) { if (id === generation.current) { cancel(); onMessage(e instanceof Error ? e.message : "Microphone access failed."); } }
  }
  const stopRecording = useRef<() => void>(() => {});
  async function speak() {
    cancel(); const id = generation.current, abort = new AbortController();
    const player = new Audio(); let url: string | undefined;
    cleanup.current = () => { abort.abort(); player.pause(); player.removeAttribute("src"); if (url) URL.revokeObjectURL(url); };
    setState("speaking");
    try {
      const result = await requestVoice({ action: "speak", text: reply.slice(0, 3000) }, abort.signal);
      if (id !== generation.current) return;
      if (!result.audioBase64) throw Error("No speech audio returned.");
      url = URL.createObjectURL(new Blob([Uint8Array.from(atob(result.audioBase64), c => c.charCodeAt(0))], { type: "audio/mpeg" }));
      player.src = url; player.onended = cancel; player.onerror = () => { cancel(); onMessage("Speech audio could not play."); };
      await player.play();
    } catch (e) { if (id === generation.current) { cancel(); onMessage(e instanceof Error ? e.message : "Speech playback failed."); } }
  }
  return <div className="live-assistant-voice" aria-label="Deepgram voice">
    <div>
      {state === "recording" ? <button type="button" onClick={() => stopRecording.current()}><Square size={15} />Stop recording</button>
        : <button type="button" disabled={!available || state !== "idle"} onClick={() => void record()}><Mic size={15} />Speak instructions</button>}
      <button type="button" disabled={!available || state !== "idle" || !reply} onClick={() => void speak()}><Volume2 size={15} />Read aloud</button>
      {state !== "idle" && <button type="button" onClick={cancel}>Cancel voice</button>}
    </div>
    <small role="status">{!available ? "Deepgram voice unavailable" : state === "recording" ? "Recording · stops after 60 seconds" : state === "transcribing" ? "Transcribing speech…" : state === "permission" ? "Waiting for microphone access…" : state === "speaking" ? "Reading assistant message…" : "Deepgram · Recordings go to Deepgram when you stop. Closing cancels."}</small>
  </div>;
}
