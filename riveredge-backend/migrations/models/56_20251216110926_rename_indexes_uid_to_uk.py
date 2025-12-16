"""
数据库索引重命名迁移

将 uid_ 前缀的唯一索引统一重命名为 uk_ 前缀，符合命名规范。
"""


def upgrade():
    """
    升级：重命名索引
    """
    return """
-- 数据库索引重命名迁移
-- 统一为最新命名规范（uid_ → uk_）

-- ============================================
-- 重命名唯一索引（uid_ → uk_）
-- ============================================
ALTER INDEX IF EXISTS "uid_apps_kuaicr_tenant__93b042" RENAME TO "uk_apps_kuaicr_tenant__93b042";
ALTER INDEX IF EXISTS "uid_apps_kuaicr_tenant__fc1f12" RENAME TO "uk_apps_kuaicr_tenant__fc1f12";
ALTER INDEX IF EXISTS "uid_apps_kuaicr_tenant__810b7c" RENAME TO "uk_apps_kuaicr_tenant__810b7c";
ALTER INDEX IF EXISTS "uid_apps_kuaicr_tenant__8af6b9" RENAME TO "uk_apps_kuaicr_tenant__8af6b9";
ALTER INDEX IF EXISTS "uid_apps_kuaicr_tenant__64f939" RENAME TO "uk_apps_kuaicr_tenant__64f939";
ALTER INDEX IF EXISTS "uid_apps_kuaicr_tenant__b8c3ab" RENAME TO "uk_apps_kuaicr_tenant__b8c3ab";
ALTER INDEX IF EXISTS "uid_apps_kuaicr_tenant__135aaf" RENAME TO "uk_apps_kuaicr_tenant__135aaf";
ALTER INDEX IF EXISTS "uid_apps_kuaicr_tenant__08f18a" RENAME TO "uk_apps_kuaicr_tenant__08f18a";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__31d606" RENAME TO "uk_apps_kuaiea_tenant__31d606";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__e64673" RENAME TO "uk_apps_kuaiea_tenant__e64673";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__a895ca" RENAME TO "uk_apps_kuaiea_tenant__a895ca";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__427961" RENAME TO "uk_apps_kuaiea_tenant__427961";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__1cde53" RENAME TO "uk_apps_kuaiea_tenant__1cde53";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__5c7fe8" RENAME TO "uk_apps_kuaiea_tenant__5c7fe8";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__dd52a6" RENAME TO "uk_apps_kuaiea_tenant__dd52a6";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__5e8bf2" RENAME TO "uk_apps_kuaiea_tenant__5e8bf2";
ALTER INDEX IF EXISTS "uid_apps_kuaiea_tenant__736d96" RENAME TO "uk_apps_kuaiea_tenant__736d96";
ALTER INDEX IF EXISTS "uid_apps_kuaime_tenant__a1b2c3" RENAME TO "uk_apps_kuaime_tenant__a1b2c3";
ALTER INDEX IF EXISTS "uid_apps_kuaime_tenant__185a1e" RENAME TO "uk_apps_kuaime_tenant__185a1e";
ALTER INDEX IF EXISTS "uid_apps_kuaime_tenant__f9033b" RENAME TO "uk_apps_kuaime_tenant__f9033b";
ALTER INDEX IF EXISTS "uid_apps_kuaime_tenant__b05410" RENAME TO "uk_apps_kuaime_tenant__b05410";
ALTER INDEX IF EXISTS "uid_apps_kuaime_tenant__53bf79" RENAME TO "uk_apps_kuaime_tenant__53bf79";
ALTER INDEX IF EXISTS "uid_apps_kuaimr_tenant__aad8bd" RENAME TO "uk_apps_kuaimr_tenant__aad8bd";
ALTER INDEX IF EXISTS "uid_apps_kuaimr_tenant__a5553d" RENAME TO "uk_apps_kuaimr_tenant__a5553d";
ALTER INDEX IF EXISTS "uid_apps_kuaimr_tenant__31d4b7" RENAME TO "uk_apps_kuaimr_tenant__31d4b7";
ALTER INDEX IF EXISTS "uid_apps_kuaimr_tenant__047e85" RENAME TO "uk_apps_kuaimr_tenant__047e85";
ALTER INDEX IF EXISTS "uid_apps_kuaipd_tenant__e0e991" RENAME TO "uk_apps_kuaipd_tenant__e0e991";
ALTER INDEX IF EXISTS "uid_apps_kuaipd_tenant__a95341" RENAME TO "uk_apps_kuaipd_tenant__a95341";
ALTER INDEX IF EXISTS "uid_apps_kuaipd_tenant__b8d426" RENAME TO "uk_apps_kuaipd_tenant__b8d426";
ALTER INDEX IF EXISTS "uid_apps_kuaipd_tenant__40f18a" RENAME TO "uk_apps_kuaipd_tenant__40f18a";
ALTER INDEX IF EXISTS "uid_apps_kuaipd_tenant__120f74" RENAME TO "uk_apps_kuaipd_tenant__120f74";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__15922a" RENAME TO "uk_apps_kuaiqm_tenant__15922a";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__1c44cc" RENAME TO "uk_apps_kuaiqm_tenant__1c44cc";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__3613a7" RENAME TO "uk_apps_kuaiqm_tenant__3613a7";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__567c4b" RENAME TO "uk_apps_kuaiqm_tenant__567c4b";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__2d5085" RENAME TO "uk_apps_kuaiqm_tenant__2d5085";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__c30ed4" RENAME TO "uk_apps_kuaiqm_tenant__c30ed4";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__7f3e44" RENAME TO "uk_apps_kuaiqm_tenant__7f3e44";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__2840f6" RENAME TO "uk_apps_kuaiqm_tenant__2840f6";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__b9b190" RENAME TO "uk_apps_kuaiqm_tenant__b9b190";
ALTER INDEX IF EXISTS "uid_apps_kuaiqm_tenant__148943" RENAME TO "uk_apps_kuaiqm_tenant__148943";
ALTER INDEX IF EXISTS "uid_apps_kuaisr_tenant__0dd7d5" RENAME TO "uk_apps_kuaisr_tenant__0dd7d5";
ALTER INDEX IF EXISTS "uid_apps_kuaisr_tenant__065dd1" RENAME TO "uk_apps_kuaisr_tenant__065dd1";
ALTER INDEX IF EXISTS "uid_apps_kuaisr_tenant__ad48ea" RENAME TO "uk_apps_kuaisr_tenant__ad48ea";
ALTER INDEX IF EXISTS "uid_apps_kuaisr_tenant__8a0de1" RENAME TO "uk_apps_kuaisr_tenant__8a0de1";
ALTER INDEX IF EXISTS "uid_apps_kuaiwm_tenant__d9b441" RENAME TO "uk_apps_kuaiwm_tenant__d9b441";
ALTER INDEX IF EXISTS "uid_apps_kuaiwm_tenant__d7fdf1" RENAME TO "uk_apps_kuaiwm_tenant__d7fdf1";
ALTER INDEX IF EXISTS "uid_apps_kuaiwm_tenant__f1dd34" RENAME TO "uk_apps_kuaiwm_tenant__f1dd34";
ALTER INDEX IF EXISTS "uid_apps_kuaiwm_tenant__8d7f52" RENAME TO "uk_apps_kuaiwm_tenant__8d7f52";
ALTER INDEX IF EXISTS "uid_apps_kuaiwm_tenant__820d42" RENAME TO "uk_apps_kuaiwm_tenant__820d42";
ALTER INDEX IF EXISTS "uid_core_applic_tenant__a1b2c3" RENAME TO "uk_core_applic_tenant__a1b2c3";
ALTER INDEX IF EXISTS "uid_core_code_r_tenant__d9e4f5" RENAME TO "uk_core_code_r_tenant__d9e4f5";
ALTER INDEX IF EXISTS "uid_core_code_s_code_ru_g9h4i5" RENAME TO "uk_core_code_s_code_ru_g9h4i5";
ALTER INDEX IF EXISTS "uid_core_custom_tenant__i9j4k5" RENAME TO "uk_core_custom_tenant__i9j4k5";
ALTER INDEX IF EXISTS "uid_core_data_di_tenant__a8b3c4" RENAME TO "uk_core_data_di_tenant__a8b3c4";
ALTER INDEX IF EXISTS "uid_core_dictio_tenant__b9c4d5" RENAME TO "uk_core_dictio_tenant__b9c4d5";
ALTER INDEX IF EXISTS "uid_core_integra_tenant__b1c2d3" RENAME TO "uk_core_integra_tenant__b1c2d3";
ALTER INDEX IF EXISTS "uid_core_languag_tenant__u9v4w5" RENAME TO "uk_core_languag_tenant__u9v4w5";
ALTER INDEX IF EXISTS "uid_core_permiss_tenant__a6de52" RENAME TO "uk_core_permiss_tenant__a6de52";
ALTER INDEX IF EXISTS "uid_core_site_s_tenant__p9q4r5" RENAME TO "uk_core_site_s_tenant__p9q4r5";
ALTER INDEX IF EXISTS "uid_core_system_tenant__c9d4e5" RENAME TO "uk_core_system_tenant__c9d4e5";
ALTER INDEX IF EXISTS "uid_core_users_tenant__26aebd" RENAME TO "uk_core_users_tenant__26aebd";
"""
    pass


