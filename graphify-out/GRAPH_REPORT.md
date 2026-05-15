# Graph Report - .  (2026-05-15)

## Corpus Check
- 102 files · ~183,863 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 536 nodes · 976 edges · 40 communities (39 shown, 1 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.85)
- Token cost: 46,880 input · 11,440 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Core Platform Pages & Docs|Core Platform Pages & Docs]]
- [[_COMMUNITY_Blog Content & Bug Reports|Blog Content & Bug Reports]]
- [[_COMMUNITY_Dashboard UI Logic|Dashboard UI Logic]]
- [[_COMMUNITY_Serverless API Handlers|Serverless API Handlers]]
- [[_COMMUNITY_Business Settings & Employees|Business Settings & Employees]]
- [[_COMMUNITY_Onboarding Flow|Onboarding Flow]]
- [[_COMMUNITY_Invoice & Payment Workflow|Invoice & Payment Workflow]]
- [[_COMMUNITY_Booking & Auth Frontend|Booking & Auth Frontend]]
- [[_COMMUNITY_Core Utilities & Setup|Core Utilities & Setup]]
- [[_COMMUNITY_Landing Page Animations|Landing Page Animations]]
- [[_COMMUNITY_B2B  B2C Lead Management|B2B / B2C Lead Management]]
- [[_COMMUNITY_Employee Signup Flow|Employee Signup Flow]]
- [[_COMMUNITY_VPS Infrastructure & DevOps|VPS Infrastructure & DevOps]]
- [[_COMMUNITY_Calendar API Backend|Calendar API Backend]]
- [[_COMMUNITY_Supabase Data Layer|Supabase Data Layer]]
- [[_COMMUNITY_Frontend Pages & Auth|Frontend Pages & Auth]]
- [[_COMMUNITY_AI Agent Roadmap|AI Agent Roadmap]]
- [[_COMMUNITY_SEO & Brand Presence|SEO & Brand Presence]]
- [[_COMMUNITY_Schedule & Booking Views|Schedule & Booking Views]]
- [[_COMMUNITY_Patient Records UI|Patient Records UI]]
- [[_COMMUNITY_n8n AI Booking Agent|n8n AI Booking Agent]]
- [[_COMMUNITY_Admin Panel Backend|Admin Panel Backend]]
- [[_COMMUNITY_Invoice Editor|Invoice Editor]]
- [[_COMMUNITY_Referral AI Automation|Referral AI Automation]]
- [[_COMMUNITY_Docker Compose Stack|Docker Compose Stack]]
- [[_COMMUNITY_Anamnese Forms|Anamnese Forms]]
- [[_COMMUNITY_Brand Identity|Brand Identity]]
- [[_COMMUNITY_Brand Visual Assets|Brand Visual Assets]]
- [[_COMMUNITY_Marketing Content|Marketing Content]]
- [[_COMMUNITY_Future Sector Expansion|Future Sector Expansion]]
- [[_COMMUNITY_Hours Management UI|Hours Management UI]]
- [[_COMMUNITY_Employee Calendar|Employee Calendar]]
- [[_COMMUNITY_Stripe Billing|Stripe Billing]]
- [[_COMMUNITY_Brand Assets (SVGFavicon)|Brand Assets (SVG/Favicon)]]
- [[_COMMUNITY_Embeddable Calendar Widget|Embeddable Calendar Widget]]
- [[_COMMUNITY_App Icons|App Icons]]

