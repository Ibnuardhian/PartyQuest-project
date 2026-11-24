# Deploy PartyQuest ke Hostinger VPS (Docker)

Panduan ini untuk **Hostinger VPS** (paket KVM) dengan Docker. Shared/Cloud Hosting Hostinger tidak menjalankan Docker, dan PartyQuest butuh PostgreSQL serta koneksi `LISTEN/NOTIFY` yang selalu hidup, jadi pakai VPS.

Stack (`compose.prod.yaml`):

| Layanan | Isi |
|---|---|
| `postgres` | PostgreSQL 17, data di volume `postgres_data`, tidak dibuka ke internet |
| `migrate` | Sekali jalan: `node scripts/migrate.mjs` dari image produksi, lalu berhenti |
| `web` | Next.js standalone (target `runner`), port 3000 hanya di jaringan Docker |
| `caddy` | Port 80/443, HTTPS otomatis (Let's Encrypt) untuk `DOMAIN`, meneruskan ke `web` |

## 1. Siapkan VPS dan domain

1. Di hPanel → VPS, pasang template **Ubuntu 24.04 with Docker** (atau Ubuntu biasa lalu pasang Docker Engine + Compose plugin).
2. Di DNS domain Anda, buat **A record** (misalnya `partyquest.domainanda.com`) ke IP VPS. Tunggu sampai `ping` ke domain itu menunjukkan IP VPS.
3. Pastikan port **80** dan **443** terbuka (firewall hPanel / `ufw allow 80,443/tcp`). Jangan buka 5432.
4. Jika template VPS sudah menjalankan reverse proxy lain di port 80/443 (misalnya Traefik dari Docker Manager), hentikan dulu, atau hapus layanan `caddy` dan arahkan proxy itu ke `web:3000`.

## 2. Ambil kode dan isi konfigurasi

```bash
ssh root@IP_VPS
git clone https://github.com/<akun>/<repo>.git partyquest && cd partyquest
cp .env.production.example .env.production
nano .env.production   # isi DOMAIN, POSTGRES_PASSWORD, GUEST_SESSION_SECRET
```

Buat rahasia acak dengan `openssl rand -hex 24` (password) dan `openssl rand -hex 32` (secret cookie). `.env.production` tidak pernah di-commit. `ELEVENLABS_API_KEY` boleh kosong: suara bawaan memakai voice pack Adam yang sudah ada di repo.

## 3. Jalankan

```bash
docker compose -f compose.prod.yaml --env-file .env.production up -d --build
docker compose -f compose.prod.yaml --env-file .env.production ps
```

`migrate` harus berstatus `Exited (0)`; `web`, `postgres`, `caddy` berstatus `Up`. Buka `https://DOMAIN`. Sertifikat dibuat otomatis pada permintaan pertama (butuh DNS yang sudah benar).

## 4. Update versi baru

```bash
cd partyquest && git pull
docker compose -f compose.prod.yaml --env-file .env.production up -d --build
```

Migrasi baru dijalankan otomatis sebelum `web` dimulai ulang.

## Deploy otomatis dengan GitHub Actions

`.github/workflows/deploy.yml` berjalan di setiap push ke `main` (atau manual lewat **Actions → Verify and deploy → Run workflow**):

1. **verify**: PostgreSQL sementara, `npm ci`, migrasi, typecheck, lint, semua test (termasuk test integrasi database), dan build image produksi.
2. **deploy** (hanya jika verify lolos dan variabel `DEPLOY_ENABLED` = `true`): SSH ke VPS, `git fetch`, checkout **commit yang sama** yang sudah diuji, lalu `docker compose -f compose.prod.yaml --env-file .env.production up -d --build`. Migrasi berjalan otomatis sebelum `web` dimulai ulang. Terakhir health check ke `DEPLOY_URL`.

Penyiapan sekali saja:

1. **Di VPS**, buat user deploy yang boleh menjalankan Docker, lalu clone repo ke folder aplikasi dan isi `.env.production` (langkah 2 di atas):
   ```bash
   adduser --disabled-password --gecos "" deploy && usermod -aG docker deploy
   mkdir -p /opt/partyquest && chown deploy:deploy /opt/partyquest
   su - deploy -c "git clone https://github.com/<akun>/<repo>.git /opt/partyquest"
   ```
   Repo privat: buat deploy key **read-only** di VPS (`ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""` sebagai user `deploy`), tambahkan isi `.pub` di GitHub **Settings → Deploy keys**, dan clone dengan URL `git@github.com:<akun>/<repo>.git`.
2. **Kunci SSH untuk Actions** (di komputer Anda): `ssh-keygen -t ed25519 -f partyquest_actions -N "" -C github-actions`. Tambahkan isi `partyquest_actions.pub` ke `/home/deploy/.ssh/authorized_keys` di VPS.
3. **Host key VPS**: `ssh-keyscan -p 22 IP_VPS` (salin seluruh outputnya). Bandingkan dengan sidik jari di VPS bila perlu: `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`.
4. Di GitHub **Settings → Environments → New environment `production`** (opsional: aktifkan *Required reviewers* agar setiap deploy minta persetujuan), isi:

   | Jenis | Nama | Isi |
   |---|---|---|
   | Secret | `VPS_HOST` | IP atau hostname VPS |
   | Secret | `VPS_USER` | `deploy` |
   | Secret | `VPS_SSH_KEY` | isi file `partyquest_actions` (kunci privat) |
   | Secret | `VPS_KNOWN_HOSTS` | output `ssh-keyscan` |
   | Variable | `VPS_PORT` | opsional, default `22` |
   | Variable | `VPS_APP_DIR` | opsional, default `/opt/partyquest` |
   | Variable | `DEPLOY_URL` | opsional, misalnya `https://partyquest.domainanda.com` (untuk health check) |

5. Di **Settings → Secrets and variables → Actions → Variables** (tingkat repo), buat `DEPLOY_ENABLED` = `true`. Sebelum itu, workflow hanya menjalankan verify.

Rahasia aplikasi (`POSTGRES_PASSWORD`, `GUEST_SESSION_SECRET`, `ELEVENLABS_API_KEY`) tetap hanya di `.env.production` di VPS; workflow tidak pernah membaca atau mengirimnya. Hapus kunci `partyquest_actions` dari komputer Anda setelah disalin ke GitHub.

## Operasional

- Log: `docker compose -f compose.prod.yaml --env-file .env.production logs -f web`
- Backup database: `docker compose -f compose.prod.yaml --env-file .env.production exec postgres pg_dump -U partyquest partyquest > backup-$(date +%F).sql`
- Bersihkan room kedaluwarsa (opsional, misalnya cron harian): `docker compose -f compose.prod.yaml --env-file .env.production exec postgres psql -U partyquest -d partyquest -c "select cleanup_expired_rooms();"`
- Cache TTS ada di volume `tts_cache`; aman dihapus kapan saja (`docker volume rm partyquest_tts_cache` setelah `down`).

## Sudah diuji

Stack ini sudah dijalankan di Docker lokal dengan `DOMAIN=localhost`: migrasi teraplikasi, halaman dan MP3 tersaji lewat HTTPS Caddy, sesi tamu dan pembuatan room berhasil, dan stream SSE (`/api/rooms/<kode>/events`) mengalir lewat Caddy. Deploy ke VPS Hostinger sendiri belum dilakukan.
