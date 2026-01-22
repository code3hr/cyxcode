/**
 * @fileoverview Speech-to-Text Transcriber
 *
 * Supports multiple STT providers including OpenAI Whisper.
 */

import { spawn } from "child_process"
import { promises as fs } from "fs"
import { Log } from "../util/log"
import { VoiceTypes } from "./types"

const log = Log.create({ name: "voice-transcriber" })

export namespace Transcriber {
  /**
   * Transcribe audio file using configured provider
   */
  export async function transcribe(
    audioPath: string,
    config: VoiceTypes.VoiceConfig = VoiceTypes.VoiceConfig.parse({})
  ): Promise<VoiceTypes.TranscriptionResult> {
    const startTime = Date.now()

    switch (config.provider) {
      case "whisper":
        return transcribeWhisperAPI(audioPath, config)
      case "whisper-local":
        return transcribeWhisperLocal(audioPath, config)
      case "deepgram":
        return transcribeDeepgram(audioPath, config)
      case "vosk":
        return transcribeVosk(audioPath, config)
      default:
        throw new Error(`Unsupported provider: ${config.provider}`)
    }
  }

  /**
   * Transcribe using OpenAI Whisper API
   */
  async function transcribeWhisperAPI(
    audioPath: string,
    config: VoiceTypes.VoiceConfig
  ): Promise<VoiceTypes.TranscriptionResult> {
    const startTime = Date.now()

    const apiKey = config.apiKey || process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error("OpenAI API key required for Whisper API. Set OPENAI_API_KEY or provide apiKey in config.")
    }

    const audioData = await fs.readFile(audioPath)
    const uint8Array = new Uint8Array(audioData)
    const blob = new Blob([uint8Array], { type: "audio/wav" })

    const formData = new FormData()
    formData.append("file", blob, "audio.wav")
    formData.append("model", "whisper-1")
    formData.append("language", config.language.split("-")[0]) // "en-US" -> "en"
    formData.append("response_format", "verbose_json")

