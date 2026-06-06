# 🤝 Cara Berkontribusi ke rakitin

Terima kasih atas minat Anda untuk berkontribusi pada proyek **rakitin**! Dokumen ini akan memandu Anda melalui proses kontribusi.

## 🇮🇩 Bahasa Indonesia

### Prasyarat

Sebelum berkontribusi, pastikan Anda telah memenuhi prasyarat berikut:

- Memahami dasar-dasar JavaScript/Node.js
- Familiar dengan Git dan GitHub workflow
- Memiliki Node.js (versi >=18) terinstal
- Memiliki npm terinstal

### Menyiapkan Lingkungan Pengembangan

1. **Fork repositori**
   - Kunjungi [https://github.com/Reinvy/rakitin](https://github.com/Reinvy/rakitin)
   - Klik tombol "Fork" di pojok kanan atas
   - Tunggu hingga proses forking selesai

2. **Clone fork Anda**
   ```bash
   git clone https://github.com/username/rakitin.git
   cd rakitin
   ```

3. **Tambahkan remote upstream**
   ```bash
   git remote add upstream https://github.com/Reinvy/rakitin.git
   ```

4. **Instal dependensi**
   ```bash
   npm install
   ```

### Proses Pengembangan

1. **Buat branch baru**
   ```bash
   git checkout -b nama-fitur-anda
   ```

2. **Lakukan perubahan**
   - Buat perubahan yang diperlukan
   - Pastikan kode mengikuti standar pengkodean yang dijelaskan di bawah
   - Uji perubahan Anda

3. **Commit perubahan**
   ```bash
   git add .
   git commit -m "Deskripsi singkat tentang perubahan Anda"
   ```

4. **Push ke branch Anda**
   ```bash
   git push origin nama-fitur-anda
   ```

5. **Buat Pull Request**
   - Kunjungi halaman fork Anda di GitHub
   - Klik "New pull request"
   - Isi deskripsi dengan detail tentang perubahan Anda
   - Tunggu review dan merge

### Standar Pengkodean

Untuk menjaga konsistensi kode, harap ikuti standar berikut:

1. **Penamaan Variabel dan Fungsi**
   - Gunakan `camelCase` untuk variabel dan fungsi
   - Gunakan `PascalCase` untuk class dan constructor
   - Gunakan `UPPER_CASE` untuk konstanta

2. **Struktur File**
   - Setiap file harus memiliki komentar deskriptif di bagian atas
   - Gunakan JSDoc untuk dokumentasi fungsi
   - Pisahkan logika ke dalam fungsi-fungsi kecil dan terukur

3. **Format Kode**
   - Gunakan 2 spasi untuk indentasi
   - Batasi panjang baris hingga 100 karakter
   - Tambahkan spasi setelah koma dan operator

4. **Komentar**
   - Gunakan bahasa Indonesia untuk komentar
   - Jelaskan "mengapa" bukan "apa"
   - Gunakan `//` untuk komentar satu baris
   - Gunakan `/* ... */` untuk komentar multi-baris

### Menambahkan Fitur Baru

Jika Anda ingin menambahkan fitur baru:

1. **Diskusikan terlebih dahulu**
   - Buka issue untuk mendiskusikan fitur yang ingin Anda tambahkan
   - Tunggu umpan balik dari maintainer

2. **Implementasikan fitur**
   - Ikuti arsitektur yang sudah ada
   - Tambahkan tes jika diperlukan
   - Perbarui dokumentasi

3. **Uji fitur**
   - Pastikan fitur berfungsi dengan baik
   - Uji dengan berbagai skenario jika memungkinkan

### Melaporkan Bug

Jika Anda menemukan bug:

1. **Cek issue yang ada**
   - Pastikan bug belum dilaporkan sebelumnya

2. **Buat issue baru**
   - Gunakan template bug report
   - Sertakan langkah-langkah untuk mereproduksi bug
   - Sertakan informasi lingkungan (Node.js version, OS, dll)

### Pull Request Guidelines

Saat membuat Pull Request:

1. **Gunakan template PR**
   - Isi semua bagian yang relevan

2. **Periksa checklist**
   - Pastikan semua item di checklist terpenuhi

3. **Tunggu review**
   - Respons terhadap komentar review
   - Lakukan perubahan jika diperlukan

## 🇬🇧 English

### Prerequisites

Before contributing, make sure you meet the following prerequisites:

- Understand basic JavaScript/Node.js
- Familiar with Git and GitHub workflow
- Have Node.js (version >=18) installed
- Have npm installed

### Setting Up Development Environment

1. **Fork the repository**
   - Visit [https://github.com/Reinvy/rakitin](https://github.com/Reinvy/rakitin)
   - Click the "Fork" button in the top right corner
   - Wait for the forking process to complete

2. **Clone your fork**
   ```bash
   git clone https://github.com/username/rakitin.git
   cd rakitin
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/Reinvy/rakitin.git
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

### Development Process

1. **Create a new branch**
   ```bash
   git checkout -b your-feature-name
   ```

2. **Make your changes**
   - Make the necessary changes
   - Ensure your code follows the coding standards outlined below
   - Test your changes

3. **Commit your changes**
   ```bash
   git add .
   git commit -m "Brief description of your changes"
   ```

4. **Push to your branch**
   ```bash
   git push origin your-feature-name
   ```

5. **Create a Pull Request**
   - Visit your fork page on GitHub
   - Click "New pull request"
   - Fill in the description with details about your changes
   - Wait for review and merge

### Coding Standards

To maintain code consistency, please follow the following standards:

1. **Variable and Function Naming**
   - Use `camelCase` for variables and functions
   - Use `PascalCase` for classes and constructors
   - Use `UPPER_CASE` for constants

2. **File Structure**
   - Each file should have a descriptive comment at the top
   - Use JSDoc for function documentation
   - Separate logic into small, measurable functions

3. **Code Formatting**
   - Use 2 spaces for indentation
   - Limit line length to 100 characters
   - Add spaces after commas and operators

4. **Comments**
   - Use Indonesian for comments
   - Explain "why" not "what"
   - Use `//` for single-line comments
   - Use `/* ... */` for multi-line comments

### Adding New Features

If you want to add a new feature:

1. **Discuss first**
   - Open an issue to discuss the feature you want to add
   - Wait for feedback from maintainers

2. **Implement the feature**
   - Follow the existing architecture
   - Add tests if necessary
   - Update documentation

3. **Test the feature**
   - Make sure the feature works well
   - Test with various scenarios if possible

### Reporting Bugs

If you find a bug:

1. **Check existing issues**
   - Make sure the bug hasn't been reported before

2. **Create a new issue**
   - Use the bug report template
   - Include steps to reproduce the bug
   - Include environment information (Node.js version, OS, etc.)

### Pull Request Guidelines

When creating a Pull Request:

1. **Use the PR template**
   - Fill in all relevant sections

2. **Check the checklist**
   - Make sure all items in the checklist are fulfilled

3. **Wait for review**
   - Respond to review comments
   - Make changes if necessary

## Code of Conduct

Please note that this project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project, you agree to abide by its terms.

## Questions?

If you have any questions about contributing, feel free to:

- Open an issue with the "question" label
- Contact the maintainers directly

Thank you for your contribution to **rakitin**!