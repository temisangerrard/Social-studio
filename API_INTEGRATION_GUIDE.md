# Social Studio API Integration Guide

**Status:** Deployed on Railway  
**Base URL:** `https://social-studio.railway.app` (or your Railway domain)

---

## Overview

The Social Studio backend is a Node.js REST API that powers content generation and brand management. It's already deployed on Railway and ready for integration with your other tools.

**Key capabilities:**
- Generate social media content (captions, hashtags, hooks, platform-specific notes)
- Assistant-driven content strategy via multi-turn conversation
- Brand profile management
- User uploads and asset management
- Job tracking for long-running generation tasks

---

## 1. Core API Endpoints

### Health Check
```
GET /api/brands
```
Simple health check endpoint. Returns array of available brands.

---

## 2. Brand Management

### List All Brands
```
GET /api/brands
```
**Response:** `BrandProfile[]`

### Get Brand Details
```
GET /api/brands/:brandId
```
**Example:** `GET /api/brands/peppera`

**Response:**
```json
{
  "id": "peppera",
  "name": "Peppera",
  "description": "...",
  "values": ["...", "..."],
  "tone": "...",
  "audience": {...},
  "mascot": {
    "name": "...",
    "description": "...",
    "visualPrompt": "...",
    "referenceImages": ["url1", "url2"]
  }
}
```

### Create/Update Brand
```
POST /api/brands
Content-Type: application/json

{
  "id": "my-brand",
  "name": "My Brand",
  "description": "Brand description",
  "values": ["value1", "value2"],
  "tone": "friendly",
  "audience": {
    "demographics": "...",
    "psychographics": "...",
    "painPoints": "..."
  },
  "mascot": {
    "name": "Brand mascot",
    "description": "...",
    "visualPrompt": "...",
    "referenceImages": []
  }
}
```

**Response:** `{ "ok": true }`

### Upload Mascot Reference Image
```
POST /api/brands/:brandId/mascot-upload
Content-Type: application/json

{
  "filename": "mascot.jpg",
  "dataUrl": "data:image/jpeg;base64,..."
}
```

**Response:**
```json
{
  "url": "/api/uploads/mascot-1234567-abcde.jpg",
  "referenceImages": ["url1", "url2", "url3"]
}
```

### Delete Mascot Reference Image
```
DELETE /api/brands/:brandId/mascot-refs/:imageIndex
```

---

## 3. Content Generation

### Start Generation Job
```
POST /api/generate
Content-Type: application/json

{
  "brandProfileId": "peppera",
  "workflow": "slideshow",
  "product": "product-name",
  "platform": "instagram",
  "idea": "Your content idea",
  "visualMode": "mascot-led",
  "deliveryTarget": "carousel",
  "ingredients": "optional context",
  "references": ["url1", "url2"]
}
```

**Response:**
```json
{
  "jobId": "gen_1234567_abcde",
  "status": "pending"
}
```

### Poll Job Status
```
GET /api/jobs/:jobId
```

**Response (in progress):**
```json
{
  "id": "gen_1234567_abcde",
  "status": "running",
  "stage": "rendering",
  "createdAt": "2024-04-10T12:00:00Z"
}
```

**Response (complete):**
```json
{
  "id": "gen_1234567_abcde",
  "status": "done",
  "stage": "done",
  "result": {
    "postId": "output_id",
    "product": "product-name",
    "platform": "instagram",
    "created_at": "2024-04-10T12:00:00Z",
    "content": {
      "captions": ["caption 1", "caption 2"],
      "hashtags": ["#tag1", "#tag2"],
      "hooks": ["hook1", "hook2"],
      "platformNotes": "..."
    }
  }
}
```

**Response (failed):**
```json
{
  "id": "gen_1234567_abcde",
  "status": "failed",
  "stage": "failed",
  "error": "Error message"
}
```

---

## 4. Assistant (Interactive Strategy)

### Create Assistant Session
```
POST /api/assistant/sessions
Content-Type: application/json

{
  "productId": "peppera"
}
```

