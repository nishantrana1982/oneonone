# Google Calendar integration setup

The app can create/update/delete Google Calendar events when reporters schedule one-on-one meetings. Follow these steps once per Google Cloud project.

## 1. Enable Google Calendar API

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and select your project (same one used for OAuth sign-in).
2. Left menu: **APIs & Services** → **Library**.
3. Search for **Google Calendar API**.
4. Open it and click **Enable**.

## 2. OAuth consent screen (calendar scope)

1. **APIs & Services** → **OAuth consent screen**.
2. Under **Scopes**, ensure you have:
   - `openid`, `email`, `profile`
   - `https://www.googleapis.com/auth/calendar`
3. If you add the calendar scope here, save. Users may need to sign in again to grant the new permission.

## 3. App / server config

- **GOOGLE_CLIENT_ID** and **GOOGLE_CLIENT_SECRET** must be set in the server `.env` (same client used for sign-in).
- **NEXTAUTH_URL** must be your production URL (e.g. `https://oneonone.wliq.ai`) so the Calendar API redirect and tokens work correctly.

## 4. User calendar access

- Calendar events are created using the **reporter’s** Google account (the person who creates the meeting).
- The reporter must have signed in with Google **after** the calendar scope was added. If they signed in before that, they should **sign out and sign in again** so Google asks for calendar permission and the app can store a refresh token.
- After that, when the reporter creates a new meeting, a Google Calendar event is created automatically (with optional Meet link if available).

## 5. What the app does

- **Create meeting** → Creates a Google Calendar event in the reporter’s primary calendar, with employee and reporter as attendees.
- **Update meeting date** → Updates the existing Google Calendar event.
- **Delete meeting** → Deletes the Google Calendar event.

No extra config is needed in the app; once the API is enabled and users have granted calendar access, it works automatically.
