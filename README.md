
# 🚀 rakitin

[![npm version](https://badge.fury.io/js/rakitin.svg)](https://badge.fury.io/js/rakitin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🇮🇩 Bahasa Indonesia

### Deskripsi Proyek

**rakitin** adalah Command Line Interface (CLI) yang dirancang khusus untuk mempercepat proses pengembangan _backend_ modular dengan Node.js dan Express.js. CLI ini membantu Anda _menggenerate_ _boilerplate_ kode untuk berbagai komponen aplikasi seperti modul, _middleware_, utilitas, dan konfigurasi, sehingga Anda dapat fokus pada logika bisnis inti aplikasi Anda.

### Fitur Utama

**rakitin** menawarkan kemampuan _generate_ kode untuk berbagai kebutuhan:

* **Module**: Membangun struktur modul aplikasi dengan dua pilihan arsitektur:
    * **Simple**: Modul akan memiliki _controller_, _service_, dan _router_ dalam satu direktori modul.
    * **Modular**: Modul akan memiliki sub-direktori terpisah untuk _controllers_, _services_, _models_, dan _routes_, mendorong modularitas yang lebih ketat.
    * Pilihan untuk mengintegrasikan ORM (Prisma, Sequelize, Mongoose, TypeORM).
* **Middleware**: _Generate_ berbagai jenis _middleware_ Express.js:
    * **Custom**: Membuat _middleware_ kosong yang dapat Anda isi dengan logika sendiri.
    * **auth**: _Middleware_ otentikasi menggunakan JWT.
    * **logger**: _Middleware_ untuk _logging_ permintaan masuk ke konsol.
    * **error**: _Middleware_ penanganan _error_ global.
    * **request-time**: _Middleware_ untuk mencatat waktu yang dibutuhkan untuk setiap permintaan.
* **Util**: Membuat file utilitas dengan berbagai fungsi yang sering digunakan:
    * **Custom**: Membuat utilitas kosong.
    * **date**: Fungsi-fungsi utilitas terkait tanggal (misalnya, `now`, `format`, `add`, `subtract`, `isBefore`, `isAfter`).
    * **string**: Fungsi-fungsi utilitas terkait _string_ (misalnya, `capitalize`, `kebabCase`, `camelCase`, `truncate`, `reverse`).
    * **number**: Fungsi-fungsi utilitas terkait angka (misalnya, `clamp`, `isEven`, `isOdd`, `randomInt`, `toCurrency`).
    * **array**: Fungsi-fungsi utilitas terkait _array_ (misalnya, `unique`, `flatten`, `chunk`, `compact`).
    * **object**: Fungsi-fungsi utilitas terkait objek (misalnya, `isEmpty`, `deepClone`, `merge`).
    * **file**: Fungsi-fungsi utilitas terkait sistem _file_ (misalnya, `readJson`, `writeJson`, `exists`).
    * **crypto**: Fungsi-fungsi utilitas kriptografi (misalnya, `hashSHA256`, `randomHex`).
    * **uuid**: Fungsi untuk _generate_ UUID (misalnya, `generate`, `short`).
    * **env**: Fungsi untuk membaca variabel lingkungan dari `.env` (misalnya, `get`, `requireEnv`).
    * **url**: Fungsi untuk memparsing atau mendapatkan _hostname_ dari URL.
    * **color**: Fungsi untuk mengkonversi _hex_ ke RGB.
    * **math**: Fungsi matematika dasar (misalnya, `sum`, `average`, `max`).
    * **validation**: Fungsi validasi dasar (misalnya, `isEmail`, `isUrl`).
    * **regex**: Fungsi utilitas _regex_ (misalnya, `matchAll`, `escape`).
    * **time**: Fungsi utilitas terkait waktu (misalnya, `sleep`, `now`).
* **Config** (Dalam Pengembangan): Fitur ini akan membantu dalam membuat file konfigurasi standar untuk berbagai kebutuhan aplikasi.
* **Integrasi Router Utama** (Dalam Pengembangan): Fitur ini akan mempermudah integrasi _router_ modul yang baru dibuat ke dalam _router_ utama aplikasi, mengurangi kerja manual.

### Instalasi

Untuk menggunakan **rakitin**, pastikan Anda memiliki Node.js (versi >=18) dan npm terinstal di sistem Anda.

1.  **Kloning repositori:**
    ```bash
    git clone [https://github.com/reinvy/rakitin.git](https://github.com/reinvy/rakitin.git)
    cd rakitin/rakitin-development # atau di mana pun Anda mengekstrak file
    ```
2.  **Instal dependensi:**
    ```bash
    npm install
    ```
3.  **Jalankan CLI secara lokal (opsional, untuk pengembangan/pengujian):**
    ```bash
    npm start
    ```
    Atau, untuk membuatnya tersedia sebagai perintah global `rakitin`:
    ```bash
    npm link
    ```

### Penggunaan

Setelah instalasi, Anda dapat menjalankan **rakitin** dari terminal:

```bash
rakitin
````

Anda akan disambut dengan *prompt* interaktif yang menanyakan "Apa yang ingin Anda generate?".

```
🚀 Hai Sayang! Ini CLI rakitin-mu!
? Apa yang ingin Anda generate? (Use arrow keys)
❯ Module
  Middleware
  Util
  Config
  Integrasi Router Utama
```

Pilih fitur yang ingin Anda *generate* menggunakan tombol panah atas/bawah dan tekan `Enter`. CLI akan memandu Anda melalui *prompt* tambahan sesuai dengan pilihan Anda.

#### Contoh Penggunaan: Membuat Modul

1.  Jalankan `rakitin`.
2.  Pilih `Module`.
3.  Masukkan nama modul Anda (misalnya, `User`).
4.  Pilih arsitektur (`Simple` atau `Modular`).
5.  Pilih apakah akan menggunakan ORM atau tidak.
6.  Jika memilih ORM, pilih ORM/Database yang diinginkan.

**rakitin** akan membuat struktur folder dan file yang sesuai di dalam direktori `app/modules/user` Anda.

### Struktur Proyek

Berikut adalah gambaran umum struktur proyek yang dibuat atau diinteraksi oleh `rakitin`:

```
.
├── app/
│   ├── modules/          # Folder untuk modul aplikasi Anda
│   │   └── [module-name]/
│   │       ├── [module-name].controller.js (Simple Arch)
│   │       ├── [module-name].service.js (Simple Arch)
│   │       ├── [module-name].routes.js (Simple Arch)
│   │       └── controllers/ (Modular Arch)
│   │       └── services/ (Modular Arch)
│   │       └── models/ (Modular Arch)
│   │       └── routes/ (Modular Arch)
│   ├── shared/           # Folder untuk komponen yang dibagikan antar modul
│   │   ├── middlewares/  # Middleware aplikasi
│   │   │   └── [middleware-name].middleware.js
│   │   ├── config/       # File konfigurasi
│   │   ├── utils/        # File utilitas
│   │   │   └── [util-name].util.js
│   │   └── interfaces/   # Definisi interface/tipe (jika ada)
│   ├── app.js            # File inisialisasi aplikasi Express
│   └── server.js         # Titik masuk utama aplikasi
├── bin/
│   └── rakitin.js        # Executable CLI
├── lib/
│   ├── generator/        # Logika untuk generate berbagai fitur
│   │   ├── config/       # Logika generator Config (Dalam Pengembangan)
│   │   ├── middleware/
│   │   ├── module/
│   │   ├── router/       # Logika generator Router Utama (Dalam Pengembangan)
│   │   └── util/
│   ├── constants.js      # Definisi path konstan
│   ├── prompt.js         # Logika prompt interaktif
│   └── utils.js          # Fungsi utilitas internal CLI
├── index.js              # Logika utama CLI
├── package.json          # Metadata proyek dan dependensi
├── package-lock.json     # Resolusi dependensi
└── .gitignore            # File yang diabaikan oleh Git
```

### Lisensi

Proyek ini dilisensikan di bawah Lisensi MIT.

### Kontribusi

Kontribusi dipersilakan\! Jika Anda memiliki ide atau menemukan *bug*, silakan ajukan *issue* atau *pull request*.

### Kontak

Author: Reinvy

-----

## 🇬🇧 English

### Project Description

**rakitin** is a Command Line Interface (CLI) specifically designed to accelerate the development process of modular backend applications with Node.js and Express.js. This CLI helps you generate boilerplate code for various application components such as modules, middleware, utilities, and configurations, allowing you to focus on your application's core business logic.

### Key Features

**rakitin** offers code generation capabilities for various needs:

  * **Module**: Builds application module structures with two architecture options:
      * **Simple**: Modules will have controllers, services, and routers within a single module directory.
      * **Modular**: Modules will have separate sub-directories for controllers, services, models, and routes, promoting stricter modularity.
      * Option to integrate ORMs (Prisma, Sequelize, Mongoose, TypeORM).
  * **Middleware**: Generates various types of Express.js middleware:
      * **Custom**: Creates an empty middleware that you can fill with your own logic.
      * **auth**: Authentication middleware using JWT.
      * **logger**: Middleware for logging incoming requests to the console.
      * **error**: Global error handling middleware.
      * **request-time**: Middleware for logging the time taken for each request.
  * **Util**: Creates utility files with various commonly used functions:
      * **Custom**: Creates an empty utility.
      * **date**: Date-related utility functions (e.g., `now`, `format`, `add`, `subtract`, `isBefore`, `isAfter`).
      * **string**: String-related utility functions (e.g., `capitalize`, `kebabCase`, `camelCase`, `truncate`, `reverse`).
      * **number**: Number-related utility functions (e.g., `clamp`, `isEven`, `isOdd`, `randomInt`, `toCurrency`).
      * **array**: Array-related utility functions (e.g., `unique`, `flatten`, `chunk`, `compact`).
      * **object**: Object-related utility functions (e.g., `isEmpty`, `deepClone`, `merge`).
      * **file**: File system-related utility functions (e.g., `readJson`, `writeJson`, `exists`).
      * **crypto**: Cryptography utility functions (e.g., `hashSHA256`, `randomHex`).
      * **uuid**: Functions to generate UUIDs (e.g., `generate`, `short`).
      * **env**: Functions to read environment variables from `.env` (e.g., `get`, `requireEnv`).
      * **url**: Functions to parse or get hostname from a URL.
      * **color**: Function to convert hex to RGB.
      * **math**: Basic mathematical functions (e.g., `sum`, `average`, `max`).
      * **validation**: Basic validation functions (e.g., `isEmail`, `isUrl`).
      * **regex**: Regex utility functions (e.g., `matchAll`, `escape`).
      * **time**: Time-related utility functions (e.g., `sleep`, `now`).
  * **Config** (Under Development): This feature will assist in creating standard configuration files for various application needs.
  * **Main Router Integration** (Under Development): This feature will simplify the integration of newly created module routers into the application's main router, reducing manual effort.

### Installation

To use **rakitin**, ensure you have Node.js (version \>=18) and npm installed on your system.

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/reinvy/rakitin.git](https://github.com/reinvy/rakitin.git)
    cd rakitin/rakitin-development # or wherever you extracted the files
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run the CLI locally (optional, for development/testing):**
    ```bash
    npm start
    ```
    Or, to make it available as a global `rakitin` command:
    ```bash
    npm link
    ```

### Usage

After installation, you can run **rakitin** from your terminal:

```bash
rakitin
```

You will be greeted with an interactive prompt asking "Apa yang ingin Anda generate?" (What do you want to generate?).

```
🚀 Hai Sayang! Ini CLI rakitin-mu!
? Apa yang ingin Anda generate? (Use arrow keys)
❯ Module
  Middleware
  Util
  Config
  Integrasi Router Utama
```

Select the feature you want to generate using the up/down arrow keys and press `Enter`. The CLI will guide you through additional prompts based on your selection.

#### Usage Example: Creating a Module

1.  Run `rakitin`.
2.  Select `Module`.
3.  Enter your module name (e.g., `User`).
4.  Choose the architecture (`Simple` or `Modular`).
5.  Choose whether to use an ORM or not.
6.  If choosing an ORM, select the desired ORM/Database.

**rakitin** will create the appropriate folder structure and files within your `app/modules/user` directory.

### Project Structure

Here's an overview of the project structure created or interacted with by `rakitin`:

```
.
├── app/
│   ├── modules/          # Folder for your application modules
│   │   └── [module-name]/
│   │       ├── [module-name].controller.js (Simple Arch)
│   │       ├── [module-name].service.js (Simple Arch)
│   │       ├── [module-name].routes.js (Simple Arch)
│   │       └── controllers/ (Modular Arch)
│   │       └── services/ (Modular Arch)
│   │       └── models/ (Modular Arch)
│   │       └── routes/ (Modular Arch)
│   ├── shared/           # Folder for components shared between modules
│   │   ├── middlewares/  # Application middlewares
│   │   │   └── [middleware-name].middleware.js
│   │   ├── config/       # Configuration files
│   │   ├── utils/        # Utility files
│   │   │   └── [util-name].util.js
│   │   └── interfaces/   # Interface/type definitions (if any)
│   ├── app.js            # Express app initialization file
│   └── server.js         # Main application entry point
├── bin/
│   └── rakitin.js        # CLI executable
├── lib/
│   ├── generator/        # Logic for generating various features
│   │   ├── config/       # Config generator logic (Under Development)
│   │   ├── middleware/
│   │   ├── module/
│   │   ├── router/       # Main Router Integration generator logic (Under Development)
│   │   └── util/
│   ├── constants.js      # Constant path definitions
│   ├── prompt.js         # Interactive prompt logic
│   └── utils.js          # Internal CLI utility functions
├── index.js              # Main CLI logic
├── package.json          # Project metadata and dependencies
├── package-lock.json     # Dependency resolution
└── .gitignore            # Files ignored by Git
```

### License

This project is licensed under the MIT License.

### Contributing

Contributions are welcome\! If you have ideas or find bugs, please open an issue or submit a pull request.

### Contact

Author: Reinvy

```
```
