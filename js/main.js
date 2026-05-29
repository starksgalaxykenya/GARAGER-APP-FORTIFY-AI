import { auth, onAuthStateChanged, signOut, getMockRole, handleLoginSignup } from './auth.js';
import { db } from './firebase-config.js';
import { loadErrorCodes, lookupErrorCodeUI } from './error-codes.js';
import { saveCarEntry } from './car-entry.js';
import { completeServiceJob, generateServiceReportPDF, initializeGeneralService } from './general-service.js';
import { saveNewClient, filterClients, lookupClientDetails, autofillVehicleDetails, listenForClients, listenForCarsForCache } from './clients.js';
import { createJobCard, generateAnalysisReportPDF, openDetailedReport, sendJobCardViaWhatsApp } from './job-cards.js';
import { generateDailyReport, generateMonthlyReport, generateReportPDF, setCompletedJobsCache } from './reports.js';
import { fetchCars, markCarAsCompleted, deleteCompletedCar } from './car-list.js';
import { addErrorCodeInput, removeErrorCodeInput, lookupErrorCodeUI as lookupErrorCode, addRepairPlanCard, removeRepairPlanCard, getAllErrorCodesWithMeaning, getAllRepairPlanItems } from './utils-ui.js';

// Expose globally for inline onclick
window.handleLoginSignup = (isLogin) => {
    const email = document.getElementById('auth-email').value;
    const pwd = document.getElementById('auth-password').value;
    const msg = document.getElementById('auth-message');
    handleLoginSignup(isLogin, email, pwd).catch(err => { msg.textContent = err.message; });
};
window.addErrorCodeInput = addErrorCodeInput;
window.removeErrorCodeInput = removeErrorCodeInput;
window.lookupErrorCode = (btn) => lookupErrorCodeUI(btn);
window.createJobCard = createJobCard;
window.generateAnalysisReportPDF = generateAnalysisReportPDF;
window.generateServiceReportPDF = generateServiceReportPDF;
window.markCarAsCompleted = markCarAsCompleted;
window.deleteCompletedCar = deleteCompletedCar;
window.openDetailedReport = openDetailedReport;
window.addRepairPlanCard = addRepairPlanCard;
window.removeRepairPlanCard = removeRepairPlanCard;
window.sendJobCardViaWhatsApp = sendJobCardViaWhatsApp;
window.completeServiceJob = completeServiceJob;
window.generateDailyReport = generateDailyReport;
window.generateMonthlyReport = generateMonthlyReport;
window.saveNewClient = saveNewClient;
window.filterClients = filterClients;
window.lookupClientDetails = lookupClientDetails;
window.autofillVehicleDetails = autofillVehicleDetails;
window.fetchCars = fetchCars;
window.showSection = showSection;
window.openClientVehiclesModal = (phone, name) => { alert(`Vehicles for ${name} – implement modal or list`); };
window.generateReportPDF = generateReportPDF;

// Navigation
function showSection(sectionId) {
    const sections = ['auth-section', 'car-entry', 'general-service', 'clients-section', 'car-list', 'completed-list', 'reports-section'];
    sections.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const target = document.getElementById(sectionId);
    if (target) target.style.display = 'block';
    if (sectionId === 'car-list') fetchCars('Active');
    if (sectionId === 'completed-list') fetchCars('Completed');
    if (sectionId === 'general-service') initializeGeneralService();
}

document.getElementById('nav-car-entry')?.addEventListener('click', () => showSection('car-entry'));
document.getElementById('nav-general-service')?.addEventListener('click', () => showSection('general-service'));
document.getElementById('nav-clients-list')?.addEventListener('click', () => showSection('clients-section'));
document.getElementById('nav-car-list')?.addEventListener('click', () => showSection('car-list'));
document.getElementById('nav-completed-list')?.addEventListener('click', () => showSection('completed-list'));
document.getElementById('nav-reports-section')?.addEventListener('click', () => showSection('reports-section'));
document.getElementById('nav-management-console')?.addEventListener('click', () => {
    if (auth.currentUser) window.location.href = 'management.html';
    else { alert('Login required'); showSection('auth-section'); }
});
document.getElementById('logoutBtn')?.addEventListener('click', () => signOut(auth));
document.getElementById('car-entry-form')?.addEventListener('submit', saveCarEntry);
document.getElementById('whatsapp-btn')?.addEventListener('click', sendJobCardViaWhatsApp);
document.getElementById('dailyDownloadBtn')?.addEventListener('click', () => generateReportPDF('daily'));
document.getElementById('monthlyDownloadBtn')?.addEventListener('click', () => generateReportPDF('monthly'));

// Auth state
let unsubClients = null, unsubCars = null, unsubActive = null, unsubCompleted = null;
onAuthStateChanged(auth, (user) => {
    const nav = document.querySelector('header nav');
    if (user) {
        document.getElementById('logoutBtn').style.display = 'block';
        if (nav) nav.style.display = 'flex';
        if (unsubClients) unsubClients();
        if (unsubCars) unsubCars();
        unsubClients = listenForClients();
        unsubCars = listenForCarsForCache();
        showSection('car-list');
        // Bind completed jobs cache to reports module
        window.completedJobsCache = [];
        const originalFetch = fetchCars;
        window.fetchCars = (status) => {
            if (status === 'Completed') {
                const origOnSnapshot = window.onSnapshot; // simplified – assume we have a global listener
                // For brevity, we patch via a simple setter in car-list.js
            }
            originalFetch(status);
        };
    } else {
        if (unsubClients) unsubClients();
        if (unsubCars) unsubCars();
        if (unsubActive) unsubActive();
        if (unsubCompleted) unsubCompleted();
        document.getElementById('logoutBtn').style.display = 'none';
        if (nav) nav.style.display = 'none';
        showSection('auth-section');
    }
});

// Init UI
loadErrorCodes();
addErrorCodeInput();
addRepairPlanCard('Full diagnostic and repair of error codes.', '');
