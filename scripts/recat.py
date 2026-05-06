#!/usr/bin/env python3
"""
Apply user-confirmed recategorizations:

1. DELETE the ¥35,550 'Travel & test sessions' row (user estimate, replaced by real data)
2. MOVE 8x 极速赛车餐厅 rows: karting/Travel → general/Food & Dining
3. CREATE new categories: karting/Membership, karting/Certification
4. MOVE ¥4,394 Club membership: karting/Entry Fees → karting/Membership
5. MOVE ¥1,600 江剑平 cert: → karting/Certification
6. MOVE ¥1,180 江剑平 race: → karting/Entry Fees (race entries unify with track-day sessions)
7. DELETE old karting/Race Entry & Certification category (now empty)
8. MOVE ¥183 Julie row: karting/Rentals → karting/Entry Fees (was track entry, not coaching)
9. MOVE ¥1,497 京东: general/Shopping → karting/Gear (onboard camera)
10. MOVE 6 Apple App Store rows: Subscriptions → general/Entertainment (one-time)
    Keep 2x iCloud (recurring) + 1x Apple ¥128 in Subscriptions
11. MOVE DiDi rides above ¥110 → karting/Travel
"""
import sqlite3
import sys
import uuid
from datetime import datetime
from pathlib import Path

DB = Path("pitwall.db")

conn = sqlite3.connect(DB)
cur = conn.cursor()

# Lookup helpers
cur.execute("SELECT id, name, domain FROM categories")
cats = {(name, domain): cid for cid, name, domain in cur.fetchall()}

def cat_id(name: str, domain: str) -> str:
    return cats[(name, domain)]

def ensure_cat(name: str, domain: str, color: str, icon: str) -> str:
    if (name, domain) in cats:
        return cats[(name, domain)]
    cid = str(uuid.uuid4())
    cur.execute(
        "INSERT INTO categories (id, name, domain, color, icon, created_at) VALUES (?,?,?,?,?,?)",
        (cid, name, domain, color, icon, datetime.now().isoformat() + "Z"),
    )
    cats[(name, domain)] = cid
    print(f"  + created category {domain}/{name}")
    return cid

# --- Step 3: create new categories first ---
membership_id = ensure_cat("Membership", "karting", "#fbbf24", "🪪")
certification_id = ensure_cat("Certification", "karting", "#f97316", "📜")

karting_travel = cat_id("Travel", "karting")
karting_entry = cat_id("Entry Fees", "karting")
karting_gear = cat_id("Gear", "karting")
karting_rentals = cat_id("Rentals", "karting")
food = cat_id("Food & Dining", "general")
entertainment = cat_id("Entertainment", "general")
race_cert_old = cats.get(("Race Entry & Certification", "karting"))

changes = []

# --- Step 1: delete the user-estimate row ---
cur.execute(
    "DELETE FROM expenses WHERE date='2026-04-22' AND amount=35550 AND description='Travel & test sessions'"
)
changes.append(("DELETE", cur.rowcount, "¥35,550 Travel & test sessions (user estimate)"))

# --- Step 2: 极速赛车餐厅 → Food & Dining ---
cur.execute(
    "UPDATE expenses SET category_id=? WHERE category_id=? AND description LIKE '%极速赛车餐厅%'",
    (food, karting_travel),
)
changes.append(("MOVE", cur.rowcount, "极速赛车餐厅 → general/Food & Dining"))

# --- Step 4: Club membership → karting/Membership ---
cur.execute(
    "UPDATE expenses SET category_id=? WHERE category_id=? AND description LIKE '%Club membership%'",
    (membership_id, karting_entry),
)
changes.append(("MOVE", cur.rowcount, "Club membership ¥4,394 → karting/Membership"))

