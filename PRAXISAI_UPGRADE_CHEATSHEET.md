# PraxisAI Upgrade Cheat-Sheet

> n8n.infinitymade.de production sistemi için pratik geliştirme rehberi.
> Stack: Twilio (WhatsApp) + Cal.com / Google Calendar + Supabase + OpenAI/Groq.
> Hedef: Friseur, Kosmetik, Nagelstudio, Physio, küçük servis işletmeleri.
>
> Kaynak: 295 hazır n8n workflow + 3 aktif PraxisAI workflow analizi.

---

## 0. PraxisAI Mevcut Durum (Özet)

### 0.1 Aktif workflow'lar (n8n.infinitymade.de)

| ID | Ad | Aktif | Node | Tetikleyici | Görev |
|---|---|---|---|---|---|
| `aLPpZG4lvh1jH0Wp` | PraxisAI — booking_inbound | ✅ | 23 | WhatsApp Webhook | Ana randevu akışı |
| `OFYyA8lMlyl747m7` | cal workflow | ✅ | 39 | Twilio + 24h cron | Cal.com agent + follow-up |
| `ZckG2qHwOtJSVM3Z` | Lead Mail Automation | ✅ | 15 | Cron + Webhook | Soğuk e-posta (MS Graph) |
| `D3h3UzRAILEAWF4T` | cal workflow — TEMPLATE | ❌ | 40 | — | Multi-tenant taslağı |
| `0RAD1BGciGHx9X3ElwfDj` | Dental chatbot | ❌ | 12 | — | Eski POC |
| `lmm0tsmvJd5m7QWq` | Lead Reply Handler | ❌ | 12 | — | Yarım kalmış |

### 0.2 booking_inbound akış mantığı (23 node)

```
WhatsApp Webhook
  → Extract Message Data (Set)
  → Is Text Message? (IF)
  → Check Opt-in Status (HTTP → Supabase)
  → Is Opted In? (IF)
      ├─ HAYIR: Is Message JA? (IF)
      │     ├─ JA  → Update Opted In → AI Agent
      │     └─ Diğer → Send Opt-in Request (WhatsApp template)
      └─ EVET: AI Agent (Groq Llama, Memory, GCal Tools)
            → Parse and Clean (Code)
            → Need Cal Check? (IF)
                ├─ EVET → Get Calendar Events → Format → Ask Groq → Reply
                └─ HAYIR → Has Booking? (IF) → Book → Confirm → Reply
```

### 0.3 cal workflow akış mantığı (39 node)

```
Twilio Trigger → ⚙️ CONFIG (Set: business_id, calendar) → Switch (STOP/HELP/normal)
  → Get Existing Chat Session (Airtable)
  → Appointment Scheduling Agent (OpenAI + 6 Cal.com Tool HTTP):
      Get Availability / Create / Find / Reschedule / Cancel / Get Existing Booking
  → Session Exists? → Create or Update → Send Reply (Twilio)

Schedule Trigger (24h):
  → Find Follow-Up Candidates (Airtable, ACTIVE & son temas N gün)
  → Generate Follow Up Message (LLM Chain) → Update Count → Send Twilio
```

### 0.4 Güçlü yönler

- ✅ **Çift yönlü stack** — booking_inbound (Supabase + Groq + GCal) ve cal workflow (Airtable + OpenAI + Cal.com) paralel çalışıyor
- ✅ Opt-in/STOP word handling var (TCPA / DSGVO uyum başlangıcı)
- ✅ AI Agent + Tool çağrısı pattern'i doğru — modern langchain node'ları
- ✅ Cron-based outbound follow-up zaten kuruldu
- ✅ Lead generation (soğuk mail) ayrı bir akış olarak çalışıyor
- ✅ ⚙️ CONFIG node'u multi-tenant için temel zemin

### 0.5 Eksikler / risk

- ❌ **Mesaj buffering yok** — kullanıcı 3 mesaj art arda atınca 3 cevap gelir
- ❌ **RAG/FAQ yok** — "Saç boyama kaç saat sürer?" gibi sorulara her seferinde LLM hallucinate ediyor
- ❌ **Hata yönetimi yok** — Groq timeout / Cal.com 5xx olunca müşteri sessizce yanıtsız kalır
- ❌ **Reminder/no-show preventif outbound yok** (24h ve 2h önce hatırlatma)
- ❌ **Reactivation cron yok** ("3 ay görüşmedik" → dön gel kampanyası)
- ❌ **İki workflow ayrı veritabanı** kullanıyor (Supabase + Airtable) — tek kaynak yapılmalı
- ❌ **Sentiment / review request akışı yok** — Google Review yıldızları kaçıyor
- ❌ **Multi-tenant yarım** — TEMPLATE var ama her müşteri için workflow kopyalamak ölçeklenmez
- ❌ **Logging / observability yok** — hata olunca debug için workflow execution'a bakmak gerekir
- ❌ **Image/voice mesaj fallback'i yok** — müşteri sesli mesaj gönderince ne olur?
- ❌ **Test ortamı yok** — production'da debug ediliyor

---

## 1. Hemen Uygulanabilecek Upgrade'ler (Quick Wins)

> Her biri 1-2 saatlik iş, mevcut workflow'a düşük riskli ekleme.

### 1.1 Mesaj Buffering — "3 saniye sustuysa cevap ver"

**Pattern adı:** Twilio + Redis chat buffering
**Kaynak:** `Enhance Customer Chat by Buffering Messages with Twilio and Redis.txt`
**Sorun:** Müşteri "Merhaba" → "yarın için" → "saç kesimi" diye 3 ayrı mesaj atınca, sistem 3 ayrı cevap üretir.
**Çözüm:** Her gelen mesajı Redis listesine pushla, 5 saniye bekle, son mesajdan beri yeni mesaj geldi mi kontrol et. Geldiyse bu execution'ı kapat, en sonuncusu cevap versin.

**PraxisAI'ya uyarlama:** `Extract Message Data` ile `Is Text Message?` arasına şu node zinciri girer:

```json
{
  "name": "Push to Buffer (Redis)",
  "type": "n8n-nodes-base.redis",
  "parameters": {
    "operation": "push",
    "list": "=chat-buffer:{{ $json.From }}",
    "messageData": "={{ $json.Body }}",
    "tail": true
  }
}
```

```json
{
  "name": "Wait 5s",
  "type": "n8n-nodes-base.wait",
  "parameters": { "amount": 5, "unit": "seconds" }
}
```

