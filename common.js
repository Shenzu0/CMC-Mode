document.addEventListener('DOMContentLoaded', function () {
    checkSession();
});

function checkSession() {
    fetch('/check-session')
        .then(response => response.json())
        .then(data => {
            if (data.isAdmin) {
                document.body.classList.add('admin');
                console.log('User is admin');
            } else {
                document.body.classList.remove('admin');
                console.log('User is not admin');
                removeEditButtons();
            }
        })
        .catch(error => console.error('Error checking session:', error));
}

function removeEditButtons() {
    document.querySelectorAll('.edit-button').forEach(button => {
        button.style.display = 'none';
    });
}

function logout() {
    fetch('/logout', { method: 'POST' })
        .then(response => {
            if (response.ok) {
                document.body.classList.remove('admin');
                removeEditButtons();
                window.location.href = 'login.html'; // Redirige vers la page de connexion après la déconnexion
            } else {
                console.error('Failed to logout');
            }
        })
        .catch(error => console.error('Error during logout:', error));
}
