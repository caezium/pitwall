#!/usr/bin/env python3
"""
Round 4:
  1. Mirror the 3 OpenRouter top-ups into ai_usage_records so they show up on
     the AI Costs page. CNY → USD at 7.2 (rough recent rate). They stay in the
     expenses table too — the AI Costs page reads from ai_usage_records, the
     transactions list reads from expenses.
  2. Recompute reimbursement excluding henry-paid karting/Entry Fees
     (track day + race entry tickets are henry's own responsibility,
     not on zwz's tab).
"""
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

DB = Path("pitwall.db")
FX = 7.2  # rough CNY→USD; precise enough for top-up tracking

conn = sqlite3.connect(DB)
cur = conn.cursor()

# ---- Step 1: OpenRouter into ai_usage_records ----
# Pull the 3 OpenRouter expense rows out of expenses and dual-log to ai_usage_records.
cur.execute(
    """SELECT e.id, e.date, e.amount, e.notes FROM expenses e
       JOIN categories c ON c.id=e.category_id
       WHERE c.domain='ai' AND e.description LIKE '%OPENROUTER%'"""
)
rows = cur.fetchall()
now = datetime.now().isoformat() + "Z"

for expense_id, date, amt_cny, notes in rows:
    # Use the WeChat txn_id from notes as externalId so this is idempotent.
    txn_id = None
    if notes:
        for chunk in notes.split(" · "):
            if chunk.startswith("4200") or chunk.startswith("payatt_"):
                txn_id = chunk.strip()
                break
    external_id = f"wechat-openrouter-{txn_id or expense_id}"

    cur.execute("SELECT id FROM ai_usage_records WHERE external_id=?", (external_id,))
    if cur.fetchone():
        print(f"  - skipping {date} ¥{amt_cny} (already in ai_usage_records)")
        continue

    usd = round(amt_cny / FX, 2)
    cur.execute(
        """INSERT INTO ai_usage_records
           (id, provider, model, date, input_tokens, output_tokens, cost,
            external_id, source, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (
            str(uuid.uuid4()),
            "openrouter",
            "credits",
            date,
            0, 0,
            usd,
            external_id,
            "manual",
            now,
        ),
    )
    print(f"  + ai_usage_records: {date}  ¥{amt_cny:.2f} → ${usd:.2f}  openrouter/credits")

conn.commit()

# ---- Step 2: reimbursement, excluding henry-paid Entry Fees ----
def s(query):
    cur.execute(query)
    return float((cur.fetchone() or [0])[0] or 0)

karting_henry_excluding_tickets = s("""
    SELECT SUM(e.amount) FROM expenses e JOIN categories c ON c.id=e.category_id
    WHERE c.domain='karting'
      AND c.name != 'Entry Fees'
      AND (e.notes LIKE '%零钱通%' OR e.notes LIKE '%零钱 %' OR e.notes LIKE '%零钱_%')
""")
karting_henry_tickets = s("""
    SELECT SUM(e.amount) FROM expenses e JOIN categories c ON c.id=e.category_id
    WHERE c.domain='karting' AND c.name='Entry Fees'
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
zwz_transfers_in = 48086.00
zwz_transfers_out = 1344.00

print()
print("=" * 70)
print("REIMBURSEMENT BALANCE — round 4 (excluding henry-paid Entry Fees)")
print("=" * 70)
print(f"  Karting paid by henry (excluding tickets)     ¥{karting_henry_excluding_tickets:>10,.2f}")
print(f"  Food paid by henry                            ¥{food_henry:>10,.2f}")
print(f"  Transportation paid by henry                  ¥{trans_henry:>10,.2f}")
total_zwz = karting_henry_excluding_tickets + food_henry + trans_henry
print(f"                              → reimbursable    ¥{total_zwz:>10,.2f}")
print()
print(f"  (henry's own karting tickets paid by him      ¥{karting_henry_tickets:>10,.2f}  ← excluded)")
print()
print(f"  Net zwz funding (transfers in − returned)     ¥{zwz_transfers_in - zwz_transfers_out:>10,.2f}")
unreimbursed = total_zwz - (zwz_transfers_in - zwz_transfers_out)
print(f"                              → owed by zwz    ¥{unreimbursed:>10,.2f}")

if unreimbursed < 0:
    print(f"\n  zwz has overpaid by ¥{-unreimbursed:,.2f}")
elif unreimbursed > 0:
    print(f"\n  zwz still owes henry ¥{unreimbursed:,.2f}")
else:
    print("\n  fully reimbursed")

print()
cur.execute("SELECT printf('$%.2f', SUM(cost)), COUNT(*) FROM ai_usage_records")
total_ai, n_ai = cur.fetchone()
print(f"AI usage records: {total_ai} across {n_ai} rows (USD)")

conn.close()
