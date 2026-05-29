import { getUTCDateString } from './utils.js';

export let currentReportJobs = [];
export let currentReportSummary = {};
export let currentReportTitle = "";
export let currentReportDateRange = "";

let completedJobsCache = []; // set from main.js via setCompletedJobsCache

export function setCompletedJobsCache(cache) { completedJobsCache = cache; }

function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function summarizeJobs(jobs) {
    const summary = { totalJobs: jobs.length, jobsByType: {}, jobsByMechanic: {}, jobsByMake: {}, totalParts: 0 };
    jobs.forEach(job => {
        summary.jobsByType[job.jobType] = (summary.jobsByType[job.jobType] || 0) + 1;
        const mechanic = job.assignedMechanic || job.servicePerson || 'Unknown';
        summary.jobsByMechanic[mechanic] = (summary.jobsByMechanic[mechanic] || 0) + 1;
        const make = job.make || 'Unknown';
        summary.jobsByMake[make] = (summary.jobsByMake[make] || 0) + 1;
        if (job.replacementParts) summary.totalParts += job.replacementParts.split('\n').length * 1000;
    });
    const sort = obj => Object.entries(obj).sort((a,b) => b[1]-a[1]).slice(0,5);
    summary.jobsByType = sort(summary.jobsByType);
    summary.jobsByMechanic = sort(summary.jobsByMechanic);
    summary.jobsByMake = sort(summary.jobsByMake);
    return summary;
}

function renderReportContent(jobs, summary, title, dateRange, contentId, modalId) {
    const content = document.getElementById(contentId);
    const summaryHtml = `
        <div class="text-center border-b pb-2"><h2 class="text-3xl font-bold text-purple-800">${title}</h2><p class="text-sm">${dateRange}</p></div>
        <div class="bg-indigo-50 p-4 rounded"><h3 class="text-2xl font-bold">Total Jobs: ${summary.totalJobs}</h3><p>Estimated Parts Value: KES ${summary.totalParts.toLocaleString()}</p></div>
        <h3 class="text-xl font-bold mt-4">Top Metrics</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-gray-100 p-2"><b>Jobs by Type</b><ul>${summary.jobsByType.map(([k,v]) => `<li>${k}: ${v}</li>`).join('')}</ul></div>
            <div class="bg-gray-100 p-2"><b>Top Mechanics</b><ul>${summary.jobsByMechanic.map(([k,v]) => `<li>${k}: ${v}</li>`).join('')}</ul></div>
            <div class="bg-gray-100 p-2"><b>Top Makes</b><ul>${summary.jobsByMake.map(([k,v]) => `<li>${k}: ${v}</li>`).join('')}</ul></div>
        </div>
        <h3 class="text-xl font-bold mt-4">Detailed Jobs</h3>`;
    const jobsHtml = jobs.map(job => `
        <div class="border p-3 rounded shadow"><b>${job.make} ${job.model} (${job.plate})</b><br>Type: ${job.jobType}<br>Mechanic: ${job.assignedMechanic || job.servicePerson}<br><button onclick="window.openDetailedReport('${job.id}')" class="text-indigo-500 text-sm">View Full Report</button></div>
    `).join('');
    content.innerHTML = summaryHtml + '<div class="space-y-2 mt-4">' + jobsHtml + '</div>';
    currentReportJobs = jobs;
    currentReportSummary = summary;
    currentReportTitle = title;
    currentReportDateRange = dateRange;
    document.getElementById(modalId).style.display = 'flex';
}

export function generateDailyReport() {
    if (!completedJobsCache.length) { alert("No completed jobs."); return; }
    const today = new Date();
    const completedToday = completedJobsCache.filter(job => job.completedAt && isSameDay(job.completedAt.toDate(), today));
    if (!completedToday.length) { alert("No jobs completed today."); return; }
    const summary = summarizeJobs(completedToday);
    const dateStr = today.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    document.getElementById('report-date').textContent = dateStr;
    renderReportContent(completedToday, summary, "End-of-Day Operations Summary", `Date: ${dateStr}`, 'report-content', 'dailyReportModal');
}

export function generateMonthlyReport() {
    if (!completedJobsCache.length) { alert("No completed jobs."); return; }
    const today = new Date();
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(today.getDate() - 30);
    const completedMonth = completedJobsCache.filter(job => job.completedAt && job.completedAt.toDate() >= thirtyDaysAgo);
    const summary = summarizeJobs(completedMonth);
    const start = thirtyDaysAgo.toLocaleDateString();
    const end = today.toLocaleDateString();
    document.getElementById('monthly-report-start').textContent = start;
    document.getElementById('monthly-report-end').textContent = end;
    renderReportContent(completedMonth, summary, "Monthly Performance Report", `Period: ${start} - ${end}`, 'monthly-report-content', 'monthlyReportModal');
}

export function generateReportPDF(reportType) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 15;
    doc.setFontSize(22).text(currentReportTitle, 14, y);
    y += 8;
    doc.setFontSize(10).text(currentReportDateRange, 14, y);
    y += 12;
    doc.autoTable({ startY: y, body: [['Total Jobs', currentReportSummary.totalJobs], ['Estimated Parts Value', `KES ${currentReportSummary.totalParts.toLocaleString()}`]], theme: 'plain', margin: { left: 14 } });
    y = doc.autoTable.previous.finalY + 8;
    const summaryData = [];
    const addSec = (title, arr) => {
        summaryData.push([{ content: title, colSpan: 2, styles: { fillColor: [240,240,240] } }]);
        if (!arr.length) summaryData.push(['No data', '']);
        else arr.forEach(([k,v]) => summaryData.push([k, v]));
    };
    addSec("Top Jobs by Type", currentReportSummary.jobsByType);
    addSec("Top Mechanics", currentReportSummary.jobsByMechanic);
    addSec("Top Makes", currentReportSummary.jobsByMake);
    doc.autoTable({ startY: y, body: summaryData, theme: 'grid', margin: { left: 14 }, styles: { fontSize: 9 } });
    y = doc.autoTable.previous.finalY + 15;
    const jobRows = currentReportJobs.map(job => [job.plate || 'N/A', `${job.make || ''} ${job.model || ''}`, job.jobType, job.assignedMechanic || job.servicePerson || 'N/A', job.completedAt ? job.completedAt.toDate().toLocaleString() : 'N/A']);
    doc.autoTable({ startY: y, head: [['Plate','Vehicle','Type','Mechanic','Completed']], body: jobRows, theme: 'striped', headStyles: { fillColor: [79,70,229] }, styles: { fontSize: 8 } });
    doc.save(`${reportType}_Report_${getUTCDateString()}.pdf`);
}
