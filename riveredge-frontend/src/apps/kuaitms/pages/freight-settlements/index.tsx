/**
 * 运费结算管理页面
 * 
 * 提供运费结算的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker, ProFormMoney } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { freightSettlementApi } from '../../services/process';
import type { FreightSettlement, FreightSettlementCreate, FreightSettlementUpdate } from '../../types/process';

/**
 * 运费结算管理列表页面组件
 */
const FreightSettlementsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSettlementUuid, setCurrentSettlementUuid] = useState<string | null>(null);
  const [settlementDetail, setSettlementDetail] = useState<FreightSettlement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑运费结算）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建运费结算
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentSettlementUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      settlementStatus: '待结算',
    });
  };

  /**
   * 处理编辑运费结算
   */
  const handleEdit = async (record: FreightSettlement) => {
    try {
      setIsEdit(true);
      setCurrentSettlementUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await freightSettlementApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        settlementNo: detail.settlementNo,
        executionId: detail.executionId,
        vehicleId: detail.vehicleId,
        vehicleNo: detail.vehicleNo,
        driverId: detail.driverId,
        driverName: detail.driverName,
        distance: detail.distance,
        freightAmount: detail.freightAmount,
        calculationRule: detail.calculationRule,
        settlementDate: detail.settlementDate,
        settlementStatus: detail.settlementStatus,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取运费结算详情失败');
    }
  };

  /**
   * 处理删除运费结算
   */
  const handleDelete = async (record: FreightSettlement) => {
    try {
      await freightSettlementApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: FreightSettlement) => {
    try {
      setCurrentSettlementUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await freightSettlementApi.get(record.uuid);
      setSettlementDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取运费结算详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: FreightSettlementCreate | FreightSettlementUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentSettlementUuid) {
        await freightSettlementApi.update(currentSettlementUuid, values as FreightSettlementUpdate);
        messageApi.success('更新成功');
      } else {
        await freightSettlementApi.create(values as FreightSettlementCreate);
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
  const columns: ProColumns<FreightSettlement>[] = [
    {
      title: '结算单编号',
      dataIndex: 'settlementNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.settlementNo}</a>
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
      title: '运输距离（公里）',
      dataIndex: 'distance',
      width: 120,
      sorter: true,
    },
    {
      title: '运费金额',
      dataIndex: 'freightAmount',
      width: 100,
      valueType: 'money',
      sorter: true,
    },
    {
      title: '结算日期',
      dataIndex: 'settlementDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '结算状态',
      dataIndex: 'settlementStatus',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待结算': { text: <Tag color="blue">待结算</Tag> },
        '已结算': { text: <Tag color="green">已结算</Tag> },
        '已取消': { text: <Tag color="default">已取消</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '已确认': { text: <Tag color="green">已确认</Tag> },
        '已结算': { text: <Tag color="green">已结算</Tag> },
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
            title="确定要删除这条运费结算记录吗？"
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
      <UniTable<FreightSettlement>
        headerTitle="运费结算管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await freightSettlementApi.list({
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
            新建运费结算
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑运费结算' : '新建运费结算'}
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
            name="settlementNo"
            label="结算单编号"
            rules={[{ required: true, message: '请输入结算单编号' }]}
            placeholder="请输入结算单编号"
          />
          <ProFormDigit
            name="executionId"
            label="运输执行ID"
            placeholder="请输入运输执行ID（可选）"
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
            name="distance"
            label="运输距离（公里）"
            placeholder="请输入运输距离"
            min={0}
          />
          <ProFormMoney
            name="freightAmount"
            label="运费金额"
            placeholder="请输入运费金额"
          />
          <ProFormDatePicker
            name="settlementDate"
            label="结算日期"
            placeholder="请选择结算日期"
          />
          <ProFormSelect
            name="settlementStatus"
            label="结算状态"
            options={[
              { label: '待结算', value: '待结算' },
              { label: '已结算', value: '已结算' },
              { label: '已取消', value: '已取消' },
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
        title="运费结算详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : settlementDetail ? (
          <ProDescriptions<FreightSettlement>
            column={1}
            dataSource={settlementDetail}
            columns={[
              { title: '结算单编号', dataIndex: 'settlementNo' },
              { title: '运输执行ID', dataIndex: 'executionId' },
              { title: '车辆ID', dataIndex: 'vehicleId' },
              { title: '车牌号', dataIndex: 'vehicleNo' },
              { title: '司机ID', dataIndex: 'driverId' },
              { title: '司机姓名', dataIndex: 'driverName' },
              { title: '运输距离（公里）', dataIndex: 'distance' },
              { title: '运费金额', dataIndex: 'freightAmount', valueType: 'money' },
              { title: '结算日期', dataIndex: 'settlementDate', valueType: 'dateTime' },
              { title: '结算状态', dataIndex: 'settlementStatus' },
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

export default FreightSettlementsPage;

