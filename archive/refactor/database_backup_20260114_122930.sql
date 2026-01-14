--
-- PostgreSQL database dump
--

\restrict G5SYKepfFWYDaCOxH97VFCYHLek7fcU6hWRfZZ3qSboelrWwipJf3dyvTRK5YXE

-- Dumped from database version 15.14
-- Dumped by pg_dump version 15.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.apps_kuaizhizao_mrp_results DROP CONSTRAINT IF EXISTS fk_apps_kuaizhizao_mrp_results_forecast_id;
ALTER TABLE IF EXISTS ONLY public.apps_kuaizhizao_lrp_results DROP CONSTRAINT IF EXISTS fk_apps_kuaizhizao_lrp_results_sales_order_id;
DROP INDEX IF EXISTS public.idx_apps_kuaizh_tenant__da4353;
DROP INDEX IF EXISTS public.idx_apps_kuaizh_tenant__6f4c84;
DROP INDEX IF EXISTS public.idx_apps_kuaizh_tenant__5edd5c;
DROP INDEX IF EXISTS public.idx_apps_kuaizh_tenant__527e15;
DROP INDEX IF EXISTS public.idx_apps_kuaizh_tenant__3c150b;
DROP INDEX IF EXISTS public.idx_apps_kuaizh_tenant__368a43;
DROP INDEX IF EXISTS public.idx_apps_kuaizh_tenant__21723c;
DROP INDEX IF EXISTS public.idx_apps_kuaizh_tenant__137f71;
DROP INDEX IF EXISTS public.idx_apps_kuaizh_start_d_247e36;
DROP INDEX IF EXISTS public.idx_apps_kuaizh_order_d_1ef496;
DROP INDEX IF EXISTS public.idx_apps_kuaizh_deliver_d65cf9;
DROP INDEX IF EXISTS public.idx_apps_kuaizh_deliver_ad67f4;
DROP INDEX IF EXISTS public.idx_apps_kuaizh_computa_acf7da;
DROP INDEX IF EXISTS public.idx_apps_kuaizh_computa_916201;
DROP INDEX IF EXISTS public.idx_apps_kuaizh_computa_637d36;
DROP INDEX IF EXISTS public.idx_apps_kuaizh_computa_4fd56c;
ALTER TABLE IF EXISTS ONLY public.apps_kuaizhizao_sales_orders DROP CONSTRAINT IF EXISTS apps_kuaizhizao_sales_orders_pkey;
ALTER TABLE IF EXISTS ONLY public.apps_kuaizhizao_sales_orders DROP CONSTRAINT IF EXISTS apps_kuaizhizao_sales_orders_order_code_key;
ALTER TABLE IF EXISTS ONLY public.apps_kuaizhizao_sales_forecasts DROP CONSTRAINT IF EXISTS apps_kuaizhizao_sales_forecasts_pkey;
ALTER TABLE IF EXISTS ONLY public.apps_kuaizhizao_sales_forecasts DROP CONSTRAINT IF EXISTS apps_kuaizhizao_sales_forecasts_forecast_code_key;
ALTER TABLE IF EXISTS ONLY public.apps_kuaizhizao_mrp_results DROP CONSTRAINT IF EXISTS apps_kuaizhizao_mrp_results_pkey;
ALTER TABLE IF EXISTS ONLY public.apps_kuaizhizao_lrp_results DROP CONSTRAINT IF EXISTS apps_kuaizhizao_lrp_results_pkey;
ALTER TABLE IF EXISTS public.apps_kuaizhizao_sales_orders ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.apps_kuaizhizao_sales_forecasts ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.apps_kuaizhizao_mrp_results ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.apps_kuaizhizao_lrp_results ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.apps_kuaizhizao_sales_orders_id_seq;
DROP TABLE IF EXISTS public.apps_kuaizhizao_sales_orders;
DROP SEQUENCE IF EXISTS public.apps_kuaizhizao_sales_forecasts_id_seq;
DROP TABLE IF EXISTS public.apps_kuaizhizao_sales_forecasts;
DROP SEQUENCE IF EXISTS public.apps_kuaizhizao_mrp_results_id_seq;
DROP TABLE IF EXISTS public.apps_kuaizhizao_mrp_results;
DROP SEQUENCE IF EXISTS public.apps_kuaizhizao_lrp_results_id_seq;
DROP TABLE IF EXISTS public.apps_kuaizhizao_lrp_results;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: apps_kuaizhizao_lrp_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apps_kuaizhizao_lrp_results (
    id integer NOT NULL,
    uuid character varying(36) NOT NULL,
    tenant_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    sales_order_id integer NOT NULL,
    material_id integer NOT NULL,
    delivery_date date NOT NULL,
    planning_horizon integer NOT NULL,
    required_quantity numeric(10,2) NOT NULL,
    available_inventory numeric(10,2) NOT NULL,
    net_requirement numeric(10,2) NOT NULL,
    planned_production numeric(10,2) NOT NULL,
    planned_procurement numeric(10,2) NOT NULL,
    production_start_date date,
    production_completion_date date,
    procurement_start_date date,
    procurement_completion_date date,
    bom_id integer,
    bom_version character varying(20),
    computation_status character varying(20) DEFAULT '完成'::character varying NOT NULL,
    computation_time timestamp with time zone NOT NULL,
    material_breakdown jsonb NOT NULL,
    capacity_requirements jsonb NOT NULL,
    procurement_schedule jsonb NOT NULL,
    notes text
);


--
-- Name: TABLE apps_kuaizhizao_lrp_results; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.apps_kuaizhizao_lrp_results IS '快格轻制造 - LRP运算结果';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.uuid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.uuid IS '业务ID（UUID，对外暴露，安全且唯一）';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.tenant_id IS '租户ID';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.created_at IS '创建时间（UTC）';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.updated_at IS '更新时间（UTC）';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.sales_order_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.sales_order_id IS '销售订单ID';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.material_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.material_id IS '物料ID';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.delivery_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.delivery_date IS '交货日期';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.planning_horizon; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.planning_horizon IS '计划时域（天）';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.required_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.required_quantity IS '需求数量';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.available_inventory; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.available_inventory IS '可用库存';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.net_requirement; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.net_requirement IS '净需求';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.planned_production; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.planned_production IS '计划生产';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.planned_procurement; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.planned_procurement IS '计划采购';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.production_start_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.production_start_date IS '生产开始日期';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.production_completion_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.production_completion_date IS '生产完成日期';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.procurement_start_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.procurement_start_date IS '采购开始日期';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.procurement_completion_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.procurement_completion_date IS '采购完成日期';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.bom_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.bom_id IS '使用的BOM ID';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.bom_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.bom_version IS 'BOM版本';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.computation_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.computation_status IS '运算状态';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.computation_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.computation_time IS '运算时间';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.material_breakdown; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.material_breakdown IS '物料分解';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.capacity_requirements; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.capacity_requirements IS '产能需求';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.procurement_schedule; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.procurement_schedule IS '采购时间表';


--
-- Name: COLUMN apps_kuaizhizao_lrp_results.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_lrp_results.notes IS '备注';


--
-- Name: apps_kuaizhizao_lrp_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.apps_kuaizhizao_lrp_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: apps_kuaizhizao_lrp_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.apps_kuaizhizao_lrp_results_id_seq OWNED BY public.apps_kuaizhizao_lrp_results.id;


--
-- Name: apps_kuaizhizao_mrp_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apps_kuaizhizao_mrp_results (
    id integer NOT NULL,
    uuid character varying(36) NOT NULL,
    tenant_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    forecast_id integer NOT NULL,
    material_id integer NOT NULL,
    planning_horizon integer NOT NULL,
    time_bucket character varying(20) DEFAULT '日'::character varying NOT NULL,
    current_inventory numeric(10,2) NOT NULL,
    safety_stock numeric(10,2) NOT NULL,
    reorder_point numeric(10,2) NOT NULL,
    total_gross_requirement numeric(10,2) NOT NULL,
    total_net_requirement numeric(10,2) NOT NULL,
    total_planned_receipt numeric(10,2) NOT NULL,
    total_planned_release numeric(10,2) NOT NULL,
    suggested_work_orders integer DEFAULT 0 NOT NULL,
    suggested_purchase_orders integer DEFAULT 0 NOT NULL,
    computation_status character varying(20) DEFAULT '完成'::character varying NOT NULL,
    computation_time timestamp with time zone NOT NULL,
    demand_schedule jsonb NOT NULL,
    inventory_schedule jsonb NOT NULL,
    planned_order_schedule jsonb NOT NULL,
    notes text
);


--
-- Name: TABLE apps_kuaizhizao_mrp_results; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.apps_kuaizhizao_mrp_results IS '快格轻制造 - MRP运算结果';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.uuid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.uuid IS '业务ID（UUID，对外暴露，安全且唯一）';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.tenant_id IS '租户ID';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.created_at IS '创建时间（UTC）';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.updated_at IS '更新时间（UTC）';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.forecast_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.forecast_id IS '销售预测ID';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.material_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.material_id IS '物料ID';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.planning_horizon; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.planning_horizon IS '计划时域（天）';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.time_bucket; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.time_bucket IS '时间段';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.current_inventory; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.current_inventory IS '当前库存';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.safety_stock; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.safety_stock IS '安全库存';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.reorder_point; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.reorder_point IS '再订货点';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.total_gross_requirement; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.total_gross_requirement IS '总毛需求';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.total_net_requirement; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.total_net_requirement IS '总净需求';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.total_planned_receipt; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.total_planned_receipt IS '总计划入库';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.total_planned_release; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.total_planned_release IS '总计划发放';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.suggested_work_orders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.suggested_work_orders IS '建议工单数';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.suggested_purchase_orders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.suggested_purchase_orders IS '建议采购订单数';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.computation_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.computation_status IS '运算状态';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.computation_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.computation_time IS '运算时间';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.demand_schedule; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.demand_schedule IS '需求时间表';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.inventory_schedule; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.inventory_schedule IS '库存时间表';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.planned_order_schedule; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.planned_order_schedule IS '计划订单时间表';


--
-- Name: COLUMN apps_kuaizhizao_mrp_results.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_mrp_results.notes IS '备注';


--
-- Name: apps_kuaizhizao_mrp_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.apps_kuaizhizao_mrp_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: apps_kuaizhizao_mrp_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.apps_kuaizhizao_mrp_results_id_seq OWNED BY public.apps_kuaizhizao_mrp_results.id;


--
-- Name: apps_kuaizhizao_sales_forecasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apps_kuaizhizao_sales_forecasts (
    id integer NOT NULL,
    uuid character varying(36) NOT NULL,
    tenant_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    forecast_code character varying(50) NOT NULL,
    forecast_name character varying(200) NOT NULL,
    forecast_type character varying(20) DEFAULT 'MTS'::character varying NOT NULL,
    forecast_period character varying(20) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status character varying(20) DEFAULT '草稿'::character varying NOT NULL,
    reviewer_id integer,
    reviewer_name character varying(100),
    review_time timestamp with time zone,
    review_status character varying(20) DEFAULT '待审核'::character varying NOT NULL,
    review_remarks text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_by integer,
    updated_by integer,
    deleted_at timestamp with time zone
);


