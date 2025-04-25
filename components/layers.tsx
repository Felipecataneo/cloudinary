// components/layers.tsx
import React, { useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useLayerStore } from "@/lib/layer-store"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card"
import { Button } from "./ui/button"
import {
  ArrowRight,
  CornerLeftDown,
  Ellipsis,
  GitCompare,
  GitCompareArrows,
  Images,
  Layers2,
  Trash,
  X, // Import X icon
} from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useImageStore } from "@/lib/store"
import LayerImage from "./layers/layer-image"
import { cn } from "@/lib/utils"
import Image from "next/image"
import LayerInfo from "./layers/layer-info"

export default function Layers() {
  const layers = useLayerStore((state) => state.layers)
  const activeLayer = useLayerStore((state) => state.activeLayer)
  const setActiveLayer = useLayerStore((state) => state.setActiveLayer)
  const addLayer = useLayerStore((state) => state.addLayer)
  const generating = useImageStore((state) => state.generating)
  const layerComparisonMode = useLayerStore(
    (state) => state.layerComparisonMode
  )
  const setLayerComparisonMode = useLayerStore(
    (state) => state.setLayerComparisonMode
  )
  const comparedLayers = useLayerStore((state) => state.comparedLayers)
  const toggleComparedLayer = useLayerStore(
    (state) => state.toggleComparedLayer
  )
  const setComparedLayers = useLayerStore((state) => state.setComparedLayers)
  const isLayersSidebarOpen = useLayerStore(state => state.isLayersSidebarOpen); // Get sidebar state


  const MCard = useMemo(() => motion(Card), [])
  const MButton = useMemo(() => motion(Button), [])

  const getLayerName = useMemo(
    () => (id: string) => {
      const layer = layers.find((l) => l.id === id)
      // Provide a default value if layer is not found or url is missing
      return layer?.url || "";
    },
    [layers]
  )

  const visibleLayers = useMemo(
    () =>
      layerComparisonMode
        ? layers.filter((layer) => layer.url && layer.resourceType === "image")
        : layers,
    [layerComparisonMode, layers]
  )

  return (
    // Add flex and h-full to the Card to make it fill its container height
    <MCard
      layout
      className="basis-[320px] shrink-0 h-full flex flex-col scrollbar-thin scrollbar-track-secondary overflow-y-scroll scrollbar-thumb-primary scrollbar-thumb-rounded-full overflow-x-hidden relative shadow-2xl"
    >
      {/* CardHeader should be sticky */}
      <CardHeader className="sticky top-0 z-10 px-4 py-6 min-h-28 bg-card shadow-sm flex flex-col justify-center"> {/* Added flex, flex-col, justify-center */}
        {layerComparisonMode ? (
          <div>
            <CardTitle className="text-sm pb-2">Comparando...</CardTitle>
            <CardDescription className="flex gap-2 items-center">
              {comparedLayers.length > 0 && layers.find(l => l.id === comparedLayers[0]) ? (
                   <Image
                     alt="compare 1"
                     width={32}
                     height={32}
                     src={getLayerName(comparedLayers[0])}
                     className="object-contain rounded-sm"
                   />
               ) : (
                  <div className="w-8 h-8 bg-muted rounded-sm"></div> // Placeholder
               )}

              {comparedLayers.length > 0 && <ArrowRight size={16} />}

              {comparedLayers.length > 1 && layers.find(l => l.id === comparedLayers[1]) ? (
                <Image
                  alt="compare 2"
                  width={32}
                  height={32}
                  src={getLayerName(comparedLayers[1])}
                   className="object-contain rounded-sm"
                />
              ) : (
                 comparedLayers.length > 0 ? <div className="w-8 h-8 bg-muted rounded-sm"></div> : "Selecione duas imagens" // Placeholder or message
              )}
            </CardDescription>
          </div>
        ) : (
          <div className="flex flex-col gap-1 ">
            {/* Changed to text-base, added font-medium */}
            <CardTitle className="text-base font-medium ">
              {activeLayer.name || "Camada Ativa"} {/* Changed default text */}
            </CardTitle>
            {activeLayer.width && activeLayer.height ? (
              <CardDescription className="text-xs">
                {activeLayer.width}x{activeLayer.height} {/* Use x for dimensions */}
              </CardDescription>
            ) : activeLayer.id === layers[0]?.id ? ( // Check if it's the initial empty layer
                 <CardDescription className="text-xs">
                   Nenhuma mídia carregada
                 </CardDescription>
             ) : null}
          </div>
        )}
      </CardHeader>
      {/* Added flex-grow to CardContent to make the list fill remaining space and enable scrolling */}
      <CardContent className="flex-grow p-0 overflow-y-auto scrollbar-thin scrollbar-track-secondary scrollbar-thumb-primary scrollbar-thumb-rounded-full scrollbar-track-rounded-full">
        <AnimatePresence>
          {visibleLayers.map((layer, index) => {
            return (
              <motion.div
                animate={{ scale: 1, opacity: 1 }}
                initial={{ scale: 0, opacity: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                layout // Enable layout animations
                className={cn(
                  "cursor-pointer ease-in-out hover:bg-secondary border-b last:border-b-0 border-border", // Added bottom border
                  layerComparisonMode
                    ? comparedLayers.includes(layer.id)
                      ? "border-primary"
                      : "border-transparent" // Explicitly border-transparent when not selected for comparison
                    : activeLayer.id === layer.id
                      ? "border-primary"
                      : "border-transparent", // Explicitly border-transparent when not active layer
                  generating ? "animate-pulse" : "" // Pulse when generating
                )}
                key={layer.id}
                onClick={() => {
                  if (generating) return // Prevent interaction while generating
                  if (layerComparisonMode) {
                    toggleComparedLayer(layer.id)
                  } else {
                    setActiveLayer(layer.id)
                  }
                }}
              >
                <div className="relative p-4 flex items-center justify-between"> {/* Added justify-between */}
                  <div className="flex gap-2 items-center"> {/* Group image and text */}
                    <LayerImage layer={layer} />
                    {!layer.url && layer.id === layers[0]?.id && ( // Show "New layer" only for the initial empty layer
                       <p className="text-xs font-medium text-muted-foreground">
                         Nova Camada
                       </p>
                    )}
                  </div>
                  {/* LayerInfo Dialog Trigger (show only if it's not the initial empty layer and not in comparison mode) */}
                  {layer.url && !layerComparisonMode && (
                      <LayerInfo layer={layer} layerIndex={index} />
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </CardContent>
      {/* CardFooter fixed at bottom */}
      <CardContent className="sticky bottom-0 bg-card flex gap-2 shrink-0 p-4"> {/* Added p-4 for padding, kept sticky and shrink-0 */}
        <MButton
          layout
          onClick={() => {
            addLayer({
              id: crypto.randomUUID(),
              url: "",
              height: 0,
              width: 0,
              publicId: "",
              name: "",
              format: "",
            })
          }}
          variant="outline"
          className="w-full flex gap-2"
          disabled={generating || layerComparisonMode} // Disable while generating or comparing
        >
          <span className="text-xs">Criar Camada</span>
          <Layers2 className="text-secondary-foreground" size={18} />
        </MButton>
        {/* Compare Button - Logic for enabling/disabling and text needs refinement */}
         <MButton
           disabled={
               !activeLayer.url || // Needs an active layer
               activeLayer.resourceType === "video" || // Can only compare images
               generating // Cannot start comparison while generating
           }
           layout
           onClick={() => {
             if (layerComparisonMode) {
               setLayerComparisonMode(false); // Exit comparison mode
               setComparedLayers([]); // Clear compared layers
             } else {
                // Enter comparison mode with the active layer as the first compared layer
                setLayerComparisonMode(true);
                setComparedLayers([activeLayer.id]);
             }
           }}
           variant={layerComparisonMode ? "destructive" : "outline"}
           className="w-full flex gap-2"
         >
           <motion.span className={cn("text-xs font-bold")}>
             {layerComparisonMode ? "Pare de comparar" : "Compare"}
           </motion.span>
           {!layerComparisonMode && ( // Show icon only when not comparing
             <Images className="text-secondary-foreground" size={18} />
           )}
         </MButton>
      </CardContent>
    </MCard>
  )
}