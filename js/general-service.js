import { db, auth } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const SERVICE_ITEMS = [
    { name: "Engine Oil & Filter", type: "filter" }, { name: "Air Filter", type: "filter" },
    { name: "Cabin Filter", type: "filter" }, { name: "Fuel Filter", type: "filter" },
    { name: "Transmission Fluid", type: "fluid" }, { name: "Brake Fluid", type: "fluid" },
    { name: "Coolant/Antifreeze", type: "fluid" }, { name: "Power Steering Fluid", type: "fluid" },
    { name: "Front Brake Pads", type: "other" }, { name: "Rear Brake Pads/Shoes", type: "other" },
    { name: "Brake Discs/Drums", type: "other" }, { name: "Handbrake Function", type: "other" },
    { name: "Tire Pressure (All)", type: "other" }, { name: "Tire Tread Depth", type: "other" },
    { name: "Suspension & Shocks", type: "other" }, { name: "Wiper Blades", type: "other" },
    { name: "Battery Health", type: "other" }, { name: "Auxiliary Drive Belts", type: "other" },
    { name: "Spark Plugs/Glow Plugs", type: "other" }
];
const LIGHTS_ITEMS = [
    "Headlights (Low)", "Headlights (High)", "Tail Lights", "Brake Lights",
    "Reverse Lights", "Indicators (Front)", "Indicators (Rear)", "Hazard Lights",
    "Fog Lights (F/R)", "Number Plate Light"
];

