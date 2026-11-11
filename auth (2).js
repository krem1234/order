// =========================================================
// auth.js – Κοινό module σύνδεσης & ρόλων (Firebase Auth)
// =========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCW2zewf0DdRv-E_lQb9dznRwocu_qa38o",
  authDomain: "order-6014b.firebaseapp.com",
  projectId: "order-6014b",
  storageBucket: "order-6014b.firebasestorage.app",
  messagingSenderId: "656642189339",
  appId: "1:656642189339:web:bb8bf9745f8e44c276b0be",
  measurementId: "G-N16YS8TW0S"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Σελίδα προορισμού ανά ρόλο
export const ROLE_HOME = {
  admin: 'admin.html',
  base: 'base.html',
  pda: 'pda.html',
  kds: 'kitchen.html'
};

export const ROLE_LABELS = {
  admin: 'Διαχειριστής',
  base: 'Ταμείο (Base)',
  pda: 'PDA',
  kds: 'Κουζίνα (KDS)'
};

// Διαθέσιμα themes (ορίζονται από τον διαχειριστή ανά χρήστη στο πεδίο pos_users/{uid}.theme)
export const THEMES = {
  light: '☀️ Λευκό',
  dark: '🌙 Σκούρο',
  green: '🌿 Πράσινο',
  blue: '🔵 Μπλε'
};

export function applyTheme(theme) {
  const t = THEMES[theme] ? theme : 'light';
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('pos_theme', t); } catch (_) {}
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Φέρνει το προφίλ (ρόλο, ενεργός/ανενεργός) του χρήστη από το Firestore
export async function fetchProfile(user) {
  const snap = await getDoc(doc(db, 'pos_users', user.uid));
  return snap.exists() ? { uid: user.uid, email: user.email, ...snap.data() } : null;
}

function waitForUser() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => { unsub(); resolve(user); });
  });
}

export async function logout() {
  try { await signOut(auth); } catch (e) { console.error(e); }
  location.replace('login.html');
}
window.logout = logout;

// Προς login: η υπόλοιπη σελίδα δεν εκτελείται ποτέ (η promise δεν επιλύεται)
function redirectToLogin(reason) {
  location.replace('login.html' + (reason ? '?reason=' + reason : ''));
  return new Promise(() => {});
}

function mountUserBar(profile) {
  // Κρύβει συνδέσμους που είναι μόνο για admin
  if (profile.role !== 'admin') {
    document.querySelectorAll('[data-admin-only]').forEach((el) => el.remove());
  }
  const host = document.querySelector('.header-actions') || document.querySelector('.pda-header');
  if (!host) return;
  const bar = document.createElement('div');
  bar.className = 'user-chip';
  bar.innerHTML =
    '<span class="user-chip-name">👤 ' + esc(profile.name || profile.email) +
    '<small>' + esc(ROLE_LABELS[profile.role] || profile.role) + '</small></span>' +
    '<button class="btn btn-ghost btn-sm" type="button" onclick="logout()">Έξοδος</button>';
  host.appendChild(bar);
}

// Καλείται στην αρχή κάθε προστατευμένης σελίδας:
//   const me = await requireRole(['admin']);
export async function requireRole(allowedRoles) {
  const user = await waitForUser();
  if (!user) return redirectToLogin();

  let profile = null;
  try {
    profile = await fetchProfile(user);
  } catch (e) {
    console.error('Αδυναμία ανάγνωσης προφίλ:', e);
  }

  if (!profile || profile.active === false) {
    await signOut(auth);
    return redirectToLogin('disabled');
  }

  if (!allowedRoles.includes(profile.role)) {
    const home = ROLE_HOME[profile.role];
    if (home) location.replace(home); else return redirectToLogin('norole');
    return new Promise(() => {});
  }

  applyTheme(profile.theme);
  // Ζωντανή αλλαγή theme όταν το αλλάζει ο διαχειριστής
  onSnapshot(doc(db, 'pos_users', user.uid), (snap) => {
    if (snap.exists()) applyTheme(snap.data().theme);
  }, () => {});

  mountUserBar(profile);
  document.documentElement.style.visibility = 'visible';
  return profile;
}
