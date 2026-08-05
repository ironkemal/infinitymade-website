# n8n Workflow — Cal.com → Custom Calendar API Migration

> n8n workflow'undaki Cal.com tool'larını kendi calendar API'mıza geçirme rehberi.
>
> **Önkoşul:** `business_id` AI Agent'ın CONFIG node'unda mevcut olmalı (Twilio'dan Supabase Vault'a lookup'la geliyor zaten).

---

## 🔄 Tool karşılığı

| Eski (Cal.com) | Yeni (kendi API) |
|---|---|
| `list_services` (cal.com/v2/event-types) | Supabase `services` tablosu |
| `check_availability` (cal.com slots) | `POST /api/booking/get-slots` |
| `create_booking` (cal.com/v2/bookings) | `POST /api/booking/create` |

---

## 1️⃣ list_services tool

n8n'de **Edit Tool: list_services** node'unu aç, parametreleri şöyle güncelle:

```json
{
  "name": "list_services",
  "type": "@n8n/n8n-nodes-langchain.toolHttpRequest",
  "parameters": {
    "toolDescription": "Lists all services (haircut, coloring etc.) with duration and price for THIS business. Call when user asks 'was kostet X', 'wie lange dauert Y', or 'was bietet ihr an'.",
    "method": "GET",
    "url": "=https://njvuclullotbksskpwgk.supabase.co/rest/v1/services?owner_id=eq.{{ $('CONFIG').item.json.business_id }}&select=id,title,duration_minutes,price,is_online_meeting",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "apikey", "value": "={{ $('CONFIG').item.json.supabase_service_role_key }}" },
        { "name": "Authorization", "value": "=Bearer {{ $('CONFIG').item.json.supabase_service_role_key }}" }
      ]
    }
  }
}
```

**Önemli:** Vault'tan `supabase_service_role_key` config'e gelmiyorsa, n8n credentials'ında bir HTTP Header Auth oluşturup ortak kullan. Anon key DEĞİL — RLS bypass için service-role gerekli.

---

## 2️⃣ get_available_slots tool

```json
{
  "name": "get_available_slots",
  "type": "@n8n/n8n-nodes-langchain.toolHttpRequest",
  "parameters": {
    "toolDescription": "Returns available time slots for a date in HH:MM format (Berlin time). Call BEFORE booking to confirm slot is free. Required: serviceId (from list_services), date (YYYY-MM-DD).",
    "method": "POST",
    "url": "https://n8n.infinitymade.de/api/booking/get-slots",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Content-Type", "value": "application/json" }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"userId\": \"{{ $('CONFIG').item.json.business_id }}\",\n  \"date\": \"{{ $fromAI('date', 'Date in YYYY-MM-DD format') }}\",\n  \"duration\": {{ $fromAI('duration_minutes', 'Service duration in minutes — get from list_services result', 'number') }}\n}"
  }
}
```

**Note:** `userId` field bizim API'da çalışan ID'sidir. Solopreneur için ownerId == employeeId, o yüzden `business_id` direkt geçiyoruz. Multi-employee aşamasında "hangi çalışanla?" sorusu eklenecek.

---

## 3️⃣ create_booking tool

```json
{
  "name": "create_booking",
  "type": "@n8n/n8n-nodes-langchain.toolHttpRequest",
  "parameters": {
    "toolDescription": "Books an appointment for the customer. Call ONLY after confirming slot via get_available_slots and reading back the time + service to the customer for confirmation. Returns booking ID on success.",
    "method": "POST",
    "url": "https://n8n.infinitymade.de/api/booking/create",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Content-Type", "value": "application/json" }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"ownerId\": \"{{ $('CONFIG').item.json.business_id }}\",\n  \"userId\": \"{{ $('CONFIG').item.json.business_id }}\",\n  \"serviceId\": \"{{ $fromAI('service_id', 'UUID of service from list_services') }}\",\n  \"date\": \"{{ $fromAI('date', 'YYYY-MM-DD, must match slot from get_available_slots') }}\",\n  \"time\": \"{{ $fromAI('time', 'HH:MM in Berlin time, must be from get_available_slots response') }}\",\n  \"customerName\": \"{{ $fromAI('customer_name') }}\",\n  \"customerEmail\": \"{{ $fromAI('customer_email', 'Optional', 'string') }}\",\n  \"customerPhone\": \"{{ $('Extract Message Data').item.json.from }}\"\n}"
  }
}
```

**Hata durumları (AI prompt'una eklenmesi gereken):**
- HTTP **409**: Slot başka biri tarafından alındı → "Tut mir leid, dieser Slot wurde gerade gebucht. Möchten Sie einen anderen wählen?"
- HTTP **400**: Eksik alan → AI tekrar sorar
- HTTP **500**: Sistem hatası → "Es gab ein technisches Problem. Bitte versuchen Sie es in 5 Minuten erneut."

---

## 4️⃣ AI Agent system prompt güncellemesi

Mevcut prompt'ta Cal.com'a referans varsa kaldır. Yeni booking flow:

```
TOOL USAGE FLOW:
1. Customer asks for appointment → call list_services (get serviceId, duration_minutes, price)
2. Confirm service with customer → which one do they want?
3. Get desired date → call get_available_slots(serviceId, date, duration_minutes)
4. Read back available times → "Heute habe ich 10:30, 14:00 oder 16:30 frei. Welche Zeit passt?"
5. Customer picks → call create_booking with EXACTLY that time string
6. On 409 error: apologize, call get_available_slots again, offer new times
7. Confirm booking ID to customer
```

**Önemli:** AI'ya zaman birimi konusunda net olmasını söyle. Tüm zamanlar **Europe/Berlin** local. UTC dönüşümü server'da otomatik yapılıyor.

---

## 5️⃣ Cal.com kalıntılarını silmek

n8n'de:
- ❌ Eski `list_event_types` tool
- ❌ Eski Cal.com `create_booking` tool (yenisini ekledikten sonra)
- ❌ `CONFIG` node'unda `cal_api_key`, `cal_event_type_id` field'ları (Vault tarafında bırakılabilir, sadece n8n'de kullanma)

Supabase tarafı:
```sql
-- profiles tablosundaki cal_username ve cal_link field'ları artık kullanılmıyor
-- Production'da boş bırak, sonradan migration ile sil:
-- ALTER TABLE profiles DROP COLUMN cal_username;
-- ALTER TABLE profiles DROP COLUMN cal_link;
```

---

## 🧪 Test akışı

1. Twilio sandbox'tan WhatsApp bot'a yaz: "Welche Services gibt es?"
2. Bot `list_services` çağırır → services dönmeli
3. "Haarschnitt für morgen 14 Uhr" yaz
4. Bot `get_available_slots` → "14:00 ist frei, soll ich buchen?"
5. "Ja" yaz → bot `create_booking` çağırır → booking ID döner
6. Supabase `bookings` tablosunda yeni satır → `start_time` UTC, Berlin local 14:00'a karşılık geliyor

Hata olursa `pm2 logs calendar-api` ile backend logları kontrol.

---

*Bu migration sadece tool layer'ı değiştirir — AI Agent, memory, opt-in flow, intent router gibi diğer her şey aynı kalır.*
