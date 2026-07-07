// Lógica de la página de login (index.html).

const loginForm = document.getElementById("login-form");
const errorMessage = document.getElementById("error-message");

// Si ya hay una sesión activa, no hace falta volver a iniciar sesión.
window.supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) {
    window.location.href = "proyectos.html";
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.textContent = "";

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await window.supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    errorMessage.textContent = "Correo o contraseña incorrectos.";
    return;
  }

  window.location.href = "proyectos.html";
});
