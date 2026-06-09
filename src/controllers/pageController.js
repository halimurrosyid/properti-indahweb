const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const escapeXml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const toSitemapDate = (date) => {
  if (!date) return null;
  return new Date(date).toISOString().split('T')[0];
};

const slugifyPathSegment = (value) => String(value || '')
  .toLowerCase()
  .trim()
  .replace(/\s+/g, '-')
  .replace(/[^\w-]+/g, '')
  .replace(/--+/g, '-')
  .replace(/^-+|-+$/g, '');

const buildSiteUrl = (req) => {
  const configuredUrl = process.env.SITE_URL || process.env.APP_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  return `${req.protocol}://${req.get('host')}`;
};

const appendSitemapUrl = (urls, host, path, options = {}) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const loc = `${host}${normalizedPath}`;
  const lastmod = toSitemapDate(options.lastmod);
  const images = options.images || [];

  urls.push({
    loc,
    lastmod,
    changefreq: options.changefreq,
    priority: options.priority,
    images: images
      .filter(Boolean)
      .map(imagePath => imagePath.startsWith('http') ? imagePath : `${host}${imagePath}`)
  });
};
const fallbackPopularCities = require('../config/popularCities.json');

const normalizeRegionName = (value) => String(value || '').toLowerCase().replace(/^(kota|kabupaten)\s+/i, '').trim();

const sortPopularCitiesByActiveListings = async (cities) => {
  const cityCounts = await prisma.property.groupBy({
    by: ['city'],
    where: { status: 'AVAILABLE' },
    _count: { city: true }
  });

  const countsByCity = cityCounts.reduce((map, item) => {
    const key = normalizeRegionName(item.city);
    map.set(key, (map.get(key) || 0) + item._count.city);
    return map;
  }, new Map());

  return cities
    .map(city => ({
      ...city,
      propertyCount: countsByCity.get(normalizeRegionName(city.name)) || 0
    }))
    .sort((a, b) => {
      if (b.propertyCount !== a.propertyCount) return b.propertyCount - a.propertyCount;
      if ((a.displayOrder || 0) !== (b.displayOrder || 0)) return (a.displayOrder || 0) - (b.displayOrder || 0);
      return a.name.localeCompare(b.name);
    });
};

exports.getHome = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany();
    
    const featuredProperties = await prisma.property.findMany({
      where: {
        isFeatured: true,
        status: 'AVAILABLE'
      },
      include: {
        category: true,
        images: true
      },
      take: 4,
      orderBy: {
        createdAt: 'desc'
      }
    });

    const latestProperties = await prisma.property.findMany({
      where: {
        status: 'AVAILABLE'
      },
      include: {
        category: true,
        images: true
      },
      take: 8,
      orderBy: {
        createdAt: 'desc'
      }
    });

    let popularCities = await prisma.popularCity.findMany({
      where: { isActive: true },
      orderBy: [
        { name: 'asc' }
      ]
    });

    if (popularCities.length === 0) {
      popularCities = fallbackPopularCities;
    }
    popularCities = await sortPopularCitiesByActiveListings(popularCities);

    res.render('pages/home', {
      title: 'Portal Properti Terpercaya',
      description: 'Portal jual beli dan sewa properti lokal Indonesia yang cepat, ringan, dan gratis biaya pasang iklan.',
      categories,
      featuredProperties,
      latestProperties,
      popularCities
    });
  } catch (error) {
    next(error);
  }
};

