export function selectedUploadIds(state = {}) {
  const ids = state.selectedUploadAssetIds;
  if (ids instanceof Set) return ids;
  return new Set(Array.isArray(ids) ? ids : []);
}

export function isUploadSelected(state, assetId) {
  return selectedUploadIds(state).has(assetId);
}

export function selectUploadForRun(state, assetId, selected = true) {
  if (!state.selectedUploadAssetIds || !(state.selectedUploadAssetIds instanceof Set)) {
    state.selectedUploadAssetIds = selectedUploadIds(state);
  }
  if (selected) {
    state.selectedUploadAssetIds.add(assetId);
  } else {
    state.selectedUploadAssetIds.delete(assetId);
  }
  return state.selectedUploadAssetIds;
}

export function activeUploadedAssets(state = {}) {
  const ids = selectedUploadIds(state);
  return (state.uploadedAssets || []).filter((asset) => ids.has(asset.id));
}

export function activeAssetAnalyses(state = {}) {
  const activeIds = new Set(activeUploadedAssets(state).map((asset) => asset.id));
  return (state.assetAnalyses || []).filter((analysis) => activeIds.has(analysis.assetId));
}

export function addUploadsToLibrary(state, assets = [], { selectForRun = false } = {}) {
  const existingIds = new Set((state.uploadedAssets || []).map((asset) => asset.id));
  const nextAssets = assets.filter((asset) => asset?.id && !existingIds.has(asset.id));
  state.uploadedAssets = [...(state.uploadedAssets || []), ...nextAssets];
  if (selectForRun) {
    nextAssets.forEach((asset) => selectUploadForRun(state, asset.id, true));
  }
  return nextAssets;
}

export function removeUploadFromLibrary(state, assetId) {
  const asset = (state.uploadedAssets || []).find((item) => item.id === assetId) || null;
  state.uploadedAssets = (state.uploadedAssets || []).filter((item) => item.id !== assetId);
  state.assetAnalyses = (state.assetAnalyses || []).filter((analysis) => analysis.assetId !== assetId);
  selectUploadForRun(state, assetId, false);
  return asset;
}
