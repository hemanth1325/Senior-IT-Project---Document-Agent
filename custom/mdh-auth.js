(function () {
    const authPaths = [
      "/login",
      "/register",
      "/password",
      "/password/email",
      "/password/reset",
      "/mfa"
    ];

    const currentPath = window.location.pathname.toLowerCase();

    const isAuthPage = authPaths.some(function (path) {
      return currentPath === path || currentPath.startsWith(path + "/");
    });

    if (!isAuthPage) {
      return;
    }

    document.addEventListener("DOMContentLoaded", function () {
      document.body.classList.add("mdh-auth-page");

      document
        .querySelectorAll(".skip-to-content-link, a[href='#main-content']")
        .forEach(function (el) {
          el.remove();
        });

      const mainContent =
        document.querySelector("main") ||
        document.querySelector(".content-wrap") ||
        document.querySelector(".container");

      if (mainContent && mainContent.parentNode && !document.querySelector(".mdh-auth-top")) {
        const topSection = document.createElement("div");
        topSection.className = "mdh-auth-top";

        topSection.innerHTML = `
          <a class="mdh-text-logo" href="/">MDH BookStack</a>
          <div class="mdh-login-heading">
            <h1>MDH BookStack Student Portal</h1>
            <p>Access university information, programs, campus details, schedules, and verified academic documents.</p>
          </div>
        `;

        mainContent.parentNode.insertBefore(topSection, mainContent);
      }
    });
  })();
