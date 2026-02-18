// ============================================
// CONFIGURACIÓN Y ESTADO GLOBAL
// ============================================

// Estado global
let catalogoNetso = null;
let googleApiKey = localStorage.getItem('googleApiKey');
let currentUser = null; // { name, role, company? }

// FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyDIz9yuaQFuzol8C8qc8XlcMAryRhL-2wc",
    authDomain: "netso-e33d0.firebaseapp.com",
    projectId: "netso-e33d0",
    storageBucket: "netso-e33d0.firebasestorage.app",
    messagingSenderId: "284636911731",
    appId: "1:284636911731:web:4deb9f967cc73f99547206",
    measurementId: "G-K1C133EZC0"
};

// Auto-configure Maps API Key if not manually set
if (!googleApiKey && firebaseConfig.apiKey) {
    console.log("🔑 Using Firebase API Key for Google Maps");
    googleApiKey = firebaseConfig.apiKey;
}

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
let analytics = null;
try {
    analytics = firebase.analytics();
} catch (e) {
    console.warn("⚠️ Firebase Analytics no se pudo inicializar (puede estar bloqueado):", e.message);
}

// Contadores de tarjetas
let fibraCount = 0;
let ontCount = 0;
let distCount = 0;
let empalmeCount = 0;
let conectCount = 0;
let herrajeCount = 0;
let herramientaCount = 0;

// Variables globales para datos de reportes (cargados desde Firebase)
let allProjectsCache = [];
let currentAnalysisImages = []; // Almacena imágenes YA ANALIZADAS
let pendingImages = []; // Cola de imágenes por analizar

// Odoo Config
const odooConfig = {
    url: 'https://netso.odoo.com',
    db: 'lixie-dev-netso-main-12510561', // Nombre real confirmado por consola
    username: 'luismoreno.netso@gmail.com',
    apiKey: '49c70a2c9f66b8561c858395d0a3d7b5f9568c4a',
    uid: null // Se obtendrá al autenticar
};

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    // Initializa Auth Listener
    initAuthListener();

    try {
        await loadCatalog();
    } catch (e) {
        console.warn("Error cargando catálogo (no crítico para login):", e);
    }
    loadProjectState();

    // Auto-guardado en cambios
    document.body.addEventListener('change', saveProjectState);
    document.body.addEventListener('input', saveProjectState);

    // Soporte para tecla "Enter" en los formularios de login
    const loginInputs = [
        'login-isp-email', 'login-isp-pass',
        'reg-isp-name', 'reg-isp-company', 'reg-isp-email', 'reg-isp-phone', 'reg-isp-pass',
        'login-netso-user', 'login-netso-pass'
    ];

    loginInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (id.startsWith('login-isp')) handleLogin();
                    else if (id.startsWith('reg-isp')) handleIspRegister();
                    else if (id.startsWith('login-netso')) handleLogin();
                }
            });
        }
    });

    // Verificar API Key (solo si está logueado)
    if (currentUser && !googleApiKey) {
        toggleSettings();
    }
});



// ============================================
// PERSISTENCIA Y FUNCIONES GLOBALES
// ============================================

// Estado persistence del proyecto actual
let currentProjectDocId = localStorage.getItem('currentProjectDocId');

function initAuthListener() {
    console.log("Iniciando initAuthListener...");
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log("✅ Usuario detectado en Firebase Auth:", user.email, "UID:", user.uid);

            // Consultar rol en Firestore
            db.collection('users').doc(user.uid).get()
                .then((doc) => {
                    if (doc.exists) {
                        const userData = doc.data();
                        console.log("📄 Perfil encontrado en Firestore:", userData);
                        currentUser = { ...userData, email: user.email, uid: user.uid };

                        // Guardar local para backup
                        localStorage.setItem('netsoUser', JSON.stringify(currentUser));
                        updateProfileUI(currentUser);

                        if (userData.role === 'netso') {
                            console.log("Redirigiendo a Dashboard Netso...");
                            showNetsoDashboard();
                        } else {
                            console.log("Redirigiendo a App Principal (ISP)...");
                            showMainApp();
                        }
                    } else {
                        // Usuario sin documento (Legacy Netso o Registro en proceso)
                        console.warn("⚠️ Usuario sin perfil en Firestore. Verificando dominio/email para fallback.");

                        const isNetsoEmail = user.email.endsWith('@netso.com') ||
                            (user.email.includes('netso') && user.email.includes('@gmail.com'));

                        if (isNetsoEmail) {
                            console.log("Fallback: Usuario identificado como Personal Netso (Legacy/Dev).");
                            currentUser = { name: user.email.split('@')[0], role: 'netso', email: user.email, uid: user.uid };
                            localStorage.setItem('netsoUser', JSON.stringify(currentUser));
                            showNetsoDashboard();
                        } else {
                            // Si no hay doc, es un error o registro incompleto
                            console.error("❌ Error: Perfil de usuario no encontrado y no califica para fallback.");
                            auth.signOut();
                            alert("❌ Error: No se encontró tu perfil de usuario. Si te acabas de registrar, espera un momento o intenta registrarte de nuevo.");
                        }
                    }
                })
                .catch((error) => {
                    console.error("❌ Error obteniendo perfil de Firestore:", error);
                    // Si hay un error de red, el usuario podría quedar en un limbo, pero permitimos que vea el login
                });

        } else {
            // No hay usuario Firebase
            console.log("ℹ️ No hay sesión activa en Firebase Auth.");
            currentUser = null;
            document.getElementById('login-page').style.display = 'flex';
            document.getElementById('main-app').style.display = 'none';
        }
    });
}

function checkLogin() {
    // Deprecated by initAuthListener, but kept as alias if needed
    initAuthListener();
}

function switchRole(role) {
    // Botones
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-role-${role}`).classList.add('active');

    // Formularios
    document.querySelectorAll('.login-form').forEach(f => f.style.display = 'none');
    document.getElementById(`form-${role}`).style.display = 'block';

    // Reset ISP mode to login when switching back
    if (role === 'isp') toggleIspMode('login');
}

function toggleIspMode(mode) {
    if (mode === 'login') {
        document.getElementById('isp-mode-register').style.display = 'none';
        document.getElementById('isp-mode-login').style.display = 'block';
    } else {
        document.getElementById('isp-mode-login').style.display = 'none';
        document.getElementById('isp-mode-register').style.display = 'block';
    }
}

function handleIspRegister() {
    const name = document.getElementById('reg-isp-name').value.trim();
    const company = document.getElementById('reg-isp-company').value.trim();
    const email = document.getElementById('reg-isp-email').value.trim();
    const phone = document.getElementById('reg-isp-phone').value.trim();
    const pass = document.getElementById('reg-isp-pass').value.trim();

    if (!name || !company || !email || !pass || !phone) {
        alert('⚠️ Completa todos los campos para registrarte.');
        return;
    }

    // Bloquear UI o mostrar spinner si fuera necesario
    const regBtn = document.querySelector('button[onclick="handleIspRegister()"]');
    if (regBtn) regBtn.innerText = "Registrando...";

    auth.createUserWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            // Guardar datos adicionales en Firestore ANTES de que el listener actúe
            return db.collection('users').doc(userCredential.user.uid).set({
                name: name,
                company: company,
                phone: phone,
                role: 'isp',
                email: email,
                createdAt: new Date().toISOString()
            });
        })
        .then(() => {
            console.log("ISP Registrado exitosamente");
            // El listener detectará el cambio de auth y redireccionará al tener el doc listo
        })
        .catch((error) => {
            console.error("Error Registro:", error);
            alert("❌ Error al registrar: " + error.message);
            if (regBtn) regBtn.innerText = "Crear Cuenta Aliado →";
        });
}

function logout() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        auth.signOut().then(() => {
            localStorage.removeItem('netsoUser');
            localStorage.removeItem('currentProjectDocId');
            location.reload();
        }).catch((error) => {
            console.error("Error al cerrar sesión:", error);
            // Forzar limpieza local de todos modos
            localStorage.removeItem('netsoUser');
            location.reload();
        });
    }
}

// ===========================================
// PROFILE DROPDOWN LOGIC
// ===========================================
function toggleProfileMenu() {
    const menu = document.getElementById('profile-dropdown');
    if (menu) menu.classList.toggle('show');
}

function toggleNetsoProfileMenu() {
    const menu = document.getElementById('netso-profile-dropdown');
    if (menu) menu.classList.toggle('show');
}

// Close Dropdown on Click Outside
window.addEventListener('click', function (e) {
    const widget = document.querySelector('.user-profile-widget');
    const menu = document.getElementById('profile-dropdown');

    if (widget && !widget.contains(e.target) && menu && !menu.contains(e.target)) {
        menu.classList.remove('show');
    }
});

function updateProfileUI(userData) {
    // ISP Widgets
    const avatar = document.getElementById('header-avatar');
    const dropdownName = document.getElementById('dropdown-user-name');
    const dropdownRole = document.querySelector('#profile-dropdown span[style*="font-size:11px"]');

    // Netso Widgets (The newly added ones)
    const netsoAvatar = document.getElementById('netso-header-avatar');
    const netsoDropdownName = document.getElementById('netso-dropdown-user-name');
    const netsoDropdownRole = document.getElementById('netso-dropdown-user-role');

    let initials = "US";
    let displayName = "Usuario";
    const roleText = (userData.role === 'netso') ? "Personal Netso" : (userData.company || "Aliado ISP");

    if (userData.name) {
        displayName = userData.name;
        const parts = userData.name.split(' ');
        initials = parts.length > 1
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : parts[0].substring(0, 2).toUpperCase();
    }

    // Update ISP elements
    if (avatar) {
        avatar.innerText = initials;
        avatar.style.backgroundColor = (userData.role === 'netso') ? '#0f172a' : '#10b981';
    }
    if (dropdownName) dropdownName.innerText = displayName;
    if (dropdownRole) dropdownRole.innerText = roleText;

    // Update Netso elements
    if (netsoAvatar) {
        netsoAvatar.innerText = initials;
        netsoAvatar.style.backgroundColor = (userData.role === 'netso') ? '#0f172a' : '#10b981';
    }
    if (netsoDropdownName) netsoDropdownName.innerText = displayName;
    if (netsoDropdownRole) netsoDropdownRole.innerText = roleText;
}

async function handleLogin(explicitRole = null) {
    let email, pass;

    // Determine Role
    // If no explicit role, check which tab is verified active in UI
    const isNetsoActive = document.getElementById('btn-role-netso').classList.contains('active');
    const role = explicitRole || (isNetsoActive ? 'netso' : 'isp');

    if (role === 'netso') {
        const emailInput = document.getElementById('login-netso-user');
        const passInput = document.getElementById('login-netso-pass');
        email = emailInput ? emailInput.value : '';
        pass = passInput ? passInput.value : '';
    } else {
        // ISP / Default
        const emailInput = document.getElementById('login-isp-email');
        const passInput = document.getElementById('login-isp-pass');
        email = emailInput ? emailInput.value : '';
        pass = passInput ? passInput.value : '';
    }

    if (!email || !pass) {
        alert("Por favor completa todos los campos (Email y Contraseña).");
        return;
    }

    // UI Loading State (Optional but good UX)
    const btnId = role === 'netso' ? '#form-netso button' : '#form-isp button';
    const btn = document.querySelector(btnId);
    const originalText = btn ? btn.innerText : 'Ingresar →';
    if (btn) btn.innerText = "⏳ Verificando...";

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, pass);
        const user = userCredential.user;

        console.log("Login success:", user.uid);

        // Cargar datos extra del usuario (Nombre, Company)
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            // EXPLICIT ASSIGNMENT: Firebase user objects don't spread well (getters/non-enumerable)
            currentUser = {
                uid: user.uid,
                email: user.email,
                ...userData
            };
            updateProfileUI(userData);
        } else {
            const fallbackName = user.email ? user.email.split('@')[0] : 'Usuario';
            currentUser = {
                uid: user.uid,
                email: user.email,
                name: fallbackName,
                role: 'isp'
            };
            updateProfileUI({ name: fallbackName, role: 'isp' });
        }

        document.getElementById('login-page').style.display = 'none';

        // REDIRECTION LOGIC
        // Prioritize explicit role from form over stored profile to allow admins to test ISP view
        if (role === 'netso') {
            showNetsoDashboard();
        } else {
            showMainApp();
        }

    } catch (error) {
        console.error("Login error:", error);
        let msg = "Error al iniciar sesión. Inténtalo de nuevo.";

        switch (error.code) {
            case 'auth/wrong-password':
                msg = "Contraseña incorrecta. Verifica tus datos.";
                break;
            case 'auth/user-not-found':
                msg = "El usuario no está registrado.";
                break;
            case 'auth/invalid-email':
                msg = "El formato del correo electrónico no es válido.";
                break;
            case 'auth/invalid-credential':
                msg = "Correo o contraseña incorrectos.";
                break;
            case 'auth/user-disabled':
                msg = "Esta cuenta ha sido deshabilitada. Contacta al soporte.";
                break;
            case 'auth/too-many-requests':
                msg = "Demasiados intentos fallidos. Por favor, intenta más tarde.";
                break;
            case 'auth/network-request-failed':
                msg = "Error de red. Verifica tu conexión a internet.";
                break;
            case 'auth/internal-error':
                msg = "Error interno del servidor. Reintenta en unos momentos.";
                break;
        }

        alert("⚠️ " + msg);
    } finally {
        if (btn) btn.innerText = originalText;
    }
}

function showMainApp() {
    console.log("Ejecutando showMainApp...");
    try {
        const loginPage = document.getElementById('login-page');
        const mainApp = document.getElementById('main-app');
        const netsoDashboard = document.getElementById('netso-dashboard');
        const header = document.querySelector('.header');

        if (loginPage) loginPage.style.display = 'none';
        if (mainApp) mainApp.style.display = 'flex';
        if (netsoDashboard) netsoDashboard.style.display = 'none';
        if (header) header.style.display = 'block';

        // Ocultar todas las páginas excepto la bienvenida (page1)
        document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
        const page1 = document.getElementById('page1');
        if (page1) page1.style.display = 'block';

        // Personalizar bienvenida
        if (currentUser) {
            const nameToDisplay = currentUser.name || currentUser.company || (currentUser.email ? currentUser.email.split('@')[0] : 'Usuario');
            console.log("Personalizando bienvenida para:", nameToDisplay);
            const welcomeTitle = document.querySelector('.main-title');
            if (welcomeTitle) welcomeTitle.innerHTML = `Bienvenido, ${nameToDisplay}`;
        }
    } catch (err) {
        console.error("❌ ERROR en showMainApp:", err);
    }
}

function showNetsoDashboard() {
    console.log("Ejecutando showNetsoDashboard...");
    try {
        const loginPage = document.getElementById('login-page');
        const mainApp = document.getElementById('main-app');
        const netsoDashboard = document.getElementById('netso-dashboard');
        const header = document.querySelector('.header');

        if (loginPage) loginPage.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        if (netsoDashboard) netsoDashboard.style.display = 'block';
        if (header) header.style.display = 'none';

        // Ocultar todas las páginas del wizard
        document.querySelectorAll('.page').forEach(p => {
            if (p.id !== 'netso-dashboard') p.style.display = 'none';
        });

        // Renderizar tabla
        console.log("Llamando a renderDashboardTable...");
        renderDashboardTable();
    } catch (err) {
        console.error("❌ ERROR en showNetsoDashboard:", err);
    }
}

// Carga el catálogo desde data.js (Estático para el Asistente/Auditoría)
async function loadCatalog() {
    console.log("Cargando catálogo estático para el asistente...");
    if (typeof catalogoNetsoData !== 'undefined') {
        catalogoNetso = catalogoNetsoData.categorias;
        populateSelects();

        // Renderizar tabla de inventario si estamos en el dashboard (usa catalogoNetso)
        if (document.getElementById('inventory-table-body')) {
            renderInventoryTable();
        }
    } else {
        console.error("❌ No se encontró catalogoNetsoData en data.js");
    }
}

// La función loadCatalogFromOdoo ha sido eliminada para el wizard 
// ya que se prefiere el catálogo estático simplificado para auditoría.

function populateSelects() {
    if (!catalogoNetso) return;

    // Helper para obtener todos los items de una categoría plana (flatten)
    const getItems = (catKey) => {
        if (!catalogoNetso[catKey]) return [];
        let allItems = [];
        Object.values(catalogoNetso[catKey]).forEach(arr => {
            if (Array.isArray(arr)) allItems = allItems.concat(arr);
        });
        return allItems;
    };

    // Helper para llenar select (si existe estático)
    const fill = (id, items) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="" disabled selected>Seleccione opción...</option>';
        items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item;
            opt.textContent = item;
            sel.appendChild(opt);
        });
    };

    // INTENTAR LLENAR SELECTS ESTÁTICOS SI EXISTEN EN EL HTML
    // (Aunque la mayoría se crean dinámicamente con las tarjetas)

    // Fibra
    fill('fibra-type', getItems('fibra_optica'));

    // Equipos de Abonado (CPE)
    fill('ont-model', getItems('equipos_abonado'));

    // Distribución
    fill('nap-model', getItems('equipos_distribucion'));

    // Empalme
    fill('fusion-model', getItems('equipos_empalme'));

    // RENDERIZAR AYUDAS VISUALES
    renderCatalogHelpers();
}

function renderCatalogHelpers() {
    if (!catalogoNetso) return;

    const sections = [
        { containerId: 'fibra-container', catKey: 'fibra_optica' },
        { containerId: 'dist-container', catKey: 'equipos_distribucion' },
        { containerId: 'empalme-container', catKey: 'equipos_empalme' },
        { containerId: 'conect-container', catKey: 'elementos_conectorizacion' },
        { containerId: 'herrajes-container', catKey: 'herrajes' },
        { containerId: 'herramientas-container', catKey: 'herramientas' },
        // 'ont-container' se maneja dentro de equipos_activos en el catálogo estático
        // Especial para Equipos Activos (no tiene container, usamos el primer select como ancla)
        { elementId: 'olt-status', catKey: 'equipos_activos' }
    ];

    sections.forEach(sec => {
        let anchor = document.getElementById(sec.containerId || sec.elementId);
        if (!anchor) return;

        // Subir al padre .section
        let sectionDiv = anchor.closest('.section');
        if (!sectionDiv) return;

        let title = sectionDiv.querySelector('.section-title');
        if (!title) return;

        // Evitar duplicados
        let existing = sectionDiv.querySelector('.catalog-helper-text');
        if (existing) existing.remove();

        // Obtener items aplanados pero agrupados por subcategoría para ser ordenados
        let helperText = "";
        const catObj = catalogoNetso[sec.catKey];
        if (catObj) {
            const parts = [];
            Object.entries(catObj).forEach(([subKey, items]) => {
                // Limpiar nombre y mostrar items cortos
                // items es array de strings. Tomamos una muestra o formateamos bonito.
                // El usuario quiere ver las opciones.
                // Si son muchos items, puede saturar. Vamos a intentar compactar.
                // Ej: ADSS (12, 24, 48...), Drop (1, 2...)

                // Heurística simple: Si los items tienen prefijo común, lo factorizamos?
                // Mejor simplemente listar todo separado por comas pero pequeño.

                // Formatear subKey: "Fibra_ADSS" -> "Fibra ADSS"
                let niceSub = subKey.replace(/_/g, ' ');
                // Unir items - Limitar a 5 items para no saturar la UI
                const maxItems = 5;
                const itemsToShow = items.slice(0, maxItems);
                const extraCount = items.length - maxItems;

                let itemsStr = itemsToShow.map(i => {
                    // Limpieza de Marcas (NETSO, SUMEC) para el preview de auditoría
                    const cleanName = i.replace(/NETSO|SUMEC/gi, '').replace(/\s+/g, ' ').trim();
                    return `<span style="background:#f1f5f9; padding:2px 4px; border-radius:4px; margin-right:4px; display:inline-block; margin-bottom:2px;">${cleanName}</span>`;
                }).join("");

                if (extraCount > 0) {
                    itemsStr += `<span style="color:#94a3b8; font-style:italic; font-size:10px;">+${extraCount} más...</span>`;
                }

                parts.push(`<div style="margin-bottom:4px;"><strong>${niceSub}:</strong> ${itemsStr}</div>`);
            });
            helperText = parts.join("");
        }

        const helperDiv = document.createElement('div');
        helperDiv.className = 'catalog-helper-text';
        helperDiv.style.fontSize = '11px';
        helperDiv.style.color = '#64748b';
        helperDiv.style.marginTop = '-10px';
        helperDiv.style.marginBottom = '20px';
        helperDiv.style.lineHeight = '1.4';
        helperDiv.style.background = '#fff';
        helperDiv.style.borderLeft = '3px solid #cbd5e1';
        helperDiv.style.padding = '10px';
        helperDiv.innerHTML = helperText;

        // Insertar después del título
        title.insertAdjacentElement('afterend', helperDiv);
    });
}



// Versión Firestore de saveProjectRegistry
function saveProjectRegistry(projectData, isNew = false) {
    // Inyectar UID del usuario actual para asociar el proyecto
    if (currentUser || auth.currentUser) {
        // DEFENSIVE: Firestore rejects 'undefined'. Ensure all fields are null or string.
        projectData.uid = (currentUser && currentUser.uid) || (auth.currentUser ? auth.currentUser.uid : null) || 'anonymous';
        projectData.userEmail = (currentUser && currentUser.email) || (auth.currentUser ? auth.currentUser.email : '') || '';

        // Ensure static contact info is saved with the project
        projectData.contactName = (currentUser && currentUser.name) || (auth.currentUser ? auth.currentUser.displayName : '') || 'Usuario';
        projectData.contactPhone = (currentUser && currentUser.phone) || '';
        projectData.ispName = (currentUser && currentUser.company) || 'ISP Externo';

        // Ensure inputs are saved if not already
        if (!projectData.clients) {
            const censo = document.getElementById('censo');
            projectData.clients = censo ? censo.value : 0;
        }
        if (!projectData.radius) {
            const radius = document.getElementById('coverageRadius');
            projectData.radius = radius ? radius.value : 0;
        }
    }

    if (currentProjectDocId && !isNew) {
        // ACTUALIZAR proyecto existente
        db.collection("projects").doc(currentProjectDocId).set(projectData, { merge: true })
            .then(() => {
                console.log("Proyecto actualizado: ", currentProjectDocId);
            })
            .catch((error) => {
                console.error("Error al actualizar proyecto: ", error);
            });
    } else {
        // CREAR nuevo proyecto
        db.collection("projects").add(projectData)
            .then((docRef) => {
                console.log("Nuevo proyecto registrado con ID: ", docRef.id);
                currentProjectDocId = docRef.id;
                localStorage.setItem('currentProjectDocId', currentProjectDocId);
            })
            .catch((error) => {
                console.error("Error al registrar proyecto: ", error);
                alert("Error al guardar en la nube: " + error.message);
            });
    }
}

// ISP HISTORY FUNCTIONS
let isHistoryView = false;
function toggleIspHistory() {
    isHistoryView = !isHistoryView;
    const historyView = document.getElementById('isp-history-view');
    const wizardPages = document.querySelectorAll('.page');
    // const header = document.querySelector('.header'); // Mantener header visible

    if (isHistoryView) {
        // Mostrar historial
        historyView.style.display = 'block';
        wizardPages.forEach(p => p.style.display = 'none');
        document.getElementById('step-label').innerText = 'Historial de Proyectos';

        // OCULTAR BARRA DE PROGRESO EN HISTORIAL
        const progressBar = document.querySelector('.progress-bar');
        if (progressBar) progressBar.style.display = 'none';

        renderIspHistoryTable();
    } else {
        // Mostrar wizard (volver a donde estaba o inicio)
        historyView.style.display = 'none';

        // MOSTRAR BARRA DE PROGRESO AL VOLVER AL WIZARD
        const progressBar = document.querySelector('.progress-bar');
        if (progressBar) progressBar.style.display = 'flex';

        // Restaurar página activa (simple approach: page1 or last saved step logic could vary)
        document.getElementById('page1').style.display = 'block';
        document.getElementById('step-label').innerText = 'Introducción';
        // En un caso real restauraríamos el paso exacto, pero por ahora volver al inicio está bien.
    }
}

// SEPARATE FETCH AND RENDER FOR SEARCH
function renderIspHistoryTable() {
    const tbody = document.getElementById('isp-history-body');
    const uid = auth.currentUser ? auth.currentUser.uid : null;

    if (!uid) return;

    // UI Loading
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 30px;">⏳ Cargando tus proyectos...</td></tr>`;

    // Reset Search
    const searchInput = document.getElementById('project-history-search');
    if (searchInput) searchInput.value = '';

    fetchProjectHistory(uid);
}

function fetchProjectHistory(uid) {
    db.collection("projects")
        .where("uid", "==", uid)
        .get()
        .then((querySnapshot) => {
            let projects = [];
            querySnapshot.forEach((doc) => {
                projects.push({ id: doc.id, ...doc.data() });
            });

            // Ordenar por fecha desc
            projects.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Cache for filtering
            allProjectsCache = projects;

            renderProjectRows(projects);
        })
        .catch((error) => {
            console.error("Error loading history:", error);
            const tbody = document.getElementById('isp-history-body');
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: red;">Error al cargar historial.</td></tr>`;
        });
}

function filterHistory() {
    const searchInput = document.getElementById('project-history-search');
    const term = searchInput.value.toLowerCase();

    if (!allProjectsCache || allProjectsCache.length === 0) return;

    if (!term) {
        renderProjectRows(allProjectsCache);
        return;
    }

    const filtered = allProjectsCache.filter(p => {
        const pName = (p.projectName || '').toLowerCase();
        return pName.includes(term);
    });

    renderProjectRows(filtered);
}

function renderProjectRows(projects) {
    const tbody = document.getElementById('isp-history-body');

    if (projects.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">📭 No se encontraron proyectos.</td></tr>`;
        return;
    }

    tbody.innerHTML = projects.map(p => {
        let statusBadge = '';
        // "COTIZACIÓN O ANÁLISIS IA" column logic
        if (p.type === 'direct') {
            statusBadge = '<span class="status-badge" style="background:#e0f2fe; color:#0369a1; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700;">COTIZACIÓN DIRECTA</span>';
        } else {
            statusBadge = p.status === 'completed'
                ? '<span class="status-badge status-completed" style="background:#dcfce7; color:#15803d; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700;">ANÁLISIS COMPLETADO</span>'
                : '<span class="status-badge status-active" style="padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700;">EN PROCESO</span>';
        }

        const dateObj = new Date(p.date);
        const dateStr = dateObj.toLocaleDateString();

        // "DESCARGABLES" column logic (Explicit Names)
        let downloadBtn = '';
        if (p.type === 'direct' && p.quoteItems) {
            downloadBtn = `
                <button onclick="downloadDirectQuoteFromHistory('${p.id}')" class="btn-secondary download-btn-excel" title="Descargar Cotización">
                    📊 Excel
                </button>
            `;
        } else if (p.reportData && p.reportData.length > 0) {
            // Updated Buttons for Engineering Reports
            downloadBtn = `
                <div class="history-actions-cell">
                    <button onclick="downloadSavedReport('${p.id}')" class="btn-secondary download-btn-excel" title="Descargar Excel">
                        📊 Excel
                    </button>
                    <button onclick="downloadPdfReport('${p.id}')" class="btn-secondary download-btn-pdf" title="Descargar PDF">
                        📄 PDF
                    </button>
                </div>
            `;
        } else {
            downloadBtn = `<span style="font-size: 12px; color: #94a3b8; font-style:italic;">En borrador</span>`;
        }

        return `
            <tr class="row-even">
                <td style="font-weight: 700; color: #334155;">${p.projectName || 'Sin Nombre'}</td>
                <td style="color: #64748b; font-size: 13px;">${dateStr}</td>
                <td>${statusBadge}</td>
                <td>${downloadBtn}</td>
            </tr>
        `;
    }).join('');
}
function findProjectByISP(ispName) {
    const projects = JSON.parse(localStorage.getItem('netso_projects') || '[]');
    return projects.find(p => p.ispName === ispName && p.status === 'active');
}

