import { db } from "./firebase-config.js";
import { collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const money = (n) => `$${Number(n || 0).toLocaleString("es-MX")}`;
const iniciales = (nombre) => (nombre || "?").trim().split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase();

async function cargarServicios() {
  const cont = document.getElementById("lpServicios");
  try {
    const snap = await getDocs(query(collection(db, "servicios"), where("activo", "==", true)));
    const servicios = snap.docs.map(d => d.data());
    cont.innerHTML = servicios.length
      ? servicios.map(s => `
          <div class="lp-servicio-card">
            <h3>${s.nombre}</h3>
            <div class="precio">${money(s.precio)}</div>
            <div class="dur">${s.duracionMinutos || 0} min</div>
          </div>`).join("")
      : `<div class="empty-state">Aún no hay servicios publicados.</div>`;
  } catch {
    cont.innerHTML = `<div class="empty-state">No se pudieron cargar los servicios.</div>`;
  }
}

async function cargarBarberos() {
  const cont = document.getElementById("lpBarberos");
  try {
    const [snapBarb, snapResenas] = await Promise.all([
      getDocs(query(collection(db, "barberos"), where("activo", "==", true))),
      getDocs(collection(db, "resenas")),
    ]);
    const resenas = snapResenas.docs.map(d => d.data());
    const barberos = snapBarb.docs.map(d => ({ id: d.id, ...d.data() }));

    cont.innerHTML = barberos.length
      ? barberos.map(b => {
          const propias = resenas.filter(r => r.barberoId === b.id);
          const cal = propias.length
            ? (propias.reduce((s, r) => s + Number(r.calificacion || 0), 0) / propias.length).toFixed(1)
            : null;
          return `
            <div class="lp-barbero-card">
              <div class="lp-barbero-avatar">${iniciales(b.nombre)}</div>
              <h3>${b.nombre}</h3>
              <div class="cal">${cal ? `★ ${cal} (${propias.length})` : "Nuevo en el equipo"}</div>
            </div>`;
        }).join("")
      : `<div class="empty-state">Aún no hay barberos publicados.</div>`;
  } catch {
    cont.innerHTML = `<div class="empty-state">No se pudo cargar el equipo.</div>`;
  }
}

cargarServicios();
cargarBarberos();

async function cargarGaleria() {
  const cont = document.getElementById("lpGaleria");
  try {
    const snap = await getDocs(query(collection(db, "portafolio"), orderBy("creadoEn", "desc"), limit(12)));
    const fotos = snap.docs.map(d => d.data());
    cont.innerHTML = fotos.length
      ? fotos.map(f => `
          <div style="aspect-ratio:1/1; border-radius:8px; overflow:hidden; border:1px solid var(--border);">
            <img src="${f.imagenBase64}" alt="Trabajo del equipo" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;">
          </div>`).join("")
      : `<div class="empty-state">El equipo aún no ha subido fotos de sus trabajos.</div>`;
  } catch {
    cont.innerHTML = `<div class="empty-state">No se pudo cargar la galería.</div>`;
  }
}
cargarGaleria();