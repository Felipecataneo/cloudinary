"use client"

import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from "./ui/dialog"
import { useImageStore } from "@/lib/store"
import { useLayerStore } from "@/lib/layer-store"
import loadingAnimation from "@/public/animations/loading.json"
import Lottie from "lottie-react"

export default function Loading() {
  const generating = useImageStore((state) => state.generating)
  const setGenerating = useImageStore((state) => state.setGenerating)
  const activeLayer = useLayerStore((state) => state.activeLayer)
  return (
    <Dialog open={generating} onOpenChange={setGenerating}>
      <DialogContent className="sm:max-w-[425px] flex flex-col items-center">
        <DialogHeader>
          <DialogTitle>Processando</DialogTitle>
          <DialogDescription>
            Aguarde enquanto processamos sua mídia...
          </DialogDescription>
        </DialogHeader>
        <div className="w-48 h-48 relative mx-auto">
          <Lottie animationData={loadingAnimation} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
