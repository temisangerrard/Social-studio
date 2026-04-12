export function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getWorkspaceAssetUrl(output, slide) {
  if (!output || !slide) {
    return null;
  }

  if (slide.asset_path) {
    const filename = slide.asset_path.split("/").pop();
    if (filename && output.post_id) {
      return `/api/assets/${output.post_id}/${filename}`;
    }
  }

  if (slide.kind === "video") {
    return null;
  }

  const slideNumber = slide.slide_number;
  if (typeof slideNumber === "number" && output.render_status !== "skipped") {
    return `/api/slides/${output.post_id}/slide-${String(slideNumber).padStart(2, "0")}.png`;
  }

  return null;
}

export function getArtifactPreviewUrl(output, artifact) {
  if (!output || !artifact) {
    return null;
  }

  if (artifact.asset_path) {
    const filename = artifact.asset_path.split("/").pop();
    if (filename && output.post_id) {
      return `/api/assets/${output.post_id}/${filename}`;
    }
  }

  if (artifact.preview_path) {
    const filename = artifact.preview_path.split("/").pop();
    if (filename && output.post_id) {
      return `/api/assets/${output.post_id}/${filename}`;
    }
  }

  return null;
}

function buildAssetCardFromItem(output, item, index, makeId) {
  const assetUrl = getArtifactPreviewUrl(output, item) || getWorkspaceAssetUrl(output, item);
  return {
    id: makeId("asset"),
    itemId: item.id || null,
    type: "asset",
    assetKind: item.kind === "video" ? "video" : "image",
    text: item.title || item.text || `Asset ${index + 1}`,
    assetUrl,
    x: 720 + (index % 4) * 220,
    y: 96 + Math.floor(index / 4) * 360,
    width: 196,
    height: 336,
    tags: [item.role || "asset", item.kind || "image", "asset"],
    sourceAssetId: item.source_asset_id || null,
    variantGroup: item.variant_group || null,
    role: item.role || "asset"
  };
}

export function buildCanvasCards(brief, generatedOutput, makeId) {
  const nextCards = [];
  const baseX = 72;
  const baseY = 72;
  const entries = [
    ["goal", brief.goal],
    ["audience", brief.audience],
    ["proof", brief.offer],
    ["visual", brief.tone],
    ["hook", brief.platform ? `Optimise for ${brief.platform}` : ""]
  ];

  entries.forEach(([type, value], index) => {
    if (!value) return;
    nextCards.push({
      id: makeId("card"),
      type,
      text: value,
      x: baseX + (index % 2) * 320,
      y: baseY + Math.floor(index / 2) * 250,
      width: type === "hook" ? 320 : 280,
      height: type === "hook" ? 240 : 220,
      tags: [type]
    });
  });

  const workflowAssets =
    generatedOutput?.artifacts?.length
      ? generatedOutput.artifacts
      : generatedOutput?.slides || [];

  if (workflowAssets.length) {
    workflowAssets.forEach((item, index) => {
      nextCards.push(buildAssetCardFromItem(generatedOutput, item, index, makeId));
    });
  }

  return nextCards;
}

export function getWorkflowPresets() {
  return [
    {
      id: "slideshow",
      label: "Static Slideshow",
      summary: "Plan and generate a post package with slide visuals, hooks, caption, and hashtags."
    },
    {
      id: "mascot-variants",
      label: "Mascot Variant Pack",
      summary: "Generate multiple mascot-led visual options from one prompt and pick a hero variant."
    },
    {
      id: "reference-edit",
      label: "Reference Edit",
      summary: "Refine an existing image with prompt changes and reference guidance."
    },
    {
      id: "video-clip",
      label: "Vertical Video Clip",
      summary: "Generate a single short-form vertical clip for TikTok or Instagram."
    },
    {
      id: "reel-package",
      label: "Reel Package",
      summary: "Build clip briefs, voiceover, subtitles, and optional clip outputs for a full reel concept."
    }
  ];
}

export function getPlatformPublishLinks(productName) {
  return [
    {
      label: "Open TikTok Upload",
      href: "https://www.tiktok.com/upload",
      helper: `Upload the exported visuals for ${productName} into TikTok.`
    },
    {
      label: "Open Instagram Create",
      href: "https://www.instagram.com/create/select/",
      helper: `Open Instagram web create flow for ${productName}.`
    }
  ];
}
