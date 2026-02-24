-- 预览孤儿需求（仅查询，不删除）
-- 执行 clean_orphan_demands.sql 前可先运行本文件确认将要删除的数据

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
