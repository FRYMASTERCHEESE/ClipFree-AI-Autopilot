ClipFree AI — Stability / Bug Fix Pack

Upload BOTH files to the ROOT of:
FRYMASTERCHEESE/ClipFree-AI-Autopilot

1. Replace the existing app.js with this app.js
2. Add the new tts-worker.js beside app.js and index.html
3. Commit changes
4. Close the old website tab completely and reopen GitHub Pages so cached JavaScript is not used.

Main fixes:
- Mobile local AI narration now runs in a background Worker instead of the page UI thread.
- Voice-model memory is destroyed with the Worker before FFmpeg rendering.
- Mobile scene frames use memory-lighter JPEGs, while final export remains 1080x1920 / 1920x1080.
- FFmpeg load and render timeouts stop infinite hangs.
- Render cleanup and wake-lock handling improved.
- YouTube requests and uploads have timeouts and clearer errors.
- Playlist cache paginates and resets when switching YouTube accounts.
- Thumbnail/caption/playlist failures are no longer silently reported as full success.
- Offline upload checks and screen-awake support added.

No index.html replacement is required for this patch.
