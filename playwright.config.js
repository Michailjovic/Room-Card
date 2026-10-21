// Playwright config for the browser tier: geometry (tests/e2e.spec.js), the studio
// (tests/studio.spec.js) and the floor plan page (tests/floorplan.spec.js, v6.47.0).
// Chromium only — the target devices (HA kiosk tablets, desktop) are Chromium-based.
'use strict';
const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
  testMatch:['tests/e2e.spec.js','tests/studio.spec.js','tests/floorplan.spec.js'],
  timeout:30000,
  retries:1,
  use:{
    browserName:'chromium',
    viewport:{width:1600,height:800},
  },
  reporter:[['list']],
});
