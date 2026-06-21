# Room Overlay Card v3.0.4

Maintenance release. Restores the original day/night blind rendering and fixes
the release workflow. No config changes.

## ↩️ Changed
- **Day/night blind reverted to the original 3.0.0 model.** The blind rework
  shipped in 3.0.1 was based on a wrong mental model and didn't match real
  hardware. The 3.0.0 two-layer rendering was the closest match, so it's
  restored. Accurate day/night blind modelling stays an open item to revisit
  with a real-world reference. (3.0.2 and 3.0.3 were internal experiments and
  were never released.)

## 🐛 Fixed
- **Release workflow** — `action-gh-release` now passes an explicit `tag_name`,
  fixing the "GitHub Releases requires a tag" failure when publishing a release.

## 🔄 Compatibility
- No config changes. Functionally identical to 3.0.0 for the card itself.
  Verified against Home Assistant 2026.6.
