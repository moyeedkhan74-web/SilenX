# SecureChat Application

A real-time chat application with WebRTC video/audio calls and end-to-end encryption readiness.

## Features
- Real-time messaging via Socket.io
- Video and Audio calls via WebRTC (Google STUN + Open Relay TURN)
- Typing indicators
- End-to-end encryption ready architecture
- Status indicators

## Tech Stack
- **Backend:** Node.js, Express, Socket.io, TypeScript
- **Frontend:** React, TypeScript, Vite, WebRTC, Zustand
- **Deployment:** Vercel (Frontend), Northflank (Backend) completely free tier capable!

## Setup Instructions

### Backend setup
1. `cd backend`
2. `npm install`
3. `cp .env.example .env`
4. `npm run dev`

### Frontend setup
1. `cd frontend`
2. `npm install`
3. `cp .env.example .env`
4. `npm run dev`

### Deployment
- Deploy Frontend via Vercel connecting to root/frontend dir.
- Deploy Backend via Northflank using the provided Dockerfile.
