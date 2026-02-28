/**
 * 工装维保记录页面
 *
 * 展示全量工装维保记录，支持新建维保记录。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Button, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { toolApi } from '../../../services/equipment';
import dayjs from 'dayjs';

interface ToolMaintenance {
  uuid?: string;
  tool_uuid?: string;
  tool_code?: string;
  tool_name?: string;
  maintenance_type?: string;
  maintenance_date?: string;
  executor?: string;
  content?: string;
  result?: string;
  created_at?: string;
}

const ToolMaintenancesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [toolOptions, setToolOptions] = useState<{ label: string; value: string }[]>([]);

  React.useEffect(() => {
    toolApi.list({ limit: 500 }).then((res: any) => {
      setToolOptions((res.items || []).map((t: any) => ({ label: `${t.code} - ${t.name}`, value: t.uuid })));
    }).catch(() => {});
  }, []);

  const handleCreate = () => {
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ maintenance_date: dayjs(), result: '完成' });
  };

  const handleSubmit = async (values: any) => {
    try {
      await toolApi.recordMaintenance({
        tool_uuid: values.tool_uuid,
        maintenance_type: values.maintenance_type,
        maintenance_date: values.maintenance_date?.format?.('YYYY-MM-DD') || values.maintenance_date,
        executor: values.executor,
        content: values.content,
        result: values.result || '完成',
        remark: values.remark,
      });
      messageApi.success('维保记录已保存');
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '保存失败');
      throw e;
    }
  };

  const columns: ProColumns<ToolMaintenance>[] = [
    { title: '工装编码', dataIndex: 'tool_code', width: 120 },
    { title: '工装名称', dataIndex: 'tool_name', width: 180, ellipsis: true },
    { title: '维保类型', dataIndex: 'maintenance_type', width: 120 },
    { title: '维保日期', dataIndex: 'maintenance_date', valueType: 'date', width: 120 },
    { title: '执行人', dataIndex: 'executor', width: 100 },
    { title: '结果', dataIndex: 'result', width: 90 },
    { title: '维保内容', dataIndex: 'content', ellipsis: true, hideInSearch: true },
  ];

  return (
    <ListPageTemplate>
      <UniTable<ToolMaintenance>
        actionRef={actionRef}
        rowKey="uuid"
        columns={columns}
        request={async (params) => {
          const res = await toolApi.listAllMaintenances({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            tool_uuid: params.tool_uuid,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建维保记录
          </Button>,
        ]}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20 }}
      />

      <FormModalTemplate
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        title="新建工装维保记录"
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
        <ProFormSelect
          name="maintenance_type"
          label="维保类型"
          options={[
            { label: '日常保养', value: '日常保养' },
            { label: '定期保养', value: '定期保养' },
            { label: '故障维修', value: '故障维修' },
          ]}
          rules={[{ required: true, message: '请选择维保类型' }]}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="maintenance_date"
          label="维保日期"
          rules={[{ required: true, message: '请选择维保日期' }]}
          colProps={{ span: 12 }}
        />
        <ProFormText name="executor" label="执行人" colProps={{ span: 12 }} />
        <ProFormSelect
          name="result"
          label="结果"
          options={[
            { label: '完成', value: '完成' },
            { label: '待跟进', value: '待跟进' },
          ]}
          colProps={{ span: 12 }}
        />
        <ProFormText name="content" label="维保内容" colProps={{ span: 24 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ToolMaintenancesPage;
