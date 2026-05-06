#!/usr/bin/env bash
# Move the Pitwall SQLite database into iCloud Drive so Apple syncs it
# across your Macs. Backups land in the same iCloud folder.
#
# IMPORTANT: SQLite + iCloud is single-writer only. Don't run the app on two
# machines simultaneously — iCloud doesn't merge concurrent writes. The app
# is fine to run on whichever machine you're using right now; iCloud will
# converge on idle. For real multi-device-concurrent sync you'd need
# Litestream → S3 (different feature).

set -euo pipefail

ICLOUD_ROOT="$HOME/Library/Mobile Documents/com~apple~CloudDocs"
TARGET_DIR="$ICLOUD_ROOT/Pitwall"
TARGET_DB="$TARGET_DIR/pitwall.db"
TARGET_BACKUPS="$TARGET_DIR/backups"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DB="$REPO_ROOT/pitwall.db"

if [ ! -d "$ICLOUD_ROOT" ]; then
  echo "❌ iCloud Drive not found at:"
  echo "   $ICLOUD_ROOT"
  echo
  echo "   Enable iCloud Drive in System Settings → Apple ID → iCloud first."
  exit 1
fi

mkdir -p "$TARGET_DIR" "$TARGET_BACKUPS"

if [ -f "$TARGET_DB" ]; then
  echo "ℹ️  iCloud database already exists at:"
  echo "   $TARGET_DB"
  if [ -f "$LOCAL_DB" ] && [ ! -L "$LOCAL_DB" ]; then
    echo
    echo "   Local file at $LOCAL_DB also exists. Won't overwrite either."
    echo "   Delete one of them manually, then re-run."
    exit 1
  fi
elif [ -f "$LOCAL_DB" ]; then
  echo "→ Moving $LOCAL_DB → $TARGET_DB"
  # SQLite WAL: snapshot first so we copy a clean file
  sqlite3 "$LOCAL_DB" "VACUUM INTO '$TARGET_DB'"
  # If WAL is empty/checkpointed VACUUM INTO is the safest copy. After that
  # we can remove the originals.
  rm -f "$LOCAL_DB" "$LOCAL_DB-shm" "$LOCAL_DB-wal"
else
  echo "→ Creating fresh database at $TARGET_DB"
  sqlite3 "$TARGET_DB" "VACUUM"
fi

# Symlink local repo path to the iCloud location so existing scripts
# (and the Docker mount) keep working unchanged.
if [ ! -L "$LOCAL_DB" ]; then
  ln -s "$TARGET_DB" "$LOCAL_DB"
  echo "→ Symlinked $LOCAL_DB → $TARGET_DB"
fi

echo
echo "✓ Done. Configure the app to use this path:"
echo
echo "  export DATABASE_PATH=\"$TARGET_DB\""
echo "  export BACKUP_DIR=\"$TARGET_BACKUPS\""
echo
echo "Suggested ~/.zshrc additions (uncomment to enable):"
echo "  # export DATABASE_PATH=\"$TARGET_DB\""
echo "  # export BACKUP_DIR=\"$TARGET_BACKUPS\""
echo
echo "On a second Mac, run this script again — iCloud will already have the"
echo "database synced; the script will detect it and just create the symlink."
