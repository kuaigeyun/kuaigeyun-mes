/**
 * 报工同步历史弹窗（只读）
 *
 * P2-2 裁定：前端仅 pull 展示同步运行历史，
 * 数据来自只读接口 GET /reporting/sync-history（SyncRunLog）。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Table, Tag, Space, Typography, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import {
  getReportingSyncHistory,
  type ReportingSyncHistoryItem,
} from '../../../services/reporting';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';

interface ReportingSyncHistoryModalProps {
  open: boolean;
  onClose: () => void;
}

const DEFAULT_PAGE_SIZE = 10;

const STATUS_TAG_COLOR: Record<string, string> = {
  success: 'green',
  partial: 'orange',
  failed: 'red',
};

export const ReportingSyncHistoryModal: React.FC<ReportingSyncHistoryModalProps> = (props) => {
  const { open, onClose } = props;
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReportingSyncHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getReportingSyncHistory({
        skip: (page - 1) * pageSize,
        limit: pageSize,
      });
      setRows(result?.data ?? []);
      setTotal(result?.total ?? 0);
    } catch (error: any) {
      setLoadError(error?.message || t('app.kuaizhizao.workReporting.syncHistoryLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [open, page, pageSize, t]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ColumnsType<ReportingSyncHistoryItem> = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.workReporting.syncHistoryColStartedAt'),
        dataIndex: 'started_at',
        key: 'started_at',
        width: 170,
        render: (value?: string | null) =>
          value ? formatDateTimeBySiteSetting(value) : '-',
      },
      {
        title: t('app.kuaizhizao.workReporting.syncHistoryColMode'),
        dataIndex: 'mode',
        key: 'mode',
        width: 90,
        render: (value: string) =>
          value === 'incremental'
            ? t('app.kuaizhizao.workReporting.syncHistoryModeIncremental')
            : t('app.kuaizhizao.workReporting.syncHistoryModeFull'),
      },
      {
        title: t('app.kuaizhizao.workReporting.syncHistoryColStatus'),
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: (value: string) => (
          <Tag color={STATUS_TAG_COLOR[value] ?? 'default'}>
            {value === 'success'
              ? t('app.kuaizhizao.workReporting.syncHistoryStatusSuccess')
              : value === 'partial'
                ? t('app.kuaizhizao.workReporting.syncHistoryStatusPartial')
                : t('app.kuaizhizao.workReporting.syncHistoryStatusFailed')}
          </Tag>
        ),
      },
      {
        title: t('app.kuaizhizao.workReporting.syncHistoryColFetched'),
        dataIndex: 'fetched',
        key: 'fetched',
        width: 80,
        align: 'right',
        render: (value?: number) => (value && value > 0 ? value : '-'),
      },
      {
        title: t('app.kuaizhizao.workReporting.syncHistoryColCreated'),
        dataIndex: 'created',
        key: 'created',
        width: 80,
        align: 'right',
        render: (value?: number) => (value && value > 0 ? value : '-'),
      },
      {
        title: t('app.kuaizhizao.workReporting.syncHistoryColUpdated'),
        dataIndex: 'updated',
        key: 'updated',
        width: 80,
        align: 'right',
        render: (value?: number) => (value && value > 0 ? value : '-'),
      },
      {
        title: t('app.kuaizhizao.workReporting.syncHistoryColSkipped'),
        dataIndex: 'skipped',
        key: 'skipped',
        width: 80,
        align: 'right',
        render: (value?: number) => (value && value > 0 ? value : '-'),
      },
      {
        title: t('app.kuaizhizao.workReporting.syncHistoryColFailed'),
        dataIndex: 'failed',
        key: 'failed',
        width: 80,
        align: 'right',
        render: (value?: number) => (value && value > 0 ? value : '-'),
      },
      {
        title: t('app.kuaizhizao.workReporting.syncHistoryColDuration'),
        dataIndex: 'duration_ms',
        key: 'duration_ms',
        width: 90,
        align: 'right',
        render: (value?: number) => {
          if (!value || value <= 0) return '-';
          if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
          return `${value}ms`;
        },
      },
      {
        title: t('app.kuaizhizao.workReporting.syncHistoryColError'),
        dataIndex: 'error_summary',
        key: 'error_summary',
        ellipsis: true,
        render: (value?: string | null) => {
          if (!value) return '-';
          const text = value.length > 80 ? `${value.slice(0, 80)}…` : value;
          return (
            <Tooltip title={value}>
              <Typography.Text type="danger" style={{ fontSize: 12 }}>
                {text}
              </Typography.Text>
            </Tooltip>
          );
        },
      },
    ],
    [t],
  );

  return (
    <Modal
      title={t('app.kuaizhizao.workReporting.syncHistoryTitle')}
      open={open}
      onCancel={onClose}
      footer={null}
      width={1100}
      destroyOnClose={false}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {loadError ? (
          <Typography.Text type="danger">{loadError}</Typography.Text>
        ) : null}
        <Table<ReportingSyncHistoryItem>
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            },
          }}
        />
      </Space>
    </Modal>
  );
};

export default ReportingSyncHistoryModal;