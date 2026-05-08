#!/bin/bash
# HA-PORTALS 数据库 + 上传文件备份脚本
# 用法：bash scripts/backup.sh
# 建议 cron：0 3 * * * /home/admin/WorkSpace/project/HA-PORTALS/scripts/backup.sh

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${HA_PORTALS_BACKUP_DIR:-$HOME/backups/ha-portals}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS="${HA_PORTALS_BACKUP_RETENTION:-30}"

mkdir -p "$BACKUP_DIR"

DB_SRC="$PROJECT_DIR/backend/data/ha-portals.db"
UPLOADS_SRC="$PROJECT_DIR/backend/uploads"

# 备份数据库（用 sqlite3 .backup 保证一致性，回退到 cp）
if [ -f "$DB_SRC" ]; then
    DB_DST="$BACKUP_DIR/ha-portals.$TIMESTAMP.db"
    if command -v sqlite3 >/dev/null 2>&1; then
        sqlite3 "$DB_SRC" ".backup '$DB_DST'"
    else
        cp "$DB_SRC" "$DB_DST"
    fi
    echo "[OK] 数据库备份: $DB_DST ($(du -h "$DB_DST" | cut -f1))"
else
    echo "[WARN] 数据库不存在: $DB_SRC"
fi

# 备份上传文件目录
if [ -d "$UPLOADS_SRC" ] && [ -n "$(ls -A "$UPLOADS_SRC" 2>/dev/null)" ]; then
    UP_DST="$BACKUP_DIR/uploads.$TIMESTAMP.tar.gz"
    tar czf "$UP_DST" -C "$PROJECT_DIR/backend" uploads/
    echo "[OK] 上传文件备份: $UP_DST ($(du -h "$UP_DST" | cut -f1))"
else
    echo "[INFO] uploads/ 为空，跳过"
fi

# 清理过期备份
find "$BACKUP_DIR" -maxdepth 1 -name "ha-portals.*.db" -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true
find "$BACKUP_DIR" -maxdepth 1 -name "uploads.*.tar.gz" -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true
echo "[OK] 已清理 $RETENTION_DAYS 天前的备份"
