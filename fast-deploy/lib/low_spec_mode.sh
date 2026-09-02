#!/usr/bin/env bash
# RiverEdge 低配模式（小内存服务器资源优化；由 common.sh source）

low_spec_mode_enabled() {
    load_deploy_env
    case "${LOW_SPEC_MODE:-0}" in
        1|yes|true|Y|y|on|ON) return 0 ;;
        *) return 1 ;;
    esac
}

low_spec_mode_status_label() {
    if low_spec_mode_enabled; then
        echo "已开启（小内存优化）"
    else
        echo "已关闭（一般模式）"
    fi
}

_low_spec_snap_key() {
    printf 'LOW_SPEC_SNAP_%s' "$1"
}

_low_spec_read_snap_deploy() {
    local field="$1" fallback="$2"
    local key val
    key="$(_low_spec_snap_key "$field")"
    val="$(read_deploy_env_value "$key" 2>/dev/null || true)"
    if [ -n "$val" ]; then
        printf '%s' "$val"
    else
        printf '%s' "$fallback"
    fi
}

low_spec_save_snapshot() {
    ensure_env_file
    local tw pp nb tsto bsto bg dm dmax tmin tmax
    tw="$(read_deploy_env_value TASKIQ_WORKERS 2>/dev/null || true)"
    [ -n "$tw" ] || tw="${TASKIQ_WORKERS:-1}"
    pp="$(read_deploy_env_value PLAYWRIGHT_POSTINSTALL_ENABLE 2>/dev/null || true)"
    [ -n "$pp" ] || pp="${PLAYWRIGHT_POSTINSTALL_ENABLE:-1}"
    nb="$(read_deploy_env_value NODE_BUILD_MEM 2>/dev/null || true)"
    [ -n "$nb" ] || nb="${NODE_BUILD_MEM:-4096}"
    tsto="$(read_deploy_env_value TASKIQ_START_TIMEOUT 2>/dev/null || true)"
    [ -n "$tsto" ] || tsto="${TASKIQ_START_TIMEOUT:-180}"
    bsto="$(read_deploy_env_value BACKEND_START_TIMEOUT 2>/dev/null || true)"
    [ -n "$bsto" ] || bsto="${BACKEND_START_TIMEOUT:-120}"
    bg="$(read_deploy_env_value BLUE_GREEN_DEPLOY 2>/dev/null || true)"
    [ -n "$bg" ] || bg="${BLUE_GREEN_DEPLOY:-0}"
    dm="$(read_env_value RIVEREDGE_DB_POOL_MIN 2>/dev/null || true)"
    [ -n "$dm" ] || dm="2"
    dmax="$(read_env_value RIVEREDGE_DB_POOL_MAX 2>/dev/null || true)"
    [ -n "$dmax" ] || dmax="10"
    tmin="$(read_env_value RIVEREDGE_TASKIQ_POOL_MIN 2>/dev/null || true)"
    [ -n "$tmin" ] || tmin="1"
    tmax="$(read_env_value RIVEREDGE_TASKIQ_POOL_MAX 2>/dev/null || true)"
    [ -n "$tmax" ] || tmax="3"

    set_deploy_env_value "$(_low_spec_snap_key TASKIQ_WORKERS)" "$tw"
    set_deploy_env_value "$(_low_spec_snap_key PLAYWRIGHT_POSTINSTALL_ENABLE)" "$pp"
    set_deploy_env_value "$(_low_spec_snap_key NODE_BUILD_MEM)" "$nb"
    set_deploy_env_value "$(_low_spec_snap_key TASKIQ_START_TIMEOUT)" "$tsto"
    set_deploy_env_value "$(_low_spec_snap_key BACKEND_START_TIMEOUT)" "$bsto"
    set_deploy_env_value "$(_low_spec_snap_key BLUE_GREEN_DEPLOY)" "$bg"
    set_deploy_env_value "$(_low_spec_snap_key RIVEREDGE_DB_POOL_MIN)" "$dm"
    set_deploy_env_value "$(_low_spec_snap_key RIVEREDGE_DB_POOL_MAX)" "$dmax"
    set_deploy_env_value "$(_low_spec_snap_key RIVEREDGE_TASKIQ_POOL_MIN)" "$tmin"
    set_deploy_env_value "$(_low_spec_snap_key RIVEREDGE_TASKIQ_POOL_MAX)" "$tmax"
    set_deploy_env_value LOW_SPEC_SNAPSHOT "1"
}

