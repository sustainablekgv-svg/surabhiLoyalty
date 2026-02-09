import { useImagePreview } from '@/contexts/ImagePreviewContext';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Button } from './button';
import { DialogOverlay, DialogPortal } from './dialog';

export const ImagePreviewModal = () => {
  const { isOpen, src, alt, closePreview } = useImagePreview();

  if (!isOpen) return null;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && closePreview()}>
      <DialogPortal>
        <DialogOverlay className="bg-black/80 backdrop-blur-sm z-[9999]" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[10000] translate-x-[-50%] translate-y-[-50%] focus:outline-none">
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
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
};