```json
{
  "name": "Get Last Buffered",
  "type": "n8n-nodes-base.redis",
  "parameters": {
    "operation": "get",
    "key": "=chat-buffer:{{ $json.From }}",
    "keyType": "list"
  }
}
```

```json
{
  "name": "Am I the Last?",
  "type": "n8n-nodes-base.if",
  "parameters": {
    "conditions": {
      "string": [{
        "value1": "={{ $('Push to Buffer (Redis)').item.json.Body }}",
        "value2": "={{ $('Get Last Buffered').last().json.value }}"
      }]
    }
  }
}
```

Sadece "true" branch akışa devam eder. Redis yoksa **Supabase tablosuna** (`message_buffer` / TTL 30s) aynı mantıkla yazılabilir.

**Beklenen fayda:** %30-40 daha az LLM çağrısı + müşteri "spam" hissetmez.

---

### 1.2 STOP / HELP / RESET Komutları (DSGVO/TCPA)

**Pattern adı:** Switch node ile keyword routing
**Kaynak:** `Handling Appointment Leads and Follow-up With Twilio, Cal.com and AI.txt` (Switch + User Request STOP)
**Durum:** cal workflow'da var, **booking_inbound'da yok**.

PraxisAI booking_inbound'a `Extract Message Data` sonrası ekle:

```json
{
  "name": "Command Words?",
  "type": "n8n-nodes-base.switch",
  "parameters": {
    "rules": {
      "values": [
        { "outputKey": "stop",  "conditions": { "string": [{ "value1": "={{ $json.body.toLowerCase() }}", "operation": "regex", "value2": "^(stop|stopp|abmelden|löschen)$" }] }},
        { "outputKey": "help",  "conditions": { "string": [{ "value1": "={{ $json.body.toLowerCase() }}", "operation": "regex", "value2": "^(hilfe|help|info)$" }] }},
        { "outputKey": "reset", "conditions": { "string": [{ "value1": "={{ $json.body.toLowerCase() }}", "operation": "regex", "value2": "^(reset|neu|löschen)$" }] }}
      ]
    }
  }
}
```

- `stop` → Supabase user_status='STOPPED', "Sie wurden abgemeldet" cevabı
- `help` → Statik hilfe mesajı
- `reset` → Conversation memory wipe + "Wir starten neu"
- default → Mevcut Opt-in akışına

**Beklenen fayda:** WhatsApp Business policy ihlali riskini sıfırlar, AVG/DSGVO için zorunlu.

---

### 1.3 Hata Yönetimi (Error Trigger + Fallback Reply)

**Pattern adı:** Workflow Error Trigger + WhatsApp fallback
**Kaynak:** Standart n8n pattern (birçok dosyada bulunuyor)
**Sorun:** Groq timeout → müşteri 30 saniye boyunca cevapsız.

Yeni bir `PraxisAI — error_handler` workflow oluştur:

```json
{
  "name": "Error Trigger",
  "type": "n8n-nodes-base.errorTrigger"
}
→
{
  "name": "Get Customer Phone",
  "type": "n8n-nodes-base.code",
  "parameters": {
    "jsCode": "return [{ json: { phone: $input.first().json.execution.error?.context?.From || $input.first().json.execution.error?.node?.parameters?.From }}];"
  }
}
→
{
  "name": "Send Fallback",
  "type": "n8n-nodes-base.twilio",
  "parameters": {
    "message": "Entschuldigung, technisches Problem. Wir melden uns gleich. Für dringende Termine: ☎ +49 ..."
  }
}
→
{
  "name": "Log Error to Supabase",
  "type": "n8n-nodes-base.supabase"
}
```

booking_inbound'da Settings → "Error Workflow" olarak bunu seç.

**Beklenen fayda:** %100 müşteriye yanıt garantisi.

---

### 1.4 Mesaj Tipi Routing (Voice / Image / Document)

**Pattern adı:** Multi-modal entry switch
**Sorun:** Müşteri voice note gönderince `Is Text Message?` IF'i false → akış ölür, hiçbir cevap yok.

`Is Text Message?` yerine Switch:

```json
{
  "name": "Message Type Router",
  "type": "n8n-nodes-base.switch",
  "parameters": {
    "rules": { "values": [
      { "outputKey": "text",  "conditions": { "string": [{ "value1": "={{ $json.body.MediaContentType0 }}", "operation": "isEmpty" }] }},
      { "outputKey": "voice", "conditions": { "string": [{ "value1": "={{ $json.body.MediaContentType0 }}", "operation": "startsWith", "value2": "audio/" }] }},
      { "outputKey": "image", "conditions": { "string": [{ "value1": "={{ $json.body.MediaContentType0 }}", "operation": "startsWith", "value2": "image/" }] }}
    ]}
  }
}
```

- text → mevcut akış
- voice → Whisper (`@n8n/n8n-nodes-langchain.transcriptionOpenAi`) → Set body=transcript → mevcut akışa
- image → "Bilder können wir leider nicht verarbeiten. Bitte schreiben Sie kurz, was Sie möchten 📝"

**Beklenen fayda:** Friseur/Kosmetik müşterisi sıkça "bu saç modeli olur mu?" diye fotoğraf yollar — şu an cevapsız kalıyor.

---

### 1.5 Quick Confirmation Buttons (WhatsApp Interactive)

**Pattern adı:** WhatsApp List/Button reply
**Sorun:** "10:00, 11:30, 14:00 uygun, hangisi?" → müşteri "saat 10" / "ilki" / "10:00" gibi 5 farklı format yazıyor → AI bazen yanlış parse ediyor.

`Send WhatsApp Reply` HTTP'sini Cloud API interactive mesajına çevir:

```json
{
  "method": "POST",
  "url": "https://graph.facebook.com/v20.0/{{phone_number_id}}/messages",
  "jsonBody": {
    "messaging_product": "whatsapp",
    "to": "={{ $json.to }}",
    "type": "interactive",
    "interactive": {
      "type": "button",
      "body": { "text": "Ich habe folgende Termine frei. Bitte wählen Sie:" },
      "action": {
        "buttons": [
          { "type": "reply", "reply": { "id": "slot_1", "title": "10:00 Uhr" }},
          { "type": "reply", "reply": { "id": "slot_2", "title": "11:30 Uhr" }},
          { "type": "reply", "reply": { "id": "slot_3", "title": "14:00 Uhr" }}
        ]
      }
    }
  }
}
```

> Twilio kullanıyorsan `MessagingServiceSid` üzerinden `ContentSid` ile content template gönderilir — aynı mantık.

