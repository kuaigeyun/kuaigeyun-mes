#!/usr/bin/env bash
# systemd 直管：Caddy 前台运行
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DEPLOY_MODE=prod
export RIVEREDGE_SYSTEMD=1
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"
load_deploy_env
ensure_linux_caddy_ready
gen_caddyfile
caddy_export_env
ensure_caddy_data_migrated
playwright_export_env
caddy_bin="$(resolve_caddy)"
caddy_config="$(caddy_resolved_config_path)"
[ -n "$caddy_bin" ] || { echo "Caddy 未安装" >&2; exit 1; }
ensure_caddy_bind_caps "$caddy_bin" || exit 1
"$caddy_bin" validate --config "$caddy_config" >/dev/null
exec env XDG_DATA_HOME="$XDG_DATA_HOME" XDG_CONFIG_HOME="$XDG_CONFIG_HOME" \
    "$caddy_bin" run --config "$caddy_config"
