import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  collection, addDoc, onSnapshot, query, where, doc, getDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

function toast(msg, isError = false) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("error", isError);
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

let citas = [];
let resenas = [];      // reseñas ya dejadas por este cliente
let barberos = {};
let servicios = {};

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "cliente-login.html?next=portal-cliente.html"; return; }

  onSnapshot(collection(db, "barberos"), (snap) => {
    barberos = Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
    render();
  });
  onSnapshot(collection(db, "servicios"), (snap) => {
    servicios = Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
    render();
  });

  onSnapshot(query(collection(db, "citas"), where("clienteUid", "==", user.uid)), (snap) => {
    citas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    render();
  });

  onSnapshot(query(collection(db, "resenas"), where("clienteUid", "==", user.uid)), (snap) => {
    resenas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });
});

$("logoutLink").addEventListener("click", (e) => {
  e.preventDefault();
  signOut(auth).then(() => window.location.href = "cliente-login.html");
});

function resenaDe(citaId) { return resenas.find(r => r.citaId === citaId); }

function render() {
  const cont = $("citasLista");
  cont.innerHTML = "";
  $("citasEmpty").classList.toggle("hidden", citas.length > 0);

  citas.forEach(c => {
    const nombreBarbero = barberos[c.barberoId]?.nombre || "—";
    const nombreServicio = servicios[c.servicioId]?.nombre || "—";
    const existente = resenaDe(c.id);

    const card = document.createElement("div");
    card.className = "citaCard";
    card.innerHTML = `
      <div class="citaCard__head">
        <div>
          <strong>${nombreServicio}</strong> con ${nombreBarbero}
          <div class="citaCard__fecha">${c.fecha}${c.hora ? " · " + c.hora : ""}</div>
        </div>
        <span class="badge badge-${c.estado}">${c.estado}</span>
      </div>
      ${c.estado === "completada" ? renderReviewBlock(c, existente) : ""}
    `;
    cont.appendChild(card);

    if (c.estado === "completada" && !existente) {
      const stars = card.querySelectorAll(".stars span");
      let seleccion = 0;
      stars.forEach(s => {
        s.addEventListener("click", () => {
          seleccion = Number(s.dataset.v);
          stars.forEach(x => x.classList.toggle("on", Number(x.dataset.v) <= seleccion));
        });
      });
      const btn = card.querySelector("[data-enviar-resena]");
      btn.addEventListener("click", async () => {
        if (!seleccion) { toast("Elige una calificación de 1 a 5 estrellas.", true); return; }
        btn.disabled = true; btn.textContent = "Enviando...";
        try {
          await addDoc(collection(db, "resenas"), {
            citaId: c.id,
            barberoId: c.barberoId,
            clienteUid: auth.currentUser.uid,
            clienteNombre: c.clienteNombre || "Cliente",
            calificacion: seleccion,
            comentario: card.querySelector("textarea").value.trim(),
            fecha: new Date().toISOString().slice(0, 10),
            creadaEn: serverTimestamp(),
          });
          toast("¡Gracias por tu reseña!");
        } catch (err) {
          toast("No se pudo enviar: " + err.message, true);
          btn.disabled = false; btn.textContent = "Enviar reseña";
        }
      });
    }
  });
}

function renderReviewBlock(c, existente) {
  if (existente) {
    return `
      <div class="reviewDone">
        Tu reseña: ${"★".repeat(existente.calificacion)}${"☆".repeat(5 - existente.calificacion)}
        ${existente.comentario ? `— "${existente.comentario}"` : ""}
      </div>`;
  }
  return `
    <div class="reviewBox">
      <div class="stars">
        ${[1,2,3,4,5].map(v => `<span data-v="${v}">★</span>`).join("")}
      </div>
      <textarea placeholder="¿Cómo te fue con tu corte? (opcional)"></textarea>
      <button class="btn btn-secondary btn-sm" data-enviar-resena>Enviar reseña</button>
    </div>`;
}