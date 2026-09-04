"""
好力 GO — 影子制造厂商就地续号到租户自有代号系列。

历史上设备合同登记挂的是「财务材料供应商台账」，migration 611 把它转成设备制造厂商时
为每条历史单据铸了 EQM-/EQC-/EQP- 合成码：公司名是真的，代号是假的。
migration 670 已把「同名真实厂商唯一」的影子归并掉；剩下的是台账里确实没有对应
正式记录的供方——它们本身就是真实公司，唯一的缺陷是代号。

本迁移保留同一条厂商记录，只把代号换成该租户自有系列的下一个号（如 A001..A022 → A023），
并同步改写合同 / 应付款 / 验收单的 manufacturer_code 快照与用户数据范围绑定，
使这些历史单据能被正常绑定的外协账号看见。

代号系列从该租户仍在用的正式厂商代号里推断（「前缀+数字」中成员最多的前缀，
补零宽度取该前缀的众数）。推断不出系列时**直接报错中止**，不猜代号：
需要先在制造厂商台账里建立正式代号，再重跑本迁移。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        DO $$
        DECLARE
            stuck text;
        BEGIN
            DROP TABLE IF EXISTS "_haoligo_mfr_renumber";

            CREATE TEMP TABLE "_haoligo_mfr_renumber" ON COMMIT DROP AS
            WITH shadow AS (
                SELECT m."id",
                       m."tenant_id",
                       m."code",
                       ROW_NUMBER() OVER (PARTITION BY m."tenant_id" ORDER BY m."id") AS seq
                FROM "haoligo_manufacturer" m
                WHERE m."deleted_at" IS NULL
                  AND (m."code" LIKE 'EQM-%' OR m."code" LIKE 'EQC-%' OR m."code" LIKE 'EQP-%')
            ),
            official AS (
                SELECT m."tenant_id",
                       (REGEXP_MATCH(m."code", '^([^0-9]*)([0-9]+)$'))[1] AS prefix,
                       (REGEXP_MATCH(m."code", '^([^0-9]*)([0-9]+)$'))[2] AS digits
                FROM "haoligo_manufacturer" m
                WHERE m."deleted_at" IS NULL
                  AND m."code" ~ '^[^0-9]*[0-9]+$'
                  AND m."code" NOT LIKE 'EQM-%'
                  AND m."code" NOT LIKE 'EQC-%'
                  AND m."code" NOT LIKE 'EQP-%'
                  AND m."tenant_id" IN (SELECT DISTINCT "tenant_id" FROM shadow)
            ),
            series AS (
                SELECT "tenant_id", prefix, width
                FROM (
                    SELECT o."tenant_id",
                           o.prefix,
                           MODE() WITHIN GROUP (ORDER BY LENGTH(o.digits)) AS width,
                           ROW_NUMBER() OVER (
                               PARTITION BY o."tenant_id" ORDER BY COUNT(*) DESC, o.prefix
                           ) AS rn
                    FROM official o
                    GROUP BY o."tenant_id", o.prefix
                ) ranked
                WHERE rn = 1
            ),
            anchor AS (
                SELECT s."tenant_id",
                       s.prefix,
                       s.width,
                       COALESCE(
                           MAX(((REGEXP_MATCH(m."code", '^([^0-9]*)([0-9]+)$'))[2])::bigint),
                           0
                       ) AS max_num
                FROM series s
                LEFT JOIN "haoligo_manufacturer" m
                       ON m."tenant_id" = s."tenant_id"
                      AND m."code" ~ '^[^0-9]*[0-9]+$'
                      AND (REGEXP_MATCH(m."code", '^([^0-9]*)([0-9]+)$'))[1] = s.prefix
                GROUP BY s."tenant_id", s.prefix, s.width
            )
            SELECT sh."id" AS shadow_id,
                   sh."tenant_id" AS tenant_id,
                   sh."code" AS old_code,
                   a.prefix || LPAD(
                       (a.max_num + sh.seq)::text,
                       GREATEST(a.width, LENGTH((a.max_num + sh.seq)::text)),
                       '0'
                   ) AS new_code
            FROM shadow sh
            JOIN anchor a ON a."tenant_id" = sh."tenant_id";

            SELECT STRING_AGG(DISTINCT FORMAT('租户 %s / %s（%s）', m."tenant_id", m."code", m."name"), '; ')
              INTO stuck
            FROM "haoligo_manufacturer" m
            WHERE m."deleted_at" IS NULL
              AND (m."code" LIKE 'EQM-%' OR m."code" LIKE 'EQC-%' OR m."code" LIKE 'EQP-%')
              AND NOT EXISTS (
                  SELECT 1 FROM "_haoligo_mfr_renumber" r WHERE r.shadow_id = m."id"
              );

            IF stuck IS NOT NULL THEN
                RAISE EXCEPTION
                    '影子制造厂商无法续号：该租户的制造厂商台账里没有「前缀+数字」形态的正式代号可续（如 A001）。请先在制造厂商台账建立正式代号后重跑本迁移。待处理：%',
                    stuck;
            END IF;

            UPDATE "haoligo_finance_equipment_contract" c
            SET "manufacturer_code" = r.new_code,
                "manufacturer_id" = COALESCE(c."manufacturer_id", r.shadow_id)
            FROM "_haoligo_mfr_renumber" r
            WHERE c."tenant_id" = r.tenant_id
              AND (c."manufacturer_id" = r.shadow_id OR c."manufacturer_code" = r.old_code);

            UPDATE "haoligo_finance_equipment_payable" p
            SET "manufacturer_code" = r.new_code,
                "manufacturer_id" = COALESCE(p."manufacturer_id", r.shadow_id)
            FROM "_haoligo_mfr_renumber" r
            WHERE p."tenant_id" = r.tenant_id
              AND (p."manufacturer_id" = r.shadow_id OR p."manufacturer_code" = r.old_code);

            UPDATE "haoligo_equipment_acceptance_sheet" a
            SET "manufacturer_code" = r.new_code,
                "manufacturer_id" = COALESCE(a."manufacturer_id", r.shadow_id)
            FROM "_haoligo_mfr_renumber" r
            WHERE a."tenant_id" = r.tenant_id
              AND (a."manufacturer_id" = r.shadow_id OR a."manufacturer_code" = r.old_code);

            UPDATE "core_user_data_scope_bindings" b
            SET "scope_code" = r.new_code,
                "updated_at" = NOW()
            FROM "_haoligo_mfr_renumber" r
            WHERE b."tenant_id" = r.tenant_id
              AND b."dimension" = 'manufacturer'
              AND b."scope_code" = r.old_code
              AND b."deleted_at" IS NULL;

            UPDATE "haoligo_manufacturer" m
            SET "code" = r.new_code,
                "updated_at" = NOW()
            FROM "_haoligo_mfr_renumber" r
            WHERE m."id" = r.shadow_id;

            DROP TABLE "_haoligo_mfr_renumber";
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 续号后原始合成码未留存，不可还原
    """
