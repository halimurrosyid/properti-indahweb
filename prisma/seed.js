const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding database...');

  // 1. Create Default Categories
  const categoriesData = [
    { name: 'Rumah', slug: 'rumah' },
    { name: 'Ruko', slug: 'ruko' },
    { name: 'Tanah', slug: 'tanah' },
    { name: 'Apartemen', slug: 'apartemen' },
    { name: 'Kos', slug: 'kos' }
  ];

  const categories = [];
  for (const cat of categoriesData) {
    const upserted = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat
    });
    categories.push(upserted);
    console.log(`Upserted category: ${upserted.name}`);
  }

  // 2. Create Default Admin User
  const adminEmail = 'admin@properti.indahweb.com';
  const adminWhatsapp = '628123456789';
  const hashedPassword = await bcrypt.hash('adminindahweb', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: hashedPassword,
      name: 'Super Admin Indahweb',
      whatsapp: adminWhatsapp,
      role: 'super_admin'
    },
    create: {
      email: adminEmail,
      password: hashedPassword,
      name: 'Super Admin Indahweb',
      whatsapp: adminWhatsapp,
      role: 'super_admin'
    }
  });
  console.log(`Upserted admin user: ${adminUser.email}`);

  // Find Category IDs
  const rumahCat = categories.find(c => c.slug === 'rumah');
  const rukoCat = categories.find(c => c.slug === 'ruko');

  // 3. Create Sample Properties
  const sampleProperties = [
    {
      title: 'Rumah Minimalis Modern Dago Dekat Kampus ITB',
      slug: 'rumah-minimalis-modern-dago-dekat-kampus-itb',
      description: 'Dijual rumah baru minimalis di area Dago, Bandung. Sangat strategis dekat ke kampus ITB, Unpad, dan area belanja Dago. Lingkungan aman, asri, dan bebas banjir. Cocok untuk hunian keluarga maupun investasi kontrakan/kost mahasiswa.',
      price: 1250000000.00,
      listingType: 'SALE',
      categoryId: rumahCat ? rumahCat.id : 1,
      landSize: 150,
      buildingSize: 120,
      bedrooms: 3,
      bathrooms: 2,
      certificate: 'SHM',
      electricity: '2200',
      waterSource: 'PDAM',
      garage: 2,
      facilities: 'AC, Taman, Dapur, Akses Jalan Mobil',
      province: 'Jawa Barat',
      city: 'Bandung',
      district: 'Coblong',
      shortAddress: 'Jl. Dago Asri No. 12',
      contactName: 'Rian Hidayat',
      whatsappNumber: '628123456789',
      isFeatured: true,
      status: 'AVAILABLE',
      userId: adminUser.id
    },
    {
      title: 'Ruko Strategis 3 Lantai Tengah Kota Bandung',
      slug: 'ruko-strategis-3-lantai-tengah-kota-bandung',
      description: 'Disewakan ruko 3 lantai di pinggir jalan raya utama Bandung. Sangat cocok untuk kantor cabang bank, kuliner, minimarket, atau usaha retail lainnya. Parkir luas, daerah ramai lalu lintas, dekat pusat bisnis dan pemerintahan.',
      price: 85000000.00,
      listingType: 'RENT',
      categoryId: rukoCat ? rukoCat.id : 2,
      landSize: 100,
      buildingSize: 240,
      bedrooms: 0,
      bathrooms: 3,
      certificate: 'HGB',
      electricity: '4400',
      waterSource: 'Jetpump',
      garage: 4,
      facilities: 'Keamanan 24 Jam, Akses Jalan Mobil, Kitchen Set',
      province: 'Jawa Barat',
      city: 'Bandung',
      district: 'Sumur Bandung',
      shortAddress: 'Jl. Asia Afrika No. 88',
      contactName: 'Budi Santoso',
      whatsappNumber: '628987654321',
      isFeatured: false,
      status: 'AVAILABLE',
      userId: adminUser.id
    }
  ];

  for (const prop of sampleProperties) {
    const upsertedProp = await prisma.property.upsert({
      where: { slug: prop.slug },
      update: {},
      create: prop
    });
    console.log(`Upserted sample property: ${upsertedProp.title}`);
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
