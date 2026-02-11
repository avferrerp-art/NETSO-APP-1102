import sys

def truncate_and_append(filename, line_num, clean_code):
    with open(filename, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()
    
    # Keep lines up to line_num (1-indexed)
    new_lines = lines[:line_num]
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
        f.write('\n' + clean_code + '\n')

clean_code = """window.saveDirectQuote = async function () {
    if (quoteItems.length === 0) {
        alert("⚠️ Tu lista está vacía. Agrega items antes de guardar.");
        return;
    }

    const projectName = document.getElementById('projectName').value || "Cotización " + new Date().toLocaleDateString();

    // Check Auth
    if (!auth.currentUser) {
        alert("⚠️ Debes iniciar sesión para guardar proyectos.");
        return;
    }

    const projectData = {
        uid: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        projectName: projectName,
        date: new Date().toISOString(),
        type: 'direct', // Distinguir del asistente
        status: 'draft',
        quoteItems: quoteItems, // Array de items
        ispName: (currentUser && currentUser.company) ? currentUser.company : 'Cliente'
    };

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Guardando...';
    btn.disabled = true;

    try {
        await db.collection("projects").add(projectData);
        alert("✅ Cotización guardada exitosamente en 'Mis Proyectos'.");
        quoteItems = []; // Limpiar tras guardar
        renderQuoteTable(); 
    } catch (e) {
        console.error("Error saving quote:", e);
        alert("❌ Error al guardar: " + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

window.downloadDirectQuoteFromHistory = function (id) {
    const project = allProjectsCache.find(p => p.id === id);

    if (!project || !project.quoteItems) {
        alert("❌ Error: Datos del proyecto no encontrados.");
        return;
    }

    const items = project.quoteItems;
    const projectName = project.projectName || "Cotización";
    const ispName = project.ispName || "Cliente";
    const dateStr = new Date(project.date).toLocaleDateString();

    let excelContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="UTF-8">
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>Cotización Netso</x:Name>
                            <x:WorksheetOptions>
                                <x:DisplayGridlines/>
                            </x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <style>
                body { font-family: Arial, sans-serif; }
                .header { background-color: #0f172a; color: #ffffff; font-size: 18px; font-weight: bold; text-align: center; }
                .subheader { background-color: #f1f5f9; color: #334155; font-weight: bold; border-bottom: 2px solid #cbd5e1; }
                td { padding: 8px; border: 1px solid #e2e8f0; vertical-align: middle; }
                .amount { text-align: right; }
                .total-row { background-color: #f1f5f9; font-weight: bold; font-size: 14px; }
            </style>
        </head>
        <body>
            <table border="1" style="border-collapse: collapse; width: 100%;">
                <tr>
                    <td colspan="4" class="header" style="height: 50px;">
                        COTIZACIÓN - ${projectName.toUpperCase()}
                    </td>
                </tr>
                <tr>
                    <td colspan="4" style="background-color: #e2e8f0; text-align: center; font-weight: bold;">
                        ${ispName} | Fecha: ${dateStr}
                    </td>
                </tr>
                <tr><td colspan="4" style="border:none; height:10px;"></td></tr>
                <tr class="subheader">
                    <td style="width: 400px; background-color: #1e293b; color: white;">PRODUCTO / DESCRIPCIÓN</td>
                    <td style="width: 100px; background-color: #1e293b; color: white; text-align: center;">CANTIDAD</td>
                    <td style="width: 150px; background-color: #1e293b; color: white; text-align: right;">UNITARIO ($)</td>
                    <td style="width: 150px; background-color: #1e293b; color: white; text-align: right;">TOTAL ($)</td>
                </tr>
    `;

    let totalGlobal = 0;
    items.forEach((item, index) => {
        totalGlobal += item.total;
        const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        excelContent += `
            <tr style="background-color: ${bg};">
                <td>${item.name}</td>
                <td style="text-align: center;">${item.qty}</td>
                <td class="amount">${item.price.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                <td class="amount" style="font-weight: 600;">${item.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
    });

    excelContent += `
        <tr><td colspan="4" style="border:none; height:10px;"></td></tr>
        <tr class="total-row">
            <td colspan="3" style="text-align: right; padding-right: 15px;">TOTAL GENERAL:</td>
            <td class="amount" style="color: #0f172a; font-size: 16px;">$ ${totalGlobal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
        </tr>
    `;

    excelContent += `
            </table>
            <div style="margin-top:20px; color:#94a3b8; font-size:11px; text-align:center;">
                Generado por Netso Platform
            </div>
        </body>
        </html>
    `;

    const filename = `${projectName.replace(/\s+/g, '_')}_Cotizacion.xls`;
    const blob = new Blob(['\\uFEFF', excelContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
};"""

if __name__ == "__main__":
    truncate_and_append('script.js', 3711, clean_code)
