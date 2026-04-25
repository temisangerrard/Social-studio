import assert from "node:assert/strict";
import test from "node:test";

import { resolveGenerationRouting } from "./generation-request.js";

test("legacy Studio UGC preset never re-enables inline UGC brief handling", () => {
  const result = resolveGenerationRouting({
    selectedStyleId: "ugc-voiceover-story",
    userPickedStyle: true,
    workflowType: "ugc-voiceover",
    routeDecision: {
      workflowType: "linkedin-text",
      contentTypeId: "linkedin-photo-post",
      deliveryTargets: "linkedin"
    },
    selectedContentTypeId: "linkedin-photo-post"
  });

  assert.equal(result.workflowType, "ugc-voiceover");
  assert.equal(result.includeUgcBrief, false);
  assert.deepEqual(result.routingOverride, {
    workflowType: "ugc-voiceover"
  });
});

test("non-UGC workflows still use the routed workflow", () => {
  const result = resolveGenerationRouting({
    selectedStyleId: "editorial-cultural-carousel",
    userPickedStyle: false,
    workflowType: "slideshow",
    routeDecision: {
      workflowType: "linkedin-text",
      contentTypeId: "linkedin-photo-post",
      deliveryTargets: "linkedin"
    },
    selectedContentTypeId: "linkedin-photo-post"
  });

  assert.equal(result.workflowType, "linkedin-text");
  assert.equal(result.includeUgcBrief, false);
  assert.equal(result.routingOverride, undefined);
});

test("manual style selection keeps the chosen workflow even when platform routing disagrees", () => {
  const result = resolveGenerationRouting({
    selectedStyleId: "editorial-cultural-carousel",
    userPickedStyle: true,
    workflowType: "slideshow",
    routeDecision: {
      workflowType: "linkedin-text",
      contentTypeId: "linkedin-photo-post",
      deliveryTargets: "linkedin"
    },
    selectedContentTypeId: "linkedin-photo-post"
  });

  assert.equal(result.workflowType, "slideshow");
  assert.deepEqual(result.routingOverride, {
    workflowType: "slideshow"
  });
  assert.equal(result.includeUgcBrief, false);
});
