// ---- Registration ---------------------------------------------------------------------------
// The card's loader (rocLoadStudio) looks for RoomOverlayCard._rocStudio after the import. If
// this file is evaluated before the card (e.g. added as its own dashboard resource), it waits.
function rocStudioRegister(){
  const C=customElements.get('room-overlay-card');
  if(!C||!C._rocInternals){console.warn('[room-overlay-card] studio: room-overlay-card.js is too old or not loaded — the studio needs v'+ROC_STUDIO_VERSION);return;}
  C._rocStudio={version:ROC_STUDIO_VERSION,open:function(opts){return RocStudio.open(opts);},Studio:RocStudio,schema:RocSchema,
    wizBuild:rsWizBuild,wizAreas:rsWizAreas,wizUpload:rsUploadImage, // the wizard's pure parts, for the test tiers
    fpImport:rsFpImport,fpEntities:rsFpEntities,fpAutoLink:rsFpAutoLink,fpSensors:rsFpSensors}; // v6.47.0 floor plan import
}
if(customElements.get('room-overlay-card'))rocStudioRegister();
else customElements.whenDefined('room-overlay-card').then(rocStudioRegister);
})();
