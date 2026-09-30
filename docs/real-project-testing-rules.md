# Aturan & Standar Pengujian `rakitin` pada Real Project

Dokumen ini adalah panduan otoritatif bagi *developer* dan *AI coding agents*
untuk menguji CLI `rakitin` seperti pengguna nyata — menjalankan binary CLI di
proyek nyata, bukan memanggil fungsi internal.

Sejak v3 model pengujian real-project **hermetik**: setiap skenario berjalan di
direktori sementara (`os.tmpdir()`) yang baru dibuat, selalu memakai
`--no-install`, dan **tidak pernah** menulis apa pun di dalam repository.

---

## 1. Filosofi & Tujuan

Pengujian real-project memastikan CLI bekerja dari sudut pandang pengguna
terminal: parsing flag, kode keluar, file yang dihasilkan di disk, dan
kontrak JSON. Yang **tidak** boleh terjadi: mengotori repository, memanggil
jaringan, atau bergantung pada state proyek sebelumnya.

### 6 Aturan Emas

1. **Direktori sementara per skenario.** Gunakan
   `fs.mkdtempSync(path.join(os.tmpdir(), "rakitin-e2e-"))` dan seed
   `package.json` minimal. Jangan pernah menulis di dalam repository —
   guard integritas `tests/setup.js` akan menggagalkan suite bila
   `package.json`/`package-lock.json` repo berubah.
2. **Selalu `--no-install`.** Setiap pemanggilan CLI wajib menyertakan
   `--no-install` agar suite sepenuhnya offline dan tidak menyentuh
   `node_modules`.
3. **Jalankan binary asli.** Panggil `bin/rakitin.js` lewat `spawnSync`
   (atau `node bin/rakitin.js` dari shell). Jangan panggil `addCommand()`
   langsung — itu tugas suite unit/integrasi, bukan real-project.
4. **Verifikasi kontrak, bukan sekadar exit code.** Parse satu objek JSON di
   stdout dan periksa `ok`/`created`/`skipped`/`nextSteps` (plus `plan` saat
   `--dry-run`).
5. **Verifikasi file hasil.** Setiap `.js` yang dihasilkan harus lulus
   `node --check <file>` (bukan `require()` — file hasil bisa punya require
   ke modul proyek yang belum ada).
6. **Teardown bersih.** Hapus direktori sementara di akhir skenario; jangan
   menyisakan artefak.

---

## 2. Alur Kerja

```bash
# 1. Suite real-project mandiri (mencetak ringkasan PASS/FAIL, exit != 0 bila gagal)
npm run test:real-project

# 2. Suite E2E berbasis Jest (opt-in child process nyata)
npm run test:e2e

# 3. Semua suite
npm test
```

`npm run test:real-project` menjalankan
[`tests/scripts/test-real-project.js`](../tests/scripts/test-real-project.js):
ia meng-spawn CLI di direktori sementara, selalu `--no-install`, mem-parse
envelope JSON, dan keluar non-zero bila ada skenario yang gagal.

`npm run test:e2e` menjalankan
[`tests/e2e/real-project.test.js`](../tests/e2e/real-project.test.js) dengan
`global.__RAKITIN_REAL_CHILD_PROCESS__ = true` (mock `child_process` di
`tests/setup.js` hanya mengizinkan spawn nyata bila flag ini diset).

Tidak perlu `npm link`: kedua suite memakai path absolut ke
`bin/rakitin.js` di repository.

---

## 3. Struktur Fixture

```js
const os = require("os");
const fs = require("fs");
const path = require("path");

function makeProject(seed = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rakitin-e2e-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    `${JSON.stringify({ name: "e2e-app", version: "1.0.0", ...seed }, null, 2)}\n`,
    "utf8"
  );
  return dir;
}
```

Seed tambahan bila skenario butuh: `express` (untuk boot smoke), ORM tertentu
(untuk deteksi preset), `app.js` (untuk `recipe docker`).

---

## 4. Matriks Perintah yang Diuji

Semua contoh headless (tanpa prompt). Flag interaktif lama sudah tidak ada.

