
## Plan: ERP/Accounting SaaS — Foundation v1

Given the massive scope (a real Odoo competitor is years of work), this v1 establishes the foundation and ships the **Accounting core + module-flag architecture** done at premium quality. Subsequent iterations layer on Inventory, Sales, Online Store, and Reports.

### Scope of v1 (what ships)

**Foundation**
- Auth (Supabase): email/password signup → auto-create company → user becomes Owner
- Multi-tenant architecture: `companies`, `company_members`, `user_roles` table with RLS isolation by `company_id`
- Roles: Owner, Accountant, Sales Manager, Inventory Manager, Store Manager, Staff
- App shell: collapsible left sidebar (grouped sections), top bar with company switcher, search, notifications, user menu
- Light/dark mode toggle, i18n structure (English content, RTL-ready CSS, Arabic added later)
- Module feature flags read from `company_settings`; sidebar + actions adapt

**Working modules (real Supabase + RLS + CRUD)**
1. **Dashboard** — executive widgets: revenue, expenses, net profit, receivables, payables, cash, unpaid invoices/bills, recent activity, quick actions
2. **Customers** — list + detail with tabs (Overview, Invoices, Payments, Activity)
3. **Suppliers** — list + detail with tabs (Overview, Bills, Payments, Activity)
4. **Customer Invoices** — list (filters, saved views, bulk actions) + detail (header, line items, related payments, activity timeline, audit trail) + create/edit drawer
5. **Supplier Bills** — same pattern as invoices
6. **Payments** — list + detail; manual/bank transfer flows; webhook event log table (UI ready, edge function stubbed)
7. **Chart of Accounts** — tree view, account types, balances
8. **Company Settings → Modules & Features** — toggles for Inventory, Stock Tracking, Online Store, Online Payments. UI across app adapts immediately.
9. **Settings → Users & Roles** — invite, assign role, deactivate

**Stubbed modules (sidebar entries with polished "coming soon" / empty states explaining what's coming)**
- Sales Orders, Products & Inventory, Online Store, Reports (overview only with placeholder cards), Reconciliation, Journals/Journal Entries

### Backend depth

- Full Supabase schema for: `companies`, `company_members`, `user_roles`, `app_role` enum, `customers`, `suppliers`, `chart_of_accounts`, `customer_invoices`, `invoice_lines`, `supplier_bills`, `bill_lines`, `payments`, `payment_transactions`, `audit_logs`, `company_settings`
- RLS on every table scoped to user's `company_id` via `has_company_access()` security-definer function
- `has_role()` security-definer function for role checks
- Basic CRUD wired through React Query
- Posting logic (invoice → journal entry), reconciliation, payment webhooks: schema + edge function scaffolds, marked as "phase 2"

### Design system

- Premium B2B admin: neutral slate palette, single strong accent (deep indigo) for primary actions, semantic colors for status (green/amber/red/blue chips)
- Inter for UI, JetBrains Mono for numbers/IDs
- Dense data tables with sticky headers, sticky summary footer, column visibility, sort, filter chips, saved views
- Right-side drawers for quick create/edit; full-page detail views with tabbed content
- Activity timeline component (reusable across all documents)
- Status badge component, currency formatter, breadcrumbs, empty states with CTAs
- Subtle depth (1px borders + soft shadows), no gradients, no decoration

### Reusable component library built in v1

`DataTable`, `FilterBar`, `SavedViews`, `StatusBadge`, `MoneyDisplay`, `ActivityTimeline`, `DocumentHeader`, `DetailTabs`, `RecordDrawer`, `EmptyState`, `MetricCard`, `BulkActionBar`, `AuditTrail`, `RelatedDocs`, `ModuleGate` (hides UI when feature flag off)

### Folder structure

```
src/
  routes/                    (TanStack Start file-based)
    _authenticated/          (auth-guarded layout)
      dashboard.tsx
      customers/, suppliers/, invoices/, bills/, payments/
      accounting/coa.tsx
      settings/company.tsx, modules.tsx, users.tsx
    login.tsx, signup.tsx
  features/                  (feature-based modules)
    accounting/, customers/, suppliers/, invoices/, bills/, payments/, settings/
      components/, hooks/, api/, types.ts
  components/
    shell/ (Sidebar, Topbar, CompanySwitcher)
    data/ (DataTable, FilterBar, ...)
    ui/ (shadcn)
  lib/ (auth, rls helpers, formatters, i18n)
  integrations/supabase/
```

### What's explicitly NOT in v1 (acknowledged, planned for later)

Inventory CRUD, Sales Orders flow, Online Store storefront, real reconciliation engine, financial report generation, payment gateway webhook processing, Arabic translations, Super Admin panel. All have UI placeholders so the product feels complete and the roadmap is visible.

### Realistic mock data seeded

5 customers, 5 suppliers, ~15 invoices in mixed statuses, ~10 bills, payments, full chart of accounts (assets/liabilities/equity/income/expenses) — so every screen looks alive in demos.

### Important caveat

Even this scoped v1 is large. Expect the first build to land the foundation, schema, shell, and 2–3 modules deeply polished, with the rest at functional-but-rough quality. We'll iterate to bring every screen to premium standard.
