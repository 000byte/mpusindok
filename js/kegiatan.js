// kegiatan.js — Shared Logic for Intel/Pidum/Datun Pages
// const urlAPI = ... deleted for Supabase
const dbClient = window.supabaseClient;

let BIDANG = '';
let BIDANG_LABEL = '';
let BIDANG_COLOR = '';
let semuaDataDesa = [];
let dataList = [];
let deleteRowId = '';

const isLoggedIn = localStorage.getItem('nganjukGis_isLoggedIn') === 'true';
const userRole = localStorage.getItem('nganjukGis_role') || '';

function initKegiatan(bidang, label, color) {
    BIDANG = bidang;
    BIDANG_LABEL = label;
    BIDANG_COLOR = color;

    // Cek akses: control sidebar
    const canEdit = isLoggedIn && (userRole === 'admin' || userRole === bidang);

    // Login status & Sidebar
    if (isLoggedIn) {
        const el = document.getElementById('login-status');
        if (el) el.classList.remove('hidden');
        const roleLabel = document.getElementById('role-label');
        if (roleLabel) roleLabel.textContent = userRole.toUpperCase();

        const sidebarAdmin = document.getElementById('sidebar-admin-only');
        if (sidebarAdmin) {
            sidebarAdmin.classList.remove('hidden');
            // Link sidebar button to existing openModal
            const btnSidebar = document.getElementById('sidebar-tambah-kegiatan');
            if (btnSidebar) {
                if (canEdit) {
                    btnSidebar.classList.remove('hidden');
                    btnSidebar.addEventListener('click', () => {
                        if (typeof openModal === 'function') openModal(false);
                    });
                } else {
                    btnSidebar.classList.add('hidden');
                }
            }
        }
    }

    // Init events
    initModal();
    initDeleteModal();
    loadDesa();
    loadData();
}

// --- DATA LOADING ---
async function loadDesa() {
    try {
        const res = await fetch('data/desa_nganjuk.json');
        semuaDataDesa = await res.json();
    } catch (e) { console.warn('Desa JSON missing'); }
}

async function loadData() {
    try {
        const { data, error } = await dbClient.from('data_' + BIDANG).select('*');
        if (error) throw error;
        
        let mentah = data || [];

        const parseDateForSort = (str) => {
            if (!str) return 0;
            const s = String(str).trim();
            if (s.includes('/')) {
                const p = s.split('/');
                if (p.length === 3) return new Date(p[2], p[1]-1, p[0]).getTime();
            }
            return new Date(s).getTime();
        };

        dataList = mentah.sort((a, b) => {
            const da = parseDateForSort(a.tanggal);
            const db = parseDateForSort(b.tanggal);
            if (!isNaN(da) && !isNaN(db) && da !== db) return db - da;
            return 0;
        });
        renderTable();
    } catch (e) { console.warn('Supabase Error:', e); }
}

