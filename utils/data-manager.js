const supabase = require('./supabase');
const path = require('path');
const slugify = require('slugify');

// ── BERITA ────────────────────────────────────────────────────────────────────

async function getBerita({ kategori, search } = {}) {
    let query = supabase.from('berita').select('*').order('tanggal', { ascending: false });
    if (kategori && kategori !== 'all') query = query.eq('kategori', kategori);
    if (search) query = query.ilike('judul', `%${search}%`);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

async function getBeritaById(id) {
    const { data, error } = await supabase.from('berita').select('*').eq('id', id).single();
    if (error) return null;
    return data;
}

async function getBeritaBySlug(slug) {
    const { data, error } = await supabase.from('berita').select('*').eq('slug', slug).single();
    if (error) return null;
    return data;
}

async function incrementBeritaViews(id, currentViews) {
    await supabase.from('berita').update({ views: (currentViews || 0) + 1 }).eq('id', id);
}

async function createBerita(data) {
    const { data: result, error } = await supabase.from('berita').insert(data).select().single();
    if (error) throw error;
    return result;
}

async function updateBerita(id, data) {
    const { data: result, error } = await supabase.from('berita').update(data).eq('id', id).select().single();
    if (error) throw error;
    return result;
}

async function deleteBerita(id) {
    const { error } = await supabase.from('berita').delete().eq('id', id);
    if (error) throw error;
}

// ── KEGIATAN ──────────────────────────────────────────────────────────────────

async function getKegiatan({ kategori } = {}) {
    let query = supabase.from('kegiatan').select('*').order('tanggal', { ascending: false });
    if (kategori && kategori !== 'all') query = query.eq('kategori', kategori);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

async function getKegiatanById(id) {
    const { data, error } = await supabase.from('kegiatan').select('*').eq('id', id).single();
    if (error) return null;
    return data;
}

async function createKegiatan(data) {
    const { data: result, error } = await supabase.from('kegiatan').insert(data).select().single();
    if (error) throw error;
    return result;
}

async function updateKegiatan(id, data) {
    const { data: result, error } = await supabase.from('kegiatan').update(data).eq('id', id).select().single();
    if (error) throw error;
    return result;
}

async function deleteKegiatan(id) {
    const { error } = await supabase.from('kegiatan').delete().eq('id', id);
    if (error) throw error;
}

// ── REGISTRASI ────────────────────────────────────────────────────────────────

async function getRegistrasi() {
    const { data, error } = await supabase.from('registrasi').select('*').order('tanggal_daftar', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function createRegistrasi(data) {
    const { data: result, error } = await supabase.from('registrasi').insert(data).select().single();
    if (error) throw error;
    return result;
}

async function deleteRegistrasi(id) {
    const { error } = await supabase.from('registrasi').delete().eq('id', id);
    if (error) throw error;
}

// ── GALERI ────────────────────────────────────────────────────────────────────

async function getGaleri({ kategori } = {}) {
    let query = supabase.from('galeri').select('*').order('created_at', { ascending: false });
    if (kategori && kategori !== 'all') query = query.eq('kategori', kategori);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

async function createGaleri(data) {
    const { data: result, error } = await supabase.from('galeri').insert(data).select().single();
    if (error) throw error;
    return result;
}

async function deleteGaleriItem(id) {
    const { error } = await supabase.from('galeri').delete().eq('id', id);
    if (error) throw error;
}

// ── IMAGE UPLOAD via Supabase Storage ─────────────────────────────────────────

async function uploadImage(fileBuffer, fileName, mimetype) {
    const ext = path.extname(fileName);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    const { data, error } = await supabase.storage
        .from('media')
        .upload(`uploads/${uniqueName}`, fileBuffer, { contentType: mimetype, upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('media').getPublicUrl(`uploads/${uniqueName}`);
    return urlData.publicUrl;
}

async function deleteImage(url) {
    try {
        // Ekstrak path dari URL publik Supabase Storage
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/storage/v1/object/public/media/');
        if (pathParts.length > 1) {
            await supabase.storage.from('media').remove([pathParts[1]]);
        }
    } catch (e) {
        console.warn('Gagal menghapus file dari storage:', e.message);
    }
}

// ── SLUG UTILS ────────────────────────────────────────────────────────────────

function generateSlug(title) {
    return slugify(title, { lower: true, strict: true, locale: 'id' });
}

async function ensureUniqueSlugDB(slug, excludeId = null) {
    let uniqueSlug = slug;
    let counter = 1;
    while (true) {
        let query = supabase.from('berita').select('id').eq('slug', uniqueSlug);
        if (excludeId) query = query.neq('id', excludeId);
        const { data } = await query;
        if (!data || data.length === 0) break;
        uniqueSlug = `${slug}-${counter}`;
        counter++;
    }
    return uniqueSlug;
}


// ── SETTINGS ─────────────────────────────────────────────────────────────────

// Default settings jika belum ada di DB
const DEFAULT_SETTINGS = {
    hero_badge: 'Media Informasi Resmi',
    hero_title_line1: 'Generasi Muda',
    hero_title_line2: 'Indonesia Emas',
    hero_description: 'Karang Taruna adalah organisasi kepemudaan yang menjadi wadah pengembangan generasi muda untuk berkontribusi aktif dalam pembangunan masyarakat, bangsa, dan negara.',
    hero_image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&h=700&fit=crop',
    stat1_number: '500+', stat1_label: 'Organisasi Aktif',
    stat2_number: '10K+', stat2_label: 'Anggota Terdaftar',
    stat3_number: '50+',  stat3_label: 'Program Tahunan',
    kontak_alamat: 'Jl. Tanjung No. 1, Kelurahan Tanjung, Kabupaten Mempawah, Kalimantan Barat',
    kontak_phone: '+62 811-5700-000',
    kontak_email: 'karangtaruna.tanjung@gmail.com',
    kontak_instagram: '',
    kontak_tiktok: '',
    kontak_facebook: '',
    kontak_whatsapp: '',
    footer_description: 'Wadah pengembangan generasi muda Kelurahan Tanjung yang aktif, kreatif, dan berkontribusi untuk kemajuan masyarakat dan bangsa.'
};

async function getSettings() {
    try {
        const { data, error } = await supabase.from('settings').select('key, value');
        if (error || !data) return { ...DEFAULT_SETTINGS };
        const result = { ...DEFAULT_SETTINGS };
        data.forEach(row => { result[row.key] = row.value; });
        return result;
    } catch (e) {
        return { ...DEFAULT_SETTINGS };
    }
}

async function updateSettings(settingsObj) {
    const rows = Object.entries(settingsObj).map(([key, value]) => ({ key, value: value || '' }));
    for (const row of rows) {
        await supabase.from('settings').upsert(row, { onConflict: 'key' });
    }
    return true;
}

module.exports = {
    getBerita, getBeritaById, getBeritaBySlug, incrementBeritaViews,
    createBerita, updateBerita, deleteBerita,
    getKegiatan, getKegiatanById, createKegiatan, updateKegiatan, deleteKegiatan,
    getRegistrasi, createRegistrasi, deleteRegistrasi,
    getGaleri, createGaleri, deleteGaleriItem,
    uploadImage, deleteImage,
    generateSlug, ensureUniqueSlugDB,
    getSettings, updateSettings
};
