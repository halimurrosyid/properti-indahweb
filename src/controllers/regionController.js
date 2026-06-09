const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const mapRegion = region => ({
  code: region.code,
  name: region.name
});

exports.getProvinces = async (req, res, next) => {
  try {
    const provinces = await prisma.regionProvince.findMany({
      orderBy: { name: 'asc' },
      select: { code: true, name: true }
    });

    res.json({ data: provinces.map(mapRegion) });
  } catch (error) {
    next(error);
  }
};

exports.getCities = async (req, res, next) => {
  try {
    const provinceCode = String(req.query.provinceCode || '').trim();

    if (!provinceCode) {
      return res.status(400).json({ error: 'provinceCode wajib diisi.' });
    }

    const cities = await prisma.regionCity.findMany({
      where: { provinceCode },
      orderBy: { name: 'asc' },
      select: { code: true, name: true }
    });

    res.json({ data: cities.map(mapRegion) });
  } catch (error) {
    next(error);
  }
};

exports.getDistricts = async (req, res, next) => {
  try {
    const cityCode = String(req.query.cityCode || '').trim();

    if (!cityCode) {
      return res.status(400).json({ error: 'cityCode wajib diisi.' });
    }

    const districts = await prisma.regionDistrict.findMany({
      where: { cityCode },
      orderBy: { name: 'asc' },
      select: { code: true, name: true }
    });

    res.json({ data: districts.map(mapRegion) });
  } catch (error) {
    next(error);
  }
};
