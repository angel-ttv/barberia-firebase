import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  collection, addDoc, getDocs, getDoc, doc, query, where, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

function toast(msg, isError = false) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("error", isError);
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

let clientePerfil = null;

// ── Requiere sesión de cliente ──
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "cliente-login.html?next=reservar.html";
    return;
  }
  const snap = await getDoc(doc(db, "clientes", user.uid));
  clientePerfil = snap.exists() ? snap.data() : { nombre: user.email, telefono: "" };
  $("saludoCliente").textContent = `Hola, ${clientePerfil.nombre.split(" ")[0]}`;
  cargarCatalogos();
});

$("logoutLink").addEventListener("click", (e) => {
  e.preventDefault();
  signOut(auth).then(() => window.location.href = "cliente-login.html");
});

const selServicio = $("servicio");
const selBarbero = $("barbero");
$("fecha").min = new Date().toISOString().slice(0, 10);

let servicios = [];
let barberos = [];

async function cargarCatalogos() {
  try {
    const [snapServ, snapBarb] = await Promise.all([
      getDocs(query(collection(db, "servicios"), where("activo", "==", true))),
      getDocs(query(collection(db, "barberos"), where("activo", "==", true))),
    ]);
    servicios = snapServ.docs.map(d => ({ id: d.id, ...d.data() }));
    barberos = snapBarb.docs.map(d => ({ id: d.id, ...d.data() }));

    selServicio.innerHTML = servicios.length
      ? servicios.map(s => `<option value="${s.id}">${s.nombre} — $${s.precio}</option>`).join("")
      : `<option value="">Sin servicios disponibles</option>`;

    selBarbero.innerHTML = barberos.length
      ? barberos.map(b => `<option value="${b.id}">${b.nombre}</option>`).join("")
      : `<option value="">Sin barberos disponibles</option>`;
  } catch (err) {
    $("formError").textContent = "No se pudo cargar el catálogo. Intenta de nuevo más tarde.";
    $("formError").classList.add("show");
  }
}

$("bookingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBox = $("formError");
  errorBox.classList.remove("show");

  if (!servicios.length || !barberos.length) {
    errorBox.textContent = "Este negocio aún no tiene servicios o barberos disponibles.";
    errorBox.classList.add("show");
    return;
  }

  const btn = $("bookBtn");
  btn.disabled = true;
  btn.textContent = "Enviando...";

  try {
    await addDoc(collection(db, "citas"), {
      clienteUid: auth.currentUser.uid,
      clienteNombre: clientePerfil.nombre,
      clienteTelefono: clientePerfil.telefono,
      servicioId: selServicio.value,
      barberoId: selBarbero.value,
      fecha: $("fecha").value,
      hora: $("hora").value,
      estado: "pendiente",
      origen: "portal-cliente",
      creadaEn: serverTimestamp(),
    });

    $("bookingForm").classList.add("hidden");
    $("confirmBox").classList.remove("hidden");
  } catch (err) {
    errorBox.textContent = "No se pudo enviar tu reserva: " + err.message;
    errorBox.classList.add("show");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirmar reserva";
  }
});