# Media and Document Issues

- Some document URLs are being resolved as `/media/media/...` (double `media` prefix), causing `404 Not Found`.
- Preview/download behavior differs by environment (localhost vs cloud): direct `/media/...` access and proxied `/api/tenants/{id}/document/?path=...` can behave differently depending on storage/hosting setup.
- Modal inline preview can fail with `localhost refused to connect` even when the same file opens correctly in a new browser tab.
- In cloud/local differences, embedded preview behavior is less reliable than direct new-tab open for the same document URL.
