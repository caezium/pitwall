#!/usr/bin/env python3
"""
Round 2 of recategorizations:
  1. Delete Yvonne-reimbursed tickets (¥176, ¥352, ¥220 — wash, ¥748 total)
  2. Tag all 亲属卡(zwz) family-card expenses with `zwz-paid` so they're
     visible but counted against zwz, not henry
  3. Compute reimbursement balance: zwz funding (transfers + 亲属卡) vs
     henry's out-of-pocket karting spending
"""
import sqlite3
import sys
import uuid
from datetime import datetime
from pathlib import Path

import openpyxl

DB = Path("pitwall.db")
XLSX = Path(
    '/Users/henry/Library/Containers/com.tencent.xinWeChat/Data/Documents/'
    'xwechat_files/wxid_n3u786o7k7cc22_1d48/temp/drag/'
    '微信支付账单流水文件(20260301-20260504)_20260504121024.xlsx'
)

conn = sqlite3.connect(DB)
cur = conn.cursor()

# --- Step 1: delete Yvonne-reimbursed tickets ---------------------------------
# Yvonne sent ¥176 + ¥352 + ¥220 = ¥748 in 3 QR receipts. Match against the
# karting/Entry Fees rows of the same amount (one row each).
cur.execute("SELECT id FROM categories WHERE name='Entry Fees' AND domain='karting'")
entry_fees_id = cur.fetchone()[0]

deleted = []
for amt in (176, 352, 220):
    cur.execute(
        """SELECT id, date, description FROM expenses
           WHERE category_id=? AND amount=?
           ORDER BY date DESC, created_at DESC LIMIT 1""",
        (entry_fees_id, amt),
    )
    row = cur.fetchone()
    if row:
        cur.execute("DELETE FROM expense_tags WHERE expense_id=?", (row[0],))
        cur.execute("DELETE FROM expenses WHERE id=?", (row[0],))
        deleted.append((row[1], amt, row[2]))
        print(f"  - deleted {row[1]}  ¥{amt}  {row[2]}  (Yvonne wash)")

# --- Step 2: create 'zwz-paid' tag and link to family-card rows ---------------
cur.execute("SELECT id FROM tags WHERE name='zwz-paid'")
existing = cur.fetchone()
if existing:
    tag_id = existing[0]
else:
    tag_id = str(uuid.uuid4())
    cur.execute("INSERT INTO tags (id, name) VALUES (?, ?)", (tag_id, "zwz-paid"))
    print(f"  + created tag 'zwz-paid'")

cur.execute(
    "SELECT id FROM expenses WHERE notes LIKE '%亲属卡(zwz)%' AND currency='CNY'"
)
zwz_paid_ids = [r[0] for r in cur.fetchall()]

# Insert links (idempotent: skip duplicates)
linked = 0
for eid in zwz_paid_ids:
    cur.execute(
        "SELECT 1 FROM expense_tags WHERE expense_id=? AND tag_id=?",
        (eid, tag_id),
    )
    if cur.fetchone():
        continue
    cur.execute(
        "INSERT INTO expense_tags (expense_id, tag_id) VALUES (?, ?)",
        (eid, tag_id),
    )
    linked += 1
print(f"  + tagged {linked} expense(s) as 'zwz-paid' "
      f"(total in DB with this tag: {len(zwz_paid_ids)})")

conn.commit()

# --- Step 3: reimbursement math -----------------------------------------------
# Pull zwz transfers FROM the WeChat XLSX (these were never imported as DB rows;
# they're income that the user opted to skip).
wb = openpyxl.load_workbook(XLSX, data_only=True)
ws = wb["Sheet1"]
zwz_transfers_in = 0.0
zwz_transfers_out = 0.0
for r in list(ws.iter_rows(values_only=True))[18:]:
    if r[0] is None:
        continue
    _, ttype, party, _, direction, amount, *_ = r
    if (party or "") != "zwz":
        continue
    if direction == "收入":
        zwz_transfers_in += float(amount or 0)
    elif direction == "支出":
        zwz_transfers_out += float(amount or 0)

