# Keka HR Integration (Leave & Public Holidays)

The app can use **Keka** to respect employee leave and office public holidays (US and India) when finding the next available meeting slot. If Keka is configured, the system will skip days when either the reporter or the employee is on leave or when the date is a public holiday for their office.

## What is used from Keka

- **Leave requests** – Approved leave for an employee (by Keka employee ID).
- **Holiday calendars** – One calendar for US office holidays and one for India office holidays. Only dates in the relevant calendar are treated as holidays (based on the user’s `country` in the app).

## Requirements

1. **Keka API access** – Create an app in the [Keka Developer Portal](https://developers.keka.com/) to get:
   - Client ID
   - Client secret
   - API key

2. **Holiday calendars in Keka** – Create or use existing holiday calendars (e.g. “US Office”, “India Office”) and note their **calendar IDs** (UUIDs). You can get calendar IDs from: **Keka → Time → Holiday Calendar**, or via the API: `GET /time/holidayscalendar`.

3. **Employee mapping** – Each user in the app who should have leave checked must have their **Keka employee ID** set (see below). You can find Keka employee IDs in Keka (employee profile) or via the API: `GET /hris/employees` or `POST /hris/employees/search` (e.g. by email).

## Environment variables

Add to `.env`:

```env
# Keka API (optional – if not set, leave/holiday checks are skipped)
KEKA_COMPANY=yourcompany
KEKA_ENVIRONMENT=keka
KEKA_CLIENT_ID=...
KEKA_CLIENT_SECRET=...
KEKA_API_KEY=...

# Holiday calendar UUIDs from Keka (optional)
KEKA_HOLIDAY_CALENDAR_ID_US=...
KEKA_HOLIDAY_CALENDAR_ID_IN=...
```

- **KEKA_COMPANY** – Your Keka subdomain (e.g. `acme` for `acme.keka.com`).
- **KEKA_ENVIRONMENT** – `keka` (production) or `kekademo` (sandbox). Default: `keka`.
- **KEKA_HOLIDAY_CALENDAR_ID_US** – UUID of the US office holiday calendar in Keka.
- **KEKA_HOLIDAY_CALENDAR_ID_IN** – UUID of the India office holiday calendar in Keka.

## User setup

- **Country** – Set each user’s **Country** (e.g. `US` or `IN`) in their profile. This decides which holiday calendar is used (US vs India).
- **Keka Employee ID** – For leave to be considered, the user must have **Keka Employee ID** set. Super Admins can set this in User Management when editing a user (if the field is exposed). The value must match the employee ID in Keka (UUID from `GET /hris/employees` or from the employee’s profile in Keka).

If **Keka Employee ID** is blank, only public holidays (for their country) are considered; leave from Keka is not checked.

## Where it’s used

- **Recurring meeting availability** – When finding the “first free” occurrence, dates are skipped if either the reporter or the employee has that day as a holiday or approved leave in Keka.
- **Creating a new recurring schedule** – The first occurrence is chosen by skipping dates that are holiday/leave for either party.
- **One-time meeting – pick a date** – If the chosen date is a holiday or either person is on leave (from Keka), the API returns no slots and a message asking to pick another day.

## API details (for reference)

- **Token:** `POST https://login.keka.com/connect/token` (or `login.kekademo.com` for sandbox)  
  Body: `grant_type=kekaapi&scope=kekaapi&client_id=...&client_secret=...&api_key=...`
- **Holidays:** `GET https://{company}.keka.com/api/v1/time/holidayscalendar/{calendarId}/holidays?calendarYear=YYYY`
- **Leave:** `GET https://{company}.keka.com/api/v1/time/leaverequests?employeeIds=id1,id2&from=...&to=...`  
  Only **approved** leave (status = 1) is treated as unavailable. Date range max 90 days.

Rate limit: 50 requests per minute.

## Adding Keka Employee ID to user edit (admin)

To let Super Admins set **Keka Employee ID** when editing a user:

1. Add an optional “Keka Employee ID” field in the User Management edit form.
2. Save it to `User.kekaEmployeeId` in the PATCH API.

Once set, leave for that user will be considered when checking availability.
