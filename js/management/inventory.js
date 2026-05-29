import { db } from './management-core.js';
import { collection, addDoc, onSnapshot, doc, deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const partsInventoryRef = collection(db, 'partsInventory');
const dailyTransactionsRef = collection(db, 'dailyTransactions');

let allParts = [];

export function initInventory() {
    const container = document.getElementById('content-inventory');
    container.innerHTML = `
        <h2 class="text-3xl font-bold border-b pb-2 mb-6">Parts Inventory Management</h2>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg">
                <h3 class="text-xl font-semibold mb-2">Add New Part</h3>
                <form id="add-part-form" class="space-y-3">
                    <input id="part-name" placeholder="Part Name" required class="w-full p-2 border rounded">
                    <input id="part-sku" placeholder="SKU (Optional)" class="w-full p-2 border rounded">
                    <input id="part-quantity" type="number" placeholder="Initial Quantity" min="1" required class="w-full p-2 border rounded">
                    <input id="part-supplier-price" type="number" placeholder="Supplier Price ($)" step="0.01" min="0" required class="w-full p-2 border rounded">
                    <input id="part-selling-price" type="number" placeholder="Selling Price ($)" step="0.01" min="0" required class="w-full p-2 border rounded">
                    <button type="submit" class="w-full bg-indigo-600 text-white py-2 rounded">Add Part</button>
                </form>
            </div>
            <div class="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
                <h3 class="text-xl font-semibold mb-2">Current Stock</h3>
                <div class="overflow-x-auto"><table class="min-w-full"><thead class="bg-gray-50"><tr><th class="px-6 py-3">Part Name (SKU)</th><th>Qty</th><th>Cost</th><th>Sell Price</th><th>Actions</th></tr></thead><tbody id="parts-inventory-body"></tbody></table></div>
            </div>
            <div class="lg:col-span-3 bg-white p-6 rounded-xl shadow-lg">
                <h3 class="text-xl font-semibold mb-2">Record Part Sale</h3>
                <form id="sell-part-form" class="flex flex-wrap items-end gap-3">
                    <div class="w-full md:w-5/12"><label>Select Part</label><select id="part-sale-select" required class="w-full p-2 border rounded"><option value="">Select Part</option></select></div>
                    <div class="w-full md:w-2/12"><label>Quantity</label><input id="part-sale-quantity" type="number" value="1" min="1" class="w-full p-2 border rounded text-center"></div>
                    <div class="w-full md:w-3/12"><label>Car Plate (Optional)</label><input id="part-sale-plate" class="w-full p-2 border rounded"></div>
                    <div class="w-full md:w-2/12"><span class="text-sm">Profit:</span><p id="part-sale-profit-display" class="font-bold text-xl text-gray-500">$0.00</p></div>
                    <button type="submit" class="w-full md:w-auto bg-green-600 text-white py-2 px-4 rounded disabled:opacity-50" disabled>Commit Sale</button>
                </form>
            </div>
        </div>
    `;
    attachListeners();
    listenForInventory();
}

function attachListeners() {
    document.getElementById('add-part-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const part = {
            name: document.getElementById('part-name').value,
            sku: document.getElementById('part-sku').value,
            quantity: parseInt(document.getElementById('part-quantity').value),
            supplierPrice: parseFloat(document.getElementById('part-supplier-price').value),
            sellingPrice: parseFloat(document.getElementById('part-selling-price').value),
            createdAt: serverTimestamp()
        };
        if (part.sellingPrice < part.supplierPrice && !confirm('Selling price lower than cost. Continue?')) return;
        await addDoc(partsInventoryRef, part);
        document.getElementById('add-part-form').reset();
        alert('Part added.');
    });
    const sellForm = document.getElementById('sell-part-form');
    const select = document.getElementById('part-sale-select');
    const qty = document.getElementById('part-sale-quantity');
    const profitSpan = document.getElementById('part-sale-profit-display');
    const commitBtn = sellForm?.querySelector('button[type="submit"]');
    const calcProfit = () => {
        const option = select.options[select.selectedIndex];
        const qtyVal = parseInt(qty.value) || 0;
        if (!option?.value || qtyVal <= 0) { profitSpan.textContent = '$0.00'; profitSpan.className = 'font-bold text-xl text-gray-500'; commitBtn.disabled = true; return; }
        const stock = parseInt(option.dataset.stock);
        if (qtyVal > stock) { profitSpan.textContent = 'Error: exceeds stock!'; profitSpan.className = 'font-bold text-lg text-red-600'; commitBtn.disabled = true; return; }
        const profitPer = parseFloat(option.dataset.sellingPrice) - parseFloat(option.dataset.supplierPrice);
        const total = profitPer * qtyVal;
        profitSpan.textContent = `$${total.toFixed(2)}`;
        profitSpan.className = total >= 0 ? 'font-bold text-xl text-green-600' : 'font-bold text-xl text-red-600';
        commitBtn.disabled = false;
    };
    select?.addEventListener('change', calcProfit);
    qty?.addEventListener('input', calcProfit);
    sellForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const partId = select.value;
        const option = select.options[select.selectedIndex];
        const qtyVal = parseInt(qty.value);
        const carPlate = document.getElementById('part-sale-plate').value || 'N/A';
        if (!partId || qtyVal <= 0) return alert('Select part and quantity');
        const stock = parseInt(option.dataset.stock);
        if (qtyVal > stock) return alert(`Only ${stock} in stock.`);
        const supplier = parseFloat(option.dataset.supplierPrice);
        const selling = parseFloat(option.dataset.sellingPrice);
        const partName = option.textContent.split(' (Stock')[0];
        const totalInc = selling * qtyVal;
        const totalExp = supplier * qtyVal;
        const profit = totalInc - totalExp;
        if (!confirm(`Sell ${qtyVal} x ${partName} for $${totalInc.toFixed(2)} (Profit $${profit.toFixed(2)})?`)) return;
        const batch = writeBatch(db);
        const partRef = doc(partsInventoryRef, partId);
        batch.update(partRef, { quantity: stock - qtyVal });
        batch.set(doc(dailyTransactionsRef), {
            type: 'PART SALE', subtype: partName, plate: carPlate,
            description: `${qtyVal} x ${partName} sold`, income: totalInc, expense: totalExp, profit: profit,
            timestamp: serverTimestamp(), isJob: true, date: new Date().toISOString().split('T')[0]
        });
        await batch.commit();
        alert(`Sale recorded. Stock updated.`);
        sellForm.reset();
        profitSpan.textContent = '$0.00';
        commitBtn.disabled = true;
    });
}

