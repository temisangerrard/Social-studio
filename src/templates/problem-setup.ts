import type { CarouselTemplateInput } from "./types.ts";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderProblemSetupTemplate(input: CarouselTemplateInput): string {
  const { slide, brandVisual, imageDataUrl, slideCount } = input;
  const { primaryColor, secondaryColor, accentColor } = brandVisual;

  const lines = (slide.text ?? "").split("\n").filter((l) => l.trim().length > 0);

  const bgContent = imageDataUrl
    ? `<img src="${imageDataUrl}" alt="" style="position:absolute;top:0;left:0;width:1080px;height:1080px;object-fit:cover;z-index:0;" />`
    : `<div style="position:absolute;top:0;left:0;width:1080px;height:1080px;background:linear-gradient(180deg, ${primaryColor} 0%, ${accentColor} 100%);z-index:0;"></div>`;

  const textLines = lines.map((line, idx) => {
    const escaped = escapeHtml(line);
    // First line bold, last line highlighted in orange, rest normal
    if (idx === 0) {
      return `<p style="margin:0 0 20px 0;font-size:42px;font-weight:800;color:#ffffff;line-height:1.2;">${escaped}</p>`;
    }
    if (idx === lines.length - 1) {
      return `<p style="margin:0 0 20px 0;font-size:40px;font-weight:700;color:${secondaryColor};line-height:1.2;">${escaped}</p>`;
    }
    return `<p style="margin:0 0 20px 0;font-size:38px;font-weight:500;color:${accentColor};line-height:1.3;">${escaped}</p>`;
  }).join("\n    ");

  const dots = Array.from({ length: slideCount }, (_, i) =>
    `<div style="width:10px;height:10px;border-radius:50%;background:${i === slide.slide_number - 1 ? secondaryColor : "rgba(255,255,255,0.4)"};"></div>`
  ).join("\n      ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;width:1080px;height:1080px;overflow:hidden;font-family:'Inter',-apple-system,system-ui,sans-serif;position:relative;background:#0f0b09;">
  ${bgContent}

  <!-- Semi-transparent dark overlay for readability -->
  <div style="position:absolute;top:0;left:0;width:1080px;height:1080px;background:rgba(0,0,0,0.55);z-index:1;"></div>

  <!-- Text overlay -->
  <div style="position:absolute;top:50%;left:60px;right:60px;transform:translateY(-50%);z-index:2;background:rgba(0,0,0,0.35);border-radius:24px;padding:48px;border-left:6px solid ${primaryColor};">
    ${textLines}
  </div>

  <!-- Slide dots -->
  <div style="position:absolute;bottom:30px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:2;">
      ${dots}
  </div>
</body>
</html>`;
}
