// Prints the material comparison table: `npx vite-node scripts/lab-report.ts`
import { SCENARIOS, runAll } from '../src/levels/scenarios';

for (const sc of SCENARIOS) {
  console.log(`\n== ${sc.name} ==`);
  console.log('material  distance  maxH  maxSpd  settle  impacts');
  for (const r of runAll(sc)) {
    console.log(
      `${r.material.padEnd(8)} ${r.distance.toFixed(0).padStart(9)} ${r.maxHeight.toFixed(0).padStart(5)} ${r.maxSpeed
        .toFixed(0)
        .padStart(7)} ${r.settleTime.toFixed(2).padStart(7)} ${String(r.bounces).padStart(8)}`,
    );
  }
}
