// ========================================================
// 1. CONFIG & INITIALIZATION FIREBASE (CLOUD FIRESTORE)
// ========================================================
const firebaseConfig = {
    apiKey: "AIzaSyAGoWJ5UfF1lyQAhEiR06f6Qm_uDc_Xo0w",
    authDomain: "lap-bsc.firebaseapp.com",
    projectId: "lap-bsc",
    storageBucket: "lap-bsc.firebasestorage.app",
    messagingSenderId: "1075222206362",
    appId: "1:1075222206362:web:acb8cb5839cd58560b8c23",
    measurementId: "G-3NWWX99KPP"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let currentUser = null;
let formRef = null;

// Variabel Global Baru
let tribulanAktif = "TW1-2026"; 
let tipeKoleksi = ""; // Menyimpan jenis database (rsud / pkm)

// ========================================================
// 2. SISTEM LOGIN & LOGOUT (Multi-Dashboard: RSUD & PKM)
// ========================================================
auth.onAuthStateChanged((user) => {
  const currentPath = window.location.pathname;
  const isRsudPage = currentPath.includes("dashboard-rsud.html");
  const isPkmPage = currentPath.includes("dashboard-pkm.html");
  const isAdminPage = currentPath.includes("dashboard-admin.html");
  const namaUser = document.getElementById("namaUser");

  if (user) {
    currentUser = user;
    const usernameAsli = user.email.replace("@gmail.com", "");
    if (namaUser) namaUser.innerText = usernameAsli;

    const selectTribulan = document.getElementById("pilihTribulan");
    if (selectTribulan) tribulanAktif = selectTribulan.value;

    if (usernameAsli.startsWith("admin")) {
      if (isAdminPage) {
        tarikSemuaDataAdmin();
      } else {
        window.location.href = "dashboard-admin.html";
      }
    } 
    else if (usernameAsli.startsWith("rsud_")) {
      tipeKoleksi = "evaluasi_kinerja_rsud";
      formRef = db.collection(tipeKoleksi).doc(`${user.uid}_${tribulanAktif}`); 
      
      if (isRsudPage) {
        muatDataDariFirebase();
      } else {
        window.location.href = "dashboard-rsud.html";
      }
    } 
    else if (usernameAsli.startsWith("pkm_")) {
      tipeKoleksi = "evaluasi_kinerja_pkm";
      formRef = db.collection(tipeKoleksi).doc(`${user.uid}_${tribulanAktif}`);
      
      if (isPkmPage) {
        muatDataDariFirebase();
      } else {
        window.location.href = "dashboard-pkm.html";
      }
    } 
    else {
      alert("Akses Ditolak: Kategori pengguna tidak dikenali.");
      auth.signOut();
    }
  } else {
    currentUser = null;
    formRef = null;
    if (isRsudPage || isPkmPage || isAdminPage) {
      window.location.href = "index.html";
    }
  }
});

function gantiTribulan() {
  const selectTribulan = document.getElementById("pilihTribulan");
  if (!selectTribulan || !currentUser || !tipeKoleksi) return;
  
  tribulanAktif = selectTribulan.value;
  formRef = db.collection(tipeKoleksi).doc(`${currentUser.uid}_${tribulanAktif}`);
  
  document.querySelectorAll('input[type="number"], select').forEach(input => {
    if(input.id !== "pilihTribulan") input.value = "";
  });
  document.querySelectorAll('[id^="skor_"], [id^="subTotal_"]').forEach(el => el.innerText = "0.00");
  
  muatDataDariFirebase();
}

function aksiLogin() {
  const username = document.getElementById("inputEmail").value;
  const password = document.getElementById("inputPassword").value;

  if (!username || !password) {
    alert("Harap isi Username dan Password!");
    return;
  }
  
  const dummyEmail = username + "@gmail.com"; 
  
  auth.signInWithEmailAndPassword(dummyEmail, password)
    .then((userCredential) => {
      alert("Berhasil masuk sebagai " + username);
    })
    .catch((error) => {
      alert("Login Gagal: " + error.message);
    });
}

function togglePassword() {
  const input = document.getElementById("inputPassword");
  const icon = document.getElementById("iconPassword");

  if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }
}

