/**
 * 物料防重助手
 * - 列表工具栏：配置比对字段（默认名称+规格+型号，可含自定义字段）
 * - 新建物料：命中后在 Modal 左侧展示 SmartSuggestionFloatPanel
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Checkbox,
  Form,
  Modal,
  Space,
  theme,
} from 'antd'
import { useTranslation } from 'react-i18next'
import {
  MODAL_ABOVE_DETAIL_SIDECHAIN_OFFSET,
  MODAL_NESTED_ABOVE_PARENT_OFFSET,
} from '../../../components/layout-templates/constants'
import SmartSuggestionFloatPanel, {
  type MessageItem,
} from '../../../components/smart-suggestion-float-panel'
import { useUserPreferenceStore } from '../../../stores/userPreferenceStore'
import { formatApiErrorDetail } from '../../../services/api'
import type { CustomField } from '../../../services/customField'
import { materialApi } from '../services/material'
import {
  MATERIAL_DEDUP_DEFAULT_FIELDS,
  MATERIAL_DEDUP_PREFERENCE_KEY,
  isMaterialDedupCustomFieldKey,
  materialDedupCustomFieldKey,
  parseMaterialDedupCustomFieldCode,
  type MaterialDedupMatchItem,
} from '../types/materialDedup'

const MATERIAL_FORM_ANCHOR = "[data-smart-suggestion-anchor='material-form']"

const I18N = 'app.master-data.materialDedup'

function normalizeMatchFields(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...MATERIAL_DEDUP_DEFAULT_FIELDS]
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const key = String(item || '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out.length ? out : [...MATERIAL_DEDUP_DEFAULT_FIELDS]
}

export function useMaterialDedupMatchFields(): {
  matchFields: string[]
  setMatchFields: (fields: string[]) => Promise<void>
} {
  const getPreference = useUserPreferenceStore((s) => s.getPreference)
  const updatePreferences = useUserPreferenceStore((s) => s.updatePreferences)
  const preferences = useUserPreferenceStore((s) => s.preferences)

  const matchFields = useMemo(() => {
    void preferences
    return normalizeMatchFields(getPreference(MATERIAL_DEDUP_PREFERENCE_KEY, MATERIAL_DEDUP_DEFAULT_FIELDS))
  }, [getPreference, preferences])

  const setMatchFields = useCallback(
    async (fields: string[]) => {
      const next = normalizeMatchFields(fields)
      await updatePreferences({ [MATERIAL_DEDUP_PREFERENCE_KEY]: next })
    },
    [updatePreferences],
  )

  return { matchFields, setMatchFields }
}

function builtinFieldLabel(key: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    name: t(`${I18N}.field.name`),
    specification: t(`${I18N}.field.specification`),
    model: t(`${I18N}.field.model`),
    brand: t(`${I18N}.field.brand`),
    base_unit: t(`${I18N}.field.baseUnit`),
    main_code: t(`${I18N}.field.mainCode`),
  }
  return map[key] || key
}

function buildDedupValuesFromForm(
  formValues: Record<string, unknown>,
  matchFields: string[],
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const key of matchFields) {
    if (isMaterialDedupCustomFieldKey(key)) {
      const code = parseMaterialDedupCustomFieldCode(key)
      if (!code) continue
      values[key] = formValues[`custom_${code}`]
      continue
    }
    if (key === 'base_unit') {
      values[key] = formValues.baseUnit
      continue
    }
    if (key === 'main_code') {
      values[key] = formValues.mainCode
      continue
    }
    values[key] = formValues[key]
  }
  return values
}

function matchFingerprint(matchFields: string[], values: Record<string, unknown>): string {
  return JSON.stringify({
    fields: matchFields,
    values: matchFields.map((k) => String(values[k] ?? '').trim()),
  })
}

function matchesToMessages(
  matches: MaterialDedupMatchItem[],
  t: (k: string, o?: Record<string, unknown>) => string,
  onOpenMaterial?: (uuid: string) => void,
): MessageItem[] {
  return matches.map((item) => {
    const parts: string[] = []
    if (item.specification) parts.push(`${t(`${I18N}.field.specification`)}：${item.specification}`)
    if (item.model) parts.push(`${t(`${I18N}.field.model`)}：${item.model}`)
    const detail = parts.length ? `\n${parts.join('，')}` : ''
    return {
      title: t(`${I18N}.suggestionTitle`, { code: item.mainCode, name: item.name }),
      text: t(`${I18N}.suggestionContent`, { code: item.mainCode, name: item.name }) + detail,
      tone: 'danger',
      actionLabel: onOpenMaterial ? t(`${I18N}.openMaterial`) : undefined,
      onAction: onOpenMaterial ? () => onOpenMaterial(item.uuid) : undefined,
    }
  })
}

export interface MaterialDedupConfigTriggerProps {
  customFields?: CustomField[]
}

/** 列表工具栏：打开防重字段配置 */
export function MaterialDedupConfigTrigger({ customFields = [] }: MaterialDedupConfigTriggerProps) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { matchFields, setMatchFields } = useMaterialDedupMatchFields()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>(matchFields)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setDraft(matchFields)
  }, [open, matchFields])

  const options = useMemo(() => {
    const allBuiltin = ['name', 'specification', 'model', 'brand', 'base_unit', 'main_code']
    const builtinOpts = allBuiltin.map((key) => ({
      label: builtinFieldLabel(key, t),
      value: key,
    }))
    const seen = new Set(builtinOpts.map((o) => o.value))
    const customOpts = customFields
      .filter((f) => f.is_active !== false)
      .map((f) => ({
        label: `${f.name} (${f.code})`,
        value: materialDedupCustomFieldKey(f.code),
      }))
      .filter((o) => {
        if (seen.has(o.value)) return false
        seen.add(o.value)
        return true
      })
    return [...builtinOpts, ...customOpts]
  }, [customFields, t])

  const handleSave = async () => {
    if (!draft.length) {
      message.warning(t(`${I18N}.configNeedOne`))
      return
    }
    setSaving(true)
    try {
      await setMatchFields(draft)
      message.success(t(`${I18N}.configSaved`))
      setOpen(false)
    } catch (err: unknown) {
      const detail =
        formatApiErrorDetail((err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail) ||
        (err instanceof Error ? err.message : '')
      message.error(detail || t(`${I18N}.configSaveFailed`))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        {t(`${I18N}.trigger`)}
      </Button>
      <Modal
        title={t(`${I18N}.configTitle`)}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void handleSave()}
        confirmLoading={saving}
        destroyOnHidden
        width={520}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t(`${I18N}.configHint`)}
        />
        <Checkbox.Group
          style={{ width: '100%' }}
          value={draft}
          onChange={(v) => setDraft(v.map(String))}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {options.map((opt) => (
              <Checkbox key={opt.value} value={opt.value}>
                {opt.label}
              </Checkbox>
            ))}
          </Space>
        </Checkbox.Group>
      </Modal>
    </>
  )
}

