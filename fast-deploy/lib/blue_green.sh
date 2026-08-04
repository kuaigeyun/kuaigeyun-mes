#!/usr/bin/env bash
# RiverEdge 蓝绿部署（由 common.sh source；勿直接执行）

BG_STATE_FILE="${LOGS_DIR}/blue-green.state"
BG_DEV_API_CADDYFILE="${CADDY_DIR}/Caddyfile.dev-api"
BG_DEV_API_TEMPLATE="${FAST_DEPLOY_DIR}/templates/Caddyfile.dev-api.template"

bg_enabled() {
    # 曾用蓝绿 update 后会留下 state；start/stop/status 据此继续走双槽位
    [ -f "$BG_STATE_FILE" ] && return 0
    [ "${BLUE_GREEN_DEPLOY:-0}" = "1" ] && return 0
    return 1
}

# update 时是否走蓝绿（交互选择；非交互与传统模式默认 stop-start，UPDATE_BLUE_GREEN=1 启用蓝绿）
update_use_blue_green() {
    load_deploy_env
    if [ -n "${UPDATE_BLUE_GREEN:-}" ]; then
        case "${UPDATE_BLUE_GREEN}" in
            1|yes|true|Y|y) return 0 ;;
            *) return 1 ;;
        esac
    fi
    if [ ! -t 0 ]; then
        log_info "非交互 update，默认传统 stop-start（export UPDATE_BLUE_GREEN=1 可启用蓝绿）"
        return 1
    fi
    local input
    echo ""
    log_info "更新方式："
    echo "  [0] 传统 stop → migrate → start（默认，低配友好）"
    echo "  [1] 蓝绿部署（备选，尽量不停机；低配机可能卡顿）"
    read -rp "请选择 [0/1，回车=0 传统]: " input
    input="${input:-0}"
    case "$input" in
        1|y|Y|yes|蓝绿) return 0 ;;
        0|n|N|no|传统) return 1 ;;
        *)
            log_warn "无效输入，使用默认：传统 stop-start"
            return 1
            ;;
    esac
}

prompt_update_blue_green() {
    if update_use_blue_green; then
        log_ok "本次更新：蓝绿部署"
        return 0
    fi
    log_ok "本次更新：传统 stop-start"
    return 1
}

bg_load_deploy_defaults() {
    BLUE_GREEN_DEPLOY="${BLUE_GREEN_DEPLOY:-0}"
    BACKEND_PORT_BLUE="${BACKEND_PORT_BLUE:-8201}"
    BACKEND_PORT_GREEN="${BACKEND_PORT_GREEN:-8202}"
    WORKER_DRAIN_TIMEOUT="${WORKER_DRAIN_TIMEOUT:-60}"
    BLUE_GREEN_HEALTH_TIMEOUT="${BLUE_GREEN_HEALTH_TIMEOUT:-120}"
}

bg_state_get() {
    local key="$1"
    [ -f "$BG_STATE_FILE" ] || return 1
    grep -E "^${key}=" "$BG_STATE_FILE" 2>/dev/null | tail -1 | cut -d= -f2-
}

bg_state_set() {
    local key="$1" val="$2"
    ensure_logs_dir
    local tmp="${BG_STATE_FILE}.tmp"
    if [ -f "$BG_STATE_FILE" ]; then
        grep -v -E "^${key}=" "$BG_STATE_FILE" >"$tmp" 2>/dev/null || true
    else
        : >"$tmp"
    fi
    printf '%s=%s\n' "$key" "$val" >>"$tmp"
    mv "$tmp" "$BG_STATE_FILE"
}

bg_slot_port() {
    case "$1" in
        blue) echo "$BACKEND_PORT_BLUE" ;;
        green) echo "$BACKEND_PORT_GREEN" ;;
        *) log_error "未知槽位: $1"; return 1 ;;
    esac
}

bg_active_slot() {
    local slot
    slot="$(bg_state_get active_slot 2>/dev/null || true)"
    if [ "$slot" = "blue" ] || [ "$slot" = "green" ]; then
        echo "$slot"
        return 0
    fi
    echo "blue"
}

