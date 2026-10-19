import React from 'react';

export type ImportRowError = { row: number; error: string };

const MAX_LIST_ROWS = 50;

function groupErrorsByReason(errors: ImportRowError[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const item of errors) {
    const reason = String(item.error || '未知错误').trim() || '未知错误';
    const rows = map.get(reason) ?? [];
    rows.push(item.row);
    map.set(reason, rows);
  }
  return map;
}

function formatRowList(rows: number[]): string {
  const sorted = [...rows].sort((a, b) => a - b);
  if (sorted.length <= 8) {
    return sorted.map((r) => `第 ${r} 行`).join('、');
  }
  const head = sorted.slice(0, 6).map((r) => `第 ${r} 行`).join('、');
  return `${head} 等 ${sorted.length} 行`;
}

export function ImportResultModalContent(props: {
  successCount: number;
  failureCount: number;
  errors: ImportRowError[];
}) {
  const { successCount, failureCount, errors } = props;
  const grouped = groupErrorsByReason(errors);
  const singleReason = grouped.size === 1 ? [...grouped.keys()][0] : null;

  return (
    <div>
      <p>
        <strong>
          导入结果：成功 {successCount} 条，失败 {failureCount} 条
        </strong>
      </p>
      {failureCount > 0 ? (
        <div style={{ marginTop: 12, maxHeight: 360, overflow: 'auto' }}>
          {singleReason ? (
            <div>
              <p style={{ marginBottom: 8, color: 'rgba(0,0,0,0.65)' }}>
                失败原因（共 {failureCount} 条）：{singleReason}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(0,0,0,0.45)' }}>
                {formatRowList(errors.map((e) => e.row))}
              </p>
            </div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {errors.slice(0, MAX_LIST_ROWS).map((e) => (
                <li key={`${e.row}-${e.error}`} style={{ marginBottom: 6 }}>
                  第 {e.row} 行：{e.error}
                </li>
              ))}
              {errors.length > MAX_LIST_ROWS ? (
                <li style={{ color: 'rgba(0,0,0,0.45)' }}>
                  另有 {errors.length - MAX_LIST_ROWS} 条未列出，请修正后重新导入
                </li>
              ) : null}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
