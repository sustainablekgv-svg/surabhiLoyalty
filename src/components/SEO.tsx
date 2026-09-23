import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  price?: number | string;
  currency?: string;
  availability?: 'InStock' | 'OutOfStock' | string;
  brand?: string;
  jsonLd?: object;
}

const SEO = ({ 
  title = 'Sustainable KGV - Rewards & Shopping',
  description = 'Empowering farmers and gopalaks through a sustainable rewards ecosystem. Shop premium organic products, earn Surabhi Coins, and contribute to community welfare with Seva Coins.',
  keywords = 'Sustainable KGV, organic products, gopalak support, farmer rewards, Seva Coins, Surabhi Coins, organic shopping',
  image = 'https://www.sustainablekgv.com/kgv.png',
  url = 'https://www.sustainablekgv.com/',
  type = 'website',
  price,
  currency = 'INR',
  availability,
  brand = 'Sustainable KGV',
  jsonLd
}: SEOProps) => {
  const siteName = 'Sustainable KGV';
  const fullTitle = title === 'Sustainable KGV - Rewards & Shopping' ? title : `${title} | ${siteName}`;
  const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : 'https://www.sustainablekgv.com/');
  const secureImage = image?.startsWith('http://') ? image.replace('http://', 'https://') : image;

  return (
    <Helmet>
      {/* Standard metadata */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={currentUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={secureImage} />
      <meta property="og:image:secure_url" content={secureImage} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:site_name" content={siteName} />

      {/* Open Graph Product Specs */}
      {type === 'product' && (
        <>
          {price !== undefined && <meta property="product:price:amount" content={String(price)} />}
          {currency && <meta property="product:price:currency" content={currency} />}
          {availability && (
            <meta 
              property="product:availability" 
              content={availability.includes('InStock') ? 'in stock' : 'out of stock'} 
            />
          )}
          {brand && <meta property="product:brand" content={brand} />}
        </>
      )}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={secureImage} />
      <meta name="twitter:image:alt" content={title} />

      {/* JSON-LD */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
