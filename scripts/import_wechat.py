#!/usr/bin/env python3
"""
Import a WeChat Pay transaction export (.xlsx) into Pitwall's SQLite DB.

- Skips transfers (转账), refunds, income, and neutral transactions
- Maps merchants to Pitwall categories (karting → existing karting categories,
  food / transport / shopping / groceries / subscriptions / AI → new general categories)
- Stores all amounts as CNY
- De-dupes against existing expenses by (date, amount, description) heuristic
"""
import argparse
import os
import re
import sqlite3
import sys
import uuid
from datetime import datetime
from pathlib import Path

import openpyxl

# --- config ---------------------------------------------------------------

KARTING_KEYWORDS = ("赛车", "竞速", "卡丁", "KART")

# (regex on party + goods, target category name, target category domain)
RULES = [
    # Karting front-desk = entry fees / track time
    (r"极速赛车前台|赛车售票|竞速赛车 财务|竞速体育", "Entry Fees", "karting"),
    # Karting on-site restaurant — tag as karting/Travel so it stays under karting
    (r"极速赛车餐厅", "Travel", "karting"),

    # AI / dev tools
    (r"OPENROUTER|OPENAI|ANTHROPIC|CLAUDE", "Other AI", "ai"),

    # Apple / iCloud / Steam — subscriptions / entertainment
    (r"iCloud", "Subscriptions", "general"),
    (r"^Apple$|apple\.com/bill", "Subscriptions", "general"),
    (r"VALVE|Steam", "Entertainment", "general"),

    # Food delivery / restaurants
    (r"美团|饿了么|肯德基|麦当劳|星巴克|喜茶|CoCo|瑞幸|餐厅|外卖|猪脚饭|比萨|小龙虾|名典|沃歌斯|Wagas", "Food & Dining", "general"),

    # Groceries / supermarkets
    (r"朴朴超市|盒马|沃尔玛|超市|永辉|7-?Eleven|便利店", "Groceries", "general"),

    # Transportation
    (r"滴滴|MTR|地铁|高铁|火车|的士|出租|加油|嘀嗒|哈啰|青桔|公交", "Transportation", "general"),

    # Travel / accommodation
    (r"携程|去哪儿|飞猪|保游网|酒店|航空", "Travel", "general"),

    # E-commerce
    (r"京东|淘宝|天猫|拼多多|亚马逊|amazon", "Shopping", "general"),
]

# Categories we may need to create. (name, domain, color, icon)
NEW_CATS = [
    ("Food & Dining",   "general", "#f87171", "🍜"),
    ("Transportation",  "general", "#4f7df7", "🚕"),
    ("Shopping",        "general", "#a78bfa", "🛍️"),
    ("Groceries",       "general", "#34d399", "🛒"),
    ("Entertainment",   "general", "#f59e0b", "🎮"),
    ("Subscriptions",   "general", "#22d3ee", "🔁"),
    ("Travel",          "general", "#60a5fa", "✈️"),
]

# --- helpers --------------------------------------------------------------

def categorize(party: str, goods: str) -> tuple[str, str]:
    """Return (category_name, domain) for a WeChat transaction."""
    text = f"{party} {goods}"
    for pattern, name, domain in RULES:
        if re.search(pattern, text, re.IGNORECASE):
            return name, domain
    return "Uncategorized", "general"


def short_desc(party: str, goods: str) -> str:
    """Build a short, human-readable description."""
    party = (party or "").strip()
    goods = (goods or "").strip()
    # Strip the long numeric transaction-ID tail
    goods = re.sub(r"-?[0-9]{8,}.*$", "", goods).strip(" -_")
    # First segment of goods (before "-") is usually the actual merchant name
    merchant = goods.split("-")[0].strip() if goods else ""
    # If merchant is just the platform itself or a generic blob, fall back
    if merchant and merchant != party and merchant not in (
        "STRIPE", "VALVE", "Apple", "美团外卖App", party,
    ):
        return f"{party} · {merchant}" if party else merchant
    return party or goods or "WeChat Pay transaction"


def parse_xlsx(path: Path) -> list[dict]:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb["Sheet1"]
    rows = list(ws.iter_rows(values_only=True))
    # Header row is at index 17 (0-based)
    out = []
    for r in rows[18:]:
        if r[0] is None:
            continue
        dt, txn_type, party, goods, direction, amount, pay_method, status, txn_id, *_ = r
        if not isinstance(dt, datetime):
            continue
        out.append({
            "datetime": dt,
            "type": txn_type or "",
            "party": party or "",
            "goods": goods or "",
            "direction": direction or "",
            "amount": float(amount or 0),
            "pay_method": pay_method or "",
            "status": status or "",
            "txn_id": txn_id or "",
        })
    return out


_PARTIAL_REFUND_RE = re.compile(r"已退款[(\(]¥?\s*([0-9]+(?:\.[0-9]+)?)\s*[)\)]")


def refund_amount(t: dict) -> float | None:
    """If this row is a *partial* refund, return the refunded amount.
    Returns None for full refunds or non-refund rows."""
    status = t.get("status") or ""
    if "已全额退款" in status:
        return None  # caller will skip
    m = _PARTIAL_REFUND_RE.search(status)
    if m:
        return float(m.group(1))
    return None