function logoutUser() {
  const konfirmasi = confirm("Apakah Anda yakin ingin keluar?");
  if (konfirmasi) {
    auth.signOut();
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

  formRef.set(dataObjek, { merge: true }).catch((err) => {
    console.error("Gagal menyimpan ke Firestore:", err);
  });
}

function muatDataDariFirebase() {
  if (!formRef) return;

  formRef.get().then((doc) => {
    if (doc.exists) {
      const data = doc.data();
      let daftarPoinUnik = new Set(); 

      for (const [key, value] of Object.entries(data)) {
        let elemen = document.getElementById(key);
        
        if (!elemen && key.startsWith("real_")) {
          const poinMurni = key.replace("real_", "");
          elemen = document.getElementById(`select_${poinMurni}`);
        }

        if (elemen && (elemen.tagName === "INPUT" || elemen.tagName === "SELECT")) {
          elemen.value = value; 
        }

        let namaPoin = "";
        if (key.startsWith("real_")) namaPoin = key.replace("real_", "");
        else if (key.startsWith("target_")) namaPoin = key.replace("target_", "");
        else if (key.startsWith("select_")) namaPoin = key.replace("select_", "");
        
        if (namaPoin && !namaPoin.includes("_Total")) {
          daftarPoinUnik.add(namaPoin);
        }
      }

      daftarPoinUnik.forEach(poin => {
        if (typeof hitungSkorOtomatis === 'function') {
          hitungSkorOtomatis(poin);
        }
      });

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
    simpanKeFirebase(namaPoin, skorPilihan, null, skorPilihan);
    return; 
  }

  const elReal = document.getElementById(`real_${namaPoin}`);
  if (!elReal) return; 
  
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
// 5. TOTAL LEVEL 3 & 6. PENJUMLAHAN AKUMULASI UTAMA
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
// 7. FUNGSI GRAND TOTAL & "SAPU JAGAT" DATABASE
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
  let predikatHasil = "-";
  
  if (elPredikat) {
    predikatHasil = tentukanPredikat(grandTotal);
    elPredikat.innerText = predikatHasil;
  }

  // === FITUR SAPU JAGAT: REKAM SELURUH NILAI DI LAYAR KE FIREBASE ===
  if (currentUser && formRef) {
    const usernameAsli = currentUser.email.replace("@gmail.com", "");
    const namaLengkapInstansi = formatNamaInstansi(usernameAsli);

    let dataLengkap = {
        nama_instansi: namaLengkapInstansi,
        grand_total: grandTotal.toFixed(2),
        predikat: predikatHasil
    };

    // Ambil SEMUA elemen berawalan skor_, subTotal_, real_, dan target_
    const semuaElemen = document.querySelectorAll('[id^="skor_"], [id^="subTotal_"], [id^="real_"], [id^="target_"]');
    
    semuaElemen.forEach(el => {
        let nilai = 0;
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
            nilai = parseFloat(el.value.replace(',', '.')) || 0;
        } else {
            nilai = parseFloat(el.innerText.replace(',', '.')) || 0;
        }
        dataLengkap[el.id] = nilai; 
    });

    formRef.set(dataLengkap, { merge: true }).catch((err) => {
        console.error("Gagal menyimpan rekap laporan ke Firestore:", err);
    });
  }
}

function tentukanPredikat(skor) {
  if (skor < 60) return "C (Kurang)";
  if (skor < 70) return "B (Cukup)";
  if (skor < 80) return "BB (Baik)";
  if (skor < 90) return "A (Sangat Baik)";
  return "AA (Memuaskan)"; 
}

// ========================================================
// 8. FUNGSI EXPORT (EXCEL) 2-IN-1 & RESET
// ========================================================
async function exportToExcel(namaKoleksi = null, docId = null, namaInstansi = null, triwulan = null) {
  try {
    alert("Sedang mengambil template dan menyuntikkan data... Mohon tunggu.");
    let dataAdmin = null;

    if (namaKoleksi && docId) {
        const doc = await db.collection(namaKoleksi).doc(docId).get();
        if (doc.exists) {
            dataAdmin = doc.data();
        } else {
            throw new Error("Data instansi tidak ditemukan di database.");
        }
    }

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
          let nilaiAkhir = 0;
          
          if (dataAdmin) {
             let nilaiDariDatabase = dataAdmin[idTarget];
             
             if (nilaiDariDatabase !== undefined) {
                nilaiAkhir = isNaN(parseFloat(nilaiDariDatabase)) ? nilaiDariDatabase : parseFloat(nilaiDariDatabase);
             } else {
                // KECERDASAN TERJEMAHAN: Jika Excel minta subTotal_ tapi di DB cuma ada skor_
                if (idTarget.startsWith('subTotal_')) {
                    const skorAsli = idTarget.replace('subTotal_', 'skor_');
                    nilaiAkhir = parseFloat(dataAdmin[skorAsli]) || 0;
                } else {
                    console.warn(`[DEBUG] Variabel "${idTarget}" tidak ditemukan di database Firebase!`);
                    nilaiAkhir = 0;
                }
             }
          } else {
             // User: Baca layar
             nilaiAkhir = ambilAngkaSaja(idTarget);
          }
          cell.value = nilaiAkhir; 
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    if (dataAdmin && namaInstansi && triwulan) {
        const namaFileBersih = namaInstansi.replace(/\s+/g, '_'); 
        a.download = `Laporan_${namaFileBersih}_${triwulan}.xlsx`;
    } else {
        a.download = "Laporan_Kinerja_Otomatis.xlsx";
    }
    
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
  const konfirmasi = confirm("⚠️ PERHATIAN!\n\nApakah Anda yakin ingin MENGHAPUS SEMUA DATA di form ini?");
  if (konfirmasi) {
    if (formRef) {
      formRef.delete().then(() => {
        alert("Semua data berhasil dihapus dari sistem.");
        location.reload(); 
      }).catch((error) => {
        alert("Gagal menghapus data: " + error.message);
      });
    } else {
      location.reload();
    }
  }
}

function formatNamaInstansi(username) {
    let tipe = "";
    let nama = "";
    
    if (username.startsWith("pkm_")) {
        tipe = "Puskesmas ";
        nama = username.replace("pkm_", "");
    } else if (username.startsWith("rsud_")) {
        tipe = "RSUD ";
        nama = username.replace("rsud_", "");
    } else {
        return username;
    }
    nama = nama.charAt(0).toUpperCase() + nama.slice(1);
    return tipe + nama;
}

// ========================================================
// 9. FUNGSI KHUSUS DASHBOARD ADMIN
// ========================================================
async function tarikSemuaDataAdmin() {
  const tabelRef = document.getElementById("tabelRekapAdmin");
  if (!tabelRef) return;

  tabelRef.innerHTML = ""; 

  try {
    let htmlTabel = "";

    const snapshotRsud = await db.collection("evaluasi_kinerja_rsud").get();
    snapshotRsud.forEach(doc => {
      const data = doc.data();
      const idParts = doc.id.split("_");
      const triwulan = idParts[1] || "Tidak Diketahui";
      const nama = data.nama_instansi || "RSUD (Belum Input)";
      const total = data.grand_total || "0.00";
      const predikat = data.predikat || "-";

      htmlTabel += `
        <tr class="rsud-row">
            <td><strong>${nama}</strong></td>
            <td>${triwulan}</td>
            <td><strong>${total}</strong></td>
            <td>${predikat}</td>
            <td><button class="btn-aksi" onclick="lihatDetailAdmin('evaluasi_kinerja_rsud', '${doc.id}', '${nama}', '${triwulan}')"><i class="fa-solid fa-eye"></i> Detail</button></td>
        </tr>
      `;
    });

    const snapshotPkm = await db.collection("evaluasi_kinerja_pkm").get();
    snapshotPkm.forEach(doc => {
      const data = doc.data();
      const idParts = doc.id.split("_");
      const triwulan = idParts[1] || "Tidak Diketahui";
      const nama = data.nama_instansi || "PKM (Belum Input)";
      const total = data.grand_total || "0.00";
      const predikat = data.predikat || "-";

      htmlTabel += `
        <tr class="pkm-row">
            <td><strong>${nama}</strong></td>
            <td>${triwulan}</td>
            <td><strong>${total}</strong></td>
            <td>${predikat}</td>
            <td><button class="btn-aksi" onclick="lihatDetailAdmin('evaluasi_kinerja_pkm', '${doc.id}', '${nama}', '${triwulan}')"><i class="fa-solid fa-eye"></i> Detail</button></td>
        </tr>
      `;
    });

    if (htmlTabel === "") {
      tabelRef.innerHTML = `<tr><td colspan="5" style="text-align:center;">Belum ada laporan.</td></tr>`;
    } else {
      tabelRef.innerHTML = htmlTabel;
    }

  } catch (error) {
    console.error("Gagal:", error);
    tabelRef.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Gagal memuat data.</td></tr>`;
  }
}

async function lihatDetailAdmin(namaKoleksi, docId, namaInstansi, triwulan) {
    document.getElementById("modalDetailAdmin").style.display = "block";
    document.getElementById("judulModal").innerText = `Detail Nilai: ${namaInstansi} (${triwulan})`;
    const isiRef = document.getElementById("isiModalDetail");
    isiRef.innerHTML = "<p>Sedang memuat rincian nilai...</p>";

    try {
        const doc = await db.collection(namaKoleksi).doc(docId).get();
        if (doc.exists) {
            const data = doc.data();
            
           let htmlKonten = `
    <div style="margin-bottom: 15px;">
        <button class="btn-excel" style="background-color: #059669; padding: 8px 12px; font-size: 14px;" 
                onclick="exportToExcel('${namaKoleksi}', '${docId}', '${namaInstansi}', '${triwulan}')">
            <i class="fa-solid fa-file-excel"></i> Cetak Laporan ${namaInstansi} Sesuai Template
        </button>
    </div>
`;
            htmlKonten += `<table class="admin-table"><tr><th>Nama Poin / Indikator</th><th>Skor Didapat</th></tr>`;
            
            const keys = Object.keys(data)
                               .filter(k => k.startsWith('skor_') || k.startsWith('subTotal_') || k.startsWith('real_') || k.startsWith('target_'))
                               .sort();
            
            keys.forEach(k => {
                htmlKonten += `<tr><td>${k}</td><td><strong>${data[k]}</strong></td></tr>`;
            });
            htmlKonten += `</table>`;
            
            isiRef.innerHTML = htmlKonten;
        }
    } catch (error) {
        isiRef.innerHTML = `<p style="color:red;">Gagal menarik rincian data: ${error.message}</p>`;
    }
}

function tutupModalAdmin() {
    document.getElementById("modalDetailAdmin").style.display = "none";
}

async function exportExcelAdmin() {
    try {
        alert("Sistem sedang mengumpulkan seluruh data instansi dan menyusunnya ke dalam Excel. Mohon tunggu beberapa saat...");
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Rekapitulasi Kinerja");

        let semuaData = [];
        let daftarPoinUnik = new Set(); 

        const snapRsud = await db.collection("evaluasi_kinerja_rsud").get();
        snapRsud.forEach(doc => {
            let data = doc.data();
            data.idDokumen = doc.id;
            semuaData.push(data);
            Object.keys(data).forEach(k => {
                if (k.startsWith('skor_') || k.startsWith('subTotal_')) daftarPoinUnik.add(k);
            });
        });

        const snapPkm = await db.collection("evaluasi_kinerja_pkm").get();
        snapPkm.forEach(doc => {
            let data = doc.data();
            data.idDokumen = doc.id;
            semuaData.push(data);
            Object.keys(data).forEach(k => {
                if (k.startsWith('skor_') || k.startsWith('subTotal_')) daftarPoinUnik.add(k);
            });
        });

        if (semuaData.length === 0) {
            alert("Belum ada data dari instansi manapun untuk dicetak.");
            return;
        }

        const kolomDasar = [
            { header: 'Nama Instansi', key: 'nama', width: 30 },
            { header: 'Periode/TW', key: 'tw', width: 15 },
            { header: 'Grand Total', key: 'gt', width: 15 },
            { header: 'Predikat', key: 'predikat', width: 20 }
        ];

        const poinUrut = Array.from(daftarPoinUnik).sort();
        poinUrut.forEach(poin => {
            kolomDasar.push({ header: poin, key: poin, width: 15 });
        });
        worksheet.columns = kolomDasar;
        
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

        semuaData.forEach(d => {
            const tw = d.idDokumen ? d.idDokumen.split('_')[1] : "-";
            let barisData = {
                nama: d.nama_instansi || "Instansi",
                tw: tw,
                gt: d.grand_total || "0",
                predikat: d.predikat || "-"
            };
            
            poinUrut.forEach(poin => {
                barisData[poin] = d[poin] !== undefined ? d[poin] : "0";
            });

            worksheet.addRow(barisData);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "Rekapitulasi_Lengkap_Dinkes.xlsx";
        document.body.appendChild(a);
        a.click();
        
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        console.error("Gagal export admin Excel:", error);
        alert("Terjadi kesalahan saat membuat file Excel: " + error.message);
    }
}