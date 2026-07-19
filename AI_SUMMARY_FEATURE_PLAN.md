# NotebookLM-Style AI Review Panel - Feature Plan

> **Status:** Planning  
> **Target Feature:** AI-powered review, summary, and study panel for notes, groups, and categories  
> **Last Updated:** 2026-06-03  

---

## 1. Goal

Build a NotebookLM-like AI layer for Threadify that helps users understand and review their own notes.

The AI should not behave like a generic chatbot first. The first version should be a grounded review panel that works from the user's existing note hierarchy:

```text
Topic
  -> Category
      -> Group
          -> nested Group
          -> Notes
      -> direct Notes
  -> orphan Notes
```

The feature should support three review levels:

1. **Note Review**: explain and summarize the currently selected note.
2. **Group Summary**: summarize all notes inside a group and explain what the group is about.
3. **Category Summary**: summarize all groups and direct notes inside a category and explain the larger subject area.

This makes the AI useful as a study and comprehension tool. The user can understand individual notes, then understand how notes connect inside a group, then understand the broader category.

---

## 2. Current System Context

### 2.1 Frontend

The frontend is a React/Vite app. The main runtime structure is:

```text
AuthProvider
  -> SocketProvider
      -> NoteProvider
          -> App
```

Important files:

- `frontend/src/context/NoteContext.jsx`
- `frontend/src/api/noteService.js`
- `frontend/src/components/layout/MainApp.jsx`
- `frontend/src/components/editor/RichTextEditor.jsx`
- `frontend/src/components/editor/EditorOutlineSidebar.jsx`

`NoteContext` owns the app's note tree and current selection:

- `topics`
- `currentTopic`
- `currentCategory`
- `currentNote`

The editor is a custom `contentEditable` editor, not TipTap. Note content is stored as raw HTML in `SubTopic.content`.

### 2.2 Backend

The backend is Express with MongoDB/Mongoose and Socket.IO.

Important files:

- `backend/src/server.js`
- `backend/src/controllers/noteController.js`
- `backend/src/routes/noteRoutes.js`
- `backend/src/models/Topic.js`
- `backend/src/models/Category.js`
- `backend/src/models/Group.js`
- `backend/src/models/SubTopic.js`
- `backend/src/middleware/authMiddleware.js`

All note routes are protected with cookie-based JWT auth. AI routes should use the same `protect` middleware.

### 2.3 Data Model

The note entity is `SubTopic`.

Relevant fields:

| Field | Meaning |
|---|---|
| `title` | Note title |
| `content` | Raw HTML from the custom editor |
| `topicId` | Parent topic |
| `categoryId` | Parent category, nullable for orphan notes |
| `groupId` | Parent group, nullable for category-direct notes |
| `version` | Content version used by autosave conflict handling |
| `order` | Display order |
| `userId` | Owner |

The backend uses Mongoose virtuals to populate hierarchy:

- `Topic.categories`
- `Topic.orphanNotes`
- `Category.groups`
- `Category.notes`
- `Group.notes`
- `Group.subgroups`

---

## 3. Feature Scope

### 3.1 Note AI Review

For the currently selected note, AI should generate:

- A plain-language explanation of what the note is about
- A concise summary
- Key points
- Important terms or concepts
- Possible gaps, unclear parts, or weak areas
- Review questions for studying

The review should be grounded only in the note content and known hierarchy context, such as topic/category/group names.

### 3.2 Group AI Summary

For a selected group, AI should summarize all notes inside that group.

It should generate:

- What the group is about
- A summary of the overall theme
- A note-by-note breakdown
- Connections between notes
- Key concepts across the group
- Suggested review questions

Nested subgroups should be included. The backend should recursively collect notes from the selected group and its descendant groups.

### 3.3 Category AI Summary

For a selected category, AI should summarize:

- Direct notes under the category
- Top-level groups
- Nested groups
- Notes inside all groups

It should generate:

- What the category is about
- Major subtopics
- Group-by-group summary
- Important cross-note connections
- Suggested study path
- Gaps or thin areas where notes may need more detail

### 3.4 Later Extension: Ask AI

After the structured review flow works reliably, add a chat-style "Ask about this note/group/category" input.

