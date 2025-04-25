// components/image-combiner/index.tsx
"use client"
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MediaUploadCard } from './media-upload-card';
import { CombinedPreviewArea } from './combined-preview-area'; // Import CombinedPreviewArea correctly
import { ControlPanel } from './control-panel';
import { DownloadSection } from './download-section';
import { clamp } from '@/lib/utils';

// Types and Helpers
type MediaType = 'image' | 'video' | null;
type RelativeFocus = { x: number; y: number };

const logPrefix = "[ImageCombiner] ";

// --- loadMediaElement Helper (Keep this helper function here) ---
const loadMediaElement = (dataUrl: string, type: MediaType, side: 'left' | 'right' | 'logo'): Promise<HTMLImageElement | HTMLVideoElement | null> => {
  // console.log(logPrefix + `[${side}] loadMediaElement START. Type: ${type}`);
  if (!dataUrl || !type) return Promise.resolve(null); // Handle null/empty input
  if (typeof window === 'undefined') { console.error(logPrefix + `[${side}] loadMediaElement failed: window is undefined.`); return Promise.reject(new Error("loadMediaElement client-side only.")); }

  return new Promise((resolve, reject) => {
    let element: HTMLImageElement | HTMLVideoElement | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const cleanupTimeout = () => { if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; } };
    const cleanupAndReject = (error: Error) => { cleanupTimeout(); reject(error); }; // Helper for errors

    timeoutId = setTimeout(() => {
        console.error(logPrefix + `[${side}] LOAD TIMEOUT after 20 seconds! Type: ${type}`);
        if(element) {
            // Attempt to stop loading and potentially revoke URL on timeout
            if ('src' in element && element.src && element.src.startsWith('blob:')) {
                 console.warn(logPrefix + `[${side}] Cleared element src and revoking blob URL on timeout.`);
                 try { element.src = ''; URL.revokeObjectURL(element.src); } catch (e) { console.error("Error during timeout cleanup:", e); }
             } else if ('src' in element) {
                 element.src = ''; // Stop non-blob network request
             }
             if ('load' in element && typeof element.load === 'function') {
                  // Check if element is a video before calling load
                 if (element instanceof HTMLVideoElement) {
                    element.load(); // Stop video loading
                 }
             }
        }
        // Reject and trigger error state in the parent
        cleanupAndReject(new Error(`Timeout loading media (${side})`));
    }, 20000); // 20 seconds timeout


    try {
        if (type === 'image') {
            const img = new window.Image();
            element = img;
            img.onload = () => {
              cleanupTimeout();
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                resolve(img); // Resolve with the loaded image element
              } else {
                console.error(logPrefix + `[${side}] Image ONLOAD fired but dimensions are invalid.`);
                cleanupAndReject(new Error(`Image loaded but with invalid dimensions (${side})`));
              }
            };
            img.onerror = (e) => {
              cleanupTimeout();
              console.error(logPrefix + `[${side}] Image ONERROR fired. Error event:`, e);
              cleanupAndReject(new Error(`Error loading image (${side})`));
            };
            img.src = dataUrl; // Use the data URL directly
        } else if (type === 'video') {
            const video = document.createElement('video');
            element = video;
             // Use a combination of events to ensure it's ready
            const handleReady = () => {
                cleanupTimeout();
                // Check readyState >= 2 (HAVE_CURRENT_DATA) or >= 3 (HAVE_FUTURE_DATA)
                if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
                    video.currentTime = 0;
                    video.muted = true;
                    video.playsInline = true;
                    // video.play().catch(err => console.warn(logPrefix + `[${side}] Auto-play failed:`, err)); // Auto-play for preview
                    resolve(video); // Resolve with the loaded video element
                } else {
                   console.error(logPrefix + `[${side}] Video ONLOADEDDATA/CANPLAY fires, but dimensions/readyState invalid. Dims: ${video.videoWidth}x${video.videoHeight}, State: ${video.readyState}`);
                   cleanupAndReject(new Error(`Video loaded but with invalid dimensions or readyState (${side})`));
                }
            };

            // Listen for loadeddata or canplay through a single function
            video.addEventListener('loadeddata', handleReady, { once: true });
            video.addEventListener('canplay', handleReady, { once: true }); // Also check canplay

            video.onerror = (e) => {
              cleanupTimeout();
              const error = video.error;
              console.error(logPrefix + `[${side}] Video ONERROR fired. Error object:`, error, "Event:", e);
              cleanupAndReject(new Error(`Error loading video (${side}): ${error?.message || 'Unknown video error'}`));
            };
            video.onstalled = () => console.warn(logPrefix + `[${side}] Video ONSTALLED fired.`);
            video.onsuspend = () => console.warn(logPrefix + `[${side}] Video ONSUSPEND fired.`);


            video.preload = 'auto'; // Suggest preloading
            video.src = dataUrl;
            video.load(); // Explicitly start loading
        } else {
          cleanupTimeout();
          console.error(logPrefix + `[${side}] Unsupported media type: ${type}`);
          cleanupAndReject(new Error(`Unsupported media type (${side})`));
        }
    } catch (err) {
      cleanupTimeout(); // In case error happens before timeout is set
      console.error(logPrefix + `[${side}] Catched error during element creation/setup:`, err);
      cleanupAndReject(err instanceof Error ? err : new Error(String(err)));
    }
  });
};


