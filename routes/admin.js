const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../utils/supabase');
const { authClient } = require('../utils/supabase');
const {
    getBerita, getBeritaById, createBerita, updateBerita, deleteBerita,
    getKegiatan, getKegiatanById, createKegiatan, updateKegiatan, deleteKegiatan,
    getRegistrasi, deleteRegistrasi,
    getGaleri, createGaleri, deleteGaleriItem,
    uploadImage, deleteImage,
    generateSlug, ensureUniqueSlugDB
} = require('../utils/data-manager');

// ─── Multer: simpan di memory lalu upload ke Supabase Storage ─────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,    // 5MB per file
        fieldSize: 25 * 1024 * 1024   // 25MB untuk field teks (konten Quill)
    },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp|gif/;
        if (allowed.test(file.mimetype)) cb(null, true);
        else cb(new Error('Hanya file gambar yang diizinkan'));
    }
});

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function isAuthenticated(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    return res.redirect('/admin/login');
}
function isGuest(req, res, next) {
    if (req.session && req.session.isAdmin) return res.redirect('/admin/dashboard');
    return next();
}

// ─── AUTH (Supabase Auth) ────────────────────────────────────────────────────

router.get('/login', isGuest, (req, res) => {
    res.render('admin/login', {
        title: 'Login Admin',
        error: req.query.error ? decodeURIComponent(req.query.error) : null,
        success: req.query.success ? decodeURIComponent(req.query.success) : null
    });
});

router.post('/login', isGuest, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.redirect('/admin/login?error=' + encodeURIComponent('Email dan password wajib diisi.'));
    }
    try {
        const { data, error } = await authClient.auth.signInWithPassword({ email, password });
        if (error) {
            console.error('Supabase auth error:', error.message, error.status);
            return res.redirect('/admin/login?error=' + encodeURIComponent('Login gagal: ' + error.message));
        }
        if (!data.user) {
            return res.redirect('/admin/login?error=' + encodeURIComponent('User tidak ditemukan.'));
        }
        req.session.isAdmin = true;
        req.session.adminUser = data.user.email;
        console.log('Login sukses:', data.user.email);
        return res.redirect('/admin/dashboard');
    } catch (err) {
        console.error('Login exception:', err.message);
        return res.redirect('/admin/login?error=' + encodeURIComponent('Terjadi kesalahan: ' + err.message));
    }
});

router.get('/logout', (req, res) => {
    req.session = null; // cookie-session: clear by setting to null
    res.redirect('/admin/login');
});

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

router.get('/', isAuthenticated, (req, res) => res.redirect('/admin/dashboard'));

router.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        const [berita, kegiatan, registrasi] = await Promise.all([
            getBerita(), getKegiatan(), getRegistrasi()
        ]);
        const totalViews = berita.reduce((sum, b) => sum + (b.views || 0), 0);
        res.render('admin/dashboard', {
            title: 'Dashboard Admin',
            adminUser: req.session.adminUser,
            stats: { totalBerita: berita.length, totalKegiatan: kegiatan.length, totalViews, totalRegistrasi: registrasi.length },
            latestBerita: berita.slice(0, 5),
            latestKegiatan: kegiatan.slice(0, 5),
            success: req.flash('success'),
            error: req.flash('error')
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/login');
    }
});

// ─── BERITA CRUD ──────────────────────────────────────────────────────────────

router.get('/berita', isAuthenticated, async (req, res) => {
    try {
        const berita = await getBerita();
        res.render('admin/berita-list', {
            title: 'Kelola Berita', adminUser: req.session.adminUser,
            berita, success: req.flash('success'), error: req.flash('error')
        });
    } catch (err) {
        req.flash('error', 'Gagal memuat data berita.'); res.redirect('/admin/dashboard');
    }
});

router.get('/berita/tambah', isAuthenticated, (req, res) => {
    res.render('admin/berita-form', {
        title: 'Tambah Berita', adminUser: req.session.adminUser, item: null, error: req.flash('error')
    });
});

router.post('/berita/tambah', isAuthenticated, upload.single('gambar'), async (req, res) => {
    try {
        const { judul, ringkasan, konten, kategori, penulis, tag } = req.body;
        let gambar = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&h=500&fit=crop';
        if (req.file) gambar = await uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
        const slug = await ensureUniqueSlugDB(generateSlug(judul));
        await createBerita({
            slug, judul, ringkasan, konten, kategori,
            tanggal: new Date().toISOString().split('T')[0],
            penulis: penulis || 'Admin', gambar, views: 0,
            tag: tag ? tag.split(',').map(t => t.trim()).filter(Boolean) : []
        });
        req.flash('success', `Berita "${judul}" berhasil ditambahkan!`);
        res.redirect('/admin/berita');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Gagal menambah berita: ' + err.message);
        res.redirect('/admin/berita/tambah');
    }
});

