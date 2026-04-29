// const urlAPI = ... deleted for Supabase
const dbClient = window.supabaseClient; // Removed to access window.supabaseClient directly in functions

// Global State
let dataWilayah = [];
let dataSPPG = [];
let dataKegiatan = [];
let geojsonLayer;
let markerUnitsLayer;
let semuaDataDesa = [];
let isLoggedIn = localStorage.getItem('nganjukGis_isLoggedIn') === 'true';
let userRole = localStorage.getItem('nganjukGis_role') || '';
let activeTab = 'lokasi';

// ==========================================
// 1. INISIALISASI PETA
// ==========================================
const map = L.map('map', {
    center: [-7.6044, 111.9044],
    zoom: 10,
    zoomControl: true,
    attributionControl: false,
    scrollWheelZoom: false
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);
map.createPane('unitPane');
map.getPane('unitPane').style.zIndex = 650;
map.createPane('tooltipPane');
map.getPane('tooltipPane').style.zIndex = 700;
markerUnitsLayer = L.layerGroup().addTo(map);

// ==========================================
// 2. FUNGSI INDIKATOR STATUS
// ==========================================
function setUpdateStatus(isLoaded) {
    const container = document.getElementById('status-indicator');
    const ping = document.getElementById('status-ping');
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');

    if (!container || !text) return;

    if (isLoaded) {
        container.classList.remove('text-gray-400');
        container.classList.add('text-[#00ac69]');
        if (ping) ping.classList.add('animate-ping', 'bg-[#00ac69]', 'opacity-80');
        if (dot) {
            dot.classList.remove('bg-gray-400');
            dot.classList.add('bg-[#00ac69]');
        }
        text.innerText = 'Updated';
    } else {
        container.classList.add('text-gray-400');
        container.classList.remove('text-[#00ac69]');
        if (ping) ping.classList.remove('animate-ping', 'bg-[#00ac69]', 'opacity-80');
        if (dot) {
            dot.classList.remove('bg-[#00ac69]');
            dot.classList.add('bg-gray-400');
        }
        text.innerText = 'Updating';
    }
}

// ==========================================
// 3. PENGAMBILAN DATA (FETCH)
// ==========================================
async function ambilDataSheet() {
    setUpdateStatus(false);
    try {
        const client = window.supabaseClient;
        const [resWilayah, resSppg, resKopdes, resRumahRJ, resIntel, resPidum, resDatun] = await Promise.all([
            client.from('wilayah_induk').select('*'),
            client.from('data_sppg').select('*'),
            client.from('data_kopdes').select('*'),
            client.from('daftar_rumahrj').select('*'),
            client.from('data_intel').select('*'),
            client.from('data_pidum').select('*'),
            client.from('data_datun').select('*')
        ]);

        if (resWilayah.error || resSppg.error) throw new Error("Supabase fetch failed");

        dataWilayah = resWilayah.data || [];
        dataSPPG = [
            ...(resSppg.data || []).map(i => ({ ...i, topik: 'sppg' })),
            ...(resKopdes.data || []).map(i => ({ ...i, topik: 'kopdes' })),
            ...(resRumahRJ.data || []).map(i => ({ ...i, topik: 'rumah_rj' }))
        ];
        dataKegiatan = [
            ...(resIntel.data || []).map(i => ({ ...i, topik: 'intel' })),
            ...(resPidum.data || []).map(i => ({ ...i, topik: 'pidum' })),
            ...(resDatun.data || []).map(i => ({ ...i, topik: 'datun' }))
        ];

        setUpdateStatus(true);
        if (typeof siramWarnaKePeta === 'function') siramWarnaKePeta();
        updateTampilanGlobal();
    } catch (e) {
        console.warn("Supabase Error:", e);
        setUpdateStatus(false);
    }
}

// ==========================================
// 4. AUTENTIKASI & HAK AKSES
// ==========================================
function cekStatusAkses() {
    isLoggedIn = localStorage.getItem('nganjukGis_isLoggedIn') === 'true';
    userRole = localStorage.getItem('nganjukGis_role') || '';
    const el = {
        btnLogin: document.getElementById('btn-login-modal'),
        profile: document.getElementById('admin-profile'),
        role: document.getElementById('role-label'),
        sidebarAdmin: document.getElementById('sidebar-admin-only'),
        btnTambah: document.getElementById('sidebar-tambah-unit'),
        btnTambahKeg: document.getElementById('sidebar-tambah-kegiatan')
    };

    const baseNav = document.querySelector('aside nav');
    let sideIntel, sidePidum, sideDatun, sideSppg, sideKopdes;
    if (baseNav) {
        sideIntel = baseNav.querySelector('a[href="intel.html"]');
        sidePidum = baseNav.querySelector('a[href="pidum.html"]');
        sideDatun = baseNav.querySelector('a[href="datun.html"]');
        sideSppg = baseNav.querySelector('a[href="sppg.html"]');
        sideKopdes = baseNav.querySelector('a[href="kopdes.html"]');
    }

    const isGuest = !isLoggedIn;
    const isAdmin = isLoggedIn && (userRole === 'admin' || userRole === '');
    const isIntel = isLoggedIn && userRole === 'intel';
    const isPidum = isLoggedIn && userRole === 'pidum';
    const isDatun = isLoggedIn && userRole === 'datun';
    const isBidang = isIntel || isPidum || isDatun;

    if (isLoggedIn) {
        if (el.btnLogin) el.btnLogin.classList.add('hidden');
        if (el.profile) el.profile.classList.remove('hidden');
        if (el.role) el.role.innerText = 'Halo, ' + (userRole === '' ? 'ADMIN' : userRole.toUpperCase());
        if (el.sidebarAdmin) el.sidebarAdmin.classList.remove('hidden');

        if (el.btnTambah) el.btnTambah.classList.toggle('hidden', !isAdmin);
        if (el.btnTambahKeg) el.btnTambahKeg.classList.toggle('hidden', !isBidang && !isAdmin);
    } else {
        if (el.btnLogin) el.btnLogin.classList.remove('hidden');
        if (el.profile) el.profile.classList.add('hidden');
        if (el.sidebarAdmin) el.sidebarAdmin.classList.add('hidden');
    }

    if (sideIntel) sideIntel.classList.toggle('hidden', !(isGuest || isAdmin || isIntel));
    if (sidePidum) sidePidum.classList.toggle('hidden', !(isGuest || isAdmin || isPidum));
    if (sideDatun) sideDatun.classList.toggle('hidden', !(isGuest || isAdmin || isDatun));
    if (sideSppg) sideSppg.classList.toggle('hidden', !(isGuest || isAdmin));
    if (sideKopdes) sideKopdes.classList.toggle('hidden', !(isGuest || isAdmin));

    if (sideSppg && sideSppg.parentElement && sideSppg.parentElement.parentElement) {
        sideSppg.parentElement.parentElement.classList.toggle('hidden', !(isGuest || isAdmin));
    }

    if (sideIntel && sideIntel.parentElement && sideIntel.parentElement.parentElement) {
        sideIntel.parentElement.parentElement.classList.toggle('hidden', !(isGuest || isAdmin || isBidang));
    }

    // Dashboard Tuning if logged in as Bidang (Intel, Pidum, Datun)
    const filterTopik = document.getElementById('filter-topik');
    const sppgCard = document.getElementById('stat-sppg');
    const tabLokasi = document.getElementById('tab-lokasi');
    const bidangSection = document.getElementById('bidang-section');

    if (isBidang) {
        if (filterTopik) {
            filterTopik.value = userRole;
            filterTopik.style.display = 'none';
            if (filterTopik.previousElementSibling && filterTopik.previousElementSibling.tagName === 'SPAN') {
                filterTopik.previousElementSibling.style.display = 'none';
            }
        }
        if (sppgCard && sppgCard.parentElement && sppgCard.parentElement.parentElement) {
            sppgCard.parentElement.parentElement.classList.add('hidden');
        }
        if (tabLokasi && tabLokasi.parentElement) {
            tabLokasi.parentElement.classList.add('hidden');
        }
        if (bidangSection) {
            bidangSection.classList.add('hidden');
        }
        switchTab('kegiatan');
    } else {
        if (filterTopik) {
            filterTopik.style.display = '';
            if (filterTopik.previousElementSibling && filterTopik.previousElementSibling.tagName === 'SPAN') {
                filterTopik.previousElementSibling.style.display = '';
            }
        }
        if (sppgCard && sppgCard.parentElement && sppgCard.parentElement.parentElement) {
            sppgCard.parentElement.parentElement.classList.remove('hidden');
        }
        if (tabLokasi && tabLokasi.parentElement) {
            tabLokasi.parentElement.classList.remove('hidden');
        }
        if (bidangSection) {
            bidangSection.classList.remove('hidden');
        }
    }
}

function initOverlayLogin() {
    const modals = {
        login: { m: document.getElementById('login-modal'), b: document.getElementById('login-box') },
        profile: { m: document.getElementById('profile-modal'), b: document.getElementById('profile-box') }
    };
    const ui = {
        btnOpenLogin: document.getElementById('btn-login-modal'),
        btnCloseLogin: document.getElementById('btn-close-modal'),
        formLogin: document.getElementById('login-form'),
        btnOpenProfile: document.getElementById('admin-profile'),
        btnCloseProfile: document.getElementById('btn-close-profile'),
        btnLogout: document.getElementById('btn-do-logout')
    };

    if (!modals.login.m || !modals.profile.m) return;

    const toggle = (modal, box, show) => {
        if (show) {
            modal.classList.remove('hidden', 'opacity-0');
            modal.classList.add('flex');
            setTimeout(() => box.classList.remove('scale-95'), 10);
        } else {
            modal.classList.add('opacity-0');
            box.classList.add('scale-95');
            setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
        }
    };

    if (ui.btnOpenLogin) ui.btnOpenLogin.addEventListener('click', () => toggle(modals.login.m, modals.login.b, true));
    if (ui.btnCloseLogin) ui.btnCloseLogin.addEventListener('click', () => toggle(modals.login.m, modals.login.b, false));
    if (ui.btnOpenProfile) ui.btnOpenProfile.addEventListener('click', () => toggle(modals.profile.m, modals.profile.b, true));
    if (ui.btnCloseProfile) ui.btnCloseProfile.addEventListener('click', () => toggle(modals.profile.m, modals.profile.b, false));

    if (ui.formLogin) {
        ui.formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = document.getElementById('login-username').value;
            const pass = document.getElementById('login-password').value;
            const btn = document.getElementById('btn-submit-login');
            const err = document.getElementById('login-error');

            btn.innerText = 'Memverifikasi...';
            btn.disabled = true;
            err.classList.add('hidden');

            try {
                let data, error;
                let targetEmails = user.includes('@')
                    ? [user]
                    : [`${user}@knnganjuk.go.id`];

                for (let email of targetEmails) {
                    const res = await dbClient.auth.signInWithPassword({
                        email: email,
                        password: pass
                    });

                    error = res.error;
                    data = res.data;

                    if (!error) {
                        break; // Berhasil login
                    }
                }

                if (error) {
                    console.error("Supabase Auth Error:", error);
                    let errMsg = error.message;
                    if (errMsg.includes('Email not confirmed')) {
                        errMsg = 'Email belum dikonfirmasi';
                    } else if (errMsg.includes('Invalid login credentials')) {
                        errMsg = 'Password salah';
                    }

                    err.innerText = errMsg;
                    err.classList.remove('hidden');
                    btn.innerText = 'Masuk Aplikasi';
                    btn.disabled = false;
                    return;
                }

                // Ambil Role
                const { data: roleData } = await dbClient
                    .from('admin_roles')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();

                const role = roleData ? roleData.role : user; // Fallback ke username jika tidak ada role strict

                localStorage.setItem('nganjukGis_isLoggedIn', 'true');
                localStorage.setItem('nganjukGis_role', role);

                if (modals.login.m && modals.login.b) {
                    toggle(modals.login.m, modals.login.b, false);
                    setTimeout(() => location.reload(), 500);
                } else {
                    location.reload();
                }
                return;
            } catch (e) {
                // FALLBACK LOKAL DARURAT HANYA JIKA API GAGAL DIPANGGIL (Koneksi putus/CORS)
                const fallbackDB = {
                    'admin': 'adminnganjuk',
                    'intel': 'intelnganjuk',
                    'pidum': 'pidumnganjuk',
                    'datun': 'datunnganjuk'
                };

                if (fallbackDB[user] && pass === fallbackDB[user]) {
                    localStorage.setItem('nganjukGis_isLoggedIn', 'true');
                    localStorage.setItem('nganjukGis_role', user);

                    if (modals.login.m && modals.login.b) {
                        toggle(modals.login.m, modals.login.b, false);
                        setTimeout(() => location.reload(), 500);
                    } else {
                        location.reload();
                    }
                    return;
                } else {
                    err.innerText = 'Koneksi API error. Fallback lokal gagal (user/pass salah).';
                    err.classList.remove('hidden');
                }
            }
            btn.innerText = 'Masuk Aplikasi';
            btn.disabled = false;
        });
    }

    if (ui.btnLogout) ui.btnLogout.addEventListener('click', async () => {
        await dbClient.auth.signOut();
        localStorage.removeItem('nganjukGis_isLoggedIn');
        localStorage.removeItem('nganjukGis_role');
        isLoggedIn = false;
        userRole = '';
        toggle(modals.profile.m, modals.profile.b, false);
        cekStatusAkses();
        resetAplikasi();
    });
}

