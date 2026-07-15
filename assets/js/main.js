// ========================================================
// 1. CONFIG & INITIALIZATION FIREBASE (CLOUD FIRESTORE)
// ========================================================
// GANTI BAGIAN INI DENGAN CONFIG DARI FIREBASE CONSOLE ANDA
 const firebaseConfig = {
    apiKey: "AIzaSyAGoWJ5UfF1lyQAhEiR06f6Qm_uDc_Xo0w",
    authDomain: "lap-bsc.firebaseapp.com",
    projectId: "lap-bsc",
    storageBucket: "lap-bsc.firebasestorage.app",
    messagingSenderId: "1075222206362",
    appId: "1:1075222206362:web:acb8cb5839cd58560b8c23",
    measurementId: "G-3NWWX99KPP"
  };

// Inisialisasi Firebase (Pastikan script CDN Firebase di HTML sudah terpasang)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let currentUser = null;
let formRef = null;

// ========================================================
// 2. SISTEM LOGIN & LOGOUT (Versi 2 File / Redirect URL)
// ========================================================
// Mengawasi Perubahan Status User
auth.onAuthStateChanged((user) => {
  // Mengecek apakah URL saat ini adalah halaman dashboard
  const isDashboardPage = window.location.pathname.includes("dashboard.html");
  const namaUser = document.getElementById("namaUser");

  if (user) {
    currentUser = user;
    // Menggunakan Cloud Firestore: Koleksi "evaluasi_kinerja", Dokumen = UID User
    formRef = db.collection("evaluasi_kinerja").doc(user.uid);
    console.log("User terhubung:", user.email);
    
    // Tampilkan nama user (menghilangkan @gmail.com)
    if (namaUser) {
        namaUser.innerText = user.email.replace("@gmail.com", "");
    }

    if (isDashboardPage) {
        // Jika sudah di dashboard, tarik data otomatis dari database
        muatDataDariFirebase();
    } else {
        // Jika user buka index.html tapi SUDAH login, langsung lempar ke dashboard
        window.location.href = "dashboard.html";
    }

  } else {
    currentUser = null;
    formRef = null;
    
    if (isDashboardPage) {
        // Jika user buka dashboard.html tapi BELUM login, langsung lempar ke index.html
        window.location.href = "index.html";
    }
  }
});

function aksiLogin() {
  // 1. Ambil nilai input
  const username = document.getElementById("inputEmail").value;
  const password = document.getElementById("inputPassword").value;

  if (!username || !password) {
    alert("Harap isi Username dan Password!");
    return;
  }
  
  // 2. TRIK: Gabungkan username dengan domain palsu
  const dummyEmail = username + "@gmail.com"; 
  
  // 3. Gunakan dummyEmail untuk proses login ke Firebase
  auth.signInWithEmailAndPassword(dummyEmail, password)
    .then((userCredential) => {
      // Alert sukses dimodifikasi agar menampilkan username
      alert("Berhasil masuk sebagai " + username);
      // Pindah halaman otomatis di-handle oleh onAuthStateChanged di atas
    })
    .catch((error) => {
      alert("Login Gagal: " + error.message);
    });
}

function logoutUser() {
  const konfirmasi = confirm("Apakah Anda yakin ingin keluar?");
  if (konfirmasi) {
    auth.signOut().then(() => {
        // Pindah halaman ke index otomatis di-handle oleh onAuthStateChanged
    });
  }
}

// ========================================================
// 3. FUNGSI PENYIMPANAN CLOUD FIRESTORE
// ========================================================
function simpanKeFirebase(namaPoin, nilaiRealisasi, nilaiTarget, skorAkhir) {
  if (!currentUser || !formRef) return; 

  let dataObjek = {};
  dataObjek[`real_${namaPoin}`] = nilaiRealisasi;
  if (nilaiTarget !== null) {
    dataObjek[`target_${namaPoin}`] = nilaiTarget;
  }
  dataObjek[`skor_${namaPoin}`] = skorAkhir;

  // { merge: true } mencegah data lain tertimpa/hilang saat mengupdate 1 poin
  formRef.set(dataObjek, { merge: true }).catch((err) => {
    console.error("Gagal menyimpan ke Firestore:", err);
  });
}

