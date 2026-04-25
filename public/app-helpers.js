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
  if (typeof slideNumber === "number" && !Number.isNaN(slideNumber) && output.render_status !== "skipped") {
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
    x: 760 + (index % 4) * 240,
    y: 72 + Math.floor(index / 4) * 520,
    width: 210,
    height: 460,
    tags: [item.role || "asset", item.kind || "image", "asset"],
    sourceAssetId: item.source_asset_id || null,
    variantGroup: item.variant_group || null,
    role: item.role || "asset"
  };
}

export function buildCanvasCards(brief, generatedOutput, makeId) {
  const nextCards = [];

  // ── Column 1: Strategy cards (x: 72) ──────────────────────────────────
  const strategyEntries = [
    ["goal", brief.goal],
    ["audience", brief.audience],
    ["proof", brief.offer],
    ["visual", brief.tone],
  ];
  let stratY = 72;
  strategyEntries.forEach(([type, value]) => {
    if (!value) return;
    nextCards.push({
      id: makeId("card"),
      type,
      text: value,
      x: 72,
      y: stratY,
      width: 280,
      height: 200,
      tags: [type]
    });
    stratY += 220;
  });

  // ── Column 2: Growth logic cards (x: 400) from generated output ────────
  if (generatedOutput) {
    let growthY = 72;

    // Caption card
    if (generatedOutput.caption) {
      nextCards.push({
        id: makeId("card"),
        type: "hook",
        text: generatedOutput.caption,
        x: 400,
        y: growthY,
        width: 300,
        height: 220,
        tags: ["caption"]
      });
      growthY += 240;
    }

    // Hook cards (one per hook)
    (generatedOutput.hooks || []).slice(0, 3).forEach((hook, i) => {
      nextCards.push({
        id: makeId("card"),
        type: "hook",
        text: hook,
        x: 400,
        y: growthY,
        width: 300,
        height: 180,
        tags: ["hook"]
      });
      growthY += 200;
    });

    // Hashtags card
    const tags = (generatedOutput.hashtags || []).join(" ");
    if (tags) {
      nextCards.push({
        id: makeId("card"),
        type: "visual",
        text: tags,
        x: 400,
        y: growthY,
        width: 300,
        height: 160,
        tags: ["hashtags"]
      });
    }
  } else if (brief.platform) {
    nextCards.push({
      id: makeId("card"),
      type: "hook",
      text: `Optimise for ${brief.platform}`,
      x: 400,
      y: 72,
      width: 300,
      height: 180,
      tags: ["platform"]
    });
  }

  // ── Column 3+: Generated asset cards (slides / artifacts) ─────────────
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
      id: "linkedin-carousel",
      label: "LinkedIn Carousel",
      summary: "Generate a LinkedIn carousel with slide copy, visual direction, and post text."
    },
    {
      id: "linkedin-text",
      label: "LinkedIn Text Post",
      summary: "Generate a text-only LinkedIn post with hooks, body copy, and hashtags."
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
    },
    {
      label: "Open LinkedIn Post",
      href: "https://www.linkedin.com/feed/?shareActive=true",
      helper: `Create a new LinkedIn post for ${productName}.`
    }
  ];
}

export function formatRelativeTime(isoString) {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays <= 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function getContentTypeLabel(workflowType) {
  const labels = {
    "slideshow": "Carousel",
    "mascot-variants": "Mascot Variants",
    "video-clip": "Video Clip",
    "reel-package": "Reel Package",
    "linkedin-carousel": "LinkedIn Carousel",
    "linkedin-text": "LinkedIn Text",
    "reference-edit": "Reference Edit",
  };
  return labels[workflowType] || "Single Image";
}
