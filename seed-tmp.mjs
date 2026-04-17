import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY_ID = '22b81ebf-3cef-4340-8559-8621e5def506';
const sb = createClient(url, key, { auth: { persistSession: false } });

const today = new Date();
const d = (offsetDays) => {
  const x = new Date(today);
  x.setDate(x.getDate() + offsetDays);
  return x.toISOString().slice(0, 10);
};
const dt = (offsetDays) => {
  const x = new Date(today);
  x.setDate(x.getDate() + offsetDays);
  return x.toISOString();
};
const rand = (n) => Math.floor(Math.random() * n);

async function main() {
  // Wipe any prior seed for this company (idempotent)
  await sb.from('payments').delete().eq('company_id', COMPANY_ID);
  await sb.from('invoice_lines').delete().in('invoice_id',
    (await sb.from('customer_invoices').select('id').eq('company_id', COMPANY_ID)).data?.map(r => r.id) ?? ['00000000-0000-0000-0000-000000000000']);
  await sb.from('bill_lines').delete().in('bill_id',
    (await sb.from('supplier_bills').select('id').eq('company_id', COMPANY_ID)).data?.map(r => r.id) ?? ['00000000-0000-0000-0000-000000000000']);
  await sb.from('customer_invoices').delete().eq('company_id', COMPANY_ID);
  await sb.from('supplier_bills').delete().eq('company_id', COMPANY_ID);
  await sb.from('customers').delete().eq('company_id', COMPANY_ID);
  await sb.from('suppliers').delete().eq('company_id', COMPANY_ID);

  // Accounts
  const { data: accs } = await sb.from('chart_of_accounts').select('id, code').eq('company_id', COMPANY_ID);
  const accBy = Object.fromEntries(accs.map(a => [a.code, a.id]));
  const salesAcc = accBy['4100'];
  const expenseAccs = ['5100', '5300', '5400', '5500'].map(c => accBy[c]);

  // Customers
  const customersInput = [
    ['Northwind Traders', 'ap@northwind.com', '+1-415-555-0101', 'San Francisco', 'US'],
    ['Acme Corporation', 'billing@acme.com', '+1-212-555-0142', 'New York', 'US'],
    ['Globex Industries', 'finance@globex.io', '+44-20-7946-0958', 'London', 'GB'],
    ['Initech Solutions', 'accounts@initech.com', '+1-512-555-0177', 'Austin', 'US'],
    ['Umbrella Holdings', 'pay@umbrella.co', '+49-30-555-0188', 'Berlin', 'DE'],
  ].map(([name, email, phone, city, country]) => ({
    company_id: COMPANY_ID, name, email, phone, city, country, currency: 'USD',
  }));
  const { data: customers, error: cErr } = await sb.from('customers').insert(customersInput).select('id, name');
  if (cErr) throw cErr;

  // Suppliers
  const suppliersInput = [
    ['Pacific Components Co.', 'sales@paccomp.com', '+1-510-555-0210', 'Oakland', 'US'],
    ['Stellar Logistics Ltd', 'ops@stellarlog.com', '+1-718-555-0233', 'Brooklyn', 'US'],
    ['Kowalski Print House', 'hello@kowalskiprint.de', '+49-89-555-0244', 'Munich', 'DE'],
    ['BlueOak Office Supply', 'orders@blueoak.com', '+1-303-555-0255', 'Denver', 'US'],
    ['Helios Cloud Services', 'billing@helioscloud.io', '+1-206-555-0266', 'Seattle', 'US'],
  ].map(([name, email, phone, city, country]) => ({
    company_id: COMPANY_ID, name, email, phone, city, country, currency: 'USD',
  }));
  const { data: suppliers, error: sErr } = await sb.from('suppliers').insert(suppliersInput).select('id, name');
  if (sErr) throw sErr;

  // Invoices — 15 mixed
  // status order: draft, sent, partial, paid, overdue, cancelled
  const invoicePlan = [
    // [customerIdx, statusOverride, issueOffset, dueOffset, lines]
    [0, 'paid', -90, -60, [['Consulting — Q1 strategy', 20, 850, 0]]],
    [0, 'paid', -55, -25, [['Implementation services', 1, 12500, 0.08]]],
    [1, 'paid', -75, -45, [['Annual platform license', 1, 24000, 0.07]]],
    [1, 'partial', -40, -10, [['Onboarding workshop', 3, 1800, 0.07], ['Training materials', 1, 450, 0]]],
    [2, 'paid', -35, -5, [['SaaS subscription — March', 1, 4900, 0]]],
    [2, 'sent', -8, 22, [['SaaS subscription — April', 1, 4900, 0], ['Premium support add-on', 1, 1200, 0]]],
    [3, 'overdue', -45, -15, [['Custom integration build', 40, 220, 0.06]]],
    [3, 'partial', -22, 8, [['Hosting — Q2', 1, 6800, 0.06]]],
    [3, 'sent', -3, 27, [['Advisory retainer — April', 10, 320, 0]]],
    [4, 'paid', -120, -90, [['Initial assessment', 1, 9500, 0]]],
    [4, 'paid', -60, -30, [['Migration services', 1, 18750, 0.05]]],
    [4, 'sent', -5, 25, [['Quarterly retainer', 1, 7500, 0.05]]],
    [0, 'draft', -1, 29, [['Renewal — pending approval', 1, 14400, 0]]],
    [1, 'overdue', -52, -22, [['Hardware procurement', 4, 1899, 0.07]]],
    [2, 'cancelled', -18, 12, [['Cancelled — pilot project', 1, 5000, 0]]],
  ];

  const settings = (await sb.from('company_settings').select('invoice_prefix, bill_prefix').eq('company_id', COMPANY_ID).single()).data;
  const invPrefix = settings?.invoice_prefix ?? 'INV-';
  const billPrefix = settings?.bill_prefix ?? 'BILL-';

  let invSeq = 1001;
  for (const [ci, status, issueOff, dueOff, lines] of invoicePlan) {
    const subtotal = lines.reduce((s, [, q, p]) => s + q * p, 0);
    const taxTotal = lines.reduce((s, [, q, p, t]) => s + q * p * t, 0);
    const total = +(subtotal + taxTotal).toFixed(2);
    let amountPaid = 0;
    if (status === 'paid') amountPaid = total;
    else if (status === 'partial') amountPaid = +(total * (0.3 + Math.random() * 0.4)).toFixed(2);

    const { data: inv, error } = await sb.from('customer_invoices').insert({
      company_id: COMPANY_ID,
      customer_id: customers[ci].id,
      invoice_number: `${invPrefix}${String(invSeq++).padStart(4, '0')}`,
      issue_date: d(issueOff),
      due_date: d(dueOff),
      status,
      currency: 'USD',
      subtotal: +subtotal.toFixed(2),
      tax_total: +taxTotal.toFixed(2),
      total,
      amount_paid: amountPaid,
    }).select('id, total, amount_paid, customer_id, currency, issue_date').single();
    if (error) throw error;

    const lineRows = lines.map(([desc, q, p, t], idx) => ({
      invoice_id: inv.id,
      position: idx,
      description: desc,
      quantity: q,
      unit_price: p,
      tax_rate: t,
      line_total: +(q * p * (1 + t)).toFixed(2),
      account_id: salesAcc,
    }));
    await sb.from('invoice_lines').insert(lineRows);

    // Payment(s) for paid/partial
    if (amountPaid > 0) {
      if (status === 'paid' && Math.random() < 0.3) {
        // split into 2 payments
        const first = +(amountPaid * 0.6).toFixed(2);
        const second = +(amountPaid - first).toFixed(2);
        await sb.from('payments').insert([
          {
            company_id: COMPANY_ID, direction: 'in', party_type: 'customer', party_id: inv.customer_id,
            invoice_id: inv.id, amount: first, currency: 'USD', method: 'bank_transfer',
            status: 'completed', reference: `WIRE-${invSeq}A`, paid_at: dt(issueOff + 14),
          },
          {
            company_id: COMPANY_ID, direction: 'in', party_type: 'customer', party_id: inv.customer_id,
            invoice_id: inv.id, amount: second, currency: 'USD', method: 'card',
            status: 'completed', reference: `CARD-${invSeq}B`, paid_at: dt(issueOff + 22),
          },
        ]);
      } else {
        await sb.from('payments').insert({
          company_id: COMPANY_ID, direction: 'in', party_type: 'customer', party_id: inv.customer_id,
          invoice_id: inv.id, amount: amountPaid, currency: 'USD',
          method: ['bank_transfer', 'card', 'online_gateway'][rand(3)],
          status: 'completed', reference: `RCPT-${invSeq}`, paid_at: dt(issueOff + 10 + rand(15)),
        });
      }
    }
  }

  // Bills — 10 mixed
  const billPlan = [
    [0, 'paid', -88, -58, [['Capacitors and resistors batch', 500, 1.85, 0.08]]],
    [0, 'paid', -45, -15, [['PCB assemblies', 80, 42, 0.08]]],
    [1, 'paid', -60, -30, [['Freight — international', 1, 3450, 0]]],
    [1, 'partial', -25, 5, [['Last-mile deliveries — March', 220, 14.5, 0]]],
    [2, 'received', -10, 20, [['Marketing brochures (2,000 ct)', 1, 1875, 0.07]]],
    [3, 'paid', -50, -20, [['Office furniture', 6, 489, 0.06]]],
    [3, 'overdue', -55, -25, [['Stationery & supplies', 1, 612.45, 0.06]]],
    [4, 'paid', -30, 0, [['Cloud compute — March', 1, 4280, 0]]],
    [4, 'received', -2, 28, [['Cloud compute — April', 1, 4310, 0]]],
    [2, 'draft', -1, 29, [['Trade show banners — pending', 1, 980, 0]]],
  ];

  let billSeq = 2001;
  for (const [si, status, issueOff, dueOff, lines] of billPlan) {
    const subtotal = lines.reduce((s, [, q, p]) => s + q * p, 0);
    const taxTotal = lines.reduce((s, [, q, p, t]) => s + q * p * t, 0);
    const total = +(subtotal + taxTotal).toFixed(2);
    let amountPaid = 0;
    if (status === 'paid') amountPaid = total;
    else if (status === 'partial') amountPaid = +(total * (0.3 + Math.random() * 0.4)).toFixed(2);

    const { data: bill, error } = await sb.from('supplier_bills').insert({
      company_id: COMPANY_ID,
      supplier_id: suppliers[si].id,
      bill_number: `${billPrefix}${String(billSeq++).padStart(4, '0')}`,
      issue_date: d(issueOff),
      due_date: d(dueOff),
      status,
      currency: 'USD',
      subtotal: +subtotal.toFixed(2),
      tax_total: +taxTotal.toFixed(2),
      total,
      amount_paid: amountPaid,
    }).select('id, supplier_id').single();
    if (error) throw error;

    const lineRows = lines.map(([desc, q, p, t], idx) => ({
      bill_id: bill.id,
      position: idx,
      description: desc,
      quantity: q,
      unit_price: p,
      tax_rate: t,
      line_total: +(q * p * (1 + t)).toFixed(2),
      account_id: expenseAccs[rand(expenseAccs.length)],
    }));
    await sb.from('bill_lines').insert(lineRows);

    if (amountPaid > 0) {
      await sb.from('payments').insert({
        company_id: COMPANY_ID, direction: 'out', party_type: 'supplier', party_id: bill.supplier_id,
        bill_id: bill.id, amount: amountPaid, currency: 'USD',
        method: ['bank_transfer', 'check', 'card'][rand(3)],
        status: 'completed', reference: `PAY-${billSeq}`, paid_at: dt(issueOff + 8 + rand(18)),
      });
    }
  }

  // Summary
  const counts = await Promise.all([
    sb.from('customers').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
    sb.from('suppliers').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
    sb.from('customer_invoices').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
    sb.from('supplier_bills').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
    sb.from('payments').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
  ]);
  console.log(JSON.stringify({
    customers: counts[0].count,
    suppliers: counts[1].count,
    invoices: counts[2].count,
    bills: counts[3].count,
    payments: counts[4].count,
  }, null, 2));
}

main().catch((e) => { console.error('SEED FAILED:', e); process.exit(1); });
