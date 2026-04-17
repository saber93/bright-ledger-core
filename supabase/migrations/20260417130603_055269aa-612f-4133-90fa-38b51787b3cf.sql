DO $$
DECLARE
  _company uuid := '22b81ebf-3cef-4340-8559-8621e5def506';
  _today date := CURRENT_DATE;
  _sales uuid; _exp1 uuid; _exp2 uuid; _exp3 uuid; _exp4 uuid;
  _inv_prefix text; _bill_prefix text;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid;
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid;
  _inv uuid; _bill uuid;
  _sub numeric; _tax numeric; _tot numeric; _paid numeric;
BEGIN
  -- Wipe prior data for this company (idempotent re-seed)
  DELETE FROM payments WHERE company_id = _company;
  DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM customer_invoices WHERE company_id = _company);
  DELETE FROM bill_lines WHERE bill_id IN (SELECT id FROM supplier_bills WHERE company_id = _company);
  DELETE FROM customer_invoices WHERE company_id = _company;
  DELETE FROM supplier_bills WHERE company_id = _company;
  DELETE FROM customers WHERE company_id = _company;
  DELETE FROM suppliers WHERE company_id = _company;

  SELECT id INTO _sales FROM chart_of_accounts WHERE company_id=_company AND code='4100';
  SELECT id INTO _exp1 FROM chart_of_accounts WHERE company_id=_company AND code='5100';
  SELECT id INTO _exp2 FROM chart_of_accounts WHERE company_id=_company AND code='5300';
  SELECT id INTO _exp3 FROM chart_of_accounts WHERE company_id=_company AND code='5400';
  SELECT id INTO _exp4 FROM chart_of_accounts WHERE company_id=_company AND code='5500';
  SELECT invoice_prefix, bill_prefix INTO _inv_prefix, _bill_prefix FROM company_settings WHERE company_id=_company;

  -- Customers
  INSERT INTO customers (company_id,name,email,phone,city,country,currency,tax_id) VALUES
    (_company,'Northwind Traders','ap@northwind.com','+1-415-555-0101','San Francisco','US','USD','US-NW-882') RETURNING id INTO c1;
  INSERT INTO customers (company_id,name,email,phone,city,country,currency,tax_id) VALUES
    (_company,'Acme Corporation','billing@acme.com','+1-212-555-0142','New York','US','USD','US-AC-441') RETURNING id INTO c2;
  INSERT INTO customers (company_id,name,email,phone,city,country,currency,tax_id) VALUES
    (_company,'Globex Industries','finance@globex.io','+44-20-7946-0958','London','GB','USD','GB-GX-339') RETURNING id INTO c3;
  INSERT INTO customers (company_id,name,email,phone,city,country,currency,tax_id) VALUES
    (_company,'Initech Solutions','accounts@initech.com','+1-512-555-0177','Austin','US','USD','US-IN-220') RETURNING id INTO c4;
  INSERT INTO customers (company_id,name,email,phone,city,country,currency,tax_id) VALUES
    (_company,'Umbrella Holdings','pay@umbrella.co','+49-30-555-0188','Berlin','DE','USD','DE-UM-115') RETURNING id INTO c5;

  -- Suppliers
  INSERT INTO suppliers (company_id,name,email,phone,city,country,currency,tax_id) VALUES
    (_company,'Pacific Components Co.','sales@paccomp.com','+1-510-555-0210','Oakland','US','USD','US-PC-771') RETURNING id INTO s1;
  INSERT INTO suppliers (company_id,name,email,phone,city,country,currency,tax_id) VALUES
    (_company,'Stellar Logistics Ltd','ops@stellarlog.com','+1-718-555-0233','Brooklyn','US','USD','US-SL-552') RETURNING id INTO s2;
  INSERT INTO suppliers (company_id,name,email,phone,city,country,currency,tax_id) VALUES
    (_company,'Kowalski Print House','hello@kowalskiprint.de','+49-89-555-0244','Munich','DE','USD','DE-KP-118') RETURNING id INTO s3;
  INSERT INTO suppliers (company_id,name,email,phone,city,country,currency,tax_id) VALUES
    (_company,'BlueOak Office Supply','orders@blueoak.com','+1-303-555-0255','Denver','US','USD','US-BO-663') RETURNING id INTO s4;
  INSERT INTO suppliers (company_id,name,email,phone,city,country,currency,tax_id) VALUES
    (_company,'Helios Cloud Services','billing@helioscloud.io','+1-206-555-0266','Seattle','US','USD','US-HC-994') RETURNING id INTO s5;

  ----- INVOICES (15) -----

  -- 1. Northwind — paid, simple consulting
  _sub := 20*850; _tax := 0; _tot := _sub + _tax; _paid := _tot;
  INSERT INTO customer_invoices (company_id,customer_id,invoice_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,c1,_inv_prefix||'1001',_today-90,_today-60,'paid',_sub,_tax,_tot,_paid) RETURNING id INTO _inv;
  INSERT INTO invoice_lines (invoice_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_inv,0,'Consulting — Q1 strategy',20,850,0,17000,_sales);
  INSERT INTO payments (company_id,direction,party_type,party_id,invoice_id,amount,currency,method,status,reference,paid_at)
  VALUES (_company,'in','customer',c1,_inv,_paid,'USD','bank_transfer','completed','WIRE-1001',(_today-76)::timestamptz);

  -- 2. Northwind — paid, split into two payments
  _sub := 12500; _tax := round(_sub*0.08,2); _tot := _sub+_tax; _paid := _tot;
  INSERT INTO customer_invoices (company_id,customer_id,invoice_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,c1,_inv_prefix||'1002',_today-55,_today-25,'paid',_sub,_tax,_tot,_paid) RETURNING id INTO _inv;
  INSERT INTO invoice_lines (invoice_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_inv,0,'Implementation services',1,12500,0.08,_tot,_sales);
  INSERT INTO payments (company_id,direction,party_type,party_id,invoice_id,amount,currency,method,status,reference,paid_at) VALUES
    (_company,'in','customer',c1,_inv,round(_paid*0.6,2),'USD','bank_transfer','completed','WIRE-1002A',(_today-41)::timestamptz),
    (_company,'in','customer',c1,_inv,_paid-round(_paid*0.6,2),'USD','card','completed','CARD-1002B',(_today-33)::timestamptz);

  -- 3. Acme — paid, big license
  _sub := 24000; _tax := round(_sub*0.07,2); _tot := _sub+_tax; _paid := _tot;
  INSERT INTO customer_invoices (company_id,customer_id,invoice_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,c2,_inv_prefix||'1003',_today-75,_today-45,'paid',_sub,_tax,_tot,_paid) RETURNING id INTO _inv;
  INSERT INTO invoice_lines (invoice_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_inv,0,'Annual platform license',1,24000,0.07,_tot,_sales);
  INSERT INTO payments (company_id,direction,party_type,party_id,invoice_id,amount,currency,method,status,reference,paid_at)
  VALUES (_company,'in','customer',c2,_inv,_paid,'USD','online_gateway','completed','GW-1003',(_today-58)::timestamptz);

  -- 4. Acme — partial
  _sub := 3*1800 + 450; _tax := round(3*1800*0.07,2); _tot := _sub+_tax; _paid := round(_tot*0.45,2);
  INSERT INTO customer_invoices (company_id,customer_id,invoice_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,c2,_inv_prefix||'1004',_today-40,_today-10,'partial',_sub,_tax,_tot,_paid) RETURNING id INTO _inv;
  INSERT INTO invoice_lines (invoice_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_inv,0,'Onboarding workshop',3,1800,0.07,round(3*1800*1.07,2),_sales),
    (_inv,1,'Training materials',1,450,0,450,_sales);
  INSERT INTO payments (company_id,direction,party_type,party_id,invoice_id,amount,currency,method,status,reference,paid_at)
  VALUES (_company,'in','customer',c2,_inv,_paid,'USD','bank_transfer','completed','RCPT-1004',(_today-28)::timestamptz);

  -- 5. Globex — paid
  _sub := 4900; _tax := 0; _tot := _sub+_tax; _paid := _tot;
  INSERT INTO customer_invoices (company_id,customer_id,invoice_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,c3,_inv_prefix||'1005',_today-35,_today-5,'paid',_sub,_tax,_tot,_paid) RETURNING id INTO _inv;
  INSERT INTO invoice_lines (invoice_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_inv,0,'SaaS subscription — March',1,4900,0,4900,_sales);
  INSERT INTO payments (company_id,direction,party_type,party_id,invoice_id,amount,currency,method,status,reference,paid_at)
  VALUES (_company,'in','customer',c3,_inv,_paid,'USD','online_gateway','completed','GW-1005',(_today-22)::timestamptz);

  -- 6. Globex — sent (not paid)
  _sub := 4900+1200; _tax := 0; _tot := _sub+_tax;
  INSERT INTO customer_invoices (company_id,customer_id,invoice_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,c3,_inv_prefix||'1006',_today-8,_today+22,'sent',_sub,_tax,_tot,0) RETURNING id INTO _inv;
  INSERT INTO invoice_lines (invoice_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_inv,0,'SaaS subscription — April',1,4900,0,4900,_sales),
    (_inv,1,'Premium support add-on',1,1200,0,1200,_sales);

  -- 7. Initech — overdue
  _sub := 40*220; _tax := round(_sub*0.06,2); _tot := _sub+_tax;
  INSERT INTO customer_invoices (company_id,customer_id,invoice_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,c4,_inv_prefix||'1007',_today-45,_today-15,'overdue',_sub,_tax,_tot,0) RETURNING id INTO _inv;
  INSERT INTO invoice_lines (invoice_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_inv,0,'Custom integration build',40,220,0.06,_tot,_sales);

  -- 8. Initech — partial
  _sub := 6800; _tax := round(_sub*0.06,2); _tot := _sub+_tax; _paid := round(_tot*0.5,2);
  INSERT INTO customer_invoices (company_id,customer_id,invoice_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,c4,_inv_prefix||'1008',_today-22,_today+8,'partial',_sub,_tax,_tot,_paid) RETURNING id INTO _inv;
  INSERT INTO invoice_lines (invoice_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_inv,0,'Hosting — Q2',1,6800,0.06,_tot,_sales);
  INSERT INTO payments (company_id,direction,party_type,party_id,invoice_id,amount,currency,method,status,reference,paid_at)
  VALUES (_company,'in','customer',c4,_inv,_paid,'USD','bank_transfer','completed','RCPT-1008',(_today-12)::timestamptz);

  -- 9. Initech — sent
  _sub := 10*320; _tax := 0; _tot := _sub+_tax;
  INSERT INTO customer_invoices (company_id,customer_id,invoice_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,c4,_inv_prefix||'1009',_today-3,_today+27,'sent',_sub,_tax,_tot,0) RETURNING id INTO _inv;
  INSERT INTO invoice_lines (invoice_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_inv,0,'Advisory retainer — April',10,320,0,3200,_sales);

  -- 10. Umbrella — paid
  _sub := 9500; _tax := 0; _tot := _sub+_tax; _paid := _tot;
  INSERT INTO customer_invoices (company_id,customer_id,invoice_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,c5,_inv_prefix||'1010',_today-120,_today-90,'paid',_sub,_tax,_tot,_paid) RETURNING id INTO _inv;
  INSERT INTO invoice_lines (invoice_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_inv,0,'Initial assessment',1,9500,0,9500,_sales);
  INSERT INTO payments (company_id,direction,party_type,party_id,invoice_id,amount,currency,method,status,reference,paid_at)
  VALUES (_company,'in','customer',c5,_inv,_paid,'USD','bank_transfer','completed','WIRE-1010',(_today-104)::timestamptz);

  -- 11. Umbrella — paid
  _sub := 18750; _tax := round(_sub*0.05,2); _tot := _sub+_tax; _paid := _tot;
  INSERT INTO customer_invoices (company_id,customer_id,invoice_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,c5,_inv_prefix||'1011',_today-60,_today-30,'paid',_sub,_tax,_tot,_paid) RETURNING id INTO _inv;
  INSERT INTO invoice_lines (invoice_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_inv,0,'Migration services',1,18750,0.05,_tot,_sales);
  INSERT INTO payments (company_id,direction,party_type,party_id,invoice_id,amount,currency,method,status,reference,paid_at)
  VALUES (_company,'in','customer',c5,_inv,_paid,'USD','bank_transfer','completed','WIRE-1011',(_today-46)::timestamptz);

  -- 12. Umbrella — sent
  _sub := 7500; _tax := round(_sub*0.05,2); _tot := _sub+_tax;
  INSERT INTO customer_invoices (company_id,customer_id,invoice_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,c5,_inv_prefix||'1012',_today-5,_today+25,'sent',_sub,_tax,_tot,0) RETURNING id INTO _inv;
  INSERT INTO invoice_lines (invoice_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_inv,0,'Quarterly retainer',1,7500,0.05,_tot,_sales);

  -- 13. Northwind — draft
  _sub := 14400; _tax := 0; _tot := _sub+_tax;
  INSERT INTO customer_invoices (company_id,customer_id,invoice_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,c1,_inv_prefix||'1013',_today-1,_today+29,'draft',_sub,_tax,_tot,0) RETURNING id INTO _inv;
  INSERT INTO invoice_lines (invoice_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_inv,0,'Renewal — pending approval',1,14400,0,14400,_sales);

  -- 14. Acme — overdue
  _sub := 4*1899; _tax := round(_sub*0.07,2); _tot := _sub+_tax;
  INSERT INTO customer_invoices (company_id,customer_id,invoice_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,c2,_inv_prefix||'1014',_today-52,_today-22,'overdue',_sub,_tax,_tot,0) RETURNING id INTO _inv;
  INSERT INTO invoice_lines (invoice_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_inv,0,'Hardware procurement',4,1899,0.07,_tot,_sales);

  -- 15. Globex — cancelled
  _sub := 5000; _tax := 0; _tot := _sub+_tax;
  INSERT INTO customer_invoices (company_id,customer_id,invoice_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,c3,_inv_prefix||'1015',_today-18,_today+12,'cancelled',_sub,_tax,_tot,0) RETURNING id INTO _inv;
  INSERT INTO invoice_lines (invoice_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_inv,0,'Cancelled — pilot project',1,5000,0,5000,_sales);

  ----- BILLS (10) -----

  -- 1. Pacific — paid
  _sub := 500*1.85; _tax := round(_sub*0.08,2); _tot := _sub+_tax; _paid := _tot;
  INSERT INTO supplier_bills (company_id,supplier_id,bill_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,s1,_bill_prefix||'2001',_today-88,_today-58,'paid',_sub,_tax,_tot,_paid) RETURNING id INTO _bill;
  INSERT INTO bill_lines (bill_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_bill,0,'Capacitors and resistors batch',500,1.85,0.08,_tot,_exp1);
  INSERT INTO payments (company_id,direction,party_type,party_id,bill_id,amount,currency,method,status,reference,paid_at)
  VALUES (_company,'out','supplier',s1,_bill,_paid,'USD','bank_transfer','completed','PAY-2001',(_today-72)::timestamptz);

  -- 2. Pacific — paid
  _sub := 80*42; _tax := round(_sub*0.08,2); _tot := _sub+_tax; _paid := _tot;
  INSERT INTO supplier_bills (company_id,supplier_id,bill_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,s1,_bill_prefix||'2002',_today-45,_today-15,'paid',_sub,_tax,_tot,_paid) RETURNING id INTO _bill;
  INSERT INTO bill_lines (bill_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_bill,0,'PCB assemblies',80,42,0.08,_tot,_exp1);
  INSERT INTO payments (company_id,direction,party_type,party_id,bill_id,amount,currency,method,status,reference,paid_at)
  VALUES (_company,'out','supplier',s1,_bill,_paid,'USD','bank_transfer','completed','PAY-2002',(_today-30)::timestamptz);

  -- 3. Stellar — paid
  _sub := 3450; _tax := 0; _tot := _sub; _paid := _tot;
  INSERT INTO supplier_bills (company_id,supplier_id,bill_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,s2,_bill_prefix||'2003',_today-60,_today-30,'paid',_sub,_tax,_tot,_paid) RETURNING id INTO _bill;
  INSERT INTO bill_lines (bill_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_bill,0,'Freight — international',1,3450,0,3450,_exp2);
  INSERT INTO payments (company_id,direction,party_type,party_id,bill_id,amount,currency,method,status,reference,paid_at)
  VALUES (_company,'out','supplier',s2,_bill,_paid,'USD','bank_transfer','completed','PAY-2003',(_today-44)::timestamptz);

  -- 4. Stellar — partial
  _sub := 220*14.5; _tax := 0; _tot := _sub; _paid := round(_tot*0.4,2);
  INSERT INTO supplier_bills (company_id,supplier_id,bill_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,s2,_bill_prefix||'2004',_today-25,_today+5,'partial',_sub,_tax,_tot,_paid) RETURNING id INTO _bill;
  INSERT INTO bill_lines (bill_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_bill,0,'Last-mile deliveries — March',220,14.5,0,_tot,_exp2);
  INSERT INTO payments (company_id,direction,party_type,party_id,bill_id,amount,currency,method,status,reference,paid_at)
  VALUES (_company,'out','supplier',s2,_bill,_paid,'USD','check','completed','CHK-2004',(_today-15)::timestamptz);

  -- 5. Kowalski — received
  _sub := 1875; _tax := round(_sub*0.07,2); _tot := _sub+_tax;
  INSERT INTO supplier_bills (company_id,supplier_id,bill_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,s3,_bill_prefix||'2005',_today-10,_today+20,'received',_sub,_tax,_tot,0) RETURNING id INTO _bill;
  INSERT INTO bill_lines (bill_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_bill,0,'Marketing brochures (2,000 ct)',1,1875,0.07,_tot,_exp4);

  -- 6. BlueOak — paid
  _sub := 6*489; _tax := round(_sub*0.06,2); _tot := _sub+_tax; _paid := _tot;
  INSERT INTO supplier_bills (company_id,supplier_id,bill_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,s4,_bill_prefix||'2006',_today-50,_today-20,'paid',_sub,_tax,_tot,_paid) RETURNING id INTO _bill;
  INSERT INTO bill_lines (bill_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_bill,0,'Office furniture',6,489,0.06,_tot,_exp4);
  INSERT INTO payments (company_id,direction,party_type,party_id,bill_id,amount,currency,method,status,reference,paid_at)
  VALUES (_company,'out','supplier',s4,_bill,_paid,'USD','card','completed','CARD-2006',(_today-37)::timestamptz);

  -- 7. BlueOak — overdue
  _sub := 612.45; _tax := round(_sub*0.06,2); _tot := _sub+_tax;
  INSERT INTO supplier_bills (company_id,supplier_id,bill_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,s4,_bill_prefix||'2007',_today-55,_today-25,'overdue',_sub,_tax,_tot,0) RETURNING id INTO _bill;
  INSERT INTO bill_lines (bill_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_bill,0,'Stationery & supplies',1,612.45,0.06,_tot,_exp4);

  -- 8. Helios — paid
  _sub := 4280; _tax := 0; _tot := _sub; _paid := _tot;
  INSERT INTO supplier_bills (company_id,supplier_id,bill_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,s5,_bill_prefix||'2008',_today-30,_today,'paid',_sub,_tax,_tot,_paid) RETURNING id INTO _bill;
  INSERT INTO bill_lines (bill_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_bill,0,'Cloud compute — March',1,4280,0,4280,_exp3);
  INSERT INTO payments (company_id,direction,party_type,party_id,bill_id,amount,currency,method,status,reference,paid_at)
  VALUES (_company,'out','supplier',s5,_bill,_paid,'USD','bank_transfer','completed','PAY-2008',(_today-16)::timestamptz);

  -- 9. Helios — received
  _sub := 4310; _tax := 0; _tot := _sub;
  INSERT INTO supplier_bills (company_id,supplier_id,bill_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,s5,_bill_prefix||'2009',_today-2,_today+28,'received',_sub,_tax,_tot,0) RETURNING id INTO _bill;
  INSERT INTO bill_lines (bill_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_bill,0,'Cloud compute — April',1,4310,0,4310,_exp3);

  -- 10. Kowalski — draft
  _sub := 980; _tax := 0; _tot := _sub;
  INSERT INTO supplier_bills (company_id,supplier_id,bill_number,issue_date,due_date,status,subtotal,tax_total,total,amount_paid)
  VALUES (_company,s3,_bill_prefix||'2010',_today-1,_today+29,'draft',_sub,_tax,_tot,0) RETURNING id INTO _bill;
  INSERT INTO bill_lines (bill_id,position,description,quantity,unit_price,tax_rate,line_total,account_id) VALUES
    (_bill,0,'Trade show banners — pending',1,980,0,980,_exp4);
END $$;