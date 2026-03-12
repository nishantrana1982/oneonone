# Meeting recording options

This app supports **In person** and **Over Zoom** meeting types. Below are practical options for recording and how they fit with the app.

---

## 1. **In-app browser recording (current)**

- **How it works:** The reporter opens the meeting page and clicks **Start recording**. The browser captures the reporter’s microphone; audio is uploaded to S3, then transcribed (Whisper) and summarized (GPT) in the app.
- **Best for:** In-person meetings (one device in the room) or any call where one person is happy to have the app record their mic (e.g. phone/laptop speaker).
- **Pros:** No extra signup, already built in, transcript and summary live in the app.
- **Cons:** Only one mic; quality depends on device and environment; user must stay on the meeting page and grant mic access.

---

## 2. **Zoom Cloud Recording**

- **How it works:** Host records the Zoom meeting in Zoom (cloud or local). After the call, the host can download the recording and (if you add it) upload the file into this app so it goes through the same transcription/summary pipeline.
- **Best for:** Remote Zoom one-on-ones where you want Zoom’s native recording and then to bring the result into this app.
- **Pros:** Full Zoom audio (all participants), reliable, no need to keep the app tab open during the call.
- **Cons:** Manual step to download and upload into the app unless you build a Zoom → app integration (e.g. webhook or Zoom app that posts the file to your API).

---

## 3. **Fathom direct integration (recommended for Zoom one-on-ones)**

- **How it works:** This app has a **Fathom webhook** that receives transcript, summary, and action items from [Fathom](https://fathom.video) when a meeting ends. You add the webhook URL in Fathom; when someone runs a one-on-one over Zoom with Fathom in the call, Fathom sends the data to the app and it is attached to the matching meeting automatically.
- **Best for:** Zoom one-on-ones where you have a paid Fathom account. No one has to click “record” in the app; Fathom records and transcribes, and the app gets the transcript and summary automatically.
- **Pros:** Fully automated; high-quality Fathom transcript and AI summary; matching by Zoom meeting ID (if you paste the Zoom link on the meeting) or by date + participant emails.
- **Setup:** See [FATHOM_ZOOM_SETUP.md](./FATHOM_ZOOM_SETUP.md) for step-by-step.

---

## Recommendation

- **Easiest today:** Keep using **in-app recording** for in-person or simple calls where one person’s mic is enough.
- **Best for Zoom-only (automated):** Use **Fathom** and the built-in webhook so transcripts and summaries appear in the app automatically after each Zoom one-on-one.
- **Alternative (manual):** Use **Zoom Cloud Recording** and add an “Upload recording” flow so the host can attach the Zoom recording file to the meeting for in-app transcription/summary.
