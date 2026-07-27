'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type AudioPlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface AudioPlayerResult {
  playerState: AudioPlayerState;
  progress: number; // 0–1
  duration: number; // seconds
  currentTime: number; // seconds
  isMuted: boolean;
  synthesizeAndPlay: (
    text: string,
    apiKey: string,
    voice?: string,
    provider?: string,
    workspaceId?: string
  ) => Promise<void>;
  togglePlay: () => void;
  stop: () => void;
  toggleMute: () => void;
  replay: () => void;
}

/**
 * Production audio player hook.
 *
 * - Calls /api/voice/tts to synthesize speech
 * - Creates an object URL from the returned MP3 binary
 * - Plays via HTML Audio element
 * - Exposes playback controls: play/pause, stop, mute, replay, progress
 */
export function useAudioPlayer(): AudioPlayerResult {
  const [playerState, setPlayerState] = useState<AudioPlayerState>('idle');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const stopProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startProgressTimer = useCallback(() => {
    stopProgressTimer();
    progressTimerRef.current = setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;
      setCurrentTime(audio.currentTime);
      if (audio.duration > 0) {
        setProgress(audio.currentTime / audio.duration);
      }
    }, 100);
  }, [stopProgressTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopProgressTimer();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      clearObjectUrl();
    };
  }, [stopProgressTimer, clearObjectUrl]);

  const synthesizeAndPlay = useCallback(
    async (text: string, apiKey: string, voice = 'nova', provider = 'openai', workspaceId?: string) => {
      if (!text?.trim() || !apiKey) return;

      // Stop any existing playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      clearObjectUrl();
      stopProgressTimer();
      setPlayerState('loading');
      setProgress(0);
      setCurrentTime(0);
      setDuration(0);

      try {
        const res = await fetch('/api/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, apiKey, voice, provider, workspaceId }),
          signal: AbortSignal.timeout(20000),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'TTS failed.' }));
          throw new Error(err.error || 'Text-to-speech failed.');
        }

        const contentType = res.headers.get('Content-Type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (data.fallback) {
            console.warn(`[AudioPlayer] TTS Fallback: ${data.message}`);
            // Gracefully complete without playing audio
            setPlayerState('idle');
            return;
          }
        }

        const audioBuffer = await res.arrayBuffer();
        const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;

        const audio = new Audio(url);
        audio.muted = isMuted;
        audioRef.current = audio;

        audio.addEventListener('loadedmetadata', () => {
          setDuration(audio.duration);
        });

        audio.addEventListener('ended', () => {
          setPlayerState('idle');
          setProgress(1);
          stopProgressTimer();
        });

        audio.addEventListener('error', () => {
          setPlayerState('error');
          stopProgressTimer();
        });

        audio.addEventListener('pause', () => {
          if (audio.ended) return;
          setPlayerState('paused');
          stopProgressTimer();
        });

        audio.addEventListener('play', () => {
          setPlayerState('playing');
          startProgressTimer();
        });

        await audio.play();
      } catch (err: any) {
        console.error('[AudioPlayer] TTS error:', err);
        setPlayerState('error');
        stopProgressTimer();
      }
    },
    [isMuted, clearObjectUrl, stopProgressTimer, startProgressTimer]
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    stopProgressTimer();
    setPlayerState('idle');
    setProgress(0);
    setCurrentTime(0);
  }, [stopProgressTimer]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);

  const replay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play();
  }, []);

  return {
    playerState,
    progress,
    duration,
    currentTime,
    isMuted,
    synthesizeAndPlay,
    togglePlay,
    stop,
    toggleMute,
    replay,
  };
}
