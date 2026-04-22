import { getWorkflowPresets } from "./app-helpers.js";

export const WORKFLOW_PRESETS = getWorkflowPresets();

export const studioState = {
  products: [],
  brands: [],
  session: null,
  canvasCards: [],
  generatedOutput: null,
  selectedAsset: null,
  uploadedAssets: [],
  assetAnalyses: [],
  routePreview: null,
  workflowType: "slideshow",
  canvasLoadingStage: null,
  downloading: false,
  canvasEngine: null,
  stylePresets: [],
  selectedStyleId: ""
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
