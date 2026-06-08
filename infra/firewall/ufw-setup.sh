#!/usr/bin/env bash
# ============================================================================
# SINERGIA MEET - AUTOMATED UBUNTU FIREWALL REGULATION (ufw-setup.sh)
# Safe, non-blocking network configuration for VPS WebRTC systems
# ============================================================================

set -euo pipefail

# 1. Verification of execution context
if [ "$EUID" -ne 0 ]; then
  echo "[-] Este script debe ejecutarse con privilegios elevados (root/sudo)." >&2
  exit 1
fi

echo "[*] Iniciando configuración de cortafuegos para Sinergia Meet..."

# 2. Reset standard rules
echo "[*] Restableciendo valores por defecto en UFW..."
ufw --force reset

# Set default deny for incoming and allow for outgoing
ufw default deny incoming
ufw default allow outgoing

# 3. Allow remote SSH management (CRITICAL to avoid locking yourself out of VPS)
echo "[+] Permitiendo control SSH (Puerto 22)..."
ufw allow 22/tcp comment 'SSH Remote Control'

# 4. Allow corporate web servers traffic (Nginx proxy)
echo "[+] Permitiendo tráfico Web standard HTTP/S (Puertos 80, 443)..."
ufw allow 80/tcp comment 'HTTP Standard Web'
ufw allow 443/tcp comment 'HTTPS Secure Web'

# 5. Allow peer signaling transport through Express / Socket.IO
echo "[+] Permitiendo puerto interno de Sinergia Backend (Puerto 3000)..."
ufw allow 3000/tcp comment 'Sinergia API Ingress'

# 6. Allow Coturn (STUN/TURN Protocols)
echo "[+] Permitiendo puertos escuchas de Coturn (Puertos 3478, 5349)..."
ufw allow 3478/tcp comment 'Coturn STUN/TURN TCP'
ufw allow 3478/udp comment 'Coturn STUN/TURN UDP'
ufw allow 5349/tcp comment 'Coturn Secure TURNS TCP'
ufw allow 5349/udp comment 'Coturn Secure TURNS UDP'

# 7. Allow dynamically allocated RTP/RTCP media streams for WebRTC
echo "[+] Permitiendo el rango dinámico de transmisión WebRTC UDP (49152-65535)..."
ufw allow 49152:65535/udp comment 'WebRTC UDP Media Streams'

# 8. Enable firewall
echo "[*] Activando cortafuegos en Ubuntu..."
ufw --force enable

echo "[+] Configuración de Firewall completada correctamente."
ufw status verbose