// --- TABLE RENDERING ---
function renderTable() {
    const body = document.getElementById('data-body');
    const empty = document.getElementById('empty-state');
    document.getElementById('total-count').textContent = dataList.length;

    if (dataList.length === 0) {
        body.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    const canEdit = isLoggedIn && (userRole === 'admin' || userRole === BIDANG);

    body.innerHTML = dataList.map((d, i) => {
        const aksi = canEdit 
            ? `<div class="flex items-center justify-center gap-1">
                <button onclick="editRow('${d.id}')" class="text-blue-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition" title="Edit">
                    <i data-lucide="pencil" class="w-4 h-4 stroke-[1.5]"></i>
                </button>
                <button onclick="deleteRow('${d.id}')" class="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition" title="Hapus">
                    <i data-lucide="trash-2" class="w-4 h-4 stroke-[1.5]"></i>
                </button>
              </div>`
            : `<span class="text-gray-300 text-xs">—</span>`;

        const f = d.foto_kegiatan || '';
        const isFValid = f.startsWith('http');
        const btnFoto = isFValid ? `<a href="${f}" target="_blank" class="w-7 h-7 flex mx-auto items-center justify-center bg-gray-50 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-blue-500" title="Lihat Foto"><i data-lucide="eye" class="w-3.5 h-3.5 stroke-[1.5]"></i></a>` : `<span class="text-gray-300 text-xs">—</span>`;

        const tgl = d.tanggal ? new Date(d.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        return `<tr class="hover:bg-gray-50 transition">
            <td class="py-3 px-5 text-xs text-gray-400 font-bold">${i + 1}</td>
            <td class="py-3 px-5 text-[11px] font-bold text-gray-400 uppercase tracking-tighter">${tgl}</td>
            <td class="py-3 px-5 text-xs font-bold uppercase tracking-tighter" style="color:${BIDANG_COLOR}">${d.jenis_kegiatan || '-'}</td>
            <td class="py-3 px-5 text-sm font-bold text-[#1f2d41]">${d.nama_kegiatan || '-'}</td>
            <td class="py-3 px-5 text-xs text-gray-500">${d.desa || '-'}, ${d.kecamatan || '-'}</td>
            <td class="py-3 px-5 text-xs text-gray-500">${d.pihak_luar || '-'}</td>
            <td class="py-3 px-5 text-xs text-gray-600 font-medium ${BIDANG === 'datun' ? 'hidden' : ''}">${d.peserta || '-'}</td>
            <td class="py-3 px-5 text-center align-middle">${btnFoto}</td>
            <td class="py-3 px-5 text-xs text-gray-400">${d.keterangan || '-'}</td>
            <td class="py-3 px-5 text-center">${aksi}</td>
        </tr>`;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

// --- MODAL LOGIC ---
function toggle(modal, box, show) {
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

function initModal() {
    const modal = document.getElementById('form-modal');
    const box = document.getElementById('form-box');
    const form = document.getElementById('kegiatan-form');
    const selKec = document.getElementById('f-kec');
    const selDesa = document.getElementById('f-desa');

    const openModal = (isEdit = false) => {
        const titleEl = document.getElementById('form-title');
        if (isEdit) {
            titleEl.innerHTML = `<i data-lucide="pencil" class="w-6 h-6 stroke-[1.5] text-blue-500"></i> Edit Kegiatan`;
        } else {
            titleEl.innerHTML = `<i data-lucide="plus" class="w-6 h-6 stroke-[1.5] text-[#10b981]"></i> Tambah Kegiatan`;
        }
        if (window.lucide) window.lucide.createIcons();
        document.getElementById('form-error').classList.add('hidden');
        document.getElementById('form-success').classList.add('hidden');

        // Populate kecamatan
        selKec.innerHTML = '<option value="">-- Pilih --</option>';
        [...new Set(semuaDataDesa.map(d => d.kecamatan))].sort()
            .forEach(k => selKec.innerHTML += `<option value="${k}">${k}</option>`);
        selDesa.innerHTML = '<option value="">-- Pilih --</option>';
        selDesa.disabled = true;

        toggle(modal, box, true);
    };

    const closeModal = () => {
        toggle(modal, box, false);
        form.reset();
        document.getElementById('edit-row').value = '';
    };

    const btnTambah = document.getElementById('btn-tambah');
    if (btnTambah) {
        btnTambah.addEventListener('click', () => openModal(false));
    }

    const btnBatal = document.getElementById('btn-batal');
    if (btnBatal) {
        btnBatal.addEventListener('click', closeModal);
    }

    const btnCloseDef = document.getElementById('btn-close');
    if (btnCloseDef) {
        btnCloseDef.addEventListener('click', closeModal);
    }

    // Kecamatan → Desa cascade
    selKec.addEventListener('change', () => {
        const kec = selKec.value;
        selDesa.innerHTML = '<option value="">-- Pilih --</option>';
        if (!kec) { selDesa.disabled = true; return; }
        selDesa.disabled = false;
        semuaDataDesa.filter(d => d.kecamatan === kec)
            .sort((a, b) => a.nama_desa.localeCompare(b.nama_desa))
            .forEach(d => selDesa.innerHTML += `<option value="${d.nama_desa}">${d.nama_desa}</option>`);
    });

    // Submit (tambah/edit)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit');
        const err = document.getElementById('form-error');
        const ok = document.getElementById('form-success');
        err.classList.add('hidden');
        ok.classList.add('hidden');
        btn.textContent = 'Menyimpan...';
        btn.disabled = true;

        const editRowVal = document.getElementById('edit-row').value;
        const isEdit = editRowVal !== '';

        const fileInput = document.getElementById('f-foto');
        const file = fileInput.files[0];
        let oldUrl = fileInput.dataset.oldurl || '';

        try {
            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const { data: uploadData, error: uploadError } = await dbClient.storage
                    .from('foto_kegiatan')
                    .upload(fileName, file);

                if (uploadError) {
                    err.textContent = 'Gagal mengunggah foto.';
                    err.classList.remove('hidden');
                    btn.textContent = 'Simpan';
                    btn.disabled = false;
                    return;
                }

                const { data: publicUrlData } = dbClient.storage
                    .from('foto_kegiatan')
                    .getPublicUrl(fileName);

                oldUrl = publicUrlData.publicUrl;
            }

            const payload = {
            tanggal: document.getElementById('f-tanggal').value,
            jenis_kegiatan: document.getElementById('f-jenis').value,
            nama_kegiatan: document.getElementById('f-nama').value,
            kecamatan: selKec.value,
            desa: selDesa.value,
            pihak_luar: document.getElementById('f-pihak').value || '-',
            peserta: document.getElementById('f-pj').value || '-',
            foto_kegiatan: oldUrl,
            keterangan: document.getElementById('f-ket').value || '-'
        };

            let resError;
            if (isEdit) {
                const { error } = await dbClient.from('data_' + BIDANG).update(payload).eq('id', editRowVal);
                resError = error;
            } else {
                const { error } = await dbClient.from('data_' + BIDANG).insert([payload]);
                resError = error;
            }

            if (!resError) {
                ok.classList.remove('hidden');
                form.reset();
                fileInput.dataset.oldurl = '';
                await loadData();
                setTimeout(closeModal, 1500);
            } else {
                err.textContent = resError.message || 'Gagal menyimpan.';
                err.classList.remove('hidden');
            }
        } catch (error) {
            console.error(error);
            err.textContent = 'Terjadi kesalahan sistem.';
            err.classList.remove('hidden');
        }
        btn.textContent = 'Simpan';
        btn.disabled = false;
    });

    // Expose for edit
    window.openModal = openModal;
    window.closeModal = closeModal;
}

// --- EDIT ---
function editRow(id) {
    const d = dataList.find(x => x.id === id);
    if (!d) return;
    window.openModal(true);

    // Fill form with existing data
    setTimeout(() => {
        document.getElementById('edit-row').value = id;

        let tgl = d.tanggal || '';
        if (tgl && tgl.includes('T')) tgl = tgl.split('T')[0];
        document.getElementById('f-tanggal').value = tgl;

        document.getElementById('f-jenis').value = d.jenis_kegiatan || '';
        document.getElementById('f-nama').value = d.nama_kegiatan || '';
        const selKec = document.getElementById('f-kec');
        selKec.value = d.kecamatan || '';
        selKec.dispatchEvent(new Event('change'));
        setTimeout(() => {
            document.getElementById('f-desa').value = d.desa || '';
        }, 200);
        document.getElementById('f-pihak').value = d.pihak_luar || '';
        document.getElementById('f-pj').value = d.peserta || '';
        document.getElementById('f-foto').value = '';
        document.getElementById('f-foto').dataset.oldurl = d.foto_kegiatan || '';
        document.getElementById('f-ket').value = d.keterangan || '';
    }, 100);
}

// --- DELETE ---
function initDeleteModal() {
    const modal = document.getElementById('delete-modal');
    const box = document.getElementById('delete-box');

    document.getElementById('btn-cancel-delete').addEventListener('click', () => toggle(modal, box, false));

    document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
        if (!deleteRowId) return;
        const btn = document.getElementById('btn-confirm-delete');
        btn.textContent = 'Menghapus...';
        btn.disabled = true;

        try {
            const { error } = await dbClient.from('data_' + BIDANG).delete().eq('id', deleteRowId);

            if (!error) {
                toggle(modal, box, false);
                await loadData();
            } else {
                alert(error.message || 'Gagal menghapus.');
            }
        } catch (e) {
            alert('Koneksi gagal.');
        }
        btn.textContent = 'Hapus';
        btn.disabled = false;
        deleteRowId = '';
    });
}

function deleteRow(id) {
    deleteRowId = id;
    const modal = document.getElementById('delete-modal');
    const box = document.getElementById('delete-box');
    toggle(modal, box, true);
}
