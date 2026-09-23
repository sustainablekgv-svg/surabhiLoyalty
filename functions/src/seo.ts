import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function replaceTitle(html: string, newTitle: string): string {
  const regex = /<title>.*?<\/title>/i;
  if (html.match(regex)) {
    return html.replace(regex, `<title>${escapeXml(newTitle)}</title>`);
  }
  return html.replace('</head>', `<title>${escapeXml(newTitle)}</title>\n</head>`);
}

function replaceCanonical(html: string, newUrl: string): string {
  const regex = /<link\s+[^>]*rel=["']canonical["'][^>]*\/?>/i;
  if (html.match(regex)) {
    return html.replace(regex, `<link rel="canonical" href="${escapeXml(newUrl)}" />`);
  }
  return html.replace('</head>', `<link rel="canonical" href="${escapeXml(newUrl)}" />\n</head>`);
}

function replaceMeta(html: string, nameOrProp: string, isProperty: boolean, newContent: string): string {
  const attribute = isProperty ? 'property' : 'name';
  const escaped = nameOrProp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Matches <meta ... property="nameOrProp" ... /> regardless of attribute order
  const regex = new RegExp(`<meta\\s+[^>]*${attribute}=["']${escaped}["'][^>]*\\/?>`, 'i');
  const cleanContent = escapeXml(newContent);
  if (html.match(regex)) {
    return html.replace(regex, `<meta ${attribute}="${nameOrProp}" content="${cleanContent}" />`);
  }
  return html.replace('</head>', `<meta ${attribute}="${nameOrProp}" content="${cleanContent}" />\n</head>`);
}

/**
 * serverSideDynamicSEO: Serves index.html dynamically injected with metadata
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
  let keywords = 'Sustainable KGV, organic products, gopalak support, farmer rewards, Seva Coins, Surabhi Coins, organic shopping';
  let image = `${siteDomain}/kgv.png`;
  const canonicalUrl = `${siteDomain}${requestPath}`;
  let type = 'website';
  const productExtraMeta: { [key: string]: string } = {};
  let jsonLdList: any[] = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": siteName,
      "url": siteDomain,
      "logo": `${siteDomain}/kgv.png`,
      "sameAs": []
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": siteName,
      "url": siteDomain,
      "potentialAction": {
        "@type": "SearchAction",
        "target": `${siteDomain}/shop?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    }
  ];

  try {
    // 1. Product details page SEO
    if (requestPath.includes('/shop/product/')) {
      const slug = requestPath.split('/shop/product/')[1]?.split('/')[0];
      if (slug) {
        let productDoc: admin.firestore.DocumentData | null = null;

        // Try searching by slug
        const productSnap = await db.collection('products')
          .where('slug', '==', slug)
          .where('isActive', '==', true)
          .limit(1)
          .get();

        if (!productSnap.empty) {
          productDoc = productSnap.docs[0].data();
        } else {
          // Fallback: search by document ID for legacy links
          const docSnap = await db.collection('products').doc(slug).get();
          if (docSnap.exists && docSnap.data()?.isActive !== false) {
            productDoc = docSnap.data() || null;
          }
        }

        if (productDoc) {
          title = `${productDoc.name} | ${siteName}`;
          if (productDoc.description) {
            description = productDoc.description
              .replace(/<[^>]*>?/gm, '')
              .substring(0, 160)
              .trim();
          }
          if (productDoc.images && productDoc.images.length > 0) {
            image = productDoc.images[0];
          }
          type = 'product';

          const price = productDoc.sellingPrice || productDoc.price || 0;
          const availability = (productDoc.stock || 0) > 0 ? 'in stock' : 'out of stock';
          const brand = productDoc.brandName || siteName;
          const category = productDoc.categoryName || '';

          keywords = `${productDoc.name}, ${brand}, ${category}, organic products, sustainable kgv, buy ${productDoc.name} online`;

          productExtraMeta['product:price:amount'] = String(price);
          productExtraMeta['product:price:currency'] = 'INR';
          productExtraMeta['product:availability'] = availability;
          productExtraMeta['product:brand'] = brand;

          // Replace default organization/website schema with Product schema + BreadcrumbList
          jsonLdList = [
            {
              "@context": "https://schema.org/",
              "@type": "Product",
              "name": productDoc.name,
              "image": productDoc.images || [image],
              "description": productDoc.description ? productDoc.description.replace(/<[^>]*>?/gm, '') : description,
              "brand": {
                "@type": "Brand",
                "name": brand
              },
              "offers": {
                "@type": "Offer",
                "url": canonicalUrl,
                "priceCurrency": "INR",
                "price": price,
                "availability": (productDoc.stock || 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
              },
              ...(productDoc.averageRating && productDoc.totalReviews ? {
                "aggregateRating": {
                  "@type": "AggregateRating",
                  "ratingValue": productDoc.averageRating,
                  "reviewCount": productDoc.totalReviews
                }
              } : {})
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Home", "item": `${siteDomain}/` },
                { "@type": "ListItem", "position": 2, "name": "Shop", "item": `${siteDomain}/shop` },
                ...(category ? [{ "@type": "ListItem", "position": 3, "name": category, "item": `${siteDomain}/shop?category=${encodeURIComponent(category)}` }] : []),
                { "@type": "ListItem", "position": category ? 4 : 3, "name": productDoc.name, "item": canonicalUrl }
              ]
            }
          ];
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
          keywords = `${category.name}, organic ${category.name}, buy ${category.name} online, Sustainable KGV shop`;
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
          keywords = `${brand.name}, ${brand.name} products, organic ${brand.name}, Sustainable KGV`;
          if (brand.logo) {
            image = brand.logo;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error fetching Firestore data for SEO:', err);
  }

  // Ensure absolute secure URL for social images
  let secureImage = image;
  if (secureImage.startsWith('/')) {
    secureImage = `${siteDomain}${secureImage}`;
  } else if (secureImage.startsWith('http://')) {
    secureImage = secureImage.replace('http://', 'https://');
  }

  // Inject meta tags into template
  html = replaceTitle(html, title);
  html = replaceCanonical(html, canonicalUrl);
  
  html = replaceMeta(html, 'description', false, description);
  html = replaceMeta(html, 'keywords', false, keywords);
  
  html = replaceMeta(html, 'og:title', true, title);
  html = replaceMeta(html, 'og:description', true, description);
  html = replaceMeta(html, 'og:image', true, secureImage);
  html = replaceMeta(html, 'og:image:secure_url', true, secureImage);
  html = replaceMeta(html, 'og:url', true, canonicalUrl);
  html = replaceMeta(html, 'og:type', true, type);
  html = replaceMeta(html, 'og:site_name', true, siteName);

  // Extra product OpenGraph meta tags
  for (const [prop, val] of Object.entries(productExtraMeta)) {
    html = replaceMeta(html, prop, true, val);
  }
  
  html = replaceMeta(html, 'twitter:title', true, title);
  html = replaceMeta(html, 'twitter:description', true, description);
  html = replaceMeta(html, 'twitter:image', true, secureImage);
  html = replaceMeta(html, 'twitter:image:alt', true, title);
  
  // Inject JSON-LD structured scripts before </head>
  if (jsonLdList && jsonLdList.length > 0) {
    const jsonLdScripts = jsonLdList
      .map(item => `<script type="application/ld+json">\n${JSON.stringify(item, null, 2)}\n</script>`)
      .join('\n');
    html = html.replace('</head>', `${jsonLdScripts}\n</head>`);
  }

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=3600');
  res.status(200).send(html);
});

/**
 * generateDynamicSitemap: Generates and serves a dynamic XML sitemap containing
 * all static routes as well as all active products, categories, and brands from Firestore,
 * complete with Google Image extensions for product search visibility.
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

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

  // Append static URLs
  for (const url of staticUrls) {
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(url.loc)}</loc>\n`;
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
        xml += `    <loc>${escapeXml(`${siteDomain}/shop/product/${product.slug}`)}</loc>\n`;
        xml += `    <lastmod>${currentDate}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;
        
        // Add Google Image Sitemap tag if product has images
        if (product.images && product.images.length > 0) {
          const imgUrl = product.images[0];
          const fullImgUrl = imgUrl.startsWith('/') ? `${siteDomain}${imgUrl}` : imgUrl;
          xml += `    <image:image>\n`;
          xml += `      <image:loc>${escapeXml(fullImgUrl)}</image:loc>\n`;
          xml += `      <image:title>${escapeXml(product.name)}</image:title>\n`;
          xml += `    </image:image>\n`;
        }
        
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
        xml += `    <loc>${escapeXml(`${siteDomain}/shop/category/${category.slug}`)}</loc>\n`;
        xml += `    <lastmod>${currentDate}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.7</priority>\n`;
        
        if (category.image) {
          const catImg = category.image.startsWith('/') ? `${siteDomain}${category.image}` : category.image;
          xml += `    <image:image>\n`;
          xml += `      <image:loc>${escapeXml(catImg)}</image:loc>\n`;
          xml += `      <image:title>${escapeXml(category.name)}</image:title>\n`;
          xml += `    </image:image>\n`;
        }
        
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
        xml += `    <loc>${escapeXml(`${siteDomain}/shop/brand/${brand.slug}`)}</loc>\n`;
        xml += `    <lastmod>${currentDate}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.7</priority>\n`;
        
        if (brand.logo) {
          const brandImg = brand.logo.startsWith('/') ? `${siteDomain}${brand.logo}` : brand.logo;
          xml += `    <image:image>\n`;
          xml += `      <image:loc>${escapeXml(brandImg)}</image:loc>\n`;
          xml += `      <image:title>${escapeXml(brand.name)}</image:title>\n`;
          xml += `    </image:image>\n`;
        }
        
        xml += `  </url>\n`;
      }
    });

  } catch (err) {
    console.error('Error generating dynamic sitemap:', err);
  }

  xml += `</urlset>\n`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.status(200).send(xml);
});
