import { createContext, ReactNode, useContext, useState } from 'react';

interface ImagePreviewContextType {
  isOpen: boolean;
  src: string;
  alt: string;
  openPreview: (src: string, alt?: string) => void;
  closePreview: () => void;
}

const ImagePreviewContext = createContext<ImagePreviewContextType | undefined>(undefined);

export const ImagePreviewProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');

  const openPreview = (imageSrc: string, imageAlt: string = 'Preview') => {
    setSrc(imageSrc);
    setAlt(imageAlt);
    setIsOpen(true);
  };

  const closePreview = () => {
    setIsOpen(false);
    setSrc('');
    setAlt('');
  };

  return (
    <ImagePreviewContext.Provider value={{ isOpen, src, alt, openPreview, closePreview }}>
      {children}
    </ImagePreviewContext.Provider>
  );
};

export const useImagePreview = () => {
  const context = useContext(ImagePreviewContext);
  if (!context) {
    throw new Error('useImagePreview must be used within an ImagePreviewProvider');
  }
  return context;
};
