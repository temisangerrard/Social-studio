export function buildUgcDraftRequest({ brandId, platform, idea, notes } = {}) {
  return {
    brandProfileId: brandId || "peppera",
    platform: platform || "tiktok",
    idea: String(idea || "").trim(),
    notes: String(notes || "").trim()
  };
}

export function buildUgcStoryboardRequest({ brandId, platform, visualMode, script } = {}) {
  return {
    brandProfileId: brandId || "peppera",
    platform: platform || "tiktok",
    visualMode: visualMode || "story-led",
    script: script || {}
  };
}

export function buildUgcGenerateRequest({
  brandId,
  platform,
  voiceId,
  visualMode,
  script,
  uploadedAssetIds,
  storyboardPreviewId
} = {}) {
  return {
    brandProfileId: brandId || "peppera",
    platform: platform || "tiktok",
    voiceId: voiceId || "mock",
    visualMode: visualMode || "story-led",
    script: script || {},
    uploadedAssetIds: Array.isArray(uploadedAssetIds) ? uploadedAssetIds : [],
    ...(storyboardPreviewId ? { storyboardPreviewId } : {})
  };
}
