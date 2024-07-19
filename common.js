document.addEventListener('DOMContentLoaded', function () {
    fetch('/check-session')
        .then(response => response.json())
        .then(data => {
            if (data.isAdmin) {
                document.body.classList.add('admin');
            } else {
                document.body.classList.remove('admin');
                // Masquer tous les éléments avec la classe edit-button
                document.querySelectorAll('.edit-button').forEach(button => {
                    button.style.display = 'none';
                });
            }
        })
        .catch(error => console.error('Error checking session:', error));
});

function logout() {
    fetch('/logout', { method: 'POST' })
        .then(response => {
            if (response.ok) {
                document.body.classList.remove('admin');
                document.querySelectorAll('.edit-button').forEach(button => {
                    button.style.display = 'none';
                });
                window.location.href = 'login.html'; // Redirige vers la page de connexion après la déconnexion
            } else {
                console.error('Failed to logout');
            }
        })
        .catch(error => console.error('Error during logout:', error));
}
