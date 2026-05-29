// =================================================================
// UI Helpers for Error Codes and Repair Plan
// =================================================================

export function addErrorCodeInput(initialCode = '') {
    const container = document.getElementById('error-codes-container');
    if (!container) return;
    const newGroup = document.createElement('div');
    newGroup.className = 'error-code-group flex space-x-2 items-center';
    newGroup.innerHTML = `
        <input type="text" value="${initialCode}" placeholder="Pxxxx (e.g., P001A)" class="error-code-input p-3 border rounded-lg w-full md:w-1/3" />
        <button type="button" onclick="window.lookupErrorCode(this)" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg">Lookup Code</button>
        <button type="button" onclick="window.removeErrorCodeInput(this)" class="remove-btn bg-red-400 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg">X</button>
    `;
    const explanationGroup = document.createElement('div');
    explanationGroup.className = 'col-span-3 mt-1';
    explanationGroup.innerHTML = `
        <p class="error-code-explanation text-sm p-2 bg-gray-50 text-gray-800 rounded mt-1" style="display:none;"></p>
        <input type="hidden" class="error-code-meaning" value="" />
    `;
    container.appendChild(newGroup);
    container.appendChild(explanationGroup);
    if (initialCode) setTimeout(() => lookupErrorCodeUI(newGroup.querySelector('button')), 50);
}

export function removeErrorCodeInput(button) {
    const group = button.closest('.error-code-group');
    const next = group.nextElementSibling;
    if (next && next.querySelector('.error-code-explanation')) next.remove();
    group.remove();
}

export function lookupErrorCodeUI(button) {
    const codeInput = button.parentNode.querySelector('.error-code-input');
    const code = codeInput.value.toUpperCase().trim();
    const displayEl = button.parentNode.nextElementSibling?.querySelector('.error-code-explanation');
    const hiddenMeaningEl = button.parentNode.nextElementSibling?.querySelector('.error-code-meaning');
    if (!displayEl) return;
    if (!code) {
        displayEl.innerHTML = `⚠️ Please enter a code.`;
        displayEl.className = 'error-code-explanation text-sm p-2 bg-yellow-50 text-yellow-800 rounded mt-1';
        displayEl.style.display = 'block';
        if (hiddenMeaningEl) hiddenMeaningEl.value = '';
        return;
    }
    const definition = window.GLOBAL_ERROR_CODE_LOOKUP?.[code];
    if (definition) {
        const fullMeaning = `${definition.issuer}: ${definition.meaning}`;
        displayEl.innerHTML = `✅ <strong>${code}</strong>: ${fullMeaning}`;
        displayEl.className = 'error-code-explanation text-sm p-2 bg-green-50 text-green-800 rounded mt-1';
        if (hiddenMeaningEl) hiddenMeaningEl.value = fullMeaning;
    } else {
        displayEl.innerHTML = `⚠️ <strong>${code}</strong>: No definition found.`;
        displayEl.className = 'error-code-explanation text-sm p-2 bg-red-50 text-red-800 rounded mt-1';
        if (hiddenMeaningEl) hiddenMeaningEl.value = `${code}: No definition found.`;
    }
    displayEl.style.display = 'block';
}

export function getAllErrorCodesWithMeaning() {
    const groups = document.querySelectorAll('.error-code-group');
    const result = [];
    groups.forEach(group => {
        const codeInput = group.querySelector('.error-code-input');
        const code = codeInput?.value.toUpperCase().trim() || '';
        const meaningInput = group.nextElementSibling?.querySelector('.error-code-meaning');
        const meaning = meaningInput?.value.trim() || '';
        if (code) {
            result.push({ code, meaning: meaning || `${code}: Not looked up.` });
        }
    });
    return result;
}

export function addRepairPlanCard(initialAction = '', initialParts = '') {
    const container = document.getElementById('repair-plan-container');
    if (!container) return;
    const card = document.createElement('div');
    card.className = 'repair-plan-card p-4 border border-pink-300 bg-pink-50 rounded-lg shadow-sm space-y-3';
    card.innerHTML = `
        <div class="flex justify-between items-center">
            <h4 class="font-semibold text-pink-800">Repair Action Item</h4>
            <button type="button" onclick="window.removeRepairPlanCard(this)" class="text-red-500 hover:text-red-700 font-bold text-lg">×</button>
        </div>
        <textarea placeholder="Specific repair action to be performed" class="repair-plan-action w-full p-2 border rounded-lg" rows="2" required>${escapeHtml(initialAction)}</textarea>
        <input type="text" placeholder="Replacement Parts List" class="repair-plan-parts w-full p-2 border rounded-lg" value="${escapeHtml(initialParts)}" />
    `;
    container.appendChild(card);
}

export function removeRepairPlanCard(button) {
    button.closest('.repair-plan-card')?.remove();
}

export function getAllRepairPlanItems() {
    const cards = document.querySelectorAll('.repair-plan-card');
    const items = [];
    cards.forEach(card => {
        const action = card.querySelector('.repair-plan-action')?.value.trim();
        const parts = card.querySelector('.repair-plan-parts')?.value.trim();
        if (action) items.push({ action, parts: parts || '' });
    });
    return items;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}