function listenForInventory() {
    onSnapshot(partsInventoryRef.orderBy('name', 'asc'), (snapshot) => {
        allParts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tbody = document.getElementById('parts-inventory-body');
        const select = document.getElementById('part-sale-select');
        tbody.innerHTML = '';
        select.innerHTML = '<option value="">Select Part to Sell</option>';
        allParts.forEach(part => {
            const profitPer = part.sellingPrice - part.supplierPrice;
            const qtyClass = part.quantity < 5 ? 'text-red-600 font-bold' : '';
            tbody.innerHTML += `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">${escapeHtml(part.name)} (${part.sku || 'N/A'})</td>
                    <td class="px-6 py-4 ${qtyClass}">${part.quantity}</td>
                    <td class="px-6 py-4 text-red-600">$${part.supplierPrice.toFixed(2)}</td>
                    <td class="px-6 py-4 text-green-600">$${part.sellingPrice.toFixed(2)}</td>
                    <td class="px-6 py-4"><button onclick="deletePart('${part.id}')" class="text-red-600">Delete</button></td>
                </tr>
            `;
            if (part.quantity > 0) {
                const opt = document.createElement('option');
                opt.value = part.id;
                opt.textContent = `${part.name} (Stock: ${part.quantity}, Profit/Unit: $${profitPer.toFixed(2)})`;
                opt.dataset.supplierPrice = part.supplierPrice;
                opt.dataset.sellingPrice = part.sellingPrice;
                opt.dataset.stock = part.quantity;
                select.appendChild(opt);
            }
        });
    });
}

window.deletePart = async (id) => {
    if (confirm('Delete this part?')) await deleteDoc(doc(partsInventoryRef, id));
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

export function cleanupInventory() {}
