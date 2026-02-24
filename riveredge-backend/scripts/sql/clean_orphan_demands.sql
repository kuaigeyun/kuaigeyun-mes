-- =============================================================================
-- 数据库层面清理孤儿需求管理单据
-- =============================================================================
-- 说明：删除「来源单据（销售订单/销售预测）已不存在或已软删、但需求记录仍存在」的需求。
-- 执行顺序：先删需求明细 (demand_items)，再删需求主表 (demands)。
-- 适用：PostgreSQL（与 Tortoise ORM 表名一致）。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 预览：仅查询将被删除的孤儿需求 ID（执行清理前建议先跑一遍确认）
-- -----------------------------------------------------------------------------
/*
SELECT d.id AS demand_id, d.tenant_id, d.demand_code, d.source_type, d.source_id
FROM apps_kuaizhizao_demands d
WHERE d.deleted_at IS NULL
  AND d.source_type IN ('sales_order', 'sales_forecast')
  AND d.source_id IS NOT NULL
  AND (
    (d.source_type = 'sales_order' AND NOT EXISTS (
      SELECT 1 FROM apps_kuaizhizao_sales_orders o
      WHERE o.tenant_id = d.tenant_id AND o.id = d.source_id AND o.deleted_at IS NULL
    ))
    OR
    (d.source_type = 'sales_forecast' AND NOT EXISTS (
      SELECT 1 FROM apps_kuaizhizao_sales_forecasts f
      WHERE f.tenant_id = d.tenant_id AND f.id = d.source_id AND f.deleted_at IS NULL
    ))
  )
ORDER BY d.tenant_id, d.id;
*/

-- -----------------------------------------------------------------------------
-- 2. 清理：先删除孤儿需求对应的明细
-- -----------------------------------------------------------------------------
DELETE FROM apps_kuaizhizao_demand_items
WHERE demand_id IN (
  SELECT d.id
  FROM apps_kuaizhizao_demands d
  WHERE d.deleted_at IS NULL
    AND d.source_type IN ('sales_order', 'sales_forecast')
    AND d.source_id IS NOT NULL
    AND (
      (d.source_type = 'sales_order' AND NOT EXISTS (
        SELECT 1 FROM apps_kuaizhizao_sales_orders o
        WHERE o.tenant_id = d.tenant_id AND o.id = d.source_id AND o.deleted_at IS NULL
      ))
      OR
      (d.source_type = 'sales_forecast' AND NOT EXISTS (
        SELECT 1 FROM apps_kuaizhizao_sales_forecasts f
        WHERE f.tenant_id = d.tenant_id AND f.id = d.source_id AND f.deleted_at IS NULL
      ))
    )
);

-- -----------------------------------------------------------------------------
-- 3. 清理：再删除孤儿需求主表记录（物理删除）
-- -----------------------------------------------------------------------------
DELETE FROM apps_kuaizhizao_demands
WHERE deleted_at IS NULL
  AND source_type IN ('sales_order', 'sales_forecast')
  AND source_id IS NOT NULL
  AND (
    (source_type = 'sales_order' AND NOT EXISTS (
      SELECT 1 FROM apps_kuaizhizao_sales_orders o
      WHERE o.tenant_id = apps_kuaizhizao_demands.tenant_id
        AND o.id = apps_kuaizhizao_demands.source_id
        AND o.deleted_at IS NULL
    ))
    OR
    (source_type = 'sales_forecast' AND NOT EXISTS (
      SELECT 1 FROM apps_kuaizhizao_sales_forecasts f
      WHERE f.tenant_id = apps_kuaizhizao_demands.tenant_id
        AND f.id = apps_kuaizhizao_demands.source_id
        AND f.deleted_at IS NULL
    ))
  );
