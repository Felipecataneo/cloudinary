// components/image-combiner/media-input.tsx
import React, { ChangeEvent } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MediaInputProps {
  id: string;
  label: string;
  accept?: string;
  onMediaUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

export function MediaInput({
  id,
  label,
  accept = "image/*,video/*", // Default to both
  onMediaUpload,
  className
}: MediaInputProps) {
  return (
    <div className={`grid w-full items-center gap-1.5 ${className}`}> {/* Removed max-w-sm */}
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="file"
        accept={accept} // Use the accept prop
        onChange={onMediaUpload}
        // Reset input value after selection to allow re-uploading the same file
        onClick={(event) => { (event.target as HTMLInputElement).value = '' }}
      />
    </div>
  );
}