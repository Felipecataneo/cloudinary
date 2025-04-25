// components/editor.tsx
"use client"
import React, { useEffect } from 'react'; // Import useEffect
import UploadForm from "./upload/upload-form"
import ActiveImage from "./active-image"
import { useLayerStore } from "@/lib/layer-store"
import Layers from "./layers"
import ImageTools from "./toolbar/image-tools"
import VideoTools from "./toolbar/video-tools"
import { ModeToggle } from "./toggle"
import Loading from "./loading"
import ExportAsset from "./toolbar/export-image"
import ImageCombiner from "./image-combiner/index"
import { Button } from "./ui/button"
import { Combine, Menu, LayoutList, X } from "lucide-react" // Import icons
import { useImageStore } from "@/lib/store"
import { cn } from "@/lib/utils"; // Import cn

export default function Editor() {
  // Fix: Pass a selector function to useLayerStore
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

  // Fix: Pass a selector function to useImageStore
  const { generating } = useImageStore(state => ({ generating: state.generating }));

  // Function to close both sidebars
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
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isToolsSidebarOpen, isLayersSidebarOpen]); // Re-run effect if sidebar state changes

  // Effect to close sidebars when entering combiner mode
  useEffect(() => {
     if (combinerMode) {
        closeSidebars();
     }
  }, [combinerMode]);

  // Effect to ensure sidebars are closed on window resize to large screen
  useEffect(() => {
      const handleResize = () => {
          // Check if the window width crosses the 'lg' breakpoint (default 1024px)
          if (window.innerWidth >= 1024 && (isToolsSidebarOpen || isLayersSidebarOpen)) {
              closeSidebars();
          }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, [isToolsSidebarOpen, isLayersSidebarOpen]); // Re-run effect if sidebar state changes


  return (
    <div className="flex h-full relative"> {/* Use relative for fixed positioning context if needed */}

      {/* Loading Overlay (Highest Z-index, shown regardless of sidebars) */}
      {/* Loading component uses Dialog/Portal which handles z-index automatically */}
      {generating && <Loading />}

      {/* --- Sidebar Toggles (Visible only on small screens) --- */}
      {/* These are fixed positioned, so they live OUTSIDE the main flex layout */}
      {/* Hide toggles in combiner mode */}
      {!combinerMode && (
          <>
              <Button
                  variant="outline"
                  size="icon"
                  className="fixed top-4 left-4 z-40 lg:hidden" // Fixed pos, high z-index, hide on lg
                  onClick={() => setToolsSidebarOpen(true)}
                  aria-label="Abrir barra de ferramentas"
                  disabled={isToolsSidebarOpen || isLayersSidebarOpen || generating} // Disable if any sidebar is open or generating
              >
                 <Menu size={18} /> {/* Use Menu icon for tools */}
              </Button>

               <Button
                   variant="outline"
                   size="icon"
                   className="fixed top-4 right-4 z-40 lg:hidden" // Fixed pos, high z-index, hide on lg
                   onClick={() => setLayersSidebarOpen(true)}
                   aria-label="Abrir camadas"
                   disabled={isToolsSidebarOpen || isLayersSidebarOpen || generating} // Disable if any sidebar is open or generating
               >
                  <LayoutList size={18} /> {/* Use LayoutList for layers */}
               </Button>
          </>
      )}


      {/* --- Main Layout Container (Flex for large screens, handles content flow) --- */}
      {/* This is the container that changes behavior based on breakpoint */}
      <div className="flex w-full h-full flex-col lg:flex-row"> {/* Flex column on small, row on large */}

         {/* Left Toolbar Area (Visible on large, hidden by default on small) */}
         {/* In combinerMode, this area is also hidden */}
         {/* Added lg:min-w-48 to apply min-width only on large screens */}
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


          {/* Main Content Area (Takes remaining space on large, full on small unless sidebar overlay is open) */}
          {/* Added flex-grow and overflow-hidden to handle potential content overflow within the main view */}
          <div className="flex-1 relative flex flex-col items-center justify-center h-full overflow-hidden">
             {/* Conditional rendering for the main view */}
             {combinerMode ? (
                 // Image Combiner takes full central area when active
                 // Add flex-1 to ImageCombiner wrapper to ensure it fills height
                 <div className="flex-1 w-full h-full"> {/* Added h-full here */}
                    <ImageCombiner />
                 </div>
             ) : activeLayer.url ? (
                 // Show ActiveImage if there's an active layer URL (and not in combinerMode)
                 <ActiveImage />
             ) : (
                 // Show UploadForm if no active layer URL (and not in combinerMode)
                 <UploadForm />
             )}
         </div>


          {/* Right Layers Area (Visible on large, hidden by default on small) */}
          {/* Added lg:basis-[320px] to apply basis only on large screens */}
          {!combinerMode && (
             <div className={cn("shrink-0 hidden lg:block lg:basis-[320px]", { "opacity-50 pointer-events-none": generating })}>
                  {/* Layers component already expects to be in a flex container */}
                  <Layers /> {/* Layers component handles its own scrolling within the Card */}
             </div>
          )}

      </div>


      {/* --- Sidebar Overlays (Fixed positioned, shown only on small screens) --- */}
      {/* Backdrop (Shown when ANY sidebar overlay is open on small screens) */}
      {/* Hide backdrop in combiner mode */}
      {(isToolsSidebarOpen || isLayersSidebarOpen) && !combinerMode && (
          <div
              className="fixed inset-0 bg-black/50 z-50 lg:hidden" // Higher z-index than toggles, lower than loading
              onClick={closeSidebars}
              aria-hidden="true"
          ></div>
      )}

      {/* Left Tools Overlay (Slides from left on small screens) */}
      {/* Only show if not in combiner mode */}
      {!combinerMode && (
          <div className={cn(
              "fixed inset-y-0 left-0 w-64 bg-card shadow-xl z-[51] transition-transform duration-300 ease-in-out lg:hidden", // Higher z-index than backdrop
              isToolsSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}>
              <div className="py-6 px-4 flex flex-col h-full"> {/* Flex column to fill height */}
                  <div className="flex justify-between items-center pb-12">
                      <h2 className="text-lg font-semibold">Ferramentas</h2>
                      <Button variant="ghost" size="icon" onClick={() => setToolsSidebarOpen(false)} aria-label="Fechar barra de ferramentas">
                          <X size={20} />
                      </Button>
                  </div>
                   {/* Tools Content - Add flex-grow and overflow-y-auto for scrolling */}
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

       {/* Right Layers Overlay (Slides from right on small screens) */}
      {/* Only show if not in combiner mode */}
       {!combinerMode && (
          <div className={cn(
              "fixed inset-y-0 right-0 w-80 bg-card shadow-xl z-[51] transition-transform duration-300 ease-in-out lg:hidden",
              isLayersSidebarOpen ? "translate-x-0" : "translate-x-full" // Slide from right
          )}>
               <div className="py-6 px-4 flex flex-col h-full"> {/* Flex column to fill height */}
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