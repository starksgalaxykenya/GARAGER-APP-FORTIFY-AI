import { db, auth } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const clientsCollection = collection(db, 'clients');
const carsCollection = collection(db, 'cars');

export let clientCache = [];
export let clientCarsCache = {};
let currentClientVehicles = [];

// --------------------------------------------------------------
// Real‑time listeners
// --------------------------------------------------------------
export function listenForClients() {
    return onSnapshot(clientsCollection, (snapshot) => {
        clientCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        document.getElementById('client-count').textContent = clientCache.length;
        const datalist = document.getElementById('client-suggestions-list');
        if (datalist) {
            datalist.innerHTML = clientCache.map(c => `<option value="${c.clientPhone} (${c.clientName})">`).join('');
        }
        if (document.getElementById('clients-section')?.style.display === 'block') {
            renderClientList(clientCache);
        }
    }, console.error);
}

export function listenForCarsForCache() {
    const q = query(carsCollection, orderBy('createdAt', 'desc'), limit(200));
    return onSnapshot(q, (snapshot) => {
        clientCarsCache = {};
        snapshot.docs.forEach(doc => {
            const car = doc.data();
            const phone = car.clientPhone;
            if (phone) {
                if (!clientCarsCache[phone]) clientCarsCache[phone] = [];
                clientCarsCache[phone].push({
                    plate: car.plate, make: car.make, model: car.model, vin: car.vin || 'N/A',
                    status: car.status, jobType: car.jobType, year: car.year || 'N/A',
                    color: car.color || 'N/A', engineCC: car.engineCC || 'N/A',
                    trim: car.trim || 'N/A', engineName: car.engineName || 'N/A',
                    transmission: car.transmission || 'Automatic', driveType: car.driveType || 'FWD'
                });
            }
        });
        if (document.getElementById('clients-section')?.style.display === 'block') {
            renderClientList(clientCache);
        }
    }, console.error);
}

// --------------------------------------------------------------
// Save new client
// --------------------------------------------------------------
export async function saveNewClient(event) {
    event.preventDefault();
    if (window.isSavingClient) return;
    window.isSavingClient = true;
    try {
        if (!auth.currentUser) throw new Error("Not logged in");
        const name = document.getElementById('new-client-name').value.trim();
        const phone = document.getElementById('new-client-phone').value.trim();
        const email = document.getElementById('new-client-email').value.trim();
        const address = document.getElementById('new-client-address').value.trim();
        if (clientCache.some(c => c.clientPhone === phone)) {
            document.getElementById('client-save-message').innerHTML = 'Error: Phone already exists.';
            return;
        }
        await addDoc(clientsCollection, {
            clientName: name, clientPhone: phone, clientEmail: email,
            clientAddress: address, createdAt: serverTimestamp()
        });
        document.getElementById('create-client-form').reset();
        document.getElementById('client-save-message').innerHTML = '✅ Client saved!';
    } catch (err) {
        console.error(err);
        document.getElementById('client-save-message').innerHTML = 'Error saving client.';
    } finally {
        window.isSavingClient = false;
    }
}

// --------------------------------------------------------------
// Client list rendering & filtering
// --------------------------------------------------------------
export function renderClientList(clients) {
    const container = document.getElementById('clients-list-container');
    const search = document.getElementById('client-search')?.value.toLowerCase() || '';
    const filtered = clients.filter(c => c.clientName.toLowerCase().includes(search) || c.clientPhone.toLowerCase().includes(search));
    if (filtered.length === 0) {
        container.innerHTML = '<p class="col-span-full text-center text-gray-500">No clients found.</p>';
        return;
    }
    container.innerHTML = filtered.map(client => createClientCard(client)).join('');
}

export function filterClients() {
    renderClientList(clientCache);
}

function createClientCard(client) {
    const vehicles = clientCarsCache[client.clientPhone] || [];
    const active = vehicles.filter(v => v.status === 'Active').length;
    return `
        <div class="bg-white p-6 rounded-xl shadow-md border-l-4 border-indigo-500">
            <h4 class="text-xl font-bold">${escapeHtml(client.clientName)}</h4>
            <p class="text-sm">Phone: ${escapeHtml(client.clientPhone)}</p>
            <p class="text-sm">Email: ${escapeHtml(client.clientEmail || 'N/A')}</p>
            <p class="text-sm mb-2">Address: ${escapeHtml(client.clientAddress || 'N/A')}</p>
            <div class="mt-2 pt-2 border-t text-sm">
                <p class="font-semibold">Vehicles: ${vehicles.length}</p>
                ${active ? `<p class="text-orange-600">Active Jobs: ${active}</p>` : ''}
            </div>
            <button onclick="window.openClientVehiclesModal('${client.clientPhone}', '${escapeHtml(client.clientName)}')" class="mt-3 bg-teal-500 text-white py-1 px-3 rounded text-sm">View Vehicles</button>
        </div>
    `;
}

