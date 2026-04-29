export const ugcState = {
  voices: [],
  uploadedAssets: [],
  draft: null,
  storyboard: null,         // { previewId, storyboardUrl, panels }
  storyboardApproved: false,
  lastOutput: null,
  loadingVoices: false,
  draftApproved: false,
  stage: "empty"            // "empty" | "brief" | "storyboard" | "generating" | "output"
};