low_spec_apply_profile() {
    ensure_env_file
    if ! low_spec_mode_enabled; then
        low_spec_save_snapshot
    fi

    set_deploy_env_value LOW_SPEC_MODE "1"
    set_deploy_env_value TASKIQ_WORKERS "1"
    set_deploy_env_value PLAYWRIGHT_POSTINSTALL_ENABLE "0"
    # 仅关闭 Chromium 后台补装以省内存/带宽；Playwright 包与已装浏览器目录保留
    set_deploy_env_value NODE_BUILD_MEM "2048"
    set_deploy_env_value ALLOW_SERVER_BUILD "0"
    set_deploy_env_value TASKIQ_START_TIMEOUT "300"
    set_deploy_env_value BACKEND_START_TIMEOUT "180"
    set_deploy_env_value BLUE_GREEN_DEPLOY "0"
    set_deploy_env_value UPDATE_BLUE_GREEN "0"

    set_env_value RIVEREDGE_DB_POOL_MIN "1"
    set_env_value RIVEREDGE_DB_POOL_MAX "3"
    set_env_value RIVEREDGE_TASKIQ_POOL_MIN "1"
    set_env_value RIVEREDGE_TASKIQ_POOL_MAX "2"
    set_env_value DOCS_ENABLED "false"

    # 清除蓝绿状态，避免 start/update 仍走双槽位
    if [ -f "${LOGS_DIR}/blue-green.state" ]; then
        rm -f "${LOGS_DIR}/blue-green.state"
        log_info "已清除蓝绿状态文件，低配模式固定传统单槽位部署"
    fi

    load_deploy_env
    ensure_production_swap || true
    ensure_low_memory_kernel_tuning || true
    ensure_low_memory_postgresql || true
}

low_spec_apply_normal_profile() {
    ensure_env_file
    local tw pp nb tsto bsto bg dm dmax tmin tmax

    tw="$(_low_spec_read_snap_deploy TASKIQ_WORKERS "1")"
    pp="$(_low_spec_read_snap_deploy PLAYWRIGHT_POSTINSTALL_ENABLE "1")"
    nb="$(_low_spec_read_snap_deploy NODE_BUILD_MEM "4096")"
    tsto="$(_low_spec_read_snap_deploy TASKIQ_START_TIMEOUT "180")"
    bsto="$(_low_spec_read_snap_deploy BACKEND_START_TIMEOUT "120")"
    bg="$(_low_spec_read_snap_deploy BLUE_GREEN_DEPLOY "0")"
    dm="$(_low_spec_read_snap_deploy RIVEREDGE_DB_POOL_MIN "2")"
    dmax="$(_low_spec_read_snap_deploy RIVEREDGE_DB_POOL_MAX "10")"
    tmin="$(_low_spec_read_snap_deploy RIVEREDGE_TASKIQ_POOL_MIN "1")"
    tmax="$(_low_spec_read_snap_deploy RIVEREDGE_TASKIQ_POOL_MAX "3")"

    set_deploy_env_value LOW_SPEC_MODE "0"
    set_deploy_env_value TASKIQ_WORKERS "$tw"
    set_deploy_env_value PLAYWRIGHT_POSTINSTALL_ENABLE "$pp"
    set_deploy_env_value NODE_BUILD_MEM "$nb"
    set_deploy_env_value TASKIQ_START_TIMEOUT "$tsto"
    set_deploy_env_value BACKEND_START_TIMEOUT "$bsto"
    set_deploy_env_value BLUE_GREEN_DEPLOY "$bg"

    set_env_value RIVEREDGE_DB_POOL_MIN "$dm"
    set_env_value RIVEREDGE_DB_POOL_MAX "$dmax"
    set_env_value RIVEREDGE_TASKIQ_POOL_MIN "$tmin"
    set_env_value RIVEREDGE_TASKIQ_POOL_MAX "$tmax"

    load_deploy_env
}

