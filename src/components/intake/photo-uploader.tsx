"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";

export function PhotoUploader({
  photos,
  onChange,
  max,
}: {
  photos: File[];
  onChange: (files: File[]) => void;
  max: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const newPhotos = [...photos];
    for (let i = 0; i < files.length && newPhotos.length < max; i++) {
      const file = files[i];
      if (file.type.startsWith("image/")) {
        newPhotos.push(file);
      }
    }
    onChange(newPhotos);
  }

  function handleRemove(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Upload up to {max} photos of your project area. This helps us provide a
        more accurate quote.
      </p>

      {photos.length < max && (
        <div
          className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary/50"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleFiles(e.dataTransfer.files);
          }}
        >
          <div className="text-center">
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Click or drag photos here</p>
            <p className="text-xs text-muted-foreground">
              {photos.length}/{max} photos uploaded
            </p>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {photos.map((photo, i) => (
            <div key={i} className="group relative">
              <img
                src={URL.createObjectURL(photo)}
                alt={`Photo ${i + 1}`}
                className="h-24 w-full rounded-md object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute -right-2 -top-2 h-6 w-6 rounded-full p-0 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => handleRemove(i)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
