import { db, auth } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAllErrorCodesWithMeaning, getAllRepairPlanItems, addErrorCodeInput, addRepairPlanCard } from './utils-ui.js'; // utility UI functions defined later

const carsCollection = collection(db, 'cars');

let isSavingCar = false;

export async function saveCarEntry(event) {
    event.preventDefault();
    if (isSavingCar) return;
    isSavingCar = true;
    try {
        if (!auth.currentUser) {
            alert("You must be logged in to save an entry.");
            return;
        }
        const errorData = getAllErrorCodesWithMeaning();
        const rawErrorCodes = errorData.map(e => e.code).join(', ');
        const fullErrorMeanings = errorData.map(e => e.meaning).map((m, i) => `${errorData[i].code}: ${m}`).join('\n');
        const repairPlan = getAllRepairPlanItems();
        const actionItems = repairPlan.map(item => item.action).join('\n---\n');
        const partsList = repairPlan.map(item => item.parts).filter(p => p).join('\n');
        if (repairPlan.length === 0) {
            alert("Please add at least one Repair Plan Item.");
            return;
        }
        const carData = {
            clientName: document.getElementById('client-name').value,
            clientPhone: document.getElementById('client-phone').value,
            clientEmail: document.getElementById('client-email').value,
            plate: document.getElementById('number-plate').value,
            vin: document.getElementById('vin').value,
            make: document.getElementById('make').value,
            model: document.getElementById('model').value,
            year: document.getElementById('year').value,
            color: document.getElementById('color').value,
            engineCC: document.getElementById('engine-cc').value,
            trim: document.getElementById('trim').value,
            engineName: document.getElementById('engine-name').value,
            transmission: document.getElementById('transmission').value,
            driveType: document.getElementById('drive').value,
            reportedProblems: document.getElementById('reported-problems').value,
            diagnosticNotes: document.getElementById('diagnostic-notes').value,
            assignedMechanic: document.getElementById('assigned-mechanic').value,
            dueDate: document.getElementById('due-date').value,
            deliveryDate: document.getElementById('delivery-date').value,
            repairPlanItems: repairPlan,
            repairNotes: actionItems,
            replacementParts: partsList,
            errorCodes: rawErrorCodes,
            errorMeanings: fullErrorMeanings,
            status: 'Active',
            jobType: 'StandardRepair',
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser.email
        };
        await addDoc(carsCollection, carData);
        alert("New Vehicle Entry successfully saved!");
        document.getElementById('car-entry-form').reset();
        document.getElementById('error-codes-container').innerHTML = '';
        document.getElementById('repair-plan-container').innerHTML = '';
        addErrorCodeInput();
        addRepairPlanCard('Full diagnostic and repair of error codes.', '');
        window.showSection('car-list');
    } catch (error) {
        console.error("Error in saveCarEntry: ", error);
        alert("Could not save vehicle entry.");
    } finally {
        isSavingCar = false;
    }
}
