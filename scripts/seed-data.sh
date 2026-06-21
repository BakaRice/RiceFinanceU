#!/bin/bash
# Seed the app with sample data for manual verification
BASE="http://127.0.0.1:3001/api"

echo "=== Creating deposit accounts ==="
D1=$(curl -s -X POST $BASE/deposits -H 'Content-Type: application/json' \
  -d '{"name":"工商银行储蓄","institution":"工商银行","accountType":"current","balance":50000,"note":"工资卡"}')
D1_ID=$(echo $D1 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

D2=$(curl -s -X POST $BASE/deposits -H 'Content-Type: application/json' \
  -d '{"name":"余额宝","institution":"支付宝","accountType":"money_market","balance":20000,"note":"日常备用"}')
D2_ID=$(echo $D2 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

curl -s -X POST $BASE/deposits -H 'Content-Type: application/json' \
  -d '{"name":"微信零钱","institution":"微信支付","accountType":"cash","balance":3500}' > /dev/null

echo "=== Creating funds ==="
F1=$(curl -s -X POST $BASE/funds -H 'Content-Type: application/json' \
  -d '{"code":"000001","name":"华夏成长混合","platform":"蚂蚁财富","note":"定投中"}')
F1_ID=$(echo $F1 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

F2=$(curl -s -X POST $BASE/funds -H 'Content-Type: application/json' \
  -d '{"code":"110011","name":"易方达中小盘","platform":"天天基金"}')
F2_ID=$(echo $F2 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "=== Creating NAV prices ==="
for date in 2026-01-15 2026-02-15 2026-03-15 2026-04-15 2026-05-15 2026-06-15; do
  nav=$(python3 -c "import random; print(round(1.2 + random.random()*0.4, 4))")
  curl -s -X POST $BASE/funds/$F1_ID/nav-prices -H 'Content-Type: application/json' \
    -d "{\"nav\":$nav,\"date\":\"$date\"}" > /dev/null
done

for date in 2026-01-15 2026-02-15 2026-03-15 2026-04-15 2026-05-15 2026-06-15; do
  nav=$(python3 -c "import random; print(round(2.5 + random.random()*0.6, 4))")
  curl -s -X POST $BASE/funds/$F2_ID/nav-prices -H 'Content-Type: application/json' \
    -d "{\"nav\":$nav,\"date\":\"$date\"}" > /dev/null
done

echo "=== Creating fund transactions ==="
curl -s -X POST $BASE/transactions -H 'Content-Type: application/json' \
  -d "{\"type\":\"fund_buy\",\"fundId\":\"$F1_ID\",\"amount\":6000,\"shares\":5000,\"occurredAt\":\"2026-01-15T10:00:00Z\"}" > /dev/null
curl -s -X POST $BASE/transactions -H 'Content-Type: application/json' \
  -d "{\"type\":\"fund_buy\",\"fundId\":\"$F1_ID\",\"amount\":3900,\"shares\":3000,\"occurredAt\":\"2026-03-15T10:00:00Z\"}" > /dev/null
curl -s -X POST $BASE/transactions -H 'Content-Type: application/json' \
  -d "{\"type\":\"fund_buy\",\"fundId\":\"$F2_ID\",\"amount\":5000,\"shares\":2000,\"occurredAt\":\"2026-01-20T10:00:00Z\"}" > /dev/null
curl -s -X POST $BASE/transactions -H 'Content-Type: application/json' \
  -d "{\"type\":\"fund_buy\",\"fundId\":\"$F2_ID\",\"amount\":3900,\"shares\":1500,\"occurredAt\":\"2026-04-20T10:00:00Z\"}" > /dev/null
curl -s -X POST $BASE/transactions -H 'Content-Type: application/json' \
  -d "{\"type\":\"deposit_adjustment\",\"depositAccountId\":\"$D1_ID\",\"amountBefore\":45000,\"amountAfter\":50000,\"occurredAt\":\"2026-05-01T10:00:00Z\",\"note\":\"工资入账\"}" > /dev/null

echo "=== Sample data loaded ==="
echo "Deposit 1 ID: $D1_ID"
echo "Deposit 2 ID: $D2_ID"
echo "Fund 1 ID: $F1_ID"
echo "Fund 2 ID: $F2_ID"
echo "Done! Visit http://localhost:5173"
