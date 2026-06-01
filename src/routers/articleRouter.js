const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const articleController = require('../controllers/articleController');
const { isAuthenticated, isAdmin } = require('../middlewares/authMiddleware');

// Ensure public/uploads/ directory exists
const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'article-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 3 * 1024 * 1024 } // Limit files to 3MB
});

// Public routes
router.get('/', articleController.getArticleList);
router.get('/:slug', articleController.getArticleDetail);

// Admin-only routes
router.get('/admin', isAuthenticated, isAdmin, articleController.getAdminArticles);
router.get('/admin/create', isAuthenticated, isAdmin, articleController.getCreateArticle);
router.post('/admin/create', isAuthenticated, isAdmin, upload.single('coverImage'), articleController.postCreateArticle);
router.get('/admin/:id/edit', isAuthenticated, isAdmin, articleController.getEditArticle);
router.post('/admin/:id/edit', isAuthenticated, isAdmin, upload.single('coverImage'), articleController.postEditArticle);
router.post('/admin/:id/toggle-publish', isAuthenticated, isAdmin, articleController.postTogglePublish);
router.post('/admin/:id/delete', isAuthenticated, isAdmin, articleController.postDeleteArticle);

module.exports = router;
