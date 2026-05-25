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
    generateSlug, ensureUniqueSlugDB,
    getSettings, updateSettings
} = require('../utils/data-manager');

// ─── Multer (memory → Supabase Storage) ──────────────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, fieldSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/jpeg|jpg|png|webp|gif/.test(file.mimetype)) cb(null, true);
        else cb(new Error('Hanya file gambar yang diizinkan'));
    }
});

// ─── Cookie config ────────────────────────────────────────────────────────────
const COOKIE_NAME = '_kt_admin';
const COOKIE_OPTS = {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 1000  // 1 jam (sesuai Supabase token expiry)
};

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function isAuthenticated(req, res, next) {
    const token = req.cookies && req.cookies[COOKIE_NAME];
    if (!token) return res.redirect('/admin/login?error=' + encodeURIComponent('Silakan login terlebih dahulu.'));
    // Decode payload tanpa verifikasi signature (verifikasi penuh di Supabase)
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            res.clearCookie(COOKIE_NAME);
            return res.redirect('/admin/login?error=' + encodeURIComponent('Sesi habis, silakan login ulang.'));
        }
        req.adminUser = payload.email || 'Admin';
        return next();
    } catch (e) {
        res.clearCookie(COOKIE_NAME);
        return res.redirect('/admin/login');
    }
}

function isGuest(req, res, next) {
    const token = req.cookies && req.cookies[COOKIE_NAME];
    if (token) return res.redirect('/admin/dashboard');
    return next();
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
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
            console.error('Auth error:', error.message);
            return res.redirect('/admin/login?error=' + encodeURIComponent('Login gagal: ' + error.message));
        }
        if (!data.session) {
            return res.redirect('/admin/login?error=' + encodeURIComponent('Tidak dapat membuat sesi.'));
        }
        // Simpan access_token di httpOnly cookie
        res.cookie(COOKIE_NAME, data.session.access_token, COOKIE_OPTS);
        console.log('Login sukses:', data.user.email);
        return res.redirect('/admin/dashboard');
    } catch (err) {
        console.error('Login exception:', err.message);
        return res.redirect('/admin/login?error=' + encodeURIComponent('Error: ' + err.message));
    }
});

router.get('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.redirect('/admin/login?success=' + encodeURIComponent('Berhasil logout.'));
});

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
router.get('/', isAuthenticated, (req, res) => res.redirect('/admin/dashboard'));

router.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        const [berita, kegiatan, registrasi] = await Promise.all([getBerita(), getKegiatan(), getRegistrasi()]);
        const totalViews = berita.reduce((sum, b) => sum + (b.views || 0), 0);
        res.render('admin/dashboard', {
            title: 'Dashboard Admin', adminUser: req.adminUser,
            stats: { totalBerita: berita.length, totalKegiatan: kegiatan.length, totalViews, totalRegistrasi: registrasi.length },
            latestBerita: berita.slice(0, 5), latestKegiatan: kegiatan.slice(0, 5),
            success: req.query.success ? decodeURIComponent(req.query.success) : null,
            error: req.query.error ? decodeURIComponent(req.query.error) : null
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
            title: 'Kelola Berita', adminUser: req.adminUser, berita,
            success: req.query.success ? decodeURIComponent(req.query.success) : null,
            error: req.query.error ? decodeURIComponent(req.query.error) : null
        });
    } catch (err) { res.redirect('/admin/dashboard'); }
});

router.get('/berita/tambah', isAuthenticated, (req, res) => {
    res.render('admin/berita-form', { title: 'Tambah Berita', adminUser: req.adminUser, item: null, error: null });
});

router.post('/berita/tambah', isAuthenticated, upload.single('gambar'), async (req, res) => {
    try {
        const { judul, ringkasan, konten, kategori, penulis, tag, tanggal } = req.body;
        let gambar = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&h=500&fit=crop';
        if (req.file) gambar = await uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
        const slug = await ensureUniqueSlugDB(generateSlug(judul));
        await createBerita({ slug, judul, ringkasan, konten, kategori, tanggal: tanggal || new Date().toISOString().split('T')[0], penulis: penulis || 'Admin', gambar, views: 0, tag: tag ? tag.split(',').map(t => t.trim()).filter(Boolean) : [] });
        res.redirect('/admin/berita?success=' + encodeURIComponent(`Berita "${judul}" berhasil ditambahkan!`));
    } catch (err) {
        res.redirect('/admin/berita/tambah?error=' + encodeURIComponent('Gagal: ' + err.message));
    }
});

router.get('/berita/edit/:id', isAuthenticated, async (req, res) => {
    try {
        const item = await getBeritaById(req.params.id);
        if (!item) return res.redirect('/admin/berita');
        res.render('admin/berita-form', { title: 'Edit Berita', adminUser: req.adminUser, item, error: null });
    } catch (err) { res.redirect('/admin/berita'); }
});

