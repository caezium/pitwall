#!/usr/bin/env bash
# Two-step IBKR Flex Web Service download + Pitwall import.
#
# Usage:  ./scripts/import_ibkr_flex.sh <TOKEN> <QUERY_ID>
#
# Step 1: SendRequest → returns a ReferenceCode
# Step 2: GetStatement?ReferenceCode=... → returns the XML
# Step 3: POST the XML to Pitwall's /api/trpc/investments.importFlexXml
set -euo pipefail

TOKEN="${1:?Usage: $0 <TOKEN> <QUERY_ID>}"
QUERY_ID="${2:?Usage: $0 <TOKEN> <QUERY_ID>}"
PITWALL_URL="${PITWALL_URL:-http://127.0.0.1:3000}"
COOKIE_JAR="${PITWALL_COOKIES:-/tmp/pitwall-cookies-127}"

API="https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService"

echo "→ Step 1: requesting reference code…"
RESP=$(curl -fsSL "$API.SendRequest?t=$TOKEN&q=$QUERY_ID&v=3")
REF=$(echo "$RESP" | sed -nE 's/.*<ReferenceCode>([^<]+)<\/ReferenceCode>.*/\1/p')
STATUS=$(echo "$RESP" | sed -nE 's/.*<Status>([^<]+)<\/Status>.*/\1/p')

if [ -z "$REF" ] || [ "$STATUS" != "Success" ]; then
  echo "  Flex SendRequest failed:"
  echo "$RESP"
  exit 1
fi
echo "  ✓ reference code: $REF"

echo "→ Step 2: fetching statement (may take 5-30s while IBKR generates it)…"
# IBKR returns 'Statement generation in progress' with HTTP 200 the first
# couple of times; poll until the XML body actually starts with <FlexQueryResponse.
TRIES=0
XMLFILE="$(mktemp -t pitwall-flex.XXXXXX.xml)"
while [ $TRIES -lt 12 ]; do
  curl -fsSL "$API.GetStatement?t=$TOKEN&q=$REF&v=3" -o "$XMLFILE"
  if grep -q "<FlexQueryResponse" "$XMLFILE"; then
    echo "  ✓ XML ready ($(wc -c < "$XMLFILE") bytes)"
    break
  fi
  echo "    still generating… sleeping 5s"
  sleep 5
  TRIES=$((TRIES + 1))
done

if ! grep -q "<FlexQueryResponse" "$XMLFILE"; then
  echo "  Flex GetStatement still not ready after 60s. Last response:"
  cat "$XMLFILE"
  exit 1
fi

echo "→ Step 3: importing into Pitwall at $PITWALL_URL …"
PAYLOADFILE="$(mktemp -t pitwall-flex-payload.XXXXXX.json)"
python3 - "$XMLFILE" "$PAYLOADFILE" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    xml = f.read()
with open(sys.argv[2], "w") as out:
    json.dump({"0": {"json": {"xml": xml}}}, out)
PY

curl -fsSL -X POST -b "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  --data-binary "@$PAYLOADFILE" \
  "$PITWALL_URL/api/trpc/investments.importFlexXml?batch=1" \
  | python3 -m json.tool

rm -f "$PAYLOADFILE"

echo
echo "Done. Saved a copy of the XML at: $XMLFILE"
