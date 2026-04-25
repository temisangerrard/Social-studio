import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { deleteUploadedAssetFromIndex } from "./server.ts";
import type { UploadedAsset } from "./types.ts";

test("deleteUploadedAssetFromIndex removes index record and stored file", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "social-studio-uploads-"));
  const storedName = "hero-photo.jpg";
  const indexPath = path.join(root, "_index.json");
  const filePath = path.join(root, storedName);
  const asset: UploadedAsset = {
    id: "upload-1",
    filename: "hero photo.jpg",
    mimeType: "image/jpeg",
    url: `/api/uploads/${storedName}`
  };
  await fs.writeFile(filePath, "image-bytes", "utf8");
  await fs.writeFile(indexPath, JSON.stringify([asset], null, 2), "utf8");

  const result = await deleteUploadedAssetFromIndex(root, "upload-1");

  assert.equal(result.deleted, true);
  await assert.rejects(() => fs.stat(filePath), /ENOENT/);
  assert.deepEqual(JSON.parse(await fs.readFile(indexPath, "utf8")), []);
});

test("deleteUploadedAssetFromIndex reports missing ids without deleting other assets", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "social-studio-uploads-"));
  const asset: UploadedAsset = {
    id: "keep-me",
    filename: "keep.png",
    mimeType: "image/png",
    url: "/api/uploads/keep.png"
  };
  await fs.writeFile(path.join(root, "keep.png"), "image-bytes", "utf8");
  await fs.writeFile(path.join(root, "_index.json"), JSON.stringify([asset], null, 2), "utf8");

  const result = await deleteUploadedAssetFromIndex(root, "missing");

  assert.equal(result.deleted, false);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, "_index.json"), "utf8")), [asset]);
  assert.equal(await fs.readFile(path.join(root, "keep.png"), "utf8"), "image-bytes");
});
