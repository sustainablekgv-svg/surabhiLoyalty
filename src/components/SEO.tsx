import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
}

export const SEO = ({ title, description, image }: SEOProps) => {
  useEffect(() => {
    // Update Title
    document.title = `${title} | Surabhi Loyalty`;

    // Update Meta Description
    if (description) {
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.setAttribute('name', 'description');
        document.head.appendChild(metaDescription);
      }
      metaDescription.setAttribute('content', description);
    }
    
    // Update OG Title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', `${title} | Surabhi Loyalty`);

    // Update OG Description
    if (description) {
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', description);
    }

    // Scroll to top on mount
    window.scrollTo(0, 0);

  }, [title, description, image]);

  return null;
};
