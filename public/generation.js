import { els } from "./dom-refs.js";
import { studioState } from "./state.js";
import { buildCanvasCards } from "./app-helpers.js";
import { CanvasEngine, downloadArtboard, downloadAllAsZip } from "./canvas-engine.js";
import { getBrandById, showStatus, hideStatus, setCheckpoint, showCanvasProgress, hideCanvasProgress, makeId } from "./ui-utils.js";
import { buildReferenceAssets, renderRoutePreview } from "./references.js";
import { outputAssets, renderInspectorPackage, renderInspectorAsset, renderCanvas } from "./inspector.js";

// ── Poll job ──────────────────────────────────────────────────────────────────
export async function pollJob(jobId, onUpdate) {
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(`/api/jobs/${jobId}`);
    const job = await res.json();
    onUpdate?.(job);
    if (job.status === "failed") throw new Error(job.error || "Generation failed.");
    if (job.status === "done") return job.result;
  }
  throw new Error("Generation timed out.");
}

// ── Sync cards from brief ─────────────────────────────────────────────────────
export function syncCardsFromBrief() {
  studioState.canvasCards = buildCanvasCards(
    studioState.session?.inferredBrief || {},
    studioState.generatedOutput,
    makeId
  );
  if (studioState.generatedOutput) {
    studioState.selectedAsset = outputAssets(studioState.generatedOutput)[0] || null;
  }
}

// ── Load output into CanvasEngine ─────────────────────────────────────────────
export function loadOutputToEngine(output) {
  if (!output || !studioState.canvasEngine) return;
  if (els.canvasEmpty) els.canvasEmpty.classList.add("hidden");
  studioState.canvasEngine.loadOutput(output);
  const dlAllBtn = document.getElementById("toolbar-download-all-btn");
  if (dlAllBtn) dlAllBtn.classList.remove("hidden");
  document.getElementById("toolbar-export-pdf")?.classList.remove("hidden");
  document.getElementById("toolbar-export-zip")?.classList.remove("hidden");
}

// ── Core generation pipeline ──────────────────────────────────────────────────
export async function runGeneration(rawIdea, notes) {
  const brandId = els.studioProductSelect.value;
  const brief = studioState.session?.inferredBrief || {};
  const workflowOverride =
    studioState.routePreview?.decision?.workflowType && studioState.routePreview.decision.workflowType !== studioState.workflowType
      ? studioState.workflowType : undefined;
  const contentTypeOverride =
    studioState.routePreview?.decision?.contentTypeId && els.studioContentTypeSelect?.value && els.studioContentTypeSelect.value !== studioState.routePreview.decision.contentTypeId
      ? els.studioContentTypeSelect.value : undefined;

  const request = {
    brandProfileId: brandId,
    rawIdea,
    notes: notes || (brief.audience ? `Audience: ${brief.audience}. Offer: ${brief.offer || ""}. Tone: ${brief.tone || ""}.` : ""),
    cards: studioState.canvasCards,
    references: [],
    referenceAssets: buildReferenceAssets({
      brandId, visualMode: els.studioVisualMode.value,
      inputValue: els.studioReferenceInput.value, selectedAsset: studioState.selectedAsset
    }),
    uploadedAssets: studioState.uploadedAssets,
    assetAnalyses: studioState.assetAnalyses,
    platformTargets: [els.studioPlatformSelect.value],
    goal: getBrandById(brandId)?.defaults?.goal || "awareness",
    workflowType: studioState.routePreview?.decision?.workflowType || studioState.workflowType,
    visualMode: els.studioVisualMode.value,
    deliveryTargets: studioState.routePreview?.decision?.deliveryTargets || els.studioDeliveryTarget.value,
    contentTypeId: studioState.routePreview?.decision?.contentTypeId || els.studioContentTypeSelect?.value || undefined,
    routingOverride: workflowOverride || contentTypeOverride
      ? { workflowType: workflowOverride, contentTypeId: contentTypeOverride } : undefined,
    variantCount: studioState.workflowType === "mascot-variants" ? 4 : undefined,
    videoOptions: ["video-clip", "reel-package"].includes(studioState.workflowType)
      ? { duration: 5, aspectRatio: "9:16", withAudio: true, consistencyMode: "mascot-consistent" } : undefined,
    styleControl: studioState.selectedStyleId ? {
      styleCardId: studioState.selectedStyleId,
      generationMode: els.studioGenerationMode?.value || "image-first",
      textDensity: els.studioTextDensity?.value || undefined,
      imageTreatment: els.studioImageTreatment?.value || undefined,
      referenceLockStrength: els.studioReferenceLock?.value || "loose"
    } : undefined
  };

  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });
  const { jobId } = await res.json();

  return pollJob(jobId, (job) => {
    const stage = job.stage || job.status || "working";
    if (stage === "planning" || job.status === "running") {
      setCheckpoint("strategy", "active");
      showCanvasProgress("Planning recipes and content…");
    }
    if (stage === "generating") {
      setCheckpoint("strategy", "done"); setCheckpoint("hooks", "done"); setCheckpoint("visuals", "active");
      showCanvasProgress("Generating visuals…");
    }
    if (stage === "rendering") {
      setCheckpoint("visuals", "done");
      showCanvasProgress("Rendering final slides…");
    }
    studioState.canvasLoadingStage = stage;
  });
}

