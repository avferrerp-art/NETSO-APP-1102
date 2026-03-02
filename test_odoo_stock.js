const https = require('https');
const config = {
    URL: 'https://netso.odoo.com',
    DB: 'lixie-dev-netso-main-12510561',
    USERNAME: 'luismoreno.netso@gmail.com',
    API_KEY: '49c70a2c9f66b8561c858395d0a3d7b5f9568c4a'
};

async function odooCall(model, method, args, kwargs = {}) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            jsonrpc: "2.0",
            method: "call",
            params: {
                service: "object",
                method: "execute_kw",
                args: [config.DB, 18, config.API_KEY, model, method, args, kwargs]
            },
            id: 2
        });
        const req = https.request('https://netso.odoo.com/jsonrpc', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                const parsed = JSON.parse(data);
                if (parsed.result !== undefined) resolve(parsed.result);
                else resolve({ error: parsed.error });
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

(async () => {
    try {
        console.log("Global Context:");
        const globalData = await odooCall('product.product', 'search_read', [[['name', 'ilike', 'T21']]], { fields: ['name', 'incoming_qty', 'qty_available', 'outgoing_qty'] });
        console.log(globalData);

        console.log("\nWarehouse Context (Urbina = 82, Caracas = 64):");
        const ctx82Data = await odooCall('product.product', 'search_read', [[['name', 'ilike', 'T21']]], { fields: ['name', 'incoming_qty', 'qty_available', 'outgoing_qty'], context: { location: 82 } });
        console.log("Urbina (82):", ctx82Data);

        const ctx64Data = await odooCall('product.product', 'search_read', [[['name', 'ilike', 'T21']]], { fields: ['name', 'incoming_qty', 'qty_available', 'outgoing_qty'], context: { location: 64 } });
        console.log("Caracas (64):", ctx64Data);

    } catch (e) {
        console.error("Script Error:", e);
    }
})();
