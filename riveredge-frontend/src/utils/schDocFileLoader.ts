/**
 * Altium .SchDoc 解析（浏览器端 altium-toolkit）
 */

import { Parser, SchematicSvgRenderer } from 'altium-toolkit';
import { fetchCoreFileBytes } from './fetchCoreFileBytes';
import { yieldToMain } from './yieldToMain';

export type SchDocParseResult = {
  svg: string;
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function resolveFileName(fileName: string | undefined, extFallback: string): string {
  const trimmed = (fileName || '').trim();
  if (!trimmed) return `drawing.${extFallback}`;
  if (new RegExp(`\\.${extFallback}$`, 'i').test(trimmed)) return trimmed;
  return `${trimmed}.${extFallback}`;
}

export async function parseSchDocFromBuffer(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<SchDocParseResult> {
  const document = await Parser.parseAsync(
    { fileName: resolveFileName(fileName, 'schdoc'), data: buffer },
    { worker: false },
  );
  const svg = SchematicSvgRenderer.render(document);
  if (!svg?.trim()) {
    throw new Error('SchDoc produced empty drawing');
  }
  return { svg };
}

export async function parseSchDocFromUrl(
  fileUrl: string,
  fileName: string | undefined,
  fileUuid?: string,
): Promise<SchDocParseResult> {
  const bytes = await fetchCoreFileBytes({
    fileUrl,
    fileUuid,
    errorLabel: 'Schematic load failed',
  });
  await yieldToMain();
  return parseSchDocFromBuffer(toArrayBuffer(bytes), fileName || 'drawing.schdoc');
}

export async function parseSchDocFromUuid(
  fileUuid: string,
  fileName: string | undefined,
): Promise<SchDocParseResult> {
  const bytes = await fetchCoreFileBytes({
    fileUuid,
    errorLabel: 'Schematic load failed',
  });
  await yieldToMain();
  return parseSchDocFromBuffer(toArrayBuffer(bytes), fileName || 'drawing.schdoc');
}
