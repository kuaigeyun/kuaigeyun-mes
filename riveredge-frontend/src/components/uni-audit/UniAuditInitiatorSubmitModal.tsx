import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Form, Modal, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import type { SubmitInitiatorNodeHint } from '../../services/uniAudit';
import { searchUserDisplay } from '../../services/user';
import { formatUserDisplayLabel } from '../../utils/userDisplay';

export interface UniAuditInitiatorSubmitModalProps {
  open: boolean;
  entityName: string;
  submitTitle: string;
  nodes: SubmitInitiatorNodeHint[];
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (selectedByNode: Record<string, number[]>) => Promise<void>;
}

const UniAuditInitiatorSubmitModal: React.FC<UniAuditInitiatorSubmitModalProps> = ({
  open,
  entityName,
  submitTitle,
  nodes,
  loading,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<Record<string, number[]>>();
  const [userOptions, setUserOptions] = useState<{ label: string; value: number }[]>([]);
  const [fetchingUsers, setFetchingUsers] = useState(false);

  const hasOptional = useMemo(
    () => nodes.some((n) => !n.required),
    [nodes],
  );

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    let cancelled = false;
    setFetchingUsers(true);
    searchUserDisplay({ page: 1, page_size: 200, is_active: true })
      .then((res) => {
        if (cancelled) return;
        setUserOptions(
          (res.items || [])
            .filter((u) => typeof u.id === 'number' && u.id > 0)
            .map((u) => ({
              label: formatUserDisplayLabel(u),
              value: u.id as number,
            })),
        );
      })
      .finally(() => {
        if (!cancelled) setFetchingUsers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    const selectedByNode: Record<string, number[]> = {};
    for (const node of nodes) {
      const raw = values[node.node_id];
      const ids = Array.isArray(raw) ? raw.filter((id) => id > 0) : raw ? [raw] : [];
      if (ids.length) {
        selectedByNode[node.node_id] = ids;
      } else if (node.required) {
        return;
      }
    }
    await onConfirm(selectedByNode);
  };

  return (
    <Modal
      open={open}
      title={submitTitle}
      okText={submitTitle}
      cancelText={t('common.cancel')}
      confirmLoading={loading}
      onCancel={onCancel}
      onOk={() => void handleOk()}
      destroyOnHidden
    >
      {hasOptional ? (
        <Alert
          type="info"
          showIcon
          title={t('pages.approval.submitInitiatorOptionalHint')}
          style={{ marginBottom: 12 }}
        />
      ) : null}
      <Form form={form} layout="vertical">
        {nodes.map((node) => (
          <Form.Item
            key={node.node_id}
            name={node.node_id}
            label={`${node.label}${node.required ? '' : ` (${t('pages.approval.submitInitiatorOptional')})`}`}
            rules={
              node.required
                ? [
                    {
                      required: true,
                      message: t('pages.approval.submitInitiatorRequired', {
                        node: node.label,
                      }),
                    },
                  ]
                : undefined
            }
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              loading={fetchingUsers}
              placeholder={t('pages.approval.submitInitiatorPlaceholder', { entity: entityName })}
              options={userOptions}
            />
          </Form.Item>
        ))}
      </Form>
    </Modal>
  );
};

export default UniAuditInitiatorSubmitModal;
