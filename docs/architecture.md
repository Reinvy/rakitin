# 🏗️ Arsitektur Internal rakitin CLI

## 🇮🇩 Bahasa Indonesia

### Overview

Dokumen ini menjelaskan arsitektur internal dari **rakitin CLI**, termasuk struktur direktori, alur kerja, dan cara menambah fitur baru.

### Struktur Direktori

```
rakitin/
├── bin/
│   └── rakitin.js        # Entry point CLI
├── lib/
│   ├── constants.js      # Definisi path konstan
│   ├── prompt.js         # Logika prompt interaktif
│   ├── utils.js          # Fungsi utilitas internal CLI
│   ├── installer.js      # Logika instalasi dependensi
│   └── generator/        # Logika untuk generate berbagai fitur
│       ├── config/       # Generator konfigurasi
│       ├── middleware/   # Generator middleware
│       ├── module/       # Generator modul
│       │   ├── arch/      # Logika arsitektur modul
│       │   └── orm/       # Logika integrasi ORM
│       ├── router/       # Generator integrasi router
│       ├── shared/       # Komponen bersama
│       └── util/         # Generator utilitas
├── index.js              # Logika utama CLI
└── package.json          # Metadata proyek dan dependensi
```

### Alur Kerja CLI

#### 1. Inisialisasi

Saat CLI dijalankan dengan perintah `rakitin`:

1. **bin/rakitin.js** dieksekusi sebagai entry point
2. Menampilkan pesan sambutan: "🚀 Hai Sayang! Ini CLI rakitin-mu!"
3. Memanggil **index.js** untuk menjalankan logika utama

#### 2. Prompt Interaktif

1. **index.js** memanggil `mainPrompt()` dari **lib/prompt.js**
2. Pengguna disajikan dengan pilihan fitur yang ingin digenerate:
   - Module
   - Middleware
   - Util
   - Config
   - Router Integration
3. Berdasarkan pilihan pengguna, **index.js** akan memanggil generator yang sesuai

#### 3. Proses Generasi

Setiap generator memiliki alur kerja yang serupa:

1. Mengumpulkan input dari pengguna melalui prompt
2. Melakukan validasi input
3. Menyiapkan konten file yang akan dibuat
4. Membuat struktur direktori jika diperlukan
5. Menulis file ke sistem
6. Menampilkan pesan sukses/kesalahan

### Komponen Inti

#### 1. Constants (lib/constants.js)

Modul ini mendefinisikan path-path konstan yang digunakan di seluruh aplikasi:

```javascript
const basePath = path.join(process.cwd(), "app");
const modulesPath = path.join(basePath, "modules");
const sharedPath = path.join(basePath, "shared");
// ... path konstan lainnya
```

#### 2. Prompt (lib/prompt.js)

Modul ini menangani semua interaksi prompt dengan pengguna menggunakan library `inquirer`. Saat ini hanya memiliki satu fungsi utama:

- `mainPrompt()`: Menampilkan pilihan fitur utama

#### 3. Utils (lib/utils.js)

Modul ini menyediakan fungsi-fungsi utilitas yang digunakan di seluruh aplikasi:

- `ensureDir()`: Memastikan direktori ada
- `writeFileIfNotExists()`: Menulis file hanya jika belum ada
- `ensureBaseStructure()`: Memastikan struktur dasar aplikasi ada
- Fungsi konversi string (`toPascalCase`, `toKebabCase`, `toCamelCase`, dll)

#### 4. Installer (lib/installer.js)

Modul ini menangani instalasi dependensi yang diperlukan:

- `installIfNeeded()`: Menginstal paket jika diperlukan
- `installOrmPackages()`: Menginstal paket ORM spesifik

#### 5. Generator (lib/generator/)

Setiap generator terletak di direktori ini dan bertanggung jawab untuk membuat fitur spesifik:

