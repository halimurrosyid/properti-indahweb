const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { ensureUploadDir } = require('../config/uploadPath');

const targetMB = Math.max(1, parseInt(process.env.UPLOAD_MAX_SIZE_MB || '1', 10) || 1);
const rawMaxMB = Math.max(targetMB * 8, parseInt(process.env.UPLOAD_RAW_MAX_SIZE_MB || '8', 10) || 8);
const targetBytes = targetMB * 1024 * 1024;
const maxImageWidth = parseInt(process.env.IMAGE_MAX_WIDTH || '1920', 10) || 1920;

function imageFileFilter(req, file, cb) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error('Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.'));
}

function createMulter() {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: rawMaxMB * 1024 * 1024
    },
    fileFilter: imageFileFilter
  });
}

async function compressImage(file) {
  const uploadDir = ensureUploadDir();
  const filename = `${file.fieldname}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.webp`;
  const outputPath = path.join(uploadDir, filename);
  let outputBuffer = null;
  const widths = [maxImageWidth, 1600, 1280, 1024, 800]
    .filter((width, index, arr) => width > 0 && arr.indexOf(width) === index);

  for (const width of widths) {
    const basePipeline = sharp(file.buffer)
      .rotate()
      .resize({
        width,
        height: width,
        fit: 'inside',
        withoutEnlargement: true
      });

    for (const quality of [82, 72, 62, 52, 42]) {
      outputBuffer = await basePipeline.clone().webp({ quality, effort: 4 }).toBuffer();
      if (outputBuffer.length <= targetBytes) {
        break;
      }
    }

    if (outputBuffer.length <= targetBytes) {
      break;
    }
  }

  await fs.promises.writeFile(outputPath, outputBuffer);

  return {
    ...file,
    buffer: undefined,
    filename,
    path: outputPath,
    destination: uploadDir,
    mimetype: 'image/webp',
    size: outputBuffer.length,
    optimized: true,
    originalSize: file.size
  };
}

async function optimizeUploadedImages(req, res, next) {
  try {
    if (req.file) {
      req.file = await compressImage(req.file);
    }

    if (req.files) {
      if (Array.isArray(req.files)) {
        req.files = await Promise.all(req.files.map(compressImage));
      } else {
        for (const fieldName of Object.keys(req.files)) {
          req.files[fieldName] = await Promise.all(req.files[fieldName].map(compressImage));
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

function createImageUpload() {
  const upload = createMulter();

  return {
    single(fieldName) {
      return [upload.single(fieldName), optimizeUploadedImages];
    },
    fields(fields) {
      return [upload.fields(fields), optimizeUploadedImages];
    }
  };
}

module.exports = {
  createImageUpload,
  targetMB,
  rawMaxMB
};
