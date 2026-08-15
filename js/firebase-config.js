// Firebase configuration and initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDqbzXsf5zMTnddV4DNyws3fuOOA6QacaQ",
  authDomain: 'testertribe-eb02a.firebaseapp.com',
  projectId: 'testertribe-eb02a',
  storageBucket: 'testertribe-eb02a.firebasestorage.app',
  messagingSenderId: '26372711857',
  appId: '1:26372711857:web:b543d4e5e1659e7f1c4990',
  measurementId: 'G-PR6EBNSZH7'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

import { GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
export const provider = new GoogleAuthProvider();