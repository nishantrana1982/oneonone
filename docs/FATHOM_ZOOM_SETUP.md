# Fathom + Zoom: automatic transcript in the app

This app supports a **direct Fathom webhook** so that when you run one-on-ones over Zoom with [Fathom](https://fathom.video) in the call, the transcript and summary are sent to the app and attached to the right meeting automatically.

---

## 1. Prerequisites

- Paid [Fathom](https://fathom.video/home) account.
- One-on-ones scheduled in this app as **Over Zoom** with a Zoom link (optional but recommended for reliable matching).

---

## 2. Configure the webhook in Fathom

1. In Fathom, go to **Settings** → **API Access** (or [fathom.video/customize#api-access-header](https://fathom.video/customize#api-access-header)).
2. Under **Webhooks**, click **Add Webhook** (or **Manage** → **Add Webhook**).
3. Set **Destination URL** to:
   ```text
   https://YOUR_APP_DOMAIN/api/integrations/fathom/webhook
   ```
   Example: `https://app.yourcompany.com/api/integrations/fathom/webhook`
4. Choose what to send:
   - **Transcript** – on
   - **Summary** – on
   - **Action items** – on (recommended)
5. Choose which recordings trigger the webhook (e.g. “Your recordings” or “Recordings shared with you”).
6. Save and copy the **Webhook secret** (it looks like `whsec_...`). You will add this to your app environment.

---

## 3. Add the webhook secret to the app

Set the following environment variable on the server where the app runs (e.g. in `.env` or your hosting env config):

```env
FATHOM_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Use the exact secret from Fathom. Restart the app after changing env vars.

---

## 4. How matching works

The app matches each Fathom webhook to a meeting in two ways:

1. **By Zoom meeting ID (best)**  
   When you create or edit a meeting and choose **Over Zoom**, paste the Zoom join link (e.g. `https://zoom.us/j/12345678901`) in the **Zoom meeting link** field. The app stores the Zoom meeting ID. When Fathom sends the webhook for that Zoom call, the app finds the meeting by this ID and attaches the transcript/summary.

2. **By date + participants**  
   If no Zoom meeting ID is stored, the app looks for a Zoom meeting on the same calendar day whose reporter and employee emails appear in the Fathom payload (e.g. from calendar invitees or transcript speakers). If exactly one such meeting exists, it is used.

So for the most reliable link:

- Schedule the meeting in the app as **Over Zoom**.
- Paste the **Zoom join URL** in the meeting (or in the recurring schedule if it’s always the same link).

---

## 5. Run a Zoom one-on-one with Fathom

1. Schedule a one-on-one in the app, set type to **Over Zoom**, and paste the Zoom link.
2. Start the Zoom meeting as usual. Ensure Fathom is enabled (Fathom bot joins when you use the Fathom Chrome extension or Fathom’s Zoom integration).
3. After the meeting ends, Fathom processes the recording and sends the webhook to your app.
4. In the app, open the meeting; the **Recording** section will show the Fathom transcript and summary (and action items if you enabled them). No need to click “Start recording” in the app.

---

## 6. Troubleshooting

- **Transcript never appears**  
  - Confirm the webhook URL is correct and the app is reachable from the internet (no firewall blocking Fathom).  
  - Confirm `FATHOM_WEBHOOK_SECRET` is set and matches the secret in Fathom.  
  - In Fathom, check that the webhook was triggered (e.g. “Recent deliveries” or logs if available).  
  - If you didn’t paste the Zoom link on the meeting, ensure reporter and employee use the same email addresses as in the app and that there’s only one Zoom meeting for that pair on that day.

- **Wrong meeting matched**  
  - Prefer storing the Zoom link on the meeting (or recurring schedule) so matching uses Zoom meeting ID.  
  - Avoid having multiple Zoom one-on-ones for the same two people on the same day if you’re not using Zoom meeting ID.

- **Signature verification failed**  
  - Ensure you’re using the raw webhook secret from Fathom (including the `whsec_` prefix) and that no extra spaces or quotes are in the env value.

---

## References

- [Fathom webhooks](https://developers.fathom.ai/webhooks)
- [Fathom API overview](https://developers.fathom.ai/api-overview)
