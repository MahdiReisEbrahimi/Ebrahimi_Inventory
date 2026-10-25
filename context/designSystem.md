# Anbark UI system

The interface is a Persian RTL workspace for daily shop operations. Its visual
identity uses deep green navigation, quiet neutral surfaces, restrained warm
accents, Vazirmatn type, and consistent Lucide icons. The design is implemented
in the existing Vue application; no backend contract or database schema changed.

## Sources of truth

- `Frontend/src/styles/main.css`: theme tokens, typography, spacing patterns,
  forms, buttons, panels, tables, feedback, and responsive shared styles.
- `Frontend/src/App.vue`: desktop navigation, accessible Reka mobile drawer,
  topbar, low-stock popover, skip link, and page container.
- `Frontend/src/composables/useTheme.ts`: one reactive theme state shared by
  the shell and charts. Initialize before mounting the app.
- `Frontend/src/components/ui/`: shared primitives and page patterns.
- `Frontend/src/components/InvoicePaper.vue`: invoice snapshots and print CSS.

The UI uses local shadcn-style components and Reka primitives with semantic CSS.
There is no Tailwind build pipeline or complete generated shadcn-vue registry.
Use actual component props rather than assuming an external component API.

## Building another page

1. Wrap the page in `page-stack`.
2. Use `PageHeader` for the title, description, optional eyebrow, and action slot.
   Keep one clearly labeled primary task.
3. Group related content in `panel`, with `panel-heading` and `panel-body`.
4. Use `form-grid` and label-wrapped `form-field` controls. Mark optional fields,
   explain units, keep error text near the form, and disable repeated submission.
5. Reuse `Button`, `AppDialog`, `EmptyState`, and `StatCard`.
6. Distinguish loading, failed requests, empty data, and empty filtered results.
   Show a retry action for failed reads. Do not represent failures as zero totals.

Button variants: `default/primary`, `outline`, `ghost`, and `destructive`.
Sizes: `default`, `sm`, `lg`, and `icon`. The default button type is `button`;
explicitly use `type="submit"` inside forms.

AppDialog uses `open` / `update:open`, `title`, and optional `width`.
Reka handles focus containment, Escape, and focus restoration. Render form
content conditionally when it needs fresh state each time a dialog opens.

CustomTable accepts typed rows, columns, actions, optional loading/error states,
and named cell slots. Label icon actions in Persian. Product status changes and
destructive actions must remain explicit and discoverable.

## Theme and responsiveness

Use semantic CSS variables instead of repeating palette colors:
`--background`, `--foreground`, `--card`, `--primary`, `--muted-foreground`,
`--border`, `--destructive`, `--success`, and `--warning`.
The corresponding values live in `:root` and `:root.dark`.

The localStorage key is `theme`. Explicit light/dark choices override the
system preference; first visits use the system preference at initialization.
Charts subscribe to the same state. Print output always uses a paper palette.

- Desktop: sidebar, bounded main content, and columns where space permits.
- At 820px and below: a modal mobile navigation drawer replaces the sidebar.
- At 640px and below: form columns stack; product tables become labeled rows;
  action groups wrap and touch controls remain comfortably sized.
- Dense movement/invoice documents scroll within their own containers.
- Prefer logical CSS properties such as `padding-inline` for RTL positioning.
- Respect `prefers-reduced-motion` and retain visible keyboard focus.

## Workflow details

- Products: search/filter, status, details, create/edit, deletion, bulk pricing.
  The same product form works in a dialog and on its dedicated route.
- Inventory: separate purchase/return choices, invoice selection for returns,
  optional price changes, and a stock-after-receipt preview.
- Invoices: buyer, editable items, and summary/issue sections. Archive browsing
  is separate. Issued invoice snapshots and draft print previews use InvoicePaper.
- Dashboard: existing APIs supply statistics and recent activity. Values derived
  from the product list are bounded by its 10,000-record cap, which is disclosed.
- Reports: clearly marked unfinished, with links to available inventory/invoice views.

## Verification

Run `npm run build` and `npm run test:unit` from Frontend/. Lint without rewriting
files using `node node_modules/oxlint/bin/oxlint src` and
`node node_modules/eslint/bin/eslint.js src --no-fix`.

Before release, inspect every route at 390px, 768px, and desktop widths in both
themes. Check keyboard navigation and focus restoration, empty/error states,
product form create/edit, purchase/return validation, invoice drafts and archive,
unsaved-draft navigation warnings, and a multi-page print preview. Use disposable
test data for mutations.

Automated build/type/lint and unit checks do not replace those visual checks.
During the redesign, native browser automation was blocked because the tool
could not reliably identify the browser URL, so visual acceptance remains open.
