# Panduan Deployment - Properti Indahweb

Dokumen ini menjelaskan langkah-langkah untuk mendeploy aplikasi Properti Indahweb ke **CloudPanel** (menggunakan PM2) dan **Dokploy** (menggunakan Docker / Docker Compose) secara otomatis.

---

## 1. Persiapan Database (Semua Platform)

Pastikan variabel lingkungan `DATABASE_URL` pada `.env` telah disesuaikan dengan koneksi database MySQL/MariaDB produksi Anda:
```env
DATABASE_URL="mysql://username:password@host:3306/dbname"
SESSION_SECRET="gunakan_kunci_rahasia_acak_yang_panjang"
NODE_ENV="production"
PORT=3000
```

---

## 2. Deployment di CloudPanel (Aplikasi Node.js + PM2)

CloudPanel mendukung penayangan Node.js di VPS secara langsung melalui Nginx reverse-proxy dan PM2 manager.

### Langkah-langkah:
1. **Buat Situs Node.js Baru** di panel CloudPanel Anda:
   - Pilih menu **Add Site** > **Create a Node.js Site**.
   - Masukkan Domain situs Anda (misal: `properti.indahweb.com`).
   - Tentukan versi Node.js (direkomendasikan versi 18 atau 20 LTS).
2. **Kirim/Clone Kode Sumber**:
   - Hubungkan VPS Anda via SSH, masuk ke root folder situs Anda (biasanya di `/home/cloudpanel/htdocs/properti.indahweb.com/`).
   - Clone repositori Git Anda ke folder tersebut.
3. **Konfigurasi Lingkungan (`.env`)**:
   - Salin file `.env` dan sesuaikan kredensial database produksi.
4. **Jalankan Perintah Produksi Pertama Kali**:
   Jalankan rangkaian perintah berikut di terminal SSH VPS Anda:
   ```bash
   # 1. Instal seluruh dependensi npm
   npm install

   # 2. Generate Prisma Client local library
   npx prisma generate

   # 3. Jalankan migrasi database ke MariaDB/MySQL produksi
   npx prisma migrate deploy

   # 4. Compile utility stylesheet Tailwind CSS
   npm run build:css

   # 5. Jalankan aplikasi menggunakan PM2
   pm2 start src/server.js --name properti-indahweb
   ```
5. **Konfigurasi Auto-Restart PM2**:
   Agar aplikasi otomatis kembali menyala saat server restart, jalankan perintah berikut:
   ```bash
   pm2 save
   pm2 startup
   ```

---

## 3. Deployment di Dokploy (Docker / Docker Compose)

Dokploy mendeploy aplikasi di dalam container Docker yang terisolasi. 

### Solusi Persistensi Gambar (Penting!)
Di dalam container Docker, gambar yang diupload akan hilang saat container di-redeploy jika folder upload masih berada di filesystem container. Aplikasi sekarang membaca folder upload dari environment `UPLOAD_DIR`.

Untuk Dokploy, buat **Persistent Storage / Volume Mount** untuk service aplikasi:
- Container path: `/data/uploads`
- Environment: `UPLOAD_DIR=/data/uploads`

URL gambar tetap memakai `/uploads/nama-file.jpg`, tetapi file fisiknya disimpan di `/data/uploads` yang harus persistent.

#### Konfigurasi `docker-compose.yml` (Sudah Terpasang):
```yaml
services:
  web:
    build: .
    environment:
      - UPLOAD_DIR=/data/uploads
    volumes:
      - uploads_data:/data/uploads
...
volumes:
  uploads_data:  # Disk persisten untuk menyimpan gambar selamanya
```

### Jalankan Migrasi Otomatis (Tanpa Terminal)
Kami telah menyematkan runner migrasi Prisma langsung ke dalam perintah startup container Docker. Setiap kali Anda melakukan update kode dan Dokploy mendeteksi perubahan (*auto-redeploy*), container akan otomatis memproses perintah migrasi schema sebelum server web online.

#### Konfigurasi `Dockerfile` (Sudah Terpasang):
```dockerfile
# Start command running migrations first, then starting node app
CMD npx prisma migrate deploy && npm start
```
Dengan konfigurasi ini:
- **TIDAK Perlu Membuka Terminal VPS** untuk menjalankan database migrasi setiap kali update.
- Database MariaDB/MySQL akan selalu ter-update secara otomatis begitu Dokploy selesai mem-build kode terbaru dari GitHub.

---

## 4. Perintah Produksi PM2 Resmi

*   **Menjalankan Aplikasi**:
    ```bash
    pm2 start src/server.js --name properti-indahweb
    ```
*   **Menghentikan Aplikasi**:
    ```bash
    pm2 stop properti-indahweb
    ```
*   **Restart Aplikasi**:
    ```bash
    pm2 restart properti-indahweb
    ```
*   **Melihat Log Aplikasi**:
    ```bash
    pm2 logs properti-indahweb
    ```
