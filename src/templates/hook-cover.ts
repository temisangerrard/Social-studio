import type { CarouselTemplateInput } from "./types.ts";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderHookCoverTemplate(input: CarouselTemplateInput): string {
  const { slide, brandVisual, imageDataUrl, slideCount } = input;
  const { primaryColor, secondaryColor, accentColor } = brandVisual;

  const lines = (slide.text ?? "").split("\n");
  const title = escapeHtml(lines[0] ?? "");
  const subtitle = escapeHtml(lines.slice(1).join(" ") ?? "");

  const bgContent = imageDataUrl
    ? `<img src="${imageDataUrl}" alt="" style="position:absolute;top:0;left:0;width:1080px;height:1080px;object-fit:cover;z-index:0;" />`
    : `<div style="position:absolute;top:0;left:0;width:1080px;height:1080px;background:linear-gradient(135deg, ${accentColor} 0%, ${primaryColor} 100%);z-index:0;"></div>`;

  const dots = Array.from({ length: slideCount }, (_, i) =>
    `<div style="width:10px;height:10px;border-radius:50%;background:${i === slide.slide_number - 1 ? secondaryColor : "rgba(255,255,255,0.4)"};"></div>`
  ).join("\n      ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;width:1080px;height:1080px;overflow:hidden;font-family:'Inter',-apple-system,system-ui,sans-serif;position:relative;background:${accentColor};">
  ${bgContent}
  <!-- Dark overlay for text readability -->
  <div style="position:absolute;top:0;left:0;width:1080px;height:1080px;background:linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.4) 100%);z-index:1;"></div>

  <!-- Header bar -->
  <div style="position:absolute;top:0;left:0;width:1080px;height:100px;background:${primaryColor};z-index:2;display:flex;align-items:center;justify-content:center;">
    <span style="color:#ffffff;font-size:28px;font-weight:700;letter-spacing:0.05em;">PEPPERA</span>
  </div>

  <!-- Title text -->
  <div style="position:absolute;top:140px;left:60px;right:60px;z-index:2;text-align:center;">
    <h1 style="margin:0;font-size:72px;font-weight:900;color:#ffffff;text-shadow:0 4px 20px rgba(0,0,0,0.6);line-height:1.1;letter-spacing:-0.02em;">${title}</h1>
    ${subtitle ? `<p style="margin:24px 0 0 0;font-size:36px;font-weight:500;color:${accentColor};text-shadow:0 2px 12px rgba(0,0,0,0.5);line-height:1.3;">${subtitle}</p>` : ""}
  </div>

  <!-- Accent stripe -->
  <div style="position:absolute;bottom:80px;left:50%;transform:translateX(-50%);width:120px;height:6px;background:${secondaryColor};border-radius:3px;z-index:2;"></div>

  <!-- Slide dots -->
  <div style="position:absolute;bottom:30px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:2;">
      ${dots}
  </div>
</body>
</html>`;
}
