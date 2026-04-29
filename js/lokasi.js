// lokasi_page.js — Logic for SPPG and KOPDES Pages
// const urlAPI = ... removed for Supabase
// const dbClient = window.supabaseClient; // Removed to access window.supabaseClient directly in functions

let TOPIK = '';
let TOPIK_LABEL = '';
let TOPIK_COLOR = '';
let semuaDataDesa = [];
let dataList = [];
let filteredData = [];

const clean = {
    kec: (n) => n ? String(n).replace(/^(kecamatan|kec\.)\s*/i, '').trim().toUpperCase() : "",
    desa: (n) => n ? String(n).replace(/^(desa|kelurahan|kel\.)\s*/i, '').trim().toUpperCase() : ""
};

const isLoggedIn = localStorage.getItem('nganjukGis_isLoggedIn') === 'true';
const userRole = localStorage.getItem('nganjukGis_role') || '';

function initLokasi(topik, label, color) {
    TOPIK = topik;
    TOPIK_LABEL = label;
    TOPIK_COLOR = color;

    const isGuest = !isLoggedIn;
    const isAdmin = isLoggedIn && (userRole === 'admin' || userRole === '');
    const isIntel = isLoggedIn && userRole === 'intel';
    const isPidum = isLoggedIn && userRole === 'pidum';
    const isDatun = isLoggedIn && userRole === 'datun';
    const isBidangRole = isIntel || isPidum || isDatun;

    // Redirect ONLY if logged in but not an Admin
    if (isLoggedIn && !isAdmin) {
        window.location.href = 'index.html';
        return;
    }

    // Login status
    if (!isGuest) {
        const el = document.getElementById('login-status');
        if (el) el.classList.remove('hidden');
        const roleLabel = document.getElementById('role-label');
        if (roleLabel) roleLabel.textContent = (userRole === '' ? 'ADMIN' : userRole.toUpperCase());
        const sidebarAdmin = document.getElementById('sidebar-admin-only');
        if (sidebarAdmin) sidebarAdmin.classList.remove('hidden');
    }

    // Hide/Show Sidebar Links
    const baseNav = document.querySelector('aside nav');
    if (baseNav) {
        const sideIntel = baseNav.querySelector('a[href="intel.html"]');
        const sidePidum = baseNav.querySelector('a[href="pidum.html"]');
        const sideDatun = baseNav.querySelector('a[href="datun.html"]');
        const sideSppg = baseNav.querySelector('a[href="sppg.html"]');
        const sideKopdes = baseNav.querySelector('a[href="kdmp.html"]');
        const sideRumahRJ = baseNav.querySelector('a[href="rumah_rj.html"]');

        if (sideIntel) sideIntel.classList.toggle('hidden', !(isGuest || isAdmin || isIntel));
        if (sidePidum) sidePidum.classList.toggle('hidden', !(isGuest || isAdmin || isPidum));
        if (sideDatun) sideDatun.classList.toggle('hidden', !(isGuest || isAdmin || isDatun));
        if (sideSppg) sideSppg.classList.toggle('hidden', !(isGuest || isAdmin));
        if (sideKopdes) sideKopdes.classList.toggle('hidden', !(isGuest || isAdmin));
        if (sideRumahRJ) sideRumahRJ.classList.toggle('hidden', !(isGuest || isAdmin));

        if (sideSppg && sideSppg.parentElement && sideSppg.parentElement.parentElement) {
            sideSppg.parentElement.parentElement.classList.toggle('hidden', !(isGuest || isAdmin));
        }
        if (sideIntel && sideIntel.parentElement && sideIntel.parentElement.parentElement) {
            sideIntel.parentElement.parentElement.classList.toggle('hidden', !(isGuest || isAdmin || isBidangRole));
        }
    }

    // Init filters
    initFilters();
    loadDesa();
    loadData();
}

