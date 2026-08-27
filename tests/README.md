# Pengujian Rakitin

Dokumentasi untuk pengujian otomatis proyek Rakitin.

## Struktur Pengujian

```
tests/
├── setup.js                    # Konfigurasi global untuk pengujian
├── lib/                        # Pengujian unit untuk fungsi-fungsi inti
│   ├── utils.test.js           # Pengujian untuk lib/utils.js
│   ├── constants.test.js       # Pengujian untuk lib/constants.js
│   ├── prompt.test.js          # Pengujian untuk lib/prompt.js
│   ├── installer.test.js       # Pengujian untuk lib/installer.js
│   └── generator/              # Pengujian untuk generator
│       ├── module.test.js      # Pengujian untuk module generator
│       ├── arch.test.js        # Pengujian untuk arsitektur (simple & modular)
│       ├── orm.test.js         # Pengujian untuk implementasi ORM
│       └── config-router.test.js # Pengujian untuk config & router
└── integration/                # Pengujian integrasi
    ├── end-to-end.test.js      # Pengujian alur kerja end-to-end
    ├── file-validation.test.js # Pengujian validitas file yang dihasilkan
    └── directory-structure.test.js # Pengujian struktur direktori
```

## Menjalankan Pengujian

### Menjalankan Semua Pengujian
```bash
npm test
```

### Menjalankan Pengujian dengan Watch Mode
```bash
npm run test:watch
```

### Menjalankan Pengujian dengan Coverage
```bash
npm run test:coverage
```

### Menjalankan Pengujian di CI/CD
```bash
npm run test:ci
```

## Jenis Pengujian

### 1. Pengujian Unit (Unit Tests)
Pengujian unit dilakukan untuk setiap fungsi dan modul secara terpisah:
- **Utils**: Pengujian fungsi utilitas seperti konversi string, operasi file, dll.
- **Constants**: Pengujian konstanta dan path yang digunakan dalam aplikasi.
- **Prompt**: Pengujian fungsi prompt untuk interaksi dengan pengguna.
- **Installer**: Pengujian fungsi instalasi package dan dependensi.

### 2. Pengujian Generator (Generator Tests)
Pengujian untuk memastikan generator berfungsi dengan benar:
- **Module Generator**: Pengujian pembuatan modul baru dengan berbagai opsi.
- **Architecture Tests**: Pengujian pembuatan struktur arsitektur (Simple & Modular).
- **ORM Tests**: Pengujian integrasi dengan berbagai ORM (Prisma, Sequelize, dll.).
- **Config & Router**: Pengujian pembuatan konfigurasi dan integrasi router.

### 3. Pengujian Integrasi (Integration Tests)
Pengujian untuk memastikan komponen bekerja sama dengan baik:
- **End-to-End**: Pengujian alur kerja lengkap dari awal hingga akhir.
- **File Validation**: Pengujian validitas file yang dihasilkan oleh generator.
- **Directory Structure**: Pengujian struktur direktori yang dibuat oleh generator.

### 4. Pengujian Real Project (Real Project E2E Tests)
Pengujian langsung terhadap direktori proyek nyata di `tests/project/` tanpa mocking:
```bash
# Update link global rakitin terlebih dahulu
npm unlink -g rakitin 2>/dev/null || true
npm link

# Jalankan suite pengujian real project
npm run test:real-project
```
Aturan lengkap dapat dilihat di [docs/real-project-testing-rules.md](../docs/real-project-testing-rules.md).

## Mocking

Pengujian menggunakan mocking untuk mengisolasi komponen yang sedang diuji:
- **File System**: Operasi file sistem di-mock untuk menghindari perubahan file yang tidak diinginkan.
- **Inquirer**: Prompt interaktif di-mock untuk pengujian otomatis.
- **Child Process**: Perintah eksternal di-mock untuk menghindari eksekusi yang tidak diinginkan.
- **Dependencies**: Dependensi eksternal di-mock untuk mengisolasi pengujian.

## Coverage

Pengujian dirancang untuk mencapai coverage yang tinggi:
- **Lines**: Persentase baris kode yang dieksekusi selama pengujian.
- **Functions**: Persentase fungsi yang dipanggil selama pengujian.
- **Branches**: Persentase cabang kondisi yang dieksekusi selama pengujian.
- **Statements**: Persentase pernyataan yang dieksekusi selama pengujian.

Laporan coverage dapat ditemukan di direktori `coverage/` setelah menjalankan `npm run test:coverage`.

## CI/CD

Pengujian otomatis diintegrasikan dengan GitHub Actions:
- **Multiple Node.js Versions**: Pengujian dijalankan pada Node.js 14.x, 16.x, 18.x, dan 20.x.
- **Multiple OS**: Pengujian dijalankan pada Ubuntu, Windows, dan macOS.
- **Coverage Reporting**: Laporan coverage diunggah ke Codecov.
- **Automated Testing**: Pengujian otomatis dijalankan pada setiap push dan pull request.

## Best Practices

1. **Test Isolation**: Setiap pengujian harus independen dan tidak bergantung pada pengujian lain.
2. **Clear Naming**: Nama pengujian harus jelas dan deskriptif.
3. **Arrange-Act-Assert**: Struktur pengujian mengikuti pola Arrange-Act-Assert.
4. **Mock External Dependencies**: Dependensi eksternal harus di-mock untuk isolasi.
5. **Test Edge Cases**: Kasus edge dan error handling harus diuji.
6. **Regular Updates**: Pengujian harus diperbarui saat kode berubah.

## Troubleshooting

### Pengujian Gagal
1. Periksa pesan error untuk mengetahui penyebabnya.
2. Pastikan semua dependensi terinstall dengan `npm install`.
3. Coba jalankan pengujian satu per satu untuk mengisolasi masalah.

### Coverage Rendah
1. Identifikasi bagian kode yang tidak tercakup dalam pengujian.
2. Tambahkan pengujian untuk bagian kode yang tidak tercakup.
3. Pastikan semua cabang kondisi memiliki pengujian.

### Mocking Tidak Berfungsi
1. Pastikan mock diatur sebelum pengujian dijalankan.
2. Reset mock setelah setiap pengujian dengan `jest.clearAllMocks()`.
3. Verifikasi bahwa mock dipanggil dengan argumen yang benar.