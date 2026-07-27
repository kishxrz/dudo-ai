'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type VoiceRecorderState = 'idle' | 'recording' | 'processing' | 'error';

export interface VoiceRecorderResult {
  state: VoiceRecorderState;
  recordingSeconds: number;
  errorMessage: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
}

interface UseVoiceRecorderOptions {
  onTranscript: (transcript: string, detectedLanguage: string) => void;
  onError: (message: string) => void;
  apiKey: string;
  provider?: string;
  workspaceId?: string;
  maxDurationSeconds?: number;
}

/**
 * Production voice recorder hook.
 *
 * - Uses MediaRecorder API (webm/opus preferred, wav fallback)
 * - Push-to-talk: startRecording() / stopRecording()
 * - Auto-cancels after maxDurationSeconds (default 120s)
 * - Uploads to /api/voice/stt on stop
 * - Calls onTranscript with the detected text + language
 */
export function useVoiceRecorder({
  onTranscript,
  onError,
  apiKey,
  provider = 'openai',
  workspaceId,
  maxDurationSeconds = 120,
}: UseVoiceRecorderOptions): VoiceRecorderResult {
  const [state, setState] = useState<VoiceRecorderState>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const maxTimerRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setRecordingSeconds(0);
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    if (state !== 'idle') return;

    setErrorMessage(null);

    // Check browser support
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const msg = 'Voice recording is not supported in this browser.';
      setErrorMessage(msg);
      onError(msg);
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      let msg = 'Microphone access denied.';
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No microphone found. Please connect a microphone and try again.';
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Microphone permission denied. Please allow microphone access in your browser settings.';
      }
      setErrorMessage(msg);
      setState('error');
      onError(msg);
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    // Pick best supported MIME type
    const mimeType = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ].find((t) => MediaRecorder.isTypeSupported(t)) || '';

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      recorder = new MediaRecorder(stream);
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = async () => {
      cleanup();

      if (chunksRef.current.length === 0) {
        const msg = 'No audio captured. Please try again.';
        setErrorMessage(msg);
        setState('error');
        onError(msg);
        return;
      }

      const audioBlob = new Blob(chunksRef.current, {
        type: mimeType || 'audio/webm',
      });

      // Reject very short recordings (< 0.5s ≈ ~8KB)
      if (audioBlob.size < 1000) {
        const msg = 'Recording too short. Please speak clearly and try again.';
        setErrorMessage(msg);
        setState('error');
        onError(msg);
        return;
      }

      setState('processing');

      try {
        const fd = new FormData();
        const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
        fd.append('audio', audioBlob, `recording.${ext}`);
        fd.append('apiKey', apiKey);
        fd.append('provider', provider);
        if (workspaceId) {
          fd.append('workspaceId', workspaceId);
        }

        const res = await fetch('/api/voice/stt', {
          method: 'POST',
          body: fd,
          signal: AbortSignal.timeout(25000),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'STT request failed.' }));
          throw new Error(errData.error || 'Speech-to-text failed.');
        }

        const data = await res.json();

        if (!data.transcript?.trim()) {
          throw new Error('Could not understand the audio. Please speak clearly and try again.');
        }

        setState('idle');
        onTranscript(data.transcript.trim(), data.language || 'en');
      } catch (err: any) {
        const msg = err.name === 'AbortError'
          ? 'Speech-to-text timed out. Please try again.'
          : err.message || 'Speech-to-text failed.';
        setErrorMessage(msg);
        setState('error');
        onError(msg);
      }
    };

    recorder.onerror = (e: any) => {
      const msg = 'Recording failed. Please try again.';
      setErrorMessage(msg);
      setState('error');
      onError(msg);
      cleanup();
    };

    mediaRecorderRef.current = recorder;
    recorder.start(250); // collect in 250ms chunks
    setState('recording');

    // Recording timer
    timerRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);

    // Auto-stop at maxDurationSeconds
    maxTimerRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
        setState('processing');
      }
    }, maxDurationSeconds * 1000);
  }, [state, apiKey, provider, workspaceId, onTranscript, onError, cleanup, maxDurationSeconds]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      // Override onstop to do nothing (discard audio)
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanup();
    setState('idle');
    setErrorMessage(null);
  }, [cleanup]);

  return {
    state,
    recordingSeconds,
    errorMessage,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