// ========================================================
// 3b. FUNGSI PEMUATAN CLOUD FIRESTORE
// ========================================================
function muatDataDariFirebase() {
  if (!formRef) return;

  formRef.get().then((doc) => {
    if (doc.exists) {
      const data = doc.data();
      let daftarPoinUnik = new Set(); // Menyimpan daftar poin yang perlu dihitung ulang

      // 1. Masukkan nilai ke dalam form input/select
      for (const [key, value] of Object.entries(data)) {
        let elemen = document.getElementById(key);
        
        // Jaga-jaga: Jika form berupa dropdown (select) tapi tersimpan sbg 'real_'
        if (!elemen && key.startsWith("real_")) {
          const poinMurni = key.replace("real_", "");
          elemen = document.getElementById(`select_${poinMurni}`);
        }

        // Tanamkan nilainya ke kotak input
        if (elemen && (elemen.tagName === "INPUT" || elemen.tagName === "SELECT")) {
          elemen.value = value; 
        }

        // 2. Kumpulkan kode poin untuk dihitung ulang (Contoh: "real_111_A" -> "111_A")
        let namaPoin = "";
        if (key.startsWith("real_")) namaPoin = key.replace("real_", "");
        else if (key.startsWith("target_")) namaPoin = key.replace("target_", "");
        else if (key.startsWith("select_")) namaPoin = key.replace("select_", "");
        
        // Masukkan ke daftar jika valid dan bukan merupakan '_Total'
        if (namaPoin && !namaPoin.includes("_Total")) {
          daftarPoinUnik.add(namaPoin);
        }
      }

      // 3. JALANKAN ULANG SEMUA RUMUS BERDASARKAN INPUT YANG BARU MASUK
      // Ini bertindak seolah-olah user baru saja mengetik ulang angkanya secara kilat,
      // sehingga semua subTotal, Total 1.1.1, dan Grand Total dijamin muncul.
      daftarPoinUnik.forEach(poin => {
        if (typeof hitungSkorOtomatis === 'function') {
          hitungSkorOtomatis(poin);
        }
      });

      // 4. Hitung ulang total utama (pengaman tambahan agar semua sinkron)
      if (typeof hitungTotalPoin11 === 'function') hitungTotalPoin11();
      if (typeof hitungTotalPoin21 === 'function') hitungTotalPoin21();
      if (typeof hitungTotalPoin31 === 'function') hitungTotalPoin31();
      if (typeof hitungTotalPoin41 === 'function') hitungTotalPoin41();
      if (typeof hitungGrandTotal === 'function') hitungGrandTotal();

    }
  }).catch((error) => {
    console.error("Gagal memuat data dari Firebase: ", error);
  });
}

// ========================================================
// 4. FUNGSI KALKULASI & PENJUMLAHAN
// ========================================================
function ambilAngkaSaja(idElement) {
  const el = document.getElementById(idElement);
  if (!el) return 0;
  
  let teks = el.textContent.trim().replace(',', '.');
  if (teks.includes(':')) {
    teks = teks.split(':').pop().trim();
  }
  
  return parseFloat(teks) || 0;
}

