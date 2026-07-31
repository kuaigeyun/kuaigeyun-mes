/**
 * Altium .PcbDoc 解析（浏览器端 altium-toolkit）
 */

import { Parser, PcbSvgRenderer } from 'altium-toolkit';
import { fetchCoreFileBytes } from './fetchCoreFileBytes';
import { yieldToMain } from './yieldToMain';

export type PcbDocSide = 'top' | 'bottom';

export type PcbDocParseResult = {
  svg: string;
  side: PcbDocSide;
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function resolveFileName(fileName: string | undefined, extFallback: string): string {
  const trimmed = (fileName || '').trim();
  if (!trimmed) return `drawing.${extFallback}`;
  if (/\.pcbdoc$/i.test(trimmed)) return trimmed;
  return `${trimmed}.${extFallback}`;
}

export async function parsePcbDocFromBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  side: PcbDocSide = 'top',
): Promise<PcbDocParseResult> {
  const document = await Parser.parseAsync(
    { fileName: resolveFileName(fileName, 'pcbdoc'), data: buffer },
    { worker: false },
  );
  const svg = PcbSvgRenderer.render(document, { side });
  if (!svg?.trim()) {
    throw new Error('PcbDoc produced empty drawing');
  }
  return { svg, side };
}

export async function parsePcbDocFromUrl(
  fileUrl: string,
  fileName: string | undefined,
  fileUuid?: string,
  side: PcbDocSide = 'top',
): Promise<PcbDocParseResult> {
  const bytes = await fetchCoreFileBytes({
    fileUrl,
    fileUuid,
    errorLabel: 'PCB load failed',
  });
  await yieldToMain();
  return parsePcbDocFromBuffer(toArrayBuffer(bytes), fileName || 'drawing.pcbdoc', side);
}

export async function parsePcbDocFromUuid(
  fileUuid: string,
  fileName: string | undefined,
  side: PcbDocSide = 'top',
): Promise<PcbDocParseResult> {
  const bytes = await fetchCoreFileBytes({
    fileUuid,
    errorLabel: 'PCB load failed',
  });
  await yieldToMain();
  return parsePcbDocFromBuffer(toArrayBuffer(bytes), fileName || 'drawing.pcbdoc', side);
}
