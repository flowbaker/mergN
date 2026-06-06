# Deploy — builder.quollhq.com (flowbaker-main box)

`flowbaker/workflowv2` → mevcut Hetzner kutusuna (`flowbaker-main`), flowbaker
servislerinin yanına, çakışmadan deploy.

## Mimari

```
Cloudflare (*.flowbaker.io origin cert, proxied DNS)
   → host nginx → 127.0.0.1:8787 → app container (localhost-only)
        ├─ mongo container (izole, named volume)   [flowbaker Mongo'ya dokunmaz]
        └─ Garage S3 :3900 (host.docker.internal)  [ayrı bucket + key]
```

- App sadece `127.0.0.1:8787` dinler; public erişim host nginx üzerinden.
- State: kendi Mongo container'ı + Garage (secret vault). flowbaker'ın hiçbir
  servisine dokunulmaz.
- TLS: `builder.quollhq.com` için ayrı cert (`/etc/ssl/quollhq/`).
- Compose project adı `workflow-builder` → container'lar `workflow-builder-*`.

## Tek seferlik kurulum (kutuda, root)

### 1. Garage: ayrı bucket + key

```bash
garage bucket create workflow-secrets
garage key create workflow-builder-key      # çıktıdaki Key ID + Secret'ı not al
garage bucket allow --read --write workflow-secrets --key workflow-builder-key
```

Key ID → `GARAGE_KEY_ID`, Secret → `GARAGE_KEY_SECRET` (GitHub secret olacak).

### 2. TLS cert + nginx vhost

`builder.quollhq.com` için cert/key'i kutuya koy:

```bash
mkdir -p /etc/ssl/quollhq
# fullchain → builder.quollhq.com.pem, private key → builder.quollhq.com.key.pem
cp builder.quollhq.com.conf /etc/nginx/conf.d/builder.quollhq.com.conf
nginx -t && systemctl reload nginx
```

### 3. DNS

`builder.quollhq.com` → kutu IP'si (65.21.0.186). Cloudflare arkasındaysa
**Proxied**; değilse düz A kaydı + Let's Encrypt.

### 4. Self-hosted runner (flowbaker/workflowv2)

Mevcut runner'lar `github-runner` user'ı altında, her biri tek repo'ya bağlı.
`workflowv2` için yeni runner:

```bash
sudo -u github-runner -i
cd ~ && mkdir actions-runner-workflowv2 && cd actions-runner-workflowv2
# en güncel runner paketini indir (flowbaker/workflowv2 → Settings → Actions → Runners → New)
./config.sh --url https://github.com/flowbaker/workflowv2 --token <REG_TOKEN>
# servis olarak kur
sudo ./svc.sh install github-runner && sudo ./svc.sh start
```

### 5. GitHub Actions secrets (repo: flowbaker/workflowv2)

`GARAGE_KEY_ID`, `GARAGE_KEY_SECRET`, `GOOGLE_GENERATIVE_AI_API_KEY`,
`GEMINI_MODEL`, `BETTER_AUTH_SECRET` (zorunlu — `openssl rand -base64 32`),
`SLACK_TOKEN`, (opsiyonel) `LANGFUSE_*`. Bkz. `.env.example`.

Sosyal login (opsiyonel): `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` ve/veya
`GH_OAUTH_CLIENT_ID` / `GH_OAUTH_CLIENT_SECRET`. Env yoksa o provider kapalı,
email/şifre login yine çalışır.

### 5a. Kullanıcı auth'u (Better Auth)

App kendi kullanıcı auth'unu Better Auth ile yapar; kullanıcı/session **Mongo'da**
(`mongodbAdapter`, migration yok). Spaces artık giriş yapan kullanıcının
sahipliğine bağlı (kişisel model) — `x-space-id` header'ı sunucuda doğrulanır.

Google sosyal login için Google Cloud Console'da OAuth2 client aç, redirect URI:

```
https://builder.quollhq.com/api/auth/callback/google
```

(GitHub için: `.../api/auth/callback/github`.)

## Deploy

`main`'e push → runner kutuda build eder + `docker compose up -d --build` →
`builder.flowbaker.io` canlı. Workflow: `.github/workflows/deploy.yml`.

Manuel (kutuda) test:

```bash
cd /path/to/workflowv2
GARAGE_KEY_ID=... GARAGE_KEY_SECRET=... GOOGLE_GENERATIVE_AI_API_KEY=... \
  docker compose -f deploy/flowbaker/docker-compose.yml up -d --build
curl -s -H 'x-space-id:default' http://127.0.0.1:8787/api/spaces
```

## Notlar

- Mongo verisi `workflow-builder_mongo-data` volume'unda; rebuild'lerde kalır.
- Garage host servisi olduğu için app ona `host.docker.internal:host-gateway`
  ile ulaşır (compose'da `extra_hosts`).
- Chat/run SSE stream'liyor → nginx'te `proxy_buffering off` zorunlu (config'de var).
- Lokal remote `xis/workflowv2` ise güncelle:
  `git remote set-url origin git@github.com:flowbaker/workflowv2.git`
