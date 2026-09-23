# APKify V1

APKify adalah Web App yang membuat APK Android WebView dari:
- URL website
- HTML
- ZIP website

## Jalankan server

```bash
npm install
npm start
```

Buka:

```text
http://localhost:3000
```

## Build worker

Server pembuat APK membutuhkan:
- Linux
- JDK 17+
- Android SDK
- Android platform 35
- Android build-tools
- `unzip`
- Gradle 8.x / Gradle Wrapper

APKify membuat project Android per-build di `builds/<project-id>/`, lalu menjalankan:

```bash
./gradlew assembleRelease
```

## Alur

Frontend → API → project record → builder → Android project → WebView → Gradle → APK.

## Catatan

V1 ini sengaja menggunakan builder lokal/server sendiri. Jangan menjalankan builder dengan akun root pada server produksi. Tambahkan sandbox/container, queue, timeout, antivirus/archive validation, authentication, rate limiting, dan storage terpisah sebelum menerima upload publik.

Untuk URL, APK membuka URL tersebut melalui WebView. Untuk HTML/ZIP, file dimasukkan ke `android_asset/web/`.

## GitHub Actions

Untuk deploy builder, gunakan runner Linux yang memiliki Android SDK/JDK. Jangan mencoba menjalankan Gradle Android sebagai fungsi serverless biasa.
