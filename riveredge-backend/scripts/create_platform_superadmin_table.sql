-- 创建平台超级管理员表
-- 表名：soil_platform_superadmin

CREATE TABLE IF NOT EXISTS soil_platform_superadmin (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_soil_platform_superadmin_username ON soil_platform_superadmin(username);
CREATE INDEX IF NOT EXISTS idx_soil_platform_superadmin_uuid ON soil_platform_superadmin(uuid);

-- 添加注释
COMMENT ON TABLE soil_platform_superadmin IS '平台超级管理员表（平台级后端）';
COMMENT ON COLUMN soil_platform_superadmin.id IS '平台超级管理员 ID（主键）';
COMMENT ON COLUMN soil_platform_superadmin.uuid IS '业务ID（UUID，对外暴露，安全且唯一）';
COMMENT ON COLUMN soil_platform_superadmin.username IS '用户名（全局唯一，平台唯一）';
COMMENT ON COLUMN soil_platform_superadmin.email IS '用户邮箱（可选）';
COMMENT ON COLUMN soil_platform_superadmin.password_hash IS '密码哈希值（使用 bcrypt 加密）';
COMMENT ON COLUMN soil_platform_superadmin.full_name IS '用户全名（可选）';
COMMENT ON COLUMN soil_platform_superadmin.is_active IS '是否激活';
COMMENT ON COLUMN soil_platform_superadmin.last_login IS '最后登录时间（可选）';
COMMENT ON COLUMN soil_platform_superadmin.created_at IS '创建时间';
COMMENT ON COLUMN soil_platform_superadmin.updated_at IS '更新时间';

