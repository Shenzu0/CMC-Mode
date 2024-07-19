// session-check.js

document.addEventListener('DOMContentLoaded', function () {
    checkSession();
});

function checkSession() {
    fetch('/check-session')
        .then(response => response.json())
        .then(data => {
            if (data.isAdmin) {
                document.body.classList.add('admin');
            } else {
                document.body.classList.remove('admin');
                removeEditButtons();
            }
        })
        .catch(error => console.error('Error checking session:', error));
}

function logout() {
    fetch('/logout', { method: 'POST' })
        .then(response => {
            if (response.ok) {
                document.body.classList.remove('admin');
                removeEditButtons();
                window.location.href = '/login.html'; // Rediriger vers la page de connexion
            } else {
                console.error('Failed to logout');
            }
        });
}

function removeEditButtons() {
    const editButtons = document.querySelectorAll('.edit-button');
    editButtons.forEach(button => button.style.display = 'none');
}
