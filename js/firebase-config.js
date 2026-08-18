// Firebase configuration and initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app-check.js';

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

// App Check - 保護 Firestore 免受濫用/爬蟲
// 已設定 reCAPTCHA v3 Site Key
const RECAPTCHA_V3_SITE_KEY='6LcCLostAAAAAG_uh5TUAZF409hs2YHZLUh0P5Ml';

if (RECAPTCHA_V3_SITE_KEY !== 'YOUR_RECAPTCHA_V3_SITE_KEY') {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_V3_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
    console.log('[App Check] 已啟用 reCAPTCHA v3 保護');
  } catch (err) {
    console.warn('[App Check] 初始化失敗:', err.message);
  }
} else {
  console.log('[App Check] 未設定 site key，跳過初始化（開發模式）');
}

export const auth = getAuth(app);
export const db = getFirestore(app);

import { GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
export const provider = new GoogleAuthProvider();