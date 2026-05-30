import React, { useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { glService, type ChartOfAccount } from '../../../services/gl';

const ChartOfAccountsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>();
  const [modalVisible, setModalVisible] = useState(false);

  const columns: ProColumns<ChartOfAccount>[] = [
    { title: '科目编码', dataIndex: 'account_code', width: 120 },
    { title: '科目名称', dataIndex: 'account_name', ellipsis: true },
    { title: '科目类型', dataIndex: 'account_type', width: 100 },
    { title: '余额方向', dataIndex: 'balance_direction', width: 90 },
    { title: '级次', dataIndex: 'level', width: 60 },
    {
      title: '末级',
      dataIndex: 'is_leaf',
      width: 60,
      render: (_, r) => (r.is_leaf ? '是' : '否'),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 80,
      render: (_, r) => (r.is_active ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
    },
  ];

  return (
    <ListPageTemplate
      title="会计科目"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          新建科目
        </Button>
      }
    >
      <UniTable<ChartOfAccount>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async () => {
          const list = await glService.listAccounts();
          return { data: list, success: true, total: list.length };
        }}
        search={false}
      />

      <FormModalTemplate
        title="新建会计科目"
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        onFinish={async (values) => {
          await glService.createAccount(values);
          messageApi.success('创建成功');
          setModalVisible(false);
          actionRef.current?.reload();
        }}
        initialValues={{ balance_direction: 'debit' }}
      >
        <ProFormText name="account_code" label="科目编码" rules={[{ required: true }]} />
        <ProFormText name="account_name" label="科目名称" rules={[{ required: true }]} />
        <ProFormSelect
          name="account_type"
          label="科目类型"
          rules={[{ required: true }]}
          options={[
            { label: '资产', value: 'asset' },
            { label: '负债', value: 'liability' },
            { label: '权益', value: 'equity' },
            { label: '成本', value: 'cost' },
            { label: '损益', value: 'profit_loss' },
          ]}
        />
        <ProFormSelect
          name="balance_direction"
          label="余额方向"
          options={[
            { label: '借', value: 'debit' },
            { label: '贷', value: 'credit' },
          ]}
        />
        <ProFormTextArea name="notes" label="备注" />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ChartOfAccountsPage;
