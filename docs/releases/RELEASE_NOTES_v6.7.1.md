# v6.7.1 — Fix the red `e2e` job

**No change to the card.** This release only fixes the test suite.

The Playwright geometry test that shipped with v6.6.0 reached for the card with
`document.querySelector('room-overlay-card')`. In `tests/harness/ha-shell.html` the card is mounted
**inside `hui-panel-view`'s shadow root** — deliberately, because that is what makes the harness
reproduce Home Assistant's real edit-mode DOM moves. `querySelector` therefore returned `null`, the
test threw `Cannot read properties of null (reading 'shadowRoot')`, and the `e2e` job failed on
every push since v6.6.0 while `smoke` and `hacs` stayed green.

The test now uses `window.__harness.card`, the handle the harness exposes and that every other test
in the file already reaches through `geo()`.

Verified by running the suite against the exact repository content: 7/7 passing in real Chromium.