async function loadDesa() {
    try {
        const res = await fetch('data/desa_nganjuk.json');
        semuaDataDesa = await res.json();
        
        // Populate Kecamatan Filter
        const selKec = document.getElementById('filter-kecamatan');
        if (selKec) {
            const list = [...new Set(semuaDataDesa.map(d => d.kecamatan))].sort();
            list.forEach(k => selKec.innerHTML += `<option value="${k}">${k}</option>`);
        }
    } catch (e) { console.warn('Desa JSON missing'); }
}

async function loadData() {
    try {
        const client = window.supabaseClient;
        const table = (TOPIK === 'rumah_rj' ? 'daftar_rumahrj' : 'data_' + TOPIK);
        console.log('Fetching data from table:', table);
        
        const { data, error } = await client.from(table).select('*');
        
        if (error) {
            console.error('Supabase Error details:', error);
            throw error;
        }
        
        console.log('Data received:', data ? data.length : 0, 'rows');
        dataList = data || [];

        // Populate Tahun Filter if exists
        const selTahun = document.getElementById('filter-tahun');
        if (selTahun) {
            const listTahun = [...new Set(dataList.map(d => d.tahun))].filter(t => t).sort((a, b) => b - a);
            selTahun.innerHTML = '<option value="">Semua Tahun</option>';
            listTahun.forEach(t => selTahun.innerHTML += `<option value="${t}">${t}</option>`);
        }

        applyFilter();
    } catch (e) { console.warn('Supabase Error:', e); }
}

function initFilters() {
    const selKec = document.getElementById('filter-kecamatan');
    const selDesa = document.getElementById('filter-desa');
    const selTopik = document.getElementById('filter-topik');

    if (selKec) {
        selKec.addEventListener('change', () => {
            const kec = selKec.value;
            if (selDesa) {
                selDesa.innerHTML = '<option value="">Semua Desa</option>';
                if (!kec) {
                    selDesa.disabled = true;
                } else {
                    selDesa.disabled = false;
                    semuaDataDesa.filter(d => d.kecamatan === kec)
                        .sort((a, b) => a.nama_desa.localeCompare(b.nama_desa))
                        .forEach(d => selDesa.innerHTML += `<option value="${d.nama_desa}">${d.nama_desa}</option>`);
                }
            }
            applyFilter();
        });
    }

    if (selDesa) selDesa.addEventListener('change', applyFilter);
    const selTahun = document.getElementById('filter-tahun');
    if (selTahun) selTahun.addEventListener('change', applyFilter);

    if (selTopik) {
        selTopik.innerHTML += `<option value="rumah_rj">Rumah RJ</option>`;
        selTopik.value = TOPIK;
        selTopik.addEventListener('change', () => {
            if (selTopik.value !== TOPIK) {
                window.location.href = selTopik.value + '.html';
            }
        });
    }
}

function applyFilter() {
    const kec = document.getElementById('filter-kecamatan')?.value || '';
    const desa = document.getElementById('filter-desa')?.value || '';
    const tahun = document.getElementById('filter-tahun')?.value || '';
    
    filteredData = dataList.filter(d => {
        const dKec = d.lokasi_kecamatan || d.kecamatan || '';
        const dDesa = d.lokasi_desa || d.desa || d.alamat || '';
        const dTahun = d.tahun ? d.tahun.toString() : '';
        
        const qKec = clean.kec(kec);
        const qDesa = clean.desa(desa);
        const targetKec = clean.kec(dKec);
        const targetDesa = clean.desa(dDesa);
        
        const matchKec = !qKec || targetKec.includes(qKec) || qKec.includes(targetKec);
        const matchDesa = !qDesa || targetDesa.includes(qDesa) || qDesa.includes(targetDesa);
        const matchTahun = !tahun || dTahun === tahun;
        
        return matchKec && matchDesa && matchTahun;
    });

    renderTable();
}

