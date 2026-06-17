import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, addDoc, deleteDoc,
  updateDoc, setDoc, onSnapshot, query, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAtND_feaejZJ8mbVagoFqGJeHcKwFq_FQ",
  authDomain: "flowroll-8421e.firebaseapp.com",
  projectId: "flowroll-8421e",
  storageBucket: "flowroll-8421e.firebasestorage.app",
  messagingSenderId: "410290247936",
  appId: "1:410290247936:web:39b164770ea4f18037bbe5",
  measurementId: "G-SVXS3W2VBD"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const SENSEI_PIN = "1234";

const hoy = new Date();
const fechaKey = hoy.toISOString().split('T')[0];
const fechaStr = hoy.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

let unsubAsistencia = null;
let unsubVideos = null;

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

window.backToLogin = () => {
  if (unsubAsistencia) { unsubAsistencia(); unsubAsistencia = null; }
  if (unsubVideos) { unsubVideos(); unsubVideos = null; }
  showView('loginView');
};

window.showPin = () => {
  showView('pinView');
  document.getElementById('pinInput').value = '';
  document.getElementById('pinError').style.display = 'none';
};

window.checkPin = (el) => {
  if (el.value.length === 4) {
    if (el.value === SENSEI_PIN) {
      showView('senseiView');
      initSensei();
    } else {
      document.getElementById('pinError').style.display = '';
      el.value = '';
    }
  }
};

window.enterAlumno = () => {
  showView('alumnoView');
  document.getElementById('fechaBanner').textContent = fechaStr;
  initAlumno();
};

// ── ALUMNO ──────────────────────────────────────────────

async function initAlumno() {
  await renderSelectAlumnos();
  renderVideosAlumno();
  document.getElementById('alumnoSeleccionado').value = '';
  document.getElementById('marcarArea').style.display = 'none';
  document.getElementById('yaRegistrado').style.display = 'none';
}

async function renderSelectAlumnos() {
  const sel = document.getElementById('alumnoSeleccionado');
  sel.innerHTML = '<option value="">— Selecciona tu nombre —</option>';
  try {
    const snap = await getDocs(collection(db, 'alumnos'));
    snap.forEach(d => {
      const a = d.data();
      const o = document.createElement('option');
      o.value = d.id;
      o.textContent = a.nombre;
      sel.appendChild(o);
    });
  } catch (e) {
    showToast('Error cargando alumnos');
  }
}

window.onAlumnoChange = async () => {
  const id = document.getElementById('alumnoSeleccionado').value;
  document.getElementById('marcarArea').style.display = 'none';
  document.getElementById('yaRegistrado').style.display = 'none';
  if (!id) return;

  const snap = await getDocs(collection(db, 'alumnos'));
  let alumno = null;
  snap.forEach(d => { if (d.id === id) alumno = { id: d.id, ...d.data() }; });
  if (!alumno) return;

  const asistSnap = await getDocs(
    query(collection(db, 'asistencias'), where('alumnoId', '==', id), where('fecha', '==', fechaKey))
  );

  if (!asistSnap.empty) {
    document.getElementById('yaRegistrado').style.display = 'flex';
  } else {
    const iniciales = alumno.nombre.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('alumnoCardPreview').innerHTML = `
      <div class="avatar">${iniciales}</div>
      <div class="alumno-info">
        <div class="nombre">${alumno.nombre}</div>
        <div class="nivel">${alumno.nivel || 'Sin nivel'}</div>
      </div>`;
    document.getElementById('marcarArea').style.display = 'block';
  }
};

window.marcarAsistencia = async () => {
  const id = document.getElementById('alumnoSeleccionado').value;
  if (!id) return;
  const btn = document.getElementById('btnMarcar');
  btn.disabled = true;
  try {
    await addDoc(collection(db, 'asistencias'), {
      alumnoId: id,
      fecha: fechaKey,
      estado: 'pendiente',
      timestamp: new Date().toISOString()
    });
    document.getElementById('marcarArea').style.display = 'none';
    document.getElementById('yaRegistrado').style.display = 'flex';
    showToast('¡Asistencia registrada!');
  } catch (e) {
    showToast('Error al registrar');
    btn.disabled = false;
  }
};

function renderVideosAlumno() {
  const el = document.getElementById('videosListAlumno');
  el.innerHTML = '<div class="loading">Cargando videos...</div>';
  unsubVideos = onSnapshot(collection(db, 'videos'), snap => {
    if (snap.empty) {
      el.innerHTML = '<div class="empty-state"><i class="fa-solid fa-video-slash"></i><p>El Sensei no ha subido videos aún.</p></div>';
      return;
    }
    el.innerHTML = snap.docs.map(d => {
      const v = d.data();
      return `<div class="video-card">
        <iframe src="${getYoutubeEmbed(v.url)}" allowfullscreen loading="lazy"></iframe>
        <div class="video-body">
          <div class="vtitle">${v.titulo}</div>
          ${v.desc ? `<div class="vdesc">${v.desc}</div>` : ''}
        </div>
      </div>`;
    }).join('');
  });
}