export function openClientVehiclesModal(phone, name) {
    const vehicles = clientCarsCache[phone] || [];
    if (!vehicles.length) {
        alert(`No vehicle history for ${name}.`);
        return;
    }
    const list = vehicles.map((v, i) => `${i+1}. ${v.plate} (${v.make} ${v.model}) - ${v.status}`).join('\n');
    alert(`Vehicles for ${name}:\n${list}`);
}

// --------------------------------------------------------------
// Lookup & autofill for Car Entry / General Service
// --------------------------------------------------------------
export function lookupClientDetails(section) {
    const searchInput = document.getElementById(`client-search-${section}`);
    const searchVal = searchInput?.value.trim() || '';
    const client = clientCache.find(c =>
        c.clientPhone === searchVal ||
        c.clientName.toLowerCase() === searchVal.toLowerCase() ||
        `${c.clientPhone} (${c.clientName})` === searchVal
    );
    const nameId = section === 'entry' ? 'client-name' : 'service-client-name';
    const phoneId = section === 'entry' ? 'client-phone' : 'service-client-phone';
    const emailId = section === 'entry' ? 'client-email' : null;
    const carSelect = document.getElementById(`car-select-${section}`);
    
    currentClientVehicles = [];
    carSelect.innerHTML = '<option value="">-- New Vehicle Entry --</option>';
    
    if (client) {
        document.getElementById(nameId).value = client.clientName;
        document.getElementById(phoneId).value = client.clientPhone;
        if (emailId) document.getElementById(emailId).value = client.clientEmail || '';
        const vehicles = clientCarsCache[client.clientPhone] || [];
        currentClientVehicles = vehicles;
        vehicles.forEach((car, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = `${car.plate} (${car.make} ${car.model}) - ${car.status}`;
            carSelect.appendChild(opt);
        });
        alert(`Client ${client.clientName} loaded.`);
    } else {
        document.getElementById(nameId).value = '';
        document.getElementById(phoneId).value = searchVal.match(/\+?[0-9\s\-\(\)]+/)?.[0] || '';
        if (emailId) document.getElementById(emailId).value = '';
        alert("Client not found. Fill details manually.");
    }
}

export function autofillVehicleDetails(section) {
    const carSelect = document.getElementById(`car-select-${section}`);
    const idx = carSelect.value;
    if (idx === "") {
        resetVehicleFields(section);
        return;
    }
    const car = currentClientVehicles[parseInt(idx)];
    if (!car) return;
    if (section === 'entry') {
        document.getElementById('number-plate').value = car.plate || '';
        document.getElementById('vin').value = car.vin || '';
        document.getElementById('make').value = car.make || '';
        document.getElementById('model').value = car.model || '';
        document.getElementById('year').value = car.year || '';
        document.getElementById('color').value = car.color || '';
        document.getElementById('engine-cc').value = car.engineCC || '';
        document.getElementById('trim').value = car.trim || '';
        document.getElementById('engine-name').value = car.engineName || '';
        document.getElementById('transmission').value = car.transmission || 'Automatic';
        document.getElementById('drive').value = car.driveType || 'FWD';
    } else if (section === 'service') {
        document.getElementById('service-plate').value = car.plate || '';
        document.getElementById('service-vin').value = car.vin || '';
        document.getElementById('service-make').value = car.make || '';
        document.getElementById('service-model').value = car.model || '';
    }
    alert(`Vehicle ${car.plate} autofilled.`);
}

function resetVehicleFields(section) {
    if (section === 'entry') {
        document.getElementById('number-plate').value = '';
        document.getElementById('vin').value = '';
        document.getElementById('make').value = '';
        document.getElementById('model').value = '';
        document.getElementById('year').value = '';
        document.getElementById('color').value = '';
        document.getElementById('engine-cc').value = '';
        document.getElementById('trim').value = '';
        document.getElementById('engine-name').value = '';
        document.getElementById('transmission').value = 'Automatic';
        document.getElementById('drive').value = 'FWD';
    } else if (section === 'service') {
        document.getElementById('service-plate').value = '';
        document.getElementById('service-vin').value = '';
        document.getElementById('service-make').value = '';
        document.getElementById('service-model').value = '';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}
