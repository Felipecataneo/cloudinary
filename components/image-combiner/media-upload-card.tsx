// components/image-combiner/media-upload-card.tsx
import React, { ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaInput } from "@/components/image-combiner/media-input";
import { Video, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaUploadCardProps {
  id: string;
  label: string;
  accept?: string;
  mediaUrl: string | null;
  mediaElement: HTMLImageElement | HTMLVideoElement | null;
  mediaType: 'image' | 'video' | null;
  isLoading: boolean;
  // Error prop is passed down from parent, not internally managed here
  error: string | null;
  onFileSelect: (file: File) => void;
}

export function MediaUploadCard({
  id,
  label,
  accept = "image/*,video/*",
  mediaUrl,
  mediaElement,
  mediaType,
  isLoading,
  error, // Use the error prop passed from parent
  onFileSelect,
}: MediaUploadCardProps) {
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    // Reset input value after selection to allow re-uploading the same file
    e.target.value = '';
  };

  return (
    <Card className="p-3 md:p-4">
      <CardHeader className='p-0 mb-3'>
        <CardTitle className="text-base md:text-lg font-medium flex items-center gap-1">
          {mediaType === 'video' ? <Video size={18} /> : <ImageIcon size={18} />}
          {label}
          {isLoading && <span className='text-xs text-muted-foreground ml-2'>(Carregando...)</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className='p-0'>
        <MediaInput
          id={id}
          label={`Carregar ${label.split(' ')[0]}`} // e.g., "Carregar Esquerda"
          accept={accept} // Use the accept prop
          onMediaUpload={handleInputChange}
          className="mb-2"
        />
        {mediaUrl && (
          <div className="aspect-video bg-muted rounded-md overflow-hidden mt-2 relative flex items-center justify-center text-sm text-muted-foreground">
            {isLoading ? (
              "Carregando..."
            ) : error ? ( // Use the error prop
              <div className="text-destructive p-2 text-center">Falha: {error}</div>
            ) : mediaElement && mediaType === 'video' ? (
              // Use key to force re-render on new video URL
              <video
                src={mediaUrl}
                className="w-full h-full object-contain"
                muted
                loop
                playsInline
                autoPlay
                key={`preview-${id}-${mediaUrl.substring(0, 10)}`}
                aria-label={`Preview ${label} vídeo`}
              />
            ) : mediaElement && mediaType === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl}
                alt={`Preview ${label}`}
                className="w-full h-full object-contain"
              />
            ) : (
              // Should not happen if mediaUrl is set but element/error is not, or still loading
              "Processando..."
            )}
          </div>
        )}
        {!mediaUrl && !isLoading && !error && ( // Show empty state if no URL, not loading, and no error
             <div className="aspect-video bg-muted rounded-md overflow-hidden mt-2 relative flex items-center justify-center text-sm text-muted-foreground">
                 Selecione um arquivo
            </div>
        )}
      </CardContent>
    </Card>
  );
}