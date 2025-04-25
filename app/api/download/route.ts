import { NextRequest, NextResponse } from "next/server"
import cloudinary from "cloudinary"
import { checkImageProcessing } from "@/server/url_process"

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const publicId = searchParams.get("publicId")
  const quality = searchParams.get("quality")
  const resource = searchParams.get("resource_type")
  const format = searchParams.get("format")
  const activeUrl = searchParams.get("url")

  if (!publicId) {
    return new NextResponse("Parâmetro publicId ausente", { status: 400 })
  }

  let selected = ""
  if (format && !format.toLowerCase().endsWith("png")) {
    switch (quality) {
      case "original":
        break
      case "large":
        selected = "q_80"
        break
      case "medium":
        selected = "q_50"
        break
      case "small":
        selected = "q_30"
        break
      default:
        return new NextResponse("Parâmetro de qualidade inválido", { status: 400 })
    }
  }

  try {
    const parts = activeUrl!.split("/upload/")
    const url = selected
      ? `${parts[0]}/upload/${selected}/${parts[1]}`
      : activeUrl!

    // Poll the URL to check if the image is processed
    let isProcessed = false
    const maxAttempts = 20
    const delay = 1000 // 1 second
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      isProcessed = await checkImageProcessing(url)

      if (isProcessed) {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    if (!isProcessed) {
      throw new Error("Tempo limite de processamento da imagem excedido")
    }
    return NextResponse.json({
      url,
      filename: `${publicId}.${quality}.${format}`,
    })
  } catch (error) {
    console.error("Erro ao gerar URL da imagem:", error)
    return NextResponse.json(
      { error: "Erro ao gerar URL da imagem" },
      { status: 500 }
    )
  }
}
