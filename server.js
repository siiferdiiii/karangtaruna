require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const {
    getBerita, getBeritaBySlug, getBeritaById, getBeritaPopuler, incrementBeritaViews,
    getKegiatan, getKegiatanById,
    getRegistrasi, createRegistrasi,
    getKolaborator, getPengurus,
    getSettings
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
app.locals.stripHtml = (str) => (str || '').replace(/<[^>]*>/g, '').trim();

// ─── No-Cache untuk semua halaman dinamis (bukan static assets) ──────────────
app.use((req, res, next) => {
    const isStatic = /\.(css|js|jpe?g|png|gif|ico|webp|woff2?)$/i.test(req.path);
    if (!isStatic) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
    next();
});

// ─── Load Settings Global (tersedia di semua template sebagai `s`) ───────────
app.use(async (req, res, next) => {
    try {
        if (!app.locals._settingsLoaded || req.path.startsWith('/admin/pengaturan')) {
            app.locals.s = await getSettings();
            app.locals._settingsLoaded = true;
        }
    } catch (e) { app.locals.s = app.locals.s || {}; }
    next();
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────
const adminRoutes = require('./routes/admin');
app.use('/admin', adminRoutes);

// ─── Public Routes ────────────────────────────────────────────────────────────
app.get('/', async (req, res) => {
    try {
        const [beritaData, kegiatanData, kolaboratorData] = await Promise.all([
            getBerita(),
            getKegiatan(),
            getKolaborator()
        ]);
        res.render('index', { 
            title: 'Beranda', 
            route: '/', 
            berita: beritaData.slice(0, 3), 
            kegiatan: kegiatanData.slice(0, 4),
            kolaborator: kolaboratorData 
        });
    } catch (err) {
        res.render('index', { title: 'Beranda', route: '/', berita: [], kegiatan: [], kolaborator: [] });
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
        
        // Fetch related and popular news in parallel
        const [allBerita, populer] = await Promise.all([
            getBerita({ kategori: item.kategori }),
            getBeritaPopuler({ limit: 3, excludeId: item.id })
        ]);
        
        const related = allBerita.filter(b => b.id !== item.id).slice(0, 3);
        
        res.render('detail-berita', { 
            title: item.judul, 
            route: '/berita', 
            item, 
            related, 
            populer,
            metaDescription: item.ringkasan,
            metaKeywords: item.tag && item.tag.length ? item.tag.join(', ') : 'berita, mempawah, karang taruna',
            metaImage: item.gambar
        });
    } catch (err) {
        res.status(404).render('404', { title: 'Tidak Ditemukan', route: '' });
    }
});

app.get('/kegiatan', async (req, res, next) => {
    try {
        const kategori = req.query.kategori || 'all';
        const kegiatanData = await getKegiatan({ kategori });
        res.render('kegiatan', { title: 'Kegiatan', route: '/kegiatan', kegiatan: kegiatanData, activeFilter: kategori }, (err, html) => {
            if (err) {
                console.error('[/kegiatan] Render error:', err.message || err);
                return res.status(500).send('<h1>Gagal memuat halaman kegiatan</h1><pre>' + err.message + '</pre>');
            }
            res.send(html);
        });
    } catch (err) {
        console.error('[/kegiatan] DB error:', err.message || err);
        res.render('kegiatan', { title: 'Kegiatan', route: '/kegiatan', kegiatan: [], activeFilter: 'all' }, (renderErr, html) => {
            if (renderErr) {
                console.error('[/kegiatan] Fallback render error:', renderErr.message || renderErr);
                return res.status(500).send('<h1>Gagal memuat halaman kegiatan</h1><pre>' + renderErr.message + '</pre>');
            }
            res.send(html);
        });
    }
});

app.get('/kegiatan/:id', async (req, res) => {
    try {
        const item = await getKegiatanById(req.params.id);
        if (!item) return res.status(404).render('404', { title: 'Tidak Ditemukan', route: '' });
        
        // Ambil kegiatan terkait dari kategori yang sama
        const allKegiatan = await getKegiatan({ kategori: item.kategori });
        const cleanDesc = item.deskripsi ? item.deskripsi.replace(/<[^>]*>/g, '').substring(0, 160).trim() + '...' : item.judul;
        
        res.render('detail-kegiatan', { 
            title: item.judul, 
            route: '/kegiatan', 
            item, 
            related,
            metaDescription: cleanDesc,
            metaKeywords: `${item.kategori || 'sosial'}, kegiatan, mempawah, karang taruna`,
            metaImage: item.gambar
        });
    } catch (err) {
        res.status(404).render('404', { title: 'Tidak Ditemukan', route: '' });
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

app.get('/struktur', async (req, res) => {
    try {
        const list = await getPengurus();
        res.render('struktur', { title: 'Struktur Kepengurusan', route: '/struktur', pengurus: list });
    } catch (err) {
        console.error('[/struktur] Error:', err);
        res.render('struktur', { title: 'Struktur Kepengurusan', route: '/struktur', pengurus: [] });
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

app.get(/^\/google([a-zA-Z0-9]+)\.html$/, (req, res) => {
    const code = req.params[0];
    res.type('text/html');
    res.send(`google-site-verification: google${code}.html`);
});

app.get('/sitemap.xml', async (req, res) => {
    try {
        const [beritaData, kegiatanData] = await Promise.all([getBerita(), getKegiatan()]);
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'karangtaruna-xi.vercel.app';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const baseUrl = `${protocol}://${host}`;
        
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
        
        const staticPages = [
            { path: '', changefreq: 'daily', priority: '1.0' },
            { path: '/tentang', changefreq: 'weekly', priority: '0.8' },
            { path: '/struktur', changefreq: 'weekly', priority: '0.8' },
            { path: '/berita', changefreq: 'daily', priority: '0.9' },
            { path: '/kegiatan', changefreq: 'daily', priority: '0.9' },
            { path: '/galeri', changefreq: 'weekly', priority: '0.7' },
            { path: '/kontak', changefreq: 'monthly', priority: '0.6' }
        ];
        
        staticPages.forEach(p => {
            xml += `  <url>\n`;
            xml += `    <loc>${baseUrl}${p.path}</loc>\n`;
            xml += `    <changefreq>${p.changefreq}</changefreq>\n`;
            xml += `    <priority>${p.priority}</priority>\n`;
            xml += `  </url>\n`;
        });
        
        beritaData.forEach(item => {
            xml += `  <url>\n`;
            xml += `    <loc>${baseUrl}/berita/${item.slug}</loc>\n`;
            xml += `    <changefreq>monthly</changefreq>\n`;
            xml += `    <priority>0.8</priority>\n`;
            xml += `  </url>\n`;
        });
        
        kegiatanData.forEach(item => {
            xml += `  <url>\n`;
            xml += `    <loc>${baseUrl}/kegiatan/${item.id}</loc>\n`;
            xml += `    <changefreq>monthly</changefreq>\n`;
            xml += `    <priority>0.7</priority>\n`;
            xml += `  </url>\n`;
        });
        
        xml += `</urlset>`;
        
        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (err) {
        console.error('Sitemap error:', err);
        res.status(500).send('Error generating sitemap');
    }
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[Global Error]', req.method, req.path, err.message || err);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).send('<h1>Server Error</h1><p>' + (err.message || 'Unknown error') + '</p>');
});

app.use((req, res) => res.status(404).render('404', { title: 'Halaman Tidak Ditemukan', route: '' }));

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`🔑 Admin: http://localhost:${PORT}/admin/login`);
});
