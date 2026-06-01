const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');
const listingController = require('../controllers/listingController');
const { isAuthenticated, isAdmin } = require('../middlewares/authMiddleware');

router.get('/', pageController.getHome);
router.get('/catalog', pageController.getCatalog);
router.get('/property/:slug', pageController.getPropertyDetail);
router.get('/pasang-iklan', pageController.getPasangIklan);

router.get('/dashboard', isAuthenticated, pageController.getUserDashboard);
router.get('/admin/dashboard', isAuthenticated, isAdmin, pageController.getAdminDashboard);

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
