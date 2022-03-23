// let data = ['1', '2'];
const mainEl = document.querySelector('#main');
const formEl = document.querySelector('#teacherForm');
const inputEl = document.querySelector('#teacherInput');
const clearBtn = document.querySelector('#clearBtn');
const alertEl = document.querySelector('#alert');
const teacherListSubmit = document.querySelector('#teacherListSubmit');

formEl.onsubmit = handleSubmit;

clearBtn.onclick = handleClear;

teacherListSubmit.onclick = handleListUpdate;

mainEl.ondragover = event => {
	event.preventDefault();
	showDroppers();
};

let unique = () => {
	return Math.floor((1 + Math.random()) * 0x10000)
		.toString(16)
		.substring(1);
};

function createItem(text) {
	const itemEl = document.createElement('li');
	itemEl.id = `a${unique()}`;
	itemEl.classList.add(
		'list-item',
		'list-group-item',
		'list-group-item-action'
	);
	itemEl.innerHTML = `
    <div class="d-flex justify-content-between">
    	<span>${text}</span><button class="btn-close"></button>
    </div>
    `;

	itemEl.children[0].children[1].onclick = handleDelete;
	itemEl.draggable = true;
	itemEl.ondragstart = event => {
		event.target.classList.add('active');
		event.dataTransfer.setData('id', `${itemEl.id}`);
	};

	itemEl.ondragend = event => {
		hideDroppers();
		event.target.classList.remove('active');
	};

	return itemEl;
}

function createDropper() {
	const dropperEl = document.createElement('div');
	dropperEl.classList.add('dropper');
	dropperEl.ondragover = event => {
		event.preventDefault();
	};

	dropperEl.ondrop = event => {
		const draggable = document.querySelector(
			`#${event.dataTransfer.getData('id')}`
		);
		$(dropperEl).after(draggable);
		dropperEl.remove();
		handleAfterDrop();
	};

	return dropperEl;
}

for (const item of data) {
	mainEl.appendChild(createItem(item));
}

const elements = mainEl.children;

Array.from(elements).forEach((element, index) => {
	if (index === 0) {
		$(element).before(createDropper());
	}

	$(element).after(createDropper());
});

function handleAfterDrop() {
	let els = document.querySelector('#main').children;

	Array.from(els).forEach((el, index) => {
		if (!$(el).hasClass('list-item')) {
			return;
		}

		if (index === 0) {
			$(el).before(createDropper());
		}

		const nextEl = $(el).next();

		if (!nextEl || !nextEl.hasClass('dropper')) {
			$(el).after(createDropper());
		}
	});

	els = document.querySelector('#main').children;

	Array.from(els).forEach(el => {
		if (!$(el).hasClass('dropper')) {
			return;
		}
		const nextEl = $(el).next();

		if (nextEl && nextEl.hasClass('dropper')) {
			nextEl.remove();
		}
	});

	updateData();
}

function showDroppers() {
	const droppers = document.querySelectorAll('#main>.dropper');

	Array.from(droppers).forEach(dropper =>
		dropper.classList.add('dropper-active')
	);
}

function hideDroppers() {
	$('#main>.dropper').removeClass('dropper-active');
}

function handleSubmit(event) {
	event.preventDefault();
	try {
		if (!inputEl.value) return;

		for (const item of data) {
			if (item === inputEl.value) {
				showAlert();
				return;
			}
		}
		hideAlert();
		data.push(inputEl.value);
		renderData(data);
		inputEl.value = '';
	} catch (error) {
		console.log(error);
	}
}

function renderData(data) {
	mainEl.innerHTML = '';

	data.forEach(item => {
		mainEl.appendChild(createItem(item));
	});

	handleAfterDrop();
}

function updateData() {
	const listEl = document.querySelectorAll('#main>.list-item');

	data = [];

	Array.from(listEl).forEach(el => data.push(el.textContent.trim()));
}

function handleClear() {
	data = [];

	renderData(data);
}

function handleDelete(event) {
	deleteFromData(event.target.parentElement.children[0].textContent);

	renderData(data);
}

function deleteFromData(item) {
	const index = data.indexOf(item);

	if (index > -1) data.splice(index, 1);
	else return false;

	return true;
}

function showAlert() {
	alertEl.classList.remove('hidden');
}

function hideAlert() {
	alertEl.classList.add('hidden');
}

async function handleListUpdate(event) {
	event.preventDefault();
	try {
		disableTeacherListSubmit();
		await axios.put('/api/submit/list', data);
		enableTeacherListSubmit();
	} catch (error) {
		location.reload();
	}
}

function disableTeacherListSubmit() {
	teacherListSubmit.setAttribute('disabled', '');
	teacherListSubmit.textContent = 'Loading...';
}

function enableTeacherListSubmit() {
	teacherListSubmit.removeAttribute('disabled');
	teacherListSubmit.textContent = 'Update';
}
