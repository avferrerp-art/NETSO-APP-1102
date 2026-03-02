import pathlib

code = r"""

// ============================================================
//   PRESUPUESTO OPTICO GPON  -  ITU-T G.671 / G.984.2
// ============================================================

window.toggleOpticalPanel = function () {
    var body = document.getElementById('optical-panel-body');
    var arrow = document.getElementById('optical-panel-arrow');
    var open = body.style.display === 'block';
    body.style.display = open ? 'none' : 'block';
    arrow.style.transform = open ? '' : 'rotate(180deg)';
};

window.calcularPresupuestoOptico = function () {
    var ALPHA_1310 = 0.35;
    var ALPHA_1490 = 0.20;
    var L_CON = 0.30;
    var L_SPLICE = 0.10;
    var SPLIT_LOSS = {'0':0,'1:2':3.7,'1:4':7.2,'1:8':10.5,'1:16':13.5,'1:32':16.8,'1:64':20.0};

    var pTx       = parseFloat(document.getElementById('ob-ptx').value) || 0;
    var sRx       = parseFloat(document.getElementById('ob-srx').value) || 0;
    var dTrunk    = parseFloat(document.getElementById('ob-d-trunk').value) || 0;
    var dDist     = parseFloat(document.getElementById('ob-d-dist').value) || 0;
    var split1Key = document.getElementById('ob-split1').value;
    var split2Key = document.getElementById('ob-split2').value;
    var nConn     = parseInt(document.getElementById('ob-connectors').value) || 0;
    var nSplice   = parseInt(document.getElementById('ob-splices').value) || 0;
    var margin    = parseFloat(document.getElementById('ob-margin').value) || 0;

    var dTotal      = dTrunk + dDist;
    var lSplit1     = SPLIT_LOSS[split1Key] || 0;
    var lSplit2     = SPLIT_LOSS[split2Key] || 0;
    var lConn       = nConn * L_CON;
    var lSplice     = nSplice * L_SPLICE;
    var budgetBruto = pTx - sRx;

    function calcWL(alpha) {
        var lFiber = alpha * dTotal;
        var lTotal = lFiber + lSplit1 + lSplit2 + lConn + lSplice + margin;
        var pbm    = budgetBruto - lTotal;
        return { lFiber: lFiber, lTotal: lTotal, pbm: pbm };
    }

    var wl1310 = calcWL(ALPHA_1310);
    var wl1490 = calcWL(ALPHA_1490);

    function classify(pbm) {
        if (pbm >= 6) return { label: '\u2705 Estado: OPTIMO',    bg: '#dcfce7', color: '#15803d' };
        if (pbm >= 3) return { label: '\u26a0\ufe0f Estado: ACEPTABLE', bg: '#fef9c3', color: '#92400e' };
        if (pbm >= 0) return { label: '\ud83d\udd34 Estado: CRITICO',   bg: '#fee2e2', color: '#b91c1c' };
        return         { label: '\u274c Estado: INVIABLE',     bg: '#fca5a5', color: '#7f1d1d' };
    }

    var status = classify(wl1310.pbm);
    var badge = document.getElementById('ob-status-badge');
    badge.textContent = status.label;
    badge.style.background = status.bg;
    badge.style.color = status.color;
    badge.style.border = '1.5px solid ' + status.color;

    function pbmColor(pbm) {
        if (pbm >= 6) return '#15803d';
        if (pbm >= 3) return '#b45309';
        if (pbm >= 0) return '#b91c1c';
        return '#7f1d1d';
    }

    document.getElementById('ob-pbm-1310').textContent = wl1310.pbm.toFixed(2);
    document.getElementById('ob-pbm-1310').style.color = pbmColor(wl1310.pbm);
    document.getElementById('ob-pbm-1490').textContent = wl1490.pbm.toFixed(2);
    document.getElementById('ob-pbm-1490').style.color = pbmColor(wl1490.pbm);
    document.getElementById('ob-wl-1310').style.borderColor = pbmColor(wl1310.pbm);
    document.getElementById('ob-wl-1490').style.borderColor = '#cbd5e1';

    var rows = [
        { name: 'Fibra Troncal (1310nm)',      qty: dTrunk+' km', unit: ALPHA_1310.toFixed(2), total: ALPHA_1310*dTrunk, hidden: false },
        { name: 'Fibra Distribucion (1310nm)', qty: dDist+' km',  unit: ALPHA_1310.toFixed(2), total: ALPHA_1310*dDist,  hidden: false },
        { name: 'Splitter N1 ('+split1Key+')', qty: '1', unit: lSplit1.toFixed(1), total: lSplit1, hidden: lSplit1===0 },
        { name: 'Splitter N2 ('+split2Key+')', qty: '1', unit: lSplit2.toFixed(1), total: lSplit2, hidden: lSplit2===0 },
        { name: 'Conectores SC/APC',           qty: nConn.toString(),   unit: L_CON.toFixed(2),    total: lConn,   hidden: nConn===0 },
        { name: 'Empalmes por Fusion',         qty: nSplice.toString(), unit: L_SPLICE.toFixed(2), total: lSplice, hidden: nSplice===0 },
        { name: 'Margen Envejecimiento',       qty: '-',                unit: '-',                 total: margin,  hidden: false }
    ];

    var tbody = document.getElementById('ob-breakdown-body');
    var html = '';
    var idx = 0;
    for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r.hidden) continue;
        var bg = (idx % 2 === 0) ? 'white' : '#f8fafc';
        html += '<tr style="background:' + bg + ';">';
        html += '<td style="padding:9px 12px;">' + r.name + '</td>';
        html += '<td style="padding:9px 8px;text-align:center;">' + r.qty + '</td>';
        html += '<td style="padding:9px 8px;text-align:right;">' + r.unit + '</td>';
        html += '<td style="padding:9px 8px;text-align:right;font-weight:600;">' + r.total.toFixed(2) + '</td></tr>';
        idx++;
    }
    tbody.innerHTML = html;

    document.getElementById('ob-ltotal-1310').textContent  = wl1310.lTotal.toFixed(2) + ' dB';
    document.getElementById('ob-budget-bruto').textContent = budgetBruto.toFixed(2) + ' dB';

    var earlyWarning = document.getElementById('ob-early-warning');
    earlyWarning.style.display = (wl1310.pbm < 5 && wl1310.pbm >= 0) ? 'block' : 'none';
    document.getElementById('ob-results').style.display = 'block';
};
"""

p = pathlib.Path(r"c:\Users\Admini\Desktop\avance 0602\script.js")
p.write_text(p.read_text(encoding='utf-8') + code, encoding='utf-8')
print("Done. New size:", p.stat().st_size)
