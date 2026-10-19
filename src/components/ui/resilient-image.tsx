import React, { useEffect, useState } from 'react';

type ResilientImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc?: string;
};

/** Keeps transient CDN/R2 failures from leaving blank product and banner tiles. */
export const ResilientImage = ({ fallbackSrc = '/kgv.png', src, onError, ...props }: ResilientImageProps) => {
  const source = typeof src === 'string' ? src : '';
  const [currentSrc, setCurrentSrc] = useState(source);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    setCurrentSrc(source);
    setRetried(false);
  }, [source]);

  const handleError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    onError?.(event);
    if (!retried && source && source !== fallbackSrc) {
      setRetried(true);
      const separator = source.includes('?') ? '&' : '?';
      setCurrentSrc(`${source}${separator}retry=${Date.now()}`);
      return;
    }
    if (currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
  };

  return <img {...props} src={currentSrc || fallbackSrc} onError={handleError} />;
};
