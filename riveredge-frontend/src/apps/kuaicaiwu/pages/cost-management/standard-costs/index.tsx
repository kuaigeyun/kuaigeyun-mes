import { rowActionKind } from '../../../../../components/uni-action';
import React, { useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Popconfirm, Tag } from 'antd';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { standardCostService, type StandardCost } from '../../../services/cost/standard-cost';
import { formatCostItemType, formatTargetType } from '../../../utils/financeUiLabels';

const StandardCostsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<StandardCost | null>(null);

  const columns: ProColumns<StandardCost>[] = [
    { title: '核算对象', dataIndex: 'target_type', width: 100, render: (_, r) => formatTargetType(r.target_type) },
    { title: '对象编码', dataIndex: 'target_code', width: 120, ellipsis: true },
    { title: '对象名称', dataIndex: 'target_name', ellipsis: true },
    { title: '成本项目', dataIndex: 'cost_item_type', width: 100, render: (_, r) => formatCostItemType(r.cost_item_type) },
    { title: '标准值', dataIndex: 'standard_value', valueType: 'money', align: 'right' },
    { title: '单位', dataIndex: 'unit', width: 80 },
    { title: '版本', dataIndex: 'version', width: 80 },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      render: (_, r) => (r.is_active ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 120,
      render: (_, record) => [
        <a key="edit" onClick={() => { setEditing(record); setModalVisible(true); }}>编辑</a>,
        <Popconfirm {...rowActionKind('delete')}
          key="del"
          title="确认删除该标准成本？"
          onConfirm={async () => {
            await standardCostService.delete(record.id);
            messageApi.success('已删除');
            actionRef.current?.reload();
          }}
        >
          <a>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<StandardCost>
        actionRef={actionRef}
        rowKey="id"
        columnPersistenceId="apps.kuaicaiwu.pages.cost-management.standard-costs"
        columns={columns}
        request={async (params) => {
          const res = await standardCostService.list({
            skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
            limit: params.pageSize ?? 20,
            search: params.keyword as string | undefined,
          });
          return { data: res.items, success: true, total: res.total };
        }}
        showCreateButton
        createButtonText="新建标准成本"
        onCreate={() => { setEditing(null); setModalVisible(true); }}
      />

      <FormModalTemplate
        title={editing ? '编辑标准成本' : '新建标准成本'}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        onFinish={async (values) => {
          if (editing) {
            await standardCostService.update(editing.id, values);
            messageApi.success('更新成功');
          } else {
            await standardCostService.create(values);
            messageApi.success('创建成功');
          }
          setModalVisible(false);
          actionRef.current?.reload();
        }}
        initialValues={editing ?? { currency: 'CNY', version: '1.0', is_active: true }}
      >
        <ProFormSelect
          name="target_type"
          label="核算对象"
          rules={[{ required: true }]}
          options={[
            { label: '物料', value: 'material' },
            { label: '工作中心', value: 'work_center' },
            { label: '工位', value: 'work_station' },
          ]}
          disabled={!!editing}
        />
        <ProFormDigit name="target_id" label="对象内码" rules={[{ required: true }]} min={1} disabled={!!editing} tooltip="系统中物料、工作中心或工位的数字编号" />
        <ProFormText name="target_code" label="对象编码" />
        <ProFormText name="target_name" label="对象名称" />
        <ProFormSelect
          name="cost_item_type"
          label="成本项目"
          rules={[{ required: true }]}
          options={[
            { label: '材料', value: 'material' },
            { label: '人工', value: 'labor' },
            { label: '制造费用', value: 'overhead' },
          ]}
          disabled={!!editing}
        />
        <ProFormDigit name="standard_value" label="标准值" rules={[{ required: true }]} min={0} />
        <ProFormText name="unit" label="单位" />
        <ProFormText name="version" label="版本" />
        <ProFormDatePicker name="effective_date" label="生效日期" />
        <ProFormDatePicker name="expiry_date" label="失效日期" />
        <ProFormSwitch name="is_active" label="启用" />
        <ProFormTextArea name="description" label="描述" />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default StandardCostsPage;
