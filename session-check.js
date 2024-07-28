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
    const editButtons = document.querySelectorAll('.edit-button');
    editButtons.forEach(button => button.style.display = 'none');
}
