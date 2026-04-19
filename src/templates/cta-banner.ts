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
  const { slide, brandVisual, slideCount, productName } = input;
  const { primaryColor, secondaryColor, accentColor, surfaceColor } = brandVisual;
  const font = brandVisual.fontFamily ?? "'Avenir Next', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
  const textSecondary = brandVisual.textSecondary ?? "#5C5450";

  const textLines = (slide.text ?? "").split("\n").filter((l) => l.trim().length > 0);
  const engagementLine = textLines.find((l) => l.includes("?") || l.toLowerCase().includes("comment")) ?? "";

  const dots = Array.from({ length: slideCount }, (_, i) =>
    `<div style="width:10px;height:10px;border-radius:50%;background:${i === slide.slide_number - 1 ? primaryColor : secondaryColor};"></div>`
  ).join("\n          ");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;width:1080px;height:1080px;overflow:hidden;font-family:${font};position:relative;background:${accentColor};">
  <!-- Card -->
  <div style="position:absolute;top:60px;left:60px;right:60px;bottom:60px;background:${surfaceColor};border-radius:40px;box-shadow:0 8px 40px rgba(0,0,0,0.08);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:72px;box-sizing:border-box;">
    <!-- Emoji -->
    <div style="font-size:64px;margin-bottom:28px;">🌶️</div>

    <!-- Headline -->
    <div style="font-size:46px;font-weight:800;color:${primaryColor};text-align:center;line-height:1.15;letter-spacing:-0.02em;margin-bottom:16px;">
      Want 10,000+ MORE<br/>recipes like these?
    </div>

    <!-- Subtitle -->
    <div style="font-size:28px;font-weight:500;color:${textSecondary};text-align:center;margin-bottom:40px;">
      Using whatever random ingredients you have!
    </div>

    <!-- CTA pill button -->
    <div style="background:${primaryColor};color:${surfaceColor};font-size:32px;font-weight:700;padding:22px 52px;border-radius:50px;text-align:center;margin-bottom:20px;">
      📱 Download ${escapeHtml(productName)} FREE
    </div>

    <!-- Small text -->
    <div style="font-size:22px;color:${textSecondary};text-align:center;margin-bottom:36px;">
      Link in bio · No credit card needed
    </div>

    <!-- Divider -->
    <div style="width:60px;height:4px;background:${secondaryColor};border-radius:2px;margin-bottom:28px;"></div>

    <!-- Engagement -->
    ${engagementLine ? `<div style="font-size:28px;font-weight:700;color:${primaryColor};text-align:center;">${escapeHtml(engagementLine)}</div>` : ""}
  </div>

  <!-- Dots -->
  <div style="position:absolute;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:10px;">
          ${dots}
  </div>
</body>
</html>`;
}