**Response:**
```json
{
  "id": "session_1234567_abcde",
  "productId": "peppera",
  "status": "interviewing",
  "currentQuestion": "What are you trying to make today?",
  "messages": [],
  "inferredBrief": {
    "goal": "",
    "audience": "",
    "offer": "",
    "tone": "",
    "platform": ""
  },
  "checkpoints": {
    "strategy": "pending",
    "hooks": "pending",
    "visuals": "pending",
    "finalPackage": "pending"
  },
  "createdAt": "2024-04-10T12:00:00Z",
  "updatedAt": "2024-04-10T12:00:00Z"
}
```

### Get Session
```
GET /api/assistant/sessions/:sessionId
```

### Send Message to Assistant
```
POST /api/assistant/sessions/:sessionId/reply
Content-Type: application/json

{
  "text": "User message"
}
```

**Response:**
```json
{
  "session": {
    "id": "...",
    "messages": [
      { "id": "...", "role": "user", "text": "...", "createdAt": "..." },
      { "id": "...", "role": "assistant", "text": "...", "createdAt": "..." }
    ],
    "inferredBrief": {
      "goal": "updated goal",
      "audience": "updated audience",
      ...
    },
    "currentQuestion": "Next question",
    ...
  },
  "shouldGenerate": false  // true when brief is complete
}
```

### Update Session
```
POST /api/assistant/sessions/:sessionId
Content-Type: application/json

{
  "status": "generating",
  "checkpoints": {
    "strategy": "complete",
    "hooks": "complete",
    "visuals": "complete",
    "finalPackage": "pending"
  }
}
```

---

## 5. Outputs & Results

### List All Outputs
```
GET /api/outputs
```

**Response:**
```json
[
  {
    "postId": "output_id_1",
    "createdAt": "2024-04-10T12:00:00Z",
    "product": "peppera",
    "platform": "instagram"
  },
  ...
]
```

### Get Output Details
```
GET /api/outputs/:postId
```

**Response:** `PostMetadata` (same as generation result)

---

## 6. File Management

### Upload Generic File
```
POST /api/uploads
Content-Type: application/json

{
  "filename": "my-image.jpg",
  "dataUrl": "data:image/jpeg;base64,..."
}
```

**Supported types:** `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `video/mp4`, `video/webm`

**Response:**
```json
{
  "filename": "my-image-1234567-abcde.jpg",
  "url": "/api/uploads/my-image-1234567-abcde.jpg",
  "mimeType": "image/jpeg"
}
```

### Serve Upload
```
GET /api/uploads/:filename
```

### Serve Generated Slides
```
GET /api/slides/:postId/:filename
```

### Serve Generated Assets
```
GET /api/assets/:postId/:filename
```

### Serve Brand Assets
```
GET /api/brand-assets/:brandId/:imageIndex
```

---

## 7. Products & Context

### List Products
```
GET /api/products
```

### Get Product Context
```
GET /api/products/:productId/context
```

---

## Integration Checklist

- [ ] Add base URL as environment variable: `SOCIAL_STUDIO_API_BASE_URL`
- [ ] Enable CORS headers (if calling from browser): Add `Access-Control-Allow-Origin: *` to backend
- [ ] Implement polling for job status (recommended: poll every 2-5 seconds)
- [ ] Handle 404 and 500 errors gracefully
- [ ] Store `jobId` and `sessionId` for future reference
- [ ] Use `dataUrl` format for file uploads (base64-encoded)

---

## Example Integration Flow

### 1. Generate Content (Direct Brief)
```javascript
// Start generation
const genRes = await fetch('https://social-studio.railway.app/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    brandProfileId: 'peppera',
    workflow: 'slideshow',
    product: 'my-product',
    platform: 'instagram',
    idea: 'Launch announcement',
    visualMode: 'mascot-led',
    deliveryTarget: 'carousel'
  })
});

const { jobId } = await genRes.json();

