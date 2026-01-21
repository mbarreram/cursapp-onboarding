document.addEventListener("DOMContentLoaded", () => {
  try {
    const raw = localStorage.getItem("cursapp_demo_user");
    if (!raw) {
      location.assign("/");
      return;
    }

    const user = JSON.parse(raw);

    document.getElementById("whoLine").textContent =
      user.name + " · " + user.role;

    document.getElementById("app").innerHTML = `
      <h1>Dashboard ${user.role}</h1>
      <p>Bienvenido a Cursapp.</p>
    `;

    document.getElementById("logoutBtn").onclick = () => {
      localStorage.removeItem("cursapp_demo_user");
      location.assign("/");
    };

  } catch (err) {
    document.body.innerHTML =
      "<pre style='padding:16px;color:red'>Error dashboard:\n" +
      err.message +
      "</pre>";
  }
});
