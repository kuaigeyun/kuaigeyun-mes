import { rowActionKind } from '../../../components/uni-action';
/**
 * 报表列表（积木专业报表，历史入口；主入口为报表中心 ReportCenter）
 */
import React, { useRef } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../components/uni-table';
import { ListPageTemplate } from '../../../components/layout-templates';
import { UniLifecycle } from '../../../components/uni-lifecycle';
import { getReports } from '../services/kuaireport';
import { getPublishDraftLifecycle } from '../utils/publishLifecycle';
import { countWithPagedRequests } from '../../../utils/pagedCount';

interface ReportRow {
  id: number;
  name?: string;
  code?: string;
  report_type?: string;
  status?: string;
  updated_at?: string;
}

const ReportList: React.FC = () => {
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const { message: messageApi } = App.useApp();

  const columns: ProColumns<ReportRow>[] = [
    {
      title: '名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '编号',
      dataIndex: 'code',
      width: 160,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '引擎类型',
      dataIndex: 'report_type',
      width: 140,
      search: false,
      render: (t) => {
        const type = String(t ?? '');
        const config =
          {
            jimu: { color: 'blue', text: '专业报表 (Jimu)' },
          }[type] || { color: 'default', text: type };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
      width: 180,
      search: false,
    },
    {
      title: '当前阶段',
      dataIndex: 'lifecycle_stage',
      key: 'lifecycle',
      width: 200,
      fixed: 'right',
      align: 'left',
      search: false,
      render: (_, record) => (
        <UniLifecycle
          {...getPublishDraftLifecycle(record as unknown as Record<string, unknown>)}
          showCircleTooltip={false}
        />
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 180,
      render: (_, record) => {
        const nodes: React.ReactNode[] = [
          <Button {...rowActionKind('update')}
            key="design"
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`../jimu-designer?id=${record.id}`)}
          >
            设计
          </Button>,
          <Button {...rowActionKind('delete')} key="del" onClick={() => messageApi.info('功能开发中')}>
            删除
          </Button>,
        ];
        return nodes;
      },
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<ReportRow>
        headerTitle="报表管理"
        actionRef={actionRef}
        columnPersistenceId="apps.kuaireport.pages.ReportList"
        scroll={{ x: 'max-content' }}
        columns={columns}
        request={async (params) => {
          try {
            const skip = ((params.current ?? 1) - 1) * (params.pageSize ?? 20);
            const limit = params.pageSize ?? 20;
            const readList = async (query: { skip?: number; limit?: number }) => {
              const res = await getReports(query);
              const raw = res?.data ?? res;
              return Array.isArray(raw) ? raw : [];
            };
            const [data, total] = await Promise.all([
              readList({ skip, limit }),
              countWithPagedRequests(readList, {}, { chunkSize: 100 }),
            ]);
            return { data, success: true, total };
          } catch {
            messageApi.error('获取列表失败');
            return { data: [], success: false, total: 0 };
          }
        }}
        rowKey="id"
        toolBarActions={[
          <Button {...rowActionKind('create')} key="new" type="primary" onClick={() => navigate('../jimu-designer')}>
            新建专业报表
          </Button>,
        ]}
      />
      <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
        提示：积木报表适用于制作固定排版、精准分页打印的各种业务单据和明细汇总表。
      </Typography.Paragraph>
    </ListPageTemplate>
  );
};

export default ReportList;
