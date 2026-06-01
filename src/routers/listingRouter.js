const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const listingController = require('../controllers/listingController');

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
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const maxMB = parseInt(process.env.UPLOAD_MAX_SIZE_MB) || 5;
const upload = multer({
  storage: storage,
  limits: { fileSize: maxMB * 1024 * 1024 }
});

// Configure Multer fields
const uploadFields = upload.fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'galleryImages', maxCount: 6 }
]);

const { isAuthenticated, isAdmin } = require('../middlewares/authMiddleware');

router.post('/quick-post', uploadFields, listingController.postQuickPost);
router.get('/track-wa/:id', listingController.trackWaClick);

// Admin listing review actions
router.post('/:id/approve', isAuthenticated, isAdmin, listingController.approveProperty);
router.post('/:id/reject', isAuthenticated, isAdmin, listingController.rejectProperty);

// User/Admin management actions
router.post('/:id/status', isAuthenticated, listingController.updatePropertyStatus);
router.post('/:id/delete', isAuthenticated, listingController.deleteProperty);

// Invoice actions
router.post('/invoice/:invoiceNumber/upload-proof', isAuthenticated, upload.single('paymentProof'), listingController.postUploadProof);
router.post('/invoice/:id/approve', isAuthenticated, isAdmin, listingController.approveInvoice);
router.post('/invoice/:id/reject', isAuthenticated, isAdmin, listingController.rejectInvoice);

// Edit Listing (by owner or admin)
router.get('/:id/edit', isAuthenticated, listingController.getEditListing);
router.post('/:id/edit', isAuthenticated, uploadFields, listingController.postEditListing);

module.exports = router;
