"use client"

import { useImageStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { replaceBackground } from "@/server/bg-replace"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ImageOff } from "lucide-react"
import { useLayerStore } from "@/lib/layer-store"
import { useState } from "react"

export default function AIBackgroundReplace() {
  const setGenerating = useImageStore((state) => state.setGenerating)
  const activeLayer = useLayerStore((state) => state.activeLayer)
  const addLayer = useLayerStore((state) => state.addLayer)
  const generating = useImageStore((state) => state.generating)
  const setActiveLayer = useLayerStore((state) => state.setActiveLayer)

  const [prompt, setPrompt] = useState("")

  return (
    <Popover>
      <PopoverTrigger disabled={!activeLayer?.url} asChild>
        <Button variant="outline" className="py-8">
          <span className="flex gap-1 items-center justify-center flex-col text-xs font-medium">
            Substituir Fundo IA
            <ImageOff size={18} />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Substituir Fundo com IA</h4>
            <p className="text-sm text-muted-foreground">
              Substitua o fundo atual por uma nova cena gerada por IA
            </p>
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="prompt">Prompt</Label>
              <Input
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: praia tropical"
                className="col-span-2 h-8"
              />
            </div>
          </div>
        </div>
        <Button
          className="w-full mt-4"
          disabled={!activeLayer?.url || !prompt || generating}
          onClick={async () => {
            setGenerating(true)
            const res = await replaceBackground({
              prompt: prompt,
              activeImage: activeLayer.url!,
            })

            if (res?.data?.success) {
              const newLayerId = crypto.randomUUID()
              addLayer({
                id: newLayerId,
                name: "bg-replaced-" + activeLayer.name,
                format: activeLayer.format,
                height: activeLayer.height,
                width: activeLayer.width,
                url: res.data.success,
                publicId: activeLayer.publicId,
                resourceType: "image",
              })
              setGenerating(false)
              setActiveLayer(newLayerId)
            }
          }}
        >
          {generating ? "Gerando..." : "Substituir Fundo"}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