- **config/**: Generator file konfigurasi
- **middleware/**: Generator middleware
- **module/**: Generator modul dengan dukungan arsitektur dan ORM
- **router/**: Generator integrasi router
- **util/**: Generator file utilitas

### Arsitektur Generator Module

Generator module adalah yang paling kompleks dengan struktur:

```
lib/generator/module/
├── module.js           # Koordinator utama
├── arch/               # Logika arsitektur
│   ├── arch.js         # Abstraksi arsitektur
│   ├── modular.arch.js # Implementasi arsitektur modular
│   └── simple.arch.js  # Implementasi arsitektur simple
├── orm/                # Logika integrasi ORM
│   ├── orm.js          # Abstraksi ORM
│   ├── prisma.orm.js   # Implementasi Prisma
│   ├── sequelize.orm.js # Implementasi Sequelize
│   ├── mongoose.orm.js # Implementasi Mongoose
│   └── typeorm.orm.js # Implementasi TypeORM
└── validation-utils.js # Utilitas validasi
```

#### Alur Kerja Generator Module

1. **module.js** mengumpulkan input pengguna (nama modul, arsitektur, ORM)
2. Berdasarkan pilihan arsitektur, memanggil:
   - `simpleArch()` untuk arsitektur simple
   - `modularArch()` untuk arsitektur modular
3. Jika ORM dipilih, memanggil fungsi ORM yang sesuai:
   - `prismaORM()`
   - `sequelizeORM()`
   - `mongooseORM()`
   - `typeormORM()`
4. Menginstal dependensi yang diperlukan

### Pattern yang Digunakan

#### 1. Abstraksi

CLI menggunakan pattern abstraksi untuk ORM dan arsitektur:

- **ORM Abstraction**: `orm.js` mendefinisikan interface yang harus diimplementasikan oleh setiap ORM
- **Architecture Abstraction**: `arch.js` mendefinisikan interface yang harus diimplementasikan oleh setiap arsitektur

#### 2. Validation

Setiap input pengguna divalidasi menggunakan fungsi dari `validation-utils.js`:

- `validateModuleName()`: Validasi nama modul
- `validateOrm()`: Validasi pilihan ORM
- `validateArchitecture()`: Validasi pilihan arsitektur

#### 3. Error Handling

Error handling dilakukan dengan konsisten:

- Setiap fungsi generator dibungkus dalam try-catch
- Error ditangani oleh `handleError()` dari `validation-utils.js`
- Pesan error yang informatif ditampilkan kepada pengguna

### Cara Menambah Fitur Baru

#### 1. Menambah Generator Baru

Untuk menambah generator baru (misalnya "Controller"):

1. Buat direktori baru di `lib/generator/controller/`
2. Buat file `controller.js` dengan fungsi `generateController()`
3. Tambahkan pilihan "Controller" di `lib/prompt.js`
4. Tambahkan case baru di `index.js`:
   ```javascript
   case "Controller":
     return generateController();
   ```

#### 2. Menambah Arsitektur Baru

Untuk menambah arsitektur baru (misalnya "Hexagonal"):

1. Buat file `hexagonal.arch.js` di `lib/generator/module/arch/`
2. Implementasikan interface yang didefinisikan di `arch.js`
3. Tambahkan pilihan "Hexagonal" di prompt generator module
4. Tambahkan logika pemanggilan di `module.js`

#### 3. Menambah ORM Baru

Untuk menambah ORM baru (misalnya "Bookshelf"):

1. Buat file `bookshelf.orm.js` di `lib/generator/module/orm/`
2. Implementasikan interface yang didefinisikan di `orm.js`
3. Tambahkan pilihan "Bookshelf" di prompt generator module
4. Tambahkan logika pemanggilan dan instalasi di `module.js`

### Best Practices

#### 1. Kode Konsisten

- Gunakan bahasa Indonesia untuk komentar dan pesan
- Ikuti standar pengkodean yang didefinisikan di `CONTRIBUTING.md`
- Gunakan JSDoc untuk dokumentasi fungsi

#### 2. Modularitas

- Pisahkan logika ke dalam fungsi-fungsi kecil
- Gunakan abstraksi untuk fitur yang memiliki variasi
- Hindari duplikasi kode

#### 3. Error Handling

- Selalu bungkus fungsi generator dalam try-catch
- Berikan pesan error yang jelas dan informatif
- Gunakan fungsi validasi untuk input pengguna

#### 4. Testing

- Uji setiap perubahan dengan berbagai skenario
- Pastikan generator berfungsi dengan baik di berbagai lingkungan
- Verifikasi bahwa file yang dihasilkan valid dan dapat digunakan

---

## 🇬🇧 English

### Overview

This document explains the internal architecture of **rakitin CLI**, including directory structure, workflow, and how to add new features.

### Directory Structure

```
rakitin/
├── bin/
│   └── rakitin.js        # CLI entry point
├── lib/
│   ├── constants.js      # Constant path definitions
│   ├── prompt.js         # Interactive prompt logic
│   ├── utils.js          # Internal CLI utility functions
│   ├── installer.js      # Dependency installation logic
│   └── generator/        # Logic for generating various features
│       ├── config/       # Configuration generator
│       ├── middleware/   # Middleware generator
│       ├── module/       # Module generator
│       │   ├── arch/      # Module architecture logic
│       │   └── orm/       # ORM integration logic
│       ├── router/       # Router integration generator
│       ├── shared/       # Shared components
│       └── util/         # Utility generator
├── index.js              # Main CLI logic
└── package.json          # Project metadata and dependencies
```

### CLI Workflow

#### 1. Initialization

When the CLI is executed with the command `rakitin`:

1. **bin/rakitin.js** is executed as the entry point
2. Displays welcome message: "🚀 Hai Sayang! Ini CLI rakitin-mu!"
3. Calls **index.js** to run the main logic

#### 2. Interactive Prompt

1. **index.js** calls `mainPrompt()` from **lib/prompt.js**
2. User is presented with feature choices to generate:
   - Module
   - Middleware
   - Util
   - Config
   - Router Integration
3. Based on user's choice, **index.js** will call the appropriate generator

#### 3. Generation Process

Each generator has a similar workflow:

1. Collect user input through prompts
2. Validate input
3. Prepare file content to be created
4. Create directory structure if needed
5. Write files to the system
6. Display success/error messages

### Core Components

#### 1. Constants (lib/constants.js)

This module defines constant paths used throughout the application:

```javascript
const basePath = path.join(process.cwd(), "app");
const modulesPath = path.join(basePath, "modules");
const sharedPath = path.join(basePath, "shared");
// ... other constant paths
```

#### 2. Prompt (lib/prompt.js)

This module handles all prompt interactions with users using the `inquirer` library. Currently has only one main function:

- `mainPrompt()`: Displays main feature choices

#### 3. Utils (lib/utils.js)

This module provides utility functions used throughout the application:

- `ensureDir()`: Ensures directory exists
- `writeFileIfNotExists()`: Writes file only if it doesn't exist
- `ensureBaseStructure()`: Ensures basic application structure exists
- String conversion functions (`toPascalCase`, `toKebabCase`, `toCamelCase`, etc.)

#### 4. Installer (lib/installer.js)

This module handles necessary dependency installation:

- `installIfNeeded()`: Installs packages if needed
- `installOrmPackages()`: Installs specific ORM packages

#### 5. Generator (lib/generator/)

Each generator is located in this directory and is responsible for creating specific features:

- **config/**: Configuration file generator
- **middleware/**: Middleware generator
- **module/**: Module generator with architecture and ORM support
- **router/**: Router integration generator
- **util/**: Utility file generator

### Module Generator Architecture

The module generator is the most complex with the following structure:

```
lib/generator/module/
├── module.js           # Main coordinator
├── arch/               # Architecture logic
│   ├── arch.js         # Architecture abstraction
│   ├── modular.arch.js # Modular architecture implementation
│   └── simple.arch.js  # Simple architecture implementation
├── orm/                # ORM integration logic
│   ├── orm.js          # ORM abstraction
│   ├── prisma.orm.js   # Prisma implementation
│   ├── sequelize.orm.js # Sequelize implementation
│   ├── mongoose.orm.js # Mongoose implementation
│   └── typeorm.orm.js # TypeORM implementation
└── validation-utils.js # Validation utilities
```

#### Module Generator Workflow

1. **module.js** collects user input (module name, architecture, ORM)
2. Based on architecture choice, calls:
   - `simpleArch()` for simple architecture
   - `modularArch()` for modular architecture
3. If ORM is selected, calls the appropriate ORM function:
   - `prismaORM()`
   - `sequelizeORM()`
   - `mongooseORM()`
   - `typeormORM()`
4. Installs necessary dependencies

### Patterns Used

#### 1. Abstraction

CLI uses abstraction pattern for ORM and architecture:

- **ORM Abstraction**: `orm.js` defines interface that must be implemented by each ORM
- **Architecture Abstraction**: `arch.js` defines interface that must be implemented by each architecture

#### 2. Validation

Each user input is validated using functions from `validation-utils.js`:

- `validateModuleName()`: Validate module name
- `validateOrm()`: Validate ORM choice
- `validateArchitecture()`: Validate architecture choice

#### 3. Error Handling

Error handling is done consistently:

- Each generator function is wrapped in try-catch
- Errors are handled by `handleError()` from `validation-utils.js`
- Informative error messages are displayed to users

### How to Add New Features

#### 1. Adding a New Generator

To add a new generator (e.g., "Controller"):

1. Create new directory at `lib/generator/controller/`
2. Create `controller.js` with `generateController()` function
3. Add "Controller" choice in `lib/prompt.js`
4. Add new case in `index.js`:
   ```javascript
   case "Controller":
     return generateController();
   ```

#### 2. Adding a New Architecture

To add a new architecture (e.g., "Hexagonal"):

1. Create `hexagonal.arch.js` file in `lib/generator/module/arch/`
2. Implement interface defined in `arch.js`
3. Add "Hexagonal" choice in module generator prompt
4. Add calling logic in `module.js`

#### 3. Adding a New ORM

To add a new ORM (e.g., "Bookshelf"):

1. Create `bookshelf.orm.js` file in `lib/generator/module/orm/`
2. Implement interface defined in `orm.js`
3. Add "Bookshelf" choice in module generator prompt
4. Add calling and installation logic in `module.js`

### Best Practices

#### 1. Consistent Code

- Use Indonesian language for comments and messages
- Follow coding standards defined in `CONTRIBUTING.md`
- Use JSDoc for function documentation

#### 2. Modularity

- Separate logic into small functions
- Use abstraction for features with variations
- Avoid code duplication

#### 3. Error Handling

- Always wrap generator functions in try-catch
- Provide clear and informative error messages
- Use validation functions for user input

#### 4. Testing

- Test each change with various scenarios
- Ensure generators work well in different environments
- Verify that generated files are valid and usable