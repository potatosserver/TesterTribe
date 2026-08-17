// Authentication module
import { 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult,
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp, collection } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { auth, db, provider } from './firebase-config.js';
import { DEFAULT_AVATAR } from './constants.js';
import { navigate } from './router.js';
import { m3Confirm } from './m3-dialog.js';

// Detect iOS Safari - popup is almost always blocked there
function isIOSSafari() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
}

// Initialize auth persistence with fallback
export async function initAuthPersistence() {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (err) {
    console.warn('IndexedDB persistence failed, falling back to in-memory:', err);
    try {
      await setPersistence(auth, inMemoryPersistence);
    } catch (e) {
      console.error('All persistence modes failed:', e);
    }
  }
}

// Handle redirect result when page loads after redirect flow
export async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      // Redirect login successful, navigate to dev profile
      // Use navigate if available, otherwise fallback to direct URL change
      if (window.navigate) {
        window.navigate('dev-profile', { authorUid: result.user.uid });
      } else {
        window.location.href = `/dev-profile/${encodeURIComponent(result.user.uid)}`;
      }
    }
  } catch (err) {
    console.error('Redirect result handling failed:', err);
  }
}

export async function signInWithGoogle() {
  // iOS Safari: use redirect directly (popup almost always blocked)
  if (isIOSSafari()) {
    await initAuthPersistence();
    return signInWithRedirect(auth, provider);
  }

  // Other platforms: try popup first
  try {
    return await signInWithPopup(auth, provider);
  } catch (popupErr) {
    // Popup blocked or closed by user -> fallback to redirect
    const isPopupBlocked = popupErr.code === 'auth/popup-blocked' ||
                           popupErr.code === 'auth/popup-closed-by-user' ||
                           popupErr.code === 'auth/cancelled-popup-request' ||
                           popupErr.message?.includes('blocked') ||
                           popupErr.message?.includes('closed');
    
    if (isPopupBlocked) {
      console.log('Popup blocked/closed, falling back to redirect...');
      await initAuthPersistence();
      return signInWithRedirect(auth, provider);
    }
    throw popupErr; // Re-throw other errors (network, config, etc.)
  }
}

export function setupAuth() {
  // Handle redirect result from redirect login flow
  handleRedirectResult().catch(console.error);

  // Profile dropdown
  window.toggleProfileDropdown = (e) => { 
    e.stopPropagation(); 
    document.getElementById('profile-dropdown').classList.toggle('active'); 
  };
  window.closeProfileDropdown = () => document.getElementById('profile-dropdown').classList.remove('active');
  window.addEventListener('click', window.closeProfileDropdown);

  // Logout
  window.handleLogout = async () => { 
    window.closeProfileDropdown(); 
    const confirmed = await m3Confirm('確定登出？', '確認登出');
    if (confirmed) { 
      await signOut(auth); 
      window.navigate('market-android'); 
    } 
  };

  // Open my own dev profile
  window.openMyProfile = () => {
    if (window.currentUser) {
      window.navigate('dev-profile', { authorUid: window.currentUser.uid });
    }
  };

  // Auth state listener
    onAuthStateChanged(auth, async (user) => {
      window.currentUser = user;
      const btnLogin = document.getElementById('btn-login');
      const headerAvatar = document.getElementById('header-avatar');
      const mobileBtnLogin = document.getElementById('mobile-btn-login');
      const mobileMenuMyProfile = document.getElementById('mobile-menu-my-profile');

      if (user) {
        if (btnLogin) btnLogin.style.display = 'none';
        if (headerAvatar) {
          headerAvatar.style.display = 'block';
          headerAvatar.src = user.photoURL || DEFAULT_AVATAR;
        }
        if (mobileBtnLogin) mobileBtnLogin.style.display = 'none';
        if (mobileMenuMyProfile) mobileMenuMyProfile.style.display = 'flex';

        const menuPhoto = document.getElementById('menu-user-photo');
        if (menuPhoto) menuPhoto.src = user.photoURL || DEFAULT_AVATAR;

        const menuName = document.getElementById('menu-user-name');
        if (menuName) menuName.innerText = user.displayName;

        const menuEmail = document.getElementById('menu-user-email');
        if (menuEmail) menuEmail.innerText = user.email;

        const accPhoto = document.getElementById('acc-user-photo');
        if (accPhoto) accPhoto.src = user.photoURL || DEFAULT_AVATAR;

        const accName = document.getElementById('acc-user-name');
        if (accName) accName.innerText = user.displayName;

        const accEmail = document.getElementById('acc-user-email');
        if (accEmail) accEmail.innerText = user.email;

        // Sync user data to Firestore users collection
        // Public data goes to users/{uid}, sensitive data (email) goes to users/{uid}/private/contact
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              displayName: user.displayName,
              photoURL: user.photoURL,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            // Create private subcollection for sensitive data
            const privateRef = doc(collection(db, 'users', user.uid, 'private'), 'contact');
            await setDoc(privateRef, {
              email: user.email,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } else {
            await setDoc(userRef, {
              displayName: user.displayName,
              photoURL: user.photoURL,
              updatedAt: serverTimestamp()
            }, { merge: true });
            // Update private subcollection
            const privateRef = doc(collection(db, 'users', user.uid, 'private'), 'contact');
            await setDoc(privateRef, {
              email: user.email,
              updatedAt: serverTimestamp()
            }, { merge: true });
          }
        } catch (err) {
          console.error('同步用戶資料失敗:', err);
        }

        // Show "我的開發者頁面" menu item
        const menuMyProfile = document.getElementById('menu-my-profile');
        if (menuMyProfile) menuMyProfile.style.display = 'flex';
      } else {
        btnLogin.style.display = 'inline-flex';
        headerAvatar.style.display = 'none';
        if (mobileBtnLogin) mobileBtnLogin.style.display = 'flex';
        if (mobileMenuMyProfile) mobileMenuMyProfile.style.display = 'none';
        window.closeProfileDropdown();
      }
    
      // Check if user just logged in from login page
      checkAndRedirectAfterLogin(user);
    });
}

// Check if user just logged in (coming from login page) and redirect to dev profile
// Use sessionStorage to persist across page refreshes and avoid SPA navigation issues
function getLoginOrigin() {
  return sessionStorage.getItem('auth_login_origin') === 'true';
}

function setLoginOrigin(value) {
  if (value) {
    sessionStorage.setItem('auth_login_origin', 'true');
  } else {
    sessionStorage.removeItem('auth_login_origin');
  }
}

export function setWasOnLoginPage(value) {
  setLoginOrigin(value);
}

// Check if user just logged in (coming from login page) and redirect to dev profile
function checkAndRedirectAfterLogin(user) {
  if (user && getLoginOrigin()) {
    setLoginOrigin(false); // Clear origin to prevent repeated redirects
    if (window.navigate) {
      window.navigate('dev-profile', { authorUid: user.uid });
    } else {
      window.location.href = `/dev-profile/${encodeURIComponent(user.uid)}`;
    }
  }
}

window.authSetLoginOrigin = setWasOnLoginPage;

export function setupLogin() {
  const btn = document.getElementById('btn-login-page');
  if (btn) {
    btn.onclick = () => {
      setWasOnLoginPage(true);
      signInWithGoogle();
    };
  }
}