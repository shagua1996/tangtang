# TangTang desktop implementation ledger

Baseline: 0a0a6a3 (current working business, including production columns and label changes).
Approved design: conversation plan dated 2026-11-16. Windows 7 SP1/10/11 x64; Electron 22.3.27; Vue 3, TypeScript, Vite, Element Plus; SQLite. A4 landscape; individual auto-size labels. 100k orders/1m lines. No unsaved-session restore or additional business modules.

## Tasks
- [x] Legacy requirements and formula characterization tests
- [x] SQLite repository, migration, worker and pagination
- [x] Vue desktop UI and print templates
- [x] Electron integration, packaging and current-host runtime verification
- [x] Performance measurements and independent review

Validation evidence: see verification.md. Physical printers, user production database, Windows7/10 machines and minimum-spec cold-cache runs remain external acceptance checks, not claimed completed here.

## Decisions
- Work in attached isolated worktree on codex/tangtang-desktop. Source checkout remains intact. No commits or pushes requested.
- Retain legacy src/ as auditable source, new application uses domain/, desktop/, ui/. This preserves original business locations and allows comparison.
- Native database tests run using Electron's Node ABI, not host Node 24. Build-time tools run on the host.
- Compatibility target is a test requirement, not a claim of Windows 7 validation on this host. Missing physical environments will be documented.
- Dependency baseline: Vue3.5.13, ElementPlus2.9.5, Vite6.2.6, TypeScript5.8.3. These fixed versions support the chosen rendering/runtime targets; lockfile rebuilt from public npm to remove obsolete private-registry URLs.
- Print stress ruling: replace one unbounded table with 16-row fixed-layout sheets after the 10000-line baseline exhausted renderer memory. This is a layout change only; independently extracted PDF row numbers remain exactly1..10000.
- Label paper stays printer-selected with size:auto and2mm margins, as requested. No guessed dimensions or automatic paper-size setting.
- UI/storage review fixes preserve original business: display-only doorDeriction fallback, immutable submitted settings snapshot, tab persistence on detail pagination, sales-only deletion and structural payload guards.
- Final current-host checks: npm test (20 TS tests plus native storage assertions), npm run test:e2e, npm run dist and node tests/packaged.cjs pass. Database and UI100k/1m benchmarks pass on current machine; full report in verification.md.

## Shared interfaces
window.tangtang methods return Promises and reject with displayable errors. listOrders({page,pageSize,search}) -> {items:[{orderId,createAt,orderForm,totalPrice,itemCount}],total,page,pageSize}; getOrderHeader(orderId) -> order without sizeList plus itemCount; listOrderItems({orderId,offset,limit})-> {items,total}; createOrder(order) -> orderId; saveOrderDetail({orderId,detailForm}); deleteOrder(orderId); saveCalculation(record); getSettings()-> setting; saveSettings(setting); nextOrderNumber({date,index})-> {no,index}; printOrder({orderId,kind:'sale'|'production'|'label',itemIndex?}); getStatus()-> {ready,needsMigration,error?}; selectLegacyDirectory(); initializeEmpty().
Domain exports DEFAULT_SETTING, DEFAULT_HOLE, DEFAULT_DETAIL, WALL_LABELS, DIRECTIONS, calculate(hole,settings,now?), sumLines(lines), formatMoney(value), formatDate(value,pattern?), makeOrder(form,lines,now?), clone(value). Old field spellings retained.
