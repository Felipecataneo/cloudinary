// components/image-combiner/combined-preview-area.tsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { cn } from '@/lib/utils';
import { clamp } from '@/lib/utils'; // Import clamp from lib/utils


// Types and Helpers
type DragType = 'left' | 'right' | 'logo' | null;
type PinchSide = 'left' | 'right' | null;
type RelativeFocus = { x: number; y: number };

const logPrefix = "[CombinedPreviewArea] ";
const calculateDistance = (touch1: Touch, touch2: Touch): number => {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

// Constants
const MIN_ZOOM = 10;
const MAX_ZOOM = 500;

interface CombinedPreviewAreaProps {
  leftMediaElement: HTMLImageElement | HTMLVideoElement | null;
  rightMediaElement: HTMLImageElement | HTMLVideoElement | null;
  logoElement: HTMLImageElement | null;

  leftZoom: number;
  rightZoom: number;
  logoZoom: number;

  leftRelativeFocus: RelativeFocus;
  rightRelativeFocus: RelativeFocus;
  logoPosition: { x: number; y: number };

  // Loading states are used for overlay UI, pass them down
  isLoadingLeft: boolean;
  isLoadingRight: boolean;
  isLoadingLogo: boolean;

   // Pass specific error messages if needed for overlays
   leftError: string | null; // Specific error for left loading
   rightError: string | null; // Specific error for right loading
   logoError: string | null; // Specific error for logo loading


  // Callbacks to update parent state
  onLeftZoomChange: (zoom: number) => void;
  onRightZoomChange: (zoom: number) => void;
  onLogoZoomChange: (zoom: number) => void;
  onLeftFocusChange: (focus: RelativeFocus) => void;
  onRightFocusChange: (focus: RelativeFocus) => void;
  onLogoPositionChange: (position: { x: number; y: number }) => void;

  containerId?: string; // Optional ID if needed for getElementById fallback
}

// Correct Export: Export the component as a named export
export function CombinedPreviewArea({
  leftMediaElement,
  rightMediaElement,
  logoElement,
  leftZoom,
  rightZoom,
  logoZoom,
  leftRelativeFocus,
  rightRelativeFocus,
  logoPosition,
  isLoadingLeft,
  isLoadingRight,
  isLoadingLogo,
  leftError, // Destructure specific error props
  rightError,
  logoError,
  onLeftZoomChange,
  onRightZoomChange,
  onLogoZoomChange,
  onLeftFocusChange,
  onRightFocusChange,
  onLogoPositionChange,
  containerId,
}: CombinedPreviewAreaProps) {

  // Refs for DOM elements
  const leftPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const combinedContainerRef = useRef<HTMLDivElement>(null); // Use useRef for the container
  const leftInteractiveRef = useRef<HTMLDivElement>(null);
  const rightInteractiveRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true); // To track component mount status
  const animationFrameId = useRef<number | null>(null); // For debouncing draws

  // State for Interactions (Managed internally)
  const [activeDrag, setActiveDrag] = useState<DragType>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialDragFocus, setInitialDragFocus] = useState<RelativeFocus>({ x: 0.5, y: 0.5 });
  const [initialLogoPos, setInitialLogoPos] = useState({ x: 50, y: 90 });
  const [isTouching, setIsTouching] = useState(false); // For drag with 1 finger (touch)

  const [isPinching, setIsPinching] = useState(false);
  const [initialPinchDistance, setInitialPinchDistance] = useState(0);
  const [pinchSide, setPinchSide] = useState<PinchSide>(null);
  const [zoomAtPinchStart, setZoomAtPinchStart] = useState(100);


  // --- Drawing Logic ---
  const drawMediaSection = useCallback((
    ctx: CanvasRenderingContext2D, mediaElement: HTMLImageElement | HTMLVideoElement | null, section: 'left' | 'right',
    targetCanvasWidth: number, targetCanvasHeight: number, zoomPercent: number, relativeFocus: RelativeFocus
  ) => {
    const dWidth = targetCanvasWidth / 2;
    const dHeight = targetCanvasHeight;
    const dx = 0; // Relative to the canvas
    const dy = 0; // Relative to the canvas

    ctx.save();
    try {
      ctx.clearRect(dx, dy, dWidth, dHeight);
      if (!mediaElement) {
        // console.log(logPrefix + `[${section}] drawMediaSection skipped: No media element.`);
        ctx.restore();
        return;
      }

      const isImage = mediaElement instanceof HTMLImageElement;
      const sourceWidth = (isImage ? mediaElement.naturalWidth : mediaElement.videoWidth) || 0;
      const sourceHeight = (isImage ? mediaElement.naturalHeight : mediaElement.videoHeight) || 0;

      if (!sourceWidth || !sourceHeight || sourceWidth <= 0 || sourceHeight <= 0) {
        // console.warn(logPrefix + `[${section}] drawMediaSection skipped: Invalid source dimensions (${sourceWidth}x${sourceHeight}).`);
        ctx.restore();
        return;
      }

      const overallScale = zoomPercent / 100;
      const sourceAspect = sourceWidth / sourceHeight;
      const destAspect = dWidth / dHeight;

      let coverScale: number;
      if (sourceAspect > destAspect) { // Source is wider relative to destination
        coverScale = dHeight / sourceHeight;
      } else { // Source is taller or same aspect
        coverScale = dWidth / sourceWidth;
      }

      const finalScale = coverScale * overallScale;

      if (finalScale <= 0 || !Number.isFinite(finalScale)) {
         // console.warn(logPrefix + `[${section}] Skipping draw due to invalid finalScale: ${finalScale}`);
         ctx.restore();
         return;
      }

      const sWidthFinal = dWidth / finalScale;
      const sHeightFinal = dHeight / finalScale;

      // Calculate source x, y to keep the relative focus point centered
      const sxIdeal = sourceWidth * relativeFocus.x - sWidthFinal / 2;
      const syIdeal = sourceHeight * relativeFocus.y - sHeightFinal / 2;

      // Clamp source x, y to keep the drawn area within the source image bounds
      const sx = clamp(sxIdeal, 0, Math.max(0, sourceWidth - sWidthFinal));
      const sy = clamp(syIdeal, 0, Math.max(0, sourceHeight - sHeightFinal));

      const sWidth = sWidthFinal;
      const sHeight = sHeightFinal;
      const dX = dx; // Destination x relative to canvas (always 0 for the canvas itself)
      const dY = dy; // Destination y relative to canvas (always 0 for the canvas itself)
      const dW = dWidth; // Destination width (full canvas width)
      const dH = dHeight; // Destination height (full canvas height)

      // console.log(logPrefix + `[${section}] drawMediaSection: sx=${sx.toFixed(1)}, sy=${sy.toFixed(1)}, sW=${sWidth.toFixed(1)}, sH=${sHeight.toFixed(1)} -> dx=${dX}, dy=${dY}, dW=${dW}, dH=${dH}`);


      if (sWidth > 0 && sHeight > 0 && dW > 0 && dH > 0 && Number.isFinite(sx) && Number.isFinite(sy) && Number.isFinite(sWidth) && Number.isFinite(sHeight)) {
        ctx.drawImage(mediaElement, sx, sy, sWidth, sHeight, dX, dY, dW, dH);
      } else {
         console.warn(logPrefix + `[${section}] Skipping drawImage due to zero/invalid draw params.`);
      }

    } catch (e) {
      console.error(logPrefix + `[${section}] Error during drawMediaSection execution:`, e);
      // Optionally draw an error indicator on the canvas
      ctx.fillStyle = 'red'; ctx.fillRect(dx, dy, dWidth, dHeight);
      ctx.fillStyle = 'white'; ctx.fillText('Draw Error', dx + 10, dy + 20);
    } finally {
      ctx.restore();
    }
  }, [clamp]); // Dependencies: clamp function


  const drawPreviewCanvases = useCallback(() => {
    // console.log(logPrefix + "drawPreviewCanvases called");
    const leftCanvas = leftPreviewCanvasRef.current;
    const rightCanvas = rightPreviewCanvasRef.current;
    const container = combinedContainerRef.current;

    if (!container || !leftCanvas || !rightCanvas || !isMounted.current) {
      // console.log(logPrefix + "drawPreviewCanvases skipped: Missing refs or unmounted.");
      animationFrameId.current = null; // Ensure frame ID is cleared if skipped
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    if (containerWidth <= 0 || containerHeight <= 0) {
      // console.log(logPrefix + "drawPreviewCanvases skipped: Zero container dimensions.");
      animationFrameId.current = null; // Ensure frame ID is cleared if skipped
      return;
    }

    const previewHalfWidth = Math.max(1, Math.floor(containerWidth / 2));
    const previewHeight = Math.max(1, containerHeight);

    let needsResizeLeft = false;
    let needsResizeRight = false;

    // Resize canvases if container size changed
    if (leftCanvas.width !== previewHalfWidth || leftCanvas.height !== previewHeight) {
      leftCanvas.width = previewHalfWidth;
      leftCanvas.height = previewHeight;
      needsResizeLeft = true;
    }
    if (rightCanvas.width !== previewHalfWidth || rightCanvas.height !== previewHeight) {
      rightCanvas.width = previewHalfWidth;
      rightCanvas.height = previewHeight;
      needsResizeRight = true;
    }

    const leftCtx = leftCanvas.getContext('2d');
    const rightCtx = rightCanvas.getContext('2d');

    if (leftCtx) {
        // If resized, clear the canvas explicitly before drawing
        if (needsResizeLeft) leftCtx.clearRect(0, 0, previewHalfWidth, previewHeight);
        drawMediaSection(leftCtx, leftMediaElement, 'left', containerWidth, previewHeight, leftZoom, leftRelativeFocus);
    } else {
        console.error(logPrefix + "Failed to get left preview context.");
    }

    if (rightCtx) {
        // If resized, clear the canvas explicitly before drawing
        if (needsResizeRight) rightCtx.clearRect(0, 0, previewHalfWidth, previewHeight);
        drawMediaSection(rightCtx, rightMediaElement, 'right', containerWidth, previewHeight, rightZoom, rightRelativeFocus);
    } else {
        console.error(logPrefix + "Failed to get right preview context.");
    }

    // Reset the animation frame ID after drawing is complete
    animationFrameId.current = null;

  }, [drawMediaSection, leftMediaElement, rightMediaElement, leftZoom, rightZoom, leftRelativeFocus, rightRelativeFocus]); // Dependencies: state and elements used for drawing


  const requestDraw = useCallback(() => {
    // Request a new frame only if one is not already pending
    if (animationFrameId.current === null && isMounted.current) {
      animationFrameId.current = requestAnimationFrame(drawPreviewCanvases);
    }
  }, [drawPreviewCanvases]); // Dependencies: The drawing function itself


  // Effect to perform initial draw and redraw on container resize
  useEffect(() => {
    const container = combinedContainerRef.current;
    if (!container) return;

    // Initial draw (allow some time for layout)
    const initialDrawTimeout = setTimeout(() => {
      if (isMounted.current && combinedContainerRef.current) {
        requestDraw();
      }
    }, 50); // Small delay to ensure layout is stable

    // Redraw on container resize
    const resizeObserver = new ResizeObserver(entries => {
      // We don't need to check entries, just knowing the container size might have changed is enough
      requestDraw();
    });

    resizeObserver.observe(container);

    // Cleanup
    return () => {
      clearTimeout(initialDrawTimeout);
      resizeObserver.disconnect();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
    // Dependencies: requestDraw function.
  }, [requestDraw]);


  // Effect to redraw when media elements, zoom, or focus change
  useEffect(() => {
    // Only redraw canvases if left or right media/zoom/focus changes.
    requestDraw();
  }, [leftMediaElement, rightMediaElement, leftZoom, rightZoom, leftRelativeFocus, rightRelativeFocus, requestDraw]); // Dependencies: elements and state that affect canvas drawing


  // --- Interaction Handlers ---
  const handleInteractionStart = useCallback((clientX: number, clientY: number, type: Exclude<DragType, null>, isTouch: boolean) => {
    // console.log(logPrefix + `handleInteractionStart: type=${type}, isTouch=${isTouch}`);

    // Defensivamente resetar estados ANTES de verificar condições
    setActiveDrag(null);
    setIsPinching(false); // Will be set to true later if it's pinch
    setPinchSide(null);
    setInitialPinchDistance(0);
    setIsTouching(isTouch); // Define if it's touch right at the start

    // Check if the corresponding media exists
    const mediaExists = (type === 'left' && leftMediaElement) ||
                       (type === 'right' && rightMediaElement) ||
                       (type === 'logo' && logoElement);

    if (!mediaExists) {
      // console.log(logPrefix + `InteractionStart blocked: No media for type ${type}.`);
      setIsTouching(false); // Ensure reset if fail
      return false; // Indicate failure
    }

    // If touch and we are already pinching, do not start drag
    if (isTouch && isPinching) {
        // console.log(logPrefix + "handleInteractionStart (touch) blocked: Already pinching.");
        return false;
    }

    // Start DRAG
    setActiveDrag(type);
    setDragStart({ x: clientX, y: clientY });
    if (type === 'left') setInitialDragFocus(leftRelativeFocus);
    else if (type === 'right') setInitialDragFocus(rightRelativeFocus);
    else if (type === 'logo') setInitialLogoPos(logoPosition);

    // console.log(logPrefix + `handleInteractionStart SUCCESS: Drag started for ${type}. Initial Focus/Pos set.`);
    return true; // Indicate success

  }, [leftMediaElement, rightMediaElement, logoElement, isPinching, leftRelativeFocus, rightRelativeFocus, logoPosition]);


  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    // Ignore if not an active drag or if pinching
    if (!activeDrag || isPinching) {
      // console.log(logPrefix + `handleDragMove blocked: activeDrag=${activeDrag}, isPinching=${isPinching}`);
      return;
    }
    // console.log(logPrefix + `handleDragMove EXECUTE for ${activeDrag}`);

    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;
    const container = combinedContainerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    const previewHalfWidth = containerWidth / 2;
    let needsRedraw = false;

    const panMedia = (mediaElement: HTMLImageElement | HTMLVideoElement, zoom: number, setRelativeFocus: (focus: RelativeFocus) => void, initialFocus: RelativeFocus) => {
      const currentZoom = zoom / 100;
      const sourceWidth = ('naturalWidth' in mediaElement ? mediaElement.naturalWidth : mediaElement.videoWidth) || 1;
      const sourceHeight = ('naturalHeight' in mediaElement ? mediaElement.naturalHeight : mediaElement.videoHeight) || 1;
      const destAspect = previewHalfWidth / containerHeight;
      const sourceAspect = sourceWidth / sourceHeight;
      const scaleToCover = (sourceAspect > destAspect) ? (containerHeight / sourceHeight) : (previewHalfWidth / sourceWidth);
      const finalScale = scaleToCover * currentZoom;
      if (finalScale <= 0 || !Number.isFinite(finalScale)) return false;

      // Delta de foco é relativo ao tamanho da *fonte* escalada na tela
      const effectiveFocusDeltaX = deltaX / (sourceWidth * finalScale);
      const effectiveFocusDeltaY = deltaY / (sourceHeight * finalScale);

      const newFocusX = clamp(initialFocus.x - effectiveFocusDeltaX, 0, 1);
      const newFocusY = clamp(initialFocus.y - effectiveFocusDeltaY, 0, 1);

      // Call the parent callback only if the value actually changed
      let focusChanged = false;
      if ((activeDrag === 'left' && (newFocusX !== leftRelativeFocus.x || newFocusY !== leftRelativeFocus.y)) ||
          (activeDrag === 'right' && (newFocusX !== rightRelativeFocus.x || newFocusY !== rightRelativeFocus.y))) {
          setRelativeFocus({ x: newFocusX, y: newFocusY });
          focusChanged = true;
      }
      return focusChanged; // Return if there was a change requiring redraw
    };


    if (activeDrag === 'left' && leftMediaElement) {
        if (panMedia(leftMediaElement, leftZoom, onLeftFocusChange, initialDragFocus)) { needsRedraw = true; }
    } else if (activeDrag === 'right' && rightMediaElement) {
        if (panMedia(rightMediaElement, rightZoom, onRightFocusChange, initialDragFocus)) { needsRedraw = true; }
    } else if (activeDrag === 'logo' && logoElement) {
        const percentDeltaX = (deltaX / containerWidth) * 100;
        const percentDeltaY = (deltaY / containerHeight) * 100;
        const newLogoX = clamp(initialLogoPos.x + percentDeltaX, 0, 100);
        const newLogoY = clamp(initialLogoPos.y + percentDeltaY, 0, 100);

        // Call parent callback only if value changed
        if (newLogoX !== logoPosition.x || newLogoY !== logoPosition.y) {
             onLogoPositionChange({ x: newLogoX, y: newLogoY });
             // Logo movement is handled by CSS style, no canvas redraw needed
        }
    }

    if (needsRedraw) {
      requestDraw(); // Use helper to avoid duplicate rAF
    }
  }, [activeDrag, isPinching, dragStart, initialDragFocus, initialLogoPos, leftMediaElement, rightMediaElement, logoElement, leftZoom, rightZoom, leftRelativeFocus, rightRelativeFocus, logoPosition, onLeftFocusChange, onRightFocusChange, onLogoPositionChange, requestDraw, clamp]);


  const handleDragEnd = useCallback(() => {
    if (activeDrag) {
        // console.log(logPrefix + `handleDragEnd: Ending drag for ${activeDrag}.`);
        setActiveDrag(null);
        // Do NOT reset isTouching or isPinching here, this is done by touch/mouse end handlers
    }
    // Cancel any pending rAF when interaction ends
    if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
    }
  }, [activeDrag]);


  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, type: Exclude<DragType, null>) => {
    // console.log(logPrefix + `handleMouseDown: type=${type}, button=${e.button}`);
    if (e.button !== 0) return; // Only left button

    const target = e.target as HTMLElement;
    const isInteractive = target.getAttribute('data-interactive-area') === String(type);
    const isLogo = type === 'logo' && target.closest('[data-logo-container]');

    if (isInteractive || isLogo) {
      e.preventDefault(); // Prevent text selection, etc.
      e.stopPropagation();
      // Call central start handler, indicating NOT touch
      handleInteractionStart(e.clientX, e.clientY, type, false);
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    // Only move if drag is active AND it's not touch AND not pinching
    if (activeDrag && !isTouching && !isPinching) {
        // No need for preventDefault here usually
        handleDragMove(e.clientX, e.clientY);
    }
  }, [activeDrag, isTouching, isPinching, handleDragMove]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    // Only finalize if it's left button AND drag was active AND not touch/pinch
    if (e.button === 0 && activeDrag && !isTouching && !isPinching) {
         // console.log(logPrefix + "handleMouseUp: Calling handleDragEnd.");
         handleDragEnd();
    }
     // Reset isTouching (though shouldn't be true for mouse) for safety
     if (isTouching) setIsTouching(false);

  }, [activeDrag, isTouching, isPinching, handleDragEnd]);


  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>, type: Exclude<DragType, null>) => {
    // console.log(logPrefix + `handleTouchStart: type=${type}, touches=${e.touches.length}`);

    const target = e.target as HTMLElement;
    const isInteractiveArea = target.getAttribute('data-interactive-area') === String(type);
    const isLogoArea = type === 'logo' && target.closest('[data-logo-container]');

    if (!isInteractiveArea && !isLogoArea) {
      // console.log(logPrefix + "handleTouchStart ignored: Target mismatch.");
      return; // Not on the right area
    }

    // Check media existence BEFORE interacting
    const mediaExists = (type === 'left' && leftMediaElement) ||
                         (type === 'right' && rightMediaElement) ||
                         (type === 'logo' && logoElement);
    if (!mediaExists) {
       // console.log(logPrefix + `handleTouchStart ignored: No media for ${type}.`);
       return;
    }

    // --- Process Toques ---
    const currentTouches = e.touches;

    if (currentTouches.length === 1 && type !== 'logo' && !isPinching) {
       // --- Start 1-finger Drag (Left/Right) ---
       // console.log(logPrefix + "handleTouchStart: Attempting 1-finger drag start.");
       e.stopPropagation(); // Prevent bubbling
       // e.preventDefault(); // Maybe prevent default for drag if scroll is an issue
       const touch = currentTouches[0];
       if (handleInteractionStart(touch.clientX, touch.clientY, type, true)) {
           // Drag started successfully
       }

    } else if (currentTouches.length === 1 && type === 'logo' && !isPinching) {
      // --- Start 1-finger Drag (Logo) ---
      // console.log(logPrefix + "handleTouchStart: Attempting 1-finger logo drag start.");
      e.stopPropagation();
      // e.preventDefault(); // Can prevent default for logo drag to disable scroll
      const touch = currentTouches[0];
      if (handleInteractionStart(touch.clientX, touch.clientY, type, true)) {
          // Drag started successfully
      }

    } else if (currentTouches.length === 2 && type !== 'logo') {
       // --- Start/Continue Pinch (Esquerda/Direita) ---
       // console.log(logPrefix + "handleTouchStart: Detected 2 touches, initiating Pinch.");
       e.stopPropagation();
       e.preventDefault(); // ESSENTIAL for pinch

       // Cancel active drag if any (pinch takes priority)
       if (activeDrag) {
           // console.log(logPrefix + "handleTouchStart: Cancelling active drag due to pinch.");
           handleDragEnd(); // Clears activeDrag
       }

       // Setup pinch state
       setIsPinching(true);
       setIsTouching(false); // Pinch is not touch drag
       setPinchSide(type);
       const initialDist = calculateDistance(currentTouches[0] as Touch, currentTouches[1] as Touch);
       setInitialPinchDistance(initialDist);
       setZoomAtPinchStart(type === 'left' ? leftZoom : rightZoom);

    } else {
      // console.log(logPrefix + `handleTouchStart: Ignoring touch event - touches=${currentTouches.length}, type=${type}, isPinching=${isPinching}`);
      // More than 2 fingers, or 1 finger while already pinching, etc. Do nothing.
    }
  }, [activeDrag, isPinching, leftMediaElement, rightMediaElement, logoElement, handleInteractionStart, handleDragEnd, leftZoom, rightZoom, setInitialPinchDistance, setPinchSide, setZoomAtPinchStart]);


  const handleTouchMove = useCallback((e: TouchEvent) => {
    // console.log(logPrefix + `handleTouchMove: touches=${e.touches.length}, isPinching=${isPinching}, isTouching=${isTouching}, activeDrag=${activeDrag}`);
    if (isPinching && e.touches.length === 2 && pinchSide) {
      // --- Pinch Logic ---
      e.preventDefault(); // ESSENTIAL to prevent browser zoom/scroll
      const currentDist = calculateDistance(e.touches[0] as Touch, e.touches[1] as Touch);
      if (initialPinchDistance <= 0) return; // Avoid division by zero

      const scale = currentDist / initialPinchDistance;
      const newZoom = clamp(zoomAtPinchStart * scale, MIN_ZOOM, MAX_ZOOM);

      // Call parent callback only if value changed
      let zoomChanged = false;
      if (pinchSide === 'left') {
          if (leftZoom !== newZoom) {
              onLeftZoomChange(newZoom);
              zoomChanged = true;
          }
      } else if (pinchSide === 'right') {
           if (rightZoom !== newZoom) {
               onRightZoomChange(newZoom);
               zoomChanged = true;
           }
      }

      if (zoomChanged) {
        requestDraw(); // Redraw if zoom changed
      }

    } else if (activeDrag && isTouching && e.touches.length === 1 && !isPinching) {
       // --- Drag Logic (1 finger) ---
       e.preventDefault(); // <<<< ESSENTIAL for touch drag to work smoothly
       handleDragMove(e.touches[0].clientX, e.touches[0].clientY);

    } else if (isPinching && e.touches.length !== 2) {
       // console.log(logPrefix + "handleTouchMove: Pinch interrupted (touch count changed).");
       // Number of fingers changed during pinch, end pinch? (handleTouchEnd will do this)

    } else if (activeDrag && isTouching && e.touches.length !== 1) {
       // console.log(logPrefix + "handleTouchMove: Touch drag interrupted (touch count changed).");
       // Number of fingers changed during drag, end drag? (handleTouchEnd will do this)
    }
  }, [isPinching, pinchSide, initialPinchDistance, zoomAtPinchStart, activeDrag, isTouching, handleDragMove, requestDraw, leftZoom, rightZoom, onLeftZoomChange, onRightZoomChange, clamp]);


  const handleTouchEnd = useCallback((e: TouchEvent) => {
     // console.log(logPrefix + `handleTouchEnd: touches=${e.touches.length}, isPinching=${isPinching}, isTouching=${isTouching}, activeDrag=${activeDrag}`);
     const touchesRemaining = e.touches.length;

     if (touchesRemaining === 0) {
         // Last finger lifted - Reset ALL touch-related states
         // console.log(logPrefix + "handleTouchEnd: 0 touches remaining. Resetting all touch states.");
         if (activeDrag && isTouching) {
             handleDragEnd(); // End the drag that was active via touch
         }
         setIsTouching(false);
         setIsPinching(false);
         setPinchSide(null);
         setInitialPinchDistance(0);
     } else if (touchesRemaining < 2 && isPinching) {
         // Was pinching, but now less than 2 fingers - End Pinch
         // console.log(logPrefix + "handleTouchEnd: Pinch ended (< 2 touches).");
         setIsPinching(false);
         setPinchSide(null);
         setInitialPinchDistance(0);
         // If 1 finger remains, it might start a NEW drag on the next touchstart/move,
         // but the current pinch is over. Do not reset isTouching here.
     }
     // If resta 1 dedo e estava em drag (isTouching=true), the drag continues until the last dedo sair.
     // If resta 1 dedo e estava em pinch, the pinch parou, isPinching=false.

     // Safety check: Ensure isTouching is false if no touches remain
     if (isTouching && touchesRemaining === 0) { // Added touchesRemaining check
         setIsTouching(false);
     }

  }, [isPinching, isTouching, activeDrag, handleDragEnd, setInitialPinchDistance, setPinchSide, setIsPinching, setIsTouching, setActiveDrag]);


  const handleWheelZoom = useCallback((e: WheelEvent, side: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();

    const zoomAmount = e.deltaY * -0.15; // Adjusted sensitivity
    let currentZoom, setZoom;

    if (side === 'left') {
        currentZoom = leftZoom;
        setZoom = onLeftZoomChange;
        if (!leftMediaElement) return; // Only zoom if media exists
    } else { // side === 'right'
        currentZoom = rightZoom;
        setZoom = onRightZoomChange;
        if (!rightMediaElement) return; // Only zoom if media exists
    }

    const newZoom = clamp(currentZoom + zoomAmount, MIN_ZOOM, MAX_ZOOM);

    if (newZoom !== currentZoom) {
        setZoom(newZoom);
        requestDraw(); // Request redraw if zoom changed
    }
  }, [leftZoom, rightZoom, leftMediaElement, rightMediaElement, onLeftZoomChange, onRightZoomChange, requestDraw, clamp]);


  // Effect for Global Mouse/Touch Listeners
  useEffect(() => {
      // passive: false is required for preventDefault in touchmove
      const touchMoveOptions: AddEventListenerOptions = { passive: false };
      // passive: true for touchstart/touchend is recommended by Chrome DevTools
      const otherTouchOptions: AddEventListenerOptions = { passive: true };

      const addListeners = () => {
           // console.log(logPrefix + `Adding global listeners: activeDrag=${activeDrag}, isTouching=${isTouching}, isPinching=${isPinching}`);
           // Touch listeners (always added if there's a touch/pinch interaction potential)
           document.addEventListener('touchmove', handleTouchMove, touchMoveOptions);
           document.addEventListener('touchend', handleTouchEnd as EventListener, otherTouchOptions); // Cast needed for TS
           document.addEventListener('touchcancel', handleTouchEnd as EventListener, otherTouchOptions); // Cast needed for TS

           // Mouse listeners (only add if it's a MOUSE drag)
           if (activeDrag && !isTouching && !isPinching) {
               document.addEventListener('mousemove', handleMouseMove);
               document.addEventListener('mouseup', handleMouseUp);
               // Change cursor and prevent selection only during active mouse drag
               document.body.style.cursor = 'grabbing';
               document.body.style.userSelect = 'none';
           }
      };

      const removeListeners = () => {
          // console.log(logPrefix + "Removing global listeners.");
          document.removeEventListener('touchmove', handleTouchMove, touchMoveOptions); // Needs same options
          document.removeEventListener('touchend', handleTouchEnd as EventListener, otherTouchOptions);
          document.removeEventListener('touchcancel', handleTouchEnd as EventListener, otherTouchOptions);
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);

          // Reset body styles only if NO interaction is active
          if (!activeDrag && !isPinching && !isTouching) {
              document.body.style.cursor = '';
              document.body.style.userSelect = '';
          }
      };

      // Add listeners IF there is ANY active interaction state
      if (activeDrag || isTouching || isPinching) {
          addListeners();
      } else {
          // Ensure styles are reset if nothing is active when dependencies change
           document.body.style.cursor = '';
           document.body.style.userSelect = '';
      }


      // Cleanup function ALWAYS removes all listeners for safety
      return () => {
          removeListeners();
          // Also ensure reset on unmount or effect re-run
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          // console.log(logPrefix + "Cleanup global listeners effect.");
      };
  // Dependencies: state variables that indicate an active interaction + the handler functions
  }, [activeDrag, isTouching, isPinching, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);


  // Effect for Wheel listeners (added directly to the interactive divs)
  useEffect(() => {
      const leftDiv = leftInteractiveRef.current;
      const rightDiv = rightInteractiveRef.current;
      const wheelOptions: AddEventListenerOptions = { passive: false }; // Needed for preventDefault

      const wheelHandlerLeft = (e: Event) => { if (e instanceof WheelEvent) handleWheelZoom(e, 'left'); };
      const wheelHandlerRight = (e: Event) => { if (e instanceof WheelEvent) handleWheelZoom(e, 'right'); };

      if (leftDiv) { leftDiv.addEventListener('wheel', wheelHandlerLeft, wheelOptions); }
      if (rightDiv) { rightDiv.addEventListener('wheel', wheelHandlerRight, wheelOptions); }

      return () => {
          if (leftDiv) { leftDiv.removeEventListener('wheel', wheelHandlerLeft, wheelOptions); }
          if (rightDiv) { rightDiv.removeEventListener('wheel', wheelHandlerRight, wheelOptions); }
      };
    // Dependencies: handleWheelZoom function (includes current zooms, elements, setters)
  }, [handleWheelZoom]);


  // --- Calculate Logo Styles ---
  const getLogoStyle = useMemo((): React.CSSProperties => {
    const container = combinedContainerRef.current;
    // Fix: Check if logoElement is valid (loaded image) instead of logo URL
    if (!container || !logoElement || !(logoElement instanceof HTMLImageElement) || logoElement.naturalWidth <= 0 || logoElement.naturalHeight <= 0) {
      return { display: 'none' };
    }

    const previewContainerWidth = container.offsetWidth;
    const previewContainerHeight = container.offsetHeight;
    if (previewContainerWidth <= 0 || previewContainerHeight <= 0) {
      return { display: 'none' };
    }

    const previewLogoWidthPx = (previewContainerWidth * logoZoom) / 100;
    const aspectRatio = logoElement.naturalHeight / logoElement.naturalWidth;
    const previewLogoHeightPx = previewLogoWidthPx * (isNaN(aspectRatio) ? 1 : aspectRatio);

    // Calculate center position in pixels relative to the container
    const logoCenterX = (previewContainerWidth * logoPosition.x) / 100;
    const logoCenterY = (previewContainerHeight * logoPosition.y) / 100;

    // Calculate top-left position
    const topLeftX = logoCenterX - previewLogoWidthPx / 2;
    const topLeftY = logoCenterY - previewLogoHeightPx / 2;

    return {
      position: 'absolute',
      left: `${topLeftX}px`,
      top: `${topLeftY}px`,
      width: `${previewLogoWidthPx}px`,
      height: `${previewLogoHeightPx}px`,
      // Cursor changes based on active drag state and element existence
      cursor: activeDrag === 'logo' ? 'grabbing' : (logoElement ? 'grab' : 'default'),
      zIndex: 10, // Ensure logo is above canvases
      userSelect: 'none',
      WebkitUserSelect: 'none', // For Safari
      MozUserSelect: 'none', // For Firefox
      touchAction: 'none', // Prevent default touch actions like scroll/zoom
      backgroundImage: `url(${logoElement.src})`, // Use element.src as it's the loaded data URL
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      border: `1px dashed ${activeDrag === 'logo' ? 'rgba(0, 100, 255, 0.8)' : 'transparent'}`,
      opacity: activeDrag === 'logo' ? 0.8 : 1.0, // Subtle feedback on drag
      transition: 'border-color 0.2s ease, opacity 0.2s ease', // Smooth transition for border/opacity',
      // Disable pointer events if logo is loading or failed to load
      pointerEvents: (isLoadingLogo || !logoElement || !(logoElement instanceof HTMLImageElement) || logoElement.naturalWidth <= 0 || logoElement.naturalHeight <= 0) ? 'none' : 'auto',
    };
  }, [combinedContainerRef, logoElement, logoZoom, logoPosition, activeDrag, isLoadingLogo]); // Dependencies: relevant state and refs for calculation


  return (
    <Card
      id={containerId} // Assign the ID here if passed
      className="p-0 bg-gradient-to-br from-slate-600 to-slate-800 dark:from-slate-800 dark:to-slate-950 relative overflow-hidden aspect-video select-none shadow-lg flex-1 min-h-0" // Added flex-1, min-h-0
      ref={combinedContainerRef} // Assign ref to the main container Card
      // Define touch-action for the parent container to control default behavior
      // 'none' prevents browser scroll/zoom WITHIN this area
      style={{ cursor: activeDrag ? 'grabbing' : (isPinching ? 'zoom-in' : 'default'), touchAction: 'none' }} // Cursor for the *container* when dragging or pinching
    >
      <div className="flex h-full w-full relative isolate"> {/* isolate for z-index */}
        {/* --- Left Interactive Area --- */}
        {/* Use ref={leftInteractiveRef} and data-interactive-area="left" */}
        {/* ... (rest of left area) ... */}
         <div
              ref={leftInteractiveRef} // Keep ref for direct access if needed
              data-interactive-area="left" // Data attribute to identify area
              className={cn(
                "w-1/2 h-full relative border-r border-dashed border-gray-500/50 dark:border-gray-600/50 flex items-center justify-center overflow-hidden", // overflow hidden to crop preview
                // Cursor changes based on element presence and drag state
                leftMediaElement ? (activeDrag === 'left' ? 'cursor-grabbing' : 'cursor-grab') : "cursor-default"
              )}
              onMouseDown={(e) => handleMouseDown(e, 'left')}
              onTouchStart={(e) => handleTouchStart(e, 'left')}
              // wheel handler is added via useEffect
            >
              <canvas ref={leftPreviewCanvasRef} className="absolute top-0 left-0 w-full h-full block pointer-events-none z-0" aria-label="Left interactive preview" />
              {isLoadingLeft && (<div className="absolute inset-0 flex items-center justify-center text-gray-200 text-sm font-medium pointer-events-none bg-black/60 z-[5]"> Carregando Esquerda... </div>)}
              {!leftMediaElement && !isLoadingLeft && !leftError && (<div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm pointer-events-none z-[5]"> Selecione um arquivo... </div>)} {/* Adjusted text */}
              {/* Fix: Use leftError prop for display */}
              {leftError && !isLoadingLeft && (<div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm font-medium p-2 text-center pointer-events-none bg-black/60 z-[5]"> Falha: {leftError} </div>)}
            </div>

            {/* --- Right Interactive Area --- */}
            {/* Use ref={rightInteractiveRef} and data-interactive-area="right" */}
            {/* ... (rest of right area) ... */}
             <div
               ref={rightInteractiveRef} // Keep ref for direct access if needed
               data-interactive-area="right" // Data attribute to identify area
               className={cn(
                 "w-1/2 h-full relative flex items-center justify-center overflow-hidden", // overflow hidden to crop preview
                  // Cursor changes based on element presence and drag state
                  rightMediaElement ? (activeDrag === 'right' ? 'cursor-grabbing' : 'cursor-grab') : "cursor-default"
               )}
               onMouseDown={(e) => handleMouseDown(e, 'right')}
               onTouchStart={(e) => handleTouchStart(e, 'right')}
               // wheel handler is added via useEffect
             >
               <canvas ref={rightPreviewCanvasRef} className="absolute top-0 left-0 w-full h-full block pointer-events-none z-0" aria-label="Right interactive preview" />
               {isLoadingRight && (<div className="absolute inset-0 flex items-center justify-center text-gray-200 text-sm font-medium pointer-events-none bg-black/60 z-[5]"> Carregando Direita... </div>)}
               {!rightMediaElement && !isLoadingRight && !rightError && (<div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm pointer-events-none z-[5]"> Selecione um arquivo... </div>)} {/* Adjusted text */}
               {/* Fix: Use rightError prop for display */}
               {rightError && !isLoadingRight && (<div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm font-medium p-2 text-center pointer-events-none bg-black/60 z-[5]"> Falha: {rightError} </div>)}
             </div>

             {/* --- Logo Interactive Area --- */}
             {/* Use data-logo-container */}
             {/* ... (rest of logo area) ... */}
              {/* Fix: Check logoElement existence and if it's an image for rendering */}
              {logoElement && logoElement instanceof HTMLImageElement && logoElement.naturalWidth > 0 && !isLoadingLogo && (
                 <div
                   data-logo-container // Data attribute for logo area
                   style={getLogoStyle} // Styles calculated by useMemo
                   onMouseDown={(e) => handleMouseDown(e, 'logo')}
                   onTouchStart={(e) => handleTouchStart(e, 'logo')}
                   role="button" // Semantic role
                   aria-label="Mover e redimensionar logo"
                   tabIndex={0} // Allow keyboard focus (though main interaction is drag)
                   className="hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 rounded-sm" // Focus styles
                 >
                   {/* Logo image is set as background-image via style */}
                 </div>
              )}

              {/* Overlay for Logo Loading */}
              {isLoadingLogo && (<div className="absolute inset-0 flex items-center justify-center text-gray-200 text-sm font-medium pointer-events-none bg-black/60 z-[15]"> Carregando Logo... </div>)}

              {/* Overlay for Logo Load Failure */}
              {/* Fix: Check if logoError exists and we're not loading */}
              {logoError && !isLoadingLogo && (<div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm font-medium p-2 text-center pointer-events-none bg-black/60 z-[15]"> Falha: {logoError} </div>)}


       </div>
     </Card>
   );
 }