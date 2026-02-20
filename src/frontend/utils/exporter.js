import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';


/**
 * Utilitário de Exportação (CSV, Excel, PDF)
 * Dependências: SheetJS (xlsx), jsPDF, jsPDF-AutoTable
 */

export function exportToExcel(data, filename, sheetName = 'Dados') {
    if (!data || !data.length) {
        alert('Sem dados para exportar.');
        return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Exporta dados para CSV (.csv)
 * @param {Array} data - Array de objetos com os dados
 * @param {String} filename - Nome do arquivo (sem extensão)
 */
export function exportToCSV(data, filename) {
    if (!data || !data.length) {
        alert('Sem dados para exportar.');
        return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Exporta dados para PDF (.pdf)
 * @param {Array} headers - Array de strings com cabeçalhos ['ID', 'Nome', ...]
 * @param {Array} data - Array de arrays com valores correspondentes [[1, 'João'], [2, 'Maria']]
 * @param {String} title - Título do relatório
 * @param {String} filename - Nome do arquivo (sem extensão)
 */
export function exportToPDF(headers, data, title, filename) {
    if (!data || !data.length) {
        alert('Sem dados para exportar.');
        return;
    }

    const doc = new jsPDF();

    // Título
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 28);

    // Tabela
    autoTable(doc, {
        head: [headers],
        body: data,
        startY: 35,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [25, 118, 210] } // Primary Color equivalent
    });

    doc.save(`${filename}.pdf`);
}
