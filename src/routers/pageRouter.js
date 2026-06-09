const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pageController = require('../controllers/pageController');
const listingController = require('../controllers/listingController');
const { isAuthenticated, isAdmin, isSuperAdmin } = require('../middlewares/authMiddleware');
const { ensureUploadDir } = require('../config/uploadPath');

const locationUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ensureUploadDir()),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'location-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: (parseInt(process.env.UPLOAD_MAX_SIZE_MB) || 3) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/i;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Format file gambar lokasi tidak didukung. Gunakan jpg, jpeg, png, atau webp.'));
  }
});

router.get('/', pageController.getHome);
router.get('/catalog', pageController.getCatalog);
router.get('/property/:slug', pageController.getPropertyDetail);
router.get('/pasang-iklan', pageController.getPasangIklan);

router.get('/dashboard', isAuthenticated, pageController.getUserDashboard);
router.get('/admin/dashboard', isAuthenticated, isAdmin, pageController.getAdminDashboard);
router.get('/admin/locations', isAuthenticated, isSuperAdmin, pageController.getAdminLocations);
router.post('/admin/locations', isAuthenticated, isSuperAdmin, locationUpload.single('imageFile'), pageController.postCreateAdminLocation);
router.post('/admin/locations/:id', isAuthenticated, isSuperAdmin, locationUpload.single('imageFile'), pageController.postUpdateAdminLocation);
router.post('/admin/locations/:id/delete', isAuthenticated, isSuperAdmin, pageController.postDeleteAdminLocation);

// Invoice & Packages Page
router.get('/invoice/:invoiceNumber', isAuthenticated, pageController.getInvoiceDetail);
router.get('/packages', pageController.getPackagesPage);

// WhatsApp Track Lead Redirect
router.get('/go/whatsapp/:listingId', listingController.trackWaClick);

// Sitemap
router.get('/sitemap.xml', pageController.getSitemap);

// SEO Landing Categories & Location Pages
const seoPaths = ['/rumah-dijual', '/tanah-dijual', '/kontrakan', '/kos'];
seoPaths.forEach(path => {
  router.get(path, pageController.getSeoListingPage);
  router.get(`${path}/:city`, pageController.getSeoListingPage);
  router.get(`${path}/:city/:district`, pageController.getSeoListingPage);
});

// Agent profile portfolio
router.get('/agen/:id', pageController.getAgentProfile);

// Favorites JSON API
router.get('/api/properties/favorites', pageController.getFavoritesApi);

// Disclaimer Page
router.get('/disclaimer', pageController.getDisclaimer);

module.exports = router;
