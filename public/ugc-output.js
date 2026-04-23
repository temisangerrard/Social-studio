export function buildUgcOutputActions({ postId, platform, videoUrl, audioUrl } = {}) {
  const actions = [];

  if (videoUrl) {
    actions.push({
      label: "Download Video",
      href: videoUrl,
      download: true
    });
  }

  if (audioUrl) {
    actions.push({
      label: "Download Audio",
      href: audioUrl,
      download: true
    });
  }

  if (postId) {
    actions.push({
      label: "Export Package",
      href: `/api/outputs/${postId}/export/package`,
      download: true
    });
  }

  if (platform === "instagram") {
    actions.push({
      label: "Open Instagram Create",
      href: "https://www.instagram.com/create/select/",
      download: false
    });
  } else if (platform === "tiktok") {
    actions.push({
      label: "Open TikTok Upload",
      href: "https://www.tiktok.com/upload",
      download: false
    });
  } else if (platform === "linkedin") {
    actions.push({
      label: "Open LinkedIn Post",
      href: "https://www.linkedin.com/feed/?shareActive=true",
      download: false
    });
  }

  return actions;
}
