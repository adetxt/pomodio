import { store } from './utils.js';
/* =====================================================================
   Shared app state: user settings and the live weather blend
   ===================================================================== */
export const PRESETS={
  clear:{cloud:0,sky:.42,fog:0,rain:0,wind:.35,storm:0,petals:1},
  overcast:{cloud:.85,sky:.9,fog:.22,rain:0,wind:.5,storm:0,petals:.5},
  fog:{cloud:.65,sky:.75,fog:1,rain:0,wind:.12,storm:0,petals:.25},
  drizzle:{cloud:.8,sky:.88,fog:.25,rain:.3,wind:.4,storm:0,petals:.3},
  rain:{cloud:.92,sky:.96,fog:.3,rain:.78,wind:.7,storm:0,petals:.1},
  storm:{cloud:1,sky:1,fog:.34,rain:1,wind:1,storm:1,petals:.05},
};
export const state={hour:12,live:true,weather:store.get('weather','clear'),tilt:store.get('tilt',.7),wet:0};
export const W={...PRESETS[state.weather]};
