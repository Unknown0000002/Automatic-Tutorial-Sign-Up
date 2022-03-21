const credentialForm = document.querySelector('#credentialForm');
const usernameInput = document.querySelector('#usernameInput');
const passwordInput = document.querySelector('#passwordInput');
const enableLoggingCheck = document.querySelector('#enableLoggingCheck');
const credentialSubmitButton = document.querySelector(
	'#credentialSubmitButton'
);
const credentialAlertSuccess = document.querySelector(
	'#credentialAlertSuccess'
);
const credentialAlertDanger = document.querySelector('#credentialAlertDanger');

function disableSubmitButton() {
	credentialSubmitButton.setAttribute('disabled', '');
	credentialSubmitButton.textContent = 'Loading...';
}

function enableSubmitButton() {
	credentialSubmitButton.removeAttribute('disabled');
	credentialSubmitButton.textContent = 'Submit';
}

function showCredentialAlertDanger() {
	credentialAlertSuccess.classList.add('hidden');
	credentialAlertDanger.classList.remove('hidden');
}

function showCredentialAlertSuccess() {
	credentialAlertDanger.classList.add('hidden');
	credentialAlertSuccess.classList.remove('hidden');
}

async function handleCredentialFormSubmit(event) {
	event.preventDefault();
	try {
		disableSubmitButton();
		const res = await axios.put('/api/submit/credentials', {
			username: usernameInput.value,
			password: passwordInput.value,
			enableLogging: enableLoggingCheck.checked,
		});

		enableSubmitButton();

		if (res?.data?.invalid) {
			showCredentialAlertDanger();
		} else showCredentialAlertSuccess();
	} catch (error) {}
}

credentialForm.onsubmit = handleCredentialFormSubmit;
