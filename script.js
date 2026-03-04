// Initialize Firebase using compat mode
const firebaseConfig = {
    apiKey: "AIzaSyDNMCPkYhHWxCwhNkPyVUuNmDK9kB8EQ-s",
    authDomain: "vegas-group-db.firebaseapp.com",
    projectId: "vegas-group-db",
    storageBucket: "vegas-group-db.firebasestorage.app",
    messagingSenderId: "182879461313",
    appId: "1:182879461313:web:af8db49a80a2b23e469940"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let recordsData = [];

// --- UI Logic & Navigation ---
const navDashboard = document.getElementById('nav-dashboard');
const navAdd = document.getElementById('nav-add');
const viewDashboard = document.getElementById('view-dashboard');
const viewAdd = document.getElementById('view-add');
const dataGrid = document.getElementById('dataGrid');
const totalCountEl = document.getElementById('totalCount');
const searchInput = document.getElementById('searchInput');

// Switch Views
const switchView = (viewId) => {
    // Auth Guard
    if (!currentUser && viewId !== 'view-login') {
        viewId = 'view-login';
    } else if (currentUser && viewId === 'view-login') {
        viewId = 'view-dashboard';
    }

    // Role Guard
    if (currentUser && currentUser.role !== 'admin' && (viewId === 'view-add' || viewId === 'view-access')) {
        showToast('Acceso denegado: Se requieren permisos de Administrador.', '#ef4444');
        viewId = 'view-dashboard';
    }

    // Nav logic
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));

    if (viewId === 'view-dashboard') document.getElementById('nav-dashboard').classList.add('active');
    else if (viewId === 'view-add') document.getElementById('nav-add').classList.add('active');
    else if (viewId === 'view-access') document.getElementById('nav-access').classList.add('active');

    // View logic
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    if (viewId === 'view-dashboard') renderGrid();
    if (viewId === 'view-access') renderUsersGrid();
};

const updateSidebarUi = () => {
    const navAdd = document.getElementById('nav-add');
    const navAccess = document.getElementById('nav-access');

    if (!currentUser) return;

    document.getElementById('sidebarName').textContent = currentUser.name;
    document.getElementById('sidebarAvatar').textContent = currentUser.name.substring(0, 2).toUpperCase();

    let roleName = 'Lector';
    if (currentUser.role === 'admin') roleName = 'Administrador';
    if (currentUser.role === 'restricted') roleName = 'Restringido';
    document.getElementById('sidebarRole').textContent = roleName;

    if (currentUser.role === 'admin') {
        navAdd.style.display = 'flex';
        navAccess.style.display = 'flex';
    } else {
        navAdd.style.display = 'none';
        navAccess.style.display = 'none';
    }
};

// --- Auth & Data Listeners ---
let recordsUnsubscribe = null;
let usersUnsubscribe = null;
let usersData = [];

const setupRecordsListener = () => {
    if (recordsUnsubscribe) recordsUnsubscribe();
    recordsUnsubscribe = db.collection("records").onSnapshot((snapshot) => {
        recordsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (document.getElementById('view-dashboard').classList.contains('active')) {
            renderGrid(document.getElementById('searchInput').value);
        }
    });
};

const setupUsersListener = () => {
    if (usersUnsubscribe) usersUnsubscribe();
    usersUnsubscribe = db.collection("roles").onSnapshot((snapshot) => {
        usersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        if (document.getElementById('view-access').classList.contains('active')) {
            renderUsersGrid();
        }
    });
};

auth.onAuthStateChanged(async (user) => {
    try {
        if (user) {
            // Fetch role from Firestore
            const roleDoc = await db.collection("roles").doc(user.uid).get();

            // Setup initial admin if not exists
            if (!roleDoc.exists && user.email === 'admin@vegasgroup.com') {
                await db.collection("roles").doc(user.uid).set({
                    email: user.email,
                    name: 'Vegas Root',
                    role: 'admin',
                    dateAdded: new Date().toLocaleDateString()
                });
                currentUser = { uid: user.uid, email: user.email, name: 'Vegas Root', role: 'admin' };
            } else {
                const data = roleDoc.exists ? roleDoc.data() : { role: 'viewer', name: user.email.split('@')[0] };
                currentUser = {
                    uid: user.uid,
                    email: user.email,
                    name: data.name,
                    role: data.role
                };
            }

            updateSidebarUi();
            switchView('view-dashboard');

            // Setup real-time listeners
            setupRecordsListener();
            if (currentUser.role === 'admin') {
                setupUsersListener();
            }
        } else {
            currentUser = null;
            recordsData = [];
            usersData = [];
            if (recordsUnsubscribe) { recordsUnsubscribe(); recordsUnsubscribe = null; }
            if (usersUnsubscribe) { usersUnsubscribe(); usersUnsubscribe = null; }
            renderGrid();
            switchView('view-login');
        }
    } catch (err) {
        console.error("Auth state logic error:", err);
        showToast('Error de sesión', '#ef4444');
    }
});

