# Room Overlay Card v4.6.3

## Release pipeline hardened — fixes HACS "unknown error" on v4.6.2

No card-code changes — the card is identical to v4.6.2 apart from the version number. This release exists because **v4.6.2 could not be installed through HACS**.

### What happened

HACS downloads `room-overlay-card.js` from the **release assets** of the selected version (that's what `filename` in `hacs.json` points to). The v4.6.2 release had no such asset: the upload workflow's single-shot `softprops/action-gh-release` step hit a transient GitHub 503 during the upload, the run failed without any retry or verification, and the release stayed published — looking perfectly fine — while every HACS install of it died with "unknown error".

### What changed

- **Retries.** The release workflow now uploads the asset with the `gh` CLI and retries up to 5 times with increasing backoff, so a transient GitHub hiccup no longer produces a broken release. (The third-party upload action, which also triggered Node-deprecation warnings, is gone.)
- **Verification.** After uploading, the workflow checks that `room-overlay-card.js` is *really* attached to the release and fails the run loudly if it isn't. A published release that HACS can't install is no longer a silent possibility.
- **Backfill.** The workflow can be run manually against any existing tag (Actions → Release → Run workflow → enter the tag) to attach the asset after the fact.

### Compatibility

- No config changes, no behaviour changes. If you're on v4.6.1 or already sideloaded v4.6.2 manually, v4.6.3 is byte-identical in behaviour.
