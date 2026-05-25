import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

function replaceTitle(html: string, newTitle: string): string {
  const regex = /<title>.*?<\/title>/i;
  if (html.match(regex)) {
    return html.replace(regex, `<title>${newTitle}</title>`);
  }
  return html.replace('</head>', `<title>${newTitle}</title>\n</head>`);
}

function replaceCanonical(html: string, newUrl: string): string {
  const regex = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i;
  if (html.match(regex)) {
    return html.replace(regex, `<link rel="canonical" href="${newUrl}" />`);
  }
  return html.replace('</head>', `<link rel="canonical" href="${newUrl}" />\n</head>`);
}

function replaceMeta(html: string, nameOrProp: string, isProperty: boolean, newContent: string): string {
  const attribute = isProperty ? 'property' : 'name';
  // Escape special characters for regex
  const escaped = nameOrProp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`<meta\\s+${attribute}="${escaped}"\\s+content="[^"]*"\\s*\\/?>`, 'i');
  if (html.match(regex)) {
    return html.replace(regex, `<meta ${attribute}="${nameOrProp}" content="${newContent}" />`);
  }
  return html.replace('</head>', `<meta ${attribute}="${nameOrProp}" content="${newContent}" />\n</head>`);
}

/**
 * serverSideDynamicSEO: Serves the index.html dynamically injected with metadata
 * fetched from Firestore based on the current product, category, or brand slug.
 */