function hitungSkorOtomatis(namaPoin) {
  const elSkor = document.getElementById(`skor_${namaPoin}`);
  const elSubTotal = document.getElementById(`subTotal_${namaPoin}`);

  if (!elSkor) return;

  const elSelect = document.getElementById(`select_${namaPoin}`);
  if (elSelect) {
    const skorPilihan = parseFloat(elSelect.value.toString().replace(',', '.')) || 0;
    elSkor.innerText = skorPilihan.toFixed(2);
    if (elSubTotal) elSubTotal.innerText = skorPilihan.toFixed(2);
    
    cekDanHitungTotalKelompok(namaPoin);
    // OTOMATIS SIMPAN DATA KE FIREBASE
    simpanKeFirebase(namaPoin, skorPilihan, null, skorPilihan);
    return; 
  }

  const elReal = document.getElementById(`real_${namaPoin}`);
  if (!elReal) return; 
  
  // PENGAMAN KOSONG
  if (elReal.value.trim() === "") {
    elSkor.innerText = "Salah";
    if (elSubTotal) elSubTotal.innerText = "Salah";
    cekDanHitungTotalKelompok(namaPoin);
    simpanKeFirebase(namaPoin, "", null, 0); 
    return;
  }

  const elTarget = document.getElementById(`target_${namaPoin}`); 
  const realisasi = parseFloat(elReal.value.replace(',', '.')) || 0;
  
  let rasio = 0;

  if (elTarget) {
    const target = parseFloat(elTarget.value.replace(',', '.')) || 0;
    if (target === 0) {
      elSkor.innerText = "0.00";
      if (elSubTotal) elSubTotal.innerText = "0.00";
      cekDanHitungTotalKelompok(namaPoin);
      simpanKeFirebase(namaPoin, realisasi, target, 0);
      return;
    }
    rasio = realisasi / target;
  } else {
    rasio = realisasi;
  }

  if (namaPoin === "212_K" || namaPoin === "212K") {
    rasio = rasio * 1000;
  }
  
  let skorFinal = null; 
  const daftarAturan = aturanPenilaian[namaPoin].kondisiSkor;

  for (let i = 0; i < daftarAturan.length; i++) {
    if (rasio <= daftarAturan[i].batas) {
       skorFinal = daftarAturan[i].nilai;
       break;
    }
  }

  if (skorFinal === null) {
    elSkor.innerText = "Salah";
    if (elSubTotal) elSubTotal.innerText = "Salah";
    skorFinal = 0; 
  } else {
    elSkor.innerText = skorFinal.toFixed(2);
    if (elSubTotal) elSubTotal.innerText = skorFinal.toFixed(2);
  }

  cekDanHitungTotalKelompok(namaPoin);
  
  // OTOMATIS SIMPAN DATA KE FIREBASE
  const nilaiTarget = elTarget ? parseFloat(elTarget.value.replace(',', '.')) || 0 : null;
  simpanKeFirebase(namaPoin, realisasi, nilaiTarget, skorFinal);
}

function cekDanHitungTotalKelompok(namaPoin) {
  if (namaPoin.includes("111_H")) hitungTotalPoinH();
  else if (namaPoin.includes("111_J")) hitungTotalPoinJ();
  else if (namaPoin.includes("314_A")) hitungTotalPoin314A();

  if (namaPoin.startsWith("111_")) { hitungTotalPoin111(); hitungTotalPoin11(); }
  else if (namaPoin.startsWith("211_")) { hitungTotalPoin211(); hitungTotalPoin21(); }
  else if (namaPoin.startsWith("212_")) { hitungTotalPoin212(); hitungTotalPoin21(); }
  else if (namaPoin.startsWith("311_")) { hitungTotalPoin311(); hitungTotalPoin31(); }
  else if (namaPoin.startsWith("312_")) { hitungTotalPoin312(); hitungTotalPoin31(); }
  else if (namaPoin.startsWith("313_")) { hitungTotalPoin313(); hitungTotalPoin31(); }
  else if (namaPoin.startsWith("314_")) { hitungTotalPoin314(); hitungTotalPoin31(); }
  else if (namaPoin.startsWith("315_")) { hitungTotalPoin315(); hitungTotalPoin31(); }
  else if (namaPoin.startsWith("411_")) { hitungTotalPoin411(); hitungTotalPoin41(); }
  else if (namaPoin.startsWith("412_")) { hitungTotalPoin412(); hitungTotalPoin41(); }
  else if (namaPoin.startsWith("413_")) { hitungTotalPoin413(); hitungTotalPoin41(); }
  else if (namaPoin.startsWith("414_")) { 
    if (typeof hitungTotalPoin414 === "function") hitungTotalPoin414();
    hitungTotalPoin41(); 
  }
  hitungGrandTotal(); 
}

