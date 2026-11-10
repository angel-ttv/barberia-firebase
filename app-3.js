import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc,
  onSnapshot, query, orderBy, where, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// ═══════════════════════════════════════════════════════════
// SESIÓN + ROL
// ═══════════════════════════════════════════════════════════
let currentUser = null;   // { uid, email, rol, barberoId, nombre }
let unsubCitas = null, unsubPagos = null, unsubUsuarios = null, unsubPortafolio = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "personal.html"; return; }

  const refUsuario = doc(db, "usuarios", user.uid);
  const snap = await getDoc(refUsuario);

  if (!snap.exists()) {
    // Bootstrap: la primera persona que entra con una cuenta nueva
    // queda como Dueño automáticamente (ver reglas de Firestore).
    await setDoc(refUsuario, {
      rol: "dueño",
      nombre: user.email,
      creadoEn: serverTimestamp(),
    });
  }

  onSnapshot(refUsuario, (docSnap) => {
    const data = docSnap.data() || {};
    currentUser = {
      uid: user.uid,
      email: user.email,
      rol: data.rol || "dueño",
      barberoId: data.barberoId || null,
      nombre: data.nombre || user.email,
    };
    aplicarRolEnUI();
    iniciarListenersDeDatos();
  });
});

document.getElementById("logoutBtn").addEventListener("click", () => signOut(auth));

function esDueño() { return currentUser?.rol === "dueño"; }
function esBarbero() { return currentUser?.rol === "barbero"; }

function aplicarRolEnUI() {
  $("userChip").textContent = `${currentUser.nombre} · ${currentUser.rol}`;

  const tabsSoloDueño = ["barberos", "servicios", "equipo"];
  tabsSoloDueño.forEach((t) => {
    const btn = document.querySelector(`.tab[data-tab="${t}"]`);
    if (btn) btn.classList.toggle("hidden", !esDueño());
  });

  $("filtroBarberoWrap").classList.toggle("hidden", !esDueño());
  $("portafolioSub").textContent = esDueño()
    ? "Fotos de cortes y diseños de todo el equipo."
    : "Sube fotos de tus cortes y diseños para mostrarlas en tu perfil.";

  // Si un barbero cae en una vista que no le corresponde, lo regresamos a Agenda
  const tabActivo = document.querySelector(".tab.active");
  if (esBarbero() && tabActivo && tabsSoloDueño.includes(tabActivo.dataset.tab)) {
    document.querySelector('.tab[data-tab="agenda"]').click();
  }
}

// ── Estado local (se llena con los listeners en tiempo real) ──
let barberos = [];
let servicios = [];
let citas = [];
let pagos = [];
let usuarios = [];
let fotos = [];
let resenas = [];

// ── Utilidades ──
const $ = (id) => document.getElementById(id);
const money = (n) => `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 0 })}`;
const hoyISO = () => new Date().toISOString().slice(0, 10);

function toast(msg, isError = false) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("error", isError);
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

function nombreBarbero(id) { return barberos.find(b => b.id === id)?.nombre || "—"; }
function nombreServicio(id) { return servicios.find(s => s.id === id)?.nombre || "—"; }

function calificacionBarbero(id) {
  const propias = resenas.filter(r => r.barberoId === id);
  if (!propias.length) return null;
  const avg = propias.reduce((s, r) => s + Number(r.calificacion || 0), 0) / propias.length;
  return { avg, total: propias.length };
}

// ── Navegación por pestañas ──
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
    tab.classList.add("active");
    $(`view-${tab.dataset.tab}`).classList.remove("hidden");
  });
});

// ═══════════════════════════════════════════════════════════
// LISTENERS: catálogos compartidos (barberos y servicios son
// visibles para todos los roles con sesión iniciada)
// ═══════════════════════════════════════════════════════════
onSnapshot(query(collection(db, "barberos"), orderBy("nombre")), (snap) => {
  barberos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderBarberos();
  renderCitas();
  renderCobros();
});

