# 📚 Contoh Proyek rakitin

## 🇮🇩 Bahasa Indonesia

### Pendahuluan

Direktori ini berisi contoh-contoh proyek yang dibuat menggunakan **rakitin CLI**. Setiap contoh menunjukkan cara menggunakan rakitin untuk membuat berbagai jenis aplikasi backend dengan arsitektur dan ORM yang berbeda.

### Daftar Contoh

#### 1. Simple Architecture dengan Prisma
- **Lokasi**: `simple-prisma/`
- **Deskripsi**: Contoh aplikasi backend sederhana dengan arsitektur simple dan Prisma ORM
- **Fitur**:
  - Struktur modul simple (controller, service, router dalam satu file)
  - Integrasi dengan Prisma ORM
  - Database PostgreSQL
  - RESTful API

#### 2. Modular Architecture dengan Sequelize
- **Lokasi**: `modular-sequelize/`
- **Deskripsi**: Contoh aplikasi backend dengan arsitektur modular dan Sequelize ORM
- **Fitur**:
  - Struktur modular (folder terpisah untuk controllers, services, models, routes)
  - Integrasi dengan Sequelize ORM
  - Database MySQL
  - RESTful API
  - Middleware autentikasi

#### 3. Modular Architecture dengan Mongoose
- **Lokasi**: `modular-mongoose/`
- **Deskripsi**: Contoh aplikasi backend dengan arsitektur modular dan Mongoose ODM
- **Fitur**:
  - Struktur modular
  - Integrasi dengan Mongoose ODM
  - Database MongoDB
  - RESTful API
  - Validasi data

#### 4. Simple Architecture tanpa ORM
- **Lokasi**: `simple-no-orm/`
- **Deskripsi**: Contoh aplikasi backend sederhana tanpa ORM
- **Fitur**:
  - Struktur modul simple
  - Koneksi database langsung dengan driver
  - Database SQLite
  - RESTful API sederhana

### Cara Menjalankan Contoh

Setiap contoh memiliki instruksi spesifik di file README-nya masing-masing, namun secara umum langkah-langkahnya adalah:

1. **Masuk ke direktori contoh**
   ```bash
   cd examples/[nama-contoh]
   ```

2. **Instal dependensi**
   ```bash
   npm install
   ```

3. **Atur konfigurasi database**
   - Edit file `.env` dengan kredensial database Anda
   - Jalankan migrasi jika diperlukan

4. **Jalankan aplikasi**
   ```bash
   npm start
   ```

5. **Tes API**
   - Gunakan Postman, curl, atau browser untuk mengakses endpoint
   - Biasanya tersedia di `http://localhost:3000`

### Struktur Umum Contoh

Setiap contoh memiliki struktur yang serupa:

```
[nama-contoh]/
├── app/
│   ├── modules/          # Modul aplikasi
│   │   └── [module-name]/ # Modul spesifik
│   ├── shared/           # Komponen bersama
│   │   ├── middlewares/  # Middleware
│   │   ├── config/       # Konfigurasi
│   │   └── utils/        # Utilitas
│   ├── app.js            # Inisialisasi Express
│   └── server.js         # Entry point
├── .env.example          # Contoh variabel lingkungan
├── package.json          # Metadata dan dependensi
└── README.md             # Instruksi khusus contoh
```

### Kontribusi Contoh

Jika Anda ingin berkontribusi dengan contoh baru:

1. Buat direktori baru di `examples/`
2. Ikuti struktur umum di atas
3. Buat README.md dengan instruksi yang jelas
4. Pastikan contoh berfungsi dengan baik
5. Buat Pull Request ke repositori utama

---

## 🇬🇧 English

### Introduction

This directory contains example projects created using **rakitin CLI**. Each example demonstrates how to use rakitin to create different types of backend applications with various architectures and ORMs.

### List of Examples

#### 1. Simple Architecture with Prisma
- **Location**: `simple-prisma/`
- **Description**: Simple backend application example with simple architecture and Prisma ORM
- **Features**:
  - Simple module structure (controller, service, router in one file)
  - Prisma ORM integration
  - PostgreSQL database
  - RESTful API

#### 2. Modular Architecture with Sequelize
- **Location**: `modular-sequelize/`
- **Description**: Backend application example with modular architecture and Sequelize ORM
- **Features**:
  - Modular structure (separate folders for controllers, services, models, routes)
  - Sequelize ORM integration
  - MySQL database
  - RESTful API
  - Authentication middleware

#### 3. Modular Architecture with Mongoose
- **Location**: `modular-mongoose/`
- **Description**: Backend application example with modular architecture and Mongoose ODM
- **Features**:
  - Modular structure
  - Mongoose ODM integration
  - MongoDB database
  - RESTful API
  - Data validation

#### 4. Simple Architecture without ORM
- **Location**: `simple-no-orm/`
- **Description**: Simple backend application example without ORM
- **Features**:
  - Simple module structure
  - Direct database connection with driver
  - SQLite database
  - Simple RESTful API

### How to Run Examples

Each example has specific instructions in its respective README file, but generally the steps are:

1. **Navigate to the example directory**
   ```bash
   cd examples/[example-name]
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up database configuration**
   - Edit `.env` file with your database credentials
   - Run migrations if necessary

4. **Run the application**
   ```bash
   npm start
   ```

5. **Test the API**
   - Use Postman, curl, or browser to access endpoints
   - Usually available at `http://localhost:3000`

### General Example Structure

Each example has a similar structure:

```
[example-name]/
├── app/
│   ├── modules/          # Application modules
│   │   └── [module-name]/ # Specific module
│   ├── shared/           # Shared components
│   │   ├── middlewares/  # Middlewares
│   │   ├── config/       # Configuration
│   │   └── utils/        # Utilities
│   ├── app.js            # Express initialization
│   └── server.js         # Entry point
├── .env.example          # Environment variables example
├── package.json          # Metadata and dependencies
└── README.md             # Example-specific instructions
```

### Contributing Examples

If you want to contribute with a new example:

1. Create a new directory in `examples/`
2. Follow the general structure above
3. Create a README.md with clear instructions
4. Ensure the example works properly
5. Create a Pull Request to the main repository