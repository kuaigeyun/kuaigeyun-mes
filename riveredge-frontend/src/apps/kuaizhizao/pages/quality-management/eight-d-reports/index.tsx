import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormDateTimePicker, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Empty, Space, Tag } from 'antd';
import { stackedPrimarySecondaryColumn } from '../components/qualityTableColumns';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { qualityImprovementApi, Quality8DReport } from '../../../services/quality-improvement';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { hasPermission } from '../../../../../utils/permission';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';

const statusTextMap: Record<string, string> = {
  d1_team: 'D1 组建团队',
  d2_problem: 'D2 问题描述',
  d3_containment: 'D3 临时遏制',
  d4_root_cause: 'D4 根因分析',
  d5_corrective_action: 'D5 纠正措施',
  d6_implement_result: 'D6 实施验证',
  d7_prevent_recurrence: 'D7 防再发',
  d8_team_congratulation: 'D8 总结',
  closed: '已关闭',
};

const EightDReportsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const actionRef = useRef<ActionType>(null);
  const createFormRef = useRef<any>(null);
  const transitionFormRef = useRef<any>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [transitionVisible, setTransitionVisible] = useState(false);
  const [currentRow, setCurrentRow] = useState<Quality8DReport | null>(null);
  const canCreate = hasPermission(currentUser ?? undefined, 'kuaizhizao:quality-management-eight-d-reports:create');
  const canUpdate = hasPermission(currentUser ?? undefined, 'kuaizhizao:quality-management-eight-d-reports:update');
  const canClose = hasPermission(currentUser ?? undefined, 'kuaizhizao:quality-management-eight-d-reports:close');

  const columns: ProColumns<Quality8DReport>[] = [
    {
      title: '8D编号',
      dataIndex: 'report_code',
      hideInTable: true,
    },
    stackedPrimarySecondaryColumn<Quality8DReport>(
      '标题 / 编号',
      'eightDStacked',
      ['title'],
      ['report_code', 'reportCode'],
      { dataIndex: 'title', fixed: 'left' },
    ),
    { title: '标题', dataIndex: 'title', hideInTable: true, ellipsis: true },
    {
      title: '阶段',
      dataIndex: 'status',
      width: 160,
      valueEnum: Object.fromEntries(Object.entries(statusTextMap).map(([k, v]) => [k, { text: v }])),
      render: (_, row) => <Tag color={row.status === 'closed' ? 'success' : 'processing'}>{statusTextMap[row.status] || row.status}</Tag>,
    },
    { title: '负责人', dataIndex: 'owner_name', width: 120 },
    { title: '计划完成', dataIndex: 'due_date', valueType: 'dateTime', width: 180 },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 180 },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      render: (_, row) => (
        <Space>
          {(canUpdate || canClose) && (
            <Button
              type="link"
              onClick={() => {
                setCurrentRow(row);
                setTransitionVisible(true);
                setTimeout(() => transitionFormRef.current?.setFieldsValue({ to_status: row.status }), 50);
              }}
            >
              推进阶段
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <PermissionGuard
      permission="kuaizhizao:quality-management-eight-d-reports:read"
      fallback={<Empty description="暂无8D查看权限" style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
        <UniTable<Quality8DReport>
          headerTitle="8D 管理"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.eight-d-reports"
          toolBarRender={() =>
            canCreate
              ? [
                  <Button key="create" type="primary" onClick={() => setCreateVisible(true)}>
                    新建8D
                  </Button>,
                ]
              : []
          }
          request={async (params) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const rows = await qualityImprovementApi.eightD.list({
              skip,
              limit: pageSize,
              status: params.status,
              owner_id: params.owner_id,
            });
            return {
              success: true,
              data: rows || [],
              total: rows.length < pageSize ? skip + rows.length : skip + rows.length + 1,
            };
          }}
        />

        <FormModalTemplate
          title="新建 8D 报告"
          open={createVisible}
          width={MODAL_CONFIG.LARGE_WIDTH}
          onClose={() => {
            setCreateVisible(false);
            createFormRef.current?.resetFields();
          }}
          formRef={createFormRef}
          onFinish={async (values) => {
            await qualityImprovementApi.eightD.create(values);
            messageApi.success('8D 报告已创建');
            setCreateVisible(false);
            actionRef.current?.reload();
          }}
        >
          <ProFormText name="title" label="标题" rules={[{ required: true }]} />
          <ProFormSelect
            name="severity"
            label="严重程度"
            valueEnum={{ minor: '轻微', major: '严重', critical: '紧急' }}
            initialValue="major"
          />
          <ProFormText name="owner_name" label="负责人" />
          <ProFormDateTimePicker name="due_date" label="计划完成日期" />
          <ProFormTextArea name="d2_problem" label="D2 问题描述" />
        </FormModalTemplate>

        <FormModalTemplate
          title={`推进 8D 阶段 - ${currentRow?.report_code || ''}`}
          open={transitionVisible}
          width={MODAL_CONFIG.LARGE_WIDTH}
          onClose={() => {
            setTransitionVisible(false);
            setCurrentRow(null);
            transitionFormRef.current?.resetFields();
          }}
          formRef={transitionFormRef}
          onFinish={async (values) => {
            if (!currentRow?.id) return;
            if (values.to_status === 'closed' && !canClose) {
              messageApi.error('无关闭权限');
              return false;
            }
            if (values.to_status !== 'closed' && !canUpdate) {
              messageApi.error('无更新权限');
              return false;
            }
            await qualityImprovementApi.eightD.transition(currentRow.id, values);
            messageApi.success('阶段已更新');
            setTransitionVisible(false);
            setCurrentRow(null);
            actionRef.current?.reload();
          }}
        >
          <ProFormSelect
            name="to_status"
            label="目标阶段"
            valueEnum={Object.fromEntries(Object.entries(statusTextMap).map(([k, v]) => [k, v]))}
            rules={[{ required: true }]}
          />
          <ProFormTextArea name="verification_result" label="验证结果" />
          <ProFormTextArea name="remarks" label="备注" />
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default EightDReportsPage;
