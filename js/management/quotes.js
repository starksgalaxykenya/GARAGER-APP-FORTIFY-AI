import { db } from './management-core.js';
import { collection, addDoc, onSnapshot, doc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const quotesRef = collection(db, 'quotes');

export function initQuotes() {
    const container = document.getElementById('content-quotes');
    container.innerHTML = `
        <h2 class="text-3xl font-bold border-b pb-2 mb-6">Repair Quotes Generation</h2>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg">
                <h3 class="text-xl font-semibold mb-2">Create New Quote</h3>
                <form id="quote-creation-form" class="space-y-3">
                    <input id="quote-client-name" placeholder="Client Name" required class="w-full p-2 border rounded">
                    <input id="quote-client-phone" placeholder="Client Phone (+CCCXXXX)" required class="w-full p-2 border rounded">
                    <input id="quote-car-plate" placeholder="Vehicle Plate" required class="w-full p-2 border rounded">
                    <input id="quote-car-make" placeholder="Make/Model" class="w-full p-2 border rounded">
                    <h4 class="font-medium">Estimated Items</h4>
                    <div id="quote-items-container" class="space-y-2"></div>
                    <button type="button" onclick="window.addQuoteItemRow()" class="w-full bg-indigo-100 text-indigo-700 py-2 rounded">+ Add Item</button>
                    <div class="pt-4 flex justify-between"><span class="text-xl font-bold">TOTAL ESTIMATE:</span><span id="quote-total-display" class="text-2xl font-extrabold text-indigo-600">$0.00</span></div>
                    <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded">Generate & Share Quote</button>
                </form>
            </div>
            <div class="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
                <h3 class="text-xl font-semibold mb-2">Past Quotes</h3>
                <div class="overflow-x-auto"><table class="min-w-full"><thead class="bg-gray-50"><tr><th class="px-3 py-2">Quote No.</th><th>Date</th><th>Client / Plate</th><th>Amount</th><th>Actions</th></tr></thead><tbody id="quotes-table-body"></tbody></table></div>
            </div>
        </div>
    `;
    attachListeners();
    listenForQuotes();
    if (typeof window.addQuoteItemRow === 'function') window.addQuoteItemRow();
    else window.addQuoteItemRow = () => addQuoteItemRow();
    addQuoteItemRow();
}

function addQuoteItemRow() {
    const container = document.getElementById('quote-items-container');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'flex space-x-2 mb-2 quote-item-row';
    row.innerHTML = `
        <input type="text" placeholder="Description" class="quote-item-desc w-5/12 p-2 border rounded">
        <input type="number" placeholder="Qty" value="1" min="1" class="quote-item-qty w-2/12 p-2 border rounded text-center" oninput="window.calcQuoteTotal()">
        <input type="number" placeholder="Unit Cost ($)" value="0.00" step="0.01" class="quote-item-unit-price w-3/12 p-2 border rounded" oninput="window.calcQuoteTotal()">
        <input type="text" placeholder="Total" class="quote-item-amount w-2/12 p-2 border rounded bg-gray-100" readonly>
        <button type="button" onclick="this.parentNode.remove(); window.calcQuoteTotal()" class="text-red-500">X</button>
    `;
    container.appendChild(row);
    window.calcQuoteTotal();
}

window.calcQuoteTotal = () => {
    let total = 0;
    document.querySelectorAll('#quote-items-container .quote-item-row').forEach(row => {
        const qty = parseFloat(row.querySelector('.quote-item-qty')?.value) || 0;
        const price = parseFloat(row.querySelector('.quote-item-unit-price')?.value) || 0;
        const lineTotal = qty * price;
        const lineInput = row.querySelector('.quote-item-amount');
        if (lineInput) lineInput.value = lineTotal.toFixed(2);
        total += lineTotal;
    });
    document.getElementById('quote-total-display').textContent = `$${total.toFixed(2)}`;
    return total;
};

function attachListeners() {
    document.getElementById('quote-creation-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const total = window.calcQuoteTotal();
        const items = [];
        document.querySelectorAll('#quote-items-container .quote-item-row').forEach(row => {
            const desc = row.querySelector('.quote-item-desc')?.value;
            const qty = parseFloat(row.querySelector('.quote-item-qty')?.value) || 0;
            const price = parseFloat(row.querySelector('.quote-item-unit-price')?.value) || 0;
            const amt = qty * price;
            if (amt > 0) items.push({ description: desc, quantity: qty, unitPrice: price, amount: amt });
        });
        if (items.length === 0) return alert('Add at least one item.');
        const quote = {
            quoteNo: `QUO-${Date.now().toString().slice(-6)}`,
            clientName: document.getElementById('quote-client-name').value,
            clientPhone: document.getElementById('quote-client-phone').value,
            carPlate: document.getElementById('quote-car-plate').value,
            carMake: document.getElementById('quote-car-make').value,
            items, total,
            date: new Date().toISOString().split('T')[0],
            timestamp: serverTimestamp()
        };
        await addDoc(quotesRef, quote);
        alert('Quote saved.');
        document.getElementById('quote-creation-form').reset();
        document.getElementById('quote-items-container').innerHTML = '';
        addQuoteItemRow();
    });
}

