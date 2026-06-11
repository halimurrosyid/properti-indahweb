const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');
const listingController = require('../controllers/listingController');
const regionController = require('../controllers/regionController');
const { isAuthenticated, isAdmin, isSuperAdmin } = require('../middlewares/authMiddleware');
const { createImageUpload } = require('../middlewares/imageUploadMiddleware');

const locationUpload = createImageUpload();

router.get('/', pageController.getHome);
router.get('/catalog', pageController.getCatalog);
router.get('/property/:slug', pageController.getPropertyDetail);
router.get('/pasang-iklan', pageController.getPasangIklan);

router.get('/api/regions/provinces', regionController.getProvinces);
router.get('/api/regions/cities', regionController.getCities);
router.get('/api/regions/districts', regionController.getDistricts);

router.get('/dashboard', isAuthenticated, pageController.getUserDashboard);
router.get('/admin/dashboard', isAuthenticated, isAdmin, pageController.getAdminDashboard);
router.get('/admin/locations', isAuthenticated, isSuperAdmin, pageController.getAdminLocations);
router.post('/admin/locations', isAuthenticated, isSuperAdmin, ...locationUpload.single('imageFile'), pageController.postCreateAdminLocation);
router.post('/admin/locations/:id', isAuthenticated, isSuperAdmin, ...locationUpload.single('imageFile'), pageController.postUpdateAdminLocation);
router.post('/admin/locations/:id/delete', isAuthenticated, isSuperAdmin, pageController.postDeleteAdminLocation);
router.get('/admin/packages', isAuthenticated, isSuperAdmin, pageController.getAdminPackages);
router.post('/admin/packages/:id', isAuthenticated, isSuperAdmin, pageController.postUpdateAdminPackage);
router.get('/admin/emails', isAuthenticated, isSuperAdmin, pageController.getAdminEmails);
router.post('/admin/emails/settings', isAuthenticated, isSuperAdmin, pageController.postAdminEmailSettings);

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
