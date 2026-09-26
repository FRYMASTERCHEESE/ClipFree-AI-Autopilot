# ClipFree AI — High-Value YouTube Autopilot

A static, GitHub-Pages-compatible YouTube production studio focused on high-commercial-value educational niches.

## What this build does

- Auto high-value niche selection: Insurance, Finance, Legal Education, Real Estate/Mortgages, AI/SaaS, Business/Marketing.
- Local $0 planning fallback, so the core workflow still works without a paid AI API.
- Optional Gemini planning and Gemini TTS narration when your API key/model has available free-tier quota.
- Original motion-graphic videos generated locally with Canvas + FFmpeg WebAssembly; no third-party stock footage is required.
- Shorts (9:16) and long-form (16:9) modes.
- Automatic script, hook, title variants, description, tags, hashtags, thumbnail text, captions/SRT and thumbnail.
- SEO readiness checks without making ranking guarantees.
- Google/YouTube OAuth connection, video upload, thumbnail upload, caption upload, playlists and optional scheduling.
- YouTube Analytics 28-day views/watch-time/subscriber feedback plus recent-upload review.
- Preview-first default; optional full-autopilot upload after the user checks the publishing confirmation.

## Deploy on GitHub Pages

1. Back up the current `Video-clipper` repository.
2. Upload all files in this package to the root of the repository, replacing `index.html`, `styles.css` and `app.js` if you want this to be the main site.
3. Keep GitHub Pages set to deploy from the `main` branch/root (or your existing Pages configuration).
4. Open `https://frymastercheese.github.io/Video-clipper/` after GitHub Pages finishes deploying.

## Google setup

Enable:
- YouTube Data API v3
- YouTube Analytics API

Create an OAuth 2.0 **Web application** client. Add:
- `https://frymastercheese.github.io` as an Authorized JavaScript origin.
- Your custom HTTPS origin too, if you use one.

Paste only the OAuth Client ID into the website. Never paste a client secret into a public static site.

New/unverified YouTube API projects may be subject to Google's restrictions, including Private uploads until the project completes the required review/audit.

## Gemini setup (optional)

Paste a Gemini API key into Setup. The defaults are currently:
- Text: `gemini-3.7-flash`
- TTS: `gemini-3.1-flash-tts-preview`

Model names, quotas and free tiers are controlled by Google and can change. If Gemini is unavailable, the local content planner remains available and video rendering falls back to captions-first original graphics.

## Important limitation

GitHub Pages is static hosting. The one-click workflow runs while the page is open; it is not a permanent 24/7 background server after the browser closes.
