# 🔄 Integrasi Router Utama di rakitin

## 🇮🇩 Bahasa Indonesia

### Pendahuluan

Fitur **Integrasi Router Utama** di **rakitin CLI** mempermudah proses integrasi router dari modul-modul yang telah dibuat ke dalam router utama aplikasi. Fitur ini mengotomatisasi proses yang biasanya dilakukan secara manual, sehingga menghemat waktu dan mengurangi kemungkinan kesalahan.

### Fitur Utama

- **Integrasi Otomatis**: Mendeteksi semua modul yang ada dan mengintegrasikannya secara otomatis
- **Integrasi Manual**: Memilih modul-modul tertentu yang akan diintegrasikan
- **Dukungan Arsitektur**:
  - **Modular**: Setiap modul memiliki router terpisah yang diimpor ke router utama
  - **Simple**: Semua route didefinisikan langsung di router utama dengan mengimpor controller
- **Pilihan Lokasi Router**: Router utama dapat dibuat di folder `app/routes` atau di folder root proyek
- **Middleware Global**: Mendukung penggunaan middleware global yang diterapkan ke semua route
- **Contoh Penggunaan**: Otomatis membuat contoh penggunaan router di file `app.js`

### Cara Penggunaan

#### 1. Menjalankan Integrasi Router

Jalankan CLI rakitin:

```bash
rakitin
```

Pilih **"Integrasi Router Utama"** dari menu:

```
🚀 Hai Sayang! Ini CLI rakitin-mu!
? Apa yang ingin Anda generate? (Use arrow keys)
❯ Module
  Middleware
  Util
  Config
  Integrasi Router Utama
```

#### 2. Memilih Jenis Integrasi

 Anda akan diminta memilih jenis integrasi:

```
? Pilih jenis integrasi router:
❯ Otomatis (deteksi semua modul)
  Manual (pilih modul yang diinginkan)
```

- **Otomatis**: Akan mendeteksi dan mengintegrasikan semua modul yang ada di folder `app/modules`
- **Manual**: Memungkinkan Anda memilih modul-modul tertentu yang akan diintegrasikan

#### 3. Memilih Lokasi Router

```
? Di mana router utama akan dibuat?
❯ Di folder app/routes
  Di folder root
```

- **Di folder app/routes**: Router utama akan dibuat di `{basePath}/routes/index.js`
- **Di folder root**: Router utama akan dibuat di `{cwd}/routes/index.js`

#### 4. Memilih Arsitektur Router

```
? Pilih arsitektur router:
❯ Modular (setiap modul memiliki router terpisah)
  Simple (semua route dalam satu file)
```

- **Modular**: Setiap modul harus memiliki file router terpisah yang akan diimpor ke router utama
- **Simple**: Router utama akan mendefinisikan semua route dengan mengimpor controller dari setiap modul

#### 5. Memilih Middleware Global (Opsional)

```
? Apakah Anda ingin menggunakan middleware global? Yes
? Pilih middleware global yang ingin digunakan:
❯ ◉ Authentication
  ◉ Authorization
  ◉ Logging
  ◯ Rate Limiting
  ◯ CORS
  ◯ Body Parser
```

Middleware yang dipilih akan diimpor dan diterapkan ke semua route di router utama.

### Struktur File yang Dihasilkan

#### Arsitektur Modular

Untuk arsitektur modular, router utama akan memiliki struktur seperti ini:

```javascript
const express = require('express');
const router = express.Router();

// Global Middleware
const authMiddleware = require('../middleware/auth.middleware');
const loggingMiddleware = require('../middleware/logging.middleware');

// Import modular routers
const userRouter = require('../modules/user/routes/user.router.js');
const productRouter = require('../modules/product/routes/product.router.js');

// Apply global middleware
router.use(authMiddleware);
router.use(loggingMiddleware);

// Use modular routers
router.use('/user', userRouter);
router.use('/product', productRouter);

module.exports = router;
```

#### Arsitektur Simple

Untuk arsitektur simple, router utama akan memiliki struktur seperti ini:

```javascript
const express = require('express');
const router = express.Router();

// Global Middleware
const authMiddleware = require('../middleware/auth.middleware');
const loggingMiddleware = require('../middleware/logging.middleware');

// Routes for user
const userController = require('../modules/user/user.controller.js');

// Routes for product
const productController = require('../modules/product/product.controller.js');

// Apply global middleware
router.use(authMiddleware);
router.use(loggingMiddleware);

// User routes
router.get('/user', userController.getAll);
router.get('/user/:id', userController.getById);
router.post('/user', userController.create);
router.put('/user/:id', userController.update);
router.delete('/user/:id', userController.delete);

// Product routes
router.get('/product', productController.getAll);
router.get('/product/:id', productController.getById);
router.post('/product', productController.create);
router.put('/product/:id', productController.update);
router.delete('/product/:id', productController.delete);

module.exports = router;
```

### Contoh Penggunaan di app.js

Jika Anda memilih untuk membuat contoh penggunaan, file `app.js` akan diperbarui seperti ini:

```javascript
const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// Contoh penggunaan router
const routes = require('./routes');
app.use('/api', routes);

module.exports = app;
```

### Validasi dan Error Handling

Fitur ini memiliki sistem validasi yang kuat untuk memastikan bahwa semua file yang diperlukan ada sebelum melakukan integrasi:

1. **Validasi File Router/Controller**: Memastikan file router atau controller yang akan diimpor ada
2. **Validasi Struktur Modul**: Memastikan modul memiliki struktur yang sesuai dengan arsitektur yang dipilih
3. **Error Handling**: Menampilkan pesan error yang jelas jika terjadi masalah selama integrasi

