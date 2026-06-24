import React, { useMemo } from 'react';
import { useRequest } from 'ahooks';
import { Empty, Spin, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { formatDateTime } from '../../../../../utils/format';
import { getQualityReport, type QualityReportPayload } from '../../../services/haoligo';
import { QUALITY_REPORT_CONFIG, type QualityReportKey } from './qualityReportConfig';

type Props = {
  title: string;
  reportKey: QualityReportKey;
};

type DetailRow = NonNullable<QualityReportPayload['items']>[number] & { seq: number };

const nowrapCell = { style: { whiteSpace: 'nowrap' as const } };

const QualityReportPage: React.FC<Props> = ({ title, reportKey }) => {
  const config = QUALITY_REPORT_CONFIG[reportKey];
  const { data, loading } = useRequest(async () => getQualityReport(reportKey), { refreshDeps: [reportKey] });

  const columns = useMemo<ColumnsType<DetailRow>>(() => {
    const base: ColumnsType<DetailRow> = [
      { title: '序号', dataIndex: 'seq', width: 56, align: 'center', onCell: () => nowrapCell },
      { title: '单号', dataIndex: 'sheet_no', width: 220, onCell: () => nowrapCell },
      { title: '状态', dataIndex: 'status_label', width: 88, onCell: () => nowrapCell },
      {
        title: config.dimensionColumnTitle,
        dataIndex: 'dimension',
        width: 130,
        ellipsis: true,
        onCell: () => nowrapCell,
        render: (v) => v || '—',
      },
      {
        title: config.summaryColumnTitle,
        dataIndex: 'summary',
        width: 260,
        ellipsis: true,
        render: (v) => v || '—',
      },
      {
        title: '反馈时间',
        dataIndex: 'reported_at',
        width: 168,
        onCell: () => nowrapCell,
        render: (v) => (v ? formatDateTime(v) : '—'),
      },
      {
        title: '计划完成',
        dataIndex: 'due_at',
        width: 168,
        onCell: () => nowrapCell,
        render: (v) => (v ? formatDateTime(v) : '—'),
      },
      {
        title: '超期',
        dataIndex: 'is_overdue',
        width: 64,
        align: 'center',
        onCell: () => nowrapCell,
        render: (v) => (v ? '是' : '否'),
      },
    ];
    return base;
  }, [config.dimensionColumnTitle, config.summaryColumnTitle]);

  const rows = useMemo(
    () => (data?.items ?? []).map((row, index) => ({ ...row, seq: index + 1 })),
    [data?.items],
  );

  return (
    <ListPageTemplate>
      <Spin spinning={loading}>
        <Typography.Title level={5} style={{ textAlign: 'center', marginBottom: 4 }}>
          {title}
        </Typography.Title>
        <Typography.Paragraph style={{ textAlign: 'center', marginBottom: 12, color: '#666' }}>
          统计时间：{formatDateTime(dayjs())}
          {rows.length ? `　共 ${rows.length} 条` : ''}
        </Typography.Paragraph>
        {!rows.length && !loading ? (
          <Empty description="暂无数据" />
        ) : (
          <Table<DetailRow>
            bordered
            size="small"
            tableLayout="fixed"
            rowKey={(row) => `${row.sheet_no}-${row.seq}`}
            columns={columns}
            dataSource={rows}
            pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
            scroll={{ x: 1154 }}
          />
        )}
      </Spin>
    </ListPageTemplate>
  );
};

export default QualityReportPage;
