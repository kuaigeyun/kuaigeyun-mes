import type { ProColumns } from '@ant-design/pro-components';

/**
 * 报表编码列：只出文本。报表禁止快捷复制（业务单据列表不要用本 helper）。
 */
export function copyableCodeColumn<T = Record<string, unknown>>(
  title: string,
  dataIndex: string,
  width?: number,
): ProColumns<T> {
  return {
    title,
    dataIndex,
    width,
    ellipsis: true,
  };
}