const ImageCombiner = () => { // Define component as const for consistent export
  // --- State for Media URLs (Data URLs from file reader) ---
  const [leftMedia, setLeftMedia] = useState<string | null>(null);
  const [rightMedia, setRightMedia] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null); // Data URL for logo

  // --- State for Media Types (Detected from file type) ---
  const [leftMediaType, setLeftMediaType] = useState<MediaType>(null);
  const [rightMediaType, setRightMediaType] = useState<MediaType>(null);

  // --- State for Loaded Media Elements (HTMLImageElement or HTMLVideoElement) ---
  const [leftMediaElement, setLeftMediaElement] = useState<HTMLImageElement | HTMLVideoElement | null>(null);
  const [rightMediaElement, setRightMediaElement] = useState<HTMLImageElement | HTMLVideoElement | null>(null);
  const [logoElement, setLogoElement] = useState<HTMLImageElement | null>(null); // Loaded logo image element

  // --- State for Parameters (Managed by CombinedPreviewArea/ControlPanel, synced here) ---
  const [leftZoom, setLeftZoom] = useState(100);
  const [rightZoom, setRightZoom] = useState(100);
  const [logoZoom, setLogoZoom] = useState(10);

  const [leftRelativeFocus, setLeftRelativeFocus] = useState<RelativeFocus>({ x: 0.5, y: 0.5 });
  const [rightRelativeFocus, setRightRelativeFocus] = useState<RelativeFocus>({ x: 0.5, y: 0.5 });
  const [logoPosition, setLogoPosition] = useState({ x: 50, y: 90 }); // Center position in %

  // --- State for Loading/Saving ---
  const [isSaving, setIsSaving] = useState(false);
  // Keep the overall saveError state for save operation failures
  const [saveError, setSaveError] = useState<string | null>(null);

  // Add specific error states for loading each media
  const [leftLoadError, setLeftLoadError] = useState<string | null>(null);
  const [rightLoadError, setRightLoadError] = useState<string | null>(null);
  const [logoLoadError, setLogoLoadError] = useState<string | null>(null);


  const [isLoadingLeft, setIsLoadingLeft] = useState(false);
  const [isLoadingRight, setIsLoadingRight] = useState(false);
  const [isLoadingLogo, setIsLoadingLogo] = useState(false);

   const isMounted = useRef(true); // To track component mount status


  // --- Effects for Loading Media Elements from Data URLs ---

   // Helper to clean up Object URLs
   const cleanupObjectURL = useCallback((element: HTMLImageElement | HTMLVideoElement | null) => {
       if (element && 'src' in element && element.src && element.src.startsWith('blob:')) {
           // console.log(logPrefix + `Revoking object URL: ${element.src}`);
           try { URL.revokeObjectURL(element.src); } catch (e) { console.error("Error revoking object URL:", e); }
       }
   }, []);


  useEffect(() => {
    isMounted.current = true;
    return () => {
        isMounted.current = false;
        // Cleanup any remaining Object URLs on unmount
        cleanupObjectURL(leftMediaElement);
        cleanupObjectURL(rightMediaElement);
        cleanupObjectURL(logoElement);
        // console.log(logPrefix + "Component unmounted. Cleaned up Object URLs.");
    };
  }, [cleanupObjectURL, leftMediaElement, rightMediaElement, logoElement]); // Add elements to dependencies for cleanup


  // Generic loader effect for left/right media
  const loadMediaEffect = useCallback(async (
      mediaUrl: string | null,
      mediaType: MediaType,
      side: 'left' | 'right', // Specific to left/right sides
      setLoading: React.Dispatch<React.SetStateAction<boolean>>,
      setMediaElement: React.Dispatch<React.SetStateAction<HTMLImageElement | HTMLVideoElement | null>>,
      setLoadError: React.Dispatch<React.SetStateAction<string | null>>, // Pass setter for specific error
      resetFocusZoom: () => void // Specific reset for left/right
  ) => {
      setLoading(true);
      setMediaElement((prevEl: HTMLImageElement | HTMLVideoElement | null) => { // Explicitly type prevEl
           cleanupObjectURL(prevEl); // Clean up old element's URL
           return null;
      });
      setLoadError(null); // Clear previous specific load error
      setSaveError(null); // Clear overall save error
      resetFocusZoom();

      if (!mediaUrl || !mediaType) {
          setLoading(false);
          return; // Nothing to load or invalid type/url
      }

      let objectUrlToClean: string | null = null; // Track the blob URL created in this effect run

      try {
          // Create Object URL for image/video blobs for potentially faster loading
          let loadingUrl = mediaUrl;
          if (mediaType === 'image' || mediaType === 'video') { // Only create blob URL for these types
             try {
                const response = await fetch(mediaUrl);
                const blob = await response.blob();
                loadingUrl = URL.createObjectURL(blob);
                 // console.log(logPrefix + `Created Object URL for ${side} (${mediaType}): ${loadingUrl}`);
                objectUrlToClean = loadingUrl; // Store the blob URL to clean up later if needed
             } catch (error) {
                console.error(logPrefix + `[${side}] Failed to create Blob/Object URL from Data URL:`, error);
                setLoadError(`Failed to process file for preview.`); // Set a user-friendly error for this side
                 // Revert to using original URL if blob creation fails (might still work for some cases)
                loadingUrl = mediaUrl; // Fallback
             }
          } else {
              // Should not happen based on MediaUploadCard logic, but handle defensively
               console.error(logPrefix + `[${side}] Unsupported media type for loadMediaEffect: ${mediaType}`);
               setLoading(false);
               setLoadError(`Unsupported media type (${side}).`);
               return;
          }


          // Start loading the element using the finalLoadUrl (Object URL or original Data URL)
          const element = await loadMediaElement(loadingUrl, mediaType, side);


          if (isMounted.current) {
            setMediaElement(element);
             // Blob URL cleanup will be handled later by cleanupObjectURL
          } else {
             // Component unmounted, clean up the element and its potential blob URL immediately
             cleanupObjectURL(element);
             if (objectUrlToClean) { try { URL.revokeObjectURL(objectUrlToClean); } catch (e) { console.error("Error revoking temp object URL:", e); }} // Clean up temp URL
          }
      } catch (err) {
          console.error(logPrefix + `[${side}] loadMediaElement failed:`, err);
          if (isMounted.current) {
              setMediaElement(null); // Explicitly set to null on failure
              setLoadError(`Error loading media.`); // Set a user-friendly error for this side
          }
           // If loadMediaElement failed after creating the object URL, clean it up
           if (objectUrlToClean) { try { URL.revokeObjectURL(objectUrlToClean); } catch (e) { console.error("Error revoking temp object URL:", e); }}
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
       // Cleanup function for this specific effect instance
       return () => {
            // If this effect is re-run (mediaUrl/type changes) before the promise resolves,
            // the next effect run's setMediaElement(prevEl => ...) will clean up the *currently* set element's URL.
            // The cleanup in the .then/.catch blocks (within loadMediaElement promise) handles the case where
            // the promise resolves *after* the component unmounts or the effect re-runs.
            // The `objectUrlToClean` logic handles the temp URL created in this effect run.
       };

  }, [loadMediaElement, cleanupObjectURL]); // Dependencies: loadMediaElement and cleanupObjectURL helpers


  // Load Left Media Effect Trigger
  useEffect(() => {
      loadMediaEffect(leftMedia, leftMediaType, 'left', setIsLoadingLeft, setLeftMediaElement, setLeftLoadError,
          () => { setLeftRelativeFocus({ x: 0.5, y: 0.5 }); setLeftZoom(100); }
      );
  }, [leftMedia, leftMediaType, loadMediaEffect, setLeftLoadError]); // Added setLeftLoadError to dependencies

  // Load Right Media Effect Trigger
  useEffect(() => {
      loadMediaEffect(rightMedia, rightMediaType, 'right', setIsLoadingRight, setRightMediaElement, setRightLoadError,
          () => { setRightRelativeFocus({ x: 0.5, y: 0.5 }); setRightZoom(100); }
      );
  }, [rightMedia, rightMediaType, loadMediaEffect, setRightLoadError]); // Added setRightLoadError to dependencies


   // Load Logo Media Effect (Specific for logo, always type 'image')
   const loadLogoEffect = useCallback(async (logoUrl: string | null, setLoading: React.Dispatch<React.SetStateAction<boolean>>, setLogoElement: React.Dispatch<React.SetStateAction<HTMLImageElement | null>>, setLoadError: React.Dispatch<React.SetStateAction<string | null>>, resetLogoPosZoom: () => void) => { // Pass setter for specific error
       setLoading(true);
       setLogoElement((prevEl: HTMLImageElement | null) => { // Fix: Explicitly type prevEl
           cleanupObjectURL(prevEl);
           return null;
       });
       setLoadError(null); // Clear previous specific load error
       setSaveError(null); // Clear overall save error
       resetLogoPosZoom();

       if (!logoUrl) {
           setLoading(false);
           return;
       }

       let loadingUrl = logoUrl;
       let objectUrlToClean: string | null = null;

        // Logo can be SVG data URL or image blob URL
        if (!logoUrl.startsWith('data:image/svg+xml')) { // Only create blob URL for non-SVG
            try {
               const response = await fetch(logoUrl);
               const blob = await response.blob();
               loadingUrl = URL.createObjectURL(blob);
                // console.log(logPrefix + `Created Object URL for Logo: ${loadingUrl}`);
                objectUrlToClean = loadingUrl; // Store the blob URL
            } catch (error) {
               console.error(logPrefix + `[Logo] Failed to create Blob/Object URL from Data URL:`, error);
               setLoading(false);
               setLoadError(`Failed to process logo for preview.`); // Set user error for logo
               return; // Stop the process
            }
        }

       try {
           // Load the element using the finalLoadUrl (might be Object URL or original SVG Data URL)
           // Cast to HTMLImageElement is safe here because type is fixed to 'image'
           const element = await loadMediaElement(loadingUrl, 'image', 'logo') as HTMLImageElement | null; // Direct await is okay here after the fetch/blob step

           if (isMounted.current) {
             setLogoElement(element);
             // Blob URL cleanup will be handled later
           } else {
              cleanupObjectURL(element);
              if (objectUrlToClean) { try { URL.revokeObjectURL(objectUrlToClean); } catch (e) { console.error("Error revoking temp object URL:", e); }}
           }
       } catch (err) {
           console.error(logPrefix + `[Logo] loadMediaElement failed:`, err);
           if (isMounted.current) {
               setLogoElement(null);
               setLoadError(`Error loading logo.`); // Set user error for logo
           }
            if (objectUrlToClean) { try { URL.revokeObjectURL(objectUrlToClean); } catch (e) { console.error("Error revoking temp object URL:", e); }}
       } finally {
         if (isMounted.current) {
           setLoading(false);
         }
       }
        return () => { /* cleanup handled */ };

   }, [loadMediaElement, cleanupObjectURL]); // Dependencies: loadMediaElement and cleanupObjectURL helpers


  useEffect(() => {
      loadLogoEffect(logo, setIsLoadingLogo, setLogoElement, setLogoLoadError,
          () => { setLogoPosition({ x: 50, y: 90 }); setLogoZoom(10); }
      );
  }, [logo, loadLogoEffect, setLogoLoadError]); // Added setLogoLoadError to dependencies


  // Determine if saving is possible (only if both are loaded images)
  const canSaveComposite = useMemo(() => {
      // Ensure both left and right are loaded HTMLImageElements with valid dimensions
      const leftIsLoadedImage = !!leftMediaElement && leftMediaElement instanceof HTMLImageElement && leftMediaElement.naturalWidth > 0 && leftMediaElement.naturalHeight > 0;
      const rightIsLoadedImage = !!rightMediaElement && rightMediaElement instanceof HTMLImageElement && rightMediaElement.naturalWidth > 0 && rightMediaElement.naturalHeight > 0;

      // If a logo is provided (check by logo URL existence), ensure it's a loaded HTMLImageElement with valid dimensions and not currently loading
      const logoIsLoadedImageOrNotProvided = !logo || (logoElement instanceof HTMLImageElement && logoElement.naturalWidth > 0 && logoElement.naturalHeight > 0 && !isLoadingLogo);

      // Saving is possible only if both main sides are loaded images, the logo is loaded (if provided), and nothing is currently loading the main images.
      return leftIsLoadedImage && rightIsLoadedImage && logoIsLoadedImageOrNotProvided && !isLoadingLeft && !isLoadingRight;

  }, [logo, leftMediaElement, rightMediaElement, logoElement, isLoadingLeft, isLoadingRight, isLoadingLogo]);

  // --- Save Logic ---
  const saveCompositeImage = useCallback(async () => {
      if (!canSaveComposite) {
          setSaveError("Select two valid image files and ensure the logo (if selected) is loaded. Both left and right sides must be images.");
          // console.warn(logPrefix + "saveCompositeImage blocked: !canSaveComposite");
          return;
      }
      const safeLeftElement = leftMediaElement as HTMLImageElement; // Cast is safe due to canSaveComposite check
      const safeRightElement = rightMediaElement as HTMLImageElement; // Cast is safe due to canSaveComposite check
      const safeLogoElement = logoElement instanceof HTMLImageElement ? logoElement : null; // Only use logo if it's a valid image element


      setIsSaving(true);
      setSaveError(null); // Clear general save error at start of save
      // console.log(logPrefix + "saveCompositeImage START");

      try {
           // Use the *actual* dimensions of the loaded elements for the final canvas size calculations
           const targetWidthPerImage = Math.max(safeLeftElement.naturalWidth, safeRightElement.naturalWidth, 500); // Minimum 500px per side
           const finalWidth = targetWidthPerImage * 2; // Combined width

           // Calculate height proportionally based on the *display aspect ratio* of the preview area
           // Get the preview container by ID. Ensure it exists and has dimensions.
           const container = document.getElementById('combined-preview-container');
           const displayAspect = container && container.offsetWidth > 0 && container.offsetHeight > 0
               ? container.offsetWidth / container.offsetHeight
               : 16 / 9; // Default aspect if container not found or has zero dimensions

           const finalHeight = Math.ceil(finalWidth / displayAspect); // Scale height based on combined width and display aspect

           if (!Number.isFinite(finalWidth) || finalWidth <= 0 || !Number.isFinite(finalHeight) || finalHeight <= 0) {
               console.error(logPrefix + `Invalid final dimensions calculation: ${finalWidth}x${finalHeight}. Container dims: ${container?.offsetWidth}x${container?.offsetHeight}`);
               throw new Error(`Final image dimensions calculated invalid: ${finalWidth}x${finalHeight}.`);
           }
          // console.log(logPrefix + `Final canvas dimensions: ${finalWidth}x${finalHeight}`);


          const canvas = document.createElement('canvas');
          canvas.width = finalWidth;
          canvas.height = finalHeight;
          const ctx = canvas.getContext('2d', { alpha: true }); // Use alpha: true for potential transparency (like logo)
          if (!ctx) throw new Error("Could not get 2D context for final canvas.");

          ctx.fillStyle = '#ffffff'; // Draw white background first
          ctx.fillRect(0, 0, canvas.width, canvas.height);


           // Function to draw each section onto the final canvas (remains the same, uses ImageElements)
          const drawFinalMedia = ( finalCtx: CanvasRenderingContext2D, mediaEl: HTMLImageElement, section: 'left' | 'right', outputWidth: number, outputHeight: number, zoom: number, focus: RelativeFocus ) => {
             // console.log(logPrefix + `Drawing final section: ${section}`);
             finalCtx.save();
             const sectionWidth = outputWidth / 2;
             const sectionHeight = outputHeight;
             const sectionDx = section === 'left' ? 0 : sectionWidth;
             const sectionDy = 0;

             // Clip to the section area
             finalCtx.beginPath();
             finalCtx.rect(sectionDx, sectionDy, sectionWidth, sectionHeight);
             finalCtx.clip();

             const sourceWidth = mediaEl.naturalWidth;
             const sourceHeight = mediaEl.naturalHeight;
             if (sourceWidth <= 0 || sourceHeight <= 0) { finalCtx.restore(); return; }

             const overallScale = zoom / 100;
             const sourceAspect = sourceWidth / sourceHeight;
             const destAspect = sectionWidth / sectionHeight; // Aspect ratio of the destination area ON THE FINAL CANVAS

             // Calculate scale to COVER the destination area
             let coverScale: number;
             if (sourceAspect > destAspect) { coverScale = sectionHeight / sourceHeight; } // Source is wider relative to destination
             else { coverScale = sectionWidth / sourceWidth; } // Source is taller or same aspect ratio as destination

             const finalScale = coverScale * overallScale; // Final scale combining cover logic and user zoom
             if (finalScale <= 0 || !Number.isFinite(finalScale)) { finalCtx.restore(); return; }


             // Calculate the source area (sx, sy, sWidth, sHeight) to be drawn
             const sWidthFinal = sectionWidth / finalScale;
             const sHeightFinal = sectionHeight / finalScale;

             // Calculate the top-left point (sx, sy) in the source image using the relative focus
             const sxIdeal = sourceWidth * focus.x - sWidthFinal / 2;
             const syIdeal = sourceHeight * focus.y - sHeightFinal / 2;

             // Clamp sx, sy to stay within the source image bounds
             const sx = clamp(sxIdeal, 0, Math.max(0, sourceWidth - sWidthFinal));
             const sy = clamp(syIdeal, 0, Math.max(0, sourceHeight - sHeightFinal));
             const sWidth = sWidthFinal;
             const sHeight = sHeightFinal;

              // console.log(logPrefix + `[${section}] Final draw params: sx=${sx.toFixed(1)}, sy=${sy.toFixed(1)}, sW=${sWidth.toFixed(1)}, sH=${sHeight.toFixed(1)} -> dx=${sectionDx}, dy=${sectionDy}, dW=${sectionWidth}, dH=${sectionHeight}`);

              if (sWidth > 0 && sHeight > 0 && Number.isFinite(sx) && Number.isFinite(sy) && Number.isFinite(sWidth) && Number.isFinite(sHeight)) {
                  finalCtx.drawImage(mediaEl, sx, sy, sWidth, sHeight, sectionDx, sectionDy, sectionWidth, sectionHeight);
              } else {
                  console.warn(logPrefix + `[${section}] Skipping final drawImage due to invalid params.`);
              }

             finalCtx.restore(); // Remove the clip
         };


          // Draw the two halves onto the final canvas
          drawFinalMedia(ctx, safeLeftElement, 'left', finalWidth, finalHeight, leftZoom, leftRelativeFocus);
          drawFinalMedia(ctx, safeRightElement, 'right', finalWidth, finalHeight, rightZoom, rightRelativeFocus);


          // Draw the logo if it exists and loaded correctly (safeLogoElement is already checked in canSaveComposite)
          if (safeLogoElement) { // Simplified check since safeLogoElement existence implies it's a valid loaded image
               // console.log(logPrefix + "Drawing final logo");
               const logoAspectRatio = safeLogoElement.naturalHeight / safeLogoElement.naturalWidth;
               // Logo size is relative to the FINAL combined image width
               const targetLogoWidth = (finalWidth * logoZoom) / 100;
               const targetLogoHeight = targetLogoWidth * (isNaN(logoAspectRatio) ? 1 : logoAspectRatio);

               // Calculate logo center position in pixels on the final canvas
               const logoCenterX = (finalWidth * logoPosition.x) / 100;
               const logoCenterY = (finalHeight * logoPosition.y) / 100;

               // Calculate top-left position of the logo
               let logoDrawX = logoCenterX - targetLogoWidth / 2;
               let logoDrawY = logoCenterY - targetLogoHeight / 2;

               // Ensure logo stays fully within the canvas boundaries
               logoDrawX = clamp(logoDrawX, 0, Math.max(0, finalWidth - targetLogoWidth));
               logoDrawY = clamp(logoDrawY, 0, Math.max(0, finalHeight - targetLogoHeight));


               // console.log(logPrefix + `Final Logo draw params: x=${logoDrawX.toFixed(1)}, y=${logoDrawY.toFixed(1)}, w=${targetLogoWidth.toFixed(1)}, h=${targetLogoHeight.toFixed(1)}`);

               if (targetLogoWidth > 0 && targetLogoHeight > 0) {
                   ctx.drawImage(safeLogoElement, logoDrawX, logoDrawY, targetLogoWidth, targetLogoHeight);
               } else {
                   console.warn(logPrefix + `Skipping final logo draw due to invalid params.`);
               }
           }


        // Generate Blob and trigger download
        canvas.toBlob( (blob) => {
            if (blob && isMounted.current) {
                 // console.log(logPrefix + "Blob created successfully. Initiating download.");
                 const url = URL.createObjectURL(blob);
                 const a = document.createElement('a');
                 a.href = url;
                 a.download = 'imagem-combinada.png';
                 document.body.appendChild(a);
                 a.click();
                 document.body.removeChild(a);
                 URL.revokeObjectURL(url); // Clean up memory
                 setIsSaving(false);
            } else {
                if (!isMounted.current) {
                    // console.log(logPrefix + "Blob creation callback ignored: Component unmounted.");
                } else {
                     console.error(logPrefix + "Failed to generate final image blob.");
                     setSaveError("Falha ao gerar o blob da imagem final."); // Set overall save error
                     setIsSaving(false);
                  }
              }
          }, 'image/png', 0.95 ); // PNG quality

      } catch (error) {
          if (isMounted.current) {
               console.error(logPrefix + "Error during saveCompositeImage:", error);
               const msg = error instanceof Error ? error.message : String(error);
               setSaveError(`Falha ao salvar: ${msg}`); // Set overall save error
               setIsSaving(false);
          }
      }
    }, [canSaveComposite, leftMediaElement, rightMediaElement, leftZoom, rightZoom, leftRelativeFocus, rightRelativeFocus, logoElement, logoPosition, logoZoom, leftMediaType, rightMediaType, clamp, logo]); // Added logo to dependencies as it's checked in canSaveComposite


  return (
    <div className="w-full h-full flex flex-col items-stretch justify-start p-2 sm:p-4 overflow-y-auto"> {/* Added flex, h-full, overflow-y-auto */}
      {/* --- Title and Upload Cards --- */}
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-center">Editor de Combinação</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 md:mb-8">
        <MediaUploadCard
          id="left-media-upload"
          label="Mídia Esquerda"
          mediaUrl={leftMedia}
          mediaElement={leftMediaElement}
          mediaType={leftMediaType}
          isLoading={isLoadingLeft}
          error={leftLoadError} // Pass specific error to MediaUploadCard
          onFileSelect={(file) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              const result = event.target?.result;
              if (typeof result === 'string') {
                let detectedType: MediaType = null;
                if (file.type.startsWith('video/')) { detectedType = 'video'; }
                else if (file.type.startsWith('image/')) { detectedType = 'image'; }
                else { setLeftLoadError(`Tipo de arquivo não suportado: ${file.type}`); return; } // Set specific error
                setLeftMediaType(detectedType);
                setLeftMedia(result);
                setLeftLoadError(null); // Clear error on successful read
              } else { setLeftLoadError("Erro interno ao processar arquivo da esquerda."); } // Set specific error
            };
            reader.onerror = () => { setLeftLoadError("Erro ao ler o arquivo esquerdo."); }; // Set specific error
            reader.readAsDataURL(file);
          }}
        />
        <MediaUploadCard
          id="right-media-upload"
          label="Mídia Direita"
          mediaUrl={rightMedia}
          mediaElement={rightMediaElement}
          mediaType={rightMediaType}
          isLoading={isLoadingRight}
          error={rightLoadError} // Pass specific error to MediaUploadCard
          onFileSelect={(file) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              const result = event.target?.result;
              if (typeof result === 'string') {
                let detectedType: MediaType = null;
                if (file.type.startsWith('video/')) { detectedType = 'video'; }
                else if (file.type.startsWith('image/')) { detectedType = 'image'; }
                else { setRightLoadError(`Tipo de arquivo não suportado: ${file.type}`); return; } // Set specific error
                setRightMediaType(detectedType);
                setRightMedia(result);
                setRightLoadError(null); // Clear error on successful read
              } else { setRightLoadError("Erro interno ao processar arquivo da direita."); } // Set specific error
            };
            reader.onerror = () => { setRightLoadError("Erro ao ler o arquivo direito."); }; // Set specific error
            reader.readAsDataURL(file);
          }}
        />
        <MediaUploadCard
          id="logo-upload"
          label="Logo (Opcional)"
          accept="image/png,image/jpeg,image/webp,image/svg+xml" // Only image for logo
          mediaUrl={logo}
          mediaElement={logoElement}
          mediaType={'image'} // Always treat logo as image for loading card UI
          isLoading={isLoadingLogo}
          error={logoLoadError} // Pass specific error to MediaUploadCard
          onFileSelect={(file) => {
            if (!file.type.startsWith('image/')) {
               setLogoLoadError("Arquivo de logo deve ser uma imagem (ex: PNG, JPG, SVG)."); // Set specific error
               return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
              const res = ev.target?.result;
              if (typeof res === 'string') { setLogo(res); setLogoLoadError(null); } // Clear error on successful read
              else { setLogoLoadError("Erro interno ao ler logo."); } // Set specific error
            };
            reader.onerror = () => { setLogoLoadError("Erro ao ler logo."); }; // Set specific error
            reader.readAsDataURL(file);
          }}
        />
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 min-h-0"> {/* flex-1, min-h-0 to make it scroll correctly if needed */}
        {/* Preview Area */}
        <div className="lg:col-span-2 flex flex-col min-h-0"> {/* flex-col, min-h-0 */}
           <CombinedPreviewArea
              // Elements and state controlling rendering
              leftMediaElement={leftMediaElement}
              rightMediaElement={rightMediaElement}
              logoElement={logoElement}
              leftZoom={leftZoom}
              rightZoom={rightZoom}
              logoZoom={logoZoom}
              leftRelativeFocus={leftRelativeFocus}
              rightRelativeFocus={rightRelativeFocus}
              logoPosition={logoPosition}
              // Loading states for overlays
              isLoadingLeft={isLoadingLeft}
              isLoadingRight={isLoadingRight}
              isLoadingLogo={isLoadingLogo}
              // Pass specific error states down for overlays
              leftError={leftLoadError}
              rightError={rightLoadError}
              logoError={logoLoadError}
              // Callbacks to update parent state
              onLeftZoomChange={setLeftZoom}
              onRightZoomChange={setRightZoom}
              onLogoZoomChange={setLogoZoom}
              onLeftFocusChange={setLeftRelativeFocus}
              onRightFocusChange={setRightRelativeFocus}
              onLogoPositionChange={setLogoPosition}
              // Pass a unique ID for the container to reliably calculate final canvas dimensions
              containerId="combined-preview-container"
           />
           <DownloadSection
               onSave={saveCompositeImage}
               canSave={canSaveComposite} // Use the correctly named variable
               isSaving={isSaving}
               saveError={saveError} // Pass the general save error
               // Pass media types for the alert based on state
              leftMediaType={leftMediaType}
              rightMediaType={rightMediaType}
              isLoadingLeft={isLoadingLeft}
              isLoadingRight={isLoadingRight}
              isLoadingLogo={isLoadingLogo}
           />
        </div>

        {/* Control Panel */}
        <div className="lg:col-span-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-track-secondary scrollbar-thumb-primary scrollbar-thumb-rounded-full scrollbar-track-rounded-full"> {/* Added overflow-y-auto and scrollbar */}
          <ControlPanel
            leftZoom={leftZoom}
            setLeftZoom={setLeftZoom}
            rightZoom={rightZoom}
            setRightZoom={setRightZoom}
            logoZoom={logoZoom}
            setLogoZoom={setLogoZoom}
            logoPosition={logoPosition}
            setLogoPosition={setLogoPosition}
            leftMediaElement={leftMediaElement}
            rightMediaElement={rightMediaElement}
            logoElement={logoElement}
            isLoadingLeft={isLoadingLeft}
            isLoadingRight={isLoadingRight}
            isLoadingLogo={isLoadingLogo}
             // requestDraw is not strictly needed here anymore
          />
        </div>
      </div>

       {/* Removed AI Editor section to simplify the main layout */}
       {/* Keeping it separate or in a different view might be cleaner */}

    </div>
  );
}; // Export the component here

export default ImageCombiner; // Export as default