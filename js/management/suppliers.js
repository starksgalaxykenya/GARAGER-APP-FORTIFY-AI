import { db } from './management-core.js';
import { collection, addDoc, onSnapshot, doc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const suppliersRef = collection(db, 'suppliers');
let allSuppliers = [];

export function initSuppliers() {
    const container = document.getElementById('content-suppliers');
    container.innerHTML = `
        <h2 class="text-3xl font-bold border-b pb-2 mb-6">Supplier Management & Ordering</h2>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-1 space-y-6">
                <div class="bg-white p-6 rounded-xl shadow-lg"><h3 class="text-xl font-semibold mb-2">Add New Supplier</h3>
                    <form id="add-supplier-form" class="space-y-3">
                        <input id="supplier-name" placeholder="Supplier Name" required class="w-full p-2 border rounded">
                        <select id="supplier-type" required class="w-full p-2 border rounded"><option>Parts</option><option>Tools</option><option>Services</option><option>Other</option></select>
                        <input id="supplier-contact" placeholder="Contact Phone (WhatsApp)" required class="w-full p-2 border rounded">
                        <input id="supplier-location" placeholder="Location/Address" class="w-full p-2 border rounded">
                        <input id="supplier-owed" type="number" placeholder="Amount Owed ($)" step="0.01" value="0" class="w-full p-2 border rounded">
                        <button type="submit" class="w-full bg-indigo-600 text-white py-2 rounded">Add Supplier</button>
                    </form>
                </div>
            </div>
            <div class="lg:col-span-2 space-y-6">
                <div class="bg-white p-6 rounded-xl shadow-lg"><h3 class="text-xl font-semibold mb-2">Current Suppliers</h3>
                    <div class="overflow-x-auto"><table class="min-w-full"><thead class="bg-gray-50"><tr><th class="px-6 py-3">Name</th><th>Type</th><th>Contact</th><th>Owed</th><th>Actions</th></tr></thead><tbody id="suppliers-table-body"></tbody></table></div>
                </div>
            </div>
            <div class="lg:col-span-3 bg-white p-6 rounded-xl shadow-lg"><h3 class="text-xl font-semibold mb-2">WhatsApp Ordering Tool</h3>
                <div class="flex flex-wrap gap-3">
                    <div class="w-full md:w-3/12"><label>Select Supplier</label><select id="whatsapp-supplier-select" class="w-full p-2 border rounded"><option value="">Select Supplier</option></select></div>
                    <div class="w-full md:w-6/12"><label>List of Supplies (one per line)</label><textarea id="supplies-list" rows="3" placeholder="1x Brake Pads (Front)&#10;1L Engine Oil" class="w-full p-2 border rounded"></textarea></div>
                    <div class="w-full md:w-2/12"><button id="order-whatsapp-btn" class="w-full bg-green-500 text-white py-3 rounded disabled:opacity-50" disabled><i class="fab fa-whatsapp mr-2"></i>Send Order</button></div>
                </div>
            </div>
        </div>
    `;
    attachListeners();
    listenForSuppliers();
}

function attachListeners() {
    document.getElementById('add-supplier-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sup = {
            name: document.getElementById('supplier-name').value,
            type: document.getElementById('supplier-type').value,
            contact: document.getElementById('supplier-contact').value,
            location: document.getElementById('supplier-location').value,
            owed: parseFloat(document.getElementById('supplier-owed').value) || 0,
            createdAt: serverTimestamp()
        };
        await addDoc(suppliersRef, sup);
        document.getElementById('add-supplier-form').reset();
        alert('Supplier added.');
    });
    const whatsappSelect = document.getElementById('whatsapp-supplier-select');
    const orderBtn = document.getElementById('order-whatsapp-btn');
    const suppliesText = document.getElementById('supplies-list');
    whatsappSelect?.addEventListener('change', () => { orderBtn.disabled = !whatsappSelect.value; });
    orderBtn?.addEventListener('click', () => {
        const supId = whatsappSelect.value;
        const supplies = suppliesText.value;
        if (!supId || !supplies) { alert('Select supplier and enter supplies.'); return; }
        const supplier = allSuppliers.find(s => s.id === supId);
        if (!supplier?.contact) { alert('Supplier contact missing.'); return; }
        let phone = supplier.contact.replace(/[^\d+]/g, '');
        if (!phone.startsWith('+')) phone = phone.replace(/\D/g, '');
        if (phone.length < 9) { alert('Invalid phone number.'); return; }
        const msg = `*Supply Request for ${supplier.name}*\n\n--- REQUIRED ITEMS ---\n\n${supplies}\n\n--- END OF LIST ---\n*Garage Manager PRO*`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    });
}

function listenForSuppliers() {
    onSnapshot(suppliersRef.orderBy('name'), (snapshot) => {
        allSuppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tbody = document.getElementById('suppliers-table-body');
        const select = document.getElementById('whatsapp-supplier-select');
        tbody.innerHTML = '';
        select.innerHTML = '<option value="">Select Supplier</option>';
        allSuppliers.forEach(sup => {
            tbody.innerHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">${escapeHtml(sup.name)}</td>
                    <td class="px-6 py-4">${escapeHtml(sup.type)}</td>
                    <td class="px-6 py-4">${escapeHtml(sup.contact)}</td>
                    <td class="px-6 py-4 ${sup.owed > 0 ? 'text-red-600 font-bold' : 'text-green-600'}">$${sup.owed.toFixed(2)}</td>
                    <td class="px-6 py-4"><button onclick="editSupplier('${sup.id}')" class="text-indigo-600 mr-2">Edit</button><button onclick="deleteSupplier('${sup.id}')" class="text-red-600">Delete</button></td>
                </tr>
            `;
            const opt = document.createElement('option');
            opt.value = sup.id;
            opt.textContent = sup.name;
            select.appendChild(opt);
        });
    });
}

window.editSupplier = (id) => alert(`Editing ${id} – implement your edit logic.`);
window.deleteSupplier = async (id) => {
    if (confirm('Delete this supplier?')) await deleteDoc(doc(suppliersRef, id));
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

export function cleanupSuppliers() {}