onSnapshot(query(collection(db, "servicios"), orderBy("nombre")), (snap) => {
  servicios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderServicios();
  renderCitas();
});

onSnapshot(collection(db, "resenas"), (snap) => {
  resenas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderBarberos();
});

// ═══════════════════════════════════════════════════════════
// LISTENERS: citas y pagos — dependen del rol
//   Dueño   → ve todo
//   Barbero → solo lo suyo (filtrado por barberoId)
// ═══════════════════════════════════════════════════════════
function iniciarListenersDeDatos() {
  if (unsubCitas) unsubCitas();
  if (unsubPagos) unsubPagos();
  if (unsubUsuarios) unsubUsuarios();

  const qCitas = esDueño()
    ? query(collection(db, "citas"), orderBy("fecha", "desc"))
    : query(collection(db, "citas"), where("barberoId", "==", currentUser.barberoId || "_ninguno"));

  unsubCitas = onSnapshot(qCitas, (snap) => {
    citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!esDueño()) citas.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    renderCitas();
  });

  const qPagos = esDueño()
    ? query(collection(db, "pagos"), orderBy("fecha", "desc"))
    : query(collection(db, "pagos"), where("barberoId", "==", currentUser.barberoId || "_ninguno"));

  unsubPagos = onSnapshot(qPagos, (snap) => {
    pagos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!esDueño()) pagos.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    renderCobros();
  });

  if (esDueño()) {
    unsubUsuarios = onSnapshot(collection(db, "usuarios"), (snap) => {
      usuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderUsuarios();
    });
  }

  if (unsubPortafolio) unsubPortafolio();
  const qFotos = esDueño()
    ? query(collection(db, "portafolio"), orderBy("creadoEn", "desc"))
    : query(collection(db, "portafolio"), where("barberoId", "==", currentUser.barberoId || "_ninguno"));
  unsubPortafolio = onSnapshot(qFotos, (snap) => {
    fotos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPortafolio();
  });
}

// ═══════════════════════════════════════════════════════════
// RENDER: AGENDA / CITAS
// ═══════════════════════════════════════════════════════════
function renderCitas() {
  const fechaFiltro = $("filtroFecha").value;
  const estadoFiltro = $("filtroEstado").value;

  let lista = citas.filter(c =>
    (!fechaFiltro || c.fecha === fechaFiltro) &&
    (!estadoFiltro || c.estado === estadoFiltro)
  );

  const tbody = $("tablaCitas");
  tbody.innerHTML = "";
  $("citasEmpty").classList.toggle("hidden", lista.length > 0);

  lista.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${c.hora || "—"}</td>
      <td>${c.clienteNombre}${c.clienteTelefono ? `<br><span style="opacity:.5;font-size:12px">${c.clienteTelefono}</span>` : ""}</td>
      <td>${nombreBarbero(c.barberoId)}</td>
      <td>${nombreServicio(c.servicioId)}</td>
      <td><span class="badge badge-${c.estado}">${c.estado}</span></td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="icon-btn" data-edit="${c.id}">✎</button>
        <button class="icon-btn" data-del="${c.id}">🗑</button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-edit]").forEach(b =>
    b.addEventListener("click", () => openCitaModal(citas.find(c => c.id === b.dataset.edit))));
  tbody.querySelectorAll("[data-del]").forEach(b =>
    b.addEventListener("click", () => confirmarBorrado("citas", b.dataset.del, "Cita eliminada")));
}
$("filtroFecha").addEventListener("change", renderCitas);
$("filtroEstado").addEventListener("change", renderCitas);

