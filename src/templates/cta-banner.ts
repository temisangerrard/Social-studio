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
  const textColor = brandVisual.textColor ?? "#1D1B19";
  const textSecondary = brandVisual.textSecondary ?? "#5C5450";

  const dots = Array.from({ length: slideCount }, (_, i) =>
    `<div style="width:8px;height:8px;border-radius:50%;background:${i === slide.slide_number - 1 ? primaryColor : 'rgba(137,53,22,0.25)'};"></div>`
  ).join("\n          ");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;width:1080px;height:1080px;overflow:hidden;font-family:${font};position:relative;background:${accentColor};">
  <!-- Card -->
  <div style="position:absolute;top:60px;left:60px;right:60px;bottom:60px;background:${surfaceColor};border-radius:40px;box-shadow:0 8px 40px rgba(0,0,0,0.06);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px;box-sizing:border-box;">
    <!-- Peppera wordmark -->
    <div style="font-size:18px;font-weight:700;color:${primaryColor};letter-spacing:0.15em;text-transform:uppercase;margin-bottom:48px;">Peppera</div>

    <!-- Headline -->
    <div style="font-size:48px;font-weight:800;color:${textColor};text-align:center;line-height:1.12;letter-spacing:-0.02em;margin-bottom:20px;">
      10,000+ more recipes<br/>from whatever you have
    </div>

    <!-- Subtitle -->
    <div style="font-size:26px;font-weight:500;color:${textSecondary};text-align:center;margin-bottom:44px;">
      Turn random ingredients into real meals
    </div>

    <!-- CTA pill -->
    <div style="background:${primaryColor};color:${surfaceColor};font-size:28px;font-weight:700;padding:22px 56px;border-radius:50px;text-align:center;margin-bottom:24px;">
      Try ${escapeHtml(productName)} free at peppera.co.uk
    </div>

    <!-- Small text -->
    <div style="font-size:18px;color:${textSecondary};text-align:center;margin-bottom:44px;">
      No credit card needed
    </div>

    <!-- Divider -->
    <div style="width:48px;height:3px;background:${primaryColor};border-radius:2px;margin-bottom:32px;"></div>

    <!-- Engagement -->
    <div style="font-size:24px;font-weight:600;color:${textColor};text-align:center;">
      Which recipe are you trying first?
    </div>
    <div style="font-size:20px;font-weight:500;color:${textSecondary};text-align:center;margin-top:8px;">
      Comment 1–5 below
    </div>
  </div>

  <!-- Dots -->
  <div style="position:absolute;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:8px;">
          ${dots}
  </div>
</body>
</html>`;
}
