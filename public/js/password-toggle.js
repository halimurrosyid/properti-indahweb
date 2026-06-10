(function () {
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-password-toggle]').forEach(function (button) {
      const targetId = button.getAttribute('data-password-toggle');
      const input = document.getElementById(targetId);
      const icon = button.querySelector('.material-symbols-outlined');

      if (!input) return;

      button.addEventListener('click', function () {
        const shouldShow = input.type === 'password';
        input.type = shouldShow ? 'text' : 'password';
        button.setAttribute('aria-label', shouldShow ? 'Sembunyikan kata sandi' : 'Lihat kata sandi');
        if (icon) {
          icon.textContent = shouldShow ? 'visibility_off' : 'visibility';
        }
      });
    });
  });
})();