--
-- Name: TABLE apps_kuaizhizao_sales_forecasts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.apps_kuaizhizao_sales_forecasts IS '快格轻制造 - 销售预测';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.uuid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.uuid IS '业务ID（UUID，对外暴露，安全且唯一）';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.tenant_id IS '租户ID';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.created_at IS '创建时间（UTC）';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.updated_at IS '更新时间（UTC）';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.forecast_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.forecast_code IS '预测编码';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.forecast_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.forecast_name IS '预测名称';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.forecast_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.forecast_type IS '预测类型';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.forecast_period; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.forecast_period IS '预测周期';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.start_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.start_date IS '预测开始日期';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.end_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.end_date IS '预测结束日期';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.status IS '预测状态';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.reviewer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.reviewer_id IS '审核人ID';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.reviewer_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.reviewer_name IS '审核人姓名';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.review_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.review_time IS '审核时间';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.review_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.review_status IS '审核状态';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.review_remarks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.review_remarks IS '审核备注';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.notes IS '备注';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.is_active IS '是否有效';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.created_by IS '创建人ID';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.updated_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.updated_by IS '更新人ID';


--
-- Name: COLUMN apps_kuaizhizao_sales_forecasts.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_forecasts.deleted_at IS '删除时间';


--
-- Name: apps_kuaizhizao_sales_forecasts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.apps_kuaizhizao_sales_forecasts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: apps_kuaizhizao_sales_forecasts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.apps_kuaizhizao_sales_forecasts_id_seq OWNED BY public.apps_kuaizhizao_sales_forecasts.id;