_low_spec_print_profile_summary() {
    echo "  TASKIQ_WORKERS=${TASKIQ_WORKERS:-—}"
    echo "  PLAYWRIGHT_POSTINSTALL_ENABLE=${PLAYWRIGHT_POSTINSTALL_ENABLE:-—}"
    echo "  RIVEREDGE_DB_POOL_MIN/MAX=$(read_env_value RIVEREDGE_DB_POOL_MIN 2>/dev/null || echo —)/$(read_env_value RIVEREDGE_DB_POOL_MAX 2>/dev/null || echo —)"
    echo "  RIVEREDGE_TASKIQ_POOL_MIN/MAX=$(read_env_value RIVEREDGE_TASKIQ_POOL_MIN 2>/dev/null || echo —)/$(read_env_value RIVEREDGE_TASKIQ_POOL_MAX 2>/dev/null || echo —)"
    echo "  BLUE_GREEN_DEPLOY=${BLUE_GREEN_DEPLOY:-0}  ALLOW_SERVER_BUILD=${ALLOW_SERVER_BUILD:-0}"
    echo "  NODE_BUILD_MEM=${NODE_BUILD_MEM:-—}  TASKIQ_START_TIMEOUT=${TASKIQ_START_TIMEOUT:-—}"
}

host_total_mem_mb() {
    if [ -r /proc/meminfo ]; then
        awk '/^MemTotal:/ {printf "%d", $2/1024}' /proc/meminfo
        return 0
    fi
    echo 0
}

host_swap_active() {
    if ! command -v swapon >/dev/null 2>&1; then
        return 1
    fi
    swapon --show 2>/dev/null | grep -q .
}

swap_auto_enable_configured() {
    load_deploy_env
    case "${SWAP_AUTO_ENABLE:-1}" in
        1|yes|true|Y|y|on|ON) return 0 ;;
        *) return 1 ;;
    esac
}

should_auto_enable_swap() {
    swap_auto_enable_configured || return 1
    if low_spec_mode_enabled; then
        return 0
    fi
    local mb
    mb="$(host_total_mem_mb)"
    [ -n "$mb" ] && [ "$mb" -gt 0 ] && [ "$mb" -le 5120 ]
}

_swap_run_root() {
    if [ "$(id -u)" -eq 0 ]; then
        "$@"
        return $?
    fi
    if sudo -n true 2>/dev/null; then
        sudo -n "$@"
        return $?
    fi
    return 1
}

_swap_ensure_fstab_entry() {
    local swap_file="$1"
    if [ ! -f /etc/fstab ]; then
        return 0
    fi
    if grep -qF "$swap_file" /etc/fstab 2>/dev/null; then
        return 0
    fi
    printf '%s none swap sw 0 0\n' "$swap_file" >> /etc/fstab
}

_create_swapfile_at() {
    local swap_file="$1"
    local swap_gb="$2"
    local swap_mb parent_dir
    swap_mb=$((swap_gb * 1024))
    parent_dir="$(dirname "$swap_file")"
    [ -d "$parent_dir" ] || mkdir -p "$parent_dir"

    if [ -f "$swap_file" ]; then
        log_info "发现已有 swap 文件 ${swap_file}，直接启用..."
    elif command -v fallocate >/dev/null 2>&1; then
        fallocate -l "${swap_gb}G" "$swap_file"
    else
        dd if=/dev/zero of="$swap_file" bs=1M count="$swap_mb" status=progress
    fi
    chmod 600 "$swap_file"
    mkswap "$swap_file"
    swapon "$swap_file"
    _swap_ensure_fstab_entry "$swap_file"
}