router.get('/berita/edit/:id', isAuthenticated, async (req, res) => {
    try {
        const item = await getBeritaById(req.params.id);
        if (!item) { req.flash('error', 'Berita tidak ditemukan'); return res.redirect('/admin/berita'); }
        res.render('admin/berita-form', { title: 'Edit Berita', adminUser: req.session.adminUser, item, error: req.flash('error') });
    } catch (err) {
        req.flash('error', 'Berita tidak ditemukan'); res.redirect('/admin/berita');
    }
});

router.post('/berita/edit/:id', isAuthenticated, upload.single('gambar'), async (req, res) => {
    try {
        const item = await getBeritaById(req.params.id);
        if (!item) { req.flash('error', 'Berita tidak ditemukan'); return res.redirect('/admin/berita'); }
        const { judul, ringkasan, konten, kategori, penulis, tag, slug: slugInput } = req.body;
        let gambar = item.gambar;
        if (req.file) {
            if (item.gambar && item.gambar.includes('supabase')) await deleteImage(item.gambar);
            gambar = await uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
        }
        const slug = await ensureUniqueSlugDB(slugInput || generateSlug(judul), req.params.id);
        await updateBerita(req.params.id, {
            slug, judul, ringkasan, konten, kategori,
            penulis: penulis || item.penulis, gambar,
            tag: tag ? tag.split(',').map(t => t.trim()).filter(Boolean) : item.tag
        });
        req.flash('success', `Berita "${judul}" berhasil diperbarui!`);
        res.redirect('/admin/berita');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Gagal memperbarui berita: ' + err.message);
        res.redirect(`/admin/berita/edit/${req.params.id}`);
    }
});

router.post('/berita/hapus/:id', isAuthenticated, async (req, res) => {
    try {
        const item = await getBeritaById(req.params.id);
        if (item?.gambar?.includes('supabase')) await deleteImage(item.gambar);
        await deleteBerita(req.params.id);
        req.flash('success', `Berita "${item?.judul || ''}" berhasil dihapus.`);
    } catch (err) {
        req.flash('error', 'Gagal menghapus berita.');
    }
    res.redirect('/admin/berita');
});

// ─── KEGIATAN CRUD ────────────────────────────────────────────────────────────

router.get('/kegiatan', isAuthenticated, async (req, res) => {
    try {
        const kegiatan = await getKegiatan();
        res.render('admin/kegiatan-list', {
            title: 'Kelola Kegiatan', adminUser: req.session.adminUser,
            kegiatan, success: req.flash('success'), error: req.flash('error')
        });
    } catch (err) {
        req.flash('error', 'Gagal memuat data kegiatan.'); res.redirect('/admin/dashboard');
    }
});

router.get('/kegiatan/tambah', isAuthenticated, (req, res) => {
    res.render('admin/kegiatan-form', {
        title: 'Tambah Kegiatan', adminUser: req.session.adminUser, item: null, error: req.flash('error')
    });
});

router.post('/kegiatan/tambah', isAuthenticated, upload.single('gambar'), async (req, res) => {
    try {
        const { judul, kategori, lokasi, tanggal, deskripsi, buka_pendaftaran } = req.body;
        let gambar = 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=600&h=400&fit=crop';
        if (req.file) gambar = await uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
        await createKegiatan({ judul, kategori, lokasi, tanggal, deskripsi, gambar, buka_pendaftaran: buka_pendaftaran === 'on' });
        req.flash('success', `Kegiatan "${judul}" berhasil ditambahkan!`);
        res.redirect('/admin/kegiatan');
    } catch (err) {
        req.flash('error', 'Gagal menambah kegiatan: ' + err.message);
        res.redirect('/admin/kegiatan/tambah');
    }
});

router.get('/kegiatan/edit/:id', isAuthenticated, async (req, res) => {
    try {
        const item = await getKegiatanById(req.params.id);
        if (!item) { req.flash('error', 'Kegiatan tidak ditemukan'); return res.redirect('/admin/kegiatan'); }
        res.render('admin/kegiatan-form', { title: 'Edit Kegiatan', adminUser: req.session.adminUser, item, error: req.flash('error') });
    } catch (err) {
        req.flash('error', 'Kegiatan tidak ditemukan'); res.redirect('/admin/kegiatan');
    }
});

