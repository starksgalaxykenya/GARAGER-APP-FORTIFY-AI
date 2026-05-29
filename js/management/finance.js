import { db, auth } from './management-core.js';
import { collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const dailyTransactionsRef = collection(db, 'dailyTransactions');
const pastReportsRef = collection(db, 'financialReports');
let currentDailyTransactions = [];
let plChartInstance = null;

function getUTCDateString() { return new Date().toISOString().split('T')[0]; }

export function initFinance() {
    const container = document.getElementById('content-finance');
    container.innerHTML = `
        <h2 class="text-3xl font-bold border-b pb-2 mb-6">Daily Financial Management</h2>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-1 space-y-6">
                <div class="bg-white p-6 rounded-xl shadow-lg"><h3 class="text-xl font-semibold mb-2">Record Job Income/Expense</h3>
                    <form id="finance-job-form" class="space-y-3">
                        <select id="job-type" required class="w-full p-2 border rounded"><option>Service</option><option>Repair</option><option>Diagnostics</option></select>
                        <input id="job-plate" placeholder="Car Plate" class="w-full p-2 border rounded">
                        <input id="job-income" type="number" placeholder="Income $" step="0.01" required class="w-full p-2 border rounded">
                        <input id="job-expense" type="number" placeholder="Expense $" step="0.01" value="0" class="w-full p-2 border rounded">
                        <div id="job-profit-display" class="text-center font-bold text-gray-500">Profit: $0.00</div>
                        <button type="submit" class="w-full bg-indigo-600 text-white py-2 rounded">Record Job</button>
                    </form>
                </div>
                <div class="bg-white p-6 rounded-xl shadow-lg"><h3 class="text-xl font-semibold mb-2">Record General Transaction</h3>
                    <form id="finance-general-form" class="space-y-3">
                        <select id="general-type" required class="w-full p-2 border rounded"><option>Stock Purchase (Expense)</option><option>Utility Bill (Expense)</option><option>Rent (Expense)</option><option>Other Income</option></select>
                        <input id="general-amount" type="number" placeholder="Amount $" step="0.01" required class="w-full p-2 border rounded">
                        <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded">Record Transaction</button>
                    </form>
                </div>
            </div>
            <div class="lg:col-span-2 space-y-6">
                <div class="bg-white p-6 rounded-xl shadow-lg"><h3 class="text-xl font-semibold mb-2">Today's Transactions</h3><div class="overflow-x-auto"><table class="min-w-full"><thead class="bg-gray-50"><tr><th class="px-3 py-2">Time</th><th>Type</th><th>Plate</th><th>Income</th><th>Expense</th><th>Profit</th><th>Action</th></tr></thead><tbody id="daily-transactions-body"></tbody></table></div></div>
                <div class="bg-white p-6 rounded-xl shadow-lg"><h3 class="text-xl font-semibold mb-2">Daily Summary</h3><div class="flex justify-around text-center"><div>Income<br><span id="summary-income" class="text-2xl font-bold text-green-600">$0.00</span></div><div>Expense<br><span id="summary-expense" class="text-2xl font-bold text-red-600">$0.00</span></div><div>Net Profit<br><span id="summary-profit" class="text-2xl font-bold text-indigo-600">$0.00</span></div></div><button id="end-day-btn" class="w-full bg-red-600 text-white py-2 rounded mt-4 disabled:opacity-50" disabled>End Day & Save P&L Report</button></div>
            </div>
        </div>
        <div id="report-view-section" class="mt-6 bg-white p-6 rounded-xl shadow-lg hidden"><h3 class="text-2xl font-semibold mb-2">Financial Reports & Trends</h3><div class="grid grid-cols-1 lg:grid-cols-3"><div class="lg:col-span-2"><canvas id="pl-chart"></canvas></div><div><h4>Past Daily Reports</h4><div id="past-reports-list" class="space-y-2 max-h-96 overflow-auto"></div></div></div></div>
        <button id="view-reports-btn" class="w-full bg-purple-600 text-white py-2 rounded mt-4">View Reports & Analytics</button>
    `;
    attachEventListeners();
    listenForDailyTransactions();
}

function attachEventListeners() {
    const jobForm = document.getElementById('finance-job-form');
    const generalForm = document.getElementById('finance-general-form');
    const endDayBtn = document.getElementById('end-day-btn');
    const viewReportsBtn = document.getElementById('view-reports-btn');
    const income = document.getElementById('job-income');
    const expense = document.getElementById('job-expense');
    const profitSpan = document.getElementById('job-profit-display');
    income?.addEventListener('input', () => updateProfit());
    expense?.addEventListener('input', () => updateProfit());
    function updateProfit() {
        const inc = parseFloat(income.value) || 0;
        const exp = parseFloat(expense.value) || 0;
        const profit = inc - exp;
        profitSpan.textContent = `Profit: $${profit.toFixed(2)}`;
        profitSpan.className = profit >= 0 ? 'font-bold text-green-600' : 'font-bold text-red-600';
    }
    jobForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inc = parseFloat(income.value);
        const exp = parseFloat(expense.value);
        const profit = inc - exp;
        await addDoc(dailyTransactionsRef, {
            type: 'JOB', subtype: document.getElementById('job-type').value, plate: document.getElementById('job-plate').value || 'N/A',
            description: `${document.getElementById('job-type').value} job`, income: inc, expense: exp, profit: profit,
            timestamp: serverTimestamp(), isJob: true, date: getUTCDateString()
        });
        jobForm.reset();
        profitSpan.textContent = 'Profit: $0.00';
    });
    generalForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('general-amount').value);
        const type = document.getElementById('general-type').value;
        const isIncome = type === 'Other Income';
        await addDoc(dailyTransactionsRef, {
            type: isIncome ? 'INCOME' : 'EXPENSE', subtype: type, plate: 'N/A', description: type,
            income: isIncome ? amount : 0, expense: isIncome ? 0 : amount, profit: isIncome ? amount : -amount,
            timestamp: serverTimestamp(), isJob: false, date: getUTCDateString()
        });
        generalForm.reset();
    });
    endDayBtn?.addEventListener('click', async () => {
        if (!currentDailyTransactions.length) return;
        if (!confirm('End day? This will save report and clear transactions.')) return;
        const date = getUTCDateString();
        const totalInc = currentDailyTransactions.reduce((s,t) => s + t.income, 0);
        const totalExp = currentDailyTransactions.reduce((s,t) => s + t.expense, 0);
        const net = totalInc - totalExp;
        await addDoc(pastReportsRef, { date, totalIncome: totalInc, totalExpense: totalExp, netProfit: net, transactions: currentDailyTransactions.map(t => ({ description: t.description, income: t.income, expense: t.expense, profit: t.profit, timestamp: t.timestamp })), createdAt: serverTimestamp() });
        const batch = writeBatch(db);
        currentDailyTransactions.forEach(t => batch.delete(doc(dailyTransactionsRef, t.id)));
        await batch.commit();
        alert(`Day ended. Net profit: $${net.toFixed(2)}`);
    });
    viewReportsBtn?.addEventListener('click', async () => {
        document.getElementById('report-view-section').classList.remove('hidden');
        const pastDiv = document.getElementById('past-reports-list');
        pastDiv.innerHTML = '<p>Loading...</p>';
        const snap = await pastReportsRef.orderBy('date', 'desc').get();
        if (snap.empty) { pastDiv.innerHTML = '<p>No past reports.</p>'; return; }
        const monthTotals = {};
        pastDiv.innerHTML = '';
        snap.forEach(doc => {
            const data = doc.data();
            const month = data.date.substring(0,7);
            monthTotals[month] = (monthTotals[month] || 0) + data.netProfit;
            const div = document.createElement('div');
            div.className = 'flex justify-between p-2 bg-gray-50 rounded';
            div.innerHTML = `<span>${data.date}</span><span class="${data.netProfit>=0?'text-green-600':'text-red-600'}">$${data.netProfit.toFixed(2)}</span><button onclick="window.generateDailyReportPDF('${doc.id}')" class="text-blue-500">PDF</button>`;
            pastDiv.appendChild(div);
        });
        if (plChartInstance) plChartInstance.destroy();
        const ctx = document.getElementById('pl-chart').getContext('2d');
        plChartInstance = new Chart(ctx, { type: 'bar', data: { labels: Object.keys(monthTotals).sort(), datasets: [{ label: 'Monthly Net Profit ($)', data: Object.values(monthTotals), backgroundColor: 'rgba(52,211,153,0.7)' }] } });
    });
}

