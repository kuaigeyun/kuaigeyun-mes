from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建自定义字段表
        CREATE TABLE IF NOT EXISTS "sys_custom_fields" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "name" VARCHAR(100) NOT NULL,
            "code" VARCHAR(50) NOT NULL,
            "table_name" VARCHAR(50) NOT NULL,
            "field_type" VARCHAR(20) NOT NULL,
            "config" JSONB,
            "label" VARCHAR(100),
            "placeholder" VARCHAR(200),
            "is_required" BOOL NOT NULL DEFAULT False,
            "is_searchable" BOOL NOT NULL DEFAULT True,
            "is_sortable" BOOL NOT NULL DEFAULT True,
            "sort_order" INT NOT NULL DEFAULT 0,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_custom_tenant__i9j4k5" UNIQUE ("tenant_id", "table_name", "code")
        );
COMMENT ON TABLE "sys_custom_fields" IS '自定义字段表';
        
        -- 创建自定义字段表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_tenant__i9j4k5" ON "sys_custom_fields" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_table__j9k4l5" ON "sys_custom_fields" ("table_name");
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_created_k9l4m5" ON "sys_custom_fields" ("created_at");
        
        -- 创建自定义字段值表
        CREATE TABLE IF NOT EXISTS "sys_custom_field_values" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "custom_field_id" INT NOT NULL,
            "record_id" INT NOT NULL,
            "record_table" VARCHAR(50) NOT NULL,
            "value_text" TEXT,
            "value_number" NUMERIC(20,4),
            "value_date" DATE,
            "value_json" JSONB,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