// ═══════════════════════════════════════════════════════════
// RENDER: BARBEROS (solo Dueño)
// ═══════════════════════════════════════════════════════════
function renderBarberos() {
  const tbody = $("tablaBarberos");
  tbody.innerHTML = "";
  $("barberosEmpty").classList.toggle("hidden", barberos.length > 0);

  barberos.forEach(b => {
    const cal = calificacionBarbero(b.id);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${b.nombre}</td>
      <td class="mono">${b.telefono || "—"}</td>
      <td class="mono">${b.comision || 0}%</td>
      <td>${cal ? `★ ${cal.avg.toFixed(1)} <span style="opacity:.5;font-size:11px;">(${cal.total})</span>` : `<span style="opacity:.4;">sin reseñas</span>`}</td>
      <td><span class="badge badge-${b.activo ? "activo" : "inactivo"}">${b.activo ? "activo" : "inactivo"}</span></td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="icon-btn" data-edit="${b.id}">✎</button>
        <button class="icon-btn" data-del="${b.id}">🗑</button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-edit]").forEach(b =>
    b.addEventListener("click", () => openBarberoModal(barberos.find(x => x.id === b.dataset.edit))));
  tbody.querySelectorAll("[data-del]").forEach(b =>
    b.addEventListener("click", () => confirmarBorrado("barberos", b.dataset.del, "Barbero eliminado")));
}

// ═══════════════════════════════════════════════════════════
// RENDER: SERVICIOS (solo Dueño)
// ═══════════════════════════════════════════════════════════
function renderServicios() {
  const tbody = $("tablaServicios");
  tbody.innerHTML = "";
  $("serviciosEmpty").classList.toggle("hidden", servicios.length > 0);

  servicios.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.nombre}</td>
      <td class="mono">${money(s.precio)}</td>
      <td class="mono">${s.duracionMinutos || 0} min</td>
      <td><span class="badge badge-${s.activo ? "activo" : "inactivo"}">${s.activo ? "activo" : "inactivo"}</span></td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="icon-btn" data-edit="${s.id}">✎</button>
        <button class="icon-btn" data-del="${s.id}">🗑</button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-edit]").forEach(b =>
    b.addEventListener("click", () => openServicioModal(servicios.find(x => x.id === b.dataset.edit))));
  tbody.querySelectorAll("[data-del]").forEach(b =>
    b.addEventListener("click", () => confirmarBorrado("servicios", b.dataset.del, "Servicio eliminado")));
}

// ═══════════════════════════════════════════════════════════
// RENDER: COBROS + KPIs
// ═══════════════════════════════════════════════════════════
function renderCobros() {
  const tbody = $("tablaCobros");
  tbody.innerHTML = "";
  $("cobrosEmpty").classList.toggle("hidden", pagos.length > 0);

  const hoy = hoyISO();
  const mesActual = hoy.slice(0, 7);
  let ingresosDia = 0, ingresosMes = 0, comisionesMes = 0;

  pagos.forEach(p => {
    if (p.fecha === hoy) ingresosDia += Number(p.monto || 0);
    if ((p.fecha || "").startsWith(mesActual)) {
      ingresosMes += Number(p.monto || 0);
      comisionesMes += Number(p.comisionBarbero || 0);
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${p.fecha}</td>
      <td>${nombreBarbero(p.barberoId)}</td>
      <td class="mono">${money(p.monto)}</td>
      <td>${p.metodo}</td>
      <td class="mono" style="color:var(--brass)">${money(p.comisionBarbero)}</td>
      <td style="text-align:right;">
        <button class="icon-btn" data-del="${p.id}">🗑</button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-del]").forEach(b =>
    b.addEventListener("click", () => confirmarBorrado("pagos", b.dataset.del, "Cobro eliminado")));

  $("kpiIngresosDia").textContent = money(ingresosDia);
  $("kpiIngresosMes").textContent = money(ingresosMes);
  $("kpiComisionesMes").textContent = money(comisionesMes);
  $("kpiTotalCobros").textContent = pagos.length;
}

// ═══════════════════════════════════════════════════════════
// RENDER: EQUIPO (solo Dueño) — vincula cuentas de Firebase Auth a roles
// ═══════════════════════════════════════════════════════════
function renderUsuarios() {
  const tbody = $("tablaUsuarios");
  if (!tbody) return;
  tbody.innerHTML = "";
  $("usuariosEmpty").classList.toggle("hidden", usuarios.length > 0);

  usuarios.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.nombre || "—"}</td>
      <td class="mono" style="font-size:11px;">${u.id}</td>
      <td><span class="badge badge-activo">${u.rol}</span></td>
      <td>${u.rol === "barbero" ? nombreBarbero(u.barberoId) : "—"}</td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="icon-btn" data-edit="${u.id}">✎</button>
        <button class="icon-btn" data-del="${u.id}">🗑</button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-edit]").forEach(b =>
    b.addEventListener("click", () => openUsuarioModal(usuarios.find(x => x.id === b.dataset.edit))));
  tbody.querySelectorAll("[data-del]").forEach(b =>
    b.addEventListener("click", () => confirmarBorrado("usuarios", b.dataset.del, "Acceso eliminado")));
}

