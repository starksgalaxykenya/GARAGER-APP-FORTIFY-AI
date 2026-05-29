import { db } from './management-core.js';
import { collection, addDoc, onSnapshot, doc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const invoicesRef = collection(db, 'invoices');
const dailyTransactionsRef = collection(db, 'dailyTransactions');

export function initInvoices() {
    const container = document.getElementById('content-invoices');
    container.innerHTML = `
        <h2 class="text-3xl font-bold border-b pb-2 mb-6">Invoices & Receipts Generation</h2>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg">
                <h3 class="text-xl font-semibold mb-2">Generate New Invoice</h3>
                <form id="invoice-creation-form" class="space-y-3">
                    <input id="invoice-client-name" placeholder="Client Name" required class="w-full p-2 border rounded">
                    <input id="invoice-client-phone" placeholder="Client Phone (+CCCXXXX)" required class="w-full p-2 border rounded">
                    <input id="invoice-car-plate" placeholder="Vehicle Plate" required class="w-full p-2 border rounded">
                    <h4 class="font-medium">Items (Labor/Parts)</h4>
                    <div id="invoice-items-container" class="space-y-2"></div>
                    <button type="button" onclick="window.addInvoiceItemRow()" class="w-full bg-indigo-100 text-indigo-700 py-2 rounded">+ Add Item</button>
                    <div class="pt-4 flex justify-between"><span class="text-xl font-bold">TOTAL:</span><span id="invoice-total-display" class="text-2xl font-extrabold text-indigo-600">$0.00</span></div>
                    <button type="submit" class="w-full bg-green-600 text-white py-3 rounded">Generate & Commit Invoice</button>
                </form>
            </div>
            <div class="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
                <h3 class="text-xl font-semibold mb-2">Past Invoices</h3>
                <div class="overflow-x-auto"><table class="min-w-full"><thead class="bg-gray-50"><tr><th class="px-3 py-2">Invoice No.</th><th>Date</th><th>Client / Plate</th><th>Amount</th><th>Actions</th></tr></thead><tbody id="invoices-table-body"></tbody></table></div>
            </div>
        </div>
    `;
    attachListeners();
    listenForInvoices();
    // Add one empty row
    if (typeof window.addInvoiceItemRow === 'function') window.addInvoiceItemRow();
    else window.addInvoiceItemRow = () => addInvoiceItemRow();
    addInvoiceItemRow();
}

function addInvoiceItemRow() {
    const container = document.getElementById('invoice-items-container');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'flex space-x-2 mb-2 invoice-item-row';
    row.innerHTML = `
        <input type="text" placeholder="Description" class="invoice-item-desc w-5/12 p-2 border rounded">
        <input type="number" placeholder="Qty" value="1" min="1" class="invoice-item-qty w-2/12 p-2 border rounded text-center" oninput="window.calcInvoiceTotal()">
        <input type="number" placeholder="Unit Price ($)" value="0.00" step="0.01" class="invoice-item-unit-price w-3/12 p-2 border rounded" oninput="window.calcInvoiceTotal()">
        <input type="text" placeholder="Total" class="invoice-item-amount w-2/12 p-2 border rounded bg-gray-100" readonly>
        <button type="button" onclick="this.parentNode.remove(); window.calcInvoiceTotal()" class="text-red-500">X</button>
    `;
    container.appendChild(row);
    window.calcInvoiceTotal();
}

window.calcInvoiceTotal = () => {
    let total = 0;
    document.querySelectorAll('#invoice-items-container .invoice-item-row').forEach(row => {
        const qty = parseFloat(row.querySelector('.invoice-item-qty')?.value) || 0;
        const price = parseFloat(row.querySelector('.invoice-item-unit-price')?.value) || 0;
        const lineTotal = qty * price;
        const lineInput = row.querySelector('.invoice-item-amount');
        if (lineInput) lineInput.value = lineTotal.toFixed(2);
        total += lineTotal;
    });
    document.getElementById('invoice-total-display').textContent = `$${total.toFixed(2)}`;
    return total;
};

function attachListeners() {
    document.getElementById('invoice-creation-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const total = window.calcInvoiceTotal();
        const items = [];
        document.querySelectorAll('#invoice-items-container .invoice-item-row').forEach(row => {
            const desc = row.querySelector('.invoice-item-desc')?.value;
            const qty = parseFloat(row.querySelector('.invoice-item-qty')?.value) || 0;
            const price = parseFloat(row.querySelector('.invoice-item-unit-price')?.value) || 0;
            const amt = qty * price;
            if (amt > 0) items.push({ description: desc, quantity: qty, unitPrice: price, amount: amt });
        });
        if (items.length === 0) return alert('Add at least one item.');
        const invoice = {
            invoiceNo: `INV-${Date.now().toString().slice(-6)}`,
            clientName: document.getElementById('invoice-client-name').value,
            clientPhone: document.getElementById('invoice-client-phone').value,
            carPlate: document.getElementById('invoice-car-plate').value,
            items, total,
            date: new Date().toISOString().split('T')[0],
            timestamp: serverTimestamp()
        };
        await addDoc(invoicesRef, invoice);
        // Automatically record finance transaction
        await addDoc(dailyTransactionsRef, {
            type: 'JOB', subtype: 'Invoice/Receipt', plate: invoice.carPlate,
            description: `Invoice #${invoice.invoiceNo} paid by ${invoice.clientName}`,
            income: total, expense: 0, profit: total,
            timestamp: serverTimestamp(), isJob: true, date: invoice.date
        });
        alert('Invoice saved and finance recorded.');
        document.getElementById('invoice-creation-form').reset();
        document.getElementById('invoice-items-container').innerHTML = '';
        addInvoiceItemRow();
    });
}

