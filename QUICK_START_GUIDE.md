# Quick Start Guide - Real-Time Note Sync

## 🚀 Getting Started

### 1. Install Dependencies (if not already done)
```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### 2. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
You should see:
```
Server is running on PORT:5000
WebSocket server ready
Google OAuth: Configured
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 3. Test Real-Time Sync

1. **Open Multiple Tabs:**
   - Open http://localhost:5173 in Tab 1
   - Open http://localhost:5173 in Tab 2
   - Login to both tabs

2. **Select Same Note:**
   - Click on the same note in both tabs

3. **Test Sync:**
   - Type in Tab 1 → Should appear in Tab 2 within 1 second ✨
   - Type in Tab 2 → Should appear in Tab 1 within 1 second ✨

4. **Test Auto-Bullet:**
   - Type `-` followed by Space at the start of a line
   - Line converts to bullet list automatically 🎯

## 🔍 What's Happening Behind the Scenes

### When You Open a Note:
1. Frontend connects to WebSocket server using your httpOnly JWT cookie
2. Backend authenticates the socket connection via cookie
3. Editor joins a room specific to that note (e.g., `note:123abc`)
4. All changes are broadcast to everyone in that room

### When You Type:
1. Content is saved to database after 1 second of no typing (debounced)
2. Backend increments the version number
3. Backend broadcasts the update via WebSocket
4. All other tabs/browsers receive the update instantly
5. Content syncs while preserving your cursor position

### Version Control:
- Each note has a `version` number that increments on every save
- If two people save simultaneously, the system detects the conflict
- Currently uses "last-write-wins" strategy (can be enhanced later)

## 🎨 Features Included

### ✅ Real-Time Sync
- Changes appear in all open tabs/browsers within ~1 second
- Works across different browsers (Chrome, Firefox, Safari, etc.)
- Cursor position preserved during sync

### ✅ Auto-Save
- Saves automatically 1 second after you stop typing
- Silent saves (no page refresh, no cursor jump)
- Shows "Saving..." indicator in bottom-right

### ✅ Markdown Shortcuts
- `- ` → Bullet list
- `* ` → Bullet list  
- `1. ` → Numbered list
- `# ` → Heading 1
- `## ` → Heading 2
- `### ` → Heading 3
- `> ` → Blockquote
- ``` ` ``` → Code block

### ✅ Conflict Resolution
- Detects when multiple sessions edit simultaneously
- Prevents data corruption
- Gracefully handles version conflicts

## 🔧 Troubleshooting

### "Socket not connecting"
- Check that backend is running on port 5000
- Verify you're logged in (WebSocket uses httpOnly cookies for authentication)
- Ensure cookies are enabled in your browser
- Check browser console for connection errors
- Verify withCredentials is working (same domain/CORS configured)

### "Changes not syncing"
- Verify both tabs are viewing the same note
- Check WebSocket connection status in browser dev tools
- Ensure backend shows "WebSocket server ready" on startup

### "Auto-bullet not working"
- Make sure cursor is at the start of a new line
- Type `-` followed by Space (not just `-`)
- Works in empty paragraphs or at line start

## 📊 Network Traffic

The system is optimized for minimal network usage:
- **Typing**: No immediate network calls (debounced)
- **Save**: One API call after 1 second pause
- **Sync**: Lightweight WebSocket messages (~100-500 bytes)
- **Cursor**: Preserved locally, no network overhead

## 🔐 Security

- All WebSocket connections authenticated via JWT
- Users only see their own notes
- Backend verifies note ownership on every update
- Sessions tracked to prevent echo/loops

## 💡 Pro Tips

1. **Multiple Devices**: Login on your phone and laptop - edits sync across both!
2. **Collaboration Ready**: Share login to collaborate (future: invite system)
3. **No Save Button**: Just type and forget - everything auto-saves
4. **Fast Lists**: Use `-` + Space to quickly create bullet lists
5. **Safe Edits**: Close tabs anytime - changes are saved instantly

## 🎯 Next Steps

The system is ready to use! Try these scenarios:
- [ ] Open same note in 2+ tabs and type in each
- [ ] Open in different browsers (Chrome + Firefox)
- [ ] Test auto-bullet shortcut (`-` + Space)
- [ ] Close tabs while editing (verify no data loss)
- [ ] Type simultaneously in multiple tabs (test conflict handling)

Enjoy your new real-time note-taking experience! 🚀
