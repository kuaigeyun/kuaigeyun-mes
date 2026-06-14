export type UniAuditAction =
  | 'submit'
  | 'withdraw'
  | 'approve'
  | 'reject'
  | 'revoke'
  | 'transfer'
  | 'add_sign'
  | 'delegate'
  | 'urge'
  | 'edit';

export type UniAuditActionsMap = {
  submit?: (id: number) => Promise<any>;
  withdraw?: (id: number) => Promise<any>;
  approve?: (id: number) => Promise<any>;
  reject?: (id: number, reason?: string) => Promise<any>;
  revoke?: (id: number) => Promise<any>;
  transfer?: (id: number, payload: Record<string, unknown>, reason?: string) => Promise<any>;
  add_sign?: (id: number, payload: Record<string, unknown>, reason?: string) => Promise<any>;
  delegate?: (id: number, payload: Record<string, unknown>, reason?: string) => Promise<any>;
  urge?: (id: number, reason?: string) => Promise<any>;
  edit?: (id: number, payload: Record<string, unknown>) => Promise<any>;
};

export type WorkflowStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled' | string;

export type UniAuditEndpointMap = Partial<Record<UniAuditAction, string>>;
