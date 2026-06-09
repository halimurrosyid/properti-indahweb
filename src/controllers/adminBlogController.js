const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const {
  addHours,
  fitDateToJakartaPublishWindow,
  parseJakartaDateTimeLocal
} = require('../utils/dateTime');
const { normalizeMetaTitle } = require('../utils/seoMeta');
const { resolveUploadedFilePath } = require('../config/uploadPath');

// Helper to generate URL slug
const generateSlug = async (title, currentId = null) => {
  let baseSlug = title
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  if (!baseSlug) baseSlug = 'artikel';

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.blogPost.findFirst({
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

// Helper: Calculate scheduled dates based on interval and publish window
const calculateScheduledTimes = (titlesCount, startAtDate, intervalHours, windowStartStr, windowEndStr) => {
  const times = [];
  let current = new Date(startAtDate.getTime());

  for (let i = 0; i < titlesCount; i++) {
    if (i > 0) {
      current = addHours(current, intervalHours);
    }

    current = fitDateToJakartaPublishWindow(current, windowStartStr, windowEndStr);
    
    times.push(new Date(current.getTime()));
  }
  
  return times;
};

// ==========================================
// 1. ARTICLES INDEX & CRUD
// ==========================================

// GET /admin/blog
exports.getBlogList = async (req, res, next) => {
  try {
    const { status, source } = req.query;
    
    // Build query filters
    const where = {};
    
    if (status) {
      where.status = status;
    } else {
      // Exclude deleted posts from default view unless specifically requested
      where.NOT = { status: 'deleted' };
    }
    
    if (source) {
      where.source = source;
    }

    const posts = await prisma.blogPost.findMany({
      where,
      include: { category: true, author: true, ai_job: true },
      orderBy: { created_at: 'desc' }
    });
    const categories = await prisma.blogCategory.findMany({ orderBy: { name: 'asc' } });

    res.render('pages/admin/blog-list', {
      title: 'Manajemen Artikel Blog',
      posts,
      categories,
      statusFilter: status || '',
      sourceFilter: source || '',
      message: req.query.msg || null,
      error: req.query.err || null
    });
  } catch (error) {
    next(error);
  }
};

// GET /admin/blog/create
exports.getCreateBlog = async (req, res, next) => {
  try {
    const categories = await prisma.blogCategory.findMany({ orderBy: { name: 'asc' } });
    
    res.render('pages/admin/blog-form', {
      title: 'Tulis Artikel Manual',
      post: null,
      categories,
      error: req.query.err || null
    });
  } catch (error) {
    next(error);
  }
};

// POST /admin/blog/create
exports.postCreateBlog = async (req, res, next) => {
  try {
    const {
      title, slug, category_id, focus_keyword,
      meta_title, meta_description, excerpt,
      content, status, scheduled_at, canonical_url
    } = req.body;

    const author_id = req.session.user.id;

    // Validate requirements
    if (!title || !content) {
      return res.redirect('/admin/blog/create?err=Judul dan konten lengkap wajib diisi.');
    }

    const finalSlug = await generateSlug(slug || title);

    let postStatus = status || 'draft';
    let publishedAt = null;
    let schedAt = null;

    if (postStatus === 'published') {
      publishedAt = new Date();
    } else if (postStatus === 'scheduled') {
      if (!scheduled_at) {
        return res.redirect('/admin/blog/create?err=Tanggal jadwal publish wajib diisi jika status scheduled.');
      }
      schedAt = parseJakartaDateTimeLocal(scheduled_at);
    }

    let featuredImage = null;
    if (req.file) {
      featuredImage = `/uploads/${req.file.filename}`;
    }

    await prisma.blogPost.create({
      data: {
        title,
        slug: finalSlug,
        excerpt: excerpt || null,
        content,
        featured_image: featuredImage,
        category_id: category_id ? parseInt(category_id) : null,
        author_id,
        status: postStatus,
        source: 'manual',
        meta_title: normalizeMetaTitle(meta_title, title),
        meta_description: meta_description || null,
        focus_keyword: focus_keyword || null,
        canonical_url: canonical_url || null,
        scheduled_at: schedAt,
        published_at: publishedAt
      }
    });

    res.redirect('/admin/blog?msg=Artikel manual berhasil dibuat!');
  } catch (error) {
    next(error);
  }
};

// GET /admin/blog/:id/edit
exports.getEditBlog = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const post = await prisma.blogPost.findUnique({
      where: { id }
    });

    if (!post) {
      return res.redirect('/admin/blog?err=Artikel tidak ditemukan.');
    }

    const categories = await prisma.blogCategory.findMany({ orderBy: { name: 'asc' } });

    res.render('pages/admin/blog-form', {
      title: `Edit Artikel: ${post.title}`,
      post: {
        ...post,
        meta_title: normalizeMetaTitle(post.meta_title, post.title)
      },
      categories,
      error: req.query.err || null
    });
  } catch (error) {
    next(error);
  }
};

// POST /admin/blog/:id/edit
exports.postEditBlog = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const {
      title, slug, category_id, focus_keyword,
      meta_title, meta_description, excerpt,
      content, status, scheduled_at, canonical_url
    } = req.body;

    const existingPost = await prisma.blogPost.findUnique({
      where: { id }
    });

    if (!existingPost) {
      return res.redirect('/admin/blog?err=Artikel tidak ditemukan.');
    }

    const finalSlug = await generateSlug(slug || title, id);

    let postStatus = status || 'draft';
    let publishedAt = existingPost.published_at;
    let schedAt = existingPost.scheduled_at;

    if (postStatus === 'published') {
      if (existingPost.status !== 'published') {
        publishedAt = new Date();
      }
      schedAt = null;
    } else if (postStatus === 'scheduled') {
      if (!scheduled_at) {
        return res.redirect(`/admin/blog/${id}/edit?err=Tanggal jadwal publish wajib diisi jika status scheduled.`);
      }
      schedAt = parseJakartaDateTimeLocal(scheduled_at);
      publishedAt = null;
    } else {
      // Draft/Archived/Deleted resets scheduling
      schedAt = null;
      publishedAt = null;
    }

    let featuredImage = existingPost.featured_image;
    if (req.file) {
      // Unlink old image if exists
      if (existingPost.featured_image) {
        const oldPath = resolveUploadedFilePath(existingPost.featured_image);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      featuredImage = `/uploads/${req.file.filename}`;
    }

    await prisma.blogPost.update({
      where: { id },
      data: {
        title,
        slug: finalSlug,
        excerpt: excerpt || null,
        content,
        featured_image: featuredImage,
        category_id: category_id ? parseInt(category_id) : null,
        status: postStatus,
        meta_title: normalizeMetaTitle(meta_title, title),
        meta_description: meta_description || null,
        focus_keyword: focus_keyword || null,
        canonical_url: canonical_url || null,
        scheduled_at: schedAt,
        published_at: publishedAt
      }
    });

    res.redirect('/admin/blog?msg=Artikel berhasil diperbarui!');
  } catch (error) {
    next(error);
  }
};