## God Nodes (most connected - your core abstractions)
1. `getOwnerId()` - 37 edges
2. `switchPanel()` - 23 edges
3. `adminFetch()` - 19 edges
4. `init()` - 17 edges
5. `t()` - 15 edges
6. `InfinityMade (Platform/Company)` - 15 edges
7. `showToast()` - 14 edges
8. `getAuthedUser()` - 14 edges
9. `init()` - 12 edges
10. `openModal()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `initCalendar()` --calls--> `mountCalendar()`  [INFERRED]
  dashboard.js → calendar-widget.js
- `Geographic Focus NRW Germany` --corresponds_to--> `Webdesign Siegburg SEO Landing Page`  [INFERRED]
  llms.txt → webdesign-siegburg.html
- `Geographic Focus NRW Germany` --corresponds_to--> `Webdesign KÃ¶ln SEO Landing Page`  [INFERRED]
  llms.txt → webdesign-koeln.html
- `Geographic Focus NRW Germany` --corresponds_to--> `Webdesign Troisdorf SEO Landing Page`  [INFERRED]
  llms.txt → webdesign-troisdorf.html
- `Geographic Focus NRW Germany` --corresponds_to--> `Webdesign Hennef SEO Landing Page`  [INFERRED]
  llms.txt → webdesign-hennef.html

## Hyperedges (group relationships)
- **InfinityMade brand identity expressed in favicon: rounded-rect background + infinity-symbol stroke in purple** —  [INFERRED 0.95]
- **OG Image Visual Composition** —  [INFERRED 1.00]

## Communities (40 total, 1 thin omitted)

### Community 0 - "Core Platform Pages & Docs"
Cohesion: 0.06
Nodes (66): Admin Panel (admin.html), Allgemeine GeschÃ¤ftsbedingungen (agb.html), Agent Prompts & Dev Checklist (AGENT_PROMPTS.md), Public Booking Page (booking.html), Known Issues / Blockers (bunu_yapamadiklarim.md), Project Instructions (CLAUDE.md), Customer Dashboard (dashboard.html), Dashboard Redesign Plan (DASHBOARD_REDESIGN_PLAN.md) (+58 more)

### Community 1 - "Blog Content & Bug Reports"
Cohesion: 0.06
Nodes (53): Blog: Fitnessstudio Mitglieder gewinnen (5 digitale Strategien 2025), Blog: WhatsApp Terminbuchung fÃ¼r Friseure (Guide 2025), Blog: Website fÃ¼r Handwerker Kosten 2025, Blog Index (Digitalisierung fÃ¼r KMU), Blog: Restaurant No-Shows per WhatsApp reduzieren (Guide 2025), Blog: Webdesign Kosten fÃ¼r KMU in NRW (2025), Bug: Anamnese PDF Print Shows Wrong Content, Bug: Booking Modal - Auto End Time (bkEnd Removal Residuals) (+45 more)

### Community 2 - "Dashboard UI Logic"
Cohesion: 0.07
Nodes (18): bindAddServiceCard(), calculateSessionInfo(), filterDocsCache(), hexToHSL(), hslToHex(), initEmpCalTab(), loadDoctors(), loadEmpDaySchedule() (+10 more)

### Community 3 - "Serverless API Handlers"
Cohesion: 0.17
Nodes (23): handler(), handler(), handler(), adminAuthFetch(), adminFetch(), adminRpc(), getAuthedUser(), getBusinessSecret() (+15 more)

### Community 4 - "Business Settings & Employees"
Cohesion: 0.14
Nodes (26): addAerzte(), aiAddMsg(), deleteAerzte(), getSector(), initBkCustomerAutocomplete(), loadAerzte(), loadSettings(), openAddEmployeeModal() (+18 more)

### Community 5 - "Onboarding Flow"
Cohesion: 0.14
Nodes (18): bindAccount(), bindBusiness(), bindHours(), bindOwner(), bindPlan(), bindServices(), bindTemplates(), bindWhatsapp() (+10 more)

### Community 6 - "Invoice & Payment Workflow"
Cohesion: 0.13
Nodes (22): closeModal(), confirmÜberweisung(), generateInvNumber(), getOwnerId(), handleGmailCallback(), handlePatientNichtErschienen(), handleTerminStarten(), loadÜberweisung() (+14 more)

### Community 7 - "Booking & Auth Frontend"
Cohesion: 0.15
Nodes (15): goStep(), init(), loadBookingSlots(), loadServices(), mountBookingCalendar(), renderBookingCalendar(), showError(), updateSidebar() (+7 more)

### Community 8 - "Core Utilities & Setup"
Cohesion: 0.12
Nodes (18): applyI18n(), bindAnamneseEvents(), bindInvEvents(), cleanBookingSlug(), ensureBookingSlug(), ensureCompanyCode(), findGaps(), generatePassword() (+10 more)

### Community 9 - "Landing Page Animations"
Cohesion: 0.16
Nodes (7): animate(), drawLines(), Particle, q(), setLanguage(), setPricingBilling(), setStatCard()

### Community 10 - "B2B / B2C Lead Management"
Cohesion: 0.14
Nodes (14): checkB2bSetup(), checkB2cSetup(), closeSidebar(), loadB2B(), loadB2C(), loadBeispielmodus(), loadLeads(), renderB2B() (+6 more)

### Community 11 - "Employee Signup Flow"
Cohesion: 0.29
Nodes (10): $(), clearStep1Errors(), collectWorkingHours(), handleEnter(), isValidEmail(), renderWorkingHours(), showFieldErr(), updateSummary() (+2 more)

### Community 12 - "VPS Infrastructure & DevOps"
Cohesion: 0.17
Nodes (13): Docker Stack (Traefik + n8n + calendar-api), GitHub Container Registry (GHCR) for calendar-api, Hetzner VPS Server, Auto-Deploy Pipeline (GitHub Actions + Watchtower), Infrastructure & Tooling Guide, n8n MCP Setup for Windsurf/Cascade, Production n8n Workflow ID xccY2rWaswRM7ZoZ, Secrets Location Map (+5 more)

### Community 13 - "Calendar API Backend"
Cohesion: 0.2
Nodes (6): addDays(), berlinDayBoundsUTC(), berlinLocalToUTC(), berlinOffsetMin(), computeSeriesPreview(), updateBkSeriesPreview()

### Community 14 - "Supabase Data Layer"
Cohesion: 0.3
Nodes (11): createBrowserClient(), createServerClient(), getBookings(), getLeads(), getOwnerId(), getPatientDetails(), getServices(), getSupabase() (+3 more)

### Community 15 - "Frontend Pages & Auth"
Cohesion: 0.2
Nodes (12): FullCalendar Scheduler Integration, Infinity Calendar Page (kalender.html), Login Page (login.html), Supabase Auth Integration on Login, Onboarding Step 1 â€” Account Creation, Onboarding Step 2 â€” Business Info, 8-Step Onboarding Page (onboarding.html), robots.txt SEO Configuration (+4 more)

### Community 16 - "AI Agent Roadmap"
Cohesion: 0.2
Nodes (12): PraxisAI Upgrade Cheat-Sheet, Message Buffering Upgrade (Redis/Supabase), Multi-Tenant business_id Routing, Plan-Based LLM Model Selection, RAG Knowledge Base via pgvector, Reactivation Cron â€” 90 Day Dormant Customers, 24h/2h Appointment Reminder Workflow, PraxisAI Development Roadmap (+4 more)

### Community 17 - "SEO & Brand Presence"
Cohesion: 0.18
Nodes (12): Google Analytics GA4 (G-9HFT4S0LTX), llms.txt Machine-Readable Overview for AI Crawlers, Geographic Focus NRW Germany, InfinityMade SaaS Entity (Siegburg, NRW), InfinityMade Target Sectors, Schema.org ProfessionalService Structured Data, Webdesign Bonn SEO Landing Page, Webdesign Hennef SEO Landing Page (+4 more)

### Community 18 - "Schedule & Booking Views"
Cohesion: 0.24
Nodes (11): doMoveBooking(), escapeHtml(), formatDateDE(), loadPatientDetailNotes(), loadScheduleBookings(), loadTodayBookings(), renderDayView(), renderOverview() (+3 more)

### Community 19 - "Patient Records UI"
Cohesion: 0.2
Nodes (11): displayName(), displayNameWithBirth(), fmtDate(), leadBirthDate(), loadNotizen(), loadPatientDetailAnamnese(), loadPatientDetailMails(), loadPatientDetailRechnungen() (+3 more)

### Community 20 - "n8n AI Booking Agent"
Cohesion: 0.22
Nodes (10): Production n8n Instance (n8n.infinitymade.de), AI Agent System Prompt Booking Flow, create_booking n8n Tool, n8n Cal.com â†’ Custom Calendar API Migration Guide, get_available_slots n8n Tool, list_services n8n Tool (Supabase services table), Cal.com to Custom API Tool Mapping, PraxisAI Active n8n Workflows (+2 more)

### Community 21 - "Admin Panel Backend"
Cohesion: 0.42
Nodes (7): apiGet(), apiPatch(), boot(), json(), loadAdminFeedbacks(), loadCustomers(), loadKpis()

### Community 22 - "Invoice Editor"
Cohesion: 0.29
Nodes (8): buildInvLineRow(), buildSvcOptions(), calcInvTotals(), formatEur(), loadInvPatients(), openInvEditor(), renderInvLines(), resetInvEditor()

### Community 23 - "Referral AI Automation"
Cohesion: 0.29
Nodes (7): OpenRouter Gemini (Zero Retention AI Vision), Referrals Traefik Routing Config (deprecated), AI Vision Parse via OpenRouter/Gemini, Referral Upload n8n Workflow (VPS Storage), Ãœberweisung Automation Setup Guide, Ãœberweisung Supabase Tables (referral_drafts), Ãœberweisung Upload Page (upload-ueberweisung.html)

### Community 24 - "Docker Compose Stack"
Cohesion: 0.43
Nodes (7): calendar-api Node.js Service (GHCR image), Docker Compose VPS Stack (Traefik + n8n + calendar-api + Watchtower), GitHub Container Registry Image: calendar-api, Let's Encrypt TLS Certificate (ACME), n8n Workflow Automation Service, Traefik Reverse Proxy (HTTPS + Routing), Watchtower Auto-Deploy Service

### Community 25 - "Anamnese Forms"
Cohesion: 0.4
Nodes (6): fillAnamneseForm(), getAnamChecks(), loadAnamnese(), resetAnamneseForm(), setAnamChecks(), syncAnamTextarea()

### Community 26 - "Brand Identity"
Cohesion: 0.53
Nodes (6): InfinityMade Brand, Infinity Symbol (âˆž), InfinityMade Logo, Purple/Violet Gradient Color Scheme, SaaS Platform (WhatsApp AI Receptionist), Upward Arrow

### Community 27 - "Brand Visual Assets"
Cohesion: 0.47
Nodes (6): InfinityMade Brand, InfinityMade Open Graph Logo Image, White Background Layout, Brand Message: Infinite Growth / Upward Trajectory, Infinity Symbol with Upward Arrow, Purple-to-Magenta Gradient Color Scheme

### Community 28 - "Marketing Content"
Cohesion: 0.4
Nodes (5): Hero Section â€” Phone Rings Nobody Answers, InfinityMade v2 Content Document, Multilingual Support DE/EN/TR, PraxisAI â€” KI-Assistent & Online-Buchung Service, InfinityMade Service Offerings (6 services)

### Community 29 - "Future Sector Expansion"
Cohesion: 0.4
Nodes (5): Pakete Coming Soon (Waitlist for unfinished sectors), Sector Coming Soon: Ã„rzte & Kliniken, Sector Coming Soon: AnwÃ¤lte & Notare, Sector Coming Soon: Dienstleister (Coaches, Agents), Sector Coming Soon: Einzelhandel (Retail)

### Community 30 - "Hours Management UI"
Cohesion: 0.5
Nodes (4): loadHoursPanel(), renderHoursGrid(), renderHoursMiniCal(), renderSpecialDaysList()

### Community 31 - "Employee Calendar"
Cohesion: 0.5
Nodes (4): getEmployeeWorkingHours(), initCalendar(), renderCalEmpList(), updateCalendarForEmployee()

### Community 32 - "Stripe Billing"
Cohesion: 0.5
Nodes (4): Stripe Customer Portal, Stripe Pricing Plans (Starter/Professional/Klinik), Stripe Setup Guide, Stripe Webhook Configuration

### Community 33 - "Brand Assets (SVG/Favicon)"
Cohesion: 0.67
Nodes (4): Brand Purple #7c3aed, InfinityMade Favicon / Brand Icon, Rounded Rectangle Background, Infinity Symbol Path

### Community 35 - "App Icons"
Cohesion: 1.0
Nodes (3): InfinityMade Brand, Infinity + Arrow Design Element, InfinityMade Brand Logo (Apple Touch Icon)

## Knowledge Gaps
- **75 isolated node(s):** `Google Calendar OAuth Integration`, `admin.js (Super Admin Logic)`, `supabase-config.js (Supabase Client Config)`, `kalender.html (Owner Calendar/Settings)`, `booking.js (Public Booking Logic)` (+70 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 9 inferred relationships involving `adminFetch()` (e.g. with `handler()` and `handler()`) actually correct?**
  _`adminFetch()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Google Calendar OAuth Integration`, `admin.js (Super Admin Logic)`, `supabase-config.js (Supabase Client Config)` to the rest of the system?**
  _75 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Core Platform Pages & Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Blog Content & Bug Reports` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Dashboard UI Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Business Settings & Employees` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
- **Should `Onboarding Flow` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._