require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cookieSession = require('cookie-session');
const flash = require('connect-flash');

const {
    getBerita, getBeritaBySlug, getBeritaById, incrementBeritaViews,
    getKegiatan, getKegiatanById,
    getRegistrasi, createRegistrasi
} = require('./utils/data-manager');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(cookieSession({
    name: 'kt_session',
    secret: process.env.SESSION_SECRET || 'karangtaruna-secret-2026',
    maxAge: 24 * 60 * 60 * 1000, // 1 hari
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
}));

// Buat req.session.flash compatible dengan connect-flash
app.use((req, res, next) => {
    if (!req.session.flash) req.session.flash = {};
    next();
});
app.use(flash());

// ─── View Engine ──────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Helpers ──────────────────────────────────────────────────────────────────
app.locals.formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    return new Date(dateStr).toLocaleDateString('id-ID', options);
};
app.locals.formatDateShort = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};
app.locals.activeRoute = (currentRoute, route) => {
    return currentRoute === route ? 'text-karang-600 font-bold' : 'text-gray-700 hover:text-karang-600';
};

// ─── Admin Routes ─────────────────────────────────────────────────────────────
const adminRoutes = require('./routes/admin');
app.use('/admin', adminRoutes);

// ─── Public Routes ────────────────────────────────────────────────────────────
app.get('/', async (req, res) => {
    try {
        const [beritaData, kegiatanData] = await Promise.all([getBerita(), getKegiatan()]);
        res.render('index', {
            title: 'Beranda',
            route: '/',
            berita: beritaData.slice(0, 3),
            kegiatan: kegiatanData.slice(0, 4)
        });
    } catch (err) {
        console.error(err);
        res.render('index', { title: 'Beranda', route: '/', berita: [], kegiatan: [] });
    }
});

app.get('/berita', async (req, res) => {
    try {
        const { kategori, q } = req.query;
        const beritaData = await getBerita({ kategori, search: q });
        res.render('berita', {
            title: 'Berita & Pengumuman',
            route: '/berita',
            berita: beritaData,
            activeKategori: kategori || 'all',
            searchQuery: q || ''
        });
    } catch (err) {
        res.render('berita', { title: 'Berita', route: '/berita', berita: [], activeKategori: 'all', searchQuery: '' });
    }
});

app.get('/berita/:slug', async (req, res) => {
    try {
        const item = await getBeritaBySlug(req.params.slug);
        if (!item) return res.status(404).render('404', { title: 'Tidak Ditemukan', route: '' });

        // Increment views (fire and forget)
        incrementBeritaViews(item.id, item.views).catch(() => {});

        const allBerita = await getBerita({ kategori: item.kategori });
        const related = allBerita.filter(b => b.id !== item.id).slice(0, 3);

        res.render('detail-berita', { title: item.judul, route: '/berita', item, related });
    } catch (err) {
        res.status(404).render('404', { title: 'Tidak Ditemukan', route: '' });
    }
});

app.get('/kegiatan', async (req, res) => {
    try {
        const kategori = req.query.kategori || 'all';
        const kegiatanData = await getKegiatan({ kategori });
        res.render('kegiatan', {
            title: 'Kegiatan',
            route: '/kegiatan',
            kegiatan: kegiatanData,
            activeFilter: kategori
        });
    } catch (err) {
        res.render('kegiatan', { title: 'Kegiatan', route: '/kegiatan', kegiatan: [], activeFilter: 'all' });
    }
});

app.get('/galeri', async (req, res) => {
    try {
        const [beritaData, kegiatanData] = await Promise.all([getBerita(), getKegiatan()]);
        const galleryImages = [
            ...beritaData.map(b => ({ src: b.gambar, title: b.judul, category: b.kategori })),
            ...kegiatanData.map(k => ({ src: k.gambar, title: k.judul, category: k.kategori }))
        ];
        res.render('galeri', { title: 'Galeri', route: '/galeri', images: galleryImages });
    } catch (err) {
        res.render('galeri', { title: 'Galeri', route: '/galeri', images: [] });
    }
});

app.get('/tentang', (req, res) => {
    res.render('tentang', { title: 'Tentang Kami', route: '/tentang' });
});

app.get('/kontak', (req, res) => {
    res.render('kontak', { title: 'Hubungi Kami', route: '/kontak', success: false });
});

app.post('/kontak', (req, res) => {
    const { nama, email, subjek, pesan } = req.body;
    console.log('📩 Pesan baru:', { nama, email, subjek, pesan });
    res.render('kontak', { title: 'Hubungi Kami', route: '/kontak', success: true, message: 'Pesan berhasil dikirim!' });
});

// ─── Pendaftaran Kegiatan (Publik) ────────────────────────────────────────────
app.get('/daftar-kegiatan/:id', async (req, res) => {
    try {
        const item = await getKegiatanById(req.params.id);
        if (!item || !item.buka_pendaftaran) return res.status(404).render('404', { title: 'Tidak Ditemukan', route: '' });
        res.render('daftar-kegiatan', { title: `Daftar: ${item.judul}`, route: '/kegiatan', kegiatan: item, success: false });
    } catch (err) {
        res.status(404).render('404', { title: 'Tidak Ditemukan', route: '' });
    }
});

app.post('/daftar-kegiatan/:id', async (req, res) => {
    try {
        const item = await getKegiatanById(req.params.id);
        if (!item) return res.status(404).render('404', { title: 'Tidak Ditemukan', route: '' });
        const { nama, email, no_hp, alamat, catatan } = req.body;
        await createRegistrasi({ jenis: 'kegiatan', referensi: item.judul, kegiatan_id: item.id, nama, email, no_hp, alamat, catatan });
        res.render('daftar-kegiatan', { title: `Daftar: ${item.judul}`, route: '/kegiatan', kegiatan: item, success: true });
    } catch (err) {
        res.status(500).render('404', { title: 'Error', route: '' });
    }
});

// ─── Pendaftaran Anggota (Publik) ─────────────────────────────────────────────
app.get('/daftar-anggota', (req, res) => {
    res.render('daftar-anggota', { title: 'Daftar Anggota Baru', route: '/', success: false });
});

app.post('/daftar-anggota', async (req, res) => {
    try {
        const { nama, nik, ttl, jenis_kelamin, alamat, no_hp, email, pendidikan, pekerjaan } = req.body;
        await createRegistrasi({ jenis: 'anggota', referensi: 'Pendaftaran Anggota Baru', nama, nik, ttl, jenis_kelamin, alamat, no_hp, email, pendidikan, pekerjaan });
        res.render('daftar-anggota', { title: 'Daftar Anggota Baru', route: '/', success: true });
    } catch (err) {
        res.render('daftar-anggota', { title: 'Daftar Anggota Baru', route: '/', success: false, error: 'Gagal mendaftar, coba lagi.' });
    }
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).render('404', { title: 'Halaman Tidak Ditemukan', route: '' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server Karang Taruna Kel. Tanjung running at http://localhost:${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔑 Admin: http://localhost:${PORT}/admin/login`);
});