// ========================================================
// 5. TOTAL LEVEL 3
// ========================================================
function hitungTotalPoinH() {
  const totalH = ambilAngkaSaja('skor_111_H1') + ambilAngkaSaja('skor_111_H2') + ambilAngkaSaja('skor_111_H3');
  const elTotalH = document.getElementById('skor_111_H_Total');
  if (elTotalH) elTotalH.innerText = totalH.toFixed(2);
}

function hitungTotalPoinJ() {
  const totalJ = ambilAngkaSaja('skor_111_J1') + ambilAngkaSaja('skor_111_J2') + 
                 ambilAngkaSaja('skor_111_J3') + ambilAngkaSaja('skor_111_J4') + 
                 ambilAngkaSaja('skor_111_J5') + ambilAngkaSaja('skor_111_J6') + ambilAngkaSaja('skor_111_J7');
  const elTotalJ = document.getElementById('skor_111_J_Total');
  if (elTotalJ) elTotalJ.innerText = totalJ.toFixed(2);
}

function hitungTotalPoin314A() {
  const totalA = ambilAngkaSaja('skor_314_A1') + ambilAngkaSaja('skor_314_A2') + 
                 ambilAngkaSaja('skor_314_A3') + ambilAngkaSaja('skor_314_A4');
  const elTotalA = document.getElementById('skor_314_A_Total');
  if (elTotalA) elTotalA.innerText = totalA.toFixed(2);
}

function hitungTotalPoin111() {
  const total = ambilAngkaSaja('subTotal_111_A') + ambilAngkaSaja('subTotal_111_B') + 
                ambilAngkaSaja('subTotal_111_C') + ambilAngkaSaja('subTotal_111_D') + 
                ambilAngkaSaja('subTotal_111_E') + ambilAngkaSaja('subTotal_111_F') + 
                ambilAngkaSaja('subTotal_111_G') + ambilAngkaSaja('skor_111_H_Total') + 
                ambilAngkaSaja('subTotal_111_I') + ambilAngkaSaja('skor_111_J_Total') + ambilAngkaSaja('subTotal_111_K');
  const el = document.getElementById('skor_111_Total');
  if (el) el.innerText = total.toFixed(2);
}

function hitungTotalPoin211() {
  const total = ambilAngkaSaja('subTotal_211_A') + ambilAngkaSaja('subTotal_211_B') + 
                ambilAngkaSaja('subTotal_211_C') + ambilAngkaSaja('subTotal_211_D') + 
                ambilAngkaSaja('subTotal_211_E') + ambilAngkaSaja('subTotal_211_F') + 
                ambilAngkaSaja('subTotal_211_G') + ambilAngkaSaja('subTotal_211_H') + ambilAngkaSaja('subTotal_211_I');
  const el = document.getElementById('skor_211_Total');
  if (el) el.innerText = total.toFixed(2);
}

function hitungTotalPoin212() {
  const total = ambilAngkaSaja('subTotal_212_A') + ambilAngkaSaja('subTotal_212_B') + 
                ambilAngkaSaja('subTotal_212_C') + ambilAngkaSaja('subTotal_212_D') + 
                ambilAngkaSaja('subTotal_212_E') + ambilAngkaSaja('subTotal_212_F') + 
                ambilAngkaSaja('subTotal_212_G') + ambilAngkaSaja('subTotal_212_H') + 
                ambilAngkaSaja('subTotal_212_I') + ambilAngkaSaja('subTotal_212_J') + ambilAngkaSaja('subTotal_212_K');
  const el = document.getElementById('skor_212_Total');
  if (el) el.innerText = total.toFixed(2);
}

