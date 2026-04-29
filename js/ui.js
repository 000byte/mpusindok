document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (mobileMenuBtn && sidebar && overlay) {
        mobileMenuBtn.addEventListener('click', () => {
            // Tampilkan Sidebar di Mobile
            sidebar.classList.remove('hidden');
            sidebar.classList.add('fixed', 'inset-y-0', 'left-0', 'z-40', 'w-64', 'flex');
            
            // Tampilkan Overlay
            overlay.classList.remove('hidden');
            overlay.classList.add('block');
            
            // Mencegah scroll di body saat menu terbuka
            document.body.classList.add('overflow-hidden');
        });

        const closeSidebar = () => {
            // Jika layar adalah mobile (biasanya lg: adalah 1024px)
            if (window.innerWidth < 1024) {
                sidebar.classList.add('hidden');
                sidebar.classList.remove('fixed', 'inset-y-0', 'left-0', 'z-40', 'w-64', 'flex');
                
                overlay.classList.add('hidden');
                overlay.classList.remove('block');
                
                document.body.classList.remove('overflow-hidden');
            }
        };

        overlay.addEventListener('click', closeSidebar);

        // Tutup menu jika mengklik link di dalam sidebar (pada mobile)
        sidebar.querySelectorAll('a, button').forEach(link => {
            link.addEventListener('click', () => {
                if (!link.id || (link.id !== 'sidebar-tambah-unit' && link.id !== 'sidebar-tambah-kegiatan')) {
                    closeSidebar();
                }
            });
        });
    }
});