function listenForInvoices() {
    onSnapshot(invoicesRef.orderBy('timestamp', 'desc'), (snapshot) => {
        const tbody = document.getElementById('invoices-table-body');
        tbody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const inv = docSnap.data();
            tbody.innerHTML += `
                <tr><td class="px-3 py-2">${inv.invoiceNo}</td><td>${inv.date}</td><td>${inv.clientName} / ${inv.carPlate}</td><td class="text-green-600 font-bold">$${inv.total.toFixed(2)}</td>
                <td><button onclick="window.generateInvoicePDF('${docSnap.id}', '${inv.clientPhone}')" class="text-blue-500 mr-2">PDF/Share</button><button onclick="deleteInvoice('${docSnap.id}')" class="text-red-500">Delete</button></td></tr>
            `;
        });
    });
}

window.generateInvoicePDF = async (invoiceId, clientPhone) => {
    const snap = await getDoc(doc(db, 'invoices', invoiceId));
    if (!snap.exists()) return;
    const inv = snap.data();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(22).text("INVOICE / RECEIPT", 14, 25);
    doc.setFontSize(10).text(`Invoice No: ${inv.invoiceNo}`, 14, 35);
    doc.text(`Date: ${inv.date}`, 14, 40);
    doc.text(`Client: ${inv.clientName}`, 14, 50);
    doc.text(`Phone: ${inv.clientPhone}`, 14, 55);
    doc.text(`Vehicle: ${inv.carPlate}`, 14, 60);
    const body = inv.items.map(item => [item.description, item.quantity, `$${item.unitPrice.toFixed(2)}`, `$${item.amount.toFixed(2)}`]);
    doc.autoTable({ startY: 70, head: [['Description','Qty','Unit Price','Line Total']], body, foot: [['','','Total',`$${inv.total.toFixed(2)}`]], theme: 'grid' });
    if (confirm('Share via WhatsApp?')) {
        const cleanPhone = clientPhone.replace(/[^\d+]/g, '');
        const msg = `*Garage Manager PRO Invoice* (No. ${inv.invoiceNo})\n\nDear ${inv.clientName},\n\nTotal amount: *$${inv.total.toFixed(2)}*.\n\nThank you.`;
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
    doc.save(`Invoice_${inv.invoiceNo}.pdf`);
};

window.deleteInvoice = async (id) => {
    if (confirm('Delete invoice?')) await deleteDoc(doc(invoicesRef, id));
};

export function cleanupInvoices() {}