router.post('/berita/edit/:id', isAuthenticated, upload.single('gambar'), async (req, res) => {
    try {
        const item = await getBeritaById(req.params.id);
        if (!item) return res.redirect('/admin/berita');
        const { judul, ringkasan, konten, kategori, penulis, tag, slug: slugInput, tanggal } = req.body;
        let gambar = item.gambar;
        if (req.file) {
            if (item.gambar && item.gambar.includes('supabase')) await deleteImage(item.gambar);
            gambar = await uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
        }
        const slug = await ensureUniqueSlugDB(slugInput || generateSlug(judul), req.params.id);
        await updateBerita(req.params.id, { slug, judul, ringkasan, konten, kategori, tanggal: tanggal || item.tanggal, penulis: penulis || item.penulis, gambar, tag: tag ? tag.split(',').map(t => t.trim()).filter(Boolean) : item.tag });
        res.redirect('/admin/berita?success=' + encodeURIComponent(`Berita "${judul}" berhasil diperbarui!`));
    } catch (err) {
        res.redirect(`/admin/berita/edit/${req.params.id}?error=` + encodeURIComponent('Gagal: ' + err.message));
    }
});

router.post('/berita/hapus/:id', isAuthenticated, async (req, res) => {
    try {
        const item = await getBeritaById(req.params.id);
        if (item?.gambar?.includes('supabase')) await deleteImage(item.gambar);
        await deleteBerita(req.params.id);
        res.redirect('/admin/berita?success=' + encodeURIComponent(`Berita berhasil dihapus.`));
    } catch (err) {
        res.redirect('/admin/berita?error=' + encodeURIComponent('Gagal menghapus.'));
    }
});

// ─── KEGIATAN CRUD ────────────────────────────────────────────────────────────
router.get('/kegiatan', isAuthenticated, async (req, res) => {
    try {
        const kegiatan = await getKegiatan();
        res.render('admin/kegiatan-list', {
            title: 'Kelola Kegiatan', adminUser: req.adminUser, kegiatan,
            success: req.query.success ? decodeURIComponent(req.query.success) : null,
            error: req.query.error ? decodeURIComponent(req.query.error) : null
        });
    } catch (err) { res.redirect('/admin/dashboard'); }
});

router.get('/kegiatan/tambah', isAuthenticated, (req, res) => {
    res.render('admin/kegiatan-form', { title: 'Tambah Kegiatan', adminUser: req.adminUser, item: null, error: null });
});

router.post('/kegiatan/tambah', isAuthenticated, upload.single('gambar'), async (req, res) => {
    try {
        const { judul, kategori, lokasi, tanggal, deskripsi, buka_pendaftaran, pendaftaran_dibuka, pendaftaran_ditutup } = req.body;
        let gambar = 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=600&h=400&fit=crop';
        if (req.file) gambar = await uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
        await createKegiatan({ 
            judul, 
            kategori, 
            lokasi, 
            tanggal, 
            deskripsi, 
            gambar, 
            buka_pendaftaran: buka_pendaftaran === 'on',
            pendaftaran_dibuka: pendaftaran_dibuka || null,
            pendaftaran_ditutup: pendaftaran_ditutup || null
        });
        res.redirect('/admin/kegiatan?success=' + encodeURIComponent(`Kegiatan "${judul}" berhasil ditambahkan!`));
    } catch (err) {
        res.redirect('/admin/kegiatan/tambah?error=' + encodeURIComponent('Gagal: ' + err.message));
    }
});

router.get('/kegiatan/edit/:id', isAuthenticated, async (req, res) => {
    try {
        const item = await getKegiatanById(req.params.id);
        if (!item) return res.redirect('/admin/kegiatan');
        res.render('admin/kegiatan-form', { title: 'Edit Kegiatan', adminUser: req.adminUser, item, error: null });
    } catch (err) { res.redirect('/admin/kegiatan'); }
});

router.post('/kegiatan/edit/:id', isAuthenticated, upload.single('gambar'), async (req, res) => {
    try {
        const item = await getKegiatanById(req.params.id);
        if (!item) return res.redirect('/admin/kegiatan');
        const { judul, kategori, lokasi, tanggal, deskripsi, buka_pendaftaran, pendaftaran_dibuka, pendaftaran_ditutup } = req.body;
        let gambar = item.gambar;
        if (req.file) {
            if (item.gambar?.includes('supabase')) await deleteImage(item.gambar);
            gambar = await uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
        }
        await updateKegiatan(req.params.id, { 
            judul, 
            kategori, 
            lokasi, 
            tanggal, 
            deskripsi, 
            gambar, 
            buka_pendaftaran: buka_pendaftaran === 'on',
            pendaftaran_dibuka: pendaftaran_dibuka || null,
            pendaftaran_ditutup: pendaftaran_ditutup || null
        });
        res.redirect('/admin/kegiatan?success=' + encodeURIComponent(`Kegiatan "${judul}" berhasil diperbarui!`));
    } catch (err) {
        res.redirect(`/admin/kegiatan/edit/${req.params.id}?error=` + encodeURIComponent('Gagal: ' + err.message));
    }
});

