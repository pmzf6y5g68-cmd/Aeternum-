/*! Rendez-vous — module de réservation pour sites web. Usage :
 *  <script src="https://VOTRE-DOMAINE/embed.js" data-business="mon-slug" async></script>
 *  Options : data-label="Prendre rendez-vous", data-color="#1758E6", data-mode="button|inline".
 *  En mode inline, placez <div id="rdv-booking"></div> là où le module doit apparaître.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var slug = script.getAttribute("data-business");
  if (!slug || !/^[a-z0-9-]{3,60}$/.test(slug)) return;
  var origin = new URL(script.src).origin;
  var label = script.getAttribute("data-label") || "Prendre rendez-vous";
  var color = script.getAttribute("data-color") || "#1758E6";
  if (!/^#[0-9a-fA-F]{3,8}$/.test(color)) color = "#1758E6";
  var mode = script.getAttribute("data-mode") || "button";
  var src = origin + "/widget/" + encodeURIComponent(slug);

  function frame(height) {
    var f = document.createElement("iframe");
    f.src = src;
    f.title = label;
    f.loading = "lazy";
    f.allow = "payment";
    f.style.cssText = "width:100%;border:0;border-radius:12px;background:#fff;height:" + height;
    return f;
  }

  if (mode === "inline") {
    var target = document.getElementById("rdv-booking");
    if (target) target.appendChild(frame("720px"));
    return;
  }

  var btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.setAttribute("aria-haspopup", "dialog");
  btn.style.cssText =
    "position:fixed;right:20px;bottom:20px;z-index:2147483000;padding:14px 22px;border:0;border-radius:999px;cursor:pointer;" +
    "font:600 15px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#fff;background:" + color + ";box-shadow:0 8px 24px rgba(11,31,58,.25)";

  var overlay = null;
  function close() {
    if (overlay) overlay.remove();
    overlay = null;
    document.removeEventListener("keydown", onKey);
    btn.focus();
  }
  function onKey(e) {
    if (e.key === "Escape") close();
  }
  function open() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", label);
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483001;background:rgba(11,31,58,.55);display:flex;align-items:center;justify-content:center;padding:12px";
    var box = document.createElement("div");
    box.style.cssText = "position:relative;width:100%;max-width:440px;height:min(760px,100%);";
    var x = document.createElement("button");
    x.type = "button";
    x.setAttribute("aria-label", "Fermer");
    x.textContent = "×";
    x.style.cssText = "position:absolute;top:-6px;right:-6px;z-index:1;width:36px;height:36px;border:0;border-radius:999px;background:#fff;color:#0B1F3A;font:600 22px/1 system-ui;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)";
    x.onclick = close;
    var f = frame("100%");
    box.appendChild(x);
    box.appendChild(f);
    overlay.appendChild(box);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    x.focus();
  }
  btn.onclick = open;
  (document.body || document.documentElement).appendChild(btn);
})();
