#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  SilenX Serv00 First-Time Setup Script
#  Run this ONCE after SSHing into your Serv00 account:
#    bash setup-serv00.sh
# ─────────────────────────────────────────────────────────────

set -e

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     SilenX Serv00 Deployment Setup          ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Install Node 20 via nvm if not available ──────────────
echo "[1/7] Checking Node.js..."
if ! command -v node &>/dev/null; then
  echo "→ Installing nvm + Node 20..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  source "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm use 20
  nvm alias default 20
else
  echo "→ Node $(node -v) already available."
fi

# ── 2. Install PM2 globally ─────────────────────────────────
echo ""
echo "[2/7] Installing PM2 process manager..."
npm install -g pm2
echo "→ PM2 $(pm2 -v) installed."

# ── 3. Clone the GitHub repository ──────────────────────────
echo ""
echo "[3/7] Cloning SilenX repository from GitHub..."
if [ -d "$HOME/silenx" ]; then
  echo "→ Repository already exists. Pulling latest..."
  cd "$HOME/silenx/backend"
  git pull origin main
else
  git clone https://github.com/moyeedkhan74-web/SilenX.git "$HOME/silenx"
  cd "$HOME/silenx/backend"
fi

# ── 4. Install dependencies ──────────────────────────────────
echo ""
echo "[4/7] Installing backend dependencies..."
npm ci --only=production

# ── 5. Build TypeScript ──────────────────────────────────────
echo ""
echo "[5/7] Building TypeScript..."
npm install --save-dev typescript @types/node
npm run build

# ── 6. Create logs directory ─────────────────────────────────
echo ""
echo "[6/7] Creating logs directory..."
mkdir -p logs

# ── 7. Start with PM2 ────────────────────────────────────────
echo ""
echo "[7/7] Starting SilenX backend with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ SilenX backend is LIVE on Serv00!        ║"
echo "║     Run: pm2 logs silenx-backend             ║"
echo "║     to see live server output.               ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
