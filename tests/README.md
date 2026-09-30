# Pengujian rakitin

Dokumentasi untuk pengujian otomatis proyek rakitin. Semua suite bersifat
**hermetik**: tidak menyentuh repository, tidak memanggil jaringan, dan tidak
pernah menjalankan child process nyata kecuali suite yang secara eksplisit
memintanya.

## Struktur Pengujian

```
tests/
├── setup.js                    # Harness global: temp dir per suite, guard integritas repo,
│                               #   blokir child_process, stub installer
├── README.md                   # dokumen ini
├── unit/                       # fungsi murni (naming, config, logger, template, progress, utils)
├── lib/                        # layer lib: commands, config-command, constants, installer, plugins
│   └── generator/              # generator: arch, orm, module, api-generators, graphql,
│                               #   websocket, testfile
├── integration/                # alur multi-perintah (end-to-end, directory-structure)
├── regression/                 # guard bug historis + public API surface
├── e2e/real-project.test.js    # spawn CLI nyata di proyek sementara
├── scripts/test-real-project.js# smoke E2E standalone (npm run test:real-project)
└── fixtures/                   # plugin demo, dsb.
```

`__mocks__/child_process.js` di root repository adalah manual mock untuk modul
inti `child_process`.

## Menjalankan Pengujian

```bash
npm test                  # seluruh suite (harus hijau DAN meninggalkan tree bersih)
npm run test:watch        # watch mode
npm run test:coverage     # dengan coverage
npm run test:ci           # jest --ci --coverage --watchAll=false
npm run test:unit         # tests/unit
npm run test:integration  # tests/integration
npm run test:e2e          # tests/e2e
npm run test:real-project # smoke E2E standalone (spawn CLI nyata)
```

## Model Hermetik

### 1. Temp dir per suite (`global.tempDir`)

`tests/setup.js` berjalan sekali per file test dan membuat direktori privat:

```js
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rakitin-test-"));
global.tempDir = tempDir;
process.cwd = () => tempDir;   // plain function, dikembalikan di afterAll
```

`process.cwd` **sengaja bukan `jest.fn`**: `jest.config.js` memakai
`clearMocks: true` yang menghapus call history (dan bisa menghapus
implementasi mock), sehingga `cwd` bisa mengembalikan `undefined` di tengah
suite. Fungsi biasa kebal terhadap hal itu.

`afterEach` mengosongkan isi temp dir, `jest.clearAllMocks()`, mereset instance
Logger (`Logger.clearInstances()`) dan plan safety (`safety.resetPlan()`);
`afterAll` menghapus direktori temp.

### 2. Guard integritas repository

`package.json` dan `package-lock.json` di-hash (sha256) di `beforeAll` dan
di-hash ulang di `afterAll`. Bila berubah, suite gagal dengan:

```
[hermetic] test run memodifikasi package.json
```

Artinya `npm test` **wajib** meninggalkan `git status --porcelain` kosong —
tidak ada instalasi nyata, tidak ada penulisan ke repository.

### 3. Child process diblokir

`tests/setup.js` memanggil `jest.mock("child_process")`, dan
`__mocks__/child_process.js` melempar untuk `exec`, `execSync`, `spawn`, dan
`spawnSync` kecuali suite mengaktifkan:

```js
global.__RAKITIN_REAL_CHILD_PROCESS__ = true;   // sebelum require apa pun
```

Suite E2E (`tests/e2e/real-project.test.js`) memakai flag ini karena memang
harus meng-spawn binary CLI. Seam lain untuk di-stub adalah
`installer.internals.execCommand` / `installer.internals.spawn`, yang sudah
di-stub otomatis di `beforeEach`:

```js
installer.internals.execCommand = jest.fn()
  .mockResolvedValue({ success: true, stdout: "", stderr: "", code: 0 });
installer.internals.isPackageInstalled = jest.fn().mockReturnValue(true);
```

### 4. Setiap pemanggilan CLI memakai `--no-install`

Semua suite dan skrip E2E menjalankan CLI di direktori sementara
(`os.tmpdir()`, bukan `tests/project/`) dan **selalu** menyertakan
`--no-install`, sehingga suite sepenuhnya offline dan tidak menyentuh
`node_modules`.

## Jenis Pengujian

### Unit (`tests/unit/`)
Fungsi murni: konversi nama + sanitizer (`naming`), loader config, logger,
engine EJS, progress UI, utils.

### Layer lib (`tests/lib/`)
Command layer dan primitifnya dengan fs nyata di `global.tempDir`:
`commands`, `config-command`, `constants`, `installer` (seam di-stub),
`plugins` (fixture `tests/fixtures/plugins/demo-plugin.js`), dan
`generator/*` (arch, orm, module, api-generators, graphql, websocket,
testfile).

### Integrasi (`tests/integration/`)
Alur multi-perintah dan struktur direktori yang dihasilkan.

### Regression (`tests/regression/`)
Guard bug historis (`p0-bugfixes`, `core-redesign`, `recipes`,
`auth-recipe-detail`) dan `public-api` yang memastikan nama export runtime
setiap `exports` subpath sama dengan daftar yang diharapkan dan muncul di
`types/index.d.ts`.

### E2E (`tests/e2e/`, `tests/scripts/test-real-project.js`)
Menjalankan binary CLI nyata di proyek sementara. Aturan lengkap:
[docs/real-project-testing-rules.md](../docs/real-project-testing-rules.md).

## Aturan Menulis Test

1. **Jangan mock fs.** Gunakan fs nyata di `global.tempDir` dan periksa state
   disk (`fs.existsSync`, baca ulang isi file). Mock fs menyembunyikan bug
   lazy-path.
2. **Validasi JS hasil generate dengan compile**, bukan eksekusi:
   `expect(() => new vm.Script(src)).not.toThrow()` atau `node --check`.
3. **Assert perilaku, bukan teks.** Test permanen harus menangkap bug yang
   terlihat konsumen (perilaku, batas, invarian, transisi, precedence, error) —
   bukan kalimat pesan, default insidental, atau `typeof`.
4. **Uji alur prompt secara headless**: panggil core function atau
   `addCommand(thing, name, ctx)` dengan konteks lengkap (`yes: true`), jangan
   script stdin/inquirer.
5. **Selalu `await`** promise installer/manifest; fire-and-forget adalah bug
   historis yang membuat import menggantung.
6. **Bersihkan yang kamu ubah**: simpan & kembalikan `installer.internals`
   atau state global lain di `afterAll` suite kamu.

## Coverage

`collectCoverageFrom` mencakup `lib/**` dan `bin/**` (kecuali
`lib/templates/**`). Laporan ada di `coverage/` setelah
`npm run test:coverage`.

## CI/CD

`.github/workflows/ci.yml`:

- **Matrix Node 22.x / 24.x** → `npm run test:ci`.
- **Tree-dirty gate**: setelah suite, `git diff --exit-code` harus bersih —
  suite tidak boleh mengubah repository.
- **Stdout purity**: perintah `--json` diuji dengan `jq -e .` sehingga stdout
  hanya berisi satu objek JSON.
- Job **lint** (ESLint flat config, termasuk `no-console` untuk `lib/**`),
  **typecheck** (`tsc --noEmit`, tanpa `skipLibCheck`), dan **smoke** (CLI
  headless di direktori sementara + bukti dry-run tidak menyentuh disk).