// ═══════════════════════════════════════════════════════════
// PORTAFOLIO: subir, listar y borrar fotos (Firebase Storage)
// ═══════════════════════════════════════════════════════════
function renderPortafolio() {
  // Filtro por barbero (solo visible para Dueño)
  const selFiltro = $("filtroPortafolioBarbero");
  if (esDueño() && selFiltro.options.length <= 1) {
    selFiltro.innerHTML = `<option value="">Todos los barberos</option>${opcionesBarberos()}`;
  }
  const filtroId = esDueño() ? selFiltro.value : null;
  const lista = filtroId ? fotos.filter(f => f.barberoId === filtroId) : fotos;

  const cont = $("galeriaPortafolio");
  cont.innerHTML = "";
  $("portafolioEmpty").classList.toggle("hidden", lista.length > 0);

  lista.forEach(f => {
    const puedeBorrar = esDueño() || f.subidoPorUid === currentUser.uid;
    const card = document.createElement("div");
    card.className = "foto-card";
    card.innerHTML = `
      <img src="${f.imagenBase64}" alt="Trabajo de ${nombreBarbero(f.barberoId)}" loading="lazy">
      ${esDueño() ? `<div class="foto-card__meta">${nombreBarbero(f.barberoId)}</div>` : ""}
      ${puedeBorrar ? `<button class="foto-card__del" data-del="${f.id}">🗑</button>` : ""}
    `;
    cont.appendChild(card);
  });

  cont.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar esta foto?")) return;
      try {
        await deleteDoc(doc(db, "portafolio", btn.dataset.del));
        toast("Foto eliminada");
      } catch (err) {
        toast("No se pudo eliminar: " + err.message, true);
      }
    });
  });
}
$("filtroPortafolioBarbero")?.addEventListener("change", renderPortafolio);

