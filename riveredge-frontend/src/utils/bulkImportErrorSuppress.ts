/**
 * 分片/逐条导入时抑制 apiRequest 的全局 error toast，避免 N 条失败弹出 N 次「服务器内部错误」。
 * 失败原因由 chunkedBulkImport / batchOperations 的结果 Modal 统一展示。
 */
let suppressDepth = 0;

export function isBulkImportErrorToastSuppressed(): boolean {
  return suppressDepth > 0;
}

export function runWithBulkImportErrorSuppress<T>(fn: () => Promise<T>): Promise<T> {
  suppressDepth += 1;
  return fn().finally(() => {
    suppressDepth = Math.max(0, suppressDepth - 1);
  });
}
