const { PrismaClient } = require('@prisma/client');
const slugify = require('slugify');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {
  findPackageForCheckout,
  packageSnapshot
} = require('../services/adPackageService');

const prisma = new PrismaClient();

function addDays(date, days) {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

function legacyFeaturedDays(packageCode) {
  if (packageCode === 'FEATURED_7') return 7;
  if (packageCode === 'FEATURED_30') return 30;
  return null;
}

function legacyAgentPackage(packageCode) {
  return packageCode === 'AGEN_BULANAN';
}

async function applyPaidPackageBenefits(invoice, options = {}) {
  const now = new Date();
  const publishProperty = options.publishProperty !== false;
  const featuredDays = invoice.featuredDurationDays || legacyFeaturedDays(invoice.packageCode);
  const grantsAgent = invoice.grantsAgent || legacyAgentPackage(invoice.packageCode);
  const durationDays = invoice.durationDays || (grantsAgent ? 30 : null);
  const listingLimit = invoice.listingLimit || (grantsAgent ? 20 : 1);

  if (invoice.propertyId) {
    await prisma.property.update({
      where: { id: invoice.propertyId },
      data: {
        ...(publishProperty ? { status: 'AVAILABLE' } : {}),
        isFeatured: Boolean(featuredDays),
        featuredUntil: featuredDays ? addDays(now, featuredDays) : null
      }
    });
  }

  if (grantsAgent) {
    await prisma.user.update({
      where: { id: invoice.userId },
      data: {
        role: 'agent',
        listingLimit,
        agentUntil: durationDays ? addDays(now, durationDays) : null,
        activePackageCode: invoice.packageCode
      }
    });
  }
}

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
    const selectedPackage = await findPackageForCheckout(prisma, req.body.packageCode || 'GRATIS');

    if (!selectedPackage) {
      return res.status(400).send('Paket iklan tidak tersedia.');
    }

    // 1. Guest Registration if not logged in
    if (!userId) {
      const { guestName, guestWhatsapp, guestEmail, guestPassword, guestPasswordConfirmation } = req.body;

      if (!guestName || !guestWhatsapp || !guestPassword || !guestPasswordConfirmation) {
        return res.status(400).send('Detail pendaftaran tamu tidak lengkap.');
      }

      if (guestPassword !== guestPasswordConfirmation) {
        return res.status(400).send('Konfirmasi kata sandi tidak sama.');
      }

      if (guestPassword.length < 6) {
        return res.status(400).send('Kata sandi minimal berisi 6 karakter.');
      }

      // Check if user already exists
      const searchClauses = [{ whatsapp: guestWhatsapp }];
      if (guestEmail && guestEmail.trim() !== '') {
        searchClauses.push({ email: guestEmail.trim() });
      }

      const existingUser = await prisma.user.findFirst({
        where: {
          OR: searchClauses
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
          email: (guestEmail && guestEmail.trim() !== '') ? guestEmail.trim() : null,
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

    const currentLimit = currentUser ? (currentUser.listingLimit || (currentUser.role === 'agent' ? 20 : 1)) : 1;
    const selectedLimit = selectedPackage.listingLimit || 1;
    const effectiveLimit = Math.max(currentLimit, selectedLimit);

    const isPrivilegedUser = currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'admin');
    if (!isPrivilegedUser && activeCount >= effectiveLimit) {
      return res.status(400).send(`Batas posting tercapai: paket Anda saat ini membatasi maksimal ${effectiveLimit} iklan aktif. Pilih paket dengan limit lebih besar atau nonaktifkan listing lama.`);
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
    const packageCode = selectedPackage.code;
    const amount = Number(selectedPackage.price || 0);

    const invoiceNumber = 'INV-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        userId: userId,
        propertyId: newProperty.id,
        packageCode,
        packageName: selectedPackage.name,
        amount,
        durationDays: selectedPackage.durationDays || null,
        listingLimit: selectedPackage.listingLimit || 1,
        featuredDurationDays: selectedPackage.featuredDurationDays || null,
        grantsAgent: selectedPackage.grantsAgent,
        packageSnapshot: packageSnapshot(selectedPackage),
        status: amount === 0 ? 'PAID' : 'PENDING',
        paidAt: amount === 0 ? new Date() : null
      }
    });

    if (amount > 0) {
      res.redirect(`/invoice/${invoiceNumber}`);
    } else {
      await applyPaidPackageBenefits(invoice, { publishProperty: false });
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
    const textMsg = `Halo ${property.contactName}, saya tertarik dengan properti "${property.title}" yang saya lihat di 1rumah.biz.id (${propUrl}). Apakah masih tersedia?`;
    
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
    const allowedRedirects = ['/dashboard', '/admin/dashboard'];
    const requestedReturnTo = req.body.returnTo;

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

    const defaultReturnTo = (req.session.user.role === 'super_admin' || req.session.user.role === 'admin')
      ? '/admin/dashboard'
      : '/dashboard';
    const returnTo = allowedRedirects.includes(requestedReturnTo) ? requestedReturnTo : defaultReturnTo;

    res.redirect(`${returnTo}?msg=Properti berhasil dihapus.`);
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

    await applyPaidPackageBenefits(invoice);

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
