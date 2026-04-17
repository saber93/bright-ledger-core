
-- ============================================
-- INVENTORY MODULE
-- ============================================

CREATE TYPE public.product_type AS ENUM ('goods', 'service', 'digital');
CREATE TYPE public.stock_movement_type AS ENUM ('in', 'out', 'transfer', 'adjustment');

CREATE TABLE public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type public.product_type NOT NULL DEFAULT 'goods',
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  unit TEXT NOT NULL DEFAULT 'unit',
  cost_price NUMERIC NOT NULL DEFAULT 0,
  sale_price NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  barcode TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT false,
  reorder_point NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, sku)
);

CREATE TABLE public.warehouses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  address_line1 TEXT,
  city TEXT,
  country TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE TABLE public.stock_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, warehouse_id)
);

CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  type public.stock_movement_type NOT NULL,
  quantity NUMERIC NOT NULL,
  reference TEXT,
  notes TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SALES ORDERS MODULE
-- ============================================

CREATE TYPE public.sales_order_status AS ENUM ('draft', 'quotation', 'confirmed', 'fulfilled', 'invoiced', 'cancelled');

CREATE TABLE public.sales_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  order_number TEXT NOT NULL,
  status public.sales_order_status NOT NULL DEFAULT 'draft',
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_total NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, order_number)
);

CREATE TABLE public.sales_order_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- ONLINE STORE MODULE
-- ============================================

CREATE TYPE public.online_order_status AS ENUM ('pending', 'paid', 'fulfilled', 'shipped', 'delivered', 'cancelled', 'refunded');

CREATE TABLE public.online_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  shipping_address_line1 TEXT,
  shipping_city TEXT,
  shipping_postal_code TEXT,
  shipping_country TEXT,
  status public.online_order_status NOT NULL DEFAULT 'pending',
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  shipping_total NUMERIC NOT NULL DEFAULT 0,
  tax_total NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_reference TEXT,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, order_number)
);

CREATE TABLE public.online_order_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.online_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_products_company ON public.products(company_id);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_warehouses_company ON public.warehouses(company_id);
CREATE INDEX idx_stock_levels_company ON public.stock_levels(company_id);
CREATE INDEX idx_stock_movements_company ON public.stock_movements(company_id);
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_sales_orders_company ON public.sales_orders(company_id);
CREATE INDEX idx_sales_orders_customer ON public.sales_orders(customer_id);
CREATE INDEX idx_sales_order_lines_order ON public.sales_order_lines(order_id);
CREATE INDEX idx_online_orders_company ON public.online_orders(company_id);
CREATE INDEX idx_online_order_lines_order ON public.online_order_lines(order_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER trg_product_categories_updated BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_warehouses_updated BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sales_orders_updated BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_online_orders_updated BEFORE UPDATE ON public.online_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS
-- ============================================

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_order_lines ENABLE ROW LEVEL SECURITY;

-- product_categories
CREATE POLICY "Members view categories" ON public.product_categories FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Inventory manage categories insert" ON public.product_categories FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['owner','inventory_manager']::app_role[]));
CREATE POLICY "Inventory manage categories update" ON public.product_categories FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), company_id, ARRAY['owner','inventory_manager']::app_role[]));
CREATE POLICY "Inventory manage categories delete" ON public.product_categories FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), company_id, ARRAY['owner','inventory_manager']::app_role[]));

-- products
CREATE POLICY "Members view products" ON public.products FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Inventory insert products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['owner','inventory_manager','store_manager']::app_role[]));
CREATE POLICY "Inventory update products" ON public.products FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), company_id, ARRAY['owner','inventory_manager','store_manager']::app_role[]));
CREATE POLICY "Inventory delete products" ON public.products FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), company_id, ARRAY['owner','inventory_manager']::app_role[]));

