function loading (text) {
	if (text) {
		document.querySelector('.loading').classList.add('visible');
		document.querySelector('.loading > .text').innerText = text;
	} else {
		document.querySelector('.loading').classList.remove('visible');
		document.querySelector('.loading > .text').innerText = '';
	}
}

function getInput (name) {
	name = name.split('.');
	return document.querySelector(`#${name[0]} [name="${name[1]}"] > input`);
}

const vscode = acquireVsCodeApi();
const $colorInput = getInput('profile.color');

let workspaces = [];
const $collabList = document.querySelector('#collabs > .list');
function checkEmptyWorkspaces () {
	if (!workspaces.length) {
		const $item = document.createElement('center');
		$item.innerText = 'No available workspaces';
		$collabList.appendChild($item);
	}
}

function updateWorkspaces () {
	$collabList.innerHTML = '';
	for (const info of workspaces) {
		const $item = document.createElement('div');
		$item.className = 'item';
		$item.onclick = () => vscode.postMessage({ type: 'open', address: info.address });
		
		const $rmBtn = document.createElement('i');
		$rmBtn.className = 'remove';
		$rmBtn.onclick = (e) => {
			e.stopPropagation();
			vscode.postMessage({ type: 'remove-workspace', address: info.address });
			const i = workspaces.indexOf(info);
			if (~i) {
				workspaces.splice(i, 1);
				$item.remove();
				checkEmptyWorkspaces();
			}
		}
		$item.appendChild($rmBtn);
		
		const $caption = document.createElement('span');
		$caption.className = 'caption';
		$caption.innerText = info.label;
		$item.appendChild($caption);
		
		const $address = document.createElement('span');
		$address.className = 'muted';
		$address.innerText = info.address;
		$item.appendChild($address);
		$collabList.appendChild($item);
	}

	checkEmptyWorkspaces();
}

window.addEventListener('message', e => {
	switch (e.data.type) {
		case 'auth':
			loading('Authorization in progress...');
			break;
		case 'done':
			loading(false);
			break;
		case 'set-collabs':
			workspaces = e.data.collabs;
			updateWorkspaces();
			break;
		case 'set-profile':
			loading(false);
			getInput('profile.nick').value = e.data.profile.nick;
			getInput('profile.color').value = e.data.profile.color;
			$colorInput.update();
			document.querySelector('#profile .avatar').src = e.data.profile.avatar;
			break;
		case 'add-workspace':
			workspaces.push(e.data.info);
			updateWorkspaces();
			break;
	}
});

// Colors input
$colorInput.update = () => {
	$colorInput.style.borderColor = $colorInput.style.outlineColor = $colorInput.value;
	$colorInput.style.backgroundColor = $colorInput.value + '70';
};
$colorInput.addEventListener('input', $colorInput.update);

const $colorPalette = document.querySelector('#color-select > .palette');
[
    '#b71c1c', '#c62828', '#d32f2f', '#e53935', '#f44336',
    '#880e4f', '#ad1457', '#c2185b', '#d81b60', '#e91e63',
    '#4a148c', '#6a1b9a', '#7b1fa2', '#8e24aa', '#9c27b0',
    '#311b92', '#4527a0', '#512da8', '#5e35b1', '#673ab7',
    '#1a237e', '#283593', '#303f9f', '#3949ab', '#3f51b5',
    '#0d47a1', '#1565c0', '#1976d2', '#1e88e5', '#2196f3',
    '#01579b', '#0277bd', '#0288d1', '#039be5', '#03a9f4',
    '#006064', '#00838f', '#00838f', '#00acc1', '#00bcd4',
    '#004d40', '#00695c', '#00796b', '#00897b', '#009688',
    '#1b5e20', '#2e7d32', '#388e3c', '#43a047', '#4caf50',
    '#33691e', '#558b2f', '#689f38', '#7cb342', '#8bc34a',
    '#827717', '#9e9d24', '#afb42b', '#c0ca33', '#cddc39',
    '#f57f17', '#f9a825', '#fbc02d', '#fdd835', '#ffeb3b',
    '#e65100', '#ff8f00', '#ffa000', '#ffb300', '#ffc107',
    '#bf360c', '#d84315', '#e64a19', '#f4511e', '#ff5722',
    '#3e2723', '#4e342e', '#5d4037', '#6d4c41', '#795548'
].forEach(color => {
	const $item = document.createElement('span');
	$item.className = 'color';
	$item.style.backgroundColor = color;
	$item.onclick = () => {
		$colorInput.value = color;
		$colorInput.update();
	};
	$colorPalette.appendChild($item);
});

function add_workspace () {
	vscode.postMessage({ type: 'add-workspace' });
}

function clear_data () {
	loading('Removing all extension data...');
	vscode.postMessage({ type: 'clear-data' });
}

function save_profile () {
	loading('Saving your profile...');
	vscode.postMessage({
		type: 'save-profile',
		value: {
			nick: getInput('profile.nick').value,
			color: getInput('profile.color').value
		}
	});
}