function renderDashboardTable() {
    const tbody = document.getElementById('projects-table-body');
    const loadingHtml = `
        <tr>
            <td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">
                ⏳ Cargando proyectos en tiempo real...
            </td>
        </tr>
    `;
    tbody.innerHTML = loadingHtml;

    // Listener en tiempo real de Firestore
    db.collection("projects").orderBy("date", "desc")
        .onSnapshot((querySnapshot) => {
            const projects = [];
            querySnapshot.forEach((doc) => {
                projects.push({ id: doc.id, ...doc.data() });
            });

            // Actualizar caché para descargas
            allProjectsCache = projects;

            if (projects.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 40px; color: #94a3b8;">
                            📭 No hay proyectos registrados aún.
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = projects.map(p => {
                // Formatear fecha con hora
                const dateObj = new Date(p.date);
                const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                // Descargables (Nombres)
                let downloadablesHtml = '<span style="color: #cbd5e1; font-size: 11px;">Pendiente</span>';
                if (p.type === 'direct' && p.quoteItems) {
                    downloadablesHtml = `<button onclick="downloadDirectQuoteFromHistory('${p.id}')" class="btn-secondary" title="Descargar Excel" style="padding: 4px 8px; font-size: 14px; background-color: #10b981; border-color: #059669; color: white;">📊 Excel</button>`;
                } else if (p.reportData && p.reportData.length > 0) {
                    downloadablesHtml = `
                        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px;">
                            <a href="#" onclick="downloadSavedReport('${p.id}'); return false;" style="color: #0ea5e9; text-decoration: none; font-weight: 600;">📥 Reporte de Compras</a>
                            <a href="#" onclick="downloadPdfReport('${p.id}'); return false;" style="color: #ef4444; text-decoration: none; font-weight: 600;">📄 Propuesta PDF</a>
                            <!-- KMZ placeholder if logic existed, but based on current code only xls/pdf are saved logic dependent -->
                            <a href="#" onclick="generarKMZ('${p.id}'); return false;" style="color: #10b981; text-decoration: none; font-weight: 600;">🌐 Archivo KMZ</a>
                        </div>
                    `;
                }

                return `
                <tr>
                    <td>
                        <div style="font-weight: 700; color: var(--netso-dark);">${p.ispName || 'Desconocido'}</div>
                    </td>
                    <td>
                        <div style="font-weight: 600;">${p.projectName || 'Sin nombre'}</div>
                        <div style="font-size: 11px; color: #64748b;">ID: ${p.id.substring(0, 8)}</div>
                    </td>
                    <td style="font-size: 13px;">${dateStr}</td>
                    <td>
                        ${downloadablesHtml}
                    </td>
                    <td>
                        <div style="font-weight: 600; color: #475569;">${p.contactName || '--'}</div>
                        <div style="font-size: 11px; color: #64748b;">${p.contactPhone || ''}</div>
                    </td>
                    <td>
                        <button onclick="consultProjectStock('${p.id}')" class="btn-secondary" style="width: 100%; padding: 8px 12px; font-size: 13px; background-color: #0ea5e9; border-color: #0284c7; color: white; font-weight: 700;">
                            Consultar
                        </button>
                    </td>
                </tr>
            `}).join('');

        }, (error) => {
            console.error("Error al obtener proyectos: ", error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #ef4444;">
                        ❌ Error de conexión con la base de datos.
                    </td>
                </tr>
            `;
        });
}

async function consultProjectStock(projectId) {
    console.log("Iniciando consulta de stock real para proyecto:", projectId);

    switchDashTab('stock-inquiry');

    const titleEl = document.getElementById('inquiry-project-name');
    const tbody = document.getElementById('stock-inquiry-body');

    if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #94a3b8;">⌛ Consultando disponibilidad en tiempo real...</td></tr>';

    try {
        const project = allProjectsCache.find(p => p.id === projectId);
        if (!project) throw new Error("Proyecto no encontrado en caché.");

        if (titleEl) titleEl.innerText = `Proyecto: ${project.projectName || project.id} (${project.ispName})`;

        // Usar todos los productos del reporte
        const reportData = (project.reportData || []).map(item => ({
            ...item,
            name: item.item || item.name
        }));

        if (reportData.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #64748b;">⚠️ Este proyecto no tiene datos de ingeniería registrados.</td></tr>';
            return;
        }

        // Asegurar catálogo Odoo cargado para matching (Fuzzy logic)
        if (allOdooProducts.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #94a3b8;">⌛ Sincronizando catálogo maestro de Odoo...</td></tr>';
            await fetchOdooProducts(true);
        }

        // Realizar Matching robusto (Igual que en Ingeniería)
        const matchedItems = reportData.map(item => {
            const searchName = item.name.toLowerCase();
            const exactMappedName = PRODUCT_MAPPING[item.name];
            let bestMatch = null;

            if (exactMappedName) {
                bestMatch = allOdooProducts.find(p =>
                    (p.display_name && p.display_name === exactMappedName) ||
                    (p.name === exactMappedName)
                );
            }

            if (!bestMatch) {
                bestMatch = allOdooProducts.find(p => {
                    const pName = (p.display_name || p.name || "").toLowerCase();
                    const searchLower = searchName.toLowerCase();
                    return pName.includes(searchLower) || searchLower.includes(pName);
                });
            }

            return { ...item, odooMatch: bestMatch };
        });

        // Obtener IDs de productos vinculados
        const productIds = matchedItems.filter(i => i.odooMatch).map(i => i.odooMatch.id);

        let stockMap = {};
        if (productIds.length > 0) {
            // 1. Consultar Stock Real (On Hand)
            const stockData = await odooCall('stock.quant', 'search_read', [[
                ['product_id', 'in', productIds],
                ['location_id.usage', '=', 'internal']
            ]], {
                fields: ['product_id', 'location_id', 'quantity', 'reserved_quantity']
            });

            // 2. Consultar Stock Entrante (Incoming)
            const inDomain = [
                ['product_id', 'in', productIds],
                ['state', 'in', ['confirmed', 'assigned', 'partially_available', 'waiting']],
                ['location_dest_id.usage', '=', 'internal'],
                ['location_id.usage', '!=', 'internal']
            ];
            const inData = await odooCall('stock.move', 'search_read', [inDomain], {
                fields: ['product_id', 'location_dest_id', 'product_uom_qty']
            });

            // Procesar Quants
            stockData.forEach(q => {
                const pid = q.product_id[0];
                const locName = q.location_id[1];
                const avail = q.quantity - q.reserved_quantity;

                if (!stockMap[pid]) stockMap[pid] = { total: 0, incoming: 0, locations: {}, incomingLocs: {} };
                stockMap[pid].total += avail;
                stockMap[pid].locations[locName] = (stockMap[pid].locations[locName] || 0) + avail;
            });

            // Procesar Incoming
            inData.forEach(m => {
                const pid = m.product_id[0];
                const inLocName = m.location_dest_id[1];
                if (!stockMap[pid]) stockMap[pid] = { total: 0, incoming: 0, locations: {}, incomingLocs: {} };
                stockMap[pid].incoming += m.product_uom_qty;
                stockMap[pid].incomingLocs[inLocName] = (stockMap[pid].incomingLocs[inLocName] || 0) + m.product_uom_qty;
            });
        }

        if (tbody) {
            tbody.innerHTML = matchedItems.map(item => {
                const odooMatch = item.odooMatch;
                const pid = odooMatch ? odooMatch.id : null;
                const stockInfo = pid ? stockMap[pid] : null;
                const required = parseFloat(item.cantidad || item.needed || 0);
                const ref = odooMatch ? (odooMatch.default_code || 'S/R') : '--';

                let locationsHtml = '<span style="color: #94a3b8; font-style: italic;">Sin disponibilidad interna</span>';
                if (stockInfo && stockInfo.total > 0) {
                    locationsHtml = Object.entries(stockInfo.locations)
                        .filter(([_, qty]) => qty > 0)
                        .map(([name, qty]) => {
                            let shortLoc = name.replace('LEC/Existencias', 'LECHERIA')
                                .replace('CCS/Existencias', 'CARACAS')
                                .replace('Urbin/Existencias', 'URBINA');

                            if (shortLoc.includes('/')) {
                                const parts = shortLoc.split('/');
                                // If it contains Existencias at the end, get the part before it
                                if (parts[parts.length - 1] === 'Existencias' && parts.length > 1) {
                                    shortLoc = parts[parts.length - 2];
                                } else {
                                    shortLoc = parts.pop().replace('Stock', '').trim();
                                }
                            }

                            return `<div style="display:flex; justify-content:space-between; margin-bottom:2px; border-bottom:1px dashed #e2e8f0; padding-bottom:2px;">
                                <span style="font-weight:600; color:#475569;">${shortLoc}:</span>
                                <span style="font-weight:700; color:#0f172a;">${Math.floor(qty)}</span>
                            </div>`;
                        }).join('');
                }
                const totalStock = stockInfo ? Math.floor(stockInfo.total) : 0;
                const incomingStock = stockInfo ? Math.floor(stockInfo.incoming) : 0;
                const hasEnough = totalStock >= required;
                const stockStyle = hasEnough ? 'background: #dcfce7; color: #166534;' : (totalStock > 0 ? 'background: #fef9c3; color: #854d0e;' : 'background: #fee2e2; color: #991b1b;');

                return `
                    <tr>
                        <td style="font-family: monospace; font-size: 11px; color: #64748b; vertical-align: top;">${ref}</td>
                        <td style="max-width: 300px; vertical-align: top;">
                            <div style="font-weight: 700; color: #1e293b; font-size: 13px;">${item.name}</div>
                            ${odooMatch ? `<div style="font-size: 10px; color: #10b981; font-weight: 600;">Odoo: ${odooMatch.name}</div>` : `<div style="font-size: 10px; color: #ef4444; font-weight: 800;">⚠️ SIN VINCULACIÓN ODOO</div>`}
                        </td>
                        <td style="text-align: center; font-weight: 700; color: #3b82f6; font-size: 1.1rem; vertical-align: top;">${required}</td>
                        <td style="font-size: 11px; line-height: 1.4; min-width: 140px; vertical-align: top;">
                            ${locationsHtml}
                            ${incomingStock > 0 ? `
                                <div style="margin-top: 6px; display: flex; justify-content: flex-start;">
                                    <span onclick="showIncomingStockDetails('${item.name.replace(/'/g, "\\'")}', ${JSON.stringify(stockInfo.incomingLocs).replace(/"/g, '&quot;')})" 
                                        style="background: #ecfdf5; color: #059669; border: 1px solid #6ee7b7; padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 700; display:flex; align-items:center; gap:2px; cursor:pointer; transition:all 0.2s;" 
                                        onmouseover="this.style.background='#d1fae5'" onmouseout="this.style.background='#ecfdf5'"
                                        title="Click para ver almacenes de llegada">
                                        📥 ${incomingStock} Esperado
                                    </span>
                                </div>
                            ` : ''}
                        </td>
                    </tr>
                `;
            }).join('');
        }

    } catch (error) {
        console.error("Error en consultProjectStock:", error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 40px; color: #ef4444;">❌ Error al cargar stock real: ${error.message}</td></tr>`;
    }
}

function generateSelectOptions(categoryKey, categoryNameId = null) {
    if (!catalogoNetso) return '<option>Cargando catálogo...</option>';

    const category = catalogoNetso[categoryKey];
    if (!category) return '';

    let html = '';

    // Si pasamos un ID de categoría específico del JSON (para casos donde la función pedía algo específico)
    // Pero por generalidad iteraremos las subcategorías

    for (const [subCatKey, items] of Object.entries(category)) {
        // Formatear nombre bonito (ej: Cajas_NAP -> Cajas NAP)
        const label = subCatKey.replace(/_/g, ' ');

        // Iconos opcionales según palabra clave (simple mejora visual)
        let icon = '🔹';
        if (label.includes('ADSS')) icon = '🔸';
        if (label.includes('Drop')) icon = '🏠';
        if (label.includes('NAP')) icon = '📦';
        if (label.includes('Empalme') || label.includes('Manga')) icon = '🔧';

        html += `<optgroup label="${icon} ${label}">`;
        items.forEach(item => {
            html += `<option value="${item}">${item}</option>`;
        });
        html += `</optgroup>`;
    }
    return html;
}

// ============================================
// GESTIÓN DE CONFIGURACIÓN Y PERSISTENCIA
// ============================================

function toggleSettings() {
    const modal = document.getElementById('settingsModal');
    const input = document.getElementById('apiKeyInput');

    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
        input.value = googleApiKey || '';
    }
}

function saveSettings() {
    const input = document.getElementById('apiKeyInput');
    const key = input.value.trim();

    if (key) {
        if (!key.startsWith('AIza')) {
            alert('⚠️ Esa no parece una API Key de Google válida.\n\nLas API Keys de Google suelen empezar con "AIza".\n\nAsegúrate de estar copiando el texto correcto ("API key") y no el "Client ID" o "Project ID".');
            return;
        }
        localStorage.setItem('googleApiKey', key);
        googleApiKey = key;
        alert('✅ Configuración guardada correctamente');
        toggleSettings();
    } else {
        alert('⚠️ Por favor ingresa una API Key válida');
    }
}

function saveProjectState() {
    const state = {
        projectName: document.getElementById('projectName').value,
        cards: document.querySelector('.page.content').innerHTML, // Esto es muy agresivo y problemático para inputs dinámicos
        // Mejor enfoque: Guardar solo valores clave y contadores
        counters: { fibraCount, distCount, empalmeCount, conectCount, ontCount, herrajeCount, herramientaCount },
        // Para inputs dinámicos, lo ideal sería recorrerlos, pero para MVP "Beginner":
        // Vamos a guardar los valores de los inputs fijos
        inputs: {
            censo: document.getElementById('censo').value,
            coverageRadius: document.getElementById('coverageRadius').value,
            oltStatus: document.getElementById('olt-status').value,
            // ... otros fijos
        }
    };
    // NOTA: Para una persistencia REAL de tarjetas dinámicas, se requiere re-crearlas desde datos.
    // Dado que el usuario pidió "Principiante", haremos algo simple primero:
    // Guardar solo los inputs fijos por ahora y avisar.

    // GUARDAR ESTADO DE ANÁLISIS IA (Sugerencias)
    if (window.currentAnalysisImages && window.currentAnalysisImages.length > 0) {
        state.analysisImages = window.currentAnalysisImages;
    }

    localStorage.setItem('netsoProjectState', JSON.stringify(state));
}

function loadProjectState() {
    const saved = localStorage.getItem('netsoProjectState');
    if (!saved) return;

    try {
        const state = JSON.parse(saved);
        if (state.inputs) {
            if (document.getElementById('projectName')) document.getElementById('projectName').value = state.inputs.projectName || '';
            if (document.getElementById('censo')) document.getElementById('censo').value = state.inputs.censo || '';
            // Restaurar otros...
        }

        // RESTAURAR ESTADO DE ANÁLISIS IA
        if (state.analysisImages && Array.isArray(state.analysisImages)) {
            window.currentAnalysisImages = state.analysisImages;
            // Opcional: Podríamos restaurar la vista previa en el paso 3, 
            // pero lo crítico es que las sugerencias estén disponibles para el paso 4.
        }

    } catch (e) { console.error("Error loading state", e); }
}

window.nextPage = function (n) {
    // 1. Hide all pages
    const pages = document.querySelectorAll('.page');
    pages.forEach(p => p.style.display = 'none');

    // Hide special pages too
    const directQuote = document.getElementById('page-direct-quote');
    if (directQuote) directQuote.style.display = 'none';

    const loginPage = document.getElementById('login-page');
    if (loginPage) loginPage.style.display = 'none';

    // 2. Show target page
    const target = document.getElementById('page' + n);
    if (target) {
        target.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Update progress dots and labels if they exist
        const label = document.getElementById('step-label');
        if (label) {
            const labels = {
                1: 'Introducción',
                2: 'Auditoría de Inventario',
                3: 'Análisis de Campo',
                4: 'Resultados de Ingeniería',
                5: 'Arquitectura Sugerida'
            };
            label.innerText = labels[n] || 'Diseño';
        }

        const dots = ['dot1', 'dot2', 'dot3', 'dot4', 'dot5'];
        dots.forEach((id, idx) => {
            const dot = document.getElementById(id);
            if (dot) {
                if (idx < n) dot.classList.add('active');
                else dot.classList.remove('active');
            }
        });

        if (n === 2 && fibraCount === 0) addFibraCard();

        // Si vamos a la página 4 (Resultados), asegurar que se renderizan las sugerencias IA
        if (n === 4 && typeof renderProjectAiSuggestions === 'function') {
            setTimeout(renderProjectAiSuggestions, 100); // Pequeño delay para asegurar DOM
        }
    } else {
        console.error(`❌ Page "page${n}" not found in DOM.`);
        alert(`Error de navegación: No se encuentra la pantalla #${n}`);
    }
};

function addFibraCard() {
    fibraCount++;
    const container = document.getElementById('fibra-container');
    const card = document.createElement('div');
    card.className = 'fibra-card';
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <label style="font-size:10px; font-weight:800; color:var(--netso-green); letter-spacing:0.5px;">CABLE DE FIBRA #${fibraCount}</label>
            <span onclick="this.parentElement.parentElement.remove()" style="cursor:pointer; color:#ef4444; font-size:20px; font-weight:700; line-height:1; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">×</span>
        </div>
        <select class="input-field" style="font-size:13px; margin-bottom:10px;">
            ${generateSelectOptions('fibra_optica')}
        </select>
        <input type="number" placeholder="Kilómetros en stock" class="input-field fibra-val" value="0" min="0" step="0.1">
    `;
    container.appendChild(card);
}

function addDistCard() {
    distCount++;
    const container = document.getElementById('dist-container');
    const card = document.createElement('div');
    card.className = 'fibra-card';
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <label style="font-size:10px; font-weight:800; color:var(--netso-green); letter-spacing:0.5px;">EQUIPO DISTRIBUCIÓN #${distCount}</label>
            <span onclick="this.parentElement.parentElement.remove()" style="cursor:pointer; color:#ef4444; font-size:20px; font-weight:700; line-height:1; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">×</span>
        </div>
        <select class="input-field" style="font-size:13px; margin-bottom:10px;">
            ${generateSelectOptions('equipos_distribucion')}
        </select>
        <input type="number" placeholder="Unidades en stock" class="input-field dist-val" value="0" min="0">
    `;
    container.appendChild(card);
}

function addEmpalmeCard() {
    empalmeCount++;
    const container = document.getElementById('empalme-container');
    const card = document.createElement('div');
    card.className = 'fibra-card';
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <label style="font-size:10px; font-weight:800; color:var(--netso-green); letter-spacing:0.5px;">EQUIPO EMPALME #${empalmeCount}</label>
            <span onclick="this.parentElement.parentElement.remove()" style="cursor:pointer; color:#ef4444; font-size:20px; font-weight:700; line-height:1; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">×</span>
        </div>
        <select class="input-field" style="font-size:13px; margin-bottom:10px;">
            ${generateSelectOptions('equipos_empalme')}
        </select>
        <input type="number" placeholder="Unidades en stock" class="input-field emp-val" value="0" min="0">
    `;
    container.appendChild(card);
}

function addConectCard() {
    conectCount++;
    const container = document.getElementById('conect-container');
    const card = document.createElement('div');
    card.className = 'fibra-card';
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <label style="font-size:10px; font-weight:800; color:var(--netso-green); letter-spacing:0.5px;">COMPONENTE #${conectCount}</label>
            <span onclick="this.parentElement.parentElement.remove()" style="cursor:pointer; color:#ef4444; font-size:20px; font-weight:700; line-height:1; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">×</span>
        </div>
        <select class="input-field" style="font-size:12px; margin-bottom:10px;">
            ${generateSelectOptions('elementos_conectorizacion')}
        </select>
        <input type="number" placeholder="Unidades en stock" class="input-field conect-val" value="0" min="0">
    `;
    container.appendChild(card);
}

function addOntCard() {
    ontCount++;
    const container = document.getElementById('ont-container');
    const card = document.createElement('div');
    card.className = 'fibra-card';

    // Lógica para obtener ONTs/CPE desde el catálogo estático
    let options = '<option>Cargando...</option>';
    if (catalogoNetso && catalogoNetso.equipos_activos) {
        const items = catalogoNetso.equipos_activos.ONT_ONU_Router;
        if (items) {
            options = items.map(item => `<option value="${item}">${item}</option>`).join('');
        }
    }
    // Si no lo encuentra, intentar por la categoría genérica
    if (options.includes('Cargando')) {
        options = generateSelectOptions('equipos_abonado');
    }

    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <label style="font-size:10px; font-weight:800; color:var(--netso-green); letter-spacing:0.5px;">EQUIPO CPE #${ontCount}</label>
            <span onclick="this.parentElement.parentElement.remove()" style="cursor:pointer; color:#ef4444; font-size:20px; font-weight:700; line-height:1; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">×</span>
        </div>
        <select class="input-field" style="font-size:13px; margin-bottom:10px;">
            ${options}
        </select>
        <input type="number" placeholder="Unidades en stock" class="input-field ont-val" value="0" min="0">
    `;
    container.appendChild(card);
}

function addHerrajeCard() {
    herrajeCount++;
    const container = document.getElementById('herrajes-container');
    const card = document.createElement('div');
    card.className = 'fibra-card';
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <label style="font-size:10px; font-weight:800; color:var(--netso-green); letter-spacing:0.5px;">HERRAJE #${herrajeCount}</label>
            <span onclick="this.parentElement.parentElement.remove()" style="cursor:pointer; color:#ef4444; font-size:20px; font-weight:700; line-height:1; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">×</span>
        </div>
        <select class="input-field" style="font-size:12px; margin-bottom:10px;">
            ${generateSelectOptions('herrajes')}
        </select>
        <input type="number" placeholder="Unidades en stock" class="input-field herraje-val" value="0" min="0">
    `;
    container.appendChild(card);
}

function addHerramientaCard() {
    herramientaCount++;
    const container = document.getElementById('herramientas-container');
    const card = document.createElement('div');
    card.className = 'fibra-card';
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <label style="font-size:10px; font-weight:800; color:var(--netso-green); letter-spacing:0.5px;">HERRAMIENTA #${herramientaCount}</label>
            <span onclick="this.parentElement.parentElement.remove()" style="cursor:pointer; color:#ef4444; font-size:20px; font-weight:700; line-height:1; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">×</span>
        </div>
        <select class="input-field" style="font-size:12px; margin-bottom:10px;">
            ${generateSelectOptions('herramientas')}
        </select>
        <input type="number" placeholder="Unidades en stock" class="input-field herramienta-val" value="0" min="0">
    `;
    container.appendChild(card);
}

function noPoseoFibra() {
    document.getElementById('fibra-container').innerHTML = `
        <div style="text-align:center; color:#64748b; font-size:12px; margin-bottom:16px; padding:20px; background:white; border-radius:16px; border:2px dashed #cbd5e1;">
            ⚠️ Sin Stock de Fibra Registrado
        </div>
    `;
    fibraCount = 0;
}

function updateRadiusDisplay(v) {
    document.getElementById('radiusValueDisplay').innerText = v + " m";
}

// ============================================
// FUNCIONES DE ANÁLISIS DE IMAGEN CON AI
// ============================================

async function testAPIKey() {
    // Validar que se haya configurado la API key
    if (!googleApiKey) {
        toggleSettings();
        return;
    }

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Probando...';
    btn.disabled = true;

    try {
        // Hacer una petición simple para verificar la API key
        // Usamos gemini-flash-latest
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${googleApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: "Responde solo: OK"
                    }]
                }]
            })
        });

        if (response.ok) {
            btn.innerHTML = '✅ Conexión Exitosa';
            btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            btn.style.color = 'white';
            btn.style.borderColor = '#10b981';

            alert('✅ ¡PERFECTO!\n\nTu API key está correctamente configurada y funcionando.\n\nYa puedes subir imágenes para analizar.');

            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = 'white';
                btn.style.color = '#a16207';
                btn.style.borderColor = '#fde047';
            }, 3000);
        } else if (response.status === 404) {
            throw new Error('API_NOT_ENABLED');
        } else if (response.status === 400) {
            throw new Error('INVALID_KEY');
        } else if (response.status === 403) {
            throw new Error('ACCESS_DENIED');
        } else {
            throw new Error('UNKNOWN_ERROR');
        }

    } catch (error) {
        btn.innerHTML = '❌ Error';
        btn.style.background = '#fee';
        btn.style.borderColor = '#ef4444';
        btn.style.color = '#dc2626';

        let errorMsg = '❌ ERROR DE CONEXIÓN\n\n';

        if (error.message === 'API_NOT_ENABLED') {
            errorMsg += '🔴 LA API NO ESTÁ HABILITADA\n\n';
            errorMsg += 'SOLUCIÓN:\n';
            errorMsg += '1. Ve a este enlace:\n';
            errorMsg += '   https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com\n\n';
            errorMsg += '2. ⚠️ MIRA ARRIBA A LA IZQUIERDA: Asegúrate de que está seleccionado el proyecto correcto (donde creaste la Key).\n\n';
            errorMsg += '3. Haz clic en el botón "ENABLE" (Habilitar)\n\n';
            errorMsg += '4. Espera 1-2 minutos y vuelve a probar\n';
        } else if (error.message === 'INVALID_KEY') {
            errorMsg += '🔴 API KEY INVÁLIDA\n\n';
            errorMsg += 'Tu API key no es correcta. Verifica:\n';
            errorMsg += '1. Que hayas copiado la key completa\n';
            errorMsg += '2. Que no tenga espacios al inicio o final\n';
            errorMsg += '3. Que sea de Google AI Studio (no de otro servicio)\n\n';
            errorMsg += 'Genera una nueva en:\n';
            errorMsg += 'https://aistudio.google.com/app/apikey';
        } else if (error.message === 'ACCESS_DENIED') {
            errorMsg += '🔴 ACCESO DENEGADO\n\n';
            errorMsg += 'La API key no tiene permisos. Verifica:\n';
            errorMsg += '1. Que la API esté habilitada\n';
            errorMsg += '2. Que no haya restricciones de IP/dominio';
        } else {
            errorMsg += 'Error: ' + error.message + '\n\n';
            errorMsg += 'Verifica:\n';
            errorMsg += '1. Tu conexión a internet\n';
            errorMsg += '2. Que la API key sea correcta\n';
            errorMsg += '3. Que la API esté habilitada en Google Cloud';
        }

        alert(errorMsg);

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = 'white';
            btn.style.color = '#a16207';
            btn.style.borderColor = '#fde047';
        }, 3000);
    } finally {
        btn.disabled = false;
    }
}

async function analyzeImage() {
    // Validar que haya imágenes pendientes
    if (pendingImages.length === 0) {
        alert('⚠️ Por favor agrega al menos una imagen antes de analizar.');
        return;
    }

    // Validar API Key
    if (!googleApiKey) {
        toggleSettings();
        return;
    }

    // UI Updates
    document.getElementById('loadingAnalysis').style.display = 'block';
    document.getElementById('analyzeBtn').disabled = true;
    document.getElementById('analyzeBtn').style.opacity = '0.5';
    document.getElementById('analysisResult').style.display = 'block';

    // Contenedor de resultados acumulados (solo visualmente limpiar si es la primera vez del lote, 
    // pero idealmente queremos acumular si el usuario analiza en tandas. 
    // Para simplificar: Limpiamos texto anterior si es un "nuevo análisis" total, 
    // pero aquí permitiremos acumular en el UI también.)

    const analysisTextContainer = document.getElementById('analysisText');
    if (pendingImages.length > 0) analysisTextContainer.innerHTML = ""; // Limpiar previo para este lote

    try {
        let successCount = 0;

        // PROCESAR CADA IMAGEN PENDIENTE
        for (let i = 0; i < pendingImages.length; i++) {
            const base64Img = pendingImages[i];

            // Actualizar UI de progreso
            document.querySelector('#loadingAnalysis div:nth-child(2)').innerText = `Analizando imagen ${i + 1} de ${pendingImages.length}...`;

            try {
                const analysis = await callGeminiAPI(base64Img);

                // SEPARAR TEXTO Y JSON (Misma lógica que Direct Quote PERO MEJORADA)
                let markdownText = analysis;
                let jsonSuggestions = [];

                // 1. Intentar buscar bloque de código ```json ... ```
                let jsonMatch = analysis.match(/```json\s*([\s\S]*?)\s*```/);

                // 2. Si no encuentra, buscar bloque genérico ``` ... ``` que parezca array
                if (!jsonMatch) {
                    jsonMatch = analysis.match(/```\s*(\[\s*\{[\s\S]*\}\s*\])\s*```/);
                }

                // 3. Last resort: Buscar array explícito [ { ... } ] en el texto crudo
                if (!jsonMatch) {
                    const rawMatch = analysis.match(/(\[\s*\{[\s\S]*\}\s*\])/);
                    if (rawMatch) {
                        jsonMatch = [rawMatch[0], rawMatch[1]]; // Simular estructura de match
                    }
                }

                if (jsonMatch && jsonMatch[1]) {
                    try {
                        jsonSuggestions = JSON.parse(jsonMatch[1]);
                        // Eliminar el JSON del texto visible para que no se vea feo
                        // Solo si es un bloque grande, si es inline a veces mejor dejarlo, 
                        // pero por clean UX intentamos quitarlo.
                        markdownText = analysis.replace(jsonMatch[0], "").trim();
                    } catch (e) {
                        console.error("Error parsing JSON suggestions:", e);
                    }
                }

                // Guardar éxito
                currentAnalysisImages.push({
                    data: base64Img,
                    detections: markdownText,
                    suggestions: jsonSuggestions
                });

                // Mostrar resultado parcial en UI
                const resultBlock = document.createElement('div');
                resultBlock.style.marginBottom = "20px";
                resultBlock.style.borderBottom = "1px solid #e2e8f0";
                resultBlock.style.paddingBottom = "15px";

                resultBlock.innerHTML = `
                    <div style="font-weight:bold; color:#0f172a; margin-bottom:5px;">Imagen ${currentAnalysisImages.length}:</div>
                    <img src="${base64Img}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; margin-bottom: 10px; display: block;">
                    <div>${formatMarkdown(markdownText)}</div>
                `;
                analysisTextContainer.appendChild(resultBlock);
                successCount++;

            } catch (err) {
                console.error("Error analizando imagen individual:", err);
                analysisTextContainer.innerHTML += `<div style="color:red; margin-bottom:15px;">Error en imagen ${i + 1}: ${err.message}</div>`;
            }
        }

        // Limpiar cola de pendientes
        pendingImages = [];
        renderPendingImages();

    } catch (globalError) {
        console.error("Error global en análisis:", globalError);
        alert('Error en el proceso de análisis.');
    } finally {
        document.getElementById('loadingAnalysis').style.display = 'none';
        document.getElementById('analyzeBtn').disabled = false;
        document.getElementById('analyzeBtn').style.opacity = '1';

        // Restaurar texto de carga
        document.querySelector('#loadingAnalysis div:nth-child(2)').innerText = `Analizando imagen...`;
    }
}


// ============================================
// AI SUGGESTIONS FOR DIRECT QUOTER
// ============================================

let pendingDirectImages = [];
let currentDirectAnalysisImages = [];

function handleDirectImageUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Convert to Array
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Str = e.target.result; // Data URL
            pendingDirectImages.push(base64Str);
            renderPendingDirectImages();
        };
        reader.readAsDataURL(file);
    });

    // Reset input
    event.target.value = '';
}

function renderPendingDirectImages() {
    const container = document.getElementById('direct-pending-images-container');
    container.innerHTML = '';

    pendingDirectImages.forEach((imgData, index) => {
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.style.width = '80px';
        div.style.height = '80px';
        div.style.borderRadius = '8px';
        div.style.overflow = 'hidden';
        div.style.border = '1px solid #cbd5e1';

        div.innerHTML = `
            <img src="${imgData}" style="width:100%; height:100%; object-fit:cover;">
            <button onclick="deleteDirectPendingImage(${index})" style="position:absolute; top:2px; right:2px; background:rgba(239, 68, 68, 0.9); color:white; border:none; border-radius:50%; width:20px; height:20px; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center;">×</button>
        `;
        container.appendChild(div);
    });

    // Show/Hide Analyze button
    const analyzeBtn = document.getElementById('directAnalyzeBtn');
    if (pendingDirectImages.length > 0) {
        analyzeBtn.style.display = 'block';
        document.getElementById('directUploadContent').innerHTML = `
            <span style="font-size: 32px; color: var(--netso-green); margin-bottom: 5px;">📷</span>
            <div style="font-size: 13px; font-weight: 700; color: var(--netso-dark);">Agregar más</div>
        `;
    } else {
        analyzeBtn.style.display = 'none';
        document.getElementById('directUploadContent').innerHTML = `
            <span style="font-size: 40px; color: var(--netso-green); margin-bottom: 10px;">📷</span>
            <div style="font-size: 14px; font-weight: 700; color: var(--netso-dark);">
                Agregar fotos para análisis
            </div>
        `;
    }
}

function deleteDirectPendingImage(index) {
    pendingDirectImages.splice(index, 1);
    renderPendingDirectImages();
}

async function analyzeDirectImage() {
    if (pendingDirectImages.length === 0) {
        alert('⚠️ Por favor agrega al menos una imagen propa analizar.');
        return;
    }

    if (!googleApiKey) {
        toggleSettings();
        return;
    }

    // UI Updates
    document.getElementById('directLoadingAnalysis').style.display = 'block';
    const btn = document.getElementById('directAnalyzeBtn');
    btn.disabled = true;
    btn.style.opacity = '0.5';
    document.getElementById('directAnalysisResult').style.display = 'block';

    const analysisTextContainer = document.getElementById('directAnalysisText');
    if (pendingDirectImages.length > 0) analysisTextContainer.innerHTML = "";

    try {
        for (let i = 0; i < pendingDirectImages.length; i++) {
            const base64Img = pendingDirectImages[i];

            // Update loading text
            document.querySelector('#directLoadingAnalysis div:nth-child(2)').innerText = `Analizando imagen ${i + 1} de ${pendingDirectImages.length}...`;

            try {
                // Reuse the same API call function
                const analysisResult = await callGeminiAPI(base64Img);

                // SEPARAR TEXTO Y JSON
                let markdownText = analysisResult;
                let jsonSuggestions = [];

                // Buscar bloque JSON al final
                const jsonMatch = analysisResult.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    try {
                        jsonSuggestions = JSON.parse(jsonMatch[1]);
                        // Eliminar el JSON del texto visible para que no se vea feo
                        markdownText = analysisResult.replace(jsonMatch[0], "").trim();
                    } catch (e) {
                        console.error("Error parsing JSON suggestions:", e);
                    }
                }

                currentDirectAnalysisImages.push({
                    data: base64Img,
                    detections: markdownText,
                    suggestions: jsonSuggestions
                });

                // Render Result Text
                const resultBlock = document.createElement('div');
                resultBlock.style.marginBottom = "20px";
                resultBlock.style.borderBottom = "1px solid #e2e8f0";
                resultBlock.style.paddingBottom = "15px";

                resultBlock.innerHTML = `
                    <div style="font-weight:bold; color:#0f172a; margin-bottom:5px;">Imagen ${currentDirectAnalysisImages.length}:</div>
                    <img src="${base64Img}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; margin-bottom: 10px; display: block;">
                    <div>${formatMarkdown(markdownText)}</div>
                `;
                analysisTextContainer.appendChild(resultBlock);

                // RENDERIZAR TARJETAS DE SUGERENCIAS (Interactivas)
                if (jsonSuggestions.length > 0) {
                    renderAiSuggestions(jsonSuggestions, currentDirectAnalysisImages.length - 1);
                }

            } catch (err) {
                console.error("Error analizando imagen (Directo):", err);
                analysisTextContainer.innerHTML += `<div style="color:red; margin-bottom:15px;">Error en imagen ${i + 1}: ${err.message}</div>`;
            }
        }

        // Clear pending
        pendingDirectImages = [];
        renderPendingDirectImages();

    } catch (globalError) {
        console.error("Error global en análisis directo:", globalError);
        alert('Error en el proceso de análisis.');
    } finally {
        document.getElementById('directLoadingAnalysis').style.display = 'none';
        btn.disabled = false;
        btn.style.opacity = '1';
        document.querySelector('#directLoadingAnalysis div:nth-child(2)').innerText = `Analizando imágenes...`;
    }
}

// NUEVA FUNCIÓN: Renderizar Sugerencias Interactivas
function renderAiSuggestions(suggestions, imageIndex) {
    const container = document.getElementById('directAnalysisText');

    // Crear contenedor de sugerencias
    const suggestionsDiv = document.createElement('div');
    suggestionsDiv.style.backgroundColor = '#f8fafc';
    suggestionsDiv.style.border = '1px solid #cbd5e1';
    suggestionsDiv.style.borderRadius = '12px';
    suggestionsDiv.style.padding = '15px';
    suggestionsDiv.style.marginTop = '10px';
    suggestionsDiv.style.marginBottom = '20px';

    suggestionsDiv.innerHTML = `<div style="font-size:14px; font-weight:700; color:#0f172a; margin-bottom:10px;">✨ Materiales Sugeridos (Haz clic para agregar)</div>`;

    suggestions.forEach((item, itemIdx) => {
        const itemId = `sugg-${imageIndex}-${itemIdx}`;

        const card = document.createElement('div');
        card.id = itemId;
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        card.style.backgroundColor = 'white';
        card.style.padding = '10px';
        card.style.marginBottom = '8px';
        card.style.borderRadius = '8px';
        card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
        card.style.border = '1px solid #e2e8f0';

        card.innerHTML = `
            <div style="flex: 1;">
                <div style="font-size:13px; font-weight:600; color:#1e293b;">${item.product}</div>
                <div style="font-size:11px; color:#64748b;">Cant: ${item.qty} • ${item.reason}</div>
            </div>
            <div style="display:flex; gap:5px;">
                <button onclick="acceptSuggestion('${itemId}', '${item.product}', ${item.qty})" 
                    style="background:#10b981; color:white; border:none; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">
                    ✓
                </button>
                 <button onclick="dismissSuggestion('${itemId}')" 
                    style="background:#ef4444; color:white; border:none; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">
                    ✕
                </button>
            </div>
        `;
        suggestionsDiv.appendChild(card);
    });

    container.appendChild(suggestionsDiv);
}

// NUEVA FUNCIÓN: Aceptar Sugerencia
// NUEVA FUNCIÓN: Aceptar Sugerencia
async function acceptSuggestion(elementId, productName, qty) {
    console.log(`[acceptSuggestion] Intentando agregar: '${productName}' (x${qty})`);

    // 1. Verificar si hay caché de productos
    if (typeof allOdooProductsCache === 'undefined' || allOdooProductsCache.length === 0) {
        console.warn("[acceptSuggestion] Cache de Odoo vacío. Intentando cargar productos...");
        try {
            if (typeof loadProductsForQuote === 'function') {
                await loadProductsForQuote();
            } else if (typeof fetchOdooProducts === 'function') {
                await fetchOdooProducts();
            }
        } catch (e) {
            console.error("[acceptSuggestion] Error cargando productos on-demand:", e);
        }
    }

    if (typeof allOdooProductsCache === 'undefined' || allOdooProductsCache.length === 0) {
        alert("⚠️ No se han podido cargar los productos de Odoo. Verifica tu conexión.");
        return;
    }

    let price = 0;
    let finalName = productName;
    let match = null;
    let odooMappedName = null;

    // A. Intentar buscar por MAPEO (PRODUCT_MAPPING)
    if (typeof PRODUCT_MAPPING !== 'undefined' && PRODUCT_MAPPING[productName]) {
        odooMappedName = PRODUCT_MAPPING[productName];
        console.log(`[acceptSuggestion] Mapeo encontrado: '${productName}' -> '${odooMappedName}'`);

        // Búsqueda 1: Exacta en display_name o name
        match = allOdooProductsCache.find(p => p.display_name === odooMappedName || p.name === odooMappedName);

        // Búsqueda 2: Flexible (Includes)
        if (!match) {
            const searchNorm = odooMappedName.toLowerCase().trim();
            match = allOdooProductsCache.find(p => {
                const pName = (p.name || "").toLowerCase();
                const pDisplay = (p.display_name || "").toLowerCase();
                return pDisplay.includes(searchNorm) || pName.includes(searchNorm);
            });
        }
    } else {
        console.log(`[acceptSuggestion] No hay mapeo explícito para '${productName}'. Buscando directo...`);
    }

    // B. Si falla mapeo o no existe, buscar por NOMBRE ORIGINAL de la sugerencia
    if (!match) {
        const searchNorm = productName.toLowerCase().trim();
        match = allOdooProductsCache.find(p => {
            const pName = (p.name || "").toLowerCase();
            const pDisplay = (p.display_name || "").toLowerCase();
            return pDisplay.includes(searchNorm) || pName.includes(searchNorm);
        });
    }

    if (match) {
        // Usar precio en USD con margen ya aplicado en el cache
        price = match.list_price_usd || 0;
        finalName = match.display_name; // Usar nombre oficial de Odoo
        console.log(`[acceptSuggestion] MATCH EXITOSO:`, match);
    } else {
        console.warn(`[acceptSuggestion] NO SE ENCONTRÓ COINCIDENCIA para '${productName}' (ni mapeado '${odooMappedName}')`);
        // Fallback: Mantener nombre sugerido y precio 0, pero avisar en consola
    }

    // 2. Agregar a la tabla de cotización
    if (typeof quoteItems !== 'undefined') {
        const quantity = parseFloat(qty); // Use parseFloat for decimal quantities
        quoteItems.push({
            id: match ? match.id : ('ai-sugg-' + Date.now()),
            name: finalName,
            price: price,
            qty: quantity,
            total: price * quantity,
            ...match // Include all other props like default_code
        });

        // Renderizar tabla
        if (typeof renderQuoteTable === 'function') {
            renderQuoteTable();
        }
    }

    // 3. Feedback visual interactivo
    const card = document.getElementById(elementId);
    if (card) {
        card.style.backgroundColor = '#dcfce7'; // Verde claro
        card.style.borderColor = '#86efac';
        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; color:#166534; font-size:13px; font-weight:600;">
                <span>✓</span>
                <span>Agregado: ${finalName} (x${qty})</span>
            </div>
        `;
    }
}

// Lógica para agregar a la tabla (Adaptada a tu estructura actual)
// function addNewQuoteItem(name, qty) { // DEPRECATED - REPLACED BY acceptSuggestion
function addNewQuoteItem_DEPRECATED(name, qty) {
    // Buscar si ya existe para sumar cantidad
    const existingIndex = quoteItems.findIndex(i => i.description === name);

    if (existingIndex >= 0) {
        quoteItems[existingIndex].quantity += parseInt(qty);
    } else {
        quoteItems.push({
            description: name,
            quantity: parseInt(qty),
            unitPrice: 0, // Precio por defecto o buscar en catálogo si tuviéramos precios cargados
            total: 0
        });
    }
    renderQuoteTable(); // Refrescar tabla
}

// Nueva función auxiliar para llamar a la API (refactorizada)
// Nueva función auxiliar para llamar a la API (refactorizada)
// Función auxiliar para llamar a Gemini con optimización de contexto
async function callGeminiAPI(base64Str) {
    let catalogContext = "";
    if (typeof PRODUCT_MAPPING !== 'undefined' && Object.keys(PRODUCT_MAPPING).length > 0) {
        const productNames = Object.keys(PRODUCT_MAPPING).join("\n");
        catalogContext = `CATÁLOGO DE PRODUCTOS (Usa EXACTAMENTE estos nombres):
${productNames}`;
    } else {
        catalogContext = `CATÁLOGO REFERENCIAL:
${JSON.stringify(catalogoNetso, null, 2)}`;
    }

    const prompt = `Eres un ingeniero experto en redes FTTH. Realiza una auditoría técnica DETALLADA de esta imagen.

INSTRUCCIONES:
1. **Análisis técnico**: Explica exhaustivamente la infraestructura visible (postes, saturación, herrajes). Sé descriptivo y profesional.
2. **Materiales**: Sugiere los componentes necesarios del catálogo.

REGLAS:
- NO hables de JSON en el texto visible.
- Incluye al final el bloque json con el formato: [\`\`\`json [ { "product": "...", "qty": 1, "reason": "..." } ] \`\`\`]

${catalogContext}
`;
    const base64Data = base64Str.split(',')[1];
    let mimeType = "image/jpeg";
    if (base64Str.includes('data:image/png')) mimeType = "image/png";
    else if (base64Str.includes('data:image/webp')) mimeType = "image/webp";

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${googleApiKey}`;

    // RETRY LOGIC for 503 / Ovearloaded errors
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            attempt++;
            console.log(`[Gemini API] Intento ${attempt}/${maxRetries}...`);

            let response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mimeType, data: base64Data } }
                        ]
                    }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.error?.message || response.statusText || "Unknown error";

                // Si es un error 503 o menciona sobrecarga, reintentamos
                if (response.status === 503 || errMsg.includes('overloaded') || errMsg.includes('high demand')) {
                    console.warn(`[Gemini API] Error temporal (${response.status}): ${errMsg}. Reintentando en 2s...`);
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponentialish backoff
                        continue;
                    }
                }

                throw new Error(errMsg);
            }

            const data = await response.json();
            // Debugging
            console.log("Gemini Response:", data);

            if (data.candidates && data.candidates[0]) {
                const candidate = data.candidates[0];

                // Check for safety blocks or other finish reasons
                if (candidate.finishReason && candidate.finishReason !== "STOP") {
                    // If content is present despite finish reason (sometimes happens), try to use it
                    if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
                        return candidate.content.parts[0].text;
                    }
                    throw new Error(`IA detenida por: ${candidate.finishReason} (Posible filtro de seguridad o cuota)`);
                }

                // Standard Success
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    return candidate.content.parts[0].text;
                }
            }

            throw new Error("La IA no devolvió un análisis válido. Intenta con otra foto.");

        } catch (error) {
            console.error(`[Gemini API] Fallo en intento ${attempt}:`, error);
            if (attempt >= maxRetries) {
                // Si es el último intento, lanzamos el error para que la UI lo muestre
                throw error;
            }
            // Si es un error de red (fetch fail), también podemos reintentar
            if (error.message.includes('fetch') || error.message.includes('network')) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }
            // Si es otro error (ej: key invalida), no reintentamos
            throw error;
        }
    }
}

function handleImageUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Procesar todos los archivos seleccionados
    Array.from(files).forEach(file => {
        if (file.size > 10 * 1024 * 1024) {
            alert(`⚠️ Imagen ${file.name} muy grande (máx 10MB). Ignorada.`);
            return;
        }
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            // Agregar a la cola de pendientes
            pendingImages.push(e.target.result);
            renderPendingImages();

            // Mostrar botón de análisis si hay imágenes
            document.getElementById('analyzeBtn').style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

    // Resetear input para permitir subir la misma imagen si se desea
    event.target.value = '';
}

function renderPendingImages() {
    const container = document.getElementById('pending-images-container');
    container.innerHTML = '';

    pendingImages.forEach((imgBase64, index) => {
        const thumb = document.createElement('div');
        thumb.style.position = 'relative';
        thumb.style.width = '80px';
        thumb.style.height = '80px';

        thumb.innerHTML = `
            <img src="${imgBase64}" style="width:100%; height:100%; object-fit:cover; border-radius:8px; border:2px solid #e2e8f0;">
            <button onclick="removePendingImage(${index})" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; line-height:20px; text-align:center; font-size:12px; cursor:pointer;">×</button>
        `;
        container.appendChild(thumb);
    });
}

function removePendingImage(index) {
    pendingImages.splice(index, 1);
    renderPendingImages();
    if (pendingImages.length === 0) {
        document.getElementById('analyzeBtn').style.display = 'none';
    }
}

function formatMarkdown(text) {
    if (!text) return '';
    return text
        // Headers
        .replace(/^### (.*$)/gim, '<h3 style="font-size: 16px; font-weight: 800; margin-top: 15px; margin-bottom: 8px; color: #1e293b;">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 style="font-size: 18px; font-weight: 800; margin-top: 20px; margin-bottom: 10px; color: #0f172a;">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 style="font-size: 20px; font-weight: 900; margin-top: 20px; margin-bottom: 12px; color: #10b981;">$1</h1>')
        // Bold
        .replace(/\*\*(.*?)\*\*/gim, '<strong style="color: #334155;">$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        // Lists
        .replace(/^\s*\*\s(.*?)$/gim, '<li style="margin-left: 20px; margin-bottom: 5px;">$1</li>')
        .replace(/^\s*-\s(.*?)$/gim, '<li style="margin-left: 20px; margin-bottom: 5px;">$1</li>')
        // Newlines to breaks
        .replace(/\n/gim, '<br>');

}

// ============================================
// FUNCIONES DE CÁLCULO Y RESULTADOS
// ============================================

// ============================================
// LÓGICA DE CÁLCULO DE MATERIALES (REGLAS DE NEGOCIO)
// ============================================

class MaterialCalculator {
    static calculate(itemName, quantityNeeded) {
        // 1. Obtener regla del catálogo
        if (typeof PRODUCT_MAPPING === 'undefined') {
            console.error("CRITICAL: PRODUCT_MAPPING is undefined in calculate!");
        }

        // Intento de normalización (trim) para evitar errores por espacios
        const cleanName = itemName.trim();
        const rule = (typeof MATERIAL_RULES !== 'undefined') ? MATERIAL_RULES[cleanName] : null;

        if (!rule) {
            console.warn(`[MaterialCalculator] SIN REGLA: "${cleanName}" (Original: "${itemName}")`);
            // Sin regla: Retorno directo (1 a 1)
            return {
                originalItem: cleanName,
                originalQty: quantityNeeded,
                finalItem: cleanName,
                finalQty: quantityNeeded,
                unit: 'u',
                note: 'Cálculo directo (Sin regla definida)'
            };
        } else {
            console.log(`[MaterialCalculator] REGLA ENCONTRADA: "${cleanName}" -> Unit: ${rule.unit}`);
        }

        const qtyPerUnit = rule.qty_per_unit || 1;
        const unitName = rule.unit || 'u';
        const rounding = rule.rounding || 'LIBRE'; // 'ESTRICTO' o 'LIBRE'

        let finalQty = 0;
        let note = '';

        // 2. Lógica por Tipo de Unidad
        if (unitName.toLowerCase().includes('bobina') || unitName.toLowerCase().includes('rollo')) {
            // CASO: CABLE / BOBINAS
            const packsNeeded = quantityNeeded / qtyPerUnit;

            if (rounding === 'ESTRICTO') {
                // Forzar entero superior
                const packsInt = Math.ceil(packsNeeded);
                finalQty = (quantityNeeded > 0 && packsInt < 1) ? 1 : packsInt;
                note = `Redondeado a ${packsInt} ${unitName}(s) de ${qtyPerUnit}m (Req: ${quantityNeeded}m)`;
            } else {
                // LIBRE: 2 decimales
                const rawVal = parseFloat(packsNeeded.toFixed(2));
                finalQty = (quantityNeeded > 0 && rawVal < 0.01) ? 0.01 : rawVal;
                note = `Equivalente a ${finalQty} ${unitName}(s) (Req: ${quantityNeeded}m)`;
            }

        } else {
            // CASO: UNIDADES DISCRETAS
            if (rounding === 'ESTRICTO' || (qtyPerUnit > 1)) {
                const packsNeeded = quantityNeeded / qtyPerUnit;
                finalQty = Math.ceil(packsNeeded);
                note = `Pack de ${qtyPerUnit} u. (Req: ${quantityNeeded})`;
            } else {
                finalQty = Math.ceil(quantityNeeded);
                note = '';
            }
        }

        return {
            originalItem: itemName,
            originalQty: quantityNeeded,
            finalItem: itemName, // El nombre base se mantiene, la unidad cambia en el display
            finalQty: finalQty,
            unit: unitName,
            note: note,
            ruleApplied: rule
        };
    }
}

function applyMaterialRulesToReport(reportItems) {
    return reportItems.map(item => {
        // Si el item es 'stock', no recalculamos (ya lo tenemos)
        if (item.type === 'stock') return item;

        // Caso especial: Sugerencias IA. Si ya tienen una unidad y cantidad fija, 
        // tal vez no queramos re-calcular si no tenemos regla?
        // Pero si tenemos regla, mejor aplicar para estandarizar.

        const calc = MaterialCalculator.calculate(item.item, item.cantidad);

        return {
            ...item,
            cantidad: calc.finalQty,
            unidad: calc.unit,
            originalQty: calc.originalQty, // Guardar original para ref
            calcNote: calc.note
        };
    });
}


// Helper para determinar capacidad de NAP según densidad
function getOptimalNAPCapacity(clientCount, radioKm) {
    // Si no hay radio o clientes, default 16
    if (!radioKm || !clientCount) return 16;

    // Calcular densidad aproximada (clientes / area circular estimada)
    const areaKm2 = Math.max(0.01, Math.PI * Math.pow(radioKm, 2));
    const density = clientCount / areaKm2;

    // Umbral de alta densidad: > 200 clientes/km2 (mismo que NAP_Optimizer)
    return (density > 200) ? 48 : 16;
}

function procesarCalculos() {
    try {
        console.log("Iniciando cálculo de diseño...");

        // Validación básica de input
        const censoEl = document.getElementById('censo');

        // Si no existe elemento censo (ej: modo cotización directa), no calculamos diseño tradicional
        if (!censoEl) {
            console.warn("Elemento censo no encontrado - Quizás en modo Cotizador Directo");
            // Si estamos en cotizador directo, el botón de calcular no debería llamarse, pero por si acaso:
            if (document.getElementById('page-direct-quote').style.display === 'block') {
                alert("Estás en modo Cotizador Directo. Usa el botón 'Generar PDF' de esa pantalla.");
                return;
            }
            // Fallback
            alert("Error: No se encuentra formulario de diseño.");
            return;
        }

        let censoVal = censoEl.value;
        if (!censoVal || parseInt(censoVal) <= 0) {
            // Si no hay censo, intentamos estimar o pedir valor
            const userInput = prompt("⚠️ No ingresaste los clientes proyectados.\n\nPor favor, ingresa el número estimado de clientes:", "100");
            if (!userInput) return;
            censoEl.value = userInput;
            censoVal = userInput;
        }

        // Feedback UI
        const btn = event.target || document.querySelector('button[onclick="procesarCalculos()"]');
        if (btn) {
            btn.innerHTML = '⏳ Calculando...';
            btn.disabled = true;
        }

        // Función interna para proceder
        const proceed = () => {
            try {
                finalizar();
            } catch (err) {
                console.error("Error en finalizar():", err);
                // MOSTRAR STACK TRACE PARA DEPURACIÓN
                alert("Error al generar resultados:\n" + err.message + "\n\n📍 " + (err.stack ? err.stack.split('\n')[1] : 'Sin stack'));
                if (btn) { btn.innerHTML = 'Calcular Diseño →'; btn.disabled = false; }
            }
        };

        // Intentar obtener geolocalización con Timeout
        if (navigator.geolocation) {
            const geoOptions = { timeout: 5000, maximumAge: 0, enableHighAccuracy: false };

            navigator.geolocation.getCurrentPosition(
                position => {
                    document.getElementById('lat-val').innerText = position.coords.latitude.toFixed(5);
                    document.getElementById('lng-val').innerText = position.coords.longitude.toFixed(5);
                    proceed();
                },
                error => {
                    console.warn('Geolocalización falló o expiró:', error.message);
                    proceed(); // Continuamos sin geo
                },
                geoOptions
            );
        } else {
            proceed();
        }

    } catch (e) {
        console.error("Error crítico en procesarCalculos:", e);
        alert("Ocurrió un error inesperado: " + e.message);
    }
}

function finalizar() {
    // Helper para obtener valor seguro
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : null;
    };

    const hp = parseInt(getVal('censo') || 0);
    const radioVal = getVal('coverageRadius') || 500;
    const radioKm = parseFloat(radioVal) / 1000;

    // DETERMINAR CAPACIDAD DE NAP (16 o 48)
    const napCap = getOptimalNAPCapacity(hp, radioKm);
    const divisor = napCap === 48 ? 43.2 : 14.4; // 14.4 es 16 * 0.9 (90% llenado)

    let sfpVal = getVal('sfp-status') || 'none'; // Default safe value

    // Determinar potencia del SFP
    let sfpP = (sfpVal === "7.0" || sfpVal === "7.0_upc") ? 7.0 : 4.5;

    // Cálculo de pérdida en cable (0.35 dB/km)
    const lossC = (radioKm * 1.5) * 0.35;

    // Cálculo de potencia final
    // Splitter loss: 1:16 -> 13.8dB, 1:32 -> 17.2dB, 1:64 -> 20.5dB
    // 48 puertos usa splitter 1:32 (L2) + algo de L1. Estimado 17.5dB para 48.
    const splitterLoss = napCap === 48 ? 17.5 : 13.8;
    const pF = (sfpP - lossC - splitterLoss - 3.5).toFixed(2);

    // Actualizar resultados (Safe check)
    const setRes = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };
    setRes('res-potencia', pF + " dBm");
    setRes('res-hp', hp);
    const napsRequeridos = Math.ceil(hp / (napCap * 0.9));
    setRes('res-naps-total', napsRequeridos);

    // Actualizar etiqueta si es necesario para claridad
    const napLabel = document.querySelector('span[id="res-naps-total"]')?.parentElement?.querySelector('span');
    if (napLabel) napLabel.innerText = `NAPs (${napCap})`;

    setRes('res-loss-cable', "-" + lossC.toFixed(2) + " dB");

    // Determinar estado (Safe)
    const badge = document.getElementById('res-status');
    if (badge) {
        if (pF > -27) {
            badge.innerText = "✓ IDEAL";
            badge.style.background = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
        } else if (pF > -28) {
            badge.innerText = "⚠ ACEPTABLE";
            badge.style.background = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)";
        } else {
            badge.innerText = "✕ CRÍTICO";
            badge.style.background = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
        }
    }

    // Generar lista de cotización pasándole la capacidad decidida
    console.log(`Generando lista cotización con NAPs de ${napCap}...`);
    generarListaCotizacion(hp, napsRequeridos, radioKm, napCap);

    // REGISTRO AUTOMÁTICO DE PROYECTO
    if (currentUser && currentUser.role === 'isp') {
        saveProjectRegistry({
            id: generateId(),
            ispName: currentUser.company,
            contactName: currentUser.name,
            projectName: getSafeValue('projectName', 'Proyecto Sin Nombre'),
            date: new Date().toISOString(),
            status: 'completed',
            results: {
                potencia: pF,
                clientes: hp,
                naps: napsRequeridos,
                napCapacity: napCap,
                cable: lossC.toFixed(2)
            },
            reportData: (() => { try { return generateReportData(); } catch (e) { console.error("Error GenReport:", e); return []; } })()
        });
    }

    // Cambiar a página de resultados
    nextPage(4);
}






// Helper seguro global
function getSafeValue(id, defaultVal = '') {
    const el = document.getElementById(id);
    return el ? el.value : defaultVal;
}

// ============================================
// HELPER FUNCTIONS FOR CALCULATIONS
// ============================================

function getUserStock() {
    const stock = {
        fibra: [],
        distribucion: [],
        empalme: [],
        conectorizacion: [],
        herrajes: [],
        herramientas: [],
        activos: {}
    };

    // Helper to read dynamic cards
    const readCards = (containerId, valClass, targetArray) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const cards = container.querySelectorAll('.fibra-card, .dist-card, .empalme-card, .conect-card, .herraje-card, .herra-card');

        cards.forEach(card => {
            const select = card.querySelector('select');
            const input = card.querySelector('input[type="number"]');

            if (select && input && select.value && parseFloat(input.value) > 0) {
                targetArray.push({
                    item: select.value,
                    cantidad: parseFloat(input.value),
                    type: select.value // For looser matching later
                });
            }
        });
    };

    readCards('fibra-container', 'fibra-val', stock.fibra);
    readCards('dist-container', 'dist-val', stock.distribucion);
    readCards('empalme-container', 'empalme-val', stock.empalme);
    readCards('conect-container', 'conect-val', stock.conectorizacion);
    readCards('herrajes-container', 'herraje-val', stock.herrajes);
    readCards('herramientas-container', 'herra-val', stock.herramientas);

    // Activos (Fixed Inputs)
    stock.activos.olt = document.getElementById('olt-status')?.value || 'none';
    stock.activos.sfp = document.getElementById('sfp-status')?.value || 'none';
    stock.activos.board = document.getElementById('board-status')?.value || 'none';

    console.log("Inventario Usuario:", stock);
    return stock;
}

function getAIAnalysisContext() {
    const context = {
        isAerial: true, // Default
        isRural: false,
        density: 'media',
        hasPoles: true,
        recommendations: []
    };

    const analysisText = document.getElementById('analysisText')?.innerText || "";
    const lowerText = analysisText.toLowerCase();

    // Heurísticas basadas en palabras clave de la IA
    if (lowerText.includes('rural') || lowerText.includes('campo') || lowerText.includes('vegetación')) {
        context.isRural = true;
        context.density = 'baja';
    }
    if (lowerText.includes('urbano') || lowerText.includes('edificios') || lowerText.includes('casa')) {
        context.isRural = false;
        context.density = 'alta';
    }

    // Si la IA detecta subterráneo (raro pero posible)
    if (lowerText.includes('subterráneo') || lowerText.includes('soterrado') || lowerText.includes('pozo')) {
        context.isAerial = false;
        context.hasPoles = false;
    }

    // Detección de Postes
    if (lowerText.includes('poste') || lowerText.includes('tendido')) {
        context.hasPoles = true;
        context.isAerial = true;
    }

    console.log("Contexto IA:", context);
    return context;
}


function generarListaCotizacion(clientes, napsRequeridos, radioKm) {
    const stock = getUserStock();
    const aiContext = getAIAnalysisContext();

    // Listas de salida
    const listaFaltantes = [];
    const listaDisponibles = [];

    // Helper para procesar un requerimiento
    const processReq = (cat, name, qty, unit, priority, stockArray) => {
        let needed = qty;

        // Buscar en stock (Búsqueda laxa)
        if (stockArray) {
            stockArray.forEach(sItem => {
                if (needed > 0 && sItem.cantidad > 0) {
                    const sName = sItem.item.toLowerCase();
                    const rName = name.toLowerCase();

                    // Lógica de coincidencia "Smart"
                    const isDrop = sName.includes('drop') && rName.includes('drop');
                    const isAdss = sName.includes('adss') && rName.includes('adss');
                    // Match simple de números (e.g. 12 hilos)
                    const sNum = (sName.match(/\d+/) || ['0'])[0];
                    const rNum = (rName.match(/\d+/) || ['1'])[0];
                    const matchHilos = sNum === rNum;

                    // Match generico (si strings coinciden mucho)
                    const exactish = sName.includes(rName) || rName.includes(sName);

                    if (exactish || (isDrop) || (isAdss && matchHilos)) {
                        const take = Math.min(needed, sItem.cantidad);
                        sItem.cantidad -= take;
                        needed -= take;

                        // Registrar uso de stock
                        listaDisponibles.push({
                            categoria: cat,
                            item: `${sItem.item} (Del Inventario)`,
                            cantidad: take,
                            unidad: unit
                        });
                    }
                }
            });
        }

        if (needed > 0) {
            listaFaltantes.push({
                categoria: cat,
                item: name,
                cantidad: needed,
                unidad: unit,
                prioridad: priority
            });
        }
    };

    // ==========================================
    // 1. CÁLCULO DE FIBRA ÓPTICA (Architecture Refined)
    // ==========================================
    // Factor de Holgura (Slack): Rural 1.30, Urbano 1.15
    const slackFactor = aiContext.isRural ? 1.30 : 1.15;

    // Drop
    const metrosDropTotal = Math.ceil(clientes * 125 * slackFactor);
    // IMPORTANTE: Pasamos METROS, el MaterialCalculator se encarga de convertir a bobinas
    processReq("🧵 Fibra Óptica", "Drop Flat/Tenzado 1 hilo (Bobina 1km)", metrosDropTotal, "m", "alta", stock.fibra);

    // Troncal
    const metrosTroncal = Math.ceil(radioKm * 1000 * 1.5 * slackFactor);
    if (metrosTroncal > 0) {
        let hiloTroncal = "ADSS 48 hilos";
        if (clientes > 1000) hiloTroncal = "ADSS 96 hilos";
        if (clientes < 200) hiloTroncal = "ADSS 24 hilos";
        if (aiContext.isRural && clientes < 100) hiloTroncal = "ADSS 12 hilos";

        processReq("🧵 Fibra Óptica", hiloTroncal, metrosTroncal, "m", "alta", stock.fibra);
    }

    // Distribución
    const metrosDist = Math.ceil((napsRequeridos * 200) * slackFactor);
    if (metrosDist > 0) {
        // Consolidamos usando el mismo nombre que la troncal si aplica
        processReq("🧵 Fibra Óptica", "ADSS 24 hilos", metrosDist, "m", "alta", stock.fibra);
    }

    // ==========================================
    // 2. EQUIPOS DE DISTRIBUCIÓN
    // ==========================================
    // NAPS: Dinámico según capacidad (16 o 48)
    const napCap = arguments[3] || 16;
    const naps = napsRequeridos || Math.ceil(clientes / (napCap * 0.9));

    let napProductName = "Caja Nap 16 puertos (Splitter 1x16 APC)";
    if (napCap === 48) {
        napProductName = "Caja Nap 48 puertos (2x Splitter 1x32 APC)";
    }

    processReq("📦 Equipos de Distribución", napProductName, naps, "unidades", "alta", stock.distribucion);

    const splittersL1 = Math.ceil(naps / (napCap === 48 ? 2 : 4));
    processReq("🔗 Conectorización", "Splitter PLC 1x4 (Nivel 1)", splittersL1, "unidades", "alta", stock.conectorizacion);

    // ==========================================
    // 3. HERRAJES Y POSTERÍA
    // ==========================================
    if (aiContext.hasPoles) {
        const totalRedMeters = metrosTroncal + metrosDist;
        const totalRedKm = totalRedMeters / 1000;
        const postesKm = aiContext.isRural ? 20 : 28;
        const totalPostes = Math.ceil(totalRedKm * postesKm);

        const retenciones = Math.ceil(totalPostes * 0.3) + (naps * 2);
        const suspensiones = Math.ceil(totalPostes * 0.7);

        // Ajuste: 1 Retención por poste en curvas o remates (estimado 30%) + 2 por NAP
        processReq("🔩 Herrajes", "Herraje de Sujeción Tipo D (Trompoplatina)", retenciones, "unidades", "media", stock.herrajes);
        processReq("🔩 Herrajes", "Tensor ADSS", retenciones, "unidades", "media", stock.herrajes);

        processReq("🔩 Herrajes", "Herraje de Suspensión Tipo J 5MM - 8MM", suspensiones, "unidades", "media", stock.herrajes);
        processReq("🔩 Herrajes", "Preformado NETSO", suspensiones, "unidades", "media", stock.herrajes);

        const metrosFleje = totalPostes * 2 * 1.5;
        processReq("🔩 Herrajes", "Fleje de Acero 1/2 pulgada (45 mts)", metrosFleje, "m", "media", stock.herrajes);

        const hebillas = totalPostes * 2;
        processReq("🔩 Herrajes", "Hebillas de Acero 1/2 pulgada", hebillas, "unidades", "media", stock.herrajes);
    }

    // ==========================================
    // 4. EMPALMES
    // ==========================================
    const mangasTotal = Math.ceil((metrosTroncal / 1000) / 2) + Math.ceil(splittersL1 / 2);
    processReq("✂️ Equipos de Empalme", "Manga de Empalme Domo 24/48 hilos", mangasTotal, "unidades", "media", stock.empalme);

    // ==========================================
    // 5. EQUIPOS ACTIVOS
    // ==========================================
    processReq("⚡ Equipos Activos", "ONT T21 Navigator Doble Banda", clientes, "unidades", "alta", stock.activos.ont === 'none' ? [] : null);

    // OLT Logic
    const puertosPon = Math.ceil(clientes / 64);
    const sStock = stock.activos; // shortcut

    // Check OLT
    if (sStock.olt === 'buy') {
        let modelo = puertosPon <= 4 ? "OLT Navigator 4 Puertos" : (puertosPon <= 8 ? "OLT Navigator 8 Puertos" : "OLT Navigator 16 Puertos");
        processReq("⚡ Equipos Activos", modelo, 1, "unidad", "crítica", null);
        processReq("⚡ Equipos Activos", "Módulos SFP C++", puertosPon, "unidades", "crítica", null);
    } else {
        let cap = 0;
        if (sStock.olt.includes('2')) cap = 2;
        if (sStock.olt.includes('8')) cap = 8;
        if (sStock.olt.includes('32')) cap = 16;

        if (puertosPon > cap) {
            processReq("⚡ Equipos Activos", `Upgrade OLT Requerido (Necesitas ${puertosPon} puertos)`, 1, "sistema", "crítica", null);
        }
        if (sStock.sfp === 'none') {
            processReq("⚡ Equipos Activos", "Módulos SFP C++", puertosPon, "unidades", "crítica", null);
        }
    }

    // ==========================================
    // 6. ACCESORIOS DROP
    // ==========================================
    processReq("🔗 Conectorización", "Tensores Drop", clientes * 2, "unidades", "media", stock.herrajes);
    processReq("🔗 Conectorización", "Conectores Rápidos SC/APC", clientes * 2, "unidades", "media", stock.conectorizacion);
    processReq("🔗 Conectorización", "Rosetas Ópticas", clientes, "unidades", "baja", stock.conectorizacion);


    // ==========================================
    // AGREGACIÓN Y CONSOLIDACIÓN (Evitar duplicados)
    // ==========================================
    const aggregatedFaltantes = [];
    listaFaltantes.forEach(item => {
        // Buscamos si ya existe el mismo material en la misma categoría
        const existing = aggregatedFaltantes.find(a => a.item === item.item && a.categoria === item.categoria);
        if (existing) {
            existing.cantidad += item.cantidad;
        } else {
            aggregatedFaltantes.push({ ...item });
        }
    });

    // Guardar globalmente para reportes
    window.currentReportData = aggregatedFaltantes;
    window.currentStockUsed = listaDisponibles;

    // ==========================================
    // INICIAR ESTADO PARA EDICIÓN MANUAL
    // ==========================================
    window.finalReportState = [];

    // 1. Agregar Stock Usado
    listaDisponibles.forEach(item => {
        window.finalReportState.push({
            id: 'stk_' + Math.random().toString(36).substr(2, 9),
            categoria: item.categoria,
            item: item.item,
            cantidad: item.cantidad,
            unidad: item.unidad,
            type: 'stock',
            prioridad: 'baja' // Stock siempre es verde/seguro
        });
    });

    // 2. Agregar Faltantes (Consolidados)
    aggregatedFaltantes.forEach(item => {
        window.finalReportState.push({
            id: 'req_' + Math.random().toString(36).substr(2, 9),
            categoria: item.categoria,
            item: item.item,
            cantidad: item.cantidad,
            unidad: item.unidad,
            type: 'missing',
            prioridad: item.prioridad
        });
    });

    // 3. APLICAR REGLAS DE EMPAQUE Y REDONDEO (Excel Rules)
    window.finalReportState = applyMaterialRulesToReport(window.finalReportState);

    renderCotizacionTable();

    // RENDERIZAR SUGERENCIAS IA (SI HAY)
    renderProjectAiSuggestions();
}

// Global State
window.finalReportState = [];
// ==========================================
// LOGICA DE SUGERENCIAS IA (PROYECTO COMPLETO)
// ==========================================
function renderProjectAiSuggestions() {
    const container = document.getElementById('project-ai-suggestions-container');
    if (!container) return;

    // Ensure access to global
    const images = window.currentAnalysisImages || [];
    console.log("Rendering Project AI Suggestions. Images:", images.length);

    const allSuggestions = [];
    if (images.length > 0) {
        images.forEach((img, idx) => {
            if (img.suggestions && Array.isArray(img.suggestions)) {
                img.suggestions.forEach(sugg => {
                    allSuggestions.push({ ...sugg, imgIndex: idx });
                });
            }
        });
    }

    console.log("Found suggestions:", allSuggestions.length);

    if (allSuggestions.length === 0) {
        if (images.length > 0) {
            container.style.display = 'block';
            container.innerHTML = `
                <div style="text-align:center; padding:15px; color:#94a3b8; font-size:12px; border:1px dashed #cbd5e1; border-radius:8px; margin-bottom:15px; background:#f8fafc;">
                    ℹ️ Análisis completado. No se detectaron materiales sugeridos adicionales.
                </div>
             `;
        } else {
            container.style.display = 'none';
        }
        return;
    }

    container.style.display = 'block';
    container.innerHTML = `
        <div style="background: linear-gradient(to right, #f0fdf4, #fff); border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px;">
                <span style="font-size:24px;">✨</span>
                <div>
                    <h3 style="font-size:16px; font-weight:800; color:#166534; margin:0;">Sugerencias del Ingeniero AI</h3>
                    <p style="font-size:12px; color:#15803d; margin:2px 0 0 0;">Basado en el análisis de tus fotos, te recomendamos agregar estos materiales.</p>
                </div>
            </div>
            <div id="project-suggestions-list" style="display:flex; flex-direction:column; gap:8px;"></div>
        </div>
    `;

    const listDiv = document.getElementById('project-suggestions-list');

    allSuggestions.forEach((item, i) => {
        const itemId = `proj-sugg-${i}`;
        const card = document.createElement('div');
        card.id = itemId;
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        card.style.backgroundColor = 'white';
        card.style.padding = '12px 15px';
        card.style.borderRadius = '8px';
        card.style.border = '1px solid #dcfce7';
        card.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)';

        card.innerHTML = `
            <div style="flex: 1;">
                <div style="font-size:13px; font-weight:700; color:#1e293b;">${item.product}</div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">
                    <span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; margin-right:5px;">Cant: ${item.qty}</span>
                    ${item.reason}
                </div>
            </div>
            <div style="display:flex; gap:8px;">
                <button onclick="acceptProjectSuggestion('${itemId}', '${item.product.replace(/'/g, "\\'")}', ${item.qty})" 
                    style="background:#16a34a; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; display:flex; align-items:center; gap:4px; transition:all 0.2s;">
                    <span>✓</span> Aceptar
                </button>
                 <button onclick="dismissProjectSuggestion('${itemId}')" 
                    title="Descartar"
                    style="background:white; border:1px solid #e2e8f0; color:#94a3b8; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; transition:all 0.2s;">
                    ✕
                </button>
            </div>
        `;
        listDiv.appendChild(card);
    });
}

function dismissProjectSuggestion(id) {
    const card = document.getElementById(id);
    if (card) {
        card.style.opacity = '0.5';
        setTimeout(() => card.remove(), 300);
    }
}

async function acceptProjectSuggestion(elementId, productName, qty) {
    const card = document.getElementById(elementId);
    if (!card) return;

    // 1. Buscar si hay match en Odoo (para el nombre oficial)
    let finalName = productName;
    let isOdooMatch = false;

    // Intentar buscar en allOdooProducts (que ya debería estar cargado en esta pantalla)
    if (typeof allOdooProducts !== 'undefined' && allOdooProducts.length > 0) {
        // Búsqueda exacta primero
        const exact = allOdooProducts.find(p =>
            (p.display_name && p.display_name === productName) ||
            (p.name === productName)
        );
        if (exact) {
            finalName = exact.display_name || exact.name;
            isOdooMatch = true;
        } else {
            // Búsqueda fuzzy
            const fuzzy = allOdooProducts.find(p => {
                const dName = (p.display_name || "").toLowerCase();
                const nName = (p.name || "").toLowerCase();
                const searchTerm = productName.toLowerCase();
                return dName.includes(searchTerm) || searchTerm.includes(dName) ||
                    nName.includes(searchTerm) || searchTerm.includes(nName);
            });
            if (fuzzy) {
                finalName = fuzzy.display_name || fuzzy.name;
                isOdooMatch = true;
            }
        }
    }

    // 2. Agregar a la lista final del reporte
    window.finalReportState.push({
        id: 'ai_' + Math.random().toString(36).substr(2, 9),
        categoria: 'Sugerencia IA',
        item: finalName,
        cantidad: parseFloat(qty),
        unidad: 'u',
        type: 'missing',
        prioridad: 'media'
    });

    // 3. Guardar cambios
    if (typeof currentProjectDocId !== 'undefined' && currentProjectDocId) {
        saveProjectRegistry({ reportData: window.finalReportState });
    }

    // 4. Actualizar Tabla
    renderCotizacionTable();

    // 5. Feedback Visual en la tarjeta
    card.style.backgroundColor = '#dcfce7';
    card.style.borderColor = '#86efac';
    card.innerHTML = `
        <div style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px; color:#166534; font-size:13px; font-weight:700; padding:5px;">
            <span>✓</span>
            <span>¡Agregado al Presupuesto!</span>
        </div>
    `;

    // Opcional: Eliminar tarjeta después de un tiempo
    setTimeout(() => {
        card.style.opacity = '0';
        setTimeout(() => card.remove(), 500);
    }, 2000);
}

function renderCotizacionTable() {
    const listContainer = document.getElementById('lista-faltantes');
    if (!listContainer) return;

    // AUTO-FETCH if empty
    if (allOdooProducts.length === 0 && !isFetchingOdoo) {
        console.log("Auto-triggering Odoo fetch for BOM view...");
        fetchOdooProducts(true);
    }

    const items = window.finalReportState;

    let html = `
        <div style="margin-bottom: 25px; border-left: 4px solid #3b82f6; padding-left: 15px; display: flex; justify-content: space-between; align-items: start;">
            <div>
                <h3 style="font-size: 16px; font-weight: 800; color: #1e293b; margin: 0;">
                    📋 Ingeniería de Proyecto (Netso Expert)
                </h3>
                <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">
                    Personaliza las cantidades y verifica la disponibilidad en Odoo antes de descargar.
                </p>
            </div>
            <button onclick="fetchOdooProducts()" title="Refrescar datos de Odoo"
                style="background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;"
                onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                <span>🔄</span> Refrescar Odoo
            </button>
        </div>
        
        <div class="table-container" style="margin-bottom: 20px;">
            <table class="netso-table">
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                        <th class="col-product" style="text-align: left; padding: 12px 16px; font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Producto</th>
                        <th class="col-ref" style="text-align: left; padding: 12px 16px; font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Ref. Netso (Odoo)</th>
                        <th class="col-qty" style="text-align: center; padding: 12px 16px; font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Unidades Recomendadas</th>
                        <!-- <th style="text-align: center; padding: 12px 16px; font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Stock Netso</th> -->
                        <th class="col-price" style="text-align: right; padding: 12px 16px; font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Precio Un.</th>
                        <th class="col-total" style="text-align: right; padding: 12px 16px; font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total</th>
                        <th style="width: 40px;"></th>
                    </tr>
                </thead>
                <tbody>
    `;

    let totalEstimado = 0;

    if (items.length === 0) {
        html += `<tr><td colspan="7" style="padding: 30px; text-align: center; color: #94a3b8;">La lista está vacía. Agrega items manualmente.</td></tr>`;
    } else {
        // Ordenar: Missing First, then Stock. Inside Missing: Priority.
        const typeOrder = { 'missing': 0, 'stock': 1 };
        const priorityOrder = { 'crítica': 0, 'alta': 1, 'media': 2, 'baja': 3 };

        items.sort((a, b) => {
            if (typeOrder[a.type] !== typeOrder[b.type]) return typeOrder[a.type] - typeOrder[b.type];
            return priorityOrder[a.prioridad] - priorityOrder[b.prioridad] || 0;
        });

        items.forEach((item, index) => {
            const isStock = item.type === 'stock';
            const rowBg = isStock ? '#f0fdf4' : (index % 2 === 0 ? '#ffffff' : '#f8fafc');

            // Odoo Matching Logic (Live)
            let odooName = '<span style="color: #cbd5e1;">---</span>';
            let netsoStock = 0;
            let price = 0;
            let hasMatch = false;

            if (allOdooProducts.length > 0) {
                const searchName = item.item.toLowerCase().trim();
                const exactMappedName = PRODUCT_MAPPING[item.item.trim()];
                let bestMatch = null;

                if (exactMappedName) {
                    bestMatch = allOdooProducts.find(p =>
                        (p.display_name && p.display_name.trim() === exactMappedName.trim()) ||
                        (p.name && p.name.trim() === exactMappedName.trim())
                    );
                }

                if (!bestMatch) {
                    // Fallback fuzzy search
                    bestMatch = allOdooProducts.find(p => {
                        const dName = (p.display_name || "").toLowerCase();
                        const nName = (p.name || "").toLowerCase();
                        if (dName.includes(searchName) || nName.includes(searchName)) return true;
                        // Specific Maps
                        if (searchName.includes('manga') && (dName.includes('manga') || nName.includes('manga')) && (dName.includes('24') || nName.includes('24'))) return true;
                        if (searchName.includes('adss 48') && (dName.includes('adss') || nName.includes('adss')) && (dName.includes('48') || nName.includes('48'))) return true;
                        return false;
                    });
                }

                if (bestMatch) {
                    odooName = `<span style="color: #334155; font-weight: 600;">${bestMatch.display_name || bestMatch.name}</span>`;
                    netsoStock = bestMatch.qty_available;
                    price = bestMatch.list_price_usd || 0;
                    hasMatch = true;
                } else {
                    odooName = `<span style="background: #fee2e2; color: #b91c1c; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; border: 1px solid #fecaca;">⚠️ SIN REF. ODOO</span>`;
                }
            }

            const stockColor = netsoStock > item.cantidad ? 'color: #15803d; background: #dcfce7;' : (netsoStock > 0 ? 'color: #ca8a04; background: #fef9c3;' : 'color: #b91c1c; background: #fee2e2;');
            const stockBadge = hasMatch ? `<span style="padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 700; ${stockColor}">${netsoStock}</span>` : '<span style="color:#cbd5e1;">-</span>';
            const priceDisplay = hasMatch ? `$${price.toFixed(2)}` : '-';
            const rowTotal = price * item.cantidad;
            const rowTotalDisplay = hasMatch ? `$${rowTotal.toFixed(2)}` : '-';

            html += `
                <tr style="background: ${rowBg}; border-bottom: 1px solid #f1f5f9; transition: background 0.2s;">
                    <td style="padding: 12px 16px;">
                        <div style="font-weight: 700; font-size: 13px; color: #1e293b;">${item.item}</div>
                        <div style="font-size: 11px; color: #94a3b8;">${item.categoria}</div>
                    </td>
                    <td style="padding: 12px 16px; font-size: 12px; line-height: 1.3;">${odooName}</td>
                    <td style="padding: 12px 16px; text-align: center;">
                        <input type="number" value="${item.cantidad}" onchange="updateItemQuantity('${item.id}', this.value)" 
                            style="width: 70px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; text-align: center; font-weight: 700; color: #0f172a; outline: none; transition: border-color 0.2s;"
                            onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#cbd5e1'">
                    </td>
                    <!-- <td style="padding: 12px 16px; text-align: center;">${stockBadge}</td> -->
                    <td style="padding: 12px 16px; text-align: right; font-size: 13px; font-weight: 600; color: #475569;">${priceDisplay}</td>
                    <td style="padding: 12px 16px; text-align: right; font-size: 13px; font-weight: 700; color: #1e293b;">${rowTotalDisplay}</td>
                    <td style="padding: 12px 16px; text-align: center;">
                        <button onclick="removeReportItem('${item.id}')" title="Eliminar"
                            style="background: none; border: none; cursor: pointer; color: #ef4444; padding: 4px; border-radius: 4px; transition: background 0.2s;">
                            <span style="font-size: 16px;">✕</span>
                        </button>
                    </td>
                </tr>
            `;

            if (hasMatch) {
                totalEstimado += rowTotal;
            }
        });

        // Totales Row
        html += `
            <tr style="background: #f1f5f9; border-top: 2px solid #e2e8f0; font-weight: 800;">
                <td colspan="4" style="padding: 15px 16px; text-align: right; color: #475569; font-size: 13px;">TOTAL ESTIMADO (ODOO)</td>
                <td style="padding: 15px 16px; text-align: right; color: #0f172a; font-size: 15px;">$${totalEstimado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td></td>
            </tr>
        `;
    }

    html += `</tbody></table></div>`;

    // Nota de IVA
    html += `
        <p style="font-size: 11px; color: #94a3b8; font-style: italic; margin: -15px 0 20px 5px;">
            ⚠️ *Nota: Los precios mostrados son estimados y no incluyen IVA.*
        </p>
    `;

    // FORMULARIO PARA AGREGAR MANUALMENTE
    html += `
        <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 15px; margin-top: 10px;">
            <h4 style="font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center;">
                <span>➕ Agregar Producto Extra</span>
                <span style="font-size:10px; color:${allOdooProducts.length > 0 ? '#15803d' : '#64748b'}; background:${allOdooProducts.length > 0 ? '#dcfce7' : '#f1f5f9'}; padding:2px 6px; border-radius:4px;">
                    ${allOdooProducts.length > 0 ? '✅ Catálogo Odoo Cargado' : '⏳ Sincronizando Catálogo...'}
                </span>
            </h4>
            <div style="display: flex; gap: 10px; align-items: center;">
                <input type="text" id="manual-item-name" placeholder="Buscar producto en Odoo..." list="odoo-products-list"
                    style="flex: 2; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
                <datalist id="odoo-products-list">
                    ${allOdooProducts.slice(0, 500).map(p => {
        const fullName = p.display_name || p.name;
        const safeValue = fullName.replace(/"/g, '&quot;');
        return `<option value="${safeValue}">`;
    }).join('')}
                </datalist>
                
                <input type="number" id="manual-item-qty" placeholder="Cant." 
                    style="width: 80px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
                <button onclick="addManualItem()" 
                    style="background: #3b82f6; color: white; border: none; padding: 8px 15px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px;">
                    Agregar
                </button>
            </div>
        </div>
    `;

    listContainer.innerHTML = html;
}

function updateItemQuantity(id, newQty) {
    const qty = parseFloat(newQty);
    if (isNaN(qty) || qty < 0) {
        alert("Por favor ingresa una cantidad válida.");
        renderCotizacionTable(); // Reset view
        return;
    }

    const itemIndex = window.finalReportState.findIndex(i => i.id === id);
    if (itemIndex > -1) {
        window.finalReportState[itemIndex].cantidad = qty;

        // AUTO-SAVE to Firestore
        if (typeof currentProjectDocId !== 'undefined' && currentProjectDocId) {
            saveProjectRegistry({ reportData: window.finalReportState });
        }

        console.log(`Updated quantity for ${id} to ${qty}`);

        // RE-RENDER para actualizar el total
        renderCotizacionTable();
    }
}

function removeReportItem(id) {
    if (!confirm("¿Eliminar este ítem de la lista?")) return;
    window.finalReportState = window.finalReportState.filter(i => i.id !== id);

    // AUTO-SAVE to Firestore
    if (typeof currentProjectDocId !== 'undefined' && currentProjectDocId) {
        saveProjectRegistry({ reportData: window.finalReportState });
    }

    renderCotizacionTable();
}

function addManualItem() {
    const nameInput = document.getElementById('manual-item-name');
    const qtyInput = document.getElementById('manual-item-qty');

    let name = nameInput.value.trim();
    const qty = parseFloat(qtyInput.value);

    if (!name || !qty || qty <= 0) {
        alert("Por favor ingresa un nombre y una cantidad válida.");
        return;
    }

    // Odoo Validation Magic
    let isOdooMatch = false;
    if (allOdooProducts.length > 0) {
        const exactMatch = allOdooProducts.find(p =>
            (p.display_name && p.display_name === name) ||
            (p.name === name)
        );
        if (exactMatch) {
            isOdooMatch = true;
            name = exactMatch.display_name || exactMatch.name; // Use official name if found
        }
    }

    window.finalReportState.push({
        id: 'man_' + Math.random().toString(36).substr(2, 9),
        categoria: isOdooMatch ? 'Producto Odoo Validado' : 'Agregado Manualmente',
        item: name,
        cantidad: qty,
        unidad: 'u',
        type: 'missing',
        prioridad: 'media'
    });

    // AUTO-SAVE to Firestore
    if (typeof currentProjectDocId !== 'undefined' && currentProjectDocId) {
        saveProjectRegistry({ reportData: window.finalReportState });
    }

    renderCotizacionTable();
}

// Nueva función requerida para PDF y Reportes
window.generateReportData = function () {
    return window.finalReportState || [];
};

function generarItemCotizacion(item) {
    return `
        <div class="list-item shopping-item" style="margin-bottom: 10px;">
            <div style="flex: 1;">
                <div class="item-name" style="font-size: 13px; font-weight: 700; color: var(--netso-dark); margin-bottom: 2px;">
                    <strong>${item.item}</strong>
                </div>
                <div class="item-category" style="font-size: 11px; color: #64748b;">
                    ${item.categoria}
                </div>
            </div>
            <div style="text-align: right;">
                <div class="item-quantity" style="font-size: 16px; font-weight: 900; color: var(--netso-green);">
                    ${item.cantidadNecesaria}
                </div>
                <div class="item-unit" style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">
                    ${item.unidad}
                </div>
            </div>
        </div>
    `;
}

// Función para omitir análisis IA
function skipAnalysis() {
    if (confirm('¿Deseas omitir el análisis de IA? Se usarán los cálculos matemáticos pero no recibirás recomendaciones de optimización.')) {
        // Limpiar texto de análisis anterior
        document.getElementById('analysisText').innerHTML = '<p><em>Análisis de IA omitido por el usuario.</em></p>';
        document.getElementById('analysisResult').style.display = 'block';

        // Proceder directamente a cálculos
        procesarCalculos();
    }
}

function generarKMZ() {
    const lat = parseFloat(document.getElementById('lat-val').innerText);
    const lng = parseFloat(document.getElementById('lng-val').innerText);
    const radio = parseFloat(document.getElementById('coverageRadius').value);
    const num = parseInt(document.getElementById('res-naps-total').innerText) || 1;
    const projectName = document.getElementById('projectName').value || 'Proyecto_Netso';

    // Validar coordenadas
    if (!lat || !lng || lat === 0) {
        alert('⚠️ No se pudo obtener la ubicación. Por favor permite el acceso a tu ubicación.');
        return;
    }

    // Generar KML
    let k = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n<name>${projectName}</name>\n`;

    // Agregar nodo central
    k += `<Placemark>\n<name>🌐 NODO CENTRAL</name>\n<description>Punto de origen de la red FTTH</description>\n<Point>\n<coordinates>${lng},${lat},0</coordinates>\n</Point>\n</Placemark>\n`;

    // Agregar NAPs distribuidos
    for (let i = 1; i <= num; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = (Math.random() * radio) / 111320; // Convertir metros a grados
        const napLng = lng + (distance * Math.sin(angle));
        const napLat = lat + (distance * Math.cos(angle));

        k += `<Placemark>\n<name>📍 NAP #${i}</name>\n<description>Caja de distribución NAP</description>\n<Style>\n<IconStyle>\n<scale>0.6</scale>\n</IconStyle>\n<LabelStyle>\n<scale>0.8</scale>\n</LabelStyle>\n</Style>\n<Point>\n<coordinates>${napLng},${napLat},0</coordinates>\n</Point>\n</Placemark>\n`;
    }

    k += `</Document>\n</kml>`;

    // Descargar archivo
    const blob = new Blob([k], { type: 'application/vnd.google-earth.kml+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${projectName.replace(/\s+/g, '_')}_Diseño_FTTH.kml`;
    link.click();

    // Feedback visual
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '✓ Descargado';
    btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = 'linear-gradient(135deg, #4285F4 0%, #1a73e8 100%)';
    }, 2000);
}


// ============================================
// MAPEO MANUAL ING -> ODOO
// ============================================
// ============================================
// MAPEO MANUAL ING -> ODOO
// ============================================
// PRODUCT_MAPPING ahora se carga desde products_data.js



async function downloadComparisonReport() {
    const btn = document.querySelector('[onclick="downloadComparisonReport()"]');
    const originalText = btn ? btn.innerText : '';
    if (btn) btn.innerText = "⏳ Generando Reporte...";

    try {
        // 1. Obtener Datos de Estado FINAL (Editado Manualmente)
        if (!window.finalReportState || window.finalReportState.length === 0) {
            alert('⚠️ Primero debes calcular el diseño para generar el reporte.');
            return;
        }

        // Mapear el estado editado a la estructura del reporte
        const fullList = window.finalReportState.map(i => ({
            ...i,
            source: i.type,
            buy: i.type === 'missing' ? i.cantidad : 0,
            stockUser: i.type === 'stock' ? i.cantidad : 0
        }));

        // 2. Garantizar Datos de Odoo
        if (allOdooProducts.length === 0) {
            const confirmFetch = confirm("⚠️ No tengo datos de Odoo cargados.\n\n¿Deseas intentar descargarlos ahora para un reporte preciso?\n(Si cancelas, se generará sin datos de Odoo)");
            if (confirmFetch) {
                await fetchOdooProducts();
            }
        }

        const projectName = document.getElementById('projectName').value || 'Sin Nombre';
        const ispName = (currentUser && currentUser.company) ? currentUser.company : 'ISP';

        // 3. Generar Excel
        let excelContent = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="UTF-8">
                <!--[if gte mso 9]>
                <xml>
                    <x:ExcelWorkbook>
                        <x:ExcelWorksheets>
                            <x:ExcelWorksheet>
                                <x:Name>Plan de Compra</x:Name>
                                <x:WorksheetOptions>
                                    <x:DisplayGridlines/>
                                </x:WorksheetOptions>
                            </x:ExcelWorksheet>
                        </x:ExcelWorksheets>
                    </x:ExcelWorkbook>
                </xml>
                <![endif]-->
                <style>
                    body { font-family: Calibri, Arial, sans-serif; }
                    td { border: 1px solid #cbd5e1; padding: 5px; vertical-align: middle; }
                    .header { background-color: #1e293b; color: white; font-weight: bold; text-align: center; }
                    .col-head { background-color: #334155; color: white; font-weight: bold; text-align: center; }
                    .text-center { text-align: center; }
                    .buy-yes { background-color: #fee2e2; color: #b91c1c; font-weight: bold; }
                    .buy-no { background-color: #f0fdf4; color: #15803d; }
                    .odoo-match { color: #0f172a; font-weight: 600; }
                    .no-match { color: #94a3b8; font-style: italic; }
                    .stock-netso { font-weight: bold; color: #0f172a; }
                </style>
            </head>
            <body>
                <table>
                    <tr><td colspan="8" class="header" style="font-size:18px;">🛒 PLAN DE COMPRA - INTEGRACIÓN ODOO</td></tr>
                    <tr><td colspan="8" style="text-align:center; background:#f1f5f9;">Proyecto: <strong>${projectName}</strong> - Cliente: <strong>${ispName}</strong></td></tr>
                    <tr><td colspan="8" style="text-align:center; font-size:11px;">Generado: ${new Date().toLocaleString()}</td></tr>
                    <tr><td colspan="8"></td></tr>
                    
                    <tr style="height: 30px;">
                        <td class="col-head" style="width:250px;">ITEM CALCULADO (INGENIERÍA)</td>
                        <td class="col-head" style="width:350px;">PRODUCTO ODOO (MATCH)</td>
                        <td class="col-head" style="width:100px;">STOCK ISP</td>
                        <td class="col-head" style="width:100px;">SUGERIDO</td>
                        <td class="col-head" style="width:120px; background:#b91c1c;">A COMPRAR</td>
                        <td class="col-head" style="width:100px; background:#15803d;">STOCK NETSO</td>
                        <td class="col-head" style="width:120px;">PRECIO UNIT. ($)</td>
                        <td class="col-head" style="width:120px; background:#f8fafc; color:#0f172a;">TOTAL ($)</td>
                    </tr>
        `;

        let totalEstimadoGlobal = 0;

        // Procesar cada item
        fullList.forEach(item => {
            const reqQty = item.cantidad || 0;
            const toBuy = item.buy;
            const stockUser = item.stockUser;

            // Fuzzy Match Odoo
            let odooMatch = { name: '---', qty: 0, price: 0 };
            const searchName = item.item.toLowerCase();
            const exactMappedName = PRODUCT_MAPPING[item.item];

            if (allOdooProducts.length > 0) {
                let bestMatch = null;

                // 1. Mapeo Manual (Prioridad Máxima)
                if (exactMappedName && exactMappedName.length > 0) {
                    bestMatch = allOdooProducts.find(p =>
                        (p.display_name && p.display_name === exactMappedName) ||
                        (p.name === exactMappedName)
                    );
                }

                // 2. Fuzzy / Heurística (Fallback)
                if (!bestMatch) {
                    bestMatch = allOdooProducts.find(p => {
                        const dName = (p.display_name || "").toLowerCase();
                        const nName = (p.name || "").toLowerCase();
                        if (dName.includes(searchName) || nName.includes(searchName)) return true;
                        if (searchName.includes('manga') && (dName.includes('manga') || nName.includes('manga')) && (dName.includes('24') || nName.includes('24'))) return true;
                        if (searchName.includes('adss 48') && (dName.includes('adss') || nName.includes('adss')) && (dName.includes('48') || nName.includes('48'))) return true;
                        if (searchName.includes('nap 16') && (dName.includes('nap') || nName.includes('nap')) && (dName.includes('16') || nName.includes('16'))) return true;
                        return false;
                    });
                }

                if (bestMatch) {
                    odooMatch = {
                        name: bestMatch.display_name || bestMatch.name,
                        qty: bestMatch.qty_available,
                        price: bestMatch.list_price || 0
                    };
                }
            }

            const buyClass = toBuy > 0 ? 'buy-yes' : 'buy-no';
            const matchClass = odooMatch.name !== '---' ? 'odoo-match' : 'no-match';
            const itemTotal = toBuy * odooMatch.price;
            totalEstimadoGlobal += itemTotal;

            excelContent += `
                <tr>
                    <td>${item.item}</td>
                    <td class="${matchClass}">${odooMatch.name}</td>
                    <td class="text-center">${stockUser}</td>
                    <td class="text-center" style="font-weight:bold;">${reqQty}</td>
                    <td class="text-center ${buyClass}" style="${toBuy > 0 ? 'background-color: #fee2e2;' : ''}">${toBuy}</td>
                    <td class="text-center stock-netso">${odooMatch.qty}</td>
                    <td class="text-center">$ ${odooMatch.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td class="text-center" style="font-weight:bold;">$ ${itemTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
            `;
        });

        // Fila de Total Global
        excelContent += `
            <tr><td colspan="8" style="border:none; height:10px;"></td></tr>
            <tr style="background:#f1f5f9; font-weight:bold;">
                <td colspan="7" style="text-align:right; padding:10px;">TOTAL ESTIMADO DE COMPRA (ODOO):</td>
                <td style="text-align:center; font-size:14px; color:#0f172a;">$ ${totalEstimadoGlobal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
        `;

        excelContent += `</table></body></html>`;

        const filename = `Plan_Compra_${projectName.replace(/\s+/g, '_')}.xls`;
        const blob = new Blob(['\uFEFF', excelContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();

        setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 100);

    } catch (e) {
        console.error("Error generando reporte:", e);
        alert("Error al generar reporte: " + e.message);
    } finally {
        if (btn) btn.innerText = originalText;
    }
}


// Helper para sumar stock real de los inputs
function calculateTotalStock(selector) {
    let total = 0;
    document.querySelectorAll(selector).forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    return total;
}

// ============================================
// DASHBOARD LOGIC (NETSO ADMIN)
// ============================================

function switchDashTab(tabName) {
    // Buttons
    const btnProjects = document.getElementById('tab-projects');
    const btnProducts = document.getElementById('tab-products');

    if (btnProjects) btnProjects.classList.toggle('active', tabName === 'projects');
    if (btnProducts) btnProducts.classList.toggle('active', tabName === 'products');

    // Views
    const viewProjects = document.getElementById('dash-view-projects');
    const viewProducts = document.getElementById('dash-view-products');
    const viewStockInquiry = document.getElementById('dash-view-stock-inquiry');

    if (viewProjects) viewProjects.style.display = tabName === 'projects' ? 'block' : 'none';
    if (viewProducts) viewProducts.style.display = tabName === 'products' ? 'block' : 'none';
    if (viewStockInquiry) viewStockInquiry.style.display = tabName === 'stock-inquiry' ? 'block' : 'none';

    if (tabName === 'products') {
        // Optional: Auto fetch or wait for button
        // fetchOdooProducts();
    }
}

// ODOO INTEGRATION
// ============================================

async function syncOdoo() {
    const btn = document.querySelector('[onclick="syncOdoo()"]');
    const originalText = btn.innerText;
    btn.innerText = "🔄 Conectando...";
    btn.disabled = true;

    try {
        if (!odooConfig.uid) {
            await authenticateOdoo();
        }

        // Paso 1: Descubrimiento de Ubicaciones (Para mapeo inicial)
        await discoverOdooLocations();

        // Paso 2: Fetch de Stock real
        await fetchOdooStock();

        alert("✅ Sincronización completada.");
    } catch (error) {
        console.error("Error Odoo Sync:", error);
        alert("❌ Error Odoo:\n" + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Helper para obtener una lista de proxies disponibles (Multi-Proxy Fallback)
function getOdooProxies(targetUrl) {
    let baseUrl = targetUrl || '';
    baseUrl = baseUrl.trim().replace(/\/+$/, "");
    if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;

    const jsonRpcUrl = baseUrl + "/jsonrpc";
    const encodedUrl = encodeURIComponent(jsonRpcUrl);

    return [
        "/api/proxy?url=" + encodedUrl,
        "https://corsproxy.io/?" + encodedUrl,
        "https://thingproxy.freeboard.io/fetch/" + jsonRpcUrl,
        "https://cors-anywhere.herokuapp.com/" + jsonRpcUrl
    ];
}

// Obsoleto
function getOdooEndpoint() {
    let baseUrl = odooConfig.url || '';
    baseUrl = baseUrl.trim().replace(/\/+$/, ""); // Quitar slashes al final

    if (!baseUrl) return null;

    if (!baseUrl.startsWith('http')) {
        console.warn("[Odoo API] URL no tiene protocolo, asumiendo https://");
        baseUrl = 'https://' + baseUrl;
    }

    // Usamos thingproxy como alternativa estable que soporta POST
    return getOdooProxies(odooConfig.url)[0];
}

async function authenticateOdoo() {
    console.log("Autenticando en Odoo...");
    if (!odooConfig.url) throw new Error("URL de Odoo no configurada.");

    const proxies = getOdooProxies(odooConfig.url);
    const payload = {
        jsonrpc: "2.0",
        method: "call",
        params: {
            service: "common",
            method: "login",
            args: [odooConfig.db, odooConfig.username, odooConfig.apiKey]
        },
        id: Math.floor(Math.random() * 1000)
    };

    let lastError = null;
    for (const endpoint of proxies) {
        try {
            console.log(`Intentando Odoo Auth vía: ${endpoint.split('/')[2]}`);
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) continue;

            const data = await response.json();
            if (data.error) {
                // Si es un error de Odoo (no de red), lo lanzamos de una vez
                throw new Error(data.error.data?.message || data.error.message);
            }
            if (!data.result) throw new Error("Credenciales inválidas.");

            odooConfig.uid = data.result;
            console.log("Odoo UID obtenido con éxito.");
            return;
        } catch (err) {
            console.warn(`Proxy fallido: ${endpoint.split('/')[2]}`, err.message);
            lastError = err;
            if (err.message.includes("Credenciales") || err.message.includes("database")) throw err;
        }
    }

    throw new Error("No se pudo conectar con Odoo tras intentar varios túneles. " + (lastError ? lastError.message : "Fallo de red."));
}

// Nueva función para listar bases de datos disponibles
async function listOdooDatabases() {
    console.log("Intentando detectar bases de datos disponibles...");
    if (!odooConfig.url) return;

    const proxies = getOdooProxies(odooConfig.url);
    const payload = {
        jsonrpc: "2.0",
        method: "call",
        params: {
            service: "db",
            method: "list",
            args: []
        },
        id: Math.floor(Math.random() * 1000)
    };

    for (const endpoint of proxies) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) continue;

            const data = await response.json();
            if (data.result && Array.isArray(data.result)) {
                alert("🛑 ¡CONFIRMADO!\n\nLa base de datos NO es '" + odooConfig.db + "'.\n\nNombres encontrados:\n" + data.result.join("\n") + "\n\nPor favor, actualiza el campo de base de datos en configuración con el nombre correcto.");
                return;
            }
        } catch (e) {
            console.warn("Fallo detección DB con proxy:", endpoint.split('/')[2]);
        }
    }
}

// Helper genérico para llamadas a modelos Odoo
async function odooCall(model, method, args = [], kwargs = {}) {
    if (!odooConfig.url) throw new Error("URL de Odoo no configurada.");

    if (!odooConfig.uid) {
        await authenticateOdoo();
    }

    const proxies = getOdooProxies(odooConfig.url);
    const payload = {
        jsonrpc: "2.0",
        method: "call",
        params: {
            service: "object",
            method: "execute_kw",
            args: [
                odooConfig.db,
                odooConfig.uid,
                odooConfig.apiKey,
                model,
                method,
                args,
                kwargs
            ]
        },
        id: Math.floor(Math.random() * 1000)
    };

    let lastError = null;
    for (const endpoint of proxies) {
        try {
            console.log(`Llamada Odoo vía: ${endpoint.split('/')[2]}...`);
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) continue;

            const data = await response.json();
            if (data.error) {
                console.error("[Odoo Result Error]", data.error);
                throw new Error(data.error.data?.message || data.error.message || "Error en respuesta de Odoo");
            }
            return data.result;
        } catch (err) {
            console.warn(`Error en proxy ${endpoint.split('/')[2]}:`, err.message);
            lastError = err;
            if (err.message.includes("Odoo") || err.message.includes("result") || err.message.includes("execute_kw")) throw err;
        }
    }

    throw new Error("Fallo final de conexión con Odoo: " + (lastError ? lastError.message : "Error de red tras agotar proxies."));
}

// Función temporal para descubrir IDs de almacenes
async function discoverOdooLocations() {
    console.log("Buscando ubicaciones...");
    // Buscamos todas las ubicaciones internas
    const locations = await odooCall('stock.location', 'search_read',
        [[['usage', '=', 'internal']]],
        { fields: ['id', 'complete_name', 'name'], limit: 20 }
    );

    console.log("Ubicaciones encontradas en Odoo:", locations);

    // Mostrar al usuario para que nos diga los IDs (temporal)
    // En producción esto se haría automático o config
    let msg = "Ubicaciones detectadas en Odoo:\n";
    locations.forEach(l => msg += `ID: ${l.id} | ${l.complete_name}\n`);
    alert(msg);
}

// Mapeo de IDs de Almacenes (Confirmados)
const ODOO_WAREHOUSES = {
    'anaco': 58,
    'caracas': 64,
    'lecheria': 52,
    'urbina': 82
};

async function fetchOdooStock() {
    const warehouseSelect = document.getElementById('warehouse-select');
    const selectedWarehouse = warehouseSelect ? warehouseSelect.value : 'lecheria';
    const locationId = ODOO_WAREHOUSES[selectedWarehouse] || 52; // Default Lechería

    console.log(`Obteniendo stock para ${selectedWarehouse} (ID: ${locationId})...`);

    // UI Loading
    const btn = document.querySelector('[onclick="syncOdoo()"]');
    if (btn) btn.innerText = "⏳ Descargando datos...";

    try {
        // Consultar stock.quant para obtener cantidades a mano y reservadas
        // Filtramos por location_id y asegurar que sea producto almacenable
        const domain = [
            ['location_id', '=', locationId],
            ['quantity', '>', 0] // Solo lo que tiene stock positivo
        ];

        const fields = ['product_id', 'quantity', 'reserved_quantity', 'product_uom_id'];

        const stockData = await odooCall('stock.quant', 'search_read', [domain], { fields: fields, limit: 500 });

        console.log("Datos de Odoo recibidos:", stockData);

        // Procesar datos para la tabla
        // Mapeamos por nombre de producto para cruzar con nuestro catálogo
        const odooMap = {};
        stockData.forEach(item => {
            // item.product_id es ej: [123, "Cable Fibra 24h"]
            const productName = item.product_id[1];
            if (!odooMap[productName]) {
                odooMap[productName] = {
                    qty: 0,
                    reserved: 0,
                    uom: item.product_uom_id[1]
                };
            }
            odooMap[productName].qty += item.quantity;
            odooMap[productName].reserved += item.reserved_quantity;
        });

        // Renderizar tabla con datos reales
        renderInventoryTable(odooMap);
        alert(`✅ Datos actualizados de Odoo.\nArtículos encontrados: ${stockData.length}`);

    } catch (error) {
        console.error("Error fetching stock:", error);
        alert(" Error al traer stock: " + error.message);
    } finally {
        if (btn) btn.innerText = "🔄 Sincronizar Odoo";
    }
}

async function findPriceField() {
    try {
        if (!odooConfig.uid) await authenticateOdoo();

        const model = 'product.product';
        console.log(`Inspecting model: ${model}`);

        // Fetch all field definitions
        const fields = await odooCall(model, 'fields_get', [], { attributes: ['string', 'type', 'name'] });

        // Search for likely candidates - EXPANDED SEARCH
        let candidates = [];
        let allPriceFields = [];

        for (const [key, val] of Object.entries(fields)) {
            const label = val.string.toLowerCase();
            const fieldName = key.toLowerCase();

            // Collect all price-related fields for logging
            if (val.type === 'monetary' || val.type === 'float') {
                allPriceFields.push(`${key} ("${val.string}") - Type: ${val.type}`);
            }

            // Search for USD/$ price fields
            if ((label.includes('precio') && label.includes('$')) ||
                (label.includes('venta') && label.includes('$')) ||
                (label.includes('price') && label.includes('$')) ||
                (label.includes('usd')) ||
                (fieldName.includes('usd')) ||
                (fieldName.includes('price') && fieldName.includes('usd'))) {
                candidates.push(`${key} ("${val.string}") - Type: ${val.type}`);
            }
        }

        console.log("=== TODOS LOS CAMPOS DE PRECIO ===");
        allPriceFields.forEach(f => console.log(f));

        if (candidates.length > 0) {
            alert("✅ Campos con USD/$ Encontrados:\n\n" + candidates.join('\n') + "\n\nRevisa la consola para ver TODOS los campos de precio.");
            console.log("=== CANDIDATOS USD ===");
            console.log(candidates);
        } else {
            alert("⚠️ No encontré un campo exacto con '$' o 'USD'.\n\nRevisa la consola para ver TODOS los campos de precio disponibles.");
        }

    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
    }
}

// Global cache for client-side filtering
let allOdooProducts = [];
let allStockMap = {};
let isFetchingOdoo = false; // Flag para evitar múltiples peticiones concurrentes

async function fetchOdooProducts(isAuto = false) {
    if (isFetchingOdoo) return;
    isFetchingOdoo = true;

    const tbody = document.getElementById('odoo-products-body');
    const btn = document.querySelector('[onclick="fetchOdooProducts()"]');

    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px;">⏳ Cargando catálogo, stock y movimientos... ${isAuto ? '(Automático)' : ''}</td></tr>`;
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Descargando...";
    }

    // Verify Config
    if (!odooConfig.url || !odooConfig.db || !odooConfig.username || !odooConfig.apiKey) {
        alert("⚠️ Falta configuración de Odoo.\nPor favor ve a 'Configuración' y guarda tus credenciales.");
        if (btn) { btn.disabled = false; btn.innerText = "📥 Cargar Catálogo Odoo"; }
        return;
    }

    try {
        if (!odooConfig.uid) {
            await authenticateOdoo();
        }

        console.log("Consultando catálogo de productos...");

        // 1. Fetch Products
        const domain = [['priority', '=', '1']];
        const fields = ['default_code', 'name', 'display_name', 'categ_id', 'list_price', 'lst_price', 'list_price_usd', 'standard_price', 'uom_id', 'qty_available', 'outgoing_qty', 'product_tmpl_id'];

        // Pass context with pricelist: 3 to get dynamic USD prices
        const ctx = { pricelist: 3, quantity: 1 };
        const initialProducts = await odooCall('product.product', 'search_read', [domain], {
            fields: fields,
            limit: 1000,
            context: ctx
        });

        // ESTRATEGIA DE RESPALDO: Obtener precios de product.template
        const templateIds = [...new Set(initialProducts.map(p => p.product_tmpl_id ? p.product_tmpl_id[0] : null).filter(id => id))];

        let templatePrices = {};
        if (templateIds.length > 0) {
            try {
                const templates = await odooCall('product.template', 'read', [templateIds], {
                    fields: ['list_price_usd']
                });
                templates.forEach(t => {
                    templatePrices[t.id] = t.list_price_usd;
                });
            } catch (err) {
                console.error("Error cargando precios de plantillas (Main):", err);
            }
        }

        // Combinar datos y aplicar margen
        const products = initialProducts.map(p => {
            let finalPrice = p.list_price_usd;
            if ((!finalPrice || finalPrice === 0) && p.product_tmpl_id) {
                const tId = p.product_tmpl_id[0];
                finalPrice = templatePrices[tId] || 0;
            }

            // APLICAR MARGEN (1.37)
            if (finalPrice) {
                finalPrice = finalPrice * 1.37;
            }

            return { ...p, list_price_usd: finalPrice };
        });

        console.log("Catálogo Odoo cargado con Tarifa USD (ID 3).");

        // 2. Fetch Detailed Stock (Quants) - ON HAND
        const productIds = products.map(p => p.id);
        const stockDomain = [
            ['product_id', 'in', productIds],
            ['location_id.usage', '=', 'internal']
            // Removed ['quantity', '>', 0] to see negative stock or zero stock with moves
        ];
        const stockFields = ['product_id', 'location_id', 'quantity'];
        const stockData = await odooCall('stock.quant', 'search_read', [stockDomain], { fields: stockFields });

        // 3. Fetch Pending Moves - OUTGOING
        const moveDomain = [
            ['product_id', 'in', productIds],
            ['state', 'in', ['confirmed', 'assigned', 'partially_available']],
            ['location_id.usage', '=', 'internal'],
            ['location_dest_id.usage', '=', 'customer']
        ];
        const moveFields = ['product_id', 'location_id', 'product_uom_qty'];
        const moveData = await odooCall('stock.move', 'search_read', [moveDomain], { fields: moveFields });

        // 4. Fetch Pending Moves - INCOMING (New)
        const inDomain = [
            ['product_id', 'in', productIds],
            ['state', 'in', ['confirmed', 'assigned', 'partially_available', 'waiting']], // Waiting availability too
            ['location_dest_id.usage', '=', 'internal'], // Dest is our warehouse
            ['location_id.usage', '!=', 'internal'] // Source is NOT internal (e.g. Vendor, Adjustment)
        ];
        const inFields = ['product_id', 'location_dest_id', 'product_uom_qty'];
        const inData = await odooCall('stock.move', 'search_read', [inDomain], { fields: inFields });

        // 5. Merge Data: Map by Product -> Location
        const tempMap = {}; // { pid: { locId: { name, onHand, outgoing, incoming } } }
        console.log("Productos Odoo RAW:", products);

        const ensureEntry = (pid, locId, locName) => {
            if (!tempMap[pid]) tempMap[pid] = {};
            if (!tempMap[pid][locId]) tempMap[pid][locId] = { name: locName, onHand: 0, outgoing: 0, incoming: 0 };
        };

        // Process Quants (On Hand)
        stockData.forEach(q => {
            const pid = q.product_id[0];
            const locId = q.location_id[0];
            const locName = q.location_id[1];
            const qty = q.quantity;
            ensureEntry(pid, locId, locName);
            tempMap[pid][locId].onHand += qty;
        });

        // Process Moves (Outgoing)
        moveData.forEach(m => {
            const pid = m.product_id[0];
            const locId = m.location_id[0];
            const locName = m.location_id[1];
            const qty = m.product_uom_qty;
            ensureEntry(pid, locId, locName);
            tempMap[pid][locId].outgoing += qty;
        });

        // Process Moves (Incoming)
        inData.forEach(m => {
            const pid = m.product_id[0];
            const locId = m.location_dest_id[0]; // Use DEST location for incoming
            const locName = m.location_dest_id[1];
            const qty = m.product_uom_qty;
            ensureEntry(pid, locId, locName);
            tempMap[pid][locId].incoming += qty;
        });

        // Convert to array format for renderer
        const stockMap = {};
        for (const pid in tempMap) {
            stockMap[pid] = Object.values(tempMap[pid]).map(item => {
                return {
                    loc: item.name,
                    qty: item.onHand,
                    net: item.onHand - item.outgoing,
                    onHand: item.onHand,
                    outgoing: item.outgoing,
                    incoming: item.incoming
                };
            });
        }

        // Store in global cache
        allOdooProducts = products.map(p => ({
            ...p,
            // Ensure we use the most accurate sales price field
            list_price: p.lst_price !== undefined ? p.lst_price : p.list_price
        }));
        allStockMap = stockMap;

        console.log(`Recibidos ${products.length} productos, ${stockData.length} quants, ${moveData.length} moves.`);
        renderOdooProductsTable(allOdooProducts, stockMap);

        // Refresh Page 4 (BOM) if it's active
        if (window.finalReportState && window.finalReportState.length > 0) {
            renderCotizacionTable();
        }

        alert(`✅ Catálogo actualizado y movimientos calculados.\n\nAhora puedes buscar productos en "Agregar Producto Extra".`);

    } catch (error) {
        console.error("Error fetching odoo products:", error);
        alert(`❌ Error al cargar productos: ${error.message}\n\nPosibles causas:\n1. URL de Odoo incorrecta (debe ser sin 'http' si usas proxy, o revisa https).\n2. Error de CORS (el proxy corsproxy.io puede estar fallando).\n3. Credenciales inválidas.`);
    } finally {
        isFetchingOdoo = false;
        if (btn) {
            btn.disabled = false;
            btn.innerText = "🔄 Actualizar Catálogo";
        }
    }
}

window.showIncomingModal = function (locationName, qty) {
    const existing = document.getElementById('custom-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'custom-modal-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.5); z-index: 9999;
        display: flex; justify-content: center; align-items: center;
        backdrop-filter: blur(2px);
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white; padding: 24px; border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        width: 300px; text-align: center; font-family: sans-serif;
        animation: fadeIn 0.15s ease-out;
    `;

    modal.innerHTML = `
        <div style="font-size: 32px; margin-bottom: 10px;">📦</div>
        <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px;">Stock Entrante</h3>
        <p style="margin: 0 0 20px 0; color: #64748b; font-size: 13px;">Ubicación: <strong>${locationName}</strong></p>
        
        <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
            <span style="display: block; font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700;">Cantidad Esperada</span>
            <span style="font-size: 24px; font-weight: 800; color: #0f172a;">
                ${Number(qty).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
        </div>

        <button onclick="document.getElementById('custom-modal-overlay').remove()" 
            style="background: #0f172a; color: white; border: none; padding: 8px 20px; 
            border-radius: 6px; font-weight: 600; cursor: pointer; width: 100%; font-size: 13px;">
            Entendido
        </button>
    `;

    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    if (!document.getElementById('modal-styles')) {
        const style = document.createElement('style');
        style.id = 'modal-styles';
        style.textContent = `@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`;
        document.head.appendChild(style);
    }
};

window.showIncomingStockDetails = function (itemName, incomingLocs) {
    const existing = document.getElementById('custom-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'custom-modal-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.5); z-index: 9999;
        display: flex; justify-content: center; align-items: center;
        backdrop-filter: blur(2px);
    `;

    // Helper para limpiar nombres
    const clean = (name) => {
        return name.replace('LEC/Existencias', 'LECHERIA')
            .replace('CCS/Existencias', 'CARACAS')
            .replace('Urbin/Existencias', 'URBINA')
            .split('/').pop().replace('Stock', '').trim();
    };

    let locsHtml = Object.entries(incomingLocs).map(([name, qty]) => `
        <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px dashed #e2e8f0;">
            <span style="color: #64748b; font-weight: 600;">${clean(name)}:</span>
            <span style="color: #059669; font-weight: 800;">+ ${Math.floor(qty)}</span>
        </div>
    `).join('');

    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white; padding: 24px; border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        width: 350px; font-family: 'Inter', sans-serif;
        animation: fadeIn 0.15s ease-out;
    `;

    modal.innerHTML = `
        <div style="text-align: center; margin-bottom: 15px;">
            <div style="font-size: 32px;">🚚</div>
            <h3 style="margin: 10px 0 5px 0; color: #1e293b; font-size: 16px;">Detalle de Mercancía en Camino</h3>
            <p style="margin: 0; color: #64748b; font-size: 12px;">Desglose por almacén de destino:</p>
        </div>
        
        <div style="background: #f8fafc; padding: 10px 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #f1f5f9;">
            <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Producto</div>
            <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 2px;">${itemName}</div>
        </div>

        <div style="margin-bottom: 25px;">
            ${locsHtml || '<p style="text-align:center; color:#94a3b8; font-size:12px;">No hay almacenes registrados.</p>'}
        </div>

        <button onclick="document.getElementById('custom-modal-overlay').remove()" 
            style="background: #0f172a; color: white; border: none; padding: 10px 20px; 
            border-radius: 8px; font-weight: 700; cursor: pointer; width: 100%; font-size: 13px; transition: all 0.2s;"
            onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background='#0f172a'">
            Entendido
        </button>
    `;

    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
};

function filterOdooProducts() {
    const term = document.getElementById('odoo-search-input').value.toLowerCase();

    const filtered = allOdooProducts.filter(p => {
        const name = (p.name || '').toLowerCase();
        const ref = (p.default_code || '').toLowerCase();
        return name.includes(term) || ref.includes(term);
    });

    renderOdooProductsTable(filtered, allStockMap);
}

function renderOdooProductsTable(products, stockMap) {
    const tbody = document.getElementById('odoo-products-body');

    // Update Counter
    const countEl = document.getElementById('odoo-product-count');
    if (countEl) countEl.innerText = `(${products ? products.length : 0})`;

    if (!products || products.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">No se encontraron productos.</td></tr>`;
        return;
    }

    // Ensure toggle function is global
    window.toggleStock = function (id) {
        const el = document.getElementById(`stock-detail-${id}`);
        // Close all others first (optional but cleaner)
        document.querySelectorAll('.stock-dropdown').forEach(d => {
            if (d.id !== `stock-detail-${id}`) d.style.display = 'none';
        });

        if (el) {
            el.style.display = el.style.display === 'none' ? 'block' : 'none';
        }
    };

    if (tbody) {
        tbody.innerHTML = products.map(p => {
            const categoryName = p.categ_id ? p.categ_id[1] : 'Sin Categoría';
            const price = p.list_price || 0;

            // Calculate Net Available: On Hand (qty_available) - Outgoing (outgoing_qty)
            const inHand = p.qty_available || 0;
            const outgoing = p.outgoing_qty || 0;
            const netAvailable = inHand - outgoing;

            // Detailed Stock Calculation (for dropdown)
            const stocks = stockMap[p.id] || [];

            let stockHtml = '';

            if (inHand !== 0 || outgoing !== 0 || stocks.length > 0) {
                // Dropdown Content
                let listHtml = '';

                if (stocks.length > 0) {
                    listHtml += stocks.map(s => {
                        let shortLoc = s.loc.replace(/^Physical Locations\//, '').replace(/^Ubicaciones Físicas\//, '').replace(/^Partner Locations\//, '')
                            .replace('LEC/Existencias', 'LECHERIA')
                            .replace('CCS/Existencias', 'CARACAS')
                            .replace('Urbin/Existencias', 'URBINA');

                        const color = s.net < 0 ? '#ef4444' : '#0f172a';
                        const weight = s.net < 0 ? '800' : '600';

                        return `
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #e2e8f0; padding: 6px 4px;">
                                <div style="display:flex; align-items:center;">
                                    <button onclick="event.stopPropagation(); showIncomingModal('${shortLoc}', ${s.incoming})" 
                                        style="margin-right:6px; border:none; background:#ecfdf5; color:#059669; font-size:10px; padding:2px 4px; border-radius:4px; cursor:pointer;" 
                                        title="Ver Entrante">📥</button>
                                    <div style="display:flex; flex-direction:column; max-width: 65%;">
                                        <span style="color: #475569; font-size: 11px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${s.loc}">${shortLoc}</span>
                                        <span style="font-size: 9px; color: #94a3b8;">(Fís: ${s.onHand} | Resv: ${s.outgoing})</span>
                                    </div>
                                </div>
                                <span style="font-weight: ${weight}; color: ${color}; font-size: 11px;">${s.net}</span>
                            </div>`;
                    }).join('');
                } else {
                    listHtml += `<div style="padding:4px; font-size:11px; color:#64748b;">Sin stock detallado</div>`;
                }

                // Button Color Logic
                let btnBg = '#e0f2fe'; let btnColor = '#0369a1'; let btnBorder = '#7dd3fc';
                if (netAvailable <= 0) {
                    btnBg = '#fee2e2'; btnColor = '#b91c1c'; btnBorder = '#fca5a5';
                }

                // Button + Dropdown Container
                stockHtml = `
                    <div style="position: relative;">
                        <button onclick="toggleStock('${p.id}')" 
                            style="background: ${btnBg}; color: ${btnColor}; border: 1px solid ${btnBorder}; border-radius: 4px; padding: 4px 8px; font-weight: 700; cursor: pointer; font-size: 11px; display: flex; align-items: center; gap: 4px; width: 100%; justify-content: center;">
                            <span>${netAvailable} Uds</span>
                            <span>▼</span>
                        </button>
                        <div id="stock-detail-${p.id}" class="stock-dropdown" 
                            style="display: none; position: absolute; top: 100%; right: 0; background: white; border: 1px solid #cbd5e1; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border-radius: 6px; padding: 8px; min-width: 150px; z-index: 50; text-align: left;">
                            ${listHtml}
                        </div>
                    </div>
                `;
            } else {
                stockHtml = `<span style="color: #ef4444; font-weight: 700; font-size: 12px;">AGOTADO</span>`;
            }

            return `
                <tr>
                    <td style="font-family: monospace; font-size: 12px; color: #64748b;">${p.default_code || '--'}</td>
                    <td style="font-weight: 600; color: #0f172a;">${p.name}</td>
                    <td style="font-size: 12px; color: #475569;">${categoryName}</td>
                    <td style="vertical-align: middle; text-align: center;">${stockHtml}</td>
                </tr>
            `;
        }).join('');

        // FIX: Add empty space at the bottom to ensure dropdowns don't get clipped
        tbody.innerHTML += `
            <tr class="padding-row">
                <td colspan="4" style="height: 150px; border: none;"></td>
            </tr>
        `;
    }
}

function renderInventoryTable(odooData = null) {
    // Debug Visual para el usuario
    // alert("Intentando renderizar tabla..."); 

    const warehouseSelect = document.getElementById('warehouse-select');
    if (!warehouseSelect) {
        console.error("Falta ID: warehouse-select");
        return;
    }

    const warehouse = warehouseSelect.value;
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) {
        console.error("Falta ID: inventory-table-body");
        return;
    }

    tbody.innerHTML = ''; // Limpiar tabla


    // Mock items based on catalogoNetso categories
    // En el futuro esto vendrá de Odoo API filtrado por warehouse

    // Flatten catalog for table
    let inventoryItems = [];

    if (!catalogoNetso) {
        console.error("Catalogo es NULL");
        return;
    }

    let totalItems = 0;

    // Validar estructura base (Soporte para ambas estructuras de datos)
    let dataToIterate = catalogoNetso;
    if (catalogoNetso.categorias) {
        dataToIterate = catalogoNetso.categorias;
    }

    const categories = Object.keys(dataToIterate);

    if (categories.length > 0) {
        categories.forEach(categoryKey => {
            const subCategories = dataToIterate[categoryKey];

            // Validar que la categoría sea un objeto (tiene subcategorías)
            // Ignoramos llaves metadata como 'empresa' si se colaron
            if (typeof subCategories !== 'object' || subCategories === null) {
                return;
            }

            Object.keys(subCategories).forEach(subCatKey => {
                const items = subCategories[subCatKey];

                if (Array.isArray(items)) {
                    items.forEach(item => {
                        // Lógica de Stock: Odoo vs Simulación
                        let stock = 0;
                        let reserved = 0;
                        let isRealData = false;

                        if (odooData) {
                            let odooItem = odooData[item];
                            if (!odooItem) {
                                const key = Object.keys(odooData).find(k => k.toLowerCase() === item.toLowerCase());
                                if (key) odooItem = odooData[key];
                            }
                            if (odooItem) {
                                stock = odooItem.qty;
                                reserved = odooItem.reserved;
                                isRealData = true;
                            }
                        } else {
                            // Fallback Simulación
                            const seed = item.length;
                            stock = seed * 5 + 10;
                            reserved = Math.ceil(stock * 0.1);
                        }

                        const available = stock - reserved;

                        inventoryItems.push({
                            sku: "NET-" + (isRealData ? "ODOO" : "SIM") + "-" + Math.floor(Math.random() * 1000),
                            name: item,
                            category: `${categoryKey} / ${subCatKey}`.replace(/_/g, ' '),
                            stock: stock,
                            reserved: reserved,
                            available: available,
                            source: isRealData ? 'Odoo' : 'Simulado'
                        });
                    });
                }
            });
        });
    }

    // alert(`Renderizando ${totalItems} items. (Catalogo: ${categories.length} cats)`); // Debug Visual

    if (inventoryItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">Cargando catálogo... (o vacío)</td></tr>';
        return;
    }

    inventoryItems.forEach(item => {
        let statusBadge = '';
        if (item.available > 50) statusBadge = '<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:800;">EN STOCK</span>';
        else if (item.available > 10) statusBadge = '<span style="background:#fef9c3; color:#854d0e; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:800;">BAJO MIN</span>';
        else statusBadge = '<span style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:800;">AGOTADO</span>';

        const row = `
            <tr>
                <td style="font-family:monospace; color:#64748b; font-size:11px;">${item.sku}</td>
                <td style="font-weight:600; color:#334155;">${item.name}</td>
                <td style="font-size:11px; color:#64748b; text-transform:capitalize;">${item.category}</td>
                <td style="text-align:center;">${item.stock}</td>
                <td style="text-align:center; color:#64748b;">${item.reserved}</td>
                <td style="text-align:center; font-weight:800; color:#0f172a;">${item.available}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// ============================================
// PDF REPORT GENERATION
// ============================================
function downloadPdfReport_Old(projectId) {
    const project = allProjectsCache.find(p => p.id === projectId);
    if (!project) {
        alert("Error: Proyecto no encontrado en caché.");
        return;
    }

    // 1. Crear contenedor temporal invisible
    const reportContainer = document.createElement('div');
    reportContainer.id = 'pdf-report-temp';
    reportContainer.style.background = 'white';
    reportContainer.style.padding = '40px';
    reportContainer.style.fontFamily = 'Arial, sans-serif';
    reportContainer.style.width = '800px'; // A4 width approx

    // 2. Generar Contenido HTML
    let aiImagesHtml = '';
    // INCLUIR IMÁGENES DE IA
    if (project.analysisImages && project.analysisImages.length > 0) {
        aiImagesHtml = `
            <div style="page-break-before: always; margin-top: 30px;">
            <h3 style="color: #475569; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px;">Anexo Fotográfico IA</h3>
            <p style="font-size: 13px; color: #64748b;">Análisis automatizado de infraestructura existente.</p>
            <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-top: 20px;">
        `;

        project.analysisImages.forEach(img => {
            // Check if base64 or URL
            const isBase64 = img.data.startsWith('data:image');
            aiImagesHtml += `
                <div style="width: 45%; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px;">
                    <img src="${img.data}" style="width: 100%; height: auto; border-radius: 4px; display: block;">
                    <div style="margin-top: 8px; font-size: 11px; color: #334155;">
                        <strong>Objetos Detectados:</strong> ${img.detections || 'N/A'}
                    </div>
                </div>
            `;
        });

        aiImagesHtml += `</div></div>`;
    }

    // Resumen Técnico (Agrupado)
    // DETECCIÓN DE MATERIALES PRINCIPALES PARA EL TEXTO
    let mainFiber = "Fibra Óptica Monomodo G.652D"; // Default profesional
    let splitterTech = "splitters de baja pérdida";

    if (project.reportData) {
        // Encontrar la fibra con mayor longitud para mencionarla como principal
        const fibers = project.reportData.filter(i => (i.material || i.item).toLowerCase().includes('fibra'));
        if (fibers.length > 0) {
            // Ordenar por cantidad descendente
            fibers.sort((a, b) => (parseFloat(b.cantidad) || 0) - (parseFloat(a.cantidad) || 0));
            // Usar el nombre de la fibra principal (limpiando comas o extras)
            mainFiber = (fibers[0].material || fibers[0].item).replace(/,/g, '').trim();
        }

        // Detectar si hay splitters específicos
        const splitters = project.reportData.find(i => (i.material || i.item).toLowerCase().includes('splitter'));
        if (splitters) {
            splitterTech = "Splitters Ópticos PLC Balanceados";
        }
    }

    // Aquí implementamos la lógica de "Resumen Técnico" vs "Detalle"
    // Simulamos agrupación por ahora basada en el reportData existente

    let technicalSummaryHtml = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px;">
            <thead>
                <tr style="background-color: #f1f5f9; color: #1e293b;">
                    <th style="padding: 8px; text-align: left; border-bottom: 2px solid #cbd5e1;">Concepto</th>
                    <th style="padding: 8px; text-align: right; border-bottom: 2px solid #cbd5e1;">Cantidad Estimada</th>
                </tr>
            </thead>
            <tbody>
    `;

    // Lógica simple de agrupación para el PDF
    const categories = {
        'Fibra': 0,
        'Cajas NAP': 0,
        'Postes': 0,
        'Herrajes': 0
    };

    if (project.reportData) {
        project.reportData.forEach(item => {
            const name = (item.material || item.item || '').toLowerCase();
            const qty = parseFloat(item.cantidad || item.required) || 0;

            if (name.includes('fibra') || name.includes('cable')) categories['Fibra'] += qty;
            else if (name.includes('caja') || name.includes('nap') || name.includes('distrib')) categories['Cajas NAP'] += qty;
            else if (name.includes('poste') || name.includes('apoyo')) categories['Postes'] += qty;
            else categories['Herrajes'] += qty;
        });
    }

    technicalSummaryHtml += `
        <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Red de Fibra Óptica (Metros)</td><td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0;">${categories['Fibra'].toFixed(2)} m</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Cajas de Distribución (NAPs)</td><td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0;">${Math.ceil(categories['Cajas NAP'])} u</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Total Postes Afectados</td><td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0;">${Math.ceil(categories['Postes'])} u</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Accesorios y Herrajes Varios</td><td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0;">${Math.ceil(categories['Herrajes'])} u</td></tr>
    `;

    technicalSummaryHtml += `</tbody></table>`;

    const dateStr = new Date(project.date).toLocaleDateString();

    reportContainer.innerHTML = `
        <div style="text-align: center; margin-bottom: 40px;">
            <img src="Netso Imagotipo Negro-Verde (2).png" alt="Netso" style="height: 50px; width: auto;">
            <div style="font-size: 14px; color: #64748b; margin-top: 5px;">Plataforma de Diseño FTTH Inteligente</div>
        </div>

        <h1 style="color: #1e293b; font-size: 24px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px;">
            Propuesta Técnica
        </h1>

        <div style="margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #475569;">Información del Proyecto</h3>
            <p><strong>Cliente / ISP:</strong> ${project.ispName || 'Aliado ISPs'}</p>
            <p><strong>Proyecto:</strong> ${project.projectName || 'Sin nombre'}</p>
            <p><strong>Fecha de Diseño:</strong> ${dateStr}</p>
            <p><strong>Estado:</strong> ${project.status === 'completed' ? 'Diseño Completado' : 'Borrador'}</p>
        </div>

        <div style="margin-bottom: 30px;">
            <h3 style="color: #475569;">Análisis de Mercado y Factibilidad Técnica</h3>
            
            <p style="font-size: 13px; line-height: 1.6; color: #334155; margin-bottom: 12px; text-align: justify;">
                <strong>Escalabilidad y Optimización del CAPEX:</strong> La implementación de infraestructura basada en fibra óptica <strong>${mainFiber}</strong> y materiales certificados por Netso permite maximizar la densidad de abonados por puerto PON, optimizando la inversión inicial. Esta arquitectura modular facilita la expansión futura sin necesidad de reingeniería costosa, asegurando una reducción significativa en los costos operativos (OPEX) a largo plazo.
            </p>

            <p style="font-size: 13px; line-height: 1.6; color: #334155; margin-bottom: 12px; text-align: justify;">
                <strong>Competitividad y Calidad de Servicio (QoS):</strong> La integración de <strong>${splitterTech}</strong> y el diseño validado mediante algoritmos de IA garantizan un presupuesto de potencia óptica óptimo en toda la red de distribución. Esto se traduce en una latencia mínima y una alta disponibilidad del servicio, otorgando una ventaja competitiva tangible frente a otros proveedores en la zona.
            </p>

            <p style="font-size: 13px; line-height: 1.6; color: #334155; text-align: justify;">
                <strong>Retorno de Inversión (ROI) y Sostenibilidad:</strong> La robustez de la red es crítica para asegurar la continuidad del servicio y minimizar gastos de mantenimiento correctivo. Los materiales propuestos cuentan con protección avanzada contra factores climáticos (UV, humedad), lo que evita la degradación prematura y re-despliegues costosos, acelerando así el retorno de inversión y garantizando una infraestructura sostenible.
            </p>
        </div>

        <div style="margin-bottom: 30px;">
            <h3 style="color: #475569;">Resumen de Infraestructura Pasiva</h3>
            <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                A continuación se presenta un resumen técnico de los recursos necesarios para la implementación de la red FTTH proyectada. 
                Este documento sirve como referencia técnica preliminar basada en un diseño de topología árbol/estrella estándar.
            </p>
            ${technicalSummaryHtml}
        </div>

        ${aiImagesHtml}

        <div style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
            Generado automáticamente por Netso | ${new Date().getFullYear()}
        </div>
    `;

    // 3. Renderizar PDF
    const opt = {
        margin: 10,
        filename: `Propuesta_${project.projectName || 'Netso'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Usar html2pdf worker
    html2pdf().set(opt).from(reportContainer).save().then(() => {
        console.log("PDF Generado exitosamente");
    }).catch(err => {
        console.error("Error PDF:", err);
        alert("Error generando PDF. Revisa consola.");
    });
}

function downloadPdfFromWizard() {
    // 1. Recopilar datos del DOM (igual que al guardar)
    const projectName = document.getElementById('projectName').value || 'Proyecto Sin Nombre';
    // FIX: Usar 'censo' y 'coverageRadius'
    const censoEl = document.getElementById('censo');
    const clients = censoEl ? censoEl.value : 0;

    const radiusEl = document.getElementById('coverageRadius');
    const radius = radiusEl ? radiusEl.value : 0;
    const reportData = generateReportData(); // Usa la misma función que el Excel

    // Obtener imágenes del análisis actual si existen
    let analysisImages = [];
    // Intentamos recuperar las imágenes del estado actual si es posible
    if (currentAnalysisImages && currentAnalysisImages.length > 0) {
        analysisImages = currentAnalysisImages;
    }

    // 2. Construir objeto de proyecto temporal
    const tempProject = {
        id: 'temp-' + Date.now(),
        projectName: projectName,
        ispName: (currentUser && currentUser.company) ? currentUser.company : 'Usuario Netso',
        date: new Date().toISOString(),
        status: 'draft',
        reportData: reportData,
        analysisImages: analysisImages,
        clients: clients,
        radius: radius
    };

    // 3. Generar PDF
    downloadPdfReport(null, tempProject);
}
// ============================================
// PDF REPORT GENERATION (PREMIUM V2)
// ============================================
function downloadPdfReport(projectId, directProjectData = null) {
    let project;

    if (directProjectData) {
        project = directProjectData;
    } else {
        project = allProjectsCache.find(p => p.id === projectId);
    }

    if (!project) {
        alert("Error: Proyecto no encontrado.");
        return;
    }

    // 1. Crear contenedor temporal invisible
    const reportContainer = document.createElement('div');
    reportContainer.id = 'pdf-report-temp';

    // 2. Generar Contenido HTML Mejorado
    // Lógica dinámica de textos
    let mainFiber = "Fibra Óptica Monomodo G.652D";
    let splitterTech = "splitters de baja pérdida";

    if (project.reportData) {
        const fibers = project.reportData.filter(i => (i.material || i.item).toLowerCase().includes('fibra'));
        if (fibers.length > 0) {
            fibers.sort((a, b) => (parseFloat(b.cantidad) || 0) - (parseFloat(a.cantidad) || 0));
            mainFiber = (fibers[0].material || fibers[0].item).replace(/,/g, '').trim();
        }
        const splitters = project.reportData.find(i => (i.material || i.item).toLowerCase().includes('splitter'));
        if (splitters) splitterTech = "Splitters Ópticos PLC Balanceados";
    }

    // Tabla Resumen Logic
    // Tabla Resumen Logic
    const categories = { 'Fibra': 0, 'Cajas NAP': 0, 'Postes': 0, 'Herrajes': 0 };
    let isEstimation = false;

    if (project.reportData && project.reportData.length > 0) {
        // DATA REAL
        project.reportData.forEach(item => {
            const name = (item.material || item.item || '').toLowerCase();
            const qty = parseFloat(item.cantidad || item.required) || 0;
            if (name.includes('fibra') || name.includes('cable')) categories['Fibra'] += qty;
            else if (name.includes('caja') || name.includes('nap') || name.includes('distrib')) categories['Cajas NAP'] += qty;
            else if (name.includes('poste') || name.includes('apoyo')) categories['Postes'] += qty;
            else categories['Herrajes'] += qty;
        });
    } else {
        // DATA ESTIMADA (FALLBACK)
        isEstimation = true;
        const netClients = parseInt(project.clients) || 0;
        const netRadius = parseFloat(project.radius) || 0; // Asumimos metros si es > 10, sino km... usually inputs are vague. Let's assume input is standard meters or we interpret.
        // Si el valor es muy pequeño (<10), probablemente sea KM.
        let radiusMeters = netRadius;
        if (netRadius < 50) radiusMeters = netRadius * 1000;

        // Fórmulas de Estimación Netso
        categories['Fibra'] = radiusMeters * 1.35 * 4; // Factor de Distribución + Feeder
        categories['Cajas NAP'] = Math.ceil(netClients / 16); // Split 1:16
        categories['Postes'] = Math.ceil(categories['Fibra'] / 35); // Vano promedio 35m
        categories['Herrajes'] = categories['Postes'] * 1.2; // 20% extra por cruces/remates
    }

    // Lógica imágenes IA
    let aiImagesHtml = '';
    if (project.analysisImages && project.analysisImages.length > 0) {
        aiImagesHtml = `
            <div style="page-break-before: always;">
            <h3 class="section-title">📡 Anexo: Auditoría IA de Infraestructura</h3>
            <p class="section-subtitle">Evidencia fotográfica y análisis automatizado de activos existentes.</p>
            <div class="gallery-grid">
        `;
        project.analysisImages.forEach(img => {
            aiImagesHtml += `
                <div class="gallery-item">
                    <img src="${img.data}" class="gallery-img">
                    <div class="gallery-caption">
                        <strong>Detección:</strong> ${img.detections || 'N/A'}
                    </div>
                </div>
            `;
        });
        aiImagesHtml += `</div></div>`;
    }

    const dateStr = new Date(project.date).toLocaleDateString();

    reportContainer.innerHTML = `
        <style>
            #pdf-report-temp { font-family: 'Helvetica', 'Arial', sans-serif; color: #334155; line-height: 1.5; width: 800px; background: white; padding: 0; }
            .header-banner { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 30px; border-radius: 0 0 12px 12px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: center; }
            .brand-name { font-size: 32px; font-weight: 800; letter-spacing: -1px; }
            .brand-sub { font-size: 14px; opacity: 0.8; font-weight: normal; }
            .doc-title { text-align: right; }
            .doc-type { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; }
            .doc-name { font-size: 24px; font-weight: bold; margin: 0; }
            
            .content-wrapper { padding: 0 40px 40px 40px; }

            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .info-card { background: #f8fafc; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; }
            .info-label { font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 1px; margin-bottom: 4px; }
            .info-value { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 15px; }
            .info-value:last-child { margin-bottom: 0; }

            .section-title { font-size: 18px; color: #0f172a; border-left: 4px solid #3b82f6; padding-left: 15px; margin-bottom: 10px; font-weight: 700; }
            .section-subtitle { font-size: 13px; color: #64748b; margin-bottom: 20px; padding-left: 19px; }
            
            .analysis-box { text-align: justify; font-size: 13px; color: #475569; columns: 2; column-gap: 40px; }
            .analysis-item { margin-bottom: 20px; break-inside: avoid; }
            .analysis-item strong { color: #0f172a; display: block; margin-bottom: 6px; font-size: 14px; }

            .tech-table { width: 100%; border-collapse: separate; border-spacing: 0; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 10px; }
            .tech-table th { background: #f1f5f9; color: #475569; font-weight: 600; font-size: 12px; text-transform: uppercase; padding: 12px 20px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            .tech-table td { padding: 12px 20px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #334155; }
            .tech-table tr:last-child td { border-bottom: none; }
            .tech-table tr:nth-child(even) { background: #f8fafc; }
            .val-col { text-align: right; font-weight: 700; color: #0f172a; }

            .gallery-grid { display: flex; flex-wrap: wrap; gap: 15px; }
            .gallery-item { width: 48%; break-inside: avoid; border: 1px solid #e2e8f0; padding: 8px; border-radius: 8px; background: white; }
            .gallery-img { width: 100%; height: 200px; object-fit: cover; border-radius: 4px; }
            .gallery-caption { margin-top: 8px; font-size: 11px; color: #64748b; }

            .footer { margin-top: 60px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        </style>

        <!-- Header Premium -->
        <div class="header-banner">
            <div style="margin-left: 40px;">
                <img src="Netso Imagotipo Negro-Verde (2).png" alt="Netso" style="height: 60px; width: auto;">
                <div class="brand-sub">Ingeniería FTTH & Suministros</div>
            </div>
            <div class="doc-title" style="margin-right: 40px;">
                <div class="doc-type">Propuesta Técnica</div>
                <div class="doc-name">Diseño de Red</div>
            </div>
        </div>

        <div class="content-wrapper">
            <!-- Info Grid -->
            <div class="grid-2">
                <div class="info-card">
                    <div class="info-label">Cliente / Aliado</div>
                    <div class="info-value">${project.ispName || 'Aliado ISPs'}</div>
                    
                    <div class="info-label">Proyecto</div>
                    <div class="info-value">${project.projectName || 'Sin nombre'}</div>
                </div>
                <div class="info-card">
                    <div class="info-label">Fecha de Emisión</div>
                    <div class="info-value">${dateStr}</div>
                    
                    <div class="info-label">Estado del Diseño</div>
                    <div class="info-value" style="color: ${project.status === 'completed' ? '#16a34a' : '#ea580c'}">
                        ${project.status === 'completed' ? '✅ Finalizado & Validado' : '⚠️ Borrador Preliminar'}
                    </div>
                </div>
            </div>

            <!-- Market Analysis (Magazine Style) -->
            <div style="margin-bottom: 50px;">
                <h3 class="section-title">Análisis de Factibilidad & Mercado</h3>
                <p class="section-subtitle">Justificación técnica y económica para la inversión en infraestructura.</p>
                
                <div class="analysis-box">
                    <div class="analysis-item">
                        <strong>🚀 Escalabilidad y CAPEX</strong>
                        La implementación basada en <b>${mainFiber}</b> permite maximizar la densidad de abonados por puerto PON. Esta arquitectura modular facilita la expansión sin reingeniería, optimizando la inversión inicial.
                    </div>
                    <div class="analysis-item">
                        <strong>⚡ Competitividad (QoS)</strong>
                        Integrando infraestructura de <b>${splitterTech}</b> y materiales certificados, garantizamos un presupuesto óptico superior. Esto se traduce en latencia mínima y ventaja real frente a la competencia.
                    </div>
                    <div class="analysis-item">
                        <strong>🛡️ ROI y Sostenibilidad</strong>
                        La robustez de los materiales certificados Netso (protección UV/Clima) minimiza el mantenimiento correctivo y evita re-despliegues, acelerando el retorno de inversión de la red desplegada.
                    </div>
                </div>
            </div>

            <!-- Tech Summary Table -->
            <div style="margin-bottom: 40px; page-break-inside: avoid;">
                <h3 class="section-title">Resumen de Infraestructura Pasiva</h3>
                <table class="tech-table">
                    <thead>
                        <tr>
                            <th>Recurso de Red</th>
                            <th style="text-align: right;">Volumen Estimado</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Red de Fibra Óptica (Metros Lineales)</td><td class="val-col">${categories['Fibra'].toFixed(2)} m</td></tr>
                        <tr><td>Nodos de Distribución (Cajas NAP)</td><td class="val-col">${Math.ceil(categories['Cajas NAP'])} u</td></tr>
                        <tr><td>Infraestructura de Apoyo (Postes)</td><td class="val-col">${Math.ceil(categories['Postes'])} u</td></tr>
                        <tr><td>Ferretería y Accesorios de Anclaje</td><td class="val-col">${Math.ceil(categories['Herrajes'])} u</td></tr>
                    </tbody>
                </table>
                <p style="font-size: 11px; color: #94a3b8; text-align: right; margin-top: 5px;">
                    ${isEstimation ? '* ESTIMACIÓN TEÓRICA basada en parámetros del proyecto (Sin auditoría detallada).' : '* Cantidades sujetas a validación en campo.'}
                </p>
            </div>

            ${aiImagesHtml}

            <!-- Footer -->
            <div class="footer">
                Documento generado electrónicamente por la plataforma <strong>Netso Planning</strong>.<br>
                Este diseño es propiedad intelectual de Netso y sus aliados.
            </div>
        </div>
    `;

    // 3. Renderizar PDF
    const opt = {
        margin: 0, // Zero margin here because we handle padding in CSS
        filename: `Propuesta_Premium_${project.projectName || 'Netso'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(reportContainer).save().then(() => {
        console.log("PDF Premium Generado");
    }).catch(err => {
        console.error("Error PDF:", err);
    });
}

// ==========================================
// NUEVO: LÓGICA DE SELECCIÓN DE PROYECTO Y COTIZADOR DIRECTO
// ==========================================

let selectedProjectType = null;
let quoteItems = [];
let allOdooProductsCache = [];

// --- SELECCIÓN DE PROYECTO ---

window.selectProjectType = function (type) {
    selectedProjectType = type;

    // Feedback Visual
    const cardA = document.getElementById('card-assistant');
    const cardB = document.getElementById('card-direct');

    if (type === 'assistant') {
        cardA.style.borderColor = '#3b82f6';
        cardA.style.background = '#eff6ff';
        cardB.style.borderColor = '#e2e8f0';
        cardB.style.background = 'white';
    } else {
        cardB.style.borderColor = '#3b82f6';
        cardB.style.background = '#eff6ff';
        cardA.style.borderColor = '#e2e8f0';
        cardA.style.background = 'white';
    }

    // Habilitar botón
    const btn = document.getElementById('btn-start-project');
    if (btn) {
        btn.style.opacity = '1';
        btn.disabled = false;
    }
};

window.startSelectedFlow = async function () {
    const projectName = document.getElementById('projectName').value;
    if (!projectName || projectName.trim() === '') {
        alert("⚠️ Por favor, asigna un nombre al proyecto antes de continuar.");
        return;
    }

    if (!selectedProjectType) {
        alert("⚠️ Selecciona una opción: ¿Asistente o Cotizador?");
        return;
    }

    if (selectedProjectType === 'assistant') {
        nextPage(2); // Flujo normal de auditoria
    } else {
        // Flujo Cotizador Directo
        document.getElementById('page1').style.display = 'none';
        document.getElementById('page-direct-quote').style.display = 'block';

        // Hide progress bar and step label in Direct Quote mode
        const progressBar = document.querySelector('.progress-bar');
        const stepLabel = document.getElementById('step-label');
        if (progressBar) progressBar.style.display = 'none';
        if (stepLabel) stepLabel.style.display = 'none';

        await loadProductsForQuote();
    }
};

window.backToProjectSelect = function () {
    document.getElementById('page-direct-quote').style.display = 'none';
    document.getElementById('page1').style.display = 'block';

    // Restore progress bar and step label when leaving Direct Quote mode
    const progressBar = document.querySelector('.progress-bar');
    const stepLabel = document.getElementById('step-label');
    if (progressBar) progressBar.style.display = 'flex';
    if (stepLabel) stepLabel.style.display = 'block';
};

// --- COTIZADOR DIRECTO ---

async function loadProductsForQuote() {
    if (allOdooProductsCache.length > 0) return;

    // Cargar productos vendibles
    try {
        if (!odooConfig.uid) {
            await authenticateOdoo();
        }

        const domain = [['sale_ok', '=', true]];
        const fields = ['display_name', 'list_price', 'list_price_usd', 'standard_price', 'default_code', 'id', 'product_tmpl_id'];

        // Cargar con contexto de Tarifa USD para precios consistentes
        const initialProducts = await odooCall('product.product', 'search_read', [domain], {
            fields: fields,
            limit: 2000,
            context: { pricelist: 3 }
        });

        // ESTRATEGIA DE RESPALDO: Obtener precios de product.template
        // Si list_price_usd viene en 0 en la variante, buscamos en la plantilla
        const templateIds = [...new Set(initialProducts.map(p => p.product_tmpl_id ? p.product_tmpl_id[0] : null).filter(id => id))];

        let templatePrices = {};
        if (templateIds.length > 0) {
            try {
                const templates = await odooCall('product.template', 'read', [templateIds], {
                    fields: ['list_price_usd']
                });
                templates.forEach(t => {
                    templatePrices[t.id] = t.list_price_usd;
                });
                console.log(`Precios de ${templates.length} plantillas cargados para corrección.`);
            } catch (err) {
                console.error("Error cargando precios de plantillas:", err);
            }
        }

        // Combinar datos y asegurar precio
        allOdooProductsCache = initialProducts.map(p => {
            let finalPrice = p.list_price_usd;
            // Si no tiene precio en variante, usar el de la plantilla
            if ((!finalPrice || finalPrice === 0) && p.product_tmpl_id) {
                const tId = p.product_tmpl_id[0];
                finalPrice = templatePrices[tId] || 0;
            }

            // APLICAR MARGEN DE GANANCIA (1.37)
            if (finalPrice) {
                finalPrice = finalPrice * 1.37;
            }

            return { ...p, list_price_usd: finalPrice };
        });

        console.log("Productos para cotizador cargados y corregidos (Variante + Plantilla).");
    } catch (e) {
        console.error("Error cargando productos:", e);
        // Mostrar error real
        alert("Error de conexión con Odoo:\n" + e.message);
    }
}

window.searchDirectProduct = function () {
    const term = document.getElementById('direct-quote-search').value.toLowerCase();
    const resultsDiv = document.getElementById('direct-search-results');

    if (term.length < 2) {
        resultsDiv.style.display = 'none';
        return;
    }

    const matches = allOdooProductsCache.filter(p =>
        (p.display_name && p.display_name.toLowerCase().includes(term)) ||
        (p.default_code && p.default_code.toLowerCase().includes(term))
    ).slice(0, 10);

    if (matches.length > 0) {
        resultsDiv.innerHTML = matches.map(p => {
            const safeName = p.display_name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const price = p.list_price_usd || 0;
            return `
                <div onclick="selectQuoteProduct('${p.id}', '${safeName}', ${price})" 
                    style="padding: 10px; cursor: pointer; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;"
                    onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                    <span style="font-size: 13px; font-weight: 600; color: #334155;">${p.display_name}</span>
                    <span style="font-size: 12px; color: #059669; font-weight: 700;">$ ${price.toFixed(2)}</span>
                </div>
            `;
        }).join('');
        resultsDiv.style.display = 'block';
    } else {
        resultsDiv.style.display = 'none';
    }
};

let currentSelectedProduct = null;

window.selectQuoteProduct = function (id, name, price) {
    currentSelectedProduct = { id, name, price };
    // Des-escapar &quot; para mostrarlo bien en el input si es necesario
    const displayName = name.replace(/&quot;/g, '"');
    document.getElementById('direct-quote-search').value = displayName;
    document.getElementById('direct-search-results').style.display = 'none';

    // Set default quantity to 1 if empty or 0
    const qtyInput = document.getElementById('direct-quote-qty');
    if (!qtyInput.value || parseFloat(qtyInput.value) <= 0) {
        qtyInput.value = "1";
    }

    qtyInput.focus();
};

window.addToQuote = function () {
    const qtyInput = document.getElementById('direct-quote-qty');
    const qty = parseFloat(qtyInput.value);

    if (!currentSelectedProduct) {
        alert("⚠️ Primero selecciona un producto de la lista.");
        return;
    }
    if (!qty || qty <= 0) {
        alert("⚠️ Ingresa una cantidad válida.");
        return;
    }

    quoteItems.push({
        ...currentSelectedProduct,
        qty: qty,
        total: currentSelectedProduct.price * qty
    });

    // Reset inputs
    document.getElementById('direct-quote-search').value = '';
    qtyInput.value = '';
    currentSelectedProduct = null;

    renderQuoteTable();
};

window.removeQuoteItem = function (index) {
    if (confirm("¿Eliminar este item?")) {
        quoteItems.splice(index, 1);
        renderQuoteTable();
    }
};

function renderQuoteTable() {
    const tbody = document.getElementById('quote-table-body');
    const totalDisplay = document.getElementById('quote-total-display');

    if (quoteItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 30px;">Tu lista está vacía. Agrega productos arriba.</td></tr>`;
        totalDisplay.innerText = "$ 0,00";
        return;
    }

    let totalGlobal = 0;

    tbody.innerHTML = quoteItems.map((item, index) => {
        totalGlobal += item.total;
        return `
            <tr>
                <td style="font-size: 13px; color: #334155;">${item.name}</td>
                <td style="text-align: center; font-weight: 600;">${item.qty}</td>
                <td style="text-align: right; color: #64748b;">$ ${item.price.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                <td style="text-align: right; font-weight: 700; color: #0f172a;">$ ${item.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                <td style="text-align: center;">
                    <button onclick="removeQuoteItem(${index})" style="color: #ef4444; background: none; border: none; cursor: pointer; font-size: 16px;">&times;</button>
                </td>
            </tr>
        `;
    }).join('');

    totalDisplay.innerText = "$ " + totalGlobal.toLocaleString('es-ES', { minimumFractionDigits: 2 });
}

window.generateDirectPDF = function () {
    if (quoteItems.length === 0) {
        alert("⚠️ No hay items para cotizar.");
        return;
    }

    const doc = new jspdf.jsPDF();
    const projectName = document.getElementById('projectName').value || "Cotización Rápida";

    // Header
    doc.setFillColor(15, 23, 42); // #0f172a
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("COTIZACIÓN", 14, 25);

    doc.setFontSize(10);
    doc.text("Netso Solutions", 200, 20, { align: 'right' });
    doc.text("Gestión Integral de Proyectos", 200, 25, { align: 'right' });

    // Info Project
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Proyecto: ${projectName}`, 14, 55);

    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 62);

    // Table Header
    let yPos = 75;
    doc.setFillColor(241, 245, 249); // #f1f5f9
    doc.rect(14, yPos - 5, 182, 10, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("DESCRIPCIÓN", 16, yPos + 1);
    doc.text("CANT.", 130, yPos + 1, { align: 'right' });
    doc.text("UNITARIO", 160, yPos + 1, { align: 'right' });
    doc.text("TOTAL", 190, yPos + 1, { align: 'right' });

    yPos += 10;

    let totalGlobal = 0;

    quoteItems.forEach(item => {
        totalGlobal += item.total;

        // Rows
        doc.setFont("helvetica", "normal");
        const nameLines = doc.splitTextToSize(item.name, 110);
        doc.text(nameLines, 16, yPos);

        doc.text(item.qty.toString(), 130, yPos, { align: 'right' });
        doc.text(`$ ${item.price.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, 160, yPos, { align: 'right' });
        doc.text(`$ ${item.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, 190, yPos, { align: 'right' });

        yPos += (nameLines.length * 5) + 3;
    });

    // Total
    doc.setLineWidth(0.5);
    doc.line(14, yPos, 196, yPos);
    yPos += 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL GENERAL: $ ${totalGlobal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, 190, yPos, { align: 'right' });

    doc.save(`${projectName.replace(/\s+/g, '_')}_Cotizacion.pdf`);
};

// ==========================================
// NAVIGATION REPAIR
// ==========================================


window.generateDirectExcel = function () {
    if (quoteItems.length === 0) {
        alert("⚠️ No hay items para cotizar.");
        return;
    }

    const projectName = document.getElementById('projectName').value || "Cotización Rápida";
    const ispName = (currentUser && currentUser.company) ? currentUser.company : 'Cliente';
    const dateStr = new Date().toLocaleDateString();

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

    quoteItems.forEach((item, index) => {
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
    const blob = new Blob(['\uFEFF', excelContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
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
};

window.saveDirectQuote = async function () {
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
        uid: auth.currentUser ? auth.currentUser.uid : 'anonymous',
        userEmail: auth.currentUser ? (auth.currentUser.email || '') : '',
        projectName: projectName,
        date: new Date().toISOString(),
        type: 'direct', // Distinguir del asistente
        status: 'draft',
        quoteItems: quoteItems, // Array de items
        ispName: (currentUser && currentUser.company) ? currentUser.company : (currentUser && currentUser.name ? currentUser.name : 'Cliente')
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


window.downloadDirectQuoteFromHistory = async function (id) {
    const project = allProjectsCache.find(p => p.id === id);

    if (!project || !project.quoteItems) {
        alert("❌ Error: Datos del proyecto no encontrados.");
        return;
    }

    // Ensure Odoo Products are loaded for mapping
    if (!allOdooProducts || allOdooProducts.length === 0) {
        console.log("No Odoo products loaded. Fetching...");
        try {
            await fetchOdooProducts();
        } catch (e) {
            console.warn("Could not fetch Odoo products for report:", e);
        }
    }

    const items = project.quoteItems;
    const projectName = project.projectName || "Cotización";
    const ispName = project.ispName || "Cliente";
    const dateStr = new Date(project.date).toLocaleDateString();

    let excelContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Calibri, Arial, sans-serif; }
                td { border: 1px solid #cbd5e1; padding: 5px; vertical-align: middle; }
                .header { background-color: #1e293b; color: white; font-weight: bold; text-align: center; }
                .col-head { background-color: #334155; color: white; font-weight: bold; text-align: center; }
                .text-center { text-align: center; }
                .amount { text-align: right; }
                .bg-header { background-color: #f1f5f9; font-weight: bold; }
                .odoo-match { color: #0f172a; font-weight: 600; }
                .no-match { color: #94a3b8; font-style: italic; }
            </style>
        </head>
        <body>
            <table>
                <tr><td colspan="6" class="header" style="font-size:18px;">COTIZACIÓN DIRECTA - NETSO</td></tr>
                <tr><td colspan="6" class="bg-header" style="text-align:center;">${ispName} | ${projectName.toUpperCase()}</td></tr>
                <tr><td colspan="6" style="text-align:center; font-size:11px;">Generado: ${dateStr}</td></tr>
                <tr><td colspan="6"></td></tr>

                <tr style="height: 30px;">
                    <td class="col-head" style="width:300px;">PRODUCTO / MATERIAL</td>
                    <td class="col-head" style="width:300px;">PRODUCTO ODOO (MATCH)</td>
                    <td class="col-head" style="width:100px;">CANTIDAD</td>
                    <td class="col-head" style="width:120px;">UNITARIO ($)</td>
                    <td class="col-head" style="width:120px;">TOTAL ($)</td>
                    <td class="col-head" style="width:120px; background:#15803d;">STOCK DISP.</td>
                </tr>
    `;

    let totalGlobal = 0;

    items.forEach(item => {
        totalGlobal += item.total;

        // Odoo Matching Logic
        let odooName = '---';
        let netsoStock = 0;

        if (allOdooProducts.length > 0) {
            const searchName = item.name.toLowerCase();
            let bestMatch = allOdooProducts.find(p => p.name.toLowerCase() === searchName); // Exact first

            if (!bestMatch) {
                // Fuzzy Fallback
                bestMatch = allOdooProducts.find(p => {
                    const pName = p.name.toLowerCase();
                    return pName.includes(searchName);
                });
            }

            if (bestMatch) {
                odooName = bestMatch.name;
                netsoStock = bestMatch.qty_available;
            }
        }

        const matchClass = odooName !== '---' ? 'odoo-match' : 'no-match';

        excelContent += `
            <tr>
                <td>${item.name}</td>
                <td class="${matchClass}">${odooName}</td>
                <td class="text-center" style="font-weight:bold;">${item.qty}</td>
                <td class="amount">$ ${item.price.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                <td class="amount" style="font-weight:bold;">$ ${item.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                <td class="text-center" style="font-weight:bold; color:#15803d;">${netsoStock}</td>
            </tr>
        `;
    });

    excelContent += `
        <tr><td colspan="6" style="border:none; height:10px;"></td></tr>
        <tr style="background-color: #f1f5f9; font-weight: bold;">
            <td colspan="4" style="text-align: right; padding-right: 15px;">TOTAL GENERAL:</td>
            <td class="amount" style="color: #0f172a; font-size: 16px;">$ ${totalGlobal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
            <td></td>
        </tr>
    `;

    excelContent += `</table></body></html>`;

    const filename = `${projectName.replace(/\s+/g, '_')}_Cotizacion.xls`;
    const blob = new Blob(['\uFEFF', excelContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 100);
};

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}


window.downloadSavedReport = async function (id) {
    const project = allProjectsCache.find(p => p.id === id);

    if (!project || !project.reportData) {
        alert("❌ Error: Reporte no encontrado.");
        return;
    }

    // Ensure Odoo Products are loaded for mapping
    if (!allOdooProducts || allOdooProducts.length === 0) {
        // Try to fetch silently if possible, or warn
        console.log("No Odoo products loaded. Fetching...");
        try {
            await fetchOdooProducts();
        } catch (e) {
            console.warn("Could not fetch Odoo products for report:", e);
        }
    }

    const projectName = project.projectName || "Reporte";
    const ispName = project.ispName || "ISP";
    const dateStr = new Date(project.date).toLocaleString();

    let excelContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="UTF-8">
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>Plan de Compra</x:Name>
                            <x:WorksheetOptions>
                                <x:DisplayGridlines/>
                            </x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <style>
                body { font-family: Calibri, Arial, sans-serif; }
                td { border: 1px solid #cbd5e1; padding: 5px; vertical-align: middle; }
                .header { background-color: #1e293b; color: white; font-weight: bold; text-align: center; }
                .col-head { background-color: #334155; color: white; font-weight: bold; text-align: center; }
                .text-center { text-align: center; }
                .buy-yes { background-color: #fee2e2; color: #b91c1c; font-weight: bold; }
                .buy-no { background-color: #f0fdf4; color: #15803d; }
                .odoo-match { color: #0f172a; font-weight: 600; }
                .no-match { color: #94a3b8; font-style: italic; }
                .stock-netso { font-weight: bold; color: #0f172a; }
            </style>
        </head>
        <body>
            <table>
                <tr><td colspan="8" class="header" style="font-size:18px;">🛒 PLAN DE COMPRA - INTEGRACIÓN ODOO</td></tr>
                <tr><td colspan="8" style="text-align:center; background:#f1f5f9;">Proyecto: <strong>${projectName}</strong> - Cliente: <strong>${ispName}</strong></td></tr>
                <tr><td colspan="8" style="text-align:center; font-size:11px;">Generado: ${dateStr}</td></tr>
                <tr><td colspan="8"></td></tr>
                
                <tr style="height: 30px;">
                    <td class="col-head" style="width:250px;">ITEM CALCULADO (INGENIERÍA)</td>
                    <td class="col-head" style="width:350px;">PRODUCTO ODOO (MATCH)</td>
                    <td class="col-head" style="width:100px;">STOCK ISP</td>
                    <td class="col-head" style="width:100px;">SUGERIDO</td>
                    <td class="col-head" style="width:120px; background:#b91c1c;">A COMPRAR</td>
                    <td class="col-head" style="width:100px; background:#15803d;">STOCK NETSO</td>
                    <td class="col-head" style="width:120px;">PRECIO UNIT. ($)</td>
                    <td class="col-head" style="width:120px; background:#f8fafc; color:#0f172a;">TOTAL ($)</td>
                </tr>
    `;


    let totalEstimadoGlobal = 0;

    project.reportData.forEach(item => {
        // Handle property name variations (historical data compatibility)
        const qty = item.qty !== undefined ? item.qty : (item.cantidad !== undefined ? item.cantidad : 0);
        const stock = item.stock !== undefined ? item.stock : (item.stockUser !== undefined ? item.stockUser : 0);

        // Recalculate toBuy to ensure accuracy
        let toBuy = qty - stock;
        if (toBuy < 0) toBuy = 0;

        // Re-calculate Logic for report (similar to downloadComparisonReport)
        // If the saved item has Odoo data attached, use it. Otherwise, try to map it live.

        let odooName = '---';
        let netsoStock = 0;
        let price = 0;

        if (allOdooProducts.length > 0) {
            const searchName = (item.item || item.name || '').toLowerCase();
            const exactMappedName = PRODUCT_MAPPING[item.item || item.name];
            let bestMatch = null;

            if (exactMappedName) {
                bestMatch = allOdooProducts.find(p => p.name === exactMappedName);
            }

            if (!bestMatch) {
                bestMatch = allOdooProducts.find(p => {
                    const pName = p.name.toLowerCase();
                    if (pName.includes(searchName)) return true;
                    // Specific Maps
                    if (searchName.includes('manga') && pName.includes('manga') && pName.includes('24')) return true;
                    if (searchName.includes('adss 48') && pName.includes('adss') && pName.includes('48')) return true;
                    if (searchName.includes('nap 16') && pName.includes('nap') && pName.includes('16')) return true;
                    return false;
                });
            }

            if (bestMatch) {
                odooName = bestMatch.name;
                netsoStock = bestMatch.qty_available;
                price = bestMatch.list_price || 0;
            }
        }

        const matchClass = odooName !== '---' ? 'odoo-match' : 'no-match';
        const buyClass = toBuy > 0 ? 'buy-yes' : 'buy-no';
        const itemTotal = toBuy * price;
        totalEstimadoGlobal += itemTotal;

        excelContent += `
            <tr>
                <td>${item.item || item.name}</td>
                <td class="${matchClass}">${odooName}</td>
                <td class="text-center">${stock}</td>
                <td class="text-center" style="font-weight:bold;">${qty}</td>
                <td class="text-center ${buyClass}" style="${toBuy > 0 ? 'background-color: #fee2e2;' : ''}">${toBuy}</td>
                <td class="text-center stock-netso">${netsoStock}</td>
                <td class="text-center">$ ${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td class="text-center" style="font-weight:bold;">$ ${itemTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
    });

    // Fila de Total Global
    excelContent += `
        <tr><td colspan="8" style="border:none; height:10px;"></td></tr>
        <tr style="background:#f1f5f9; font-weight:bold;">
            <td colspan="7" style="text-align:right; padding:10px;">TOTAL ESTIMADO DE COMPRA (ODOO):</td>
            <td style="text-align:center; font-size:14px; color:#0f172a;">$ ${totalEstimadoGlobal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
    `;

    excelContent += `</table></body></html>`;

    const blob = new Blob(['\uFEFF', excelContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectName.replace(/\s+/g, '_')}_Ingenieria.xls`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 100);
};

window.downloadPdfReport = function (id) {
    const project = allProjectsCache.find(p => p.id === id);

    if (!project || !project.reportData) {
        alert("❌ Error: Reporte no encontrado.");
        return;
    }

    const doc = new jspdf.jsPDF();
    const projectName = project.projectName || "Reporte";

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255);
    doc.setFontSize(18);
    doc.text("REPORTE DE MATERIALES", 14, 20);

    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text(`Proyecto: ${projectName}`, 14, 45);
    doc.text(`Fecha: ${new Date(project.date).toLocaleDateString()}`, 14, 52);

    let yPos = 65;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, yPos - 6, 182, 8, 'F');
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("ITEM", 16, yPos);
    doc.text("REQ", 140, yPos, { align: 'right' });
    doc.text("STOCK", 165, yPos, { align: 'right' });
    doc.text("COMPRAR", 190, yPos, { align: 'right' });
    yPos += 8;

    project.reportData.forEach(item => {
        let toBuy = item.qty - (item.stock || 0);
        if (toBuy < 0) toBuy = 0;

        doc.setFont("helvetica", "normal");
        const nameLines = doc.splitTextToSize(item.item, 110);
        doc.text(nameLines, 16, yPos);
        doc.text(item.qty.toString(), 140, yPos, { align: 'right' });
        doc.text((item.stock || 0).toString(), 165, yPos, { align: 'right' });
        doc.setFont("helvetica", "bold");
        doc.text(toBuy.toString(), 190, yPos, { align: 'right' });

        yPos += (nameLines.length * 5) + 3;

        if (yPos > 280) {
            doc.addPage();
            yPos = 20;
        }
    });

    doc.save(`${projectName.replace(/\s+/g, '_')}_Materiales.pdf`);
};

// NUEVA FUNCIÓN: Denegar/Ocultar Sugerencia
function dismissSuggestion(elementId) {
    const card = document.getElementById(elementId);
    if (card) {
        card.style.opacity = '0.5';
        setTimeout(() => {
            card.remove();
        }, 300);
    }
}


// ==========================================
// RESTORED NAVIGATION LOGIC
// ==========================================
// Removed duplicate declaration of selectedProjectType to avoid SyntaxError
// let selectedProjectType = null; 

function selectProjectType(type) {
    selectedProjectType = type;
    document.querySelectorAll('.project-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById(`card-${type}`);
    if (card) card.classList.add('selected');

    // Enable button
    const btn = document.getElementById('btn-start-project');
    if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    }
    console.log("Proyecto seleccionado:", type);
}

function startSelectedFlow() {
    console.log("Iniciando flujo:", selectedProjectType);
    // Safe check if selectedProjectType is defined
    if (typeof selectedProjectType !== 'undefined' && !selectedProjectType) {
        alert("⚠️ Por favor selecciona una opción para continuar (Asistente AI o Manual).");
        return;
    } else if (typeof selectedProjectType === 'undefined') {
        console.error("selectedProjectType is undefined!");
        return;
    }

    // Hide dashboard / selection
    const dash = document.getElementById('netso-dashboard');
    if (dash) dash.style.display = 'none';

    // Show Page 1
    const p1 = document.getElementById('page1');
    if (p1) p1.style.display = 'block';

    // Update step indicator
    if (typeof updateStepIndicator === 'function') {
        updateStepIndicator(1);
    } else {
        // Fallback implementation if global function missing
        const steps = document.querySelectorAll('.step-item');
        steps.forEach((s, idx) => {
            if (idx + 1 === 1) s.classList.add('active');
            else s.classList.remove('active');
        });
    }

    window.scrollTo(0, 0);
}

// Ensure updateStepIndicator is available globally if not already
if (typeof window.updateStepIndicator === 'undefined') {
    window.updateStepIndicator = function (step) {
        const steps = document.querySelectorAll('.step-item');
        steps.forEach((s, idx) => {
            if (idx + 1 === step) s.classList.add('active');
            else if (idx + 1 < step) s.classList.add('completed'); // Optional style
            else s.classList.remove('active');
        });
    };
}


// ==========================================
// OLT OPTIMIZER (Restored)
// ==========================================
// ==========================================
// OLT OPTIMIZER (Advanced Multi-Objective Algorithm)
// ==========================================

/**
 * Advanced OLT Optimizer for FTTH Networks
 * Implements multi-objective optimization with:
 * - Weighted centroid calculation (density + plan value)
 * - Candidate generation (5-6 locations)
 * - Multi-factor scoring (distance 40%, cost 30%, accessibility 20%, scalability 10%)
 * - GPON technical validation (20km range, 27dB optical budget)
 */
class OLT_Optimizer {
    constructor(clients, options = {}) {
        this.clients = clients || [];
        this.options = {
            country: options.country || 'CO', // Default Colombia
            maxGponRange: options.maxGponRange || (options.country === 'CO' ? 18 : 20), // km (18km for CO)
            maxOpticalBudget: options.maxOpticalBudget || 27, // dB
            maxDropDistance: options.maxDropDistance || 0.5, // km (500m)
            candidateOffset: options.candidateOffset || (options.country === 'CO' ? 0.3 : 0.5), // km (0.3km for CO)
            backhaul: options.backhaul || null, // {lat, lng} if available
            zonaType: options.zonaType || null, // 'urbana', 'suburbana', 'rural' (autodetected if null)
            ...options
        };
    }

    // ==========================================
    // STEP 1: Simple Centroid Calculation
    // ==========================================
    calculateSimpleCentroid() {
        if (this.clients.length === 0) return null;

        let sumLat = 0, sumLng = 0;
        this.clients.forEach(c => {
            sumLat += c.lat;
            sumLng += c.lng;
        });

        return {
            lat: sumLat / this.clients.length,
            lng: sumLng / this.clients.length
        };
    }

    // ==========================================
    // UTILITY: Haversine Distance (Precise)
    // ==========================================
    static haversineDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Alias for backward compatibility
    static getDistanceKm(lat1, lng1, lat2, lng2) {
        return OLT_Optimizer.haversineDistance(lat1, lng1, lat2, lng2);
    }

    // ==========================================
    // STEP 2: Client Weighting
    // ==========================================
    calculateClientWeights() {
        return this.clients.map(client => {
            // Plan factor: basic=1.0, medium=1.5, premium=2.0
            let planFactor = 1.0;
            if (client.plan === 'medium') planFactor = 1.5;
            else if (client.plan === 'premium') planFactor = 2.0;

            // Density factor: count nearby clients within 200m
            const nearby = this.countNearbyClients(client, 0.2);
            let densityFactor = 1.0;
            if (nearby >= 5) densityFactor = 1.5;
            else if (nearby >= 2) densityFactor = 1.2;

            return {
                clientId: client.id,
                weight: planFactor * densityFactor,
                planFactor,
                densityFactor,
                nearbyCount: nearby
            };
        });
    }

    countNearbyClients(client, radiusKm = 0.2) {
        let count = 0;
        this.clients.forEach(c => {
            if (c.id !== client.id) {
                const dist = OLT_Optimizer.haversineDistance(client.lat, client.lng, c.lat, c.lng);
                if (dist <= radiusKm) count++;
            }
        });
        return count;
    }

    calculateWeightedCentroid() {
        if (this.clients.length === 0) return null;

        const weights = this.calculateClientWeights();
        let sumLat = 0, sumLng = 0, sumWeight = 0;

        this.clients.forEach((client, idx) => {
            const weight = weights[idx].weight;
            sumLat += client.lat * weight;
            sumLng += client.lng * weight;
            sumWeight += weight;
        });

        if (sumWeight === 0) return this.calculateSimpleCentroid();

        return {
            lat: sumLat / sumWeight,
            lng: sumLng / sumWeight
        };
    }

    // ==========================================
    // STEP 3: Generate Candidate Locations
    // ==========================================
    generateCandidateLocations() {
        const center = this.calculateWeightedCentroid();
        if (!center) return [];

        const offsetKm = this.options.candidateOffset;
        // 1 degree lat ≈ 111 km
        const latOffset = offsetKm / 111;
        // Adjust lng offset by latitude
        const lngOffset = offsetKm / (111 * Math.cos(center.lat * Math.PI / 180));

        const candidates = [
            { name: 'Centroide Ponderado', lat: center.lat, lng: center.lng, type: 'centroid' },
            { name: 'Norte (+500m)', lat: center.lat + latOffset, lng: center.lng, type: 'offset_n' },
            { name: 'Sur (-500m)', lat: center.lat - latOffset, lng: center.lng, type: 'offset_s' },
            { name: 'Este (+500m)', lat: center.lat, lng: center.lng + lngOffset, type: 'offset_e' },
            { name: 'Oeste (-500m)', lat: center.lat, lng: center.lng - lngOffset, type: 'offset_w' }
        ];

        // Add backhaul candidate if available
        if (this.options.backhaul) {
            candidates.push({
                name: 'Cerca de Backhaul',
                lat: this.options.backhaul.lat,
                lng: this.options.backhaul.lng,
                type: 'backhaul'
            });
        }

        return candidates;
    }

    // ==========================================
    // SCORE CANDIDATE (SYNC VERSION - FOR REAL-TIME DRAG)
    // ==========================================
    scoreCandidateSync(candidate) {
        // Skip async accessibility check for speed
        const distanceScore = this.calculateDistanceScore(candidate);
        const costScore = this.calculateCostScore(candidate);
        const accessibilityScore = 50; // Default average for visual feedback
        const scalabilityScore = this.calculateScalabilityScore(candidate);

        const totalScore = (
            0.40 * distanceScore +
            0.30 * costScore +
            0.20 * accessibilityScore +
            0.10 * scalabilityScore
        );

        return {
            ...candidate,
            score_total: Math.round(totalScore * 100) / 100
        };
    }

    // ==========================================
    // STEP 4: Multi-Factor Scoring System
    // ==========================================
    async scoreCandidate(candidate) {
        const distanceScore = this.calculateDistanceScore(candidate);
        const costScore = this.calculateCostScore(candidate);
        const accessibilityScore = await this.calculateAccessibilityScore(candidate);
        const scalabilityScore = this.calculateScalabilityScore(candidate);

        const totalScore = (
            0.40 * distanceScore +
            0.30 * costScore +
            0.20 * accessibilityScore +
            0.10 * scalabilityScore
        );

        return {
            ...candidate,
            score_total: Math.round(totalScore * 100) / 100,
            score_distancia: Math.round(distanceScore * 100) / 100,
            score_costo: Math.round(costScore * 100) / 100,
            score_accesibilidad: Math.round(accessibilityScore * 100) / 100,
            score_escalabilidad: Math.round(scalabilityScore * 100) / 100,
            distancia_promedio_clientes_km: this.calculateAverageDistance(candidate),
            distancia_maxima_cliente_km: this.calculateMaxDistance(candidate)
        };
    }

    calculateDistanceScore(candidate) {
        const avgDist = this.calculateAverageDistance(candidate);
        const maxDist = this.calculateMaxDistance(candidate);

        // Score based on ranges (adjusted for Colombia urban context)
        let score = 100;
        if (avgDist < 1) score = 100;
        else if (avgDist < 3) score = 90;
        else if (avgDist < 5) score = 75;
        else if (avgDist < 8) score = 60;
        else if (avgDist < 12) score = 40;
        else if (avgDist < 18) score = 20;
        else score = 5;

        // Penalize if max distance exceeds GPON limit
        if (maxDist > this.options.maxGponRange) {
            score -= 30;
        }

        return Math.max(0, score);
    }


    calculateAverageDistance(candidate) {
        if (this.clients.length === 0) return 0;

        const totalDist = this.clients.reduce((sum, client) => {
            return sum + OLT_Optimizer.haversineDistance(
                candidate.lat, candidate.lng,
                client.lat, client.lng
            );
        }, 0);

        return totalDist / this.clients.length;
    }

    calculateMaxDistance(candidate) {
        if (this.clients.length === 0) return 0;

        return Math.max(...this.clients.map(client =>
            OLT_Optimizer.haversineDistance(
                candidate.lat, candidate.lng,
                client.lat, client.lng
            )
        ));
    }

    calculateCostScore(candidate) {
        let score = 0;

        // Factor 1: Backhaul Proximity (if available)
        if (this.options.backhaul) {
            const backhaulDist = OLT_Optimizer.haversineDistance(
                candidate.lat, candidate.lng,
                this.options.backhaul.lat, this.options.backhaul.lng
            );

            if (backhaulDist < 0.5) score = 95;
            else if (backhaulDist < 2) score = 85;
            else if (backhaulDist < 5) score = 70;
            else if (backhaulDist < 10) score = 50;
            else score = 30;
        } else {
            // Factor 2: Zone Type Inference (No backhaul info)
            // Calculate density: clients / area km2
            const lats = this.clients.map(c => c.lat);
            const lngs = this.clients.map(c => c.lng);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);

            const avgLat = (minLat + maxLat) / 2;
            const heightKm = (maxLat - minLat) * 111;
            const widthKm = (maxLng - minLng) * 111 * Math.cos(avgLat * Math.PI / 180);
            const areaKm2 = Math.max(0.1, heightKm * widthKm); // Avoid div by zero

            const density = this.clients.length / areaKm2;

            // Determine zone score based on infrastructure likelihood
            if (this.clients.length > 100 || density > 50) {
                // Urban: Better electric grid, easier access
                score = 80;
            } else if (density > 10) {
                // Suburban
                score = 65;
            } else {
                // Rural
                score = 45;
            }
        }

        return score;
    }

    async calculateAccessibilityScore(candidate) {
        // Advanced: Use Google Places API if available
        if (window.google && window.google.maps && window.google.maps.places) {
            try {
                const service = new google.maps.places.PlacesService(document.createElement('div'));
                const request = {
                    location: new google.maps.LatLng(candidate.lat, candidate.lng),
                    radius: 500, // 500 meters
                    type: ['gas_station', 'atm', 'bank', 'school', 'hospital'] // Indicadores de infraestructura
                };

                // Add timeout to prevent hanging
                const places = await Promise.race([
                    new Promise((resolve) => {
                        service.nearbySearch(request, (results, status) => {
                            if (status === google.maps.places.PlacesServiceStatus.OK) {
                                resolve(results || []);
                            } else {
                                resolve([]);
                            }
                        });
                    }),
                    new Promise(resolve => setTimeout(() => {
                        // console.warn('Places API timeout');
                        resolve([]);
                    }, 2000)) // 2s timeout
                ]);

                const count = places.length;
                if (count >= 10) return 95;
                if (count >= 5) return 80;
                if (count >= 2) return 60;
                if (count >= 1) return 45;
                return 30;

            } catch (e) {
                console.warn("Error accessing Places API, using fallback:", e);
            }
        }

        // Fallback: Type-based proxy
        if (candidate.type === 'backhaul') return 90;
        if (candidate.type === 'centroid') return 80;
        return 70; // Offsets
    }

    calculateScalabilityScore(candidate) {
        const centroid = this.calculateWeightedCentroid() || this.calculateSimpleCentroid();
        if (!centroid) return 50;

        // Calculate current coverage radius (max distance from centroid)
        let coverageRadius = 0;
        this.clients.forEach(c => {
            const d = OLT_Optimizer.haversineDistance(centroid.lat, centroid.lng, c.lat, c.lng);
            if (d > coverageRadius) coverageRadius = d;
        });
        if (coverageRadius === 0) coverageRadius = 1; // Avoid div/0

        const distFromCenter = OLT_Optimizer.haversineDistance(
            candidate.lat, candidate.lng,
            centroid.lat, centroid.lng
        );

        const ratio = distFromCenter / coverageRadius;
        let score = 75; // Baseline

        if (ratio < 0.3) score = 95; // Dead center
        else if (ratio < 0.6) score = 75; // Good balance
        else if (ratio < 0.8) score = 55; // Bit far
        else score = 35; // Edge

        // Bonus: Empty space analysis (simple bounding box logic)
        // If candidate is in a sparse quadrant, we assume growth potential
        // (Simplified logic: always +10 if not at absolute edge)
        if (ratio < 0.9) score += 10;

        return Math.min(100, score);
    }

    // ==========================================
    // STEP 5: Select Optimal Location
    // ==========================================
    async selectOptimalLocation() {
        const candidates = this.generateCandidateLocations();
        if (candidates.length === 0) return null;

        // Async scoring for all candidates
        const scoredCandidates = await Promise.all(candidates.map(c => this.scoreCandidate(c)));
        scoredCandidates.sort((a, b) => b.score_total - a.score_total);

        const optimal = scoredCandidates[0];
        optimal.razon_seleccion = this.generateSelectionReason(optimal);

        // Add reasons for alternatives
        const alternatives = scoredCandidates.slice(1, 4).map(alt => {
            alt.razon_alternativa = this.generateAlternativeReason(alt, optimal);
            return alt;
        });

        return {
            ubicacion_optima: optimal,
            ubicaciones_alternativas: alternatives,
            all_candidates: scoredCandidates
        };
    }

    generateSelectionReason(candidate) {
        const score = candidate.score_total;
        let baseReason = "";

        if (score >= 85) baseReason = "Ubicación excelente: alta concentración de clientes, buena accesibilidad y espacio para crecimiento";
        else if (score >= 70) baseReason = "Ubicación buena: balance adecuado entre cercanía a clientes y factibilidad operativa";
        else if (score >= 55) baseReason = "Ubicación aceptable: cumple requisitos técnicos pero puede requerir inversión adicional";
        else baseReason = "Ubicación subóptima: considere ajustar parámetros de diseño";

        return baseReason;
    }

    generateAlternativeReason(alt, optimal) {
        if (alt.score_costo > optimal.score_costo) return "Menor costo de implementación, aunque más lejana de algunos clientes";
        if (alt.score_accesibilidad > optimal.score_accesibilidad) return "Mejor accesibilidad vial/infraestructura, facilita mantenimiento";
        if (alt.score_escalabilidad > optimal.score_escalabilidad) return "Mayor potencial de expansión futura";
        return "Alternativa viable con balance diferente de factores";
    }



    // ==========================================
    // STEP 6: Validation
    // ==========================================
    validateLocation(location) {
        const warnings = [];
        let allInRange = true;
        let farthestClient = null;
        let maxDist = 0;

        this.clients.forEach(client => {
            const dist = OLT_Optimizer.haversineDistance(
                location.lat, location.lng,
                client.lat, client.lng
            );

            if (dist > maxDist) {
                maxDist = dist;
                farthestClient = client;
            }

            if (dist > this.options.maxGponRange) {
                allInRange = false;
                warnings.push(`Cliente ${client.id} fuera de rango GPON (${dist.toFixed(2)} km > ${this.options.maxGponRange} km)`);
            } else if (dist > 15) {
                warnings.push(`Cliente ${client.id} distante (${dist.toFixed(2)} km). Considerar amplificador óptico.`);
            }
        });

        // Optical Budget validation (Detailed)
        // Fiber Loss: 0.35 dB/km
        // Splitter Loss: 1:32 split (1:4 + 1:8) ≈ 17.5 dB
        // Connector/Splice Loss: ~1.0 dB margin
        const fiberLoss = maxDist * 0.35;
        const splitterLoss = 17.5;
        const connectorLoss = 1.0;
        const totalEstimatedLoss = fiberLoss + splitterLoss + connectorLoss;
        const margin = this.options.maxOpticalBudget - totalEstimatedLoss;

        if (totalEstimatedLoss > this.options.maxOpticalBudget) {
            warnings.push(`⚠️ PRESUPUESTO ÓPTICO EXCEDIDO: ${totalEstimatedLoss.toFixed(2)} dB > ${this.options.maxOpticalBudget} dB`);
        } else if (margin < 3) {
            warnings.push(`⚠️ Margen operativo bajo (${margin.toFixed(2)} dB). Riesgo de degradación.`);
        }

        return {
            todos_clientes_en_rango: allInRange,
            cliente_mas_lejano_id: farthestClient ? farthestClient.id : null,
            distancia_maxima_km: maxDist,
            perdida_estimada_db: totalEstimatedLoss.toFixed(2),
            margen_operativo_db: margin.toFixed(2),
            advertencias: warnings
        };
    }

    // ==========================================
    // MAIN ENTRY POINT
    // ==========================================
    async findOptimalOLTAdvanced() {
        try {
            // Handle edge cases
            if (this.clients.length === 0) {
                return {
                    error: 'No hay clientes para optimizar',
                    ubicacion_optima: null,
                    ubicaciones_alternativas: [],
                    validaciones: { todos_clientes_en_rango: false, advertencias: ['Sin clientes'] }
                };
            }

            if (this.clients.length < 3) {
                // For very few clients, just use simple centroid
                const centroid = this.calculateSimpleCentroid();
                const scored = await this.scoreCandidate({ ...centroid, name: 'Centroide Simple', type: 'centroid' });
                scored.razon_seleccion = 'Pocos clientes: ubicación central simple';

                const validations = this.validateLocation(scored);

                const result = {
                    ubicacion_optima: scored,
                    ubicaciones_alternativas: [],
                    validaciones: validations
                };
                console.log("OLT Optimizer Results (Simple):", JSON.stringify(result, null, 2));
                return result;
            }

            // Normal flow
            const result = await this.selectOptimalLocation();
            const validations = this.validateLocation(result.ubicacion_optima);

            const finalResult = {
                ubicacion_optima: result.ubicacion_optima,
                ubicaciones_alternativas: result.ubicaciones_alternativas,
                validaciones: validations
            };

            console.log("OLT Optimizer Results:", JSON.stringify(finalResult, null, 2));
            return finalResult;

        } catch (error) {
            console.error("Critical OLT Optimizer Error:", error);
            return {
                error: error.message || "Error interno en optimizador",
                ubicacion_optima: null,
                ubicaciones_alternativas: [],
                validaciones: { todos_clientes_en_rango: false, advertencias: ["Error crítico de cálculo"] }
            };
        }
    }

    // New: Recalculate based on manual drag/drop
    async recalculateWithManualOLT(manualLat, manualLng, originalOptimalResult) {
        const manualCandidate = {
            name: "Ubicación Manual",
            lat: manualLat,
            lng: manualLng,
            type: 'manual'
        };

        const scoredManual = await this.scoreCandidate(manualCandidate);
        const validations = this.validateLocation(scoredManual);

        let comparison = null;
        if (originalOptimalResult) {
            const opt = originalOptimalResult.ubicacion_optima;
            comparison = {
                score_diff: scoredManual.score_total - opt.score_total,
                dist_diff: scoredManual.distancia_promedio_clientes_km - opt.distancia_promedio_clientes_km,
                better_score: scoredManual.score_total > opt.score_total
            };
        }

        return {
            ubicacion_manual: scoredManual,
            validaciones: validations,
            comparacion_con_optima: comparison
        };
    }

    // Backward compatibility
    findOptimalOLT() {
        const result = this.findOptimalOLTAdvanced();
        return {
            optimal: {
                lat: result.ubicacion_optima?.lat || 0,
                lng: result.ubicacion_optima?.lng || 0,
                scoreTotal: result.ubicacion_optima?.score_total || 0
            },
            alternatives: result.ubicaciones_alternativas || [],
            validations: result.validaciones
        };
    }
}


// ============================================
// CLASE OPTIMIZADOR DE NAPs (ADVANCED CLUSTERING 2.0)
// ============================================
class NAP_Optimizer {
    constructor(clients, oltLocation, options = {}) {
        if (!clients || clients.length === 0) throw new Error("NAP_Optimizer: Se requiere un array de clientes no vacío.");
        if (!oltLocation || typeof oltLocation.lat !== 'number') throw new Error("NAP_Optimizer: Ubicación de OLT inválida.");

        this.clients = clients;
        this.oltLocation = oltLocation;

        // Configuración por defecto adaptada a Netso
        this.options = {
            maxDistanceOLTtoNAP: options.maxDistanceOLTtoNAP || 20.0, // km (GPON limit)
            maxDistanceNAPtoClient: options.maxDistanceNAPtoClient || 0.5, // km (Drop limit)
            optimizationMode: options.optimizationMode || 'costo', // 'costo' o 'calidad'
            allowMixedCapacities: options.allowMixedCapacities !== undefined ? options.allowMixedCapacities : true,
            napCapacitySmall: 16,
            napCapacityLarge: 48,
            costSmall: 180, // USD
            costLarge: 420  // USD
        };

        this.boundingBox = this._calculateBoundingBox();
    }

    _calculateBoundingBox() {
        if (this.clients.length === 0) return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };
        const lats = this.clients.map(c => c.lat);
        const lngs = this.clients.map(c => c.lng);
        return {
            minLat: Math.min(...lats),
            maxLat: Math.max(...lats),
            minLng: Math.min(...lngs),
            maxLng: Math.max(...lngs)
        };
    }

    async calculateOptimalNAPs() {
        console.time("NAP_Optimization");
        console.log(`Starting NAP Optimization for ${this.clients.length} clients...`);

        try {
            // Paso 1: Configuración
            const config = this._determineOptimalConfiguration();

            // Paso 2: K-Means++
            let centroids = this._initializeCentroidsKMeansPlusPlus(config.total_naps_estimadas);
            console.log(`Initialized ${centroids.length} centroids with K-Means++`);

            // Paso 3: Constrained K-Means
            let { naps, unassigned } = this._runConstrainedKMeans(centroids, config);

            // Paso 4: Unassigned handling
            if (unassigned.length > 0) {
                console.warn(`${unassigned.length} unassigned clients. Creating micro-clusters...`);
                const extraNaps = this._handleUnassignedClients(unassigned);
                naps = [...naps, ...extraNaps];
            }

            // Paso 5: Optimization
            const optimizedNaps = this._optimizeByMerging(naps);

            // Paso 6: Metrics
            const finalNaps = this._calculateRouteMetrics(optimizedNaps);

            // Paso 7: Coverage
            const coverageAnalysis = this._analyzeCoverage(finalNaps);

            // Paso 8: Validation
            const validaciones = this._validateConfiguration(finalNaps);

            console.timeEnd("NAP_Optimization");

            return {
                naps: finalNaps,
                configuracion: config,
                analisis_cobertura: coverageAnalysis,
                validaciones: validaciones,
                metricas: {
                    total_naps: finalNaps.length,
                    clientes_cubiertos: finalNaps.reduce((acc, nap) => acc + nap.cantidad_clientes, 0),
                    costo_estimado: finalNaps.reduce((sum, n) => sum + n.precio_unitario, 0)
                },
                optimizaciones_aplicadas: ["K-Means++", "Constraints", "Merge"]
            };

        } catch (error) {
            console.error("NAP Optimization Failed:", error);
            throw error;
        }
    }

    _determineOptimalConfiguration() {
        // Simple density check for now
        const widthKm = OLT_Optimizer.haversineDistance(
            this.boundingBox.minLat, this.boundingBox.minLng,
            this.boundingBox.minLat, this.boundingBox.maxLng
        );
        const heightKm = OLT_Optimizer.haversineDistance(
            this.boundingBox.minLat, this.boundingBox.minLng,
            this.boundingBox.maxLat, this.boundingBox.minLng
        );
        // Avoid zero area
        const areaKm2 = Math.max(0.01, widthKm * heightKm);
        const density = this.clients.length / areaKm2;

        console.log(`Density: ${density.toFixed(2)} clients/km2`);

        let useHighDensity = (density > 200 || this.options.optimizationMode === 'calidad');

        // Estimate NAPs needed
        const cap = useHighDensity ? 48 : 16;
        const total = Math.ceil(this.clients.length / cap);

        return {
            strategy: useHighDensity ? 'High Density' : 'Standard',
            default_capacity: cap,
            total_naps_estimadas: total
        };
    }

    _initializeCentroidsKMeansPlusPlus(k) {
        if (k <= 0) return [];
        const centroids = [];

        // 1. First centroid: client closest to OLT
        let first = this.clients[0];
        let minDist = Infinity;
        for (const c of this.clients) {
            const d = OLT_Optimizer.haversineDistance(c.lat, c.lng, this.oltLocation.lat, this.oltLocation.lng);
            if (d < minDist) { minDist = d; first = c; }
        }
        centroids.push({ lat: first.lat, lng: first.lng });

        // 2. Next centroids
        for (let i = 1; i < k; i++) {
            let maxDistSq = -1;
            let nextCentroid = null;

            for (const c of this.clients) {
                let distToClosest = Infinity;
                for (const cent of centroids) {
                    const d = OLT_Optimizer.haversineDistance(c.lat, c.lng, cent.lat, cent.lng);
                    if (d < distToClosest) distToClosest = d;
                }

                if (distToClosest > maxDistSq) {
                    maxDistSq = distToClosest;
                    nextCentroid = c;
                }
            }

            if (nextCentroid) centroids.push({ lat: nextCentroid.lat, lng: nextCentroid.lng });
        }
        return centroids;
    }

    _runConstrainedKMeans(centroids, config) {
        // Initial clusters
        let clusters = centroids.map((c, i) => ({
            id: `TEMP-${i}`,
            lat: c.lat,
            lng: c.lng,
            capacity: config.default_capacity,
            clients: []
        }));

        let unassigned = [];
        const MAX_ITER = 20;

        for (let iter = 0; iter < MAX_ITER; iter++) {
            // Clear assignments
            clusters.forEach(c => c.clients = []);
            unassigned = [];

            // Randomize client order to avoid bias
            const shuffled = [...this.clients].sort(() => Math.random() - 0.5);

            for (const client of shuffled) {
                let bestCluster = null;
                let minDist = Infinity;

                for (const cluster of clusters) {
                    // Capacity constraint
                    if (cluster.clients.length >= cluster.capacity) continue;

                    // OLT-NAP Distance constraint
                    const distToOLT = OLT_Optimizer.haversineDistance(this.oltLocation.lat, this.oltLocation.lng, cluster.lat, cluster.lng);
                    if (distToOLT > this.options.maxDistanceOLTtoNAP) continue;

                    // NAP-Client Distance constraint
                    const dist = OLT_Optimizer.haversineDistance(client.lat, client.lng, cluster.lat, cluster.lng);
                    if (dist > this.options.maxDistanceNAPtoClient) continue;

                    if (dist < minDist) {
                        minDist = dist;
                        bestCluster = cluster;
                    }
                }

                if (bestCluster) {
                    bestCluster.clients.push(client);
                } else {
                    unassigned.push(client);
                }
            }

            // Recalculate centroids
            let maxShift = 0;
            for (const cluster of clusters) {
                if (cluster.clients.length === 0) continue;

                let sumLat = 0, sumLng = 0;
                for (const c of cluster.clients) { sumLat += c.lat; sumLng += c.lng; }

                const newLat = sumLat / cluster.clients.length;
                const newLng = sumLng / cluster.clients.length;

                const shift = OLT_Optimizer.haversineDistance(cluster.lat, cluster.lng, newLat, newLng);
                if (shift > maxShift) maxShift = shift;

                cluster.lat = newLat;
                cluster.lng = newLng;
            }

            if (maxShift < 0.01) break; // Converged (<10m)
        }

        return { naps: clusters.filter(c => c.clients.length > 0), unassigned };
    }

    _handleUnassignedClients(clients) {
        // Simple recursive fallback: treat them as a new problem
        // For now, just create new clusters for them
        // This is a simplified version of "mini-clustering"
        const newClusters = [];
        const cap = 16;

        while (clients.length > 0) {
            const chunk = clients.splice(0, cap);
            // Centroid is average
            let sumLat = 0, sumLng = 0;
            chunk.forEach(c => { sumLat += c.lat; sumLng += c.lng; });
            newClusters.push({
                lat: sumLat / chunk.length,
                lng: sumLng / chunk.length,
                capacity: cap,
                clients: chunk,
                is_fallback: true
            });
        }
        return newClusters;
    }

    _optimizeByMerging(naps) {
        if (!this.options.allowMixedCapacities) return naps;

        console.log("Starting NAP Merge Optimization...");
        let optimized = [...naps];
        let merged = true;
        let iterations = 0;

        while (merged && iterations < 10) {
            merged = false;
            iterations++;

            for (let i = 0; i < optimized.length; i++) {
                if (merged) break; // Restart loop after a merge

                for (let j = i + 1; j < optimized.length; j++) {
                    const napA = optimized[i];
                    const napB = optimized[j];

                    // 1. Distance check (< 300m)
                    const dist = OLT_Optimizer.haversineDistance(napA.lat, napA.lng, napB.lat, napB.lng);
                    if (dist > 0.3) continue;

                    // 2. Capacity check
                    const totalClients = napA.clients.length + napB.clients.length;
                    let targetCap = 16;
                    let targetCost = this.options.costSmall;

                    if (totalClients > 16) {
                        targetCap = 48;
                        targetCost = this.options.costLarge;
                    }

                    if (totalClients > targetCap) continue; // Cannot merge

                    // 3. Cost benefit check
                    const currentCost = (napA.capacity === 48 ? this.options.costLarge : this.options.costSmall) +
                        (napB.capacity === 48 ? this.options.costLarge : this.options.costSmall);

                    if (targetCost >= currentCost) continue; // No savings

                    // 4. Constraint Validation (New Centroid)
                    const newLat = (napA.lat * napA.clients.length + napB.lat * napB.clients.length) / totalClients;
                    const newLng = (napA.lng * napA.clients.length + napB.lng * napB.clients.length) / totalClients;

                    // Check if all clients are still within 500m
                    const allClientsObj = [...napA.clients, ...napB.clients];
                    let rangeViolation = false;
                    for (const c of allClientsObj) {
                        if (OLT_Optimizer.haversineDistance(c.lat, c.lng, newLat, newLng) > this.options.maxDistanceNAPtoClient) {
                            rangeViolation = true;
                            break;
                        }
                    }
                    if (rangeViolation) continue;

                    // Execute Merge
                    console.log(`Merging NAP-${i} and NAP-${j} into new ${targetCap}-port NAP. Savings: $${currentCost - targetCost}`);

                    const newNAP = {
                        id: `MERGED-${iterations}-${i}`,
                        lat: newLat,
                        lng: newLng,
                        capacity: targetCap,
                        clients: allClientsObj
                    };

                    optimized.splice(j, 1); // Remove B first (higher index)
                    optimized.splice(i, 1); // Remove A
                    optimized.push(newNAP);

                    merged = true;
                    break;
                }
            }
        }
        return optimized;
    }

    _calculateRouteMetrics(naps) {
        return naps.map((nap, idx) => {
            const distStraight = OLT_Optimizer.haversineDistance(this.oltLocation.lat, this.oltLocation.lng, nap.lat, nap.lng);

            // Slack factor 1.12 for fiber route
            const distReal = distStraight * 1.12;

            // Loss Calculation
            // Fiber: 0.35 dB/km
            // Splices: 1 every 2km (0.1 dB each)
            // Connectors: 1.0 dB (0.5 x 2)
            const fiberLoss = distReal * 0.35;
            const splices = Math.ceil(distReal / 2);
            const spliceLoss = splices * 0.1;
            const connectorLoss = 1.0;
            const routeLoss = fiberLoss + spliceLoss + connectorLoss;

            return {
                ...nap,
                id: `NAP-${String(idx + 1).padStart(3, '0')}`,
                distancia_olt_km: Number(distStraight.toFixed(3)),
                distancia_fibra_real_km: Number(distReal.toFixed(3)),
                empalmes_estimados: splices,
                perdida_ruta_db: Number(routeLoss.toFixed(2)),
                clientes_asignados: nap.clients.map(c => c.id),
                cantidad_clientes: nap.clients.length,
                tipo_nap: nap.capacity === 48 ? 'NAP_48P_HD' : 'NAP_16P_IP68',
                precio_unitario: nap.capacity === 48 ? this.options.costLarge : this.options.costSmall,
                ocupacion_porcentaje: Number(((nap.clients.length / nap.capacity) * 100).toFixed(1)),
                // Optical budget placeholders (filled later if needed)
                splitter_nivel1_asignado: null,
                perdida_splitter_nivel1_db: null
            };
        });
    }

    _analyzeCoverage(naps) {
        // Grid analysis for dead zones
        const GRID_SIZE_KM = 0.1; // 100m grid
        const widthKm = OLT_Optimizer.haversineDistance(this.boundingBox.minLat, this.boundingBox.minLng, this.boundingBox.minLat, this.boundingBox.maxLng);
        const heightKm = OLT_Optimizer.haversineDistance(this.boundingBox.minLat, this.boundingBox.minLng, this.boundingBox.maxLat, this.boundingBox.minLng);

        const cols = Math.ceil(widthKm / GRID_SIZE_KM);
        const rows = Math.ceil(heightKm / GRID_SIZE_KM);

        let coveredPoints = 0;
        let totalPoints = 0;
        let deadZones = [];

        // Simple check: iterate grid points within bounding box
        // Warning: O(rows*cols * naps). Keep grid course.
        // Limit max grid points to avoid performance hit
        const stepLat = (this.boundingBox.maxLat - this.boundingBox.minLat) / rows;
        const stepLng = (this.boundingBox.maxLng - this.boundingBox.minLng) / cols;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const lat = this.boundingBox.minLat + r * stepLat;
                const lng = this.boundingBox.minLng + c * stepLng;
                totalPoints++;

                // Check distance to nearest NAP
                let minDist = Infinity;
                for (const nap of naps) {
                    const d = OLT_Optimizer.haversineDistance(lat, lng, nap.lat, nap.lng);
                    if (d < minDist) minDist = d;
                }

                if (minDist <= this.options.maxDistanceNAPtoClient) {
                    coveredPoints++;
                } else {
                    // Potential dead zone
                    // Only track if it's "significant" (not just edge)
                    // Simplified: just store point
                    // deadZones.push({lat, lng});
                }
            }
        }

        const coveragePct = totalPoints > 0 ? (coveredPoints / totalPoints) * 100 : 0;

        return {
            total_area_km2: (widthKm * heightKm).toFixed(2),
            porcentaje_cobertura: coveragePct.toFixed(1),
            zonas_sin_servicio: [] // Populate via clustering logic if needed, skipping for performace now
        };
    }

    _validateConfiguration(naps) {
        const errors = [];
        const warnings = [];
        let occupiedPorts = 0;
        let totalPorts = 0;
        let occupancies = [];

        naps.forEach(nap => {
            occupiedPorts += nap.cantidad_clientes;
            totalPorts += nap.capacity;
            occupancies.push(nap.ocupacion_porcentaje);

            if (nap.cantidad_clientes > nap.capacity) {
                errors.push(`NAP ${nap.id} exceeds capacity (${nap.cantidad_clientes}/${nap.capacity})`);
            }
            if (nap.distancia_olt_km > this.options.maxDistanceOLTtoNAP) {
                errors.push(`NAP ${nap.id} too far from OLT (${nap.distancia_olt_km}km)`);
            }
            if (nap.ocupacion_porcentaje > 90) {
                warnings.push(`NAP ${nap.id} saturated (${nap.ocupacion_porcentaje}%)`);
            }
            if (nap.ocupacion_porcentaje < 40) {
                warnings.push(`NAP ${nap.id} underutilized (${nap.ocupacion_porcentaje}%)`);
            }
        });

        // Std Dev of occupancy
        const avgOcc = occupancies.reduce((a, b) => a + b, 0) / occupancies.length;
        const variance = occupancies.reduce((a, b) => a + Math.pow(b - avgOcc, 2), 0) / occupancies.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev > 30) warnings.push("Unbalanced NAP distribution detected");

        return {
            valid: errors.length === 0,
            errores_criticos: errors,
            advertencias: warnings,
            metricas: {
                ocupacion_promedio: avgOcc.toFixed(1),
                desviacion_estandar: stdDev.toFixed(1)
            }
        };
    }
}

// ==========================================
// NAP CLUSTERING (K-means)
// ==========================================
async function calculateNAPs(clients, oltLocation = null) {
    if (!clients || clients.length === 0) return [];

    // Backward compatibility: calculate centroid if no OLT provided
    if (!oltLocation) {
        console.warn("calculateNAPs called without OLT location. Using simple centroid.");
        let sumLat = 0, sumLng = 0;
        clients.forEach(c => { sumLat += c.lat; sumLng += c.lng; });
        oltLocation = { lat: sumLat / clients.length, lng: sumLng / clients.length };
    }

    const optimizer = new NAP_Optimizer(clients, oltLocation);
    const result = await optimizer.calculateOptimalNAPs();
    return result.naps;
}

// ==========================================
// GOOGLE MAPS LOADER
// ==========================================
function loadGoogleMapsScript(callback) {
    if (window.google && window.google.maps) {
        if (callback) callback();
        return;
    }

    if (window.isGoogleMapsLoading) {
        if (callback) {
            const check = setInterval(() => {
                if (window.google && window.google.maps) {
                    clearInterval(check);
                    callback();
                }
            }, 100);
        }
        return;
    }

    if (!googleApiKey) {
        alert("⚠️ Falta la API Key de Google Maps. Configúrala en el menú de usuario.");
        toggleSettings();
        return;
    }

    window.isGoogleMapsLoading = true;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
        window.isGoogleMapsLoading = false;
        if (callback) callback();
    };
    script.onerror = () => {
        window.isGoogleMapsLoading = false;
        alert("❌ Error al cargar Google Maps. Verifica tu conexión o API Key.");
    };
    document.head.appendChild(script);
}

// ==========================================
// API KEY MANAGEMENT
// ==========================================
window.resetGoogleMapsKey = function () {
    const newKey = prompt("🔑 Ingresa tu nueva Google Maps API Key:");
    if (newKey && newKey.trim().length > 10) {
        localStorage.setItem('googleApiKey', newKey.trim());
        googleApiKey = newKey.trim();
        alert("✅ API Key actualizada. La página se recargará.");
        location.reload();
    } else if (newKey !== null) {
        alert("❌ API Key inválida o cancelada.");
    }
};

// ==========================================
// ADDRESS SEARCH & GEOCODING
// ==========================================
async function handleAddressSearch(map, oltMarker) {
    const input = document.getElementById('address-search');
    if (!input || !input.value.trim()) return;

    const geocoder = new google.maps.Geocoder();

    // Mostramos feedback de carga
    const originalPlaceholder = input.placeholder;
    input.placeholder = "🔍 Buscando...";
    input.disabled = true;

    try {
        const result = await new Promise((resolve, reject) => {
            geocoder.geocode({ address: input.value }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    resolve(results[0]);
                } else {
                    reject(status);
                }
            });
        });

        const location = result.geometry.location;
        const newLat = location.lat();
        const newLng = location.lng();

        console.log(`📍 Dirección encontrada: ${result.formatted_address} (${newLat}, ${newLng})`);

        // 1. Mover Mapa
        map.setCenter(location);
        map.setZoom(16);

        // 2. Mover OLT
        if (oltMarker) {
            oltMarker.setPosition(location);
            // Disparar evento de dragend manualmente para recalcular todo
            google.maps.event.trigger(oltMarker, 'dragend', { latLng: location });
        }

        // Feedback visual
        input.value = result.formatted_address;

    } catch (error) {
        console.error("Geocoding error:", error);
        alert("❌ No se encontró la dirección: " + input.value);
    } finally {
        input.placeholder = originalPlaceholder;
        input.disabled = false;
    }
}
window.showArchitecture = showArchitecture;

async function showArchitecture(oltOverride = null) {
    loadGoogleMapsScript(async () => {
        console.log("🗺️ Calculando Arquitectura...");
        let mstResult = null;

        // La sección de presupuesto se muestra ahora a través de renderOLTResults

        const btn = event?.target;
        if (btn) btn.innerHTML = "⏳ Procesando...";

        try {
            // 2. Get User's Current Location (Geolocation API)
            let mapCenter = { lat: -10.9843, lng: -74.7460 }; // Default: Huánuco, Perú

            // Try to get user's current location with timeout
            try {
                if (navigator.geolocation) {
                    btn.innerHTML = "⏳ Buscando ubicación...";
                    // Request user's location with 5s timeout race
                    const position = await Promise.race([
                        new Promise((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, {
                                enableHighAccuracy: true,
                                timeout: 5000,
                                maximumAge: 0
                            });
                        }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout obteniendo ubicación")), 5000))
                    ]);

                    mapCenter = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };

                    console.log("📍 Ubicación detectada:", mapCenter);
                    localStorage.setItem('projectLocation', JSON.stringify(mapCenter));
                } else {
                    console.warn("Geolocation no disponible, usando ubicación por defecto");
                }
            } catch (geoError) {
                console.warn("No se pudo obtener ubicación (usando default):", geoError.message);
                // Check if there's a stored location
                const storedLocation = localStorage.getItem('projectLocation');
                if (storedLocation) {
                    try {
                        mapCenter = JSON.parse(storedLocation);
                        console.log("📍 Usando ubicación guardada:", mapCenter);
                    } catch (e) {
                        console.warn("No se pudo parsear ubicación guardada, usando default");
                    }
                }
            }

            if (btn) btn.innerHTML = "⏳ Aplicando algoritmo...";

            // 1. Get Real Client Data from Wizard
            const censoInput = document.getElementById('censo');
            const radiusInput = document.getElementById('coverageRadius');

            const clientCount = censoInput ? parseInt(censoInput.value) || 20 : 20;
            const coverageRadiusMeters = radiusInput ? parseInt(radiusInput.value) || 500 : 500;
            const coverageRadiusKm = coverageRadiusMeters / 1000;


            // 3. Generate Client Distribution
            let clients = [];
            for (let i = 0; i < clientCount; i++) {
                // Distribute clients within coverage radius
                const angle = Math.random() * 2 * Math.PI;
                const distance = Math.random() * coverageRadiusKm;

                // Convert polar to cartesian (approximate for small distances)
                const latOffset = (distance * Math.cos(angle)) / 111; // 1 degree lat ≈ 111 km
                const lngOffset = (distance * Math.sin(angle)) / (111 * Math.cos(mapCenter.lat * Math.PI / 180));

                clients.push({
                    id: `CLI_${i + 1}`,
                    lat: mapCenter.lat + latOffset,
                    lng: mapCenter.lng + lngOffset
                });
            }


            // 4. Advanced OLT Optimization
            const optimizer = new OLT_Optimizer(clients, { country: 'CO' }); // Default to Colombia
            const result = await optimizer.findOptimalOLTAdvanced();

            if (result.error) {
                alert(result.error);
                if (btn) btn.innerHTML = "🗺️ Ver Arquitectura Sugerida";
                return;
            }

            const oltOptimal = result.ubicacion_optima;
            const validations = result.validaciones;

            // Save result to Firestore (if project context exists)
            if (typeof currentProjectDocId !== 'undefined' && currentProjectDocId) {
                try {
                    console.log("Saving OLT calculation to Firestore...");
                    await db.collection('proyectos').doc(currentProjectDocId).update({
                        olt_calculation: {
                            ...result,
                            fecha_calculo: new Date().toISOString(),
                            version_algoritmo: '2.0'
                        }
                    });
                    console.log("OLT calculation saved successfully.");
                } catch (err) {
                    console.warn("Failed to save OLT calculation to Firestore:", err);
                    // Don't block UI
                }
            }

            // 5. Advanced NAP Clustering (v2.0)
            const napOptimizer = new NAP_Optimizer(clients, oltOptimal);
            const napResult = await napOptimizer.calculateOptimalNAPs();
            const naps = napResult.naps;

            console.log("✅ NAP Optimization Complete:", JSON.stringify(napResult, null, 2));

            // Store clients globally for recalculation
            window.currentProjectClients = clients;

            // 6. Render Map
            const mapDiv = document.getElementById('map-container');
            if (mapDiv) {
                mapDiv.style.display = 'block';
                // 5. Initialize Map with optimal center
                const map = new google.maps.Map(mapDiv, {
                    zoom: 15,
                    center: { lat: oltOptimal.lat, lng: oltOptimal.lng },
                    mapTypeId: google.maps.MapTypeId.HYBRID,
                    mapTypeControl: true,
                    streetViewControl: true,
                    fullscreenControl: true
                });

                // 🔥 AGREGAR LEYENDA PREMIUM
                FibraDespliegue.createMapLegend(map);

                // OLT Marker (Red) - DRAGGABLE
                const oltMarker = new google.maps.Marker({
                    position: { lat: oltOptimal.lat, lng: oltOptimal.lng },
                    map: map,
                    label: "OLT",
                    title: `OLT Óptima - Score: ${oltOptimal.score_total}/100`,
                    draggable: true, // ENABLE DRAG
                    icon: {
                        url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
                    }
                });

                // Address Search Handler
                const searchInput = document.getElementById('address-search');
                if (searchInput) {
                    // Remove old listeners to avoid duplicates
                    const newInput = searchInput.cloneNode(true);
                    searchInput.parentNode.replaceChild(newInput, searchInput);

                    newInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddressSearch(map, oltMarker);
                        }
                    });
                }

                // Real-time InfoWindow
                const infoWindow = new google.maps.InfoWindow({
                    content: `<div style="padding:5px;"><strong>Arrastra para recalcular...</strong></div>`,
                    disableAutoPan: true // Prevent map jumping while dragging
                });

                // Optimization instance for drag events (reuse existing clients)
                let dragOptimizer = null;
                let lastUpdate = 0; // Throttling timestamp

                oltMarker.addListener('dragstart', () => {
                    infoWindow.open(map, oltMarker);
                    if (window.currentProjectClients) {
                        dragOptimizer = new OLT_Optimizer(window.currentProjectClients, { country: 'CO' });
                    }
                });

                oltMarker.addListener('drag', (event) => {
                    if (!dragOptimizer) return;

                    // Throttling: Update max every 50ms
                    const now = Date.now();
                    if (now - lastUpdate < 50) return;
                    lastUpdate = now;

                    const lat = event.latLng.lat();
                    const lng = event.latLng.lng();

                    // Fast Scoring (Synchronous)
                    const tempCandidate = { lat, lng, type: 'manual' };
                    // Use the new SYNC method to avoid Promise issues
                    const tempResult = dragOptimizer.scoreCandidateSync(tempCandidate);

                    // Quick optical check
                    const validations = dragOptimizer.validateLocation(tempResult);
                    const loss = parseFloat(validations.perdida_estimada_db || 0);
                    const power = (4.0 - loss).toFixed(2);

                    // Determine status color
                    let color = '#ef4444'; // Red (Critical)
                    let statusText = 'CRÍTICO';
                    if (power >= -22) { color = '#f59e0b'; statusText = 'AL LÍMITE'; } // Orange
                    if (power >= -18) { color = '#10b981'; statusText = 'IDEAL'; } // Green

                    // Premium UI for Info Window
                    infoWindow.setContent(`
                        <div style="font-family: 'Inter', sans-serif; text-align: center; min-width: 180px; padding: 4px;">
                            <div style="font-size: 10px; color: #64748b; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px;">EN TIEMPO REAL</div>
                            
                            <div style="display: flex; justify-content: center; align-items: baseline; gap: 4px; margin-bottom: 8px;">
                                <span style="font-size: 28px; font-weight: 800; color: #1e293b;">${tempResult.score_total}</span>
                                <span style="font-size: 13px; color: #94a3b8; font-weight: 600;">/ 100</span>
                            </div>

                            <div style="background: #f8fafc; border-radius: 8px; padding: 6px; border: 1px solid #e2e8f0;">
                                <div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">Potencia Est.</div>
                                <div style="font-size: 16px; font-weight: 800; color: ${color};">
                                    ${power} dBm
                                </div>
                                <div style="font-size: 9px; font-weight: 700; color: ${color}; margin-top: 2px;">${statusText}</div>
                            </div>
                        </div>
                    `);
                });

                // DRAG END EVENT LISTENER
                oltMarker.addListener('dragend', async (event) => {
                    const newLat = event.latLng.lat();
                    const newLng = event.latLng.lng();
                    console.log("📍 OLT arrastrada a:", newLat, newLng);

                    // Close InfoWindow
                    infoWindow.close();

                    // Show loading indicator
                    const btn = document.getElementById('btn-architecture');
                    if (btn) btn.innerHTML = "🔄 Recalculando NAPs...";

                    try {
                        if (window.currentProjectClients) {
                            const optimizer = new OLT_Optimizer(window.currentProjectClients, { country: 'CO' });

                            // Create candidate from new location
                            const manualCandidate = {
                                lat: newLat,
                                lng: newLng,
                                type: 'manual',
                                name: 'Ubicación Manual'
                            };

                            // Score the new location
                            const newResult = await optimizer.scoreCandidate(manualCandidate);
                            newResult.razon_seleccion = "📍 Ubicación ajustada manualmente por el usuario.";

                            // Validate new location
                            const newVal = optimizer.validateLocation(newResult);

                            // 🔥 RECALCULATE NAPs with new OLT location
                            const napOptimizer = new NAP_Optimizer(window.currentProjectClients, { lat: newLat, lng: newLng });
                            const napResult = await napOptimizer.calculateOptimalNAPs();
                            const newNaps = napResult.naps;

                            console.log("✅ NAPs recalculadas:", newNaps.length);

                            // Clear ALL existing markers and polylines from map
                            // We need to store references to clear them
                            // For now, we'll just recreate the entire map view

                            // Update marker position (already done by drag)
                            oltMarker.setTitle(`OLT Manual - Score: ${newResult.score_total}/100`);

                            // Clear old NAP markers and polylines by removing them from map
                            // Store markers globally for cleanup
                            if (window.currentNAPMarkers) {
                                window.currentNAPMarkers.forEach(marker => marker.setMap(null));
                            }
                            if (window.currentPolylines) {
                                window.currentPolylines.forEach(line => line.setMap(null));
                            }

                            // Initialize storage arrays
                            window.currentNAPMarkers = [];
                            window.currentPolylines = [];

                            // Redraw NAP markers
                            newNaps.forEach(nap => {
                                // Diferenciar por capacidad para la leyenda
                                let iconColor = (nap.capacity === 48) ? 'blue' : 'orange';

                                const napMarker = new google.maps.Marker({
                                    position: { lat: nap.lat, lng: nap.lng },
                                    map: map,
                                    icon: `http://maps.google.com/mapfiles/ms/icons/${iconColor}-dot.png`,
                                    title: `${nap.id} - ${nap.cantidad_clientes}/${nap.capacity} clientes (${nap.ocupacion_porcentaje.toFixed(1)}%)`
                                });
                                window.currentNAPMarkers.push(napMarker);
                            });

                            // 🔥 DIBUJAR MST CON RUTAS REALES
                            let mstResult = null;
                            try {
                                mstResult = await FibraDespliegue.calcularMSTConRutas(map, { lat: newLat, lng: newLng }, newNaps);
                                console.log("✅ MST con rutas reales completado:", mstResult);
                            } catch (mstErr) {
                                console.warn("Fallo al calcular MST en drag:", mstErr);
                            }

                            // Update UI with new results
                            renderOLTResults(newResult, window.currentProjectClients.length, newNaps, newVal, result, mstResult);

                            console.log("✅ Mapa actualizado con nueva configuración OLT-NAPs");
                        }
                    } catch (error) {
                        console.error("Error recalculando NAPs:", error);
                        alert("Error al recalcular NAPs: " + error.message);
                    } finally {
                        if (btn) btn.innerHTML = "🗺️ Ver Arquitectura Sugerida";
                    }
                });

                // Alternative OLT Locations (Yellow) - DISABLED
                // User can now drag OLT freely, so alternative locations are not needed
                /*
                if (result.ubicaciones_alternativas && result.ubicaciones_alternativas.length > 0) {
                    result.ubicaciones_alternativas.forEach((alt, idx) => {
                        new google.maps.Marker({
                            position: { lat: alt.lat, lng: alt.lng },
                            map: map,
                            label: `${idx + 2}`,
                            title: `${alt.name} - Score: ${alt.score_total}/100`,
                            icon: {
                                url: 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png'
                            }
                        });
                    });
                }
                */

                // NAP Markers (Status-based colors) + Fiber Routes
                // Initialize global storage for cleanup on OLT drag
                window.currentNAPMarkers = [];
                window.currentPolylines = [];

                // Redraw NAP markers
                naps.forEach(nap => {
                    // Diferenciar por capacidad para la leyenda
                    let iconColor = (nap.capacity === 48) ? 'blue' : 'orange';

                    const napMarker = new google.maps.Marker({
                        position: { lat: nap.lat, lng: nap.lng },
                        map: map,
                        icon: `http://maps.google.com/mapfiles/ms/icons/${iconColor}-dot.png`,
                        title: `${nap.id} - ${nap.cantidad_clientes}/${nap.capacity} clientes (${nap.ocupacion_porcentaje.toFixed(1)}%)`
                    });
                    window.currentNAPMarkers.push(napMarker);

                    // InfoWindow with detailed NAP info
                    const napInfoContent = `
                        <div style="font-family: 'Inter', sans-serif; padding: 8px; min-width: 200px;">
                            <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px;">${nap.id}</div>
                            <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">
                                <strong>Tipo:</strong> ${nap.tipo_nap}<br>
                                <strong>Clientes:</strong> ${nap.cantidad_clientes} / ${nap.capacity}<br>
                                <strong>Ocupación:</strong> ${nap.ocupacion_porcentaje.toFixed(1)}%<br>
                                <strong>Distancia OLT:</strong> ${nap.distancia_olt_km.toFixed(2)} km<br>
                                <strong>Pérdida Ruta:</strong> ${nap.perdida_ruta_db.toFixed(2)} dB
                            </div>
                        </div>
                    `;
                    const napInfoWindow = new google.maps.InfoWindow({ content: napInfoContent });
                    napMarker.addListener('click', () => {
                        napInfoWindow.open(map, napMarker);
                    });
                });

                // 🔥 DIBUJAR MST CON RUTAS REALES (RENDER INICIAL)
                try {
                    mstResult = await FibraDespliegue.calcularMSTConRutas(map, { lat: oltOptimal.lat, lng: oltOptimal.lng }, naps);
                    console.log("✅ MST Inicial completado:", mstResult);
                } catch (mstErr) {
                    console.warn("⚠️ Fallo en cálculo MST inicial (usando fallback):", mstErr);
                }
            }

            // 7. Initial UI Render
            renderOLTResults(oltOptimal, window.currentProjectClients.length, naps, validations, result, mstResult);

        } catch (err) {
            console.error("❌ Error en showArchitecture:", err);
            // Solo mostramos alerta si es error crítico, no de MST
            if (!err.message.includes('mstResult')) {
                alert("Ocurrió un error al calcular la arquitectura: " + err.message);
            }
        } finally {
            if (btn) btn.innerHTML = "🗺️ Ver Arquitectura Sugerida";
            console.log("🏁 Proceso de arquitectura finalizado");
            // Reset loading state just in case
            window.isGoogleMapsLoading = false;
        }
    });
}

function renderOLTResults(oltOptimal, clientCount, naps, validations, result, mstData = null) {
    const detailsDiv = document.getElementById('architecture-details');
    if (!detailsDiv) return;

    detailsDiv.style.display = 'block';

    // 1. Calculate Optical Metrics with REAL fiber distance if available
    const txPower = FibraDespliegue.config.P_TX; // 7.0 dBm

    // Si tenemos datos del MST, usamos la distancia real. Si no, usamos la validación estimada.
    const realDistKm = mstData ? parseFloat(mstData.total_km) : parseFloat(validations.distancia_maxima_km || 0);
    const lossFiber = realDistKm * FibraDespliegue.config.ALPHA;

    // Splitter loss según capacidad (asumimos predominante)
    const napCap = naps[0]?.capacity || 16;
    const splitterLoss = napCap === 48 ? FibraDespliegue.config.SPLITTER_NAP48 : FibraDespliegue.config.SPLITTER_NAP16;

    const totalLoss = lossFiber + splitterLoss + FibraDespliegue.config.PERDIDA_CONECTOR + FibraDespliegue.config.MARGEN_SEGURIDAD;
    const rxPower = (txPower - totalLoss).toFixed(2);

    // Determine Status
    let statusText = "IDEAL";
    let statusClass = "";
    if (rxPower < -28) {
        statusText = "CRÍTICO";
        statusClass = "danger";
    } else if (rxPower < -25) {
        statusText = "AL LÍMITE";
        statusClass = "warning";
    }

    let html = `
        <div class="olt-result-card">
            
            <!-- 1. Main Premium Card (Dark) -->
            <div class="premium-main-card">
                <div class="premium-main-value">${rxPower} dBm</div>
                <div class="premium-main-label">Potencia Estimada Recibida</div>
                <div class="premium-status-pill ${statusClass}">
                    ✓ ${statusText}
                </div>
            </div>

            <!-- 2. Light Stats Grid -->
            <div class="premium-stats-grid">
                <div class="premium-stat-card">
                    <span class="premium-stat-label">PÉRDIDA EN MST</span>
                    <span class="premium-stat-value">-${totalLoss.toFixed(2)} <small class="premium-stat-unit">dB</small></span>
                </div>
                <div class="premium-stat-card">
                    <span class="premium-stat-label">DISTANCIA REAL</span>
                    <span class="premium-stat-value">${realDistKm.toFixed(2)} <small class="premium-stat-unit">km</small></span>
                </div>
                <div class="premium-stat-card">
                    <span class="premium-stat-label">NAPS REQUERIDOS</span>
                    <span class="premium-stat-value">${naps.length}</span>
                </div>
                <div class="premium-stat-card">
                    <span class="premium-stat-label">MARGEN SEGURIDAD</span>
                    <span class="premium-stat-value">${FibraDespliegue.config.MARGEN_SEGURIDAD} <small class="premium-stat-unit">dB</small></span>
                </div>
            </div>

            <div class="olt-body" style="padding-top: 0;">
                <div class="olt-section-title">
                    <i class="fas fa-chart-bar"></i> Detalles de Scoring
                </div>
                <!-- ... existing score breakdown ... -->
    `;

    // Add back the detailed score bars for context (optional but good to keep)
    // Helpers for progress bars
    const getBarWidth = (score) => Math.max(5, Math.min(100, score));

    html += `
        <div class="scores-grid">
            <div class="score-item">
                <div class="score-label">
                    <span>Distancia</span>
                    <span>${oltOptimal.score_distancia}/100</span>
                </div>
                <div class="score-bar-bg">
                    <div class="score-bar-fill" style="width: ${getBarWidth(oltOptimal.score_distancia)}%;"></div>
                </div>
            </div>
            <div class="score-item">
                <div class="score-label">
                    <span>Costo</span>
                    <span>${oltOptimal.score_costo}/100</span>
                </div>
                <div class="score-bar-bg">
                    <div class="score-bar-fill" style="width: ${getBarWidth(oltOptimal.score_costo)}%;"></div>
                </div>
            </div>
            <div class="score-item">
                <div class="score-label">
                    <span>Accesibilidad</span>
                    <span>${oltOptimal.score_accesibilidad}/100</span>
                </div>
                <div class="score-bar-bg">
                    <div class="score-bar-fill" style="width: ${getBarWidth(oltOptimal.score_accesibilidad)}%;"></div>
                </div>
            </div>
            <div class="score-item">
                <div class="score-label">
                    <span>Escalabilidad</span>
                    <span>${oltOptimal.score_escalabilidad}/100</span>
                </div>
                <div class="score-bar-bg">
                    <div class="score-bar-fill" style="width: ${getBarWidth(oltOptimal.score_escalabilidad)}%;"></div>
                </div>
            </div>
        </div>

    `;

    // Add validation warnings if any
    if (validations.advertencias && validations.advertencias.length > 0) {
        html += `
            <div class="notice-card" style="border-color: #f59e0b; background: #fffbeb;">
                <strong style="color: #b45309; display: block; margin-bottom: 8px;">⚠️ Advertencias:</strong>
        `;
        validations.advertencias.forEach(warning => {
            html += `<div style="color: #92400e; margin-bottom: 4px;">• ${warning}</div>`;
        });
        html += `</div>`;
    }


    html += `</div></div>`; // Close body and card

    detailsDiv.innerHTML = html;

    // --- SINCRONIZACIÓN DINÁMICA CON LISTA DE MATERIALES ---
    try {
        console.log("Sincronizando lista de materiales con resultados del Optimizador...");

        const capCounts = naps.reduce((acc, n) => {
            const cap = n.capacity || 16;
            acc[cap] = (acc[cap] || 0) + 1;
            return acc;
        }, {});

        const mainCap = parseInt(Object.keys(capCounts).sort((a, b) => capCounts[b] - capCounts[a])[0] || 16);
        const radioKm = parseFloat(document.getElementById('coverageRadius')?.value || 500) / 1000;

        // Regenerar lista con los datos precisos del mapa
        generarListaCotizacion(clientCount, naps.length, radioKm, mainCap);

        // Actualizar el resumen rápido
        const resNapsTotal = document.getElementById('res-naps-total');
        if (resNapsTotal) {
            resNapsTotal.innerText = naps.length;
            const napLabel = resNapsTotal.parentElement.querySelector('span');
            if (napLabel) napLabel.innerText = `NAPs (${mainCap})`;
        }
    } catch (syncErr) {
        console.warn("Error en sincronización dinámica:", syncErr);
    }
}



// Global Assignments
window.renderOLTResults = renderOLTResults;
window.selectProjectType = selectProjectType;
window.startSelectedFlow = startSelectedFlow;


// ==========================================
// RESTORED NAVIGATION LOGIC
// ==========================================
// Removed duplicate declaration of selectedProjectType to avoid SyntaxError
// let selectedProjectType = null; 

function selectProjectType(type) {
    selectedProjectType = type;
    document.querySelectorAll('.project-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById(`card - ${type} `);
    if (card) card.classList.add('selected');

    // Enable button
    const btn = document.getElementById('btn-start-project');
    if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    }
    console.log("Proyecto seleccionado:", type);
}

function startSelectedFlow() {
    console.log("Iniciando flujo:", selectedProjectType);
    // Safe check if selectedProjectType is defined
    if (typeof selectedProjectType !== 'undefined' && !selectedProjectType) {
        alert("⚠️ Por favor selecciona una opción para continuar (Asistente AI o Manual).");
        return;
    } else if (typeof selectedProjectType === 'undefined') {
        console.error("selectedProjectType is undefined!");
        return;
    }

    // Hide dashboard / selection
    const dash = document.getElementById('netso-dashboard');
    if (dash) dash.style.display = 'none';

    // Show Page 1
    const p1 = document.getElementById('page1');
    if (p1) p1.style.display = 'block';

    // Update step indicator
    if (typeof updateStepIndicator === 'function') {
        updateStepIndicator(1);
    } else {
        // Fallback implementation if global function missing
        const steps = document.querySelectorAll('.step-item');
        steps.forEach((s, idx) => {
            if (idx + 1 === 1) s.classList.add('active');
            else s.classList.remove('active');
        });
    }

    window.scrollTo(0, 0);
}

// Ensure updateStepIndicator is available globally if not already
if (typeof window.updateStepIndicator === 'undefined') {
    window.updateStepIndicator = function (step) {
        const steps = document.querySelectorAll('.step-item');
        steps.forEach((s, idx) => {
            if (idx + 1 === step) s.classList.add('active');
            else if (idx + 1 < step) s.classList.add('completed'); // Optional style
            else s.classList.remove('active');
        });
    };
}


