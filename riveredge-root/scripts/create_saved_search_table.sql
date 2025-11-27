-- 创建保存搜索条件表
CREATE TABLE IF NOT EXISTS root_saved_searches (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER,
    user_id INTEGER NOT NULL,
    page_path VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_shared BOOLEAN DEFAULT FALSE,
    search_params JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 外键约束
    CONSTRAINT fk_saved_search_user FOREIGN KEY (user_id) REFERENCES root_users(id) ON DELETE CASCADE,
    CONSTRAINT fk_saved_search_tenant FOREIGN KEY (tenant_id) REFERENCES tree_tenants(id) ON DELETE CASCADE,
    
    -- 唯一约束：同一用户在同一页面不能有重名的搜索条件
    CONSTRAINT uk_saved_search_user_page_name UNIQUE (user_id, page_path, name)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_saved_search_tenant_user_page ON root_saved_searches(tenant_id, user_id, page_path);
CREATE INDEX IF NOT EXISTS idx_saved_search_tenant_page_shared ON root_saved_searches(tenant_id, page_path, is_shared);
CREATE INDEX IF NOT EXISTS idx_saved_search_user ON root_saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_search_tenant ON root_saved_searches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saved_search_page_path ON root_saved_searches(page_path);

-- 添加表注释
COMMENT ON TABLE root_saved_searches IS '保存搜索条件表';
COMMENT ON COLUMN root_saved_searches.id IS '搜索条件 ID（主键）';
COMMENT ON COLUMN root_saved_searches.tenant_id IS '组织 ID（外键，关联到 tree_tenants 表）';
COMMENT ON COLUMN root_saved_searches.user_id IS '创建者用户 ID（外键，关联到 root_users 表）';
COMMENT ON COLUMN root_saved_searches.page_path IS '页面路径（用于区分不同页面的搜索条件）';
COMMENT ON COLUMN root_saved_searches.name IS '搜索条件名称';
COMMENT ON COLUMN root_saved_searches.is_shared IS '是否共享（True：共享，False：个人）';
COMMENT ON COLUMN root_saved_searches.search_params IS '搜索参数（JSON 格式）';
COMMENT ON COLUMN root_saved_searches.created_at IS '创建时间';
COMMENT ON COLUMN root_saved_searches.updated_at IS '更新时间';

