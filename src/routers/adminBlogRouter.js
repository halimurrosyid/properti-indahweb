const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const adminBlogController = require('../controllers/adminBlogController');
const { isAuthenticated, isAdmin } = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');

// Setup upload folder
const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'blog-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Build upload filter and limits
const maxMB = parseInt(process.env.UPLOAD_MAX_SIZE_MB) || 3;
const upload = multer({
  storage: storage,
  limits: { fileSize: maxMB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/i;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Format file gambar tidak didukung! Hanya menerima file jpg, jpeg, png, webp.'));
  }
});

// Protect all router endpoints for super_admin & admin
router.use(isAuthenticated);
router.use(isAdmin);

// 1. Categories Routes
router.get('/categories', csrfProtection, adminBlogController.getBlogCategories);
router.post('/categories', csrfProtection, adminBlogController.postCreateCategory);
router.post('/categories/:id/delete', csrfProtection, adminBlogController.postDeleteCategory);

// 2. AI Generator Routes
router.get('/ai-generate', csrfProtection, adminBlogController.getAiGenerate);
router.post('/ai-generate', upload.single('featured_image'), csrfProtection, adminBlogController.postAiGenerate);
router.get('/ai-jobs', csrfProtection, adminBlogController.getAiJobs);
router.post('/ai-jobs/:id/cancel', csrfProtection, adminBlogController.postCancelJob);
router.post('/ai-jobs/items/:itemId/regenerate', csrfProtection, adminBlogController.postRegenerateFailedItem);

// 3. Articles CRUD Routes
router.get('/', csrfProtection, adminBlogController.getBlogList);
router.get('/create', csrfProtection, adminBlogController.getCreateBlog);
router.post('/create', upload.single('featured_image'), csrfProtection, adminBlogController.postCreateBlog);
router.get('/:id/edit', csrfProtection, adminBlogController.getEditBlog);
router.post('/:id/edit', upload.single('featured_image'), csrfProtection, adminBlogController.postEditBlog);
router.post('/:id/archive', csrfProtection, adminBlogController.postArchiveBlog);
router.post('/:id/restore', csrfProtection, adminBlogController.postRestoreBlog);
router.post('/:id/delete', csrfProtection, adminBlogController.postDeleteBlog);

module.exports = router;