// ==========================================
// 5. DATA FILTERING HELPER
// ==========================================
const clean = {
    kec: (n) => n ? String(n).replace(/^(kecamatan|kec\.)\s*/i, '').trim().toUpperCase() : "",
    desa: (n) => n ? String(n).replace(/^(desa|kelurahan|kel\.)\s*/i, '').trim().toUpperCase() : ""
};

function dapatkanDataTerfilter() {
    const kec = document.getElementById('filter-kecamatan')?.value || "";
    const desa = document.getElementById('filter-desa')?.value || "";
    const topik = document.getElementById('filter-topik')?.value.toLowerCase() || "";
    const qDesa = clean.desa(desa);

    return dataSPPG.filter(s => {
        const sKec = s.lokasi_kecamatan || s.kecamatan || s.wilayah || "";
        const matchKec = kec === "" || clean.kec(sKec) === clean.kec(kec);
        const matchTopik = topik === "" || (s.topik || "").toLowerCase() === topik;

        let matchDesa = true;
        if (qDesa !== "") {
            const sDesa = (s.lokasi_desa || s.desa || s.nama_desa || "").toUpperCase();
            const sAlamat = (s.alamat || "").toUpperCase();
            matchDesa = sDesa.includes(qDesa) || sAlamat.includes(qDesa);
        }
        return matchKec && matchTopik && matchDesa;
    });
}

function filterKegiatan(kec, desa) {
    const topik = document.getElementById('filter-topik')?.value.toLowerCase() || "";
    return dataKegiatan.filter(k => {
        const matchKec = !kec || clean.kec(k.kecamatan || '') === clean.kec(kec);
        const matchDesa = !desa || clean.desa(k.desa || '') === clean.desa(desa);
        const matchTopik = topik === "" || (k.topik || "").toLowerCase() === topik;
        return matchKec && matchDesa && matchTopik;
    });
}

// ==========================================
// 6. EVENT LISTENER FILTER PETA
// ==========================================
const filters = ['filter-kecamatan', 'filter-desa', 'filter-topik'];
filters.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('change', (e) => {
            const val = e.target.value;
            const nKec = document.getElementById('filter-kecamatan').value;

            if (id === 'filter-kecamatan') {
                const elDesa = document.getElementById('filter-desa');
                if (elDesa) {
                    elDesa.innerHTML = '<option value="">Semua Desa</option>';
                    if (val === "") { elDesa.disabled = true; resetView(); return; }
                    elDesa.disabled = false;
                    const kClean = clean.kec(val);
                    semuaDataDesa.filter(d => clean.kec(d.kecamatan) === kClean)
                        .sort((a, b) => a.nama_desa.localeCompare(b.nama_desa))
                        .forEach(d => elDesa.innerHTML += `<option value="${d.nama_desa}">${d.nama_desa}</option>`);
                }

                if (geojsonLayer) {
                    geojsonLayer.eachLayer(l => {
                        const n = l.feature.properties.NAMOBJ || l.feature.properties.WADMKC;
                        if (n === val) {
                            map.fitBounds(l.getBounds());
                            updateDetailPanel(l.feature.properties.data_tambahan, n);
                        }
                    });
                }
            } else if (id === 'filter-desa') {
                if (val !== "") {
                    let infoDesa = dataWilayah.find(w => (w.level || '').toLowerCase() === 'desa' && clean.desa(w.nama_wilayah) === clean.desa(val) && clean.kec(w.kecamatan || nKec) === clean.kec(nKec));
                    if (!infoDesa) infoDesa = dataWilayah.find(w => (w.level || '').toLowerCase() === 'desa' && clean.desa(w.nama_wilayah) === clean.desa(val));
                    updateDetailPanel(infoDesa || null, nKec, val);
                } else if (nKec !== "") {
                    if (geojsonLayer) {
                        geojsonLayer.eachLayer(l => {
                            const n = l.feature.properties.NAMOBJ || l.feature.properties.WADMKC;
                            if (n === nKec) {
                                updateDetailPanel(l.feature.properties.data_tambahan, n);
                            }
                        });
                    }
                }
            } else if (id === 'filter-topik') {
                const isKegiatan = val === 'intel' || val === 'pidum' || val === 'datun';
                if (isKegiatan) {
                    switchTab('kegiatan');
                } else if (val === 'sppg' || val === 'kopdes') {
                    switchTab('lokasi');
                }
            }
            updateTampilanGlobal();
        });
    }
});