router.post('/kegiatan/edit/:id', isAuthenticated, upload.single('gambar'), async (req, res) => {
    try {
        const item = await getKegiatanById(req.params.id);
        if (!item) { req.flash('error', 'Kegiatan tidak ditemukan'); return res.redirect('/admin/kegiatan'); }
        const { judul, kategori, lokasi, tanggal, deskripsi, buka_pendaftaran } = req.body;
        let gambar = item.gambar;
        if (req.file) {
            if (item.gambar?.includes('supabase')) await deleteImage(item.gambar);
            gambar = await uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
        }
        await updateKegiatan(req.params.id, { judul, kategori, lokasi, tanggal, deskripsi, gambar, buka_pendaftaran: buka_pendaftaran === 'on' });
        req.flash('success', `Kegiatan "${judul}" berhasil diperbarui!`);
        res.redirect('/admin/kegiatan');
    } catch (err) {
        req.flash('error', 'Gagal memperbarui kegiatan: ' + err.message);
        res.redirect(`/admin/kegiatan/edit/${req.params.id}`);
    }
});

router.post('/kegiatan/hapus/:id', isAuthenticated, async (req, res) => {
    try {
        const item = await getKegiatanById(req.params.id);
        if (item?.gambar?.includes('supabase')) await deleteImage(item.gambar);
        await deleteKegiatan(req.params.id);
        req.flash('success', `Kegiatan "${item?.judul || ''}" berhasil dihapus.`);
    } catch (err) {
        req.flash('error', 'Gagal menghapus kegiatan.');
    }
    res.redirect('/admin/kegiatan');
});

// ─── FORMULIR REGISTRASI ──────────────────────────────────────────────────────

router.get('/formulir', isAuthenticated, async (req, res) => {
    try {
        const registrasi = await getRegistrasi();
        res.render('admin/formulir-list', {
            title: 'Data Pendaftaran', adminUser: req.session.adminUser,
            registrasi, success: req.flash('success'), error: req.flash('error')
        });
    } catch (err) {
        req.flash('error', 'Gagal memuat data pendaftaran.'); res.redirect('/admin/dashboard');
    }
});

router.post('/formulir/hapus/:id', isAuthenticated, async (req, res) => {
    try {
        await deleteRegistrasi(req.params.id);
        req.flash('success', 'Data pendaftaran berhasil dihapus.');
    } catch (err) {
        req.flash('error', 'Gagal menghapus data.');
    }
    res.redirect('/admin/formulir');
});

// ─── GALERI ───────────────────────────────────────────────────────────────────

router.get('/galeri', isAuthenticated, async (req, res) => {
    try {
        const galeri = await getGaleri();
        res.render('admin/galeri-list', {
            title: 'Kelola Galeri', adminUser: req.session.adminUser,
            galeri, success: req.flash('success'), error: req.flash('error')
        });
    } catch (err) {
        req.flash('error', 'Gagal memuat galeri.'); res.redirect('/admin/dashboard');
    }
});

router.get('/galeri/upload', isAuthenticated, (req, res) => {
    res.render('admin/galeri-upload', {
        title: 'Upload Gambar Galeri', adminUser: req.session.adminUser, error: req.flash('error')
    });
});

router.post('/galeri/upload', isAuthenticated, upload.array('gambar', 10), async (req, res) => {
    try {
        const { judul, kategori, deskripsi } = req.body;
        if (!req.files || req.files.length === 0) {
            req.flash('error', 'Pilih minimal satu gambar!');
            return res.redirect('/admin/galeri/upload');
        }
        for (const file of req.files) {
            const gambar_url = await uploadImage(file.buffer, file.originalname, file.mimetype);
            await createGaleri({ judul, kategori: kategori || 'umum', deskripsi, gambar_url });
        }
        req.flash('success', `${req.files.length} gambar berhasil diupload ke galeri!`);
        res.redirect('/admin/galeri');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Gagal upload gambar: ' + err.message);
        res.redirect('/admin/galeri/upload');
    }
});

router.post('/galeri/hapus/:id', isAuthenticated, async (req, res) => {
    try {
        const { data: item } = await supabase.from('galeri').select('*').eq('id', req.params.id).single();
        if (item?.gambar_url?.includes('supabase')) await deleteImage(item.gambar_url);
        await deleteGaleriItem(req.params.id);
        req.flash('success', 'Gambar berhasil dihapus dari galeri.');
    } catch (err) {
        req.flash('error', 'Gagal menghapus gambar.');
    }
    res.redirect('/admin/galeri');
});

module.exports = router;
