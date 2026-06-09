const { PrismaClient } = require('@prisma/client');
const slugify = require('slugify');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function resolveRegionSelection({ provinceCode, cityCode, districtCode }) {
  if (!provinceCode || !cityCode || !districtCode) {
    const error = new Error('Pilih provinsi, kota/kabupaten, dan kecamatan dari daftar wilayah.');
    error.status = 400;
    throw error;
  }

  const district = await prisma.regionDistrict.findFirst({
    where: {
      code: districtCode,
      cityCode,
      city: {
        provinceCode,
        province: {
          code: provinceCode
        }
      }
    },
    include: {
      city: {
        include: {
          province: true
        }
      }
    }
  });

  if (!district) {
    const error = new Error('Kombinasi provinsi, kota/kabupaten, dan kecamatan tidak valid.');
    error.status = 400;
    throw error;
  }

  return {
    province: district.city.province.name,
    city: district.city.name,
    district: district.name,
    provinceCode: district.city.province.code,
    cityCode: district.city.code,
    districtCode: district.code
  };
}

exports.postQuickPost = async (req, res, next) => {
  try {
    let userId = req.session.user ? req.session.user.id : null;
    let authorName = '';
    let authorWhatsapp = '';

    // 1. Guest Registration if not logged in
    if (!userId) {
      const { guestName, guestWhatsapp, guestEmail, guestPassword } = req.body;

      if (!guestName || !guestWhatsapp || !guestEmail || !guestPassword) {
        return res.status(400).send('Detail pendaftaran tamu tidak lengkap.');
      }

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: guestEmail },
            { whatsapp: guestWhatsapp }
          ]
        }
      });

      if (existingUser) {
        return res.status(400).send('Nomor WhatsApp atau Email Anda sudah terdaftar. Silakan login terlebih dahulu.');
      }

      // Create new user account
      const hashedPassword = await bcrypt.hash(guestPassword, 10);
      const newUser = await prisma.user.create({
        data: {
          name: guestName,
          whatsapp: guestWhatsapp,
          email: guestEmail,
          password: hashedPassword,
          role: 'user'
        }
      });

      // Automatically sign in the user
      req.session.user = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        whatsapp: newUser.whatsapp,
        role: newUser.role
      };

      userId = newUser.id;
      authorName = newUser.name;
      authorWhatsapp = newUser.whatsapp;
    } else {
      authorName = req.session.user.name;
      authorWhatsapp = req.session.user.whatsapp;
    }

    // Verify posting limits based on user role to prevent spamming
    const activeCount = await prisma.property.count({
      where: {
        userId: userId,
        status: { in: ['AVAILABLE', 'PENDING'] }
      }
    });

    const currentUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (currentUser && currentUser.role === 'user') {
      if (activeCount >= 1) {
        return res.status(400).send('Batas posting tercapai: Akun gratis dibatasi maksimal 1 iklan aktif. Silakan hubungi admin atau aktifkan Paket Agen untuk menambah properti.');
      }
    } else if (currentUser && currentUser.role === 'agent') {
      const agentLimit = 20;
      if (activeCount >= agentLimit) {
        return res.status(400).send(`Batas posting tercapai: Paket Agen dibatasi maksimal ${agentLimit} iklan aktif untuk mencegah spam.`);
      }
    }

    // 2. Parse listing metadata
    const {
      title,
      description,
      price,
      listingType,
      categoryId,
      landSize,
      buildingSize,
      bedrooms,
      bathrooms,
      certificate,
      electricity,
      waterSource,
      garage,
      province,
      city,
      district,
      provinceCode,
      cityCode,
      districtCode,
      shortAddress,
      facilities
    } = req.body;

    const region = await resolveRegionSelection({ provinceCode, cityCode, districtCode });

    // Generate unique slug
    const uniqueSlug = slugify(title, { lower: true, strict: true }) + '-' + Date.now();

    // Map facilities array to comma-separated string
    const facilitiesStr = Array.isArray(facilities) ? facilities.join(', ') : (facilities || '');

    // Insert property
    const newProperty = await prisma.property.create({
      data: {
        title,
        slug: uniqueSlug,
        description,
        price: parseFloat(price),
        listingType,
        categoryId: parseInt(categoryId),
        landSize: parseInt(landSize),
        buildingSize: parseInt(buildingSize),
        bedrooms: parseInt(bedrooms),
        bathrooms: parseInt(bathrooms),
        certificate,
        electricity: electricity || null,
        waterSource: waterSource || null,
        garage: garage ? parseInt(garage) : 0,
        facilities: facilitiesStr || null,
        province: region.province,
        city: region.city,
        district: region.district,
        provinceCode: region.provinceCode,
        cityCode: region.cityCode,
        districtCode: region.districtCode,
        shortAddress,
        contactName: authorName,
        whatsappNumber: authorWhatsapp,
        userId: userId,
        status: 'PENDING'
      }
    });

    // 3. Handle File Upload Attachments
    const imageRecords = [];

    // Main image upload handler
    if (req.files && req.files.mainImage && req.files.mainImage[0]) {
      const mainImgFile = req.files.mainImage[0];
      const relativeUrl = `/uploads/${mainImgFile.filename}`;
      
      imageRecords.push({
        propertyId: newProperty.id,
        url: relativeUrl,
        isMain: true
      });
    }

    // Gallery images handler
    if (req.files && req.files.galleryImages) {
      req.files.galleryImages.forEach(file => {
        const relativeUrl = `/uploads/${file.filename}`;
        imageRecords.push({
          propertyId: newProperty.id,
          url: relativeUrl,
          isMain: false
        });
      });
    }

    // Insert image records in database
    if (imageRecords.length > 0) {
      await prisma.propertyImage.createMany({
        data: imageRecords
      });
    }

    // Insert invoice for package selection
    const packageCode = req.body.packageCode || 'GRATIS';
    let packageName = 'Paket Gratis';
    let amount = 0;

    if (packageCode === 'FEATURED_7') {
      packageName = 'Featured 7 Hari';
      amount = 50000;
    } else if (packageCode === 'FEATURED_30') {
      packageName = 'Featured 30 Hari';
      amount = 150000;
    } else if (packageCode === 'AGEN_BULANAN') {
      packageName = 'Paket Agen Bulanan';
      amount = 250000;
    }

    const invoiceNumber = 'INV-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);

    await prisma.invoice.create({
      data: {
        invoiceNumber,
        userId: userId,
        propertyId: newProperty.id,
        packageCode,
        packageName,
        amount,
        status: packageCode === 'GRATIS' ? 'PAID' : 'PENDING',
        paidAt: packageCode === 'GRATIS' ? new Date() : null
      }
    });

    if (amount > 0) {
      res.redirect(`/invoice/${invoiceNumber}`);
    } else {
      res.redirect('/dashboard?submitted=1');
    }
  } catch (error) {
    next(error);
  }
};

