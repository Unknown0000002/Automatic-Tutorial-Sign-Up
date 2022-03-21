const startServerBtn = document.querySelector('#startServerBtn');
const stopServerBtn = document.querySelector('#stopServerBtn');
const serverStartedAlert = document.querySelector('#serverStartedAlert');
const serverStoppedAlert = document.querySelector('#serverStoppedAlert');
const endProcessBtn = document.querySelector('#endProcessBtn');

function changeToStart() {
	stopServerBtn.classList.add('hidden');
	startServerBtn.classList.remove('hidden');
}

function changeToStop() {
	startServerBtn.classList.add('hidden');
	stopServerBtn.classList.remove('hidden');
}

function showServerStartedAlert() {
	serverStartedAlert.classList.remove('hidden');
	serverStoppedAlert.classList.add('hidden');
}

function hideServerStartedAlert() {
	serverStartedAlert.classList.add('hidden');
}

function showServerStoppedAlert() {
	serverStartedAlert.classList.add('hidden');
	serverStoppedAlert.classList.remove('hidden');
}

function hideServerStoppedAlert() {
	serverStoppedAlert.classList.add('hidden');
}

async function handleServerStart() {
	try {
		await axios.post('/api/startServer');
		showServerStartedAlert();
		changeToStop();
	} catch (error) {
		location.reload();
	}
}

async function handleServerStop() {
	try {
		await axios.post('/api/stopServer');
		showServerStoppedAlert();
		changeToStart();
	} catch (error) {
		location.reload();
	}
}

function handleProcessEnd() {
	try {
		setTimeout(() => window.close(), 100);
		axios.post('/api/endProcess');
	} catch (error) {
		location.reload();
	}
}

startServerBtn.onclick = handleServerStart;
stopServerBtn.onclick = handleServerStop;
endProcessBtn.onclick = handleProcessEnd;
