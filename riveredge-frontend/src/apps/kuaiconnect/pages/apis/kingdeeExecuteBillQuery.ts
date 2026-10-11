/**
 * 金蝶 ExecuteBillQuery 请求体解析与构建
 */

export const KINGDEE_EXECUTE_BILL_QUERY_PATH =
  'Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.ExecuteBillQuery.common.kdsvc';

export interface ExecuteBillQueryDraft {
  formId: string;
  fieldKeys: string[];
  filterString: string;
  orderString: string;
  startRow: number;
  limit: number;
}

export interface KingdeeFieldOption {
  key: string;
  label: string;
}

export interface KingdeeFormCatalogItem {
  form_id: string;
  name: string;
  default_field_keys: string[];
  fields: KingdeeFieldOption[];
}

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isKingdeeExecuteBillQueryPath(path?: string | null): boolean {
  return String(path || '').includes('ExecuteBillQuery.common.kdsvc');
}

export function parseExecuteBillQueryBody(body: unknown): ExecuteBillQueryDraft | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }
  const parameters = (body as { parameters?: unknown }).parameters;
  if (!Array.isArray(parameters) || parameters.length === 0) {
    return null;
  }
  const queryText = parameters[0];
  if (typeof queryText !== 'string' || !queryText.trim()) {
    return null;
  }
  try {
    const query = JSON.parse(queryText) as {
      FormId?: string;
      FieldKeys?: string;
      FilterString?: string;
      OrderString?: string;
      StartRow?: number;
      Limit?: number;
    };
    return {
      formId: String(query.FormId || '').trim(),
      fieldKeys: String(query.FieldKeys || '')
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean),
      filterString: String(query.FilterString || ''),
      orderString: String(query.OrderString || ''),
      startRow: Number.isFinite(Number(query.StartRow)) ? Number(query.StartRow) : 0,
      limit: Number.isFinite(Number(query.Limit)) ? Number(query.Limit) : 100,
    };
  } catch {
    return null;
  }
}

export function buildExecuteBillQueryBody(
  draft: ExecuteBillQueryDraft,
  previousBody?: unknown,
): Record<string, unknown> {
  const query = {
    FormId: draft.formId,
    FieldKeys: draft.fieldKeys.join(','),
    FilterString: draft.filterString,
    OrderString: draft.orderString,
    TopRowCount: 0,
    StartRow: draft.startRow,
    Limit: draft.limit,
  };
  const envelope =
    previousBody && typeof previousBody === 'object' && !Array.isArray(previousBody)
      ? { ...(previousBody as Record<string, unknown>) }
      : {};
  return {
    format: envelope.format ?? 1,
    useragent: envelope.useragent ?? 'ApiClient',
    rid: newRequestId(),
    parameters: [JSON.stringify(query)],
    timestamp: String(Math.floor(Date.now() / 1000)),
    v: envelope.v ?? '1.0',
  };
}

export function shouldShowKingdeeExecuteBillQueryWizard(
  connectionUuid: string | undefined,
  path: string | undefined,
  connectionType?: string | null,
): boolean {
  return connectionType === 'kingdee_galaxy' && isKingdeeExecuteBillQueryPath(path);
}
