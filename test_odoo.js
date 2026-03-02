const https = require('https');
const config = {
    URL: 'https://netso.odoo.com',
    DB: 'lixie-dev-netso-main-12510561',
    USERNAME: 'luismoreno.netso@gmail.com',
    API_KEY: '49c70a2c9f66b8561c858395d0a3d7b5f9568c4a'
};

async function testOdooConnection() {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            jsonrpc: "2.0",
            method: "call",
            params: {
                service: "common",
                method: "authenticate",
                args: [config.DB, config.USERNAME, config.API_KEY, {}]
            },
            id: 1
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
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.result) {
                        console.log("Connection successful! UID:", parsed.result);
                        resolve(parsed.result);
                    } else if (parsed.error) {
                        console.error("Odoo error:", parsed.error);
                        reject(parsed.error);
                    } else {
                        console.error("Unknown response:", parsed);
                        reject(parsed);
                    }
                } catch (e) {
                    console.error("Error parsing response:", e);
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

testOdooConnection();
