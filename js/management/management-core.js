import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = { /* same as before */ };
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

import { initFinance, cleanupFinance } from './finance.js';
import { initInventory, cleanupInventory } from './inventory.js';
import { initSuppliers, cleanupSuppliers } from './suppliers.js';
import { initInvoices, cleanupInvoices } from './invoices.js';
import { initQuotes, cleanupQuotes } from './quotes.js';

const authSection = document.getElementById('auth-section-management');
const dashboard = document.getElementById('management-dashboard');
const loginBtn = document.getElementById('managementLoginBtn');
const logoutBtn = document.getElementById('managementLogoutBtn');
const authMessage = document.getElementById('management-auth-message');

let currentTab = 'finance';

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`content-${tabId}`).classList.remove('hidden');
    if (tabId === 'finance') initFinance();
    else if (tabId === 'inventory') initInventory();
    else if (tabId === 'suppliers') initSuppliers();
    else if (tabId === 'invoices') initInvoices();
    else if (tabId === 'quotes') initQuotes();
}

document.getElementById('tab-finance').onclick = () => { currentTab = 'finance'; showTab('finance'); };
document.getElementById('tab-inventory').onclick = () => { currentTab = 'inventory'; showTab('inventory'); };
document.getElementById('tab-suppliers').onclick = () => { currentTab = 'suppliers'; showTab('suppliers'); };
document.getElementById('tab-invoices').onclick = () => { currentTab = 'invoices'; showTab('invoices'); };
document.getElementById('tab-quotes').onclick = () => { currentTab = 'quotes'; showTab('quotes'); };

async function handleLogin() {
    const email = document.getElementById('management-email').value;
    const password = document.getElementById('management-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        authMessage.textContent = `Login failed: ${error.message}`;
    }
}
loginBtn.onclick = handleLogin;

onAuthStateChanged(auth, (user) => {
    if (user) {
        authSection.style.display = 'none';
        dashboard.style.display = 'block';
        logoutBtn.style.display = 'block';
        showTab(currentTab);
    } else {
        authSection.style.display = 'flex';
        dashboard.style.display = 'none';
        logoutBtn.style.display = 'none';
        cleanupFinance(); cleanupInventory(); cleanupSuppliers(); cleanupInvoices(); cleanupQuotes();
    }
});

logoutBtn.onclick = () => signOut(auth);
