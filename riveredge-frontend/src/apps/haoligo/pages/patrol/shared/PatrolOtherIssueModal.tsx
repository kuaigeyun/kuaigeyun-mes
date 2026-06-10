import { Form, Input, Modal, Switch } from 'antd';
import { useEffect } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (text: string, addToCommon: boolean) => void;
};

export function PatrolOtherIssueModal({ open, onClose, onConfirm }: Props) {
  const [form] = Form.useForm<{ text: string; addToCommon: boolean }>();

  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    const text = values.text.trim();
    if (!text) return;
    onConfirm(text, Boolean(values.addToCommon));
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="添加其他问题"
      open={open}
      onCancel={onClose}
      onOk={() => void handleOk()}
      destroyOnHidden
      okText="添加"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ addToCommon: false }}
      >
        <Form.Item
          name="text"
          label="问题描述"
          rules={[{ required: true, message: '请填写问题描述' }, { max: 200, message: '最多 200 字' }]}
        >
          <Input placeholder="请描述具体问题" maxLength={200} showCount />
        </Form.Item>
        <Form.Item
          name="addToCommon"
          label="加入常见问题"
          valuePropName="checked"
          tooltip="勾选后写入「问题类型」数据字典，下次可直接勾选"
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
