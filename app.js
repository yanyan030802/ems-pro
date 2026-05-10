// ═══════════════════════════════════════════
//  EMS Pro — app.js
//  Employee Management System
//  Firebase Firestore + Auth backend
// ═══════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, doc,
  updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── YOUR FIREBASE CONFIG (replace with yours from Step 2 in the guide) ──
const firebaseConfig = {
apiKey: "AIzaSyAQ2WNK00OWJRkefj2Vwpw8glk6un5Gfcw",
  authDomain: "ems-pro-6040d.firebaseapp.com",
  projectId: "ems-pro-6040d",
  storageBucket: "ems-pro-6040d.firebasestorage.app",
  messagingSenderId: "617342037987",
  appId: "1:617342037987:web:c5693aa7123dff49eebad6"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// ─────────────────────────────────────────
//  GLOBAL STATE
// ─────────────────────────────────────────
let allEmployees = [];
let allAttendance = [];
let allLeave = [];
let allPayroll = [];
let allPerformance = [];

// ─────────────────────────────────────────
//  AUTH LISTENER — runs on every page load
// ─────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user) {
    showApp(user);
  } else {
    showLoginScreen();
  }
});

function showApp(user) {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('registerScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  const name = user.displayName || user.email.split('@')[0];
  document.getElementById('sidebarName').textContent = name;
  document.getElementById('sidebarAvatar').textContent = name.charAt(0).toUpperCase();

  // Set date in topbar
  document.getElementById('topbarDate').textContent = new Date().toLocaleDateString('en-PH', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });

  // Load all data
  listenToEmployees();
  listenToAttendance();
  listenToLeave();
  listenToPayroll();
  listenToPerformance();
}

function showLoginScreen() {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('registerScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

// ─────────────────────────────────────────
//  AUTH FUNCTIONS
// ─────────────────────────────────────────
window.loginUser = async function () {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');

  if (!email || !pass) { showError(errEl, 'Please enter email and password.'); return; }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    showError(errEl, getAuthError(e.code));
  }
};

window.registerUser = async function () {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPassword').value;
  const errEl = document.getElementById('registerError');
  errEl.classList.add('hidden');

  if (!name || !email || !pass) { showError(errEl, 'All fields are required.'); return; }
  if (pass.length < 6) { showError(errEl, 'Password must be at least 6 characters.'); return; }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    showToast('Account created! Welcome, ' + name);
  } catch (e) {
    showError(errEl, getAuthError(e.code));
  }
};

window.logoutUser = async function () {
  await signOut(auth);
};

