# Graph Report - .  (2026-08-01)

## Corpus Check
- 309 files · ~115,324 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1304 nodes · 2850 edges · 178 communities (73 shown, 105 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.85)
- Token cost: 224,505 input · 8,500 output

## Community Hubs (Navigation)
- App Shell & Error Boundaries
- Invoice Form
- Invoices List Page
- Patients & Payers Pages
- PDF Rich Text Blocks
- Anagrafica Mutation Actions
- Invoice Export Column Catalog
- E2E Test Fixtures & Login
- Audit Log Page
- PDF Editor Block Dragging
- TypeScript Compiler Config
- Protected Layout Shell
- Password Reset Form
- Fiscal Validation & Payer Schema
- Rate-Limited API Routes
- Account & Audit Filter Forms
- Account & Dashboard Pages
- shadcn/ui Component Registry Config
- Seed & Audit Retention Scripts
- Invoice Create Action & Validation
- Root Page & Auth Actions
- Login Rate Limiting
- User Management Form
- PDF Editor Block Panels
- Invoice PDF Rendering
- PDF Editor Toolbar
- PDF Editor Block Rendering
- PDF Layout Undo History
- shadcn Select/Dialog Primitives
- JWT Session Signing
- Dev Dependencies
- PDF Settings Actions
- npm Scripts
- API Route Auth Checker
- Auth & Prod Deploy Findings (JWT/TLS/DEP-01/02, SEC-01/02/03)
- Login Page & Theme Toggle
- Backup Service & Restore Verification
- Prisma Client Singleton
- Security Headers Config
- Users Admin Page
- Invoices Filter Bar
- UI/Auth Dependencies
- Patient Form & Schema
- PDF Editor Page Settings Panel
- Backup Shell Script
- Invoice Lifecycle Regression Test
- PDF Template Engine Rationale (Blocco/richContent bridge)
- Audit Log Retention Service
- Client IP Resolution
- Server Action Auth Regression Test
- Audit Log Coverage Regression Test
- Audit Log PII Regression Test
- Backup Integrity Regression Test
- CSP Nonce Regression Test
- Dummy Hash Cost Regression Test
- Payer Restore Count Regression Test
- Seed Password Policy Regression Test
- Temporary Password Flow Regression Test
- Route Protection Findings (proxy.ts, SEC-01/05/06)
- DB Integration & E2E Test Setup (QUA-04)
- package.json Metadata
- Local Dev Setup & README
- Backup Retention Regression Test
- Container Timezone Regression Test
- Last Admin Guard Regression Test
- Patient Archive Idempotency Regression Test
- Patient Cascade Archive Flag Regression Test
- Payer Archive Cascade Regression Test
- Proxy Matcher Regression Test
- API Route Test
- Layout Test
- Prisma Pool Findings (PERF-06/LOG-04)
- DB Index Findings (DB-01/DB-03/PERF-04)
- Account Cache Invalidation Regression Test
- Docker Build Config Regression Test
- Partial Unique Indexes Regression Test
- PDF Route Cache-Control Regression Test
- class-variance-authority Dependency
- Multi-Tenancy Isolation & SEC-04
- clsx Dependency
- cross-env Dependency
- Dev Postgres Service & SEC-09
- Prod Postgres Service & DEP-10
- ESLint Config
- eslint-config-next Dependency
- exceljs Dependency
- CI Pipeline
- @hookform/resolvers Dependency
- jose Dependency
- lucide-react Dependency
- next Dependency
- next-themes Dependency
- pg Dependency
- prisma Dependency
- @prisma/adapter-pg Dependency
- react Dependency
- react-hook-form Dependency
- @react-pdf/renderer Dependency
- shadcn Dependency
- tailwind-merge Dependency
- @tiptap/core Dependency
- @tiptap/pm Dependency
- @tiptap/react Dependency
- @tiptap/starter-kit Dependency
- tw-animate-css Dependency
- zod Dependency
- @playwright/test Dependency
- tailwindcss Dependency
- @tailwindcss/postcss Dependency
- @testing-library/dom Dependency
- @testing-library/react Dependency
- @testing-library/user-event Dependency
- @types/node Dependency
- @types/pg Dependency
- @types/react Dependency
- @types/react-dom Dependency
- typescript Dependency
- @vitejs/plugin-react Dependency
- PostCSS Config
- Backup Encryption & Retention Rationale
- Restore Procedure & Prod Deploy
- Missing Doc References (DOC-01/02)
- Untracked Docs in .gitignore (DOC-02/03)
- Invoice Numbering Domain Decision (LOG-01/02)
- Session/Invoice Query Perf Findings (PERF-01/05)
- Audit Retention Healthcheck Regression Test
- Next.js Version Breaking-Changes Warning
- Responsive UI Conventions
- Data/Actions/Validations Separation Convention
- Tailwind v4 + shadcn/ui Convention
- file.svg Icon
- globe.svg Icon
- Next.js Logo
- Vercel Logo
- window.svg Icon
- Duplicate .env.prod Example File (DOC-03)
- Invoice Form City/CAP Overwrite Bug (LOG-02)
- archivePayer State Check Gap (LOG-04)
- Unhandled Invoice Number Promise (LOG-05)
- Invoices Page Payload Bloat (PERF-02)
- Offset Pagination Tradeoff (PERF-07)
- rowToImpostazioniPdf Type Cast Fix (QUA-01)
- invoices-manager.tsx Size/Responsibility Finding (QUA-02)
- getPdfSettings Sentinel ID Finding (QUA-03)
- In-Memory Rate Limit Reset Finding (SEC-06)
- Public Health Endpoint Rate Limit (SEC-07)
- Export Route Origin Check (SEC-08)
- Prisma Runtime Dependency Fix (DEP-02)
- Structured Logging & Rotation Fix (DEP-08)
- LAN Origin Env Var Fix (DEP-09)
- Invoice Change History Fix (LOG-03)
- Invoice List Pagination Fix (LOG-05)
- User Name Length Limit Fix (LOG-06)
- Invoice Year Range Validation (LOG-07)
- Invalid PDF Invoice ID Handling (LOG-08)
- restorePayer Cascade Flag Fix (LOG-09)
- Dead 413 Branch Removal (LOG-10)
- archivePatient State Check Fix (LOG-11)
- ESLint useMemo Warning Fix (QUA-01)
- user-form.tsx any-Type Cleanup (QUA-02)
- isBolloCodiceTaken Parameter Fix (QUA-05)
- Export Column Cap Fix (SEC-02)
- getInvoiceById passwordHash Leak Fix (SEC-03)
- PDF fontFamily Enum Fix (SEC-04)
- X-Powered-By Header Removal (SEC-07)
- CSP Nonce Script-Src Fix (SEC-08)
- Audit Log Password Redaction Fix (SEC-11)

