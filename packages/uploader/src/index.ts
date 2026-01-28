import fs from "node:fs";
import type { IngestRequest } from "@wapmetrics/schemas";

export type UploadOptions = IngestRequest & {
  token: string;
  apiUrl: string;
  bundlePath: string;
};

export async function uploadArtifact(opts: UploadOptions) {
  const { token, apiUrl, bundlePath, ...metadata } = opts;

  if (!fs.existsSync(bundlePath)) {
    throw new Error(`Bundle not found at ${bundlePath}`);
  }

  const formData = new FormData();

  // Read file into a Blob-like object for fetch
  // In Node 20, we can use fs.openAsBlob or just read buffer and create Blob
  // But standard fetch body takes Buffer too in some impls, or Blob.
  // Node 18+ fetch global support.

  // Correct way for Node 18/20 built-in fetch with FormData:
  const fileBuffer = fs.readFileSync(bundlePath);
  const fileBlob = new Blob([fileBuffer]);

  formData.append("bundle", fileBlob, "wapmetrics-run.tgz");

  // Append metadata
  formData.append("owner", metadata.owner);
  formData.append("repo", metadata.repo);
  formData.append("sha", metadata.sha);
  if (metadata.pr) {
    formData.append("pr", String(metadata.pr));
  }

  const response = await fetch(`${apiUrl}/ingest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // Content-Type is set automatically by fetch with FormData
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Upload failed: ${response.status} ${response.statusText}\n${text}`,
    );
  }

  return await response.json();
}