window.showLogin = function () {
  document.getElementById('registerScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
};

window.showRegister = function () {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('registerScreen').classList.remove('hidden');
};

function getAuthError(code) {
  const map = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Try again.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/invalid-credential': 'Invalid email or password.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

// ─────────────────────────────────────────
//  NAVIGATION
// ─────────────────────────────────────────
window.showPage = function (page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const titles = {
    dashboard: 'Dashboard', employees: 'Employees',
    attendance: 'Attendance', leave: 'Leave Management',
    payroll: 'Payroll', performance: 'Performance'
  };

  document.getElementById('page-' + page).classList.add('active');
  if (el) el.classList.add('active');
  document.getElementById('pageTitle').textContent = titles[page] || page;

  // Close sidebar on mobile
  if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
};

window.toggleSidebar = function () {
  document.getElementById('sidebar').classList.toggle('open');
};

// ─────────────────────────────────────────
//  EMPLOYEES — Firestore CRUD
// ─────────────────────────────────────────
function listenToEmployees() {
  const q = query(collection(db, 'employees'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => {
    allEmployees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEmployees(allEmployees);
    updateDashboard();
    populateEmployeeDropdowns();
  });
}

function renderEmployees(list) {
  const tbody = document.getElementById('empTableBody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No employees found.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(e => `
    <tr>
      <td><strong>${e.empId || '—'}</strong></td>
      <td>${e.name}</td>
      <td>${e.position || '—'}</td>
      <td>${e.department || '—'}</td>
      <td>${e.email || '—'}</td>
      <td><span class="badge-pill ${getBadgeClass(e.status)}">${e.status || 'Active'}</span></td>
      <td>
        <button class="btn-icon btn-edit" onclick="editEmployee('${e.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn-icon btn-del" onclick="confirmDelete('${e.id}', 'employees', '${e.name}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');

  // Update department filter
  const depts = [...new Set(allEmployees.map(e => e.department).filter(Boolean))];
  const filter = document.getElementById('empDeptFilter');
  const current = filter.value;
  filter.innerHTML = '<option value="">All Departments</option>' +
    depts.map(d => `<option value="${d}" ${d === current ? 'selected' : ''}>${d}</option>`).join('');
}

window.filterEmployees = function () {
  const search = document.getElementById('empSearch').value.toLowerCase();
  const dept = document.getElementById('empDeptFilter').value;
  const filtered = allEmployees.filter(e =>
    (!search || e.name?.toLowerCase().includes(search) || e.empId?.toLowerCase().includes(search) || e.position?.toLowerCase().includes(search)) &&
    (!dept || e.department === dept)
  );
  renderEmployees(filtered);
};

window.saveEmployee = async function () {
  const docId = document.getElementById('empDocId').value;
  const data = {
    empId: v('empId'), name: v('empName'), position: v('empPosition'),
    department: v('empDept'), email: v('empEmail'), phone: v('empPhone'),
    dateHired: v('empHired'), type: v('empType'), salary: parseFloat(v('empSalary')) || 0,
    status: v('empStatus')
  };
  if (!data.name) { showToast('Name is required.', 'error'); return; }

  try {
    if (docId) {
      await updateDoc(doc(db, 'employees', docId), data);
      showToast('Employee updated!', 'success');
    } else {
      await addDoc(collection(db, 'employees'), { ...data, createdAt: serverTimestamp() });
      showToast('Employee added!', 'success');
    }
    closeModal('addEmpModal');
  } catch (e) { showToast('Error: ' + e.message, 'error'); }
};

window.editEmployee = function (id) {
  const e = allEmployees.find(x => x.id === id);
  if (!e) return;
  document.getElementById('empModalTitle').textContent = 'Edit Employee';
  document.getElementById('empDocId').value = id;
  setVal('empId', e.empId); setVal('empName', e.name); setVal('empPosition', e.position);
  setVal('empDept', e.department); setVal('empEmail', e.email); setVal('empPhone', e.phone);
  setVal('empHired', e.dateHired); setVal('empType', e.type); setVal('empSalary', e.salary);
  setVal('empStatus', e.status);
  openModal('addEmpModal');
};

// ─────────────────────────────────────────
//  ATTENDANCE
// ─────────────────────────────────────────
function listenToAttendance() {
  const q = query(collection(db, 'attendance'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => {
    allAttendance = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAttendance(allAttendance);
    updateDashboard();
  });
}

function renderAttendance(list) {
  const tbody = document.getElementById('attTableBody');
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No attendance records.</td></tr>'; return; }
  tbody.innerHTML = list.map(a => `
    <tr>
      <td>${a.employeeName}</td>
      <td>${a.date}</td>
      <td>${a.timeIn || '—'}</td>
      <td>${a.timeOut || '—'}</td>
      <td><span class="badge-pill ${getBadgeClass(a.status)}">${a.status}</span></td>
      <td>
        <button class="btn-icon btn-edit" onclick="editAttendance('${a.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn-icon btn-del" onclick="confirmDelete('${a.id}', 'attendance', '${a.employeeName}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

window.filterAttendance = function () {
  const date = document.getElementById('attDateFilter').value;
  const filtered = date ? allAttendance.filter(a => a.date === date) : allAttendance;
  renderAttendance(filtered);
};

window.saveAttendance = async function () {
  const docId = document.getElementById('attDocId').value;
  const empSel = document.getElementById('attEmp');
  const data = {
    employeeId: empSel.value,
    employeeName: empSel.options[empSel.selectedIndex]?.text || '',
    date: v('attDate'), timeIn: v('attIn'), timeOut: v('attOut'),
    status: v('attStatus')
  };
  if (!data.employeeId || !data.date) { showToast('Select an employee and date.', 'error'); return; }
  try {
    if (docId) {
      await updateDoc(doc(db, 'attendance', docId), data);
      showToast('Attendance updated!', 'success');
    } else {
      await addDoc(collection(db, 'attendance'), { ...data, createdAt: serverTimestamp() });
      showToast('Attendance logged!', 'success');
    }
    closeModal('addAttModal');
  } catch (e) { showToast(e.message, 'error'); }
};

window.editAttendance = function (id) {
  const a = allAttendance.find(x => x.id === id);
  if (!a) return;
  document.getElementById('attModalTitle').textContent = 'Edit Attendance';
  document.getElementById('attDocId').value = id;
  setVal('attDate', a.date); setVal('attIn', a.timeIn); setVal('attOut', a.timeOut);
  setVal('attStatus', a.status);
  setTimeout(() => { setVal('attEmp', a.employeeId); }, 100);
  openModal('addAttModal');
};

// ─────────────────────────────────────────
//  LEAVE
// ─────────────────────────────────────────
function listenToLeave() {
  const q = query(collection(db, 'leave'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => {
    allLeave = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderLeave(allLeave);
    updateDashboard();
  });
}

function renderLeave(list) {
  const tbody = document.getElementById('leaveTableBody');
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No leave records.</td></tr>'; return; }
  tbody.innerHTML = list.map(l => {
    const days = l.from && l.to ? Math.max(1, Math.round((new Date(l.to) - new Date(l.from)) / 86400000) + 1) : '—';
    return `
    <tr>
      <td>${l.employeeName}</td>
      <td>${l.type}</td>
      <td>${l.from}</td>
      <td>${l.to}</td>
      <td>${days}</td>
      <td><span class="badge-pill ${getBadgeClass(l.status)}">${l.status}</span></td>
      <td>
        <button class="btn-icon btn-edit" onclick="editLeave('${l.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn-icon btn-del" onclick="confirmDelete('${l.id}', 'leave', '${l.employeeName}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
}

window.saveLeave = async function () {
  const docId = document.getElementById('leaveDocId').value;
  const empSel = document.getElementById('leaveEmp');
  const data = {
    employeeId: empSel.value,
    employeeName: empSel.options[empSel.selectedIndex]?.text || '',
    type: v('leaveType'), from: v('leaveFrom'), to: v('leaveTo'),
    reason: v('leaveReason'), status: v('leaveStatus')
  };
  if (!data.employeeId || !data.from || !data.to) { showToast('Fill required fields.', 'error'); return; }
  try {
    if (docId) {
      await updateDoc(doc(db, 'leave', docId), data);
      showToast('Leave updated!', 'success');
    } else {
      await addDoc(collection(db, 'leave'), { ...data, createdAt: serverTimestamp() });
      showToast('Leave request filed!', 'success');
    }
    closeModal('addLeaveModal');
  } catch (e) { showToast(e.message, 'error'); }
};

window.editLeave = function (id) {
  const l = allLeave.find(x => x.id === id);
  if (!l) return;
  document.getElementById('leaveModalTitle').textContent = 'Edit Leave';
  document.getElementById('leaveDocId').value = id;
  setVal('leaveType', l.type); setVal('leaveFrom', l.from); setVal('leaveTo', l.to);
  setVal('leaveReason', l.reason); setVal('leaveStatus', l.status);
  setTimeout(() => setVal('leaveEmp', l.employeeId), 100);
  openModal('addLeaveModal');
};

// ─────────────────────────────────────────
//  PAYROLL
// ─────────────────────────────────────────
function listenToPayroll() {
  const q = query(collection(db, 'payroll'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => {
    allPayroll = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPayroll(allPayroll);
  });
}

function renderPayroll(list) {
  const tbody = document.getElementById('payTableBody');
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No payroll records.</td></tr>'; return; }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td>${p.employeeName}</td>
      <td>${p.period}</td>
      <td>₱${Number(p.basic || 0).toLocaleString()}</td>
      <td>₱${Number(p.deductions || 0).toLocaleString()}</td>
      <td><strong>₱${Number(p.net || 0).toLocaleString()}</strong></td>
      <td><span class="badge-pill ${getBadgeClass(p.status)}">${p.status}</span></td>
      <td>
        <button class="btn-icon btn-edit" onclick="editPayroll('${p.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn-icon btn-del" onclick="confirmDelete('${p.id}', 'payroll', '${p.employeeName}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

window.calcNetPay = function () {
  const basic = parseFloat(document.getElementById('payBasic').value) || 0;
  const ded = parseFloat(document.getElementById('payDeductions').value) || 0;
  document.getElementById('payNet').value = (basic - ded).toFixed(2);
};

window.savePayroll = async function () {
  const docId = document.getElementById('payDocId').value;
  const empSel = document.getElementById('payEmp');
  const data = {
    employeeId: empSel.value,
    employeeName: empSel.options[empSel.selectedIndex]?.text || '',
    period: v('payPeriod'),
    basic: parseFloat(v('payBasic')) || 0,
    deductions: parseFloat(v('payDeductions')) || 0,
    net: parseFloat(v('payNet')) || 0,
    status: v('payStatus')
  };
  if (!data.employeeId || !data.period) { showToast('Fill required fields.', 'error'); return; }
  try {
    if (docId) {
      await updateDoc(doc(db, 'payroll', docId), data);
      showToast('Payroll updated!', 'success');
    } else {
      await addDoc(collection(db, 'payroll'), { ...data, createdAt: serverTimestamp() });
      showToast('Payroll record added!', 'success');
    }
    closeModal('addPayModal');
  } catch (e) { showToast(e.message, 'error'); }
};

window.editPayroll = function (id) {
  const p = allPayroll.find(x => x.id === id);
  if (!p) return;
  document.getElementById('payModalTitle').textContent = 'Edit Payroll';
  document.getElementById('payDocId').value = id;
  setVal('payPeriod', p.period); setVal('payBasic', p.basic);
  setVal('payDeductions', p.deductions); setVal('payNet', p.net); setVal('payStatus', p.status);
  setTimeout(() => setVal('payEmp', p.employeeId), 100);
  openModal('addPayModal');
};

// ─────────────────────────────────────────
//  PERFORMANCE
// ─────────────────────────────────────────
function listenToPerformance() {
  const q = query(collection(db, 'performance'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => {
    allPerformance = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPerformance(allPerformance);
  });
}

function renderPerformance(list) {
  const tbody = document.getElementById('perfTableBody');
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No evaluations yet.</td></tr>'; return; }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td>${p.employeeName}</td>
      <td>${p.period}</td>
      <td><span class="badge-pill badge-active">${p.rating}</span></td>
      <td>${p.score || '—'}/100</td>
      <td>${p.remarks || '—'}</td>
      <td>
        <button class="btn-icon btn-edit" onclick="editPerformance('${p.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn-icon btn-del" onclick="confirmDelete('${p.id}', 'performance', '${p.employeeName}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

window.savePerformance = async function () {
  const docId = document.getElementById('perfDocId').value;
  const empSel = document.getElementById('perfEmp');
  const data = {
    employeeId: empSel.value,
    employeeName: empSel.options[empSel.selectedIndex]?.text || '',
    period: v('perfPeriod'), rating: v('perfRating'),
    score: parseFloat(v('perfScore')) || 0, remarks: v('perfRemarks')
  };
  if (!data.employeeId || !data.period) { showToast('Fill required fields.', 'error'); return; }
  try {
    if (docId) {
      await updateDoc(doc(db, 'performance', docId), data);
      showToast('Evaluation updated!', 'success');
    } else {
      await addDoc(collection(db, 'performance'), { ...data, createdAt: serverTimestamp() });
      showToast('Evaluation saved!', 'success');
    }
    closeModal('addPerfModal');
  } catch (e) { showToast(e.message, 'error'); }
};

window.editPerformance = function (id) {
  const p = allPerformance.find(x => x.id === id);
  if (!p) return;
  document.getElementById('perfModalTitle').textContent = 'Edit Evaluation';
  document.getElementById('perfDocId').value = id;
  setVal('perfPeriod', p.period); setVal('perfRating', p.rating);
  setVal('perfScore', p.score); setVal('perfRemarks', p.remarks);
  setTimeout(() => setVal('perfEmp', p.employeeId), 100);
  openModal('addPerfModal');
};

// ─────────────────────────────────────────
//  DELETE
// ─────────────────────────────────────────
window.confirmDelete = function (id, collectionName, name) {
  document.getElementById('deleteMsg').textContent = `Delete record for "${name}"? This cannot be undone.`;
  document.getElementById('confirmDeleteBtn').onclick = async () => {
    try {
      await deleteDoc(doc(db, collectionName, id));
      showToast('Record deleted.', 'success');
      closeModal('deleteModal');
    } catch (e) { showToast(e.message, 'error'); }
  };
  openModal('deleteModal');
};

// ─────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────
function updateDashboard() {
  const total = allEmployees.length;
  const active = allEmployees.filter(e => e.status === 'Active').length;
  const today = new Date().toISOString().split('T')[0];
  const onLeave = allLeave.filter(l => l.status === 'Approved' && l.from <= today && l.to >= today).length;
  const depts = new Set(allEmployees.map(e => e.department).filter(Boolean)).size;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-onleave').textContent = onLeave;
  document.getElementById('stat-depts').textContent = depts;

  // Recent employees table
  const recent = allEmployees.slice(0, 5);
  const recTb = document.getElementById('recentEmpTable');
  recTb.innerHTML = recent.length
    ? recent.map(e => `<tr>
        <td>${e.name}</td>
        <td>${e.department || '—'}</td>
        <td><span class="badge-pill ${getBadgeClass(e.status)}">${e.status || 'Active'}</span></td>
      </tr>`).join('')
    : '<tr><td colspan="3" class="empty">No employees yet.</td></tr>';

  // Dept chart
  const deptMap = {};
  allEmployees.forEach(e => { if (e.department) deptMap[e.department] = (deptMap[e.department] || 0) + 1; });
  const maxCount = Math.max(...Object.values(deptMap), 1);
  const chartEl = document.getElementById('deptChart');
  chartEl.innerHTML = Object.entries(deptMap).length
    ? Object.entries(deptMap).map(([d, c]) => `
      <div class="dept-bar">
        <div class="dept-bar-label"><span>${d}</span><span>${c} emp${c > 1 ? 's' : ''}</span></div>
        <div class="dept-bar-track"><div class="dept-bar-fill" style="width:${(c/maxCount*100).toFixed(1)}%"></div></div>
      </div>`).join('')
    : '<p style="color:var(--text-light);text-align:center">No data yet.</p>';

  // Notification badge
  const pendingLeave = allLeave.filter(l => l.status === 'Pending').length;
  document.getElementById('notifBadge').textContent = pendingLeave;
  document.getElementById('notifBadge').style.display = pendingLeave ? 'flex' : 'none';
}

// ─────────────────────────────────────────
//  HELPER: Populate employee dropdowns
// ─────────────────────────────────────────
function populateEmployeeDropdowns() {
  const ids = ['attEmp', 'leaveEmp', 'payEmp', 'perfEmp'];
  const options = allEmployees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = options || '<option value="">No employees added yet</option>';
  });
}

// ─────────────────────────────────────────
//  MODAL HELPERS
// ─────────────────────────────────────────
window.openModal = function (id) {
  // Reset form fields when opening "add" mode
  const overlay = document.getElementById(id);
  if (!id.includes('delete')) {
    // Reset hidden doc id so we know it's a new record
    const docIdField = overlay.querySelector('input[type="hidden"]');
    if (docIdField && !docIdField.value) {
      overlay.querySelectorAll('input:not([type=hidden]), select, textarea').forEach(el => {
        if (el.tagName === 'SELECT') el.selectedIndex = 0;
        else if (el.type !== 'hidden') el.value = '';
      });
    }
  }
  overlay.classList.remove('hidden');
};

window.closeModal = function (id) {
  const overlay = document.getElementById(id);
  overlay.classList.add('hidden');
  // Clear doc id for next open
  const docIdField = overlay.querySelector('input[type="hidden"]');
  if (docIdField) docIdField.value = '';

  // Reset title labels
  const titleMap = {
    addEmpModal: 'Add New Employee', addAttModal: 'Log Attendance',
    addLeaveModal: 'File Leave Request', addPayModal: 'Add Payroll Record',
    addPerfModal: 'Add Performance Evaluation'
  };
  const titleEl = overlay.querySelector('[id$="ModalTitle"]');
  if (titleEl && titleMap[id]) titleEl.textContent = titleMap[id];
};

// ─────────────────────────────────────────
//  UI HELPERS
// ─────────────────────────────────────────
function v(id) { return document.getElementById(id)?.value || ''; }
function setVal(id, val) { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; }

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

window.showToast = function (msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3500);
};

function getBadgeClass(status) {
  const map = {
    'Active': 'badge-active', 'Inactive': 'badge-inactive', 'On Leave': 'badge-leave',
    'Pending': 'badge-pending', 'Approved': 'badge-approved', 'Rejected': 'badge-rejected',
    'Released': 'badge-released', 'Present': 'badge-present', 'Absent': 'badge-absent',
    'Late': 'badge-late', 'Half Day': 'badge-pending'
  };
  return map[status] || 'badge-active';
}
