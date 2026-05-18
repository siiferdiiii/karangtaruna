// Admin Panel JavaScript

document.addEventListener('DOMContentLoaded', function () {

    // ── Delete button event delegation ──────────
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.delete-btn');
        if (btn) {
            e.preventDefault();
            const url = btn.dataset.url;
            const name = btn.dataset.name;
            confirmDelete(url, name);
        }
    });

    // ── Sidebar Toggle ──────────────────────────
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarClose = document.getElementById('sidebarClose');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    function openSidebar() {
        sidebar && sidebar.classList.add('open');
        sidebarOverlay && sidebarOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
        sidebar && sidebar.classList.remove('open');
        sidebarOverlay && sidebarOverlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    sidebarToggle && sidebarToggle.addEventListener('click', openSidebar);
    sidebarClose && sidebarClose.addEventListener('click', closeSidebar);
    sidebarOverlay && sidebarOverlay.addEventListener('click', closeSidebar);

    // ── Auto-dismiss flash messages ─────────────
    const flashMsg = document.getElementById('flashMsg');
    if (flashMsg) {
        setTimeout(() => {
            flashMsg.style.opacity = '0';
            flashMsg.style.transition = 'opacity 0.5s ease';
            setTimeout(() => flashMsg.remove(), 500);
        }, 4000);
    }

    // ── Upload drag & drop highlight ────────────
    const uploadAreas = document.querySelectorAll('.upload-area');
    uploadAreas.forEach(area => {
        area.addEventListener('dragover', e => {
            e.preventDefault();
            area.style.borderColor = '#f97316';
            area.style.background = '#fff7ed';
        });
        area.addEventListener('dragleave', () => {
            area.style.borderColor = '';
            area.style.background = '';
        });
        area.addEventListener('drop', e => {
            e.preventDefault();
            area.style.borderColor = '';
            area.style.background = '';
            const fileInput = area.querySelector('input[type="file"]');
            if (fileInput && e.dataTransfer.files[0]) {
                fileInput.files = e.dataTransfer.files;
                fileInput.dispatchEvent(new Event('change'));
            }
        });
    });
});

// ── Delete Confirmation Modal ────────────────────
function confirmDelete(url, name) {
    const modal = document.getElementById('deleteModal');
    const form = document.getElementById('deleteForm');
    const text = document.getElementById('modalText');
    if (!modal || !form) return;
    form.action = url;
    if (text) text.textContent = `Apakah Anda yakin ingin menghapus "${name}"? Tindakan ini tidak dapat dibatalkan.`;
    modal.classList.add('open');
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.remove('open');
}

// Close modal on overlay click
document.addEventListener('click', function (e) {
    const modal = document.getElementById('deleteModal');
    if (modal && e.target === modal) closeDeleteModal();
});

// Escape key closes modal
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDeleteModal();
});
