require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

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
app.use(cookieParser());

// ─── View Engine ──────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Helpers ──────────────────────────────────────────────────────────────────
app.locals.formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
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
        res.render('index', { title: 'Beranda', route: '/', berita: beritaData.slice(0, 3), kegiatan: kegiatanData.slice(0, 4) });
    } catch (err) {
        res.render('index', { title: 'Beranda', route: '/', berita: [], kegiatan: [] });
    }
});

app.get('/berita', async (req, res) => {
    try {
        const { kategori, q } = req.query;
        const beritaData = await getBerita({ kategori, search: q });
        res.render('berita', { title: 'Berita & Pengumuman', route: '/berita', berita: beritaData, activeKategori: kategori || 'all', searchQuery: q || '' });
    } catch (err) {
        res.render('berita', { title: 'Berita', route: '/berita', berita: [], activeKategori: 'all', searchQuery: '' });
    }
});

app.get('/berita/:slug', async (req, res) => {
    try {
        const item = await getBeritaBySlug(req.params.slug);
        if (!item) return res.status(404).render('404', { title: 'Tidak Ditemukan', route: '' });
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
        res.render('kegiatan', { title: 'Kegiatan', route: '/kegiatan', kegiatan: kegiatanData, activeFilter: kategori });
    } catch (err) {
        res.render('kegiatan', { title: 'Kegiatan', route: '/kegiatan', kegiatan: [], activeFilter: 'all' });
    }
});

app.get('/galeri', async (req, res) => {
    try {
        const [beritaData, kegiatanData] = await Promise.all([getBerita(), getKegiatan()]);
        const images = [
            ...beritaData.map(b => ({ src: b.gambar, title: b.judul, category: b.kategori })),
            ...kegiatanData.map(k => ({ src: k.gambar, title: k.judul, category: k.kategori }))
        ];
        res.render('galeri', { title: 'Galeri', route: '/galeri', images });
    } catch (err) {
        res.render('galeri', { title: 'Galeri', route: '/galeri', images: [] });
    }
});

app.get('/tentang', (req, res) => res.render('tentang', { title: 'Tentang Kami', route: '/tentang' }));

app.get('/kontak', (req, res) => res.render('kontak', { title: 'Hubungi Kami', route: '/kontak', success: false }));
app.post('/kontak', (req, res) => res.render('kontak', { title: 'Hubungi Kami', route: '/kontak', success: true }));

app.get('/daftar-kegiatan/:id', async (req, res) => {
    try {
        const item = await getKegiatanById(req.params.id);
        if (!item || !item.buka_pendaftaran) return res.status(404).render('404', { title: 'Tidak Ditemukan', route: '' });
        res.render('daftar-kegiatan', { title: `Daftar: ${item.judul}`, route: '/kegiatan', kegiatan: item, success: false });
    } catch (err) { res.status(404).render('404', { title: 'Tidak Ditemukan', route: '' }); }
});

app.post('/daftar-kegiatan/:id', async (req, res) => {
    try {
        const item = await getKegiatanById(req.params.id);
        if (!item) return res.status(404).render('404', { title: 'Tidak Ditemukan', route: '' });
        const { nama, email, no_hp, alamat, catatan } = req.body;
        await createRegistrasi({ jenis: 'kegiatan', referensi: item.judul, kegiatan_id: item.id, nama, email, no_hp, alamat, catatan });
        res.render('daftar-kegiatan', { title: `Daftar: ${item.judul}`, route: '/kegiatan', kegiatan: item, success: true });
    } catch (err) { res.status(500).render('404', { title: 'Error', route: '' }); }
});

app.get('/daftar-anggota', (req, res) => res.render('daftar-anggota', { title: 'Daftar Anggota Baru', route: '/', success: false }));
app.post('/daftar-anggota', async (req, res) => {
    try {
        const { nama, nik, ttl, jenis_kelamin, alamat, no_hp, email, pendidikan, pekerjaan } = req.body;
        await createRegistrasi({ jenis: 'anggota', referensi: 'Pendaftaran Anggota Baru', nama, nik, ttl, jenis_kelamin, alamat, no_hp, email, pendidikan, pekerjaan });
        res.render('daftar-anggota', { title: 'Daftar Anggota Baru', route: '/', success: true });
    } catch (err) { res.render('daftar-anggota', { title: 'Daftar Anggota Baru', route: '/', success: false }); }
});

app.use((req, res) => res.status(404).render('404', { title: 'Halaman Tidak Ditemukan', route: '' }));

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`🔑 Admin: http://localhost:${PORT}/admin/login`);
});