function resetView() {
    if (geojsonLayer) map.fitBounds(geojsonLayer.getBounds());
    sembunyikanDetail();
    updateTampilanGlobal();
}

function resetAplikasi() {
    if (document.getElementById('filter-kecamatan')) document.getElementById('filter-kecamatan').value = "";
    if (document.getElementById('filter-topik')) document.getElementById('filter-topik').value = "";
    const elDesa = document.getElementById('filter-desa');
    if (elDesa) {
        elDesa.innerHTML = '<option value="">Semua Desa</option>';
        elDesa.disabled = true;
    }
    resetView();
}

const btnReset = document.getElementById('btn-reset');
if (btnReset) btnReset.addEventListener('click', resetAplikasi);

// ==========================================
// 7. TAB NAVIGATION (LOKASI & KEGIATAN)
// ==========================================
const tabLokasiBtn = document.getElementById('tab-lokasi');
const tabKegiatanBtn = document.getElementById('tab-kegiatan');
if (tabLokasiBtn) tabLokasiBtn.addEventListener('click', () => switchTab('lokasi'));
if (tabKegiatanBtn) tabKegiatanBtn.addEventListener('click', () => switchTab('kegiatan'));

function switchTab(tab) {
    activeTab = tab;
    const tabLokasi = document.getElementById('tab-lokasi');
    const tabKegiatan = document.getElementById('tab-kegiatan');
    const lokasiContent = document.getElementById('lokasi-content');
    const kegiatanContent = document.getElementById('kegiatan-content');

    if (tab === 'lokasi') {
        if (tabLokasi) tabLokasi.classList.add('tab-active');
        if (tabKegiatan) tabKegiatan.classList.remove('tab-active');
        if (lokasiContent) lokasiContent.classList.remove('hidden');
        if (kegiatanContent) kegiatanContent.classList.add('hidden');
    } else {
        if (tabKegiatan) tabKegiatan.classList.add('tab-active');
        if (tabLokasi) tabLokasi.classList.remove('tab-active');
        if (lokasiContent) lokasiContent.classList.add('hidden');
        if (kegiatanContent) kegiatanContent.classList.remove('hidden');
    }
}

// ==========================================
// 8. UI RENDERING & MAP HELPERS
// ==========================================
function updateTampilanGlobal() {
    const terfilter = dapatkanDataTerfilter();
    const kec = document.getElementById('filter-kecamatan')?.value || '';
    const desa = document.getElementById('filter-desa')?.value || '';
    const topik = document.getElementById('filter-topik')?.value || '';

    // Update Angka
    animateValue('stat-sppg', terfilter.filter(s => s.topik === 'sppg').length);
    animateValue('stat-kopdes', terfilter.filter(s => s.topik === 'kopdes' || s.topik === 'kdmp').length);
    animateValue('stat-rumahrj', terfilter.filter(s => s.topik === 'rumah_rj').length);

    const kegFiltered = filterKegiatan(kec, desa);
    animateValue('stat-total-kegiatan', kegFiltered.length);
    animateValue('stat-intel', dataKegiatan.filter(k => k.topik === 'intel').length);
    animateValue('stat-pidum', dataKegiatan.filter(k => k.topik === 'pidum').length);
    animateValue('stat-datun', dataKegiatan.filter(k => k.topik === 'datun').length);

    renderMarkerUnit(terfilter, kegFiltered);
    renderChartKegiatan();
    renderRecentActivities();

    // RENDER KEDUA TABEL SECARA BERSAMAAN AGAR TIDAK HILANG SAAT PINDAH TAB
    if (kec !== "" || topik !== "") {
        const defInfo = document.getElementById('default-info');
        const detInfo = document.getElementById('detail-info');
        const bioPanel = document.getElementById('biodata-panel');

        if (defInfo) defInfo.classList.add('hidden');
        if (detInfo) detInfo.classList.remove('hidden');

        const isAdminContext = isLoggedIn && (userRole === 'admin' || userRole === '');
        if (kec === "" || !isAdminContext) {
            if (bioPanel) bioPanel.style.display = 'none';
        } else {
            if (bioPanel) bioPanel.style.display = 'flex';
        }

        muatDaftarTabel(terfilter);
        muatDaftarKegiatan(kegFiltered);
    } else {
        sembunyikanDetail();
        muatDaftarTabel([]);
        muatDaftarKegiatan([]);
    }
}

