# Properti Indahweb

Portal Jual Beli Sewa Properti Indahweb adalah aplikasi berbasis web yang dirancang untuk mempermudah pencarian, pemasaran, dan manajemen properti.

## Teknologi Utama
- **Backend**: Node.js & Express.js
- **Database ORM**: Prisma (dengan database MySQL/MariaDB)
- **Frontend / Templating**: EJS & Tailwind CSS
- **Deployment**: PM2 (CloudPanel) & Docker (Dokploy)

## Fitur Utama
1. **Autentikasi & Otorisasi**: Login cepat dengan Whatsapp & Password, Role-based access control (Super Admin, Admin, Agent, User).
2. **Manajemen Listing Properti**: Pasang iklan gratis/bayar, status listing pending/approved, upload galeri foto, highlight properti.
3. **Pencarian & SEO Friendly**: Filter pencarian lengkap, SEO friendly URLs, dynamic Meta Title & Meta Description, Canonical URL, Breadcrumbs, Sitemap.xml & Robots.txt.
4. **WhatsApp Tracking**: Tombol chat WA dengan tracking klik tersimpan di database (anonim dengan `ip_hash`), statistik klik di dashboard.
5. **Paket Iklan & Invoice**: Sistem paket iklan (Gratis, Premium Featured 7 Hari, 30 Hari, Agen Bulanan) dengan invoice pembayaran dan verifikasi admin.

## Deployment & Konfigurasi VPS
Untuk panduan detail mengenai deployment menggunakan **Dokploy (Docker)** maupun **CloudPanel (Node.js + PM2)**, silakan baca dokumentasi lengkap di:
👉 **[Panduan Deployment (README_DEPLOYMENT.md)](file:///c:/Users/Septiani%20Nurkamilah/Documents/properti-indahweb/README_DEPLOYMENT.md)**

## Cara Menjalankan Lokal

1. Clone repositori ini.
2. Salin file `.env.example` menjadi `.env` dan sesuaikan URL koneksi database:
   ```env
   DATABASE_URL="mysql://root:password@localhost:3306/properti_indahweb"
   SESSION_SECRET="rahasia-acak-anda"
   PORT=3000
   ```
3. Instal dependensi:
   ```bash
   npm install
   ```
4. Generate Prisma Client & Migrate database:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```
5. Build Tailwind CSS:
   ```bash
   npm run build:css
   ```
6. Jalankan dalam mode development:
   ```bash
   npm run dev
   ```
