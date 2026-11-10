import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const destino = params.get("next") || "portal-cliente.html";

// Si ya hay sesión, saltar directo al destino
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = destino;
});

function mostrarError(msg) {
  const box = $("authError");
  box.textContent = msg;
  box.classList.add("show");
}
function ocultarError() { $("authError").classList.remove("show"); }

// ── Tabs ──
$("tabLogin").addEventListener("click", () => {
  $("tabLogin").classList.add("active");
  $("tabRegister").classList.remove("active");
  $("loginForm").classList.remove("hidden");
  $("registerForm").classList.add("hidden");
  ocultarError();
});
$("tabRegister").addEventListener("click", () => {
  $("tabRegister").classList.add("active");
  $("tabLogin").classList.remove("active");
  $("registerForm").classList.remove("hidden");
  $("loginForm").classList.add("hidden");
  ocultarError();
});

function mensajeError(codigo) {
  const mapa = {
    "auth/invalid-email": "El correo no tiene un formato válido.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Intenta iniciar sesión.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
  };
  return mapa[codigo] || "No se pudo completar la solicitud. Intenta de nuevo.";
}

// ── Iniciar sesión ──
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  ocultarError();
  const btn = $("loginBtn");
  btn.disabled = true; btn.textContent = "Entrando...";
  try {
    await signInWithEmailAndPassword(auth, $("loginEmail").value.trim(), $("loginPassword").value);
    window.location.href = destino;
  } catch (err) {
    mostrarError(mensajeError(err.code));
    btn.disabled = false; btn.textContent = "Entrar";
  }
});

// ── Crear cuenta ──
$("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  ocultarError();
  const btn = $("registerBtn");
  btn.disabled = true; btn.textContent = "Creando...";
  try {
    const cred = await createUserWithEmailAndPassword(auth, $("regEmail").value.trim(), $("regPassword").value);
    await setDoc(doc(db, "clientes", cred.user.uid), {
      nombre: $("regNombre").value.trim(),
      telefono: $("regTelefono").value.trim(),
      email: $("regEmail").value.trim(),
      creadoEn: serverTimestamp(),
    });
    window.location.href = destino;
  } catch (err) {
    mostrarError(mensajeError(err.code));
    btn.disabled = false; btn.textContent = "Crear cuenta";
  }
});