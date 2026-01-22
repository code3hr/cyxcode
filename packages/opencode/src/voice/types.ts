/**
 * @fileoverview Voice Input Types
 *
 * Type definitions for voice input and speech recognition.
 */

import z from "zod"

export namespace VoiceTypes {
  /** Supported speech-to-text providers */
  export const Provider = z.enum([
    "whisper",      // OpenAI Whisper API
    "whisper-local", // Local Whisper model
    "deepgram",     // Deepgram API
    "google",       // Google Cloud Speech
    "azure",        // Azure Speech Services
    "vosk",         // Vosk (offline)
  ])
  export type Provider = z.infer<typeof Provider>

  /** Voice input status */
  export const Status = z.enum([
    "idle",
    "listening",
    "processing",
    "error",
  ])
  export type Status = z.infer<typeof Status>

  /** Audio format */
  export const AudioFormat = z.enum([
    "wav",
    "mp3",
    "webm",
    "ogg",
    "flac",
  ])
  export type AudioFormat = z.infer<typeof AudioFormat>

  /** Voice configuration */
  export const VoiceConfig = z.object({
    /** Speech-to-text provider */
    provider: Provider.default("whisper"),
    /** API key for cloud providers */
    apiKey: z.string().optional(),
    /** Language code (e.g., "en-US") */
    language: z.string().default("en-US"),
    /** Sample rate in Hz */
    sampleRate: z.number().default(16000),
    /** Enable continuous listening */
    continuous: z.boolean().default(false),
    /** Silence threshold for auto-stop (ms) */
    silenceThreshold: z.number().default(2000),
    /** Max recording duration (ms) */
    maxDuration: z.number().default(30000),
    /** Wake word (optional) */
    wakeWord: z.string().optional(),
    /** Audio format */
    format: AudioFormat.default("wav"),
    /** Local model path (for whisper-local/vosk) */
    modelPath: z.string().optional(),
  })
  export type VoiceConfig = z.infer<typeof VoiceConfig>

  /** Transcription result */
  export const TranscriptionResult = z.object({
    /** Transcribed text */
    text: z.string(),
    /** Confidence score (0-1) */
    confidence: z.number().min(0).max(1).optional(),
    /** Detected language */
    language: z.string().optional(),
    /** Processing duration (ms) */
    duration: z.number(),
    /** Word-level timestamps */
    words: z.array(z.object({
      word: z.string(),
      start: z.number(),
      end: z.number(),
      confidence: z.number().optional(),
    })).optional(),
  })
  export type TranscriptionResult = z.infer<typeof TranscriptionResult>

  /** Voice command */
  export const VoiceCommand = z.object({
    /** Raw transcribed text */
    raw: z.string(),
    /** Parsed command */
    command: z.string(),
    /** Command arguments */
    args: z.record(z.string(), z.string()),
    /** Confidence score */
    confidence: z.number().optional(),
    /** Timestamp */
    timestamp: z.number(),
  })
  export type VoiceCommand = z.infer<typeof VoiceCommand>

  /** Command mapping for voice shortcuts */
  export const CommandAlias = z.object({
    /** Voice phrases that trigger this command */
    phrases: z.array(z.string()),
    /** Actual command to execute */
    command: z.string(),
    /** Command description */
    description: z.string().optional(),
  })
  export type CommandAlias = z.infer<typeof CommandAlias>
}
