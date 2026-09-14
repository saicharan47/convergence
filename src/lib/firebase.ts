import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Placeholder config. The user will need to replace this with their actual Firebase config.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Data Models based on requirements:
// 1. Exact Firestore Schema: Clues embedded in a single `tracks` document
// 2. Auth Strategy: Custom session (Team Name + Secret Code) matching a document in Firestore
// 3. Leaderboard Scope: Per-track

export interface Clue {
  id: string;
  title: string;
  riddle: string;
  instruction: string;
  answerCode: string; // The 5-letter physical code on-site
  imageUrl?: string;
}

export interface TrackData {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  clues: Clue[];
}

export interface TeamData {
  id: string; // The document ID
  name: string;
  track: string; // Track ID (e.g. 'A', 'B')
  secretCode: string; // For the custom session auth
  unlockedClueIndex: number;
  checkpoints: { clueId: string; completedAt: number }[];
  createdAt: number;
}

export interface RoomData {
  id: string; // e.g., 'ADMIN'
  isActive: boolean;
  isHuntStarted: boolean;
  tracks: string[]; // List of track IDs available in this room
}
