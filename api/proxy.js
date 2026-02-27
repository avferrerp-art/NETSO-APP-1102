const https = require('https');
const http = require('http');
const url = require('url');

/**
 * Servidor Proxy Simple para Odoo (Compatible con Vercel/Netlify Functions)
 * 
 * Uso: GET /api?url=https://tu-odoo.com/jsonrpc
 * Body: { jsonrpc: "2.0", method: "call", ... }
 */

module.exports = async (req, res) => {
    // 1. Configurar CORS (Permitir todo)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Responder a preflight OPTIONS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 2. Extraer URL destino
    // En Vercel, req.query está disponible. En Node puro, hay que parsearlo.
    const query = url.parse(req.url, true).query;
    const targetUrl = query.url; // La URL de Odoo

    if (!targetUrl) {
        res.status(400).json({ error: 'Falta parámetro ?url=...' });
        return;
    }

    // 3. Preparar la solicitud al servidor Odoo
    const parsedTarget = url.parse(targetUrl);
    const lib = parsedTarget.protocol === 'https:' ? https : http;

    const proxyHeaders = { ...req.headers };
    delete proxyHeaders['content-length']; // Importante: recalculamos esto después
    delete proxyHeaders['host'];

    const proxyReq = lib.request({
        hostname: parsedTarget.hostname,
        port: parsedTarget.port,
        path: parsedTarget.path,
        method: req.method,
        headers: {
            ...proxyHeaders,
            host: parsedTarget.hostname, // Importante: Host header correcto
            origin: parsedTarget.protocol + '//' + parsedTarget.hostname // Fingir origen
        }
    }, (proxyRes) => {
        // Enviar respuesta al cliente
        res.status(proxyRes.statusCode);
        Object.keys(proxyRes.headers).forEach((key) => {
            // No mandar transfer-encoding chunked manual si lo maneja el framework
            if (key.toLowerCase() !== 'transfer-encoding') {
                res.setHeader(key, proxyRes.headers[key]);
            }
        });
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
        console.error("Error en proxy:", e);
        res.status(502).json({ error: "Error en proxy: " + e.message });
    });

    // 4. Enviar datos del cuerpo (si es POST)
    if (req.body && Object.keys(req.body).length > 0) {
        // Si el entorno ya parseó el body (Vercel), lo stringificamos
        const bodyData = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;

        // RECALCULAR CONTENT-LENGTH porque si fue parseado y re-stringificado, el original es erróneo
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));

        proxyReq.write(bodyData);
        proxyReq.end();
    } else {
        // Si no hay body parseado pero es un método con payload (como un body stream puro)
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            req.pipe(proxyReq);
        } else {
            proxyReq.end();
        }
    }
};
