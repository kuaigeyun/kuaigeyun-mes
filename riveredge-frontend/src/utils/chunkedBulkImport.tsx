/**
 * 分片批量导入：按 chunk 顺序调用后端 bulk API，避免上万条一次请求超时。
 * 与物料主数据 import（CHUNK=100 + /batch-create）同一路径。
 */
import React from 'react';
import { Progress } from 'antd';
import { getAntdMessage, getAntdModal } from './antdAppApis';
import type { BatchImportResult } from './batchOperations';

export const DEFAULT_IMPORT_CHUNK_SIZE = 100;

export interface ChunkBulkFailedItem {
  /** 相对本 chunk 的下标（从 0） */
  index: number;
  reason: string;
}

export interface ChunkBulkChunkResult {
  createdCount: number;
  failedItems?: ChunkBulkFailedItem[];
}

export interface ChunkedBulkImportConfig<T> {
  items: T[];
  /** 单次请求条数，默认 100（须 ≤ 后端 max_length） */
  chunkSize?: number;
  title?: string;
  /** 导入一整片；失败项 index 为片内下标 */
  importChunk: (chunk: T[], chunkOffset: number) => Promise<ChunkBulkChunkResult>;
  /** 将全局下标映射为用户可见行号（默认 index+1） */
  rowNumberForIndex?: (globalIndex: number, item: T) => number;
  onProgress?: (done: number, total: number, success: number, fail: number) => void;
  /** 是否弹出成功/部分失败结果（默认 true） */
  showResultModal?: boolean;
}

/**
 * 顺序分片调用 bulk API，展示进度。
 */
export async function importInChunks<T>(
  config: ChunkedBulkImportConfig<T>,
): Promise<BatchImportResult> {
  const {
    items,
    chunkSize = DEFAULT_IMPORT_CHUNK_SIZE,
    title = '正在导入数据',
    importChunk,
    rowNumberForIndex,
    onProgress,
    showResultModal = true,
  } = config;

  const result: BatchImportResult = {
    total: items.length,
    successCount: 0,
    failureCount: 0,
    errors: [],
    successItems: [],
    failureItems: [],
  };

  if (items.length === 0) {
    return result;
  }

  const size = Math.max(1, Math.min(200, Math.trunc(chunkSize) || DEFAULT_IMPORT_CHUNK_SIZE));
  const progressModal = getAntdModal().info({
    title,
    width: 600,
    content: (
      <div>
        <Progress percent={0} status="active" />
        <p style={{ marginTop: 16 }}>准备导入 {items.length} 条数据…</p>
      </div>
    ),
    okButtonProps: { style: { display: 'none' } },
  });

  try {
    for (let offset = 0; offset < items.length; offset += size) {
      const chunk = items.slice(offset, offset + size);
      const chunkRes = await importChunk(chunk, offset);
      const created = Math.max(0, Number(chunkRes.createdCount) || 0);
      result.successCount += created;

      const failed = chunkRes.failedItems ?? [];
      for (const f of failed) {
        const localIdx = Number(f.index);
        const globalIndex =
          Number.isFinite(localIdx) && localIdx >= 0 && localIdx < chunk.length
            ? offset + localIdx
            : offset;
        const item = items[globalIndex];
        const row =
          rowNumberForIndex?.(globalIndex, item) ??
          globalIndex + 1;
        result.failureCount += 1;
        result.errors.push({
          row,
          error: f.reason || '未知错误',
        });
        if (item !== undefined) {
          result.failureItems.push(item);
        }
      }

      // 后端可能只返回 createdCount、不列失败：用片长对齐
      const accounted = created + failed.length;
      if (accounted < chunk.length) {
        const missing = chunk.length - accounted;
        result.failureCount += missing;
        for (let i = accounted; i < chunk.length; i++) {
          const globalIndex = offset + i;
          result.errors.push({
            row: rowNumberForIndex?.(globalIndex, items[globalIndex]) ?? globalIndex + 1,
            error: '未返回创建结果',
          });
          result.failureItems.push(items[globalIndex]);
        }
      }

      const done = Math.min(offset + chunk.length, items.length);
      const percent = Math.round((done / items.length) * 100);
      progressModal.update({
        content: (
          <div>
            <Progress percent={percent} status="active" />
            <p style={{ marginTop: 16 }}>
              已处理 {done} / {items.length} 条…
            </p>
            <p style={{ marginTop: 8, color: '#52c41a' }}>
              成功：{result.successCount} 条 | 失败：{result.failureCount} 条
            </p>
          </div>
        ),
      });
      onProgress?.(done, items.length, result.successCount, result.failureCount);
    }
  } finally {
    progressModal.destroy();
  }

  if (showResultModal) {
    if (result.failureCount > 0) {
      getAntdModal().warning({
        title: `${title}（部分失败）`,
        width: 700,
        content: (
          <div>
            <p>
              <strong>
                导入结果：成功 {result.successCount} 条，失败 {result.failureCount} 条
              </strong>
            </p>
          </div>
        ),
      });
    } else if (result.successCount > 0) {
      getAntdMessage().success(`成功导入 ${result.successCount} 条数据`);
    }
  }

  return result;
}

