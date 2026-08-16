import React, { useEffect } from 'react';
import { Form } from 'antd';
import { ProForm, ProFormText } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate, MODAL_CONFIG } from '../../../components/layout-templates';
import { UniUserIdSelect } from '../../../components/uni-user-id-select';

type Props = {
  open: boolean;
  assetName?: string;
  onCancel: () => void;
  onSubmit: (custodianId: number, custodianName: string) => Promise<void>;
};

const AssetAssignModal: React.FC<Props> = ({ open, assetName, onCancel, onSubmit }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<{ custodian_id: number; custodian_name: string }>();

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [form, open]);

  return (
    <FormModalTemplate
      open={open}
      title={t('app.kuaioa.asset.assign')}
      onClose={onCancel}
      form={form}
      width={MODAL_CONFIG.TINY_WIDTH}
      onFinish={async (values) => {
        const id = Number(values.custodian_id);
        const name = String(values.custodian_name ?? '').trim();
        if (!Number.isFinite(id) || id <= 0 || !name) {
          throw new Error(t('app.kuaioa.common.required'));
        }
        await onSubmit(id, name);
      }}
    >
      {assetName ? (
        <ProForm.Item label={t('app.kuaioa.asset.name')}>
          <span>{assetName}</span>
        </ProForm.Item>
      ) : null}
      <UniUserIdSelect
        name="custodian_id"
        label={t('app.kuaioa.asset.custodian')}
        required
        onUserPicked={(user) => {
          form.setFieldsValue({
            custodian_name: user?.label || user?.full_name || user?.username || undefined,
          });
        }}
      />
      <ProFormText name="custodian_name" hidden />
    </FormModalTemplate>
  );
};

export default AssetAssignModal;