export interface MaterialDedupCreateGuardProps {
  open: boolean
  /** 仅新建时启用 */
  enabled: boolean
  excludeUuid?: string
  onOpenMaterial?: (uuid: string) => void
}

/** 新建物料表单内：防重检测 + Modal 左侧智能建议面板 */
export function MaterialDedupCreateGuard({
  open,
  enabled,
  excludeUuid,
  onOpenMaterial,
}: MaterialDedupCreateGuardProps) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const form = Form.useFormInstance()
  const { matchFields } = useMaterialDedupMatchFields()
  const [matches, setMatches] = useState<MaterialDedupMatchItem[]>([])
  const [checking, setChecking] = useState(false)
  const lastFingerprintRef = useRef<string>('')
  const seqRef = useRef(0)

  // 高于同屏 MaterialForm Modal（常见 base+100）及遮罩，保证左侧面板可点
  const overlayZIndex =
    token.zIndexPopupBase + MODAL_ABOVE_DETAIL_SIDECHAIN_OFFSET + MODAL_NESTED_ABOVE_PARENT_OFFSET

  const nameWatch = Form.useWatch('name', form)
  const specificationWatch = Form.useWatch('specification', form)
  const modelWatch = Form.useWatch('model', form)
  const brandWatch = Form.useWatch('brand', form)
  const baseUnitWatch = Form.useWatch('baseUnit', form)
  const mainCodeWatch = Form.useWatch('mainCode', form)
  const allWatched = Form.useWatch([], form)

  const formValues = useMemo(() => {
    const base = (allWatched && typeof allWatched === 'object' ? allWatched : {}) as Record<string, unknown>
    return {
      ...base,
      name: nameWatch ?? base.name,
      specification: specificationWatch ?? base.specification,
      model: modelWatch ?? base.model,
      brand: brandWatch ?? base.brand,
      baseUnit: baseUnitWatch ?? base.baseUnit,
      mainCode: mainCodeWatch ?? base.mainCode,
    }
  }, [
    allWatched,
    nameWatch,
    specificationWatch,
    modelWatch,
    brandWatch,
    baseUnitWatch,
    mainCodeWatch,
  ])

  const runCheck = useCallback(async () => {
    if (!enabled || !open) {
      setMatches([])
      return
    }
    const values = buildDedupValuesFromForm(
      form.getFieldsValue(true) as Record<string, unknown>,
      matchFields,
    )
    const fingerprint = matchFingerprint(matchFields, values)
    const nameFilled = String(values.name ?? '').trim() !== ''
    const anyFilled = matchFields.some((k) => String(values[k] ?? '').trim() !== '')
    const ready = matchFields.includes('name') ? nameFilled : anyFilled
    if (!ready) {
      lastFingerprintRef.current = fingerprint
      setMatches([])
      return
    }
    if (fingerprint === lastFingerprintRef.current) return
    lastFingerprintRef.current = fingerprint

    const seq = ++seqRef.current
    setChecking(true)
    try {
      const result = await materialApi.checkDuplicates({
        matchFields,
        values,
        excludeUuid,
        mastersOnly: true,
      })
      if (seq !== seqRef.current) return
      if (result.skipped) {
        setMatches([])
        return
      }
      setMatches(result.matched ? result.matches || [] : [])
    } catch (err: unknown) {
      if (seq !== seqRef.current) return
      setMatches([])
      const detail =
        formatApiErrorDetail((err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail) ||
        (err instanceof Error ? err.message : '')
      if (detail) {
        message.warning(detail)
      }
    } finally {
      if (seq === seqRef.current) setChecking(false)
    }
  }, [enabled, excludeUuid, form, matchFields, message, open])

  useEffect(() => {
    if (!enabled || !open) {
      setMatches([])
      lastFingerprintRef.current = ''
      return
    }
    const timer = window.setTimeout(() => {
      void runCheck()
    }, 400)
    return () => window.clearTimeout(timer)
  }, [enabled, open, formValues, matchFields, runCheck])

  const panelMessages = useMemo(
    () => matchesToMessages(matches, t, onOpenMaterial),
    [matches, onOpenMaterial, t],
  )

  if (!enabled || !open) return null

  return (
    <SmartSuggestionFloatPanel
      visible={matches.length > 0}
      loading={checking && matches.length === 0}
      suggestion={null}
      messages={panelMessages}
      anchorSelector={MATERIAL_FORM_ANCHOR}
      zIndex={overlayZIndex}
    />
  )
}

export default MaterialDedupConfigTrigger
