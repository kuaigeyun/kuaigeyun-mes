/**
 * 备件需求管理页面
 * 
 * 提供备件需求的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { sparePartDemandApi } from '../../services/process';
import type { SparePartDemand, SparePartDemandCreate, SparePartDemandUpdate } from '../../types/process';

/**
 * 备件需求管理列表页面组件
 */
const SparePartDemandsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentDemandUuid, setCurrentDemandUuid] = useState<string | null>(null);
  const [demandDetail, setDemandDetail] = useState<SparePartDemand | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑备件需求）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建备件需求
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentDemandUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      demandDate: new Date().toISOString(),
    });
  };

  /**
   * 处理编辑备件需求
   */
  const handleEdit = async (record: SparePartDemand) => {
    try {
      setIsEdit(true);
      setCurrentDemandUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await sparePartDemandApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        demandNo: detail.demandNo,
        sourceType: detail.sourceType,
        sourceId: detail.sourceId,
        sourceNo: detail.sourceNo,
        materialId: detail.materialId,
        materialName: detail.materialName,
        materialCode: detail.materialCode,
        demandQuantity: detail.demandQuantity,
        demandDate: detail.demandDate,
        requiredDate: detail.requiredDate,
        applicantId: detail.applicantId,
        applicantName: detail.applicantName,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取备件需求详情失败');
    }
  };

  /**
   * 处理删除备件需求
   */
  const handleDelete = async (record: SparePartDemand) => {
    try {
      await sparePartDemandApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: SparePartDemand) => {
    try {
      setCurrentDemandUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await sparePartDemandApi.get(record.uuid);
      setDemandDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取备件需求详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: SparePartDemandCreate | SparePartDemandUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentDemandUuid) {
        await sparePartDemandApi.update(currentDemandUuid, values as SparePartDemandUpdate);
        messageApi.success('更新成功');
      } else {
        await sparePartDemandApi.create(values as SparePartDemandCreate);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<SparePartDemand>[] = [
    {
      title: '需求单编号',
      dataIndex: 'demandNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.demandNo}</a>
      ),
    },
    {
      title: '物料名称',
      dataIndex: 'materialName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '物料编码',
      dataIndex: 'materialCode',
      width: 120,
      ellipsis: true,
    },
    {
      title: '需求数量',
      dataIndex: 'demandQuantity',
      width: 100,
      sorter: true,
    },
    {
      title: '需求日期',
      dataIndex: 'demandDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '要求到货日期',
      dataIndex: 'requiredDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待审批': { text: <Tag color="blue">待审批</Tag> },
        '已审批': { text: <Tag color="green">已审批</Tag> },
        '已采购': { text: <Tag color="orange">已采购</Tag> },
        '已取消': { text: <Tag color="default">已取消</Tag> },
      },
    },
    {
      title: '申请人',
      dataIndex: 'applicantName',
      width: 100,
      ellipsis: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条备件需求吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <UniTable<SparePartDemand>
        headerTitle="备件需求管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await sparePartDemandApi.list({
            skip,
            limit: pageSize,
            ...rest,
          });
          return {
            data,
            success: true,
            total: data.length, // TODO: 后端需要返回总数
          };
        }}
        rowKey="uuid"
        search={{
          labelWidth: 'auto',
        }}
        toolBarRender={() => [
          <Button
            type="primary"
            key="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建备件需求
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑备件需求' : '新建备件需求'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <ProForm
          formRef={formRef}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: isEdit ? '更新' : '创建',
            },
            submitButtonProps: {
              loading: formLoading,
            },
          }}
        >
          <ProFormText
            name="demandNo"
            label="需求单编号"
            rules={[{ required: true, message: '请输入需求单编号' }]}
            placeholder="请输入需求单编号"
          />
          <ProFormSelect
            name="sourceType"
            label="来源类型"
            options={[
              { label: '维护计划', value: '维护计划' },
              { label: '故障处理', value: '故障处理' },
              { label: '其他', value: '其他' },
            ]}
            placeholder="请选择来源类型"
          />
          <ProFormDigit
            name="sourceId"
            label="来源ID"
            placeholder="请输入来源ID"
          />
          <ProFormText
            name="sourceNo"
            label="来源编号"
            placeholder="请输入来源编号"
          />
          <ProFormDigit
            name="materialId"
            label="物料ID"
            rules={[{ required: true, message: '请输入物料ID' }]}
            placeholder="请输入物料ID"
          />
          <ProFormText
            name="materialName"
            label="物料名称"
            rules={[{ required: true, message: '请输入物料名称' }]}
            placeholder="请输入物料名称"
          />
          <ProFormText
            name="materialCode"
            label="物料编码"
            placeholder="请输入物料编码"
          />
          <ProFormDigit
            name="demandQuantity"
            label="需求数量"
            rules={[{ required: true, message: '请输入需求数量' }]}
            placeholder="请输入需求数量"
            min={1}
          />
          <ProFormDatePicker
            name="demandDate"
            label="需求日期"
            rules={[{ required: true, message: '请选择需求日期' }]}
            placeholder="请选择需求日期"
          />
          <ProFormDatePicker
            name="requiredDate"
            label="要求到货日期"
            placeholder="请选择要求到货日期"
          />
          <ProFormDigit
            name="applicantId"
            label="申请人ID"
            placeholder="请输入申请人ID"
          />
          <ProFormText
            name="applicantName"
            label="申请人姓名"
            placeholder="请输入申请人姓名"
          />
          <ProFormTextArea
            name="remark"
            label="备注"
            placeholder="请输入备注信息"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="备件需求详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : demandDetail ? (
          <ProDescriptions<SparePartDemand>
            column={1}
            dataSource={demandDetail}
            columns={[
              { title: '需求单编号', dataIndex: 'demandNo' },
              { title: '来源类型', dataIndex: 'sourceType' },
              { title: '来源ID', dataIndex: 'sourceId' },
              { title: '来源编号', dataIndex: 'sourceNo' },
              { title: '物料ID', dataIndex: 'materialId' },
              { title: '物料名称', dataIndex: 'materialName' },
              { title: '物料编码', dataIndex: 'materialCode' },
              { title: '需求数量', dataIndex: 'demandQuantity' },
              { title: '需求日期', dataIndex: 'demandDate', valueType: 'dateTime' },
              { title: '要求到货日期', dataIndex: 'requiredDate', valueType: 'dateTime' },
              { title: '申请人', dataIndex: 'applicantName' },
              { title: '状态', dataIndex: 'status' },
              { title: '备注', dataIndex: 'remark' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default SparePartDemandsPage;

