# Nivara Barber Shop System — MVP (HTML + CSS + JS + Firebase)

## Qué incluye
- **Landing pública** (`index.html`) — presentación del negocio, servicios y equipo en vivo, botón de reserva
- **Login de personal** (`personal.html`) — Dueño y Barberos, con Firebase Authentication
- **Cuenta de cliente** (`cliente-login.html`) — login/registro propio, separado del personal
- **Reserva de citas** (`reservar.html`) — el cliente debe iniciar sesión para agendar (ya no es anónimo)
- **Mis citas** (`portal-cliente.html`) — historial del cliente + dejar reseña (1-5 ⭐ + comentario)
  en citas ya marcadas como **completadas**
- **Dashboard de personal** (`dashboard.html`) con acceso según rol:
  - **Dueño**: todo — Agenda, Barberos (ahora con su calificación promedio), Servicios, Cobros, Equipo
  - **Barbero**: solo su propia Agenda y sus propios Cobros

> **Personaliza la landing:** abre `index.html` y edita el texto del hero, el nombre del negocio
> en el header/footer, y la variable `--landing-negocio` al inicio del `<style>`.

## Configuración (10–15 minutos)
1. [console.firebase.google.com](https://console.firebase.google.com) → **Crear proyecto** → Agregar app Web.
2. Pega el `firebaseConfig` en `js/firebase-config.js`.
3. **Authentication → Sign-in method → Email/Password → Activar.**
4. **Authentication → Users → Add user** — crea tu cuenta de Dueño.
5. **Firestore Database → Crear base de datos** (modo producción).
6. **Firestore → Reglas** — pega `firestore.rules.txt` y publica.
7. Abre `personal.html` con tu cuenta de personal → queda como Dueño automáticamente.
8. Comparte `index.html` (la landing) o directo `reservar.html` con tus clientes.

## Flujo del cliente
1. Entra a `reservar.html` → si no tiene sesión, va a `cliente-login.html` (login o crear cuenta).
2. Agenda su cita — queda en `citas` con su `clienteUid`.
3. En `portal-cliente.html` ve su historial. Cuando el Dueño marca una cita como **completada**,
   ahí mismo le aparece la opción de calificarla con estrellas y comentario.
4. Esa calificación promedio se ve automáticamente en la pestaña **Barberos** del Dashboard.

## Cómo dar de alta a un barbero con su propio acceso
1. Firebase Console → Authentication → Add user → copia su UID.
2. Dashboard (Dueño) → pestaña **Equipo** → "+ Vincular usuario" → UID, nombre, rol Barbero,
   vinculado a su registro en Barberos.

## Estructura de datos en Firestore
- `usuarios/{uid}`: personal — `rol ("dueño"|"barbero"), nombre, barberoId`
- `clientes/{uid}`: clientes — `nombre, telefono, email`
- `barberos`: `nombre, telefono, comision (%), activo`
- `servicios`: `nombre, precio, duracionMinutos, activo`
- `citas`: `clienteUid, clienteNombre, clienteTelefono, fecha, hora, barberoId, servicioId, estado, origen`
- `pagos`: `barberoId, monto, fecha, metodo, comisionBarbero`
- `resenas`: `citaId, barberoId, clienteUid, clienteNombre, calificacion (1-5), comentario, fecha`

## Alcance de este MVP y siguientes pasos
- Mono-negocio (un proyecto Firebase = una barbería). Para SaaS multi-sucursal, agregar `negocioId`.
- Pendiente (roadmap ya conversado): portafolio de fotos de los barberos (requiere activar Firebase
  Storage), personalización de marca más completa por el Dueño (logo/colores desde el Dashboard), inventario, calendario visual.
- Para producción real, mover el cálculo de comisiones a una Cloud Function.
