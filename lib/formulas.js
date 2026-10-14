'use strict';
// DroneCalc — engineering formulas for multirotors.
// Units: grams (g), watts (W), volts (V), amps (A), mAh, minutes.
// Every function returns { result, formulas, assumptions } so callers can audit the math.

const CELL_VOLTAGE = { lipo: 3.7, lihv: 3.8, liion: 3.6 };
const ENERGY_DENSITY_WH_PER_KG = { lipo: 150, lihv: 160, liion: 220 };

function num(name, v, { min = -Infinity, max = Infinity, def } = {}) {
  if ((v === undefined || v === null || v === '') && def !== undefined) return def;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new InputError(`${name} must be a number`);
  if (n < min || n > max) throw new InputError(`${name} must be in [${min}, ${max}]`);
  return n;
}
function chem(v) {
  const c = String(v || 'lipo').toLowerCase();
  if (!(c in CELL_VOLTAGE)) throw new InputError(`chemistry must be one of ${Object.keys(CELL_VOLTAGE).join(', ')}`);
  return c;
}
class InputError extends Error {}
const r = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

/** Hover flight time from battery and efficiency. */
function flightTime(p) {
  const cells = num('cells', p.cells, { min: 1, max: 14 });
  const capacityMah = num('capacityMah', p.capacityMah, { min: 100, max: 100000 });
  const auwG = num('auwG', p.auwG, { min: 50, max: 50000 });
  const effGPerW = num('efficiencyGPerW', p.efficiencyGPerW, { min: 1, max: 20, def: 7 });
  const usable = num('usableFraction', p.usableFraction, { min: 0.3, max: 1, def: 0.8 });
  const cRating = num('cRating', p.cRating, { min: 1, max: 200, def: 0 });
  const chemistry = chem(p.chemistry);
  const vCell = CELL_VOLTAGE[chemistry];

  const packV = cells * vCell;
  const energyWh = packV * capacityMah / 1000;
  const usableWh = energyWh * usable;
  const hoverW = auwG / effGPerW;
  const hoverA = hoverW / packV;
  const minutes = usableWh / hoverW * 60;
  const result = {
    packVoltageV: r(packV), energyWh: r(energyWh), usableEnergyWh: r(usableWh),
    hoverPowerW: r(hoverW), hoverCurrentA: r(hoverA), flightTimeMin: r(minutes, 1),
  };
  if (cRating > 0) {
    const maxContA = cRating * capacityMah / 1000;
    result.maxContinuousCurrentA = r(maxContA);
    result.hoverCurrentShareOfMax = r(hoverA / maxContA, 3);
  }
  return {
    result,
    formulas: [
      'packV = cells * Vcell', 'E = packV * capacity_mAh / 1000', 'E_usable = E * usableFraction',
      'P_hover = AUW_g / efficiency_g_per_W', 'I_hover = P_hover / packV', 't_min = E_usable / P_hover * 60',
      'I_max = C * capacity_Ah',
    ],
    assumptions: [
      `${chemistry} nominal ${vCell} V/cell`, `usable fraction ${usable} (protects the pack)`,
      `hover efficiency ${effGPerW} g/W — take it from the motor/prop test data at hover thrust`,
      'pure hover in still air; forward flight, wind and aggressive manoeuvres reduce time',
    ],
  };
}

/** Thrust-to-weight ratio and approximate hover throttle. */
function thrustToWeight(p) {
  const auwG = num('auwG', p.auwG, { min: 50, max: 50000 });
  const motors = num('motors', p.motors, { min: 1, max: 16, def: 4 });
  const maxThrustPerMotorG = num('maxThrustPerMotorG', p.maxThrustPerMotorG, { min: 10, max: 50000 });
  const total = motors * maxThrustPerMotorG;
  const twr = total / auwG;
  const hoverThrottle = Math.sqrt(1 / twr);
  let rating = 'insufficient (cannot hover safely)';
  if (twr >= 1.5) rating = 'minimum for stable hover / heavy lift';
  if (twr >= 2) rating = 'good for camera / mapping drones';
  if (twr >= 4) rating = 'sporty / FPV freestyle';
  if (twr >= 7) rating = 'racing';
  return {
    result: { totalMaxThrustG: r(total, 0), thrustToWeight: r(twr), hoverThrottlePct: twr >= 1 ? r(hoverThrottle * 100, 1) : null, rating },
    formulas: ['T_total = motors * T_max_per_motor', 'TWR = T_total / AUW', 'throttle_hover ≈ sqrt(1 / TWR)'],
    assumptions: ['thrust ∝ throttle² (thrust ∝ rpm², rpm roughly ∝ throttle)', 'max thrust at full battery voltage'],
  };
}

