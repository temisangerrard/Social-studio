import assert from "node:assert/strict";
import test from "node:test";

import {
  activeAssetAnalyses,
  activeUploadedAssets,
  addUploadsToLibrary,
  isUploadSelected,
  removeUploadFromLibrary,
  selectUploadForRun
} from "./upload-scope.js";

test("stored uploads are not active run context until selected", () => {
  const state = {
    uploadedAssets: [
      { id: "old-food", url: "/api/uploads/old-food.jpg" },
      { id: "new-food", url: "/api/uploads/new-food.jpg" }
    ],
    assetAnalyses: [
      { assetId: "old-food", assetType: "food_photo" },
      { assetId: "new-food", assetType: "food_photo" }
    ],
    selectedUploadAssetIds: new Set(["new-food"])
  };

  assert.deepEqual(activeUploadedAssets(state).map((asset) => asset.id), ["new-food"]);
  assert.deepEqual(activeAssetAnalyses(state).map((analysis) => analysis.assetId), ["new-food"]);
});

test("new uploads can be added to the library and selected for the current run", () => {
  const state = {
    uploadedAssets: [{ id: "existing", url: "/api/uploads/existing.jpg" }],
    selectedUploadAssetIds: new Set()
  };

  addUploadsToLibrary(state, [{ id: "fresh", url: "/api/uploads/fresh.jpg" }], { selectForRun: true });

  assert.deepEqual(state.uploadedAssets.map((asset) => asset.id), ["existing", "fresh"]);
  assert.equal(isUploadSelected(state, "existing"), false);
  assert.equal(isUploadSelected(state, "fresh"), true);
});

test("run selection can be toggled without deleting stored uploads", () => {
  const state = {
    uploadedAssets: [{ id: "hero", url: "/api/uploads/hero.jpg" }],
    selectedUploadAssetIds: new Set(["hero"])
  };

  selectUploadForRun(state, "hero", false);

  assert.deepEqual(state.uploadedAssets.map((asset) => asset.id), ["hero"]);
  assert.deepEqual(activeUploadedAssets(state), []);
});

test("uploads can be deleted from library, active selection, and analyses together", () => {
  const state = {
    uploadedAssets: [
      { id: "hero", url: "/api/uploads/hero.jpg" },
      { id: "keep", url: "/api/uploads/keep.jpg" }
    ],
    assetAnalyses: [
      { assetId: "hero", assetType: "product_photo" },
      { assetId: "keep", assetType: "food_photo" }
    ],
    selectedUploadAssetIds: new Set(["hero", "keep"])
  };

  const removed = removeUploadFromLibrary(state, "hero");

  assert.equal(removed.id, "hero");
  assert.deepEqual(state.uploadedAssets.map((asset) => asset.id), ["keep"]);
  assert.deepEqual(state.assetAnalyses.map((analysis) => analysis.assetId), ["keep"]);
  assert.deepEqual(activeUploadedAssets(state).map((asset) => asset.id), ["keep"]);
});