**Beklenen fayda:** Yanlış parse %0, müşteri 1 tıkla onaylar.

---

### 1.6 Conversation Memory'yi Supabase'e Bağla

**Sorun:** Mevcut `memoryBufferWindow` n8n process belleğinde — n8n restart olunca müşterinin geçmişi sıfırlanır.

Çözüm: `Postgres Chat Memory` node'una geç:

```json
{
  "name": "Conversation Memory",
  "type": "@n8n/n8n-nodes-langchain.memoryPostgresChat",
  "parameters": {
    "sessionIdType": "customKey",
    "sessionKey": "={{ $('Extract Message Data').item.json.from }}",
    "tableName": "n8n_chat_histories",
    "contextWindowLength": 10
  },
  "credentials": { "postgres": { "name": "Supabase Postgres" } }
}
```

Supabase SQL:
```sql
create table n8n_chat_histories (
  id bigserial primary key,
  session_id text not null,
  message jsonb not null,
  created_at timestamptz default now()
);
create index on n8n_chat_histories(session_id, created_at);
```

**Beklenen fayda:** Restart-safe, çoklu işletme için sorgulanabilir, analitik için gold mine.

---

### 1.7 Log Every Conversation to Supabase

**Sorun:** Müşteri "neden bu cevabı verdi" diye sorduğunda execution log'u 7 gün sonra siliniyor.

`Send WhatsApp Reply` paralelinde:

```json
{
  "name": "Log Message",
  "type": "n8n-nodes-base.supabase",
  "parameters": {
    "operation": "create",
    "tableId": "conversation_log",
    "fieldsUi": { "fieldValues": [
      { "fieldId": "business_id", "fieldValue": "={{ $('CONFIG').item.json.business_id }}" },
      { "fieldId": "phone",       "fieldValue": "={{ $json.from }}" },
      { "fieldId": "user_msg",    "fieldValue": "={{ $('Extract Message Data').item.json.body }}" },
      { "fieldId": "bot_msg",     "fieldValue": "={{ $json.reply }}" },
      { "fieldId": "intent",      "fieldValue": "={{ $('Parse and Clean').item.json.intent }}" },
      { "fieldId": "tool_calls",  "fieldValue": "={{ JSON.stringify($('AI Agent').item.json.toolCalls) }}" },
      { "fieldId": "latency_ms",  "fieldValue": "={{ Date.now() - $('WhatsApp Inbound').item.json.startedAt }}" }
    ]}
  }
}
```

**Beklenen fayda:** Cost/latency dashboard, müşteri şikayetinde "neyin yanlış gittiğini" 5 saniyede gösterirsin.

---

### 1.8 Workflow'lar Arası Veritabanı Birleştirme

**Sorun:** booking_inbound → Supabase, cal workflow → Airtable. İki yerde session, iki yerde user, iki yerde follow-up.
**Çözüm:** Airtable'daki tabloları Supabase'e taşı (sql migration aşağıda — Bölüm 6.1). cal workflow'daki tüm Airtable node'larını Supabase node'una çevir. Faz 1: paralel yaz. Faz 2: Airtable'ı kapat.

**Beklenen fayda:** Tek kaynak gerçeği, ay €20 Airtable + 2x bakım hatası.

---

### 1.9 Cevap Öncesi Hızlı "Yazıyor..." Göstergesi

**Pattern:** WhatsApp Cloud API `typing_on` indicator (yeni 2025 özelliği) veya sahte "..." mesajı.

```json
{
  "name": "Typing Indicator",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "url": "https://graph.facebook.com/v20.0/{{phone_id}}/messages",
    "jsonBody": {
      "messaging_product": "whatsapp",
      "status": "read",
      "message_id": "={{ $json.body.message_id }}",
      "typing_indicator": { "type": "text" }
    }
  }
}
```

`AI Agent`'ten önce paralel branch olarak çalıştır.

**Beklenen fayda:** Algılanan hız 3x — kullanıcı "okundu" gördüğü için sabreder.

---

### 1.10 Cal.com'da Service Catalog Tool

**Sorun:** AI Agent "Saç kesimi 30€, boyama 75€" gibi fiyat/süre bilgisi varsayıyor (hallucination).
**Çözüm:** Cal.com Event Types listesini tool olarak ekle:

```json
{
  "name": "List Services",
  "type": "@n8n/n8n-nodes-langchain.toolHttpRequest",
  "parameters": {
    "toolDescription": "Lists all available services (haircut, coloring etc.) with duration and price for THIS business. Call this when user asks 'was kostet X' or 'wie lange dauert Y'.",
    "method": "GET",
    "url": "https://api.cal.com/v2/event-types",
    "sendHeaders": true,
    "headerParameters": { "parameters": [
      { "name": "Authorization", "value": "=Bearer {{ $('CONFIG').item.json.calApiKey }}" }
    ]}
  }
}
```

**Beklenen fayda:** Yanlış fiyat = kayıp güven. Gerçek fiyat = kayıp yok.

---

## 2. Orta Vadeli Geliştirmeler (1-2 hafta)

### 2.1 RAG Knowledge Base — FAQ + Salon Bilgileri

**Kaynak:** `Complete business WhatsApp AI-Powered RAG Chatbot using OpenAI.txt` + `Supabase Insertion & Upsertion & Retrieval.txt`

**Sorun:** "Erişebilirlik var mı?", "Park yeri?", "Hijyen önlemleri?", "Çocuk indirimi?", "Boya alerjim var, hangi ürünleri kullanıyorsunuz?" gibi soruları AI uyduruyor.

**Mimari:**
1. **Indexing workflow** (manuel tetik): Google Drive klasöründen müşterinin FAQ/menu/policy PDF'lerini al → Token Splitter → OpenAI Embeddings → Supabase `pgvector` tablosu (`business_id` + chunk + embedding).
2. **Retrieval Tool** AI Agent'a eklenir:

```json
{
  "name": "Search Knowledge Base",
  "type": "@n8n/n8n-nodes-langchain.toolVectorStore",
  "parameters": {
    "name": "knowledge_base",
    "description": "Search this business's FAQ, services, prices, policies, opening hours. Use for any non-booking question."
  }
}
```

```json
{
  "name": "Supabase Vector Store",
  "type": "@n8n/n8n-nodes-langchain.vectorStoreSupabase",
  "parameters": {
    "tableName": "kb_documents",
    "queryName": "match_kb_documents",
    "filter": "={\"business_id\":\"{{ $('CONFIG').item.json.business_id }}\"}"
  }
}
```

