#!/usr/bin/env python3
"""
Import the P2P karting/transport transfers from the WeChat export.
Categories are user-confirmed (see chat).
"""
import sqlite3
import sys
import uuid
from datetime import datetime
from pathlib import Path

import openpyxl

XLSX = Path('/Users/henry/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_n3u786o7k7cc22_1d48/temp/drag/微信支付账单流水文件(20260301-20260504)_20260504121024.xlsx')
DB = Path("pitwall.db")

# (counterparty, date YYYY-MM-DD, amount, category_name, category_domain, description)
PLAN = [
    ("吴海山",     "2026-04-05", 19668.00, "Gear",                        "karting", "吴海山 · Karting equipment"),
    ("吴海山",     "2026-04-28",  1200.00, "Gear",                        "karting", "吴海山 · Karting equipment"),
    ("GV Chester","2026-04-27",  6000.00, "Rentals",                     "karting", "GV Chester (GV) · Coaching + 125cc rental"),
    ("GV Chester","2026-05-02",  2000.00, "Parts & Maintenance",         "karting", "GV Chester (GV) · Front wing replacement"),
    ("廣",         "2026-04-06",  2500.00, "Rentals",                     "karting", "廣 (Zens Racing) · Coaching + 125cc rental"),
    ("廣",         "2026-04-20",  2500.00, "Rentals",                     "karting", "廣 (Zens Racing) · Coaching + 125cc rental"),
    ("廣",         "2026-04-27",  1200.00, "Rentals",                     "karting", "廣 (Zens Racing) · Coaching + 125cc rental"),
    ("Ryan",      "2026-04-13",  1800.00, "Rentals",                     "karting", "Ryan (Marela Racing) · Coaching + 125cc rental"),
    ("Ryan",      "2026-04-18",  1200.00, "Rentals",                     "karting", "Ryan (Marela Racing) · Coaching + 125cc rental"),
    ("江剑平",     "2026-04-10",  1600.00, "Race Entry & Certification",  "karting", "江剑平 · 125cc kart certification"),
    ("江剑平",     "2026-04-11",  1180.00, "Race Entry & Certification",  "karting", "江剑平 · 100cc recreational race"),
    ("Julie",     "2026-04-01",  1000.00, "Rentals",                     "karting", "Julie (WLM Racing / William Lee) · Coaching"),
    ("Julie",     "2026-04-01",  1000.00, "Rentals",                     "karting", "Julie (WLM Racing / William Lee) · Coaching"),
    ("Julie",     "2026-04-05",   183.00, "Rentals",                     "karting", "Julie (WLM Racing / William Lee) · Coaching"),
    ("嗨大星～～",   "2026-04-08",  1388.00, "Gear",                        "karting", "嗨大星 · Onboard camera"),
    ("发给806.",   "2026-05-01",   150.00, "Transportation",              "general", "发给806 · Transportation (red packet)"),
    ("发给806.",   "2026-05-01",   200.00, "Transportation",              "general", "发给806 · Transportation (red packet)"),
    ("William Lee 李偉臨 (WLMRacing)","2026-04-01", 1.00, "Rentals", "karting", "William Lee 李偉臨 (WLMRacing) · Coaching"),
]

NEW_CATS = [
    ("Rentals",                    "karting", "#a78bfa", "🏎️"),
    ("Race Entry & Certification", "karting", "#fbbf24", "🏁"),
]


def find_txn_id(party: str, date_str: str, amount: float) -> str:
    """Locate the matching WeChat row's txn_id for traceability."""
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    rows = list(wb["Sheet1"].iter_rows(values_only=True))[18:]
    for r in rows:
        if r[0] is None:
            continue
        dt, ttype, p, goods, direction, amt, pay, status, txn_id, *_ = r
        if not isinstance(dt, datetime):
            continue
        if (
            (p or "") == party
            and dt.strftime("%Y-%m-%d") == date_str
            and abs(float(amt) - amount) < 0.005
            and direction == "支出"
        ):
            return f"WeChat · {ttype} · {pay} · {txn_id}"
    return f"WeChat · {party} · {date_str} (no match)"


def main():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    # Create new categories
    cur.execute("SELECT id, name, domain FROM categories")
    cats = {(name, domain): cid for cid, name, domain in cur.fetchall()}
    now = datetime.now().isoformat() + "Z"
    for name, domain, color, icon in NEW_CATS:
        if (name, domain) not in cats:
            cid = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO categories (id, name, domain, color, icon, created_at) VALUES (?,?,?,?,?,?)",
                (cid, name, domain, color, icon, now),
            )
            cats[(name, domain)] = cid
            print(f"  + created category {domain}/{name}")
    conn.commit()

    inserted = 0
    for party, date_str, amount, cat_name, cat_dom, desc in PLAN:
        cat_id = cats.get((cat_name, cat_dom))
        if not cat_id:
            print(f"  ! missing category {cat_dom}/{cat_name}, skipping {desc}", file=sys.stderr)
            continue
        notes = find_txn_id(party, date_str, amount)
        cur.execute(
            """INSERT INTO expenses
               (id, category_id, amount, currency, date, description, notes, created_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (str(uuid.uuid4()), cat_id, amount, "CNY", date_str, desc, notes, now),
        )
        inserted += 1
        print(f"  + {date_str}  ¥{amount:>9.2f}  {cat_dom}/{cat_name:<27s} {desc}")
    conn.commit()
    print(f"\nInserted {inserted} P2P rows.")


if __name__ == "__main__":
    main()