def downgrade():
    """
    降级：恢复索引名称
    """
    return """
-- 恢复索引名称（uk_ → uid_）

-- ============================================
-- 恢复唯一索引名称（uk_ → uid_）
-- ============================================
ALTER INDEX IF EXISTS "uk_apps_kuaicr_tenant__93b042" RENAME TO "uid_apps_kuaicr_tenant__93b042";
ALTER INDEX IF EXISTS "uk_apps_kuaicr_tenant__fc1f12" RENAME TO "uid_apps_kuaicr_tenant__fc1f12";
ALTER INDEX IF EXISTS "uk_apps_kuaicr_tenant__810b7c" RENAME TO "uid_apps_kuaicr_tenant__810b7c";
ALTER INDEX IF EXISTS "uk_apps_kuaicr_tenant__8af6b9" RENAME TO "uid_apps_kuaicr_tenant__8af6b9";
ALTER INDEX IF EXISTS "uk_apps_kuaicr_tenant__64f939" RENAME TO "uid_apps_kuaicr_tenant__64f939";
ALTER INDEX IF EXISTS "uk_apps_kuaicr_tenant__b8c3ab" RENAME TO "uid_apps_kuaicr_tenant__b8c3ab";
ALTER INDEX IF EXISTS "uk_apps_kuaicr_tenant__135aaf" RENAME TO "uid_apps_kuaicr_tenant__135aaf";
ALTER INDEX IF EXISTS "uk_apps_kuaicr_tenant__08f18a" RENAME TO "uid_apps_kuaicr_tenant__08f18a";
ALTER INDEX IF EXISTS "uk_apps_kuaiea_tenant__31d606" RENAME TO "uid_apps_kuaiea_tenant__31d606";
ALTER INDEX IF EXISTS "uk_apps_kuaiea_tenant__e64673" RENAME TO "uid_apps_kuaiea_tenant__e64673";
ALTER INDEX IF EXISTS "uk_apps_kuaiea_tenant__a895ca" RENAME TO "uid_apps_kuaiea_tenant__a895ca";
ALTER INDEX IF EXISTS "uk_apps_kuaiea_tenant__427961" RENAME TO "uid_apps_kuaiea_tenant__427961";
ALTER INDEX IF EXISTS "uk_apps_kuaiea_tenant__1cde53" RENAME TO "uid_apps_kuaiea_tenant__1cde53";
ALTER INDEX IF EXISTS "uk_apps_kuaiea_tenant__5c7fe8" RENAME TO "uid_apps_kuaiea_tenant__5c7fe8";
ALTER INDEX IF EXISTS "uk_apps_kuaiea_tenant__dd52a6" RENAME TO "uid_apps_kuaiea_tenant__dd52a6";
ALTER INDEX IF EXISTS "uk_apps_kuaiea_tenant__5e8bf2" RENAME TO "uid_apps_kuaiea_tenant__5e8bf2";
ALTER INDEX IF EXISTS "uk_apps_kuaiea_tenant__736d96" RENAME TO "uid_apps_kuaiea_tenant__736d96";
ALTER INDEX IF EXISTS "uk_apps_kuaime_tenant__a1b2c3" RENAME TO "uid_apps_kuaime_tenant__a1b2c3";
ALTER INDEX IF EXISTS "uk_apps_kuaime_tenant__185a1e" RENAME TO "uid_apps_kuaime_tenant__185a1e";
ALTER INDEX IF EXISTS "uk_apps_kuaime_tenant__f9033b" RENAME TO "uid_apps_kuaime_tenant__f9033b";
ALTER INDEX IF EXISTS "uk_apps_kuaime_tenant__b05410" RENAME TO "uid_apps_kuaime_tenant__b05410";
ALTER INDEX IF EXISTS "uk_apps_kuaime_tenant__53bf79" RENAME TO "uid_apps_kuaime_tenant__53bf79";
ALTER INDEX IF EXISTS "uk_apps_kuaimr_tenant__aad8bd" RENAME TO "uid_apps_kuaimr_tenant__aad8bd";
ALTER INDEX IF EXISTS "uk_apps_kuaimr_tenant__a5553d" RENAME TO "uid_apps_kuaimr_tenant__a5553d";
ALTER INDEX IF EXISTS "uk_apps_kuaimr_tenant__31d4b7" RENAME TO "uid_apps_kuaimr_tenant__31d4b7";
ALTER INDEX IF EXISTS "uk_apps_kuaimr_tenant__047e85" RENAME TO "uid_apps_kuaimr_tenant__047e85";
ALTER INDEX IF EXISTS "uk_apps_kuaipd_tenant__e0e991" RENAME TO "uid_apps_kuaipd_tenant__e0e991";
ALTER INDEX IF EXISTS "uk_apps_kuaipd_tenant__a95341" RENAME TO "uid_apps_kuaipd_tenant__a95341";
ALTER INDEX IF EXISTS "uk_apps_kuaipd_tenant__b8d426" RENAME TO "uid_apps_kuaipd_tenant__b8d426";
ALTER INDEX IF EXISTS "uk_apps_kuaipd_tenant__40f18a" RENAME TO "uid_apps_kuaipd_tenant__40f18a";
ALTER INDEX IF EXISTS "uk_apps_kuaipd_tenant__120f74" RENAME TO "uid_apps_kuaipd_tenant__120f74";
ALTER INDEX IF EXISTS "uk_apps_kuaiqm_tenant__15922a" RENAME TO "uid_apps_kuaiqm_tenant__15922a";
ALTER INDEX IF EXISTS "uk_apps_kuaiqm_tenant__1c44cc" RENAME TO "uid_apps_kuaiqm_tenant__1c44cc";
ALTER INDEX IF EXISTS "uk_apps_kuaiqm_tenant__3613a7" RENAME TO "uid_apps_kuaiqm_tenant__3613a7";
ALTER INDEX IF EXISTS "uk_apps_kuaiqm_tenant__567c4b" RENAME TO "uid_apps_kuaiqm_tenant__567c4b";
ALTER INDEX IF EXISTS "uk_apps_kuaiqm_tenant__2d5085" RENAME TO "uid_apps_kuaiqm_tenant__2d5085";
ALTER INDEX IF EXISTS "uk_apps_kuaiqm_tenant__c30ed4" RENAME TO "uid_apps_kuaiqm_tenant__c30ed4";
ALTER INDEX IF EXISTS "uk_apps_kuaiqm_tenant__7f3e44" RENAME TO "uid_apps_kuaiqm_tenant__7f3e44";
ALTER INDEX IF EXISTS "uk_apps_kuaiqm_tenant__2840f6" RENAME TO "uid_apps_kuaiqm_tenant__2840f6";
ALTER INDEX IF EXISTS "uk_apps_kuaiqm_tenant__b9b190" RENAME TO "uid_apps_kuaiqm_tenant__b9b190";
ALTER INDEX IF EXISTS "uk_apps_kuaiqm_tenant__148943" RENAME TO "uid_apps_kuaiqm_tenant__148943";
ALTER INDEX IF EXISTS "uk_apps_kuaisr_tenant__0dd7d5" RENAME TO "uid_apps_kuaisr_tenant__0dd7d5";
ALTER INDEX IF EXISTS "uk_apps_kuaisr_tenant__065dd1" RENAME TO "uid_apps_kuaisr_tenant__065dd1";
ALTER INDEX IF EXISTS "uk_apps_kuaisr_tenant__ad48ea" RENAME TO "uid_apps_kuaisr_tenant__ad48ea";
ALTER INDEX IF EXISTS "uk_apps_kuaisr_tenant__8a0de1" RENAME TO "uid_apps_kuaisr_tenant__8a0de1";
ALTER INDEX IF EXISTS "uk_apps_kuaiwm_tenant__d9b441" RENAME TO "uid_apps_kuaiwm_tenant__d9b441";
ALTER INDEX IF EXISTS "uk_apps_kuaiwm_tenant__d7fdf1" RENAME TO "uid_apps_kuaiwm_tenant__d7fdf1";
ALTER INDEX IF EXISTS "uk_apps_kuaiwm_tenant__f1dd34" RENAME TO "uid_apps_kuaiwm_tenant__f1dd34";
ALTER INDEX IF EXISTS "uk_apps_kuaiwm_tenant__8d7f52" RENAME TO "uid_apps_kuaiwm_tenant__8d7f52";
ALTER INDEX IF EXISTS "uk_apps_kuaiwm_tenant__820d42" RENAME TO "uid_apps_kuaiwm_tenant__820d42";
ALTER INDEX IF EXISTS "uk_core_applic_tenant__a1b2c3" RENAME TO "uid_core_applic_tenant__a1b2c3";
ALTER INDEX IF EXISTS "uk_core_code_r_tenant__d9e4f5" RENAME TO "uid_core_code_r_tenant__d9e4f5";
ALTER INDEX IF EXISTS "uk_core_code_s_code_ru_g9h4i5" RENAME TO "uid_core_code_s_code_ru_g9h4i5";
ALTER INDEX IF EXISTS "uk_core_custom_tenant__i9j4k5" RENAME TO "uid_core_custom_tenant__i9j4k5";
ALTER INDEX IF EXISTS "uk_core_data_di_tenant__a8b3c4" RENAME TO "uid_core_data_di_tenant__a8b3c4";
ALTER INDEX IF EXISTS "uk_core_dictio_tenant__b9c4d5" RENAME TO "uid_core_dictio_tenant__b9c4d5";
ALTER INDEX IF EXISTS "uk_core_integra_tenant__b1c2d3" RENAME TO "uid_core_integra_tenant__b1c2d3";
ALTER INDEX IF EXISTS "uk_core_languag_tenant__u9v4w5" RENAME TO "uid_core_languag_tenant__u9v4w5";
ALTER INDEX IF EXISTS "uk_core_permiss_tenant__a6de52" RENAME TO "uid_core_permiss_tenant__a6de52";
ALTER INDEX IF EXISTS "uk_core_site_s_tenant__p9q4r5" RENAME TO "uid_core_site_s_tenant__p9q4r5";
ALTER INDEX IF EXISTS "uk_core_system_tenant__c9d4e5" RENAME TO "uid_core_system_tenant__c9d4e5";
ALTER INDEX IF EXISTS "uk_core_users_tenant__26aebd" RENAME TO "uid_core_users_tenant__26aebd";
"""
    pass