/** UniImport 矩阵导入单次响应（snake / camel；errors 项 error 或 message） */
export interface ExcelMatrixImportChunkResponse {
  success_count?: number;
  failure_count?: number;
  successCount?: number;
  failureCount?: number;
  total?: number;
  errors?: Array<{ row?: number; error?: string; message?: string }>;
}

export interface ExcelMatrixImportResult {
  success_count: number;
  failure_count: number;
  errors: Array<{ row: number; error: string }>;
  total: number;
}

function isNonEmptyMatrixRow(row: unknown): boolean {
  if (!Array.isArray(row)) return false;
  return row.some((c) => c != null && String(c).trim() !== '');
}

function normalizeExcelMatrixChunkResult(res: unknown): {
  success: number;
  failure: number;
  errors: Array<{ row: number; error: string }>;
} {
  const r = (res ?? {}) as ExcelMatrixImportChunkResponse;
  const success = Math.max(0, Number(r.success_count ?? r.successCount) || 0);
  const failure = Math.max(0, Number(r.failure_count ?? r.failureCount) || 0);
  const raw = Array.isArray(r.errors) ? r.errors : [];
  const errors = raw.map((e) => ({
    row: Number(e?.row) || 0,
    error: String(e?.error ?? e?.message ?? '未知错误'),
  }));
  return { success, failure, errors };
}

/**
 * UniImport 二维矩阵分片导入：保留表头（及示例行），数据行按 chunk 顺序 POST，
 * 聚合 success_count / failure_count / errors，并按片偏移修正行号。
 * 不以片长强行补失败（质检等路径可能静默跳过已存在行）。
 */