# DB-side aggregates
def sum_by(query, *params):
    cur.execute(query, params)
    row = cur.fetchone()
    return float(row[0] or 0), int(row[1] or 0)

# Total spending by payer
zwz_card_total, zwz_card_n = sum_by(
    "SELECT SUM(amount), COUNT(*) FROM expenses WHERE notes LIKE '%亲属卡(zwz)%'"
)
henry_total, henry_n = sum_by(
    "SELECT SUM(amount), COUNT(*) FROM expenses "
    "WHERE notes LIKE '%零钱通%' OR notes LIKE '%零钱 %' OR notes LIKE '%零钱_%'"
)
# Karting subset by payer
karting_zwz_card, _ = sum_by(
    """SELECT SUM(e.amount), COUNT(*) FROM expenses e
       JOIN categories c ON c.id=e.category_id
       WHERE c.domain='karting' AND e.notes LIKE '%亲属卡(zwz)%'"""
)
karting_henry, _ = sum_by(
    """SELECT SUM(e.amount), COUNT(*) FROM expenses e
       JOIN categories c ON c.id=e.category_id
       WHERE c.domain='karting' AND
             (e.notes LIKE '%零钱通%' OR e.notes LIKE '%零钱 %' OR e.notes LIKE '%零钱_%')"""
)
karting_other, _ = sum_by(
    """SELECT SUM(e.amount), COUNT(*) FROM expenses e
       JOIN categories c ON c.id=e.category_id
       WHERE c.domain='karting'
         AND e.notes IS NOT NULL
         AND e.notes NOT LIKE '%亲属卡(zwz)%'
         AND e.notes NOT LIKE '%零钱通%'
         AND e.notes NOT LIKE '%零钱 %'
         AND e.notes NOT LIKE '%零钱_%'"""
)
karting_pre_wechat, _ = sum_by(
    """SELECT SUM(e.amount), COUNT(*) FROM expenses e
       JOIN categories c ON c.id=e.category_id
       WHERE c.domain='karting' AND e.notes IS NULL"""
)

print()
print("=" * 70)
print("REIMBURSEMENT BALANCE")
print("=" * 70)
print(f"zwz funded henry — incoming transfers (not in DB)  ¥{zwz_transfers_in:>12,.2f}")
print(f"zwz paid directly — 亲属卡 family card             ¥{zwz_card_total:>12,.2f}  ({zwz_card_n} rows)")
print(f"  → total zwz contribution                         ¥{zwz_transfers_in + zwz_card_total:>12,.2f}")
print()
print(f"henry repaid zwz — outgoing transfers (skipped)    ¥{zwz_transfers_out:>12,.2f}")
print()
print("KARTING domain breakdown (henry's spending universe)")
print(f"  karting paid via 亲属卡(zwz)                     ¥{karting_zwz_card:>12,.2f}")
print(f"  karting paid via henry's own wallet              ¥{karting_henry:>12,.2f}")
print(f"  karting paid by other (no notes / pre-WeChat)    ¥{karting_other + karting_pre_wechat:>12,.2f}")
total_karting = karting_zwz_card + karting_henry + karting_other + karting_pre_wechat
print(f"  → total karting in DB                            ¥{total_karting:>12,.2f}")
print()

# Net: assume zwz transfers were intended to fund henry's out-of-pocket karting.
# Unreimbursed = (henry's karting wallet spending) - (zwz transfers in - zwz returned out)
net_zwz_funding = zwz_transfers_in - zwz_transfers_out
unreimbursed = karting_henry - net_zwz_funding
print(f"Net zwz funding to henry (transfers in − returned) ¥{net_zwz_funding:>12,.2f}")
print(f"Henry's out-of-pocket karting spend                ¥{karting_henry:>12,.2f}")
print(f"  → unreimbursed (henry is owed)                   ¥{unreimbursed:>12,.2f}")
print()

if unreimbursed > 0:
    print(f"  zwz still owes henry ¥{unreimbursed:,.2f}")
elif unreimbursed < 0:
    print(f"  zwz has overpaid by ¥{-unreimbursed:,.2f} (henry has buffer)")
else:
    print("  fully reimbursed")

conn.close()
