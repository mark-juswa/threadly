# AI Summary / Review Panel - Feature Plan

> **Status:** Planning  
> **Target Feature:** AI-powered summarization and review panel for the notes app  
> **Last Updated:** 2025

---

## Table of Contents

1. [System Analysis](#1-system-analysis)
2. [Constraints](#2-constraints)
3. [Architecture Proposal](#3-architecture-proposal)
4. [UI Plan](#4-ui-plan)
5. [Backend Plan](#5-backend-plan)
6. [AI Prompt and Model Selection Strategy](#6-ai-prompt-and-model-selection-strategy)
7. [Database Plan](#7-database-plan)
8. [Performance and UX Considerations](#8-performance-and-ux-considerations)
9. [Risk Assessment](#9-risk-assessment)
10. [Step-by-Step Implementation Plan](#10-step-by-step-implementation-plan)

---

## 1. System Analysis

### 1.1 Note (SubTopic) Structure

The core data entity is `SubTopic`, which represents an individual note. Its schema fields are:

| Field | Type | Description |
|---|---|---|
| `title` | String | The note's display title |
| `content` | String | Raw HTML from TipTap editor |
| `topic` | ObjectId (ref: Topic) | Parent topic |
| `user` | ObjectId (ref: User) | Owner of the note |
| `order` | Number | Display ordering index |
| `createdAt` | Date | Auto-timestamp |
| `updatedAt` | Date | Auto-timestamp |

**Content format:** Note content is stored as raw HTML produced by the TipTap v2 rich text editor. Example:

```html
<h1>Heading</h1>
<p><strong>Bold text</strong> and <em>italic text</em></p>
<ul>
  <li>Bullet point one</li>
  <li>Bullet point two</li>
</ul>
<mark>Highlighted text</mark>
<p><a href="https://example.com">A link</a></p>
```

This HTML must be **stripped or parsed** before being sent to an AI model, as raw HTML tokens waste context window and confuse models.

### 1.2 Full Data Hierarchy

```
User
 └── Category
      ├── Topic (no group)
      │    └── SubTopic (Note)
      └── Group
           └── Topic
                └── SubTopic (Note)
```

The `Group` entity is optional — topics may belong directly to a category without a group. This hierarchy provides useful **context** for AI summarization: a note about "Linked Lists" in a topic called "Data Structures" under a category called "Computer Science" gives the AI meaningful framing.

### 1.3 Existing Right Sidebar — EditorOutlineSidebar

The current right sidebar (`EditorOutlineSidebar`) is a **single-panel** component that:

- Receives the TipTap `editor` instance as a prop
- Parses heading nodes (`h1`, `h2`, `h3`) from editor content to build a Table of Contents (TOC)
- Re-runs on every `editor.onUpdate` event
- Navigates to headings via `editor.chain().focus().setTextSelection(pos)`
- Has **no existing tab system** — it is a single, linear panel

The new AI Summary panel will be added as a **second tab** within this sidebar container, converting the sidebar into a two-tab interface: **Outline** and **AI Summary**.

### 1.4 Tab Integration Safety

Key risks when adding a tab system to `EditorOutlineSidebar`:

- **Editor re-render risk:** If the `editor` prop is passed down in a way that causes re-creation, the TipTap editor will lose its state. The tab UI must be isolated in the sidebar wrapper and must NOT cause any parent re-render.
- **onUpdate listener leaks:** The existing outline logic attaches `editor.onUpdate`. Adding AI tab logic must not register duplicate listeners or fail to clean them up on unmount.
- **State isolation:** Tab-switching state must live only in the sidebar component, never bubbling up to `NoteContext` or any parent that owns the editor.

### 1.5 AI-Specific Risks

- **HTML injection in prompt:** Sending raw TipTap HTML to an AI model can cause prompt injection, waste tokens, and degrade response quality.
- **Stale summaries:** If a user edits a note after generating a summary, the cached summary becomes stale. A versioning/invalidation strategy is required.
- **Model hallucination:** AI may add facts not present in the note. The UI must clearly label output as AI-generated.
- **Rate limit abuse:** Without per-user rate limiting on the AI endpoint, a single user could exhaust free API quotas.

### 1.6 Performance Risks

- **Cold starts (Render free tier):** The backend may be asleep; an AI request could time out if the cold start + AI inference together exceed 30 seconds.
- **Large note content:** A note with many images (as base64 or Cloudinary URLs) could create an enormous HTML string. The backend must truncate or sanitize content before sending to AI.
- **Blocking the editor:** Any AI call must be fully async and must never block the main React rendering thread or the TipTap editor update cycle.

---

## 2. Constraints

### 2.1 Render Free Tier

- **No persistent background workers.** Long-running jobs (e.g., queued AI processing) cannot be implemented without a paid tier or an external queue service.
- **Cold starts:** The Render free-tier Node.js service sleeps after 15 minutes of inactivity. The first request after sleep can take 20–30 seconds. AI inference adds additional latency on top of this.
- **Request timeout:** Render enforces a 30-second request timeout on free plans. AI inference via Hugging Face free inference API can take 5–20 seconds for large models. Total pipeline (wake + call + respond) must stay under this limit.
- **Mitigation:** Use smaller, faster models (BART-large-CNN targets ~3–8s inference). Show a loading state in the UI. Implement client-side timeout with a user-friendly retry message.

### 2.2 Token Limits and Input Size

- Hugging Face free inference API caps input at ~1024–2048 tokens depending on model.
- TipTap HTML content must be stripped of HTML tags, then truncated to ~1500 characters of plain text before sending.
- Very long notes will receive partial summaries — this must be disclosed in the UI ("Summary based on first ~1500 characters").

### 2.3 Cost

- **Hugging Face Inference API (free tier):** Free for public models with rate limits (~1000 requests/day, shared infrastructure). No billing required.
- **OpenAI / Anthropic:** Would cost ~$0.002–$0.015 per request. At scale, this becomes significant. Not viable for a free-tier-first deployment without a billing strategy.
- **Decision:** Use Hugging Face free inference API as the primary provider. Design the backend AI module to be provider-agnostic so OpenAI can be swapped in later.

### 2.4 No Persistent Workers

- Cannot use Bull, BullMQ, or any Redis-backed job queue that requires a persistent process.
- All AI processing must be synchronous within the HTTP request lifecycle (request → AI call → response).
- Upstash Redis (already in use) can be used for caching summaries — it is a managed external service and does not require a persistent worker.

### 2.5 API Key Security

- Hugging Face API key must be stored as a Render environment variable (`HF_API_KEY`).
- Must never be exposed to the frontend.
- All AI requests must be proxied through the backend.

---

## 3. Architecture Proposal

### 3.1 High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────┐ │
│  │CategorySidebar│  │  RichTextEditor  │  │  RightSidebar     │ │
│  │TopicSidebar  │  │  (TipTap v2)     │  │  ┌─────────────┐  │ │
│  │              │  │                  │  │  │ [Outline][AI]│  │ │
│  │              │  │  auto-save ──────┼──┼─▶│ Tab System  │  │ │
│  └──────────────┘  └──────────────────┘  │  ├─────────────┤  │ │
│                           │              │  │ OutlinePanel │  │ │
│                           │              │  │   OR         │  │ │
│                    NoteContext           │  │ AISummaryPanel│ │ │
│                           │              │  └─────────────┘  │ │
│                           ▼              └───────────────────┘ │
│                    ┌────────────┐                 │            │
│                    │  Axios     │◀────────────────┘            │
│                    │  API calls │  POST /api/ai/summarize       │
│                    └────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Express Backend │
                    │                 │
                    │  aiRoutes.js    │
                    │  aiController.js│
                    │  aiService.js   │
                    │  aiRateLimiter  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼───┐  ┌───────▼──────┐  ┌───▼──────────┐
     │  Upstash   │  │  Hugging Face│  │   MongoDB    │
     │  Redis     │  │  Inference   │  │  (optional   │
     │  (cache)   │  │  API         │  │   cache)     │
     └────────────┘  └──────────────┘  └──────────────┘
```

### 3.2 Data Flow — AI Summary Request

```
1. User clicks "Generate Summary" in AISummaryPanel
2. AISummaryPanel dispatches POST /api/ai/summarize
   Body: { subtopicId, noteTitle, noteContent (HTML), topicName, categoryName, groupName? }
3. aiRateLimiter middleware checks: has this user exceeded 20 req/hour?
   → If yes: 429 Too Many Requests
4. aiController strips HTML from noteContent → plain text
5. aiController checks Upstash Redis cache key: `ai:summary:{subtopicId}:{contentHash}`
   → If cache hit: return cached summary immediately
6. aiController calls aiService.generateSummary(plainText, context)
7. aiService builds prompt and calls Hugging Face Inference API
8. Response parsed, cleaned, stored in Redis with TTL=24h
9. (Optional) Stored in SubTopic.aiSummary embedded field in MongoDB
10. Response sent to frontend: { summary, keyPoints, generatedAt, model }
11. AISummaryPanel renders the result
```

### 3.3 New Files and Modifications

**New backend files:**
- `backend/routes/aiRoutes.js`
- `backend/controllers/aiController.js`
- `backend/services/aiService.js`
- `backend/middleware/aiRateLimiter.js`

**Modified backend files:**
- `backend/server.js` — mount `aiRoutes`
- `backend/models/SubTopic.js` — add optional `aiSummary` embedded field

**New frontend files:**
- `frontend/src/components/AISummaryPanel.jsx`
- `frontend/src/hooks/useAISummary.js`

**Modified frontend files:**
- `frontend/src/components/EditorOutlineSidebar.jsx` — add tab system, render `AISummaryPanel`

---

## 4. UI Plan

### 4.1 Tab System in the Right Sidebar

The existing `EditorOutlineSidebar` will be refactored to host two tabs:

| Tab | Label | Icon | Content |
|---|---|---|---|
| 0 | Outline | `#` or list icon | Existing heading TOC (unchanged) |
| 1 | AI Summary | sparkle / ✦ icon | New `AISummaryPanel` component |

**Tab state** is managed with a simple `useState` inside `EditorOutlineSidebar`. It must NOT be lifted to a parent to prevent editor re-renders.

### 4.2 Tab State Management — Isolation Guarantee

```jsx
// EditorOutlineSidebar.jsx (modified)
// Tab state is LOCAL — never lifted up
const [activeTab, setActiveTab] = useState(0); // 0 = Outline, 1 = AI Summary

// Tab switching does NOT touch editor prop at all
// The editor instance is passed down only to the Outline panel
```

The key principle: `editor` prop flows only to the Outline tab's internal logic. The AI tab never receives or accesses the `editor` instance directly, preventing any risk of accidental re-renders or listener leaks.

### 4.3 Component Structure

```
EditorOutlineSidebar (modified)
 ├── SidebarTabBar         ← new sub-component (or inline JSX)
 │    ├── Tab: "Outline"
 │    └── Tab: "AI Summary"
 ├── OutlinePanel          ← existing logic, extracted or kept inline
 │    └── (receives editor prop, builds heading TOC)
 └── AISummaryPanel        ← new component
      ├── GenerateButton
      ├── LoadingState (skeleton)
      ├── SummaryDisplay
      │    ├── SummaryText
      │    └── KeyPointsList
      ├── ErrorState
      └── StaleWarning (if note was edited after last generation)
```

### 4.4 EditorOutlineSidebar Code Sketch

```jsx
// frontend/src/components/EditorOutlineSidebar.jsx
import { useState, useCallback } from 'react';
import AISummaryPanel from './AISummaryPanel';

export default function EditorOutlineSidebar({ editor }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="flex flex-col h-full w-64 border-l border-gray-200">
      {/* Tab Bar */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab(0)}
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 0
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Outline
        </button>
        <button
          onClick={() => setActiveTab(1)}
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 1
              ? 'border-b-2 border-purple-500 text-purple-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          ✦ AI Summary
        </button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 0 && (
          <OutlinePanel editor={editor} />
        )}
        {activeTab === 1 && (
          <AISummaryPanel />
          // Note: no editor prop passed — fully isolated
        )}
      </div>
    </div>
  );
}
```

### 4.5 AISummaryPanel Component Sketch

```jsx
// frontend/src/components/AISummaryPanel.jsx
import { useContext } from 'react';
import { NoteContext } from '../context/NoteContext';
import { useAISummary } from '../hooks/useAISummary';

export default function AISummaryPanel() {
  const { selectedNote, selectedTopic, selectedCategory, selectedGroup } =
    useContext(NoteContext);
  const { summary, keyPoints, isLoading, error, isStale, generate } =
    useAISummary(selectedNote);

  if (!selectedNote) {
    return (
      <div className="p-4 text-sm text-gray-400 text-center mt-8">
        Select a note to generate an AI summary.
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <button
        onClick={() => generate({ selectedNote, selectedTopic, selectedCategory, selectedGroup })}
        disabled={isLoading}
        className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg text-sm font-medium
                   hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Generating...' : summary ? 'Regenerate Summary' : 'Generate Summary'}
      </button>

      {isStale && !isLoading && (
        <div className="text-xs text-amber-600 bg-amber-50 rounded p-2">
          ⚠ Note has been edited since last summary. Regenerate for latest content.
        </div>
      )}

      {isLoading && <SummarySkeletonUI />}

      {error && !isLoading && (
        <div className="text-xs text-red-500 bg-red-50 rounded p-2">
          {error}
        </div>
      )}

      {summary && !isLoading && (
        <>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Summary
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
          </div>
          {keyPoints?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Key Points
              </h3>
              <ul className="text-sm text-gray-700 space-y-1">
                {keyPoints.map((point, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-purple-400 mt-0.5">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">
            AI-generated · May contain inaccuracies
          </p>
        </>
      )}
    </div>
  );
}

function SummarySkeletonUI() {
  return (
    <div className="animate-pulse flex flex-col gap-3">
      <div className="h-3 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-full" />
      <div className="h-3 bg-gray-200 rounded w-5/6" />
      <div className="h-3 bg-gray-200 rounded w-2/3" />
    </div>
  );
}
```

### 4.6 useAISummary Hook Sketch

```jsx
// frontend/src/hooks/useAISummary.js
import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

export function useAISummary(selectedNote) {
  const [summary, setSummary] = useState(null);
  const [keyPoints, setKeyPoints] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const lastSummarizedContentRef = useRef(null);

  // Detect stale state when note content changes after a summary is generated
  useEffect(() => {
    if (summary && selectedNote?.content !== lastSummarizedContentRef.current) {
      setIsStale(true);
    }
  }, [selectedNote?.content, summary]);

  const generate = useCallback(async ({ selectedNote, selectedTopic, selectedCategory, selectedGroup }) => {
    if (!selectedNote) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await axios.post('/api/ai/summarize', {
        subtopicId: selectedNote._id,
        noteTitle: selectedNote.title,
        noteContent: selectedNote.content,
        topicName: selectedTopic?.name,
        categoryName: selectedCategory?.name,
        groupName: selectedGroup?.name,
      }, { timeout: 28000 }); // 28s client timeout, under Render's 30s limit
      setSummary(data.summary);
      setKeyPoints(data.keyPoints || []);
      lastSummarizedContentRef.current = selectedNote.content;
      setIsStale(false);
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setError('Request timed out. The server may be waking up — please try again.');
      } else if (err.response?.status === 429) {
        setError('Rate limit reached. You can generate up to 20 summaries per hour.');
      } else {
        setError('Failed to generate summary. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { summary, keyPoints, isLoading, error, isStale, generate };
}
```

---

## 5. Backend Plan

### 5.1 New Route — POST /api/ai/summarize

**File:** `backend/routes/aiRoutes.js`

```js
// backend/routes/aiRoutes.js
const express = require('express');
const router = express.Router();
const { summarize } = require('../controllers/aiController');
const { isAuthenticated } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

// All AI routes require authentication + per-user rate limiting
router.post('/summarize', isAuthenticated, aiRateLimiter, summarize);

module.exports = router;
```

**Mount in server.js:**
```js
const aiRoutes = require('./routes/aiRoutes');
app.use('/api/ai', aiRoutes);
```

### 5.2 Request / Response Shape

**Request body (POST /api/ai/summarize):**
```json
{
  "subtopicId": "64f3a1b2c3d4e5f6a7b8c9d0",
  "noteTitle": "Binary Search Trees",
  "noteContent": "<h1>BST</h1><p>A <strong>binary search tree</strong> is...</p>",
  "topicName": "Data Structures",
  "categoryName": "Computer Science",
  "groupName": "Algorithms"
}
```

**Successful response (200):**
```json
{
  "summary": "A binary search tree (BST) is a hierarchical data structure where each node has at most two children. Left children are smaller than the parent, right children are larger. Key operations include insertion, deletion, and search, all running in O(log n) average time.",
  "keyPoints": [
    "Each node has at most two children (left and right)",
    "Left subtree values are always less than the parent node",
    "Average time complexity for search/insert/delete is O(log n)",
    "Worst case degrades to O(n) for unbalanced trees"
  ],
  "generatedAt": "2025-01-15T10:30:00.000Z",
  "model": "facebook/bart-large-cnn",
  "cached": false
}
```

**Error responses:**
```json
// 429 - Rate limit exceeded
{ "error": "Rate limit exceeded. Maximum 20 AI requests per hour." }

// 400 - Bad request
{ "error": "noteContent is required and must be a non-empty string." }

// 503 - AI service unavailable
{ "error": "AI service temporarily unavailable. Please try again in a moment." }

// 500 - Internal error
{ "error": "An unexpected error occurred. Please try again." }
```

### 5.3 aiController.js

```js
// backend/controllers/aiController.js
const { generateSummary } = require('../services/aiService');
const { getRedisClient } = require('../config/redis');
const crypto = require('crypto');

// Strip HTML tags and normalize whitespace
function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, ' ')   // remove all HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')       // collapse whitespace
    .trim();
}

function hashContent(str) {
  return crypto.createHash('md5').update(str).digest('hex').slice(0, 16);
}

exports.summarize = async (req, res) => {
  const { subtopicId, noteTitle, noteContent, topicName, categoryName, groupName } = req.body;
  const userId = req.user._id.toString();

  // Input validation
  if (!subtopicId || !noteContent || typeof noteContent !== 'string') {
    return res.status(400).json({ error: 'subtopicId and noteContent are required.' });
  }

  // Strip HTML and truncate to ~1500 chars to stay within token limits
  const plainText = stripHtml(noteContent).slice(0, 1500);
  if (plainText.trim().length < 20) {
    return res.status(400).json({ error: 'Note content is too short to summarize.' });
  }

  // Build cache key from subtopicId + content hash (content-aware caching)
  const contentHash = hashContent(noteContent);
  const cacheKey = `ai:summary:${subtopicId}:${contentHash}`;

  try {
    const redis = getRedisClient();

    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return res.json({ ...parsed, cached: true });
    }

    // Build context for AI prompt
    const context = {
      noteTitle: noteTitle || 'Untitled Note',
      topicName,
      categoryName,
      groupName,
    };

    // Call AI service
    const result = await generateSummary(plainText, context);

    // Cache for 24 hours
    await redis.set(cacheKey, JSON.stringify(result), { ex: 86400 });

    return res.json({ ...result, cached: false });
  } catch (err) {
    console.error('[AI Summarize Error]', err.message);
    if (err.message === 'AI_SERVICE_UNAVAILABLE') {
      return res.status(503).json({ error: 'AI service temporarily unavailable. Please try again.' });
    }
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};
```

### 5.4 Rate Limiting Strategy

**File:** `backend/middleware/aiRateLimiter.js`

The AI endpoint uses a dedicated rate limiter, separate from the existing general `rateLimiter`, because:
- AI requests are expensive (latency + quota cost)
- Users should be limited individually by `userId`, not by IP
- The limit is intentionally lower than general API limits

```js
// backend/middleware/aiRateLimiter.js
const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '1 h'), // 20 requests per hour per user
  analytics: true,
  prefix: 'ratelimit:ai',
});

exports.aiRateLimiter = async (req, res, next) => {
  const identifier = req.user._id.toString(); // per-user, not per-IP
  const { success, limit, remaining, reset } = await ratelimit.limit(identifier);

  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', reset);

  if (!success) {
    return res.status(429).json({
      error: `Rate limit exceeded. Maximum ${limit} AI requests per hour.`,
      resetAt: new Date(reset).toISOString(),
    });
  }
  next();
};
```

### 5.5 Error Handling Matrix

| Scenario | HTTP Status | Error Message | Action |
|---|---|---|---|
| Missing subtopicId or noteContent | 400 | "subtopicId and noteContent are required." | Validate on frontend too |
| Note too short (<20 chars) | 400 | "Note content is too short to summarize." | Show friendly UI message |
| User not authenticated | 401 | "Unauthorized" | Passport.js middleware handles |
| Rate limit exceeded | 429 | "Rate limit exceeded..." | Show remaining time in UI |
| HF API key missing | 503 | "AI service temporarily unavailable." | Alert in server logs |
| HF API timeout (>20s) | 503 | "AI service temporarily unavailable." | Retry suggestion in UI |
| HF API returns malformed response | 500 | "An unexpected error occurred." | Log full error server-side |
| Redis connection failure | 500 | "An unexpected error occurred." | Degrade gracefully, skip cache |

---

## 6. AI Prompt and Model Selection Strategy

### 6.1 Why Hugging Face Free Inference API

| Provider | Cost | Latency | Setup | Render Free Tier Compatible |
|---|---|---|---|---|
| **Hugging Face Inference API** | Free (public models) | 3–15s | API key only | ✅ Yes |
| OpenAI GPT-4o | ~$0.01–$0.03/req | 2–5s | Billing required | ⚠ Cost risk |
| OpenAI GPT-3.5-turbo | ~$0.002/req | 1–3s | Billing required | ⚠ Cost risk |
| Anthropic Claude | ~$0.008/req | 2–6s | Billing required | ⚠ Cost risk |
| Ollama (local) | Free | 1–10s | Server install | ❌ No (Render stateless) |
| Replicate | Pay per second | Variable | Billing required | ⚠ Cost risk |

**Decision rationale:** Hugging Face Inference API provides free access to powerful public models with no billing setup. It is the only viable zero-cost option for a Render free-tier deployment. The backend module will be written as a provider-agnostic service so that switching to OpenAI in the future requires only changing `aiService.js`.

### 6.2 Model Recommendation

#### Primary Recommendation: `facebook/bart-large-cnn`

| Attribute | Value |
|---|---|
| Model type | Encoder-decoder (seq2seq) |
| Trained on | CNN/DailyMail news articles |
| Speciality | Abstractive summarization |
| Max input tokens | ~1024 |
| Avg inference time (HF free) | ~3–8 seconds |
| Output quality | High for factual prose, good for structured notes |
| HF Inference API support | ✅ Excellent — dedicated summarization pipeline |

**Why BART-large-CNN wins for this use case:**
- It is a dedicated summarization model — no prompt engineering needed, just pass the text
- Inference time is predictable and well within Render's 30s timeout even with cold starts
- The summarization pipeline endpoint returns clean text without additional parsing
- Well-maintained and widely tested on the HF free tier

#### Secondary Option: `mistralai/Mistral-7B-Instruct-v0.2`

| Attribute | Value |
|---|---|
| Model type | Causal LLM (instruction-tuned) |
| Max input tokens | ~32,768 |
| Avg inference time (HF free) | ~10–25 seconds |
| Output quality | Excellent — can follow complex instructions, extract key points |
| HF Inference API support | ✅ Text generation pipeline |

**When to use Mistral instead:**
- Notes are structured with headers, bullets, and tables (BART struggles with non-prose)
- Key point extraction quality needs to be higher
- Cold starts are not a concern (e.g., upgraded Render tier)

**Strategy:** Use BART as primary. Fall back to Mistral if BART returns a poor-quality or too-short summary (detected by character count threshold).

### 6.3 aiService.js — Provider-Agnostic Design

```js
// backend/services/aiService.js
const axios = require('axios');

const HF_API_URL = 'https://api-inference.huggingface.co/models';
const PRIMARY_MODEL = 'facebook/bart-large-cnn';
const FALLBACK_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2';
const HF_API_KEY = process.env.HF_API_KEY;

async function callHuggingFace(model, payload) {
  const response = await axios.post(
    `${HF_API_URL}/${model}`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000, // 20s — leaves buffer for Render overhead
    }
  );
  return response.data;
}

// BART summarization — direct pipeline, no prompt needed
async function summarizeWithBART(plainText) {
  const data = await callHuggingFace(PRIMARY_MODEL, {
    inputs: plainText,
    parameters: {
      max_length: 150,
      min_length: 40,
      do_sample: false,
    },
  });
  // BART returns: [{ summary_text: "..." }]
  return data[0]?.summary_text || null;
}

// Mistral — instruction-tuned, needs a prompt
async function summarizeWithMistral(plainText, context) {
  const contextLine = [
    context.categoryName && `Category: ${context.categoryName}`,
    context.topicName && `Topic: ${context.topicName}`,
    context.groupName && `Group: ${context.groupName}`,
  ].filter(Boolean).join(' | ');

  const prompt = `<s>[INST] You are a helpful study assistant. Summarize the following note concisely.
${contextLine ? `Context: ${contextLine}` : ''}
Note title: "${context.noteTitle}"

Note content:
${plainText}

Provide:
1. A 2-4 sentence summary
2. 3-5 bullet point key takeaways

Format your response as:
SUMMARY: <your summary here>
KEY POINTS:
- <point 1>
- <point 2>
- <point 3>
[/INST]`;

  const data = await callHuggingFace(FALLBACK_MODEL, {
    inputs: prompt,
    parameters: {
      max_new_tokens: 300,
      temperature: 0.3,
      return_full_text: false,
    },
  });
  return data[0]?.generated_text || null;
}

// Parse Mistral structured output
function parseMistralOutput(text) {
  const summaryMatch = text.match(/SUMMARY:\s*(.+?)(?=KEY POINTS:|$)/s);
  const keyPointsMatch = text.match(/KEY POINTS:\s*([\s\S]+)$/);

  const summary = summaryMatch?.[1]?.trim() || text.trim();
  const keyPoints = keyPointsMatch
    ? keyPointsMatch[1]
        .split('\n')
        .map(line => line.replace(/^[-*•]\s*/, '').trim())
        .filter(line => line.length > 5)
    : [];

  return { summary, keyPoints };
}

exports.generateSummary = async (plainText, context) => {
  if (!HF_API_KEY) {
    throw new Error('AI_SERVICE_UNAVAILABLE');
  }

  let summary = null;
  let keyPoints = [];
  let modelUsed = PRIMARY_MODEL;

  try {
    summary = await summarizeWithBART(plainText);

    // Quality check: if BART output is too short, fall back to Mistral
    if (!summary || summary.length < 50) {
      throw new Error('BART_QUALITY_THRESHOLD_NOT_MET');
    }
  } catch (bartErr) {
    console.warn('[aiService] BART failed or quality low, trying Mistral:', bartErr.message);
    try {
      modelUsed = FALLBACK_MODEL;
      const rawMistral = await summarizeWithMistral(plainText, context);
      const parsed = parseMistralOutput(rawMistral || '');
      summary = parsed.summary;
      keyPoints = parsed.keyPoints;
    } catch (mistralErr) {
      console.error('[aiService] Both models failed:', mistralErr.message);
      throw new Error('AI_SERVICE_UNAVAILABLE');
    }
  }

  return {
    summary,
    keyPoints,
    generatedAt: new Date().toISOString(),
    model: modelUsed,
  };
};
```

### 6.4 Prompt Engineering for HTML Content with Context

The key transformations before sending to AI:

1. **Strip HTML tags** — Remove all `<>` tags, decode HTML entities
2. **Preserve structure semantically** — Convert `<h1>`, `<h2>` to capitalized section markers optionally
3. **Inject hierarchy context** — Prepend category/topic/group as framing context
4. **Truncate** — Hard cap at 1500 characters to avoid token overflow

**Enhanced HTML stripping that preserves semantic structure:**

```js
function stripHtmlWithStructure(html) {
  return html
    .replace(/<h[1-6][^>]*>/gi, '\n## ')  // headings become section markers
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')        // list items become bullets
    .replace(/<\/li>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')              // strip remaining tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')           // collapse excessive newlines
    .trim();
}
```

### 6.5 Fallback Strategy

```
Primary:  facebook/bart-large-cnn
  └── If output < 50 chars OR axios timeout/error
Fallback: mistralai/Mistral-7B-Instruct-v0.2
  └── If axios timeout/error
Terminal: throw AI_SERVICE_UNAVAILABLE → 503 to client
```

### 6.6 Cost Analysis

| Scenario | Requests/day | HF Free Tier | Cost |
|---|---|---|---|
| Single user, heavy use | 50 req/day | Within limit | $0 |
| 10 active users | ~100 req/day | Within limit | $0 |
| 50 active users | ~500 req/day | Borderline | $0 (monitor) |
| 100+ active users | ~1000+ req/day | May hit limits | Consider HF Pro ($9/mo) |

The per-user rate limit of 20 req/hour naturally caps total daily load, making the free tier viable for early-stage applications with up to ~50 daily active users.

---

## 7. Database Plan

### 7.1 Optional AISummary Embedded Field in SubTopic

The `SubTopic` model can optionally store the last generated AI summary for persistence across sessions. This is optional because Upstash Redis serves as the primary cache — MongoDB storage is for long-term persistence and cross-device access.

**Modified `backend/models/SubTopic.js`:**

```js
// backend/models/SubTopic.js (modified)
const mongoose = require('mongoose');

const aiSummarySchema = new mongoose.Schema({
  summary: { type: String, required: true },
  keyPoints: [{ type: String }],
  generatedAt: { type: Date, default: Date.now },
  model: { type: String },
  contentHash: { type: String }, // MD5 hash of content at generation time
}, { _id: false });

const subTopicSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, default: '' },
  topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  order: { type: Number, default: 0 },
  aiSummary: { type: aiSummarySchema, default: null }, // NEW: optional embedded summary
}, { timestamps: true });

module.exports = mongoose.model('SubTopic', subTopicSchema);
```

### 7.2 When to Write to MongoDB

Writing every AI summary to MongoDB is optional and carries a write cost. The recommended strategy:

| Trigger | Write to MongoDB? | Write to Redis? |
|---|---|---|
| User generates summary | ✅ Yes (async, non-blocking) | ✅ Yes (primary cache) |
| Cache hit served | ❌ No | ❌ No (already cached) |
| Note content changes | ❌ No (lazy invalidation) | ❌ No (key changes naturally) |
| User deletes note | N/A (cascade delete) | ❌ Redis TTL handles cleanup |

**Async MongoDB write (non-blocking):**

```js
// In aiController.js, after caching in Redis:
// Fire-and-forget MongoDB write — does not block the response
SubTopic.findByIdAndUpdate(subtopicId, {
  aiSummary: {
    summary: result.summary,
    keyPoints: result.keyPoints,
    generatedAt: result.generatedAt,
    model: result.model,
    contentHash,
  }
}).catch(err => console.error('[aiController] MongoDB write failed:', err.message));
// Do NOT await this — response already sent
```

### 7.3 Cache Invalidation Strategy

The caching approach is **content-hash-based**, meaning invalidation is implicit:

- Cache key = `ai:summary:{subtopicId}:{md5(noteContent)}`
- When the user edits the note, `noteContent` changes → the MD5 hash changes → the cache key changes → old cached summary is simply never requested again (it expires after 24h TTL)
- No explicit cache invalidation is ever needed
- The `isStale` flag in the frontend hook detects when the displayed summary was generated against older content

### 7.4 Schema Versioning

If the `aiSummary` embedded schema changes in the future (e.g., adding a `topics` field), add a `schemaVersion` field:

```js
const aiSummarySchema = new mongoose.Schema({
  schemaVersion: { type: Number, default: 1 },
  summary: String,
  keyPoints: [String],
  generatedAt: Date,
  model: String,
  contentHash: String,
}, { _id: false });
```

Old documents with no `schemaVersion` are treated as `v0` and regenerated on next request.

### 7.5 Index Considerations

No new indexes are needed. The `aiSummary` field is embedded and accessed only through the parent `SubTopic` document lookup by `_id`, which is already indexed as the primary key.

---

## 8. Performance and UX Considerations

### 8.1 Never Blocking the Editor

The TipTap editor's performance is the top priority. All AI operations must be:

- **Triggered only by explicit user action** (button click) — never on editor content change
- **Executed entirely outside the editor's React tree** — `AISummaryPanel` is a sibling, not a child of the editor component
- **State isolated** — `useAISummary` hook state never touches `NoteContext` or any context that the editor subscribes to
- **No editor.onUpdate listeners** — the AI panel does not register any TipTap listeners

### 8.2 Debounce Logic

The "Generate Summary" button should be debounced / disabled during loading to prevent double-submissions:

```jsx
// Simple disabled state covers this:
<button onClick={generate} disabled={isLoading}>
  {isLoading ? 'Generating...' : 'Generate Summary'}
</button>
```

Additionally, consider a 2-second debounce if the button is ever triggered programmatically.

### 8.3 Loading States and Skeleton UI

Four distinct UI states in `AISummaryPanel`:

| State | Condition | UI |
|---|---|---|
| Empty | No note selected | "Select a note" placeholder |
| Ready | Note selected, no summary yet | "Generate Summary" button |
| Loading | `isLoading === true` | Animated skeleton + "Generating..." button |
| Success | `summary` is set | Summary text + key points |
| Error | `error` is set | Red error box + retry button |
| Stale | `isStale === true` | Amber warning banner above summary |

The skeleton UI (Section 4.5) uses Tailwind's `animate-pulse` for a smooth loading experience without any additional animation libraries.

### 8.4 Memoization

```jsx
// In EditorOutlineSidebar, memoize the tab bar to prevent re-renders
// when editor updates fire (editor.onUpdate triggers parent re-renders):
const TabBar = memo(({ activeTab, setActiveTab }) => (
  <div className="flex border-b">...</div>
));

// AISummaryPanel itself should be memo-wrapped:
export default memo(AISummaryPanel);
```

Since `AISummaryPanel` reads from `NoteContext` directly (not from props), it will only re-render when `selectedNote` or other relevant context values change — not when the editor content updates via TipTap's internal state.

### 8.5 Handling Note Switching

When the user switches to a different note, the AI panel should:
1. Clear the current summary display (`summary = null`)
2. Check if a cached summary exists for the new note (optional: auto-fetch from MongoDB)
3. Show the "Generate Summary" button for the new note

```jsx
// In useAISummary hook:
useEffect(() => {
  // Reset state when the selected note changes
  setSummary(null);
  setKeyPoints([]);
  setError(null);
  setIsStale(false);
  lastSummarizedContentRef.current = null;
}, [selectedNote?._id]); // keyed on note ID, not content
```

### 8.6 Client-Side Timeout

The Axios call in `useAISummary` uses a 28-second timeout (`timeout: 28000`). This gives Render's cold-start + HF inference the maximum possible time while still resolving before any browser-level timeout. If it fires, the user sees a specific "server waking up" message with a retry suggestion.

### 8.7 Accessibility

- The "Generate Summary" button must have `aria-disabled` set when loading
- Loading state should include `aria-live="polite"` region so screen readers announce when the summary appears
- Error messages should use `role="alert"` for immediate screen reader announcement

```jsx
<div aria-live="polite" aria-atomic="true">
  {summary && <SummaryDisplay summary={summary} keyPoints={keyPoints} />}
</div>
<div role="alert">
  {error && <ErrorDisplay error={error} />}
</div>
```

---

## 9. Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| Render cold start + HF inference exceeds 30s timeout | High | Medium | Use BART (fast model); 28s client timeout with retry message |
| HF free tier quota exhausted (shared infrastructure) | Medium | Medium | Per-user rate limit 20/hr; Redis caching reduces repeat calls |
| TipTap editor re-renders due to tab UI changes | High | Low | Tab state strictly local to sidebar; never lifted to parent |
| onUpdate listener leak when switching tabs | Medium | Low | AI panel never registers editor listeners |
| AI hallucination / incorrect summary | Medium | High | Clear "AI-generated · May contain inaccuracies" disclaimer in UI |
| Prompt injection via malicious note content | Medium | Low | HTML stripped server-side; content sent as plain text string, not as instructions |
| Large note content exceeds token limit | Medium | High | Hard truncation at 1500 chars before AI call; UI notice for partial summaries |
| Stale summary displayed after note edit | Low | High | Content-hash cache key + `isStale` flag in frontend hook |
| Redis cache miss storm (many users, cold Redis) | Low | Low | Upstash Redis is managed and always-on; no cold start issue |
| HF API key accidentally exposed to frontend | Critical | Low | Key only in `.env` and Render dashboard; never sent in API responses |
| MongoDB write failure for aiSummary field | Low | Low | Fire-and-forget write; Redis is primary store; user unaffected |
| User clicks "Generate" multiple times rapidly | Low | Low | Button disabled during `isLoading`; single in-flight request |
| Mistral fallback also times out | Medium | Low | Both failures caught; 503 returned with clear retry message |
| AISummaryPanel unmounts mid-request | Low | Medium | Axios cancel token on unmount (useEffect cleanup) prevents state updates on unmounted component |
| Notes with only images (no text) | Low | Medium | Post-strip text length check (<20 chars) returns 400 with helpful message |

---

## 10. Step-by-Step Implementation Plan

### Phase 1: Backend Foundation

**Goal:** Set up the AI endpoint infrastructure without any AI calls yet.

**Step 1.1 — Add Hugging Face API key to environment**
- Add `HF_API_KEY=hf_...` to `backend/.env` (local)
- Add `HF_API_KEY` to Render dashboard environment variables

**Step 1.2 — Create `backend/middleware/aiRateLimiter.js`**
- Implement sliding window rate limiter using existing `@upstash/ratelimit` package
- Limit: 20 requests per hour per authenticated user ID
- Use prefix `ratelimit:ai` to separate from existing `ratelimit` prefix

**Step 1.3 — Create `backend/routes/aiRoutes.js`**
- Single route: `POST /summarize`
- Middleware chain: `isAuthenticated` → `aiRateLimiter` → `summarize` controller

**Step 1.4 — Create stub `backend/controllers/aiController.js`**
- Implement `stripHtml()` and `hashContent()` utilities
- Implement input validation
- Return a hardcoded mock response for now (for frontend testing)
- Add Redis cache check/set logic

**Step 1.5 — Mount routes in `backend/server.js`**
- Add: `app.use('/api/ai', require('./routes/aiRoutes'))`

**Step 1.6 — Test with curl or Postman**
```bash
curl -X POST http://localhost:5000/api/ai/summarize \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=..." \
  -d '{"subtopicId":"abc123","noteContent":"<p>Hello world</p>","noteTitle":"Test"}'
```

---

### Phase 2: AI Service Integration

**Goal:** Connect the real Hugging Face API.

**Step 2.1 — Create `backend/services/aiService.js`**
- Implement `summarizeWithBART()` using `facebook/bart-large-cnn`
- Implement `summarizeWithMistral()` using `mistralai/Mistral-7B-Instruct-v0.2`
- Implement `parseMistralOutput()` for structured response parsing
- Implement `generateSummary()` with primary/fallback/terminal error chain

**Step 2.2 — Wire aiService into aiController**
- Replace mock response with real `generateSummary()` call
- Implement the full cache-check → AI call → cache-write flow

**Step 2.3 — Test end-to-end**
- Test with a real note's HTML content
- Verify BART returns a reasonable summary
- Simulate BART failure to verify Mistral fallback activates
- Verify Redis cache is written and returned on second request

**Step 2.4 — (Optional) Update SubTopic model**
- Add `aiSummary` embedded field to `backend/models/SubTopic.js`
- Add fire-and-forget MongoDB write in `aiController.js`

---

### Phase 3: Frontend Hook

**Goal:** Create the data-fetching layer for the UI.

**Step 3.1 — Create `frontend/src/hooks/useAISummary.js`**
- Implement all state: `summary`, `keyPoints`, `isLoading`, `error`, `isStale`
- Implement `generate()` function with Axios POST and 28s timeout
- Implement stale detection via `useEffect` on `selectedNote.content`
- Implement note-switch reset via `useEffect` on `selectedNote._id`
- Add Axios cancel token in cleanup to prevent state updates on unmounted component

**Step 3.2 — Test hook in isolation**
- Temporarily add a test button to any existing component
- Verify all state transitions work correctly
- Verify error states (rate limit, timeout) display correctly

---

### Phase 4: Frontend UI Components

**Goal:** Build the visible AI panel.

**Step 4.1 — Create `frontend/src/components/AISummaryPanel.jsx`**
- Implement all UI states: empty, ready, loading (skeleton), success, error, stale
- Connect to `NoteContext` for `selectedNote`, `selectedTopic`, `selectedCategory`, `selectedGroup`
- Connect to `useAISummary` hook
- Add accessibility attributes (`aria-live`, `role="alert"`, `aria-disabled`)
- Wrap with `React.memo`

**Step 4.2 — Modify `frontend/src/components/EditorOutlineSidebar.jsx`**
- Add `useState(0)` for `activeTab` (local state only)
- Add tab bar JSX (Outline | AI Summary)
- Import and conditionally render `AISummaryPanel`
- Ensure existing outline logic is completely unchanged
- Ensure `editor` prop is NOT passed to `AISummaryPanel`
- Wrap tab bar in `React.memo` if performance testing reveals re-render issues

---

### Phase 5: Integration Testing and Polish

**Goal:** Verify the full feature works end-to-end and is production-ready.

**Step 5.1 — Full flow test**
- Open a note with substantial content
- Switch to "AI Summary" tab
- Click "Generate Summary"
- Verify summary and key points display
- Edit the note → verify `isStale` warning appears
- Click "Regenerate" → verify fresh summary is generated
- Switch to a different note → verify panel resets

**Step 5.2 — Rate limit test**
- Manually trigger 21 requests in rapid succession
- Verify 429 error is displayed gracefully in the UI

**Step 5.3 — Error state tests**
- Temporarily break `HF_API_KEY` → verify 503 is handled gracefully
- Set a very short client timeout → verify timeout error message displays
- Submit a note with only whitespace → verify 400 is handled gracefully

**Step 5.4 — Editor integrity test**
- Switch between Outline and AI Summary tabs rapidly
- Type in the editor while AI Summary tab is active
- Verify editor content, cursor position, and undo history are fully preserved

**Step 5.5 — Performance check**
- Use React DevTools Profiler to confirm tab switching does not cause editor re-renders
- Confirm `AISummaryPanel` does not re-render on every editor keystroke

**Step 5.6 — Deploy to Render**
- Push backend changes; verify `HF_API_KEY` is set in Render dashboard
- Push frontend changes; verify static site rebuilds
- Test from production URL with a real note
- Monitor Render logs for any cold start + timeout issues

---

### Phase 6: Future Enhancements (Post-MVP)

These are out of scope for the initial implementation but worth planning for:

| Enhancement | Description | Prerequisite |
|---|---|---|
| **Persistent summary storage** | Load previously generated summary from MongoDB on note open | Phase 1 Step 2.4 |
| **Copy to clipboard** | Button to copy summary text | Phase 4 complete |
| **AI Q&A / Chat** | Ask questions about the note | New HF endpoint + UI |
| **Multi-note summary** | Summarize all notes in a topic | New backend endpoint |
| **Summary export** | Include AI summary in note export (PDF/MD) | Export feature |
| **Provider upgrade** | Switch to OpenAI GPT-4o for higher quality | Change `aiService.js` only |
| **Streaming responses** | Stream summary tokens to UI for faster perceived response | SSE or WebSocket |
| **Summary history** | Keep last 3 summaries per note | Extend `aiSummary` schema |

---

*End of AI Summary / Review Panel Feature Plan*
