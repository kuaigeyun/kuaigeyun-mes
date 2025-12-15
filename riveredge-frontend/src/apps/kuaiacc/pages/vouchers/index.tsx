/**
 * 凭证管理页面
 * 
 * 提供凭证的 CRUD 功能，按照中国财务规范：借贷记账法、凭证审核、过账。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormInstance, ProDescriptions, ProFormDigit } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, CheckOutlined, FileTextOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { voucherApi } from '../../services/process';
import type { Voucher, VoucherCreate, VoucherUpdate } from '../../types/process';

/**
 * 凭证管理列表页面组件
 */
const VouchersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentVoucherUuid, setCurrentVoucherUuid] = useState<string | null>(null);
  const [voucherDetail, setVoucherDetail] = useState<Voucher | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑凭证）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建凭证
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentVoucherUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      voucherType: '记账凭证',
      status: '草稿',
      attachmentCount: 0,
      totalDebit: 0,
      totalCredit: 0,
    });
  };

  /**
   * 处理编辑凭证
   */
  const handleEdit = async (record: Voucher) => {
    try {
      if (record.status === '已过账') {
        messageApi.warning('已过账的凭证不能修改');
        return;
      }
      
      setIsEdit(true);
      setCurrentVoucherUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await voucherApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        voucherNo: detail.voucherNo,
        voucherDate: detail.voucherDate,
        voucherType: detail.voucherType,
        attachmentCount: detail.attachmentCount,
        summary: detail.summary,
        totalDebit: detail.totalDebit,
        totalCredit: detail.totalCredit,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取凭证详情失败');
    }
  };

  /**
   * 处理删除凭证
   */
  const handleDelete = async (record: Voucher) => {
    try {
      if (record.status === '已过账') {
        messageApi.warning('已过账的凭证不能删除');
        return;
      }
      
      await voucherApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理审核凭证
   */
  const handleReview = async (record: Voucher) => {
    try {
      if (record.status !== '草稿') {
        messageApi.warning('只有草稿状态的凭证才能审核');
        return;
      }
      
      if (!record.isBalanced) {
        messageApi.warning('凭证借贷不平衡，无法审核');
        return;
      }
      
      await voucherApi.review(record.uuid);
      messageApi.success('审核成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '审核失败');
    }
  };

  /**
   * 处理过账凭证
   */
  const handlePost = async (record: Voucher) => {
    try {
      if (record.status !== '已审核') {
        messageApi.warning('只有已审核状态的凭证才能过账');
        return;
      }
      
      await voucherApi.post(record.uuid);
      messageApi.success('过账成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '过账失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Voucher) => {
    try {
      setCurrentVoucherUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await voucherApi.get(record.uuid);
      setVoucherDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取凭证详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: VoucherCreate | VoucherUpdate) => {
    try {
      setFormLoading(true);
      
      // 检查借贷平衡
      if (values.totalDebit !== values.totalCredit) {
        messageApi.error('凭证借贷不平衡，借方合计必须等于贷方合计');
        return;
      }
      
      if (isEdit && currentVoucherUuid) {
        await voucherApi.update(currentVoucherUuid, values as VoucherUpdate);
        messageApi.success('更新成功');
      } else {
        await voucherApi.create({
          ...values as VoucherCreate,
          createdBy: 1, // TODO: 从用户上下文获取
        });
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
  const columns: ProColumns<Voucher>[] = [
    {
      title: '凭证编号',
      dataIndex: 'voucherNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.voucherNo}</a>
      ),
    },
    {
      title: '凭证日期',
      dataIndex: 'voucherDate',
      width: 120,
      valueType: 'date',
    },
    {
      title: '凭证类型',
      dataIndex: 'voucherType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '记账凭证': { text: '记账凭证' },
        '收款凭证': { text: '收款凭证' },
        '付款凭证': { text: '付款凭证' },
        '转账凭证': { text: '转账凭证' },
      },
    },
    {
      title: '借方合计',
      dataIndex: 'totalDebit',
      width: 120,
      valueType: 'money',
    },
    {
      title: '贷方合计',
      dataIndex: 'totalCredit',
      width: 120,
      valueType: 'money',
    },
    {
      title: '借贷平衡',
      dataIndex: 'isBalanced',
      width: 100,
      render: (_, record) => (
        record.isBalanced ? <Tag color="green">平衡</Tag> : <Tag color="red">不平衡</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '已审核': { text: <Tag color="blue">已审核</Tag> },
        '已过账': { text: <Tag color="green">已过账</Tag> },
        '已作废': { text: <Tag color="red">已作废</Tag> },
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.status === '草稿' && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleReview(record)}
            >
              审核
            </Button>
          )}
          {record.status === '已审核' && (
            <Button
              type="link"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => handlePost(record)}
            >
              过账
            </Button>
          )}
          {record.status !== '已过账' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              >
                编辑
              </Button>
              <Popconfirm
                title="确定要删除这条凭证吗？"
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
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <UniTable<Voucher>
        headerTitle="凭证管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await voucherApi.list({
            skip,
            limit: pageSize,
            ...rest,
          });
          return {
            data,
            success: true,
            total: data.length,
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
            新建凭证
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑凭证' : '新建凭证'}
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
            name="voucherNo"
            label="凭证编号"
            rules={[{ required: true, message: '请输入凭证编号' }]}
            placeholder="格式：记-001、收-001、付-001、转-001"
            disabled={isEdit}
          />
          <ProFormDatePicker
            name="voucherDate"
            label="凭证日期"
            rules={[{ required: true, message: '请选择凭证日期' }]}
          />
          <ProFormSelect
            name="voucherType"
            label="凭证类型"
            options={[
              { label: '记账凭证', value: '记账凭证' },
              { label: '收款凭证', value: '收款凭证' },
              { label: '付款凭证', value: '付款凭证' },
              { label: '转账凭证', value: '转账凭证' },
            ]}
            rules={[{ required: true, message: '请选择凭证类型' }]}
          />
          <ProFormDigit
            name="attachmentCount"
            label="附件数量"
            min={0}
            initialValue={0}
          />
          <ProFormText
            name="summary"
            label="摘要"
            placeholder="请输入摘要"
          />
          <ProFormDigit
            name="totalDebit"
            label="借方合计"
            rules={[{ required: true, message: '请输入借方合计' }]}
            min={0}
            fieldProps={{
              precision: 2,
            }}
          />
          <ProFormDigit
            name="totalCredit"
            label="贷方合计"
            rules={[
              { required: true, message: '请输入贷方合计' },
              ({ getFieldValue }) => ({
                validator: (_, value) => {
                  const debit = getFieldValue('totalDebit');
                  if (value !== debit) {
                    return Promise.reject(new Error('贷方合计必须等于借方合计'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
            min={0}
            fieldProps={{
              precision: 2,
            }}
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="凭证详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : voucherDetail ? (
          <ProDescriptions<Voucher>
            column={1}
            dataSource={voucherDetail}
            columns={[
              { title: '凭证编号', dataIndex: 'voucherNo' },
              { title: '凭证日期', dataIndex: 'voucherDate', valueType: 'dateTime' },
              { title: '凭证类型', dataIndex: 'voucherType' },
              { title: '附件数量', dataIndex: 'attachmentCount' },
              { title: '摘要', dataIndex: 'summary' },
              { title: '借方合计', dataIndex: 'totalDebit', valueType: 'money' },
              { title: '贷方合计', dataIndex: 'totalCredit', valueType: 'money' },
              { title: '借贷平衡', dataIndex: 'isBalanced', valueType: 'switch' },
              { title: '状态', dataIndex: 'status' },
              { title: '审核时间', dataIndex: 'reviewedAt', valueType: 'dateTime' },
              { title: '过账时间', dataIndex: 'postedAt', valueType: 'dateTime' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default VouchersPage;