Supabase SQL:
```sql
create extension if not exists vector;
create table kb_documents (
  id bigserial primary key,
  business_id uuid not null,
  content text,
  metadata jsonb,
  embedding vector(1536)
);
create index on kb_documents using ivfflat (embedding vector_cosine_ops);

create or replace function match_kb_documents (
  query_embedding vector(1536),
  match_count int default 5,
  filter jsonb default '{}'
) returns table (id bigint, content text, metadata jsonb, similarity float)
language sql stable as $$
  select id, content, metadata, 1 - (embedding <=> query_embedding) as similarity
  from kb_documents
  where metadata @> filter
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

**Etki:** Hallucination ~%80 azalır, müşteri özgüveni artar.

---

### 2.2 Outbound: 24h ve 2h Reminder Cron'u

**Kaynak:** Cal workflow'daki "Every 24hrs" pattern + WhatsApp template message
**Sorun:** No-show oranı %15-25 (sektör ortalaması). 24h ve 2h hatırlatma %50 azaltır.

Yeni workflow `PraxisAI — reminders`:

```
Schedule Trigger (her 30dk)
  → Supabase: SELECT * FROM bookings
       WHERE start_at BETWEEN now()+23h45m AND now()+24h15m
         AND reminder_24h_sent IS NULL
  → Loop: WhatsApp Template "appointment_reminder_24h"
  → Update reminder_24h_sent = now()
```

WhatsApp Template (Meta Business Manager'da onaylatılmalı):
```
Hallo {{1}}, kleine Erinnerung an Ihren Termin morgen um {{2}} Uhr für {{3}}.
Antworten Sie BESTÄTIGEN um zu bestätigen oder VERSCHIEBEN um zu ändern.
```

Aynı workflow 2h reminder için tekrar (`now()+1h45m AND now()+2h15m`).

Reply geldiğinde booking_inbound'da intent="confirm" / "reschedule" branch'i ekle.

---

### 2.3 Reactivation Cron — "3 ay görüşmedik"

**Kaynak:** `cal workflow` Find Follow-Up Candidates pattern
**Hedef:** Friseur müşterisi 6-8 hafta sonra dönmeli; 3 ay görüşmediyse uyarı.

```
Schedule (haftada 1, Salı 10:00)
  → Supabase RPC: get_dormant_customers(business_id, days=90)
  → LLM Chain (Generate Personalized Reactivation Message)
       Prompt: "Customer name {{name}}, last service {{service}} on {{date}}.
                Write 1 sentence German WhatsApp message inviting them back.
                Include a 10% discount code: COMEBACK10. Casual tone, no emoji spam."
  → WhatsApp Template send
  → Mark contacted_at = now()
```

**Beklenen fayda:** Tipik salon için aylık ek %3-5 ciro.

---

### 2.4 Sentiment Analysis + Review Request Akışı

**Kaynak:** `AI Customer feedback sentiment analysis.txt` + `Scrape Trustpilot Reviews with DeepSeek...txt`

Yeni workflow `PraxisAI — post_visit`:

```
Schedule (her saat)
  → Supabase: bookings WHERE end_at < now()-2h AND followup_sent IS NULL
  → WhatsApp: "Wie war Ihr Termin? Antworten Sie 1-5 ⭐ oder einen kurzen Text."
  → Update followup_sent
```

Cevap geldiğinde booking_inbound'a yeni intent:

```json
{
  "name": "Sentiment Classifier",
  "type": "@n8n/n8n-nodes-langchain.textClassifier",
  "parameters": {
    "categories": { "categories": [
      { "category": "positive", "description": "5★, happy, satisfied, will come back" },
      { "category": "neutral",  "description": "3★, okay, average" },
      { "category": "negative", "description": "1-2★, complaint, problem" }
    ]}
  }
}
```

- positive → Send Google Review link: "Vielen Dank! Würden Sie uns mit einer Google-Bewertung helfen? {{review_url}}"
- neutral → "Was können wir besser machen? Ihr Feedback hilft uns."
- negative → Send to owner via Telegram/Email + sakinleştirici WhatsApp + "Wir rufen Sie zurück" + Supabase `complaints` tablosuna

---

### 2.5 Lead Qualification Scoring (mevcut Lead Mail → daha akıllı)

**Kaynak:** `Qualify new leads in Google Sheets via OpenAI's GPT-4.txt`
**Mevcut:** Lead Mail Automation siteyi scrape ediyor → e-posta gönderiyor. Eksik: kalitesizleri filtrelemiyor.

`Build Prompt` öncesine ekle:

```json
{
  "name": "Score Lead",
  "type": "@n8n/n8n-nodes-langchain.chainLlm",
  "parameters": {
    "promptType": "define",
    "text": "Lead: {{ $json.business_name }} — {{ $json.industry }} — {{ $json.website_text }}.\nScore 1-10:\n- Fit (Friseur/Kosmetik/Nagel/Physio/Massage = 10, others lower)\n- Size (1-10 employees ideal)\n- Digital maturity (already has online booking? lower score)\nReturn JSON: { score, reason }",
    "outputParser": "structured"
  }
}
```

Score < 6 → atla. Score >= 6 → mail gönder. CRM'de score sakla → A/B test.

---

### 2.6 Multi-Tenant `business_id` Routing

**Sorun:** Her yeni müşteri için workflow kopyalamak ölçeklenmez. Şu an cal workflow TEMPLATE var ama elle kopyalanıyor.

**Çözüm: Single workflow + business_id lookup**

Tek bir webhook (`/whatsapp-inbound`) tüm müşteriler için. CONFIG node'u dinamik:

```json
{
  "name": "Lookup Business by Phone Number ID",
  "type": "n8n-nodes-base.supabase",
  "parameters": {
    "operation": "getAll",
    "tableId": "businesses",
    "filterType": "manual",
    "matchType": "allFilters",
    "filters": { "conditions": [
      { "keyName": "whatsapp_phone_id", "keyValue": "={{ $json.body.entry[0].changes[0].value.metadata.phone_number_id }}" }
    ]}
  }
}
```

Çıktı: `business_id`, `cal_api_key`, `gcal_id`, `language`, `timezone`, `system_prompt_extra`, `kb_collection`.

Sonraki tüm node'lar `{{ $('Lookup Business').item.json.X }}` kullanır.

