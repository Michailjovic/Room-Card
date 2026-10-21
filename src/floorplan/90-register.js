// ---- Registration ---------------------------------------------------------------------------
// The card's loader (rocLoadFloorplan) looks for RoomOverlayCard._rocFloorplan after the import.
function rfpRegister(){
  const C=customElements.get('room-overlay-card');
  if(!C){console.warn('[room-overlay-card] floorplan: room-overlay-card.js is not loaded');return;}
  C._rocFloorplan={version:ROC_FP_VERSION,
    mount:function(host,opts){return new RfpView(host,opts);},
    View:RfpView,themes:RFP_THEMES,themeNames:RFP_THEME_NAMES,theme:rfpTheme,themeName:rfpThemeName,
    geom:{poly:rfpPoly,area:rfpArea,bbox:rfpBBox,inPoly:rfpInPoly,distSeg:rfpDistSeg,pole:rfpPole,wallSegs:rfpWallSegs,openingEdge:rfpOpeningEdge,
      proj:RFP_PROJ,fit:rfpFit,P:rfpP,inv:rfpInv,viewDir:rfpViewDir,clean:rfpCleanOutline,doors:rfpProposeDoors,kelvin:rfpKelvin}};
}
if(customElements.get('room-overlay-card'))rfpRegister();
else customElements.whenDefined('room-overlay-card').then(rfpRegister);
})();
