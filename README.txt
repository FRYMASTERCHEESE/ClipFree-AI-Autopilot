ClipFree AI — Mobile Freeze Fix

Replace ONLY app.js in the root of your GitHub repository.

What changed:
- Narration is generated BEFORE FFmpeg is loaded, preventing Kokoro + FFmpeg from filling phone memory together.
- On phones, scene frames are generated at a lighter internal resolution and the final MP4 is scaled to Full HD 1080p.
- Final Shorts/Reels export stays 1080x1920; long-form stays 1920x1080.
- FFmpeg uses a lower-memory mobile preset and one thread.
- Large rendering steps yield to the browser so the page stays responsive.
- Temporary scene/audio files and the FFmpeg WASM heap are released after each mobile render.