Supabase tablosu:
```sql
create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text check (industry in ('friseur','kosmetik','nagel','physio','massage','other')),
  whatsapp_phone_id text unique not null,
  cal_api_key text,
  cal_event_type_id int,
  gcal_calendar_id text,
  language text default 'de',
  timezone text default 'Europe/Berlin',
  system_prompt_extra text,
  active boolean default true,
  plan text default 'starter',
  created_at timestamptz default now()
);
```

---

### 2.7 Subagent Pattern: Booking Agent + FAQ Agent + Smalltalk Agent

**Sorun:** Tek AI Agent her şeyi yapmaya çalışınca sistem promptu 2000 token şişiyor → maliyet + hata.

**Çözüm:** Router Agent → Specialist Agent

```
AI Router Agent (cheap model: gpt-4o-mini / Groq Llama-3.1-8b)
  Tool: route_intent → "booking" | "faq" | "smalltalk" | "complaint" | "human"

Switch on intent:
  booking   → Booking Agent (Cal.com tools, GPT-4o)
  faq       → FAQ Agent (RAG tools, gpt-4o-mini)
  smalltalk → Smalltalk Agent (no tools, Groq)
  complaint → escalate to human (Telegram owner)
  human     → "Wir verbinden Sie. Bitte einen Moment."
```

**Beklenen fayda:** %50 token tasarrufu, daha hızlı yanıt, daha az hata.

---

### 2.8 Konuşma Sonu Tespiti + CRM Update

**Sorun:** Konuşma "Danke, bis morgen!" ile bitiyor ama veritabanında flag yok.

```json
{
  "name": "Is Conversation Ended?",
  "type": "@n8n/n8n-nodes-langchain.textClassifier",
  "parameters": {
    "categories": { "categories": [
      { "category": "ended", "description": "Goodbye, thanks, see you, danke tschüss" },
      { "category": "ongoing" }
    ]}
  }
}
```

ended → Supabase `conversations.ended_at = now()`, summary = (LLM özet) → analytics dashboard.

---

### 2.9 Fiyat A/B Testing (Plan Bazlı LLM Seçimi)

CONFIG'den `plan`'a göre model:
- starter (€29/ay) → Groq Llama-3.1-8b (ucuz, hızlı, biraz hatalı)
- pro (€59/ay) → GPT-4o-mini
- premium (€99/ay) → GPT-4o veya Claude Sonnet 4.6

```json
{
  "model": "={{ {'starter':'llama-3.1-8b-instant','pro':'gpt-4o-mini','premium':'gpt-4o'}[$('CONFIG').item.json.plan] }}"
}
```

---

## 3. Yeni Özellik Fikirleri (Phase 2+)

### 3.1 Sesli Asistan (Vapi / ElevenLabs)
**Kaynak:** `AI Voice Chatbot with ElevenLabs & OpenAI for Customer Service and Restaurants.txt`

- Telefon numarası → Twilio Voice → Vapi/ElevenLabs streaming → aynı booking AI Agent
- Yaşlı müşteriler WhatsApp kullanmıyor — telefon hala #1 kanal Friseur'da
- Maliyet ~€0.20/dk; ortalama çağrı 2dk = €0.40

### 3.2 Embeddable Website Chatbot
**Kaynak:** `Create a Branded AI-Powered Website Chatbot.txt`

