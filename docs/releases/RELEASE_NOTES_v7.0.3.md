# v7.0.3 — a release checks its own version

No change to the card; nothing to do after updating.

- The files attached to **v7.0.1** were built from the 7.0.0 code: that release was published a
  minute before its commit was pushed, and GitHub put the tag on the commit before it. The fixes
  listed under 7.0.1 first shipped in **7.0.2**.
- The release workflow now compares the tag with the version in the code and stops when they
  differ, so this cannot happen silently again.

Details: [CHANGELOG.md](../../CHANGELOG.md).