ensure_production_swap() {
    local force="${1:-0}"
    if is_windows_gitbash; then
        return 0
    fi
    load_deploy_env
    swap_auto_enable_configured || return 0

    if host_swap_active; then
        log_ok "Swap 已启用: $(free -h 2>/dev/null | awk '/^Swap:/ {print $2 " (已用 " $3 ")"}' || echo —)"
        return 0
    fi

    if [ "$force" != "1" ] && ! should_auto_enable_swap; then
        _low_spec_swap_hint
        return 0
    fi

    local swap_file="${SWAP_FILE:-/swapfile}"
    local swap_gb="${SWAP_SIZE_GB:-4}"
    case "$swap_gb" in
        ''|*[!0-9]*)
            log_error "SWAP_SIZE_GB 无效: ${swap_gb}"
            return 1
            ;;
    esac
    if [ "$swap_gb" -lt 1 ] || [ "$swap_gb" -gt 32 ]; then
        log_error "SWAP_SIZE_GB 须在 1～32 之间（当前 ${swap_gb}）"
        return 1
    fi

    log_info "未检测到 swap，创建 ${swap_gb}GB swap（${swap_file}）以降低 OOM 风险..."
    if _swap_run_root _create_swapfile_at "$swap_file" "$swap_gb"; then
        log_ok "Swap 已创建并启用: $(free -h 2>/dev/null | awk '/^Swap:/ {print $2}' || echo —)"
        return 0
    fi

    log_warn "自动配置 swap 需要 root 权限（当前无 sudo 免密）"
    log_info "请手动执行: sudo ./fast-deploy/deploy.sh setup-swap"
    log_info "或: sudo fallocate -l ${swap_gb}G ${swap_file} && sudo chmod 600 ${swap_file} && sudo mkswap ${swap_file} && sudo swapon ${swap_file}"
    return 1
}

_low_spec_swap_hint() {
    if is_windows_gitbash; then
        return 0
    fi
    if host_swap_active; then
        return 0
    fi
    log_warn "未检测到 swap；3～4GB 内存机建议配置 2～4GB swap，降低 OOM 风险"
    log_info "自动配置: sudo ./fast-deploy/deploy.sh setup-swap（或开启低配模式后 start）"
}

cmd_setup_swap() {
    if is_windows_gitbash; then
        log_error "setup-swap 仅支持 Linux 生产机"
        return 1
    fi
    ensure_production_swap 1
}

_ensure_sysctl_vm_swappiness() {
    local target="${1:-10}"
    if is_windows_gitbash; then
        return 0
    fi
    if [ "$(id -u)" -eq 0 ]; then
        sysctl -w "vm.swappiness=${target}" >/dev/null 2>&1 || true
        grep -q '^vm.swappiness=' /etc/sysctl.conf 2>/dev/null || \
            echo "vm.swappiness=${target}" >> /etc/sysctl.conf
    elif sudo -n sysctl -w "vm.swappiness=${target}" >/dev/null 2>&1; then
        if ! grep -q '^vm.swappiness=' /etc/sysctl.conf 2>/dev/null; then
            echo "vm.swappiness=${target}" | sudo tee -a /etc/sysctl.conf >/dev/null
        fi
    else
        log_warn "无法设置 vm.swappiness=${target}（需 root）；可手动: sudo sysctl -w vm.swappiness=${target}"
        return 1
    fi
    log_ok "vm.swappiness=${target}"
    return 0
}

ensure_low_memory_kernel_tuning() {
    if is_windows_gitbash; then
        return 0
    fi
    load_deploy_env
    swap_auto_enable_configured || return 0
    _ensure_sysctl_vm_swappiness "${VM_SWAPPINESS:-10}" || true
}

