import { db, auth } from './firebase-config.js';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const carsCollection = collection(db, 'cars');

let unsubscribeActive = null;
let unsubscribeCompleted = null;

export function fetchCars(status) {
    const container = document.getElementById(status === 'Active' ? 'car-list-container' : 'completed-list-container');
    if (!container) return;
    container.innerHTML = `<p class="text-center text-blue-500">Loading ${status} jobs...</p>`;
    const q = query(carsCollection, where('status', '==', status), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        const cars = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        if (status === 'Completed') window.completedJobsCache = cars;
        if (!cars.length) {
            container.innerHTML = `<p class="text-center text-gray-500">No ${status} jobs.</p>`;
            return;
        }
        cars.forEach(car => container.appendChild(createCarCard(car, status)));
    }, err => { container.innerHTML = `<p class="text-red-500">Error: ${err.message}</p>`; });
    if (status === 'Active') { if (unsubscribeActive) unsubscribeActive(); unsubscribeActive = unsubscribe; }
    else { if (unsubscribeCompleted) unsubscribeCompleted(); unsubscribeCompleted = unsubscribe; }
}

function createCarCard(car, status) {
    const card = document.createElement('div');
    const border = car.jobType === 'GeneralService' ? 'border-green-500' : 'border-blue-500';
    card.className = `bg-white p-6 rounded-xl shadow-lg border-t-4 ${border}`;
    const actions = status === 'Active' ?
        `<button onclick="window.markCarAsCompleted('${car.id}')" class="bg-green-500 text-white py-2 px-4 rounded text-sm">Mark Complete</button>` :
        `<button onclick="window.deleteCompletedCar('${car.id}')" class="bg-red-500 text-white py-2 px-4 rounded text-sm">Delete</button>`;
    card.innerHTML = `
        <div class="flex justify-between"><h3 class="text-2xl font-bold">${escapeHtml(car.plate)}</h3>${car.jobType === 'GeneralService' ? '<span class="text-xs bg-green-100 px-2 py-0.5 rounded">G. Service</span>' : ''}</div>
        <p class="font-semibold">${escapeHtml(car.make)} ${escapeHtml(car.model)} (${escapeHtml(car.year)})</p>
        <p class="text-sm">Client: ${escapeHtml(car.clientName)} (${escapeHtml(car.clientPhone)})</p>
        <p class="text-sm">Mechanic: ${escapeHtml(car.assignedMechanic)}</p>
        <p class="text-sm mb-2">Due: ${escapeHtml(car.deliveryDate)}</p>
        <div class="flex space-x-2">${actions}<button onclick="window.openDetailedReport('${car.id}')" class="bg-blue-500 text-white py-2 px-4 rounded text-sm">View Report</button></div>
    `;
    return card;
}

export async function markCarAsCompleted(carId) {
    if (!confirm("Mark as completed?")) return;
    try {
        await updateDoc(doc(db, 'cars', carId), { status: 'Completed', completedAt: serverTimestamp(), completedBy: auth.currentUser?.email });
        alert("Job moved to completed.");
        window.showSection('car-list');
    } catch (err) { alert("Error: " + err.message); }
}

export async function deleteCompletedCar(carId) {
    if (!confirm("Permanently delete this job?")) return;
    try {
        await deleteDoc(doc(db, 'cars', carId));
        alert("Deleted.");
    } catch (err) { alert("Error: " + err.message); }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}