### Best Practices

1. **Konsistensi Arsitektur**: Pastikan semua modul menggunakan arsitektur yang sama (modular atau simple)
2. **Penamaan File**: Gunakan konvensi penamaan yang konsisten untuk file router dan controller
3. **Middleware Global**: Pilih middleware yang benar-benar diperlukan untuk semua route
4. **Struktur Folder**: Pertahankan struktur folder yang konsisten untuk semua modul

---

## 🇬🇧 English

### Introduction

The **Main Router Integration** feature in **rakitin CLI** simplifies the process of integrating routers from modules that have been created into the application's main router. This feature automates a process that is usually done manually, saving time and reducing the possibility of errors.

### Key Features

- **Automatic Integration**: Detects all existing modules and integrates them automatically
- **Manual Integration**: Allows selecting specific modules to be integrated
- **Architecture Support**:
  - **Modular**: Each module has a separate router that is imported into the main router
  - **Simple**: All routes are defined directly in the main router by importing controllers
- **Router Location Options**: The main router can be created in the `app/routes` folder or in the project root folder
- **Global Middleware**: Supports the use of global middleware applied to all routes
- **Usage Example**: Automatically creates an example of router usage in the `app.js` file

### How to Use

#### 1. Running Router Integration

Run the rakitin CLI:

```bash
rakitin
```

Select **"Integrasi Router Utama"** from the menu:

```
🚀 Hai Sayang! Ini CLI rakitin-mu!
? Apa yang ingin Anda generate? (Use arrow keys)
❯ Module
  Middleware
  Util
  Config
  Integrasi Router Utama
```

#### 2. Choosing Integration Type

You will be asked to choose the integration type:

```
? Pilih jenis integrasi router:
❯ Otomatis (deteksi semua modul)
  Manual (pilih modul yang diinginkan)
```

- **Otomatis** (Automatic): Will detect and integrate all modules in the `app/modules` folder
- **Manual** (Manual): Allows you to select specific modules to be integrated

#### 3. Choosing Router Location

```
? Di mana router utama akan dibuat?
❯ Di folder app/routes
  Di folder root
```

- **Di folder app/routes**: The main router will be created at `{basePath}/routes/index.js`
- **Di folder root**: The main router will be created at `{cwd}/routes/index.js`

#### 4. Choosing Router Architecture

```
? Pilih arsitektur router:
❯ Modular (setiap modul memiliki router terpisah)
  Simple (semua route dalam satu file)
```

- **Modular**: Each module must have a separate router file that will be imported into the main router
- **Simple**: The main router will define all routes by importing controllers from each module

#### 5. Choosing Global Middleware (Optional)

```
? Apakah Anda ingin menggunakan middleware global? Yes
? Pilih middleware global yang ingin digunakan:
❯ ◉ Authentication
  ◉ Authorization
  ◉ Logging
  ◯ Rate Limiting
  ◯ CORS
  ◯ Body Parser
```

Selected middleware will be imported and applied to all routes in the main router.

### Generated File Structure

#### Modular Architecture

For modular architecture, the main router will have a structure like this:

```javascript
const express = require('express');
const router = express.Router();

// Global Middleware
const authMiddleware = require('../middleware/auth.middleware');
const loggingMiddleware = require('../middleware/logging.middleware');

// Import modular routers
const userRouter = require('../modules/user/routes/user.router.js');
const productRouter = require('../modules/product/routes/product.router.js');

// Apply global middleware
router.use(authMiddleware);
router.use(loggingMiddleware);

// Use modular routers
router.use('/user', userRouter);
router.use('/product', productRouter);

module.exports = router;
```

#### Simple Architecture

For simple architecture, the main router will have a structure like this:

```javascript
const express = require('express');
const router = express.Router();

// Global Middleware
const authMiddleware = require('../middleware/auth.middleware');
const loggingMiddleware = require('../middleware/logging.middleware');

// Routes for user
const userController = require('../modules/user/user.controller.js');

// Routes for product
const productController = require('../modules/product/product.controller.js');

// Apply global middleware
router.use(authMiddleware);
router.use(loggingMiddleware);

// User routes
router.get('/user', userController.getAll);
router.get('/user/:id', userController.getById);
router.post('/user', userController.create);
router.put('/user/:id', userController.update);
router.delete('/user/:id', userController.delete);

// Product routes
router.get('/product', productController.getAll);
router.get('/product/:id', productController.getById);
router.post('/product', productController.create);
router.put('/product/:id', productController.update);
router.delete('/product/:id', productController.delete);

module.exports = router;
```

### Usage Example in app.js

If you choose to create a usage example, the `app.js` file will be updated like this:

```javascript
const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// Contoh penggunaan router
const routes = require('./routes');
app.use('/api', routes);

module.exports = app;
```

### Validation and Error Handling

This feature has a strong validation system to ensure that all required files exist before performing integration:

1. **Router/Controller File Validation**: Ensures that the router or controller files to be imported exist
2. **Module Structure Validation**: Ensures modules have the appropriate structure for the selected architecture
3. **Error Handling**: Displays clear error messages if problems occur during integration

### Best Practices

1. **Architecture Consistency**: Ensure all modules use the same architecture (modular or simple)
2. **File Naming**: Use consistent naming conventions for router and controller files
3. **Global Middleware**: Choose middleware that is truly necessary for all routes
4. **Folder Structure**: Maintain a consistent folder structure for all modules