- `<script src="https://chat.infinitymade.de/widget.js" data-business="uuid">` 1 satır
- n8n webhook → aynı AI Agent (tool'lar paylaşımlı)
- Her salon kendi sitesinde chat alır + lead kaydeder

### 3.3 Instagram DM Kanalı
**Kaynak:** `AI agent for Instagram DM_inbox. Manychat + Open AI integration.txt`

- Friseur/Kosmetik müşterilerinin %60'ı Instagram'da
- Meta Cloud API (WhatsApp + IG aynı sistem) → tek webhook, kanal=ig branch
- Story reply'ları da yakalanır → "Bu modeli istiyorum" diyene direkt randevu

### 3.4 Google Reviews Otomatik İsteme + Yanıt
**Kaynak:** `Scrape Trustpilot Reviews with DeepSeek...txt`

- Olumlu sentiment'tan sonra direkt Google review link (Bölüm 2.4 içinde mevcut)
- Yeni review geldiğinde Google Business Profile API webhook → AI yanıt taslağı → owner Telegram onay → otomatik post

### 3.5 Konuşmadan Otomatik FAQ Çıkarma
**Pattern:** Cron her hafta `conversation_log` tablosunu tarar → en sık sorulan ama RAG'de cevabı olmayan 5 soruyu owner'a Telegram ile yollar → owner cevaplar → auto-index.

### 3.6 Multi-Language Auto-Detect
- Detect language node → DE/EN/TR/AR/RU
- Owner profile'da dil tercihi yoksa input dilinde cevap ver
- Friseur'larda Almanya'da %30+ müşteri Türkçe/Arapça konuşmak ister

### 3.7 Photo-to-Service-Suggestion
**Pattern:** Müşteri saç/tırnak fotoğrafı yollar → GPT-4 Vision → "Bu balayage ~120€, 3 saat" → randevu öner.

### 3.8 Personel Atama Tool'u
- AI Agent: `assign_staff(service, time, customer_preference)` tool
- Hairdresser X yarın 14:00'da müsait + müşteri "geçen seferki kişi" diyorsa Supabase'de last_staff = X → otomatik tahsis.

### 3.9 No-Show Risk Scoring
- Müşterinin geçmiş no-show oranı + booking lead time + saat → risk skoru
- Skor > 0.7 → 4h önce ekstra reminder + manuel onay isteği

### 3.10 Owner Dashboard Bot (Telegram)
- Sahip Telegram'a `/heute` yazar → "Bugün 8 randevu, 2 iptal, 3 yeni lead, €450 tahmini ciro"
- `/woche` → haftalık özet + sentiment ortalaması

---

## 4. Code Snippet Bankası

### 4.1 Twilio mesaj buffering (Set node, Code alternatif)

Redis yoksa pure Supabase:

```javascript
// Code node: "Buffer Check"
const phone = $input.first().json.from;
const body = $input.first().json.body;
const now = Date.now();

// Supabase: upsert latest message timestamp
await $helpers.httpRequest({
  method: 'POST',
  url: `${$env.SUPABASE_URL}/rest/v1/message_buffer`,
  headers: {
    'apikey': $env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${$env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  },
  body: { phone, last_msg_at: new Date().toISOString(), last_body: body }
});

return [{ json: { phone, body, bufferedAt: now }}];
```

Sonra `Wait 5s` → ikinci sorgu: `last_msg_at` benim yazdığımdan büyükse abort.

### 4.2 Supabase upsert pattern (n8n native node)

```json
{
  "type": "n8n-nodes-base.supabase",
  "parameters": {
    "operation": "upsert",
    "tableId": "user_credits",
    "matchType": "anyFilter",
    "filters": { "conditions": [
      { "keyName": "user_id", "keyValue": "={{ $json.userId }}" }
    ]},
    "fieldsUi": { "fieldValues": [
      { "fieldId": "user_id", "fieldValue": "={{ $json.userId }}" },
      { "fieldId": "credits", "fieldValue": "={{ $json.credits }}" }
    ]}
  }
}
```

### 4.3 Cal.com event-type create (Tool HTTP)

```json
{
  "name": "Create Booking",
  "type": "@n8n/n8n-nodes-langchain.toolHttpRequest",
  "parameters": {
    "toolDescription": "Books an appointment. Required: name, email, start (ISO 8601), eventTypeId.",
    "method": "POST",
    "url": "https://api.cal.com/v2/bookings",
    "sendHeaders": true,
    "headerParameters": { "parameters": [
      { "name": "Authorization", "value": "=Bearer {{ $('CONFIG').item.json.cal_api_key }}" },
      { "name": "cal-api-version", "value": "2024-08-13" }
    ]},
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"start\": \"{{ $fromAI('start_iso') }}\",\n  \"eventTypeId\": {{ $('CONFIG').item.json.cal_event_type_id }},\n  \"attendee\": {\n    \"name\": \"{{ $fromAI('customer_name') }}\",\n    \"email\": \"{{ $fromAI('customer_email','optional') }}\",\n    \"phoneNumber\": \"{{ $('Extract Message Data').item.json.from }}\",\n    \"language\": \"de\",\n    \"timeZone\": \"Europe/Berlin\"\n  }\n}"
  }
}
```

### 4.4 OpenAI Tools / Function calling örneği

AI Agent prompt yerine `$fromAI()` ile tool parametrelerini doldurur:
```
$fromAI('field_name', 'description', 'string|number|boolean')
```

### 4.5 RAG query pattern (Tool Vector Store)

```json
{
  "name": "Knowledge Base",
  "type": "@n8n/n8n-nodes-langchain.toolVectorStore",
  "parameters": {
    "name": "business_kb",
    "description": "Returns information about THIS business: services, prices, hours, policies, FAQ. Use for any question that's not a booking action.",
    "topK": 4
  }
}
```

### 4.6 Structured Output Parser (intent + entities)

```json
{
  "type": "@n8n/n8n-nodes-langchain.outputParserStructured",
  "parameters": {
    "jsonSchemaExample": "{\n  \"intent\": \"book|reschedule|cancel|info|smalltalk|complaint\",\n  \"service\": \"haircut|coloring|...\",\n  \"preferred_date\": \"2026-05-10\",\n  \"preferred_time\": \"14:00\",\n  \"customer_name\": \"...\",\n  \"needs_human\": false\n}"
  }
}
```

### 4.7 WhatsApp Cloud API outbound template

```json
{
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "=https://graph.facebook.com/v20.0/{{ $('CONFIG').item.json.whatsapp_phone_id }}/messages",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "jsonBody": "={\n  \"messaging_product\":\"whatsapp\",\n  \"to\":\"{{ $json.phone }}\",\n  \"type\":\"template\",\n  \"template\":{\n    \"name\":\"appointment_reminder_24h\",\n    \"language\":{\"code\":\"de\"},\n    \"components\":[\n      {\"type\":\"body\",\"parameters\":[\n        {\"type\":\"text\",\"text\":\"{{ $json.name }}\"},\n        {\"type\":\"text\",\"text\":\"{{ $json.time }}\"},\n        {\"type\":\"text\",\"text\":\"{{ $json.service }}\"}\n      ]}\n    ]\n  }\n}"
  }
}
```

### 4.8 Postgres Chat Memory bağlantısı

Bölüm 1.6'daki snippet kullanılır.

### 4.9 Error handler workflow signature

Workflow → Settings → Error Workflow: `error_handler`. Her workflow'da set et.

### 4.10 Sentiment classifier (mini)

```json
{
  "type": "@n8n/n8n-nodes-langchain.textClassifier",
  "parameters": {
    "inputText": "={{ $json.body }}",
    "categories": { "categories": [
      {"category":"positive"},{"category":"neutral"},{"category":"negative"}
    ]}
  }
}
```

---

## 5. PraxisAI'ya Eklenecek Yeni Workflow'lar

| # | Workflow Adı | Tetikleyici | Kısa açıklama |
|---|---|---|---|
| 1 | `praxisai_error_handler` | Error Trigger | Tüm workflow hatalarını yakalar, müşteriye fallback yollar, Supabase'e log yazar, Telegram owner'a uyarı atar |
| 2 | `praxisai_reminders` | Schedule (her 30dk) | 24h ve 2h önce randevu hatırlatma (WhatsApp template) |
| 3 | `praxisai_post_visit` | Schedule (her saat) | Randevu sonrası "Wie war Ihr Termin?" + sentiment analiz + Google Review isteği |
| 4 | `praxisai_reactivation` | Schedule (haftada 1) | 90 gün sessiz müşterilere kişiselleştirilmiş geri çağırma + indirim kodu |
| 5 | `praxisai_kb_indexer` | Manuel + GDrive trigger | Müşterinin FAQ/menu/policy dokümanlarını Supabase pgvector'e indexler |
| 6 | `praxisai_owner_telegram_bot` | Telegram Trigger | `/heute`, `/woche`, `/iptal X`, `/yeni-tatil` gibi owner komutları |
| 7 | `praxisai_voice_inbound` | Twilio Voice webhook | Vapi/ElevenLabs streaming → aynı AI Agent → telefon randevuları |
| 8 | `praxisai_website_chat` | Webhook (widget.js) | Embeddable site chatbot, aynı tool'ları kullanır, lead'i CRM'e yazar |
| 9 | `praxisai_instagram_dm` | Meta webhook (IG channel) | Instagram DM + Story reply → randevu akışı |
| 10 | `praxisai_review_responder` | Google Business webhook + Cron | Yeni review → AI taslak yanıt → owner onay → publish |
| 11 | `praxisai_no_show_predictor` | Schedule (saatlik) | Yüksek riskli randevulara ek onay isteği yollar |
| 12 | `praxisai_weekly_report` | Schedule (Pazartesi 08:00) | Sahibin haftalık raporu (gelir, no-show, sentiment, top hizmetler) — Email + Telegram |
| 13 | `praxisai_billing_sync` | Stripe webhook | Plan upgrade/downgrade → businesses.plan kolonu güncelle → model seçimi değişir |
| 14 | `praxisai_kb_gap_detector` | Schedule (haftada 1) | conversation_log tarar, RAG'de cevap bulunmayan en sık 5 soruyu owner'a yollar |

---

## 6. Mimari Öneriler

### 6.1 Veritabanı Birleştirme — Tek Supabase Şeması

```sql
-- Müşteri işletmeler (multi-tenant root)
create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  whatsapp_phone_id text unique,
  cal_api_key text,
  cal_event_type_id int,
  gcal_calendar_id text,
  language text default 'de',
  timezone text default 'Europe/Berlin',
  system_prompt_extra text,
  plan text default 'starter',
  active boolean default true,
  created_at timestamptz default now()
);

-- Son müşteri (end-user)
create table customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  phone text not null,
  name text,
  email text,
  language text,
  opted_in boolean default false,
  opted_in_at timestamptz,
  blocked boolean default false,
  no_show_count int default 0,
  total_visits int default 0,
  last_visit_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  unique(business_id, phone)
);

-- Konuşma logu (her mesaj 1 satır)
create table conversation_log (
  id bigserial primary key,
  business_id uuid references businesses(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  direction text check (direction in ('inbound','outbound')),
  channel text default 'whatsapp',
  user_msg text,
  bot_msg text,
  intent text,
  tool_calls jsonb,
  latency_ms int,
  model text,
  cost_usd numeric(10,6),
  created_at timestamptz default now()
);
create index on conversation_log (business_id, created_at desc);
create index on conversation_log (customer_id, created_at desc);

-- Randevular (mirror Cal.com için cache)
create table bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id),
  customer_id uuid references customers(id),
  cal_booking_id bigint unique,
  service text,
  staff text,
  start_at timestamptz,
  end_at timestamptz,
  status text check (status in ('confirmed','cancelled','no_show','completed','rescheduled')),
  reminder_24h_sent timestamptz,
  reminder_2h_sent timestamptz,
  followup_sent timestamptz,
  sentiment text,
  rating int,
  feedback text,
  created_at timestamptz default now()
);
create index on bookings (start_at);
create index on bookings (business_id, status);

-- RAG knowledge base (pgvector)
create extension if not exists vector;
create table kb_documents (
  id bigserial primary key,
  business_id uuid references businesses(id) on delete cascade,
  source text,
  content text,
  metadata jsonb,
  embedding vector(1536),
  created_at timestamptz default now()
);
create index on kb_documents using ivfflat (embedding vector_cosine_ops);

-- LangChain memory
create table n8n_chat_histories (
  id bigserial primary key,
  session_id text not null,
  message jsonb not null,
  created_at timestamptz default now()
);
create index on n8n_chat_histories (session_id, created_at);

-- Hata log
create table error_log (
  id bigserial primary key,
  workflow_id text,
  workflow_name text,
  node_name text,
  error_message text,
  context jsonb,
  customer_phone text,
  created_at timestamptz default now()
);

-- Mesaj buffer (Redis yoksa)
create table message_buffer (
  phone text primary key,
  business_id uuid,
  last_msg_at timestamptz,
  last_body text
);

-- Şikayetler
create table complaints (
  id uuid primary key default gen_random_uuid(),
  business_id uuid,
  customer_id uuid,
  message text,
  resolved boolean default false,
  resolved_at timestamptz,
  created_at timestamptz default now()
);
```

### 6.2 Workflow Hiyerarşisi (parent / child)

```
┌─ praxisai_inbound_router  (TEK webhook /whatsapp-in)
│    → Lookup Business → Buffer Check → Switch (text/voice/image)
│    → Execute Workflow node:
│         ├─ praxisai_booking_agent (subworkflow)  — randevu intent
│         ├─ praxisai_faq_agent      (subworkflow) — bilgi intent
│         ├─ praxisai_complaint_flow (subworkflow) — şikayet
│         └─ praxisai_smalltalk      (subworkflow)
│
├─ praxisai_outbound_dispatcher  (TEK Twilio/WA send node burada)
│    → tüm child workflow'lar buraya çağırır (consistency + rate limit)
│
├─ praxisai_error_handler  (Error Trigger, hepsine bağlı)
└─ praxisai_observability  (her workflow'tan log yutar)
```

**Faydası:**
- Yeni feature = yeni subworkflow, ana akışı bozmaz
- Bir AI prompt değişikliği = 1 yerde, tüm tenant'lara yayılır
- Test workflow'u prod'tan ayrı (sadece subworkflow ID değişir)

### 6.3 Webhook Endpoint Stratejisi

**Şu an muhtemelen:** Her workflow'un kendi webhook URL'i, müşteri başına farklı.

**Önerilen tek endpoint:**
- `https://n8n.infinitymade.de/webhook/whatsapp-in` → tüm WA inbound (Meta Cloud API)
- `https://n8n.infinitymade.de/webhook/voice-in` → Twilio Voice
- `https://n8n.infinitymade.de/webhook/web-chat` → Site widget
- `https://n8n.infinitymade.de/webhook/ig-in` → Instagram DM
- `https://n8n.infinitymade.de/webhook/cal-event` → Cal.com → bookings tablosu sync
- `https://n8n.infinitymade.de/webhook/stripe` → billing

Müşteri = `whatsapp_phone_id` ile DB'den lookup; URL standart.

### 6.4 Hata Yönetimi / Retry

| Senaryo | Strateji |
|---|---|
| Groq/OpenAI 5xx | n8n built-in retry (3x, exponential), sonra Error Workflow → fallback Twilio |
| Cal.com 5xx | Retry 2x → eğer hala fail: müşteriye "Wir prüfen kurz, bitte 1 Min Geduld" + Telegram owner alarm |
| Twilio rate limit | Outbound dispatcher'da queue (Redis BLPOP veya Supabase queue) |
| Webhook signature fail | 401 dön + log ama sessizce |
| Whisper transcription empty | "Wir konnten Sie leider nicht verstehen, bitte schreiben Sie kurz" |
| Database deadlock | Supabase RPC içinde `SELECT FOR UPDATE SKIP LOCKED` |

### 6.5 Observability

Her workflow'a "Log Execution" pattern:
```
End of flow → Set { workflow, business_id, customer_id, latency, cost, success }
            → Supabase execution_log insert
```

Metabase / Grafana → `execution_log` üzerinde dashboard:
- p50/p95 latency per workflow
- Cost per business per day
- Error rate
- Booking conversion (mesaj → randevu)

### 6.6 Skalabilite Notları

- **Concurrent execution:** booking_inbound'da `Wait 5s` execution'ları işgal eder. n8n queue mode (Bull) + Redis kullan, BullMQ worker sayısını arttır.
- **Memory leak riski:** Window Buffer Memory yerine Postgres Chat Memory (Bölüm 1.6).
- **Rate limit:** WhatsApp Cloud API 80 msg/sn per number; Supabase'e çıkış kuyruğu yaz, dispatcher saniyede max 60.
- **Cost cap per business:** `businesses.monthly_token_budget` kolonu, agent çağrısından önce kontrol et — aşıyorsa "free tier exceeded" mesajı.

### 6.7 Test / Staging Ortamı

- `n8n-staging.infinitymade.de` ayrı n8n instance
- Webhook URL'leri Meta Cloud API'da farklı number_id ile staging'e bağlı (test telefon)
- Supabase → ayrı schema (`staging.*`) veya ayrı project
- Her workflow için pin data kullan, küçük testleri prod'a çıkmadan dene

### 6.8 Güvenlik Checklist

- [ ] Webhook'larda `verify_token` ile signature doğrulama (Meta için zorunlu)
- [ ] Supabase RLS aktif, `business_id` her sorguda filtrelenmeli
- [ ] Cal.com API key'i CONFIG'de değil, n8n credentials'ta + her business kendi credential'ı
- [ ] Service role key'i sadece n8n container'da env var, log'a düşmesin
- [ ] PII (telefon, isim) log'larda maskelenmeli (last 4 digit göster)
- [ ] DSGVO: 12 ay sonra `conversation_log` otomatik anonimleştir (cron + UPDATE)
- [ ] Opt-in tablosunda kanıt sakla (zaman + IP/device fingerprint)

---

## 7. Yol Haritası (öneri sıralama)

### Hafta 1 — Stabilite
1. Error handler workflow (1.3)
2. STOP/HELP keyword routing (1.2)
3. Voice/image fallback (1.4)
4. Conversation log to Supabase (1.7)

### Hafta 2 — Kalite
5. Mesaj buffering (1.1)
6. Postgres chat memory (1.6)
7. Cal.com service catalog tool (1.10)
8. Quick reply buttons (1.5)

### Hafta 3-4 — Para
9. 24h/2h reminders workflow (2.2)
10. Post-visit + sentiment + Google review (2.4)
11. Reactivation cron (2.3)

### Hafta 5-6 — Ölçek
12. Veritabanı birleştirme (1.8 + 6.1)
13. Multi-tenant routing (2.6)
14. RAG knowledge base (2.1)
15. Subagent router (2.7)

### Hafta 7+ — Yeni kanal/özellik
16. Owner Telegram bot (5.6)
17. Embeddable site chatbot (3.2)
18. Instagram DM (3.3)
19. Voice (3.1)
20. Weekly report + observability (5.12 + 6.5)

---

## 8. Pattern Bankası — Hızlı Referans Tablosu

Tüm önerilerin kaynak dosyaları (`267 otomasyon` klasörü):

| # | Dosya | Kullanım Yeri |
|---|---|---|
| ⭐ | Enhance Customer Chat by Buffering Messages with Twilio and Redis | 1.1 buffering |
| ⭐ | Handling Appointment Leads and Follow-up With Twilio, Cal.com and AI | 1.2 STOP, 2.3 follow-up |
| ⭐ | Complete business WhatsApp AI-Powered RAG Chatbot using OpenAI | 2.1 RAG |
| ⭐ | Supabase Insertion & Upsertion & Retrieval | 4.2, 6.1 |
| ⭐ | AI-Driven Lead Management and Inquiry Automation with ERPNext & n8n | 2.5 lead scoring |
|   | AI Customer feedback sentiment analysis | 2.4 sentiment |
|   | Scrape Trustpilot Reviews with DeepSeek, Analyze Sentiment with OpenAI | 2.4, 3.4 review |
|   | AI Voice Chatbot with ElevenLabs & OpenAI for Customer Service | 3.1 voice |
|   | Create a Branded AI-Powered Website Chatbot | 3.2 widget |
|   | AI agent for Instagram DM_inbox. Manychat + Open AI integration | 3.3 IG |
|   | Qualify new leads in Google Sheets via OpenAI's GPT-4 | 2.5 |
|   | Qualifying Appointment Requests with AI & n8n Forms | 2.7 router |
|   | Suggest meeting slots using AI | 1.10 Cal.com tool |
|   | AI Agent _ Google calendar assistant using OpenAI | mevcut booking_inbound benzeri |
|   | Telegram Bot with Supabase memory and OpenAI assistant integration | 5.6 owner bot |
|   | Building Your First WhatsApp Chatbot | onboarding referansı |
|   | Respond to WhatsApp Messages with AI Like a Pro! | typing indicator + buttons |
|   | RAG Chatbot for Company Documents using Google Drive and Gemini | 2.1 alternatif |
|   | A Very Simple Human in the Loop Email Response System Using AI | 3.4 review approval |
|   | AI-Powered Email Automation for Business: Summarize & Respond with RAG | Lead Mail upgrade |
|   | Enhance Customer Chat... | mesaj buffer (tekrar) |

---

## 9. Sonuç

PraxisAI bugünkü haliyle **fonksiyonel bir MVP** — randevu alıyor, opt-in yönetiyor, follow-up yapıyor. Ancak küçük servis işletmeleri pazarında rekabetçi kalmak için 3 katmanda ilerlemeli:

1. **Sağlamlaştır** (1-2 hafta): Hata yönetimi, buffering, log — şu an sessiz hatalar var.
2. **Para kazandır** (3-4 hafta): Reminder, reactivation, review akışları — bunlar müşterinin doğrudan ROI gördüğü yerler.
3. **Ölçeklendir** (5-8 hafta): Multi-tenant, RAG, subagent — 1'den 50 müşteriye geçiş için zorunlu.

Phase 2'de yeni kanallar (voice, IG, web widget) eklenince PraxisAI **WhatsApp randevu botu** olmaktan çıkıp **küçük işletme AI resepsiyonisti** kategorisine geçer — fiyatlama da €29-99/ay aralığında haklı çıkar.

---

*Son güncelleme: Mayıs 2026 | Cheat-sheet versiyonu: 1.0*
