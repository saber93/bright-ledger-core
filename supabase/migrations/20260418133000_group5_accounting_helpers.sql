-- ============================================================================
-- GROUP 5: ACCOUNTING HELPERS
-- ============================================================================

DO $$
DECLARE
  company_row RECORD;
  liability_parent_id uuid;
BEGIN
  FOR company_row IN SELECT id FROM public.companies LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.chart_of_accounts
      WHERE company_id = company_row.id
        AND code = '2300'
    ) THEN
      SELECT id
      INTO liability_parent_id
      FROM public.chart_of_accounts
      WHERE company_id = company_row.id
        AND code = '2000'
      ORDER BY created_at
      LIMIT 1;

      INSERT INTO public.chart_of_accounts (
        company_id,
        code,
        name,
        type,
        parent_id,
        description
      )
      VALUES (
        company_row.id,
        '2300',
        'Customer Credits Payable',
        'liability',
        liability_parent_id,
        'Outstanding customer credit notes awaiting allocation or refund.'
      );
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.accounting_account_id(_company_id uuid, _code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.chart_of_accounts
  WHERE company_id = _company_id
    AND code = _code
  ORDER BY created_at
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.accounting_cash_account_id(_company_id uuid, _method text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(_method, '') IN ('cash', 'petty_cash') THEN public.accounting_account_id(_company_id, '1100')
    ELSE public.accounting_account_id(_company_id, '1200')
  END;
$$;