-- warehouses
CREATE POLICY "Members view warehouses" ON public.warehouses FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Inventory insert warehouses" ON public.warehouses FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['owner','inventory_manager']::app_role[]));
CREATE POLICY "Inventory update warehouses" ON public.warehouses FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), company_id, ARRAY['owner','inventory_manager']::app_role[]));
CREATE POLICY "Inventory delete warehouses" ON public.warehouses FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), company_id, ARRAY['owner','inventory_manager']::app_role[]));

-- stock_levels
CREATE POLICY "Members view stock levels" ON public.stock_levels FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Inventory insert stock levels" ON public.stock_levels FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['owner','inventory_manager']::app_role[]));
CREATE POLICY "Inventory update stock levels" ON public.stock_levels FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), company_id, ARRAY['owner','inventory_manager']::app_role[]));
CREATE POLICY "Inventory delete stock levels" ON public.stock_levels FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), company_id, ARRAY['owner','inventory_manager']::app_role[]));

-- stock_movements
CREATE POLICY "Members view stock movements" ON public.stock_movements FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Inventory insert stock movements" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['owner','inventory_manager']::app_role[]));
CREATE POLICY "Inventory update stock movements" ON public.stock_movements FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), company_id, ARRAY['owner','inventory_manager']::app_role[]));
CREATE POLICY "Inventory delete stock movements" ON public.stock_movements FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), company_id, ARRAY['owner','inventory_manager']::app_role[]));

-- sales_orders
CREATE POLICY "Members view sales orders" ON public.sales_orders FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Sales insert orders" ON public.sales_orders FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['owner','sales_manager','accountant']::app_role[]));
CREATE POLICY "Sales update orders" ON public.sales_orders FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), company_id, ARRAY['owner','sales_manager','accountant']::app_role[]));
CREATE POLICY "Sales delete orders" ON public.sales_orders FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), company_id, ARRAY['owner','sales_manager']::app_role[]));

-- sales_order_lines
CREATE POLICY "Members view sales order lines" ON public.sales_order_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales_orders o WHERE o.id = sales_order_lines.order_id AND has_company_access(auth.uid(), o.company_id)));
CREATE POLICY "Sales insert order lines" ON public.sales_order_lines FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales_orders o WHERE o.id = sales_order_lines.order_id AND has_any_role(auth.uid(), o.company_id, ARRAY['owner','sales_manager','accountant']::app_role[])));
CREATE POLICY "Sales update order lines" ON public.sales_order_lines FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales_orders o WHERE o.id = sales_order_lines.order_id AND has_any_role(auth.uid(), o.company_id, ARRAY['owner','sales_manager','accountant']::app_role[])));
CREATE POLICY "Sales delete order lines" ON public.sales_order_lines FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales_orders o WHERE o.id = sales_order_lines.order_id AND has_any_role(auth.uid(), o.company_id, ARRAY['owner','sales_manager']::app_role[])));

-- online_orders
CREATE POLICY "Members view online orders" ON public.online_orders FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id));
CREATE POLICY "Store insert online orders" ON public.online_orders FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), company_id, ARRAY['owner','store_manager','sales_manager']::app_role[]));
CREATE POLICY "Store update online orders" ON public.online_orders FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), company_id, ARRAY['owner','store_manager','sales_manager']::app_role[]));
CREATE POLICY "Store delete online orders" ON public.online_orders FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), company_id, ARRAY['owner','store_manager']::app_role[]));

-- online_order_lines
CREATE POLICY "Members view online order lines" ON public.online_order_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.online_orders o WHERE o.id = online_order_lines.order_id AND has_company_access(auth.uid(), o.company_id)));
CREATE POLICY "Store insert online order lines" ON public.online_order_lines FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.online_orders o WHERE o.id = online_order_lines.order_id AND has_any_role(auth.uid(), o.company_id, ARRAY['owner','store_manager','sales_manager']::app_role[])));
CREATE POLICY "Store update online order lines" ON public.online_order_lines FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.online_orders o WHERE o.id = online_order_lines.order_id AND has_any_role(auth.uid(), o.company_id, ARRAY['owner','store_manager','sales_manager']::app_role[])));
CREATE POLICY "Store delete online order lines" ON public.online_order_lines FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.online_orders o WHERE o.id = online_order_lines.order_id AND has_any_role(auth.uid(), o.company_id, ARRAY['owner','store_manager']::app_role[])));

