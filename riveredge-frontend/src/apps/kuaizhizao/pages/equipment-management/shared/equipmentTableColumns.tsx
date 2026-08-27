/**
 * 设备运维 UniTable 列宽三桶共享构建（SystemFixed / ContentKeepWidth / RemainderFlex）。
 * 禁止为改宽另起 key；叠列身份沿用已有 rank 的 dataIndex。
 */

import type { ProColumns } from '@ant-design/pro-components';
import { UniTableStackedPrimaryCell } from '../../../../../components/uni-table/stackedPrimaryColumn';

type WidthMode = 'keep' | 'remainder';

function applyWidthMode<T extends object>(
  col: ProColumns<T>,
  mode: WidthMode,
  minWidth: number,
): ProColumns<T> {
  if (mode === 'remainder') {
    return {
      ...col,
      minWidth,
      uniTablePrimaryFlex: true,
      uniTableRemainderFlex: true,
      resizable: false,
      ellipsis: false,
    };
  }
  return {
    ...col,
    width: minWidth,
    minWidth,
    uniTableKeepWidth: true,
    resizable: false,
  };
}

/** ContentKeepWidth 文本列 */
export function buildKeepWidthColumn<T extends object>(
  title: string,
  dataIndex: string,
  options?: {
    width?: number;
    fixed?: 'left' | 'right';
    sorter?: boolean;
    hideInSearch?: boolean;
    searchOrder?: number;
    copyable?: boolean;
    ellipsis?: boolean;
    render?: ProColumns<T>['render'];
  },
): ProColumns<T> {
  const width = options?.width ?? 140;
  const col: ProColumns<T> = {
    title,
    dataIndex,
    fixed: options?.fixed,
    sorter: options?.sorter,
    hideInSearch: options?.hideInSearch,
    ellipsis: options?.ellipsis ?? true,
  };
  if (options?.searchOrder != null) {
    col.search = { order: options.searchOrder } as ProColumns['search'];
  }
  if (options?.render) {
    col.render = options.render;
  }
  return applyWidthMode(col, 'keep', width);
}

/**
 * 台账名称/编码叠列 = RemainderFlex。
 * 身份 dataIndex 固定为 `code`（GLOBAL rank 10），禁止另起 key。
 */
export function buildLedgerNameCodeRemainderColumn<T extends object>(
  title: string,
  options?: {
    fixed?: 'left' | 'right';
    minWidth?: number;
    sorter?: boolean;
    searchOrder?: number;
    nameKey?: string;
    codeKey?: string;
  },
): ProColumns<T> {
  const nameKey = options?.nameKey ?? 'name';
  const codeKey = options?.codeKey ?? 'code';
  const minWidth = options?.minWidth ?? 200;
  return applyWidthMode(
    {
      title,
      dataIndex: codeKey,
      fixed: options?.fixed ?? 'left',
      sorter: options?.sorter ?? true,
      search: options?.searchOrder != null ? ({ order: options.searchOrder } as ProColumns['search']) : undefined,
      render: (_, record) => {
        const row = record as Record<string, unknown>;
        return (
          <UniTableStackedPrimaryCell
            primary={String(row[nameKey] ?? '') || '-'}
            secondary={String(row[codeKey] ?? '') || '-'}
          />
        );
      },
    } as ProColumns<T>,
    'remainder',
    minWidth,
  );
}

/**
 * 单据资产名称/编码叠列 = RemainderFlex。
 * 身份用 nameDataIndex（如 equipment_name / mold_name），勿另起 key。
 */
export function buildDocAssetNameCodeRemainderColumn<T extends object>(
  title: string,
  options: {
    nameDataIndex: string;
    codeDataIndex: string;
    minWidth?: number;
    sorter?: boolean;
    fixed?: 'left' | 'right';
    hideInSearch?: boolean;
  },
): ProColumns<T> {
  const minWidth = options.minWidth ?? 200;
  return applyWidthMode(
    {
      title,
      dataIndex: options.nameDataIndex,
      fixed: options.fixed,
      sorter: options.sorter ?? true,
      hideInSearch: options.hideInSearch ?? true,
      render: (_, record) => {
        const row = record as Record<string, unknown>;
        return (
          <UniTableStackedPrimaryCell
            primary={String(row[options.nameDataIndex] ?? '') || '-'}
            secondary={String(row[options.codeDataIndex] ?? '') || '-'}
          />
        );
      },
    } as ProColumns<T>,
    'remainder',
    minWidth,
  );
}

/** 单字段不确定文本 = RemainderFlex（故障描述 / 要求 / 方案说明等） */
export function buildRemainderTextColumn<T extends object>(
  title: string,
  dataIndex: string,
  options?: {
    minWidth?: number;
    sorter?: boolean;
    hideInSearch?: boolean;
    fixed?: 'left' | 'right';
  },
): ProColumns<T> {
  const minWidth = options?.minWidth ?? 160;
  return applyWidthMode(
    {
      title,
      dataIndex,
      sorter: options?.sorter ?? true,
      hideInSearch: options?.hideInSearch ?? true,
      fixed: options?.fixed,
    } as ProColumns<T>,
    'remainder',
    minWidth,
  );
}
