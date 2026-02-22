# 🐛 Image Upload Debugging Guide

## Issue
Image upload shows "Uploading..." but never completes.

## Debugging Steps

### 1. Check Browser Console (F12)
After pasting an image, look for these logs in order:

```
✅ Image compressed: XMB → YMB
✅ Starting upload to backend...
✅ Upload result: { imageUrl: "..." }
✅ Image URL: https://...
✅ Placeholder found: <div id="temp-...">
✅ Placeholder replaced with real image
✅ Upload complete!
```

### 2. Identify Where It Fails

**If you see:**
- ❌ No logs at all → Paste handler not triggering
- ❌ Stops at "Starting upload..." → Backend not responding
- ❌ "Failed to upload image: ..." → Server error (check error message)
- ❌ "Placeholder not found" → DOM issue (auto-save conflict)

### 3. Common Issues & Solutions

#### Issue: "Placeholder not found"
**Cause:** Auto-save removed the placeholder before upload finished.

**Solution Applied:**
- Added 100ms delay before triggering save after replacement
- Track upload state to prevent interference

#### Issue: "Only image files are allowed"
**Cause:** Clipboard images don't have proper filename/MIME type.

**Solution Applied:**
- Generate filename: `clipboard-{timestamp}.{extension}`
- Map MIME types to extensions properly

#### Issue: Upload takes forever
**Cause:** Render free tier has slow cold starts.

**Solution Applied:**
- Image compression (90% size reduction)
- Optimistic UI shows image immediately
- Upload happens in background

### 4. Test the Fix

1. **Open DevTools Console (F12)**
2. **Take a screenshot** (Win+Shift+S on Windows, Cmd+Shift+4 on Mac)
3. **Paste into editor** (Ctrl+V / Cmd+V)
4. **Watch the console logs**

Expected behavior:
- ✅ Blurred image appears instantly
- ✅ "Uploading..." spinner shows
- ✅ Console shows progress logs
- ✅ Image becomes sharp after 1-3 seconds
- ✅ No errors

### 5. What Was Changed

**File: `frontend/src/components/editor/RichTextEditor.jsx`**

1. **Better error handling:**
   - Detailed console logs at each step
   - Clear error messages
   - Cleanup placeholder on error

2. **Fixed DOM timing:**
   - Track uploads before triggering save
   - 100ms delay before save after replacement
   - Prevents auto-save from interfering

3. **Improved clipboard support:**
   - Proper filename generation for clipboard images
   - MIME type to extension mapping
   - File object creation with all required properties

## Next Steps

If the issue persists:
1. Share the console logs
2. Check Network tab for failed requests
3. Check backend logs for errors
4. Verify Cloudinary credentials are set

## Performance Tips

- Keep images under 5MB before compression
- Compression reduces to ~500KB automatically
- First upload may be slow (cold start on Render)
- Subsequent uploads are faster