function listenForQuotes() {
    onSnapshot(quotesRef.orderBy('timestamp', 'desc'), (snapshot) => {
        const tbody = document.getElementById('quotes-table-body');
        tbody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const q = docSnap.data();
            tbody.innerHTML += `
                <tr><td class="px-3 py-2">${q.quoteNo}</td><td>${q.date}</td><td>${q.clientName} / ${q.carPlate}</td><td class="text-indigo-600 font-bold">$${q.total.toFixed(2)} (Est.)</td>
                <td><button onclick="window.generateQuotePDF('${docSnap.id}', '${q.clientPhone}')" class="text-blue-500 mr-2">PDF/Share</button><button onclick="deleteQuote('${docSnap.id}')" class="text-red-500">Delete</button></td></tr>
            `;
        });
    });
}

window.generateQuotePDF = async (quoteId, clientPhone) => {
    const snap = await getDoc(doc(db, 'quotes', quoteId));
    if (!snap.exists()) return;
    const q = snap.data();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(22).text("REPAIR QUOTE", 14, 25);
    doc.setFontSize(10).text(`Quote No: ${q.quoteNo}`, 14, 35);
    doc.text(`Date: ${q.date}`, 14, 40);
    doc.text(`Client: ${q.clientName}`, 14, 50);
    doc.text(`Phone: ${q.clientPhone}`, 14, 55);
    doc.text(`Vehicle: ${q.carMake}`, 14, 60);
    doc.text(`Plate: ${q.carPlate}`, 14, 65);
    const body = q.items.map(item => [item.description, item.quantity, `$${item.unitPrice.toFixed(2)}`, `$${item.amount.toFixed(2)}`]);
    doc.autoTable({ startY: 75, head: [['Item/Service','Qty','Est. Unit Cost','Est. Line Total']], body, foot: [['','','Estimated Total',`$${q.total.toFixed(2)}`]], theme: 'grid' });
    doc.text("NOTE: This is an estimate. Final costs may vary.", 14, doc.autoTable.previous.finalY + 8);
    if (confirm('Share via WhatsApp?')) {
        const cleanPhone = clientPhone.replace(/[^\d+]/g, '');
        const msg = `*Garage Manager PRO Repair Quote* (No. ${q.quoteNo})\n\nDear ${q.clientName},\n\nEstimated total: *$${q.total.toFixed(2)}*.\n\nPlease confirm.`;
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
    doc.save(`Quote_${q.quoteNo}.pdf`);
};

window.deleteQuote = async (id) => {
    if (confirm('Delete quote?')) await deleteDoc(doc(quotesRef, id));
};

export function cleanupQuotes() {}