window.switchAlumnoTab = (tab, el) => {
  document.querySelectorAll('#alumnoView .nav-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('#alumnoView .tab-section').forEach(s => s.classList.remove('active'));
  document.getElementById('alumno' + cap(tab)).classList.add('active');
};

// ── SENSEI ──────────────────────────────────────────────

function initSensei() {
  document.getElementById('fechaBannerSensei').textContent = fechaStr;
  listenAsistencia();
  renderAlumnosList();
  renderVideosSensei();
}

function listenAsistencia() {
  const listEl = document.getElementById('asistenciaList');
  const metricsEl = document.getElementById('metricsRow');
  listEl.innerHTML = '<div class="loading">Cargando...</div>';

  unsubAsistencia = onSnapshot(
    query(collection(db, 'asistencias'), where('fecha', '==', fechaKey)),
    async snap => {
      const asistencias = {};
      snap.forEach(d => { asistencias[d.data().alumnoId] = { id: d.id, ...d.data() }; });

      const alumnosSnap = await getDocs(collection(db, 'alumnos'));
      const alumnos = [];
      alumnosSnap.forEach(d => alumnos.push({ id: d.id, ...d.data() }));

      const presentes = alumnos.filter(a => asistencias[a.id]);
      const ausentes = alumnos.filter(a => !asistencias[a.id]);
      const confirmados = presentes.filter(a => asistencias[a.id].estado === 'confirmada').length;

      metricsEl.innerHTML = `
        <div class="metric"><div class="val">${alumnos.length}</div><div class="lbl">Total</div></div>
        <div class="metric"><div class="val">${presentes.length}</div><div class="lbl">Asistieron</div></div>
        <div class="metric"><div class="val">${confirmados}</div><div class="lbl">Confirmados</div></div>`;

      let html = '';
      if (presentes.length === 0) {
        html += '<div class="empty-state"><i class="fa-solid fa-calendar-xmark"></i><p>Ningún alumno ha marcado asistencia aún.</p></div>';
      }
      presentes.forEach(a => {
        const est = asistencias[a.id].estado;
        const asistId = asistencias[a.id].id;
        const iniciales = (a.nombre || '?').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
        const badgeClass = est === 'confirmada' ? 'badge--ok' : est === 'rechazada' ? 'badge--no' : 'badge--pend';
        const badgeText = est === 'confirmada' ? 'Confirmada' : est === 'rechazada' ? 'Rechazada' : 'Pendiente';
        const btns = est === 'pendiente'
          ? `<button class="btn-icon btn-icon--ok" onclick="confirmar('${asistId}', true)" title="Confirmar"><i class="fa-solid fa-check"></i></button>
             <button class="btn-icon btn-icon--no" onclick="confirmar('${asistId}', false)" title="Rechazar"><i class="fa-solid fa-xmark"></i></button>`
          : '';
        html += `<div class="asist-card">
          <div class="avatar">${iniciales}</div>
          <div class="alumno-info"><div class="nombre">${a.nombre}</div><div class="nivel">${a.nivel || ''}</div></div>
          <div class="asist-actions"><span class="badge ${badgeClass}">${badgeText}</span>${btns}</div>
        </div>`;
      });

      if (ausentes.length > 0) {
        html += `<p style="font-size:12px;color:var(--muted);margin:12px 0 8px;text-transform:uppercase;letter-spacing:.5px;">Sin registrar</p>`;
        ausentes.forEach(a => {
          const iniciales = (a.nombre || '?').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
          html += `<div class="asist-card asist-card--ausente">
            <div class="avatar">${iniciales}</div>
            <div class="alumno-info"><div class="nombre">${a.nombre}</div><div class="nivel">${a.nivel || ''}</div></div>
            <div class="asist-actions"><span class="badge badge--ausente">Ausente</span></div>
          </div>`;
        });
      }
      listEl.innerHTML = html;
    }
  );
}

window.confirmar = async (asistId, ok) => {
  try {
    await updateDoc(doc(db, 'asistencias', asistId), { estado: ok ? 'confirmada' : 'rechazada' });
    showToast(ok ? 'Asistencia confirmada ✓' : 'Asistencia rechazada');
  } catch (e) { showToast('Error al actualizar'); }
};

async function renderAlumnosList() {
  const el = document.getElementById('alumnosList');
  el.innerHTML = '<div class="loading">Cargando...</div>';
  try {
    const snap = await getDocs(collection(db, 'alumnos'));
    if (snap.empty) {
      el.innerHTML = '<div class="empty-state"><i class="fa-solid fa-users-slash"></i><p>No hay alumnos registrados.</p></div>';
      return;
    }
    el.innerHTML = snap.docs.map(d => {
      const a = d.data();
      const iniciales = (a.nombre || '?').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
      return `<div class="asist-card">
        <div class="avatar">${iniciales}</div>
        <div class="alumno-info"><div class="nombre">${a.nombre}</div><div class="nivel">${a.nivel || 'Sin nivel'}</div></div>
        <div class="asist-actions"><button class="btn-icon btn-icon--no" onclick="eliminarAlumno('${d.id}')"><i class="fa-solid fa-trash"></i></button></div>
      </div>`;
    }).join('');
  } catch (e) { el.innerHTML = '<div class="empty-state"><p>Error cargando alumnos.</p></div>'; }
}

window.agregarAlumno = async () => {
  const nombre = document.getElementById('nuevoNombre').value.trim();
  const nivel = document.getElementById('nuevoNivel').value.trim();
  if (!nombre) { showToast('Escribe el nombre del alumno'); return; }
  try {
    await addDoc(collection(db, 'alumnos'), { nombre, nivel: nivel || 'Sin nivel' });
    document.getElementById('nuevoNombre').value = '';
    document.getElementById('nuevoNivel').value = '';
    await renderAlumnosList();
    showToast('Alumno agregado');
  } catch (e) { showToast('Error al agregar'); }
};

window.eliminarAlumno = async (id) => {
  if (!confirm('¿Eliminar este alumno?')) return;
  try {
    await deleteDoc(doc(db, 'alumnos', id));
    await renderAlumnosList();
    showToast('Alumno eliminado');
  } catch (e) { showToast('Error al eliminar'); }
};

function renderVideosSensei() {
  const el = document.getElementById('videosListSensei');
  el.innerHTML = '<div class="loading">Cargando...</div>';
  onSnapshot(collection(db, 'videos'), snap => {
    if (snap.empty) {
      el.innerHTML = '<div class="empty-state"><i class="fa-solid fa-video-slash"></i><p>No hay videos aún.</p></div>';
      return;
    }
    el.innerHTML = snap.docs.map(d => {
      const v = d.data();
      return `<div class="video-card">
        <iframe src="${getYoutubeEmbed(v.url)}" allowfullscreen loading="lazy"></iframe>
        <div class="video-body">
          <div class="video-header">
            <div class="vtitle">${v.titulo}</div>
            <button class="btn-icon btn-icon--no" onclick="eliminarVideo('${d.id}')"><i class="fa-solid fa-trash"></i></button>
          </div>
          ${v.desc ? `<div class="vdesc">${v.desc}</div>` : ''}
        </div>
      </div>`;
    }).join('');
  });
}

window.abrirModal = () => document.getElementById('videoModal').classList.add('open');
window.cerrarModal = (e) => {
  if (!e || e.target === document.getElementById('videoModal')) {
    document.getElementById('videoModal').classList.remove('open');
  }
};

window.guardarVideo = async () => {
  const titulo = document.getElementById('vTitulo').value.trim();
  const url = document.getElementById('vUrl').value.trim();
  const desc = document.getElementById('vDesc').value.trim();
  if (!titulo || !url) { showToast('Escribe título y URL'); return; }
  try {
    await addDoc(collection(db, 'videos'), { titulo, url, desc });
    document.getElementById('vTitulo').value = '';
    document.getElementById('vUrl').value = '';
    document.getElementById('vDesc').value = '';
    document.getElementById('videoModal').classList.remove('open');
    showToast('Video agregado');
  } catch (e) { showToast('Error al guardar video'); }
};

window.eliminarVideo = async (id) => {
  if (!confirm('¿Eliminar este video?')) return;
  try {
    await deleteDoc(doc(db, 'videos', id));
    showToast('Video eliminado');
  } catch (e) { showToast('Error al eliminar'); }
};

window.switchSenseiTab = (tab, el) => {
  document.querySelectorAll('#senseiView .nav-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('#senseiView .tab-section').forEach(s => s.classList.remove('active'));
  document.getElementById('sensei' + cap(tab)).classList.add('active');
  if (tab === 'alumnos') renderAlumnosList();
};

function getYoutubeEmbed(url) {
  try {
    const u = new URL(url);
    let vid = '';
    if (u.hostname.includes('youtu.be')) vid = u.pathname.slice(1);
    else if (u.searchParams.get('v')) vid = u.searchParams.get('v');
    else if (u.pathname.includes('/embed/')) vid = u.pathname.split('/embed/')[1];
    if (vid) return 'https://www.youtube.com/embed/' + vid.split('&')[0];
  } catch (e) {}
  return url;
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