document.getElementById('btnLogin').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    const err = document.getElementById('loginError');

    if (!email || !pass) {
        err.style.display = 'block';
        err.textContent = 'Por favor, rellena ambos campos.';
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, pass);
        err.style.display = 'none';
        document.getElementById('loginForm').reset();
        showToast('Autenticado correctamente');
    } catch (error) {
        err.style.display = 'block';
        err.textContent = 'Credenciales incorrectas: ' + error.message;
        console.error("Auth error:", error);
        alert("Error de Firebase Auth (" + error.code + "): " + error.message);
    }
});

document.getElementById('btnLogout').addEventListener('click', () => {
    auth.signOut();
});

// Sidebar Event Listeners
navDashboard.addEventListener('click', () => switchView('view-dashboard'));
navAdd.addEventListener('click', () => switchView('view-add'));
document.getElementById('nav-access').addEventListener('click', () => switchView('view-access'));



// --- Form Handling & Image to Base64 ---
const form = document.getElementById('recordForm');
const photoInput = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
// SVG Silhouette in Base64 (A common grey avatar)
const defaultImage = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4gPHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmZmYiIC8+IDxwYXRoIGQ9Ik01MCwyNEExMCwxMCAwIDEsMCA1MCw0NEExMCwxMCAwIDEsMCA1MCwyNE01MCw1MUMzOCw1MSAxNyw2MyAxNyw3NlY4M0g4M1Y3NkM4Myw2MyA2Miw1MSA1MCw1MVoiIGZpbGw9IiNjY2MiIC8+PC9zdmc+";
let currentBase64Photo = defaultImage;

// Handle Photo Selection
photoInput.addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            currentBase64Photo = e.target.result;
            photoPreview.src = currentBase64Photo;
        }
        reader.readAsDataURL(file);
    }
});

// Calculate Age (Basic logic)
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Collect dynamic inputs
    const phones = Array.from(document.querySelectorAll('input[name="phone[]"]')).map(input => input.value).filter(val => val.trim() !== '');
    const emails = Array.from(document.querySelectorAll('input[name="email[]"]')).map(input => input.value).filter(val => val.trim() !== '');

    const newRecord = {
        uid: generateId(),
        idNumber: document.getElementById('idNumber').value,
        fullName: document.getElementById('fullName').value,
        activityStatus: document.getElementById('activityStatus').value,
        activityDetail: document.getElementById('activityDetail').value,
        activityDetail2: document.getElementById('activityDetail2').value,
        position: document.getElementById('position').value,
        phones: phones,
        emails: emails,
        photoUrl: currentBase64Photo,
        dateAdded: new Date().toLocaleDateString()
    };

    try {
        await db.collection("records").doc(newRecord.uid).set(newRecord);
        showToast('Registro guardado exitosamente');
    } catch (err) {
        console.error("Error guardando:", err);
        showToast('Error al guardar registro', '#ef4444');
    }

    // Reset dynamic inputs to just one field each
    document.getElementById('phoneInputsContainer').innerHTML = `
        <div class="dynamic-input">
            <input type="tel" name="phone[]" required>
            <button type="button" class="btn-icon add-input" onclick="addDynamicField('phoneInputsContainer', 'tel', 'phone[]')"><i class='bx bx-plus'></i></button>
        </div>`;
    document.getElementById('emailInputsContainer').innerHTML = `
        <div class="dynamic-input">
            <input type="email" name="email[]" required>
            <button type="button" class="btn-icon add-input" onclick="addDynamicField('emailInputsContainer', 'email', 'email[]')"><i class='bx bx-plus'></i></button>
        </div>`;

    form.reset();
    currentBase64Photo = defaultImage;
    photoPreview.src = defaultImage;

    switchView('view-dashboard');
});

