DO $$
DECLARE
  c RECORD;
  v_branch_id uuid;
  v_warehouse_id uuid;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    UPDATE public.company_settings
    SET pos_enabled = true,
        quick_expenses_enabled = true,
        cash_sessions_enabled = true,
        tax_reporting_enabled = true,
        refunds_enabled = true
    WHERE company_id = c.id;

    IF NOT EXISTS (SELECT 1 FROM public.branches WHERE company_id = c.id) THEN
      INSERT INTO public.branches (company_id, code, name, city, country, is_active)
      VALUES (c.id, 'MAIN', 'Main Store', 'Lisbon', 'PT', true)
      RETURNING id INTO v_branch_id;
    ELSE
      SELECT id INTO v_branch_id FROM public.branches WHERE company_id = c.id ORDER BY created_at LIMIT 1;
    END IF;

    SELECT id INTO v_warehouse_id FROM public.warehouses WHERE company_id = c.id ORDER BY created_at LIMIT 1;

    IF NOT EXISTS (SELECT 1 FROM public.pos_registers WHERE company_id = c.id) THEN
      INSERT INTO public.pos_registers (company_id, branch_id, code, name, default_warehouse_id, is_active)
      VALUES (c.id, v_branch_id, 'REG-1', 'Register 1', v_warehouse_id, true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.tax_rates WHERE company_id = c.id) THEN
      INSERT INTO public.tax_rates (company_id, name, rate, type, is_active, effective_from, is_default) VALUES
        (c.id, 'Standard 23%',      23.00, 'both', true, CURRENT_DATE, true),
        (c.id, 'Reduced 13%',       13.00, 'both', true, CURRENT_DATE, false),
        (c.id, 'Super-reduced 6%',   6.00, 'both', true, CURRENT_DATE, false),
        (c.id, 'Zero-rated 0%',      0.00, 'both', true, CURRENT_DATE, false),
        (c.id, 'Exempt',             0.00, 'both', true, CURRENT_DATE, false);
    END IF;
  END LOOP;
END $$;