// PDF generation using @react-pdf/renderer
// Server-only module

import React from "react";

/**
 * Render a React-PDF document to a Buffer.
 * Uses dynamic import to avoid bundling issues on the client.
 */
export async function renderPdfToBuffer(
  document: React.ReactElement
): Promise<Buffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const buffer = await renderToBuffer(document as any);
  return Buffer.from(buffer);
}
