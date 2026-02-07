import { useImagePreview } from '@/contexts/ImagePreviewContext';
import { cn } from '@/lib/utils';
import React from 'react';

interface PreviewableImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  previewSrc?: string;
  previewAlt?: string;
}

export const PreviewableImage = ({ 
  src, 
  alt, 
  className, 
  previewSrc, 
  previewAlt,
  onClick,
  ...props 
}: PreviewableImageProps) => {
  const { openPreview } = useImagePreview();

  const handleClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.stopPropagation(); // Prevent row clicks or other parent handlers
    if (src) {
      openPreview(previewSrc || src, previewAlt || alt || 'Preview');
    }
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <img
      src={src}
      alt={alt}
      className={cn("cursor-pointer transition-opacity hover:opacity-80 active:scale-95 duration-200", className)}
      onClick={handleClick}
      {...props}
    />
  );
};