// Poll for completion
let job;
while (true) {
  const jobRes = await fetch(`https://social-studio.railway.app/api/jobs/${jobId}`);
  job = await jobRes.json();
  
  if (job.status === 'done' || job.status === 'failed') break;
  await new Promise(r => setTimeout(r, 2000)); // wait 2 seconds
}

// Use result
if (job.status === 'done') {
  console.log('Captions:', job.result.content.captions);
  console.log('Hashtags:', job.result.content.hashtags);
}
```

### 2. Interactive Assistant Flow
```javascript
// Create session
const sessionRes = await fetch('https://social-studio.railway.app/api/assistant/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ productId: 'peppera' })
});

const { id: sessionId, currentQuestion } = await sessionRes.json();
console.log(currentQuestion); // "What are you trying to make today?"

// Chat loop
const userMessage = "I want to launch a new product";
const replyRes = await fetch(`https://social-studio.railway.app/api/assistant/sessions/${sessionId}/reply`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: userMessage })
});

const { session, shouldGenerate } = await replyRes.json();
console.log(session.currentQuestion); // Next AI question
console.log(shouldGenerate); // true when ready to generate
```

---

## Environment Variables (for Railway)

Already configured:
- `PORT` = 3000
- `NODE_ENV` = production

Optional:
- `FAL_KEY` = For image generation (if using FAL)
- `OPENAI_API_KEY` = For LLM-powered features

---

## CORS Considerations

If calling from a different domain, you may need to add CORS headers. Update `src/server.ts` to add:

```javascript
if (req.method === "OPTIONS") {
  res.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end();
  return;
}

// Add to all responses:
"Access-Control-Allow-Origin": "*"
```

---

## Error Handling

All errors return JSON with `error` field and appropriate HTTP status:
- `400` - Bad request (missing required fields)
- `404` - Not found (brand, session, job, etc.)
- `500` - Server error

Example:
```json
{ "error": "Brand not found" }
```

---

## Support & Questions

For integration questions, check the source code:
- `src/server.ts` - All API endpoints
- `src/types.ts` - Type definitions
- `public/app.js` - Frontend integration examples

---

## Handoff Notes for LLM

### What This API Does
The Social Studio backend is a content generation service that:
1. Manages brand profiles with customizable mascots, tone, values, and audience
2. Generates social media content (captions, hashtags, hooks, platform notes) via two methods:
   - **Direct generation** from a brief (fast, one-shot)
   - **Assistant-driven** multi-turn conversation (interactive, strategy-focused)
3. Stores generated outputs and allows downloading/retrieval

### Key Integration Points
- The frontend (`public/app.js`) shows how to call these APIs
- Generations are async jobs—always poll with `/api/jobs/:jobId`
- File uploads must be base64-encoded data URLs
- The assistant gradually infers a "brief" from conversation

### If Someone Asks To...
- **Add a new brand:** POST `/api/brands` with the shape from endpoint docs
- **Allow brands from external database:** Modify `storage.ts` to read from your DB instead of filesystem
- **Add authentication:** Wrap `handleRequest()` with auth check middleware
- **Add webhooks:** Store callbacks in-memory and POST to them when jobs complete
- **Stream generation updates:** Modify job handler to send Server-Sent Events
- **Integrate with Slack/Discord:** Create endpoint that takes a jobId and posts results to external service

### Code Locations
- API routes: `src/server.ts` (lines 85-400)
- Storage/persistence: `src/storage.ts`
- Brand types: `src/types.ts` (look for `BrandProfile`)
- Job queue logic: `src/server.ts` (lines 82-105)

### Testing the APIs
```bash
# Create brand
curl -X POST https://social-studio.railway.app/api/brands \
  -H "Content-Type: application/json" \
  -d '{"id":"test","name":"Test","description":"Test brand"}'

# Generate content
curl -X POST https://social-studio.railway.app/api/generate \
  -H "Content-Type: application/json" \
  -d '{"brandProfileId":"peppera","product":"test","idea":"test idea"}'

# Get job status
curl https://social-studio.railway.app/api/jobs/gen_xyz
```

---

**Last Updated:** April 2024  
**Deployed:** Railway  
**Status:** Production Ready