| Kategori | Perintah CLI | Validasi |
|---|---|---|
| Versi | `rakitin --cli-version [--json]` | mencetak versi `package.json`, exit 0 |
| Ringkasan | `rakitin` (bare) | ringkasan + next steps, exit 0, tanpa prompt |
| Init | `rakitin init [--preset basic\|intermediate\|advanced] [--orm …] [--force]` | `.rakitinrc.json` v3 (`version: 3`), idempoten |
| Module (modular) | `rakitin add module user --arch modular --orm none --yes --no-install` | `app/modules/user/{controllers,services,routes}/user.*` |
| Module (simple) | `rakitin add module product --arch simple --orm none --yes --no-install` | `app/modules/product/product.{controller,router,service}.js` |
| Module (ORM) | `rakitin add module item --arch modular --orm mongoose\|prisma\|sequelize\|typeorm --no-install --yes` | file model/entity/schema ORM + singleton koneksi |
| Module (template) | `rakitin add module m --arch simple --orm none --template readonly\|graphql\|realtime` | verb terbatas / artefak GraphQL / handler WS |
| Middleware | `rakitin add middleware <custom\|auth\|logger\|error\|request-time> [--custom-name x]` | `app/shared/middlewares/<kebab>.middleware.js` |
| Config | `rakitin add config <app\|jwt\|database\|cors\|…>` | `app/shared/config/<kind>.config.js` + blok `.env.example` |
| Util | `rakitin add util uuid` (bukan lagi piped menu) | `app/shared/utils/uuid.util.js` |
| Endpoint | `rakitin add endpoint user --resource items --fields title:string,price:number` | `app/modules/user/resources/*` + mount di region `// rakitin:resources:` |
| Validation | `rakitin add validation profile --fields name:string:true` / `add validation common` | `app/shared/validators/*.validator.js` |
| Documentation | `rakitin add docs openapi-json\|openapi-yaml\|swagger-ui\|complete` | `app/docs/openapi.json\|openapi.yaml\|swagger-ui.js` |
| GraphQL | `rakitin add graphql --module user` | `app/graphql/**` + region `# rakitin:graphql:` |
| WebSocket | `rakitin add websocket --module user [--path /ws]` | `app/ws/**` + handler + region `// rakitin:ws:` |
| Test files | `rakitin add test --all` | `tests/modules/<kebab>.test.js` |
| Recipe Auth | `rakitin recipe auth --arch modular --orm none` | middleware auth + modul user + validator + env `# AUTH RECIPE` |
| Recipe Swagger | `rakitin recipe swagger` | `app/shared/config/swagger.config.js` + `app/docs/index.js` |
| Recipe Test | `rakitin recipe test` | `jest.config.js` + `tests/setup.js` + spec per modul + script `test` |
| Recipe Docker | `rakitin recipe docker` (butuh entrypoint: `app.js`/`bin/www`/`index.js`/`app/server.js`) | `Dockerfile` + `.dockerignore`; tanpa entrypoint ⇒ exit 1 |
| Integrate | `rakitin integrate [--middleware auth,logger]` | region marker, `app/routes/index.js`, `.bak` saat replace |
| Plugin | `rakitin plugin list\|add\|remove\|info` | `.rakitinrc.json#plugins`, `data.errors[]` |
| Diagnostics | `rakitin info\|doctor\|list [--json]` | envelope `{ok, …}`, `doctor` checks/summary |
| Dry-run | semua di atas + `--dry-run` | `find . -type f \| md5sum` tidak berubah, tidak ada `node_modules` |

---

## 5. Pemeriksaan Integritas Hasil

```bash
# Sintaks setiap file JS yang dihasilkan (compile-only, jangan require)
find app tests -name "*.js" -exec node --check {} +

# Envelope JSON harus parse dan sesuai kontrak
node bin/rakitin.js add module user --arch modular --orm none --yes --no-install --json \
  | jq -e '(.ok == true) and (.created | type == "array") and (.created | length > 0)'

# Dry-run tidak boleh menyentuh disk
BEFORE=$(find . -type f | sort | md5sum)
node bin/rakitin.js add module x --arch modular --orm mongoose --yes --dry-run --json \
  | jq -e '.plan[].op | IN("create","overwrite","mkdir","install")'
[ "$BEFORE" = "$(find . -type f | sort | md5sum)" ] || { echo "dry-run bocor"; exit 1; }
test ! -d node_modules || { echo "dry-run memasang paket"; exit 1; }

# Integrasi idempoten (dua run berturut-turut byte-identical)
node bin/rakitin.js integrate --json >/dev/null; cp app/routes/index.js /tmp/g1
node bin/rakitin.js integrate --json >/dev/null
diff -q /tmp/g1 app/routes/index.js && echo IDENTICAL
```

---

## 6. Boot Smoke (opsional, butuh `express` terpasang)

```bash
node -e "require('./app/routes')"        # router harus load tanpa error
```

Bila skenario ingin menguji HTTP nyata, install `express` di direktori
sementara (jaringan) lalu jalankan `app.listen(0)` — jangan pernah mengandalkan
`node_modules` repository untuk ini, dan jangan menambahkan skenario jaringan
ke suite default.
