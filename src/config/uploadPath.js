const fs = require('fs');
const path = require('path');

const defaultUploadDir = path.join(__dirname, '..', '..', 'public', 'uploads');
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : defaultUploadDir;

const ensureUploadDir = () => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  return uploadDir;
};

const resolveUploadedFilePath = (publicUrl) => {
  const filename = path.basename(publicUrl || '');
  return filename ? path.join(uploadDir, filename) : null;
};

module.exports = {
  ensureUploadDir,
  resolveUploadedFilePath,
  uploadDir
};
