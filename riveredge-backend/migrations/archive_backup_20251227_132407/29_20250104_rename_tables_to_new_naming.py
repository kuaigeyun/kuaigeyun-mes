from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 数据库表重命名迁移
        -- 从植物系命名重构为常规B端命名
        
        -- ============================================
        -- 平台级表重命名 (soil_ → platform_)
        -- ============================================
        ALTER TABLE IF EXISTS "soil_platform_superadmin" RENAME TO "platform_superadmin";
        ALTER TABLE IF EXISTS "soil_packages" RENAME TO "platform_packages";
        
        -- ============================================
        -- 租户管理表重命名 (tree_ → platform_)
        -- ============================================
        ALTER TABLE IF EXISTS "tree_tenants" RENAME TO "platform_tenants";
        ALTER TABLE IF EXISTS "tree_tenant_configs" RENAME TO "platform_tenant_configs";
        ALTER TABLE IF EXISTS "tree_tenant_activity_logs" RENAME TO "platform_tenant_activity_logs";
        
        -- ============================================
        -- 系统级表重命名 (root_ → core_)
        -- ============================================
        ALTER TABLE IF EXISTS "root_menus" RENAME TO "core_menus";
        ALTER TABLE IF EXISTS "root_approval_instances" RENAME TO "core_approval_instances";
        ALTER TABLE IF EXISTS "root_login_logs" RENAME TO "core_login_logs";
        ALTER TABLE IF EXISTS "root_operation_logs" RENAME TO "core_operation_logs";
        ALTER TABLE IF EXISTS "root_message_logs" RENAME TO "core_message_logs";
        ALTER TABLE IF EXISTS "root_data_backups" RENAME TO "core_data_backups";
        ALTER TABLE IF EXISTS "root_user_preferences" RENAME TO "core_user_preferences";
        ALTER TABLE IF EXISTS "root_print_devices" RENAME TO "core_print_devices";
        ALTER TABLE IF EXISTS "root_print_templates" RENAME TO "core_print_templates";
        ALTER TABLE IF EXISTS "root_scripts" RENAME TO "core_scripts";
        ALTER TABLE IF EXISTS "root_electronic_records" RENAME TO "core_electronic_records";
        ALTER TABLE IF EXISTS "root_approval_processes" RENAME TO "core_approval_processes";
        ALTER TABLE IF EXISTS "root_scheduled_tasks" RENAME TO "core_scheduled_tasks";
        ALTER TABLE IF EXISTS "root_message_configs" RENAME TO "core_message_configs";
        ALTER TABLE IF EXISTS "root_message_templates" RENAME TO "core_message_templates";
        ALTER TABLE IF EXISTS "root_datasets" RENAME TO "core_datasets";
        ALTER TABLE IF EXISTS "root_data_sources" RENAME TO "core_data_sources";
        ALTER TABLE IF EXISTS "root_apis" RENAME TO "core_apis";
        ALTER TABLE IF EXISTS "root_files" RENAME TO "core_files";
        ALTER TABLE IF EXISTS "root_integration_configs" RENAME TO "core_integration_configs";
        ALTER TABLE IF EXISTS "root_applications" RENAME TO "core_applications";
        
        -- ============================================
        -- 系统级表重命名 (sys_ → core_)
        -- ============================================
        ALTER TABLE IF EXISTS "sys_users" RENAME TO "core_users";
        ALTER TABLE IF EXISTS "sys_saved_searches" RENAME TO "core_saved_searches";
        ALTER TABLE IF EXISTS "sys_data_dictionaries" RENAME TO "core_data_dictionaries";
        ALTER TABLE IF EXISTS "sys_languages" RENAME TO "core_languages";
        ALTER TABLE IF EXISTS "sys_site_settings" RENAME TO "core_site_settings";
        ALTER TABLE IF EXISTS "sys_invitation_codes" RENAME TO "core_invitation_codes";
        ALTER TABLE IF EXISTS "sys_custom_field_values" RENAME TO "core_custom_field_values";
        ALTER TABLE IF EXISTS "sys_custom_fields" RENAME TO "core_custom_fields";
        ALTER TABLE IF EXISTS "sys_code_rules" RENAME TO "core_code_rules";
        ALTER TABLE IF EXISTS "sys_code_sequences" RENAME TO "core_code_sequences";
        ALTER TABLE IF EXISTS "sys_system_parameters" RENAME TO "core_system_parameters";
        ALTER TABLE IF EXISTS "sys_dictionary_items" RENAME TO "core_dictionary_items";
        ALTER TABLE IF EXISTS "sys_departments" RENAME TO "core_departments";
        ALTER TABLE IF EXISTS "sys_roles" RENAME TO "core_roles";
        ALTER TABLE IF EXISTS "sys_positions" RENAME TO "core_positions";
        ALTER TABLE IF EXISTS "sys_permissions" RENAME TO "core_permissions";
        ALTER TABLE IF EXISTS "sys_role_permissions" RENAME TO "core_role_permissions";
        ALTER TABLE IF EXISTS "sys_user_roles" RENAME TO "core_user_roles";
        
        -- ============================================
        -- 索引重命名（需要根据实际索引名调整）
        -- ============================================
        -- 注意：索引重命名需要手动执行，因为索引名可能不同
        -- 可以使用以下 SQL 查询所有需要重命名的索引：
        -- 
        -- SELECT 
        --     indexname,
        --     REPLACE(indexname, 'soil_', 'platform_') as new_name
        -- FROM pg_indexes 
        -- WHERE schemaname = 'public' AND indexname LIKE 'idx_soil_%'
        -- UNION ALL
        -- SELECT 
        --     indexname,
        --     REPLACE(REPLACE(indexname, 'root_', 'core_'), 'sys_', 'core_') as new_name
        -- FROM pg_indexes 
        -- WHERE schemaname = 'public' AND (indexname LIKE 'idx_root_%' OR indexname LIKE 'idx_sys_%')
        -- UNION ALL
        -- SELECT 
        --     indexname,
        --     REPLACE(indexname, 'tree_', 'platform_') as new_name
        -- FROM pg_indexes 
        -- WHERE schemaname = 'public' AND indexname LIKE 'idx_tree_%';
        --
        -- 然后根据查询结果生成 ALTER INDEX 语句"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 反向重命名（回滚）
        
        -- 系统级表 (core_ → sys_)
        ALTER TABLE IF EXISTS "core_users" RENAME TO "sys_users";
        ALTER TABLE IF EXISTS "core_saved_searches" RENAME TO "sys_saved_searches";
        ALTER TABLE IF EXISTS "core_data_dictionaries" RENAME TO "sys_data_dictionaries";
        ALTER TABLE IF EXISTS "core_languages" RENAME TO "sys_languages";
        ALTER TABLE IF EXISTS "core_site_settings" RENAME TO "sys_site_settings";
        ALTER TABLE IF EXISTS "core_invitation_codes" RENAME TO "sys_invitation_codes";
        ALTER TABLE IF EXISTS "core_custom_field_values" RENAME TO "sys_custom_field_values";
        ALTER TABLE IF EXISTS "core_custom_fields" RENAME TO "sys_custom_fields";
        ALTER TABLE IF EXISTS "core_code_rules" RENAME TO "sys_code_rules";
        ALTER TABLE IF EXISTS "core_code_sequences" RENAME TO "sys_code_sequences";
        ALTER TABLE IF EXISTS "core_system_parameters" RENAME TO "sys_system_parameters";
        ALTER TABLE IF EXISTS "core_dictionary_items" RENAME TO "sys_dictionary_items";
        ALTER TABLE IF EXISTS "core_departments" RENAME TO "sys_departments";
        ALTER TABLE IF EXISTS "core_roles" RENAME TO "sys_roles";
        ALTER TABLE IF EXISTS "core_positions" RENAME TO "sys_positions";
        ALTER TABLE IF EXISTS "core_permissions" RENAME TO "sys_permissions";
        ALTER TABLE IF EXISTS "core_role_permissions" RENAME TO "sys_role_permissions";
        ALTER TABLE IF EXISTS "core_user_roles" RENAME TO "sys_user_roles";
        
        -- 系统级表 (core_ → root_)
        ALTER TABLE IF EXISTS "core_menus" RENAME TO "root_menus";
        ALTER TABLE IF EXISTS "core_approval_instances" RENAME TO "root_approval_instances";
        ALTER TABLE IF EXISTS "core_login_logs" RENAME TO "root_login_logs";
        ALTER TABLE IF EXISTS "core_operation_logs" RENAME TO "root_operation_logs";
        ALTER TABLE IF EXISTS "core_message_logs" RENAME TO "root_message_logs";
        ALTER TABLE IF EXISTS "core_data_backups" RENAME TO "root_data_backups";
        ALTER TABLE IF EXISTS "core_user_preferences" RENAME TO "root_user_preferences";
        ALTER TABLE IF EXISTS "core_print_devices" RENAME TO "root_print_devices";
        ALTER TABLE IF EXISTS "core_print_templates" RENAME TO "root_print_templates";
        ALTER TABLE IF EXISTS "core_scripts" RENAME TO "root_scripts";
        ALTER TABLE IF EXISTS "core_electronic_records" RENAME TO "root_electronic_records";
        ALTER TABLE IF EXISTS "core_approval_processes" RENAME TO "root_approval_processes";
        ALTER TABLE IF EXISTS "core_scheduled_tasks" RENAME TO "root_scheduled_tasks";
        ALTER TABLE IF EXISTS "core_message_configs" RENAME TO "root_message_configs";
        ALTER TABLE IF EXISTS "core_message_templates" RENAME TO "root_message_templates";
        ALTER TABLE IF EXISTS "core_datasets" RENAME TO "root_datasets";
        ALTER TABLE IF EXISTS "core_data_sources" RENAME TO "root_data_sources";
        ALTER TABLE IF EXISTS "core_apis" RENAME TO "root_apis";
        ALTER TABLE IF EXISTS "core_files" RENAME TO "root_files";
        ALTER TABLE IF EXISTS "core_integration_configs" RENAME TO "root_integration_configs";
        ALTER TABLE IF EXISTS "core_applications" RENAME TO "root_applications";
        
        -- 租户管理表 (platform_ → tree_)
        ALTER TABLE IF EXISTS "platform_tenants" RENAME TO "tree_tenants";
        ALTER TABLE IF EXISTS "platform_tenant_configs" RENAME TO "tree_tenant_configs";
        ALTER TABLE IF EXISTS "platform_tenant_activity_logs" RENAME TO "tree_tenant_activity_logs";
        
        -- 平台级表 (platform_ → soil_)
        ALTER TABLE IF EXISTS "platform_superadmin" RENAME TO "soil_platform_superadmin";
        ALTER TABLE IF EXISTS "platform_packages" RENAME TO "soil_packages";"""


MODELS_STATE = (
    "eJztfWuT20hy7V/p6E+2o2dMgsRr4vpGaCTNWnelGVnS2A6vNmg8Ci3usEkuQErTdsx/v/"
    "VAobIKBRIkUQCaXbsRGjYJVBWyHsjMczLzf28fNilaFd+/eP/m9oeb/72Ntlv83/Lb27ub"
    "23X0gMQ39Dr87S6KV/TrZJOjRbRd0muX6xT9jgr8/V/+crtD62i9WyxT8kuC7779693NX2"
    "4f0O7LJmWf9/tl+Un8nuQo2qF0Ee1u/4q/uI3iYpdHyQ43mkWrAuGvtr8tsiVapXTAfHys"
    "n/16+fc9+XuX78mlKcqi/YrcvN6vVtUQU3EF+b58GN5+Gi+SzWr/sBbtppsED2O5vhct3a"
    "M1yslQRVt0VIvd45aO6M169xMdJn3+NXmM5XpX0FHfkyum+AfasTOd+/Ng5s39P+iYiyRf"
    "bnfLDR3A5703i9zPe3eGZm9efd5n2ST4vJ+jWfx5H7oOot8kn/fBFEX4qiBE5VX4O3ca4D"
    "vDCSJ3ZH72ee+7TkB/Dcmwto94MtbViPHwbtnziydh46XP8/On2z/+UIQhDQ9/jpwp/uwH"
    "8ec1/n/Z3RwFeJhuHEbk8zzEn+cBHp4fR/hqfz7x8L8omdN/fT5s3wvmcuvsoTzXycj3k6"
    "n8K2x/NqG/pnMspCBO3eobN8Dte4E3I2Obknac6YSMhI7KCfE3wSRL6fUOeQLYmxtOI3mk"
    "oReSz2EcV6OLk4yMwlGurD+N72VUNqGDPzuIyCNK4qpn0ndCJs6bTjLSOusbkfE7ZCrJhN"
    "/8GBXoHdmayjJwooD0MyG9zZ34hmw1JoRqX7I/xX5jf++3afn3DRGpS7qLYyZAh6yOrNx9"
    "dJuTHfrgPCjfbJyN8g1uMwJfiW1LjwC4catNWO3c2/+T7dcJ2Q4321W0yzb5w/flaRTjp/"
    "9+wXfigjT2f2+lXc6bO7bN+TiObHR+r7zTX36J8sat/hD9vlih9f3uC/5z5ml3+BxN2aRN"
    "+Q7/9Vewi+MspIsPbxPPi/EyCv2ZI34NyK9Tjy6mKf7VpUt2jiaTxp2OR3hgp//7iw8v//"
    "XFh3+Yef9Id7yYLulQPzBntdNWMw/8iIbTILV/1lwcPXW/q07boOX5K7bxjTiApZOtdi54"
    "rj8hu91DtTPi/INXTAN4SbbeOz9v1uj7/S5Zb7417JFov9ss8M8nbBt5IGdN2Cv86275gJ"
    "pmTTslrjPF0nTxcxJZZx55FWbzcut8etko6LTs7Hv+4RY89yJKU/lBdbPx6c271x8/vXj3"
    "ntz6UBR/X9GnePHpNfmFHpEPj8q3/4A3EjkXsSLD1KaqkZv/ePPpX2/Inzf/9cvPr+mQN8"
    "XuPqc9ius+/ZeyBMQ5PfASkAfS3xLwPDLhnhtPnusSoP+9/BzWzipv2/D7cDqZHFF5if4y"
    "Scn5mU3OfpHhbtQ3GbU4DAmPt21YeO5x2c0R1TQDor2y95aiHCTym8yPJvRcDYh+GSceOW"
    "md5vdWO+m7NeHDMZtRJJQezpqJT+j3Rl3iqOS9GbEDguyMVfvp9X9+kk6Wn7kk3734z3+U"
    "Tpe3v/z8J365OFp+fvn2lx8VkW8jvGYMrXfetvH1fnzBB/hx8OcsmF+wXGvrtXRaGBKfaN"
    "34aauVXxBnRGVN5g59n4bkMzGZyYHxp9efmF34/peP/NOv5YdXr9++/vSaG88XHRHTmshz"
    "hOVc7BZfUJSivDB0TGh6OWsO/t/HX34+6aiAMnfDWam3kGaIe2JG7LqMmf1aqf66xi39JV"
    "0mu7ub1bLY/fWAjEmjh48T9eRQNBDSgHqccMFtozx6MD07opMBJmeWONyee5pTFG/SR8MT"
    "xLvof3rmmTt7ehNTbPFjogVxZR21386fm1ov/UyPO09SokMSr4cyHU9xktDv0cN21YWtcH"
    "CWQDf9T5MfzojrPAvipzZNy2IRJbvl12PzU8r+dOVM6uCsmflxs1mhaH2ic4NYae7c8ei/"
    "JXCjmYAYN35A5j/+8stbSeY/vlFthV/f/fgaK2B0AvBFyx1zo9Z8jlgQxWOxQw9HJM2/OU"
    "vUoodBRO0nWUxcuGlWA56C5l+xMZ3Szxk1lyfE5evNG/dMf1OWohVq5SNsPL0O+wP1hjfs"
    "s0+PsBC86g4kdrjXbnKetnfwr9oFrsVnxYpY7Db32AJF+W0Tbk+ajaPkt29Rni5q+F/1iw"
    "L7kWkqcbqflvSpjtML6IV3Kr8gw98eIhgw4gCesPtN/sj+IrewSWVMg+1qE6WLYhft9kWN"
    "fGApB7U1Q3HyOcq8cVIOquEdphy0IhiAtjQEA/ArPueplkQOEUYnwN8QgkHmp/ybMCBtBm"
    "ES8G/godMbzQCM+gnSDMiwXuzwfMf7HSp++Ly+wf9bpj/cmFqYrAcyeNKHWTSe9VWJh3Qo"
    "JrALfJl1QA4pWWAQSanQgNgl/07INLK3JhRNfTGxFtijhhMqJjQLmBJVCakcwSZf3i/X0W"
    "rBh+LOyLp3Q7L6tI1Wj+05M1/eb2xwBwZUdkrPfeKPrj07eFLhJAY3Fcv/qQssdMhpkXDz"
    "lS/VwAmcWq/k6FIb8BM/Lg8n2sA7/LqufQsbQb/jlVHgc1htyXM8srAS1y0fmt6zzdHXJf"
    "q22OcrcoM4fX798Jb1+Ntv5J367/iiG0p2IoOKgwmZDdIUPK/EUPi7tCYPZ1I9VCkPqvWG"
    "k0kore7ovqg9QDAh51PsI8nGpAuZLe1yB2lbBG+oWsMV0nJ4UJUlRxvQGljlOQCVBXYgiI"
    "XoOzHpc8IRNXYxfjOV59yGWPH4ZGN/ZhEWvrRAxUFIt4Sex1AOIwVX6uFu8u60hKyaHmQJ"
    "WZaQZQlZlpBlCVmWkGUJWae8Dx3XPeIQ6M+MOPs1iR9CfU9KxoipOap1MtBkmTW0upyWyl"
    "wzNSVSB0Pxk46aoV1ylSpj1qhIeQfnwTTL++NaYeg4s5nvTGZe4M593w0mlXpY/+mYF7ON"
    "KX+yGvjjmz8RTVB6idRVQ+GJNqOhS+0PRdc92eVx9orXUHllx4lJMUudmD7cj4ta9Qmdfz"
    "LXZAocS4YEqvQw0Nl8ucesy7O7wrDMiBw2PxA3/SRn4gWirflJontTLEXedD+0nS5cqmMk"
    "8lxrSMBJjuqTF7yRUAHLqeqLoCPTEg5L+7aCFs50qKt9DaO/dIOldKjpWJKUJUk1MUoaSF"
    "IX86HeofX+tg0fil54p/KhHvC3R/lQ2yhH4E/c02qJFUD8xAtBfdqi/GFZEItmIVKwFJt8"
    "t9jkKX5Y+rc4rmt0KfK3BBEp10q/1YZw5HrxBPKFlqNFl2wwSxNmlIySoyWG1z4tDGTYzp"
    "GTckckbCsM/FDL1AqmpI/Mc2gLhOzoB9XZ5jsz5n2byK25U3/G+6UgvWBkAYaVdAfV2eYI"
    "kefyyR0M2C25WLQfeH0pcjoulmymaaS856be2FiDiTuvePtUjmVqG38+I+e2W6WzeZoMLz"
    "PL+ooZXtJyEdAM4weVTCh4DWA/8Rc//cZ3Z9Par5w7kzDejdSXlyFug5J2Xqx3N69Qsbxf"
    "38g/QryI+FNuuKuFU2KwnrdZ46OeMWLm5OKIjojKg72U66PWs3yUNxqlzoCdoQmIB7sKXn"
    "mIjaS+yejAtbuzWldB8/5lJ52bJbPDvVbvQ7qilINGdFNuDdAZafTnX9++JRMYkHXL4n28"
    "YBbWzqqyL6EDUAnOCHuUpQXA52/EP5fPNadpBFDkK6c+uOsMGha+kPhb83W0ql1K9ybb6e"
    "GcrjRCcqe38Xs4J05/beXtIxcQBMDzwwR2SU+JWUTf4XD4D2gX1XbClCwbuGMbg6gSGQIK"
    "gzCthjilKz/zpP4M88VgggCyujr0vbSzavAOYtYQtS5ffHz54hXV3/PoW6XOyZqgrE79hB"
    "VifOT8GT1SreoNVqiidYLaWkTa93VQTQl94yg6gpIy44DeoVOmFMWeKpV8mKXw/rAkvtNc"
    "DZbEZ0l8Z9stlsRnSXyWxGdJfFdE4muiaegtxS6pGB1RubR8gX5IXE4L2Z1mQV+AVdTkS+"
    "xwQ/LlTY9hbV7uWehyUVf+CVO0DNj+QDyY890uXfJfVDjC0ElS72Uo3lyHnqkuV7wOqTEw"
    "EbpuhjEVTTrvOjQUATJ3eEYmZ6kncvNjMRS7cT52YB9aXkyPuYa4H/aIrPk3Zwkb9jGMuL"
    "W+6UFFD93nho59tYuhVJ6ugIEuNSACLxgSO2+6pySN5+EjI+WmWorYs6KIyS4NgD0Z8WuA"
    "9s3oXG0ZRb2DYW00MC1dT08uEjPUkq4HbPwvy1WKJ6J3/FNRKMph/vTnD2gVcar6kwYyW9"
    "AhP2xapoejF96pdMh80yY9nK0wd4BKGKYOCYX0nXFSCavhdUAlBG1ltVRq8NdG6h3FJdn1"
    "0C3TdSo3qX/wZOU0pNlU90xPlPRnZAFeM+kPLlSF9Md5b/CaLgvBaDNySXtUBDpxJhdL7K"
    "vyuOAmVTZm0PzroXy7J3LMes/GpfN1nx2YuPuSb/b3X6jB+VjQ9+BCaVb38rmMmLU4rsW8"
    "i9aPnzbk3xoni77IF8pr/X015tbWJVz+4Gwu81ZUpzKdkU1O9Y/f0KMsdx5moNVr5DFVSk"
    "zZiNA7ykZyoq7h5VGlj+c6iVYvkigHxQXlTcAKKMf9K26Oq0mGJ1+rk5w692S8rXVckLOk"
    "flyw47Q6xysOrCD3a1YDnUg6BQdXAx+lug7oljtnBVhCnyX0WUKfJfRZQp9Z750l9FlC3x"
    "UT+rRWYJdMkOstk2rKOr4ADXwmZVL1roKT5WYq98mzqnLUjddlaLKIpeX0ImmLgz8zHFyP"
    "vWrRmAbs1Uw9KeqOaQMYcr+NDBhWLrdDgCG5iLZWT0wi/4SPB+5wwRP6sFyzr1O0jfLdA8"
    "zBggW93JWOR/YFXio2oUndvXfTiAJ1BypCZ2K7GlI3H6Po443Oj9EENkpJljNEsnRMyMHB"
    "oUJpDABKZKkRCc2MvndDDg+6tOYtI7tSSG89/f7mn/5JbojJzfOoU4Um11Z+Dckd5Pb/ri"
    "3df/mJrI3/ZmjZ/IZcUK587c/VrmBfEQWBDdqPfDw4pxwclBSoyOXO3QAORerpE15qbTui"
    "j9z4MBwYmrHRuIg4hd1ZNpFHU9d+SlJxSmuF0c/q6I+Ks+Ep/oW4GP5bjFsjYz5qiuQ2zK"
    "U7D5LD4qXMdJY0hxgsiYsqtoefiqQ1oAUyJADyspw43IUakv0wI66E9r48vtab5A5h7iAl"
    "MC5sNYhjQvt2EaoeF9wL+6z6oYRwZrlpar5J4pukioBqVl/TqDXtUNcy3qETuZ0jyHerQ+"
    "8guAzug2QfDo8D4oIzm9zQFyBrqajygcDABbivJO9t877hQHv5WpQfi8un3F+1GWkv8yYJ"
    "ixGgh2i5UrsPJxE9xmNh3MsRGnRRMTV7IiI6PFKeTz7ABbtgjjyy8CZISm2yjYri2wZrLl"
    "+igqbdcalvgPkV3DnJGOwi+oQTQnot57pq9iZO8sctZU440YTfLZrP8At5oRUwEwwQ84kV"
    "sLwsIY+T4lXHL5QPMvUGtkg6P0pJOQh/MrmRD0rlEeBhqR/X4RORjU7up+mtUva6iordYr"
    "W5Lzv0yarD4ibLyqPnRkaJiDUzQT8NvaV0ESpo77RGCUD++PrTDck/RGFSmNdF1pFrmuWF"
    "uV08h54U9KVX0vxdFOjOyjoxUiJCVTN0Iw1YoTgd5km+kubiKCuAmwojnThoyZictmAyJy"
    "/zbJ5eNG1guCdN2nswCy0z9YgprAgAT47Y0Q2rhw92IGYHoGboJ5ePT8vtgZQQldlRuQ8s"
    "s8MyO54ts6OFrbHLUfe2huWFWF6I5YVYXsjlS4B78S8/yfUzC9ofhuLQtxOmQ+oD9eQYes"
    "dWbQ9UnrFv59TZ06Ip2Ci5uEztnFonQ9XR7Mh91+UEVE5AQ5tDan8gWttpvs0u6W7PgEsi"
    "fL1Ds3YU1PywxC8iXNV7GkT0A3jNh55j6Kw3OcNqPwPOb4fow6CzV2z2eWLqNSMaH1419n"
    "yPoDcoLOvyLddfsVBobsA7Uk+i2KwjPKxNfh+tl/9DszJ8LkusdKz1CpypP4Kd3GePBujZ"
    "KNpVW6WMEmZm01VtD1S62JmTgvQ+fQnOMr9zha5e3C/6Gu2iY8kSz05fWTU+UNLKcEY8rR"
    "PCoBf165qSVko1umW1w2zSyhzb2/lvhuZANN5P7IIbkrzDLLVGR6vXSBxDvNwYknjZcj/i"
    "Zvy0OYqJWkSLcM9R0l29aCOix8+1wzbeYrnOTM2B2kVPKf1YigVqoHhuTEA3nravudjRky"
    "g9bcManlVYgzz5CgXJSJSd0sewaf7GwYs6FbRVKEcm1GO5h/FM0lAsqLPTM+pjK8S0HQoR"
    "EsE1F4cJvUD5Mvly2yZQqLz0DoQKRdVXIEzIhupUvV0ehVM2dCRl1omEqq8o51mbTGBToP"
    "khUCm97M9Gk8i2MCSosukhIKRLhKTNgbDedcOh1pOARPM96PF62Qyig9dfHeXgTsrh2/Jd"
    "8JF20+pdUF56p4aNspEeChy94xGuNIB0X889S+XNo0Zh4XublLZubk6nNMOqk4wzKW01vP"
    "ZJaesRbJoINZbSFbSe1Wrdl9F3YZLKV/oJ9aOTcVCBvacPylKzfvyCVqvy47+9hQAGqDwP"
    "n8nxCPgYzAFbE7k8DDHICBl0vb5HBWU8ZBMSDR5TIAXc2BAG03mu3LrQfC+jU0CqwPgOIt"
    "9ESTzq/Li3netCllxuyeVPklxu0wbWB2Lp4ZYebunhNm1gB7VsgZ7UQdpATZ3aK04bCGQ3"
    "0rSB9H5DwudtDy981dbZAlunELYOPigMkbWuNTsjtAFHlp1x5J64i2RdBuLE8XhoDNny3h"
    "yBoWy8J+oCEHQ4paWus4N1CMlnWv7RnSUOtzjIeYLvnEUEJA8CyuJOCXw6Jdvk4CEzOMlh"
    "yXw1C66umrMyG3oaJJYEeKimJGSKzCMMYeYFPhvcWoory4aaPMm0pVgQ+X69Jg9/WNQXRS"
    "CALoaJ64k9ciD5DuXxkORuZN0OKnhKLcdy6ZVZpXQ6DKEdHhxyqqartZcruRe7aLc/O/FN"
    "29kVvQxEZm+Ybd+JyWaccJuw2CcJKgqmPGTRcoVKaKA8LzqnvFMJoTzfmKK9yx30oyg3ST"
    "t0p6QiYkzhqSrB6jgUaEsrfWa0Un22bC1MLFZED9myP9E2b9tQH8pL7wD1oYqdLRP5CNd2"
    "SX9INw8RT3pdnsosufUqWlsywyGUy1xuawiWmcptDa7R5raGWXxp5ie2CQIUxaKaRAWhyz"
    "mHiXHmoYkupBa24iazKdeC63QAyLwAeYzXlErrQbhfAP03nOYwz9KUMxOYPzeYUkhk4qhZ"
    "km/YMG9ArtKjWX/bLAe54qvEFFEqvrItWLvKTzMl8YvES6GZxsE1Aci1LPpnW1ptW1VzmK"
    "V5d7Nc80/o9+0yR+ndTbEvtghv2RS2Sg6H2nhDwocIw2kZhxtHxTK5u9nmmwzRSpwkChet"
    "dyjf5stCHiTa7fDqrw1T5+v5kVEvyBKbRFKlYKL30eR+IMtrSKZb4jNTVxDP0z7zxK3FDr"
    "9B7pF6M+yLhXazdyNogo7t3Y9SKmMqvqJM/Ur8EqTVaTaaNLOWnHKaHWHJKZaccvYL3pJT"
    "LDnFklMsOeWKyCmNyb+0em6XyEtpsBoxNUXbYxDfhQZAl0Jv5RW+5ebDeZpcBz7h1+v9A5"
    "2AA1nr5YkIj06DsJXOFmhYy8NInCtHhEntp/MkyZvvUY5T5/h6rgzE81emU1uYpenY/l0a"
    "75crfEvxPYHzzzQ6YK/9UCDOMYvHSGSojPQjEzadnDUxUvNjMUPa+iI6sC+AI+OogJ352S"
    "IGXYxRyKf6bDoQvHD49AcXyX32p8Cf5s66Ok1enzNB67NvAIouxoTwtEX4HXTbBhTi196p"
    "AbEp+6F1RCx1BbLMj6LMqiZK1gbD1g8nyauUeKMMiVUHaSIwtt6HGh578/Hf3lIXPK0oGS"
    "OHNX/z4v0b5WszUaj1EV5DLCown8Uu7tIFcVn9KrmsnHzO1HblhQXK5KyKYrJFBtnm/Vbb"
    "m4dKxuHH+Cjy5LarP2ZBGAvCWBDGgjAWhLEgjAVhLAhzHopQ12HNQDHXGydcl+BIo4WvNI"
    "xVY4uOLJgVizl/XJgM1pZ7GCpOQtjbasg2jc0mpmi0XXYeB8EevrMo1gMC7juYFYq0VTDr"
    "KHEcG//YaxgeFl6y7zscRdezDcjrST21gWA2EMwGgg29C+u+aBOKSL2XYbPXG3eRn52a/h"
    "BG1QC2monKe48viahQjyOw/No7XVzelv1YR2FtAJ5UuIlzx/oIwIOhTKYC8GAf0AzgqCb8"
    "/dIAPOl5mIYLq5jS2qSKKTKmcLtWky+H28EnVsPtePAavEa1bVkk7Xt8JQWdGdQ9k7rqJt"
    "xs8RB3E3EWrVb43brNNwt8HLExQVtmOp9ShrBc8/r9h1+IIBCFWMiwWTyi2H2qnIQXppRl"
    "vkxqAp8jUh2QWbGHQtwyFO32+BVcmzAnJJ1MSMof15lWEajcQm6MALQxcxautXCthWstXH"
    "tlZpiFay1ce71wrV5Z7RKobRFvdLbwxhNspFfoz5djLdiobfDK2bK04SvQMDIpZbmXMYp6"
    "gCAW2YY8In7+zRm15WrdDIPvtbOJBwX/rpTeoXcpjAPvoS4NQ8Ku2j5LzD+tNtH5cj7uld"
    "HIPyNdHpiBV7/8+uPb13jPvH755uObkmdQaYP0R3mJf3j94q0icO4Gaq/aVyG8hPpwpg8E"
    "9toP8eNCF5dmdkZS97HRY96AyFwMvrzE//mwX7VDX6qL79QAOAIFLXL806EQOBvcdrTSY0"
    "hcQXgVh6MMa/Mz4kpkxE0x1PbBbTBQC7bluzT+1aEADWhXDWj7LJUZYEUIPJegJiyCln3D"
    "iKLujJzRrBRB1+FtsAqk5vnSbFrlhmyQ2IgD3g6gR2aWZwkj7FkfZl3arK9KPHKWxC6ctD"
    "J2Bqdcxc7IQahe0yUzusqemLOckWpf7C0ZZDEqCZI6wEra5QpgVaC/k+TjOUOIwKYLUp/m"
    "KCGRne4EK0ngcrRVr2a1UvFLLxPX4SGjHX2fqFfjrV9hq/JRMY3W6CvK2QpPo+XqkX182K"
    "x3X/gfjyjK8We2potF8YhH9KAifBBnVo6joPlXjiMjDbGn6pDxMGuQYkWPtOCbBd8s+GbB"
    "Nwu+XSXyYsE3C75dL/im13a7BN+uN0rSlBVwtvTr8ZHClDA1BXIPQ9UEPmAjnS1NTWXgK8"
    "Uj9BbjOPCIymI9IvDpWatXan0savAhu7wDnZYb9QYFyhofozyF56IjSQq3h6ETod7JMLHQ"
    "nXt0LjiYNeVImVvIGGgv9TAIXt+9h2tQaN9GUPdHorARnM8qglOfofUoDtgAV5sJIHwbre"
    "/3bSMIq4vvVAx7Vf5iIeyLIOyY1DcLoslklBC2GF572Bq+DyGEzCBe2GJ72BjGCNZhY9gm"
    "5LQMB2TDET1R8NrIwrxC8LoCpsGUqy6pNx9/ufFm4XfTavRh4LA18D9f2DyhNfvv3yItMg"
    "5XuEDGub+rao1H+npu4LP2Xq/vV8vii8r/oAG9UaiEsBKdbcH7ZBe5/sxkn/jgXBeriByI"
    "rAhjRg6PIE6nfCG5cRzCHEV8+gVHzXPmE8pgDuX72UKlkHq5mCRwuXx/qOhyiAhnJogjeR"
    "ufBkkXm3y32OQpyumVM5LBmVlxYUAI1fSzBa9PsCkseG3BawteW/B61OafBa8teH1d+Ou0"
    "AfXrVtm9APRWX4BXQBhowrzN2gAdQt/AkDCkhig9DJSq2ayB1OGEQCur/duoi3qFas891S"
    "w0bkVqJmcMmXH5PB6e44uwONDFINCO3j63gNqzANSEX+WIqM8r4ik3PxbzVu8+6sBKtfCk"
    "hSebMJ5+IcnN/XKN/7ltBUnyi+9qkCT5hfx7FJMkqU40pSTJ17Q3+hdrbrmFf5WlwmtwJv"
    "lb9r3BHqRf6g3JIm3TqnKdBVOZ2ufR1DuZ63Kd2s1Sf5TAqn6oh0HWICauFHZPU3JXSYsF"
    "fbjJNKUarVs9JgUTPVpWksUSs9QArKSmG84IWyF13O5h1DLWt0ECYyt6qYdNCZtxLk1Xyf"
    "cKaSKdIAymNzL0SkqJipef0mo5JSBzLhQJQwrwN57sWHWT2bTimdG0MfMMkWzZ7iykk+rJ"
    "7zRtgU6LEN1ahMgiRBYhsgiRRYgsQtTzEhD6vIGjGLQ+moMYaH0ipSM4k6HOCnRQtjwYAY"
    "8lr2JqEstP2NGZXJl/5qZj4JhTKF4sWCrSzK8gi2lItM3MDXXaKXxdwlJyFwJ4NbCiMrsv"
    "nwXtaQfbHwY4ErPw5n0FIPnz82N/64gPd4UkkcGIyXonAwWhSqcGFac/iasAHS+g5hDW5I"
    "i4sa0/Iws4nAhL+Gg2wrPDVpmIUvTVXGpHtYuh1zR1VFCVelKeLO9fMqP63SZerhBPM9ax"
    "8Jv2QJxvvhVH8YLLhA/6GMEO8NI5C0WjxXh4csc+1nnp1DR6cIs+hgnGlDQYJyYG/YRTX4"
    "p9kqCiYKs9i/BiTy8WtSpp0uw+RwtsthXGTvZ6J32l5xUqnzuj7kjqE2ujHEL36Fky7yyI"
    "Xh8FdtTj2wC5XIyuvN8Uy3IcLUrG8YvvVHRlW/5yFFxJ0TbKdw9IGwMGIFYbE9YQEzYhlU"
    "nn2TwdJXQhhndCTBhwrEG4ArZVBw3gr1LsFagS6TqzCfeUsrvY44cuCp5s7JWRBXCFsVdV"
    "eBRcKE2JQ8E1mpRBsm50cuJQNREo3CNKIlDpeKShPBSzcxMXwcUrpMSmAU692AA3xSOhZP"
    "EWiya1+tSwJJt806JTFp2y6NTQ0IRFpyw6ZdEpm3yzayBErzF2CWN0FPyle4kNnHvTkCLd"
    "oef3WpNFaq2K4fxcssih08eU0JU+xqLAGbHgGkz5mtnfhb5n4yq6jKuw8UA2wZ6NYOkxgk"
    "XrkT4ZTpGJQF3AmHz5nLVDyzH+9OcPaFURLFrtU/A2UhzsyruIvYVYLIHG5V3ZwDcc+8Hv"
    "3TpzXbfKSv/ZrxwVJxuIj7wUzB8t4SvSxodNy5p71cV3KnxFyXD5RldzT4rVIZfQPywaxY"
    "6dSlNpBCM6DIupKIHfEQZDit/PgeM7MuRzEHQC18GS0SyqBbbInZsk3N6fUeiYetkqZ2gk"
    "7w8e+AGhJqmHJoAqLDMARLr+YWvS87ZoDfZ+BFFqM4mll57tBYrYaPiZRzVZenTCBsv9xM"
    "qj8Qc8oUG6ZWGDbRAHAzhCZ0xdvZNrhFTdC6e/A0Wan8WGhA6aH4vQL90iffr+z9Sph/Lz"
    "3+Iu0l/Wq0euf+iV7Kbj5Aw1WlgPT0GLPvHd26Be/wUeZZIudRGHCU9uRDTi/baVGggury"
    "mC9IiP6Y/H48Sr0HB2A5t++EWRbPg3TbHhVpFkZgmALBk3eI6ycVKc9EM9rHn6cUTSP88n"
    "XvP9+N+YwfCfqzhr0DrND4U/e6ZirmFvY4uzbkGZsuwQyw6x7BDLDrHskMGpAZYdYtkhT5"
    "8d0hRNBfWkDtghmngpaE4YkqHSxUCl66DGmdAIGJosh2yTDI/iO647hFOiuBIVcLnGxzqB"
    "wiP6a0ActOzXjiOpJAvO7CRUfQw/C8Fsgq151+OHVQQnYVIGTZRq+neyWkF/IE/7Ha+wY2"
    "ZGaB9d4m+6bVH10U9KWmkKqOxgpSKYMtjzw+SGLpgbluXgho51vHlns+UKLbYRXoBmZkxq"
    "3zjn7fgOgnZ6kNLyjllQAfGStwxcCf0DF9Ld6jGhREItbNmLZmBYG1U/AZWd2ofg6/YolU"
    "ux/B9TRE+p/fNYBMv74yZp6Dizme9MZl7gzn3fDSaVbVr/qQElbtgfbugQbDRhPiQ6TdSp"
    "EzhBc+qQw/boj2/+RExS6azSMNqMhqIPHYQuqVVKEPoWrVM8Hva6zvfrdfVHH+Hpy/X6Hh"
    "WkYvLanJ+m3skgNPI3bBgE2c5SkvUxmCf686jJCdx17hxaUL1nPpzcZ49OGGikZbQqBq3V"
    "fjFs9zTM72TzsO2f/Kj2OtB0x0GVtfaZTDfK802+eMDHd1mN18CxWuujn7CG0CXVkIOYMp"
    "4yRAqiTDwdD3vI9B3HIcEGQLwT6PvjZp8n6LYt9F1efqeFvgv64yHo+44ndqf5xyvEW4Dh"
    "tqRzS5zbQ+E4Czurg2yfyoPh1tCokkok08GXuchrfZQYdR3TDpNU2WIonMkeQ9Lvi/dvdM"
    "2aAcvr/VjI/AcLmbP9YyFzC5kfP3UtZG4hcwuZW8j8iiDzpoQKdW1p1GkV9GfjoHkV6hLU"
    "ZFeQFQWbXaFDN4TGJBpZjgWTbJFhaSIaW0shi/AD9u8rZvVQ8ZUfN+v7TcrssGm0XYIE01"
    "0iG/i5suW9ubOHt94PHyHIUiLrWUR8DVMSHuxnHvNLlCVyvYCWvM0mzcybwakHNtNCjzVu"
    "8cjXKCHPeljY/JuzpC11MozA08yB+2NQsa+iYidk0ivUo+26R2vBLwvdI/mweiZ4D5U+BW"
    "QM6VhyBz2pWA1zOjYEyKaYsSlmjhoHHZdKBisu2kUF2nVKXuo3A41MxdOgQEEzzNUqvxnA"
    "OrGkbvn+OTPDzKsq+9ptK4RVXH5XQ1hFIrcDACuFTvGFsETCQ7SO7kEeGlso4aibX5dqb0"
    "QYKyxEcGmhBNhWHUX1gilpPfMIMIlSWt9KMJJ9Z+ZRZHAit6NkfwphcWMBjEp3gKw0rMa0"
    "lA2H9lMfKRtXydZpGOmIIdQDaXXMLMArLtQgLaaGQg3wGuOFGqQ9qhRqECeyemWQTjNafG"
    "hGOo6jsxLkNFZpqF4MdDaUTSW6KpcVeNWSRn/+9e3bGx5W4oe0lDitf6fsy1MqQvBnm1Nx"
    "o8hX5SbuEi2PpYKEeBMyuXZoTrVTqjakOB/R58kYXr74+PLFK6qB5tG36nUNlIHa6/InrF"
    "cs79d/Ro/0rfkGvzCjNWN3tdHFtKfy0TyAUrHP5rfLId1M0pIa1TPLRbFcFMtFsVwUy0Wx"
    "XBTLRbFclC64KHorY4QslPEV9zBlfFn6ydEoGK0lOg4MBPgmzUhc7mAsqpsRk9+W9TA8a9"
    "04MTqQviWn2DIgFqM1rshKrjMD7yapfTOHXFvAq3dfXpsjT4uX67GvBqS8DSh+PSVZTp2+"
    "hpIsUjG07oqySFbOl+UqxYv/yYp95L7vFtSEdywY/+3m/rYNNQFcfqdSE8q4/sVqc39C3v"
    "MdeiB+8zL9Uxn9TajK4AsRIg5ToCtJWmokBtY68NjCm6UfODe98YIcJcvtshR341WWQVE/"
    "l9IgYGQ7YrLTIjiZ646STQGH6s7SKfVDTOGwD7MspOsa2nJnAVFqZ5mjMeVEth83JQSIee"
    "YSGkY6n34uywjNsyA2Fo2unSkbk25xQIsDqtNgcUCLA1oc0OKAFgdssQRkBd/Ugaz0MVAO"
    "2VohK8/3M/KS7PDlBq0jM9JUehheliJ+tGNZXnHAM1DnRajz2aKrRytLJrGR4omwg4HqNP"
    "CIQOLlCSYTl6tV4SSiFbniKTNHqAOOpAb1CR8W23c+/14uctlJ3Hg9Kes+/htKuiSeSiCc"
    "aH2gWSidBEGoA4HOlhoeys7g8gXN9xT7CH0O1GHixvHp68wIvv81ypcmay5I7feT30C836"
    "mLp6ow4k5IVoOnleXgynOZAwfcwVzmhfSHzWXeKWuubS7z1m7QrlOb2wTIg7waCgIw9ppO"
    "XnTYoycInEHPJMGE5cw8M86MPq/BSaiaWCndpjh/j/KHZVGwUR1HucHldyrKva1+Owpyiy"
    "zmWF4sYzoLzK+aYDNvweJyrfjzGdkh7khTmlfDOyHcntI+fJRmcrg9bKuOzsJfGUmehdvC"
    "YHisMflUOZpVbc5JknOmLlUYca0lRreXrRKCCwXpfM4SaPwgN8UZLYFzQzhSPzAwpaz+s1"
    "mhH/DfKQ/MHSUefCDA3sySu+IAe7igmgLsmxZdU4rR0xZjOSB+pJIOxeW8E74/yUIoJckX"
    "sFi5sLko4RH7DWtfWvZ0xYt1xz4z5eNALgDpAFFyASjvBPXyemlTBpaVPUe7qDRUyXkGh2"
    "A4+L3OrAAe4s0FDp/dl3yzv/9CFfbHYkHaUl+956chaoqYXxx9172L1o+fNuTfWqw81R0W"
    "iibxAY+7rRIZhCnJC+j4jox+qG8MOgmbnKo8v6HHSjOh8i5NfD1tkI+m0pjK28Hi43y3FV"
    "0LFQValnwj4dBSaiylxlJqLKXGpKVtKTWWUvPMKTVXHFqvty+69PNfQYGHNsIzYHh1OQuV"
    "R8zQTMD2h8l0cJFRerao6+kMmGVrSs6i9YGKmnRhrXco7StNHqF3XYwDQVTd6Ue0Iq4UnW"
    "cuajobiODX6B2aRsI7VG4JJyQzNqH1ZGXPcwg9SOUxBRMqa68WXqZA9raql3fIlbBwooUT"
    "mzCYBtjwxATpLbHEF9vtaplEu7ZgIrz+TkUTI/HjCXAiCJW1Iae1zYOo18V1xpm0WwzvMI"
    "oICyB7M+IZniNyEjBtHbaS1YseUxyNsdzwZ8K2ynxS1p6WVnZnfsC/6TqWFCbwZv7JIEjc"
    "StxpNuX+bPgEI44lPYAdmlloV4wdwilvwg7hNV2WJ9QCctJeVAC5ZVK/xvUymrJh4pdz8Y"
    "GkwvYcIv8gJSvfzXjyBtbKV5QXms58Z0669J2kBDM3eHUtttHui3ola9Z3Z1OpC3oXWu/y"
    "x8V2gw+i2kinnkt3IxHgJA6FJkgjaSLaKJ1EdqrA0ZPnucGPBp/jAa33CxYXRAHXWUoPEr"
    "exuJu4FWjMLQFiGEWl6p889XfxWOzQg5r6G9ItgDhOyxeOL1wSXG+1QmntWlq7C5xs7ZOc"
    "DwPHWlTOonIWlbOonEXlLCpnUTmLyp0HLOk1d4vKtUEoTFk0FrQ4+lbSmnfjAC2IeWlI1r"
    "zpgaK19QbzBUhAbbmWRrUh8YHWB4pX1ToKOoRShLfBkAjlDkawDvVelC7XJPDFGBKq0oPx"
    "l1mL3a04mS54I9XkCRxOhuSp9NBP1oB2jjONIAfPEaC48QxNiqaXUXGpulR5Ky/mEVnyb8"
    "7K3y96GCR/v94hq5Fif7n8bdWEHiVdOdJNrnGpk2EErsACg4rdFmWpQJcOfLuWd2R5R02s"
    "DbEieuAdvdwXu83DTxWV5xjvCF5/p/KOEvoj76latnriEb2VxQJa0lED6aiijYySdFR2DB"
    "ITSKzNlskMJFqRXA1EISDhR6d3TSjpiD46TWDgpUQdLClJB8dklpgk+qwTk1qN66lRlYws"
    "z2umKgHZNlKVwDXdU5XEoUv7ApwYtpXoqOiV4iBQR6VmDdih38uFtN4/xDzqRMREFFjvSH"
    "Z8Jf6+i3KyIETSUv78nAYE+2r0ZtDpdcmIJ2TZh4jkSgziiEwyzZXIEqWGEeEmYlkQF11I"
    "5sx1pmH1Ky0JihW7sD4e/G5AK3U4jKTlxz6qaO3ejAg+pBlaxZRCptIqStCXzark8bgzj9"
    "j+GX2uGKv5nB2Uo7/vl7mGHJQRqqMbeLGgKaEoT76QqaxdTA8kbz4lKyN1HHEL1q8P3CD0"
    "3BOpR635T5ajZDlKZ/u5LEfpB8tRshyl0VizlqNkOUrPhKOkVdm7BGyumKNkyJS5ABGuqR"
    "HCCWVoCuQeBpoIrZ3XoRjBeA2JUe5hIApNoxE8jc43gjuk4BhlNvRNahjaDTBGugR1Shia"
    "36rtEbxpT/OzdPk2Bt4aU2QUuYeheGyKG+qCU0hHQeHOLJMAPexjGHy+8swNTYgQDkGD9B"
    "O5k2Ekrrg3B5d76VU1KXXQxZAyr3zAloVyNSwUS1rra91avo/l+7QnTLRjAMmehY74QO/x"
    "Etm9Ql+XCbptVdQEXH9Xq2pCflyk9NdDfKBq+Eoaouo7uiboJ3Gi8D/53uF/b9ar5dpyih"
    "pfJg6p7eHOCCwUxDEFjSb+KPlF+qGewCyiiYlgyiOJu0MfoUyD39CTJgkSQ9hCkh8SXqmS"
    "Iso8LPib2URun1VzLeu4Zu6UEtmT5mvmKJzKvwKqgmA0gd/nqORDTWWGUjihyVgzAh+Kcn"
    "gZbgCfQCToxnM8n9XQq5y09HbmIFE67IhCdXgCfC+jU0sUIN9BZDqjJB41YcpSEyw1wVIT"
    "LDXBUhMGx6UtNcFSE54+NaHJhQ/1pA6oCdpi9tdKTYCyGys1wSCa3hOO3kL4qt202iTRqg"
    "TS0e7bJv+tVMFXm316BJ61iWoaxTy2RDWdMRUazpae8y8ASeupCnJNFF6kg1atJ6lsZpEL"
    "a6hz0x9axe4scbjOPG6SwpL5FhZcpTJnCTX0NAiBAXhUprQiAp4pYQmx2fb8MGlww0DXC5"
    "z2rvkNFvLpER7m4jws6otIEKCLQYQNGVfiGBxa8CUGYFDuoodh1rhP83iheFg4fhXh0xeP"
    "fY2SvtFNbdc9Wtb+hNWSQ/JLXA5Ru1qzel9E9wiLf380Mdl5RAyl/bF4OSHU5cUEhSKv+Q"
    "6clXQ174sh9hDodZjtIwn1eWwfSwexdJA2+LZYHT2kgvkYfUXpR0ryvG1D/YDX36nUj4L8"
    "WFJGNdwPUp2yygSzJWc9zevJyB4SflZeSKQrX4aVsC02AFFa/VlgE478aZkebHmJLAD4vP"
    "WmrCrLTSPVozvixjxLUx6YoR/FMRKHCOko3wvOzJfbLXkDDa3rksc4lBgSR5wY4k59+n0U"
    "N7dzJAPKySI+mHAE3KfwLpJLsNQyqwLbSLTHSqSwR5FmgkuvQSZlpS2ALgaTiSulvOA7lf"
    "QWBj7hnvieUytnpELEMxrd4RCmDszyA1s4Ou1KypWmK9X0K9XxUctjAVZJVUmo+sZHKSUW"
    "+HTIqSevV6m2EDusarWFqKMQP2GZCISdmFh4efRQqA8AfYDct3gjbxeQUMUm3LCslvqJbl"
    "ktltViWS1PzX6wrBbLapHcb5VVZAI/Bc2P5iTW6aznaKgdnMHCEDUkf6kD0+wi19UKXK+2"
    "n61Q4G5UjeIKqFmNaf6PWh0dY7ql6+OwNC8CvEQPwwBeLY2uoZHH0iVlcCJED8PUXqgM1k"
    "FFLdnJ7fWgeL9c7Zbr4nvCjznTYKx13Q/J6AxHgGaGBmEHab3fpzkJGzzhlzu98Qr7iHY7"
    "NnstnN7g+rua0xv/uCjYr0fzn9vYxAYeHTlhRhmP6EfkvcMKn4uhnuDKroW9wRYhcRBSAY"
    "9mII8onBpyvw+7Bo4PfyZga+YazoAOn6CeAb1JeiMO5SODmmdzj1I86BQliXDeC08u8Lqx"
    "ZzUyZ00ghJldM8I07HVaflcSFoPgp7csWJ4d7FDuMc+ZT3ifCgnYeuStR9565K1H3nrkr9"
    "Qdaz3yz90jD62+Pl0Rotc+Q5260InG4pywvEzLy1R0jKN2foM3SvLxXOyaeon/8xHhPtYt"
    "c3FJN9ScU4QluijKn+veKfpzvl8hUaBPfhbrnypjvt1ZNs58WX5GrBIWyC6G2t4/JVnToC"
    "2YMbuEVjPKXHbIiQ57YsTKcJpoPVld+57YewWmhSpHB0fEPjtT/8l5muBKuYHbUxAR+aIq"
    "FxpDxapU/2zcjEkJmqpGfLC2n5GlLkrd8WdRy9Dp1x3wATW0XhtJX7X9kn2eI9wDPlnps+"
    "h3Br0Uv4HQbkFWAeXFgl3iucR/6vnTTDcsvFNCds0/00Uf/DNp25/LbQCnnfUeWe+R9R5Z"
    "75H1Ho3V7rDeI+s9UhJtVcbX5eexfoMrfYzlTDaj/XVxNAvN7sicnBfjrrQ/mvnQarAdyF"
    "Oov4ZUDrmDs8+vk84uE1r8saPugNTJGWV9mtanWdd8j/qGGn2a6oujSx/nL1uyDPAo327a"
    "8e+kG+5UH+eG/7pYbY4z8ESlASkcXTRC14PyHR4HFoX67Sb+G0p24AbI7msMaq//cvA2/S"
    "CawuUtv1BDoU2oK8xN+GHtZuk4fbn6oR725QaA0eQnGWPKZ81t1YPkoY8Ttsb8up4zj3W/"
    "GioJ0DDqJ1gSQD+opgcsQ98ZsTJDVLGYVeUslNcX+cZDxHCKyTfs3pBm1wnCYHojjwu3cC"
    "PezbZ4gXULWregdQtat+BYVHfrFrRuwWcd5g11IhHUCfMoT71OUlYJISvmniFZ13sZJve+"
    "JGAl9z4766E+W1axpxoj+/x1ib59NpOGv2bemtFAdN0MFiYOLIDSsHN9WQFhmaRgETuWGz"
    "4IUxKZ7/iO/GsHU6MJMdd7OkxPkNLXCGaJaepBQkJU1e3zKz5O2ex82KxQbzNhTFVv6GmM"
    "rwoxLW9edfpKKJ+8hRHbmZSHNVT1UiXGaodGpnhmPERsEZ6NTLSWLeinn+Irkhypw9CN41"
    "AkrgEHf1Wa5czDwkiBluWWaMpYQz0W0XB27Q6pg6GVoTfvO1RkqF4d3Ztb13IH/SxoKQ8r"
    "q5hF9Y1yQafzjEL2REf3qKdKDmEfybLOCf+92C0eEB6JqSO93olxzaUhVocifMmc5gohp4"
    "+XpCzaOfjT609MV3n/y8dPHekq6j7gcugoVdYhUfeULMttLMUnJN1BsiyXqX1aIPc4MNQA"
    "5F6M1X6irtuXrLZWG6xWuuEOYLXcy78ovcGsXtfxjCn0ssVv6FGHnIIfLdz5A+Om8Ii7Pp"
    "J+S1gfiPU7PztKECNWs91rzo5yAF6jgBjoHeJ6AM3L6um1ASPNdUj9dvwNTT9OmFFlNhMw"
    "2iOhFK2moXVicNkBltRHe0OZEKylgmSxCDwl+oJvFHlwoFUl14YXkKoErNSldD2P/5Rb/h"
    "qt9kht253MEhEr+mM9WZWCRLshATI9f17luWJYi4/SGfm+zLJS9gyWvtqxol7ratrb5Bz6"
    "F67FUceBo2rn4ekAqS2OrF2O9EeWhVItlGqhVAuldhBhUZkHhg5kuYeBsIpu1Lku8QqoFL"
    "bffV0kR1F77idByklK70iToFxlOfTTjILh3JV6+v5R47rB63PES3KRQ+gdKkiZzhM8QvId"
    "dyp9/4H93MIfdMer3lE/UMW6F4x+8avlwdfVgTQIuANFrKZx8uC1Qz3mVQppqbd5RZqWCB"
    "IwTyh9hJJvDnpyZ+mUngbTWt6qgHwfIVAgjrTso5T7pcpvIpajnrQPv/dmUVC1TAvB43t5"
    "BlJTTPoGGT5BJr31q1i/iuWnW366daoMblFbp8qzd6pccQUnyYw3UrWJWiiGhMfbHoZWJW"
    "G1jCpE487rrqg69upHk5hHqDMXles4ze+tcylaJqn+PdGVnQZOG1D2VYYyeoiWK6ZlFw8F"
    "+4AbR/k6Kr/e7osvFwrbqQn7WTmUhnMc1b2uZl3dw/hUFV5hmXraC4in1c0mzWzDwf2qy2"
    "IRYTXo67GDp1zgZxWHEx0MU6Vv7pRuIM0E9FqHj4vzsKj5N2fJGnQxiLBDlNJEDNEc7pBB"
    "BW9zDdlcQ218tm3BCuLDvximeI+Xw+4TeiC+O3TbBqaQ77hTYYot+XmxK39vDVPowAkBXY"
    "jDm//Jd4tFMRpQDIcmqptRRxddWp7vZ+NEMbRDNYJiNPSkY1hSn2FI6OTwStVoeP/qJ2Yb"
    "/Ound2/Zp//Y5CmMGQDABeh+jjKWLmj6WS4TSGGPICPezPX6HhXU0Z9NHMrZJRn0HI8QFI"
    "J50kjZNIWUNEjPIiUWKbFIiUVKLFJikRKLlFik5DkiJU5TegygJ3WAlDjPCSmBsrNIyYDC"
    "V42ebcpiC6dfdg8lNPJNMXo6lPGVAiSSpTs+gKSjxCNNCEnP+UbgKazkGxGG+3+SD2wJt0"
    "BMnjJupdsEfcNWcE5UFqkWtiKfw8ChoRjEUeJ7jlyBsuSQBiQJB7vr4Hk0POTF/DsLrtaa"
    "s0YbehqEPQK8WtMsZRYmDIckM+z5YdLgCoPuL+iQ6joyx+KRFo80hUeKo29Qwe/LcJL90T"
    "f9eSV8lPbH4gWDOIYX05nAR1AHzqxVhI/YfdEzwqv22qPjgibSx1YtUoQqJXq4Wq+FhfMt"
    "nN8GvOwVzv+YfEEkb2/6KSp+u20D58t33KlwfsF/Xuzw72dEHeIFen+P8sXhOEQF4LeAfn"
    "0LUsSbbT4BHo8S0NcP1QSg39RTCWc788nnshA6/DWcEMPjqHlhBkVvGrJF0X+wKHqpoVoU"
    "3aLoFkW3KLpF0S2K3noJXAGK3hRvKJElbbzhSUAulN1IUfQrRXgl02dkCO8VEBcaQjwlm0"
    "olLjC5szuYgRNtl4skWq06IS/Uozsl74cpeSt9DCP3ICT5qFluIFbkoF5Ba7MGYbVfeVgt"
    "q6VlSPBmYz3rvfQDnteF3QpCHyUMTvyKpqdJ7qKfOZI8Tk92dixJQUNSqDI03+gutGSE1j"
    "bbGMkI+X69Jg9/WNQXkRFAF4MI24s9Alr5DgXv0gnzeA8qeApjY7n0j52LToeBzsUEPBvo"
    "vJJ7sYt2e1NF1DS9DJR1pmG2fScmm3HCzfFinySoKFPPZNFyhdLO9WIqFJTnm9yk1KsOeu"
    "L3AgGH7jSk1XEymA5lHFa3pYxYykgbeFysjh4oI3h2o1dLqnJH+eNtG86IcsudShqh+G7K"
    "L1gezALx1+aE1JoyZhW/BH4NyCOWLFIuMZcyJfxglAQRiIeKobYniPgJ2TU+ShnPIq0yFD"
    "S0q3iiFI4GvBKmYhB8CY7p1q9nZSG6ZopIowDPXU5Ymk0Fm0SMZcRMkQMF4Mws1bIY2Z71"
    "YZZQcbA6XRcUAdYBObZkgUEwjBeZS2vXdAn6aAvKSTtY1I5gc1wsisdihx5YNThhgsItDB"
    "soZdXwKx5zyreHqjxUHbJ3gdqhcDDYknaWCmWpUJYKZalQV2NnWSqUpUI9DyqUXvvrEmy6"
    "XiqUKa34bOk/GyqU3kQYh1O2MlFMIn6ih0EAv+6traFRWouH9yJpi1hYxKKNv7YbxALscH"
    "xadoELV3edtYfLQf705w9oFfE3ZqulBGu4187bJsdlzcmpW14cgqnglzf8xUL2EB9aubX+"
    "aIsBya21woBqA1AwoOr3RTWZhyAgeH35VbHJd4tNnuK1ZKOCjwE9DIsYJdxTB0zaAj2NgA"
    "4DP6a+T4ZNIvCr+twHwB12jZu4iPfFtP36leMAdCRw6cnCOt0vzCsEd6TTj8pP+waBHNS2"
    "7xDWAT7I0Eo3MZ/Lkvd+7Fc1fD1vRkzecBZJEBNojtaN1zcn6rp3iCuVI1XQJXwUb3IKyo"
    "BHCAOSPCxwfKeSlZwgX7HsXYdysyNyDXxwgCkl5YC8DPG+tC2X14v3Fh3bjIT0s+fGjxGV"
    "n0eFVgGFX6J19Kt94RcN0/2pt+fFx5cvXlFtNY++VW91RU+ovVl/wrrH8n79Z/RIX7Bv8L"
    "s1WidoRIpbjTvTqLhZ/NDihxY/tPihxQ8tfmjxw17jE7CybAoDqxofAYJ4jgHQJdZIzQhT"
    "gq4aH42gzzGNuhT3M0AXVUNxHBgjNVQNibxqe6DgplNM7y4jmYhVbkikvOmBaApH3QwdEg"
    "6Aj/2wLM/LAS03Pxa7Q++S6cB8sMC0BaYtMG0+9bbqAzShPtY6MXN6tUb6zHkm25xyDZGM"
    "zcBeO0ZATchMab88qvHN+utyRzH7l4R00AbRVm65UxHtZfX7ghAZzgxqtMA1XTrhJCBx8H"
    "HmMxbmKIFrdZCHgWvfnRIIyZnSWHQ1hTVsiwG5+BESQEFVKlDry1SQI94l7Tszj/dCUliT"
    "GHjaO3g9mASx4bPWQey63J4miG1ykV4hiM2jD+vT38SwZoN2E5KnXT9o9BAtV2qj4SQi+y"
    "2Op00WErs5x6pu+byw/k4Qpg4zU8/A05Omzohpty/wCrqpElKEjt+4kdn0k7ottEIOhXXT"
    "zDl8Pfp9u8TaUQnuNm38QyIZC+Js8c3TfAUW37T4psU3Lb5p8U2Lb168BGohfp1ZlsMG+H"
    "WjeHboXafaq6E3XtX2QPDmaQp5lzBmqdYbkitofSx6hEnjpQOlgls+RyZkepZ+DRsfy3wc"
    "N+86kKqwDY0gc3LzY5HsIRO4A5kK+7k/1Ejusz815zTvwFXrOxaWtbCshWX7ixc+hJs04I"
    "IXA34f8P55j/KHZVGwcRwH/JRb7lTAj2qC2+qCOuDHVUUK8okL6VcW51Ng60bwpDu8TujG"
    "35E333xWwWUAPD8YewquE41xoA22yF2oIbF7ZvGE+/Iql2vEW2PZNTgYByNOpR5ghCiE+k"
    "Hi0Xr/sDXpeVu0Bns/FszZYhJriIvWUKGuaAibgVoaxWNBt1wBG5R2FYNW+GOe0CzYxBJg"
    "1QLj6B656M581W76Edqvly6FDjR/+XQ2JPpaJ2OZgG42TZ/4w5n64VBYwy3uIv1lvXosX6"
    "gnYA9nqoRCE34KGuGJb+ZG8hg43DT61kUK5K8Fyt/nKEM5IgHDbRRI5ZaaArnHvy+21QVH"
    "GWMUS2afyJ0VkczSx2rIKvMNOTPCS5rMiaUV+ukoSWT6oR7LgeKSE3oSBfL9ZY4Q0EoQx0"
    "QD5ZXlEk6Q8hyUVGIIQpbTZEoLo5C7IqI3sm/CCcWgfaIrwtZYPcyuSWTsCZpk4nsZlQGh"
    "5/v0CfwoiUdNH7PMFstsscwWy2yxzJbB3fyW2fLsmS1cbzai94LGx3IOQ/NJKFWHjHz2Dm"
    "Tvz4Pvw5M9LLKdc2j7/e8f52kkShf91HE+oG2PvI6z1hI/bo40Gt+VUXqxrf1iu803X6PV"
    "+3xDKl7etjG21Xtq1nZUXoAtbnrFQXv7DlaTE3a3+A4UlbM2eEPaBVq10KFxf+l8yvJYjN"
    "IG1w/1mA0u8nTWw7mkwCj6CDx/p76n0ip2COHQ8yfKr+GEFA9nljjhbcC64ikxzOeZm/Bb"
    "PMfzeQlZM+Z500NY89ya59Y8t+a5Nc+teW7Nc2ue28JcYHKBnmQLc50WtwNlZwtz9Zk6Tz"
    "KGRpY0b82TrBg5LXjj/TiRoJwDJyD20yTGSnA4pcnnDzuUkvf55qfV5tsNd0AF1D4bk6tJ"
    "PqfW2fLe3EnFW+9/5lrN1ijnZMn8CYtvm/y3DC8lc/ZQQ0+DvJWbvSgwdq4ivR1yunQdw2"
    "hDUmxIig1J6Y+AeNwD3Ah7nFvCriw9ciVl7BRndh1bPFDzhEM3sBrLJeXq3qGiiO7RJ/RA"
    "3Kvotg18pN5zp8JHD+yCxa68ojV6RB+2EUeywJFGpQoISDAhpxHbf57vZ6MEjvRDNQEcNf"
    "VkBuFp6s0iPBbhsQiPRXgswmMRHovwWITHIjxgcoGeZBGeExEeILuRIjz0fkPC520PVKIH"
    "KPt+4sel4UKFT7PIMS27eCjYB9w4ytdR+fV2X3y5UNj14j3XCqdBE3FkcFqxj/+GkrOdoE"
    "fEDVo3vsj1qxzGOrJjhWUlnCPyHmaxjt4sot+rcY8Xrm7NQY630NHEbZdgYLz5/tc1c1q4"
    "cRxyOUuuiRlJVRhOk2YwbIC1/zXKl0SgXfhidatfar8nXBJOCRA69D49MYzSQmIWErOQWG"
    "+Q2HHfdjeQWEtQ5+NjsUMP76McL9Id7eg4qKPec6eCOgW9YLHlVxxNwfEberS4TVPAzyxx"
    "mBtxlFgNS7TmozSDQz0h0Qa4HzJ9YFtZrU5T6WcNk1T2sKqGFhspU0TX+4cY5exzzF4p7I"
    "+/FZt1maDMaPkmqCTUyzfBB66P4uYDSpcFKSGUTWdcgmXXs5Qmn5v7NPtjTDUTAhBMSKbk"
    "gAY5jRhJOpQBz8jSv8IaUPj8lOUFJHSRp4c1T8sDqh2IstpErawm1o+JyoVnyZEkgM8StQ"
    "F5r06j9nuVNgkOSrVl4QSoyi+xV5Jafqnp8CpnpeFXLMiU72xVibH1niwoa0FZC8qOA5Gz"
    "oKwFZS0oO9ASIEbt5cewdlLLpgeCZLtXM7uEc1kta0OCrxrvBwE4Q98eh+v/emHdTiwYi+"
    "mesvLHhulW5uQRgfNvzsJMRA+DYCbdW8aDYi8W5bIol0W5+kO5jqMC7VAuCgx1lviuioQ6"
    "JfMdDJ9qSH0nBZ21SzVfZsurfsEN7PZFCYLt8xzhu1j7ICV9sY8flrsd+IbH/eb7tTZxPY"
    "2UggKF/ch4oqbTQ9fXxyI3Z4G8Q8GQrITRPAvGn7lPDNVEAFZTT3VUDf5aulwR8dzBakzN"
    "KfRo+FWvKfzgeK8hwAvmnK1ygfYbYYvXNXvVU0vuxceXL17Rl1MefauOEniy1vbyT/jYXt"
    "6v/4we6ZaGR/sQkbkgqWpjYK6Fbyx8Y+EbC99Y+MbCNxa+6XEJ7Ja7lTkfNm98oLANSVEO"
    "Jj4L4bjALW0wGEP3Jus9FkPS7KtYjHH4o4n6Z8r3XzbdU9EHuCrBO/5pRVSULpMj740tWq"
    "dEnmcdH6KLgUAwMFG+E1OyKQ8sLR+MmZilN6k0QHNEotX4XwkxvVYr8mfHcY7cl7XuJrJX"
    "ewApXQwFxWcuYQM7hDctMlyeLUpddLTeL2hQpEpPY7FToKjh+p+jOHrzqgOzQ/HlmhFyvZ"
    "OBc0QGGWGvE6fcydkhFX9hp8tecm8bUgLVPsay0llAwRxF8w5XN3/YnqtQq932aEEBKV5c"
    "d/ppmEzJ5mHbP/qr9tqjnyQOaHmhaY2Ff7VTbOH9Zwbvy8UGIbRi4pUo92Dmhdgar70U7W"
    "nzijyaNlcPvwr5S+yJi5kSL/fFbvNA5ffvlOrahilRu+lOZUok9IpSDJRDW6dKSNfUOQX0"
    "zxzh5rAgaeO4gfJvHfPBkg7YUprMklFSDMqOIWkAINCM7Nw2hvhwWyU0z+nTZ0QSd00WYK"
    "UIIRGA0wdUCYyYIEAGNc/mHjXhaFGNJOErLAiDKVw7N8rmFoYeX2nl6gvlYzfjxXNTqbXq"
    "AQ4GD3e88suATflBaEdgwIdWIrRv9d3UhtRX/HB1jtaeJyYAkJu5F4weHtq19gMCrNO8fi"
    "LSeLFDv7MoVzegu8VJyv0ArmH8enZVFR4Bficrl/1K3AaeP83q1xAq/g83zLMswitUcZLF"
    "5/lzp5ZdILQxvJYEYkkglgRiSSBXae5aEsizJ4GoRqkht4emm7GczCa12w6OaeEBMDQ1Ug"
    "ejnJSLVPTupqByyhichaqPYfJp6y2Xs3W/ejZsYf4YUv7kDnpKY6tYcSfLy1ByWmFFGhW2"
    "6OK8FzdKlg/R6kSJc4tY93JmDX5fNnxA7q9ev3zz7sXbf3Amd3Ml7pNPwLxhCZMXv1Gp8g"
    "7OVoZOFKjsRDim8xwSKlZWtCLjeQGMiYx30AeX73yfika0gzP6LOj5zEBPLSp3GmJhCqF7"
    "vULJLt+sl8kHqhPdtkHoajfdqQgdqq5YMF2rdSFGXflFugpqcc2rZYaSRzwxC/ztva3U2O"
    "gMc2eUX+5O9Nr9iFA8/VBNBAo39VRH9PzYRyWmUBagwFeSDASBRyrgxKRf36Wv8rlPyJxz"
    "osmzlzscSYX6OfNJhdkdbFuqWk7z7rJyF0FG/JoHmIzmI5ObxHcNkckWIbm1CIlFSCxCYh"
    "ESi5BYhMSWnjzxfdgUJAv1pA5KT2qDZK+19CSUnS09OaDwhX+tQ9FdadJRyYIdWdLRkRc3"
    "PDnWWzpcleKGTyfWO1uumMVnaBtI7Q9jFkphEBTKI7U9K9OQWvgk32s4mYSdm3o8XPXbJv"
    "8tW2HVyHhgrNLTwNGxqqsImH6tPVFdh8baOOVq4cOQ8H7Dk1vlmEjzKNud54oaOsOEpMIo"
    "GSboY5XVs5f3a55PIsqTL8sq1wRucZdvHg1kl1BhDDMbQNPLMDPR5CoPvZnH3bJkVkovjJ"
    "gXkQSETkz1ZxWv2/nM0NVgMEOF1P5oHIPgRdBdtD7dV70C3lKX/XlwoPieSQw3kTQ+3XPK"
    "ojGVOareST82nDyfcg6pDlRVI7Ydf3P1ut+UTnt0m0M99XnsuFLWi9UmiQw6TXTdDJVgEE"
    "zyPBNlfTu2GDU+VUvWsmStNsQUsTp6KLOO9T50n9NN+XKzzpb3t21oW/W77lTe1lJcQhKI"
    "42uOFqHQUbcEYcvysWprKfQIBsHS/IgS5aPkY+mHepiPJbGvYocF3NMMnMQfK9Vnb2j9cF"
    "YFeJdan/2XF/vdF2YWvnj/hn34DxR/2Wx+Y3/gYzEiBBtO3MqMV2mHD1av0g4fZsQcqQN5"
    "Ecyv5isssE5OOVV4AhIu8wDg2VWv6RL6lCupd7+rdFXVYS9qVXX2uqFXgS0zzxAhNE68DG"
    "I5ooPWpdHxhbiHNU0YW7s2zRzqkiVH2yxy2R2rqNiJe3iWBX/C5gpJN9RyM9CbUZ5vcvWu"
    "0J2GZDboESGezuZ+0OvHltlomY2W2WiZjU/PkLTMRstsvC5mY1PaeL0a2yVAfb3MRlPq/d"
    "nSv0pmYwMY3Wz1TKMTrZ4OcecrpUPqjb9xQGZJ5Q9t926O98vVbrkuvidkwTONGNFnPxTJ"
    "dma1Zj4Gp0Xacus9FravPB5HhM2/OUvaUifDCFzx+Qwq9pqrqT+sUdt1j3bBUX/aVRsFwk"
    "1o6E0vd9BThqaj3s5xvPQttG+h/TYYZ6/Q/ifa5guijSx3j2837aD9+l13ANrnjvhFOeCo"
    "vG6x2rTA9wGCT/6OqAZs0Xwpl5ebpdDdrICeHSZIgV7rlHTCEF8xijo4H0Duey2TRzgloD"
    "rLsO/Nk5QHHZS58rM4E4lWCLAf0H9ZopXQRYiVeiWvbZLzw/MRyOfvzgjSG0ihWST6hwlG"
    "6S2Q/cQsCMXLkgl/0jIsZeJWXpDym5CA1WFIvU+zNODORojww8z/cDwwGQsczxHQu9WkH8"
    "SSO8EmWA9sQ9JhgSdQQVzSduAw1wbb0nf0zq/0U4rEZ+YiXuBDY31zFNGFXQJEl79XYsRy"
    "8JCyDjH1AHsTSTybLdmnm7wUEGyOsM9vmsPClPs5pK62IAHrB5tqBb6WLUiPLf8aWoDWAr"
    "QDALR696pFaC1CaxFai9BahLZFWEXSEeSinVfR+jBAo1nlsEO4sVv4SzsXg+Bf56vK43CX"
    "AVXdkLNS6WEs+soJRkkHuohk0ZgW9MDEkXOMtbNPmpJWoo/vOcmv0uAQvNj39760xz7u8f"
    "y8SB+W69s2zj/NbXc6719Bfo/475LPb1+gnLZq3XqlQoyIo8qdkXUYpDRvMIp8ObrFnbtB"
    "H06/tmOpu/5OuJNBo+B6aPYyV+HhFkp6Ekj6W5KUQhLr4zkzX47+4U7CptghbPLNeXANHF"
    "fpgIFZlEEPzCXI2oTfQM++JvSHjIPWR/YnLGsUNkDX3900S4SF5cAxwmcrHZ80ZzMbI7ur"
    "/jQHZUpHACUaxBEt0ZNM+QhgsEy9Aiy8Ho4vkwqhhsQpmrqeJEn29FOWoGNOnLaeK57bYQ"
    "UsaIFV8DSSO1W6i7pWQFiUNNMNc8mczMD0P1Cd9fLtWrrtyoOQemvBKmLvpfKNRKXiJvPa"
    "mqBP2bhieB/oIVqu1A7CSUSXZjxtevGxm7dRUXwjxYu+RMUX+uiU+MdIg+48ITeiCa9wyp"
    "9VFLuNk/xxS2O8nGjC7xbNZ/igXWgFMK1Kqx4cX2NADnDliwiZ1eZ+uVYjZHyPWifMQV9z"
    "vV7gvLWOWeuYtZEz1i9r/bJPxyln/bLP3i9bGadGjE3Y+jCe2e71zA69sVRZNfQWrNo2Hf"
    "3hukcFf1z/PluouHtVqpIWb8rLXetkIDF3ZaF0OQGVnWNoaUvtD+RdPc18u9Sv+swCNoQ5"
    "qxFcz5ED1Io+dyGfGTJQ9TlMrMBpPoKrU4+0IMY5fuJuoYw//j+UYlPa"
)
