// components/image-combiner/download-section.tsx
import React from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, AlertTriangle } from 'lucide-react';

interface DownloadSectionProps {
  onSave: () => Promise<void>; // Callback to trigger save in parent
  canSave: boolean; // Boolean indicating if save is possible
  isSaving: boolean; // Boolean indicating if saving is in progress
  saveError: string | null; // Error message for save
  leftMediaType: 'image' | 'video' | null;
  rightMediaType: 'image' | 'video' | null;
  isLoadingLeft: boolean;
  isLoadingRight: boolean;
  isLoadingLogo: boolean;
}

export function DownloadSection({
  onSave,
  canSave,
  isSaving,
  saveError,
  leftMediaType,
  rightMediaType,
  isLoadingLeft,
  isLoadingRight,
  isLoadingLogo,
}: DownloadSectionProps) {
  const isLoadingAny = isLoadingLeft || isLoadingRight || isLoadingLogo;

  return (
    <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex-grow flex flex-col gap-2 w-full sm:w-auto">
        {/* Video Warning Alert */}
        {(leftMediaType === 'video' || rightMediaType === 'video') && !isSaving && (
          <Alert variant="default" className="w-full text-xs sm:text-sm p-2 sm:p-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-xs sm:text-sm font-semibold">Aviso Vídeo</AlertTitle>
            <AlertDescription className="text-xs sm:text-sm">
              Os vídeos são automaticamente convertidos para o formato GIF. A qualidade pode ser reduzida.
            </AlertDescription>
          </Alert>
        )}
        {/* Save Error Alert */}
        {saveError && (
          <Alert variant="destructive" className="w-full text-xs sm:text-sm p-2 sm:p-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-xs sm:text-sm font-semibold">Erro</AlertTitle>
            <AlertDescription className="text-xs sm:text-sm">
              {saveError}
            </AlertDescription>
          </Alert>
        )}
      </div>
      {/* Download Button */}
      <Button
        onClick={onSave}
        disabled={!canSave || isSaving || isLoadingAny}
        className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0"
        aria-label={canSave ? "Baixar imagem combinada" : "Carregue duas imagens válidas para poder baixar"}
        title={
          !canSave
            ? "Carregue uma imagem válida em ambos os lados para habilitar o download."
            : isSaving
              ? "Salvando imagem..."
              : isLoadingAny
                ? "Aguarde o carregamento das mídias..."
                : "Baixar imagem combinada (PNG)"
        }
      >
        {isSaving ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
            Processando...
          </>
        ) : (
          <>
            <Download size={18} />
            Baixar Imagem
          </>
        )}
      </Button>
    </div>
  );
}