ensure_low_memory_postgresql() {
    if is_windows_gitbash; then
        return 0
    fi
    load_deploy_env
    swap_auto_enable_configured || return 0
    local total_mb
    total_mb="$(host_total_mem_mb 2>/dev/null || echo 0)"
    if [ "$total_mb" -gt 5120 ]; then
        return 0
    fi
    local conf_dir conf_file
    if [ -d /etc/postgresql ]; then
        conf_dir="$(find /etc/postgresql -maxdepth 2 -type d -name main 2>/dev/null | head -1)"
        [ -n "$conf_dir" ] || return 0
        conf_file="${conf_dir}/conf.d/riveredge-lowmem.conf"
        local content="shared_buffers = 256MB
max_connections = 80
work_mem = 4MB
maintenance_work_mem = 64MB
"
        if [ "$(id -u)" -eq 0 ]; then
            printf '%s' "$content" > "$conf_file"
            systemctl reload postgresql 2>/dev/null || systemctl restart postgresql 2>/dev/null || true
        elif sudo -n true 2>/dev/null; then
            printf '%s' "$content" | sudo tee "$conf_file" >/dev/null
            sudo systemctl reload postgresql 2>/dev/null || sudo systemctl restart postgresql 2>/dev/null || true
        else
            log_warn "无法写入 PostgreSQL 低配 conf（需 sudo）: ${conf_file}"
            return 1
        fi
        log_ok "PostgreSQL 低配参数已写入 ${conf_file}"
    fi
}

_low_spec_offer_restart() {
    local input
    if [ ! -t 0 ]; then
        log_info "非交互模式：请手动执行 ./fast-deploy/deploy.sh stop && ./fast-deploy/deploy.sh start"
        return 0
    fi
    read -rp "是否立即重启服务使配置生效？[y/N]: " input
    case "${input:-N}" in
        y|Y|yes|是)
            if [ "$DEPLOY_MODE" = "dev" ]; then
                cmd_stop_dev
                cmd_start_dev
            else
                cmd_stop_prod
                cmd_start_prod
            fi
            ;;
        *)
            log_info "已保存配置；下次 start/restart 后生效"
            ;;
    esac
}

cmd_low_spec_mode() {
    load_deploy_env
    ensure_env_file
    echo ""
    echo "=== 低配模式（小内存服务器）==="
    echo "  当前: $(low_spec_mode_status_label)"
    echo "  内存: $(host_mem_summary)"
    _low_spec_swap_hint
    echo ""
    echo "  开启后: Taskiq 单 worker、关闭 Playwright 后台补装、缩小 DB 连接池、"
    echo "          关闭 Chromium 后台补装（已装浏览器保留）、禁用蓝绿双后端（更新固定传统部署）、"
    echo "          延长启动等待；无 swap 时尝试自动创建（见 deploy.env SWAP_*）；适合约 4GB 及以下内存。"
    echo ""
    echo "  [1] 开启低配模式"
    echo "  [2] 恢复一般模式"
    echo "  [0] 返回 / 取消"
    echo ""
    if [ ! -t 0 ]; then
        log_error "非交互环境请使用: ./fast-deploy/deploy.sh low-spec-mode on|off"
        return 1
    fi
    local choice
    read -rp "请选择 [0/1/2]: " choice
    case "${choice:-0}" in
        1|on|enable)
            if low_spec_mode_enabled; then
                log_ok "低配模式已处于开启状态"
                _low_spec_print_profile_summary
                return 0
            fi
            low_spec_apply_profile
            log_ok "已开启低配模式并写入 deploy.env / riveredge-backend/.env"
            _low_spec_print_profile_summary
            _low_spec_offer_restart
            ;;
        2|off|disable)
            if ! low_spec_mode_enabled; then
                log_ok "当前已为一般模式"
                _low_spec_print_profile_summary
                return 0
            fi
            low_spec_apply_normal_profile
            log_ok "已恢复一般模式（自开启低配前的快照；若无快照则使用默认推荐值）"
            _low_spec_print_profile_summary
            _low_spec_offer_restart
            ;;
        0|q|Q|"")
            return 0
            ;;
        *)
            log_warn "无效选项"
            return 1
            ;;
    esac
}

cmd_low_spec_mode_cli() {
    local action="${1:-}"
    load_deploy_env
    ensure_env_file
    case "$action" in
        on|enable|1)
            low_spec_apply_profile
            log_ok "低配模式已开启"
            _low_spec_print_profile_summary
            ;;
        off|disable|0)
            low_spec_apply_normal_profile
            log_ok "已恢复一般模式"
            _low_spec_print_profile_summary
            ;;
        status)
            echo "低配模式: $(low_spec_mode_status_label)"
            _low_spec_print_profile_summary
            ;;
        *)
            cmd_low_spec_mode
            ;;
    esac
}
