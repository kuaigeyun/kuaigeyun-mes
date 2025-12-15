/**
 * 车辆调度管理页面
 * 
 * 提供车辆调度的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { vehicleDispatchApi } from '../../services/process';
import type { VehicleDispatch, VehicleDispatchCreate, VehicleDispatchUpdate } from '../../types/process';

/**
 * 车辆调度管理列表页面组件
 */
const VehicleDispatchesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentDispatchUuid, setCurrentDispatchUuid] = useState<string | null>(null);
  const [dispatchDetail, setDispatchDetail] = useState<VehicleDispatch | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑车辆调度）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建车辆调度
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentDispatchUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      dispatchType: '正常调度',
    });
  };

  /**
   * 处理编辑车辆调度
   */
  const handleEdit = async (record: VehicleDispatch) => {
    try {
      setIsEdit(true);
      setCurrentDispatchUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await vehicleDispatchApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        dispatchNo: detail.dispatchNo,
        vehicleId: detail.vehicleId,
        vehicleNo: detail.vehicleNo,
        driverId: detail.driverId,
        driverName: detail.driverName,
        planId: detail.planId,
        dispatchDate: detail.dispatchDate,
        dispatchType: detail.dispatchType,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取车辆调度详情失败');
    }
  };

  /**
   * 处理删除车辆调度
   */
  const handleDelete = async (record: VehicleDispatch) => {
    try {
      await vehicleDispatchApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: VehicleDispatch) => {
    try {
      setCurrentDispatchUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await vehicleDispatchApi.get(record.uuid);
      setDispatchDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取车辆调度详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: VehicleDispatchCreate | VehicleDispatchUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentDispatchUuid) {
        await vehicleDispatchApi.update(currentDispatchUuid, values as VehicleDispatchUpdate);
        messageApi.success('更新成功');
      } else {
        await vehicleDispatchApi.create(values as VehicleDispatchCreate);
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
  const columns: ProColumns<VehicleDispatch>[] = [
    {
      title: '调度单编号',
      dataIndex: 'dispatchNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.dispatchNo}</a>
      ),
    },
    {
      title: '车牌号',
      dataIndex: 'vehicleNo',
      width: 120,
      ellipsis: true,
    },
    {
      title: '司机姓名',
      dataIndex: 'driverName',
      width: 100,
      ellipsis: true,
    },
    {
      title: '调度日期',
      dataIndex: 'dispatchDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '调度类型',
      dataIndex: 'dispatchType',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '正常调度': { text: '正常调度' },
        '紧急调度': { text: '紧急调度' },
        '临时调度': { text: '临时调度' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待调度': { text: <Tag color="blue">待调度</Tag> },
        '已调度': { text: <Tag color="green">已调度</Tag> },
        '执行中': { text: <Tag color="orange">执行中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
        '已取消': { text: <Tag color="default">已取消</Tag> },
      },
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
            title="确定要删除这条车辆调度记录吗？"
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
      <UniTable<VehicleDispatch>
        headerTitle="车辆调度管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await vehicleDispatchApi.list({
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
            新建车辆调度
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑车辆调度' : '新建车辆调度'}
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
            name="dispatchNo"
            label="调度单编号"
            rules={[{ required: true, message: '请输入调度单编号' }]}
            placeholder="请输入调度单编号"
          />
          <ProFormDigit
            name="vehicleId"
            label="车辆ID"
            placeholder="请输入车辆ID"
          />
          <ProFormText
            name="vehicleNo"
            label="车牌号"
            placeholder="请输入车牌号"
          />
          <ProFormDigit
            name="driverId"
            label="司机ID"
            placeholder="请输入司机ID"
          />
          <ProFormText
            name="driverName"
            label="司机姓名"
            placeholder="请输入司机姓名"
          />
          <ProFormDigit
            name="planId"
            label="运输计划ID"
            placeholder="请输入运输计划ID（可选）"
          />
          <ProFormDatePicker
            name="dispatchDate"
            label="调度日期"
            placeholder="请选择调度日期"
          />
          <ProFormSelect
            name="dispatchType"
            label="调度类型"
            options={[
              { label: '正常调度', value: '正常调度' },
              { label: '紧急调度', value: '紧急调度' },
              { label: '临时调度', value: '临时调度' },
            ]}
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
        title="车辆调度详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : dispatchDetail ? (
          <ProDescriptions<VehicleDispatch>
            column={1}
            dataSource={dispatchDetail}
            columns={[
              { title: '调度单编号', dataIndex: 'dispatchNo' },
              { title: '车辆ID', dataIndex: 'vehicleId' },
              { title: '车牌号', dataIndex: 'vehicleNo' },
              { title: '司机ID', dataIndex: 'driverId' },
              { title: '司机姓名', dataIndex: 'driverName' },
              { title: '运输计划ID', dataIndex: 'planId' },
              { title: '调度日期', dataIndex: 'dispatchDate', valueType: 'dateTime' },
              { title: '调度类型', dataIndex: 'dispatchType' },
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

export default VehicleDispatchesPage;

