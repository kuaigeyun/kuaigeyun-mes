/**
 * 工装台账页面
 *
 * 提供工装的 CRUD 功能，包括列表展示、创建、编辑等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { toolApi } from '../../../services/equipment';
import dayjs from 'dayjs';

interface Tool {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  code?: string;
  name?: string;
  type?: string;
  spec?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  warranty_expiry?: string;
  status?: string;
  is_active?: boolean;
  maintenance_period?: number;
  needs_calibration?: boolean;
  calibration_period?: number;
  total_usage_count?: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

const ToolLedgerPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool | null>(null);
  const formRef = useRef<any>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [toolDetail, setToolDetail] = useState<Tool | null>(null);

  const handleCreate = () => {
    setIsEdit(false);
    setCurrentTool(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  const handleEdit = async (record: Tool) => {
    try {
      if (!record.uuid) {
        messageApi.error('工装UUID不存在');
        return;
      }
      const detail = await toolApi.get(record.uuid);
      setIsEdit(true);
      setCurrentTool(detail);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          type: detail.type,
          spec: detail.spec,
          manufacturer: detail.manufacturer,
          supplier: detail.supplier,
          purchase_date: detail.purchase_date ? dayjs(detail.purchase_date) : null,
          warranty_expiry: detail.warranty_expiry ? dayjs(detail.warranty_expiry) : null,
          status: detail.status,
          is_active: detail.is_active,
          maintenance_period: detail.maintenance_period,
          needs_calibration: detail.needs_calibration,
          calibration_period: detail.calibration_period,
          description: detail.description,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取工装详情失败');
    }
  };

  const handleDetail = async (record: Tool) => {
    try {
      if (!record.uuid) {
        messageApi.error('工装UUID不存在');
        return;
      }
      const detail = await toolApi.get(record.uuid);
      setToolDetail(detail);
      setDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取工装详情失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const data = {
        ...values,
        purchase_date: values.purchase_date?.format?.('YYYY-MM-DD') || values.purchase_date,
        warranty_expiry: values.warranty_expiry?.format?.('YYYY-MM-DD') || values.warranty_expiry,
      };
      if (isEdit && currentTool?.uuid) {
        await toolApi.update(currentTool.uuid, data);
        messageApi.success('工装更新成功');
      } else {
        await toolApi.create(data);
        messageApi.success('工装创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  const detailColumns: ProDescriptionsItemType<Tool>[] = [
    { title: '工装编码', dataIndex: 'code' },
    { title: '工装名称', dataIndex: 'name' },
    { title: '工装类型', dataIndex: 'type' },
    { title: '规格型号', dataIndex: 'spec' },
    { title: '制造商', dataIndex: 'manufacturer' },
    { title: '供应商', dataIndex: 'supplier' },
    { title: '采购日期', dataIndex: 'purchase_date', valueType: 'date' },
    { title: '保修到期日', dataIndex: 'warranty_expiry', valueType: 'date' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '正常': { text: '正常', color: 'success' },
          '领用中': { text: '领用中', color: 'processing' },
          '维修中': { text: '维修中', color: 'warning' },
          '校验中': { text: '校验中', color: 'warning' },
          '停用': { text: '停用', color: 'default' },
          '报废': { text: '报废', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    { title: '累计使用次数', dataIndex: 'total_usage_count' },
    { title: '描述', dataIndex: 'description' },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  const columns: ProColumns<Tool>[] = [
    { title: '工装编码', dataIndex: 'code', width: 140, ellipsis: true, fixed: 'left' },
    { title: '工装名称', dataIndex: 'name', width: 200, ellipsis: true },
    { title: '工装类型', dataIndex: 'type', width: 100 },
    { title: '规格型号', dataIndex: 'spec', width: 120, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '正常': { text: '正常', color: 'success' },
          '领用中': { text: '领用中', color: 'processing' },
          '维修中': { text: '维修中', color: 'warning' },
          '校验中': { text: '校验中', color: 'warning' },
          '停用': { text: '停用', color: 'default' },
          '报废': { text: '报废', color: 'error' },
        };
        const config = statusMap[status as string || ''] || { text: (status as string) || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    { title: '累计使用次数', dataIndex: 'total_usage_count', width: 110 },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => [
        <Button key="detail" type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>详情</Button>,
        <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>,
      ],
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Tool>
          headerTitle="工装台账"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await toolApi.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
              });
              return {
                data: response.items || [],
                success: true,
                total: response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取工装列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          toolBarRender={() => [
            <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建工装</Button>,
          ]}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={isEdit ? '编辑工装' : '新建工装'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentTool(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
      >
        <ProFormText name="code" label="工装编码" placeholder="留空自动生成" />
        <ProFormText name="name" label="工装名称" placeholder="请输入工装名称" rules={[{ required: true, message: '请输入工装名称' }]} />
        <ProFormSelect
          name="type"
          label="工装类型"
          placeholder="请选择工装类型"
          options={[
            { label: '夹具', value: '夹具' },
            { label: '治具', value: '治具' },
            { label: '检具', value: '检具' },
            { label: '刀具', value: '刀具' },
            { label: '其他', value: '其他' },
          ]}
        />
        <ProFormText name="spec" label="规格型号" placeholder="请输入规格型号" />
        <ProFormText name="manufacturer" label="制造商" placeholder="请输入制造商" />
        <ProFormText name="supplier" label="供应商" placeholder="请输入供应商" />
        <ProFormDatePicker name="purchase_date" label="采购日期" />
        <ProFormDatePicker name="warranty_expiry" label="保修到期日" />
        <ProFormSelect
          name="status"
          label="工装状态"
          placeholder="请选择状态"
          options={[
            { label: '正常', value: '正常' },
            { label: '领用中', value: '领用中' },
            { label: '维修中', value: '维修中' },
            { label: '校验中', value: '校验中' },
            { label: '停用', value: '停用' },
            { label: '报废', value: '报废' },
          ]}
        />
        <ProFormDigit name="maintenance_period" label="保养周期（天）" placeholder="请输入保养周期" />
        <ProFormDigit name="calibration_period" label="校验周期（天）" placeholder="请输入校验周期" />
        <ProFormTextArea name="description" label="备注" placeholder="请输入备注" fieldProps={{ rows: 2 }} />
      </FormModalTemplate>

      <DetailDrawerTemplate
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); setToolDetail(null); }}
        title={`工装详情 - ${toolDetail?.code || ''}`}
        columns={detailColumns}
        dataSource={toolDetail}
        width={DRAWER_CONFIG.DEFAULT_WIDTH}
      />
    </>
  );
};

export default ToolLedgerPage;
