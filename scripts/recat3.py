#!/usr/bin/env python3
"""
Round 3:
  1. Delete pre-WeChat ¥19,600 'Equipment' (double-count with 吴海山 ¥19,668+¥1,200)
  2. Tag pre-WeChat Chassis (¥32,000) and Club membership (¥4,394) as zwz-paid
     — zwz paid these directly outside the WeChat ledger
  3. Move ¥179 京东 (04-10) from general/Shopping → karting/Gear
  4. Add the two partial-refund nets that the importer dropped:
       ¥59.90  (was ¥2,282.60 − ¥2,222.70 refund)
       ¥526.80 (was ¥2,023.80 − ¥1,497.00 refund)
     Both 04-10, both karting-related per user, → karting/Gear
"""
import sqlite3
import sys
import uuid
from datetime import datetime
from pathlib import Path

DB = Path("pitwall.db")
conn = sqlite3.connect(DB)
cur = conn.cursor()

cur.execute("SELECT id, name, domain FROM categories")
cats = {(name, domain): cid for cid, name, domain in cur.fetchall()}
karting_gear = cats[("Gear", "karting")]
shopping = cats[("Shopping", "general")]

cur.execute("SELECT id FROM tags WHERE name='zwz-paid'")
tag_id = cur.fetchone()[0]

def link_tag(expense_id: str):
    cur.execute(
        "SELECT 1 FROM expense_tags WHERE expense_id=? AND tag_id=?",
        (expense_id, tag_id),
    )
    if cur.fetchone():
        return False
    cur.execute(
        "INSERT INTO expense_tags (expense_id, tag_id) VALUES (?, ?)",
        (expense_id, tag_id),
    )
    return True

# --- Step 1: delete the ¥19,600 Equipment estimate (double-count) ---
cur.execute(
    "DELETE FROM expense_tags WHERE expense_id IN "
    "(SELECT id FROM expenses WHERE date='2026-04-15' AND amount=19600 AND description='Equipment')"
)
cur.execute(
    "DELETE FROM expenses WHERE date='2026-04-15' AND amount=19600 AND description='Equipment'"
)
print(f"  - deleted ¥19,600 Equipment row (double-count of 吴海山 transfers)")

# --- Step 2: tag Chassis & Membership as zwz-paid ---
for date, amount, desc in [
    ("2026-04-05", 32000, "Chassis (车)"),
    ("2026-04-08",  4394, "Club membership (入会)"),
]:
    cur.execute(
        "SELECT id FROM expenses WHERE date=? AND amount=? AND description=?",
        (date, amount, desc),
    )
    row = cur.fetchone()
    if not row:
        print(f"  ! could not find {desc} ({date} ¥{amount}); skipping tag")
        continue
    if link_tag(row[0]):
        print(f"  + tagged zwz-paid: {date} ¥{amount} {desc}")

# --- Step 3: move ¥179 京东 (04-10) → karting/Gear ---
cur.execute(
    """UPDATE expenses
       SET category_id=?, description=?
       WHERE date='2026-04-10' AND amount=179 AND category_id=?""",
    (karting_gear, "京东 · Misc karting accessory", shopping),
)
print(f"  → moved {cur.rowcount} row(s): ¥179 京东 04-10 → karting/Gear")

# --- Step 4: add the partial-refund net rows ---
now = datetime.now().isoformat() + "Z"
NEW_ROWS = [
    {
        "amount": 59.90,
        "desc": "京东 · Karting parts (net of partial refund: ¥2,282.60 − ¥2,222.70)",
        "notes": "WeChat · 商户消费 · 零钱通 · partial refund: kept ¥59.90 of ¥2,282.60 purchase",
    },
    {
        "amount": 526.80,
        "desc": "京东 · Karting parts (net of partial refund: ¥2,023.80 − ¥1,497.00)",
        "notes": "WeChat · 商户消费 · 零钱通 · partial refund: kept ¥526.80 of ¥2,023.80 purchase",
    },
]
for r in NEW_ROWS:
    new_id = str(uuid.uuid4())
    cur.execute(
        """INSERT INTO expenses
           (id, category_id, amount, currency, date, description, notes, created_at)
           VALUES (?,?,?,?,?,?,?,?)""",
        (new_id, karting_gear, r["amount"], "CNY", "2026-04-10",
         r["desc"], r["notes"], now),
    )
    print(f"  + inserted ¥{r['amount']:>7.2f}  {r['desc']}")

