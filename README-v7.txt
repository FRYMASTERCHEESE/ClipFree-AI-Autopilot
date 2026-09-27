ClipFree AI — 30 Shorts Stable Android v7

Replace these three root files in FRYMASTERCHEESE/ClipFree-AI-Autopilot:
- index.html
- app.js
- tts-worker.js

Key fixes:
- Dedicated one-use narration worker per attempt on Android
- No shared/prewarm worker race
- Up to 3 automatic worker attempts, plus one full recovery cycle
- Smaller TTS chunks on retries
- Lighter 540x960 temporary frames on mobile; final export remains 1080x1920
- Shorter spoken scripts while keeping disclaimers in YouTube descriptions
- Extra memory cooldown between queued videos
- Existing resumable YouTube uploads, retry logic and saved 30-video progress preserved

Keep the browser tab open while the queue is running.
