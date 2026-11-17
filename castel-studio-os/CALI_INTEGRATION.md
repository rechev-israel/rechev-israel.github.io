# Cali ↔ CASTEL STUDIO OS — Integration

## 1. What we found (public sources only)

| Option | Status | Evidence |
|---|---|---|
| Official API | **Not available / not documented** | No developer docs on the App Store listing, the privacy policy or the web. |
| Authorised Firebase access | **Not available to the business owner** | `cali-b5f0e.web.app` is a Flutter web app on a Firebase project owned by the Cali developer. A public booking link is **not** database access, and using the app's embedded Firebase config to read data would bypass Cali's access controls — we don't do that. Access requires the vendor to grant it (e.g. a scoped service account). |
| Webhooks | **Not documented** | — |
| Export | **Not documented** | The app has an in-app reports dashboard; an export would need to be confirmed with the vendor. |
| Calendar sync | **To confirm** | Cali advertises "sync with the service provider's calendar". If this is Google Calendar, a read-only Google Calendar connection (authorised by you) is a possible fallback. |

Vendor: Yonatan Cohen · https://caliapp.co.il · contact listed in the privacy policy: `yonatandev147@gmail.com`.

## 2. What is already built on our side

- **Signed sync endpoint** (live, inactive until a secret is set): `POST https://castel-studio-delta.vercel.app/api/integrations/cali/webhook`
- **Duplicate-free CSV import**: Bookings → "ייבוא מאפליקציית התורים".
- **Sync core** shared by both: idempotent upserts, customer matching (Cali id → phone → create), status/cancellation mapping, revenue booked once per completed appointment, a sync log, per-event error isolation, read-only (never writes back to Cali).
- Synced appointments automatically appear in the dashboard, CRM history, finance, analytics and the reminder automation.

## 3. Credentials and permissions — what you provide, and how

| Item | Who creates it | Where it goes |
|---|---|---|
| `CALI_WEBHOOK_SECRET` (random, 32+ chars) | You (iPhone Passwords app → generate) | 1) Vercel → Settings → Environment Variables (Production). 2) Shared with the Cali developer **once**, over a private channel (e.g. a direct phone call or an end-to-end-encrypted chat). **Never in our chat, email threads or GitHub.** |
| Cali vendor agreement | You (send the request below) | Their confirmation that they will push events for business `aeKiKr0vCLX` |
| *(Alternative)* Scoped read-only access granted by the vendor (API key or Firebase service account) | Cali developer | Saved via the secure credential form / Vercel env vars — never pasted in chat |

Nothing is needed from your Cali login password, and you should not share it.

## 4. Technical spec for the Cali developer

**Transport:** HTTPS `POST` to the URL above, `Content-Type: application/json`, max 500 events per request.

**Authentication:** headers
- `X-Castel-Timestamp`: Unix seconds
- `X-Castel-Signature`: `sha256=` + hex(HMAC-SHA256(secret, `${timestamp}.${rawBody}`))

Requests older than 5 minutes are rejected (replay protection). Retries are safe — processing is idempotent.

**Body:**
```json
{
  "events": [
    { "type": "appointment.upsert", "data": {
        "id": "CALI_APPOINTMENT_ID",
        "startsAt": "2026-11-20T10:30:00+02:00",
        "endsAt": "2026-11-20T11:15:00+02:00",
        "status": "scheduled | confirmed | completed | cancelled | no_show",
        "price": 110,
        "service": { "id": "CALI_SERVICE_ID", "name": "תספורת גבר" },
        "staffName": "שם הספר",
        "customer": { "id": "CALI_CUSTOMER_ID", "name": "ישראל ישראלי", "phone": "0501234567", "email": null },
        "updatedAt": "2026-11-17T09:00:00Z"
    } },
    { "type": "appointment.cancelled", "data": { "id": "CALI_APPOINTMENT_ID", "reason": "ביטול לקוח" } },
    { "type": "customer.upsert", "data": { "id": "CALI_CUSTOMER_ID", "name": "ישראל ישראלי", "phone": "0501234567" } }
  ]
}
```

**When to send:** on every create / update / cancel, plus an optional nightly full re-send of the next 30 days (safe — no duplicates).

**Responses:** `200` with counts · `401` bad signature/stale · `422` validation (details returned) · `429` rate limited · `503` not configured.

## 5. Ready-to-send request (Hebrew — copy from iPhone)

> שלום יונתן,
> אני בעל העסק CASTEL STUDIO באשקלון ומשתמש ב-Cali (מזהה עסק aeKiKr0vCLX).
> אני מחבר את Cali למערכת ניהול עסקית פנימית, ומבקש לקבל את נתוני העסק שלי (תורים, ביטולים, לקוחות ושירותים) באחת מהדרכים הבאות:
> 1. Webhook: שליחת אירועים חתומים (HMAC-SHA256) לכתובת https://castel-studio-delta.vercel.app/api/integrations/cali/webhook — מפרט מלא מצורף.
> 2. או API לקריאה בלבד / ייצוא CSV תקופתי של התורים.
> 3. או לאשר שהסנכרון ליומן הוא ל-Google Calendar.
> את המפתח הסודי לחתימה אמסור לך בשיחה ישירה.
> תודה!

## 6. Data mapping

| Cali | CASTEL STUDIO OS |
|---|---|
| appointment id | `Appointment.externalRef` (unique per business + source `cali`) |
| customer id / phone | `Customer.externalRef = cali:<id>`, else matched by normalised Israeli phone |
| service id / name | `Service.externalRef = cali:<id>`, else matched by name (unknown services are not auto-created; the name is kept in notes) |
| status | scheduled/confirmed/completed/cancelled/no_show (Hebrew labels supported) |
| price on completed | one `ACTUAL` income transaction `appointment:<id>`; removed if the appointment leaves completed |
| availability | Not exposed by Cali today. Our opening hours stay manual until the vendor provides it. |

## 7. Not done on purpose

- No scraping, no use of Cali's embedded Firebase keys, no login automation.
- No write-back to Cali (single source of truth for bookings stays in Cali).
- Historical appointments synced from Cali do **not** trigger post-visit message automations (prevents message floods on first import). Reminder automation does include future Cali appointments, with owner approval as always.