// POST /admin/blog/:id/archive
exports.postArchiveBlog = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    
    await prisma.blogPost.update({
      where: { id },
      data: {
        status: 'archived',
        archived_at: new Date()
      }
    });

    res.redirect('/admin/blog?msg=Artikel berhasil diarsipkan.');
  } catch (error) {
    next(error);
  }
};

// POST /admin/blog/:id/restore
exports.postRestoreBlog = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    
    await prisma.blogPost.update({
      where: { id },
      data: {
        status: 'draft',
        archived_at: null,
        deleted_at: null
      }
    });

    res.redirect('/admin/blog?msg=Artikel berhasil dikembalikan ke Draft.');
  } catch (error) {
    next(error);
  }
};

// POST /admin/blog/:id/delete
exports.postDeleteBlog = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    
    await prisma.blogPost.update({
      where: { id },
      data: {
        status: 'deleted',
        deleted_at: new Date()
      }
    });

    res.redirect('/admin/blog?msg=Artikel berhasil dihapus (Soft Delete).');
  } catch (error) {
    next(error);
  }
};

// POST /admin/blog/bulk-update
exports.postBulkUpdateBlogs = async (req, res, next) => {
  try {
    const {
      selected_post_ids,
      bulk_status,
      bulk_category_id,
      bulk_scheduled_at
    } = req.body;

    const selectedIds = Array.isArray(selected_post_ids)
      ? selected_post_ids
      : (selected_post_ids ? [selected_post_ids] : []);

    const ids = selectedIds
      .map(id => parseInt(id))
      .filter(id => Number.isInteger(id) && id > 0);

    if (ids.length === 0) {
      return res.redirect('/admin/blog?err=Pilih minimal satu artikel untuk diperbarui.');
    }

    const data = {};

    if (bulk_category_id && bulk_category_id !== '__nochange') {
      data.category_id = bulk_category_id === '__none' ? null : parseInt(bulk_category_id);
      if (bulk_category_id !== '__none' && !Number.isInteger(data.category_id)) {
        return res.redirect('/admin/blog?err=Kategori bulk tidak valid.');
      }
    }

    if (bulk_status && bulk_status !== '__nochange') {
      const allowedStatuses = ['draft', 'published', 'scheduled', 'archived', 'deleted'];
      if (!allowedStatuses.includes(bulk_status)) {
        return res.redirect('/admin/blog?err=Status bulk tidak valid.');
      }

      data.status = bulk_status;

      if (bulk_status === 'published') {
        data.published_at = new Date();
        data.scheduled_at = null;
      } else if (bulk_status === 'scheduled') {
        if (!bulk_scheduled_at) {
          return res.redirect('/admin/blog?err=Jadwal publish wajib diisi jika status bulk diubah ke Scheduled.');
        }
        data.scheduled_at = parseJakartaDateTimeLocal(bulk_scheduled_at);
        data.published_at = null;
      } else {
        data.scheduled_at = null;
        data.published_at = null;
      }

      if (bulk_status === 'archived') {
        data.archived_at = new Date();
      } else if (bulk_status !== 'archived') {
        data.archived_at = null;
      }

      if (bulk_status === 'deleted') {
        data.deleted_at = new Date();
      } else if (bulk_status !== 'deleted') {
        data.deleted_at = null;
      }
    }

    if (Object.keys(data).length === 0) {
      return res.redirect('/admin/blog?err=Pilih minimal satu perubahan bulk untuk diterapkan.');
    }

    await prisma.blogPost.updateMany({
      where: { id: { in: ids } },
      data
    });

    res.redirect(`/admin/blog?msg=${ids.length} artikel berhasil diperbarui secara massal.`);
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. CATEGORIES MANAGEMENT
// ==========================================

// GET /admin/blog/categories
exports.getBlogCategories = async (req, res, next) => {
  try {
    const categories = await prisma.blogCategory.findMany({
      include: {
        _count: { select: { posts: true } }
      },
      orderBy: { name: 'asc' }
    });

    res.render('pages/admin/blog-categories', {
      title: 'Kelola Kategori Blog',
      categories,
      message: req.query.msg || null,
      error: req.query.err || null
    });
  } catch (error) {
    next(error);
  }
};

// POST /admin/blog/categories
exports.postCreateCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.redirect('/admin/blog/categories?err=Nama kategori wajib diisi.');
    }

    const baseSlug = name.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
    let slug = baseSlug;
    let counter = 1;
    
    while (true) {
      const existing = await prisma.blogCategory.findUnique({ where: { slug } });
      if (!existing) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    await prisma.blogCategory.create({
      data: { name, slug, description }
    });

    res.redirect('/admin/blog/categories?msg=Kategori baru berhasil dibuat.');
  } catch (error) {
    next(error);
  }
};

