'use strict';
const test = require('node:test');
const assert = require('node:assert');
const f = require('../lib/formulas');

test('flightTime: 4S 5000mAh, 1500 g, 7 g/W, 80% → ~16.6 min', () => {
  const { result } = f.flightTime({ cells: 4, capacityMah: 5000, auwG: 1500, efficiencyGPerW: 7 });
  assert.strictEqual(result.packVoltageV, 14.8);
  assert.strictEqual(result.energyWh, 74);
  assert.ok(Math.abs(result.hoverPowerW - 214.29) < 0.01);
  assert.ok(Math.abs(result.flightTimeMin - 16.6) < 0.1); // 59.2 Wh / 214.29 W * 60
});
test('flightTime: C-rating share', () => {
  const { result } = f.flightTime({ cells: 6, capacityMah: 10000, auwG: 6000, efficiencyGPerW: 8, cRating: 10 });
  assert.strictEqual(result.maxContinuousCurrentA, 100);
  assert.ok(result.hoverCurrentShareOfMax > 0 && result.hoverCurrentShareOfMax < 1);
});
test('thrustToWeight: 4x1000g on 1000g → TWR 4, throttle 50%', () => {
  const { result } = f.thrustToWeight({ auwG: 1000, motors: 4, maxThrustPerMotorG: 1000 });
  assert.strictEqual(result.thrustToWeight, 4);
  assert.strictEqual(result.hoverThrottlePct, 50);
});
test('batterySizing is self-consistent with flightTime', () => {
  const b = f.batterySizing({ dryWeightG: 1200, targetFlightTimeMin: 20, cells: 4, efficiencyGPerW: 7 }).result;
  assert.ok(b.feasible);
  const t = f.flightTime({ cells: 4, capacityMah: b.capacityMah, auwG: b.auwG, efficiencyGPerW: 7 }).result;
  assert.ok(t.flightTimeMin >= 19.9, `got ${t.flightTimeMin}`);
});
test('batterySizing: infeasible target', () => {
  const b = f.batterySizing({ dryWeightG: 1000, targetFlightTimeMin: 300, cells: 4, efficiencyGPerW: 5 }).result;
  assert.strictEqual(b.feasible, false);
});
test('propSizing: 1600 g quad, DL 1 → ~22.6 cm prop', () => {
  const { result } = f.propSizing({ auwG: 1600, motors: 4, diskLoadingGPerCm2: 1 });
  assert.ok(Math.abs(result.propDiameterCm - 22.6) < 0.1); // A=400cm2 → D=22.57
});
test('input validation', () => {
  assert.throws(() => f.flightTime({ cells: 'x', capacityMah: 1000, auwG: 500 }), f.InputError);
  assert.throws(() => f.flightTime({ cells: 4, capacityMah: 1000, auwG: 500, chemistry: 'nimh' }), f.InputError);
});
