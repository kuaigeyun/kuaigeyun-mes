-- 初始化应用数据
-- 运行此脚本前需要连接到PostgreSQL数据库

-- 插入 master-data 应用
INSERT INTO core_applications (
    uuid, tenant_id, name, code, description, icon, version,
    route_path, entry_point, menu_config, permission_code,
    is_system, is_active, is_installed, sort_order, created_at, updated_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    1,
    '基础数据管理',
    'master-data',
    '统一管理工厂、仓库、物料、工艺、供应链、绩效等基础数据',
    'database',
    '1.0.0',
    '/apps/master-data',
    '../apps/master-data/index.tsx',
    '{
        "title": "基础数据管理",
        "icon": "database",
        "path": "/apps/master-data",
        "children": [
            {
                "title": "工厂数据",
                "icon": "factory",
                "sort_order": 1,
                "children": [
                    {"title": "车间", "path": "/apps/master-data/factory/workshops", "permission": "master-data:factory:workshop:view", "sort_order": 1},
                    {"title": "产线", "path": "/apps/master-data/factory/production-lines", "permission": "master-data:factory:production-line:view", "sort_order": 2},
                    {"title": "工位", "path": "/apps/master-data/factory/workstations", "permission": "master-data:factory:workstation:view", "sort_order": 3}
                ]
            },
            {
                "title": "物料数据",
                "icon": "package",
                "sort_order": 3,
                "children": [
                    {"title": "物料管理", "path": "/apps/master-data/materials", "permission": "master-data:material:view", "sort_order": 1},
                    {"title": "BOM", "path": "/apps/master-data/materials/bom", "permission": "master-data:material:bom:view", "sort_order": 2}
                ]
            }
        ]
    }',
    'app:master-data',
    true, true, true, 990,
    NOW(), NOW()
) ON CONFLICT (tenant_id, code) DO NOTHING;

-- 插入 kuaizhizao 应用
INSERT INTO core_applications (
    uuid, tenant_id, name, code, description, icon, version,
    route_path, entry_point, menu_config, permission_code,
    is_system, is_active, is_installed, sort_order, created_at, updated_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440002',
    1,
    '快格轻制造',
    'kuaizhizao',
    '轻量级MES系统，专注生产执行核心流程',
    'production',
    '1.0.5',
    '/apps/kuaizhizao',
    '../apps/kuaizhizao/index.tsx',
    '{
        "title": "快格轻制造",
        "icon": "production",
        "path": "/apps/kuaizhizao",
        "children": [
            {
                "title": "销售管理",
                "icon": "chartLine",
                "sort_order": 1,
                "children": [
                    {"title": "销售订单", "path": "/apps/kuaizhizao/sales-management/sales-orders", "permission": "kuaizhizao:sales-order:view", "sort_order": 1}
                ]
            },
            {
                "title": "生产执行",
                "icon": "activity",
                "sort_order": 4,
                "children": [
                    {"title": "工单管理", "path": "/apps/kuaizhizao/production-execution/work-orders", "permission": "kuaizhizao:work-order:view", "sort_order": 1},
                    {"title": "报工管理", "path": "/apps/kuaizhizao/production-execution/reporting", "permission": "kuaizhizao:reporting:view", "sort_order": 2}
                ]
            }
        ]
    }',
    'app:kuaizhizao',
    true, true, true, 980,
    NOW(), NOW()
) ON CONFLICT (tenant_id, code) DO NOTHING;

-- 检查插入结果
SELECT code, name, is_active, is_installed FROM core_applications WHERE tenant_id = 1;