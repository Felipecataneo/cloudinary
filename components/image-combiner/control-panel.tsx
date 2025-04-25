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
          <div>
            <Label className="block mb-1 font-medium flex items-center">
              <ZoomIn size={16} className="mr-2" /> Zoom Relativo
            </Label>
            <Slider
              defaultValue={[1]}
              max={2}
              min={0.1}
              step={0.1}
              value={[leftZoom]}
              onValueChange={(v) => setLeftZoom(v[0])}
              disabled={!leftMediaElement || isLoadingLeft}
              aria-label="Ajustar zoom relativo"
            />
            <p className="text-xs text-muted-foreground">Arraste a mídia na pré-visualização ou use a pinça (touch) para zoom.</p>
          </div>
        </Card>
      </TabsContent>

      {/* --- Right Tab Content --- */}
      <TabsContent value="right" className="mt-4 space-y-4">
        <Card className="p-4">
          <div>
            <Label className="block mb-1 font-medium flex items-center">
              <ZoomIn size={16} className="mr-2" /> Zoom Relativo
            </Label>
            <Slider
              defaultValue={[1]}
              max={2}
              min={0.1}
              step={0.1}
              value={[rightZoom]}
              onValueChange={(v) => setRightZoom(v[0])}
              disabled={!rightMediaElement || isLoadingRight}
              aria-label="Ajustar zoom relativo"
            />
            <p className="text-xs text-muted-foreground">Arraste a mídia na pré-visualização ou use a pinça (touch) para zoom.</p>
          </div>
        </Card>
      </TabsContent>

      {/* --- Logo Tab Content --- */}
      <TabsContent value="logo" className="mt-4 space-y-4">
        <Card className="p-4">
          <div>
            <Label className="block mb-1 font-medium flex items-center">
              <ZoomIn size={16} className="mr-2" /> Tamanho Relativo
            </Label>
            <Slider
              defaultValue={[1]}
              max={2}
              min={0.1}
              step={0.1}
              value={[logoZoom]}
              onValueChange={(v) => setLogoZoom(v[0])}
              disabled={!logoElement || isLoadingLogo}
              aria-label="Ajustar tamanho relativo do logo"
            />
            <div className="mt-4">
              <Label className="block mb-1 font-medium flex items-center">
                <Move size={16} className="mr-2" /> Posição Central
              </Label>
              <p className="text-xs text-muted-foreground">Arraste o logo na pré-visualização ou ajuste abaixo.</p>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label className="text-xs">Horizontal (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={logoPosition.x.toFixed(1)}
                    onChange={(e) =>
                      setLogoPosition({
                        ...logoPosition,
                        x: clamp(Number(e.target.value), 0, 100),
                      })
                    }
                    disabled={!logoElement || isLoadingLogo}
                    aria-label="Ajustar posição horizontal do logo em porcentagem"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Vertical (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={logoPosition.y.toFixed(1)}
                    onChange={(e) =>
                      setLogoPosition({
                        ...logoPosition,
                        y: clamp(Number(e.target.value), 0, 100),
                      })
                    }
                    disabled={!logoElement || isLoadingLogo}
                    aria-label="Ajustar posição vertical do logo em porcentagem"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  );
}