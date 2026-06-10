const DEFAULT_PACKAGES = [
  {
    code: 'GRATIS',
    name: 'Paket Gratis',
    description: 'Untuk pemilik atau agen yang baru mulai memasang iklan.',
    price: 0,
    durationDays: null,
    listingLimit: 1,
    isFeatured: false,
    featuredDurationDays: null,
    grantsAgent: false,
    isPopular: false,
    isActive: true,
    sortOrder: 1,
    benefits: [
      '1 iklan properti aktif',
      'Tampil di katalog publik',
      'Tombol chat WhatsApp',
      'Review normal'
    ]
  },
  {
    code: 'FEATURED_7',
    name: 'Featured 7 Hari',
    description: 'Promosi cepat untuk listing yang ingin lebih menonjol.',
    price: 50000,
    durationDays: 7,
    listingLimit: 1,
    isFeatured: true,
    featuredDurationDays: 7,
    grantsAgent: false,
    isPopular: false,
    isActive: true,
    sortOrder: 2,
    benefits: [
      'Tampil di slot properti unggulan',
      'Lencana premium pada listing',
      'Prioritas tampilan selama 7 hari',
      'Review prioritas'
    ]
  },
  {
    code: 'FEATURED_30',
    name: 'Featured 30 Hari',
    description: 'Exposure lebih lama untuk listing prioritas.',
    price: 150000,
    durationDays: 30,
    listingLimit: 1,
    isFeatured: true,
    featuredDurationDays: 30,
    grantsAgent: false,
    isPopular: true,
    isActive: true,
    sortOrder: 3,
    benefits: [
      'Semua benefit Featured 7 Hari',
      'Prioritas tampilan selama 30 hari',
      'Cocok untuk listing utama',
      'Statistik lead di dashboard'
    ]
  },
  {
    code: 'AGEN_BULANAN',
    name: 'Paket Agen Bulanan',
    description: 'Untuk agen aktif yang membutuhkan kuota listing lebih besar.',
    price: 250000,
    durationDays: 30,
    listingLimit: 20,
    isFeatured: false,
    featuredDurationDays: null,
    grantsAgent: true,
    isPopular: false,
    isActive: true,
    sortOrder: 4,
    benefits: [
      'Posting hingga 20 properti aktif',
      'Lencana agen terverifikasi',
      'Halaman profil agen publik',
      'Masa aktif agen 30 hari'
    ]
  }
];

function serializeBenefits(benefits) {
  if (Array.isArray(benefits)) {
    return benefits.map(item => String(item).trim()).filter(Boolean).join('\n');
  }
  return String(benefits || '').trim();
}

function parseBenefits(benefits) {
  return String(benefits || '')
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean);
}

function formatPackagePrice(price) {
  return Number(price || 0).toLocaleString('id-ID');
}

function packageSnapshot(pkg) {
  return JSON.stringify({
    code: pkg.code,
    name: pkg.name,
    description: pkg.description || null,
    price: Number(pkg.price || 0),
    durationDays: pkg.durationDays || null,
    listingLimit: pkg.listingLimit || 1,
    isFeatured: Boolean(pkg.isFeatured),
    featuredDurationDays: pkg.featuredDurationDays || null,
    grantsAgent: Boolean(pkg.grantsAgent),
    benefits: parseBenefits(pkg.benefits)
  });
}

async function seedDefaultPackages(prisma) {
  for (const pkg of DEFAULT_PACKAGES) {
    await prisma.adPackage.upsert({
      where: { code: pkg.code },
      update: {
        name: pkg.name,
        description: pkg.description,
        sortOrder: pkg.sortOrder
      },
      create: {
        ...pkg,
        benefits: serializeBenefits(pkg.benefits)
      }
    });
  }
}

async function findActivePackages(prisma) {
  const packages = await prisma.adPackage.findMany({
    where: { isActive: true },
    orderBy: [
      { sortOrder: 'asc' },
      { id: 'asc' }
    ]
  });

  if (packages.length > 0) {
    return packages;
  }

  await seedDefaultPackages(prisma);
  return prisma.adPackage.findMany({
    where: { isActive: true },
    orderBy: [
      { sortOrder: 'asc' },
      { id: 'asc' }
    ]
  });
}

async function findPackageForCheckout(prisma, code) {
  const fallbackCode = code || 'GRATIS';
  let pkg = await prisma.adPackage.findFirst({
    where: {
      code: fallbackCode,
      isActive: true
    }
  });

  if (!pkg) {
    await seedDefaultPackages(prisma);
    pkg = await prisma.adPackage.findFirst({
      where: {
        code: fallbackCode,
        isActive: true
      }
    });
  }

  if (!pkg) {
    pkg = await prisma.adPackage.findFirst({
      where: {
        code: 'GRATIS',
        isActive: true
      }
    });
  }

  return pkg;
}

module.exports = {
  DEFAULT_PACKAGES,
  serializeBenefits,
  parseBenefits,
  formatPackagePrice,
  packageSnapshot,
  seedDefaultPackages,
  findActivePackages,
  findPackageForCheckout
};
