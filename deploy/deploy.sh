#!/bin/bash
set -e

# 加载 nvm（SSH 非交互模式需要手动 source）
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

PROJECT_DIR="/home/admin/WorkSpace/project/HA-PORTALS"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "=== HA-PORTALS 部署脚本 ==="

# 1. 后端 venv + 依赖
echo "[1/5] 设置后端环境..."
cd "$BACKEND_DIR"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt --quiet

# 2. 确保数据目录存在 + 初始化 + 备份
echo "[2/5] 检查数据目录..."
mkdir -p data uploads

if [ ! -f "data/ha-portals.db" ] && [ -f "data/seed.db" ]; then
    echo "  初始化数据库 (seed.db → ha-portals.db)"
    cp data/seed.db data/ha-portals.db
fi

# 部署前备份（存在才备，成本几乎为 0）
if [ -f "data/ha-portals.db" ]; then
    BAK="data/ha-portals.db.deploy-bak.$(date +%Y%m%d_%H%M%S)"
    cp "data/ha-portals.db" "$BAK"
    echo "  部署前备份: $BAK"
    # 只保留最近 5 份部署备份
    ls -1t data/ha-portals.db.deploy-bak.* 2>/dev/null | tail -n +6 | xargs -r rm -f
fi

# 检查 .env（缺少则中止，不允许用默认密码启动）
if [ ! -f ".env" ]; then
    echo "❌ 错误：$BACKEND_DIR/.env 不存在"
    echo "   请先复制 .env.example 并修改 ADMIN_PASSWORD 和 JWT_SECRET_KEY："
    echo "   cp $BACKEND_DIR/.env.example $BACKEND_DIR/.env"
    echo "   vim $BACKEND_DIR/.env"
    exit 1
fi

# 检查 .env 中的关键密钥是否仍为默认值
if grep -q 'ADMIN_PASSWORD=changeme' .env 2>/dev/null; then
    echo "❌ 错误：ADMIN_PASSWORD 仍为默认值 'changeme'，请修改后重试"
    exit 1
fi
if grep -q 'JWT_SECRET_KEY=change-this-to-a-random-secret-key' .env 2>/dev/null; then
    echo "❌ 错误：JWT_SECRET_KEY 仍为默认值，请修改后重试"
    exit 1
fi
# 3. 构建前端
echo "[3/5] 构建前端..."
cd "$FRONTEND_DIR"
npm ci --silent
npm run build

# 4. systemd 服务
echo "[4/5] 配置 systemd 服务..."
sudo cp "$PROJECT_DIR/deploy/ha-portals.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ha-portals
sudo systemctl restart ha-portals

# 5. Nginx
echo "[5/5] 配置 Nginx..."
sudo mkdir -p /etc/nginx/snippets
sudo cp "$PROJECT_DIR/deploy/nginx.conf" /etc/nginx/snippets/ha-portals.conf

# 检查 PSY server 块是否已 include 本文件
if ! sudo grep -q 'ha-portals.conf' /etc/nginx/conf.d/psy-cms.conf 2>/dev/null; then
    echo "⚠️  请在 /etc/nginx/conf.d/psy-cms.conf 的 server 块末尾添加："
    echo "    include /etc/nginx/snippets/ha-portals.conf;"
    echo "  然后运行: sudo nginx -t && sudo systemctl reload nginx"
else
    sudo nginx -t && sudo systemctl reload nginx
fi

echo ""
echo "=== 部署完成 ==="
echo "后端运行在: http://127.0.0.1:8002"
echo "前台访问: http://$(hostname -I | awk '{print $1}')/ha/"
echo "后台管理: http://$(hostname -I | awk '{print $1}')/ha/admin"
echo ""
echo "⚠️  首次部署请确认："
echo "  1. /etc/nginx/conf.d/psy-cms.conf 的 server 块中已 include snippets/ha-portals.conf"
echo "  2. $BACKEND_DIR/.env 中的密码和密钥已修改"
echo ""

# 6. 部署后健康检查（3 秒后重试一次）
echo "[6/6] 健康检查..."
sleep 3
if curl -sf -m 5 http://127.0.0.1:8002/api/health >/dev/null 2>&1; then
    echo "✅ 后端健康检查通过"
else
    echo "⚠️  后端健康检查失败 - 检查日志: journalctl -u ha-portals -n 50"
fi