--
-- Name: apps_kuaizhizao_sales_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apps_kuaizhizao_sales_orders (
    id integer NOT NULL,
    uuid character varying(36) NOT NULL,
    tenant_id integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    order_code character varying(50) NOT NULL,
    customer_id integer NOT NULL,
    customer_name character varying(200) NOT NULL,
    customer_contact character varying(100),
    customer_phone character varying(20),
    order_date date NOT NULL,
    delivery_date date NOT NULL,
    order_type character varying(20) DEFAULT 'MTO'::character varying NOT NULL,
    total_quantity numeric(10,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT '草稿'::character varying NOT NULL,
    reviewer_id integer,
    reviewer_name character varying(100),
    review_time timestamp with time zone,
    review_status character varying(20) DEFAULT '待审核'::character varying NOT NULL,
    review_remarks text,
    salesman_id integer,
    salesman_name character varying(100),
    shipping_address text,
    shipping_method character varying(50),
    payment_terms character varying(100),
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_by integer,
    updated_by integer,
    deleted_at timestamp with time zone
);


--
-- Name: TABLE apps_kuaizhizao_sales_orders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.apps_kuaizhizao_sales_orders IS '快格轻制造 - 销售订单';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.uuid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.uuid IS '业务ID（UUID，对外暴露，安全且唯一）';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.tenant_id IS '租户ID';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.created_at IS '创建时间（UTC）';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.updated_at IS '更新时间（UTC）';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.order_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.order_code IS '订单编码';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.customer_id IS '客户ID';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.customer_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.customer_name IS '客户名称';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.customer_contact; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.customer_contact IS '客户联系人';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.customer_phone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.customer_phone IS '客户电话';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.order_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.order_date IS '订单日期';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.delivery_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.delivery_date IS '交货日期';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.order_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.order_type IS '订单类型';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.total_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.total_quantity IS '总数量';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.total_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.total_amount IS '总金额';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.status IS '订单状态';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.reviewer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.reviewer_id IS '审核人ID';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.reviewer_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.reviewer_name IS '审核人姓名';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.review_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.review_time IS '审核时间';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.review_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.review_status IS '审核状态';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.review_remarks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.review_remarks IS '审核备注';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.salesman_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.salesman_id IS '销售员ID';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.salesman_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.salesman_name IS '销售员姓名';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.shipping_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.shipping_address IS '收货地址';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.shipping_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.shipping_method IS '发货方式';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.payment_terms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.payment_terms IS '付款条件';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.notes IS '备注';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.is_active IS '是否有效';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.created_by IS '创建人ID';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.updated_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.updated_by IS '更新人ID';


--
-- Name: COLUMN apps_kuaizhizao_sales_orders.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apps_kuaizhizao_sales_orders.deleted_at IS '删除时间';


--
-- Name: apps_kuaizhizao_sales_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.apps_kuaizhizao_sales_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: apps_kuaizhizao_sales_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.apps_kuaizhizao_sales_orders_id_seq OWNED BY public.apps_kuaizhizao_sales_orders.id;


--
-- Name: apps_kuaizhizao_lrp_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apps_kuaizhizao_lrp_results ALTER COLUMN id SET DEFAULT nextval('public.apps_kuaizhizao_lrp_results_id_seq'::regclass);


--
-- Name: apps_kuaizhizao_mrp_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apps_kuaizhizao_mrp_results ALTER COLUMN id SET DEFAULT nextval('public.apps_kuaizhizao_mrp_results_id_seq'::regclass);


--
-- Name: apps_kuaizhizao_sales_forecasts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apps_kuaizhizao_sales_forecasts ALTER COLUMN id SET DEFAULT nextval('public.apps_kuaizhizao_sales_forecasts_id_seq'::regclass);


--
-- Name: apps_kuaizhizao_sales_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apps_kuaizhizao_sales_orders ALTER COLUMN id SET DEFAULT nextval('public.apps_kuaizhizao_sales_orders_id_seq'::regclass);


--
-- Data for Name: apps_kuaizhizao_lrp_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.apps_kuaizhizao_lrp_results (id, uuid, tenant_id, created_at, updated_at, sales_order_id, material_id, delivery_date, planning_horizon, required_quantity, available_inventory, net_requirement, planned_production, planned_procurement, production_start_date, production_completion_date, procurement_start_date, procurement_completion_date, bom_id, bom_version, computation_status, computation_time, material_breakdown, capacity_requirements, procurement_schedule, notes) FROM stdin;
1	8633da33-4e4e-433b-a4ff-537279490a45	7	2026-01-03 02:46:38.270163+08	2026-01-03 02:46:38.270163+08	48	1	2026-01-20	19	50.00	0.00	50.00	50.00	0.00	2026-01-06	2026-01-20	\N	\N	\N	\N	完成	2026-01-03 18:46:38.270163+08	{}	{}	{}	\N
2	07563a0b-2a75-4a0d-8dc4-8063541a4d7b	7	2026-01-03 02:46:48.248383+08	2026-01-03 02:46:48.248383+08	49	1	2026-01-20	19	50.00	0.00	50.00	50.00	0.00	2026-01-06	2026-01-20	\N	\N	\N	\N	完成	2026-01-03 18:46:48.248383+08	{}	{}	{}	\N
3	435b4dee-c35e-43ff-9e60-3a97275daa79	7	2026-01-03 02:47:04.87206+08	2026-01-03 02:47:04.87206+08	50	1	2026-01-20	19	50.00	0.00	50.00	50.00	0.00	2026-01-06	2026-01-20	\N	\N	\N	\N	完成	2026-01-03 18:47:04.87206+08	{}	{}	{}	\N
4	5655b2bf-78fe-4517-8c6a-3feed9a89438	7	2026-01-03 02:47:14.541058+08	2026-01-03 02:47:14.541058+08	51	1	2026-01-20	19	50.00	0.00	50.00	50.00	0.00	2026-01-06	2026-01-20	\N	\N	\N	\N	完成	2026-01-03 18:47:14.541058+08	{}	{}	{}	\N
5	9cdc761a-a7ae-4c7d-bfba-a4b7314d0acf	7	2026-01-03 02:47:24.246901+08	2026-01-03 02:47:24.246901+08	52	1	2026-01-20	19	50.00	0.00	50.00	50.00	0.00	2026-01-06	2026-01-20	\N	\N	\N	\N	完成	2026-01-03 18:47:24.246901+08	{}	{}	{}	\N
\.


--
-- Data for Name: apps_kuaizhizao_mrp_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.apps_kuaizhizao_mrp_results (id, uuid, tenant_id, created_at, updated_at, forecast_id, material_id, planning_horizon, time_bucket, current_inventory, safety_stock, reorder_point, total_gross_requirement, total_net_requirement, total_planned_receipt, total_planned_release, suggested_work_orders, suggested_purchase_orders, computation_status, computation_time, demand_schedule, inventory_schedule, planned_order_schedule, notes) FROM stdin;
2	8ffe7b5f-e206-4ad0-b5a5-a3b16c345c71	7	2026-01-03 00:44:48.349119+08	2026-01-03 00:44:48.349119+08	10	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	0	1	完成	2026-01-03 16:44:48.349119+08	{}	{}	{}	\N
3	21423264-381c-4070-9758-3f4f09aed7df	7	2026-01-03 00:45:03.080957+08	2026-01-03 00:45:03.080957+08	11	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	0	1	完成	2026-01-03 16:45:03.080957+08	{}	{}	{}	\N
4	ead26c17-cc37-41cf-a2c0-0dc93e3da8da	7	2026-01-03 00:45:23.615248+08	2026-01-03 00:45:23.615248+08	12	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	0	1	完成	2026-01-03 16:45:23.615248+08	{}	{}	{}	\N
5	291f08d6-1a59-4c93-aa00-f57c645db6a6	7	2026-01-03 00:45:34.112882+08	2026-01-03 00:45:34.112882+08	13	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	0	1	完成	2026-01-03 16:45:34.112882+08	{}	{}	{}	\N
6	844a6d24-7397-40f2-af39-cafbad37ce77	7	2026-01-03 00:45:48.47014+08	2026-01-03 00:45:48.47014+08	14	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	0	1	完成	2026-01-03 16:45:48.47014+08	{}	{}	{}	\N
7	e7194e4b-2946-46b0-afaf-0d16ad148796	7	2026-01-03 00:46:31.387706+08	2026-01-03 00:46:31.387706+08	15	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	0	1	完成	2026-01-03 16:46:31.386705+08	{}	{}	{}	\N
8	8d806dba-6626-4469-974d-b5cc4552a0e2	7	2026-01-03 00:46:43.259749+08	2026-01-03 00:46:43.259749+08	16	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	0	1	完成	2026-01-03 16:46:43.259749+08	{}	{}	{}	\N
9	4e6a587c-6f70-4c41-803d-c28170871695	7	2026-01-03 00:47:14.771022+08	2026-01-03 00:47:14.771022+08	17	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	0	1	完成	2026-01-03 16:47:14.771022+08	{}	{}	{}	\N
10	b32cebac-d689-4e29-9a19-7cc577dac47b	7	2026-01-03 00:48:03.763459+08	2026-01-03 00:48:03.763459+08	18	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	0	1	完成	2026-01-03 16:48:03.763459+08	{}	{}	{}	\N
11	dcb8ccd6-4602-4332-947b-69dc134eb301	7	2026-01-03 00:48:38.957145+08	2026-01-03 00:48:38.957145+08	19	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	0	1	完成	2026-01-03 16:48:38.957145+08	{}	{}	{}	\N
12	31c002d7-aaab-4049-b9dc-8f900d3a5823	7	2026-01-03 00:48:56.794895+08	2026-01-03 00:48:56.794895+08	20	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	0	1	完成	2026-01-03 16:48:56.794895+08	{}	{}	{}	\N
13	f43d226a-3976-4bba-b058-d1621ee6bb89	7	2026-01-03 00:50:22.197789+08	2026-01-03 00:50:22.197789+08	21	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 16:50:22.197789+08	{}	{}	{}	\N
14	fb586868-1d9c-477c-8399-f1f0c3fb0fbe	7	2026-01-03 00:51:18.361609+08	2026-01-03 00:51:18.361609+08	22	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 16:51:18.361609+08	{}	{}	{}	\N
15	19411208-8dd6-4c56-a822-56d419b06772	7	2026-01-03 00:51:45.328382+08	2026-01-03 00:51:45.328382+08	23	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 16:51:45.328382+08	{}	{}	{}	\N
16	6e9ef429-95f4-43f8-8106-902da3d69bff	7	2026-01-03 00:52:15.030588+08	2026-01-03 00:52:15.030588+08	24	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 16:52:15.030588+08	{}	{}	{}	\N
17	7109c351-09d1-4524-97b4-e7578ad1e075	7	2026-01-03 00:52:38.665787+08	2026-01-03 00:52:38.665787+08	25	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 16:52:38.665787+08	{}	{}	{}	\N
18	5d6e1068-4074-47be-a6d4-0a3d6f872f04	7	2026-01-03 00:52:49.347939+08	2026-01-03 00:52:49.347939+08	26	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 16:52:49.347939+08	{}	{}	{}	\N
19	a28bb0f3-1069-4f39-998c-2a6e3d678777	7	2026-01-03 00:53:06.528455+08	2026-01-03 00:53:06.528455+08	27	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 16:53:06.528455+08	{}	{}	{}	\N
20	ff530ff7-9cb5-43e3-a1a7-f9cb2ba74587	7	2026-01-03 00:53:17.918911+08	2026-01-03 00:53:17.918911+08	28	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 16:53:17.918911+08	{}	{}	{}	\N
21	6bc5366f-ab9f-4ff6-b9d6-5157707bcd34	7	2026-01-03 00:54:30.385987+08	2026-01-03 00:54:30.385987+08	29	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 16:54:30.385987+08	{}	{}	{}	\N
22	6e2c46b9-4143-477d-b3e9-70dd4db62bb3	7	2026-01-03 01:03:24.29868+08	2026-01-03 01:03:24.29868+08	30	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:03:24.29868+08	{}	{}	{}	\N
23	2cc0c9bd-27ff-4a40-a553-33332b2d77e1	7	2026-01-03 01:06:45.960151+08	2026-01-03 01:06:45.960151+08	31	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:06:45.960151+08	{}	{}	{}	\N
24	82e2c985-c882-4d64-81be-732e30179549	7	2026-01-03 01:08:31.475952+08	2026-01-03 01:08:31.475952+08	32	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:08:31.475952+08	{}	{}	{}	\N
25	bc5e9e1b-a576-40a0-bb64-4f2b4a177d73	7	2026-01-03 01:08:42.071715+08	2026-01-03 01:08:42.071715+08	33	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:08:42.071715+08	{}	{}	{}	\N
26	de998386-c698-43d7-b344-6cc704e20277	7	2026-01-03 01:08:49.701405+08	2026-01-03 01:08:49.701405+08	34	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:08:49.701405+08	{}	{}	{}	\N
27	1cd9c38e-d56d-4be1-b913-68c05d7aec9f	7	2026-01-03 01:09:59.003911+08	2026-01-03 01:09:59.003911+08	35	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:09:59.003911+08	{}	{}	{}	\N
28	88e23274-5743-462c-b0ef-09d93f85809a	7	2026-01-03 01:10:24.727337+08	2026-01-03 01:10:24.727337+08	36	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:10:24.727337+08	{}	{}	{}	\N
29	55bb34eb-e970-43c3-b308-22d7f37d2df2	7	2026-01-03 01:10:57.942017+08	2026-01-03 01:10:57.942017+08	37	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:10:57.942017+08	{}	{}	{}	\N
30	94c6945d-4f74-4e9c-9c93-4d54134c400f	7	2026-01-03 01:11:27.178192+08	2026-01-03 01:11:27.178192+08	38	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:11:27.178192+08	{}	{}	{}	\N
31	7433e2fe-b2c9-41ad-89bb-0d2047318f80	7	2026-01-03 01:11:48.63939+08	2026-01-03 01:11:48.63939+08	39	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:11:48.63939+08	{}	{}	{}	\N
32	7148dbac-2ca8-4804-b52f-a67c6b80f54e	7	2026-01-03 01:12:09.338179+08	2026-01-03 01:12:09.338179+08	40	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:12:09.338179+08	{}	{}	{}	\N
33	936320e0-f90d-406e-a1c5-e96406664f10	7	2026-01-03 01:12:40.036012+08	2026-01-03 01:12:40.036012+08	41	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:12:40.036012+08	{}	{}	{}	\N
34	425116f1-0a93-4ed4-a277-6efd5791bcda	7	2026-01-03 01:13:01.489046+08	2026-01-03 01:13:01.489046+08	42	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:13:01.489046+08	{}	{}	{}	\N
35	5af11db7-556e-4992-bee8-8c944a60251f	7	2026-01-03 01:13:22.014101+08	2026-01-03 01:13:22.014101+08	43	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:13:22.014101+08	{}	{}	{}	\N
36	8f686857-4d6a-4445-84a0-8c0a990dd8d2	7	2026-01-03 01:14:07.295435+08	2026-01-03 01:14:07.295435+08	44	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:14:07.295435+08	{}	{}	{}	\N
37	4ea94df9-2ed2-4832-b72c-fce051d3daaa	7	2026-01-03 01:14:42.472707+08	2026-01-03 01:14:42.472707+08	45	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:14:42.472707+08	{}	{}	{}	\N
38	1e264d41-da61-4fd9-8590-511f31981765	7	2026-01-03 01:15:49.24829+08	2026-01-03 01:15:49.24829+08	46	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:15:49.24829+08	{}	{}	{}	\N
39	416e865a-36b6-4389-955b-25ed304b4570	7	2026-01-03 01:16:36.52773+08	2026-01-03 01:16:36.52773+08	47	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:16:36.52773+08	{}	{}	{}	\N
40	9520eb64-6c98-4e6b-9af3-a322d81aba1f	7	2026-01-03 01:17:26.121309+08	2026-01-03 01:17:26.121309+08	48	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:17:26.121309+08	{}	{}	{}	\N
41	d6975d18-8c5f-4a79-91a6-db1b0b674bb3	7	2026-01-03 01:17:35.396633+08	2026-01-03 01:17:35.396633+08	49	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:17:35.396633+08	{}	{}	{}	\N
42	791d4dc4-e01f-4afa-8f48-10f0a500815e	7	2026-01-03 01:17:46.666497+08	2026-01-03 01:17:46.666497+08	50	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:17:46.666497+08	{}	{}	{}	\N
43	58d8ea4f-7743-4ebe-bdfd-cc0a7eba1526	7	2026-01-03 01:18:07.561128+08	2026-01-03 01:18:07.561128+08	51	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:18:07.561128+08	{}	{}	{}	\N
44	1bfab5af-2ee5-440a-9b5c-c2c6e053ad42	7	2026-01-03 01:18:28.306033+08	2026-01-03 01:18:28.306033+08	52	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:18:28.306033+08	{}	{}	{}	\N
45	b00259d1-4c42-4c8e-9270-de454b96b90d	7	2026-01-03 01:18:56.630135+08	2026-01-03 01:18:56.630135+08	53	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:18:56.630135+08	{}	{}	{}	\N
46	647eddc4-352b-4516-8b71-107f68e12475	7	2026-01-03 01:19:26.755126+08	2026-01-03 01:19:26.755126+08	54	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:19:26.755126+08	{}	{}	{}	\N
47	50bcffbe-852a-4df1-b7b1-70d83e4871c6	7	2026-01-03 01:19:38.525319+08	2026-01-03 01:19:38.525319+08	55	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:19:38.525319+08	{}	{}	{}	\N
48	4d6b869b-a857-4c6e-95e6-ec51c95023f6	7	2026-01-03 01:20:05.134293+08	2026-01-03 01:20:05.134293+08	56	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:20:05.134293+08	{}	{}	{}	\N
49	02d65c8b-0e22-45fb-b662-089994b13d81	7	2026-01-03 01:20:31.382354+08	2026-01-03 01:20:31.382354+08	57	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:20:31.382354+08	{}	{}	{}	\N
50	eb502e90-d869-43fe-b008-a47311ccd2cd	7	2026-01-03 01:20:56.182154+08	2026-01-03 01:20:56.182154+08	58	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:20:56.182154+08	{}	{}	{}	\N
51	919edc6f-f7dc-4117-bcea-198b91727bc0	7	2026-01-03 01:21:06.78538+08	2026-01-03 01:21:06.78538+08	59	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:21:06.78538+08	{}	{}	{}	\N
52	9cf7be1f-b296-4a76-b7e9-f02f730c398c	7	2026-01-03 01:22:05.022686+08	2026-01-03 01:22:05.022686+08	60	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:22:05.022686+08	{}	{}	{}	\N
53	cd654a26-8425-46b7-bc3d-130488988a2e	7	2026-01-03 01:22:15.33382+08	2026-01-03 01:22:15.33382+08	61	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:22:15.33382+08	{}	{}	{}	\N
54	c368e269-f9d6-400c-ba13-c6cf6edd8527	7	2026-01-03 01:23:02.396176+08	2026-01-03 01:23:02.396176+08	62	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:23:02.396176+08	{}	{}	{}	\N
55	aad33290-4f11-431b-877c-849e2052e08b	7	2026-01-03 01:23:39.166516+08	2026-01-03 01:23:39.166516+08	63	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:23:39.166516+08	{}	{}	{}	\N
56	456b5386-86aa-4b89-806e-611bfd2bf726	7	2026-01-03 01:23:50.214564+08	2026-01-03 01:23:50.214564+08	64	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:23:50.214564+08	{}	{}	{}	\N
57	473da361-0667-4478-851b-94e9076200aa	7	2026-01-03 01:24:03.588341+08	2026-01-03 01:24:03.588341+08	65	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:24:03.588341+08	{}	{}	{}	\N
58	f18a4d9f-b5e2-41c4-a5d3-9947db2949b2	7	2026-01-03 01:24:41.180466+08	2026-01-03 01:24:41.180466+08	66	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:24:41.17996+08	{}	{}	{}	\N
59	a8367a80-5145-449b-9810-ebc191552249	7	2026-01-03 01:25:07.679994+08	2026-01-03 01:25:07.679994+08	67	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:25:07.679609+08	{}	{}	{}	\N
60	2229235b-3dab-42c2-bd4f-74ea9f24e2c5	7	2026-01-03 01:25:35.22544+08	2026-01-03 01:25:35.22544+08	68	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:25:35.22544+08	{}	{}	{}	\N
61	4a844525-2264-4124-a361-822baaaf68be	7	2026-01-03 01:25:59.154748+08	2026-01-03 01:25:59.154748+08	69	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:25:59.154748+08	{}	{}	{}	\N
62	a2e89566-97d4-4ed3-a24f-db582d086983	7	2026-01-03 01:27:11.547669+08	2026-01-03 01:27:11.547669+08	70	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:27:11.547669+08	{}	{}	{}	\N
63	fddf3c93-e3e4-467d-bca7-b89f9835c36c	7	2026-01-03 01:32:57.052786+08	2026-01-03 01:32:57.052786+08	71	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:32:57.052786+08	{}	{}	{}	\N
64	eed6570d-1906-4f18-b32b-96017f245caa	7	2026-01-03 01:35:26.005589+08	2026-01-03 01:35:26.005589+08	72	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:35:26.005589+08	{}	{}	{}	\N
65	f6a1969b-0cac-4ce5-86f7-a32da25a7937	7	2026-01-03 01:36:23.943419+08	2026-01-03 01:36:23.943419+08	73	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:36:23.943419+08	{}	{}	{}	\N
66	700fd80f-f35d-4f4f-b0b6-6f1bafed0540	7	2026-01-03 01:59:11.48119+08	2026-01-03 01:59:11.48119+08	74	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 17:59:11.480183+08	{}	{}	{}	\N
67	dfd5bf35-c5a4-4bb8-9254-7b6878ca2339	7	2026-01-03 02:00:05.383993+08	2026-01-03 02:00:05.383993+08	75	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 18:00:05.383993+08	{}	{}	{}	\N
68	a263a3cc-0e4c-4792-b590-67fa732dad91	7	2026-01-03 02:01:13.059263+08	2026-01-03 02:01:13.059263+08	76	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 18:01:13.059263+08	{}	{}	{}	\N
69	0783ac58-3c8c-4d8c-b63b-3029a4394862	7	2026-01-03 02:04:34.404856+08	2026-01-03 02:04:34.404856+08	77	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 18:04:34.404856+08	{}	{}	{}	\N
70	3b1e0741-48f7-44eb-8a11-f442a4ee57e1	7	2026-01-03 02:05:49.047635+08	2026-01-03 02:05:49.047635+08	78	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 18:05:49.047635+08	{}	{}	{}	\N
71	0ca478ac-3529-4d1b-94bd-8c71501bf2d5	7	2026-01-03 02:07:09.032895+08	2026-01-03 02:07:09.032895+08	79	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 18:07:09.032895+08	{}	{}	{}	\N
72	6c99eb47-7a6b-4f7e-bc00-f43de8d6b058	7	2026-01-03 02:19:53.000406+08	2026-01-03 02:19:53.000406+08	80	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 18:19:53.000406+08	{}	{}	{}	\N
73	b03ba00c-9a16-4977-9ad1-34ebb72434d0	7	2026-01-03 02:21:24.984525+08	2026-01-03 02:21:24.984525+08	81	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 18:21:24.984525+08	{}	{}	{}	\N
74	82b34c24-8406-42d9-b3e1-7e75a9a34957	7	2026-01-03 02:23:00.089535+08	2026-01-03 02:23:00.089535+08	82	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 18:23:00.089535+08	{}	{}	{}	\N
75	1d168733-ddf1-4401-ba01-1191f8e3e3a9	7	2026-01-03 02:24:48.85087+08	2026-01-03 02:24:48.85087+08	83	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 18:24:48.85087+08	{}	{}	{}	\N
76	d482e468-b461-4400-85eb-170debcd6eaf	7	2026-01-03 02:27:10.377348+08	2026-01-03 02:27:10.377348+08	84	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 18:27:10.377348+08	{}	{}	{}	\N
77	f8a82b16-7192-4d59-819b-d03a9e84bf1b	7	2026-01-03 02:40:32.596117+08	2026-01-03 02:40:32.596117+08	85	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 18:40:32.596117+08	{}	{}	{}	\N
78	5448e885-04d7-499a-b0d2-8d79a698cbf0	7	2026-01-03 02:41:37.895259+08	2026-01-03 02:41:37.895259+08	86	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 18:41:37.895259+08	{}	{}	{}	\N
79	d7cb04d3-00bf-471e-8507-e100205dd3be	7	2026-01-03 02:43:06.731192+08	2026-01-03 02:43:06.731192+08	87	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 18:43:06.730166+08	{}	{}	{}	\N
80	851f8f38-5faf-4d2b-bd20-17c3a70d2e0c	7	2026-01-03 02:44:22.159255+08	2026-01-03 02:44:22.159255+08	88	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 18:44:22.159255+08	{}	{}	{}	\N
81	b2a68a5c-a7f8-4643-8544-661bc11a0526	7	2026-01-03 02:45:23.310256+08	2026-01-03 02:45:23.310256+08	89	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 18:45:23.310256+08	{}	{}	{}	\N
82	730efeb2-b8fe-4cb6-b9af-a5d46501e389	7	2026-01-03 02:46:48.976142+08	2026-01-03 02:46:48.976142+08	90	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 18:46:48.976142+08	{}	{}	{}	\N
83	fb88dfb0-7f77-4ed1-a954-7d1c27685bab	7	2026-01-03 02:47:25.049834+08	2026-01-03 02:47:25.049834+08	91	1	30	日	0.00	0.00	0.00	100.00	100.00	0.00	0.00	1	0	完成	2026-01-03 18:47:25.049834+08	{}	{}	{}	\N
\.


--
-- Data for Name: apps_kuaizhizao_sales_forecasts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.apps_kuaizhizao_sales_forecasts (id, uuid, tenant_id, created_at, updated_at, forecast_code, forecast_name, forecast_type, forecast_period, start_date, end_date, status, reviewer_id, reviewer_name, review_time, review_status, review_remarks, notes, is_active, created_by, updated_by, deleted_at) FROM stdin;
1	087cfaba-fcff-4026-b4b1-b08349652f54	7	2026-01-03 00:35:25.817865+08	2026-01-03 00:35:25.817865+08	SF202601030001	测试销售预测	MTS	月度	2026-01-01	2026-01-31	待审核	\N	\N	\N	待审核	\N	\N	t	179	179	\N
2	4115d3c2-b7e9-4941-a000-392e38b7f53d	7	2026-01-03 00:35:49.06883+08	2026-01-03 00:35:49.06883+08	SF202601030002	测试销售预测	MTS	月度	2026-01-01	2026-01-31	待审核	\N	\N	\N	待审核	\N	\N	t	180	180	\N
29	0fd937c2-f5d1-42b8-847e-ebd5487f2e46	7	2026-01-03 00:54:30.354953+08	2026-01-03 00:54:30.354953+08	SF202601030029	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 08:54:30.373161+08	通过	\N	\N	t	210	210	\N
3	18017948-de51-477d-b431-67d2aa87a13d	7	2026-01-03 00:37:42.006442+08	2026-01-03 00:37:42.006442+08	SF202601030003	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	181	测试用户	2026-01-03 08:37:42.033613+08	通过	\N	\N	t	181	181	\N
30	b2276ba6-f7da-4dc8-8960-88fed0153b32	7	2026-01-03 01:03:24.261421+08	2026-01-03 01:03:24.261421+08	SF202601030030	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:03:24.287419+08	通过	\N	\N	t	210	210	\N
4	80f502c9-6858-49a4-bdf4-d64045d36bb7	7	2026-01-03 00:38:01.388092+08	2026-01-03 00:38:01.388092+08	SF202601030004	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	182	测试用户	2026-01-03 08:38:01.408835+08	通过	\N	\N	t	182	182	\N
5	7411dac5-3eab-419b-8569-af9baf4372dc	7	2026-01-03 00:39:54.90944+08	2026-01-03 00:39:54.90944+08	SF202601030005	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	183	测试用户	2026-01-03 08:39:54.925801+08	通过	\N	\N	t	183	183	\N
31	ae1b9afd-f527-4a64-b2a3-1dd77d2469d6	7	2026-01-03 01:06:45.921157+08	2026-01-03 01:06:45.921157+08	SF202601030031	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:06:45.948688+08	通过	\N	\N	t	210	210	\N
6	9b90a601-e13c-4e1f-ac4e-f15aa777ecfa	7	2026-01-03 00:41:05.250381+08	2026-01-03 00:41:05.250381+08	SF202601030006	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	184	测试用户	2026-01-03 08:41:05.26828+08	通过	\N	\N	t	184	184	\N
32	e9da61bc-7668-48a6-b2b4-38a9e711d0e1	7	2026-01-03 01:08:31.446627+08	2026-01-03 01:08:31.446627+08	SF202601030032	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:08:31.46493+08	通过	\N	\N	t	210	210	\N
7	45fcd4ee-f25a-4c56-985c-65f2c467c7b8	7	2026-01-03 00:41:26.453796+08	2026-01-03 00:41:26.453796+08	SF202601030007	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	185	测试用户	2026-01-03 08:41:26.471149+08	通过	\N	\N	t	185	185	\N
8	8dc937e6-f899-44f9-a7d7-8c92e44eb96f	7	2026-01-03 00:43:48.236175+08	2026-01-03 00:43:48.236175+08	SF202601030008	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	189	测试用户	2026-01-03 08:43:48.255566+08	通过	\N	\N	t	189	189	\N
9	d6c8c918-ee48-4e2f-9d3d-4011f1783f73	7	2026-01-03 00:44:24.80799+08	2026-01-03 00:44:24.80799+08	SF202601030009	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	190	测试用户	2026-01-03 08:44:24.827532+08	通过	\N	\N	t	190	190	\N
10	d4f6457f-3560-40dd-b436-0f056682accd	7	2026-01-03 00:44:48.311536+08	2026-01-03 00:44:48.311536+08	SF202601030010	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	191	测试用户	2026-01-03 08:44:48.333354+08	通过	\N	\N	t	191	191	\N
11	fc4d5888-6a75-4bf8-881f-f81217e9ff79	7	2026-01-03 00:45:03.048689+08	2026-01-03 00:45:03.048689+08	SF202601030011	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	192	测试用户	2026-01-03 08:45:03.067773+08	通过	\N	\N	t	192	192	\N
12	7ed9b19f-9073-40dc-a9be-46e08f8b0822	7	2026-01-03 00:45:23.58216+08	2026-01-03 00:45:23.58216+08	SF202601030012	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	193	测试用户	2026-01-03 08:45:23.601588+08	通过	\N	\N	t	193	193	\N
13	18f99cc5-d32a-4b96-a72f-fca166b249b4	7	2026-01-03 00:45:34.081613+08	2026-01-03 00:45:34.081613+08	SF202601030013	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	194	测试用户	2026-01-03 08:45:34.085118+08	通过	\N	\N	t	194	194	\N
14	7077d38d-9e43-476c-83ce-c30c0e3e5aaf	7	2026-01-03 00:45:48.438928+08	2026-01-03 00:45:48.438928+08	SF202601030014	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	195	测试用户	2026-01-03 08:45:48.45445+08	通过	\N	\N	t	195	195	\N
15	df821064-d910-4302-b4d6-8f6e1292b571	7	2026-01-03 00:46:31.354775+08	2026-01-03 00:46:31.354775+08	SF202601030015	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	196	测试用户	2026-01-03 08:46:31.369328+08	通过	\N	\N	t	196	196	\N
16	812f6e67-e025-4e47-9974-302006989000	7	2026-01-03 00:46:43.228189+08	2026-01-03 00:46:43.228189+08	SF202601030016	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	197	测试用户	2026-01-03 08:46:43.246621+08	通过	\N	\N	t	197	197	\N
17	6fbfc8a1-d9fd-4cb8-af5d-f458e9be3847	7	2026-01-03 00:47:14.740523+08	2026-01-03 00:47:14.740523+08	SF202601030017	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	198	测试用户	2026-01-03 08:47:14.759985+08	通过	\N	\N	t	198	198	\N
18	5c1e1700-2e87-4b0e-8dde-8a403ba4ee2b	7	2026-01-03 00:48:03.719329+08	2026-01-03 00:48:03.719329+08	SF202601030018	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	199	测试用户	2026-01-03 08:48:03.747396+08	通过	\N	\N	t	199	199	\N
19	bdaaaa93-7b64-4339-bfdb-23ea60ddf7c9	7	2026-01-03 00:48:38.926243+08	2026-01-03 00:48:38.926243+08	SF202601030019	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	200	测试用户	2026-01-03 08:48:38.945139+08	通过	\N	\N	t	200	200	\N
20	65d77b44-a239-430b-a776-5188a9e91817	7	2026-01-03 00:48:56.763338+08	2026-01-03 00:48:56.763338+08	SF202601030020	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	201	测试用户	2026-01-03 08:48:56.781971+08	通过	\N	\N	t	201	201	\N
21	07f99cc7-9b58-4681-91c5-4c3d6db7ba3f	7	2026-01-03 00:50:22.166253+08	2026-01-03 00:50:22.166253+08	SF202601030021	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	202	测试用户	2026-01-03 08:50:22.184348+08	通过	\N	\N	t	202	202	\N
22	f517f41b-bc8c-41b6-b696-d11656ca7a35	7	2026-01-03 00:51:18.334988+08	2026-01-03 00:51:18.334988+08	SF202601030022	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	203	测试用户	2026-01-03 08:51:18.344822+08	通过	\N	\N	t	203	203	\N
23	a56dc9dc-33b2-40bf-a4de-aefefcc0cf51	7	2026-01-03 00:51:45.294611+08	2026-01-03 00:51:45.294611+08	SF202601030023	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	204	测试用户	2026-01-03 08:51:45.315891+08	通过	\N	\N	t	204	204	\N
24	567bf759-0247-4a65-b136-759398695912	7	2026-01-03 00:52:14.991932+08	2026-01-03 00:52:14.991932+08	SF202601030024	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	205	测试用户	2026-01-03 08:52:15.014434+08	通过	\N	\N	t	205	205	\N
25	7b028986-8493-4d53-aa4e-513a5c3675ff	7	2026-01-03 00:52:38.631334+08	2026-01-03 00:52:38.631334+08	SF202601030025	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	206	测试用户	2026-01-03 08:52:38.649811+08	通过	\N	\N	t	206	206	\N
26	1b653ce8-6055-423b-9141-5a2a2e9a29b6	7	2026-01-03 00:52:49.318339+08	2026-01-03 00:52:49.319348+08	SF202601030026	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	207	测试用户	2026-01-03 08:52:49.337933+08	通过	\N	\N	t	207	207	\N
27	4674ad34-ae7f-4dcd-86a3-411282b98dfe	7	2026-01-03 00:53:06.504989+08	2026-01-03 00:53:06.504989+08	SF202601030027	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	208	测试用户	2026-01-03 08:53:06.523885+08	通过	\N	\N	t	208	208	\N
28	b835ce3a-e6c9-467b-aea0-bcb2f06c6f9e	7	2026-01-03 00:53:17.8893+08	2026-01-03 00:53:17.8893+08	SF202601030028	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	209	测试用户	2026-01-03 08:53:17.907905+08	通过	\N	\N	t	209	209	\N
33	1e605da2-619d-44a9-a98a-39cfb4edf9cb	7	2026-01-03 01:08:42.041355+08	2026-01-03 01:08:42.041355+08	SF202601030033	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:08:42.060441+08	通过	\N	\N	t	210	210	\N
34	51171a78-cd62-4e00-9d85-83ec733c6972	7	2026-01-03 01:08:49.662092+08	2026-01-03 01:08:49.662092+08	SF202601030034	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:08:49.688675+08	通过	\N	\N	t	210	210	\N
35	938c5f3a-b0c6-4ac9-8305-729d4731425b	7	2026-01-03 01:09:58.960483+08	2026-01-03 01:09:58.960483+08	SF202601030035	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:09:58.991241+08	通过	\N	\N	t	210	210	\N
36	333a9ef6-9d32-4854-a059-32db0495b2ba	7	2026-01-03 01:10:24.687972+08	2026-01-03 01:10:24.687972+08	SF202601030036	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:10:24.714408+08	通过	\N	\N	t	210	210	\N
37	5f039b87-b05b-4a18-a3da-56e83e399b7d	7	2026-01-03 01:10:57.896975+08	2026-01-03 01:10:57.896975+08	SF202601030037	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:10:57.929175+08	通过	\N	\N	t	210	210	\N
38	0b7dd5c3-c418-45de-bc71-43a65a54ab18	7	2026-01-03 01:11:27.148921+08	2026-01-03 01:11:27.148921+08	SF202601030038	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:11:27.167606+08	通过	\N	\N	t	210	210	\N
39	4eddbee8-fab8-40b0-96eb-175be168c740	7	2026-01-03 01:11:48.596062+08	2026-01-03 01:11:48.596062+08	SF202601030039	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:11:48.623921+08	通过	\N	\N	t	210	210	\N
40	8d5c3a3a-d5a1-4a98-bc9e-23e218b658d1	7	2026-01-03 01:12:09.299245+08	2026-01-03 01:12:09.299245+08	SF202601030040	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:12:09.32319+08	通过	\N	\N	t	210	210	\N
41	157747e5-dfdf-4b17-b463-b161ba21a67f	7	2026-01-03 01:12:39.991399+08	2026-01-03 01:12:39.991399+08	SF202601030041	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:12:40.021603+08	通过	\N	\N	t	210	210	\N
42	8380b7ba-64b1-4a27-8f53-84a39c4ff770	7	2026-01-03 01:13:01.459201+08	2026-01-03 01:13:01.459201+08	SF202601030042	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:13:01.477146+08	通过	\N	\N	t	210	210	\N
43	8cf552d0-b6e0-44e3-b74d-7583687f0efc	7	2026-01-03 01:13:21.983293+08	2026-01-03 01:13:21.983293+08	SF202601030043	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:13:22.001373+08	通过	\N	\N	t	210	210	\N
44	af2ca05f-13c4-4440-99ea-57277875c305	7	2026-01-03 01:14:07.235649+08	2026-01-03 01:14:07.235649+08	SF202601030044	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:14:07.272118+08	通过	\N	\N	t	210	210	\N
45	86bac428-be02-4ad7-9fe4-5abde10b2b97	7	2026-01-03 01:14:42.427393+08	2026-01-03 01:14:42.427393+08	SF202601030045	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:14:42.459456+08	通过	\N	\N	t	210	210	\N
46	51535658-1426-439e-af81-4f43bae61c73	7	2026-01-03 01:15:49.204648+08	2026-01-03 01:15:49.204648+08	SF202601030046	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:15:49.234423+08	通过	\N	\N	t	210	210	\N
47	fb4b4185-323e-4c2c-94e1-7fe7edc4d5de	7	2026-01-03 01:16:36.487663+08	2026-01-03 01:16:36.487663+08	SF202601030047	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:16:36.516407+08	通过	\N	\N	t	210	210	\N
48	1f9ee7f2-8b5f-49e7-969e-364a146c3a4a	7	2026-01-03 01:17:26.07916+08	2026-01-03 01:17:26.07916+08	SF202601030048	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:17:26.109438+08	通过	\N	\N	t	210	210	\N
49	81ec4f59-d2f4-49ad-8a8e-54d89086b7c1	7	2026-01-03 01:17:35.362904+08	2026-01-03 01:17:35.362904+08	SF202601030049	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:17:35.385363+08	通过	\N	\N	t	210	210	\N
50	03304cf3-646b-4e01-a933-5ffd9a9982f8	7	2026-01-03 01:17:46.616775+08	2026-01-03 01:17:46.616775+08	SF202601030050	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:17:46.653764+08	通过	\N	\N	t	210	210	\N
51	d52b5935-c745-43f4-8e71-30fb5e7a7902	7	2026-01-03 01:18:07.521978+08	2026-01-03 01:18:07.521978+08	SF202601030051	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:18:07.550248+08	通过	\N	\N	t	210	210	\N
52	630a9709-c0e4-440d-a43a-50a84aff34d2	7	2026-01-03 01:18:28.26766+08	2026-01-03 01:18:28.26766+08	SF202601030052	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:18:28.294868+08	通过	\N	\N	t	210	210	\N
53	3d0f8553-4fbe-4211-9882-02a27a785808	7	2026-01-03 01:18:56.603624+08	2026-01-03 01:18:56.603624+08	SF202601030053	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:18:56.626556+08	通过	\N	\N	t	210	210	\N
54	51a7f5d7-3a54-4d38-a958-eb4a15711ee5	7	2026-01-03 01:19:26.724205+08	2026-01-03 01:19:26.724205+08	SF202601030054	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:19:26.742831+08	通过	\N	\N	t	210	210	\N
55	6b4f7bae-3721-49b9-b3e2-9dbd2b7dafc3	7	2026-01-03 01:19:38.49407+08	2026-01-03 01:19:38.49407+08	SF202601030055	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:19:38.513016+08	通过	\N	\N	t	210	210	\N
56	d0f32c82-520f-4ac1-aedb-08d0fc3b8746	7	2026-01-03 01:20:05.101943+08	2026-01-03 01:20:05.101943+08	SF202601030056	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:20:05.122294+08	通过	\N	\N	t	210	210	\N
57	fd4251b3-b78c-4839-9ea1-670698d9ba2c	7	2026-01-03 01:20:31.341919+08	2026-01-03 01:20:31.338734+08	SF202601030057	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:20:31.368716+08	通过	\N	\N	t	210	210	\N
58	0e326fa5-2f87-44cd-924d-5a1aac6f9e4d	7	2026-01-03 01:20:56.140727+08	2026-01-03 01:20:56.140727+08	SF202601030058	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:20:56.169814+08	通过	\N	\N	t	210	210	\N
59	97febcdb-fffe-4c9a-9321-4c8b73b4dc5f	7	2026-01-03 01:21:06.742669+08	2026-01-03 01:21:06.742669+08	SF202601030059	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:21:06.771305+08	通过	\N	\N	t	210	210	\N
60	febc8119-19c7-468f-ada2-0000bc0b9858	7	2026-01-03 01:22:04.980324+08	2026-01-03 01:22:04.980324+08	SF202601030060	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:22:05.009635+08	通过	\N	\N	t	210	210	\N
61	4774f620-bdd7-4bc5-9a66-6e93b46d0177	7	2026-01-03 01:22:15.294776+08	2026-01-03 01:22:15.294776+08	SF202601030061	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:22:15.321714+08	通过	\N	\N	t	210	210	\N
62	f6d9b1c2-863a-4f15-9de1-4e95beb08815	7	2026-01-03 01:23:02.366317+08	2026-01-03 01:23:02.366317+08	SF202601030062	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:23:02.385532+08	通过	\N	\N	t	210	210	\N
63	a24bb3fa-6154-4222-8108-a9e4217418b2	7	2026-01-03 01:23:39.130777+08	2026-01-03 01:23:39.130777+08	SF202601030063	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:23:39.150769+08	通过	\N	\N	t	210	210	\N
64	672d9d24-018d-4a56-b4cb-78563ca826b0	7	2026-01-03 01:23:50.182028+08	2026-01-03 01:23:50.182028+08	SF202601030064	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:23:50.202564+08	通过	\N	\N	t	210	210	\N
65	50f085ae-e512-4621-8bcb-6ccf3c6ae4fb	7	2026-01-03 01:24:03.548466+08	2026-01-03 01:24:03.547466+08	SF202601030065	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:24:03.576022+08	通过	\N	\N	t	210	210	\N
66	279c659e-92c7-4d20-aed2-98a90b16fa68	7	2026-01-03 01:24:41.140609+08	2026-01-03 01:24:41.140609+08	SF202601030066	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:24:41.168658+08	通过	\N	\N	t	210	210	\N
67	1af6a187-37c4-476e-a570-2d87d0841d40	7	2026-01-03 01:25:07.639387+08	2026-01-03 01:25:07.639387+08	SF202601030067	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:25:07.667344+08	通过	\N	\N	t	210	210	\N
68	972e715f-c01d-450f-9cde-9eada209a6b7	7	2026-01-03 01:25:35.193922+08	2026-01-03 01:25:35.193922+08	SF202601030068	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:25:35.213678+08	通过	\N	\N	t	210	210	\N
69	68881e43-2e51-4f0a-a482-2f3a94218699	7	2026-01-03 01:25:59.114681+08	2026-01-03 01:25:59.114681+08	SF202601030069	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:25:59.14094+08	通过	\N	\N	t	210	210	\N
70	77ef3c66-1864-4b5c-abec-75aea3705d09	7	2026-01-03 01:27:11.506045+08	2026-01-03 01:27:11.506045+08	SF202601030070	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:27:11.53415+08	通过	\N	\N	t	210	210	\N
71	e941304e-1ef2-43d0-84aa-06cdbf26ce05	7	2026-01-03 01:32:57.013883+08	2026-01-03 01:32:57.013883+08	SF202601030071	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:32:57.041264+08	通过	\N	\N	t	210	210	\N
72	0e0df2a3-982a-4b8c-a5d8-ae32b94c29f4	7	2026-01-03 01:35:25.975003+08	2026-01-03 01:35:25.975003+08	SF202601030072	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:35:25.993934+08	通过	\N	\N	t	210	210	\N
73	8e208851-1b0e-4dfd-bfe6-a9df8677f810	7	2026-01-03 01:36:23.918501+08	2026-01-03 01:36:23.918501+08	SF202601030073	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:36:23.938313+08	通过	\N	\N	t	210	210	\N
74	233cd616-c648-4604-b997-918586a6bfc2	7	2026-01-03 01:59:11.435565+08	2026-01-03 01:59:11.435565+08	SF202601030074	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 09:59:11.469262+08	通过	\N	\N	t	210	210	\N
75	4a378ab6-f0a8-4a43-af0b-e797e4869810	7	2026-01-03 02:00:05.343557+08	2026-01-03 02:00:05.343557+08	SF202601030075	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 10:00:05.372305+08	通过	\N	\N	t	210	210	\N
76	664de068-e902-4cdd-94bc-c20fee7f21db	7	2026-01-03 02:01:13.019528+08	2026-01-03 02:01:13.019528+08	SF202601030076	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 10:01:13.048085+08	通过	\N	\N	t	210	210	\N
77	dcff1d1e-7ce7-400b-aaf6-ff1e1393c095	7	2026-01-03 02:04:34.374289+08	2026-01-03 02:04:34.374289+08	SF202601030077	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 10:04:34.393065+08	通过	\N	\N	t	210	210	\N
78	1fc1b2c4-a0b0-4dcf-80f8-d8658c878355	7	2026-01-03 02:05:49.002356+08	2026-01-03 02:05:49.002356+08	SF202601030078	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 10:05:49.035848+08	通过	\N	\N	t	210	210	\N
79	eb6cbfc5-97bb-45e9-9e00-4101e76a00d5	7	2026-01-03 02:07:08.981986+08	2026-01-03 02:07:08.981986+08	SF202601030079	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 10:07:09.012049+08	通过	\N	\N	t	210	210	\N
80	b0e7ff15-6caa-4cce-8ca8-fb96d9cf6b2a	7	2026-01-03 02:19:52.963698+08	2026-01-03 02:19:52.963698+08	SF202601030080	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 10:19:52.984491+08	通过	\N	\N	t	210	210	\N
81	c6506cc4-cd67-42c8-aa51-14619a05d125	7	2026-01-03 02:21:24.932883+08	2026-01-03 02:21:24.932883+08	SF202601030081	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 10:21:24.961797+08	通过	\N	\N	t	210	210	\N
82	10732201-f517-45a2-85d2-2dd1328703fb	7	2026-01-03 02:23:00.038995+08	2026-01-03 02:23:00.038995+08	SF202601030082	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 10:23:00.07623+08	通过	\N	\N	t	210	210	\N
83	e58e3fad-cb6f-46f5-86f8-975ba88d5b9e	7	2026-01-03 02:24:48.821604+08	2026-01-03 02:24:48.821604+08	SF202601030083	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 10:24:48.84053+08	通过	\N	\N	t	210	210	\N
84	33a4512f-24ca-4dba-8e07-2df1bab9b64d	7	2026-01-03 02:27:10.333694+08	2026-01-03 02:27:10.337761+08	SF202601030084	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 10:27:10.365143+08	通过	\N	\N	t	210	210	\N
85	6c17b332-24df-4fbc-81d4-436d60a49b73	7	2026-01-03 02:40:32.555825+08	2026-01-03 02:40:32.555825+08	SF202601030085	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 10:40:32.584367+08	通过	\N	\N	t	210	210	\N
86	929b6b12-dd63-495c-9b80-b060e05e5c05	7	2026-01-03 02:41:37.855903+08	2026-01-03 02:41:37.855903+08	SF202601030086	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 10:41:37.883534+08	通过	\N	\N	t	210	210	\N
87	dd6fe7e4-d611-4455-b147-44a74343e8f6	7	2026-01-03 02:43:06.691378+08	2026-01-03 02:43:06.691378+08	SF202601030087	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 10:43:06.714419+08	通过	\N	\N	t	210	210	\N
88	1b624ddd-963f-4b3c-b8ed-3c4f4689677c	7	2026-01-03 02:44:22.115062+08	2026-01-03 02:44:22.115062+08	SF202601030088	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 10:44:22.145515+08	通过	\N	\N	t	210	210	\N
89	e85ba84a-3268-40d5-8e85-5a987eb924d4	7	2026-01-03 02:45:23.269897+08	2026-01-03 02:45:23.269897+08	SF202601030089	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 10:45:23.296925+08	通过	\N	\N	t	210	210	\N
90	cf0c5ded-1028-4517-b8c6-3cb9d154f8aa	7	2026-01-03 02:46:48.932721+08	2026-01-03 02:46:48.932721+08	SF202601030090	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 10:46:48.963339+08	通过	\N	\N	t	210	210	\N
91	e11c5881-9b84-4d47-8986-2ed26f42e5fd	7	2026-01-03 02:47:25.000945+08	2026-01-03 02:47:25.000945+08	SF202601030091	测试销售预测	MTS	月度	2026-01-01	2026-01-31	已审核	210	测试用户	2026-01-03 10:47:25.036818+08	通过	\N	\N	t	210	210	\N
\.


--
-- Data for Name: apps_kuaizhizao_sales_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.apps_kuaizhizao_sales_orders (id, uuid, tenant_id, created_at, updated_at, order_code, customer_id, customer_name, customer_contact, customer_phone, order_date, delivery_date, order_type, total_quantity, total_amount, status, reviewer_id, reviewer_name, review_time, review_status, review_remarks, salesman_id, salesman_name, shipping_address, shipping_method, payment_terms, notes, is_active, created_by, updated_by, deleted_at) FROM stdin;
1	672edbfb-bfde-477b-b867-ae9deeeda272	7	2026-01-03 01:25:59.219286+08	2026-01-03 01:25:59.219286+08	SO-VIRTUAL-MTS	1	测试客户	\N	\N	2026-01-03	2026-02-02	MTS虚拟订单	0.00	0.00	已审核	\N	\N	\N	待审核	\N	\N	\N	\N	\N	\N	\N	t	\N	\N	\N
53	59d3c2aa-5e33-4cd5-a288-b217b1f8eab5	1	2026-01-06 00:44:59.171907+08	2026-01-06 00:44:59.171907+08	SO20260106001	1	客户A	张三	13800138001	2026-01-04	2026-02-05	MTO	300.00	11000.00	已审核	\N	\N	\N	待审核	\N	\N	李销售	北京市朝阳区xxx街道xxx号	快递	货到付款	优先处理订单	t	1	\N	\N
2	b2a40cc2-38e4-4f2d-b5a4-67fd924c725d	7	2026-01-03 01:50:57.13557+08	2026-01-03 01:50:57.13557+08	SO202601030001	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	待审核	\N	\N	\N	待审核	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
54	6a00136a-927a-471d-827b-3ab485ffaaa5	1	2026-01-06 00:44:59.249969+08	2026-01-06 00:44:59.249969+08	SO20260106002	2	客户B	李四	13800138002	2026-01-02	2026-02-20	MTO	150.00	12000.00	已确认	\N	\N	\N	待审核	\N	\N	王销售	上海市浦东新区xxx路xxx号	物流	月结30天	常规订单	t	1	\N	\N
3	67b37587-f16f-4acb-a77c-30a4e31becd7	7	2026-01-03 01:52:01.046364+08	2026-01-03 01:52:01.046364+08	SO202601030002	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	待审核	\N	\N	\N	待审核	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
55	b09281ee-5ef8-4a15-be9f-ddaf7fa5ef6d	1	2026-01-06 00:44:59.251967+08	2026-01-06 00:44:59.251967+08	SO20260106003	3	客户C	王五	13800138003	2025-12-31	2026-01-21	MTS	250.00	14500.00	草稿	\N	\N	\N	待审核	\N	\N	赵销售	广州市天河区xxx大道xxx号	快递	预付款	待确认订单	t	1	\N	\N
4	85d37507-accc-4292-9a19-cd615214d2a3	7	2026-01-03 01:52:52.892682+08	2026-01-03 01:52:52.892682+08	SO202601030003	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	待审核	\N	\N	\N	待审核	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
56	5277684e-105e-4a40-8a3c-68ab0ac26c30	1	2026-01-06 00:44:59.253547+08	2026-01-06 00:44:59.253547+08	SO20260106004	1	客户A	张三	13800138001	2025-12-29	2026-01-26	MTO	300.00	30000.00	进行中	\N	\N	\N	待审核	\N	\N	李销售	北京市朝阳区xxx街道xxx号	物流	月结60天	加急订单	t	1	\N	\N
5	495cbc22-50eb-4092-973b-b9de30bea731	7	2026-01-03 01:53:30.697463+08	2026-01-03 01:53:30.697463+08	SO202601030004	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	待审核	\N	\N	\N	待审核	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
57	2d340d91-f835-44e9-ba74-a6ab7fa967f4	1	2026-01-06 00:44:59.254536+08	2026-01-06 00:44:59.254536+08	SO20260106005	2	客户B	李四	13800138002	2025-12-27	2026-01-01	MTO	100.00	3000.00	已完成	\N	\N	\N	待审核	\N	\N	王销售	上海市浦东新区xxx路xxx号	快递	货到付款	已完成订单	t	1	\N	\N
6	1e30427a-eaf4-4c8b-bab5-dcb888a16a2b	7	2026-01-03 01:53:43.985341+08	2026-01-03 01:53:43.985341+08	SO202601030005	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	待审核	\N	\N	\N	待审核	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
7	dfe9c6fe-3fd3-4d64-b89c-e361abad6162	7	2026-01-03 01:54:25.892408+08	2026-01-03 01:54:25.892408+08	SO202601030006	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	待审核	\N	\N	\N	待审核	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
8	3921751c-637a-458a-80bc-281e3303fa73	7	2026-01-03 01:55:18.241049+08	2026-01-03 01:55:18.241049+08	SO202601030007	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	待审核	\N	\N	\N	待审核	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
9	397ee49c-d818-45b0-a94e-75289ee9ac19	7	2026-01-03 01:56:17.93486+08	2026-01-03 01:56:17.93486+08	SO202601030008	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	待审核	\N	\N	\N	待审核	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
70	c390b273-a16b-4f07-a615-7523d364447c	7	2026-01-06 01:05:59.455301+08	2026-01-06 01:05:59.455301+08	SO202601060003	5	测试客户	测试联系人	13800000000	2026-01-06	2026-02-15	MTO	0.00	0.00	已确认	210	测试用户	2026-01-06 09:05:59.487452+08	通过	\N	\N	\N	测试收货地址	快递	货到付款	完整流程测试订单	t	210	210	\N
10	f5475022-d48d-4f4b-846a-c07f5fca639e	7	2026-01-03 01:58:54.066681+08	2026-01-03 01:58:54.066681+08	SO202601030009	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	待审核	\N	\N	\N	待审核	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
11	2a9f155f-fb03-4f5b-9733-fe58d4d89852	7	2026-01-03 01:59:10.758545+08	2026-01-03 01:59:10.758545+08	SO202601030010	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	待审核	\N	\N	\N	待审核	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
12	0db92a8b-4db1-485c-a77e-7b5c5f88f549	7	2026-01-03 01:59:55.787075+08	2026-01-03 01:59:55.787075+08	SO202601030011	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	待审核	\N	\N	\N	待审核	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
13	df25a854-6095-44b8-abb8-33a480278283	7	2026-01-03 02:00:04.732721+08	2026-01-03 02:00:04.732721+08	SO202601030012	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	待审核	\N	\N	\N	待审核	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
14	d37f3c85-4858-4fe1-88a5-3820c39a088c	7	2026-01-03 02:01:03.065297+08	2026-01-03 02:01:03.065297+08	SO202601030013	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	待审核	\N	\N	\N	待审核	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
15	8e2d2e7e-ab4e-482a-b308-76a3fb60f942	7	2026-01-03 02:01:12.389585+08	2026-01-03 02:01:12.389585+08	SO202601030014	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	待审核	\N	\N	\N	待审核	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
16	d9ef68bd-e569-4d5e-b1c1-6d8508889044	7	2026-01-03 02:02:10.934948+08	2026-01-03 02:02:10.934948+08	SO202601030015	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:02:10.974541+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
17	f72b7955-5f45-48a0-b4b0-c9655c66361d	7	2026-01-03 02:03:42.173738+08	2026-01-03 02:03:42.173738+08	SO202601030016	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:03:42.191779+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
18	d2f3d56a-9c85-4bb6-b32b-1a760628de25	7	2026-01-03 02:04:16.543503+08	2026-01-03 02:04:16.543503+08	SO202601030017	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:04:16.562079+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
19	c8ee1a3e-5f2e-40ff-a876-72cb1bf5135d	7	2026-01-03 02:04:33.738587+08	2026-01-03 02:04:33.738587+08	SO202601030018	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:04:33.765423+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
20	9058c430-2225-482d-8b54-c32f007e5826	7	2026-01-03 02:05:39.211538+08	2026-01-03 02:05:39.211538+08	SO202601030019	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:05:39.237908+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
21	b3f6f297-9518-4bdd-88c6-52b29e05a12a	7	2026-01-03 02:05:48.360677+08	2026-01-03 02:05:48.360677+08	SO202601030020	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:05:48.385728+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
71	c2eba06a-e0b1-4439-9ec9-6bfd48ad4da3	7	2026-01-06 01:06:13.604926+08	2026-01-06 01:06:13.604926+08	SO202601060004	5	测试客户	测试联系人	13800000000	2026-01-06	2026-02-15	MTO	0.00	0.00	已确认	210	测试用户	2026-01-06 09:06:13.633901+08	通过	\N	\N	\N	测试收货地址	快递	货到付款	完整流程测试订单	t	210	210	\N
22	d9df511c-e861-454e-a1d9-c7594a537f69	7	2026-01-03 02:06:59.018386+08	2026-01-03 02:06:59.018386+08	SO202601030021	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:06:59.046121+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
23	235e3eac-ae4d-448b-9c52-6f34c03f7eb0	7	2026-01-03 02:07:08.271908+08	2026-01-03 02:07:08.271908+08	SO202601030022	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:07:08.290672+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
24	c60d8674-b9fc-4cac-8193-1fe2c1b981f1	7	2026-01-03 02:19:40.77641+08	2026-01-03 02:19:40.77641+08	SO202601030023	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:19:40.800103+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
25	4587722b-1674-4fdc-bcdf-b093ad864ba2	7	2026-01-03 02:19:52.212866+08	2026-01-03 02:19:52.212866+08	SO202601030024	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:19:52.230795+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
26	ed49792e-4be6-4be8-b954-2a4bf75d253f	7	2026-01-03 02:20:36.781726+08	2026-01-03 02:20:36.781726+08	SO202601030025	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:20:36.807583+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
27	8a0f1b25-6e9c-4569-9124-bbad0eb7b8f0	7	2026-01-03 02:21:14.170508+08	2026-01-03 02:21:14.170508+08	SO202601030026	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:21:14.191433+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
28	b770f620-c756-4328-b0df-e42b71f825f3	7	2026-01-03 02:21:24.142666+08	2026-01-03 02:21:24.142666+08	SO202601030027	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:21:24.179937+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
29	1b2b86d8-2135-4d0e-91a9-69eee3e89280	7	2026-01-03 02:22:49.439023+08	2026-01-03 02:22:49.439023+08	SO202601030028	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:22:49.468744+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
63	1a8b6583-f062-4a35-9477-1b7a63ca592f	1	2026-01-06 00:45:58.937683+08	2026-01-06 00:45:58.937683+08	SO20260106001_084558	1	客户A	张三	13800138001	2026-01-04	2026-02-05	MTO	300.00	11000.00	已审核	\N	\N	\N	待审核	\N	\N	李销售	北京市朝阳区xxx街道xxx号	快递	货到付款	优先处理订单	t	1	\N	\N
64	f52e107a-f7c6-47ad-89ec-d1b9360925b1	1	2026-01-06 00:45:58.937683+08	2026-01-06 00:45:58.937683+08	SO20260106002_084558	2	客户B	李四	13800138002	2026-01-02	2026-02-20	MTO	150.00	12000.00	已确认	\N	\N	\N	待审核	\N	\N	王销售	上海市浦东新区xxx路xxx号	物流	月结30天	常规订单	t	1	\N	\N
65	2aedd3bf-6456-44be-b3c0-ccc948155428	1	2026-01-06 00:45:58.937683+08	2026-01-06 00:45:58.937683+08	SO20260106003_084558	3	客户C	王五	13800138003	2025-12-31	2026-01-21	MTS	250.00	14500.00	草稿	\N	\N	\N	待审核	\N	\N	赵销售	广州市天河区xxx大道xxx号	快递	预付款	待确认订单	t	1	\N	\N
30	5755e38a-bc2c-4463-8bc7-2808aa9e29db	7	2026-01-03 02:22:59.292652+08	2026-01-03 02:22:59.292652+08	SO202601030029	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:22:59.320887+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
66	819f659d-886e-4ff0-9272-d0764b97da79	1	2026-01-06 00:45:58.948204+08	2026-01-06 00:45:58.948204+08	SO20260106004_084558	1	客户A	张三	13800138001	2025-12-29	2026-01-26	MTO	300.00	30000.00	进行中	\N	\N	\N	待审核	\N	\N	李销售	北京市朝阳区xxx街道xxx号	物流	月结60天	加急订单	t	1	\N	\N
67	c7469c90-1d3d-4592-a849-daa03ebe2f91	1	2026-01-06 00:45:58.949546+08	2026-01-06 00:45:58.949546+08	SO20260106005_084558	2	客户B	李四	13800138002	2025-12-27	2026-01-01	MTO	100.00	3000.00	已完成	\N	\N	\N	待审核	\N	\N	王销售	上海市浦东新区xxx路xxx号	快递	货到付款	已完成订单	t	1	\N	\N
31	ce77c1f3-0930-4f16-8faf-d7d395d85d26	7	2026-01-03 02:23:24.255915+08	2026-01-03 02:23:24.255915+08	SO202601030030	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:23:24.280054+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
32	632fab3a-103b-4926-91e1-dad4944115f8	7	2026-01-03 02:24:27.25488+08	2026-01-03 02:24:27.25488+08	SO202601030031	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:24:27.291402+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
33	a8579299-bbbe-40e1-823a-cb4134a62bf0	7	2026-01-03 02:24:37.608002+08	2026-01-03 02:24:37.608002+08	SO202601030032	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:24:37.641333+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
34	d6cc72e8-3670-4984-8b10-dedbbab2b70e	7	2026-01-03 02:24:48.084737+08	2026-01-03 02:24:48.084737+08	SO202601030033	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:24:48.110109+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
35	e914f0e7-25ed-4383-b19a-82ec5092f7f5	7	2026-01-03 02:26:09.40464+08	2026-01-03 02:26:09.40464+08	SO202601030034	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:26:09.440312+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
36	da8a72e4-1bae-4ddc-889f-7cf5b1cafdae	7	2026-01-03 02:26:19.742291+08	2026-01-03 02:26:19.742291+08	SO202601030035	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:26:19.776331+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
37	c6108f45-5478-4408-8d3b-705fc9679ae7	7	2026-01-03 02:26:29.388155+08	2026-01-03 02:26:29.388155+08	SO202601030036	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:26:29.41824+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
38	1bce1909-8487-40e0-a0cb-eed8b7ee6f78	7	2026-01-03 02:26:39.146481+08	2026-01-03 02:26:39.146481+08	SO202601030037	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:26:39.184569+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
39	2211c0c1-70e3-45d5-8925-737b39cadc24	7	2026-01-03 02:26:59.476316+08	2026-01-03 02:26:59.476316+08	SO202601030038	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:26:59.511399+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
68	d2f5fcff-2129-4140-b7cc-9ca46e5940db	7	2026-01-06 01:05:21.945807+08	2026-01-06 01:05:21.945807+08	SO202601060001	5	测试客户	测试联系人	13800000000	2026-01-06	2026-02-15	MTO	0.00	0.00	草稿	\N	\N	\N	待审核	\N	\N	\N	测试收货地址	快递	货到付款	完整流程测试订单	t	210	\N	\N
40	c3387c18-8182-4759-9ec2-926e90e677c4	7	2026-01-03 02:27:09.492524+08	2026-01-03 02:27:09.492524+08	SO202601030039	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:27:09.515901+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
41	925e3344-38e7-4056-b3a3-3677078652c2	7	2026-01-03 02:40:13.271911+08	2026-01-03 02:40:13.271911+08	SO202601030040	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:40:13.292215+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
42	850998c6-4daa-4753-8510-785f8eb3a0f3	7	2026-01-03 02:40:22.281922+08	2026-01-03 02:40:22.281922+08	SO202601030041	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:40:22.300406+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
43	3b867f38-6fe0-4412-a275-955996020bcb	7	2026-01-03 02:40:31.906008+08	2026-01-03 02:40:31.906008+08	SO202601030042	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:40:31.925409+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
44	b660d133-5748-4f66-be50-8110e5d17dec	7	2026-01-03 02:41:27.680639+08	2026-01-03 02:41:27.680639+08	SO202601030043	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:41:27.705486+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
45	b2bd4665-de73-48ce-a6cf-ce36c08c6813	7	2026-01-03 02:41:37.200833+08	2026-01-03 02:41:37.200833+08	SO202601030044	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:41:37.219298+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
46	a166cabc-5754-4ac5-b787-c020298023a9	7	2026-01-03 02:42:55.369322+08	2026-01-03 02:42:55.370322+08	SO202601030045	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:42:55.405248+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
47	e19d92d9-27df-4206-b9d3-7743652d1a25	7	2026-01-03 02:43:06.02148+08	2026-01-03 02:43:06.02148+08	SO202601030046	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:43:06.049539+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
48	b513d9ea-8f45-483c-9574-bec604ccd8ae	7	2026-01-03 02:46:38.214945+08	2026-01-03 02:46:38.214945+08	SO202601030047	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:46:38.246461+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
49	e96495a4-e19c-44b7-8c2c-ceb7c1154253	7	2026-01-03 02:46:48.197112+08	2026-01-03 02:46:48.197112+08	SO202601030048	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:46:48.227192+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
69	0cc90778-b6af-476d-865d-6f3cdda73715	7	2026-01-06 01:05:40.861592+08	2026-01-06 01:05:40.861592+08	SO202601060002	5	测试客户	测试联系人	13800000000	2026-01-06	2026-02-15	MTO	0.00	0.00	草稿	\N	\N	\N	待审核	\N	\N	\N	测试收货地址	快递	货到付款	完整流程测试订单	t	210	\N	\N
50	0753f73d-dc9e-4c84-8aa9-31a8f8eb5a14	7	2026-01-03 02:47:04.826588+08	2026-01-03 02:47:04.826588+08	SO202601030049	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:47:04.850652+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
51	3bb116cd-c32d-48d7-b0d0-5fead207bd2f	7	2026-01-03 02:47:14.500738+08	2026-01-03 02:47:14.500738+08	SO202601030050	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:47:14.522537+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
52	a065cb5e-43dc-494f-b5d1-1ffe0ba0bd0e	7	2026-01-03 02:47:24.193074+08	2026-01-03 02:47:24.193074+08	SO202601030051	1	测试客户	\N	\N	2026-01-01	2026-01-20	MTO	0.00	0.00	已确认	210	测试用户	2026-01-03 10:47:24.224074+08	通过	\N	\N	\N	\N	\N	\N	\N	t	210	210	\N
\.


--
-- Name: apps_kuaizhizao_lrp_results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.apps_kuaizhizao_lrp_results_id_seq', 5, true);


--
-- Name: apps_kuaizhizao_mrp_results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.apps_kuaizhizao_mrp_results_id_seq', 83, true);


--
-- Name: apps_kuaizhizao_sales_forecasts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.apps_kuaizhizao_sales_forecasts_id_seq', 91, true);


--
-- Name: apps_kuaizhizao_sales_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.apps_kuaizhizao_sales_orders_id_seq', 71, true);


--
-- Name: apps_kuaizhizao_lrp_results apps_kuaizhizao_lrp_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apps_kuaizhizao_lrp_results
    ADD CONSTRAINT apps_kuaizhizao_lrp_results_pkey PRIMARY KEY (id);


--
-- Name: apps_kuaizhizao_mrp_results apps_kuaizhizao_mrp_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apps_kuaizhizao_mrp_results
    ADD CONSTRAINT apps_kuaizhizao_mrp_results_pkey PRIMARY KEY (id);


--
-- Name: apps_kuaizhizao_sales_forecasts apps_kuaizhizao_sales_forecasts_forecast_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apps_kuaizhizao_sales_forecasts
    ADD CONSTRAINT apps_kuaizhizao_sales_forecasts_forecast_code_key UNIQUE (forecast_code);


--
-- Name: apps_kuaizhizao_sales_forecasts apps_kuaizhizao_sales_forecasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apps_kuaizhizao_sales_forecasts
    ADD CONSTRAINT apps_kuaizhizao_sales_forecasts_pkey PRIMARY KEY (id);


--
-- Name: apps_kuaizhizao_sales_orders apps_kuaizhizao_sales_orders_order_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apps_kuaizhizao_sales_orders
    ADD CONSTRAINT apps_kuaizhizao_sales_orders_order_code_key UNIQUE (order_code);


--
-- Name: apps_kuaizhizao_sales_orders apps_kuaizhizao_sales_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apps_kuaizhizao_sales_orders
    ADD CONSTRAINT apps_kuaizhizao_sales_orders_pkey PRIMARY KEY (id);


--
-- Name: idx_apps_kuaizh_computa_4fd56c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apps_kuaizh_computa_4fd56c ON public.apps_kuaizhizao_lrp_results USING btree (computation_status);


--
-- Name: idx_apps_kuaizh_computa_637d36; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apps_kuaizh_computa_637d36 ON public.apps_kuaizhizao_mrp_results USING btree (computation_status);


--
-- Name: idx_apps_kuaizh_computa_916201; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apps_kuaizh_computa_916201 ON public.apps_kuaizhizao_lrp_results USING btree (computation_time);


--
-- Name: idx_apps_kuaizh_computa_acf7da; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apps_kuaizh_computa_acf7da ON public.apps_kuaizhizao_mrp_results USING btree (computation_time);


--
-- Name: idx_apps_kuaizh_deliver_ad67f4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apps_kuaizh_deliver_ad67f4 ON public.apps_kuaizhizao_lrp_results USING btree (delivery_date);


--
-- Name: idx_apps_kuaizh_deliver_d65cf9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apps_kuaizh_deliver_d65cf9 ON public.apps_kuaizhizao_sales_orders USING btree (delivery_date);


--
-- Name: idx_apps_kuaizh_order_d_1ef496; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apps_kuaizh_order_d_1ef496 ON public.apps_kuaizhizao_sales_orders USING btree (order_date);


--
-- Name: idx_apps_kuaizh_start_d_247e36; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apps_kuaizh_start_d_247e36 ON public.apps_kuaizhizao_sales_forecasts USING btree (start_date, end_date);


--
-- Name: idx_apps_kuaizh_tenant__137f71; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apps_kuaizh_tenant__137f71 ON public.apps_kuaizhizao_sales_orders USING btree (tenant_id, customer_id);


--
-- Name: idx_apps_kuaizh_tenant__21723c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apps_kuaizh_tenant__21723c ON public.apps_kuaizhizao_sales_forecasts USING btree (tenant_id, forecast_period);


--
-- Name: idx_apps_kuaizh_tenant__368a43; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apps_kuaizh_tenant__368a43 ON public.apps_kuaizhizao_mrp_results USING btree (tenant_id, material_id);


--
-- Name: idx_apps_kuaizh_tenant__3c150b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apps_kuaizh_tenant__3c150b ON public.apps_kuaizhizao_sales_forecasts USING btree (tenant_id, status);


--
-- Name: idx_apps_kuaizh_tenant__527e15; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apps_kuaizh_tenant__527e15 ON public.apps_kuaizhizao_lrp_results USING btree (tenant_id, sales_order_id);


--
-- Name: idx_apps_kuaizh_tenant__5edd5c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apps_kuaizh_tenant__5edd5c ON public.apps_kuaizhizao_sales_orders USING btree (tenant_id, status);


--
-- Name: idx_apps_kuaizh_tenant__6f4c84; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apps_kuaizh_tenant__6f4c84 ON public.apps_kuaizhizao_mrp_results USING btree (tenant_id, forecast_id);


--
-- Name: idx_apps_kuaizh_tenant__da4353; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apps_kuaizh_tenant__da4353 ON public.apps_kuaizhizao_lrp_results USING btree (tenant_id, material_id);


--
-- Name: apps_kuaizhizao_lrp_results fk_apps_kuaizhizao_lrp_results_sales_order_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apps_kuaizhizao_lrp_results
    ADD CONSTRAINT fk_apps_kuaizhizao_lrp_results_sales_order_id FOREIGN KEY (sales_order_id) REFERENCES public.apps_kuaizhizao_sales_orders(id) ON DELETE CASCADE;


--
-- Name: apps_kuaizhizao_mrp_results fk_apps_kuaizhizao_mrp_results_forecast_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apps_kuaizhizao_mrp_results
    ADD CONSTRAINT fk_apps_kuaizhizao_mrp_results_forecast_id FOREIGN KEY (forecast_id) REFERENCES public.apps_kuaizhizao_sales_forecasts(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict G5SYKepfFWYDaCOxH97VFCYHLek7fcU6hWRfZZ3qSboelrWwipJf3dyvTRK5YXE

