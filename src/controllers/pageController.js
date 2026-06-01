const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

    res.render('pages/home', {
      title: 'Portal Properti Terpercaya',
      description: 'Portal jual beli dan sewa properti lokal Indonesia yang cepat, ringan, dan gratis biaya pasang iklan.',
      categories,
      featuredProperties,
      latestProperties
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
    const host = `${req.protocol}://${req.get('host')}`;
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // 1. Static Pages
    const staticUrls = ['/', '/catalog', '/pasang-iklan'];
    staticUrls.forEach(url => {
      xml += `  <url>\n    <loc>${host}${url}</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
    });

    // 2. SEO Category Landing Pages
    const seoCategories = [
      { path: '/rumah-dijual', catSlug: 'rumah', type: 'SALE' },
      { path: '/tanah-dijual', catSlug: 'tanah', type: 'SALE' },
      { path: '/kontrakan', catSlug: 'rumah', type: 'RENT' },
      { path: '/kos', catSlug: 'kos', type: 'RENT' }
    ];

    seoCategories.forEach(item => {
      xml += `  <url>\n    <loc>${host}${item.path}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });

    // 3. SEO Location Pages (Dynamic based on existing locations)
    const activeProperties = await prisma.property.findMany({
      where: { status: 'AVAILABLE' },
      include: { category: true }
    });

    const locations = new Set();
    activeProperties.forEach(prop => {
      const citySlug = prop.city.toLowerCase().trim().replace(/\s+/g, '-');
      const distSlug = prop.district.toLowerCase().trim().replace(/\s+/g, '-');
      const catSlug = prop.category.slug;
      const type = prop.listingType;

      let basePath = '';
      if (catSlug === 'rumah' && type === 'SALE') basePath = '/rumah-dijual';
      else if (catSlug === 'tanah' && type === 'SALE') basePath = '/tanah-dijual';
      else if (catSlug === 'rumah' && type === 'RENT') basePath = '/kontrakan';
      else if (catSlug === 'kos') basePath = '/kos';

      if (basePath) {
        locations.add(`${basePath}/${citySlug}`);
        locations.add(`${basePath}/${citySlug}/${distSlug}`);
      }
    });

    locations.forEach(loc => {
      xml += `  <url>\n    <loc>${host}${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
    });

    // 4. Detail Property Pages
    activeProperties.forEach(prop => {
      xml += `  <url>\n    <loc>${host}/property/${prop.slug}</loc>\n    <lastmod>${prop.updatedAt.toISOString().split('T')[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    });

    // 5. Detail Blog Article Pages
    const activeBlogPosts = await prisma.blogPost.findMany({
      where: { status: 'published' }
    });

    activeBlogPosts.forEach(post => {
      const lastmodDate = post.published_at || post.updated_at || new Date();
      xml += `  <url>\n    <loc>${host}/artikel/${post.slug}</loc>\n    <lastmod>${lastmodDate.toISOString().split('T')[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    });

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
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
