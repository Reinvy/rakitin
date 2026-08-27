# Aturan & Standar Pengujian `rakitin` pada Real Project

Dokumen ini adalah panduan otoritatif bagi *developer* dan *AI coding agents* untuk melakukan pengujian library `rakitin` pada proyek nyata (*real project*) di direktori `tests/project`.

---

## 1. Filosofi & Tujuan Pengujian

Pengujian real-project bertujuan memastikan bahwa CLI `rakitin` berfungsi 100% dari perspektif pengguna terminal nyata tanpa *mocking* internal yang artifisial.

### 6 Aturan Emas Pengujian Real-Project:

1. **Global Link Terkini**: Sebelum pengujian dimulai, lakukan `npm unlink -g rakitin` lalu `npm link` di root repository rakitin agar binary global selalu sinkron dengan kode lokal.
2. **Clean Slate Per-Skenario**: Setiap skenario pengujian independen harus dimulai dari direktori `tests/project` yang bersih total (tanpa artefak sisa dari test sebelumnya), diinisialisasi dengan `package.json` minimal.
3. **Simulasi Pengguna Nyata (Zero-Assumption)**: Jalankan perintah langsung melalui binary CLI (`rakitin <cmd>`) atau piping stdin untuk prompt interaktif.
4. **Cakupan Seluruh Perintah**: Seluruh generator, perintah diagnostik, opsi `--arch`, `--orm`, `--yes`, `--dry-run`, `--json`, `--no-install`, dan *composite recipes* harus teruji.
5. **Verifikasi Keutuhan File & Sintaks**: Seluruh file `.js` yang dihasilkan wajib lulus uji sintaks (`node -c <file>`) dan tidak menghasilkan *dangling imports* atau *runtime ReferenceError*.
6. **Pembersihan Bersih (Clean Teardown)**: Kembalikan kondisi direktori `tests/project` setelah seluruh rangkaian tes selesai.

---

## 2. Siklus Alur Kerja (Workflow)

```bash
# 1. Update global symlink binary
npm unlink -g rakitin 2>/dev/null || true
npm link

# 2. Jalankan test suite real project otomatis
npm run test:real-project

# Atau jalankan via Jest E2E suite
npm run test:e2e
```

---

## 3. Struktur Pengujian Real Project

Direktori target: `tests/project/`

Setiap pengujian menyiapkan struktur proyek minimal:
```json
{
  "name": "test-real-project",
  "version": "1.0.0",
  "description": "Clean test project for rakitin",
  "main": "index.js",
  "type": "commonjs",
  "dependencies": {
    "express": "^4.19.0"
  }
}
```

---

## 4. Matriks Perintah yang Diuji

| Kategori | Perintah CLI | Skenario Validasi |
|---|---|---|
| **Init** | `rakitin init [--preset basic\|intermediate\|advanced] [--overwrite]` | Memastikan `.rakitinrc.json` terbuat dan idempoten |
| **Module (Modular)** | `rakitin add module user --arch modular --orm none --yes` | Memverifikasi `app/modules/user/{controllers,services,routes}/user.*.js` |
| **Module (Simple)** | `rakitin add module product --arch simple --orm none --yes` | Memverifikasi `app/modules/product/product.{controller,router,service}.js` |
| **Module (ORMs)** | `rakitin add module item --arch modular --orm mongoose\|prisma\|sequelize\|typeorm --no-install --yes` | Memverifikasi schema/model ORM dan inisialisasi koneksi |
| **Middleware** | `rakitin add middleware <kind>` (`auth`, `logger`, `error`, `request-time`, `custom`) | Memverifikasi `app/shared/middlewares/<kind>.middleware.js` |
| **Config** | `rakitin add config <kind>` (`app`, `jwt`, `database`, `cors`, dll) | Memverifikasi `app/shared/config/<kind>.config.js` & penambahan blok `.env.example` |
| **Util** | `printf 'uuid\n' \| rakitin add util` | Memverifikasi `app/shared/utils/uuid.util.js` |
| **Endpoint** | `printf 'user\nprofile\nbio:string,age:number\nY\nY\n' \| rakitin add endpoint` | Memverifikasi penambahan endpoint baru ke modul eksisting |
| **Validation** | `printf 'new\nUser\nname:string:true,email:string:true\n' \| rakitin add validation` | Memverifikasi schema validasi Joi di `app/shared/validators/` |
| **Documentation** | `printf 'openapi-json\nMy API\n1.0.0\nY\n' \| rakitin add docs` | Memverifikasi pembuatan OpenAPI spec di `app/docs/` |
| **Recipe Auth** | `rakitin recipe auth --arch modular` | Memverifikasi JWT middleware + user module + joi validators + env |
| **Recipe Swagger** | `rakitin recipe swagger` | Memverifikasi OpenAPI 3 spec + setup swagger-ui |
| **Recipe Test** | `rakitin recipe test` | Memverifikasi Jest & Supertest scaffold |
| **Recipe Docker** | `rakitin recipe docker` | Memverifikasi Dockerfile, docker-compose.yml, .dockerignore |
| **Integrate** | `rakitin integrate [--middleware auth,logger]` | Memverifikasi marker `/* rakitin:routes:start */`, file `app/routes/index.js`, dan backup `.bak` |
| **Diagnostics** | `rakitin info`, `rakitin doctor`, `rakitin list` | Memverifikasi keluaran JSON dan health-check status |

---

## 5. Pemeriksaan Integritas Hasil Eksekusi

Setiap file `.js` yang digenerate oleh `rakitin` harus diperiksa dengan script:
```bash
# Validasi sintaks untuk seluruh file .js di dalam direktori app
find app/ -name "*.js" -exec node -c {} +
```

Dan untuk verifikasi import router utama:
```bash
node -e "require('./app/routes/index.js')"
```
