/**
 * 工装校准记录页面
 *
 * 展示全量工装校准记录，支持新建校准记录。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Button, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { toolApi } from '../../../services/equipment';
import dayjs from 'dayjs';

interface ToolCalibration {
  uuid?: string;
  tool_uuid?: string;
  tool_code?: string;
  tool_name?: string;
  calibration_date?: string;
  result?: string;
  certificate_no?: string;
  expiry_date?: string;
  calibration_org?: string;
  created_at?: string;
}

const ToolCalibrationsPage: React.FC = () => {
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
    formRef.current?.setFieldsValue({ calibration_date: dayjs(), result: '合格' });
  };

  const handleSubmit = async (values: any) => {
    try {
      await toolApi.recordCalibration({
        tool_uuid: values.tool_uuid,
        calibration_date: values.calibration_date?.format?.('YYYY-MM-DD') || values.calibration_date,
        result: values.result,
        certificate_no: values.certificate_no,
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD') || values.expiry_date,
        calibration_org: values.calibration_org,
        remark: values.remark,
      });
      messageApi.success('校准记录已保存');
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '保存失败');
      throw e;
    }
  };

  const columns: ProColumns<ToolCalibration>[] = [
    { title: '工装编码', dataIndex: 'tool_code', width: 120 },
    { title: '工装名称', dataIndex: 'tool_name', width: 180, ellipsis: true },
    { title: '校准日期', dataIndex: 'calibration_date', valueType: 'date', width: 120 },
    {
      title: '结果',
      dataIndex: 'result',
      width: 100,
      render: (_, r) => {
        const color = r.result === '合格' ? 'success' : r.result === '不合格' ? 'error' : 'warning';
        return <Tag color={color}>{r.result || '-'}</Tag>;
      },
    },
    { title: '证书编号', dataIndex: 'certificate_no', width: 140 },
    { title: '有效期至', dataIndex: 'expiry_date', valueType: 'date', width: 120 },
    { title: '校验机构', dataIndex: 'calibration_org', width: 140, hideInSearch: true },
  ];

  return (
    <ListPageTemplate>
      <UniTable<ToolCalibration>
        actionRef={actionRef}
        rowKey="uuid"
        columns={columns}
        request={async (params) => {
          const res = await toolApi.listAllCalibrations({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            tool_uuid: params.tool_uuid,
          });
          return { data: res.items || [], success: true, total: res.total || 0 };
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建校准记录
          </Button>,
        ]}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20 }}
      />

      <FormModalTemplate
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        title="新建工装校准记录"
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
        <ProFormDatePicker
          name="calibration_date"
          label="校准日期"
          rules={[{ required: true, message: '请选择校准日期' }]}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="result"
          label="结果"
          options={[
            { label: '合格', value: '合格' },
            { label: '不合格', value: '不合格' },
            { label: '准用', value: '准用' },
          ]}
          rules={[{ required: true, message: '请选择结果' }]}
          colProps={{ span: 12 }}
        />
        <ProFormText name="certificate_no" label="证书编号" colProps={{ span: 12 }} />
        <ProFormDatePicker name="expiry_date" label="有效期至" colProps={{ span: 12 }} />
        <ProFormText name="calibration_org" label="校验机构" colProps={{ span: 12 }} />
        <ProFormText name="remark" label="备注" colProps={{ span: 24 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ToolCalibrationsPage;