// POST /admin/blog/categories/:id/delete
exports.postDeleteCategory = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    // Delete category
    await prisma.blogCategory.delete({
      where: { id }
    });

    res.redirect('/admin/blog/categories?msg=Kategori berhasil dihapus.');
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. AI POSTS GENERATION & JOBS
// ==========================================

// GET /admin/blog/ai-generate
exports.getAiGenerate = async (req, res, next) => {
  try {
    const categories = await prisma.blogCategory.findMany({ orderBy: { name: 'asc' } });
    const isApiConfigured = !!process.env.ANTHROPIC_API_KEY;

    res.render('pages/admin/blog-ai-generate', {
      title: 'Generate Artikel Otomatis dengan AI',
      categories,
      isApiConfigured,
      defaultWordMin: parseInt(process.env.AI_BLOG_DEFAULT_WORD_MIN) || 900,
      defaultWordMax: parseInt(process.env.AI_BLOG_DEFAULT_WORD_MAX) || 1500,
      error: req.query.err || null
    });
  } catch (error) {
    next(error);
  }
};

// POST /admin/blog/ai-generate
exports.postAiGenerate = async (req, res, next) => {
  try {
    const {
      batch_name, titles_text, category_id, focus_keyword,
      prompt_template, knowledge_base, status_mode,
      publish_start_at, interval_hours, publish_window_start, publish_window_end,
      word_min, word_max
    } = req.body;

    const created_by = req.session.user.id;

    if (!titles_text) {
      return res.redirect('/admin/blog/ai-generate?err=Daftar judul wajib diisi.');
    }

    // Split titles by newlines and clean empty lines
    const titles = titles_text
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (titles.length === 0) {
      return res.redirect('/admin/blog/ai-generate?err=Tidak ada judul valid yang ditemukan.');
    }

    const maxTitles = parseInt(process.env.AI_BLOG_MAX_TITLES_PER_BATCH) || 50;
    if (titles.length > maxTitles) {
      return res.redirect(`/admin/blog/ai-generate?err=Jumlah judul melebihi batas maksimal batch (${maxTitles} judul).`);
    }

    const selectedCategoryId = category_id ? parseInt(category_id) : null;
    if (!selectedCategoryId) {
      return res.redirect('/admin/blog/ai-generate?err=Kategori hasil artikel wajib dipilih.');
    }

    const wordMin = word_min ? parseInt(word_min) : (parseInt(process.env.AI_BLOG_DEFAULT_WORD_MIN) || 900);
    const wordMax = word_max ? parseInt(word_max) : (parseInt(process.env.AI_BLOG_DEFAULT_WORD_MAX) || 1500);
    if (!Number.isInteger(wordMin) || !Number.isInteger(wordMax) || wordMin < 300 || wordMax < wordMin || wordMax > 3000) {
      return res.redirect('/admin/blog/ai-generate?err=Range jumlah kata tidak valid. Gunakan minimal 300 kata dan maksimal 3000 kata.');
    }

    let featuredImage = null;
    if (req.file) {
      featuredImage = `/uploads/${req.file.filename}`;
    }

    // Parse interval parameters
    const pStartAt = publish_start_at ? parseJakartaDateTimeLocal(publish_start_at) : new Date();
    const pInterval = interval_hours ? parseInt(interval_hours) : 12;
    const pWindowStart = publish_window_start || '08:00';
    const pWindowEnd = publish_window_end || '22:00';

    // Calculate dates for scheduled mode
    let calculatedDates = [];
    if (status_mode === 'scheduled') {
      calculatedDates = calculateScheduledTimes(titles.length, pStartAt, pInterval, pWindowStart, pWindowEnd);
    }

    // Create the AiBlogJob
    const job = await prisma.aiBlogJob.create({
      data: {
        batch_name: batch_name || `Batch AI ${new Date().toLocaleDateString('id-ID')}`,
        titles_text: titles.join('\n'),
        total_titles: titles.length,
        status: 'pending',
        publish_mode: status_mode, // draft, published, scheduled
        interval_hours: status_mode === 'scheduled' ? pInterval : null,
        publish_start_at: status_mode === 'scheduled' ? pStartAt : null,
        publish_window_start: status_mode === 'scheduled' ? pWindowStart : null,
        publish_window_end: status_mode === 'scheduled' ? pWindowEnd : null,
        category_id: selectedCategoryId,
        word_min: wordMin,
        word_max: wordMax,
        prompt_template: prompt_template || null,
        knowledge_base: knowledge_base || null,
        featured_image: featuredImage,
        created_by: created_by
      }
    });

    // Create AiBlogJobItems
    const jobItemsData = titles.map((title, index) => ({
      ai_job_id: job.id,
      title,
      status: 'pending',
      scheduled_at: status_mode === 'scheduled' ? calculatedDates[index] : null
    }));

    await prisma.aiBlogJobItem.createMany({
      data: jobItemsData
    });

    res.redirect('/admin/blog/ai-jobs?msg=Batch pekerjaan AI berhasil didaftarkan ke antrean.');
  } catch (error) {
    next(error);
  }
};

