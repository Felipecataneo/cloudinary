"use server"

import { v2 as cloudinary } from "cloudinary"
import { actionClient } from "@/server/safe-action"
import z from "zod"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
})

const transcriptionData = z.object({
  publicId: z.string(),
})

async function checkTranscriptionStatus(publicId: string): Promise<string> {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: "video",
    })
    if (
      result.info &&
      result.info.raw_convert &&
      result.info.raw_convert.google_speech
    ) {
      return result.info.raw_convert.google_speech.status
    }
    return "pending" // Assume pending if we can't find status
  } catch (error) {
    console.error("Error checking transcription status:", error)
    throw new Error("Failed to check transcription status")
  }
}

function generateSubtitledVideoUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    resource_type: "video",
    transformation: [
      {
        overlay: {
          resource_type: "subtitles",
          public_id: `${publicId}.transcript`,
        },
      },
      { flags: "layer_apply" },
    ],
  })
}

export const initiateTranscription = actionClient
  .schema(transcriptionData)
  .action(async ({ parsedInput: { publicId } }) => {
    console.log("Iniciando transcrição para:", publicId)
    try {
      // Iniciar transcrição
      await cloudinary.api.update(publicId, {
        resource_type: "video",
        raw_convert: "google_speech",
      })

      // Poll for completion
      const maxAttempts = 20
      const delay = 2000
      let status = "pending"

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        status = await checkTranscriptionStatus(publicId)
        console.log(`Tentativa ${attempt + 1}: Status da transcrição - ${status}`)

        if (status === "complete") {
          const subtitledVideoUrl = generateSubtitledVideoUrl(publicId)
          return { 
            success: "Transcrição completada com sucesso!",
            subtitledVideoUrl 
          }
        } else if (status === "failed") {
          return { error: "Transcrição falhou" }
        }

        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      return { error: "Tempo limite excedido ao processar o vídeo" }
    } catch (error) {
      console.error("Erro no processo de transcrição:", error)
      return {
        error:
          "Erro no processo de transcrição: " +
          (error instanceof Error ? error.message : String(error)),
      }
    }
  })
