// Playwright config for the geometry regression tier (tests/e2e.spec.js).
// Chromium only — the target devices (HA kiosk tablets, desktop) are Chromium-based.
'use strict';
const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
  testMatch:'tests/e2e.spec.js',
  timeout:30000,
  retries:1,
  use:{
    browserName:'chromium',
    viewport:{width:1600,height:800},
  },
  reporter:[['list']],
});
