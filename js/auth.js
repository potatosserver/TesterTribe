// Authentication module
import { signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { auth, db, provider } from './firebase-config.js';
import { DEFAULT_AVATAR } from './constants.js';

export function setupAuth() {
  // Login button
  document.getElementById('btn-login').onclick = () => signInWithPopup(auth, provider);

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
    if (confirm('確定登出？')) { 
      await signOut(auth); 
      window.switchTab('market'); 
    } 
  };

  // Open my own dev profile
  window.openMyProfile = () => {
    if (window.currentUser) {
      window.switchTab('devProfile', { authorUid: window.currentUser.uid });
    }
  };

  // Auth state listener
  onAuthStateChanged(auth, async (user) => {
    window.currentUser = user;
    const btnLogin = document.getElementById('btn-login');
    const headerAvatar = document.getElementById('header-avatar');
    
    if (user) {
      btnLogin.style.display = 'none';
      headerAvatar.style.display = 'block';
      headerAvatar.src = user.photoURL || DEFAULT_AVATAR;
      document.getElementById('menu-user-photo').src = user.photoURL || DEFAULT_AVATAR;
      document.getElementById('menu-user-name').innerText = user.displayName;
      document.getElementById('menu-user-email').innerText = user.email;
      document.getElementById('acc-user-photo').src = user.photoURL || DEFAULT_AVATAR;
      document.getElementById('acc-user-name').innerText = user.displayName;
      document.getElementById('acc-user-email').innerText = user.email;

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
      const menuMyProfile = document.getElementById('menu-my-profile');
      if (menuMyProfile) menuMyProfile.style.display = 'none';
      window.closeProfileDropdown();
      window.switchTab('market');
    }
  });
}