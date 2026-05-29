import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAllErrorCodesWithMeaning, getAllRepairPlanItems } from './utils-ui.js';
import { escapeHtml, cleanPhoneNumber } from './utils.js';

export let currentJobCardData = null;

export function createJobCard() {
    const errorData = getAllErrorCodesWithMeaning();
    const rawErrorCodes = errorData.map(e => e.code).join(', ');
    const fullErrorMeanings = errorData.map(e => e.meaning).map((m, i) => `${errorData[i].code}: ${m}`).join('\n');
    const repairPlan = getAllRepairPlanItems();
    const actionItems = repairPlan.map(item => item.action).join('\n---\n');
    const partsList = repairPlan.map(item => item.parts).filter(p => p).join('\n');
    const data = {
        clientName: document.getElementById('client-name')?.value || 'N/A',
        clientPhone: document.getElementById('client-phone')?.value || 'N/A',
        clientEmail: document.getElementById('client-email')?.value || 'N/A',
        plate: document.getElementById('number-plate')?.value || 'N/A',
        make: document.getElementById('make')?.value || 'N/A',
        model: document.getElementById('model')?.value || 'N/A',
        year: document.getElementById('year')?.value || 'N/A',
        vin: document.getElementById('vin')?.value || 'N/A',
        color: document.getElementById('color')?.value || 'N/A',
        engineCC: document.getElementById('engine-cc')?.value || 'N/A',
        trim: document.getElementById('trim')?.value || 'N/A',
        engineName: document.getElementById('engine-name')?.value || 'N/A',
        transmission: document.getElementById('transmission')?.value || 'N/A',
        driveType: document.getElementById('drive')?.value || 'N/A',
        reportedProblems: document.getElementById('reported-problems')?.value || 'None specified.',
        diagnosticNotes: document.getElementById('diagnostic-notes')?.value || 'No notes.',
        assignedMechanic: document.getElementById('assigned-mechanic')?.value || 'Unassigned',
        dueDate: document.getElementById('due-date')?.value || 'TBD',
        deliveryDate: document.getElementById('delivery-date')?.value || 'TBD',
        repairPlanItems: repairPlan,
        repairNotes: actionItems || 'Pending assessment.',
        replacementParts: partsList || 'No parts.',
        errorCodes: rawErrorCodes,
        errorMeanings: fullErrorMeanings,
        jobType: 'StandardRepair'
    };
    renderJobCardContent(data, 'Preview');
    document.getElementById('jobCardModal').style.display = 'flex';
}

export async function openDetailedReport(carId) {
    try {
        const docSnap = await getDoc(doc(db, 'cars', carId));
        if (docSnap.exists()) {
            renderJobCardContent(docSnap.data(), docSnap.data().status);
            document.getElementById('jobCardModal').style.display = 'flex';
        } else alert("Report not found!");
    } catch (err) {
        console.error(err);
        alert("Could not load report.");
    }
}