export function initializeGeneralService() {
    const fluids = document.getElementById('fluids-filters-body');
    const lights = document.getElementById('lights-body');
    const other = document.getElementById('other-checks-body');
    if (!fluids) return;
    fluids.innerHTML = '';
    lights.innerHTML = '';
    other.innerHTML = '';
    SERVICE_ITEMS.forEach(item => {
        if (item.type === 'filter' || item.type === 'fluid') {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${item.name}</td>
                <td><input type="checkbox" name="${item.name}-faulty" class="form-checkbox"></td>
                <td><input type="checkbox" name="${item.name}-checked" class="form-checkbox" checked></td>
                <td><input type="checkbox" name="${item.name}-changed" class="form-checkbox"></td>`;
            fluids.appendChild(tr);
        } else {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${item.name}</td>
                <td><input type="checkbox" name="${item.name}-faulty" class="form-checkbox"></td>
                <td><input type="checkbox" name="${item.name}-checked" class="form-checkbox" checked></td>
                <td><input type="checkbox" name="${item.name}-changed" class="form-checkbox"></td>
                <td><input type="text" name="${item.name}-notes" placeholder="Condition" class="w-full p-1 border rounded text-xs"></td>`;
            other.appendChild(tr);
        }
    });
    LIGHTS_ITEMS.forEach(light => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${light}</td>
            <td><input type="checkbox" name="${light}-left-working" class="form-checkbox" checked></td>
            <td><input type="checkbox" name="${light}-right-working" class="form-checkbox" checked></td>
            <td><input type="text" name="${light}-notes" placeholder="Notes" class="w-full p-1 border rounded text-xs"></td>`;
        lights.appendChild(tr);
    });
    document.getElementById('general-service-form')?.reset();
}

function collectGeneralServiceData() {
    const form = document.getElementById('general-service-form');
    const clientName = form['service-client-name']?.value;
    const clientPhone = form['service-client-phone']?.value;
    const plate = form['service-plate']?.value;
    if (!clientName || !clientPhone || !plate) {
        alert("Fill client name, phone, and plate.");
        return null;
    }
    const data = {
        clientName, clientPhone, plate, make: form['service-make']?.value || '',
        model: form['service-model']?.value || '', vin: form['service-vin']?.value || '',
        currentMileage: form['current-mileage']?.value,
        nextServiceMileage: form['next-service-mileage']?.value,
        servicePerson: form['service-person']?.value,
        serviceChecks: [], lightChecks: [], jobType: 'GeneralService',
        reportedProblems: 'Standard General Service Check.',
        diagnosticNotes: `Service by ${form['service-person']?.value} on ${new Date().toLocaleDateString()}. Mileage: ${form['current-mileage']?.value} KM. Next due: ${form['next-service-mileage']?.value} KM.`,
        repairPlanItems: [], errorCodes: 'N/A', errorMeanings: 'N/A',
        assignedMechanic: form['service-person']?.value,
        dueDate: new Date().toISOString().split('T')[0],
        deliveryDate: new Date().toISOString().split('T')[0],
        color: 'N/A', engineCC: 'N/A', trim: 'N/A', engineName: 'N/A',
        transmission: 'N/A', driveType: 'N/A', year: 'N/A'
    };
    SERVICE_ITEMS.forEach(item => {
        const faulty = form[`${item.name}-faulty`]?.checked;
        const checked = form[`${item.name}-checked`]?.checked;
        const changed = form[`${item.name}-changed`]?.checked;
        let status = 'NOT CHECKED';
        if (faulty) status = 'FAULTY/NEEDS ATTENTION';
        else if (changed) status = 'CHANGED/REPLACED';
        else if (checked) status = 'OK/CHECKED';
        const notes = item.type === 'other' ? form[`${item.name}-notes`]?.value || '' : '';
        data.serviceChecks.push({ item: item.name, status, notes, faulty, checked, changed, type: item.type });
    });
    LIGHTS_ITEMS.forEach(light => {
        data.lightChecks.push({
            light, left: form[`${light}-left-working`]?.checked,
            right: form[`${light}-right-working`]?.checked,
            notes: form[`${light}-notes`]?.value || ''
        });
    });
    return data;
}

export async function completeServiceJob() {
    if (window.isSavingService) return;
    window.isSavingService = true;
    try {
        if (!auth.currentUser) throw new Error("Not logged in");
        const fullData = collectGeneralServiceData();
        if (!fullData) return;
        const saveData = { ...fullData, status: 'Completed', completedAt: serverTimestamp(), completedBy: auth.currentUser.email };
        delete saveData.serviceChecks;
        delete saveData.lightChecks;
        await addDoc(collection(db, 'cars'), saveData);
        alert("Service job saved as completed!");
        document.getElementById('general-service-form')?.reset();
        initializeGeneralService();
        window.showSection('completed-list');
    } catch (err) {
        console.error(err);
        alert("Failed to save service job.");
    } finally {
        window.isSavingService = false;
    }
}

export async function generateServiceReportPDF() {
    const data = collectGeneralServiceData();
    if (!data) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 15;
    doc.setFontSize(22).text("General Vehicle Service Report", 14, y);
    y += 8;
    doc.setFontSize(10).text(`Date: ${new Date().toLocaleDateString()}`, 14, y);
    y += 12;
    doc.autoTable({
        startY: y, body: [
            ['Client', data.clientName, 'Phone', data.clientPhone],
            ['Vehicle', `${data.make} ${data.model}`, 'Plate', data.plate],
            ['Service By', data.servicePerson, 'Date', new Date().toLocaleDateString()]
        ], theme: 'plain', styles: { fontSize: 10 }, margin: { left: 14 }
    });
    y = doc.autoTable.previous.finalY + 8;
    const fluidsData = data.serviceChecks.filter(c => c.type === 'filter' || c.type === 'fluid').map(c => [c.item, c.status]);
    doc.setFontSize(14).text("Fluids & Filters", 14, y);
    doc.autoTable({ startY: y + 5, head: [['Item', 'Status']], body: fluidsData, theme: 'grid', margin: { left: 14 } });
    y = doc.autoTable.previous.finalY + 8;
    const lightsData = data.lightChecks.map(l => [l.light, l.left ? '✅' : '❌', l.right ? '✅' : '❌', l.notes]);
    doc.setFontSize(14).text("Lights & Electrical", 14, y);
    doc.autoTable({ startY: y + 5, head: [['Light', 'Left', 'Right', 'Notes']], body: lightsData, theme: 'grid', margin: { left: 14 } });
    y = doc.autoTable.previous.finalY + 8;
    const otherData = data.serviceChecks.filter(c => c.type === 'other').map(c => [c.item, c.status, c.notes]);
    doc.setFontSize(14).text("Critical Checks", 14, y);
    doc.autoTable({ startY: y + 5, head: [['Item', 'Status', 'Notes']], body: otherData, theme: 'grid', margin: { left: 14 } });
    y = doc.autoTable.previous.finalY + 8;
    doc.autoTable({ startY: y, body: [['Current Mileage', `${data.currentMileage} KM`], ['Next Service Est.', `${data.nextServiceMileage} KM`]], theme: 'plain', margin: { left: 14 } });
    doc.save(`Service_Report_${data.plate}.pdf`);
}
