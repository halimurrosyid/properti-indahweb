const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// Helper to generate URL-friendly slug
const generateSlug = async (title, currentId = null) => {
  let baseSlug = title
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start
    .replace(/-+$/, '');            // Trim - from end

  if (!baseSlug) baseSlug = 'artikel';

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.article.findFirst({
      where: {
        slug: slug,
        NOT: currentId ? { id: currentId } : undefined
      }
    });

    if (!existing) {
      break;
    }
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

// ==========================================
// PUBLIC VIEWS
// ==========================================

// GET /artikel
exports.getArticleList = async (req, res, next) => {
  try {
    const articles = await prisma.article.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' }
    });

    res.render('pages/article-list', {
      title: 'Artikel & Panduan Properti',
      description: 'Dapatkan tips, tren, dan panduan lengkap seputar pasar properti lokal dari para ahli.',
      articles
    });
  } catch (error) {
    next(error);
  }
};

// GET /artikel/:slug
exports.getArticleDetail = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const article = await prisma.article.findUnique({
      where: { slug }
    });

    if (!article || (!article.isPublished && (!req.session.user || (req.session.user.role !== 'admin' && req.session.user.role !== 'super_admin')))) {
      const err = new Error('Artikel tidak ditemukan');
      err.status = 404;
      return next(err);
    }

    res.render('pages/article-detail', {
      title: article.title,
      description: article.excerpt || article.title,
      article
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// ADMIN VIEWS
// ==========================================

// GET /artikel/admin
exports.getAdminArticles = async (req, res, next) => {
  try {
    const articles = await prisma.article.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Also get pending properties and invoices for admin dashboard notifications/badges if needed
    const properties = await prisma.property.findMany({
      where: { status: 'PENDING' }
    });
    const invoices = await prisma.invoice.findMany({
      where: { status: 'PENDING', NOT: { paymentProof: null } }
    });

    res.render('pages/admin-articles', {
      title: 'Kelola Artikel Blog',
      description: 'Halaman manajemen artikel dan tips properti.',
      articles,
      pendingPropertiesCount: properties.length,
      pendingInvoicesCount: invoices.length
    });
  } catch (error) {
    next(error);
  }
};

// GET /artikel/admin/create
exports.getCreateArticle = async (req, res, next) => {
  try {
    res.render('pages/article-form', {
      title: 'Buat Artikel Baru',
      description: 'Tulis artikel baru untuk dipublikasikan.',
      article: null
    });
  } catch (error) {
    next(error);
  }
};

// POST /artikel/admin/create
exports.postCreateArticle = async (req, res, next) => {
  try {
    const { title, content, excerpt, isPublished } = req.body;
    let coverImage = null;

    if (req.file) {
      coverImage = `/uploads/${req.file.filename}`;
    }

    const slug = await generateSlug(title);

    await prisma.article.create({
      data: {
        title,
        slug,
        content,
        excerpt: excerpt || null,
        coverImage,
        isPublished: isPublished === 'true'
      }
    });

    res.redirect('/artikel/admin?msg=Artikel berhasil dibuat!');
  } catch (error) {
    next(error);
  }
};

// GET /artikel/admin/:id/edit
exports.getEditArticle = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const article = await prisma.article.findUnique({
      where: { id }
    });

    if (!article) {
      const err = new Error('Artikel tidak ditemukan');
      err.status = 404;
      return next(err);
    }

    res.render('pages/article-form', {
      title: `Edit Artikel: ${article.title}`,
      description: 'Perbarui konten artikel Anda.',
      article
    });
  } catch (error) {
    next(error);
  }
};

// POST /artikel/admin/:id/edit
exports.postEditArticle = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { title, content, excerpt, isPublished } = req.body;

    const existingArticle = await prisma.article.findUnique({
      where: { id }
    });

    if (!existingArticle) {
      const err = new Error('Artikel tidak ditemukan');
      err.status = 404;
      return next(err);
    }

    let coverImage = existingArticle.coverImage;
    if (req.file) {
      // Delete old cover image if it exists
      if (existingArticle.coverImage) {
        const oldPath = path.join(__dirname, '..', '..', 'public', existingArticle.coverImage);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      coverImage = `/uploads/${req.file.filename}`;
    }

    const slug = await generateSlug(title, id);

    await prisma.article.update({
      where: { id },
      data: {
        title,
        slug,
        content,
        excerpt: excerpt || null,
        coverImage,
        isPublished: isPublished === 'true'
      }
    });

    res.redirect('/artikel/admin?msg=Artikel berhasil diperbarui!');
  } catch (error) {
    next(error);
  }
};

// POST /artikel/admin/:id/toggle-publish
exports.postTogglePublish = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const article = await prisma.article.findUnique({
      where: { id }
    });

    if (!article) {
      return res.status(404).json({ success: false, message: 'Artikel tidak ditemukan' });
    }

    const updated = await prisma.article.update({
      where: { id },
      data: { isPublished: !article.isPublished }
    });

    res.redirect(`/artikel/admin?msg=Status publikasi artikel "${updated.title}" berhasil diubah!`);
  } catch (error) {
    next(error);
  }
};

// POST /artikel/admin/:id/delete
exports.postDeleteArticle = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const article = await prisma.article.findUnique({
      where: { id }
    });

    if (!article) {
      const err = new Error('Artikel tidak ditemukan');
      err.status = 404;
      return next(err);
    }

    // Delete cover image from storage
    if (article.coverImage) {
      const imgPath = path.join(__dirname, '..', '..', 'public', article.coverImage);
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    }

    await prisma.article.delete({
      where: { id }
    });

    res.redirect('/artikel/admin?msg=Artikel berhasil dihapus secara permanen!');
  } catch (error) {
    next(error);
  }
};
