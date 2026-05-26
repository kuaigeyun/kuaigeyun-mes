import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormDigit, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Empty, Space, Tag } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { OQCInspection, qualityImprovementApi } from '../../../services/quality-improvement';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { hasPermission } from '../../../../../utils/permission';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';

const OQCInspectionPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const actionRef = useRef<ActionType>(null);
  const createFormRef = useRef<any>(null);
  const conductFormRef = useRef<any>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [conductVisible, setConductVisible] = useState(false);
  const [currentRow, setCurrentRow] = useState<OQCInspection | null>(null);
  const canCreate = hasPermission(currentUser ?? undefined, 'kuaizhizao:quality-management-oqc-inspection:create');
  const canUpdate = hasPermission(currentUser ?? undefined, 'kuaizhizao:quality-management-oqc-inspection:update');
  const canApprove = hasPermission(currentUser ?? undefined, 'kuaizhizao:quality-management-oqc-inspection:approve');

  const columns: ProColumns<OQCInspection>[] = [
    { title: '检验单号', dataIndex: 'inspection_code', width: 150 },
    { title: '来源单号', dataIndex: 'source_code', width: 150 },
    { title: '物料编码', dataIndex: 'material_code', width: 140 },
    { title: '物料名称', dataIndex: 'material_name', width: 180, ellipsis: true },
    { title: '检验数量', dataIndex: 'inspection_quantity', valueType: 'digit', width: 110 },
    { title: '不合格数量', dataIndex: 'unqualified_quantity', valueType: 'digit', width: 120 },
    {
      title: '放行结论',
      dataIndex: 'release_decision',
      width: 120,
      render: (_, row) => {
        const color = row.release_decision === 'released' ? 'success' : row.release_decision === 'rejected' ? 'error' : 'default';
        const text = row.release_decision === 'released' ? '放行' : row.release_decision === 'rejected' ? '拒绝放行' : '待判定';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    { title: '状态', dataIndex: 'status', width: 100 },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 180 },
    {
      title: '操作',
      valueType: 'option',
      width: 220,
      render: (_, row) => (
        <Space>
          {canUpdate && (
            <Button
              type="link"
              onClick={() => {
                setCurrentRow(row);
                setConductVisible(true);
                setTimeout(
                  () =>
                    conductFormRef.current?.setFieldsValue({
                      inspection_result: row.inspection_result || '合格',
                      quality_status: row.quality_status || '合格',
                      release_decision: row.release_decision || 'pending',
                      qualified_quantity: row.qualified_quantity,
                      unqualified_quantity: row.unqualified_quantity,
                    }),
                  50
                );
              }}
            >
              执行检验
            </Button>
          )}
          {canApprove && (
            <Button
              type="link"
              onClick={async () => {
                if (!row.id) return;
                await qualityImprovementApi.oqc.approve(row.id, true);
                messageApi.success('审核通过');
                actionRef.current?.reload();
              }}
            >
              审核通过
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <PermissionGuard
      permission="kuaizhizao:quality-management-oqc-inspection:read"
      fallback={<Empty description="暂无OQC查看权限" style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
        <UniTable<OQCInspection>
          headerTitle="OQC 出货检验"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.oqc-inspection"
          toolBarRender={() =>
            canCreate
              ? [
                  <Button key="create" type="primary" onClick={() => setCreateVisible(true)}>
                    新建OQC
                  </Button>,
                ]
              : []
          }
          request={async (params) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const result = await qualityImprovementApi.oqc.list({ skip, limit: pageSize, status: params.status });
            return {
              success: true,
              data: result?.items || [],
              total: result?.total || 0,
            };
          }}
        />

        <FormModalTemplate
          title="新建 OQC 检验单"
          open={createVisible}
          width={MODAL_CONFIG.LARGE_WIDTH}
          formRef={createFormRef}
          onClose={() => {
            setCreateVisible(false);
            createFormRef.current?.resetFields();
          }}
          onFinish={async (values) => {
            if (!canCreate) {
              messageApi.error('无新建权限');
              return false;
            }
            await qualityImprovementApi.oqc.create(values);
            messageApi.success('OQC 检验单已创建');
            setCreateVisible(false);
            actionRef.current?.reload();
          }}
        >
          <ProFormText name="source_code" label="来源单号" rules={[{ required: true }]} />
          <ProFormDigit name="source_id" label="来源单据ID" rules={[{ required: true }]} />
          <ProFormText name="material_code" label="物料编码" rules={[{ required: true }]} />
          <ProFormText name="material_name" label="物料名称" rules={[{ required: true }]} />
          <ProFormDigit name="material_id" label="物料ID" rules={[{ required: true }]} />
          <ProFormDigit name="inspection_quantity" label="检验数量" rules={[{ required: true }]} />
        </FormModalTemplate>

        <FormModalTemplate
          title={`执行 OQC 检验 - ${currentRow?.inspection_code || ''}`}
          open={conductVisible}
          width={MODAL_CONFIG.LARGE_WIDTH}
          formRef={conductFormRef}
          onClose={() => {
            setConductVisible(false);
            setCurrentRow(null);
            conductFormRef.current?.resetFields();
          }}
          onFinish={async (values) => {
            if (!currentRow?.id) return;
            if (!canUpdate) {
              messageApi.error('无执行检验权限');
              return false;
            }
            await qualityImprovementApi.oqc.conduct(currentRow.id, values);
            messageApi.success('检验执行成功');
            setConductVisible(false);
            setCurrentRow(null);
            actionRef.current?.reload();
          }}
        >
          <ProFormSelect
            name="inspection_result"
            label="检验结果"
            valueEnum={{ 合格: '合格', 不合格: '不合格', 部分合格: '部分合格' }}
            rules={[{ required: true }]}
          />
          <ProFormSelect name="quality_status" label="质量状态" valueEnum={{ 合格: '合格', 不合格: '不合格' }} rules={[{ required: true }]} />
          <ProFormDigit name="qualified_quantity" label="合格数量" rules={[{ required: true }]} />
          <ProFormDigit name="unqualified_quantity" label="不合格数量" rules={[{ required: true }]} />
          <ProFormSelect
            name="release_decision"
            label="放行结论"
            valueEnum={{ pending: '待判定', released: '放行', rejected: '拒绝放行' }}
            rules={[{ required: true }]}
          />
          <ProFormTextArea name="release_note" label="放行说明" />
          <ProFormTextArea name="notes" label="备注" />
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default OQCInspectionPage;
