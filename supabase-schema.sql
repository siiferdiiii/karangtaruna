-- ============================================================
-- SQL SCHEMA - Karang Taruna Kelurahan Tanjung, Kab. Mempawah
-- Jalankan di: Supabase SQL Editor
-- ============================================================

-- ── Tabel berita ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS berita (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  judul TEXT NOT NULL,
  ringkasan TEXT NOT NULL,
  konten TEXT NOT NULL,
  kategori TEXT NOT NULL DEFAULT 'Edukasi',
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  penulis TEXT DEFAULT 'Admin',
  gambar TEXT,
  views INTEGER DEFAULT 0,
  tag TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabel kegiatan ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kegiatan (
  id SERIAL PRIMARY KEY,
  judul TEXT NOT NULL,
  kategori TEXT NOT NULL DEFAULT 'sosial',
  lokasi TEXT NOT NULL,
  tanggal DATE NOT NULL,
  deskripsi TEXT,
  gambar TEXT,
  buka_pendaftaran BOOLEAN DEFAULT FALSE,
  pendaftaran_dibuka DATE,
  pendaftaran_ditutup DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabel registrasi ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registrasi (
  id SERIAL PRIMARY KEY,
  jenis TEXT NOT NULL CHECK (jenis IN ('anggota','kegiatan')),
  referensi TEXT,
  kegiatan_id INTEGER REFERENCES kegiatan(id) ON DELETE SET NULL,
  nama TEXT NOT NULL,
  nik TEXT,
  ttl TEXT,
  jenis_kelamin TEXT,
  alamat TEXT,
  no_hp TEXT,
  email TEXT,
  pendidikan TEXT,
  pekerjaan TEXT,
  catatan TEXT,
  tanggal_daftar TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabel galeri ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS galeri (
  id SERIAL PRIMARY KEY,
  judul TEXT NOT NULL,
  deskripsi TEXT,
  gambar_url TEXT NOT NULL,
  kategori TEXT DEFAULT 'umum',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_berita_slug ON berita(slug);
CREATE INDEX IF NOT EXISTS idx_berita_kategori ON berita(kategori);
CREATE INDEX IF NOT EXISTS idx_kegiatan_kategori ON kegiatan(kategori);
CREATE INDEX IF NOT EXISTS idx_registrasi_jenis ON registrasi(jenis);
CREATE INDEX IF NOT EXISTS idx_galeri_kategori ON galeri(kategori);

-- ── Row Level Security ──────────────────────────────────────
ALTER TABLE berita ENABLE ROW LEVEL SECURITY;
ALTER TABLE kegiatan ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE galeri ENABLE ROW LEVEL SECURITY;

-- Public read (anon key bisa baca)
CREATE POLICY "Public read berita" ON berita FOR SELECT USING (true);
CREATE POLICY "Public read kegiatan" ON kegiatan FOR SELECT USING (true);
CREATE POLICY "Public read galeri" ON galeri FOR SELECT USING (true);

-- Service role full access (backend admin)
CREATE POLICY "Service full berita" ON berita FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service full kegiatan" ON kegiatan FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service full registrasi" ON registrasi FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service full galeri" ON galeri FOR ALL USING (true) WITH CHECK (true);

-- ── Supabase Storage: buat bucket 'media' ───────────────────
-- Jalankan ini TERPISAH jika bucket belum ada:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);
-- CREATE POLICY "Public read media" ON storage.objects FOR SELECT USING (bucket_id = 'media');
-- CREATE POLICY "Service upload media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media');
-- CREATE POLICY "Service delete media" ON storage.objects FOR DELETE USING (bucket_id = 'media');

-- ── Seed Data dari JSON (Berita) ────────────────────────────
INSERT INTO berita (slug, judul, ringkasan, konten, kategori, tanggal, penulis, gambar, views, tag) VALUES
('pelatihan-kepemimpinan-pemuda-2026', 'Pelatihan Kepemimpinan Pemuda Tingkat Nasional 2026',
 'Karang Taruna menggelar pelatihan kepemimpinan bagi 500 pemuda dari berbagai daerah di Indonesia.',
 'Karang Taruna Kelurahan Tanjung menggelar Pelatihan Kepemimpinan Pemuda yang diikuti oleh pemuda-pemuda pilihan. Kegiatan ini bertujuan untuk membentuk karakter kepemimpinan dan meningkatkan kapasitas organisasi.',
 'Edukasi', '2026-05-15', 'Admin KT',
 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&h=500&fit=crop',
 1250, ARRAY['pelatihan','kepemimpinan']),

('aksi-bersih-pantai-serentak', 'Aksi Bersih Pantai di Wilayah Tanjung',
 'Anggota Karang Taruna Tanjung turut serta dalam gerakan bersih pantai untuk menjaga lingkungan.',
 'Dalam rangka memperingati Hari Lingkungan Hidup, Karang Taruna Kelurahan Tanjung menggelar aksi bersih pantai yang melibatkan ratusan anggota aktif dan warga setempat.',
 'Lingkungan', '2026-05-12', 'Tim Media KT',
 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&h=500&fit=crop',
 890, ARRAY['lingkungan','pantai']),

('program-wirausaha-muda', 'Program Wirausaha Muda Karang Taruna Tanjung',
 'Karang Taruna Tanjung membuka program pelatihan wirausaha untuk pemuda usia 17-30 tahun.',
 'Program wirausaha muda ini dirancang untuk membekali pemuda Kelurahan Tanjung dengan keterampilan bisnis, manajemen keuangan, dan pemasaran digital untuk menghadapi era kompetisi global.',
 'Edukasi', '2026-05-08', 'Admin KT',
 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=500&fit=crop',
 650, ARRAY['wirausaha','pemuda'])
ON CONFLICT (slug) DO NOTHING;

-- ── Seed Data (Kegiatan) ────────────────────────────────────
INSERT INTO kegiatan (judul, kategori, lokasi, tanggal, deskripsi, gambar, buka_pendaftaran) VALUES
('Gotong Royong Bersih Kelurahan', 'lingkungan', 'Kelurahan Tanjung', '2026-05-25',
 'Gotong royong membersihkan lingkungan Kelurahan Tanjung bersama warga dan pengurus RT/RW.',
 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop', false),

('Festival Seni Budaya Pemuda Tanjung', 'kreativitas', 'Balai Kelurahan Tanjung', '2026-06-10',
 'Festival seni budaya menampilkan bakat-bakat muda Kelurahan Tanjung dalam bidang musik, tari, dan kerajinan tangan.',
 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=600&h=400&fit=crop', true),

('Bakti Sosial Ramadhan', 'sosial', 'Masjid Al-Hidayah Tanjung', '2026-06-01',
 'Kegiatan bakti sosial berupa pembagian sembako dan buka puasa bersama bagi warga kurang mampu di Kelurahan Tanjung.',
 'https://images.unsplash.com/photo-1469571486292-b53601010b89?w=600&h=400&fit=crop', false)
ON CONFLICT DO NOTHING;