function renderJobCardContent(data, status) {
    window.currentJobCardData = data;
    const container = document.getElementById('job-card-content');
    const dialog = document.getElementById('job-card-dialog');
    dialog.classList.remove('max-w-3xl', 'max-w-xl');
    if (data.jobType === 'GeneralService') {
        dialog.classList.add('max-w-xl');
        container.innerHTML = `
            <div class="text-center border-b pb-2"><h2 class="text-3xl font-bold text-green-800">General Service Report</h2><p class="text-sm">${new Date().toLocaleDateString()}</p></div>
            <div class="grid grid-cols-2 gap-2"><p><b>Client:</b> ${escapeHtml(data.clientName)}</p><p><b>Phone:</b> ${escapeHtml(data.clientPhone)}</p><p><b>Vehicle:</b> ${escapeHtml(data.make)} ${escapeHtml(data.model)} (${escapeHtml(data.plate)})</p><p><b>Service By:</b> ${escapeHtml(data.servicePerson || 'N/A')}</p></div>
            <h3 class="text-xl font-bold">Service Summary</h3><p class="whitespace-pre-wrap">${escapeHtml(data.diagnosticNotes)}</p>
            <h3 class="text-xl font-bold">Mileage</h3><p>Current: ${escapeHtml(data.currentMileage)} KM</p><p>Next: ${escapeHtml(data.nextServiceMileage)} KM</p>
            <p class="text-xs italic">Full checklist available in the Service Report PDF.</p>`;
        document.getElementById('whatsapp-btn').style.display = 'none';
    } else {
        dialog.classList.add('max-w-3xl');
        const repairHtml = data.repairPlanItems?.length ? data.repairPlanItems.map((item, i) => `
            <div class="p-2 border border-pink-300 bg-pink-50 rounded"><b>Action ${i+1}:</b> ${escapeHtml(item.action)}<br>${item.parts ? `<b>Parts:</b> ${escapeHtml(item.parts)}` : ''}</div>
        `).join('') : '<p>No repair plan.</p>';
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-2"><p><b>Client:</b> ${escapeHtml(data.clientName)}</p><p><b>Phone:</b> ${escapeHtml(data.clientPhone)}</p><p><b>Email:</b> ${escapeHtml(data.clientEmail)}</p></div>
            <h3 class="text-xl font-bold">Vehicle</h3><div class="grid grid-cols-3 gap-1"><p><b>Plate:</b> ${escapeHtml(data.plate)}</p><p><b>Make:</b> ${escapeHtml(data.make)}</p><p><b>Model:</b> ${escapeHtml(data.model)}</p><p><b>Year:</b> ${escapeHtml(data.year)}</p><p><b>VIN:</b> ${escapeHtml(data.vin)}</p><p><b>Trans:</b> ${escapeHtml(data.transmission)}</p></div>
            <h3 class="text-xl font-bold">Problem & Diagnosis</h3><p><b>Reported:</b> ${escapeHtml(data.reportedProblems)}</p><p><b>Diagnostic:</b> ${escapeHtml(data.diagnosticNotes)}</p>
            <h3 class="text-xl font-bold">Repair Plan</h3>${repairHtml}
            <h3 class="text-xl font-bold">Job Status</h3><p><b>Status:</b> ${escapeHtml(status)}</p><p><b>Mechanic:</b> ${escapeHtml(data.assignedMechanic)}</p><p><b>Delivery:</b> ${escapeHtml(data.deliveryDate)}</p>
            <h3 class="text-xl font-bold">Error Codes</h3><pre class="text-sm bg-yellow-50 p-2">${escapeHtml(data.errorMeanings)}</pre>`;
        document.getElementById('whatsapp-btn').style.display = 'inline-block';
    }
}

export function sendJobCardViaWhatsApp() {
    const data = window.currentJobCardData;
    if (!data) { alert("No job card data."); return; }
    const phone = cleanPhoneNumber(data.clientPhone);
    if (!phone) { alert("Invalid phone number."); return; }
    let msg = `*Garage Manager PRO Job Report*\n\nClient: ${data.clientName}\nVehicle: ${data.make} ${data.model} (${data.plate})\nJob Type: ${data.jobType === 'GeneralService' ? 'General Service' : 'Standard Repair'}\n\n`;
    if (data.jobType === 'GeneralService') {
        msg += `Service Notes: ${data.diagnosticNotes}\nMileage: ${data.currentMileage} KM\nNext Service: ${data.nextServiceMileage} KM`;
    } else {
        msg += `Status: ${data.status}\nMechanic: ${data.assignedMechanic}\nDelivery: ${data.deliveryDate}\n\nReported: ${data.reportedProblems}\nDiagnostic: ${data.diagnosticNotes}\n\nRepair Plan:\n`;
        data.repairPlanItems?.forEach((item, i) => { msg += `  • ${item.action}\n`; if (item.parts) msg += `    Parts: ${item.parts}\n`; });
        if (data.errorCodes && data.errorCodes !== 'N/A') msg += `\nError Codes: ${data.errorCodes}`;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}
