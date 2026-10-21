# v7 Phase 0 spikes

Throw-away code that answered the spike questions in [`V7_PLAN.md`](../../V7_PLAN.md) §3 / §13.
Not part of the shipped card or the regular test tiers (Phase 1 turns `s34.spec.js` into the
HA-in-the-loop tier).

| File | Spike |
|---|---|
| `s34.spec.js` | S1 + S3 + S4: real Home Assistant, dashboard save paths, studio `<dialog>` above HA's editor |
| `onboard.py` | scripted onboarding of a fresh HA container → `tokens.json` |
| `configuration.yaml` | minimal HA config (`default_config`, `demo`) |
| `pw.config.js` | Playwright config for `s34.spec.js` |
| `floorplan-concept.html` | S5: the floorplan concept (author's AnyVac geometry) with the *Změřit výkon* probe (`window.__bench()`) |

## Run S3/S4 locally

```bash
mkdir -p ha/config/www && cp configuration.yaml ha/config/ && cp ../../room-overlay-card.js ha/config/www/
docker run -d --name roc-ha -p 8123:8123 -v "$PWD/ha/config:/config" ghcr.io/home-assistant/home-assistant:2026.10.2
# wait until http://localhost:8123/api/onboarding answers, then:
python3 onboard.py            # writes tokens.json next to this file
npx playwright test -c pw.config.js
```

Pin the image to the HA version the author runs; the spikes were done on 2026.10.2.