# --- Step 5: 江剑平 cert → karting/Certification ---
if race_cert_old:
    cur.execute(
        "UPDATE expenses SET category_id=? WHERE category_id=? AND description LIKE '%certification%'",
        (certification_id, race_cert_old),
    )
    changes.append(("MOVE", cur.rowcount, "江剑平 cert ¥1,600 → karting/Certification"))

    # --- Step 6: 江剑平 race → karting/Entry Fees ---
    cur.execute(
        "UPDATE expenses SET category_id=? WHERE category_id=? AND description LIKE '%recreational race%'",
        (karting_entry, race_cert_old),
    )
    changes.append(("MOVE", cur.rowcount, "江剑平 race ¥1,180 → karting/Entry Fees"))

    # --- Step 7: drop the old empty Race Entry & Certification category ---
    cur.execute("SELECT COUNT(*) FROM expenses WHERE category_id=?", (race_cert_old,))
    remaining = cur.fetchone()[0]
    if remaining == 0:
        cur.execute("DELETE FROM categories WHERE id=?", (race_cert_old,))
        changes.append(("DROP", 1, "category karting/Race Entry & Certification (empty)"))
    else:
        changes.append(("KEEP", remaining, f"karting/Race Entry & Certification still has {remaining} rows"))

# --- Step 8: ¥183 Julie row → karting/Entry Fees ---
cur.execute(
    """UPDATE expenses SET category_id=?, description=?
       WHERE category_id=? AND amount=183 AND date='2026-04-05'
       AND description LIKE '%Julie%'""",
    (karting_entry, "Julie (WLM Racing / William Lee) · Track entry ticket", karting_rentals),
)
changes.append(("MOVE", cur.rowcount, "¥183 Julie 04-05 → karting/Entry Fees (was rental, actually entry)"))

# --- Step 9: ¥1,497 京东 → karting/Gear ---
cur.execute(
    """UPDATE expenses SET category_id=?, description=?
       WHERE date='2026-04-10' AND amount=1497 AND description='京东'""",
    (karting_gear, "京东 · Onboard camera (karting gear)"),
)
changes.append(("MOVE", cur.rowcount, "京东 ¥1,497 → karting/Gear"))

# --- Step 10: Apple App Store one-offs → Entertainment ---
# Keep iCloud rows + the 2026-03-14 ¥128 Apple as Subscriptions; everything else Apple → Entertainment
subs = cat_id("Subscriptions", "general")
cur.execute(
    """UPDATE expenses
       SET category_id=?
       WHERE category_id=?
         AND description LIKE 'Apple%'
         AND NOT (date='2026-03-14' AND amount=128)""",
    (entertainment, subs),
)
changes.append(("MOVE", cur.rowcount, "Apple App Store one-offs → general/Entertainment"))

# --- Step 11: DiDi rides > ¥110 → karting/Travel ---
transport = cat_id("Transportation", "general")
cur.execute(
    """UPDATE expenses
       SET category_id=?
       WHERE category_id=?
         AND description LIKE '滴滴出行%'
         AND amount > 110""",
    (karting_travel, transport),
)
changes.append(("MOVE", cur.rowcount, "DiDi rides > ¥110 → karting/Travel"))

conn.commit()

# --- Summary ---
print()
for kind, n, desc in changes:
    print(f"  {kind:6s}  {n} row(s)   {desc}")
print()

cur.execute(
    """SELECT c.domain || '/' || c.name AS cat, COUNT(*) AS n,
              printf('¥%,.2f', SUM(e.amount)) AS total
       FROM expenses e LEFT JOIN categories c ON c.id=e.category_id
       WHERE e.currency='CNY'
       GROUP BY cat ORDER BY SUM(e.amount) DESC"""
)
print("After:")
for cat, n, total in cur.fetchall():
    print(f"  {cat:<40s}  {n:>4d}   {total:>12s}")

cur.execute("SELECT printf('¥%,.2f', SUM(amount)), COUNT(*) FROM expenses WHERE currency='CNY'")
total, n = cur.fetchone()
print(f"\nGrand total: {total} across {n} rows")

conn.close()
