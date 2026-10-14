# DroneCalc API

Engineering calculators for multirotor drones. Every answer includes the formulas and assumptions used.

| Endpoint | What it does |
|---|---|
| `GET /v1/flight-time?cells=4&capacityMah=5000&auwG=1500&efficiencyGPerW=7` | Hover flight time, power, current, C-rating check |
| `GET /v1/thrust-to-weight?auwG=1500&motors=4&maxThrustPerMotorG=1200` | TWR, hover throttle, class |
| `GET /v1/battery-sizing?dryWeightG=1100&targetFlightTimeMin=20&cells=4` | Battery mass & capacity for a target time |
| `GET /v1/prop-sizing?auwG=1500&motors=4&diskLoadingGPerCm2=1` | Prop diameter from disk loading |
| `GET /v1/pricing` | How to pay |
| `GET /openapi.json` | Full spec |

POST with a JSON body works for every `/v1/*` endpoint. A web calculator is served at `/`.

## Pricing
20 free requests per day per IP. Then **0.10 USDC per request on Base**: send N × 0.10 USDC to the address in `/v1/pricing`
and pass the transaction hash in the `X-Payment-Tx` header. One transaction can prepay many requests.

## Operations (for the agent)
- `bash ~/service/start.sh` — start server + public tunnel (idempotent). Public URL in `~/service/PUBLIC_URL`.
- `cd ~/service && npm test` — run all tests (must stay green).
- `bash ~/service/stats.sh` — usage and recorded revenue.
- Logs: `~/logs/service.log`, `~/logs/tunnel.log`.
