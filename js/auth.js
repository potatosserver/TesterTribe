// Authentication module
import { signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';
import { auth, db, provider } from './firebase-config.js';
import { DEFAULT_AVATAR } from './constants.js';
import { navigate, getStoreFromUrl } from './router.js';
import { m3Confirm } from './m3-dialog.js';

export function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function setupAuth() {
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
      window.switchTab('market'); 
    } 
  };

  // Open my own dev profile
  window.openMyProfile = () => {
    if (window.currentUser) {
      const store = getStoreFromUrl(); // Get current store from URL
      window.navigate('dev-profile', { store, authorIdentifier: window.currentUser.uid });
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
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } else {
            await setDoc(userRef, {
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL,
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
        window.switchTab('market');
      }
    
      // Check if user just logged in from login page
      checkAndRedirectAfterLogin(user);
    });
}

// Check if user just logged in (coming from login page) and redirect to dev profile
let wasOnLoginPage = false;
export function setWasOnLoginPage(value) {
  wasOnLoginPage = value;
}
window.authSetLoginOrigin = setWasOnLoginPage;

function checkAndRedirectAfterLogin(user) {
  if (wasOnLoginPage && user) {
    wasOnLoginPage = false;
    const store = getStoreFromUrl();
    window.navigate('dev-profile', { store, authorIdentifier: user.uid });
  }
}

export function setupLogin() {
  const btn = document.getElementById('btn-login-page');
  if (btn) {
    btn.onclick = () => {
      setWasOnLoginPage(true);
      signInWithGoogle();
    };
  }
}