function listenForDailyTransactions() {
    const today = getUTCDateString();
    onSnapshot(query(dailyTransactionsRef, where('date', '==', today), orderBy('timestamp', 'asc')), snapshot => {
        currentDailyTransactions = [];
        let totalInc = 0, totalExp = 0;
        const tbody = document.getElementById('daily-transactions-body');
        tbody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            currentDailyTransactions.push({ id: docSnap.id, ...d });
            totalInc += d.income;
            totalExp += d.expense;
            const profitClass = d.profit >= 0 ? 'text-green-600' : 'text-red-600';
            const time = d.timestamp ? d.timestamp.toDate().toLocaleTimeString() : 'Pending';
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="px-3 py-2">${time}</td><td>${d.subtype}</td><td>${d.plate}</td><td class="text-green-600">$${d.income.toFixed(2)}</td><td class="text-red-600">$${d.expense.toFixed(2)}</td><td class="${profitClass}">$${d.profit.toFixed(2)}</td><td><button onclick="deleteTransaction('${docSnap.id}')" class="text-red-500">Delete</button></td>`;
            tbody.appendChild(tr);
        });
        document.getElementById('summary-income').textContent = `$${totalInc.toFixed(2)}`;
        document.getElementById('summary-expense').textContent = `$${totalExp.toFixed(2)}`;
        const net = totalInc - totalExp;
        const netSpan = document.getElementById('summary-profit');
        netSpan.textContent = `$${net.toFixed(2)}`;
        netSpan.className = net >= 0 ? 'font-bold text-indigo-600' : 'font-bold text-red-600';
        document.getElementById('end-day-btn').disabled = currentDailyTransactions.length === 0;
    });
}

async function deleteTransaction(id) {
    if (confirm('Delete transaction?')) await deleteDoc(doc(dailyTransactionsRef, id));
}
window.deleteTransaction = deleteTransaction;
window.generateDailyReportPDF = async (reportId) => {
    const snap = await getDoc(doc(pastReportsRef, reportId));
    if (!snap.exists()) return;
    const report = snap.data();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Daily P&L Report", 14, 22);
    doc.text(`Date: ${report.date}`, 14, 30);
    doc.autoTable({ startY: 45, head: [['Metric','Amount ($)']], body: [['Total Income', report.totalIncome.toFixed(2)], ['Total Expense', report.totalExpense.toFixed(2)], ['NET PROFIT', report.netProfit.toFixed(2)]], theme: 'grid' });
    const trans = report.transactions.map(t => [t.timestamp?.toDate().toLocaleTimeString() || 'N/A', t.description, t.income.toFixed(2), t.expense.toFixed(2), t.profit.toFixed(2)]);
    doc.autoTable({ startY: doc.autoTable.previous.finalY + 10, head: [['Time','Description','Income','Expense','Profit']], body: trans, theme: 'striped', styles: { fontSize: 8 } });
    doc.save(`Report_${report.date}.pdf`);
};

export function cleanupFinance() { /* no persistent listeners to clean */ }