function hitungTotalPoin311() {
  const total = ambilAngkaSaja('subTotal_311_A') + ambilAngkaSaja('subTotal_311_B') + 
                ambilAngkaSaja('subTotal_311_C') + ambilAngkaSaja('subTotal_311_D') + 
                ambilAngkaSaja('subTotal_311_E') + ambilAngkaSaja('subTotal_311_F') + 
                ambilAngkaSaja('subTotal_311_G') + ambilAngkaSaja('subTotal_311_H') + 
                ambilAngkaSaja('subTotal_311_I') + ambilAngkaSaja('subTotal_311_J') + 
                ambilAngkaSaja('subTotal_311_K') + ambilAngkaSaja('subTotal_311_L') + 
                ambilAngkaSaja('subTotal_311_M') + ambilAngkaSaja('subTotal_311_N') + 
                ambilAngkaSaja('subTotal_311_O') + ambilAngkaSaja('subTotal_311_P');
  const el = document.getElementById('skor_311_Total');
  if (el) el.innerText = total.toFixed(2);
}

function hitungTotalPoin312() {
  const total = ambilAngkaSaja('subTotal_312_A') + ambilAngkaSaja('subTotal_312_B') + 
                ambilAngkaSaja('subTotal_312_C') + ambilAngkaSaja('subTotal_312_D') + 
                ambilAngkaSaja('subTotal_312_E') + ambilAngkaSaja('subTotal_312_F') + 
                ambilAngkaSaja('subTotal_312_G') + ambilAngkaSaja('subTotal_312_H');
  const el = document.getElementById('skor_312_Total');
  if (el) el.innerText = total.toFixed(2);
}

function hitungTotalPoin313() {
  const total = ambilAngkaSaja('subTotal_313_A') + ambilAngkaSaja('subTotal_313_B') + 
                ambilAngkaSaja('subTotal_313_C') + ambilAngkaSaja('subTotal_313_D') + 
                ambilAngkaSaja('subTotal_313_E') + ambilAngkaSaja('subTotal_313_F');
  const el = document.getElementById('skor_313_Total');
  if (el) el.innerText = total.toFixed(2);
}

function hitungTotalPoin314() {
  const skor314Total = ambilAngkaSaja('skor_314_A_Total');
  const el = document.getElementById('skor_314_Total');
  if (el) el.innerText = skor314Total.toFixed(2);
}

function hitungTotalPoin315() {
  const skor315Total = ambilAngkaSaja('subTotal_315_A');
  const el = document.getElementById('skor_315_Total');
  if (el) el.innerText = skor315Total.toFixed(2);
}

function hitungTotalPoin411() {
  const total = ambilAngkaSaja('subTotal_411_A') + ambilAngkaSaja('subTotal_411_B') + 
                ambilAngkaSaja('subTotal_411_C') + ambilAngkaSaja('subTotal_411_D') + ambilAngkaSaja('subTotal_411_E');
  const el = document.getElementById('skor_411_Total');
  if (el) el.innerText = total.toFixed(2);
}

function hitungTotalPoin412() {
  const total = ambilAngkaSaja('subTotal_412_A') + ambilAngkaSaja('subTotal_412_B');
  const el = document.getElementById('skor_412_Total');
  if (el) el.innerText = total.toFixed(2);
}

function hitungTotalPoin413() {
  const total = ambilAngkaSaja('subTotal_413_A') + ambilAngkaSaja('subTotal_413_B');
  const el = document.getElementById('skor_413_Total');
  if (el) el.innerText = total.toFixed(2);
}

function hitungTotalPoin414() {
  const total = ambilAngkaSaja('subTotal_414_A') + ambilAngkaSaja('subTotal_414_B');
  const el = document.getElementById('skor_414_Total');
  if (el) el.innerText = total.toFixed(2);
}