def is_importable(t: dict) -> bool:
    # Only outgoing
    if t["direction"] != "支出":
        return False
    # Skip P2P transfers
    if t["type"] in ("转账", "微信红包（单发）", "微信红包"):
        return False
    # QR payments: keep if a category rule matches the merchant; otherwise treat as P2P
    if t["type"] == "扫二维码付款":
        name, _ = categorize(t["party"], t["goods"])
        return name != "Uncategorized"
    # Refund handling:
    # - full refunds (已全额退款) → skip the original purchase entirely
    # - partial refunds (已退款(¥X.XX)) → keep, but caller adjusts amount = orig - refund
    # - the income-side refund row (type contains 退款) → skip; we don't log refunds as income
    if "退款" in (t["type"] or ""):
        return False  # the income-side refund row
    status = t.get("status") or ""
    if "已全额退款" in status:
        return False  # full refund: drop original purchase
    # Skip neutral (recharges)
    if t["type"].startswith("转入零钱通"):
        return False
    return True


def ensure_categories(conn: sqlite3.Connection) -> dict[tuple[str, str], str]:
    """Make sure the categories we need exist. Return {(name, domain): id}."""
    cur = conn.cursor()
    cur.execute("SELECT id, name, domain FROM categories")
    by_key = {(name, domain): cid for cid, name, domain in cur.fetchall()}
    now = datetime.utcnow().isoformat() + "Z"
    for name, domain, color, icon in NEW_CATS:
        if (name, domain) not in by_key:
            cid = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO categories (id, name, domain, color, icon, created_at) VALUES (?,?,?,?,?,?)",
                (cid, name, domain, color, icon, now),
            )
            by_key[(name, domain)] = cid
            print(f"  + created category {domain}/{name}")
    conn.commit()
    return by_key


def existing_keys(conn: sqlite3.Connection) -> set[tuple[str, str, float]]:
    cur = conn.cursor()
    cur.execute("SELECT date, description, amount FROM expenses")
    return {(d, desc, round(amt, 2)) for d, desc, amt in cur.fetchall()}


# --- main -----------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx", type=Path)
    ap.add_argument("--db", type=Path, default=Path("pitwall.db"))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.xlsx.exists():
        print(f"ERROR: {args.xlsx} not found", file=sys.stderr)
        sys.exit(1)
    if not args.db.exists():
        print(f"ERROR: db {args.db} not found", file=sys.stderr)
        sys.exit(1)

    transactions = parse_xlsx(args.xlsx)
    print(f"Parsed {len(transactions)} rows from {args.xlsx.name}")

    conn = sqlite3.connect(args.db)
    cats = ensure_categories(conn) if not args.dry_run else {}
    if not args.dry_run:
        # Reload after creation
        cats = ensure_categories(conn)

    # Pre-load existing expense fingerprints to skip duplicates
    existing = existing_keys(conn)

    counts = {}
    skipped = {"non_expense": 0, "duplicate": 0, "zero": 0}
    to_insert = []

    for t in transactions:
        if not is_importable(t):
            skipped["non_expense"] += 1
            continue
        # Adjust for partial refunds: import net (orig - refund), with a note
        refund = refund_amount(t)
        net_amount = t["amount"] - refund if refund is not None else t["amount"]
        if net_amount <= 0:
            skipped["zero"] += 1
            continue
        cat_name, domain = categorize(t["party"], t["goods"])
        date_str = t["datetime"].strftime("%Y-%m-%d")
        desc = short_desc(t["party"], t["goods"])
        if refund is not None:
            desc = f"{desc} (net of partial refund: ¥{t['amount']:.2f} − ¥{refund:.2f})"
        key = (date_str, desc, round(net_amount, 2))
        # Only dedupe against rows that existed BEFORE this import batch.
        # Two legit same-merchant same-amount orders on the same day must both import.
        if key in existing:
            skipped["duplicate"] += 1
            continue
        counts[(domain, cat_name)] = counts.get((domain, cat_name), 0) + 1
        notes = f"WeChat · {t['type']} · {t['pay_method']} · {t['txn_id']}"
        if refund is not None:
            notes += f" · partial refund ¥{refund:.2f}"
        to_insert.append({
            "id": str(uuid.uuid4()),
            "category_id": cats.get((cat_name, domain)) or cats.get(("Uncategorized", "general")),
            "amount": round(net_amount, 2),
            "currency": "CNY",
            "date": date_str,
            "description": desc,
            "notes": notes,
            "created_at": t["datetime"].strftime("%Y-%m-%dT%H:%M:%SZ"),
        })

    # Print summary
    print()
    print(f"Skipped: non-expense={skipped['non_expense']}, duplicate={skipped['duplicate']}, zero={skipped['zero']}")
    print(f"Will insert: {len(to_insert)}")
    print()
    print("By category:")
    for (domain, name), n in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {n:4d}  {domain}/{name}")

    if args.dry_run:
        print("\n--dry-run, not inserting")
        return

    cur = conn.cursor()
    for r in to_insert:
        cur.execute(
            """INSERT INTO expenses
               (id, category_id, amount, currency, date, description, notes, created_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (r["id"], r["category_id"], r["amount"], r["currency"],
             r["date"], r["description"], r["notes"], r["created_at"]),
        )
    conn.commit()
    print(f"\nInserted {len(to_insert)} rows into expenses.")


if __name__ == "__main__":
    main()
