import React, { useCallback, useState } from 'react';
import { Button, Descriptions, Empty, Modal, Table } from 'antd';
import { App } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  DetailDrawerActions,
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  useDetailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import { rowActionKind } from '../../../../../components/uni-action';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { getAntdModal } from '../../../../../utils/antdAppApis';
export function renderIsActiveTag(t: TFunction, isActive?: boolean) {
  return (
    <MarkerTag color={isActive ? 'success' : 'default'}>
      {isActive ? t('common.enabled') : t('common.disabled')}
    </MarkerTag>
  );
}

export function buildIsActiveDescriptionColumn<T extends { is_active?: boolean }>(
  t: TFunction,
  titleKey: string = 'common.enabled',
): ProDescriptionsItemProps<T> {
  return {
    title: t(titleKey),
    dataIndex: 'is_active',
    render: (_, record) => renderIsActiveTag(t, record.is_active),
  };
}

type RowActionsParams<T extends { id?: number }> = {
  record: T;
  t: TFunction;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onDetail: (record: T) => void;
  onEdit: (record: T) => void;
  onDelete: (record: T) => void;
};

export function renderEquipmentMasterRowActions<T extends { id?: number }>({
  record,
  t,
  canRead,
  canUpdate,
  canDelete,
  onDetail,
  onEdit,
  onDelete,
}: RowActionsParams<T>): React.ReactNode[] {
  return [
    canRead ? (
      <Button key="detail" {...rowActionKind('read')} onClick={() => onDetail(record)}>
        {t('common.detail')}
      </Button>
    ) : null,
    canUpdate ? (
      <Button key="edit" {...rowActionKind('update')} onClick={() => onEdit(record)}>
        {t('common.edit')}
      </Button>
    ) : null,
    canDelete ? (
      <Button
        key="delete"
        {...rowActionKind('delete')}
        onClick={() => {
          getAntdModal().confirm({
            title: t('common.deleteTitle'),
            onOk: () => {
              if (record.id != null) {
                onDelete(record);
              }
            },
          });
        }}
      >
        {t('common.delete')}
      </Button>
    ) : null,
  ];
}

type EquipmentMasterDetailDrawerProps<T extends Record<string, unknown>> = {
  open: boolean;
  loading?: boolean;
  detail: T | null;
  title: string;
  onClose: () => void;
  basicColumns: ProDescriptionsItemProps<T>[];
  /** 基本信息区右侧附加内容（如模具码/设备码二维码） */
  basicExtra?: React.ReactNode;
  lines?: React.ReactNode;
  linesTitle?: string;
  extra?: React.ReactNode;
};

export function EquipmentMasterDetailDrawer<T extends Record<string, unknown>>({
  open,
  loading,
  detail,
  title,
  onClose,
  basicColumns,
  basicExtra,
  lines,
  linesTitle,
  extra,
}: EquipmentMasterDetailDrawerProps<T>) {
  const visibleBasicColumns = basicColumns.filter((col) => {
    const dataIndex = col.dataIndex;
    if (dataIndex !== 'description' && dataIndex !== 'requirement') return true;
    if (!detail || typeof dataIndex !== 'string') return true;
    const value = detail[dataIndex];
    return typeof value === 'string' && value.trim().length > 0;
  });
  const timeconfigBasicItems = useDetailDrawerDescriptionItems(visibleBasicColumns, detail);

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      loading={loading}
      onClose={onClose}
      size={DRAWER_CONFIG.STANDARD_WIDTH}
      extra={extra}
      basic={
        detail ? (
          <Descriptions
            column={2}
            size="small"
            items={timeconfigBasicItems}
          />
        ) : undefined
      }
      basicExtra={basicExtra}
      lines={lines}
      linesTitle={linesTitle}
    />
  );
}

export function MasterDataLinesTable<T extends Record<string, unknown>>({
  rows,
  columns,
  rowKey,
  emptyDescription,
}: {
  rows: T[];
  columns: ColumnsType<T>;
  rowKey: string | ((row: T) => string);
  emptyDescription: string;
}) {
  if (!rows.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />;
  }
  return (
    <Table<T>
      size="small"
      pagination={false}
      rowKey={rowKey}
      columns={columns}
      dataSource={rows}
      scroll={{ x: 'max-content' }}
    />
  );
}

export function buildDetailDrawerEditExtra(
  t: TFunction,
  visible: boolean,
  onEdit: () => void,
) {
  if (!visible) return null;

  return (
    <DetailDrawerActions
      items={[
        {
          key: 'edit',
          visible: true,
          render: () => (
            <Button {...rowActionKind('update')} size="small" onClick={onEdit}>
              {t('common.edit')}
            </Button>
          ),
        },
      ]}
    />
  );
}

/** 先开抽屉、清空记录、拉取详情；失败则关闭并提示 */
export function useEquipmentDetailDrawer<T extends Record<string, unknown>>() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<T | null>(null);

  const openDetail = useCallback(
    async (fetcher: () => Promise<T>, errorMessage?: string) => {
      setOpen(true);
      setLoading(true);
      setDetail(null);
      try {
        const loaded = await fetcher();
        setDetail(loaded);
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, errorMessage ?? t('common.loadFailed')));
        setOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [message, t],
  );

  const closeDetail = useCallback(() => {
    setOpen(false);
    setDetail(null);
  }, []);

  return { open, loading, detail, setDetail, openDetail, closeDetail };
}
