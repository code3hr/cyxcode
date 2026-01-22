/**
 * @fileoverview Audio Recorder
 *
 * Cross-platform audio recording using system microphone.
 */

import { spawn, type ChildProcess } from "child_process"
import { promises as fs } from "fs"
import * as path from "path"
import * as os from "os"
import { Log } from "../util/log"
import { VoiceTypes } from "./types"

const log = Log.create({ name: "voice-recorder" })

export namespace AudioRecorder {
  let recordingProcess: ChildProcess | null = null
  let isRecording = false

  /**
   * Check if recording tools are available
   */
  export async function checkAvailability(): Promise<{
    available: boolean
    tool: string | null
    message: string
  }> {
    const tools = [
      { name: "sox", args: ["--version"], platforms: ["linux", "darwin"] },
      { name: "arecord", args: ["--version"], platforms: ["linux"] },
      { name: "ffmpeg", args: ["-version"], platforms: ["linux", "darwin", "win32"] },
    ]

    for (const tool of tools) {
      if (!tool.platforms.includes(process.platform)) continue

      try {
        const result = await new Promise<boolean>((resolve) => {
          const proc = spawn(tool.name, tool.args, { stdio: "pipe" })
          proc.on("error", () => resolve(false))
          proc.on("close", (code) => resolve(code === 0))
        })

        if (result) {
          return {
            available: true,
            tool: tool.name,
            message: `Using ${tool.name} for audio recording`,
          }
        }
      } catch {
        continue
      }
    }

    return {
      available: false,
      tool: null,
      message: "No audio recording tool found. Install sox, arecord, or ffmpeg.",
    }
  }

  /**
   * Get the recording command for the current platform
   */
  function getRecordCommand(
    outputPath: string,
    config: VoiceTypes.VoiceConfig
  ): { cmd: string; args: string[] } {
    const platform = process.platform

    if (platform === "darwin") {
      // macOS - use sox with coreaudio
      return {
        cmd: "sox",
        args: [
          "-d",  // Default input device
          "-r", String(config.sampleRate),
          "-c", "1",  // Mono
          "-b", "16", // 16-bit
          outputPath,
        ],
      }
    } else if (platform === "linux") {
      // Linux - try sox first, fall back to arecord
      return {
        cmd: "sox",
        args: [
          "-d",
          "-r", String(config.sampleRate),
          "-c", "1",
          "-b", "16",
          outputPath,
        ],
      }
    } else if (platform === "win32") {
      // Windows - use ffmpeg with dshow
      return {
        cmd: "ffmpeg",
        args: [
          "-f", "dshow",
          "-i", "audio=Microphone",
          "-ar", String(config.sampleRate),
          "-ac", "1",
          "-y",
          outputPath,
        ],
      }
    }

    throw new Error(`Unsupported platform: ${platform}`)
  }

  /**
   * Start recording audio
   */
  export async function startRecording(
    config: VoiceTypes.VoiceConfig = VoiceTypes.VoiceConfig.parse({})
  ): Promise<string> {
    if (isRecording) {
      throw new Error("Already recording")
    }

    const availability = await checkAvailability()
    if (!availability.available) {
      throw new Error(availability.message)
    }

    // Create temp file for recording
    const tempDir = os.tmpdir()
    const timestamp = Date.now()
    const outputPath = path.join(tempDir, `voice_${timestamp}.wav`)

    const { cmd, args } = getRecordCommand(outputPath, config)

    log.info("Starting recording", { cmd, outputPath })

    return new Promise((resolve, reject) => {
      recordingProcess = spawn(cmd, args, {
        stdio: "pipe",
      })

      isRecording = true

      recordingProcess.on("error", (err) => {
        isRecording = false
        recordingProcess = null
        reject(new Error(`Recording failed: ${err.message}`))
      })

      // Set up auto-stop after max duration
      const timeout = setTimeout(() => {
        if (isRecording) {
          stopRecording().then(() => resolve(outputPath)).catch(reject)
        }
      }, config.maxDuration)

      recordingProcess.on("close", () => {
        clearTimeout(timeout)
        isRecording = false
        recordingProcess = null
        resolve(outputPath)
      })
    })
  }

  /**
   * Stop recording audio
   */
  export async function stopRecording(): Promise<void> {
    if (!isRecording || !recordingProcess) {
      return
    }

    log.info("Stopping recording")

    return new Promise((resolve) => {
      if (recordingProcess) {
        recordingProcess.on("close", () => {
          isRecording = false
          recordingProcess = null
          resolve()
        })

        // Send SIGINT to gracefully stop recording
        recordingProcess.kill("SIGINT")

        // Force kill after 2 seconds if not stopped
        setTimeout(() => {
          if (recordingProcess) {
            recordingProcess.kill("SIGKILL")
          }
        }, 2000)
      } else {
        resolve()
      }
    })
  }

  /**
   * Record for a specific duration
   */
  export async function recordDuration(
    durationMs: number,
    config: VoiceTypes.VoiceConfig = VoiceTypes.VoiceConfig.parse({})
  ): Promise<string> {
    const outputPath = await startRecording({
      ...config,
      maxDuration: durationMs,
    })

    await new Promise((resolve) => setTimeout(resolve, durationMs))
    await stopRecording()

    return outputPath
  }

  /**
   * Check if currently recording
   */
  export function getStatus(): VoiceTypes.Status {
    return isRecording ? "listening" : "idle"
  }

  /**
   * Clean up temporary audio files
   */
  export async function cleanup(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
    } catch {
      // Ignore cleanup errors
    }
  }
}