// Comprime una imagen en el navegador y la devuelve como dataURL (base64),
// para poder guardarla directo en Firestore sin necesitar Storage/Blaze.
function comprimirImagen(archivo, maxAncho = 900, calidad = 0.72) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error("No se pudo leer el archivo"));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Archivo no es una imagen válida"));
      img.onload = () => {
        const escala = Math.min(1, maxAncho / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", calidad));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

$("inputFoto").addEventListener("change", async (e) => {
  const archivos = Array.from(e.target.files || []);
  if (!archivos.length) return;

  if (!esDueño() && !currentUser.barberoId) {
    toast("Tu cuenta no está vinculada a un barbero. Pide al Dueño que la vincule en Equipo.", true);
    e.target.value = "";
    return;
  }
  let barberoId = currentUser.barberoId;
  if (esDueño()) {
    barberoId = $("filtroPortafolioBarbero").value;
    if (!barberoId) {
      toast("Elige primero a qué barbero pertenecen las fotos, en el filtro de arriba.", true);
      e.target.value = "";
      return;
    }
  }

  let subidas = 0;
  for (const archivo of archivos) {
    if (!archivo.type.startsWith("image/")) continue;
    try {
      const imagenBase64 = await comprimirImagen(archivo);
      // Firestore limita cada documento a 1 MB; dejamos margen para el resto de campos.
      if (imagenBase64.length > 900 * 1024) {
        toast(`"${archivo.name}" quedó muy pesada incluso comprimida. Prueba con otra foto.`, true);
        continue;
      }
      await addDoc(collection(db, "portafolio"), {
        barberoId,
        imagenBase64,
        subidoPorUid: currentUser.uid,
        creadoEn: serverTimestamp(),
      });
      subidas++;
    } catch (err) {
      toast("No se pudo subir " + archivo.name + ": " + err.message, true);
    }
  }
  if (subidas) toast(subidas === 1 ? "Foto subida" : `${subidas} fotos subidas`);
  e.target.value = "";
});

// ═══════════════════════════════════════════════════════════
// BORRADO
// ═══════════════════════════════════════════════════════════
async function confirmarBorrado(coleccion, id, mensajeOk) {
  if (!confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) return;
  try {
    await deleteDoc(doc(db, coleccion, id));
    toast(mensajeOk);
  } catch (err) {
    toast("No se pudo eliminar: " + err.message, true);
  }
}

// ═══════════════════════════════════════════════════════════
// MODAL genérico
// ═══════════════════════════════════════════════════════════
const modalBackdrop = $("modalBackdrop");
let guardarHandler = null;

function abrirModal(titulo, cuerpoHTML, onSave) {
  $("modalTitle").textContent = titulo;
  $("modalBody").innerHTML = cuerpoHTML;
  guardarHandler = onSave;
  modalBackdrop.classList.add("show");
}
function cerrarModal() {
  modalBackdrop.classList.remove("show");
  guardarHandler = null;
}
$("modalClose").addEventListener("click", cerrarModal);
$("modalCancel").addEventListener("click", cerrarModal);
modalBackdrop.addEventListener("click", (e) => { if (e.target === modalBackdrop) cerrarModal(); });
$("modalSave").addEventListener("click", async () => {
  if (!guardarHandler) return;
  const btn = $("modalSave");
  btn.disabled = true; btn.textContent = "Guardando...";
  try {
    await guardarHandler();
    cerrarModal();
  } catch (err) {
    toast("Error al guardar: " + err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = "Guardar";
  }
});

function opcionesBarberos(seleccionadoId) {
  return barberos.map(b =>
    `<option value="${b.id}" ${b.id === seleccionadoId ? "selected" : ""}>${b.nombre}</option>`).join("");
}
function opcionesServicios(seleccionadoId) {
  return servicios.map(s =>
    `<option value="${s.id}" ${s.id === seleccionadoId ? "selected" : ""}>${s.nombre} — ${money(s.precio)}</option>`).join("");
}

// ── Modal: Cita ──
function openCitaModal(existente) {
  if (!barberos.length || !servicios.length) {
    toast("Registra al menos un barbero y un servicio antes de agendar.", true);
    return;
  }
  const c = existente || {};
  const barberoFijo = esBarbero(); // un barbero solo agenda para sí mismo
  abrirModal(existente ? "Editar cita" : "Nueva cita", `
    <div class="field"><label>Cliente</label><input id="f-cliente" value="${c.clienteNombre || ""}" placeholder="Nombre del cliente"></div>
    <div class="field"><label>Teléfono</label><input id="f-tel" value="${c.clienteTelefono || ""}" placeholder="Opcional"></div>
    <div class="grid-2">
      <div class="field"><label>Fecha</label><input type="date" id="f-fecha" value="${c.fecha || hoyISO()}"></div>
      <div class="field"><label>Hora</label><input type="time" id="f-hora" value="${c.hora || ""}"></div>
    </div>
    <div class="field"><label>Barbero</label><select id="f-barbero" ${barberoFijo ? "disabled" : ""}>${opcionesBarberos(barberoFijo ? currentUser.barberoId : c.barberoId)}</select></div>
    <div class="field"><label>Servicio</label><select id="f-servicio">${opcionesServicios(c.servicioId)}</select></div>
    <div class="field"><label>Estado</label>
      <select id="f-estado">
        ${["pendiente", "confirmada", "completada", "cancelada"].map(e =>
          `<option value="${e}" ${c.estado === e ? "selected" : ""}>${e}</option>`).join("")}
      </select>
    </div>
  `, async () => {
    const data = {
      clienteNombre: $("f-cliente").value.trim(),
      clienteTelefono: $("f-tel").value.trim(),
      fecha: $("f-fecha").value,
      hora: $("f-hora").value,
      barberoId: barberoFijo ? currentUser.barberoId : $("f-barbero").value,
      servicioId: $("f-servicio").value,
      estado: $("f-estado").value || "pendiente",
    };
    if (!data.clienteNombre || !data.fecha) throw new Error("Cliente y fecha son obligatorios.");
    if (existente) {
      await updateDoc(doc(db, "citas", existente.id), data);
      toast("Cita actualizada");
    } else {
      await addDoc(collection(db, "citas"), { ...data, creadaEn: serverTimestamp() });
      toast("Cita agendada");
    }
  });
}
$("btnNuevaCita").addEventListener("click", () => openCitaModal(null));

// ── Modal: Barbero (solo Dueño) ──
function openBarberoModal(existente) {
  const b = existente || {};
  abrirModal(existente ? "Editar barbero" : "Nuevo barbero", `
    <div class="field"><label>Nombre</label><input id="f-nombre" value="${b.nombre || ""}" placeholder="Nombre completo"></div>
    <div class="field"><label>Teléfono</label><input id="f-telefono" value="${b.telefono || ""}" placeholder="10 dígitos"></div>
    <div class="field"><label>Comisión (%)</label><input type="number" id="f-comision" value="${b.comision ?? 40}" min="0" max="100"></div>
    <div class="field"><label>Estado</label>
      <select id="f-activo">
        <option value="true" ${b.activo !== false ? "selected" : ""}>Activo</option>
        <option value="false" ${b.activo === false ? "selected" : ""}>Inactivo</option>
      </select>
    </div>
  `, async () => {
    const data = {
      nombre: $("f-nombre").value.trim(),
      telefono: $("f-telefono").value.trim(),
      comision: Number($("f-comision").value) || 0,
      activo: $("f-activo").value === "true",
    };
    if (!data.nombre) throw new Error("El nombre es obligatorio.");
    if (existente) {
      await updateDoc(doc(db, "barberos", existente.id), data);
      toast("Barbero actualizado");
    } else {
      await addDoc(collection(db, "barberos"), { ...data, creadoEn: serverTimestamp() });
      toast("Barbero agregado");
    }
  });
}
$("btnNuevoBarbero").addEventListener("click", () => openBarberoModal(null));

// ── Modal: Servicio (solo Dueño) ──
function openServicioModal(existente) {
  const s = existente || {};
  abrirModal(existente ? "Editar servicio" : "Nuevo servicio", `
    <div class="field"><label>Nombre</label><input id="f-nombre" value="${s.nombre || ""}" placeholder="Ej. Corte + barba"></div>
    <div class="grid-2">
      <div class="field"><label>Precio (MXN)</label><input type="number" id="f-precio" value="${s.precio ?? ""}" min="0"></div>
      <div class="field"><label>Duración (min)</label><input type="number" id="f-duracion" value="${s.duracionMinutos ?? 30}" min="5"></div>
    </div>
    <div class="field"><label>Estado</label>
      <select id="f-activo">
        <option value="true" ${s.activo !== false ? "selected" : ""}>Activo</option>
        <option value="false" ${s.activo === false ? "selected" : ""}>Inactivo</option>
      </select>
    </div>
  `, async () => {
    const data = {
      nombre: $("f-nombre").value.trim(),
      precio: Number($("f-precio").value) || 0,
      duracionMinutos: Number($("f-duracion").value) || 0,
      activo: $("f-activo").value === "true",
    };
    if (!data.nombre) throw new Error("El nombre es obligatorio.");
    if (existente) {
      await updateDoc(doc(db, "servicios", existente.id), data);
      toast("Servicio actualizado");
    } else {
      await addDoc(collection(db, "servicios"), { ...data, creadoEn: serverTimestamp() });
      toast("Servicio agregado");
    }
  });
}
$("btnNuevoServicio").addEventListener("click", () => openServicioModal(null));

// ── Modal: Cobro ──
function openCobroModal() {
  if (!barberos.length) {
    toast("Registra al menos un barbero antes de cobrar.", true);
    return;
  }
  const barberoFijo = esBarbero();
  abrirModal("Registrar cobro", `
    <div class="field"><label>Barbero</label><select id="f-barbero" ${barberoFijo ? "disabled" : ""}>${opcionesBarberos(barberoFijo ? currentUser.barberoId : null)}</select></div>
    <div class="grid-2">
      <div class="field"><label>Monto (MXN)</label><input type="number" id="f-monto" min="0" placeholder="0"></div>
      <div class="field"><label>Fecha</label><input type="date" id="f-fecha" value="${hoyISO()}"></div>
    </div>
    <div class="field"><label>Método</label>
      <select id="f-metodo">
        <option value="efectivo">Efectivo</option>
        <option value="tarjeta">Tarjeta</option>
        <option value="transferencia">Transferencia</option>
      </select>
    </div>
  `, async () => {
    const barberoId = barberoFijo ? currentUser.barberoId : $("f-barbero").value;
    const monto = Number($("f-monto").value) || 0;
    if (monto <= 0) throw new Error("El monto debe ser mayor a cero.");
    const barbero = barberos.find(b => b.id === barberoId);
    const comisionBarbero = Math.round(monto * ((barbero?.comision || 0) / 100));

    await addDoc(collection(db, "pagos"), {
      barberoId,
      monto,
      fecha: $("f-fecha").value || hoyISO(),
      metodo: $("f-metodo").value,
      comisionBarbero,
      creadoEn: serverTimestamp(),
    });
    toast("Cobro registrado");
  });
}
$("btnNuevoCobro").addEventListener("click", openCobroModal);

// ── Modal: Usuario/Equipo (solo Dueño) ──
function openUsuarioModal(existente) {
  const u = existente || {};
  abrirModal(existente ? "Editar acceso" : "Vincular usuario", `
    <p style="font-size:12.5px; opacity:.6; margin:-4px 0 14px;">
      Primero crea la cuenta en Firebase Console → Authentication → Add user,
      copia su UID y pégalo aquí.
    </p>
    <div class="field"><label>UID de Firebase Auth</label>
      <input id="f-uid" value="${existente ? existente.id : ""}" placeholder="Pega el UID" ${existente ? "disabled" : ""}>
    </div>
    <div class="field"><label>Nombre</label><input id="f-nombre" value="${u.nombre || ""}" placeholder="Nombre visible"></div>
    <div class="field"><label>Rol</label>
      <select id="f-rol">
        <option value="barbero" ${u.rol === "barbero" ? "selected" : ""}>Barbero</option>
        <option value="dueño" ${u.rol === "dueño" ? "selected" : ""}>Dueño</option>
      </select>
    </div>
    <div class="field" id="wrapBarberoLigado">
      <label>Barbero vinculado</label>
      <select id="f-barberoLigado">${opcionesBarberos(u.barberoId)}</select>
    </div>
  `, async () => {
    const uid = existente ? existente.id : $("f-uid").value.trim();
    const rol = $("f-rol").value;
    if (!uid) throw new Error("Falta el UID.");
    const data = {
      nombre: $("f-nombre").value.trim(),
      rol,
      barberoId: rol === "barbero" ? $("f-barberoLigado").value : null,
    };
    await setDoc(doc(db, "usuarios", uid), data, { merge: true });
    toast(existente ? "Acceso actualizado" : "Usuario vinculado");
  });

  // Mostrar/ocultar el selector de barbero según el rol elegido
  const selRol = $("f-rol");
  const wrap = $("wrapBarberoLigado");
  const sync = () => wrap.classList.toggle("hidden", selRol.value !== "barbero");
  selRol.addEventListener("change", sync);
  sync();
}
document.getElementById("btnNuevoUsuario")?.addEventListener("click", () => openUsuarioModal(null));