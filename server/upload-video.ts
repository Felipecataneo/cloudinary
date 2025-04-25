"use server"

import { UploadApiResponse, v2 as cloudinary } from "cloudinary"
import { actionClient } from "@/server/safe-action"
import z from "zod"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
})

const formData = z.object({
  video: z.instanceof(FormData),
})

type UploadResult =
  | { success: UploadApiResponse; error?: never }
  | { error: string; success?: never }

export const uploadVideo = actionClient
  .schema(formData)
  .action(async ({ parsedInput: { video } }): Promise<UploadResult> => {
    console.log(video)
    const formVideo = video.get("video")

    if (!formVideo) return { error: "Nenhum vídeo enviado" }
    if (!video) return { error: "Nenhum vídeo enviado" }

    const file = formVideo as File

    try {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      return new Promise<UploadResult>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: "video",
            upload_preset: "restyled",
            use_filename: true,
            unique_filename: false,
            filename_override: file.name,
          },
          (error, result) => {
            if (error || !result) {
              console.error("Erro ao fazer upload:", error)
              reject({ error: "Falha ao fazer upload do vídeo" })
            } else {
              console.log("Upload bem sucedido:", result)
              resolve({ success: result })
            }
          }
        )

        uploadStream.end(buffer)
      })
    } catch (error) {
      console.error("Erro ao fazer upload:", error)
      return { error: "Falha ao fazer upload do vídeo" }
    }
  })
