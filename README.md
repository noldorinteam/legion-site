# LEGION — FiveM Hacker Grubu Web Sitesi

## Kurulum

### 1. GitHub Pages Kurulumu

1. `noldorinteam` hesabında **`noldorinteam`** adında bir public repo oluştur (username.github.io gibi çalışır).
2. Bu repo'nun içindeki tüm dosyaları push et.
3. Repo Ayarları → Pages → Source: `main` branch, `/root` klasörü seç.
4. Birkaç dakika içinde site yayında olacak.

### 2. Mr. Robot Müziği Ekleme

Mr. Robot tema müziğini (`mr-robot-theme.mp3`) şu klasöre ekle:
```
hacker-sitesi/
  music/
    mr-robot-theme.mp3   ← Bu dosyayı buraya koy
```

**Önemli**: Müzik dosyasını kendin temin etmen gerekiyor (telif hakkı nedeniyle dahil edilmedi).
Önerilen: YouTube'dan indir veya Spotify'dan kaydet. Dosya adı tam olarak `mr-robot-theme.mp3` olmalı.

### 3. GitHub API Deposu Ayarı

`index.html` içindeki config bloğunu güncelle (zaten ayarlı):
```js
window.LEGION_CONFIG = {
  githubToken: "YOUR_TOKEN",
  githubUser:  "noldorinteam",
  githubRepo:  "noldorinteam",  // ← Medyalar hangi repo'ya gidecekse
  branch:      "main"
};
```

> ⚠️ Token'ı public repo'ya commit etme! GitHub Pages için environment variable kullan veya ayrı bir backend oluştur.

### 4. Medya Deposu

Fotoğraf ve videolar GitHub'daki `media/` klasörüne gönderilecek.
Bu klasör otomatik oluşturulur.

## Özellikler

- 🖥️ Hacking-style boot ekranı (Matrix animasyonu + terminal log)
- 🎵 Mr. Robot tema müziği (autoplay)
- 📷 Fotoğraf & video galerisi
- ⬆️ GitHub'a otomatik yükleme (API)
- 🗑️ Fotoğraf/video silme
- 💥 Glitch "01011001" geçiş efekti
- 🇹🇷 Tam Türkçe arayüz
- 🔤 Türkçe karakter destekli hacker fontları

## Dosya Yapısı

```
hacker-sitesi/
├── index.html      # Ana sayfa
├── style.css       # Tüm stiller
├── matrix.js       # Matrix yağmuru animasyonu
├── boot.js         # Boot sekansı
├── github.js       # GitHub API entegrasyonu
├── gallery.js      # Galeri modülü
├── app.js          # Ana uygulama
└── music/
    └── mr-robot-theme.mp3  ← Sen ekleyeceksin
```