conn.commit()

# --- Recompute reimbursement balance ---
def s(query):
    cur.execute(query)
    return float((cur.fetchone() or [0])[0] or 0)

# Henry-wallet (零钱/零钱通) spending in reimbursable buckets
karting_henry = s("""
    SELECT SUM(e.amount) FROM expenses e JOIN categories c ON c.id=e.category_id
    WHERE c.domain='karting'
      AND (e.notes LIKE '%零钱通%' OR e.notes LIKE '%零钱 %' OR e.notes LIKE '%零钱_%')
""")
food_henry = s("""
    SELECT SUM(e.amount) FROM expenses e JOIN categories c ON c.id=e.category_id
    WHERE c.name='Food & Dining' AND c.domain='general'
      AND (e.notes LIKE '%零钱通%' OR e.notes LIKE '%零钱 %' OR e.notes LIKE '%零钱_%')
""")
trans_henry = s("""
    SELECT SUM(e.amount) FROM expenses e JOIN categories c ON c.id=e.category_id
    WHERE c.name='Transportation' AND c.domain='general'
      AND (e.notes LIKE '%零钱通%' OR e.notes LIKE '%零钱 %' OR e.notes LIKE '%零钱_%')
""")
zwz_paid_via_card = s("""
    SELECT SUM(e.amount) FROM expenses e
    WHERE e.notes LIKE '%亲属卡(zwz)%'
""")

# Get karting paid via 亲属卡 (already counted as zwz-funded)
karting_zwz_card = s("""
    SELECT SUM(e.amount) FROM expenses e JOIN categories c ON c.id=e.category_id
    WHERE c.domain='karting' AND e.notes LIKE '%亲属卡(zwz)%'
""")

# Pre-WeChat zwz-paid (Chassis, Membership) — now tagged zwz-paid
zwz_pre_wechat = s("""
    SELECT SUM(e.amount) FROM expenses e
    JOIN expense_tags et ON et.expense_id=e.id
    JOIN tags t ON t.id=et.tag_id
    WHERE t.name='zwz-paid' AND e.notes IS NOT NULL
      AND e.notes NOT LIKE '%亲属卡(zwz)%'
""")
# (Chassis & Membership have notes like "New chassis" / "Annual membership")

zwz_transfers_in = 48086.00
zwz_transfers_out = 1344.00

print()
print("=" * 70)
print("REIMBURSEMENT BALANCE — round 3")
print("=" * 70)
print(f"  Henry fronted (零钱通) — karting               ¥{karting_henry:>10,.2f}")
print(f"                       — food                   ¥{food_henry:>10,.2f}")
print(f"                       — transportation         ¥{trans_henry:>10,.2f}")
total_henry = karting_henry + food_henry + trans_henry
print(f"                                  → total       ¥{total_henry:>10,.2f}")
print()
print(f"  Net zwz funding (transfers in − returned)     ¥{zwz_transfers_in - zwz_transfers_out:>10,.2f}")
unreimbursed = total_henry - (zwz_transfers_in - zwz_transfers_out)
print(f"                                  → owed        ¥{unreimbursed:>10,.2f}")
print()
print(f"  (zwz also paid directly via 亲属卡            ¥{zwz_paid_via_card:>10,.2f})")
print(f"  (zwz also paid pre-WeChat outside ledger     ¥{zwz_pre_wechat:>10,.2f})")
print(f"  Total zwz contribution                       ¥{(zwz_transfers_in - zwz_transfers_out) + zwz_paid_via_card + zwz_pre_wechat:>10,.2f}")

print()
cur.execute("""
    SELECT c.domain || '/' || c.name AS cat, COUNT(*) AS n,
           printf('¥%,.2f', SUM(e.amount)) AS total
    FROM expenses e LEFT JOIN categories c ON c.id=e.category_id
    WHERE e.currency='CNY'
    GROUP BY cat ORDER BY SUM(e.amount) DESC
""")
print("Final categories:")
for cat, n, total in cur.fetchall():
    print(f"  {cat:<35s}  {n:>4d}   {total:>12s}")

cur.execute("SELECT printf('¥%,.2f', SUM(amount)), COUNT(*) FROM expenses WHERE currency='CNY'")
total, n = cur.fetchone()
print(f"\nGrand total: {total} across {n} rows")

conn.close()
