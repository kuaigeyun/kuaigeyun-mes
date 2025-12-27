from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 创建系统参数表
        CREATE TABLE IF NOT EXISTS "sys_system_parameters" (
            "id" SERIAL NOT NULL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL UNIQUE,
            "tenant_id" INT,
            "key" VARCHAR(100) NOT NULL,
            "value" TEXT NOT NULL,
            "type" VARCHAR(20) NOT NULL,
            "description" TEXT,
            "is_system" BOOL NOT NULL DEFAULT False,
            "is_active" BOOL NOT NULL DEFAULT True,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ,
            CONSTRAINT "uid_sys_system_tenant__c9d4e5" UNIQUE ("tenant_id", "key")
        );
        COMMENT ON TABLE "sys_system_parameters" IS '系统参数表';
        
        -- 创建系统参数表索引
        CREATE INDEX IF NOT EXISTS "idx_sys_system_tenant__c9d4e5" ON "sys_system_parameters" ("tenant_id");
        CREATE INDEX IF NOT EXISTS "idx_sys_system_key_d9e4f5" ON "sys_system_parameters" ("key");
        CREATE INDEX IF NOT EXISTS "idx_sys_system_created_e9f4g5" ON "sys_system_parameters" ("created_at");"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 删除系统参数表索引
        DROP INDEX IF EXISTS "idx_sys_system_created_e9f4g5";
        DROP INDEX IF EXISTS "idx_sys_system_key_d9e4f5";
        DROP INDEX IF EXISTS "idx_sys_system_tenant__c9d4e5";
        
        -- 删除系统参数表
        DROP TABLE IF EXISTS "sys_system_parameters";"""


MODELS_STATE = (
    "eJztXflv4ziW/lcM/zQzSBdk2boKOwukrp2argtVqd3BVBpuWaISbzu2R7KrOjvo/315iO"
    "IjRVmyLNlOwhmg2pEoHo/Xe+/7+Pjv4d0qRovs2efVAg2fD/49DNdr/N/88fBiMFyGd0g8"
    "YQnx4004o18Ms/tsmuKHNPF8GaPf8c/ng2/fhhu0DJeb6Twe/nIx+DaMcAb5rxSFGxRPw8"
    "3wF/xgGM6yTRpGG/xZEi4yhB+tf5smc7SIaZ14FXBO+NV2Of/Xlvy9SbckaYyScLsgHy+3"
    "i0VRiVikIM/z6vL849k0Wi22d0uRb7yKcDXmyxuR0w1aopRUVeRFazXd3K9pjd4uN29oNf"
    "GbaLUkzZgvNxmt9Q1JMcIvaMH2aOJN/LE78f6gdc6idL7ezFe0AtdbP4ht/K/t2W9fXW+T"
    "xPKvtxM0nl1vA8dG9EmE349QeL11/ADlqfAzZ+Q7OJWFyBeJl1xvPcf26duAVGt9v7ldLY"
    "sa4+oNWftFS1h9aXs+XA3/+EMRhlS9660b2iNcrOfPrpf4/3lxE+TjajqzICS/JwF+HiW4"
    "+h6KE/LEjvFv15/IebEmuLOIpQnlt84Y0efIIc30xvi55eAcnGAU8vSuN8HPA9exrrdjy7"
    "JJjVzHxt+5Y2vE03oomtB/PZI2IL+D2UxXPkwplQ9alndDnIx0bcprQeoRkU5xR1ZCSmL1"
    "QDhf1ybdRHIZvAgz9J7MLKWL7dAn5Vuk5Ik9G2y385hmPSpmFftTzCX293Yd538PSKUdUt"
    "xs5ohqXW5wv862G5Q9v14O8P/m8fNBXwOQlUAqT8qYoBFr24iX8fUryGeWBLS/XFxld4al"
    "GnhjW7z1yduRS+s1IqOA9vIEWRYsqxAPKVB0pmiUNFxLg8N1PIsMHReVBkpeAFmMZIGRLr"
    "LI8A4Si6UhS52aBg8jPFA9nwxKVhOlAZFcNy+0cLkO8slQmUUuEZwt1QQsImph7piMaD/h"
    "FZpnU7xOb9AdSei6pFw8rFx5kioT069+i+sc8+mBa2URWbkTWDdcIF7Q59+RWiD+l48QJq"
    "pi/JKUjj2ijU7IzHYSl4y+ZJKPomJkszzxc5xmZsGUZGlL8q2D7kJke7mz78ATsZ2sUXo3"
    "zzIsvkzaV4o9onpj4Uk2t+lqe3ML98Gpkq1u89m90/BkeNXGCwPa0Mq+vPzy8vLVa5LjVJ"
    "dY3pfeh8v7qxX5l25Pb/HOFC4junHTfXyq7OqfijprdrKaDUtem9l6KFZl2iOr9EeYxtPf"
    "0L0s9ynbeZUtSlunWRj9BjMp1I48jxQt6OjgDStUErrT8/bk+zhukRgG2wylXQyAvNpfcX"
    "ZcSeq577Uqyb5dT+rbtNPZ+uTaY0+3WrDVtFjGQz4w2CrC9RFlMJB+pD2wcyzwSqqjgE64"
    "NgOArAsre6WsFHiBCbVLBdnBaobI8D+S7TIishpkq/niWV7zGd7gnxW9NiUZ/edQO5TqtF"
    "Reh4YjSB4VL2/DtFJTvQt/ny7Q8mZDxvHY1XZ9v3u3pudxDXcoqv99+fnl3y4//2ns/pkq"
    "rKKrhNXRckqDfuAWBuwGKf9WfVFrNPxUGAt+Q/NBqDCDLjSd1naD6AZg4zWeNx9WS/Rsu4"
    "mWqx8VcyTcblZT/HqPaSNXpFWHvcJvN/M7VNVr2i6pUGXY1Ll6WSnoOC/sGf8xBO2ehnEs"
    "N1TXG1dv37/+cnX5/hNd9LPsXwvaisur1+SNTZ/eK0//hCcSWROxHc7s+iKTwf+8vfrbgP"
    "w5+OfHD3QXWq+yzU1KSxTprv6pDAGhsJ14CMgVOd4Q0OuoT2kI0P8evg5re5Xn3fN+OLKs"
    "egW4sP9ab2S4GHUnow6znoTH8+5ZeE697Lq0i1tL3ykJH9a5H0VCKaFVT1yh3yt1iVrJCy"
    "fB3nK7ev2PK2ll+cAl+f7yH3+WVpd3Hz/8F08ulpYPL999fKGIvHBS1AicP9l/1EsltBL4"
    "ixU2K8LlnttAn/4WTd/NcCV3dN6Ljx/fSZ334q3aO1/fv3iN1yTakzjRnNmhZS2vcPPUdF"
    "k+/lv1mCjgJD0mHFYnlTTzBjRQpiqXo92Kk36FgmUeU3UWQ1zVm8iC5TabBg9bjfqldvku"
    "cBgxIqab1Q3a3KJ0qCBwF/mWT/G2wotScpUWbxTfCOkm6IppghRyn42EFBbOtl1IIUlEM6"
    "N/yQa99AqvDutFuElW6R3uz7v5kj2O0TpMN3cIZInlPN/kHkf2AI8UZODHkmNvUAn/dIcm"
    "QjfiLjTRm4UEYZtY7uBLGH4Z6NwYVSgjLGOSIJyPa5F1g2OEUh0AhujYlkubTtE+K+C4oB"
    "NNbFJO6OVY3nL0bPCXv8gZMbm5LvWpWLSq8tuAfEE+/7U0dP/6hoyNXxlMNhmQBPnI174u"
    "ZgV7RPQDVmkv9HDl7LxyUFKFNMmm5viwKlJJV3ioNS2INrmyMRwRGrPaOIi4g51xYsm1KS"
    "s/TM5+TJBF9lutfa04K1rxV+Jh+FXUWyNjXmsK4Vb0pTPxo93ixf8mEQFGfY/YK5GD+LB2"
    "vdjSwc2kSgDdpZUoPKgBmQ9j4klo7srjY71K7hDf9mOC38Jc/dksIdMfoaK54FtYZlHOhN"
    "SVGW4Sjk4RYll8VKGFAioZfVW11uRDPct4hlpyPjWQd6NFbyeqDL5jvm+IlUuMBXtsDaJV"
    "ivLxlhG81nf9Im3eE2JeSc7b6nnDEfZ8W5SbxeWTz69SjzSXeZWERQ3QXThfqMUHVkiX8Z"
    "mw7WlDA0sMbW/GtGwmfLKAO24Sqwu4oBVMkEsGnoUSWPw6zLIfK6y43IbZLUWSqWuAuRWc"
    "SUSKRrSF1jgq+rrIdjCL0vs1pUzYocW/FtkneEOeagXMBAPErLSwDg93k4g0J8ajjieUFz"
    "L1AzZIOl9KIwLZWNZAXiiVJsDFUl+v3Ssiq51cTtWukpe6CLPNdLG6yQv0yKjD4ibDyqXr"
    "RuI4OitB3w09sw2gucZV0A69Ry2g4y+vrwYfvr6jVmga/ii0WkVHLmmWb/BaNb9Z/ozKKH"
    "IjA9qmKwXd9BgzCO8jvm6tVCBilQFV9NBAqrDCbarQTnND5JXUF7V8AG4qnGnHQUumz27z"
    "rQnZzJNJfFC3geru1WmfQC9UIvhVzJ4C+39wlI5u6Dy8sifidABWhr5zef10pB5IBlE5HY"
    "X3wHA6DKfjSXI6GpgZmxR1b2YYRohhhBhGiGGEHD4EuAP/8JVc37Mg/9OQG47tf+mQ9ECd"
    "OD3tsUXePfeK7Ti13XIMv1TrbsENUPtF8m71NXNKhZyoo7ry3HXZAYX/r6fJIeV/IkLbfm"
    "7NLoluT4BFIty8p+brKID5bokfRLUql3QS0Z/AYX7qPoZ++j57WC3nhP3bIfBw0t7LVts0"
    "6mubEZmfXjV2PZcANyhgaqw/X37HQpkSltLFYI3SbLUMcbVW6U24nP9fSDIhPTs5dP8pa7"
    "0CYjoetU4u84gGaGsA7VFbpYwN1s+kK/LuW5/WzznXnsxIv9NNcJx4nSt0dmlChd/DTZj2"
    "JE6R+ansk2BMXK1WlHz9/K57aZaNjxSbzulvPYlTZH6cAwhOYHk8MkZHouvlMILhWz8xvr"
    "Xc+Qo5opfjP0oZ/eBOTRnA58HY2BdTUsgQfezecgnn00mn4mc06SLt2QU961t0266zC4L2"
    "f/D5hUuUzqPbYZMTDHnSC3CGISwegQMM5hBBUdrh5wPyjGqi+OzJ9fiO7cluKF1a4YPsT6"
    "GU6mXfWt8k06InQeVZn8LDfYiQtIezl5tu2J0V57OL7FsJ6+9fPn5orgPqZfN1id9+i+fR"
    "5mKwmGebX3ZIipS3WwdX1W1FGSMZvNBuHXnlNJvEwXvBFd1jGu0FeVK4F0CijbIjfMO9dh"
    "fy82jZJtxss/zc2SJcmmNnuyhO/R07g0dm+jp2BtJoj53BAzaUmeV6NtHOUDgT57yLsI/y"
    "cSCiubnI0rm8YS5ONB5xF7lUZ1pDGMgSHDFaUl2SAK9FiEoRnHLATwlNkjjmkTUZA8EfUU"
    "aLZasHmAasmgNwjKD2QE6T4SBHYZRIFUoURjYFS6m8OFGIGVIAU3oIEKTxwTEoUT6b0mre"
    "nj0jWJ/FY1kw0PFiMF/yX+j39TxF8cUg22ZrhKdsDHMli0OpvgFRyYNglPvJZ2E2jy4G63"
    "SVIBodj3jJ8VaB0nU6z+RKos0Gj/5SNYMRMRq8xGWpfbr2Mu2fDDErlKJ3kq2VEm/BAYyA"
    "dLek0NPjYPwI5dgVn2YbvPLfIPVjWBaDXpjPAWRB6/b+hXTKiIovy09l+Akb+qPkbE6AHK"
    "ypGlayYSU/OFayiTRXrojhFRteseEVm0hzHRDztDpu641M48zIjdVezEyR9zmI70Dlv0uh"
    "516BmgWLmw7tNDlRRmvhv15u7+oOk8odEdR2g7CTWgs0KHGkiWOlRpjUdmonSZ79EeU4su"
    "vHc2Ecth+Zdmlg5mZj8710tp0v8CfZM+IsbGl0wFKP4PIctjOJNWI+iZsU9ldhoNd02Mhq"
    "1TFS9udihjT1Q3RgXwAnRq2A7UlrEYMizlHI+/prOhC8cPYcj4Ijl3k8BX4/V9aj0+T1hA"
    "Gtv76CMHAwFvQJJwnpRKkHg3jaCxjdcDVfTNfsRRkOMrCPxAHkWssxYB/oQO8L9oFlQFWi"
    "iIwG3h8K+0jtYecg4NkWemJFUWfOCeRp1PkyyANbrII8HDKBabyIEttJL9P8GXb7CaekIA"
    "TDv8ZSUd2AHNO7WTc4R7hY4FV7na6meCnKSndojSYjapvKJyE/ff5IBIECHv5Sd0uYNHqU"
    "W8LW6TwqCXyCCGfc9cXhSz2wkiBsauLFvdRhdkAKscjZWcceeSAiBdWyK3Eng9QYpMYgNQ"
    "apMUjNA1fuDVJjkJqngdToFdUuQYMGXu72AUDOxsWtV+Y7dHE3dZm2lqVxmkKjqE8py6Wc"
    "o6hP4DqV7cca8fMnLej8pWJOc0VPM3tYI9dj3t/zKO8T07sT9l6peznCS90ZPQm7yLuVmN"
    "8sVmF7Odd7ZDTyT0iRO3rg1cevL969xnPm9cu3X97mKGWhDdKX8hD//PrynRolK3cBtQCO"
    "CXDa0gcCSz0OcHyge+tcMGQt6KL3lvcGuvAo341QFxASXLpUip9hrb1YSnMxFLsVi57SWa"
    "Wb6SqNcdPYG+EkMMANGxzizHGl616cNPYDBJyBNOAlO1gOoyZ2ivTAI9G7kB54BEY6sAMQ"
    "HeV4dURORUcJv7YHvoW36KjBmLk/k30Fz9VzlITHwnBHFg0cyVxyHJ1hwhQYjfYwt8CNiD"
    "uYZj0CCBL5U4xl9rfwfiiHvmvAm34GQO7F37Iy+vUq77zPpws/qQxdSQNFga7I0qOm0dyG"
    "W45M2vA2XC3+I80RBf+RlkcKpWiDQjSLRj4gK7PIMStSaNEjsfjScseBzVsV+F6Y/959k4"
    "64qNPgRwY/MviRwY8MfvTowAODHxn86PHiR3ptsUv8iJq7/WxiPOvThJbtS4luLfxynNlH"
    "6gLWWxTn4QJ+RIH8WmBQfVhvFWZ8yeTvQt8DHrndXdfuYIuc/dn0mtb27UCaT+CWBeECOD"
    "HWZ2LHPqnYsVokRe+N3htJka/O6oKwst+ttMoMzev45ufP5G7OXNF4YHfLkvtch3wC6W4R"
    "bYBcFXfCNkGu4AWyEnJFunRa3FYrQVf0FUep+I2qBojKV51CUTlG3LiCKvWTfEUuRHt24k"
    "0gnXw7nB+VLt2lvs2AWCXjmcWdbFUX8PLzRRBlkkqowqZoTjmWVSof5ia1t0FusPS6k0AN"
    "OjF30LO5QMGaIv89FFm6csIM8/lEAZGigXtkSKfsvodVeoAQ8jXi8D1B7+MS2Z+Ldnxo93"
    "egR4PbrfsQOsj+XIR+6BQ5puu/pUp9Kjf/EBcRf1wu7rn6odexq5aTFlq0MB4eghK9595b"
    "oV1/g0uZpEsdxF56VfhHGmmBILmqBwJPSx2HCSeE/KW7cBneAE3RsJhqlzOdL+yMWEyQJX"
    "Qoi0m5yYOwmChKzg53u/6I5J64Nj3TPia0db+w3T1KTGcxsWA+inkmTnxLDCnpC6A3uh75"
    "QtJXaTnlmrJ6uTZlIlbU9GGyqPoZgI+YRSUNpgoWFUzTO4tKmqMKi0qsyGpKPybhXfzYHp"
    "OCZ2ErFbaSQlVsDLQ3lEklisqHFdg+SaYfvr57N+DcZS8gcSZcfxyU5uU+dC3etgkVN4tL"
    "IclNfCVyPhd6F7x8O+3moof9/G54H2E+XVKHl5dfXl6+ogpUGv4otmugDJS2yzerFM1vlj"
    "+j+7ojeXpDS7cq1zrq4KTasbvs8M3JSlKlh84w7wzzzjDvDPPOMO8M884w7440BB4x805v"
    "YRjmXQPmXV+Gl2He1a1Ieiv0PJh3wC/Zj8TlAs5FdevF3Decu5Nw7vZ1YBiOnuHoGY7eQ1"
    "BkJbdZH9FBYP6nvTL86H681veD63GvCkT3afEl9+2+Cr6kdFKhO8akZOXczhcxHvwPVuxn"
    "7vduElMFpXdzejPosFFUFZH8Qo2rUryqZSWIMCp48V1t0yj/S2TBGmw4CPns9iZjFgHuLD"
    "kIonp7cBAqYuPDvJJSJBX4lnkPGAYJGQJ4vtHrlJ1xkeckiumTCLAPSjkxPwQLlOUkghng"
    "xxOSBwqs53JWfKr7NqWcPmfeZgb2E9rQc8LW4mjlQ2Md9DPkHjHrAA6oKtZB1aDLR5LcgG"
    "jfwcjZyvmSSunKRXJeCJ+fjldIkg9gMXJhdmHEaQwVY18a9nTEi3HHfjNLZgdBQlpA1GsG"
    "5D1BTa7e3sDRhLzkcBOyX3Q925eD3WnAF5kT3FrV3Nymq+3NLd91KT9R2Xp1O9phNIJp7V"
    "73PlzeX63IvyUCAVUdpooiwQ+4NDozXMHkVHcM2gmrlGo8v6F7KKIsN6/06hSvTKEv5V+D"
    "sZezQYl+iIdCYRrKgq9UxAzdwNANDN3A0A0M3cDQDQzdwNAN9qMb6E2LM6Qb6FfF4/ANmg"
    "ivB5ury14onGE99QTM/0Rxlw6xRzukeDCjti85i9xPI+VODHVDqKndc7Vei/Mg1Kie9Bqt"
    "iCtF7cxFTWE9D3y7fq2XHUOjUDiG8ikBQvErTucAOo/yZQqYMPrUwsHky45WNXnriWVrJp"
    "ahJTwpWoIWCtfDLxVQ+DfZq8CQuIPPNn8Jv6P4CwrT6HbYBEaE6S8UHDEj76YZfVkX6WZN"
    "7nJah3hNoH/KDhlxiFtJNs+m6/lyieLizwyvPMgEzBEKxIjA1LFNjtR6Lr3ZOXGPcf02u0"
    "2a3YGir0UdxAhuzwLBZWC+HBTU514++MxgRcLJvM6D8Dgjjz4n13FX5VOHr+0r4p1wFvhu"
    "N4W6DcKljacDS0wiAkv6bkFwqJJJfv05cFf5luXIx1LzmUpPw/oeQRI9wo3wY9IsJwEnzm"
    "GzxvSuc9tyr/n96JSGCXOo7XYV0KtIqYJ7xfJRvnhbjJJcUuCJh2LqqfZolWNXHq/SEVe2"
    "WKnZs/vacQvzm8XZiomFl4Z3mdoAZxzZvK8Tc5e2gUgMRGIgEgORPCH/uIFInjxE8pQDAI"
    "KVuI122sEaLIzQnuQvFdC3A85x9CfatCp7e5eX46gaxWPG+Wotji7RJuH22C1N/qTV8TFR"
    "wonuem5mcGnkerzDZcId1WNHiBJO0hHCWD2pqCUbubkeVFw8TO7cbWkwloo+zu3DLZwAmh"
    "46nxuH93MQVjjBD/Z3X1Gz8+Vqmcxvhk0c3tIHF8DjvUkRrhuzYiP6usHpGZKMclTLXm/4"
    "0nizmU4yIjcHkBXoGB5saNWLkvfwWoPv88uFZ8ilT1w5x0mCyIEViyBfxbGW0hETd+bKAe"
    "fhMRJweETjKy5dT1w+WgNrWxfHskk3NPZy74iJwGo7iFYpn1lZEawQODmLiSJXDuSq8INc"
    "3/J44BEpve8Fmpy/h4stUvN2rHEkFt8X5dVXwR6cwGL4tC37iNSjgvq4k3D4iWMVeqDA+H"
    "6N7/d8fb/afng4zt8GyxVQBOTlyrh/jfvXuH+N+/fgIQBMg54WZLmEUwXn60SV69LTBhXC"
    "4zod1JKP43PYS+E9G3fDE2As72cQ7D0FOmMyaz0/9YZ1hbenxkNy2KUu2E55NacTNkzvh4"
    "0udpE/uVAvdyGWT8zfzzUMyMpgKub2lrLiR4nYWNk+z9tboEkvqlrnLGoQRaUiXyVaghJd"
    "BaaUbu8rHEbX0u19MD3bOQs3lOTCUMkuCsFFqQVMKdUCtDvvsDgZFbAtqMvDvOeln6H6iC"
    "OuSMO1IuIKTNPk9N9B97xIM1gJY0Kw0Ptsg+5KNE4whWEGuawq3uYkVzo91FMP53U1ivH4"
    "GY+fYXsatqdx9xl3n3H3mYAYXbj49Jpfty67Bx8QoyI4QF8acWvpP5l4AXrz4HReNpUMSs"
    "2TGoEfRgYtSjgNB7FzS0vTd0eljZrbH44iaRNmwYRZaOKrbYo/7A65AGY4Xi27uJKg+Oq4"
    "wfEliktpvT3oniIOpRQwylu+sRwQCl/JrRGWU6qAjOUUr6dFX+6CcmD6/BG4AslgPHUYD4"
    "MhzhLpKWMlTTGeSiyH4R6AkluwF3bgOiwNuyiElSXFzi+jKCfGciRc6cEiOt0PzEeI60ir"
    "H5WfdgMBrMrGWwgrAC9kaKHrGE4I8mZeQRdy3TGxeOnl9gBdAtkVBG/N/CpYLx1CSnlNFW"
    "AJL8WrlOIxoAmBH0Q8YnqjsDA25VOEJA1sOICTorxCboJ4Wbt45GLfonXTX5l3VkAV0Pcl"
    "dsZxla+qCPxp+KPY1RU9obSzvlmlaH6z/BmVY/Gfid5WosBU6m0GOjTQoYEODXRooEMDHR"
    "ro8EhDgCrKfcFfReZnAB62Uf67hBmbHAloLejDWP99CLqNWdSluJ8AsKgaiecBL1IjtSeR"
    "F3mfKOb4PmZ3l8G/iUXek0h51idiKNS6GDrkGgD/+m5ZWq3WYDn7c7E79O6YDswHg0kbTN"
    "pg0r3r5yX/Xx/qY6mQflavxihff17JJquclhKwC9RrRgYoCZkp7YcfTCRXmu55t7vyyYUC"
    "ZutumpXAbJqguJlBujrVQNXqID5CJCpxbe5P1/IdcmAq7UShQTrpDl56CUL5pnZnFhBjbk"
    "wcJ8xzWTiYQ54bo9lxbBliz1IJECuGEx+cPiyXD3OT2tsgN1h6HazboBPzq7jZjKA3cRf5"
    "N4sKMyhuLoYZSrOq6pr22mzBJN439FMJNTsYo+GrRk+7GMj+XLTvQ4dCB3p66WLrXuIRq4"
    "WcSwd0M2mOiba0VOJPhawMyfWCH5eL+3xD3QNpaam3C3PlzNR2rd64585cqUqCxU2jbx12"
    "oxfl6n8i0WqxzZc2UiDVb1QNkvH/WQhckqCWD1mEODWsx/L0KYL5niXfUTpOAeIONw6DCr"
    "6X4gnJMYxL4TIpXh6Q+0+lcJly3Auf1ZSx+5bbuxm/bHbGnEPsj//N8tsiTxvYAjS4XIvB"
    "ZxTPSbxALxmNuQTzoscx1X0nNNJVQgO/kqjnrmV7/OLLB8qr7GXoP0JGZR7cFg6hqohobc"
    "JfCAIkKEAO+FV0rDezadz9XEpcAngtUTNQL25tPle1BEq49rSKyaEETa9+a2JyGGKdIdad"
    "hYVniHWGWHcW5p8h1hliHRgCPcbePW3Q3e5VzCdCs9uf7LW/rn0eHDBadE99wPM+DQWsE+"
    "ulQ2bYY6U5ak258xjcTy5+SidW8UkZVIarZrhqhqt2PNCrHhFoRpnqJnA7u5DvkszP+eb+"
    "3Wqfa/zgVxcVd/mFeZrpYtXgRj8Ab5G/Q2r8GairiLxDYZIk9o59gZ8bk0IYwiFqUUax/B"
    "nlPCWOI3/PIJxgRPAoP/DJdX0T8nuSOFHBWkpmiUDAwhHJjfzLWFaBg9jBAp/Ttl0PCYiE"
    "bKyhXD7DkJlglNJ82Q1DVE+cJoks3lL2xLGcwlDLnwTErgiCEUWUYp/b8t5swk/9Cw5WLN"
    "fHtSckf4+kgfWpAXkadXrT6wIPBVLYhKTVAi1QUUWSt28zvZ9N6Qv65Xf6K0biN/PATNeL"
    "cDmQpKiDMGCR5Vs74O2Q/ow6WFxLEs9qTebpKuWUMZDdBM1CeE2ZNpRD8T0PvK7mcK2eka"
    "vMqhGuwc/gwWbLbwODfRjso2QImxsI1Q3MgB8G/DgTz7cBP548+JFbNT0txSL305xa7Vcx"
    "bL0p9h1dW3907BTu4fZq8nm4kIGa3pPXXinhXPSVPQySDnQRyZrpW9AnviehjaF2KO6q9/"
    "3t5VOp8AMe7PP7tAg3ySq9+7LF/XMZ382bnYvUfHYBme3YwiMLNk0zzUiikCeSnH7bDKU0"
    "a+PXy7ViRDxVzpgMRj/2qe8spPg18X95E4tCGI5/DK9f07qUfX97fMmgGZAe2r7MV7g7h5"
    "xCYSPybxjNCiJFQLzqrj32ZD879xJKpAuQK7b7JkXsX1Cv3AMDPHewBOYTZHnCJ5CnDz2D"
    "gmXu2eSQtGfNgpxlvvxpUC0RxkOHdZQxBOr5pDx2VkcpknHTXqE1gBL1Z+GE0lFGvAaQKQ"
    "5T5j0G0sP6QX/oJAmIVzR2XEmSrPXUFyKfZqXttsnayFoGWyP5U8tncMHBAqmnK/oyP8sr"
    "7P8dtPvDp2vut8sXQuquBaOIbU78QD+RihNNSmOCtrJyxPAy0F04X6gFBFZIh+ZsVLX75c"
    "dswyz7scJ7yW2Y3bIwvERvZBflOJOIfIhoPUBAKzFKBrMovV/TQw12aPGvRfYJXminWgGw"
    "RkMxaOtXySMHvvw84nG2IQjUnDmSPSIjnD0RgktNFOahL/leD/DeGs+s8cwaVrpxzBrH7M"
    "PwyhnH7JN3zBaGaS+GJsz9NK7Z7nXMDt2xVFHtaRcs8u6bF+04tYKv171bCxUXr0pV0uD7"
    "cnOXCjmRmLuyTrrsgMLG6WloS/mfyL26n+l2qGP1iXGXhSmrEdzxuMvCgm47kPfnLstlHl"
    "ETau0feHTqkT7cYwsfcbdYxh//D5u0Dec="
)