/** Battery sizing for a target hover time (closed-form, battery mass included). */
function batterySizing(p) {
  const dryWeightG = num('dryWeightG', p.dryWeightG, { min: 50, max: 50000 });
  const targetMin = num('targetFlightTimeMin', p.targetFlightTimeMin, { min: 1, max: 600 });
  const cells = num('cells', p.cells, { min: 1, max: 14 });
  const effGPerW = num('efficiencyGPerW', p.efficiencyGPerW, { min: 1, max: 20, def: 7 });
  const usable = num('usableFraction', p.usableFraction, { min: 0.3, max: 1, def: 0.8 });
  const chemistry = chem(p.chemistry);
  const rho = num('energyDensityWhPerKg', p.energyDensityWhPerKg, { min: 50, max: 500, def: ENERGY_DENSITY_WH_PER_KG[chemistry] }) / 1000; // Wh/g
  const tH = targetMin / 60;
  const k = tH / effGPerW;            // Wh needed per gram of AUW (usable)
  const denom = rho * usable - k;
  if (denom <= 0) {
    return {
      result: { feasible: false, reason: 'target time is beyond what this chemistry and efficiency can provide at any battery size' },
      formulas: ['m_b = m_dry * k / (rho * u - k), k = t_h / eff'],
      assumptions: [`energy density ${rho * 1000} Wh/kg`],
    };
  }
  const mB = dryWeightG * k / denom;
  const auw = dryWeightG + mB;
  const energyWh = auw * k / usable;
  const vPack = cells * CELL_VOLTAGE[chemistry];
  const capacityMah = energyWh / vPack * 1000;
  return {
    result: {
      feasible: true, batteryMassG: r(mB, 0), auwG: r(auw, 0), packEnergyWh: r(energyWh, 1),
      capacityMah: Math.ceil(capacityMah / 50) * 50, packVoltageV: r(vPack), batteryShareOfAuw: r(mB / auw, 3),
    },
    formulas: ['k = t_hours / efficiency', 'm_b = m_dry * k / (rho * u - k)', 'E = AUW * k / u', 'capacity = E / packV'],
    assumptions: [
      `${chemistry}, ${rho * 1000} Wh/kg pack-level energy density`, `usable fraction ${usable}`,
      'efficiency assumed constant with weight (in reality it drops as load grows — add 10–20% margin)',
      'battery share above ~0.4 of AUW gives diminishing returns',
    ],
  };
}

/** Propeller diameter from hover thrust and target disk loading. */
function propSizing(p) {
  const auwG = num('auwG', p.auwG, { min: 50, max: 50000 });
  const motors = num('motors', p.motors, { min: 1, max: 16, def: 4 });
  const diskLoading = num('diskLoadingGPerCm2', p.diskLoadingGPerCm2, { min: 0.2, max: 5, def: 1.0 });
  const targetTwr = num('targetThrustToWeight', p.targetThrustToWeight, { min: 1.2, max: 12, def: 2 });
  const hoverPerMotor = auwG / motors;
  const areaCm2 = hoverPerMotor / diskLoading;
  const dCm = Math.sqrt(4 * areaCm2 / Math.PI);
  return {
    result: {
      hoverThrustPerMotorG: r(hoverPerMotor, 0), requiredMaxThrustPerMotorG: r(hoverPerMotor * targetTwr, 0),
      propDiameterCm: r(dCm, 1), propDiameterIn: r(dCm / 2.54, 1),
    },
    formulas: ['T_hover = AUW / motors', 'A = T_hover / DL', 'D = sqrt(4A/π)', 'T_max_needed = T_hover * TWR'],
    assumptions: [
      `disk loading ${diskLoading} g/cm² at hover (0.5–1 efficient, 1.5–3 compact/FPV)`,
      'pick the nearest standard prop size that fits the frame; verify with motor test data',
    ],
  };
}

module.exports = { flightTime, thrustToWeight, batterySizing, propSizing, InputError, CELL_VOLTAGE, ENERGY_DENSITY_WH_PER_KG };
