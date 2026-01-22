/**
 * @fileoverview Voice Input Controller
 *
 * Main interface for voice-controlled operation.
 */

import { Log } from "../util/log"
import { VoiceTypes } from "./types"
import { AudioRecorder } from "./recorder"
import { Transcriber } from "./transcriber"
import { VoiceCommands } from "./commands"

const log = Log.create({ name: "voice-input" })

export namespace VoiceInput {
  let config: VoiceTypes.VoiceConfig = VoiceTypes.VoiceConfig.parse({})
  let status: VoiceTypes.Status = "idle"
  let commandCallback: ((cmd: VoiceTypes.VoiceCommand) => void) | null = null
  let continuousMode = false
  let stopRequested = false

  /**
   * Initialize voice input with configuration
   */
  export async function initialize(
    options: Partial<VoiceTypes.VoiceConfig> = {}
  ): Promise<{ success: boolean; message: string }> {
    config = VoiceTypes.VoiceConfig.parse(options)

    // Check audio recording availability
    const recorderStatus = await AudioRecorder.checkAvailability()
    if (!recorderStatus.available) {
      return {
        success: false,
        message: recorderStatus.message,
      }
    }

    // Check transcription provider availability
    const providers = await Transcriber.getAvailableProviders()
    if (providers.length === 0) {
      return {
        success: false,
        message: "No speech-to-text provider available. Set OPENAI_API_KEY for Whisper API or install local tools.",
      }
    }

    // Use first available provider if configured one isn't available
    if (!providers.includes(config.provider)) {
      config.provider = providers[0]
      log.info(`Using ${config.provider} provider (configured provider not available)`)
    }

    log.info("Voice input initialized", {
      provider: config.provider,
      language: config.language,
    })

    return {
      success: true,
      message: `Voice input ready. Using ${config.provider} for speech recognition.`,
    }
  }

  /**
   * Listen for a single voice command
   */
  export async function listen(): Promise<VoiceTypes.VoiceCommand | null> {
    if (status === "listening") {
      throw new Error("Already listening")
    }

    status = "listening"
    log.info("Listening for voice command...")

    try {
      // Record audio
      const audioPath = await AudioRecorder.startRecording(config)

      // Wait for user to stop (or auto-stop after silence/max duration)
      await waitForRecordingComplete()

      status = "processing"
      log.info("Processing audio...")

      // Transcribe
      const transcription = await Transcriber.transcribe(audioPath, config)

      if (!transcription.text) {
        log.info("No speech detected")
        status = "idle"
        await AudioRecorder.cleanup(audioPath)
        return null
      }

      log.info("Transcription result", { text: transcription.text })

      // Parse command
      const command = VoiceCommands.parse(transcription.text)

      // Cleanup
      await AudioRecorder.cleanup(audioPath)

      status = "idle"
      return command
    } catch (err) {
      status = "error"
      log.error("Voice input error", { error: (err as Error).message })
      throw err
    }
  }

  /**
   * Wait for recording to complete
   */
  async function waitForRecordingComplete(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (AudioRecorder.getStatus() === "idle") {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
    })
  }

  /**
   * Start continuous listening mode
   */
  export async function startContinuous(
    onCommand: (cmd: VoiceTypes.VoiceCommand) => void
  ): Promise<void> {
    if (continuousMode) {
      throw new Error("Already in continuous mode")
    }

    continuousMode = true
    stopRequested = false
    commandCallback = onCommand

    log.info("Starting continuous listening mode")

    while (continuousMode && !stopRequested) {
      try {
        const command = await listen()
        if (command && commandCallback) {
          // Check for stop command
          if (command.command === "exit" || command.command === "stop listening") {
            break
          }
          commandCallback(command)
        }
      } catch (err) {
        log.error("Error in continuous mode", { error: (err as Error).message })
        // Brief pause before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    continuousMode = false
    commandCallback = null
    log.info("Continuous listening stopped")
  }

  /**
   * Stop continuous listening mode
   */
  export function stopContinuous(): void {
    stopRequested = true
    continuousMode = false
    AudioRecorder.stopRecording()
  }

  /**
   * Stop current recording
   */
  export async function stop(): Promise<void> {
    await AudioRecorder.stopRecording()
    status = "idle"
  }

  /**
   * Get current status
   */
  export function getStatus(): VoiceTypes.Status {
    return status
  }

  /**
   * Check if voice input is available
   */
  export async function isAvailable(): Promise<boolean> {
    const recorder = await AudioRecorder.checkAvailability()
    const providers = await Transcriber.getAvailableProviders()
    return recorder.available && providers.length > 0
  }

  /**
   * Get voice input configuration
   */
  export function getConfig(): VoiceTypes.VoiceConfig {
    return { ...config }
  }

  /**
   * Update configuration
   */
  export function setConfig(options: Partial<VoiceTypes.VoiceConfig>): void {
    config = VoiceTypes.VoiceConfig.parse({ ...config, ...options })
  }

  /**
   * Get available voice commands help
   */
  export function getHelp(): string {
    return VoiceCommands.getHelp()
  }

  /**
   * Quick voice command - record, transcribe, and return command
   */
  export async function quickCommand(
    durationMs: number = 5000
  ): Promise<VoiceTypes.VoiceCommand | null> {
    status = "listening"
    log.info(`Recording for ${durationMs}ms...`)

    try {
      const audioPath = await AudioRecorder.recordDuration(durationMs, config)

      status = "processing"
      const transcription = await Transcriber.transcribe(audioPath, config)

      await AudioRecorder.cleanup(audioPath)

      if (!transcription.text) {
        status = "idle"
        return null
      }

      const command = VoiceCommands.parse(transcription.text)
      status = "idle"
      return command
    } catch (err) {
      status = "error"
      throw err
    }
  }
}
