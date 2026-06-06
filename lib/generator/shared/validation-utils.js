/**
 * Utilitas untuk validasi input dan penanganan error
 */

/**
 * Memvalidasi nama modul
 * @param {string} moduleName - Nama modul yang akan divalidasi
 * @returns {Object} - { isValid: boolean, message: string }
 */
function validateModuleName(moduleName) {
  if (!moduleName) {
    return {
      isValid: false,
      message: "Nama modul tidak boleh kosong"
    };
  }
  
  if (typeof moduleName !== 'string') {
    return {
      isValid: false,
      message: "Nama modul harus berupa string"
    };
  }
  
  if (moduleName.trim() === '') {
    return {
      isValid: false,
      message: "Nama modul tidak boleh hanya berisi spasi"
    };
  }
  
  // Cek karakter khusus yang tidak diizinkan
  const invalidChars = /[\\/:*?"<>|]/;
  if (invalidChars.test(moduleName)) {
    return {
      isValid: false,
      message: "Nama modul mengandung karakter yang tidak diizinkan: \\ / : * ? \" < > |"
    };
  }
  
  // Cek apakah dimulai dengan angka atau karakter khusus
  if (/^[0-9_-]/.test(moduleName)) {
    return {
      isValid: false,
      message: "Nama modul tidak boleh dimulai dengan angka atau karakter khusus"
    };
  }
  
  return {
    isValid: true,
    message: "Nama modul valid"
  };
}

/**
 * Memvalidasi pilihan ORM
 * @param {string} orm - Jenis ORM yang akan divalidasi
 * @returns {Object} - { isValid: boolean, message: string }
 */
function validateOrm(orm) {
  const validOrms = ["Prisma", "Sequelize", "TypeORM", "Mongoose", "None"];
  
  if (!orm) {
    return {
      isValid: false,
      message: "ORM tidak boleh kosong"
    };
  }
  
  if (typeof orm !== 'string') {
    return {
      isValid: false,
      message: "ORM harus berupa string"
    };
  }
  
  if (!validOrms.includes(orm)) {
    return {
      isValid: false,
      message: `ORM tidak valid. Pilihan yang tersedia: ${validOrms.join(", ")}`
    };
  }
  
  return {
    isValid: true,
    message: "ORM valid"
  };
}

/**
 * Memvalidasi pilihan arsitektur
 * @param {string} architecture - Jenis arsitektur yang akan divalidasi
 * @returns {Object} - { isValid: boolean, message: string }
 */
function validateArchitecture(architecture) {
  const validArchitectures = ["Simple", "Modular"];
  
  if (!architecture) {
    return {
      isValid: false,
      message: "Arsitektur tidak boleh kosong"
    };
  }
  
  if (typeof architecture !== 'string') {
    return {
      isValid: false,
      message: "Arsitektur harus berupa string"
    };
  }
  
  if (!validArchitectures.includes(architecture)) {
    return {
      isValid: false,
      message: `Arsitektur tidak valid. Pilihan yang tersedia: ${validArchitectures.join(", ")}`
    };
  }
  
  return {
    isValid: true,
    message: "Arsitektur valid"
  };
}

/**
 * Error handler yang konsisten untuk kesalahan validasi
 * @param {string} context - Konteks di mana error terjadi
 * @param {Error} error - Objek error
 * @throws {Error} - Error dengan pesan yang telah diformat
 */
function handleError(context, error) {
  console.error(`❌ Kesalahan di ${context}: ${error.message}`);
  
  // Jika error sudah memiliki format yang baik, lemparkan kembali
  if (error.message.includes("tidak") || error.message.includes("gagal")) {
    throw error;
  }
  
  // Format error dengan pesan yang lebih jelas
  const formattedError = new Error(`Gagal ${context}: ${error.message}`);
  throw formattedError;
}

/**
 * Membuat pesan error yang konsisten dalam bahasa Indonesia
 * @param {string} type - Jenis error (validation, system, etc)
 * @param {string} details - Detail error
 * @returns {string} - Pesan error yang telah diformat
 */
function createErrorMessage(type, details) {
  const errorTemplates = {
    validation: `Validasi gagal: ${details}`,
    system: `Kesalahan sistem: ${details}`,
    notFound: `${details} tidak ditemukan`,
    notSupported: `${details} tidak didukung`,
    permission: `Tidak memiliki izin untuk ${details.toLowerCase()}`
  };
  
  return errorTemplates[type] || `Kesalahan: ${details}`;
}

module.exports = {
  validateModuleName,
  validateOrm,
  validateArchitecture,
  handleError,
  createErrorMessage
};