function renderTable() {
    const body = document.getElementById('data-body');
    const empty = document.getElementById('empty-state');
    const countEl = document.getElementById('total-count');
    
    if (countEl) countEl.textContent = filteredData.length;

    if (filteredData.length === 0) {
        if (body) body.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');

    if (body) {
        body.innerHTML = filteredData.map((d, i) => {
            if (TOPIK === 'rumah_rj') {
                const nama = d.nama_tersangka || '-';
                const pasal = d.pasal || '-';
                const jk = d.jenis_kelamin || '-';
                const usia = d.usia || '-';
                const pekerjaan = d.pekerjaan || '-';
                const kec = d.kecamatan || '-';
                const desa = d.desa || '-';
                const alamat = d.alamat || '-';
                const kesepakatan = d.kesepakatan || '-';
                const status = d.status || '-';
                const tahun = d.tahun || '-';

                return `<tr class="hover:bg-gray-50 transition border-b border-gray-100 last:border-0 text-[11px]">
                    <td class="py-3 px-4 text-gray-400 font-bold text-center">${i + 1}</td>
                    <td class="py-3 px-4 font-bold text-[#1f2d41]">${nama}</td>
                    <td class="py-3 px-4 text-gray-600">${pasal}</td>
                    <td class="py-3 px-4 text-center">${jk}</td>
                    <td class="py-3 px-4 text-center">${usia}</td>
                    <td class="py-3 px-4">${pekerjaan}</td>
                    <td class="py-3 px-4 text-purple-600 font-bold uppercase tracking-tighter">${desa}</td>
                    <td class="py-3 px-4 text-purple-600 font-bold uppercase tracking-tighter">${kec}</td>
                    <td class="py-3 px-4 text-gray-400 max-w-[150px] truncate" title="${alamat}">${alamat}</td>
                    <td class="py-3 px-4 italic text-gray-500">${kesepakatan}</td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${status.toLowerCase().includes('berhasil') ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}">
                            ${status}
                        </span>
                    </td>
                    <td class="py-3 px-4 text-center font-bold text-gray-400">${tahun}</td>
                </tr>`;
            }

            const nama = d.nama_unit || d.nama_kopdes || d.nama || '-';
            const kec = d.lokasi_kecamatan || d.kecamatan || '-';
            const desa = d.lokasi_desa || d.desa || '-';
            const alamat = d.alamat || '-';
            
            if (TOPIK === 'kopdes') {
                return `<tr class="hover:bg-gray-50 transition border-b border-gray-100 last:border-0">
                    <td class="py-4 px-5 text-xs text-gray-400 font-bold text-center">${i + 1}</td>
                    <td class="py-4 px-5 font-bold text-[#1f2d41] text-sm">${nama}</td>
                    <td class="py-4 px-5 text-xs text-red-600 font-black uppercase tracking-tighter text-center">${kec}</td>
                    <td class="py-4 px-5 text-xs font-bold text-gray-500 uppercase tracking-tighter text-center">${desa}</td>
                    <td class="py-4 px-5 text-xs text-gray-500 italic leading-relaxed">${alamat}</td>
                </tr>`;
            }

            return `<tr class="hover:bg-gray-50 transition border-b border-gray-100 last:border-0">
                <td class="py-4 px-5 text-xs text-gray-400 font-bold">${i + 1}</td>
                <td class="py-4 px-5">
                    <div class="text-sm font-bold text-[#1f2d41]">${nama}</div>
                </td>
                <td class="py-4 px-5 text-xs ${TOPIK === 'sppg' ? 'text-blue-600' : 'text-red-600'} font-bold uppercase tracking-tighter">${kec}</td>
                <td class="py-4 px-5 text-xs font-bold text-gray-500">${desa}</td>
                <td class="py-4 px-5 text-xs text-gray-400 leading-relaxed">${alamat}</td>
            </tr>`;
        }).join('');
    }

    if (window.lucide) window.lucide.createIcons();
}
