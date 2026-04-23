export const studioState = {
  products: [],
  brands: [],
  canvasCards: [],
  generatedOutput: null,
  selectedAsset: null,
  uploadedAssets: [],
  assetAnalyses: [],
  selectedUploadAssetIds: new Set(),
  routePreview: null,
  workflowType: "slideshow",
  canvasLoadingStage: null,
  downloading: false,
  canvasEngine: null,
  stylePresets: [],
  selectedStyleId: "",
  userPickedStyle: false,
  ugcBriefApproved: false
};

export const calendarState = {
  weekOffset: 0,
  slots: [],
  pillars: [],
  selectedSlotIds: new Set(),
  editingPillarId: null,
  editingSlotId: null,
  editingSlotDate: null
};