function animateValue(id, target) {
    const obj = document.getElementById(id);
    if (!obj) return;
    const start = parseInt(obj.innerText.replace(/,/g, '')) || 0;
    if (start === target) return;

    const duration = 800;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerText = Math.floor(progress * (target - start) + start).toLocaleString();
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

function renderRecentActivities() {
    const container = document.getElementById('recent-activities-list');
    if (!container) return;

    if (dataKegiatan.length === 0) {
        container.innerHTML = '<tr><td colspan="6" class="py-12 text-center text-xs text-gray-400 italic bg-gray-50/20">Belum ada data kegiatan terdaftar.</td></tr>';
        return;
    }

    const parseDateForSort = (str) => {
        if (!str) return 0;
        const s = String(str).trim();
        if (s.includes('/')) {
            const p = s.split('/');
            if (p.length === 3) return new Date(p[2], p[1] - 1, p[0]).getTime();
        }
        return new Date(s).getTime();
    };

    // Sort by date descending
    const sorted = [...dataKegiatan].sort((a, b) => {
        const da = parseDateForSort(a.tanggal);
        const db = parseDateForSort(b.tanggal);
        if (!isNaN(da) && !isNaN(db) && da !== db) return db - da;
        return 0;
    }).slice(0, 5); // Show latest 5

    const colorMap = {
        intel: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        pidum: 'text-red-600 bg-red-50 border-red-100',
        datun: 'text-yellow-600 bg-yellow-50 border-yellow-100'
    };
    const labelMap = { intel: 'Intelijen', pidum: 'Pidum', datun: 'Datun' };

    container.innerHTML = sorted.map(k => {
        const tgl = k.tanggal ? new Date(k.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        const bidang = k.topik || 'intel';
        const kec = k.kecamatan || '-';
        const desa = k.desa || '-';

        const f = k.foto_kegiatan || '';
        const hasF = f && f.startsWith('http');
        const btnF = hasF ? `<a href="${f}" target="_blank" class="w-8 h-8 flex mx-auto items-center justify-center bg-gray-50 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-emerald-500" title="Lihat Foto"><i data-lucide="eye" class="w-4 h-4 stroke-[1.5]"></i></a>` : `<span class="text-xs text-gray-300 flex justify-center">—</span>`;

        return `
            <tr class="hover:bg-gray-50/50 transition-colors">
                <td class="py-4 px-6">
                    <span class="text-[9px] font-black uppercase px-2.5 py-1 rounded-md border ${colorMap[bidang]}">${labelMap[bidang]}</span>
                </td>
                <td class="py-4 px-6">
                    <div class="text-[11px] font-bold text-gray-400 uppercase tracking-tighter">${tgl}</div>
                </td>
                <td class="py-4 px-6">
                    <div class="text-xs font-bold uppercase tracking-tighter ${({intel:'text-emerald-600',pidum:'text-red-600',datun:'text-yellow-600'})[bidang] || 'text-emerald-600'}">${k.jenis_kegiatan || '-'}</div>
                </td>
                <td class="py-4 px-6">
                    <div class="text-sm font-bold text-[#1f2d41] line-clamp-1" title="${k.nama_kegiatan}">${k.nama_kegiatan || '-'}</div>
                </td>
                <td class="py-4 px-6">
                    <div class="text-xs font-bold text-[#00ac69] uppercase tracking-tighter">${kec}, ${desa}</div>
                </td>
                <td class="py-4 px-6 text-center">
                    ${btnF}
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

// ==========================================
// 9. RENDERER TABEL LOKASI & DETAIL
// ==========================================
function updateDetailPanel(data, nKec, nDesa = null) {
    const defInfo = document.getElementById('default-info');
    const detInfo = document.getElementById('detail-info');
    if (defInfo) defInfo.classList.add('hidden');
    if (detInfo) detInfo.classList.remove('hidden');

    const label = nDesa ? "Desa" : "Kecamatan";
    const nama = nDesa || nKec;
    const el = {
        w: document.getElementById('wilayah-nama'),
        p: document.getElementById('pemimpin-nama'),
        j: document.getElementById('pemimpin-jabatan'),
        k: document.querySelector('#pemimpin-kontak span'),
        t: document.getElementById('pemimpin-keterangan'),
        f: document.getElementById('pemimpin-foto')
    };

    if (data && data.nama_pemimpin) {
        const jab = (data.level || '').toLowerCase() === 'kecamatan' ? 'Camat' : 'Lurah / Kades';
        if (el.w) el.w.innerText = `${label} ${data.nama_wilayah}`;
        if (el.p) el.p.innerText = data.nama_pemimpin;
        if (el.j) el.j.innerText = jab;
        if (el.k) el.k.innerText = data.kontak_pemimpin || '-';
        if (el.t) el.t.innerText = data.keterangan || 'Tidak ada keterangan';

        const fotoDir = (data.foto_pemimpin && String(data.foto_pemimpin).length > 5) ? data.foto_pemimpin : `https://ui-avatars.com/api/?name=${encodeURIComponent(data.nama_pemimpin)}&background=00ac69&color=fff`;
        if (el.f) el.f.src = fotoDir;
    } else {
        if (el.w) el.w.innerText = `${label} ${nama}`;
        if (el.p) el.p.innerText = "Data Belum Tersedia";
        if (el.j) el.j.innerText = "-";
        if (el.k) el.k.innerText = "-";
        if (el.t) el.t.innerText = "-";
        if (el.f) el.f.src = `https://ui-avatars.com/api/?name=?&background=ccc&color=fff`;
    }
}

function sembunyikanDetail() {
    const defInfo = document.getElementById('default-info');
    const detInfo = document.getElementById('detail-info');
    if (defInfo) defInfo.classList.remove('hidden');
    if (detInfo) detInfo.classList.add('hidden');
}

function muatDaftarTabel(list) {
    const container = document.getElementById('sppg-list');
    if (!container) return;

    const countEl = document.getElementById('sppg-count');
    if (countEl) countEl.innerText = list.length;

    if (list.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 text-center py-6 border border-dashed rounded-lg bg-gray-50">Tidak ada data terdaftar.</p>`;
        return;
    }

    const buatTabel = (items, judul, warna, topik = '') => {
        if (items.length === 0) return "";
        let head = "";

        if (topik === 'rumah_rj') {
            head = `<tr>
                <th class="py-4 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center w-[40px]">No</th>
                <th class="py-4 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Tersangka</th>
                <th class="py-4 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Pasal</th>
                <th class="py-4 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">JK</th>
                <th class="py-4 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">Usia</th>
                <th class="py-4 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Desa</th>
                <th class="py-4 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Kecamatan</th>
                <th class="py-4 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Kesepakatan</th>
                <th class="py-4 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                <th class="py-4 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">Tahun</th>
            </tr>`;
        } else if (topik === 'kopdes' || topik === 'kdmp') {
            head = `<tr>
                <th class="py-4 px-5 text-[10px] font-bold uppercase text-gray-400 tracking-widest w-[25%]">Nama Unit</th>
                <th class="py-4 px-5 text-[10px] font-bold uppercase text-gray-400 tracking-widest text-center">Kecamatan</th>
                <th class="py-4 px-5 text-[10px] font-bold uppercase text-gray-400 tracking-widest text-center">Desa</th>
                <th class="py-4 px-5 text-[10px] font-bold uppercase text-gray-400 tracking-widest w-[35%]">Alamat Lengkap</th>
            </tr>`;
        } else {
            head = isLoggedIn
                ? `<tr><th class="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-[30%]">Informasi Unit</th><th class="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-[70%]">Alamat Lengkap</th></tr>`
                : `<tr><th class="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-[15%] text-center">Kecamatan</th><th class="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-[15%] text-center">Desa</th><th class="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-[30%]">Nama Unit</th><th class="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-[40%] text-center">Alamat Lengkap</th></tr>`;
        }

        let rows = "";
        items.forEach((u, idx) => {
            if (topik === 'rumah_rj') {
                const nama = u.nama_tersangka || '-';
                const pasal = u.pasal || '-';
                const jk = u.jenis_kelamin || '-';
                const usia = u.usia || '-';
                const kec = u.kecamatan || '-';
                const desa = u.desa || '-';
                const kesepakatan = u.kesepakatan || '-';
                const status = u.status || '-';
                const tahun = u.tahun || '-';
                const badge = status.toLowerCase().includes('berhasil') ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600';

                rows += `<tr class="hover:bg-gray-50/50 border-b border-gray-100 last:border-0 transition-colors text-[11px]">
                    <td class="py-4 px-5 text-gray-400 font-bold text-center">${idx + 1}</td>
                    <td class="py-4 px-5 font-bold text-[#1f2d41]">${nama}</td>
                    <td class="py-4 px-5 text-gray-600">${pasal}</td>
                    <td class="py-4 px-5 text-center">${jk}</td>
                    <td class="py-4 px-5 text-center">${usia}</td>
                    <td class="py-4 px-5 text-purple-600 font-black uppercase tracking-tighter">${desa}</td>
                    <td class="py-4 px-5 text-purple-600 font-black uppercase tracking-tighter">${kec}</td>
                    <td class="py-4 px-5 italic text-gray-500">${kesepakatan}</td>
                    <td class="py-4 px-5">
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${badge}">${status}</span>
                    </td>
                    <td class="py-4 px-5 text-center font-bold text-gray-400">${tahun}</td>
                </tr>`;
            } else if (u.topik === 'kopdes' || u.topik === 'kdmp') {
                const n = u.nama_unit || "-";
                const k = u.kecamatan || "-";
                const d = u.desa || "-";
                const a = u.alamat || "-";

                rows += `<tr class="hover:bg-gray-50/50 border-b border-gray-100 last:border-0 transition-colors">
                    <td class="py-4 px-5 text-sm font-bold text-[#1f2d41]">${n}</td>
                    <td class="py-4 px-5 text-xs font-bold text-gray-400 text-center uppercase tracking-tighter">${k}</td>
                    <td class="py-4 px-5 text-xs font-bold text-gray-500 text-center uppercase tracking-tighter">${d}</td>
                    <td class="py-4 px-5 text-xs text-gray-500 italic leading-relaxed">${a}</td>
                </tr>`;
            } else {
                const n = u.nama_unit || u.nama_kopdes || u.nama || "-";
                const k = u.lokasi_kecamatan || u.kecamatan || "-";
                const d = u.lokasi_desa || u.desa || "-";
                const a = u.alamat || "-";

                if (!isLoggedIn) {
                    rows += `<tr class="hover:bg-gray-50/50 border-b border-gray-100 last:border-0 transition-colors">
                        <td class="py-4 px-6 text-xs font-bold text-gray-400 text-center uppercase tracking-tighter">${k}</td>
                        <td class="py-4 px-6 text-xs font-bold text-gray-500 text-center">${d}</td>
                        <td class="py-4 px-6 text-sm font-bold text-[#1f2d41]">${n}</td>
                        <td class="py-4 px-6 text-xs text-gray-500 italic leading-relaxed">${a}</td>
                    </tr>`;
                } else {
                    rows += `<tr class="hover:bg-gray-50/50 border-b border-gray-100 last:border-0 transition-colors">
                        <td class="py-5 px-6">
                            <div class="text-sm font-black text-[#1f2d41] mb-1">${n}</div>
                        </td>
                        <td class="py-5 px-6">
                            <div class="text-[12px] leading-relaxed text-gray-500">${a}</div>
                        </td>
                    </tr>`;
                }
            }
        });

        return `<div class="mb-8 last:mb-0">
            <h4 class="text-[10px] font-black text-gray-400 uppercase tracking-normal mb-4 flex items-center gap-2">
                <span class="w-1.5 h-4 rounded-full ${warna.replace('border-', 'bg-')}"></span>
                ${judul}
            </h4>
            <div class="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm custom-scrollbar">
                <table class="w-full text-left bg-white min-w-[700px]">
                    <thead class="bg-gray-50/50 border-b border-gray-100">${head}</thead>
                    <tbody class="divide-y divide-gray-100">${rows}</tbody>
                </table>
            </div>
        </div>`;
    };

    container.innerHTML = buatTabel(list.filter(i => i.topik === 'sppg'), "Data SPPG", "border-blue-500", "sppg") +
        buatTabel(list.filter(i => i.topik === 'kdmp' || i.topik === 'kopdes'), "Data KDMP", "border-red-500", "kdmp") +
        buatTabel(list.filter(i => i.topik === 'rumah_rj'), "Data Rumah RJ", "border-purple-500", "rumah_rj");

    if (window.lucide) window.lucide.createIcons();
}

// ==========================================
// 10. RENDERER TABEL KEGIATAN
// ==========================================
function muatDaftarKegiatan(list) {
    const container = document.getElementById('kegiatan-list');
    if (!container) return;

    const countEl = document.getElementById('kegiatan-count');
    if (countEl) countEl.innerText = list.length;

    if (list.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 text-center py-6 border border-dashed rounded-lg bg-gray-50">Belum ada data kegiatan untuk wilayah ini.</p>`;
        return;
    }

    const warnaBidang = { intel: 'border-emerald-500', pidum: 'border-red-500', datun: 'border-yellow-500' };
    const namaBidang = { intel: 'Kegiatan Intel', pidum: 'Kegiatan Pidum', datun: 'Kegiatan Datun' };

    const buatTabelKeg = (items, topik) => {
        if (items.length === 0) return '';
        const head = `<tr class="bg-gray-50/50 border-b border-gray-100">
            <th class="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-[10%]">Tanggal</th>
            <th class="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-[13%]">Jenis Kegiatan</th>
            <th class="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-[20%]">Nama Kegiatan</th>
            <th class="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-[14%]">Pihak Luar</th>
            <th class="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-[15%]">Wilayah</th>
            <th class="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-[15%]">Peserta</th>
            <th class="py-4 px-6 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-[13%] text-center">Foto</th>
        </tr>`;
        let rows = '';
        items.forEach(k => {
            const tgl = k.tanggal ? new Date(k.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
            const nama = k.nama_kegiatan || '-';
            const jenis = k.jenis_kegiatan || '-';
            const lokasi = `${k.kecamatan || '-'}, ${k.desa || '-'}`;
            const pj = k.peserta || '-';
            const pihak = k.pihak_luar || '-';
            const ket = k.keterangan && k.keterangan !== '-' ? `<div class="mt-2 text-[11px] text-gray-400 leading-relaxed border-l-2 border-gray-100 pl-3 italic">${k.keterangan}</div>` : '';

            const fotoUrl = k.foto_kegiatan || '';
            const isUrlValid = fotoUrl.startsWith('http');
            const fotoBtn = isUrlValid ? `<a href="${fotoUrl}" target="_blank" class="w-8 h-8 flex mx-auto items-center justify-center bg-gray-50 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-[#00ac69]" title="Lihat Foto"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg></a>` : `<span class="text-xs text-gray-300 flex justify-center">—</span>`;

            rows += `<tr class="hover:bg-gray-50/50 border-b border-gray-100 last:border-0 transition-colors">
                <td class="py-5 px-6"><div class="text-[11px] font-bold text-gray-400 uppercase tracking-tighter">${tgl}</div></td>
                <td class="py-5 px-6"><div class="text-xs font-bold uppercase tracking-tighter ${({intel:'text-emerald-600',pidum:'text-red-600',datun:'text-yellow-600'})[topik] || 'text-emerald-600'}">${jenis}</div></td>
                <td class="py-5 px-6"><div class="text-sm font-black text-[#1f2d41]">${nama}</div>${ket}</td>
                <td class="py-5 px-6"><div class="text-xs font-medium text-gray-500">${pihak}</div></td>
                <td class="py-5 px-6"><div class="text-xs font-bold text-[#00ac69]">${lokasi}</div></td>
                <td class="py-5 px-6"><div class="text-xs font-bold text-gray-600">${pj}</div></td>
                <td class="py-5 px-6 align-middle">${fotoBtn}</td>
            </tr>`;
        });
        return `<div class="mb-8 last:mb-0">
            <h4 class="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span class="w-1.5 h-4 rounded-full ${warnaBidang[topik].replace('border-', 'bg-')}"></span>
                ${namaBidang[topik]}
            </h4>
            <div class="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
                <table class="w-full text-left bg-white min-w-[600px]">
                    <thead>${head}</thead>
                    <tbody class="divide-y divide-gray-100">${rows}</tbody>
                </table>
            </div>
        </div>`;
    };

    // Sort data terbaru di atas (Berdasarkan tanggal DD/MM/YYYY atau YYYY-MM-DD atau urutan terakhir)
    const parseDateForSort = (str) => {
        if (!str) return 0;
        const s = String(str).trim();
        if (s.includes('/')) {
            const p = s.split('/');
            if (p.length === 3) return new Date(p[2], p[1] - 1, p[0]).getTime();
        }
        return new Date(s).getTime();
    };

    list.forEach((d, i) => d._tmpIdx = i);
    list.sort((a, b) => {
        const da = parseDateForSort(a.tanggal);
        const db = parseDateForSort(b.tanggal);
        if (!isNaN(da) && !isNaN(db) && da !== db) return db - da;
        return b._tmpIdx - a._tmpIdx;
    });

    container.innerHTML = buatTabelKeg(list.filter(k => k.topik === 'intel'), 'intel') +
        buatTabelKeg(list.filter(k => k.topik === 'pidum'), 'pidum') +
        buatTabelKeg(list.filter(k => k.topik === 'datun'), 'datun');

    if (window.lucide) window.lucide.createIcons();
}

// ==========================================
// 11. CHART RENDERER (GRAFIK)
// ==========================================
let chartInstance = null;
function renderChartKegiatan() {
    const canvas = document.getElementById('chart-kegiatan');
    if (!canvas) return;

    if (chartInstance) chartInstance.destroy();

    const list20 = [
        "BAGOR", "BARON", "BERBEK", "GONDANG", "JATIKALEN",
        "KERTOSONO", "LENGKONG", "LOCERET", "NGANJUK", "NGETOS",
        "NGLUYU", "NGRONGGOT", "PACE", "PATIANROWO", "PRAMBON",
        "REJOSO", "SAWAHAN", "SUKOMORO", "TANJUNGANOM", "WILANGAN"
    ];

    // Data structure: dataMap[namaKecamatan][jenisKegiatan] = count
    const dataMap = {};
    list20.forEach(k => { dataMap[k] = {}; });
    
    const jenisSet = new Set();
    const jenisTotalCount = {};

    dataKegiatan.forEach(k => {
        const namaKec = clean.kec(k.kecamatan || '');
        if (!namaKec || !dataMap[namaKec]) return;

        let jenis = (k.jenis_kegiatan || 'Lainnya').trim();
        // Capitalize each word for neatness
        jenis = jenis.replace(/\b\w/g, l => l.toUpperCase());
        
        jenisSet.add(jenis);
        if (!dataMap[namaKec][jenis]) dataMap[namaKec][jenis] = 0;
        dataMap[namaKec][jenis]++;

        if (!jenisTotalCount[jenis]) jenisTotalCount[jenis] = 0;
        jenisTotalCount[jenis]++;
    });

    // Urutkan berdasarkan yang terbanyak
    const uniqueJenis = Array.from(jenisSet).sort((a, b) => jenisTotalCount[b] - jenisTotalCount[a]);
    
    // Palette warnanya
    const colorPalette = [
        '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', 
        '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
        '#d946ef', '#84cc16', '#64748b', '#0ea5e9', '#eab308'
    ];

    const datasets = uniqueJenis.map((jenis, index) => {
        return {
            label: jenis,
            data: list20.map(kec => dataMap[kec][jenis] || 0),
            backgroundColor: colorPalette[index % colorPalette.length],
            borderRadius: 4,
            maxBarThickness: 40
        };
    });

    chartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: list20,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: true,
                    position: 'top',
                    labels: {
                        font: { family: 'Poppins', size: 10 },
                        usePointStyle: true,
                        boxWidth: 8
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: {
                        font: { family: 'Poppins', size: 9 },
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' },
                    ticks: { font: { family: 'Poppins', size: 10 }, stepSize: 1 }
                }
            }
        }
    });

    // Render Summary di bawah Chart
    const summaryContainer = document.getElementById('jenis-kegiatan-summary');
    if (summaryContainer) {
        summaryContainer.innerHTML = '';
        uniqueJenis.forEach((jenis, index) => {
            const count = jenisTotalCount[jenis];
            const color = colorPalette[index % colorPalette.length];
            summaryContainer.innerHTML += `
                <div class="bg-white border border-gray-100 rounded-lg p-4 flex flex-col justify-center items-center hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                    <h4 class="text-2xl font-black text-[#1f2d41]">${count}</h4>
                    <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center mt-1">${jenis}</p>
                </div>
            `;
        });
    }
}

// ==========================================
// 12. PENGGAMBARAN PETA (LAYERS)
// ==========================================
function gayaPeta() {
    return { fillColor: '#bbf2ce', weight: 1, color: '#ffffff', fillOpacity: 0.5 };
}

function fungsiInteraksi(f, l) {
    l.on({
        mouseover: (e) => e.target.setStyle({ fillOpacity: 0.7, weight: 2, color: '#00ac69' }),
        mouseout: (e) => { if (geojsonLayer) geojsonLayer.resetStyle(e.target); },
        click: (e) => {
            const n = e.target.feature.properties.NAMOBJ || e.target.feature.properties.WADMKC;
            const filterKec = document.getElementById('filter-kecamatan');
            if (filterKec) {
                filterKec.value = n;
                filterKec.dispatchEvent(new Event('change'));
                const section = document.getElementById('data-section');
                if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });
}

function buatMaskerLuar(geoJSON) {
    const world = [[-90, -180], [-90, 180], [90, 180], [90, -180]];
    const holes = [];
    geoJSON.features.forEach(f => {
        const type = f.geometry.type;
        const coords = f.geometry.coordinates;
        if (type === 'Polygon') {
            coords.forEach(ring => holes.push(ring.map(c => [c[1], c[0]])));
        } else if (type === 'MultiPolygon') {
            coords.forEach(poly => poly.forEach(ring => holes.push(ring.map(c => [c[1], c[0]]))));
        }
    });
    L.polygon([world, ...holes], { fillColor: '#f8f9fa', fillOpacity: 0.9, stroke: false, interactive: false, className: 'mask-overlay' }).addTo(map);
}

function siramWarnaKePeta() {
    if (!geojsonLayer) return;
    geojsonLayer.eachLayer(l => {
        const p = l.feature.properties;
        const namaGeo = clean.kec(p.NAMOBJ || p.WADMKC);
        const idGeo = String(p.KDBBPS || p.KDPBPS || p.KDCPUM || p.ID_BPS || '');

        const info = dataWilayah.find(w => {
            if ((w.level || '').toLowerCase() !== 'kecamatan') return false;
            const idSheet = w.id_wilayah ? String(w.id_wilayah) : '';
            const namaSheet = clean.kec(w.nama_wilayah);
            return (idSheet && idGeo && idSheet === idGeo) || namaSheet === namaGeo;
        });

        const units = dataSPPG.filter(s => clean.kec(s.lokasi_kecamatan || s.kecamatan || '') === namaGeo);
        const kegKec = dataKegiatan.filter(k => clean.kec(k.kecamatan || '') === namaGeo);

        const sppgCount = units.filter(u => u.topik === 'sppg').length;
        const kopdesCount = units.filter(u => u.topik === 'kdmp' || u.topik === 'kopdes').length;
        const rumahRjCount = units.filter(u => u.topik === 'rumah_rj').length;

        let kegLines = '';
        const warnaBidang = { intel: '#10b981', pidum: '#ef4444', datun: '#eab308' };
        ['intel', 'pidum', 'datun'].forEach(bid => {
            const items = kegKec.filter(k => k.topik === bid);
            if (items.length > 0) {
                const grouped = {};
                items.forEach(k => {
                    const nama = k.jenis_kegiatan || '-';
                    grouped[nama] = (grouped[nama] || 0) + 1;
                });
                const detail = Object.entries(grouped).map(([nama, count]) => `${count} <b>${nama}</b>`).join(', ');
                const label = bid.charAt(0).toUpperCase() + bid.slice(1);
                kegLines += `<span style="color:${warnaBidang[bid]}; font-size:10px; display:block; margin-top:1px;">${label}: ${detail}</span>`;
            }
        });

        const tooltipHtml = `<div style="text-align:left; white-space:nowrap;">
            <b style="font-size:13px; display:block; text-align:center; margin-bottom:4px;">Kec. ${namaGeo}</b>
            <div style="display:flex; gap:8px; font-size:10px; color:#6b7280; justify-content:center;">
                <span>${sppgCount} SPPG</span><span>|</span><span>${kopdesCount} KDMP</span><span>|</span><span>${rumahRjCount} Rumah RJ</span>
            </div>
            ${kegLines ? '<div style="border-top:1px solid #e5e7eb; margin-top:4px; padding-top:4px; white-space:normal; max-width:320px;">' + kegLines + '</div>' : ''}
        </div>`;

        l.feature.properties.data_tambahan = info || { nama_wilayah: namaGeo };
        l.bindTooltip(tooltipHtml, {
            sticky: true,
            className: 'custom-tooltip',
            pane: 'tooltipPane' // Agar informasi wilayah selalu SANGAT DI DEPAN
        });
    });
}

// --- Helper Geometris untuk Mencegah Titik Terlempar ---
function isInsideNganjuk(lat, lng) {
    // Range kasar Kabupaten Nganjuk
    return lat >= -7.9 && lat <= -7.4 && lng >= 111.7 && lng <= 112.2;
}

function getCentroidFromGeoJSON(namaKec) {
    if (!geojsonLayer || !namaKec) return null;
    let matchLayer = null;
    geojsonLayer.eachLayer(layer => {
        const prop = layer.feature.properties;
        const n = clean.kec(prop.NAMOBJ || prop.WADMKC);
        if (n === clean.kec(namaKec)) matchLayer = layer;
    });
    if (matchLayer) {
        const center = matchLayer.getBounds().getCenter();
        return { lat: center.lat, lng: center.lng };
    }
    return null;
}

function pointInPolygon(lat, lng, poly) {
    // Algoritma Ray Casting untuk cek titik di dalam polygon (GeoJSON format: [lng, lat])
    let x = lng, y = lat;
    let Inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        let xi = poly[i][0], yi = poly[i][1];
        let xj = poly[j][0], yj = poly[j][1];
        let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) Inside = !Inside;
    }
    return Inside;
}

function getSmartJitter(lat, lng, namaKec) {
    const scale = 0.003; // ~300 meter untuk pemisahan titik
    let newLat = lat + (Math.random() - 0.5) * scale;
    let newLng = lng + (Math.random() - 0.5) * scale;

    // Jika geojsonLayer tersedia, cari polygon kecamatan yang sesuai
    if (geojsonLayer && namaKec) {
        let matchingFeature = null;
        geojsonLayer.eachLayer(layer => {
            const prop = layer.feature.properties;
            const n = clean.kec(prop.NAMOBJ || prop.WADMKC);
            if (n === clean.kec(namaKec)) matchingFeature = layer.feature;
        });

        if (matchingFeature) {
            const coords = matchingFeature.geometry.coordinates;
            const type = matchingFeature.geometry.type;
            
            // Cek apakah titik baru ada di dalam (hanya untuk Polygon sederhana / ring pertama)
            let isSafe = false;
            try {
                if (type === 'Polygon') {
                    isSafe = pointInPolygon(newLat, newLng, coords[0]);
                } else if (type === 'MultiPolygon') {
                    isSafe = coords.some(poly => pointInPolygon(newLat, newLng, poly[0]));
                }
            } catch (e) { isSafe = true; } // Fallback jika geometri kompleks

            // Jika terlempar keluar kecamatan, kembalikan ke titik tengah (center) agar aman
            if (!isSafe) return { lat, lng };
        }
    }
    return { lat: newLat, lng: newLng };
}

function renderMarkerUnit(list, listKeg = null) {
    if (!markerUnitsLayer) return;
    markerUnitsLayer.clearLayers();

    const warnaTopik = {
        sppg: '#3b82f6',
        kopdes: '#ef4444',
        kdmp: '#ef4444',
        rumah_rj: '#a855f7',
        intel: '#10b981',
        pidum: '#ef4444',
        datun: '#eab308'
    };

    list.forEach(u => {
        try {
            const topic = (u.topik || "kopdes").toLowerCase().trim();
            const color = warnaTopik[topic] || warnaTopik['kdmp'] || '#ef4444';
            const defaultName = topic === 'rumah_rj' ? 'Rumah RJ' : (topic === 'sppg' ? 'SPPG' : (topic === 'kdmp' || topic === 'kopdes' ? 'KDMP' : 'Unit'));
            const mName = u.nama_unit || u.nama || defaultName;

            const d = clean.desa(u.desa || u.lokasi_desa || "");
            const k = clean.kec(u.kecamatan || u.lokasi_kecamatan || "");

            let finalLat, finalLng;

            // 1. Validasi Koordinat Asli
            const rawLat = u.latitude || u.lat;
            const rawLng = u.longitude || u.lng;
            const latVal = parseFloat(String(rawLat || "").replace(',', '.'));
            const lngVal = parseFloat(String(rawLng || "").replace(',', '.'));

            // Deteksi koordinat terbalik (Lng masuk ke Lat atau sebaliknya)
            let useDirect = !isNaN(latVal) && !isNaN(lngVal) && latVal !== 0;
            if (useDirect && !isInsideNganjuk(latVal, lngVal)) {
                // Cek jika dibalik ternyata valid
                if (isInsideNganjuk(lngVal, latVal)) {
                    // Sembuhkan otomatis jika terbalik
                    finalLat = lngVal;
                    finalLng = latVal;
                } else {
                    useDirect = false; // Memang koordinat luar wilayah
                }
            } else if (useDirect) {
                finalLat = latVal;
                finalLng = lngVal;
            }

            // 2. Fallback ke Pusat Desa jika koordinat tidak valid/luar wilayah
            if (!useDirect) {
                let ref = semuaDataDesa.find(item => {
                    return clean.desa(item.nama_desa) === d && clean.kec(item.kecamatan) === k;
                });
                if (!ref) ref = semuaDataDesa.find(item => clean.kec(item.kecamatan) === k);

                if (ref && ref.lat && ref.lng) {
                    finalLat = parseFloat(ref.lat);
                    finalLng = parseFloat(ref.lng);
                } else {
                    // Fallback ke centroid kecamatan dari GeoJSON
                    const centroid = getCentroidFromGeoJSON(k);
                    if (centroid) {
                        finalLat = centroid.lat;
                        finalLng = centroid.lng;
                    } else {
                        finalLat = -7.6044;
                        finalLng = 111.9044;
                    }
                }
            }

            // 3. Smart Jitter (Keep inside kecamatan boundary)
            const jittered = getSmartJitter(finalLat, finalLng, k);

            // 4. Final safety gate — skip jika masih di luar Nganjuk
            if (!isInsideNganjuk(jittered.lat, jittered.lng)) {
                console.warn('Circle marker SKIP (di luar Nganjuk):', mName, jittered.lat, jittered.lng);
                return;
            }

            L.circleMarker([jittered.lat, jittered.lng], {
                radius: 3,
                fillColor: color,
                color: "#fff",
                weight: 1,
                fillOpacity: 1,
                pane: 'unitPane'
            }).bindTooltip(`<b>${mName}</b><br><span style="font-size:10px; color:#666;">${k} - ${d}</span>`, {
                direction: 'top',
                pane: 'tooltipPane'
            }).addTo(markerUnitsLayer);

        } catch (err) {
            console.error("Marker Error:", err);
        }
    });

    // PASTIKAN LAYER MARKER SELALU DI ATAS POLIGON KECAMATAN
    if (markerUnitsLayer) {
        markerUnitsLayer.addTo(map);
        if (typeof markerUnitsLayer.eachLayer === 'function') {
            markerUnitsLayer.eachLayer(layer => {
                if (typeof layer.bringToFront === 'function') layer.bringToFront();
            });
        }
    }

    const dataKeg = listKeg || dataKegiatan;
    dataKeg.forEach(kg => {
        try {
            const d = clean.desa(kg.desa || "");
            const k = clean.kec(kg.kecamatan || "");

            // 1. Cari koordinat desa dari referensi
            let ref = semuaDataDesa.find(item => clean.desa(item.nama_desa) === d && clean.kec(item.kecamatan) === k)
                   || semuaDataDesa.find(item => clean.kec(item.kecamatan) === k);

            let baseLat, baseLng;
            if (ref && ref.lat && ref.lng) {
                baseLat = parseFloat(ref.lat);
                baseLng = parseFloat(ref.lng);
            } else {
                // Fallback ke centroid kecamatan dari GeoJSON
                const centroid = getCentroidFromGeoJSON(k);
                if (centroid) {
                    baseLat = centroid.lat;
                    baseLng = centroid.lng;
                } else {
                    baseLat = -7.6044;
                    baseLng = 111.9044;
                }
            }

            // 2. Validasi koordinat dasar
            if (!isInsideNganjuk(baseLat, baseLng)) {
                console.warn('Triangle SKIP (di luar Nganjuk):', kg.jenis_kegiatan, baseLat, baseLng);
                return;
            }

            // 3. Smart Jitter (gunakan fungsi yang sama dengan circle marker)
            const jittered = getSmartJitter(baseLat, baseLng, k);

            // 4. Final safety gate
            if (!isInsideNganjuk(jittered.lat, jittered.lng)) {
                jittered.lat = baseLat;
                jittered.lng = baseLng;
            }

            const color = warnaTopik[kg.topik] || '#10b981';
            const nama = kg.jenis_kegiatan || '-';
            const bidang = kg.topik ? kg.topik.charAt(0).toUpperCase() + kg.topik.slice(1) : '';

            const triangleHtml = `<svg width="6" height="6" viewBox="0 0 6 6" style="display:block;"><path d="M 3 0 L 6 6 L 0 6 Z" fill="${color}" fill-opacity="0.8" stroke="${color}" stroke-width="0.5" /></svg>`;
            const triangleIcon = L.divIcon({
                html: triangleHtml,
                className: 'triangle-marker',
                iconSize: [6, 6],
                iconAnchor: [3, 3]
            });

            L.marker([jittered.lat, jittered.lng], {
                icon: triangleIcon
            }).bindTooltip(`<b style="color:${color}">[${bidang}]</b> ${nama}`, { direction: 'top' }).addTo(markerUnitsLayer);
        } catch (err) {
            console.error('Triangle Marker Error:', err);
        }
    });
}

async function muatGeoJSONNganjuk() {
    try {
        const res = await fetch('data/kecamatan_nganjuk.geojson');
        const geoJSON = await res.json();
        buatMaskerLuar(geoJSON);
        geojsonLayer = L.geoJson(geoJSON, { style: gayaPeta, onEachFeature: fungsiInteraksi }).addTo(map);
        map.fitBounds(geojsonLayer.getBounds());

        const filterKec = document.getElementById('filter-kecamatan');
        if (filterKec) {
            const list = Array.from(new Set(geoJSON.features.map(f => f.properties.NAMOBJ || f.properties.WADMKC))).sort();
            list.forEach(k => { if (k) filterKec.innerHTML += `<option value="${k}">${k}</option>`; });
        }
    } catch (e) { console.error("GeoJSON Error", e); }
}

async function muatTitikDesa() {
    try {
        const res = await fetch('data/desa_nganjuk.json');
        semuaDataDesa = await res.json();
    } catch (e) { console.warn("Desa JSON missing."); }
}

// ==========================================
// 13. TAMBAH DATA (SPPG/KOPDES & KEGIATAN)
// ==========================================
function showFormModal(modal, box, show) {
    if (show) {
        modal.classList.remove('hidden', 'opacity-0');
        modal.classList.add('flex');
        setTimeout(() => box.classList.remove('scale-95'), 10);
    } else {
        modal.classList.add('opacity-0');
        box.classList.add('scale-95');
        setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
    }
}

function initModalTambahUnit() {
    const btnBuka = document.getElementById('sidebar-tambah-unit');
    const modal = document.getElementById('tambah-modal');
    const box = document.getElementById('tambah-box');
    const form = document.getElementById('form-tambah-unit');
    if (!btnBuka || !modal || !form) return;

    const selKec = document.getElementById('input-kecamatan');
    const selDesa = document.getElementById('input-desa');
    const selTopik = document.getElementById('input-topik');
    const divSK = document.getElementById('field-sk-ahu');
    const divPJ = document.getElementById('field-pj');
    const skInput = document.getElementById('input-sk-ahu');

    btnBuka.addEventListener('click', () => {
        selKec.innerHTML = '<option value="">-- Pilih --</option>';
        [...new Set(semuaDataDesa.map(d => d.kecamatan))].sort().forEach(k => {
            selKec.innerHTML += `<option value="${k}">${k}</option>`;
        });
        selDesa.innerHTML = '<option value="">-- Pilih --</option>';
        selDesa.disabled = true;
        
        // Reset fields and visibility
        divSK.classList.add('hidden');
        divPJ.classList.remove('hidden');
        
        document.getElementById('tambah-error').classList.add('hidden');
        document.getElementById('tambah-success').classList.add('hidden');
        showFormModal(modal, box, true);
    });

    document.getElementById('btn-close-tambah')?.addEventListener('click', () => showFormModal(modal, box, false));
    document.getElementById('btn-batal-tambah')?.addEventListener('click', () => showFormModal(modal, box, false));

    selTopik.addEventListener('change', () => {
        if (selTopik.value === 'kopdes') {
            divSK.classList.add('hidden');
            divPJ.classList.add('hidden');
            skInput.required = false;
        } else {
            divSK.classList.add('hidden');
            divPJ.classList.remove('hidden');
            skInput.required = false;
        }
    });

    selKec.addEventListener('change', () => {
        const kec = selKec.value;
        selDesa.innerHTML = '<option value="">-- Pilih --</option>';
        if (!kec) { selDesa.disabled = true; return; }
        selDesa.disabled = false;
        semuaDataDesa.filter(d => clean.kec(d.kecamatan) === clean.kec(kec))
            .sort((a, b) => a.nama_desa.localeCompare(b.nama_desa))
            .forEach(d => selDesa.innerHTML += `<option value="${d.nama_desa}">${d.nama_desa}</option>`);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-tambah');
        const err = document.getElementById('tambah-error');
        const ok = document.getElementById('tambah-success');

        btn.innerText = 'Menyimpan...';
        btn.disabled = true;
        err.classList.add('hidden');
        ok.classList.add('hidden');

        try {
            const payload = {
                nama_unit: document.getElementById('input-nama-unit').value,
                alamat: document.getElementById('input-alamat').value
            };

            if (selTopik.value === 'kopdes') {
                payload.kecamatan = selKec.value;
                payload.desa = selDesa.value;
            } else {
                payload.lokasi_kecamatan = selKec.value;
                payload.lokasi_desa = selDesa.value;
                payload.penanggung_jawab = document.getElementById('input-pj').value || '-';
            }

            const { error } = await dbClient.from('data_' + selTopik.value).insert([payload]);

            if (!error) {
                ok.classList.remove('hidden');
                form.reset();
                await ambilDataSheet(); // me-refresh data global
                setTimeout(() => showFormModal(modal, box, false), 1500);
            } else {
                throw new Error(error.message || 'Gagal menyimpan data.');
            }
        } catch (e) {
            err.innerText = e.message || 'Koneksi error.';
            err.classList.remove('hidden');
        }
        btn.innerText = 'Simpan';
        btn.disabled = false;
    });
}

function initModalTambahKegiatan() {
    const btnBuka = document.getElementById('sidebar-tambah-kegiatan');
    const modal = document.getElementById('kegiatan-modal');
    const box = document.getElementById('kegiatan-box');
    const form = document.getElementById('form-tambah-kegiatan');
    if (!btnBuka || !modal || !form) return;

    const selKec = document.getElementById('input-keg-kecamatan');
    const selDesa = document.getElementById('input-keg-desa');
    const selTopik = document.getElementById('input-keg-bidang');

    btnBuka.addEventListener('click', () => {
        selKec.innerHTML = '<option value="">-- Pilih --</option>';
        [...new Set(semuaDataDesa.map(d => d.kecamatan))].sort().forEach(k => {
            selKec.innerHTML += `<option value="${k}">${k}</option>`;
        });
        selDesa.innerHTML = '<option value="">-- Pilih --</option>';
        selDesa.disabled = true;

        if (['intel', 'pidum', 'datun'].includes(userRole)) {
            selTopik.value = userRole;
            selTopik.disabled = true;
            selTopik.classList.add('bg-gray-100', 'cursor-not-allowed', 'text-gray-500');
            selTopik.classList.remove('bg-gray-50', 'text-gray-700', 'focus:border-[#00ac69]');
        } else if (userRole === 'admin' || userRole === '') {
            selTopik.value = 'intel';
            selTopik.disabled = false;
            selTopik.classList.remove('bg-gray-100', 'cursor-not-allowed', 'text-gray-500');
            selTopik.classList.add('bg-gray-50', 'text-gray-700', 'focus:border-[#00ac69]');
        }

        document.getElementById('kegiatan-error').classList.add('hidden');
        document.getElementById('kegiatan-success').classList.add('hidden');
        showFormModal(modal, box, true);
    });

    document.getElementById('btn-close-kegiatan')?.addEventListener('click', () => showFormModal(modal, box, false));
    document.getElementById('btn-batal-kegiatan')?.addEventListener('click', () => showFormModal(modal, box, false));

    selKec.addEventListener('change', () => {
        const kec = selKec.value;
        selDesa.innerHTML = '<option value="">-- Pilih --</option>';
        if (!kec) { selDesa.disabled = true; return; }
        selDesa.disabled = false;
        semuaDataDesa.filter(d => clean.kec(d.kecamatan) === clean.kec(kec))
            .sort((a, b) => a.nama_desa.localeCompare(b.nama_desa))
            .forEach(d => selDesa.innerHTML += `<option value="${d.nama_desa}">${d.nama_desa}</option>`);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-kegiatan');
        const err = document.getElementById('kegiatan-error');
        const ok = document.getElementById('kegiatan-success');

        btn.innerText = 'Mengunggah & Menyimpan...';
        btn.disabled = true;
        err.classList.add('hidden');
        ok.classList.add('hidden');

        try {
            const fileInput = document.getElementById('input-keg-foto');
            const file = fileInput.files[0];
            let oldUrl = '';

            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const { data: uploadData, error: uploadError } = await dbClient.storage
                    .from('foto_kegiatan')
                    .upload(fileName, file);

                if (uploadError) {
                    throw new Error('Gagal mengunggah foto.');
                }

                const { data: publicUrlData } = dbClient.storage
                    .from('foto_kegiatan')
                    .getPublicUrl(fileName);

                oldUrl = publicUrlData.publicUrl;
            }

            const payload = {
                tanggal: document.getElementById('input-keg-tanggal').value,
                jenis_kegiatan: document.getElementById('input-keg-jenis').value,
                nama_kegiatan: document.getElementById('input-keg-nama').value,
                kecamatan: selKec.value,
                desa: selDesa.value,
                pihak_luar: document.getElementById('input-keg-pihakluar').value || '-',
                peserta: document.getElementById('input-keg-pj').value || '-',
                foto_kegiatan: oldUrl,
                keterangan: document.getElementById('input-keg-ket').value || '-'
            };

            const { error } = await dbClient.from('data_' + selTopik.value.toLowerCase()).insert([payload]);

            if (!error) {
                ok.classList.remove('hidden');
                form.reset();
                await ambilDataSheet(); // me-refresh data global
                setTimeout(() => showFormModal(modal, box, false), 1500);
            } else {
                throw new Error(error.message || 'Gagal menyimpan data.');
            }
        } catch (e) {
            err.innerText = e.message || 'Koneksi error.';
            err.classList.remove('hidden');
        }
        btn.innerText = 'Simpan';
        btn.disabled = false;
    });
}

// ==========================================
// 14. BOOTSTRAP (RUN APP)
// ==========================================
async function jalankanAplikasi() {
    cekStatusAkses();
    initOverlayLogin();
    initModalTambahUnit();
    initModalTambahKegiatan();

    await muatGeoJSONNganjuk();
    await muatTitikDesa();
    await ambilDataSheet();

    // Initialize icons
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

jalankanAplikasi();