-- ============================================
-- SEED DEMO DATA for company 22b81ebf-3cef-4340-8559-8621e5def506
-- ============================================

DO $$
DECLARE
  _co UUID := '22b81ebf-3cef-4340-8559-8621e5def506';
  _cat_elec UUID; _cat_acc UUID; _cat_office UUID; _cat_apparel UUID;
  _wh_main UUID; _wh_east UUID;
  _p_keyboard UUID; _p_mouse UUID; _p_monitor UUID; _p_dock UUID; _p_headset UUID;
  _p_chair UUID; _p_desk UUID; _p_lamp UUID;
  _p_tshirt UUID; _p_hoodie UUID; _p_cap UUID;
  _p_cable UUID; _p_charger UUID; _p_stand UUID; _p_consult UUID;
  _cust_ids UUID[];
  _so1 UUID; _so2 UUID; _so3 UUID; _so4 UUID; _so5 UUID; _so6 UUID; _so7 UUID; _so8 UUID;
  _oo1 UUID; _oo2 UUID; _oo3 UUID; _oo4 UUID; _oo5 UUID; _oo6 UUID; _oo7 UUID;
BEGIN
  -- Categories
  INSERT INTO public.product_categories (company_id, name, description) VALUES
    (_co, 'Electronics', 'Computers, peripherals, and gadgets') RETURNING id INTO _cat_elec;
  INSERT INTO public.product_categories (company_id, name, description) VALUES
    (_co, 'Accessories', 'Cables, chargers, and add-ons') RETURNING id INTO _cat_acc;
  INSERT INTO public.product_categories (company_id, name, description) VALUES
    (_co, 'Office Furniture', 'Chairs, desks, and lighting') RETURNING id INTO _cat_office;
  INSERT INTO public.product_categories (company_id, name, description) VALUES
    (_co, 'Apparel', 'Branded merchandise and clothing') RETURNING id INTO _cat_apparel;

  -- Warehouses
  INSERT INTO public.warehouses (company_id, code, name, address_line1, city, country) VALUES
    (_co, 'WH-MAIN', 'Main Warehouse', '500 Industrial Pkwy', 'Oakland', 'US') RETURNING id INTO _wh_main;
  INSERT INTO public.warehouses (company_id, code, name, address_line1, city, country) VALUES
    (_co, 'WH-EAST', 'East Coast Hub', '88 Distribution Way', 'Newark', 'US') RETURNING id INTO _wh_east;

  -- Products
  INSERT INTO public.products (company_id, sku, name, description, type, category_id, unit, cost_price, sale_price, tax_rate, is_published, reorder_point) VALUES
    (_co, 'KB-MX-01', 'Mechanical Keyboard Pro', 'Hot-swappable mechanical keyboard with RGB', 'goods', _cat_elec, 'unit', 65, 149, 0.08, true, 20) RETURNING id INTO _p_keyboard;
  INSERT INTO public.products (company_id, sku, name, description, type, category_id, unit, cost_price, sale_price, tax_rate, is_published, reorder_point) VALUES
    (_co, 'MS-WL-02', 'Wireless Mouse Ergonomic', 'Bluetooth ergonomic mouse', 'goods', _cat_elec, 'unit', 18, 49, 0.08, true, 30) RETURNING id INTO _p_mouse;
  INSERT INTO public.products (company_id, sku, name, description, type, category_id, unit, cost_price, sale_price, tax_rate, is_published, reorder_point) VALUES
    (_co, 'MN-27-4K', '27" 4K Monitor', 'IPS 4K monitor with USB-C', 'goods', _cat_elec, 'unit', 280, 499, 0.08, true, 10) RETURNING id INTO _p_monitor;
  INSERT INTO public.products (company_id, sku, name, description, type, category_id, unit, cost_price, sale_price, tax_rate, is_published, reorder_point) VALUES
    (_co, 'DK-USC-01', 'USB-C Docking Station', '12-in-1 docking station', 'goods', _cat_elec, 'unit', 95, 199, 0.08, true, 15) RETURNING id INTO _p_dock;
  INSERT INTO public.products (company_id, sku, name, description, type, category_id, unit, cost_price, sale_price, tax_rate, is_published, reorder_point) VALUES
    (_co, 'HS-BT-03', 'Bluetooth Headset Pro', 'Noise cancelling headset', 'goods', _cat_elec, 'unit', 70, 169, 0.08, true, 12) RETURNING id INTO _p_headset;
  INSERT INTO public.products (company_id, sku, name, description, type, category_id, unit, cost_price, sale_price, tax_rate, is_published, reorder_point) VALUES
    (_co, 'CH-ERG-01', 'Ergonomic Office Chair', 'Mesh ergonomic chair with lumbar support', 'goods', _cat_office, 'unit', 180, 389, 0.06, true, 8) RETURNING id INTO _p_chair;
  INSERT INTO public.products (company_id, sku, name, description, type, category_id, unit, cost_price, sale_price, tax_rate, is_published, reorder_point) VALUES
    (_co, 'DS-STD-01', 'Standing Desk Electric', 'Height-adjustable electric desk', 'goods', _cat_office, 'unit', 320, 649, 0.06, true, 5) RETURNING id INTO _p_desk;
  INSERT INTO public.products (company_id, sku, name, description, type, category_id, unit, cost_price, sale_price, tax_rate, is_published, reorder_point) VALUES
    (_co, 'LP-LED-01', 'LED Desk Lamp', 'Adjustable LED desk lamp', 'goods', _cat_office, 'unit', 22, 59, 0.06, true, 25) RETURNING id INTO _p_lamp;
  INSERT INTO public.products (company_id, sku, name, description, type, category_id, unit, cost_price, sale_price, tax_rate, is_published, reorder_point) VALUES
    (_co, 'AP-TEE-01', 'Branded T-Shirt', '100% cotton branded tee', 'goods', _cat_apparel, 'unit', 8, 24, 0.05, true, 50) RETURNING id INTO _p_tshirt;
  INSERT INTO public.products (company_id, sku, name, description, type, category_id, unit, cost_price, sale_price, tax_rate, is_published, reorder_point) VALUES
    (_co, 'AP-HD-01', 'Branded Hoodie', 'Premium fleece hoodie', 'goods', _cat_apparel, 'unit', 22, 59, 0.05, true, 30) RETURNING id INTO _p_hoodie;
  INSERT INTO public.products (company_id, sku, name, description, type, category_id, unit, cost_price, sale_price, tax_rate, is_published, reorder_point) VALUES
    (_co, 'AP-CAP-01', 'Branded Cap', 'Embroidered cap', 'goods', _cat_apparel, 'unit', 6, 19, 0.05, true, 40) RETURNING id INTO _p_cap;
  INSERT INTO public.products (company_id, sku, name, description, type, category_id, unit, cost_price, sale_price, tax_rate, is_published, reorder_point) VALUES
    (_co, 'AC-CBL-USC', 'USB-C Cable 2m', 'Braided USB-C to USB-C cable', 'goods', _cat_acc, 'unit', 3, 12, 0.08, true, 100) RETURNING id INTO _p_cable;
  INSERT INTO public.products (company_id, sku, name, description, type, category_id, unit, cost_price, sale_price, tax_rate, is_published, reorder_point) VALUES
    (_co, 'AC-CHG-65', '65W GaN Charger', 'Compact 65W charger', 'goods', _cat_acc, 'unit', 14, 39, 0.08, true, 40) RETURNING id INTO _p_charger;
  INSERT INTO public.products (company_id, sku, name, description, type, category_id, unit, cost_price, sale_price, tax_rate, is_published, reorder_point) VALUES
    (_co, 'AC-LST-01', 'Laptop Stand Aluminum', 'Adjustable aluminum laptop stand', 'goods', _cat_acc, 'unit', 18, 49, 0.08, true, 35) RETURNING id INTO _p_stand;
  INSERT INTO public.products (company_id, sku, name, description, type, category_id, unit, cost_price, sale_price, tax_rate, is_published, reorder_point) VALUES
    (_co, 'SVC-CONS', 'Consulting (per hour)', 'Professional consulting service', 'service', NULL, 'hour', 0, 220, 0, false, 0) RETURNING id INTO _p_consult;

  -- Stock levels (split between two warehouses)
  INSERT INTO public.stock_levels (company_id, product_id, warehouse_id, quantity) VALUES
    (_co, _p_keyboard, _wh_main, 85), (_co, _p_keyboard, _wh_east, 32),
    (_co, _p_mouse, _wh_main, 140), (_co, _p_mouse, _wh_east, 45),
    (_co, _p_monitor, _wh_main, 22), (_co, _p_monitor, _wh_east, 8),
    (_co, _p_dock, _wh_main, 38), (_co, _p_dock, _wh_east, 14),
    (_co, _p_headset, _wh_main, 27), (_co, _p_headset, _wh_east, 11),
    (_co, _p_chair, _wh_main, 14), (_co, _p_chair, _wh_east, 5),
    (_co, _p_desk, _wh_main, 9), (_co, _p_desk, _wh_east, 3),
    (_co, _p_lamp, _wh_main, 60), (_co, _p_lamp, _wh_east, 18),
    (_co, _p_tshirt, _wh_main, 220), (_co, _p_tshirt, _wh_east, 80),
    (_co, _p_hoodie, _wh_main, 95), (_co, _p_hoodie, _wh_east, 28),
    (_co, _p_cap, _wh_main, 130), (_co, _p_cap, _wh_east, 40),
    (_co, _p_cable, _wh_main, 380), (_co, _p_cable, _wh_east, 120),
    (_co, _p_charger, _wh_main, 92), (_co, _p_charger, _wh_east, 30),
    (_co, _p_stand, _wh_main, 56), (_co, _p_stand, _wh_east, 18);

  -- Stock movements (recent activity)
  INSERT INTO public.stock_movements (company_id, product_id, warehouse_id, type, quantity, reference, occurred_at) VALUES
    (_co, _p_keyboard, _wh_main, 'in', 50, 'PO-2024-0042', now() - interval '14 days'),
    (_co, _p_monitor, _wh_main, 'in', 12, 'PO-2024-0043', now() - interval '10 days'),
    (_co, _p_chair, _wh_main, 'in', 10, 'PO-2024-0044', now() - interval '8 days'),
    (_co, _p_keyboard, _wh_main, 'out', 8, 'SO-1004', now() - interval '5 days'),
    (_co, _p_mouse, _wh_main, 'out', 15, 'SO-1005', now() - interval '4 days'),
    (_co, _p_monitor, _wh_main, 'out', 3, 'SO-1006', now() - interval '3 days'),
    (_co, _p_keyboard, _wh_east, 'transfer', 12, 'TR-0017', now() - interval '6 days'),
    (_co, _p_dock, _wh_main, 'adjustment', -2, 'Cycle count', now() - interval '2 days'),
    (_co, _p_headset, _wh_main, 'out', 5, 'SO-1007', now() - interval '1 day'),
    (_co, _p_lamp, _wh_main, 'in', 25, 'PO-2024-0045', now() - interval '9 hours');

  -- Get customer ids in order
  SELECT array_agg(id ORDER BY created_at) INTO _cust_ids FROM public.customers WHERE company_id = _co;

  -- Sales orders (8 mixed)
  INSERT INTO public.sales_orders (company_id, customer_id, order_number, status, order_date, expected_delivery_date, currency, subtotal, tax_total, total)
  VALUES (_co, _cust_ids[1], 'SO-1001', 'invoiced', CURRENT_DATE - 35, CURRENT_DATE - 25, 'USD', 1490, 119.20, 1609.20) RETURNING id INTO _so1;
  INSERT INTO public.sales_order_lines (order_id, product_id, position, description, quantity, unit_price, tax_rate, line_total) VALUES
    (_so1, _p_keyboard, 0, 'Mechanical Keyboard Pro', 10, 149, 0.08, 1609.20);

  INSERT INTO public.sales_orders (company_id, customer_id, order_number, status, order_date, expected_delivery_date, currency, subtotal, tax_total, total)
  VALUES (_co, _cust_ids[2], 'SO-1002', 'fulfilled', CURRENT_DATE - 22, CURRENT_DATE - 12, 'USD', 4990, 399.20, 5389.20) RETURNING id INTO _so2;
  INSERT INTO public.sales_order_lines (order_id, product_id, position, description, quantity, unit_price, tax_rate, line_total) VALUES
    (_so2, _p_monitor, 0, '27" 4K Monitor', 10, 499, 0.08, 5389.20);

  INSERT INTO public.sales_orders (company_id, customer_id, order_number, status, order_date, expected_delivery_date, currency, subtotal, tax_total, total)
  VALUES (_co, _cust_ids[3], 'SO-1003', 'confirmed', CURRENT_DATE - 12, CURRENT_DATE + 8, 'USD', 3890, 233.40, 4123.40) RETURNING id INTO _so3;
  INSERT INTO public.sales_order_lines (order_id, product_id, position, description, quantity, unit_price, tax_rate, line_total) VALUES
    (_so3, _p_chair, 0, 'Ergonomic Office Chair', 10, 389, 0.06, 4123.40);

  INSERT INTO public.sales_orders (company_id, customer_id, order_number, status, order_date, expected_delivery_date, currency, subtotal, tax_total, total)
  VALUES (_co, _cust_ids[4], 'SO-1004', 'quotation', CURRENT_DATE - 5, CURRENT_DATE + 20, 'USD', 1947, 116.82, 2063.82) RETURNING id INTO _so4;
  INSERT INTO public.sales_order_lines (order_id, product_id, position, description, quantity, unit_price, tax_rate, line_total) VALUES
    (_so4, _p_desk, 0, 'Standing Desk Electric', 3, 649, 0.06, 2063.82);

  INSERT INTO public.sales_orders (company_id, customer_id, order_number, status, order_date, expected_delivery_date, currency, subtotal, tax_total, total)
  VALUES (_co, _cust_ids[5], 'SO-1005', 'confirmed', CURRENT_DATE - 8, CURRENT_DATE + 12, 'USD', 2735, 218.80, 2953.80) RETURNING id INTO _so5;
  INSERT INTO public.sales_order_lines (order_id, product_id, position, description, quantity, unit_price, tax_rate, line_total) VALUES
    (_so5, _p_dock, 0, 'USB-C Docking Station', 5, 199, 0.08, 1074.60),
    (_so5, _p_headset, 1, 'Bluetooth Headset Pro', 10, 169, 0.08, 1825.20);

  INSERT INTO public.sales_orders (company_id, customer_id, order_number, status, order_date, expected_delivery_date, currency, subtotal, tax_total, total)
  VALUES (_co, _cust_ids[1], 'SO-1006', 'draft', CURRENT_DATE - 1, CURRENT_DATE + 30, 'USD', 980, 78.40, 1058.40) RETURNING id INTO _so6;
  INSERT INTO public.sales_order_lines (order_id, product_id, position, description, quantity, unit_price, tax_rate, line_total) VALUES
    (_so6, _p_mouse, 0, 'Wireless Mouse Ergonomic', 20, 49, 0.08, 1058.40);

  INSERT INTO public.sales_orders (company_id, customer_id, order_number, status, order_date, expected_delivery_date, currency, subtotal, tax_total, total)
  VALUES (_co, _cust_ids[2], 'SO-1007', 'cancelled', CURRENT_DATE - 18, CURRENT_DATE + 2, 'USD', 1180, 70.80, 1250.80) RETURNING id INTO _so7;
  INSERT INTO public.sales_order_lines (order_id, product_id, position, description, quantity, unit_price, tax_rate, line_total) VALUES
    (_so7, _p_lamp, 0, 'LED Desk Lamp', 20, 59, 0.06, 1250.80);

  INSERT INTO public.sales_orders (company_id, customer_id, order_number, status, order_date, expected_delivery_date, currency, subtotal, tax_total, total)
  VALUES (_co, _cust_ids[3], 'SO-1008', 'fulfilled', CURRENT_DATE - 28, CURRENT_DATE - 18, 'USD', 2200, 0, 2200) RETURNING id INTO _so8;
  INSERT INTO public.sales_order_lines (order_id, product_id, position, description, quantity, unit_price, tax_rate, line_total) VALUES
    (_so8, _p_consult, 0, 'Consulting (per hour)', 10, 220, 0, 2200);

  -- Online orders (7 mixed)
  INSERT INTO public.online_orders (company_id, order_number, customer_email, customer_name, customer_phone, shipping_address_line1, shipping_city, shipping_postal_code, shipping_country, status, currency, subtotal, shipping_total, tax_total, total, payment_method, payment_reference, placed_at)
  VALUES (_co, 'WEB-2001', 'sarah.lee@email.com', 'Sarah Lee', '+1-415-555-7821', '420 Mission St Apt 5B', 'San Francisco', '94105', 'US', 'delivered', 'USD', 198, 9.99, 15.84, 223.83, 'card', 'pi_3OqxYZ', now() - interval '24 days') RETURNING id INTO _oo1;
  INSERT INTO public.online_order_lines (order_id, product_id, position, product_name, quantity, unit_price, line_total) VALUES
    (_oo1, _p_keyboard, 0, 'Mechanical Keyboard Pro', 1, 149, 149),
    (_oo1, _p_cable, 1, 'USB-C Cable 2m', 4, 12, 48);

  INSERT INTO public.online_orders (company_id, order_number, customer_email, customer_name, shipping_address_line1, shipping_city, shipping_postal_code, shipping_country, status, currency, subtotal, shipping_total, tax_total, total, payment_method, payment_reference, placed_at)
  VALUES (_co, 'WEB-2002', 'mike.johnson@email.com', 'Mike Johnson', '88 Oak Avenue', 'Austin', '78701', 'US', 'shipped', 'USD', 499, 14.99, 39.92, 553.91, 'card', 'pi_3OqyAB', now() - interval '6 days') RETURNING id INTO _oo2;
  INSERT INTO public.online_order_lines (order_id, product_id, position, product_name, quantity, unit_price, line_total) VALUES
    (_oo2, _p_monitor, 0, '27" 4K Monitor', 1, 499, 499);

  INSERT INTO public.online_orders (company_id, order_number, customer_email, customer_name, shipping_address_line1, shipping_city, shipping_postal_code, shipping_country, status, currency, subtotal, shipping_total, tax_total, total, payment_method, payment_reference, placed_at)
  VALUES (_co, 'WEB-2003', 'priya.patel@email.com', 'Priya Patel', '12 Camden High St', 'London', 'NW1 0JH', 'GB', 'paid', 'USD', 102, 19.99, 6.16, 128.15, 'card', 'pi_3OqzCD', now() - interval '2 days') RETURNING id INTO _oo3;
  INSERT INTO public.online_order_lines (order_id, product_id, position, product_name, quantity, unit_price, line_total) VALUES
    (_oo3, _p_tshirt, 0, 'Branded T-Shirt', 2, 24, 48),
    (_oo3, _p_cap, 1, 'Branded Cap', 2, 19, 38),
    (_oo3, _p_cable, 2, 'USB-C Cable 2m', 1, 12, 12),
    (_oo3, _p_cable, 3, 'USB-C Cable 2m extra', 1, 12, 4);

  INSERT INTO public.online_orders (company_id, order_number, customer_email, customer_name, shipping_address_line1, shipping_city, shipping_postal_code, shipping_country, status, currency, subtotal, shipping_total, tax_total, total, payment_method, placed_at)
  VALUES (_co, 'WEB-2004', 'tom.becker@email.com', 'Tom Becker', 'Friedrichstraße 90', 'Berlin', '10117', 'DE', 'pending', 'USD', 199, 24.99, 15.92, 239.91, 'card', now() - interval '4 hours') RETURNING id INTO _oo4;
  INSERT INTO public.online_order_lines (order_id, product_id, position, product_name, quantity, unit_price, line_total) VALUES
    (_oo4, _p_dock, 0, 'USB-C Docking Station', 1, 199, 199);

  INSERT INTO public.online_orders (company_id, order_number, customer_email, customer_name, shipping_address_line1, shipping_city, shipping_postal_code, shipping_country, status, currency, subtotal, shipping_total, tax_total, total, payment_method, payment_reference, placed_at)
  VALUES (_co, 'WEB-2005', 'emma.wilson@email.com', 'Emma Wilson', '77 Elm Street', 'Brooklyn', '11201', 'US', 'fulfilled', 'USD', 88, 9.99, 4.40, 102.39, 'card', 'pi_3OrAEF', now() - interval '12 days') RETURNING id INTO _oo5;
  INSERT INTO public.online_order_lines (order_id, product_id, position, product_name, quantity, unit_price, line_total) VALUES
    (_oo5, _p_hoodie, 0, 'Branded Hoodie', 1, 59, 59),
    (_oo5, _p_cap, 1, 'Branded Cap', 1, 19, 19),
    (_oo5, _p_cable, 2, 'USB-C Cable 2m', 1, 12, 12);

  INSERT INTO public.online_orders (company_id, order_number, customer_email, customer_name, shipping_address_line1, shipping_city, shipping_postal_code, shipping_country, status, currency, subtotal, shipping_total, tax_total, total, payment_method, payment_reference, placed_at)
  VALUES (_co, 'WEB-2006', 'jordan.kim@email.com', 'Jordan Kim', '31 Pine Rd', 'Seattle', '98101', 'US', 'cancelled', 'USD', 389, 14.99, 23.34, 427.33, 'card', 'pi_3OrBGH', now() - interval '9 days') RETURNING id INTO _oo6;
  INSERT INTO public.online_order_lines (order_id, product_id, position, product_name, quantity, unit_price, line_total) VALUES
    (_oo6, _p_chair, 0, 'Ergonomic Office Chair', 1, 389, 389);

  INSERT INTO public.online_orders (company_id, order_number, customer_email, customer_name, shipping_address_line1, shipping_city, shipping_postal_code, shipping_country, status, currency, subtotal, shipping_total, tax_total, total, payment_method, payment_reference, placed_at)
  VALUES (_co, 'WEB-2007', 'alex.rivera@email.com', 'Alex Rivera', '210 Sunset Blvd', 'Los Angeles', '90028', 'US', 'refunded', 'USD', 39, 6.99, 3.12, 49.11, 'card', 'pi_3OrCIJ', now() - interval '18 days') RETURNING id INTO _oo7;
  INSERT INTO public.online_order_lines (order_id, product_id, position, product_name, quantity, unit_price, line_total) VALUES
    (_oo7, _p_charger, 0, '65W GaN Charger', 1, 39, 39);
END $$;
