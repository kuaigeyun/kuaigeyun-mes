/**
 * 模具使用记录页面
 *
 * 展示全量模具使用记录，支持新建使用记录。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker, ProFormDigit } from '@ant-design/pro-components';
import { App, Button, Tag, message, Modal } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { moldApi } from '../../../services/equipment';
import dayjs from 'dayjs';

interface MoldUsage {
  uuid?: string;
  usage_no?: string;
  mold_uuid?: string;
  mold_code?: string;
  mold_name?: string;
  source_type?: string;
  source_no?: string;
  usage_date?: string;
  usage_count?: number;
  operator_name?: string;
  status?: string;
  return_date?: string;
  remark?: string;
  created_at?: string;
}

const MoldUsagesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [moldOptions, setMoldOptions] = useState<{ label: string; value: string }[]>([]);

  React.useEffect(() => {
    moldApi.list({ limit: 500 }).then((res: any) => {
      setMoldOptions((res.items || []).map((m: any) => ({ label: `${m.code} - ${m.name}`, value: m.uuid })));
    }).catch(() => {});
  }, []);

  const handleCreate = () => {
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ usage_date: dayjs(), usage_count: 1, status: '使用中' });
  };

  const handleSubmit = async (values: any) => {
    try {
      await moldApi.createUsage({
        mold_uuid: values.mold_uuid,
        source_type: values.source_type,
        source_no: values.source_no,
        usage_date: values.usage_date?.format?.('YYYY-MM-DD HH:mm:ss') || values.usage_date,
        usage_count: values.usage_count ?? 1,
        operator_name: values.operator_name,
        status: values.status || '使用中',
        remark: values.remark,
      });
      messageApi.success('使用记录已保存');
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '保存失败');
      throw e;
    }
  };

  const columns: ProColumns<MoldUsage>[] = [
    { title: '使用单号', dataIndex: 'usage_no', width: 150, fixed: 'left', ellipsis: true },
    { title: '模具编码', dataIndex: 'mold_code', width: 120 },
    { title: '模具名称', dataIndex: 'mold_name', width: 180, ellipsis: true },
    { title: '使用日期', dataIndex: 'usage_date', valueType: 'dateTime', width: 170 },
    { title: '使用次数', dataIndex: 'usage_count', width: 100, align: 'right' },
    { title: '来源类型', dataIndex: 'source_type', width: 100 },
    { title: '来源单号', dataIndex: 'source_no', width: 140 },
    { title: '操作人', dataIndex: 'operator_name', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, r) => {
        const color = r.status === '使用中' ? 'processing' : r.status === '已归还' ? 'success' : 'default';
        return <Tag color={color}>{r.status || '-'}</Tag>;
      },
    },
    { title: '备注', dataIndex: 'remark', ellipsis: true, hideInSearch: true },
  ];

  return (
    <ListPageTemplate>
      <UniTable<MoldUsage>
        actionRef={actionRef}
        rowKey="uuid"
        columns={columns}
        request={async (params) => {
          const res = await moldApi.listUsages({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            mold_uuid: params.mold_uuid,
            status: params.status,
            search: params.usage_no,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建使用记录
          </Button>,
        ]}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20 }}
      />

      <FormModalTemplate
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        title="新建模具使用记录"
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        onFinish={handleSubmit}
        grid
      >
        <ProFormSelect
          name="mold_uuid"
          label="模具"
          options={moldOptions}
          placeholder="请选择模具"
          rules={[{ required: true, message: '请选择模具' }]}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="usage_date"
          label="使用日期"
          fieldProps={{ showTime: true }}
          rules={[{ required: true, message: '请选择使用日期' }]}
          colProps={{ span: 12 }}
        />
        <ProFormDigit name="usage_count" label="使用次数" min={1} initialValue={1} colProps={{ span: 12 }} />
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { label: '使用中', value: '使用中' },
            { label: '已归还', value: '已归还' },
            { label: '已报废', value: '已报废' },
          ]}
          colProps={{ span: 12 }}
        />
        <ProFormText name="source_type" label="来源类型" placeholder="如：工单" colProps={{ span: 12 }} />
        <ProFormText name="source_no" label="来源单号" colProps={{ span: 12 }} />
        <ProFormText name="operator_name" label="操作人" colProps={{ span: 12 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default MoldUsagesPage;