// GET /admin/blog/ai-jobs
exports.getAiJobs = async (req, res, next) => {
  try {
    const jobs = await prisma.aiBlogJob.findMany({
      include: {
        creator: true,
        items: {
          orderBy: { id: 'asc' }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.render('pages/admin/blog-ai-jobs', {
      title: 'Monitoring Batch Pekerjaan AI',
      jobs,
      message: req.query.msg || null,
      error: req.query.err || null
    });
  } catch (error) {
    next(error);
  }
};

// POST /admin/blog/ai-jobs/:id/cancel
exports.postCancelJob = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const job = await prisma.aiBlogJob.findUnique({
      where: { id }
    });

    if (!job) {
      return res.redirect('/admin/blog/ai-jobs?err=Pekerjaan tidak ditemukan.');
    }

    if (job.status !== 'pending' && job.status !== 'running') {
      return res.redirect('/admin/blog/ai-jobs?err=Pekerjaan sudah selesai atau tidak dapat dibatalkan.');
    }

    // Cancel pending items
    await prisma.aiBlogJobItem.updateMany({
      where: { ai_job_id: id, status: 'pending' },
      data: { status: 'skipped', error_message: 'Dibatalkan oleh admin.' }
    });

    // Mark job cancelled
    await prisma.aiBlogJob.update({
      where: { id },
      data: {
        status: 'cancelled',
        completed_at: new Date()
      }
    });

    res.redirect('/admin/blog/ai-jobs?msg=Pekerjaan AI berhasil dibatalkan.');
  } catch (error) {
    next(error);
  }
};

// POST /admin/blog/ai-jobs/items/:itemId/regenerate
exports.postRegenerateFailedItem = async (req, res, next) => {
  try {
    const itemId = parseInt(req.params.itemId);
    const item = await prisma.aiBlogJobItem.findUnique({
      where: { id: itemId },
      include: { ai_job: true }
    });

    if (!item) {
      return res.redirect('/admin/blog/ai-jobs?err=Item pekerjaan tidak ditemukan.');
    }

    if (item.status !== 'failed') {
      return res.redirect('/admin/blog/ai-jobs?err=Hanya item gagal yang dapat di-generate ulang.');
    }

    // Reset item status to pending
    await prisma.aiBlogJobItem.update({
      where: { id: itemId },
      data: {
        status: 'pending',
        error_message: null
      }
    });

    // Mark the parent job running/pending again if it was marked complete/failed
    if (item.ai_job.status === 'completed' || item.ai_job.status === 'failed') {
      await prisma.aiBlogJob.update({
        where: { id: item.ai_job_id },
        data: {
          status: 'running',
          failed_count: { decrement: 1 }
        }
      });
    }

    res.redirect('/admin/blog/ai-jobs?msg=Item berhasil dimasukkan kembali ke antrean untuk dicoba ulang.');
  } catch (error) {
    next(error);
  }
};
