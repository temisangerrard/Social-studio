import type { CarouselTemplateInput } from "./types.ts";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderCtaBannerTemplate(input: CarouselTemplateInput): string {
  const { slide, brandVisual, imageDataUrl, slideCount, productName } = input;
  const { primaryColor, secondaryColor, accentColor, surfaceColor } = brandVisual;

  const bgContent = imageDataUrl
    ? `<img src="${imageDataUrl}" alt="" style="position:absolute;top:0;left:0;width:1080px;height:540px;object-fit:cover;z-index:0;" />`
    : `<div style="position:absolute;top:0;left:0;width:1080px;height:540px;background:linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%);z-index:0;display:flex;align-items:center;justify-content:center;">
        <span style="font-size:160px;">🌶️</span>
      </div>`;

  // Parse slide text for engagement question if present
  const textLines = (slide.text ?? "").split("\n").filter((l) => l.trim().length > 0);
  const engagementLine = textLines.find((l) => l.includes("?") || l.toLowerCase().includes("comment")) ?? "";

  const dots = Array.from({ length: slideCount }, (_, i) =>
    `<div style="width:10px;height:10px;border-radius:50%;background:${i === slide.slide_number - 1 ? secondaryColor : "rgba(0,0,0,0.2)"};"></div>`
  ).join("\n      ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;width:1080px;height:1080px;overflow:hidden;font-family:'Inter',-apple-system,system-ui,sans-serif;position:relative;background:${accentColor};">
  <!-- Mascot image upper portion -->
  ${bgContent}

  <!-- CTA content area -->
  <div style="position:absolute;top:540px;left:0;width:1080px;height:540px;background:${accentColor};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 60px;box-sizing:border-box;z-index:1;">
    <!-- Headline -->
    <div style="font-size:42px;font-weight:900;color:${primaryColor};text-align:center;line-height:1.2;margin-bottom:12px;">
      Want 10,000+ MORE recipes like these?
    </div>

    <!-- Subtitle -->
    <div style="font-size:28px;font-weight:500;color:#555;text-align:center;margin-bottom:28px;">
      Using whatever random ingredients you have!
    </div>

    <!-- Download button -->
    <div style="background:${secondaryColor};color:${surfaceColor};font-size:34px;font-weight:800;padding:20px 48px;border-radius:50px;text-align:center;margin-bottom:16px;box-shadow:0 4px 16px rgba(0,0,0,0.15);">
      📱 Download ${escapeHtml(productName)} FREE
    </div>

    <!-- Small text -->
    <div style="font-size:24px;color:#777;text-align:center;margin-bottom:20px;">
      Link in bio → No credit card needed
    </div>

    <!-- Engagement question -->
    ${engagementLine ? `<div style="font-size:30px;font-weight:700;color:${primaryColor};text-align:center;">${escapeHtml(engagementLine)}</div>` : ""}
  </div>

  <!-- Slide dots -->
  <div style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:2;">
      ${dots}
  </div>
</body>
</html>`;
}
