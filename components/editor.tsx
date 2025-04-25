// components/editor.tsx
"use client"
import React, { useEffect } from 'react';
import dynamic from 'next/dynamic'; // Import dynamic

import UploadForm from "./upload/upload-form"
import ActiveImage from "./active-image"
import { useLayerStore } from "@/lib/layer-store"
import Layers from "./layers"
// import Loading from "./loading" // Remove direct import
import ExportAsset from "./toolbar/export-image"
import ImageCombiner from "./image-combiner/index"
import ImageTools from "./toolbar/image-tools" // Ensure these are imported
import VideoTools from "./toolbar/video-tools" // Ensure these are imported
import { ModeToggle } from "./toggle";

import { Button } from "./ui/button"
import { Combine, Menu, LayoutList, X } from "lucide-react"
import { useImageStore } from "@/lib/store"
import { cn } from "@/lib/utils";

// Dynamically import Loading with ssr: false
const Loading = dynamic(() => import("./loading"), { ssr: false });


export default function Editor() {
  const {
    activeLayer,
    combinerMode,
    setCombinerMode,
    isToolsSidebarOpen,
    setToolsSidebarOpen,
    isLayersSidebarOpen,
    setLayersSidebarOpen
  } = useLayerStore(state => ({
    activeLayer: state.activeLayer,
    combinerMode: state.combinerMode,
    setCombinerMode: state.setCombinerMode,
    isToolsSidebarOpen: state.isToolsSidebarOpen,
    setToolsSidebarOpen: state.setToolsSidebarOpen,
    isLayersSidebarOpen: state.isLayersSidebarOpen,
    setLayersSidebarOpen: state.setLayersSidebarOpen,
  }));

  const { generating } = useImageStore(state => ({ generating: state.generating }));

  const closeSidebars = () => {
    setToolsSidebarOpen(false);
    setLayersSidebarOpen(false);
  };

  // Effect to close sidebars if Escape key is pressed
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (isToolsSidebarOpen || isLayersSidebarOpen)) {
        closeSidebars();
      }
    };
    document.addEventListener('keydown', handleEscape);
    // Add closeSidebars to dependency array as it's used inside the effect
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isToolsSidebarOpen, isLayersSidebarOpen, closeSidebars]); // ADD closeSidebars here

  // Effect to close sidebars when entering combiner mode
  useEffect(() => {
     if (combinerMode) {
        closeSidebars();
     }
  }, [combinerMode, closeSidebars]); // ADD closeSidebars here

  // Effect to ensure sidebars are closed on window resize to large screen
  useEffect(() => {
      const handleResize = () => {
          // Check if the window width crosses the 'lg' breakpoint (default 1024px)
          if (window.innerWidth >= 1024 && (isToolsSidebarOpen || isLayersSidebarOpen)) {
              closeSidebars();
          }
      };
      window.addEventListener('resize', handleResize);
       // Add closeSidebars to dependency array as it's used inside the effect
      return () => window.removeEventListener('resize', handleResize);
  }, [isToolsSidebarOpen, isLayersSidebarOpen, closeSidebars]); // ADD closeSidebars here


  return (
    <div className="flex h-full relative">

      {/* Loading Overlay (Highest Z-index, shown regardless of sidebars) */}
      {generating && <Loading />} {/* Use the dynamically imported Loading */}

      {/* --- Sidebar Toggles (Visible only on small screens) --- */}
      {!combinerMode && (
          <>
              <Button
                  variant="outline"
                  size="icon"
                  className="fixed top-4 left-4 z-40 lg:hidden"
                  onClick={() => setToolsSidebarOpen(true)}
                  aria-label="Abrir barra de ferramentas"
                  // Disable if any sidebar is open, generating, or in combiner mode
                  disabled={isToolsSidebarOpen || isLayersSidebarOpen || generating || combinerMode}
              >
                 <Menu size={18} />
              </Button>

               <Button
                   variant="outline"
                   size="icon"
                   className="fixed top-4 right-4 z-40 lg:hidden"
                   onClick={() => setLayersSidebarOpen(true)}
                   aria-label="Abrir camadas"
                    // Disable if any sidebar is open, generating, or in combiner mode
                   disabled={isToolsSidebarOpen || isLayersSidebarOpen || generating || combinerMode}
               >
                  <LayoutList size={18} />
               </Button>
          </>
      )}


      {/* --- Main Layout Container --- */}
      <div className="flex w-full h-full flex-col lg:flex-row">

         {/* Left Toolbar Area */}
         {!combinerMode && (
            <div className={cn("py-6 px-4 hidden lg:block lg:min-w-48", { "opacity-50 pointer-events-none": generating })}>
                <div className="pb-12 text-center">
                   <ModeToggle />
                </div>
                <div className="flex flex-col gap-4">
                    {/* Toggle button for Combiner Mode */}
                    <Button
                       variant={combinerMode ? "secondary" : "outline"}
                       className="py-8"
                       onClick={() => setCombinerMode(!combinerMode)}
                       disabled={generating}
                    >
                       <span className="flex gap-1 items-center justify-center flex-col text-xs font-medium">
                          {combinerMode ? "Sair do Combinador" : "Combinador de Imagens"}
                          <Combine size={18} />
                       </span>
                    </Button>
                    {/* Conditional rendering of toolbars based on active layer type */}
                    {activeLayer.resourceType === "video" ? <VideoTools /> : activeLayer.resourceType === "image" ? <ImageTools /> : null}
                     {/* Export button is always available if a resource is loaded, regardless of type */}
                    {activeLayer.resourceType && (
                       <ExportAsset resource={activeLayer.resourceType} />
                    )}
                </div>
            </div>
         )}


          {/* Main Content Area */}
          <div className="flex-1 relative flex flex-col items-center justify-center h-full overflow-hidden">
             {/* Conditional rendering for the main view */}
             {combinerMode ? (
                 <div className="flex-1 w-full h-full">
                    <ImageCombiner />
                 </div>
             ) : activeLayer.url ? (
                 <ActiveImage />
             ) : (
                 <UploadForm />
             )}
         </div>


          {/* Right Layers Area */}
          {!combinerMode && (
             <div className={cn("shrink-0 hidden lg:block lg:basis-[320px]", { "opacity-50 pointer-events-none": generating })}>
                  <Layers />
             </div>
          )}

      </div>


      {/* --- Sidebar Overlays (Fixed positioned, shown only on small screens) --- */}
      {/* Backdrop */}
      {(isToolsSidebarOpen || isLayersSidebarOpen) && !combinerMode && (
          <div
              className="fixed inset-0 bg-black/50 z-50 lg:hidden"
              onClick={closeSidebars}
              aria-hidden="true"
          ></div>
      )}

      {/* Left Tools Overlay */}
      {!combinerMode && (
          <div className={cn(
              "fixed inset-y-0 left-0 w-64 bg-card shadow-xl z-[51] transition-transform duration-300 ease-in-out lg:hidden",
              isToolsSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}>
              <div className="py-6 px-4 flex flex-col h-full">
                  <div className="flex justify-between items-center pb-12">
                      <h2 className="text-lg font-semibold">Ferramentas</h2>
                      <Button variant="ghost" size="icon" onClick={() => setToolsSidebarOpen(false)} aria-label="Fechar barra de ferramentas">
                          <X size={20} />
                      </Button>
                  </div>
                   {/* Tools Content */}
                   <div className="flex flex-col gap-4 flex-grow overflow-y-auto scrollbar-thin scrollbar-track-secondary scrollbar-thumb-primary scrollbar-thumb-rounded-full scrollbar-track-rounded-full">
                        <Button
                           variant={combinerMode ? "secondary" : "outline"}
                           className="py-8"
                           onClick={() => { setCombinerMode(!combinerMode); closeSidebars(); }}
                           disabled={generating}
                        >
                           <span className="flex gap-1 items-center justify-center flex-col text-xs font-medium">
                              {combinerMode ? "Sair do Combinador" : "Combinador de Imagens"}
                              <Combine size={18} />
                           </span>
                        </Button>
                       {activeLayer.resourceType === "video" ? <VideoTools /> : activeLayer.resourceType === "image" ? <ImageTools /> : null}
                        {activeLayer.resourceType && (
                          <ExportAsset resource={activeLayer.resourceType} />
                        )}
                   </div>
              </div>
          </div>
      )}

       {/* Right Layers Overlay */}
       {!combinerMode && (
          <div className={cn(
              "fixed inset-y-0 right-0 w-80 bg-card shadow-xl z-[51] transition-transform duration-300 ease-in-out lg:hidden",
              isLayersSidebarOpen ? "translate-x-0" : "translate-x-full"
          )}>
               <div className="py-6 px-4 flex flex-col h-full">
                   <div className="flex justify-between items-center pb-12">
                       <h2 className="text-lg font-semibold">Camadas</h2>
                       <Button variant="ghost" size="icon" onClick={() => setLayersSidebarOpen(false)} aria-label="Fechar camadas">
                           <X size={20} />
                       </Button>
                   </div>
                   <Layers />
               </div>
          </div>
       )}
    </div>
  );
}