exports.getCatalog = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany();

    // Filters from query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    const keyword = req.query.keyword || '';
    const listingType = req.query.listingType || '';
    const category = req.query.category || '';
    const city = req.query.city || '';
    const district = req.query.district || '';
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
    const bedrooms = req.query.bedrooms ? parseInt(req.query.bedrooms) : null;
    const bathrooms = req.query.bathrooms ? parseInt(req.query.bathrooms) : null;

    // Build prisma query where clause
    const where = {
      status: 'AVAILABLE'
    };

    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
        { shortAddress: { contains: keyword } }
      ];
    }

    if (listingType) {
      where.listingType = listingType;
    }

    if (category) {
      where.category = {
        slug: category
      };
    }

    if (city) {
      where.city = { contains: city };
    }

    if (district) {
      where.district = { contains: district };
    }

    if (minPrice !== null || maxPrice !== null) {
      where.price = {};
      if (minPrice !== null) where.price.gte = minPrice;
      if (maxPrice !== null) where.price.lte = maxPrice;
    }

    if (bedrooms !== null && !isNaN(bedrooms)) {
      where.bedrooms = bedrooms;
    }

    if (bathrooms !== null && !isNaN(bathrooms)) {
      where.bathrooms = bathrooms;
    }

    // Query DB
    const totalResults = await prisma.property.count({ where });
    const totalPages = Math.ceil(totalResults / limit);

    const properties = await prisma.property.findMany({
      where,
      include: {
        category: true,
        images: true
      },
      skip,
      take: limit,
      orderBy: [
        { isFeatured: 'desc' }, // Featured listings first
        { createdAt: 'desc' }  // Then newest
      ]
    });

    res.render('pages/catalog', {
      title: 'Katalog Pencarian Properti',
      description: 'Cari rumah, ruko, apartemen, atau tanah impian Anda dengan filter lengkap.',
      properties,
      categories,
      totalResults,
      totalPages,
      currentPage: page,
      filters: req.query,
      submitted_success: req.query.submitted === '1',
      breadcrumbs: [
        { label: 'Home', url: '/' },
        { label: 'Properti', url: '/catalog' }
      ]
    });
  } catch (error) {
    next(error);
  }
};

exports.getPropertyDetail = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const property = await prisma.property.findUnique({
      where: { slug },
      include: {
        category: true,
        images: true
      }
    });

    if (!property || property.status !== 'AVAILABLE') {
      return res.status(404).render('pages/home', {
        title: 'Halaman Tidak Ditemukan',
        categories: [],
        featuredProperties: [],
        latestProperties: [],
        error: 'Properti tidak ditemukan atau sudah tidak tersedia.'
      });
    }

    // Split facilities by comma
    const facilities = property.facilities 
      ? property.facilities.split(',').map(f => f.trim()).filter(Boolean) 
      : [];

    const priceFormatted = Number(property.price).toLocaleString('id-ID');
    const waLeadUrl = `/go/whatsapp/${property.id}`;

    // Schema SEO JSON-LD
    const mainImage = property.images.find(img => img.isMain)?.url || (property.images[0] ? property.images[0].url : '');
    const fullMainImageUrl = mainImage ? `${req.protocol}://${req.get('host')}${mainImage}` : '';
    const jsonLdData = {
      '@context': 'https://schema.org',
      '@type': 'SingleFamilyResidence',
      'name': property.title,
      'description': property.description.substring(0, 160),
      'address': {
        '@type': 'PostalAddress',
        'addressLocality': property.city,
        'addressRegion': property.province,
        'streetAddress': property.shortAddress,
        'addressCountry': 'ID'
      },
      'numberOfRooms': property.bedrooms + property.bathrooms,
      'numberOfBedrooms': property.bedrooms,
      'numberOfBathrooms': property.bathrooms,
      'floorSize': {
        '@type': 'QuantitativeValue',
        'value': property.buildingSize,
        'unitCode': 'MTK'
      },
      'image': fullMainImageUrl
    };

    res.render('pages/detail', {
      title: property.title,
      description: property.description.substring(0, 160),
      property,
      facilities,
      priceFormatted,
      waLeadUrl,
      jsonLd: JSON.stringify(jsonLdData)
    });
  } catch (error) {
    next(error);
  }
};

exports.getPasangIklan = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany();
    res.render('pages/pasang-iklan', {
      title: 'Pasang Iklan Properti Gratis',
      description: 'Pasang iklan rumah, ruko, tanah, atau apartemen Anda secara gratis dan langsung terhubung dengan peminat via WhatsApp.',
      categories
    });
  } catch (error) {
    next(error);
  }
};