// ========================================================
// 6. PENJUMLAHAN AKUMULASI UTAMA (LEVEL 2)
// ========================================================
function hitungTotalPoin11() {
  const skor11 = ambilAngkaSaja('skor_111_Total');
  const el = document.getElementById('skor_11_Total');
  if (el) el.innerText = skor11.toFixed(2);
}

function hitungTotalPoin21() {
  const total21 = ambilAngkaSaja('skor_211_Total') + ambilAngkaSaja('skor_212_Total');
  const el = document.getElementById('skor_21_Total');
  if (el) el.innerText = total21.toFixed(2);
}

function hitungTotalPoin31() {
  const total31 = ambilAngkaSaja('skor_311_Total') + ambilAngkaSaja('skor_312_Total') + 
                  ambilAngkaSaja('skor_313_Total') + ambilAngkaSaja('skor_314_Total') + ambilAngkaSaja('skor_315_Total');
  const el = document.getElementById('skor_31_Total');
  if (el) el.innerText = total31.toFixed(2);
}

function hitungTotalPoin41() {
  const total41 = ambilAngkaSaja('skor_411_Total') + ambilAngkaSaja('skor_412_Total') + 
                  ambilAngkaSaja('skor_413_Total') + ambilAngkaSaja('skor_414_Total'); 
  const el = document.getElementById('skor_41_Total');
  if (el) el.innerText = total41.toFixed(2);
}

// ========================================================
// 7. FUNGSI GRAND TOTAL RSUD
// ========================================================
function hitungGrandTotal() {
  const total1 = ambilAngkaSaja('skor_11_Total');
  const total2 = ambilAngkaSaja('skor_21_Total');
  const total3 = ambilAngkaSaja('skor_31_Total');
  const total4 = ambilAngkaSaja('skor_41_Total');
  
  const grandTotal = total1 + total2 + total3 + total4;
  
  const elGrandTotal = document.getElementById('grandTotal');
  if (elGrandTotal) elGrandTotal.innerText = grandTotal.toFixed(2);

  const elPredikat = document.getElementById('predikatGrandTotal');
  if (elPredikat) elPredikat.innerText = tentukanPredikat(grandTotal);
}

function tentukanPredikat(skor) {
  if (skor < 60) return "C (Kurang)";
  if (skor < 70) return "B (Cukup)";
  if (skor < 80) return "BB (Baik)";
  if (skor < 90) return "A (Sangat Baik)";
  return "AA (Memuaskan)"; 
}

// ========================================================
// 8. FUNGSI EXPORT (EXCEL) & RESET DATA
// ========================================================
async function exportToExcel() {
  try {
    alert("Sedang mengambil template dan menyuntikkan data... Mohon tunggu.");

    const response = await fetch('assets/template/template_excel.xlsx');
    
    if (!response.ok) {
      throw new Error("Gagal memuat template. Pastikan file berada di 'assets/template/template_excel.xlsx'");
    }

    const arrayBuffer = await response.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.worksheets[0];

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (typeof cell.value === 'string' && cell.value.startsWith('$')) {
          const idTarget = cell.value.substring(1); 
          const nilaiAkhir = ambilAngkaSaja(idTarget);
          cell.value = nilaiAkhir; 
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "Laporan_Kinerja_RSUD_Otomatis.xlsx";
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

  } catch (error) {
    console.error("Gagal export:", error);
    alert("Terjadi kesalahan: \n" + error.message);
  }
}

function resetData() {
  const konfirmasi = confirm("⚠️ PERHATIAN!\n\nApakah Anda yakin ingin MENGHAPUS SEMUA DATA di form ini? Data yang terhapus tidak dapat dikembalikan.");
  
  if (konfirmasi) {
    if (formRef) {
      formRef.delete().then(() => {
        alert("Semua data berhasil dihapus dari sistem.");
        // Otomatis diarahkan ulang agar data hilang dari layar
        location.reload(); 
      }).catch((error) => {
        alert("Gagal menghapus data: " + error.message);
      });
    } else {
      location.reload();
    }
  }
}