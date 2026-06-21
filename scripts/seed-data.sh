#!/bin/bash
# Seed the app with sample data for manual verification (v2 snapshot ledger)
BASE="http://127.0.0.1:3001/api"

echo "=== Creating assets ==="
A1=$(curl -s -X POST $BASE/assets -H 'Content-Type: application/json' \
  -d '{"name":"华夏成长混合","type":"fund","institution":"蚂蚁财富","note":"定投中"}')
A1_ID=$(echo $A1 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

A2=$(curl -s -X POST $BASE/assets -H 'Content-Type: application/json' \
  -d '{"name":"易方达中小盘","type":"fund","institution":"天天基金"}')
A2_ID=$(echo $A2 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

A3=$(curl -s -X POST $BASE/assets -H 'Content-Type: application/json' \
  -d '{"name":"工商银行储蓄","type":"deposit","institution":"工商银行","note":"工资卡"}')
A3_ID=$(echo $A3 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

curl -s -X POST $BASE/assets -H 'Content-Type: application/json' \
  -d '{"name":"余额宝","type":"other","institution":"支付宝","note":"日常备用"}' > /dev/null

curl -s -X POST $BASE/assets -H 'Content-Type: application/json' \
  -d '{"name":"支付宝积存金","type":"gold","institution":"支付宝"}' > /dev/null

curl -s -X POST $BASE/assets -H 'Content-Type: application/json' \
  -d '{"name":"公积金","type":"housing_fund","institution":"北京公积金"}' > /dev/null

A6=$(curl -s -X POST $BASE/assets -H 'Content-Type: application/json' \
  -d '{"name":"微信零钱","type":"cash","institution":"微信支付"}')
A6_ID=$(echo $A6 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

curl -s -X POST $BASE/assets -H 'Content-Type: application/json' \
  -d '{"name":"华泰证券账户","type":"stock","institution":"华泰证券"}' > /dev/null

echo "=== Creating snapshot 1 (2026-01-15) ==="
curl -s -X POST $BASE/snapshots -H 'Content-Type: application/json' \
  -d "{\"recordedAt\":\"2026-01-15T20:00:00\",\"note\":\"年初盘点\",\"values\":[
    {\"assetId\":\"$A1_ID\",\"amount\":12000,\"profit\":500,\"profitRate\":0.0435},
    {\"assetId\":\"$A2_ID\",\"amount\":8000,\"profit\":-200,\"profitRate\":-0.0244},
    {\"assetId\":\"$A3_ID\",\"amount\":50000}
  ]}" > /dev/null

echo "=== Creating snapshot 2 (2026-03-15) ==="
curl -s -X POST $BASE/snapshots -H 'Content-Type: application/json' \
  -d "{\"recordedAt\":\"2026-03-15T20:00:00\",\"note\":\"一季度盘点\",\"values\":[
    {\"assetId\":\"$A1_ID\",\"amount\":13500,\"profit\":1200,\"profitRate\":0.0976},
    {\"assetId\":\"$A2_ID\",\"amount\":8500,\"profit\":0,\"profitRate\":0}
  ]}" > /dev/null

echo "=== Creating snapshot 3 (2026-05-15) ==="
curl -s -X POST $BASE/snapshots -H 'Content-Type: application/json' \
  -d "{\"recordedAt\":\"2026-05-15T20:00:00\",\"note\":\"五月盘点\",\"values\":[
    {\"assetId\":\"$A1_ID\",\"amount\":15000,\"profit\":2000,\"profitRate\":0.1538},
    {\"assetId\":\"$A2_ID\",\"amount\":9200,\"profit\":300,\"profitRate\":0.0337},
    {\"assetId\":\"$A3_ID\",\"amount\":55000}
  ]}" > /dev/null

echo "=== Creating snapshot 4 (2026-06-21) - current ==="
curl -s -X POST $BASE/snapshots -H 'Content-Type: application/json' \
  -d "{\"recordedAt\":\"2026-06-21T20:00:00\",\"note\":\"六月盘点\",\"values\":[
    {\"assetId\":\"$A1_ID\",\"amount\":16200,\"profit\":2800,\"profitRate\":0.209},
    {\"assetId\":\"$A2_ID\",\"amount\":9800,\"profit\":500,\"profitRate\":0.0538},
    {\"assetId\":\"$A3_ID\",\"amount\":53000},
    {\"assetId\":\"$A6_ID\",\"amount\":3500}
  ]}" > /dev/null

echo "=== Sample data loaded ==="
echo ""
echo "Assets created:"
echo "  基金: $A1_ID, $A2_ID"
echo "  存款: $A3_ID"
echo "  零钱: $A6_ID"
echo ""
echo "4 snapshots created (Jan→Jun 2026)"
echo "Done! Visit http://localhost:5173"