## God Nodes (most connected - your core abstractions)
1. `cn()` - 71 edges
2. `requireUserId()` - 42 edges
3. `Button()` - 40 edges
4. `getClientIp()` - 36 edges
5. `logAudit()` - 34 edges
6. `prisma` - 23 edges
7. `Label()` - 18 edges
8. `Input()` - 17 edges
9. `InvoiceForm()` - 16 edges
10. `createInvoice()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `DEP-03: nessun TLS, con secure:true il cookie di sessione non viene salvato (aperto, richiede reverse proxy)` --semantically_similar_to--> `SEC-02: nessun TLS in produzione, cookie Secure mai salvato (fix: Nginx Proxy Manager + Cloudflare Tunnel)`  [INFERRED] [semantically similar]
  ROADMAP.md → ROADMAP-ANALISI-2026-07-31.md
- `SEC-01: Next.js 16.2.10, 13 advisory high incluso bypass proxy Turbopack (fix: bump a 16.2.12)` --semantically_similar_to--> `SEC-05: 18 vulnerabilità note nelle dipendenze di produzione senza fix non-breaking (postcss, sharp, uuid, valibot)`  [INFERRED] [semantically similar]
  ROADMAP.md → ROADMAP-ANALISI-2026-07-31.md
- `LOG-02: hard-delete fattura + numerazione max+1: numeri riusati e buchi, decisione di dominio ancora aperta` --semantically_similar_to--> `LOG-01: hard-delete fattura + numerazione max+1: numeri riusati e buchi, requisito fiscale art.21 DPR 633/72`  [INFERRED] [semantically similar]
  ROADMAP.md → ROADMAP-ANALISI-2026-07-31.md
- `DEP-06: backup mai verificati, chiave e copie sulla stessa macchina (fix: verifica automatica + rclone off-site)` --semantically_similar_to--> `DEP-06: nessun allarme su fallimenti backup/retention (fix: dead man's switch Healthchecks.io ping)`  [INFERRED] [semantically similar]
  ROADMAP.md → ROADMAP-ANALISI-2026-07-31.md
- `QUA-04: nessun test che eserciti le Server Action contro un DB reale (fix: vitest.integration.config.ts, npm run test:db)` --semantically_similar_to--> `QUA-04: copertura e2e limitata al login, flussi fattura/PDF/export/archiviazione non coperti (fix: nuovi spec e2e)`  [INFERRED] [semantically similar]
  ROADMAP-ANALISI-2026-07-31.md → ROADMAP.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Ordine di lavoro: blocchi da risolvere prima di qualunque deploy (DEP-01 -> DEP-02 -> DEP-03 -> SEC-01 -> LOG-01 -> DOC-01)** — roadmap_dep_01, roadmap_dep_02, roadmap_dep_03, roadmap_sec_01, roadmap_log_01, roadmap_doc_01 [EXTRACTED 1.00]
- **Ordine di lavoro: da fare subito dopo, prima di inserire dati reali (numerazione fatture, ultimo admin, DoS export, backup, healthcheck, CI)** — roadmap_log_02, roadmap_sec_05, roadmap_sec_02, roadmap_dep_04, roadmap_dep_05, roadmap_dep_06, roadmap_dep_07 [EXTRACTED 1.00]
- **I quattro servizi dello stack di produzione definiti insieme in docker-compose.prod.yml** — docker_compose_prod_yml_db_service, docker_compose_prod_yml_app_service, docker_compose_prod_yml_backup_service, docker_compose_prod_yml_audit_log_retention_service [EXTRACTED 1.00]

## Communities (178 total, 105 thin omitted)

### Community 0 - "App Shell & Error Boundaries"
Cohesion: 0.06
Nodes (69): ErrorBoundary(), geistMono, geistSans, metadata, AuditLogManager(), AuditLogManagerProps, formatAzione(), formatData() (+61 more)

### Community 1 - "Invoice Form"
Cohesion: 0.07
Nodes (37): formatCurrency(), InvoiceForm(), InvoiceFormProps, InvoiceWithRelations, meseToLabel(), basePatients, basePayers, patient (+29 more)

### Community 2 - "Invoices List Page"
Cohesion: 0.06
Nodes (38): InvoicesPage(), metadata, currentMonthInvoiceFilters(), EMPTY_INVOICE_FILTERS, baseProps, InvoiceFixture, replace, INVOICES_PAGE_SIZE (+30 more)

### Community 3 - "Patients & Payers Pages"
Cohesion: 0.08
Nodes (34): metadata, PatientsPage(), metadata, PayersPage(), PATIENTS_PAGE_SIZE, PAYERS_PAGE_SIZE, ArchivedPatientRow, findArchivedPatientsPage() (+26 more)

### Community 4 - "PDF Rich Text Blocks"
Cohesion: 0.09
Nodes (31): RichTextBlockEditor(), RichTextBlockEditorProps, Commands, NotaMark, @tiptap/core, VariableChipBadge(), VariableNode, RichTemplateFieldProps (+23 more)

### Community 5 - "Anagrafica Mutation Actions"
Cohesion: 0.15
Nodes (33): PatientForm(), PayerForm(), updateProfile(), logout(), deleteInvoice(), refreshInvoiceAnagrafica(), archivePatient(), createPatient() (+25 more)

### Community 6 - "Invoice Export Column Catalog"
Cohesion: 0.10
Nodes (22): EXPORT_COLUMN_CATEGORY_LABELS, EXPORT_COLUMNS, ExportableInvoice, ExportColumn, ExportColumnCategory, getExportColumn(), PAGANTE_ATTUALE, PAZIENTE_ATTUALE (+14 more)

### Community 7 - "E2E Test Fixtures & Login"
Cohesion: 0.16
Nodes (17): loginAsTestUser(), createTestInvoice(), createTestPatient(), createTestPayer(), deleteTestPayerCascade(), getTestUserId(), uniqueSuffix(), TEST_USER (+9 more)

### Community 8 - "Audit Log Page"
Cohesion: 0.13
Nodes (20): AuditLogPage(), metadata, baseProps, replace, AuditLogFilters, buildAuditLogWhere(), EMPTY_AUDIT_LOG_FILTERS, endOfDay() (+12 more)

### Community 9 - "PDF Editor Block Dragging"
Cohesion: 0.14
Nodes (20): makeId(), PdfEditor(), DraggingState, useBlockDragging(), UseBlockDraggingOptions, useCanvasZoomPan(), UseCanvasZoomPanOptions, ClipboardState (+12 more)

### Community 10 - "TypeScript Compiler Config"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 11 - "Protected Layout Shell"
Cohesion: 0.11
Nodes (19): ProtectedLayout(), TemporaryPasswordNotice(), MobileHeader(), MobileHeaderProps, NavItem, navItems, SidebarContent(), SidebarContentProps (+11 more)

### Community 12 - "Password Reset Form"
Cohesion: 0.13
Nodes (19): ResetPasswordForm(), ResetPasswordFormProps, copyToClipboard(), TemporaryPasswordField(), TemporaryPasswordFieldProps, COMMON_WEAK_PASSWORDS, isCommonWeakPassword(), generateTemporaryPassword() (+11 more)

### Community 13 - "Fiscal Validation & Payer Schema"
Cohesion: 0.10
Nodes (19): CF_REGEX, PIVA_REGEX, TextAlign, PayerFormData, PayerFormInput, payerSchema, BloccoFormData, bloccoSchema (+11 more)

### Community 14 - "Rate-Limited API Routes"
Cohesion: 0.12
Nodes (16): dynamic, GET(), healthCheckLimiter, exportLimiter, POST(), GET(), pdfGenerationLimiter, createRateLimiter() (+8 more)

### Community 15 - "Account & Audit Filter Forms"
Cohesion: 0.15
Nodes (15): ChangePasswordForm(), ProfileForm(), ProfileFormProps, AuditLogFilterBar(), AuditLogFilterBarProps, AZIONE_OPTIONS, fromSelectValue(), toSelectValue() (+7 more)

### Community 16 - "Account & Dashboard Pages"
Cohesion: 0.19
Nodes (15): AccountPage(), metadata, DashboardPage(), formatCurrency(), metadata, metadata, LoginForm(), Card() (+7 more)

### Community 17 - "shadcn/ui Component Registry Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 18 - "Seed & Audit Retention Scripts"
Cohesion: 0.15
Nodes (14): @prisma/client, @prisma/client, main(), main(), pingHealthcheck(), purgeOnce(), RETENTION_MONTHS, TARGET_HOUR (+6 more)

### Community 19 - "Invoice Create Action & Validation"
Cohesion: 0.21
Nodes (17): createInvoice(), InvoiceActionState, isBolloCodiceTaken(), isBolloCodiceUniqueViolation(), isInvoiceNumberTaken(), isInvoiceNumberUniqueViolation(), RelationValidationResult, updateInvoice() (+9 more)

### Community 20 - "Root Page & Auth Actions"
Cohesion: 0.22
Nodes (12): RootPage(), AccountActionState, changePassword(), changePasswordLimiter, login(), redactUsernameForAudit(), hashPassword(), verifyPassword() (+4 more)

### Community 21 - "Login Rate Limiting"
Cohesion: 0.22
Nodes (16): AttemptRecord, attempts, buildKey(), buildUsernameKey(), checkLoginRateLimit(), checkRecord(), evictOldest(), globalForRateLimit (+8 more)

### Community 22 - "User Management Form"
Cohesion: 0.16
Nodes (13): UserCreateForm(), UserEditForm(), UserForm(), UserFormProps, createUser(), resetPasswordLimiter, updateUser(), UserActionState (+5 more)

### Community 23 - "PDF Editor Block Panels"
Cohesion: 0.18
Nodes (11): PdfEditorAddBlockPanel(), PdfEditorAddBlockPanelProps, PdfEditorBlockPropertiesPanel(), PdfEditorBlockPropertiesPanelProps, makeBlocco(), renderPanel(), PdfEditorMesiPanel(), DEFAULT_MESE_CONFIG (+3 more)

### Community 24 - "Invoice PDF Rendering"
Cohesion: 0.31
Nodes (13): getFontFamily(), InvoicePDFDocument(), InvoicePDFDocumentProps, renderTextSegments(), applyReplacements(), buildReplacements(), expandEachLoops(), formatCurrency() (+5 more)

### Community 25 - "PDF Editor Toolbar"
Cohesion: 0.19
Nodes (8): PdfEditorProps, PdfEditorToolbar(), PdfEditorToolbarProps, useTextCursorInsert(), DEFAULT_BLOCCO, LAYOUT_DEFAULT, PdfSettingsInput, fixtures

### Community 26 - "PDF Editor Block Rendering"
Cohesion: 0.22
Nodes (10): Block(), renderFormattedSegments(), renderRichStatic(), makeBlocco(), renderBlock(), PreviewSegments(), parseInlineFormatting(), TextSegment (+2 more)

### Community 27 - "PDF Layout Undo History"
Cohesion: 0.24
Nodes (10): usePdfLayoutHistory(), UsePdfLayoutHistoryOptions, ImpostazioniPdf, InvoiceWithRelations, isBlocco(), isMeseConfig(), isPdfLayout(), isTextAlign() (+2 more)

### Community 28 - "shadcn Select/Dialog Primitives"
Cohesion: 0.22
Nodes (13): CardAction(), DialogOverlay(), SelectContent(), SelectGroup(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton() (+5 more)

### Community 29 - "JWT Session Signing"
Cohesion: 0.21
Nodes (11): assertStrongJwtSecret(), encodedSecret, getTokenMaxAgeSeconds(), KNOWN_PLACEHOLDER_SECRETS, SessionPayload, signSession(), signSessionWithMaxAge(), verifySession() (+3 more)

### Community 30 - "Dev Dependencies"
Cohesion: 0.15
Nodes (13): eslint, jsdom, devDependencies, eslint, jsdom, @testing-library/jest-dom, tsx, @types/bcryptjs (+5 more)

### Community 31 - "PDF Settings Actions"
Cohesion: 0.30
Nodes (10): PdfSettingsPage(), PdfSettingsActionState, refreshInvoicePdfLayout(), updatePdfSettings(), requireSession(), getPdfSettings(), now(), rowToImpostazioniPdf() (+2 more)

### Community 32 - "npm Scripts"
Cohesion: 0.17
Nodes (12): scripts, build, dev, lint, seed, start, test, test:db (+4 more)

### Community 33 - "API Route Auth Checker"
Cohesion: 0.27
Nodes (7): hasApiRouteAuthCheck(), hasExplicit401AuthCheck(), hasRedirectBasedAuthCheck(), REDIRECT_BASED_AUTH_CALLS, API_DIR, HTTP_METHODS, PUBLIC_ROUTES

### Community 34 - "Auth & Prod Deploy Findings (JWT/TLS/DEP-01/02, SEC-01/02/03)"
Cohesion: 0.24
Nodes (11): Autenticazione custom via JWT in cookie httpOnly, tokenVersion per revoca sessioni, proxy.ts come gate GET, Servizio app (produzione): pubblica porta APP_PORT:3000, healthcheck /api/health, mem_limit 768m, TLS obbligatorio prima di esporre pubblicamente: cookie Secure scartato dal browser senza HTTPS, DEP-01: nessun reverse proxy né TLS nello stack prod (fix infra: Nginx Proxy Manager + Cloudflare Tunnel), DEP-02: app pubblicata su tutte le interfacce (mitigazione: nessun port-forward pubblico, resta su LAN), SEC-01: JWT_SECRET reale committato nel Dockerfile come default di build (fix: placeholder non utilizzabile), SEC-02: nessun TLS in produzione, cookie Secure mai salvato (fix: Nginx Proxy Manager + Cloudflare Tunnel), SEC-03: lockout account globale perché resolveClientIp() ritorna 'unknown' senza TRUSTED_PROXY (fix parziale) (+3 more)

### Community 35 - "Login Page & Theme Toggle"
Cohesion: 0.22
Nodes (8): LoginPage(), metadata, icons, labels, Mode, order, ThemeToggle(), ThemeToggleProps

### Community 36 - "Backup Service & Restore Verification"
Cohesion: 0.20
Nodes (10): Servizio backup: build da Dockerfile.backup, mount rclone.conf opzionale con create_host_path:false, Notifica di esito dead man's switch (Healthchecks.io ping) per backup e retention audit log, Copia off-site opzionale via rclone (RCLONE_REMOTE), copia solo il file .gpg già cifrato, Verifica automatica del ripristino: ogni backup viene decifrato e ripristinato in DB usa-e-getta ad ogni run, DEP-03: copia selettiva node_modules su standalone tentata e poi ANNULLATA dopo due crash in produzione, DEP-04: rclone.conf montato come obbligatorio (fix: bind mount con create_host_path:false), DEP-06: nessun allarme su fallimenti backup/retention (fix: dead man's switch Healthchecks.io ping), LOG-06: logAudit best-effort, una mutazione può restare senza traccia (fix: logAuditOrThrow transazionale) (+2 more)

### Community 37 - "Prisma Client Singleton"
Cohesion: 0.36
Nodes (4): adapter, globalForPrisma, prisma, authContext

### Community 38 - "Security Headers Config"
Cohesion: 0.20
Nodes (7): nextConfig, securityHeaders, HeaderEntry, HeaderRule, loadHeadersFor(), mutableEnv, MutableProcessEnv

### Community 39 - "Users Admin Page"
Cohesion: 0.36
Nodes (7): metadata, UsersPage(), UsersManager(), requireAdmin(), getUserById(), getUserByUsername(), getUsers()

### Community 40 - "Invoices Filter Bar"
Cohesion: 0.31
Nodes (7): fromSelectValue(), InvoicesFilterBar(), InvoicesFilterBarProps, PersonaSearchFieldProps, PersonaSuggestion, toSelectValue(), usePersonaSuggestions()

### Community 41 - "UI/Auth Dependencies"
Cohesion: 0.29
Nodes (7): @base-ui/react, bcryptjs, dependencies, @base-ui/react, bcryptjs, react-dom, react-dom

### Community 42 - "Patient Form & Schema"
Cohesion: 0.53
Nodes (4): PatientFormProps, PatientFormData, PatientFormInput, patientSchema

### Community 43 - "PDF Editor Page Settings Panel"
Cohesion: 0.47
Nodes (3): PdfEditorPageSettingsPanel(), PdfEditorPageSettingsPanelProps, toNumber()

### Community 44 - "Backup Shell Script"
Cohesion: 0.53
Nodes (5): PGPASSWORD, ping_healthcheck(), backup-db.sh script, sync_offsite(), verify_backup()

### Community 46 - "PDF Template Engine Rationale (Blocco/richContent bridge)"
Cohesion: 0.40
Nodes (5): Motore di template PDF custom: editor WYSIWYG drag-and-drop, Blocco[] JSON, snapshot layout per fattura, Doppia rappresentazione Blocco.testo/richContent: ponte parseTestoToRichContent/serializeRichContentToTesto, PERF-03: buildReplacements() ricostruito per ogni blocco PDF (fix: calcolato una volta, passato ai chiamanti), SEC-09: CSP con style-src 'unsafe-inline' per posizionamento pixel dell'editor PDF, mantenuto per costo/beneficio, QUA-03: pdf-editor.tsx a 1848 righe, il triplo del secondo file (fix: scomposto in 12 file, 537 righe residue)

### Community 47 - "Audit Log Retention Service"
Cohesion: 0.40
Nodes (5): Servizio audit-log-retention: riusa immagine app con build dichiarata esplicitamente, entrypoint dedicato, DB-02: audit_logs senza indice createdAt da solo, retention fa seq scan (fix: @@index([createdAt])), DEP-05: audit-log-retention riusa immagine app senza dichiarare build (fix: stanza build aggiunta), LOG-03: audit log carica 200 righe e filtra lato client (fix: filtri/paginazione spostati server-side), SEC-12: nessuna retention sull'audit log, dati sanitari senza policy (fix tecnico: servizio audit-log-retention)

### Community 48 - "Client IP Resolution"
Cohesion: 0.60
Nodes (4): HeaderReader, isTrustedProxyEnabled(), parseClientIpFromHeaders(), resolveClientIp()

### Community 49 - "Server Action Auth Regression Test"
Cohesion: 0.40
Nodes (3): ACTIONS_DIR, AUTH_CALLS, PUBLIC_ACTIONS

### Community 50 - "Audit Log Coverage Regression Test"
Cohesion: 0.40
Nodes (3): ACTIONS_DIR, AUDIT_CALLS, READ_ONLY_ACTIONS

### Community 51 - "Audit Log PII Regression Test"
Cohesion: 0.50
Nodes (4): ACTIONS_DIR, BANNED_META_KEYS, extractBalanced(), findMetaBlocks()

### Community 52 - "Backup Integrity Regression Test"
Cohesion: 0.40
Nodes (4): backupScript, compose, dockerfileBackup, ROOT

### Community 55 - "Payer Restore Count Regression Test"
Cohesion: 0.40
Nodes (3): body, PAYERS_DATA_PATH, source

### Community 57 - "Temporary Password Flow Regression Test"
Cohesion: 0.50
Nodes (4): ACCOUNT_ACTIONS_PATH, extractFunctionBody(), functionBody(), USERS_ACTIONS_PATH

### Community 58 - "Route Protection Findings (proxy.ts, SEC-01/05/06)"
Cohesion: 0.50
Nodes (4): proxy.ts: route protection GET-only, file convention che sostituisce middleware.ts in questa versione Next.js, SEC-05: 18 vulnerabilità note nelle dipendenze di produzione senza fix non-breaking (postcss, sharp, uuid, valibot), SEC-01: Next.js 16.2.10, 13 advisory high incluso bypass proxy Turbopack (fix: bump a 16.2.12), SEC-06: proxy.ts lascia passare anche le richieste HEAD saltando il controllo sessione (fix: escluso anche HEAD)

### Community 59 - "DB Integration & E2E Test Setup (QUA-04)"
Cohesion: 0.50
Nodes (4): npm run test:db: test di integrazione contro Postgres reale (scripts/db-integration/, QUA-04), escluso da CI, QUA-04: nessun test che eserciti le Server Action contro un DB reale (fix: vitest.integration.config.ts, npm run test:db), QUA-04: copertura e2e limitata al login, flussi fattura/PDF/export/archiviazione non coperti (fix: nuovi spec e2e), SEC-10: setup e2e crea utente con password nota nel DB puntato da DATABASE_URL (fix: assertSafeTestEnvironment)

### Community 60 - "package.json Metadata"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 61 - "Local Dev Setup & README"
Cohesion: 0.50
Nodes (4): Sviluppo locale: Postgres via docker-compose.dev.yml, .env, migration, npm run seed per primo admin, Gestionale Fatture: overview progetto, Next.js 16 App Router + PostgreSQL/Prisma, JWT custom, DEP-01: nessun modo di creare il primo utente su DB vuoto (fix: prisma/seed.mjs, npm run seed), DOC-01: README.md ancora boilerplate create-next-app, mancano prerequisiti e procedura deploy (fix: riscritto)

### Community 62 - "Backup Retention Regression Test"
Cohesion: 0.50
Nodes (3): backupScript, readmeBackup, ROOT

### Community 63 - "Container Timezone Regression Test"
Cohesion: 0.50
Nodes (3): dockerfile, packageJson, ROOT

### Community 71 - "Prisma Pool Findings (PERF-06/LOG-04)"
Cohesion: 0.67
Nodes (3): Prisma con adapter pg su Pool custom (non engine di default), singleton su globalThis in sviluppo, PERF-06: nuovo Pool pg a ogni valutazione modulo, nessun handler SIGTERM (fix: pool memoizzato + shutdown), LOG-04: nuovo Pool pg a ogni hot-reload in sviluppo, mai chiuso (fix: pool memoizzato su globalThis)

### Community 72 - "DB Index Findings (DB-01/DB-03/PERF-04)"
Cohesion: 0.67
Nodes (3): DB-01: nessun indice su FK id_Pagante/id_Paziente (fix: @@index aggiunti, migration via prisma migrate diff), DB-03: indici unique parziali non introspettabili, rischio drift silenzioso (fix: test testuale su migration.sql), PERF-04: ricerche contains/insensitive causano seq scan (fix rimandato: pg_trgm richiede Postgres per test)

## Knowledge Gaps
- **354 isolated node(s):** `metadata`, `metadata`, `metadata`, `metadata`, `metadata` (+349 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **105 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@prisma/client` connect `Seed & Audit Retention Scripts` to `UI/Auth Dependencies`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **Why does `dependencies` connect `UI/Auth Dependencies` to `Seed & Audit Retention Scripts`, `package.json Metadata`, `class-variance-authority Dependency`, `clsx Dependency`, `exceljs Dependency`, `@hookform/resolvers Dependency`, `jose Dependency`, `lucide-react Dependency`, `next Dependency`, `next-themes Dependency`, `pg Dependency`, `prisma Dependency`, `@prisma/adapter-pg Dependency`, `react Dependency`, `react-hook-form Dependency`, `@react-pdf/renderer Dependency`, `shadcn Dependency`, `tailwind-merge Dependency`, `@tiptap/core Dependency`, `@tiptap/pm Dependency`, `@tiptap/react Dependency`, `@tiptap/starter-kit Dependency`, `tw-animate-css Dependency`, `zod Dependency`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **What connects `metadata`, `metadata`, `metadata` to the rest of the system?**
  _354 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Shell & Error Boundaries` be split into smaller, more focused modules?**
  _Cohesion score 0.05845464725643897 - nodes in this community are weakly interconnected._
- **Should `Invoice Form` be split into smaller, more focused modules?**
  _Cohesion score 0.06557377049180328 - nodes in this community are weakly interconnected._
- **Should `Invoices List Page` be split into smaller, more focused modules?**
  _Cohesion score 0.06440677966101695 - nodes in this community are weakly interconnected._
- **Should `Patients & Payers Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.07755102040816327 - nodes in this community are weakly interconnected._