COMMENT ON TABLE "sys_custom_field_values" IS '自定义字段值表';
        
        -- 创建自定义字段值表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_v_custom__l9m4n5" ON "sys_custom_field_values" ("custom_field_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_v_tenant__m9n4o5" ON "sys_custom_field_values" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_v_record_n9o4p5" ON "sys_custom_field_values" ("record_table", "record_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_custom_v_created_o9p4q5" ON "sys_custom_field_values" ("created_at");
        
        -- 添加外键约束
        ALTER TABLE "sys_custom_field_values" ADD CONSTRAINT "fk_sys_custom_v_custom__l9m4n5" FOREIGN KEY ("custom_field_id") REFERENCES "sys_custom_fields" ("id") ON DELETE CASCADE;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除外键约束
        ALTER TABLE "sys_custom_field_values" DROP CONSTRAINT IF EXISTS "fk_sys_custom_v_custom__l9m4n5";
        
        -- 删除自定义字段值表索引
        DROP INDEX IF EXISTS "idx_sys_custom_v_created_o9p4q5";
        DROP INDEX IF EXISTS "idx_sys_custom_v_record_n9o4p5";
        DROP INDEX IF EXISTS "idx_sys_custom_v_tenant__m9n4o5";
        DROP INDEX IF EXISTS "idx_sys_custom_v_custom__l9m4n5";
        
        -- 删除自定义字段值表
        DROP TABLE IF EXISTS "sys_custom_field_values";
        
        -- 删除自定义字段表索引
        DROP INDEX IF EXISTS "idx_sys_custom_created_k9l4m5";
        DROP INDEX IF EXISTS "idx_sys_custom_table__j9k4l5";
        DROP INDEX IF EXISTS "idx_sys_custom_tenant__i9j4k5";
        
        -- 删除自定义字段表
        DROP TABLE IF EXISTS "sys_custom_fields";"""


MODELS_STATE = (
    "eJztXXtz47iR/yoq/5WknAlFia+py1V5XneTnVeNPblU1lsKRYK2bmXJS0qz60vtdz88CL"
    "ABgiJFkaJsI6malUWo0Wy8uvvX3fj32d06Rsvsxdf1Ep29HP37LLy/x//Nvz47H52twjtU"
    "fMMa4q834Zz+4ix7yGYp/pI2Xqxi9Bv++HL0449nG7QKV5vZIj776Xz041mECeSfUhRuUD"
    "wLN2c/4S/Ownm2ScNog3+WhMsM4a/uf54lC7SMKU+cBUwJP9quFr9syd+bdEuaxigJt0vy"
    "49V2uRRMxEUL8n3OLqcfz2fRerm9WxV043WE2VisbgpKN2iFUsJqQYtyNds83FOO3q827y"
    "ib+Em0XpHXWKw2GeX6hrQY4we0Y3s89ab+xJ16v1Oesyhd3G8Wa8rA9dYPYhv/a3v2+zfX"
    "2ySx/OvtFE3m19vAsRH9JsLPxyi83jp+gPJW+Dtn7Du4lYXILxIvud56ju3TpwFh6/5hc7"
    "teCY4xe2fs/Ys3YfzS9/l0dfb774owJPaut25oj3G3nj+/XuH/591NkY/ZdOZBSD5PA/x9"
    "lGD2PRQn5Bs7xp9dfyrTYq/gziPWJpSfOhNEv0cOeU1vgr+3HEzBCcYhb+96U/x94DrW9X"
    "ZiWTbhyHVs/Dt3Yo15Ww9FU/qvR9oG5HMwn+v6hy2l/sGb5cMQJ2PdO+VcED4iMiju2EpI"
    "T4wPhOm6NhkmQmX0KszQR7KylCG2Q5/0b5Gep/Z8tN0uYkp6LFYV+7NYS+zv7X2c/z0iTD"
    "uku/ncKdi62OBxnW83KHt5vRrh/y3il6O+JiDrgTBP+piiMXu3Me/j2zdAZ54EdLxczLI7"
    "x1INvIldPPXJ07FL+RqTWUBHeYosC/YlxEM6LAazeClpupYmh+t4Fpk6LipNlLwDshnJAi"
    "NDZJHpHSQWa0O2OrUNnkZ4ono+mZSME+UFIpk3L7Rwvw7yyVSZRy4RnC1xAjYRtTN3Qma0"
    "n3CGFtkM79MbdEcaui7pF08rV16kysL0q59inmO+PDBXFpGVO4W84Q7xhr74jtQO8b98hj"
    "BRiflLWjr2mL50Qla2k7hk9iXTfBaJmc1o4u9xm7kFW5KtLcmPDnoKkePlzr4D3xTHyT1K"
    "7xZZhsWXSeeKOCOqDxbeZHObrrc3t/AcnClkdYfP7pOGN8O7Nt4Y0IYy+/ri8vXFm7eE4k"
    "zXWD6XPoarh6s1+ZceT+/xyRSuInpw03N8ppzqXwTPmpOs5sCS92a2Hxa7Mh2RdfprmMaz"
    "n9GDLPcZO3mVI0rL0zyMfoZEhNqR00jRks4O/mJCJaEnPX+f/BzHb1RMg22G0i4mQM72N0"
    "yOK0k9j71WJdl36Am/TQed7U+uPfF0uwXbTcU2HvKJwXYRro8ok4GMIx2BnXOBM6nOArrg"
    "2kwAsi+s7bWyU+ANJtRuFeQEq5kiZ/+RbFcRkdUoWy+WL3LO5/iAfyFGbUYI/eeZdirVaa"
    "mch4YzSJ4Vr2/DtFJTvQt/my3R6mZD5vHE1Q59v2e3ZuQxhzsU1b9ffH393xdf/zBx/0gV"
    "1mKoCquj5ZIG48AtDDgMEv1WY1FrNPxZGAt+Q/OhUGFGXWg6re2GYhiAjdd43Xxar9CL7S"
    "ZarX+tWCPhdrOe4cd7LBuZkVYD9gY/3SzuUNWoaYekQpVhS+fqdaWg47yzF/zDGXjvWRjH"
    "8ovqRuPq/ce3l1cXH7/QTT/LflnSt7i4ekue2PTbB+XbP+CFRPZEbIczu14QGf3P+6v/Hp"
    "E/R//8/ImeQvfrbHOT0h6Ldlf/VKZAobANPAVkRo43BfQ66nOaAvS/h+/D2lHltHs+D8eW"
    "Va8AC/uv9UGGu1FPMuow60l4nHbPwnPqZdelXdxa+k5J+JDnfhQJpYdWI3GFfqvUJWolXz"
    "gJ9pbb1dt/XEk7yycuyY8X//ijtLt8+Pzpv3jzYmv59PrD51eKyIWTokbg/Jv9Z73UQyuB"
    "v1pjsyJc7XkM9Olv0YzdHDO5Y/Beff78QRq8V+/V0fn28dVbvCfRkcSNFswOLWt5ws1TM2"
    "T5/G81YkUHg4xY4bAaVNLMG9BAmarcjnYrTvodCvZ5TNW5mOKq3kQ2LLfZMnjcatRPtdu3"
    "wGGKGTHbrG/Q5halZwoCd54f+RRvE16UkqtUPFF8I2SYoCumCVLIfTYSUiicbbuQQtKIEq"
    "N/yQa99AjvDvfLcJOs0zs8nneLFfs6RvdhurlDgCSW82KTexzZF3imIAM/lhx7o0r4pzs0"
    "EboRd6GJ3jwkCNvUckeXYXg50rkxqlBG2Mc0QZiOa5F9g2OEEg8AQ3Rsy6WvTtE+K+C4oB"
    "NNbdJP6OVY3mr8YvSnP8mEmNxcl/pULMqq/DQgvyA//1dp6v71HZkb/2Iw2XREGuQzX/tY"
    "rAr2FdEPGNNe6GHm7Jw5KCkhTXKoOT5kRerpCk+1ph3RV658GY4ITRg3DiLuYGeSWDI3Ze"
    "WHydmPCbLIPqvc14qz4i3+SjwM/yr41siYc00h3IqxdKZ+tFu8+N8kIsCo7xF7JXIQn9au"
    "F1s6uJmwBNBdyoTwoAZkPUyIJ6G5K4/P9Sq5Q3zbjwl+C6n683lClj9C4nXBb2Gfop8p4Z"
    "UZbhKOThFiWXxUoYUCKhl9VVxr6FDPMl6hlkynBvJutOntRJXB75jvG2LlUsSCPbFG0TpF"
    "+XzLCF7ru75om49Esa4k5231uuEIe34syq/F5ZOvr9KINJd5lYQLDtBduFiq3QdWSLfxeW"
    "Hb0xcNrGJqe3OmZTPhkw3ccZNY3cCLsIIpcsnEs1ACu78Ps+zXNVZcbsPsliLJ1DXA3ArO"
    "NCJdI/qG1iQSYy3IjuZR+nBPQybs0OK/Lsgn+ECeaQXMBAPErLxhHR7uJhF5nRjPOt5Q3s"
    "jUH7BJ0vlWGhHIxrJG8kapvALcLPV87d4RGXdyP1WnSt7rMsw2s+X6Ju/QI7MOi5tMK5fu"
    "G4nj6KwE/TD0HG0AzTWugnboPWoBHV++vRp9+vaBWqFp+KvQahUduaRZvsN71eJm9QMqo8"
    "iNDGib7hT00GORQfgc8XV7pQIRqxFQYoRGEsNKbFOFdpobIm+ksaiNB+CmwokOHLRk+hw2"
    "35qSwzyZxgcNG2B3r0H7AkahEsGviuwR2P+jC+noJpyHMztQTAeIytAPLudPF9QDg0HUmA"
    "7hPTAxHSam41nGdDQwMzYp6t7MMBEhJiLERISYiJDDpwB34B++k+tHFtAfJrjh2P6XDoMe"
    "qBOnpzNW0O55VGzHqR2WY/ilWg8LfgF1XCTvVl8rp9TJQAPVleeuywEQ/r+eFodEf6CAtv"
    "3cml0Guj2DKJLCzTt0vI4CmO+W+EGhVuWeBhH9AA7zoccY+un7HGG1nwHHt0PgYdDRy9bb"
    "NOrrmCmID68au55LgBsUMDXWX6y+Y6HMSJTS+egepdl6FWK21ulNuFr8X0iIkJGdHnr+lL"
    "XeAmI6Xmid3OcRDdDWANqTtkpZNFg/i07Q7luf1q85157OybjTQ3CSeJ0rdHZpQYXfw02Y"
    "9iTOgvhQ9kkwIa5WK0q+ff3QvTTLxkeKTef0557EWRA/TgKCE1ger4zRkeh6SUYw8dbPLN"
    "5aHnwlOKKX9B+lj35wp6YRwKcRsbEvpqQEQ/Rxess9nM4gDRWf0WSItLkL+qjvYth25S4U"
    "Yf8H5y9coHQR3Z41yWDIm56DHIZQfAUSGEwSgejt8PyAnFBNFZ89Yz2+Y3uym5AurfAB+S"
    "GUUr3sW+ubZFn0JKic9BAe7kOEpE3OXm26ie6syM8W5FsJ62+Xnz811wH1svm2wk9/jBfR"
    "5ny0XGSbn3ZIivS3WwdX1W1FGSMEXmmPjpw5zSFx8FlwRc+YRmdB3hSeBTDQRjkRfsSjdh"
    "fyfLRsE262WZ53tgxXJu1sV4hTf2lnMGWmr7Qz0EabdgYTbGhkluvZRDtD4bzI8xZlH+V0"
    "IKK5ucjSubwhFSeajLmLXOKZcggLWYIUoxXVJQnwKkpUFsUpRzxLaJrEMa+sySIQ/DGNaL"
    "FsNYFpxNgcgTSC2oScJtNBrsIoBVUoVRjZEiy18uJECcyQCpjSJEDQxgdpUEX/bEmrtD17"
    "TrA+i9eyYKDj+Wix4p/Qb/eLFMXno2yb3SO8ZGNIlWwOJX4DopIHwTj3k8/DbBGdj+7TdY"
    "JodTziJcdHBUrv00UmM4k2Gzz7S2wGY2I0eInLWvt072XaP5liVihV7yRHKw28BQkYARlu"
    "SaGn6WA8hXLiFj/NNnjnv0Hqj2FfDHphPgdAgvL28ZWUZUTFl+VZGX7Cpv44OZkMkIM1VR"
    "OVbKKSH11Usqk0V2bExBWbuGITV2wqzXUQmKfVcVsfZBpnRm6s9mJmFrRPQXwHKv9dCj33"
    "CtRsWNx0aKfJFX20Fv7b1fauLplUHoigdhgKO6m1QINSjDRxrNQIk9pO7STJyR9RjmO7fj"
    "4L47D9zLRLEzM3G5ufpfPtYol/kr0gzsKWRgfs9Qguz7N2JrFGzIO4SeF4CQO9ZsDGVquB"
    "kcifihnS1A/RgX0BnBi1AranrUUMujhFIe/rr+lA8IWz53ghOHKfx1Pg93NlPTlNXh8woP"
    "XXVwQMHIwFfcFNQrpQ6sEg3vYcVjdcL5aze/agDAcZ2EeKAeRayzFgH+hA7wv2gX1AVUJU"
    "RgPPD4V9pPdheRAwt4VmrCjqzCmBPI0GXwZ54BurIA+HTGAbL6KB7WSUKX2G3X7BLSkIwf"
    "CvidRVNyDH7G7eDc4RLpd4175P1zO8FWWlO7TG0zG1TeVMyC9fPxNBoICXv9TdEibNHuWW"
    "sPt0EZUEPkUkZtz1i+RLPbCSIGxq4s29NGB2QDqxSO6sY489UJGCatmVuJNBagxSY5Aag9"
    "QYpOaRK/cGqTFIzfNAavSKapegQQMvd/sCICfj4tYr8x26uJu6TFvL0jhNoVHUp5TlXk5R"
    "1AO4TmX7sUb8/JsW4fylboa5oqeZPayR6zHv73mS94np3Ql779S9pPBSd0ZPwha0W4n53X"
    "IdtpdzvUdGI/+EdLljBN58/vbqw1u8Zt6+fn/5PkcphTZIH8pT/Ovbiw9qlazcBdQCOCbA"
    "aUsfCOz1OMDxge6tU8GQtaCL3lveF+jyGv/n63bZDHURjc+VS6VIzZhZul1qcBflZil2Bx"
    "b9VLgADCzDht4PIlpDeBxUOuaLPGI/QMDVR8tZsrRxWBOx2/SdZCzqAhas7sZ0YLILTICG"
    "tDyHgq42xWYAXfZqLvVKMjDEmcQkL34csYQekmTjEMCEwbbsG3YxKSu0wqoVcQxIolRyvS"
    "nuNtLzPEp01wTBW3s07xcnY5GMVCExjtDwOhzu2KJFKxlPHBliFAt8SJtIXmBWxBXNhADQ"
    "K/JnsdLY34XnRUk4rwGO+pmeOYKwZX3069HeeZdQFz5aGTaDQ67CZmQjVNt0eROvSNdJWZ"
    "KS2hc7JP1kTt4xwdNPh1VJq1zBqjL0Czb9wpSBQ2DR+bFHA+MiwhspGQqao3u1tTsnVcjw"
    "mZcU7TDLaEPPE7U1XvoCVpW3inG4Qt9RymZ4HC6WD+zj3Xq1ueV/PKAwxZ/5bTrsKloV3J"
    "PvgJW2I7/66a4bYmtuICouODW4m8HdDO5mcDeDuz050MXgbgZ3e7q4m17T7RJ3o46DnoTH"
    "aQ9Tk7cvC6C19DXXUggzoq8hkHvovVBr/Uio9lFradqabL+nCUXorcXTgCKEtVoj8HGr2S"
    "tRPxU1eJdN3oFOyw36HgWK2tcq61mehdeiI0kWLo+edoRyJ8NUw+7cm3PAxqy5BoW5hHrD"
    "66UeBoHqu/duDYrqP4Obawr34MDxE6Ye97Oqx61PCazFACuQaqWeMMOBD88Z5JdUN0oaBD"
    "daS/A1L8Fci17LJcMVQDtbp5vZOo3x+xqAuwLgFiWzTxLghhW9m4LaUr1JkJCoVAdX4GT4"
    "VIKTlbuEueXPfgXLwj9SCLmXCfCUIWQ4UaogZNBG40AqX6y5F4SsQsJwjSiQsLQ9UkRSe6"
    "dBs8u0R2RnLihmooU2+bHYfGm/k8DmbxX4Xph/NjCsgWENDGtg2MExOAPDGhjWwLAGhu0c"
    "htVqiycIw+oOsYFR2J6U6A5R2KcKG2otitOADZ/QPXQtUij7sN4qzPiSyd+Fvgc8cruHrl"
    "1dRpn8yYya1vbtQJoGajFQi4Fajge16L3RFfBKNZICbJ+O6i3w6dNqheY8vvvhK1qGXNFo"
    "tE5P4OrN3H/2LUNcEyk4zwXze0PkitD4um6YeCkanyvIFRnSWbrWJV7SRxylIk3oHwaIYr"
    "uOUFSOce2ZqPTxZwKaxvh49m3PltGenXgTaAfLhjhTP5Ipct9mQKySydziTjbhCw3l5cFT"
    "IyHKJPVQhU1RSjmWVeofUpPetwE12HtdIcsGg5g76NlaoGCNoL+HIkt3TkgwX08sR46/4B"
    "4E6ZLdt9ZiDxBCvkccfibofVwF+VPRjg8d/g70aL4X9yR0QP5UhH7oEjmm67+lSj2Um/8M"
    "dxF/Xi0fuPqh17GrtpMWWnRhPDwGJXrPs7cyeAlsZZIudVD00hvhH2mkBYLmqh4IPC11MU"
    "y4IYxfugtX4Q3QFE0UU+12pvOFnVAUE4wSOjSKCdIql+Nw/TGhnrg2jRmekEIcvrDdPVpX"
    "jV3pBOko5hks0AEipKRfAL3R9axA0VdpP2VOGV+srEgVp48ziqqfCfiEo6ikyVQRRQXb9B"
    "5FJa1RJYqq2JHVln5Mytz4sT0hHc/DVipsZQiVOBjoaCiLqugqn1bg+CREP3378GHEs+a8"
    "gFyT4PqToLQu9wnX4u82peJm1ypIcit+dXpVNkAVPCrXo/vd8DnCfLqEh9cXl68v3lAFKg"
    "1/Fcc1UAZKx+W7dYoWN6sf0AM9NXdUlNUbWrpdudZRBxfVjtNlh29OVpIqPXQm8s5E3pnI"
    "OxN5ZyLvTOSdibw70hR4wpF3egvDRN41iLzry/AykXd1O5LeCj2NyDvgl+xH4nIHp6K69W"
    "Lum5i7QWLu9nVgmBg9E6NnYvQegyIruc36uNwC0u9nk2sKdh3dj9dky9NCvXrcqwLRfV7x"
    "kvsOX0W8pJSp0F3EpGTl3C6WMZ78j1bsJ+73blJTBaV3C1aKsVFVlaL5uVpXRTza414QvP"
    "mut2mU/1WQYC9sYhDy1e1NJ9f0ArOTjEEo2NsjBqHiandIKylVUoFPmfeAYZAwQgCvNxLX"
    "kDgTQXNKKs/hbyIQfVCixPwQ7J4nekdCHhngx1NCAwXWS5kUX+q+TUNOXzJvMwP7SdjQSx"
    "KtxdHKxxZ10M+Ue8JRB3BCVUUdVE26pKL4736TkUcr51sqDVcWzXknfH2SiZBLkk/gYuZC"
    "cmHEwxgq5r407emML+ZdXtKRWjI7AiSkDUQJkFDOBLV5cV8pY4qjCbyY5CZkn+h+tm8Mdq"
    "cFX+SY4Naq5uY2XW9vbvmpS+MTlaNXd6IdFkYwqz3rPoarh6s1+bcUQEBVh5miSPAEl2al"
    "hvWRnOqJQQdhnVKN52f0AEWU5eaVXp3izAh9Kf81mHt5NCjRD/FUEKahLPhKRcyEG5hwAx"
    "NuYMINTLiBCTcw4QYm3GC/cAO9aXGC4Qb6XfE48QZNhNeDzdXlKAhnWE8jAekPVHfpEHu0"
    "wxAPZtT2JeeC+jBS7sRQNwE1tWeu1mtxGgE1qie9RiviSlE7c1HT2TDXjVQ7hsZh4RjKlw"
    "S4SV5xOgfQeZRvU8CE0bcuHEy+7GhVm7deWOUrTExYwjMLS9BC4Xr4pQIK7+dmhtfbbLO+"
    "eycwuToYEbY/V3DEiD7jHZ3vRhLpL5k7ziQwV1S/EXvRSYKHeccAGpQ2z4ZwIgPIXIto9k"
    "qggpLGjF89FFcc0Vg9BiG6MQEkMR2rjicBIQKqZaeX4uhSgEzYUiqUA/rMuYiTsbhmoglf"
    "jwxo7Gd6PmGgEcq2CmiEbbq8ZTR/VbHpyoWZ+FKiXNGWxUagcqXidhusfbOJtNrezYvL4L"
    "hpkmG1I9rwmfjbJkzJhPDmUymrGW+UyeJG7SsYT8XNc6Svv11+/lQMr0M4tsi0D1BMVIl5"
    "SAbZmrBoASy1IKSVt+aRcg1S/pRmKwS+F5T5wWcDWqrsuL7lkaYeEtqlO0E8kRoMKUzXXo"
    "YRul0v8xxqZ+JavCSeN7ddkQ2dol+2ixTFpXzoJCLTxXfnommGwjS6JUNZakw3JHc6JjMj"
    "tu3iJ+t0s+MHRYSzuaXDgHcGvDPgnQHvDHhnwDsD3j1j8E6vrhvwrgmQ0ZcZ0yG2ARxQPQ"
    "2B3MNAA6G18ToUI+C3JzHKPQx0HXqlATwO2xvAHQIKzH7uSSMuiLeSPrHa99OsBnYBaMbl"
    "2wpz92O8iDbno+Ui2/y0Y5QIi7txQRUCVI5bQkDFBalDoqfxFbRP4KTdz8fS5WkMPDU9yV"
    "npofetrELaigvqgF2oJEPgyKqRIf+mVW477GOY7HbhldNI73jZ7ZIzsEbgh9QSkDsZRuKK"
    "a3Nwuece1T6lDroYUubC/zuozE3FEnNLmKlAYkJ9Tt49pg31aRos0Sz4R/YsdBQKdBl+R/"
    "ElPenPmoQCwfbnSihQRp7lakPdpVf34Q2a3YdYZ2WBQRK8U9znoDTD+8v9YrVCsfgzw5ox"
    "MndnFbHEAgXeup5LA2gSd1QZq9FdYNA0iWNunOu5qAsPKsx6eM8UpMvrA+ip64KH7JCVZ7"
    "vO7+Nyxh79PpxX06lLtd9XxDsDTsDvdldTbBODor1aC/ZYhBlw6VXIhEkegl++ZTlSyANf"
    "qbQwvu8RL45HyqT4MXktJwGXT8DXmlAL37ZcOcoLUqgddjW3v6KlGn4jto9SHAOYJbmkwD"
    "ceiinu7VGWY1eerwU7YrNSyTO/Fn7DPBCE7ZhYeGl4l6kv4Ewim481d4WN5OUyYJa8Cbgw"
    "ARcm4MIEXPRpXZiACxNw8cwDLp7zXaBgJ26jnXawBxdGaE/ylzroGyByHH1xa63K3h4mch"
    "xVo3jCUUP1FkeXmGXh9tgtzYPQtqKHYfy4DQ2uoRGh3B3V40AUPQwyEIWxOiwQBG3k5nrQ"
    "fLtYbhar7AUJ4mhpMJa6Pk48TAsngGaEBglh0TrD93MQVrjED099xf+5RJgsqXbXKPcV/u"
    "BcTX7FD2dZ/rTs8aaP021+JbHs5zYeazYtGMzpTBLvJPNdvYT4Ylgca8Fqc1e2lEUKaMGo"
    "tFx9pSVwHZtE6MCemOM6GEciIm6aIFL61iLAWtfZrewKX89GZH2G0VxwBzlin+2xd+pZrC"
    "TgySUYJFEgsAgjOFNGcHkWjl4+qfi9K9el+1S5pxqQEhzvzJ3tZaoXqaT8XdQ0T/28AzBA"
    "4ztojpQ7G21TescC3lnpu+hXBi+fizYzMgso7gBWieuwK6nHiY4tvFIC1uYvdNL7fyG0va"
    "lMA0Apxl9u/OXGX2785cZffvLOUuMvf+7+csnwOnw/rsy1g32cyp7cj+bXxdZcaHU1Y9Iu"
    "mFehfzLjodVeO5Bnofr2pHLIHbTev/bau/rQ4Ou2uh1SJ3uUCe01ob1lzbfWL1ThwfyxdH"
    "AoPsGD3JtXlNZrlrrZxL0p/eAcuDc3KcKMM9ZYKmiDe8JIM3obRzmoFz40rs98r+NZrscI"
    "0JX8gSC/tnFQLvh9Xt9ujlz6jStT1PonS95Bd053laJ36AEEfj9NKCzQcBx7Yl1rLhGD3N"
    "a45RoNQ+Mg3h23PzNuR9E65SsrG/EEfbUoGlkoMnOAqlJNgWXPsqoJUnua4Vyi/D1cbpFK"
    "m2VPc2zpVRlcUkKrncBilXht2aRXL0XUXiAlTb/iAil9HLQJbTWuutN11WnH4fH46hpsV0"
    "ARkLcr460z3jrjrTPeug68dcI06GlDlnsYKEiwG1Wu9TmoLUVWKITHjalSez5OSNVeCu/J"
    "RFM9g7tZ9jMI9l4Cnd3ZoncF1RrWla6gnR6SgxxB+CgK3yzogg3Th7MmriDlJ+dKrBu1fG"
    "L+fKEJd6u8Nt5c81BR/Qor2/5Jhr1Bk75gtc5Z1OC++Aq6Sn15JUANtpSuXxAOIx5pUG7P"
    "Ts7hLoGAvJx2sNzuKx+6nqpP/sqHfLruvPKBten+ygfF3yatYOXCdpLq8ZBt0F0pSx0sYU"
    "ggl1XF0zyHny4PFRkytwcYj9/j9/iZ4Dzj7jPuPuPuM+4+c3tAtVV3bW4PaHV7QPcacWvp"
    "P5ubkfXmwXBeNjXXnZonNQI/LNdd9DBMinXnlpZm7I6aFW+qzB5F0iYU1YSiNvHVNsUfdl"
    "eUBSsc75Z1RRj20kJareGcyXc/fEXLkJ+YjaYSDHEp7bcH5URwKEXAKO/5wULWEGctX1q/"
    "N8VyZGqNsJwSAzKWIx7PxFjugnJg+/wrUDrdYDx1GA+DIU4S6SljJU0xnkosh+EeICRXRC"
    "/swHVYGydyEO+LKfvllqeB5Ui40qNFdLqfmE8Q15F2P7W4gg4d27eggnLvtLQYW9w+LQK8"
    "NetLRL10CCnlnCrAEt6K1+wqafAKgR+QOWV7dkVwhxrqT9PmvJBeSQJeHMBJUc6QmyDe16"
    "448sd3zTXQ96XojOMqX/igYao/dfZcXL6+eEOV1TT8VZzqip5QOlnfrVO0uFn9gB7oAfse"
    "n61hXlbpRPS2UghMpd5moEMDHRro0ECHBjo00KGBDo80Bbq6D1U7rKdxIWp75b9LmLFJSk"
    "BrQR8W9d+HoNuYRV2K+xkAi6qReBrwIjVSexK5oD3M7eV7md1d3kpOLPKeRMpJDxShUOti"
    "6DDWwNx8am4+NZi0waQflX5e8v/1oT6WOuln92qM8vXnlWyyy2lDAnaBes2CAUpCZkr74Y"
    "mJX/Eu9wWld4ssY+zWg9nKT84VMDvFj2f34nkZzKYNxMWzoqGpwq+bxEeoROUHsc200T/T"
    "EkIEIXYdS15KO1Fo0K4gdp2XyocUucM4IMbchDhOmOdSOJhDTo2F2Ym68QB7lnqAWDFc+C"
    "D7sNw/pCa9bwNqsPc6WLfBIOZV09eiUHxBv1lVmBFfchkkKK0qim2J19yDLFjE+5Z+KqFm"
    "B2M0fNfo6RQD5E9F+z50KnSgp8u7c0+iL3VyKgPQzaI5JtrSUokfClk5w13En1fLh/xA3Q"
    "Npaam3F+bKiantWr1xz5O5UpUEm5tG3zpIf7yksfpfyGVc2OZLGymQ6m9UDZLF/7MbvkiD"
    "2nhIUeLURD2Wl4+4q+wk4x2ldApwrVrjMqjg91I9IfmKtlK5TIqXB6QwtVQuU6574TNOWX"
    "Tfans3Ryn7PGfOIfbH/2brVa4fDRkMCV64zMXoK4oXpF6gl4wnXIJ515OY6r5TWukqoYVf"
    "yaWOrmWTb6wkfrRxlb1M/ScYUZkXt4VTqKoiWpvyF0UAJOhALvglBtab2/Ra0VxKXAJ4L1"
    "EJyGt1HDZfq9oASrj3tKrJodwJWf3U1OQwgXUmsO4kLDwTWGcC607C/DOBdSawDkyBHmvv"
    "Dlt0t3sV85mE2e0f7LW/rn0aMWC0657GgNMeJgSsE+ulw8iwpxrmqDXlTmNyP7v6KZ1YxY"
    "NGUJlYNROrZmLVjniVXy0i0CxkqpvC7a+32WZ9R4f271SBawJwlX50riBcEW2QDwdVDMsY"
    "l9SGI10K8JWiaI3ZZ7TPR/xvUfLdwGGldYdV4ZMEwvKOAcYDkQ6mwTcFxXbTyvEibhO0gM"
    "a6Rrlcj2Bnno2I3RdGc7nAB5TAaQNReHZMXbJ7xwFBI6OIzzA/8Mdw7oyUxV0OTxUVKSSs"
    "X8SvxRI18QI70bCOZ36OQMgvopbj2DUT2xfo6B0QE/to6X3mNGgxcQ7gHm7aJfr0OjeaSl"
    "hAZ7MNNoEobOP4dLXYUb4eQBtmNLJWwuYHz8nMZU+LW5zVNsS+fDkiPoLryhw8eNOkApeb"
    "qyENKGVAKQNKGVDqaZhnBpQyoBTcBRSD9PAtWb/Gy92cys7cp2bbwTZdWP89DY3UwUkOyk"
    "HqeXdDIBwyPY6C6GOg7Hut1dJa9ytn3BemT0/Kn9zBcbAp1YI7DVQKWpC9Crvoot3BjaLF"
    "XbjcU+LcGtYdzozgi5zwDrm/efv6/ceLD3+wrfOpAmTwAZhWTGFy8PcqVd5Ba2VoT4HKDo"
    "Q6nWeXULGyohUZB7p7Exnv4BgXHbf3p2hEewJXHhuQzoB0+6EVFYDdweDcFXXfXBDwfLF5"
    "+LC+OWuCzpV/dQ7guU2KiFJA/UJh3ma2XN/U368MwDbyd0iNYAO8SceGk8TQq9VbTQPJOR"
    "aTThjqU3BRRtMK40H+PcOigjFBxBiQ404jCsA4AkGbJvOkQOLCMaFG/mUlEAIHsapfPq+p"
    "5HoIwEbOhKwm2D/TrplglN582R1FcCncJoks/qbsG8dyRBRl/k1AVmgQjGm6V+xzn4Y3n/"
    "KS3BLABPlx7anFcTrITw3m1GjQd2I6nbhAWQ9sQVK2wBuoKX+Etm8zTJEt6XP6y+/0U4yK"
    "z8wTNbtfhquRJEVdfhHsEuQX8aNkjlz6Ii7NwSPHjWtJ4lnfk3W6Tnk9B0BuiuYhEJO+zr"
    "r4Pb8VWaVwrRawrCTVCN/JKUivLT8NDAZkMKCz42JA+qBgAwIZEMiAQAYEMiBQ/RTIrZqe"
    "tuKC+jBO7X4Vww6d492mbmjHYpDcjfZq8ml40oGa3pP/UunhVPSVPQySDnQRyZrpW9ADX2"
    "LexlBrvdPkSZH6wPy9fCp9+fy+LMNNsk7vLrd4fC7iu0WzoqWan53DoHxs4ZENm7aZZaRR"
    "yBtJTr9thlJK2vj1cq0YEU+VMyGT0Y996jsLaXIp8X95U4vmFzn+Mbx+TXkp+/72+CXLmw"
    "Ltoe3LfIW7KeT5zSDaPc9yDkjKi2tPPDkJhnsJpYxoQBXbfVNxMSfgK/fAAM8d7IH5BBlN"
    "+A0sogU9g0XkvWeTCsaeNQ/yyPvVn0fVEmGx+ZBHOcGHej5pkSnGo3TNaNNRoRxAifrzkI"
    "aDRGPOAQz9KGcawPaQPzngPiBe0dhxJUmyt6e+ELnULH1vm4GlNJAfvI3kTy0XyAVVv6SR"
    "rhjLvNBuYf/vyAI4fLnmfrt8I6TuWjCL2OHEQ29oXEg0Lc0J+paVM4b3ge7CxVLtILBCOj"
    "Xn491uyvswy34lgTK3YXbL7sgkeqPnU1/4NCI/RBaPpOfvWiRVzKP04Z4metihxX9dkE/w"
    "RjvTCmAsQvh38ldZ5An48vPrSLMNQaAWzJHsERlh8kQILjVRmIe+5Hs9wHtrPLPGM2ui84"
    "1j1jhmH4dXzjhmn71jVhimvRiakPowrtnudcwO3bFUUe3pFBS0+y5a5Di1gq/XvVsLFXev"
    "SlXS4Ptyc5c6GUjMXVknXQ6AsHF6mtoS/YHcq/uZboc6Vp9ZYaHClNUI7niFhQoLuu1E3j"
    "9mWe7ziJpQa//Ak1OPtChGGx9xt1jG7/8P5S23Eg=="
)