bg_inactive_slot() {
    if [ "$(bg_active_slot)" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

bg_active_port() {
    bg_slot_port "$(bg_active_slot)"
}

bg_inactive_port() {
    bg_slot_port "$(bg_inactive_slot)"
}

bg_backend_pid_file() {
    echo "${LOGS_DIR}/backend-$1.pid"
}

bg_backend_log_file() {
    echo "${LOGS_DIR}/backend-$1.log"
}

bg_sync_active_backend_pid_legacy() {
    local slot pidf
    slot="$(bg_active_slot)"
    pidf="$(bg_backend_pid_file "$slot")"
    if [ -f "$pidf" ]; then
        cp -f "$pidf" "${LOGS_DIR}/backend.pid" 2>/dev/null || true
    fi
}

bg_wait_health_on_port() {
    local port="$1"
    local timeout="${2:-$BLUE_GREEN_HEALTH_TIMEOUT}"
    local retries=0
    while [ "$retries" -lt "$timeout" ]; do
        if curl -sf "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
        retries=$((retries + 1))
    done
    return 1
}

bg_frontend_slot_dir() {
    echo "${FRONTEND_DIR}/dist-$1"
}

bg_frontend_live_link() {
    echo "${FRONTEND_DIR}/dist-live"
}

bg_init_frontend_slots() {
    local slot dir live
    live="$(bg_frontend_live_link)"
    for slot in blue green; do
        dir="$(bg_frontend_slot_dir "$slot")"
        if [ ! -f "$dir/index.html" ] && [ -f "$FRONTEND_DIR/dist/index.html" ]; then
            log_info "初始化前端槽位 dist-${slot}..."
            rm -rf "$dir"
            mkdir -p "$dir"
            cp -a "$FRONTEND_DIR/dist/." "$dir/"
        fi
    done
    if [ ! -L "$live" ] && [ ! -d "$live" ]; then
        local active_fe
        active_fe="$(bg_state_get frontend_slot 2>/dev/null || bg_active_slot)"
        ln -sfn "$(bg_frontend_slot_dir "$active_fe")" "$live"
    fi
}

bg_get_frontend_root_for_caddy() {
    local live
    live="$(bg_frontend_live_link)"
    if [ -L "$live" ] || [ -d "$live" ]; then
        caddy_native_path "$live"
        return 0
    fi
    caddy_native_path "$FRONTEND_DIR/dist"
}

bg_sync_all_frontend_slots_from_dist() {
    local slot src dest
    src="$FRONTEND_DIR/dist"
    [ -f "$src/index.html" ] || { log_error "缺少 $src/index.html"; return 1; }
    [ -f "$src/login.html" ] || { log_error "缺少 $src/login.html"; return 1; }
    bg_init_frontend_slots
    for slot in blue green; do
        dest="$(bg_frontend_slot_dir "$slot")"
        log_info "同步前端槽位 dist-${slot} ← dist..."
        rm -rf "$dest"
        mkdir -p "$dest"
        cp -a "$src/." "$dest/"
    done
    log_ok "蓝绿前端槽位已从 Git dist 同步"
}

bg_prepare_frontend_inactive() {
    local inactive src
    inactive="$(bg_inactive_slot)"
    src="$FRONTEND_DIR/dist"
    local dest
    dest="$(bg_frontend_slot_dir "$inactive")"
    [ -f "$src/index.html" ] || { log_error "缺少 $src/index.html"; return 1; }
    [ -f "$src/login.html" ] || { log_error "缺少 $src/login.html"; return 1; }
    log_info "准备前端 inactive 槽位 dist-${inactive}..."
    rm -rf "$dest"
    mkdir -p "$dest"
    cp -a "$src/." "$dest/"
    log_ok "前端 inactive 槽位就绪"
}

bg_flip_frontend_to_slot() {
    local slot="$1"
    local live dest
    live="$(bg_frontend_live_link)"
    dest="$(bg_frontend_slot_dir "$slot")"
    [ -f "$dest/index.html" ] || { log_error "dist-${slot} 无效"; return 1; }
    ln -sfn "$dest" "$live"
    bg_state_set frontend_slot "$slot"
    log_ok "前端 dist-live -> dist-${slot}"
}

bg_record_pre_update_git() {
    local sha ref
    sha="$(git -C "$PROJECT_ROOT" rev-parse HEAD 2>/dev/null || true)"
    ref="$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
    bg_state_set pre_update_git_sha "$sha"
    bg_state_set pre_update_git_ref "$ref"
}

bg_init_state() {
    ensure_logs_dir
    bg_load_deploy_defaults
    if [ -f "$BG_STATE_FILE" ] && [ -n "$(bg_state_get active_slot 2>/dev/null || true)" ]; then
        bg_init_frontend_slots
        return 0
    fi
    log_info "初始化蓝绿部署状态（active=blue）..."
    bg_state_set active_slot "blue"
    bg_state_set frontend_slot "blue"
    bg_init_frontend_slots
    log_ok "蓝绿状态已初始化"
}

bg_stop_backend_slot() {
    local slot="$1"
    local graceful="${2:-1}"
    local pidf pid
    pidf="$(bg_backend_pid_file "$slot")"
    if [ -f "$pidf" ]; then
        pid="$(tr -d '[:space:]' <"$pidf" 2>/dev/null || true)"
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            if [ "$graceful" = "1" ]; then
                kill -TERM "$pid" 2>/dev/null || true
                local i=0
                while [ "$i" -lt 30 ] && kill -0 "$pid" 2>/dev/null; do
                    sleep 1
                    i=$((i + 1))
                done
                kill -9 "$pid" 2>/dev/null || true
            else
                kill -9 "$pid" 2>/dev/null || true
            fi
            log_info "已停止 backend-${slot} (PID $pid)"
        fi
        rm -f "$pidf"
    fi
    local port
    port="$(bg_slot_port "$slot")"
    kill_port "$port" 2>/dev/null || true
}

bg_stop_all_backends() {
    bg_stop_backend_slot blue 0
    bg_stop_backend_slot green 0
    rm -f "${LOGS_DIR}/backend.pid"
}

bg_start_backend_slot() {
    local slot="$1"
    local mode="${2:-$DEPLOY_MODE}"
    local port host reload_args
    port="$(bg_slot_port "$slot")"
    pidf="$(bg_backend_pid_file "$slot")"
    if [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null; then
        if bg_wait_health_on_port "$port" 5; then
            log_info "backend-${slot} 已在运行 (:${port})"
            bg_sync_active_backend_pid_legacy
            return 0
        fi
        bg_stop_backend_slot "$slot" 0
    fi
    kill_port "$port"
    if [ "$mode" = "dev" ]; then
        host="0.0.0.0"
        reload_args=(--reload --reload-dir src)
        log_info "启动 backend-${slot} (dev, :${port})..."
    else
        sync_backend_deps
        host="127.0.0.1"
        reload_args=(--workers 1)
        log_info "启动 backend-${slot} (prod, :${port})..."
    fi
    (
        cd "$BACKEND_DIR"
        export PORT="$port"
        export HOST="$host"
        export PYTHONPATH="$BACKEND_DIR/src"
        export SETUPTOOLS_EGG_INFO_DIR="$LOGS_DIR"
        if [ "$mode" = "prod" ]; then
            export ENVIRONMENT=production
            export DEBUG=false
            playwright_export_env
        fi
        nohup "$(resolve_uv)" run $(backend_uv_extra_args) uvicorn server.main:app \
            --host "$host" --port "$port" "${reload_args[@]}" \
            > "$(bg_backend_log_file "$slot")" 2>&1 &
        echo $! >"$pidf"
    )
    if ! bg_wait_health_on_port "$port" "$BACKEND_START_TIMEOUT"; then
        log_error "backend-${slot} 启动失败，查看 $(bg_backend_log_file "$slot")"
        tail -30 "$(bg_backend_log_file "$slot")" >&2 || true
        return 1
    fi
    if [ "$(bg_active_slot)" = "$slot" ]; then
        bg_sync_active_backend_pid_legacy
    fi
    log_ok "backend-${slot} 就绪 (:${port})"
}

bg_gen_dev_api_caddyfile() {
    local backend_addr="$1"
    mkdir -p "$CADDY_DIR"
    [ -f "$BG_DEV_API_TEMPLATE" ] || { log_error "缺少 $BG_DEV_API_TEMPLATE"; return 1; }
    sed -e "s|{{LISTEN_PORT}}|${BACKEND_PORT}|g" \
        -e "s|{{BACKEND_ADDR}}|${backend_addr}|g" \
        "$BG_DEV_API_TEMPLATE" >"${BG_DEV_API_CADDYFILE}.tmp"
    mv "${BG_DEV_API_CADDYFILE}.tmp" "$BG_DEV_API_CADDYFILE"
}

bg_start_dev_api_proxy() {
    local active_port backend_addr caddy_bin caddy_config
    active_port="$(bg_active_port)"
    backend_addr="127.0.0.1:${active_port}"
    bg_gen_dev_api_caddyfile "$backend_addr" || return 1
    if [ -f "${LOGS_DIR}/dev-api-proxy.pid" ] && kill -0 "$(cat "${LOGS_DIR}/dev-api-proxy.pid")" 2>/dev/null; then
        if check_port "$BACKEND_PORT"; then
            log_info "dev API 代理已在 :${BACKEND_PORT}"
            return 0
        fi
        stop_service dev-api-proxy
    fi
    caddy_bin="$(resolve_caddy)"
    [ -n "$caddy_bin" ] || { log_error "未安装 Caddy（dev API 代理需要）"; return 1; }
    caddy_config="$(caddy_native_path "$BG_DEV_API_CADDYFILE")"
    if ! "$caddy_bin" validate --config "$caddy_config" >/dev/null 2>&1; then
        log_error "dev API Caddyfile 校验失败"
        return 1
    fi
    log_info "启动 dev API 代理 (:${BACKEND_PORT} -> ${backend_addr})..."
    nohup "$caddy_bin" run --config "$caddy_config" >> "${LOGS_DIR}/dev-api-proxy.log" 2>&1 &
    echo $! > "${LOGS_DIR}/dev-api-proxy.pid"
    local retries=0
    while [ "$retries" -lt 30 ]; do
        check_port "$BACKEND_PORT" && break
        sleep 1
        retries=$((retries + 1))
    done
    check_port "$BACKEND_PORT" || { log_error "dev API 代理启动超时"; return 1; }
    log_ok "dev API 代理就绪"
}

bg_reload_dev_api_proxy() {
    local active_port backend_addr caddy_bin caddy_config
    active_port="$1"
    [ -n "$active_port" ] || active_port="$(bg_active_port)"
    backend_addr="127.0.0.1:${active_port}"
    bg_gen_dev_api_caddyfile "$backend_addr" || return 1
    caddy_bin="$(resolve_caddy)"
    caddy_config="$(caddy_native_path "$BG_DEV_API_CADDYFILE")"
    if [ -f "${LOGS_DIR}/dev-api-proxy.pid" ] && kill -0 "$(cat "${LOGS_DIR}/dev-api-proxy.pid")" 2>/dev/null; then
        if caddy_reload_with_admin "$caddy_bin" "$caddy_config" "$(caddy_dev_api_admin_address)" >/dev/null 2>&1; then
            log_ok "dev API 代理已 reload -> ${backend_addr}"
            return 0
        fi
    fi
    bg_start_dev_api_proxy
}

bg_stop_dev_api_proxy() {
    if [ -f "${LOGS_DIR}/dev-api-proxy.pid" ]; then
        local pid
        pid="$(cat "${LOGS_DIR}/dev-api-proxy.pid" 2>/dev/null || true)"
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null || true
            sleep 2
            kill -9 "$pid" 2>/dev/null || true
        fi
        rm -f "${LOGS_DIR}/dev-api-proxy.pid"
    fi
    kill_port "$BACKEND_PORT" 2>/dev/null || true
}

bg_reload_caddy_prod_config() {
    reload_caddy_prod_config
}

bg_stop_scheduler_only() {
    stop_service scheduler
}

bg_drain_worker_scheduler() {
    bg_stop_scheduler_only
    local pidf pid i
    pidf="$LOGS_DIR/worker.pid"
    if [ -f "$pidf" ]; then
        pid="$(tr -d '[:space:]' <"$pidf" 2>/dev/null || true)"
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            log_info "等待 Worker 优雅退出（最多 ${WORKER_DRAIN_TIMEOUT}s）..."
            kill -TERM "$pid" 2>/dev/null || true
            i=0
            while [ "$i" -lt "$WORKER_DRAIN_TIMEOUT" ] && kill -0 "$pid" 2>/dev/null; do
                sleep 1
                i=$((i + 1))
            done
            if kill -0 "$pid" 2>/dev/null; then
                log_warn "Worker drain 超时，发送 SIGKILL"
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$pidf"
    fi
    stop_service worker
    if [ "$DEPLOY_MODE" = "dev" ]; then
        start_worker_dev
    else
        start_worker_prod
    fi
}

bg_rollback_update() {
    local active_slot active_port
    active_slot="$(bg_active_slot)"
    active_port="$(bg_slot_port "$active_slot")"
    log_warn "执行蓝绿 update 回滚（保持 active=${active_slot}）..."
    bg_stop_backend_slot "$(bg_inactive_slot)" 0
    if [ "$DEPLOY_MODE" = "prod" ]; then
        bg_flip_frontend_to_slot "$active_slot" || true
        gen_caddyfile
        bg_reload_caddy_prod_config || true
    else
        bg_reload_dev_api_proxy "$active_port" || bg_start_dev_api_proxy || true
    fi
    if ! bg_wait_health_on_port "$active_port" 10; then
        log_error "回滚后 active backend 不健康，请手动检查"
        log_error "升级前 Git: $(bg_state_get pre_update_git_sha 2>/dev/null || echo unknown)"
        return 1
    fi
    log_warn "蓝绿回滚完成；若需完整退回升级前代码: git checkout $(bg_state_get pre_update_git_sha 2>/dev/null || echo '<pre_update_git_sha>')"
    return 0
}

bg_run_update_prod() {
    local inactive inactive_port old_active old_port
    bg_init_state
    bg_record_pre_update_git
    inactive="$(bg_inactive_slot)"
    inactive_port="$(bg_slot_port "$inactive")"
    old_active="$(bg_active_slot)"
    old_port="$(bg_slot_port "$old_active")"

    if [ "${SKIP_GIT_SYNC:-0}" != "1" ]; then
        sync_git_from_origin || return 1
    fi
    recompose_extension_apps_if_enabled || return 1
    cmd_ensure_frontend_dist || return 1
    bg_prepare_frontend_inactive || return 1

    cmd_migrate || { bg_rollback_update; return 1; }

    bg_stop_scheduler_only
    if ! bg_start_backend_slot "$inactive" prod; then
        bg_rollback_update
        return 1
    fi

    if ! bg_flip_frontend_to_slot "$inactive"; then
        bg_stop_backend_slot "$inactive" 0
        bg_rollback_update
        return 1
    fi

    bg_state_set active_slot "$inactive"
    if ! bg_reload_caddy_prod_config; then
        bg_state_set active_slot "$old_active"
        bg_flip_frontend_to_slot "$old_active" || true
        bg_stop_backend_slot "$inactive" 0
        bg_rollback_update
        return 1
    fi

    bg_stop_backend_slot "$old_active" 1
    bg_sync_active_backend_pid_legacy
    bg_drain_worker_scheduler || return 1
    record_deploy_release_metadata || return 1
    log_ok "生产环境蓝绿 update 完成 (active=${inactive}, :${inactive_port})"
}

bg_run_update_dev() {
    local inactive inactive_port old_active old_port
    bg_init_state
    bg_record_pre_update_git
    inactive="$(bg_inactive_slot)"
    inactive_port="$(bg_slot_port "$inactive")"
    old_active="$(bg_active_slot)"
    old_port="$(bg_slot_port "$old_active")"

    if [ "${SKIP_GIT_SYNC:-0}" != "1" ]; then
        sync_git_from_origin || return 1
    fi
    recompose_extension_apps_if_enabled || return 1

    cmd_migrate || { bg_rollback_update; return 1; }

    bg_stop_scheduler_only
    if ! bg_start_backend_slot "$inactive" dev; then
        bg_rollback_update
        return 1
    fi

    if ! bg_reload_dev_api_proxy "$inactive_port"; then
        bg_stop_backend_slot "$inactive" 0
        bg_rollback_update
        return 1
    fi

    bg_state_set active_slot "$inactive"
    bg_stop_backend_slot "$old_active" 1
    bg_sync_active_backend_pid_legacy
    bg_drain_worker_scheduler || return 1
    record_deploy_release_metadata || return 1
    log_ok "开发环境蓝绿 update 完成 (active=${inactive}, API 入口 :${BACKEND_PORT})"
}

bg_start_stack_dev() {
    bg_init_state
    local slot
    slot="$(bg_active_slot)"
    bg_start_backend_slot "$slot" dev || return 1
    bg_start_dev_api_proxy || return 1
    start_worker_dev
}

bg_start_stack_prod_backend() {
    bg_init_state
    local slot
    slot="$(bg_active_slot)"
    bg_start_backend_slot "$slot" prod || return 1
}

bg_stop_stack() {
    bg_stop_dev_api_proxy
    bg_stop_all_backends
    stop_service worker
    stop_service scheduler
}

bg_print_status() {
    local slot port
    echo "  蓝绿部署: 已启用 (active=$(bg_active_slot), frontend=$(bg_state_get frontend_slot 2>/dev/null || echo ?))"
    for slot in blue green; do
        port="$(bg_slot_port "$slot")"
        if curl -sf "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
            echo "  backend-${slot} (:${port}): 健康"
        else
            echo "  backend-${slot} (:${port}): 未就绪"
        fi
    done
    if [ "$DEPLOY_MODE" = "dev" ]; then
        check_port "$BACKEND_PORT" && echo "  dev API 代理 (:${BACKEND_PORT}): 监听中" || echo "  dev API 代理 (:${BACKEND_PORT}): 未运行"
    fi
    local live
    live="$(bg_frontend_live_link)"
    if [ -L "$live" ]; then
        echo "  dist-live -> $(readlink "$live" 2>/dev/null || echo ?)"
    fi
}
