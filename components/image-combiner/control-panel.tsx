// components/image-combiner/control-panel.tsx
import React from 'react';
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ZoomIn, Move } from 'lucide-react';
// Import clamp from lib/utils
import { clamp } from '@/lib/utils';


const MIN_ZOOM = 10;
const MAX_ZOOM = 500; // Max zoom for images/videos

interface ControlPanelProps {
  leftZoom: number;
  setLeftZoom: (zoom: number) => void;
  rightZoom: number;
  setRightZoom: (zoom: number) => void;
  logoZoom: number;
  // Fix: Use setLogoZoom prop name
  setLogoZoom: (zoom: number) => void;
  logoPosition: { x: number; y: number };
  // Fix: Use setLogoPosition prop name
  setLogoPosition: (position: { x: number; y: number }) => void;
  leftMediaElement: HTMLImageElement | HTMLVideoElement | null;
  rightMediaElement: HTMLImageElement | HTMLVideoElement | null;
  logoElement: HTMLImageElement | null;
  isLoadingLeft: boolean;
  isLoadingRight: boolean;
  isLoadingLogo: boolean;
  // The requestDraw prop is likely not needed here anymore
  // requestDraw?: () => void;
}

export function ControlPanel({
  leftZoom,
  setLeftZoom,
  rightZoom,
  setRightZoom,
  logoZoom,
  // Fix: Destructure setLogoZoom
  setLogoZoom,
  logoPosition,
  // Fix: Destructure setLogoPosition
  setLogoPosition,
  leftMediaElement,
  rightMediaElement,
  logoElement,
  isLoadingLeft,
  isLoadingRight,
  isLoadingLogo,
  // requestDraw, // Remove if not needed
}: ControlPanelProps) {

  return (
    <Tabs defaultValue="left" className="w-full">
      <TabsList className="grid grid-cols-3 w-full">
        <TabsTrigger value="left" disabled={!leftMediaElement || isLoadingLeft}>Esquerda</TabsTrigger>
        <TabsTrigger value="right" disabled={!rightMediaElement || isLoadingRight}>Direita</TabsTrigger>
        <TabsTrigger value="logo" disabled={!logoElement || isLoadingLogo}>Logo</TabsTrigger>
      </TabsList>

      {/* --- Left Tab Content --- */}
      <TabsContent value="left" className="mt-4 space-y-4">
        <Card className="p-4">
          <Label htmlFor="left-zoom" className="block mb-2 font-medium flex items-center"><ZoomIn size={16} className="mr-2" /> Zoom ({leftZoom.toFixed(0)}%)</Label>
          <Slider
            id="left-zoom"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={1}
            value={[leftZoom]}
            // When zoom changes, update state. Drawing is handled by effect in preview area.
            onValueChange={(v) => { setLeftZoom(v[0]); /* requestDraw?.(); */ }}
            disabled={!leftMediaElement || isLoadingLeft}
            aria-label="Adjust left image zoom"
          />
          <div className="mt-4">
            <Label className="block mb-1 font-medium flex items-center"><Move size={16} className="mr-2" /> Posição (Foco)</Label>
            <p className="text-xs text-muted-foreground">Arraste a mídia na pré-visualização ou use a pinça (touch) para zoom.</p>
          </div>
        </Card>
      </TabsContent>

      {/* --- Right Tab Content --- */}
      <TabsContent value="right" className="mt-4 space-y-4">
        <Card className="p-4">
          <Label htmlFor="right-zoom" className="block mb-2 font-medium flex items-center"><ZoomIn size={16} className="mr-2" /> Zoom ({rightZoom.toFixed(0)}%)</Label>
          <Slider
            id="right-zoom"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={1}
            value={[rightZoom]}
             // When zoom changes, update state. Drawing is handled by effect in preview area.
            onValueChange={(v) => { setRightZoom(v[0]); /* requestDraw?.(); */ }}
            disabled={!rightMediaElement || isLoadingRight}
            aria-label="Adjust right image zoom"
          />
          <div className="mt-4">
            <Label className="block mb-1 font-medium flex items-center"><Move size={16} className="mr-2" /> Posição (Foco)</Label>
            <p className="text-xs text-muted-foreground">Arraste a mídia na pré-visualização ou use a pinça (touch) para zoom.</p>
          </div>
        </Card>
      </TabsContent>

      {/* --- Logo Tab Content --- */}
      <TabsContent value="logo" className="mt-4 space-y-4">
        <Card className="p-4">
          <Label htmlFor="logo-zoom" className="block mb-2 font-medium flex items-center"><ZoomIn size={16} className="mr-2" /> Largura Relativa ({logoZoom.toFixed(1)}%)</Label>
          {/* Max zoom/size for logo can be different, maybe relative to the container width? */}
          <Slider
            id="logo-zoom"
            min={1}
            max={50} // Logo max width is 50% of combined preview container width
            step={0.1}
            value={[logoZoom]}
            // Fix: Use setLogoZoom
            onValueChange={(v) => setLogoZoom(v[0])} // Call parent callback directly
            disabled={!logoElement || isLoadingLogo}
            aria-label="Adjust logo relative size"
          />
          <div className="mt-4">
            <Label className="block mb-1 font-medium flex items-center"><Move size={16} className="mr-2" /> Posição Central</Label>
            <p className="text-xs text-muted-foreground">Arraste o logo na pré-visualização ou ajuste abaixo.</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <Label htmlFor="logo-pos-x" className='text-xs text-muted-foreground'>X (%)</Label>
                <Input
                  id="logo-pos-x"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={logoPosition.x.toFixed(1)}
                   // Fix: Use setLogoPosition
                  onChange={(e) => setLogoPosition({ ...logoPosition, x: clamp(Number(e.target.value), 0, 100) })}
                  disabled={!logoElement || isLoadingLogo}
                  aria-label="Adjust logo horizontal position in percentage"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="logo-pos-y" className='text-xs text-muted-foreground'>Y (%)</Label>
                <Input
                  id="logo-pos-y"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={logoPosition.y.toFixed(1)}
                  // Fix: Use setLogoPosition
                  onChange={(e) => setLogoPosition({ ...logoPosition, y: clamp(Number(e.target.value), 0, 100) })}
                  disabled={!logoElement || isLoadingLogo}
                  aria-label="Adjust logo vertical position in percentage"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  );
}