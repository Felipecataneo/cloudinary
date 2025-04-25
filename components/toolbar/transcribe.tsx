"use client"

import { Button } from "@/components/ui/button"
import { useLayerStore } from "@/lib/layer-store"
import { useImageStore } from "@/lib/store"
import { useState } from "react"
import { toast } from "sonner"
import { initiateTranscription } from "@/server/transcribe"
import { Captions, AlignCenter } from "lucide-react"

export default function VideoTranscription() {
  const activeLayer = useLayerStore((state) => state.activeLayer)
  const updateLayer = useLayerStore((state) => state.updateLayer)
  const [transcribing, setTranscribing] = useState(false)
  const setGenerating = useImageStore((state) => state.setGenerating)
  const setActiveLayer = useLayerStore((state) => state.setActiveLayer)

  const handleTranscribe = async () => {
    if (!activeLayer.publicId || activeLayer.resourceType !== "video") {
      toast.error("Please select a video layer first")
      return
    }

    setTranscribing(true)
    setGenerating(true)

    try {
      const result = await initiateTranscription({
        publicId: activeLayer.publicId,
      })

      if (result) {
        if (result.data && "success" in result.data) {
          toast.success(result.data.success)
          if (result.data.subtitledVideoUrl) {
            updateLayer({
              ...activeLayer,
              transcriptionURL: result.data.subtitledVideoUrl,
            })
            setActiveLayer(activeLayer.id)
          }
        } else if (result.data && "error" in result.data) {
          toast.error(result.data.error)
        } else {
          toast.error("Resposta inesperada do servidor")
        }
      }
    } catch (error) {
      toast.error("Ocorreu um erro durante a transcrição")
      console.error("Erro na transcrição:", error)
    } finally {
      setTranscribing(false)
      setGenerating(false)
    }
  }

  return (
    <div className="flex items-center">
      {!activeLayer.transcriptionURL && (
        <Button
          className="py-8 w-full"
          onClick={handleTranscribe}
          disabled={transcribing || activeLayer.resourceType !== "video"}
          variant={"outline"}
        >
          <span className="flex gap-1 items-center justify-center flex-col text-xs font-medium">
            {transcribing ? "Transcrevendo..." : "Transcrever Vídeo"}
            <AlignCenter size={18} />
          </span>
        </Button>
      )}

      {activeLayer.transcriptionURL && (
        <Button
          variant={"outline"}
          className="py-8 w-full"
          onClick={() => {
            window.open(activeLayer.transcriptionURL, "_blank")
          }}
        >
          <span className="flex gap-1 items-center justify-center flex-col text-xs font-medium">
            Abrir Vídeo Com Legendas
            <AlignCenter size={18} />
          </span>
        </Button>
      )}
    </div>
  )
}
