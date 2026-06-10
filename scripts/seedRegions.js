require('dotenv').config();
const fs = require('fs');
const https = require('https');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SOURCE_URL = process.env.REGION_SOURCE_URL || 'https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah.sql';
const SOURCE_FILE = process.env.REGION_SOURCE_FILE || path.join(__dirname, '..', 'prisma', 'data', 'wilayah.sql');
const INSERT_BATCH_SIZE = 1000;
const MIN_PROVINCES = 30;
const MIN_CITIES = 400;
const MIN_DISTRICTS = 7000;

async function hasCompleteRegionData() {
  const [provinces, cities, districts] = await Promise.all([
    prisma.regionProvince.count(),
    prisma.regionCity.count(),
    prisma.regionDistrict.count()
  ]);

  return provinces >= MIN_PROVINCES && cities >= MIN_CITIES && districts >= MIN_DISTRICTS;
}

async function loadRegionSource() {
  if (fs.existsSync(SOURCE_FILE)) {
    console.log(`Loading Indonesian region master data from ${SOURCE_FILE}`);
    return fs.promises.readFile(SOURCE_FILE, 'utf8');
  }

  console.log(`Fetching Indonesian region master data from ${SOURCE_URL}`);
  return fetchText(SOURCE_URL);
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        fetchText(response.headers.location).then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch ${url}: HTTP ${response.statusCode}`));
        response.resume();
        return;
      }

      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

function unescapeSqlValue(value) {
  return value.replace(/''/g, "'");
}

function parseWilayahSql(sql) {
  const provinces = [];
  const cities = [];
  const districts = [];
  const rowRegex = /\('([^']+)','((?:[^']|'')*)'\)/g;
  let match;

  while ((match = rowRegex.exec(sql)) !== null) {
    const code = match[1];
    const name = unescapeSqlValue(match[2]);

    if (/^\d{2}$/.test(code)) {
      provinces.push({ code, name });
    } else if (/^\d{2}\.\d{2}$/.test(code)) {
      cities.push({
        code,
        name,
        provinceCode: code.slice(0, 2)
      });
    } else if (/^\d{2}\.\d{2}\.\d{2}$/.test(code)) {
      districts.push({
        code,
        name,
        cityCode: code.slice(0, 5)
      });
    }
  }

  return { provinces, cities, districts };
}

async function upsertBatch(model, rows, uniqueField, dataMapper) {
  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
    await prisma.$transaction(
      batch.map(row => model.upsert({
        where: { [uniqueField]: row[uniqueField] },
        update: dataMapper(row),
        create: dataMapper(row)
      }))
    );
  }
}

async function main() {
  if (process.env.FORCE_REGION_SEED !== 'true' && await hasCompleteRegionData()) {
    console.log('Region master data already exists. Skipping region seed.');
    return;
  }

  const sql = await loadRegionSource();
  const { provinces, cities, districts } = parseWilayahSql(sql);

  if (provinces.length < MIN_PROVINCES || cities.length < MIN_CITIES || districts.length < MIN_DISTRICTS) {
    throw new Error(`Parsed region data looks incomplete: ${provinces.length} provinces, ${cities.length} cities, ${districts.length} districts`);
  }

  console.log(`Parsed ${provinces.length} provinces, ${cities.length} cities/regencies, ${districts.length} districts.`);

  await upsertBatch(prisma.regionProvince, provinces, 'code', row => ({
    code: row.code,
    name: row.name
  }));
  await upsertBatch(prisma.regionCity, cities, 'code', row => ({
    code: row.code,
    name: row.name,
    provinceCode: row.provinceCode
  }));
  await upsertBatch(prisma.regionDistrict, districts, 'code', row => ({
    code: row.code,
    name: row.name,
    cityCode: row.cityCode
  }));

  console.log('Region master seeding completed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
