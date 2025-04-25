// components/editor.tsx
"use client"
import UploadForm from "./upload/upload-form"
import ActiveImage from "./active-image"
import { useLayerStore } from "@/lib/layer-store"
import Layers from "./layers"
import ImageTools from "./toolbar/image-tools"
import VideoTools from "./toolbar/video-tools"
import { ModeToggle } from "./toggle"
import Loading from "./loading"
import ExportAsset from "./toolbar/export-image"
// Import the refactored ImageCombiner
import ImageCombiner from "./image-combiner/index" // Adjust path if needed
import { Button } from "./ui/button" // Assuming you have Button
import { Combine } from "lucide-react" // Import an icon for combining
import { useImageStore } from "@/lib/store" // Need generating state

export default function Editor() {
  const activeLayer = useLayerStore((state) => state.activeLayer)
  const combinerMode = useLayerStore((state) => state.combinerMode)
  const setCombinerMode = useLayerStore((state) => state.setCombinerMode)
  const generating = useImageStore((state) => state.generating) // Get generating state

  return (
    <div className="flex h-full ">
      <div className="py-6 px-4 min-w-48 ">
        <div className="pb-12 text-center">
          <ModeToggle />
        </div>
        <div className="flex flex-col gap-4 ">
          {/* Toggle button for Combiner Mode */}
          <Button
             variant={combinerMode ? "secondary" : "outline"} // Highlight when active
             className="py-8"
             onClick={() => setCombinerMode(!combinerMode)}
             disabled={generating} // Disable while any operation is generating
          >
             <span className="flex gap-1 items-center justify-center flex-col text-xs font-medium">
                {combinerMode ? "Exit Combiner" : "Image Combiner"}
                <Combine size={18} />
             </span>
          </Button>

          {/* Existing Toolbars (show only when NOT in combinerMode) */}
          {!combinerMode && (
             <>
                {activeLayer.resourceType === "video" ? <VideoTools /> : null}
                {activeLayer.resourceType === "image" ? <ImageTools /> : null}
                {activeLayer.resourceType && (
                  <ExportAsset resource={activeLayer.resourceType} />
                )}
             </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center h-full">
         {/* Loading overlay is shown regardless of the main view below it */}
         {generating && <Loading />}

         {/* Conditional rendering for the main view */}
         {combinerMode ? (
             // Show ImageCombiner when combinerMode is true
             <ImageCombiner />
         ) : activeLayer.url ? (
             // Show ActiveImage if there's an active layer URL (and not in combinerMode)
             <ActiveImage />
         ) : (
             // Show UploadForm if no active layer URL (and not in combinerMode)
             <UploadForm />
         )}
     </div>


      <Layers />
    </div>
  )
}