export const serverSideDynamicSEO = functions.https.onRequest(async (req, res) => {
  const requestPath = req.path;
  
  // Read index.html template from functions/lib directory
  let html = '';
  try {
    const templatePath = path.join(__dirname, 'index.html');
    if (fs.existsSync(templatePath)) {
      html = fs.readFileSync(templatePath, 'utf8');
    } else {
      // Fallback if not found in __dirname (e.g. local emulators run before building)
      const fallbackPath = path.join(__dirname, '../../dist/index.html');
      if (fs.existsSync(fallbackPath)) {
        html = fs.readFileSync(fallbackPath, 'utf8');
      } else {
        const rootPath = path.join(__dirname, '../../index.html');
        if (fs.existsSync(rootPath)) {
          html = fs.readFileSync(rootPath, 'utf8');
        } else {
          res.status(500).send('HTML template not found.');
          return;
        }
      }
    }
  } catch (err) {
    console.error('Error reading index.html template:', err);
    res.status(500).send('Error loading template.');
    return;
  }

  // Base configuration
  const siteDomain = 'https://www.sustainablekgv.com';
  const siteName = 'Sustainable KGV';
  let title = 'Sustainable KGV - Rewards & Shopping';
  let description = 'Empowering farmers and gopalaks through a sustainable rewards ecosystem. Shop premium organic products, earn Surabhi Coins, and contribute to community welfare.';
  let image = `${siteDomain}/kgv.png`;
  let canonicalUrl = `${siteDomain}${requestPath}`;
  let type = 'website';
  let jsonLd: any = null;

  try {
    // 1. Product details page SEO
    if (requestPath.includes('/shop/product/')) {
      const slug = requestPath.split('/shop/product/')[1]?.split('/')[0];
      if (slug) {
        const productSnap = await db.collection('products')
          .where('slug', '==', slug)
          .where('isActive', '==', true)
          .limit(1)
          .get();

        if (!productSnap.empty) {
          const product = productSnap.docs[0].data();
          title = `${product.name} | ${siteName}`;
          if (product.description) {
            // Strip HTML tags and shorten description
            description = product.description
              .replace(/<[^>]*>?/gm, '')
              .substring(0, 160)
              .trim();
          }
          if (product.images && product.images.length > 0) {
            image = product.images[0];
          }
          type = 'product';
          
          // Generate Product Schema
          jsonLd = {
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": product.name,
            "image": product.images || [image],
            "description": product.description ? product.description.replace(/<[^>]*>?/gm, '') : description,
            "brand": {
              "@type": "Brand",
              "name": product.brandName || "Sustainable KGV"
            },
            "offers": {
              "@type": "Offer",
              "url": canonicalUrl,
              "priceCurrency": "INR",
              "price": product.sellingPrice || product.price,
              "availability": (product.stock || 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
            }
          };
          if (product.averageRating && product.totalReviews) {
            jsonLd.aggregateRating = {
              "@type": "AggregateRating",
              "ratingValue": product.averageRating,
              "reviewCount": product.totalReviews
            };
          }
        }
      }
    }
    // 2. Category page SEO
    else if (requestPath.includes('/shop/category/')) {
      const slug = requestPath.split('/shop/category/')[1]?.split('/')[0];
      if (slug) {
        const categorySnap = await db.collection('categories')
          .where('slug', '==', slug)
          .limit(1)
          .get();

        if (!categorySnap.empty) {
          const category = categorySnap.docs[0].data();
          title = `Shop ${category.name} | ${siteName}`;
          description = `Browse premium organic ${category.name.toLowerCase()} products on Sustainable KGV. Earn Surabhi Coins and support our community.`;
          if (category.image) {
            image = category.image;
          }
        }
      }
    }
    // 3. Brand page SEO
    else if (requestPath.includes('/shop/brand/')) {
      const slug = requestPath.split('/shop/brand/')[1]?.split('/')[0];
      if (slug) {
        const brandSnap = await db.collection('brands')
          .where('slug', '==', slug)
          .limit(1)
          .get();

        if (!brandSnap.empty) {
          const brand = brandSnap.docs[0].data();
          title = `Shop ${brand.name} | ${siteName}`;
          if (brand.description) {
            description = brand.description
              .replace(/<[^>]*>?/gm, '')
              .substring(0, 160)
              .trim();
          } else {
            description = `Shop premium organic products from ${brand.name} on Sustainable KGV. Support local farmers and gopalaks.`;
          }
          if (brand.logo) {
            image = brand.logo;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error fetching Firestore data for SEO:', err);
    // Fall back gracefully with base SEO tags
  }

  // Inject meta tags
  html = replaceTitle(html, title);
  html = replaceCanonical(html, canonicalUrl);
  
  html = replaceMeta(html, 'description', false, description);
  
  html = replaceMeta(html, 'og:title', true, title);
  html = replaceMeta(html, 'og:description', true, description);
  html = replaceMeta(html, 'og:image', true, image);
  html = replaceMeta(html, 'og:url', true, canonicalUrl);
  html = replaceMeta(html, 'og:type', true, type);
  html = replaceMeta(html, 'og:site_name', true, siteName);
  
  html = replaceMeta(html, 'twitter:title', true, title);
  html = replaceMeta(html, 'twitter:description', true, description);
  html = replaceMeta(html, 'twitter:image', true, image);
  
  // Inject JSON-LD structured script if it exists
  if (jsonLd) {
    const jsonLdScript = `\n<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>\n</head>`;
    html = html.replace('</head>', jsonLdScript);
  }

  // Respond with the dynamically constructed HTML page
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=3600');
  res.status(200).send(html);
});

/**
 * generateDynamicSitemap: Generates and serves a dynamic XML sitemap containing
 * all static routes as well as all active products, categories, and brands from Firestore.
 */
export const generateDynamicSitemap = functions.https.onRequest(async (req, res) => {
  const siteDomain = 'https://www.sustainablekgv.com';
  const currentDate = new Date().toISOString().split('T')[0];

  // 1. Define static URLs
  const staticUrls = [
    { loc: `${siteDomain}/`, lastmod: currentDate, changefreq: 'weekly', priority: '1.0' },
    { loc: `${siteDomain}/shop`, lastmod: currentDate, changefreq: 'daily', priority: '0.9' },
    { loc: `${siteDomain}/login`, lastmod: currentDate, changefreq: 'monthly', priority: '0.5' },
    { loc: `${siteDomain}/signup`, lastmod: currentDate, changefreq: 'monthly', priority: '0.5' },
    { loc: `${siteDomain}/privacy-policy`, lastmod: currentDate, changefreq: 'monthly', priority: '0.6' },
    { loc: `${siteDomain}/terms-conditions`, lastmod: currentDate, changefreq: 'monthly', priority: '0.6' },
    { loc: `${siteDomain}/cancellation-refund`, lastmod: currentDate, changefreq: 'monthly', priority: '0.6' },
    { loc: `${siteDomain}/shipping-policy`, lastmod: currentDate, changefreq: 'monthly', priority: '0.6' },
    { loc: `${siteDomain}/contact-us`, lastmod: currentDate, changefreq: 'monthly', priority: '0.6' },
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Append static URLs
  for (const url of staticUrls) {
    xml += `  <url>\n`;
    xml += `    <loc>${url.loc}</loc>\n`;
    xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
    xml += `    <priority>${url.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  try {
    // 2. Fetch all active products
    const productsSnap = await db.collection('products')
      .where('isActive', '==', true)
      .get();
    
    productsSnap.forEach((doc) => {
      const product = doc.data();
      if (product.slug) {
        xml += `  <url>\n`;
        xml += `    <loc>${siteDomain}/shop/product/${product.slug}</loc>\n`;
        xml += `    <lastmod>${currentDate}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;
        xml += `  </url>\n`;
      }
    });

    // 3. Fetch all active categories
    const categoriesSnap = await db.collection('categories')
      .where('isActive', '==', true)
      .get();
    
    categoriesSnap.forEach((doc) => {
      const category = doc.data();
      if (category.slug) {
        xml += `  <url>\n`;
        xml += `    <loc>${siteDomain}/shop/category/${category.slug}</loc>\n`;
        xml += `    <lastmod>${currentDate}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.7</priority>\n`;
        xml += `  </url>\n`;
      }
    });

    // 4. Fetch all active brands
    const brandsSnap = await db.collection('brands')
      .where('isActive', '==', true)
      .get();
    
    brandsSnap.forEach((doc) => {
      const brand = doc.data();
      if (brand.slug) {
        xml += `  <url>\n`;
        xml += `    <loc>${siteDomain}/shop/brand/${brand.slug}</loc>\n`;
        xml += `    <lastmod>${currentDate}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.7</priority>\n`;
        xml += `  </url>\n`;
      }
    });

  } catch (err) {
    console.error('Error generating dynamic sitemap:', err);
    // Continue and serve whatever sitemap we have built so far if firestore fails
  }

  xml += `</urlset>\n`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.status(200).send(xml);
});
