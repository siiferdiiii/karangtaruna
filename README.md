# 🚀 Karang Taruna - Media Informasi (Node.js)

Aplikasi web media informasi resmi Karang Taruna Indonesia dibangun dengan **Node.js**, **Express.js**, dan **EJS**.

## 📁 Struktur Project

```
karang-taruna-nodejs/
├── data/               # Mock data (JSON)
├── public/             # Static assets (CSS, JS, Images)
├── views/              # EJS Templates
│   └── partials/       # Reusable components
├── server.js           # Entry point
├── package.json
└── .env
```

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Jalankan Server
```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

### 3. Buka Browser
```
http://localhost:3000
```

## 🛠️ Fitur

- ✅ Server-side rendering dengan EJS
- ✅ Routing dinamis (Home, Berita, Kegiatan, Galeri, Tentang, Kontak)
- ✅ Detail berita dengan slug URL
- ✅ Filter kegiatan berdasarkan kategori (Sosial, Edukasi, Lingkungan)
- ✅ Responsive design dengan Tailwind CDN
- ✅ Mock data siap pakai (bisa diganti dengan database)
- ✅ Contact form handling

## 📦 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Template Engine**: EJS
- **CSS**: Tailwind CSS (CDN)
- **Icons**: Font Awesome (CDN)
- **Fonts**: Google Fonts - Poppins

## 🔧 Customization

- Edit file di folder `data/` untuk mengubah konten berita & kegiatan
- Edit file di folder `views/` untuk mengubah tampilan
- Edit file `public/css/style.css` untuk custom styling

## 📄 License

MIT License - Karang Taruna Indonesia