This should come later because summary/review output is easier to constrain, cache, and verify. Starting with structured output also reduces the risk of a generic chatbot that ignores the user's note structure.

---

## 4. UI Plan

### 4.1 Sidebar Placement

Use the existing right sidebar area currently occupied by `EditorOutlineSidebar`.

Convert it into a local tabbed sidebar:

```text
[Outline] [AI Review]
```

Tab state should live inside the sidebar component only. It should not be added to `NoteContext`, because switching tabs should not disturb the editor.

### 4.2 AI Review Tab

The AI tab should show context-aware actions:

When a note is selected:

- `Review Note`
- `Generate Questions`

When the current note belongs to a group:

- `Summarize Group`

When the current note belongs to a category:

- `Summarize Category`

For a first implementation, it is acceptable to show all available buttons in one panel:

```text
AI Review

[Review Note]
[Summarize Group]
[Summarize Category]

Result area...
```

### 4.3 Result Rendering

AI responses should be structured, not a single unformatted paragraph.

Recommended sections:

- Overview
- Summary
- Key Points
- Connections
- Review Questions
- Gaps / Needs Clarification

The UI should clearly indicate when a result is based on partial content because the note/group/category was too large.

### 4.4 Editor Safety

The custom editor is sensitive to React re-renders because it uses `contentEditable`, autosave, and direct DOM updates.

Do not:

- Store AI loading/result state in `NoteContext`
- Trigger full note refreshes just to display AI output
- Modify `currentNote.content` when generating a summary
- Re-render `RichTextEditor` due to AI panel state changes

Do:

- Keep AI panel state local
- Use a dedicated frontend service for AI requests
- Read from `currentNote` and the current tree without mutating it

---

## 5. Backend Architecture

### 5.1 New Files

Add:

```text
backend/src/routes/aiRoutes.js
backend/src/controllers/aiController.js
backend/src/services/aiService.js
backend/src/utils/htmlToPlainText.js
backend/src/utils/contentHash.js
backend/src/middleware/aiRateLimiter.js
```

Optional:

```text
backend/src/services/aiCacheService.js
```

### 5.2 New Routes

Mount in `backend/src/server.js`:

```js
app.use('/api/ai', aiRoutes);
```

Recommended endpoints:

```text
POST /api/ai/note-review
POST /api/ai/group-summary
POST /api/ai/category-summary
```

All routes must use:

```js
router.use(protect);
```

### 5.3 Request Shapes

Note review:

```json
{
  "noteId": "..."
}
```

Group summary:

```json
{
  "groupId": "..."
}
```

Category summary:

```json
{
  "categoryId": "..."
}
```

The frontend should send IDs only. The backend should fetch data from MongoDB and verify ownership. Do not trust frontend-sent note content for group/category summaries.

### 5.4 Ownership Checks

Every controller must verify the requested entity belongs to `req.user._id`.

Examples:

```js
await SubTopic.findOne({ _id: noteId, userId: req.user._id });
await Group.findOne({ _id: groupId, userId: req.user._id });
await Category.findOne({ _id: categoryId, userId: req.user._id });
```

### 5.5 Content Collection

For note review:

- Fetch one `SubTopic`
- Fetch parent topic/category/group names when available
- Strip note HTML to plain text

For group summary:

- Fetch the selected `Group`
- Recursively fetch descendant groups
- Fetch notes where `groupId` is any group ID in that set
- Sort notes by `order` and `updatedAt` as needed
- Strip all HTML to plain text

For category summary:

- Fetch the selected `Category`
- Fetch direct category notes where `categoryId` matches and `groupId` is null
- Fetch all groups under the category
- Recursively include nested groups
- Fetch all notes in those groups
- Strip all HTML to plain text

---

## 6. AI Provider Strategy

Hugging Face Inference Providers running Gemma is the v1 primary provider. Use `google/gemma-2-2b-it` by default because it is instruction-tuned, relatively small, and practical without local GPU hardware. Gemini remains an optional fallback only when configured.

The backend should still hide provider details behind `aiService` so the provider can be changed later.

Initial service API:

