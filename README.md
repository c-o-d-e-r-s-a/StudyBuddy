# 📚 StudyBuddy

An AI study companion that watches for attention drops during self-paced learning and offers help grounded in your own notes.

**Try it:** [Live Demo](https://attentive-tutor.lovable.app/) · [DevPost](https://devpost.com/software/studybuddy-21w574)

## 💡 Inspiration

In self-paced study there is no instructor to notice a glazed-over look or a stuck moment. StudyBuddy explores whether **on-device computer vision** plus **RAG over the learner’s materials** can intervene at the right time, without uploading raw webcam video.

## ⚙️ What it does

1. Upload study materials (PDF / notes)
2. Study while the browser analyzes the webcam feed locally
3. When sustained distraction / attention-drop signals appear, the tutor can intervene with explanations grounded in your notes
4. Ask follow-ups via text or voice
5. Review session signals (focus / distraction events)

## 🛠️ How we built it

| Layer | Stack |
|-------|--------|
| Frontend | Next.js, React, TypeScript |
| Backend | Node.js, Express, Socket.IO |
| Vision | OpenCV.js **in the browser** (face presence, head-movement / look-away proxies) |
| Tutoring | Google Gemini + embeddings / FAISS RAG over uploaded notes |
| Voice | Microphone → backend transcription (Gemini) · TTS via ElevenLabs |

### 🔐 Privacy model (accurate)

- **Webcam frames stay on-device.** OpenCV.js runs in the browser; the server receives only derived events (e.g. timestamps, face-present, distraction score)—not video frames.
- **Not everything is local.** Voice audio and text questions are sent to the backend and cloud APIs (Gemini / ElevenLabs) so the tutor can answer.
- **Hackathon sensing is heuristic**, not a production emotion model: distraction is estimated from face detection and head-movement / gaze-away proxies, with thresholds and rate limits to reduce noisy interventions. A simulated sensing module exists for demos when the camera path is unstable.

### ⚡ Real-time pipeline

Socket.IO keeps a session open between browser and server. Client-side sensing emits events → backend may trigger a RAG + Gemini response → answer (and optional speech) streams back to the UI.

## 🚧 Challenges

- **False positives:** early thresholds fired too often; fixed with sustained-signal windows and intervention rate limits
- **Long sessions:** Socket.IO reconnect / heartbeat hardening
- **Camera / browser variance:** WebRTC permission and OpenCV.js load differences across browsers
- **Large PDFs:** parsing and embedding without freezing the UI

## 🔬 What’s next / research directions

- Stronger validation of intervention timing vs learning outcomes
- Confusion heatmaps over note sections
- Spaced-repetition cards from high-friction topics
- Clearer separation of on-device sensing vs cloud tutoring for privacy reviews

## 🚀 Quick start

```bash
# Backend
cd backend
cp .env.example .env   # add GEMINI_API_KEY, ELEVENLABS_* 
npm install
npx ts-node src/index.ts

# Frontend (other terminal)
cd frontend
npm install
npm run dev
```

Never commit `.env`. Use `backend/.env.example` as the template.

## 💻 Built with

Next.js · React · TypeScript · Node.js · Socket.IO · OpenCV.js · Google Gemini · WebRTC · ElevenLabs
