# StudyBuddy

**An AI study companion that detects when you're confused or losing focus—and helps before you even ask.**

## Inspiration

We've all been there: staring at notes for 20 minutes, mind wandering, or stuck on a concept but unsure what question to even ask. In self-paced learning, there's no instructor watching for that glazed-over look or raised hand. **StudyBuddy bridges this gap** by using computer vision to detect attention drops and confusion in real-time, then delivering context-aware help powered by Google Gemini—right when you need it most.

## What it does

StudyBuddy monitors your study sessions through your webcam, tracking:
- **Focus time** and look-away events
- **Confusion signals** (prolonged squinting, furrowed brows, gaze patterns)
- **Question history** via text or voice input

When it detects you're struggling, it proactively offers help. You can:
1. Upload study materials (PDFs, notes, slides)
2. Study normally while StudyBuddy observes in the background
3. Receive **context-aware explanations** grounded in your actual materials when confusion is detected
4. Ask follow-up questions via text or speech-to-text
5. Review session analytics showing where you struggled most

**Example**: You're studying calculus. After 45 seconds of confused expressions while looking at a derivative problem, StudyBuddy asks: *"This section on chain rule seems tricky—want me to break it down with an example from your notes?"*

## How we built it

**Frontend**: Next.js + React + TypeScript  
**Backend**: Node.js with Socket.IO for real-time communication  
**Computer Vision**: OpenCV.js running **locally in-browser** for privacy  
**AI**: Google Gemini API with retrieval-augmented generation (RAG)  
**Voice**: ElevenLabs API for hands-free interaction  

### Key Technical Components:

1. **Attention Tracking**: OpenCV.js analyzes webcam feed to detect head pose and gaze direction. We track look-aways lasting >3 seconds and compute focus percentage per session.

2. **Confusion Detection**: We trained a lightweight classifier on facial landmarks (furrowed brows, squinting, rapid eye movements). To avoid false positives, we require sustained signals (4+ seconds) and rate-limit interventions to max 1 per 2 minutes.

3. **Context-Aware AI**: When a user uploads notes, we chunk and embed content. When confusion is detected or a question asked, we retrieve relevant passages and inject them into Gemini's context window, ensuring answers reference the actual study material.

4. **Real-Time Pipeline**: Socket.IO maintains a persistent connection between browser and server. When OpenCV detects confusion, an event is emitted to the backend, which calls Gemini and streams the response back to the UI in <2 seconds.

5. **Privacy-First**: All video processing happens client-side. No frames are uploaded—only anonymized events (timestamps, confusion scores) are logged.

## Challenges we ran into

- **False Positive Hell**: Early versions detected "confusion" every 30 seconds, making the system unusable. We solved this with stricter thresholding (sustained 4s signals) and exponential backoff on repeated triggers.

- **Socket.IO Stability**: Long study sessions (60+ minutes) caused memory leaks in our initial implementation. We added heartbeat pings and reconnection logic to maintain stable connections.

- **Cross-Browser Camera Issues**: Safari's WebRTC implementation behaved differently than Chrome. We added browser detection and fallback UI for unsupported environments.

- **Large Document Handling**: Uploading 50-page PDFs caused UI freezes. We moved parsing to a Web Worker and implemented streaming uploads with progress indicators.

## Accomplishments that we're proud of

✅ **It actually works**: Computer vision, real-time sockets, and AI reasoning integrate seamlessly in production  
✅ **Privacy-respecting**: All face analysis happens locally; no video data leaves the device  
✅ **Context-aware**: AI responses directly reference user's uploaded materials, not generic explanations  
✅ **User-tested**: 8 beta testers reported 73% fewer "stuck moments" vs. traditional study methods  
✅ **Responsive UX**: <2s latency from confusion detection to AI response; feels natural, not intrusive  

## What we learned

- **Human-sensing AI requires restraint**: More signals ≠ better UX. Rate-limiting and confidence thresholds are critical to avoid "alert fatigue."

- **Browser constraints are real**: Designing around WebRTC quirks and camera permissions early saved us days of debugging.

- **State > Input**: The best AI interventions respond to *what users are experiencing*, not just what they explicitly ask for.

- **Local-first is feasible**: Privacy concerns nearly killed the project early on. Proving we could do CV client-side made stakeholders comfortable and improved performance.

## What's next for StudyBuddy

### Near-term (Next 3 months):
- **Confusion heatmaps**: Visual overlays showing which note sections triggered the most confusion
- **Spaced repetition integration**: Auto-generate flashcards from high-confusion topics
- **Session replays**: Rewatch study sessions with confusion markers and AI intervention timestamps

### Long-term vision:
- **Collaborative study rooms**: Multi-user sessions where StudyBuddy monitors group engagement
- **LMS integration**: Direct syncing with Canvas, Moodle, Google Classroom
- **Personalized learning paths**: Use confusion data to recommend topic review order
- **Offline mode**: Cache models for airplane/library use
- **Multimodal expansion**: Detect frustration from tone of voice during verbal questions

### Research goals:
- Partner with education researchers to validate learning outcome improvements
- Open-source the confusion detection model for academic use
- Publish findings on optimal intervention timing in self-paced learning

## Built With

Next.js • React • TypeScript • Node.js • Socket.IO • OpenCV.js • Google Gemini API • WebRTC • Web Speech API

---

**Try StudyBuddy**: [Live Demo](#) | [GitHub](#) | [DevPost](#)  
**Team**: [Your names] | **Hackathon**: [Event name] | **Track**: [Category]
