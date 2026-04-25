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

export function getWorkflowPresets() {
  return [
    { id: "slideshow", label: "Carousel" },
    { id: "linkedin-carousel", label: "LinkedIn Carousel" },
    { id: "linkedin-text", label: "LinkedIn Text" },
    { id: "mascot-variants", label: "Mascot Variants" },
    { id: "reference-edit", label: "Reference Edit" },
    { id: "video-clip", label: "Video Clip" },
    { id: "reel-package", label: "Reel Package" },
  ];
}

export function buildCanvasCards(brief, output, idGen) {
  const slides = output.slides || [];
  const artifacts = output.artifacts || [];

  if (slides.length > 0) {
    return slides.map((slide) => ({
      id: idGen(output.post_id),
      type: "asset",
      assetUrl: getWorkspaceAssetUrl(output, slide),
    }));
  }

  return artifacts.map((artifact) => ({
    id: idGen(output.post_id),
    type: "asset",
    assetUrl: getArtifactPreviewUrl(output, artifact),
  }));
}