exports.trackWaClick = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id || req.params.listingId);
    const property = await prisma.property.findUnique({
      where: { id }
    });

    if (!property) {
      return res.status(404).send('Listing properti tidak ditemukan.');
    }

    // Log Click Track
    const ip = req.ip || '127.0.0.1';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    const userAgent = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || 'Direct';

    // Parse Device
    let device = 'Desktop';
    if (/mobile/i.test(userAgent)) {
      device = 'Mobile';
    } else if (/tablet/i.test(userAgent)) {
      device = 'Tablet';
    }

    await prisma.whatsappTrack.create({
      data: {
        propertyId: id,
        ipHash,
        userAgent: userAgent.substring(0, 255),
        referrer: referrer.substring(0, 255),
        device
      }
    });

    // Redirect to WhatsApp chat link
    const cleanedPhone = property.whatsappNumber.replace(/\D/g, '');
    const propUrl = `${req.protocol}://${req.get('host')}/property/${property.slug}`;
    const textMsg = `Halo ${property.contactName}, saya tertarik dengan properti "${property.title}" yang saya lihat di Properti Indahweb (${propUrl}). Apakah masih tersedia?`;
    
    const waUrl = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(textMsg)}`;
    
    res.redirect(waUrl);
  } catch (error) {
    next(error);
  }
};

exports.approveProperty = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.property.update({
      where: { id },
      data: { status: 'AVAILABLE' }
    });
    res.redirect('/admin/dashboard?msg=Properti berhasil disetujui.');
  } catch (error) {
    next(error);
  }
};

exports.rejectProperty = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.property.update({
      where: { id },
      data: { status: 'REJECTED' }
    });
    res.redirect('/admin/dashboard?msg=Properti berhasil ditolak.');
  } catch (error) {
    next(error);
  }
};

exports.updatePropertyStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const userId = req.session.user.id;

    const property = await prisma.property.findUnique({
      where: { id }
    });

    if (!property) {
      return res.status(404).send('Properti tidak ditemukan.');
    }

    if (property.userId !== userId && req.session.user.role !== 'super_admin' && req.session.user.role !== 'admin') {
      return res.status(403).send('Anda tidak memiliki akses untuk mengubah properti ini.');
    }

    if (!['AVAILABLE', 'SOLD', 'RENTED'].includes(status)) {
      return res.status(400).send('Status tidak valid.');
    }

    await prisma.property.update({
      where: { id },
      data: { status }
    });

    res.redirect('/dashboard?msg=Status properti berhasil diperbarui.');
  } catch (error) {
    next(error);
  }
};

exports.deleteProperty = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.session.user.id;

    const property = await prisma.property.findUnique({
      where: { id }
    });

    if (!property) {
      return res.status(404).send('Properti tidak ditemukan.');
    }

    if (property.userId !== userId && req.session.user.role !== 'super_admin' && req.session.user.role !== 'admin') {
      return res.status(403).send('Anda tidak memiliki akses untuk menghapus properti ini.');
    }

    await prisma.property.delete({
      where: { id }
    });

    if (req.session.user.role === 'super_admin' || req.session.user.role === 'admin') {
      res.redirect('/admin/dashboard?msg=Properti berhasil dihapus.');
    } else {
      res.redirect('/dashboard?msg=Properti berhasil dihapus.');
    }
  } catch (error) {
    next(error);
  }
};

exports.approveInvoice = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { property: true }
    });

    if (!invoice) {
      return res.status(404).send('Invoice tidak ditemukan.');
    }

    // Update Invoice Status to PAID
    await prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date()
      }
    });

    // Activate Package Benefits
    if (invoice.propertyId) {
      let isFeatured = false;
      let featuredUntil = null;

      if (invoice.packageCode === 'FEATURED_7') {
        isFeatured = true;
        featuredUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      } else if (invoice.packageCode === 'FEATURED_30') {
        isFeatured = true;
        featuredUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }

      await prisma.property.update({
        where: { id: invoice.propertyId },
        data: {
          status: 'AVAILABLE', // Auto publish listing when paid
          isFeatured,
          featuredUntil
        }
      });
    }

    // If Package is AGEN_BULANAN, upgrade User Role to agent
    if (invoice.packageCode === 'AGEN_BULANAN') {
      await prisma.user.update({
        where: { id: invoice.userId },
        data: { role: 'agent' }
      });
    }

    res.redirect('/admin/dashboard?msg=Invoice berhasil disetujui.');
  } catch (error) {
    next(error);
  }
};

exports.rejectInvoice = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.invoice.update({
      where: { id },
      data: { status: 'REJECTED' }
    });
    res.redirect('/admin/dashboard?msg=Invoice berhasil ditolak.');
  } catch (error) {
    next(error);
  }
};

exports.postUploadProof = async (req, res, next) => {
  try {
    const { invoiceNumber } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber }
    });

    if (!invoice) {
      return res.status(404).send('Invoice tidak ditemukan.');
    }

    if (invoice.userId !== req.session.user.id) {
      return res.status(403).send('Akses Ditolak.');
    }

    if (!req.file) {
      return res.redirect(`/invoice/${invoiceNumber}?err=Harap pilih file bukti pembayaran.`);
    }

    const proofUrl = `/uploads/${req.file.filename}`;

    await prisma.invoice.update({
      where: { invoiceNumber },
      data: {
        paymentProof: proofUrl,
        status: 'PENDING' // Keep/reset pending for admin approval
      }
    });

    res.redirect(`/invoice/${invoiceNumber}?msg=Bukti pembayaran berhasil diunggah. Menunggu konfirmasi admin.`);
  } catch (error) {
    next(error);
  }
};

exports.getEditListing = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.session.user.id;

    const property = await prisma.property.findUnique({
      where: { id },
      include: { category: true, images: true }
    });

    if (!property) {
      return res.status(404).render('pages/404', {
        title: 'Properti Tidak Ditemukan',
        description: 'Properti yang ingin Anda edit tidak ditemukan.'
      });
    }

    if (property.userId !== userId && req.session.user.role !== 'super_admin' && req.session.user.role !== 'admin') {
      return res.status(403).send('Akses Ditolak: Anda tidak memiliki hak untuk mengedit properti ini.');
    }

    const categories = await prisma.category.findMany();

    res.render('pages/edit-listing', {
      title: `Edit: ${property.title}`,
      description: 'Edit dan perbarui data listing properti Anda.',
      property,
      categories,
      error: req.query.err || null
    });
  } catch (error) {
    next(error);
  }
};

exports.postEditListing = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.session.user.id;

    const property = await prisma.property.findUnique({
      where: { id },
      include: { images: true }
    });

    if (!property) {
      return res.status(404).send('Properti tidak ditemukan.');
    }

    if (property.userId !== userId && req.session.user.role !== 'super_admin' && req.session.user.role !== 'admin') {
      return res.status(403).send('Akses Ditolak.');
    }

    const {
      title, description, price, listingType, categoryId,
      landSize, buildingSize, bedrooms, bathrooms, certificate,
      electricity, waterSource, garage, province, city, district,
      provinceCode, cityCode, districtCode, shortAddress, facilities
    } = req.body;

    const facilitiesStr = Array.isArray(facilities) ? facilities.join(', ') : (facilities || '');
    const region = await resolveRegionSelection({ provinceCode, cityCode, districtCode });

    await prisma.property.update({
      where: { id },
      data: {
        title,
        description,
        price: parseFloat(price),
        listingType,
        categoryId: parseInt(categoryId),
        landSize: parseInt(landSize) || 0,
        buildingSize: parseInt(buildingSize) || 0,
        bedrooms: parseInt(bedrooms) || 0,
        bathrooms: parseInt(bathrooms) || 0,
        certificate: certificate || '',
        electricity: electricity || null,
        waterSource: waterSource || null,
        garage: garage ? parseInt(garage) : 0,
        facilities: facilitiesStr || null,
        province: region.province,
        city: region.city,
        district: region.district,
        provinceCode: region.provinceCode,
        cityCode: region.cityCode,
        districtCode: region.districtCode,
        shortAddress,
        status: 'PENDING'  // Back to review queue after edit
      }
    });

    // Handle new image uploads
    const newImageRecords = [];

    if (req.files && req.files.mainImage && req.files.mainImage[0]) {
      await prisma.propertyImage.deleteMany({ where: { propertyId: id, isMain: true } });
      newImageRecords.push({
        propertyId: id,
        url: `/uploads/${req.files.mainImage[0].filename}`,
        isMain: true
      });
    }

    if (req.files && req.files.galleryImages && req.files.galleryImages.length > 0) {
      await prisma.propertyImage.deleteMany({ where: { propertyId: id, isMain: false } });
      req.files.galleryImages.forEach(file => {
        newImageRecords.push({
          propertyId: id,
          url: `/uploads/${file.filename}`,
          isMain: false
        });
      });
    }

    if (newImageRecords.length > 0) {
      await prisma.propertyImage.createMany({ data: newImageRecords });
    }

    const redirectTarget = (req.session.user.role === 'super_admin' || req.session.user.role === 'admin')
      ? '/admin/dashboard?msg=Listing berhasil diperbarui dan menunggu persetujuan ulang.'
      : '/dashboard?msg=Listing berhasil diperbarui dan menunggu persetujuan admin.';

    res.redirect(redirectTarget);
  } catch (error) {
    next(error);
  }
};
