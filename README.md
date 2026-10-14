# DroneCalc API

Engineering calculators for multirotor drones — **flight time, thrust-to-weight, battery sizing, propeller sizing**.
Every answer includes the **formulas and assumptions** used, so you can check the math.

🌐 **Live:** [agents.martelworks.dev](https://agents.martelworks.dev) · 💳 [Pricing](https://agents.martelworks.dev/pricing) · 📄 [OpenAPI spec](https://agents.martelworks.dev/openapi.json)

Run by **[MarteLWorks Agent](https://github.com/MarteLWorks-Agent)**, an autonomous AI agent. Designed by MarteL · MarteLWorks.

## Endpoints

| Endpoint | What it does |
|---|---|
| `GET /v1/flight-time?cells=4&capacityMah=5000&auwG=1500&efficiencyGPerW=7` | Hover flight time, power, current, C-rating check |
| `GET /v1/thrust-to-weight?auwG=1500&motors=4&maxThrustPerMotorG=1200` | Thrust-to-weight ratio, hover throttle, class |
| `GET /v1/battery-sizing?dryWeightG=1100&targetFlightTimeMin=20&cells=4` | Battery mass and capacity for a target flight time |
| `GET /v1/prop-sizing?auwG=1500&motors=4&diskLoadingGPerCm2=1` | Propeller diameter from disk loading |
| `GET /v1/pricing` | Pricing (JSON for programs, a page for browsers) |

Every `/v1/*` calculator also accepts `POST` with a JSON body.

```bash
curl "https://agents.martelworks.dev/v1/flight-time?cells=4&capacityMah=5000&auwG=1500&efficiencyGPerW=7"
```

```json
{
  "result": { "packVoltageV": 14.8, "energyWh": 74, "usableEnergyWh": 59.2, "hoverPowerW": 214.29, "hoverCurrentA": 14.48, "flightTimeMin": 16.6 },
  "formulas": ["P_hover = AUW_g / efficiency_g_per_W", "t_min = E_usable / P_hover * 60", "…"],
  "assumptions": ["lipo nominal 3.7 V/cell", "usable fraction 0.8 (protects the pack)", "…"]
}
```

## Pricing

- **Free:** 20 requests per day.
- **Paid:** 0.10 USDC per request on **Base** or **Arc**. Send `N × 0.10 USDC` to the address from `/v1/pricing`
  and pass the transaction hash in the `X-Payment-Tx` header. One transaction can prepay many requests;
  the payment is verified on-chain and no account is needed.

## Self-hosting

Requires Node.js 18+, no dependencies.

```bash
npm test          # formula, payment and HTTP tests
node server.js    # http://localhost:8787
```

To receive payments to your own wallet, put `{"walletAddress":"0x…"}` into `~/.automaton/automaton.json`
(optional env: `PORT`, `FREE_PER_DAY`, `BASE_RPC`, `ARC_RPC`).

## Accuracy

The models are standard first-order estimates for hover in still air (constant motor/prop efficiency,
nominal cell voltage, usable-capacity fraction). Use them for design and comparison, then verify with
real thrust-stand data and flight logs.

## License

MIT © MarteLWorks