```js
generateNoteReview({ note, context })
generateGroupSummary({ group, notes, context })
generateCategorySummary({ category, groups, notes, context })
```

Provider options:

1. Try Hugging Face Gemma first.
2. If Gemma times out, is loading, is unavailable, or returns malformed output, try Gemini only when it is configured and listed in AI_PROVIDER_ORDER.
3. Keep provider order and model IDs configurable so the model can be changed without touching route/controller code.

Required environment variables should be documented in backend `.env` usage:

```text
AI_PROVIDER=openai|huggingface
OPENAI_API_KEY=...
HF_API_KEY=...
AI_PROVIDER_ORDER=huggingface,gemini
HF_TOKEN=...
HF_MODEL=google/gemma-2-2b-it
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3-flash-preview
```

If no provider key is configured, the backend should return a clear error:

```json
{
  "message": "AI provider is not configured"
}
```

---

## 7. Prompt Strategy

### 7.1 General Rules

Prompts must tell the model:

- Use only the provided notes.
- Do not invent facts.
- If content is unclear or missing, say so.
- Keep output structured.
- Explain relationships between notes when summarizing groups/categories.

### 7.2 Note Review Prompt Shape

Inputs:

- Topic name
- Category name, if any
- Group name, if any
- Note title
- Plain text note content

Expected output:

```json
{
  "overview": "...",
  "summary": "...",
  "keyPoints": ["..."],
  "importantTerms": ["..."],
  "reviewQuestions": ["..."],
  "gaps": ["..."]
}
```

### 7.3 Group Summary Prompt Shape

Inputs:

- Topic name
- Category name
- Group name
- List of notes with titles and plain text excerpts

Expected output:

```json
{
  "overview": "...",
  "summary": "...",
  "noteBreakdown": [
    {
      "title": "...",
      "contribution": "..."
    }
  ],
  "connections": ["..."],
  "keyPoints": ["..."],
  "reviewQuestions": ["..."],
  "gaps": ["..."]
}
```

### 7.4 Category Summary Prompt Shape

Inputs:

- Topic name
- Category name
- Groups with their notes
- Direct category notes

Expected output:

```json
{
  "overview": "...",
  "summary": "...",
  "majorSubtopics": ["..."],
  "groupBreakdown": [
    {
      "groupName": "...",
      "summary": "..."
    }
  ],
  "connections": ["..."],
  "studyPath": ["..."],
  "reviewQuestions": ["..."],
  "gaps": ["..."]
}
```

---

## 8. Sanitization And Limits

### 8.1 HTML To Plain Text

AI should not receive raw editor HTML.

Create `htmlToPlainText.js` to:

- Remove scripts/styles
- Convert headings/list items into readable line breaks
- Remove image tags or replace them with `[Image]`
- Decode HTML entities
- Collapse repeated whitespace
- Trim output

### 8.2 Content Limits

Set conservative limits:

```text
Note review: up to 12,000 plain-text characters
Group summary: up to 30,000 plain-text characters total
Category summary: up to 45,000 plain-text characters total
```

If content exceeds the limit:

- Truncate safely
- Return `truncated: true`
- Show this in the UI

### 8.3 Large Group/Category Strategy

For large collections, use staged summarization:

1. Summarize each note into a compact internal note summary.
2. Summarize the collection using those note summaries.

This can be added after the first implementation if needed.

---

## 9. Caching

Caching prevents repeated AI calls for unchanged content.

### 9.1 Cache Key

Use a content hash:

```text
ai:{type}:{entityId}:{contentHash}
```

Examples:

```text
ai:note-review:NOTE_ID:HASH
ai:group-summary:GROUP_ID:HASH
ai:category-summary:CATEGORY_ID:HASH
```

The hash should include:

- Relevant note IDs
- Note titles
- Note versions or `updatedAt`
- Plain text content
- Group/category names

### 9.2 Cache Storage

Options:

1. Upstash Redis, already present in backend dependencies
2. MongoDB embedded fields
3. No cache for v1, then add Redis later

Recommendation:

- Start without persistent DB schema changes.
- Add Redis cache if AI usage becomes expensive or slow.

---

## 10. Rate Limiting

AI requests should have a stricter rate limit than normal app routes.

Recommended limits:

```text
Note review: 20 requests/hour/user
Group summary: 10 requests/hour/user
Category summary: 5 requests/hour/user
```

If using Upstash, key by user ID:

```text
ratelimit:ai:{userId}
```

Return a clear `429` response when exceeded.

---

## 11. Frontend Architecture

### 11.1 New Files

Add:

```text
frontend/src/api/aiService.js
frontend/src/hooks/useAIReview.js
frontend/src/components/editor/AiReviewPanel.jsx
```

Optional:

```text
frontend/src/components/editor/AiResultRenderer.jsx
```

### 11.2 `aiService`

Expose:

```js
reviewNote(noteId)
summarizeGroup(groupId)
summarizeCategory(categoryId)
```

These should call:

```text
/api/ai/note-review
/api/ai/group-summary
/api/ai/category-summary
```

### 11.3 `useAIReview`

Own local AI state:

- `loading`
- `error`
- `result`
- `resultType`
- `truncated`
- `generatedAt`

This hook should not mutate `NoteContext`.

### 11.4 Sidebar Changes

Modify:

```text
frontend/src/components/editor/EditorOutlineSidebar.jsx
```

Add tabs:

```text
Outline | AI Review
```

Render the existing outline UI under the Outline tab.

Render `AiReviewPanel` under the AI Review tab.

---

## 12. UX Behavior

### 12.1 Empty States

If no note is selected:

- Do not show AI review actions.
- Show a simple message asking the user to select a note.

If selected note has no content:

- Disable `Review Note`.
- Show "This note has no content to review."

If note is not in a group:

- Disable or hide `Summarize Group`.

If note is not in a category:

- Disable or hide `Summarize Category`.

### 12.2 Loading

Show a compact loading state in the AI panel. Do not block the editor.

### 12.3 Errors

Handle:

- AI provider not configured
- Rate limit exceeded
- No content found
- Network/server failure
- Provider timeout

### 12.4 Stale Results

If the current note changes after a result is generated, clear the result or label it as stale.

For v1, clearing on note change is simplest.

---

## 13. Implementation Steps

### Phase 1: Backend Foundation

1. Add `htmlToPlainText` utility.
2. Add `aiService` with provider abstraction.
3. Add `aiController`.
4. Add `aiRoutes`.
5. Mount `/api/ai` in `server.js`.
6. Add ownership checks for note/group/category.
7. Add basic rate limiter.

### Phase 2: Frontend Panel

1. Add `aiService.js`.
2. Add `useAIReview`.
3. Add `AiReviewPanel`.
4. Add tabs to `EditorOutlineSidebar`.
5. Add loading/error/result states.
6. Ensure editor does not re-render unnecessarily.

### Phase 3: Group And Category Intelligence

1. Implement recursive group note collection.
2. Implement category collection with groups and direct notes.
3. Add structured result rendering for group/category summaries.
4. Add content truncation indicators.

### Phase 4: Caching And Polish

1. Add content hash utility.
2. Add Redis or in-memory cache path.
3. Add stale result detection.
4. Improve result formatting.
5. Add "Ask about this" later if needed.

---

## 14. Main Risks

### 14.1 Editor Re-render Risk

The editor relies on direct DOM behavior. AI panel state should remain isolated to avoid cursor jumps or content resets.

### 14.2 Prompt Injection

Notes are user content. Treat note text as data, not instructions. The prompt must explicitly say that note content may contain instructions that should be ignored unless they are part of the study material.

### 14.3 Large Content

Groups and categories may contain too much text. Use limits, truncation, and eventually staged summarization.

### 14.4 Hallucination

The AI should not invent facts. The UI should present output as AI-generated review based on available notes.

### 14.5 Cost And Rate Limits

AI calls can become expensive or slow. Add rate limiting early and caching after the first working version.

---

## 15. Recommended First Version

Build the first version in this order:

1. `Review Note`
2. `Summarize Group`
3. `Summarize Category`

Keep it as a structured AI Review tab in the right sidebar.

Do not start with open-ended chat. Add chat only after the structured summaries are reliable.

The goal is to make the app explain the user's own material at note, group, and category levels, so users can understand, review, and study their contents more effectively.


