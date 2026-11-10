# Tokenbelege

Quelle: Designcheckout laut DESIGN-PINS.json; nicht runtime. Reihenfolge/Theme-Kontext aus Original beibehalten.

45: :root[data-design="neu"] {
47:   --radius: 18px;      /* Karten, Tabellenrahmen, Dialog, Seitenpanel */
48:   --radius-xl: 22px;   /* höchstens eine Hauptkarte je Seite */
49:   --radius-md: 14px;   /* Mini-Karten, Banner, Toast */
50:   --radius-sm: 12px;   /* Knöpfe, Felder, Segment, Menüpunkte */
51:   --radius-xs: 999px;  /* Status-Tags, Filter-Chips: Pille */
52:   --radius-xxs: 6px;   /* Checkbox, Zähler-Chips */
56:   --fs-display: 32px; --lh-display: 36px;
57:   --fs-h1: 28px;      --lh-h1: 34px;
58:   --fs-h2: 20px;      --lh-h2: 26px;
59:   --fs-karte: 18px;   --lh-karte: 24px;
60:   --fs-kennzahl: 28px; --lh-kennzahl: 32px;
61:   --fs-text: 14px;    --lh-text: 20px;
62:   --fs-tabelle: 13px; --lh-tabelle: 18px;
63:   --fs-meta: 12px;    --lh-meta: 16px;
67:   --dur-schnell: 120ms;   /* Hover, Fokus */
68:   --dur: 180ms;           /* Aufklappen, Menü, Flyout */
69:   --dur-lang: 240ms;      /* Seitenpanel, Dialog */
70:   --ease-standard: cubic-bezier(0.2, 0, 0, 1);
74:   --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 20px;
75:   --sp-6: 24px; --sp-8: 32px; --sp-10: 40px; --sp-12: 48px; --sp-16: 64px;
78: :root[data-design="neu"]:not([data-theme="dark"]) {
82:   --bg-main: #F4F6F9;
84:   --bg-card-solid: #FFFFFF;
101:   --text-main: #0B0F17;              /* fast schwarz, 17,7:1 auf Grund */
102:   --text-muted: #475467;             /* 7,7:1 auf Weiß */
107:   --primary: #0B0F17;
113:   --accent: #2563EB;                 /* Links, Akzenttext, 5,2:1 auf Weiß */
117:   --focus-ring: #2563EB;
121:   --success: #067647;
123:   --danger: #B42318;
129:   --warning: #CC6B49;                /* Warnsymbol Orange, Grafik 3,6:1 auf Weiß */
147:   --chart-1: #2563EB; --chart-2: #64748B; --chart-3: #93C5FD; --chart-4: #98A2B3; --chart-rest: #E4E7EC;
156:   --shadow-e1: 0 1px 2px rgba(16, 24, 40, 0.04), 0 6px 20px -8px rgba(16, 24, 40, 0.08); /* Karte, weich (E12) */
157:   --shadow-e2: 0 8px 24px -6px rgba(17, 24, 39, 0.16), 0 2px 6px rgba(17, 24, 39, 0.06); /* Menü, Toast, Popover */
158:   --shadow-e3: 0 24px 56px -12px rgba(17, 24, 39, 0.30);                                /* Dialog, Seitenpanel */
170: :root[data-design="neu"][data-theme="dark"] {
171:   --bg-main: #0B0D12;
173:   --bg-card-solid: #14171D;
188:   --text-main: #F1F3F6;
189:   --text-muted: #A6AEBB;
194:   --primary: #F1F3F6;
200:   --accent: #60A5FA;
204:   --focus-ring: #60A5FA;
207:   --success: #47CD89;
209:   --danger: #F97066;
212:   --warning: #D97757;                /* Claude-Orange, 5,8:1 auf Karte dunkel */
228:   --chart-1: #60A5FA; --chart-2: #94A3B8; --chart-3: #3B82F6; --chart-4: #475467; --chart-rest: #262B33;
235:   --shadow-e1: 0 1px 2px rgba(0, 0, 0, 0.30), 0 8px 24px -10px rgba(0, 0, 0, 0.50);
236:   --shadow-e2: 0 8px 24px -6px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.30);
237:   --shadow-e3: 0 24px 56px -12px rgba(0, 0, 0, 0.70);
