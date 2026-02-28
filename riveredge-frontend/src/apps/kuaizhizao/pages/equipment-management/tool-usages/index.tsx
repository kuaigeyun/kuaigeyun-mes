/**
 * 工装领用归还页面
 *
 * 展示全量工装领用记录，支持领用、归还操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, message, Modal } from 'antd';
import { PlusOutlined, RollbackOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { toolApi } from '../../../services/equipment';
import dayjs from 'dayjs';

interface ToolUsage {
  uuid?: string;
  usage_no?: string;
  tool_uuid?: string;
  tool_code?: string;
  tool_name?: string;
  operator_name?: string;
  source_type?: string;
  source_no?: string;
  checkout_date?: string;
  checkin_date?: string;
  status?: string;
  remark?: string;
}

const ToolUsagesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [toolOptions, setToolOptions] = useState<{ label: string; value: string }[]>([]);

  React.useEffect(() => {
    toolApi.list({ limit: 500 }).then((res: any) => {
      const items = (res.items || []).filter((t: any) => t.status !== '领用中');
      setToolOptions(items.map((t: any) => ({ label: `${t.code} - ${t.name}`, value: t.uuid })));
    }).catch(() => {});
  }, []);

  const handleCheckout = () => {
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ checkout_date: dayjs() });
  };

  const handleCheckin = async (record: ToolUsage) => {
    if (record.status !== '使用中') {
      messageApi.warning('该记录已归还');
      return;
    }
    Modal.confirm({
      title: '确认归还',
      content: `确定要归还工装「${record.tool_code} - ${record.tool_name}」吗？`,
      onOk: async () => {
        try {
          await toolApi.checkin(record.uuid!);
          messageApi.success('归还成功');
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.message || '归还失败');
        }
      },
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      await toolApi.checkout({
        tool_uuid: values.tool_uuid,
        operator_name: values.operator_name,
        department_name: values.department_name,
        source_type: values.source_type,
        source_no: values.source_no,
        checkout_date: values.checkout_date?.format?.('YYYY-MM-DD HH:mm:ss') || values.checkout_date,
        remark: values.remark,
      });
      messageApi.success('领用成功');
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '领用失败');
      throw e;
    }
  };

  const columns: ProColumns<ToolUsage>[] = [
    { title: '领用单号', dataIndex: 'usage_no', width: 150, fixed: 'left', ellipsis: true },
    { title: '工装编码', dataIndex: 'tool_code', width: 120 },
    { title: '工装名称', dataIndex: 'tool_name', width: 180, ellipsis: true },
    { title: '领用时间', dataIndex: 'checkout_date', valueType: 'dateTime', width: 170 },
    { title: '归还时间', dataIndex: 'checkin_date', valueType: 'dateTime', width: 170 },
    { title: '操作人', dataIndex: 'operator_name', width: 100 },
    { title: '来源类型', dataIndex: 'source_type', width: 100 },
    { title: '来源单号', dataIndex: 'source_no', width: 140 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, r) => {
        const color = r.status === '使用中' ? 'processing' : 'success';
        return <Tag color={color}>{r.status || '-'}</Tag>;
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 100,
      fixed: 'right',
      render: (_, record) =>
        record.status === '使用中' ? (
          <Button type="link" size="small" icon={<RollbackOutlined />} onClick={() => handleCheckin(record)}>
            归还
          </Button>
        ) : null,
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<ToolUsage>
        actionRef={actionRef}
        rowKey="uuid"
        columns={columns}
        request={async (params) => {
          const res = await toolApi.listAllUsages({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            tool_uuid: params.tool_uuid,
            status: params.status,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        toolBarRender={() => [
          <Button key="checkout" type="primary" icon={<PlusOutlined />} onClick={handleCheckout}>
            新建领用
          </Button>,
        ]}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20 }}
      />

      <FormModalTemplate
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        title="工装领用"
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        onFinish={handleSubmit}
        grid
      >
        <ProFormSelect
          name="tool_uuid"
          label="工装"
          options={toolOptions}
          placeholder="请选择工装"
          rules={[{ required: true, message: '请选择工装' }]}
          colProps={{ span: 12 }}
        />
        <ProFormText name="operator_name" label="领用人" colProps={{ span: 12 }} />
        <ProFormText name="department_name" label="领用部门" colProps={{ span: 12 }} />
        <ProFormText name="source_type" label="来源类型" placeholder="如：工单" colProps={{ span: 12 }} />
        <ProFormText name="source_no" label="来源单号" colProps={{ span: 12 }} />
        <ProFormText name="remark" label="备注" colProps={{ span: 24 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ToolUsagesPage;
