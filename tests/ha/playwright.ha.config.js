// Playwright config for the HA-in-the-loop tier — run through `npm run test:ha` (tests/ha/run-ha.js),
// which starts Home Assistant and sets ROC_HA_URL / ROC_HA_TOKENS.
'use strict';
const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
  testDir:__dirname,
  testMatch:'ha.spec.js',
  timeout:90000,
  retries:0,
  workers:1,
  use:{browserName:'chromium',viewport:{width:1400,height:900}},
  reporter:[['list']],
});
