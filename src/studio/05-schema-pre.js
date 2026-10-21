// The schema registry (src/schema/roc-schema.js) is bundled here for the validation status. Its
// UMD footer exports to `module.exports` when `module` exists — this wrapper provides one, so the
// registry stays private to the studio instead of becoming window globals.
const RocSchema=(function(module){
