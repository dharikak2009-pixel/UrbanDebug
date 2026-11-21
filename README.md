# UrbanDebug

**Report it. Track it. Fix your city.**

**Live demo:** https://YOUR-APP.vercel.app
**Admin demo passcode:** `admin123`

## Overview
UrbanDebug is a civic-tech web app. Citizens report urban problems such as potholes, garbage, broken streetlights, water leaks and drainage issues. AI triage suggests a category, a priority and a department, and administrators track each report until it is resolved. Think of the city as software: every problem is a bug, and UrbanDebug helps debug it.

## Main features
- **Report issues** with title, description, category, city and area/street/landmark. Optional photo and optional approximate GPS. No home address needed.
- **Validation** with clear error messages, a success message and a unique report ID (for example `UD-261121-K7Q2`).
- **AI triage** that suggests a category, a Low/Medium/High priority with a short reason, and a recommended department.
- **Track issues** by searching a report ID. Shows description, category, location, priority, date and status (Submitted, Under Review, In Progress, Resolved).
- **Admin dashboard** with the latest reports first, status/priority/department updates, sorting, and sample data tools.
- **Live statistics** (total, pending review, in progress, resolved) calculated from the real saved reports.

## Technologies used
HTML, CSS and vanilla JavaScript for the front end. A Node.js serverless function (`api/analyze.js`) calls the Google Gemini API. Hosted on Vercel. No frameworks or build step.

## Run locally
1. Install Node.js 18 or newer.
2. Install the Vercel CLI: `npm i -g vercel`
3. In the project folder, create a file named `.env` containing `GEMINI_API_KEY=your_key_here` (never commit it; `.gitignore` already excludes it).
4. Run `vercel dev` and open the address it prints.

Without the key, or if you open `index.html` directly, the app still works and uses a **rule-based analysis**, clearly labelled as not AI.

## AI setup (Google Gemini)
1. Create a free key at Google AI Studio.
2. In Vercel, open Project Settings, Environment Variables, and add `GEMINI_API_KEY`. Optionally add `GEMINI_MODEL` to change the model (default `gemini-2.5-flash`).
3. Redeploy. The key stays on the server and is never sent to the browser.

## Limitations of this prototype
- Reports are saved in the browser's **localStorage**. This is not a shared database: reports survive refreshes but exist only in the browser and device where they were submitted, and clearing browser data deletes them. Tracking by ID and the admin view only see reports from the same browser.
- Photos are shrunk before saving, but browser storage is limited (about 5 MB). If it fills up, photos are dropped to keep the reports.
- The admin passcode is a client-side demo gate, not real security.
- Approximate GPS is rounded and optional.
- Next step: replace localStorage with a hosted database and real admin authentication.