document.getElementById('btnCancel').addEventListener('click', () => {
    // Reset dynamic inputs to just one field each
    document.getElementById('phoneInputsContainer').innerHTML = `
        <div class="dynamic-input">
            <input type="tel" name="phone[]" required>
            <button type="button" class="btn-icon add-input" onclick="addDynamicField('phoneInputsContainer', 'tel', 'phone[]')"><i class='bx bx-plus'></i></button>
        </div>`;
    document.getElementById('emailInputsContainer').innerHTML = `
        <div class="dynamic-input">
            <input type="email" name="email[]" required>
            <button type="button" class="btn-icon add-input" onclick="addDynamicField('emailInputsContainer', 'email', 'email[]')"><i class='bx bx-plus'></i></button>
        </div>`;

    form.reset();
    currentBase64Photo = defaultImage;
    photoPreview.src = defaultImage;
    switchView('view-dashboard');
});

// --- Dashboard Rendering ---
const renderGrid = (filterText = '') => {
    const records = recordsData;
    dataGrid.innerHTML = '';

    const filtered = records.filter(r => {
        const text = filterText.toLowerCase();
        return r.fullName.toLowerCase().includes(text) ||
            r.idNumber.toLowerCase().includes(text) ||
            (r.activityStatus && r.activityStatus.toLowerCase().includes(text)) ||
            (r.activityDetail && r.activityDetail.toLowerCase().includes(text)) ||
            (r.activityDetail2 && r.activityDetail2.toLowerCase().includes(text));
    });

    totalCountEl.textContent = filtered.length;

    if (filtered.length === 0) {
        dataGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding: 60px 40px; background: var(--bg-surface); border: 1px dashed var(--border); border-radius: var(--radius-lg);">
                <i class='bx bx-search-alt' style="font-size: 64px; color: #cbd5e1; margin-bottom: 16px;"></i>
                <h3 style="font-size: 18px; margin-bottom: 8px;">No se encontraron resultados</h3>
                <p style="color: #64748b;">No hay registros coincidentes con "${filterText}".<br>Intenta buscar de nuevo con otros términos o añade un nuevo registro.</p>
            </div>
        `;
        return;
    }

    if (filterText.trim() !== '') {
        const searchNotice = document.createElement('div');
        searchNotice.style = "grid-column: 1/-1; padding: 12px 20px; background: #eff6ff; color: #1e3a8a; border-radius: var(--radius-md); font-weight: 500; font-size: 14px; margin-bottom: 8px;";
        searchNotice.innerHTML = `<i class='bx bx-search' style='margin-right:8px;'></i> Mostrando resultados para: <strong>"${filterText}"</strong>`;
        dataGrid.appendChild(searchNotice);
    }

    filtered.forEach(record => {
        let isRestricted = currentUser && currentUser.role === 'restricted';

        let actDesc = record.activityStatus === 'estudia' ? 'Estudia en' : record.activityStatus === 'ambos' ? 'Estudia y Trabaja' : 'Trabaja en';
        let detailString = `${record.activityDetail || 'N/A'}${record.activityDetail2 ? ' & ' + record.activityDetail2 : ''}`;

        // Role-based Censor Mapping
        let displayId = isRestricted ? '<span class="censored">xxx-xxx</span>' : record.idNumber;
        let displayDetail = isRestricted ? '<span class="censored">xxxxxxxx</span>' : detailString;

        const card = document.createElement('div');
        card.className = 'person-card';
        card.innerHTML = `
            <div class="card-header" onclick="openModal('${record.uid}')">
                <img src="${isRestricted ? defaultImage : record.photoUrl}" class="card-photo" alt="Foto">
                <div class="card-title">
                    <h3>${record.fullName}</h3>
                    <p>ID: ${displayId}</p>
                </div>
            </div>
            <div class="card-body" onclick="openModal('${record.uid}')">
                <div class="card-detail">
                    <i class="bx bx-briefcase"></i>
                    <span>${record.position}</span>
                </div>
                <div class="card-detail">
                    <i class="bx ${record.activityStatus === 'estudia' ? 'bx-book' : record.activityStatus === 'ambos' ? 'bx-briefcase-alt-2' : 'bx-building'}"></i>
                    <span>${actDesc}: ${displayDetail}</span>
                </div>
            </div>
            <div class="card-footer">
                <span class="badge" style="text-transform: capitalize;">${record.activityStatus === 'ambos' ? 'Estudiante y Empleado' : record.activityStatus}</span>
                ${currentUser && currentUser.role === 'admin' ? `
                <button class="btn-delete" title="Eliminar Registro" onclick="deleteRecord('${record.uid}', event)">
                    <i class="bx bx-trash"></i>
                </button>
                ` : '<div></div>'}
            </div>
        `;
        dataGrid.appendChild(card);
    });
};

// Search handling
searchInput.addEventListener('input', (e) => {
    renderGrid(e.target.value);
});

// --- Actions (Delete & Modal View) ---
window.deleteRecord = async (uid, event) => {
    event.stopPropagation(); // Prevent opening modal
    if (confirm('¿Estás seguro de que deseas eliminar este registro de la base de datos?')) {
        try {
            await db.collection("records").doc(uid).delete();
            showToast('Registro eliminado', '#ef4444');
        } catch (err) {
            console.error(err);
            showToast('Error al eliminar', '#ef4444');
        }
    }
};

const modal = document.getElementById('detailModal');
const modalBody = document.getElementById('modalBody');

window.openModal = (uid) => {
    const r = recordsData.find(rec => rec.uid === uid || rec.id === uid);
    if (!r) return;

    let isRestricted = currentUser && currentUser.role === 'restricted';

    // Censor Logic
    let displayId = isRestricted ? '<span class="censored">xxx-xxx</span>' : r.idNumber;
    let displayDetail = isRestricted ? '<span class="censored">xxxxxxxx</span>' : (r.activityDetail || 'No especificado');
    let displayDetail2 = isRestricted ? '<span class="censored">xxxxxxxx</span>' : r.activityDetail2;
    let displayPhones = isRestricted ? '<p><span class="censored">xxxxxx</span></p>' : (r.phones && r.phones.length > 0 ? r.phones.map(p => `<p>${p}</p>`).join('') : '<p>No especificado</p>');
    let displayEmails = isRestricted ? '<p><span class="censored">xxxxxx</span></p>' : (r.emails && r.emails.length > 0 ? r.emails.map(e => `<p>${e}</p>`).join('') : '<p>No especificado</p>');

    modalBody.innerHTML = `
        <div class="modal-profile">
            <img src="${isRestricted ? defaultImage : r.photoUrl}" alt="Foto">
            <div class="modal-profile-info">
                <h2>${r.fullName}</h2>
                <p style="color: #64748b; font-size: 14px; text-transform: capitalize;">${r.position} - ${r.activityStatus}</p>
                <div class="badge" style="background: #e2e8f0; color: #334155; margin-right: 8px;">ID: ${displayId}</div>
                <div class="badge">Añadido: ${r.dateAdded}</div>
            </div>
        </div>
        <div class="modal-body-content">
            <div class="detail-grid">
                <div class="detail-item">
                    <h4>Teléfonos</h4>
                    ${displayPhones}
                </div>
                <div class="detail-item">
                    <h4>Correos Electrónicos</h4>
                    ${displayEmails}
                </div>
                <div class="detail-item">
                    <h4>Estado Actividad</h4>
                    <p style="text-transform: capitalize;">${r.activityStatus}</p>
                </div>
                <div class="detail-item">
                    <h4>${r.activityStatus === 'estudia' ? 'Institución Educativa' : r.activityStatus === 'ambos' ? 'Institución y Empresa' : 'Empresa'}</h4>
                    <p>${displayDetail}</p>
                    ${r.activityStatus === 'ambos' && r.activityDetail2 ? `<p style="margin-top: 4px;">${displayDetail2}</p>` : ''}
                </div>
            </div>
        </div>
`;
    modal.classList.add('show');
};

document.querySelector('.close-modal').addEventListener('click', () => {
    modal.classList.remove('show');
});
window.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('show');
});

// --- Toast Notification ---
const toast = document.getElementById('toast');
const showToast = (message, color = '#10b981') => {
    toast.textContent = message;
    toast.style.background = color;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
};

// Dynamic Fields Logic
window.addDynamicField = (containerId, type, name) => {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = 'dynamic-input';
    div.innerHTML = `
            <input type="${type}" name="${name}" required>
        <button type="button" class="btn-icon remove-input" onclick="removeDynamicField(this)"><i class='bx bx-minus'></i></button>
    `;
    container.appendChild(div);
};

window.removeDynamicField = (btn) => {
    const fieldRow = btn.closest('.dynamic-input');
    fieldRow.remove();
};

// Activity Input Toggle
window.toggleActivityInput = () => {
    const status = document.getElementById('activityStatus').value;
    const group = document.getElementById('activityDetailGroup');
    const label = document.getElementById('activityDetailLabel');
    const input = document.getElementById('activityDetail');

    // Group 2 for "ambos"
    const group2 = document.getElementById('activityDetailGroup2');
    const input2 = document.getElementById('activityDetail2');

    if (status === 'estudia') {
        group.style.display = 'flex';
        group2.style.display = 'none';
        label.textContent = 'Nombre de Institución';
        input.placeholder = 'Ej: Universidad Central...';
        input.required = true;
        input2.required = false;
        input2.value = '';
    } else if (status === 'trabaja') {
        group.style.display = 'flex';
        group2.style.display = 'none';
        label.textContent = 'Nombre de Empresa';
        input.placeholder = 'Ej: Constructora XYZ...';
        input.required = true;
        input2.required = false;
        input2.value = '';
    } else if (status === 'ambos') {
        group.style.display = 'flex';
        group2.style.display = 'flex';

        label.textContent = 'Nombre de Institución';
        input.placeholder = 'Ej: Universidad Central...';
        input.required = true;

        input2.placeholder = 'Ej: Empresa de Prácticas...';
        input2.required = true;
    } else {
        group.style.display = 'none';
        group2.style.display = 'none';
        input.value = '';
        input2.value = '';
        input.required = false;
        input2.required = false;
    }
};

// --- Access Management Logic ---
const renderUsersGrid = () => {
    const grid = document.getElementById('usersGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const users = usersData;

    users.forEach(u => {
        let roleBadge = u.role === 'admin' ? '#f59e0b' : u.role === 'restricted' ? '#ef4444' : '#3b82f6';
        let roleName = u.role === 'admin' ? 'Admin' : u.role === 'restricted' ? 'Restringido' : 'Lector';

        const div = document.createElement('div');
        div.className = 'user-card';
        div.innerHTML = `
            <div class="user-card-info">
                <span class="user-card-name">${u.name}</span>
                <span class="user-card-email">${u.email}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
                <span class="badge" style="background: ${roleBadge}; color: white; border: none;">${roleName}</span>
                ${u.email !== 'admin@vegasgroup.com' ? `
                <button class="btn-delete" title="Revocar Acceso" onclick="deleteUser('${u.uid}')" style="background: transparent; border: none; font-size: 18px; padding: 4px; border-radius: 4px; cursor: pointer; color: var(--text-muted);">
                    <i class="bx bx-trash" style="color: #ef4444;"></i>
                </button>
                ` : '<div style="width: 26px;"></div>'}
            </div>
        `;
        grid.appendChild(div);
    });
};

document.getElementById('addUserForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser || currentUser.role !== 'admin') return;

    const name = document.getElementById('newUserName').value;
    const email = document.getElementById('newUserEmail').value;
    const pass = document.getElementById('newUserPass').value;
    const role = document.getElementById('newUserRole').value;

    const users = usersData;
    if (users.find(u => u.email === email)) {
        alert('Este correo ya tiene acceso.');
        return;
    }

    try {
        if (!confirm("Advertencia: Crear un usuario nuevo cerrará momentáneamente tu sesión de administrador. Deberás volver a iniciar sesión (1 sola vez). ¿Continuar?")) return;

        const res = await auth.createUserWithEmailAndPassword(email, pass);
        await db.collection("roles").doc(res.user.uid).set({
            name,
            email,
            role,
            dateAdded: new Date().toLocaleDateString()
        });

        document.getElementById('addUserForm').reset();
    } catch (err) {
        console.error(err);
        alert('Error al crear usuario: ' + err.message);
    }
});

window.deleteUser = async (uid) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    if (confirm('¿Seguro que deseas revocar el acceso a este usuario (Solo remueve sus permisos en la BD)?')) {
        try {
            await db.collection("roles").doc(uid).delete();
            showToast('Acceso revocado', '#ef4444');
        } catch (err) {
            console.error(err);
            showToast('Error', '#ef4444');
        }
    }
};

// Init
switchView('view-dashboard'); // Will trigger login view if no currentUser
