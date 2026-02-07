import { useImagePreview } from '@/contexts/ImagePreviewContext';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Button } from './button';
import { DialogContent, DialogOverlay, DialogPortal } from './dialog';

export const ImagePreviewModal = () => {
  const { isOpen, src, alt, closePreview } = useImagePreview();

  if (!isOpen) return null;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && closePreview()}>
      <DialogPortal>
        <DialogOverlay className="bg-black/80 backdrop-blur-sm z-[9999]" />
        <DialogContent className="max-w-[90vw] max-h-[90vh] w-auto h-auto p-0 border-none bg-transparent shadow-none z-[10000] flex justify-center items-center">
            <div className="relative">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute -top-12 right-0 text-white hover:bg-white/20 rounded-full"
                    onClick={closePreview}
                >
                    <X className="h-6 w-6" />
                </Button>
                <img 
                    src={src} 
                    alt={alt} 
                    className="max-w-[90vw] max-h-[85vh] object-contain rounded-md shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        </DialogContent>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
};
