'use client';

import { useCallback, useEffect } from 'react';
import { Mic, MicOff, Square, X, Volume2, VolumeX, RotateCcw, Loader2, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';

interface VoiceButtonProps {
  /** The active provider's API key */
  apiKey: string;
  /** Whether the chat is busy (sending a message) */
  disabled?: boolean;
  /** Whether TTS auto-play is enabled */
  ttsEnabled: boolean;
  /** The last AI reply text — triggers auto TTS if changed */
  lastAiReply?: string;
  /**
   * Called when STT completes — pass the transcript to the parent
   * so it can be sent as a chat message
   */
  onTranscript: (transcript: string) => void;
  /** Called when any voice error occurs */
  onError: (message: string) => void;
  /** STT provider */
  sttProvider?: string;
  /** TTS provider */
  ttsProvider?: string;
  /** TTS voice to use */
  ttsVoice?: string;
  /** Workspace ID */
  workspaceId?: string;
}

/**
 * VoiceButton — A self-contained voice UI widget.
 */
export default function VoiceButton({
  apiKey,
  disabled = false,
  ttsEnabled,
  lastAiReply,
  onTranscript,
  onError,
  sttProvider = 'openai',
  ttsProvider = 'openai',
  ttsVoice = 'nova',
  workspaceId,
}: VoiceButtonProps) {
  const {
    state: recState,
    recordingSeconds,
    errorMessage: recError,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecorder({
    apiKey,
    provider: sttProvider,
    workspaceId,
    onTranscript: (transcript, detectedLanguage) => {
      console.log(`[Voice] STT complete — lang: ${detectedLanguage}, text: ${transcript.slice(0, 60)}`);
      onTranscript(transcript);
    },
    onError,
    maxDurationSeconds: 120,
  });

  const {
    playerState,
    progress,
    currentTime,
    duration,
    isMuted,
    synthesizeAndPlay,
    togglePlay,
    stop: stopAudio,
    toggleMute,
    replay,
  } = useAudioPlayer();

  // Auto-play TTS when a new AI reply arrives (if TTS is enabled)
  useEffect(() => {
    if (ttsEnabled && lastAiReply && lastAiReply.trim() && apiKey) {
      const cleanText = lastAiReply
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
        .replace(/[*_`~#]/g, '')
        .trim();
      if (cleanText.length > 0) {
        synthesizeAndPlay(cleanText, apiKey, ttsVoice, ttsProvider, workspaceId);
      }
    }
  }, [lastAiReply]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Recording state UI ──────────────────────────────────────────
  if (recState === 'recording') {
    return (
      <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
        {/* Pulsing indicator */}
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        {/* Timer */}
        <span className="text-[10px] font-mono font-bold text-red-600 min-w-[30px]">
          {formatTime(recordingSeconds)}
        </span>
        {/* Stop */}
        <button
          type="button"
          onClick={stopRecording}
          className="h-6 w-6 rounded-md bg-red-500 hover:bg-red-600 text-white flex items-center justify-center cursor-pointer transition-colors"
          title="Stop recording"
        >
          <Square size={9} strokeWidth={3} />
        </button>
        {/* Cancel */}
        <button
          type="button"
          onClick={cancelRecording}
          className="h-6 w-6 rounded-md bg-zinc-200 hover:bg-zinc-300 text-zinc-600 flex items-center justify-center cursor-pointer transition-colors"
          title="Cancel recording"
        >
          <X size={10} />
        </button>
      </div>
    );
  }

  // ── Processing state UI (STT in flight) ─────────────────────────
  if (recState === 'processing') {
    return (
      <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1">
        <Loader2 size={12} className="text-[#22577A] animate-spin" />
        <span className="text-[10px] text-zinc-500 font-medium">Transcribing…</span>
      </div>
    );
  }

  // ── Error state UI ───────────────────────────────────────────────
  if (recState === 'error' && recError) {
    return (
      <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1 max-w-[220px]">
        <MicOff size={11} className="text-red-500 shrink-0" />
        <span className="text-[10px] text-red-600 font-medium truncate">{recError}</span>
        <button
          type="button"
          onClick={() => startRecording()}
          className="text-[10px] text-[#22577A] font-bold underline cursor-pointer shrink-0"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── TTS Loading ──────────────────────────────────────────────────
  if (playerState === 'loading') {
    return (
      <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1">
        <Loader2 size={12} className="text-[#22577A] animate-spin" />
        <span className="text-[10px] text-zinc-500 font-medium">Generating audio…</span>
      </div>
    );
  }

  // ── TTS Playing / Paused UI ─────────────────────────────────────
  if (playerState === 'playing' || playerState === 'paused') {
    const progressPct = Math.round(progress * 100);

    return (
      <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={togglePlay}
          className="h-6 w-6 rounded-md bg-[#22577A] hover:bg-[#1A4461] text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
          title={playerState === 'playing' ? 'Pause' : 'Play'}
        >
          {playerState === 'playing' ? <Pause size={9} strokeWidth={3} /> : <Play size={9} strokeWidth={3} />}
        </button>

        {/* Progress bar */}
        <div className="flex items-center gap-1">
          <div className="w-16 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#22577A] rounded-full transition-all duration-100"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[9px] font-mono text-zinc-400">
            {formatTime(currentTime)}/{formatTime(duration)}
          </span>
        </div>

        {/* Mute */}
        <button
          type="button"
          onClick={toggleMute}
          className="h-5 w-5 rounded text-zinc-500 hover:text-zinc-800 flex items-center justify-center cursor-pointer transition-colors"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
        </button>

        {/* Replay */}
        <button
          type="button"
          onClick={replay}
          className="h-5 w-5 rounded text-zinc-500 hover:text-zinc-800 flex items-center justify-center cursor-pointer transition-colors"
          title="Replay"
        >
          <RotateCcw size={11} />
        </button>

        {/* Stop */}
        <button
          type="button"
          onClick={stopAudio}
          className="h-5 w-5 rounded text-zinc-500 hover:text-zinc-800 flex items-center justify-center cursor-pointer transition-colors"
          title="Stop"
        >
          <Square size={10} />
        </button>
      </div>
    );
  }

  // ── Idle — Microphone button ─────────────────────────────────────
  return (
    <button
      type="button"
      onClick={() => startRecording()}
      disabled={disabled || !apiKey}
      className={cn(
        'h-8.5 w-8.5 p-0 rounded-lg flex items-center justify-center transition-all duration-200 border shrink-0',
        disabled || !apiKey
          ? 'bg-zinc-100 text-zinc-300 border-zinc-200 cursor-not-allowed'
          : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50 hover:text-[#22577A] hover:border-[#22577A] cursor-pointer'
      )}
      title={!apiKey ? 'Connect an API key to use voice' : 'Click to record voice message'}
    >
      <Mic size={14} />
    </button>
  );
}
