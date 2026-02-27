/**
 * API para proveer las variables de entorno de Vercel de manera segura al frontend.
 * En lugar de tener config.js (que está en .gitignore y falta en Vercel),
 * Vercel inyectará estas claves desde la configuración de su panel (Vercel Dashboard).
 */
module.exports = (req, res) => {
    // Definimos cabeceras CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Leemos las variables del entorno de Node (Vercel inyecta esto mágicamente si las configuras)
    const envConfig = {
        GEMINI_KEY: process.env.VITE_GEMINI_KEY || process.env.GEMINI_KEY || '',
        ODOO_CONFIG: {
            URL: process.env.VITE_ODOO_URL || process.env.ODOO_URL || 'https://netso.odoo.com',
            DB: process.env.VITE_ODOO_DB || process.env.ODOO_DB || 'lixie-dev-netso-main-12510561',
            USERNAME: process.env.VITE_ODOO_USERNAME || process.env.ODOO_USERNAME || '',
            API_KEY: process.env.VITE_ODOO_API_KEY || process.env.ODOO_API_KEY || ''
        }
    };

    res.status(200).json(envConfig);
};
