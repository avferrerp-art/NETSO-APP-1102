const https = require('https');

https.get('https://netso-app-1102.vercel.app/api/env', (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            console.log("Status Code:", res.statusCode);
            const parsedData = JSON.parse(rawData);

            // Masking parts for security in logs
            if (parsedData.ODOO_CONFIG) {
                const conf = parsedData.ODOO_CONFIG;
                console.log("URL:", conf.URL);
                console.log("DB:", conf.DB);
                console.log("Username length:", conf.USERNAME ? conf.USERNAME.length : 0, ":", conf.USERNAME);
                console.log("API_KEY length:", conf.API_KEY ? conf.API_KEY.length : 0);
            } else {
                console.log("No ODOO_CONFIG found!", parsedData);
            }
        } catch (e) {
            console.error("Error parsing response:", e.message);
            console.log("Raw Response:", rawData);
        }
    });
}).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
});