    log.info("Sending audio to Whisper API")

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Whisper API error: ${error}`)
    }

    const result = await response.json() as {
      text: string
      language: string
      duration: number
      words?: Array<{ word: string; start: number; end: number }>
    }

    return {
      text: result.text.trim(),
      language: result.language,
      duration: Date.now() - startTime,
      words: result.words?.map((w) => ({
        word: w.word,
        start: w.start * 1000,
        end: w.end * 1000,
      })),
    }
  }

  /**
   * Transcribe using local Whisper model
   */
  async function transcribeWhisperLocal(
    audioPath: string,
    config: VoiceTypes.VoiceConfig
  ): Promise<VoiceTypes.TranscriptionResult> {
    const startTime = Date.now()

    // Check if whisper CLI is available
    const whisperAvailable = await checkCommand("whisper")
    if (!whisperAvailable) {
      throw new Error("Local Whisper not found. Install with: pip install openai-whisper")
    }

    const modelSize = config.modelPath || "base"

    return new Promise((resolve, reject) => {
      const args = [
        audioPath,
        "--model", modelSize,
        "--language", config.language.split("-")[0],
        "--output_format", "json",
        "--output_dir", "/tmp",
      ]

      const proc = spawn("whisper", args, { stdio: "pipe" })
      let stdout = ""
      let stderr = ""

      proc.stdout?.on("data", (data) => { stdout += data.toString() })
      proc.stderr?.on("data", (data) => { stderr += data.toString() })

      proc.on("error", (err) => reject(err))
      proc.on("close", async (code) => {
        if (code !== 0) {
          reject(new Error(`Whisper failed: ${stderr}`))
          return
        }

        try {
          // Read the JSON output
          const jsonPath = audioPath.replace(/\.[^.]+$/, ".json")
          const jsonContent = await fs.readFile(jsonPath, "utf-8")
          const result = JSON.parse(jsonContent)

          resolve({
            text: result.text?.trim() || "",
            language: result.language,
            duration: Date.now() - startTime,
          })
        } catch (err) {
          // Fallback: parse from stderr/stdout
          const textMatch = stdout.match(/\] (.+)$/m)
          resolve({
            text: textMatch?.[1]?.trim() || "",
            duration: Date.now() - startTime,
          })
        }
      })
    })
  }

  /**
   * Transcribe using Deepgram API
   */
  async function transcribeDeepgram(
    audioPath: string,
    config: VoiceTypes.VoiceConfig
  ): Promise<VoiceTypes.TranscriptionResult> {
    const startTime = Date.now()

    const apiKey = config.apiKey || process.env.DEEPGRAM_API_KEY
    if (!apiKey) {
      throw new Error("Deepgram API key required. Set DEEPGRAM_API_KEY or provide apiKey in config.")
    }

    const audioData = await fs.readFile(audioPath)
    const uint8Array = new Uint8Array(audioData)

    const response = await fetch(
      `https://api.deepgram.com/v1/listen?language=${config.language}&punctuate=true`,
      {
        method: "POST",
        headers: {
          "Authorization": `Token ${apiKey}`,
          "Content-Type": "audio/wav",
        },
        body: uint8Array,
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Deepgram API error: ${error}`)
    }

    const result = await response.json() as {
      results: {
        channels: Array<{
          alternatives: Array<{
            transcript: string
            confidence: number
            words: Array<{ word: string; start: number; end: number; confidence: number }>
          }>
        }>
      }
    }

    const alternative = result.results?.channels?.[0]?.alternatives?.[0]

    return {
      text: alternative?.transcript?.trim() || "",
      confidence: alternative?.confidence,
      duration: Date.now() - startTime,
      words: alternative?.words?.map((w) => ({
        word: w.word,
        start: w.start * 1000,
        end: w.end * 1000,
        confidence: w.confidence,
      })),
    }
  }

  /**
   * Transcribe using Vosk (offline)
   */
  async function transcribeVosk(
    audioPath: string,
    config: VoiceTypes.VoiceConfig
  ): Promise<VoiceTypes.TranscriptionResult> {
    const startTime = Date.now()

    // Check if vosk-transcriber is available
    const voskAvailable = await checkCommand("vosk-transcriber")
    if (!voskAvailable) {
      throw new Error("Vosk not found. Install with: pip install vosk")
    }

    return new Promise((resolve, reject) => {
      const args = ["-i", audioPath]
      if (config.modelPath) {
        args.push("-m", config.modelPath)
      }

      const proc = spawn("vosk-transcriber", args, { stdio: "pipe" })
      let stdout = ""
      let stderr = ""

      proc.stdout?.on("data", (data) => { stdout += data.toString() })
      proc.stderr?.on("data", (data) => { stderr += data.toString() })

      proc.on("error", (err) => reject(err))
      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Vosk failed: ${stderr}`))
          return
        }

        resolve({
          text: stdout.trim(),
          duration: Date.now() - startTime,
        })
      })
    })
  }

  /**
   * Check if a command is available
   */
  async function checkCommand(cmd: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(cmd, ["--help"], { stdio: "pipe" })
      proc.on("error", () => resolve(false))
      proc.on("close", (code) => resolve(code === 0))
    })
  }

  /**
   * Get available providers
   */
  export async function getAvailableProviders(): Promise<VoiceTypes.Provider[]> {
    const available: VoiceTypes.Provider[] = []

    // Whisper API is always available if API key is set
    if (process.env.OPENAI_API_KEY) {
      available.push("whisper")
    }

    // Check local whisper
    if (await checkCommand("whisper")) {
      available.push("whisper-local")
    }

    // Deepgram is available if API key is set
    if (process.env.DEEPGRAM_API_KEY) {
      available.push("deepgram")
    }

    // Check vosk
    if (await checkCommand("vosk-transcriber")) {
      available.push("vosk")
    }

    return available
  }
}
