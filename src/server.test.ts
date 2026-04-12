import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { decodeDataUrl, resolvePublicAssetPath, sanitizeStoredFilename } from "./server.ts";

test("resolvePublicAssetPath serves public javascript modules", () => {
  const publicRoot = "/tmp/social-studio-public";
  const resolved = resolvePublicAssetPath("/app-helpers.js", publicRoot);
  assert.equal(resolved, path.join(publicRoot, "app-helpers.js"));
});

test("resolvePublicAssetPath blocks parent directory traversal", () => {
  const publicRoot = "/tmp/social-studio-public";
  assert.equal(resolvePublicAssetPath("/../secret.txt", publicRoot), null);
});

test("sanitizeStoredFilename strips unsafe path characters", () => {
  assert.equal(sanitizeStoredFilename("../Mascot Ref!!.png"), "mascot-ref.png");
});

test("decodeDataUrl parses mime type and payload", () => {
  const payload = Buffer.from("hello").toString("base64");
  const decoded = decodeDataUrl(`data:text/plain;base64,${payload}`);
  assert.equal(decoded.mimeType, "text/plain");
  assert.equal(decoded.buffer.toString("utf8"), "hello");
});
