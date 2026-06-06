# Guía de Despliegue en Servidores VPS Linux Ubuntu - Sinergia Meet
Ecosistema: Sinergia Meet, Sinergia Wallet, Sinergia Pay, Sinergia Workspace.

Este archivo documenta la infraestructura de contenedores Docker, el archivo de composición `docker-compose.yml`, la configuración de Nginx con SSL Let's Encrypt para el dominio `sinergiameet.com` y los comandos de automatización para desplegarlos en un VPS Ubuntu.

---

## 1. Dockerfile (Frontend & Backend en Producción)
Guarde esto como `Dockerfile` en la raíz de su proyecto para realizar el despliegue multi-stage:

```dockerfile
# Stage 1: Build Frontend + Backend bundle
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Service Runtime image
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

# Copiar artefactos compilados del stage 1
COPY --from=builder /app/dist ./dist

# Puerto donde corre el dev/start script
EXPOSE 3000

CMD ["npm", "start"]
```

---

## 2. Docker Compose File (`docker-compose.yml`)
Guarde esto como `docker-compose.yml` en el VPS para desplegar la base de datos PostgreSQL, la plataforma Sinergia Meet y el servidor de archivos MinIO:

```yaml
version: '3.8'

services:
  # 1. Base de datos PostgreSQL
  postgres_db:
    image: postgres:15-alpine
    container_name: sinergia_db
    restart: always
    environment:
      POSTGRES_DB: sinergia_meet_db
      POSTGRES_USER: sinergia_admin
      POSTGRES_PASSWORD: SinergiaStrongPassword2026!
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sinergia_admin -d sinergia_meet_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 2. Servidor MinIO (Compatible con Amazon S3 para Grabaciones de Video)
  minio_s3:
    image: minio/minio:RELEASE.2024-01-28T22-35-53Z
    container_name: sinergia_s3
    restart: always
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: sinergiakey_s3
      MINIO_ROOT_PASSWORD: SinergiaSecretPassword2026!
    volumes:
      - miniodata:/data
    command: server /data --console-address ":9001"

  # 3. Aplicación Full Stack Sinergia Meet
  sinergia_app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: sinergia_application
    restart: always
    ports:
      - "3000:3000"
    depends_on:
      postgres_db:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://sinergia_admin:SinergiaStrongPassword2026!@postgres_db:5432/sinergia_meet_db
      GEMINI_API_KEY: "SU_CLAVE_GEMINI_API"
      APP_URL: "https://sinergiameet.com"
      JWT_SECRET: "ClaveDeFirmaSinergiaSaaS2026!!!"
      JWT_REFRESH_SECRET: "ClaveDeRefrescoSinergiaSaaS2026!!!"
      MINIO_ENDPOINT: "minio_s3"
      MINIO_ACCESS_KEY: "sinergiakey_s3"
      MINIO_SECRET_KEY: "SinergiaSecretPassword2026!"

volumes:
  pgdata:
    driver: local
  miniodata:
    driver: local
```

---

## 3. Configuración de Nginx Reverse Proxy (`nginx.conf`)
Cree un archivo de configuración en `/etc/nginx/sites-available/sinergiameet.com` en su VPS Ubuntu:

```nginx
# Redireccionar HTTP a HTTPS automáticamente
server {
    listen 80;
    listen [::]:80;
    server_name sinergiameet.com www.sinergiameet.com;
    return 301 https://$host$request_uri;
}

# Servidor HTTPS con Upstream a Node.js Dockerizado
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name sinergiameet.com www.sinergiameet.com;

    # Certificados SSL Let's Encrypt
    ssl_certificate /etc/letsencrypt/live/sinergiameet.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sinergiameet.com/privkey.pem;

    # Protocolos de Criptografía Segura (OWASP Compliant)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Seguridad de Cabeceras
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "no-referrer-when-downgrade";
    add_header Content-Security-Policy "default-src 'self' http: https: ws: wss: data: blob: 'unsafe-inline' 'unsafe-eval';";

    # WebSocket Ingress para WebRTC / Socket.IO
    location /socket.io {
        proxy_pass http://localhost:3000/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Dirección general de la aplicación
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 4. Instrucciones Rápidas de Despliegue en el VPS:
1. Instale Docker y Docker Compose en su VPS Hostinger Ubuntu:
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install docker.io docker-compose nginx certbot python3-certbot-nginx -y
   ```
2. Obtenga los certificados SSL Let's Encrypt:
   ```bash
   sudo certbot --nginx -d sinergiameet.com -d www.sinergiameet.com --non-interactive --agree-tos -m administracion@sinergiameet.com
   ```
3. Suba los archivos de código a `/var/www/sinergia-meet/` y lance el contenedor:
   ```bash
   cd /var/www/sinergia-meet/
   docker-compose up -d --build
   ```
4. Recargue Nginx:
   ```bash
   sudo systemctl restart nginx
   ```
