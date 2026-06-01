const express = require('express');
const router = express.Router();
const publicBlogController = require('../controllers/publicBlogController');

// Public blog routes
router.get('/', publicBlogController.getBlogList);
router.get('/kategori/:slug', publicBlogController.getBlogListByCategory);
router.get('/:slug', publicBlogController.getBlogDetail);

module.exports = router;