export async function importExcelMatrixInChunks(config: {
  data: any[][];
  /** 默认 true：row0 表头、row1 示例、数据从 row2 起 */
  hasExampleRow?: boolean;
  chunkSize?: number;
  title?: string;
  importChunk: (matrix: any[][]) => Promise<unknown>;
  /** 默认 false：由调用方按业务展示结果 */
  showResultModal?: boolean;
}): Promise<ExcelMatrixImportResult> {
  const {
    data,
    hasExampleRow = true,
    chunkSize = DEFAULT_IMPORT_CHUNK_SIZE,
    title = '正在导入数据',
    importChunk,
    showResultModal = false,
  } = config;

  const aggregated: ExcelMatrixImportResult = {
    success_count: 0,
    failure_count: 0,
    errors: [],
    total: 0,
  };

  const header = data?.[0];
  if (!header || !Array.isArray(header)) {
    return aggregated;
  }

  const example = hasExampleRow && data.length > 1 ? data[1] : undefined;
  const dataStart = hasExampleRow ? 2 : 1;
  /** 与后端 idx+3 / enumerate(..., start=3) 一致 */
  const displayRowBase = hasExampleRow ? 3 : 2;
  const dataRows = (data.slice(dataStart) as any[][]).filter(isNonEmptyMatrixRow);

  if (dataRows.length === 0) {
    return aggregated;
  }

  const size = Math.max(1, Math.min(200, Math.trunc(chunkSize) || DEFAULT_IMPORT_CHUNK_SIZE));
  const progressModal = getAntdModal().info({
    title,
    width: 600,
    content: (
      <div>
        <Progress percent={0} status="active" />
        <p style={{ marginTop: 16 }}>准备导入 {dataRows.length} 条数据…</p>
      </div>
    ),
    okButtonProps: { style: { display: 'none' } },
  });

  try {
    for (let offset = 0; offset < dataRows.length; offset += size) {
      const chunk = dataRows.slice(offset, offset + size);
      const matrix: any[][] =
        example !== undefined ? [header, example, ...chunk] : [header, ...chunk];
      const normalized = normalizeExcelMatrixChunkResult(await importChunk(matrix));
      aggregated.success_count += normalized.success;
      aggregated.failure_count += normalized.failure;
      for (const e of normalized.errors) {
        const localDisplay = e.row > 0 ? e.row : displayRowBase;
        aggregated.errors.push({
          row: offset + localDisplay,
          error: e.error,
        });
      }

      const done = Math.min(offset + chunk.length, dataRows.length);
      const percent = Math.round((done / dataRows.length) * 100);
      progressModal.update({
        content: (
          <div>
            <Progress percent={percent} status="active" />
            <p style={{ marginTop: 16 }}>
              已处理 {done} / {dataRows.length} 条…
            </p>
            <p style={{ marginTop: 8, color: '#52c41a' }}>
              成功：{aggregated.success_count} 条 | 失败：{aggregated.failure_count} 条
            </p>
          </div>
        ),
      });
    }
  } finally {
    progressModal.destroy();
  }

  aggregated.total = aggregated.success_count + aggregated.failure_count;

  if (showResultModal) {
    if (aggregated.failure_count > 0) {
      getAntdModal().warning({
        title: `${title}（部分失败）`,
        width: 700,
        content: (
          <div>
            <p>
              <strong>
                导入结果：成功 {aggregated.success_count} 条，失败 {aggregated.failure_count} 条
              </strong>
            </p>
          </div>
        ),
      });
    } else if (aggregated.success_count > 0) {
      getAntdMessage().success(`成功导入 ${aggregated.success_count} 条数据`);
    }
  }

  return aggregated;
}

/**
 * 无后端 bulk 时的过渡：片内用受限并发逐条 create，片间顺序执行。
 * 仍比一次打出上万请求安全；有 bulk API 后应改用 importInChunks + bulk。
 */
export async function importInChunksViaPerItemCreate<T>(config: {
  items: T[];
  chunkSize?: number;
  concurrency?: number;
  title?: string;
  createOne: (item: T, globalIndex: number) => Promise<unknown>;
  rowNumberForIndex?: (globalIndex: number, item: T) => number;
  showResultModal?: boolean;
}): Promise<BatchImportResult> {
  const concurrency = Math.max(1, Math.min(8, config.concurrency ?? 4));
  return importInChunks({
    items: config.items,
    chunkSize: config.chunkSize ?? DEFAULT_IMPORT_CHUNK_SIZE,
    title: config.title,
    rowNumberForIndex: config.rowNumberForIndex,
    showResultModal: config.showResultModal,
    importChunk: async (chunk, chunkOffset) => {
      const failedItems: ChunkBulkFailedItem[] = [];
      let createdCount = 0;
      let next = 0;
      const workers = Array.from({ length: concurrency }, async () => {
        while (next < chunk.length) {
          const i = next;
          next += 1;
          try {
            await config.createOne(chunk[i], chunkOffset + i);
            createdCount += 1;
          } catch (error: unknown) {
            const err = error as { message?: string; detail?: string };
            failedItems.push({
              index: i,
              reason: err?.message || err?.detail || '未知错误',
            });
          }
        }
      });
      await Promise.all(workers);
      return { createdCount, failedItems };
    },
  });
}
