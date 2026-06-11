const express = require('express');
const router = express.Router();
const adminBlogController = require('../controllers/adminBlogController');
const { isAuthenticated, isAdmin } = require('../middlewares/authMiddleware');
const { csrfProtection } = require('../middlewares/csrfMiddleware');
const { createImageUpload } = require('../middlewares/imageUploadMiddleware');

const upload = createImageUpload();

// Protect all router endpoints for super_admin & admin
router.use(isAuthenticated);
router.use(isAdmin);

// 1. Categories Routes
router.get('/categories', csrfProtection, adminBlogController.getBlogCategories);
router.post('/categories', csrfProtection, adminBlogController.postCreateCategory);
router.post('/categories/:id/delete', csrfProtection, adminBlogController.postDeleteCategory);

// 2. AI Generator Routes
router.get('/ai-generate', csrfProtection, adminBlogController.getAiGenerate);
router.post('/ai-generate', ...upload.single('featured_image'), csrfProtection, adminBlogController.postAiGenerate);
router.get('/ai-jobs', csrfProtection, adminBlogController.getAiJobs);
router.post('/ai-jobs/:id/cancel', csrfProtection, adminBlogController.postCancelJob);
router.post('/ai-jobs/items/:itemId/regenerate', csrfProtection, adminBlogController.postRegenerateFailedItem);

// 3. Articles CRUD Routes
router.get('/', csrfProtection, adminBlogController.getBlogList);
router.post('/bulk-update', csrfProtection, adminBlogController.postBulkUpdateBlogs);
router.get('/create', csrfProtection, adminBlogController.getCreateBlog);
router.post('/create', ...upload.single('featured_image'), csrfProtection, adminBlogController.postCreateBlog);
router.get('/:id/edit', csrfProtection, adminBlogController.getEditBlog);
router.post('/:id/edit', ...upload.single('featured_image'), csrfProtection, adminBlogController.postEditBlog);
router.post('/:id/archive', csrfProtection, adminBlogController.postArchiveBlog);
router.post('/:id/restore', csrfProtection, adminBlogController.postRestoreBlog);
router.post('/:id/delete', csrfProtection, adminBlogController.postDeleteBlog);

module.exports = router;