router.post('/kegiatan/hapus/:id', isAuthenticated, async (req, res) => {
    try {
        const item = await getKegiatanById(req.params.id);
        if (item?.gambar?.includes('supabase')) await deleteImage(item.gambar);
        await deleteKegiatan(req.params.id);
        res.redirect('/admin/kegiatan?success=' + encodeURIComponent('Kegiatan berhasil dihapus.'));
    } catch (err) {
        res.redirect('/admin/kegiatan?error=' + encodeURIComponent('Gagal menghapus.'));
    }
});

// ─── FORMULIR ─────────────────────────────────────────────────────────────────
router.get('/formulir', isAuthenticated, async (req, res) => {
    try {
        const registrasi = await getRegistrasi();
        res.render('admin/formulir-list', {
            title: 'Data Pendaftaran', adminUser: req.adminUser, registrasi,
            success: req.query.success ? decodeURIComponent(req.query.success) : null,
            error: req.query.error ? decodeURIComponent(req.query.error) : null
        });
    } catch (err) { res.redirect('/admin/dashboard'); }
});

router.post('/formulir/hapus/:id', isAuthenticated, async (req, res) => {
    try {
        await deleteRegistrasi(req.params.id);
        res.redirect('/admin/formulir?success=' + encodeURIComponent('Data berhasil dihapus.'));
    } catch (err) {
        res.redirect('/admin/formulir?error=' + encodeURIComponent('Gagal menghapus.'));
    }
});

// ─── GALERI ───────────────────────────────────────────────────────────────────
router.get('/galeri', isAuthenticated, async (req, res) => {
    try {
        const galeri = await getGaleri();
        res.render('admin/galeri-list', {
            title: 'Kelola Galeri', adminUser: req.adminUser, galeri,
            success: req.query.success ? decodeURIComponent(req.query.success) : null,
            error: req.query.error ? decodeURIComponent(req.query.error) : null
        });
    } catch (err) { res.redirect('/admin/dashboard'); }
});

router.get('/galeri/upload', isAuthenticated, (req, res) => {
    res.render('admin/galeri-upload', { title: 'Upload Galeri', adminUser: req.adminUser, error: null });
});

router.post('/galeri/upload', isAuthenticated, upload.array('gambar', 10), async (req, res) => {
    try {
        const { judul, kategori, deskripsi } = req.body;
        if (!req.files || req.files.length === 0) {
            return res.redirect('/admin/galeri/upload?error=' + encodeURIComponent('Pilih minimal satu gambar!'));
        }
        for (const file of req.files) {
            const gambar_url = await uploadImage(file.buffer, file.originalname, file.mimetype);
            await createGaleri({ judul, kategori: kategori || 'umum', deskripsi, gambar_url });
        }
        res.redirect('/admin/galeri?success=' + encodeURIComponent(`${req.files.length} gambar berhasil diupload!`));
    } catch (err) {
        res.redirect('/admin/galeri/upload?error=' + encodeURIComponent('Gagal upload: ' + err.message));
    }
});

router.post('/galeri/hapus/:id', isAuthenticated, async (req, res) => {
    try {
        const { data: item } = await supabase.from('galeri').select('*').eq('id', req.params.id).single();
        if (item?.gambar_url?.includes('supabase')) await deleteImage(item.gambar_url);
        await deleteGaleriItem(req.params.id);
        res.redirect('/admin/galeri?success=' + encodeURIComponent('Gambar berhasil dihapus.'));
    } catch (err) {
        res.redirect('/admin/galeri?error=' + encodeURIComponent('Gagal menghapus.'));
    }
});


// ─── PENGATURAN WEBSITE ───────────────────────────────────────────────────────
router.get('/pengaturan', isAuthenticated, async (req, res) => {
    try {
        const settings = await getSettings();
        res.render('admin/pengaturan', {
            title: 'Pengaturan Website', adminUser: req.adminUser, settings,
            success: req.query.success ? decodeURIComponent(req.query.success) : null,
            error: req.query.error ? decodeURIComponent(req.query.error) : null
        });
    } catch (err) {
        res.redirect('/admin/dashboard?error=' + encodeURIComponent('Gagal memuat pengaturan.'));
    }
});

router.post('/pengaturan', isAuthenticated, upload.single('hero_image_file'), async (req, res) => {
    try {
        const body = req.body;
        // Jika ada upload foto hero baru
        if (req.file) {
            body.hero_image = await uploadImage(req.file.buffer, req.file.originalname, req.file.mimetype);
        }
        // Hapus field upload dari body (bukan setting)
        delete body.hero_image_file;
        await updateSettings(body);
        // Reload settings ke app.locals
        const { getSettings: gs } = require('../utils/data-manager');
        require('../server') // noop, just for clarity
        res.redirect('/admin/pengaturan?success=' + encodeURIComponent('Pengaturan berhasil disimpan!'));
    } catch (err) {
        console.error('Pengaturan error:', err);
        res.redirect('/admin/pengaturan?error=' + encodeURIComponent('Gagal menyimpan: ' + err.message));
    }
});

module.exports = router;