export function finishGeneration(output) {
  studioState.canvasLoadingStage = null;
  studioState.generatedOutput = output;
  studioState.workflowType = output.workflow_type || studioState.workflowType;
  studioState.selectedAsset = outputAssets(output)[0] || null;
  if (output.routing_decision) {
    studioState.routePreview = { decision: output.routing_decision, trace: output.routing_trace };
  }
  setCheckpoint("visuals", "done");
  setCheckpoint("finalPackage", "done");
  hideCanvasProgress();
  hideStatus();
  loadOutputToEngine(output);
  renderRoutePreview();
}

// ── Refinement merge ──────────────────────────────────────────────────────────
export function mergeRefinedOutput(currentOutput, refinementOutput, mode, selectedAsset) {
  if (!currentOutput || !refinementOutput?.artifacts?.length) return refinementOutput;
  const next = refinementOutput.artifacts[0];
  const merged = outputAssets(currentOutput)
    .filter((a) => mode !== "replace" || a.itemId !== selectedAsset?.itemId)
    .map((a) => ({
      id: a.itemId, kind: a.assetKind, role: a.role, title: a.text,
      prompt: a.prompt || a.text, asset_path: a.assetUrl, preview_path: a.assetUrl,
      source_asset_id: a.sourceAssetId, variant_group: a.variantGroup
    }));
  merged.push(next);
  return { ...currentOutput, post_id: refinementOutput.post_id, workflow_type: "reference-edit", artifacts: merged };
}

// ── Download all ──────────────────────────────────────────────────────────────
export async function downloadAllAssets() {
  const output = studioState.generatedOutput;
  if (studioState.downloading || !output) return;
  studioState.downloading = true;
  els.studioDownloadAllBtn.disabled = true;
  els.studioDownloadAllBtn.textContent = "Downloading…";
  try {
    if (studioState.canvasEngine) {
      await downloadAllAsZip(studioState.canvasEngine.getArtboards(), output);
    } else {
      const zip = new window.JSZip();
      await Promise.all(outputAssets(output).map(async (item, i) => {
        if (!item.assetUrl) return;
        const res = await fetch(item.assetUrl);
        if (!res.ok) return;
        const blob = await res.blob();
        const ext = item.assetUrl.split(".").pop() || (item.assetKind === "video" ? "mp4" : "png");
        zip.file(`${item.itemId || `asset-${i + 1}`}.${ext}`, blob);
      }));
      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `${output.post_id}-assets.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  } catch (err) {
    showStatus(err instanceof Error ? err.message : "Download failed.");
  } finally {
    studioState.downloading = false;
    els.studioDownloadAllBtn.disabled = false;
    els.studioDownloadAllBtn.textContent = "Download All";
  }
}
