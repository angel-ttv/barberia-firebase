import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

const form = document.getElementById("loginForm");
const errorBox = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");

// Si ya hay sesión activa, va directo al dashboard
onAuthStateChanged(auth, (user) => {
  if (user && location.pathname.endsWith("personal.html")) {
    window.location.href = "dashboard.html";
  }
});

function mensajeError(codigo) {
  const mapa = {
    "auth/invalid-email": "El correo no tiene un formato válido.",
    "auth/user-disabled": "Esta cuenta fue deshabilitada.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
  };
  return mapa[codigo] || "No se pudo iniciar sesión. Intenta de nuevo.";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.classList.remove("show");
  loginBtn.disabled = true;
  loginBtn.textContent = "Entrando...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "dashboard.html";
  } catch (err) {
    errorBox.textContent = mensajeError(err.code);
    errorBox.classList.add("show");
    loginBtn.disabled = false;
    loginBtn.textContent = "Entrar";
  }
});