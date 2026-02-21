/**
 * 客户新建/编辑弹窗（可复用）
 *
 * 供客户管理页、报价单/销售订单等页面的「快速新建客户」使用。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import { App } from 'antd';
import { FormModalTemplate } from '../../../components/layout-templates';
import { MODAL_CONFIG } from '../../../components/layout-templates/constants';
import { customerApi } from '../services/supply-chain';
import { testGenerateCode, generateCode } from '../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../utils/codeRulePage';
import type { Customer, CustomerCreate, CustomerUpdate } from '../types/supply-chain';

const PAGE_CODE = 'master-data-supply-chain-customer';

export interface CustomerFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 编辑时传入客户 uuid，为 null 时为新建 */
  editUuid: string | null;
  /** 保存成功回调（新建或编辑后返回当前客户数据） */
  onSuccess: (customer: Customer) => void;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  open,
  onClose,
  editUuid,
  onSuccess,
}) => {
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance>();
  const [formLoading, setFormLoading] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);

  const isEdit = Boolean(editUuid);

  useEffect(() => {
    if (!open) return;
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ isActive: true });
    if (!editUuid) {
      if (isAutoGenerateEnabled(PAGE_CODE)) {
        const ruleCode = getPageRuleCode(PAGE_CODE);
        if (ruleCode) {
          testGenerateCode({ rule_code: ruleCode })
            .then((res) => {
              setPreviewCode(res.code);
              formRef.current?.setFieldsValue({ code: res.code });
            })
            .catch(() => setPreviewCode(null));
        } else {
          setPreviewCode(null);
        }
      } else {
        setPreviewCode(null);
      }
      return;
    }
    setPreviewCode(null);
    customerApi
      .get(editUuid)
      .then((detail) => {
        formRef.current?.setFieldsValue({
          code: detail.code,
          name: detail.name,
          shortName: detail.shortName,
          contactPerson: detail.contactPerson,
          phone: detail.phone,
          email: detail.email,
          address: detail.address,
          category: detail.category,
          isActive: detail.isActive ?? (detail as any).is_active ?? true,
        });
      })
      .catch((err: any) => {
        messageApi.error(err?.message || '获取客户详情失败');
      });
  }, [open, editUuid]);

  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      if (isEdit && editUuid) {
        await customerApi.update(editUuid, values as CustomerUpdate);
        messageApi.success('更新成功');
        const updated = await customerApi.get(editUuid);
        onSuccess(updated);
      } else {
        if (isAutoGenerateEnabled(PAGE_CODE)) {
          const ruleCode = getPageRuleCode(PAGE_CODE);
          const currentCode = values.code;
          if (ruleCode && (currentCode === previewCode || !currentCode)) {
            try {
              const codeResponse = await generateCode({ rule_code: ruleCode });
              values.code = codeResponse.code;
            } catch {
              // keep form code
            }
          }
        }
        if (values.isActive === undefined) {
          values.isActive = true;
        }
        const created = await customerApi.create(values as CustomerCreate);
        messageApi.success('创建成功');
        onSuccess(created);
      }
      onClose();
      formRef.current?.resetFields();
      setPreviewCode(null);
    } catch (error: any) {
      messageApi.error(error?.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    formRef.current?.resetFields();
    setPreviewCode(null);
  };

  return (
    <FormModalTemplate
      title={isEdit ? '编辑客户' : '新建客户'}
      open={open}
      onClose={handleClose}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      formRef={formRef}
      initialValues={{ isActive: true }}
      layout="vertical"
      grid
    >
      <ProFormText
        name="code"
        label="客户编码"
        placeholder={isAutoGenerateEnabled(PAGE_CODE) ? '编码已根据编码规则自动生成，也可手动编辑' : '请输入客户编码'}
        colProps={{ span: 12 }}
        rules={[
          { required: true, message: '请输入客户编码' },
          { max: 50, message: '客户编码不能超过50个字符' },
        ]}
        fieldProps={{ style: { textTransform: 'uppercase' } }}
        extra={!isEdit && isAutoGenerateEnabled(PAGE_CODE) ? '编码已根据编码规则自动生成，也可手动编辑。' : undefined}
      />
      <ProFormText
        name="name"
        label="客户名称"
        placeholder="请输入客户名称"
        colProps={{ span: 12 }}
        rules={[
          { required: true, message: '请输入客户名称' },
          { max: 200, message: '客户名称不能超过200个字符' },
        ]}
      />
      <ProFormText
        name="shortName"
        label="简称"
        placeholder="请输入简称"
        colProps={{ span: 12 }}
        rules={[{ max: 100, message: '简称不能超过100个字符' }]}
      />
      <ProFormText
        name="contactPerson"
        label="联系人"
        placeholder="请输入联系人"
        colProps={{ span: 12 }}
        rules={[{ max: 100, message: '联系人不能超过100个字符' }]}
      />
      <ProFormText
        name="phone"
        label="电话"
        placeholder="请输入电话"
        colProps={{ span: 12 }}
        rules={[{ max: 20, message: '电话不能超过20个字符' }]}
      />
      <ProFormText
        name="email"
        label="邮箱"
        placeholder="请输入邮箱"
        colProps={{ span: 12 }}
        rules={[
          { type: 'email', message: '请输入有效的邮箱地址' },
          { max: 100, message: '邮箱不能超过100个字符' },
        ]}
      />
      <ProFormText
        name="category"
        label="分类"
        placeholder="请输入分类"
        colProps={{ span: 12 }}
        rules={[{ max: 50, message: '分类不能超过50个字符' }]}
      />
      <ProFormTextArea
        name="address"
        label="地址"
        placeholder="请输入地址"
        colProps={{ span: 24 }}
        fieldProps={{ rows: 3, maxLength: 500 }}
      />
      <ProFormSwitch name="isActive" label="是否启用" colProps={{ span: 12 }} initialValue />
    </FormModalTemplate>
  );
};
