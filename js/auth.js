import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

export function getMockRole(email) {
    return email && email.toLowerCase().includes('admin') ? 'admin' : 'mechanic';
}

export async function handleLoginSignup(isLogin, email, password) {
    if (isLogin) {
        return signInWithEmailAndPassword(auth, email, password);
    } else {
        if (email && !email.toLowerCase().includes('admin')) {
            throw new Error('Only Admins can sign up new accounts.');
        }
        return createUserWithEmailAndPassword(auth, email, password);
    }
}

export { auth, onAuthStateChanged, signOut };
