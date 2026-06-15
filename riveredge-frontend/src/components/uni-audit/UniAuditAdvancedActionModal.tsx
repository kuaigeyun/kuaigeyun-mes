import React, { useEffect, useState } from 'react';
import { Modal, Select, Radio, App } from 'antd';
import { searchUserDisplay } from '../../services/user';
import { formatUserDisplayLabel } from '../../utils/userDisplay';
import type { UniAuditAction } from './types';

export interface AdvancedActionState {
  action: 'transfer' | 'add_sign' | 'delegate';
  open: boolean;
}

interface Props {
  state: AdvancedActionState | null;
  onClose: () => void;
  onConfirm: (action: UniAuditAction, payload: Record<string, unknown>, comment?: string) => Promise<void>;
}

const UniAuditAdvancedActionModal: React.FC<Props> = ({ state, onClose, onConfirm }) => {
  const { message } = App.useApp();
  const [users, setUsers] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetUserId, setTargetUserId] = useState<number | undefined>();
  const [signUsers, setSignUsers] = useState<number[]>([]);
  const [signType, setSignType] = useState<'before' | 'after'>('before');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!state?.open) return;
    setTargetUserId(undefined);
    setSignUsers([]);
    setSignType('before');
    setComment('');
    searchUserDisplay({ page: 1, page_size: 200, is_active: true }).then((res) => {
      setUsers(
        (res.items || []).map((u) => ({
          label: formatUserDisplayLabel(u),
          value: u.id,
        })),
      );
    });
  }, [state?.open]);

  if (!state?.open) return null;

  const titleMap = {
    transfer: '转交审批',
    add_sign: '加签',
    delegate: '委托审批',
  };

  const handleOk = async () => {
    if (!state) return;
    try {
      setLoading(true);
      if (state.action === 'add_sign') {
        if (!signUsers.length) {
          message.warning('请选择加签审批人');
          return;
        }
        await onConfirm('add_sign', { sign_user_ids: signUsers, sign_type: signType }, comment || undefined);
      } else {
        if (!targetUserId) {
          message.warning('请选择用户');
          return;
        }
        const key = state.action === 'transfer' ? 'transfer_to_user_id' : 'delegate_to_user_id';
        await onConfirm(state.action, { [key]: targetUserId }, comment || undefined);
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open
      title={titleMap[state.action]}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      destroyOnHidden
    >
      {state.action === 'add_sign' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <Radio.Group value={signType} onChange={(e) => setSignType(e.target.value)}>
              <Radio value="before">前加签</Radio>
              <Radio value="after">后加签</Radio>
            </Radio.Group>
          </div>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="选择加签审批人"
            options={users}
            value={signUsers}
            onChange={setSignUsers}
            showSearch
            optionFilterProp="label"
          />
        </>
      )}
      {(state.action === 'transfer' || state.action === 'delegate') && (
        <Select
          style={{ width: '100%' }}
          placeholder="选择用户"
          options={users}
          value={targetUserId}
          onChange={setTargetUserId}
          showSearch
          optionFilterProp="label"
        />
      )}
    </Modal>
  );
};

export default UniAuditAdvancedActionModal;