exports.getUserDashboard = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const properties = await prisma.property.findMany({
      where: { userId },
      include: {
        category: true,
        images: true,
        _count: {
          select: { tracks: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const invoices = await prisma.invoice.findMany({
      where: { userId },
      include: { property: true },
      orderBy: { createdAt: 'desc' }
    });

    res.render('pages/dashboard', {
      title: 'Dasbor Agen Anda',
      properties,
      invoices,
      message: req.query.msg || null
    });
  } catch (error) {
    next(error);
  }
};

exports.getAdminDashboard = async (req, res, next) => {
  try {
    const properties = await prisma.property.findMany({
      where: { status: 'PENDING' },
      include: {
        category: true,
        images: true,
        user: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const invoices = await prisma.invoice.findMany({
      include: { user: true, property: true },
      orderBy: { createdAt: 'desc' }
    });

    res.render('pages/admin-dashboard', {
      title: 'Panel Peninjauan Admin',
      properties,
      invoices,
      message: req.query.msg || null
    });
  } catch (error) {
    next(error);
  }
};

exports.getAdminLocations = async (req, res, next) => {
  try {
    let cities = await prisma.popularCity.findMany({
      orderBy: [
        { name: 'asc' }
      ]
    });
    cities = await sortPopularCitiesByActiveListings(cities);

    res.render('pages/admin-locations', {
      title: 'Kelola Lokasi Populer',
      cities,
      message: req.query.msg || null,
      error: req.query.err || null
    });
  } catch (error) {
    next(error);
  }
};

exports.postCreateAdminLocation = async (req, res, next) => {
  try {
    const { name, province, isActive } = req.body;

    if (!name || !province) {
      return res.redirect('/admin/locations?err=Nama kota dan provinsi wajib diisi.');
    }

    const uploadedImage = req.file ? `/uploads/${req.file.filename}` : null;
    if (!uploadedImage) {
      return res.redirect('/admin/locations?err=Upload gambar lokasi wajib diisi.');
    }

    await prisma.popularCity.create({
      data: {
        name: name.trim(),
        province: province.trim(),
        imageUrl: uploadedImage,
        isActive: isActive === 'on'
      }
    });

    res.redirect('/admin/locations?msg=Lokasi populer berhasil ditambahkan.');
  } catch (error) {
    next(error);
  }
};

exports.postUpdateAdminLocation = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { name, province, isActive } = req.body;

    if (!name || !province) {
      return res.redirect('/admin/locations?err=Nama kota dan provinsi wajib diisi.');
    }

    const uploadedImage = req.file ? `/uploads/${req.file.filename}` : null;

    await prisma.popularCity.update({
      where: { id },
      data: {
        name: name.trim(),
        province: province.trim(),
        ...(uploadedImage ? { imageUrl: uploadedImage } : {}),
        isActive: isActive === 'on'
      }
    });

    res.redirect('/admin/locations?msg=Lokasi populer berhasil diperbarui.');
  } catch (error) {
    next(error);
  }
};

exports.postDeleteAdminLocation = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    await prisma.popularCity.delete({
      where: { id }
    });

    res.redirect('/admin/locations?msg=Lokasi populer berhasil dihapus.');
  } catch (error) {
    next(error);
  }
};

exports.getSeoListingPage = async (req, res, next) => {
  try {
    const pathSegments = req.originalUrl.split('?')[0].split('/').filter(Boolean);
    const baseSeo = pathSegments[0]; // e.g. 'rumah-dijual', 'tanah-dijual', 'kontrakan', 'kos'

    let categorySlug = '';
    let listingType = '';
    let baseSeoLabel = '';

    if (baseSeo === 'rumah-dijual') {
      categorySlug = 'rumah';
      listingType = 'SALE';
      baseSeoLabel = 'Rumah Dijual';
    } else if (baseSeo === 'tanah-dijual') {
      categorySlug = 'tanah';
      listingType = 'SALE';
      baseSeoLabel = 'Tanah Dijual';
    } else if (baseSeo === 'kontrakan') {
      categorySlug = 'rumah';
      listingType = 'RENT';
      baseSeoLabel = 'Kontrakan';
    } else if (baseSeo === 'kos') {
      categorySlug = 'kos';
      listingType = 'RENT';
      baseSeoLabel = 'Kos';
    } else {
      return res.status(404).send('Halaman Tidak Ditemukan');
    }

    // Auto-create category in DB if missing to prevent database lookup errors
    let dbCategory = await prisma.category.findUnique({
      where: { slug: categorySlug }
    });

    if (!dbCategory) {
      dbCategory = await prisma.category.create({
        data: {
          name: categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1),
          slug: categorySlug
        }
      });
    }

    const cityParam = req.params.city || '';
    const districtParam = req.params.district || '';

    const capitalize = (str) => str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const cityFilter = cityParam ? capitalize(cityParam.replace(/-/g, ' ')) : '';
    const districtFilter = districtParam ? capitalize(districtParam.replace(/-/g, ' ')) : '';

    // Build breadcrumbs
    const breadcrumbs = [
      { label: 'Home', url: '/' },
      { label: baseSeoLabel, url: `/${baseSeo}` }
    ];

    if (cityFilter) {
      breadcrumbs.push({ label: cityFilter, url: `/${baseSeo}/${cityParam}` });
    }
    if (districtFilter) {
      breadcrumbs.push({ label: districtFilter, url: `/${baseSeo}/${cityParam}/${districtParam}` });
    }

    // Build filters for view state pre-population
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    const keyword = req.query.keyword || '';
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
    const bedrooms = req.query.bedrooms ? parseInt(req.query.bedrooms) : null;
    const bathrooms = req.query.bathrooms ? parseInt(req.query.bathrooms) : null;

    const where = {
      status: 'AVAILABLE',
      categoryId: dbCategory.id,
      listingType: listingType
    };

    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
        { shortAddress: { contains: keyword } }
      ];
    }

    if (cityFilter) {
      where.city = { contains: cityFilter };
    }

    if (districtFilter) {
      where.district = { contains: districtFilter };
    }

    if (minPrice !== null || maxPrice !== null) {
      where.price = {};
      if (minPrice !== null) where.price.gte = minPrice;
      if (maxPrice !== null) where.price.lte = maxPrice;
    }

    if (bedrooms !== null && !isNaN(bedrooms)) {
      where.bedrooms = bedrooms;
    }

    if (bathrooms !== null && !isNaN(bathrooms)) {
      where.bathrooms = bathrooms;
    }

    // Query DB
    const totalResults = await prisma.property.count({ where });
    const totalPages = Math.ceil(totalResults / limit);

    const properties = await prisma.property.findMany({
      where,
      include: {
        category: true,
        images: true
      },
      skip,
      take: limit,
      orderBy: [
        { isFeatured: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    const categories = await prisma.category.findMany();

    // Dynamic Meta Title & Meta Description
    let locationLabel = '';
    if (districtFilter && cityFilter) {
      locationLabel = ` di ${districtFilter}, ${cityFilter}`;
    } else if (cityFilter) {
      locationLabel = ` di ${cityFilter}`;
    }

    let pageLabel = dbCategory.name + ' ' + (listingType === 'SALE' ? 'Dijual' : 'Disewa');
    if (baseSeo === 'kontrakan') pageLabel = 'Kontrakan';
    else if (baseSeo === 'kos') pageLabel = 'Kos';

    const metaTitle = `${pageLabel}${locationLabel} Murah & Terbaru | Properti Indahweb`;
    const metaDescription = `Temukan listing ${pageLabel.toLowerCase()}${locationLabel} terbaru dengan pilihan terlengkap, harga murah, langsung hubungi pemilik / agen via WhatsApp.`;
    
    const canonicalUrl = `${req.protocol}://${req.get('host')}/${baseSeo}` + 
                         (cityParam ? `/${cityParam}` : '') + 
                         (districtParam ? `/${districtParam}` : '');

    res.render('pages/catalog', {
      metaTitle,
      metaDescription,
      canonicalUrl,
      properties,
      categories,
      totalResults,
      totalPages,
      currentPage: page,
      filters: {
        keyword,
        listingType,
        category: categorySlug,
        city: cityFilter,
        district: districtFilter,
        minPrice: req.query.minPrice || '',
        maxPrice: req.query.maxPrice || '',
        bedrooms: req.query.bedrooms || '',
        bathrooms: req.query.bathrooms || ''
      },
      submitted_success: req.query.submitted === '1',
      breadcrumbs
    });
  } catch (error) {
    next(error);
  }
};

exports.getSitemap = async (req, res, next) => {
  try {
    const host = buildSiteUrl(req);
    const urls = [];

    // 1. Static public pages
    [
      { path: '/', changefreq: 'daily', priority: '1.0' },
      { path: '/catalog', changefreq: 'daily', priority: '0.9' },
      { path: '/artikel', changefreq: 'daily', priority: '0.9' },
      { path: '/pasang-iklan', changefreq: 'weekly', priority: '0.8' },
      { path: '/packages', changefreq: 'weekly', priority: '0.7' },
      { path: '/disclaimer', changefreq: 'monthly', priority: '0.3' }
    ].forEach(page => {
      appendSitemapUrl(urls, host, page.path, {
        changefreq: page.changefreq,
        priority: page.priority
      });
    });

    // 2. SEO Category Landing Pages
    const seoCategories = [
      { path: '/rumah-dijual', catSlug: 'rumah', type: 'SALE' },
      { path: '/tanah-dijual', catSlug: 'tanah', type: 'SALE' },
      { path: '/kontrakan', catSlug: 'rumah', type: 'RENT' },
      { path: '/kos', catSlug: 'kos', type: 'RENT' }
    ];

    seoCategories.forEach(item => {
      appendSitemapUrl(urls, host, item.path, {
        changefreq: 'daily',
        priority: '0.8'
      });
    });

    // 3. SEO Location Pages (Dynamic based on existing locations)
    const activeProperties = await prisma.property.findMany({
      where: { status: 'AVAILABLE' },
      include: { category: true, images: true }
    });

    const locations = new Set();
    activeProperties.forEach(prop => {
      const citySlug = slugifyPathSegment(prop.city);
      const distSlug = slugifyPathSegment(prop.district);
      const catSlug = prop.category.slug;
      const type = prop.listingType;

      let basePath = '';
      if (catSlug === 'rumah' && type === 'SALE') basePath = '/rumah-dijual';
      else if (catSlug === 'tanah' && type === 'SALE') basePath = '/tanah-dijual';
      else if (catSlug === 'rumah' && type === 'RENT') basePath = '/kontrakan';
      else if (catSlug === 'kos') basePath = '/kos';

      if (basePath) {
        if (citySlug) locations.add(`${basePath}/${citySlug}`);
        if (citySlug && distSlug) locations.add(`${basePath}/${citySlug}/${distSlug}`);
      }
    });

    locations.forEach(loc => {
      appendSitemapUrl(urls, host, loc, {
        changefreq: 'weekly',
        priority: '0.6'
      });
    });

    // 4. Detail Property Pages
    activeProperties.forEach(prop => {
      appendSitemapUrl(urls, host, `/property/${prop.slug}`, {
        lastmod: prop.updatedAt,
        changefreq: 'weekly',
        priority: prop.isFeatured ? '0.8' : '0.7',
        images: prop.images.map(image => image.url)
      });
    });

    // 5. Public agent profile pages for agents/admins with active listings
    const activeAgents = await prisma.user.findMany({
      where: {
        properties: {
          some: { status: 'AVAILABLE' }
        }
      },
      include: {
        properties: {
          where: { status: 'AVAILABLE' },
          orderBy: { updatedAt: 'desc' },
          take: 1
        }
      }
    });

    activeAgents.forEach(agent => {
      appendSitemapUrl(urls, host, `/agen/${agent.id}`, {
        lastmod: agent.properties[0]?.updatedAt || agent.updatedAt,
        changefreq: 'weekly',
        priority: '0.5'
      });
    });

    // 6. Blog category pages with published articles
    const activeBlogCategories = await prisma.blogCategory.findMany({
      where: {
        posts: {
          some: { status: 'published' }
        }
      },
      include: {
        posts: {
          where: { status: 'published' },
          orderBy: { updated_at: 'desc' },
          take: 1
        }
      }
    });

    activeBlogCategories.forEach(category => {
      appendSitemapUrl(urls, host, `/artikel/kategori/${category.slug}`, {
        lastmod: category.posts[0]?.updated_at || category.updated_at,
        changefreq: 'weekly',
        priority: '0.6'
      });
    });

    // 7. Detail Blog Article Pages
    const activeBlogPosts = await prisma.blogPost.findMany({
      where: { status: 'published' },
      orderBy: { published_at: 'desc' }
    });

    activeBlogPosts.forEach(post => {
      const lastmodDate = post.published_at || post.updated_at || new Date();
      appendSitemapUrl(urls, host, `/artikel/${post.slug}`, {
        lastmod: lastmodDate,
        changefreq: 'weekly',
        priority: '0.7',
        images: post.featured_image ? [post.featured_image] : []
      });
    });

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

    urls.forEach(url => {
      xml += `  <url>\n`;
      xml += `    <loc>${escapeXml(url.loc)}</loc>\n`;
      if (url.lastmod) xml += `    <lastmod>${escapeXml(url.lastmod)}</lastmod>\n`;
      if (url.changefreq) xml += `    <changefreq>${escapeXml(url.changefreq)}</changefreq>\n`;
      if (url.priority) xml += `    <priority>${escapeXml(url.priority)}</priority>\n`;
      url.images.forEach(imageUrl => {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${escapeXml(imageUrl)}</image:loc>\n`;
        xml += `    </image:image>\n`;
      });
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (error) {
    next(error);
  }
};

exports.getInvoiceDetail = async (req, res, next) => {
  try {
    const { invoiceNumber } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber },
      include: {
        property: {
          include: { category: true }
        },
        user: true
      }
    });

    if (!invoice) {
      return res.status(404).send('Invoice tidak ditemukan.');
    }

    // Protect: only the invoice owner or admin can view
    if (!req.session.user || (invoice.userId !== req.session.user.id && req.session.user.role !== 'super_admin' && req.session.user.role !== 'admin')) {
      return res.status(403).send('Akses Ditolak: Anda tidak berhak melihat invoice ini.');
    }

    res.render('pages/invoice-detail', {
      title: `Detail Invoice ${invoice.invoiceNumber}`,
      invoice,
      message: req.query.msg || null,
      error: req.query.err || null
    });
  } catch (error) {
    next(error);
  }
};

exports.getPackagesPage = async (req, res, next) => {
  try {
    res.render('pages/packages', {
      title: 'Paket Iklan Premium Properti Indahweb',
      description: 'Tingkatkan jangkauan promosi properti Anda dengan paket iklan premium dan lencana terverifikasi.'
    });
  } catch (error) {
    next(error);
  }
};

// GET /agen/:id
exports.getAgentProfile = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(404).send('Agen tidak ditemukan.');
    }

    const agent = await prisma.user.findUnique({
      where: { id }
    });

    if (!agent) {
      return res.status(404).send('Agen tidak ditemukan.');
    }

    const properties = await prisma.property.findMany({
      where: {
        userId: id,
        status: 'AVAILABLE'
      },
      include: { category: true, images: true },
      orderBy: { createdAt: 'desc' }
    });

    res.render('pages/agent-profile', {
      title: `Profil Agen: ${agent.name} | Properti Indahweb`,
      description: `Lihat listing properti aktif yang dipasarkan oleh ${agent.name} di Properti Indahweb.`,
      agent,
      properties
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/properties/favorites
exports.getFavoritesApi = async (req, res, next) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.json([]);
    }

    const idList = ids
      .split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id));

    if (idList.length === 0) {
      return res.json([]);
    }

    const properties = await prisma.property.findMany({
      where: {
        id: { in: idList },
        status: 'AVAILABLE'
      },
      include: { category: true, images: true }
    });

    res.json(properties);
  } catch (error) {
    next(error);
  }
};

// GET /disclaimer
exports.getDisclaimer = async (req, res, next) => {
  try {
    res.render('pages/disclaimer', {
      title: 'Pernyataan Penyangkal (Disclaimer) | Properti Indahweb',
      description: 'Pernyataan Penyangkal (Disclaimer) penggunaan portal informasi Properti Indahweb.'
    });
  } catch (error) {
    next(error);
  }
};
