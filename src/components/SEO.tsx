import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  jsonLd?: object;
}

const SEO = ({ 
  title = 'Sustainable KGV - Rewards & Shopping',
  description = 'Empowering farmers and gopalaks through a sustainable rewards ecosystem. Shop premium organic products, earn Surabhi Coins, and contribute to community welfare with Seva Coins.',
  keywords = 'Sustainable KGV, organic products, gopalak support, farmer rewards, Seva Coins, Surabhi Coins',
  image = 'https://www.sustainablekgv.com/kgv.png',
  url = 'https://www.sustainablekgv.com/',
  type = 'website',
  jsonLd
}: SEOProps) => {
  const siteName = 'Sustainable KGV';
  const fullTitle = title === 'Sustainable KGV - Rewards & Shopping' ? title : `${title} | ${siteName}`;

  return (
    <Helmet>
      {/* Standard metadata */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content={siteName} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

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
