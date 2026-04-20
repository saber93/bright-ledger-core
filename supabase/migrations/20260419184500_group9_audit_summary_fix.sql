-- ============================================================================
-- GROUP 9: AUDIT SUMMARY FORMAT FIX
-- ============================================================================

CREATE OR REPLACE FUNCTION public.finance_audit_summary(
  _table_name text,
  _action text,
  _before jsonb,
  _after jsonb
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  _row jsonb := COALESCE(_after, _before);
  _direction text;
  _amount numeric := COALESCE(NULLIF(_row->>'amount', '')::numeric, 0);
  _total numeric := COALESCE(NULLIF(_row->>'total', '')::numeric, 0);
  _number text := COALESCE(
    _row->>'invoice_number',
    _row->>'bill_number',
    _row->>'credit_note_number',
    _row->>'expense_number',
    _row->>'order_number',
    _row->>'reference'
  );
BEGIN
  CASE _table_name
    WHEN 'customer_invoices' THEN
      RETURN format(
        '%s invoice %s for %s.',
        initcap(_action),
        COALESCE(_number, '—'),
        to_char(_total, 'FM999999999999990.00')
      );
    WHEN 'supplier_bills' THEN
      RETURN format(
        '%s bill %s for %s.',
        initcap(_action),
        COALESCE(_number, '—'),
        to_char(_total, 'FM999999999999990.00')
      );
    WHEN 'payments' THEN
      _direction := CASE WHEN COALESCE(_row->>'direction', 'in') = 'out' THEN 'outflow' ELSE 'receipt' END;
      RETURN format(
        '%s payment %s of %s.',
        initcap(_action),
        _direction,
        to_char(_amount, 'FM999999999999990.00')
      );
    WHEN 'credit_notes' THEN
      RETURN format(
        '%s credit note %s for %s.',
        initcap(_action),
        COALESCE(_number, '—'),
        to_char(_total, 'FM999999999999990.00')
      );
    WHEN 'cash_refunds' THEN
      RETURN format(
        '%s cash refund of %s via %s.',
        initcap(_action),
        to_char(_amount, 'FM999999999999990.00'),
        COALESCE(_row->>'method', 'unknown')
      );
    WHEN 'quick_expenses' THEN
      RETURN format(
        '%s quick expense %s for %s.',
        initcap(_action),
        COALESCE(_number, '—'),
        to_char(_amount, 'FM999999999999990.00')
      );
    WHEN 'cash_sessions' THEN
      RETURN format('%s cash session %s.', initcap(_action), COALESCE(_row->>'status', 'state'));
    WHEN 'cash_session_events' THEN
      RETURN format(
        '%s cash-session event %s for %s.',
        initcap(_action),
        COALESCE(_row->>'type', 'event'),
        to_char(_amount, 'FM999999999999990.00')
      );
    WHEN 'credit_note_allocations' THEN
      RETURN format(
        '%s credit allocation %s for %s.',
        initcap(_action),
        COALESCE(_row->>'target_type', 'target'),
        to_char(_amount, 'FM999999999999990.00')
      );
    WHEN 'company_settings' THEN
      RETURN format('%s company finance settings.', initcap(_action));
    WHEN 'accounting_periods' THEN
      RETURN format(
        '%s accounting period %s.',
        initcap(_action),
        to_char(COALESCE((_row->>'period_start')::date, CURRENT_DATE), 'Mon YYYY')
      );
    WHEN 'pos_order_lines' THEN
      RETURN format(
        'POS price override on %s to %s.',
        COALESCE(_row->>'description', 'line'),
        to_char(COALESCE(NULLIF(_row->>'unit_price', '')::numeric, 0), 'FM999999999999990.00')
      );
    ELSE
      RETURN format('%s %s.', initcap(_action), replace(_table_name, '_', ' '));
  END CASE;
END;
$$;
