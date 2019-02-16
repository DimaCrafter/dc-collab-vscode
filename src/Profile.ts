import Settings from './Settings'
import * as vscode from 'vscode'

import * as http from 'https'
const API_BASE = 'https://dc-collab-auth.herokuapp.com/api';
function getURL (path, query) {
	let url = API_BASE + '/' + path;
	if (query) url += '?' + Object.entries(query).map(([key, val]) => key + '=' + val).join('&');
	return url;
}

function fetchAPI (path: string, query?: object, cb?: (event: string, value: string) => void);
function fetchAPI (path, query, cb) {
	if (typeof query == 'function') {
		cb = query;
		query = undefined;
	}

	return new Promise(resolve => {
		http.get(getURL(path, query), res => {
			if (cb) {
				res.on('close', resolve);
				res.on('data', chunk => {
					chunk = chunk.toString();
					const delim = chunk.indexOf(':');
					cb(chunk.slice(0, delim), chunk.slice(delim + 1, -1));
				});
			} else {
				let data = '';
				res.on('data', chunk => data += chunk.toString());
				res.on('close', () => resolve(JSON.parse(data)));
			}
		});
	});
}

// Returns `tmpID` when authentication is done
export async function auth () {
	let tmpID;
	if (Settings.accessToken) {
		await fetchAPI('get-id', { token: Settings.accessToken }, (event, value) => {
			if (event == 'tmpID') tmpID = value;
		});
	} else {
		await fetchAPI('start-auth', (event, value) => {
			switch (event) {
				case 'tmpID':
					tmpID = value;
					// `proceed-auth` will trigger `token` event, when successfully logged in.
					vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(getURL('proceed-auth', { tmpID })));
					break;
				case 'token':
					Settings.accessToken = value;
					Settings.save();
					break;
			}
		});
	}

	return tmpID;
}

let currentProfile;
export async function get () {
	if (!currentProfile) {
		if (Settings.accessToken) {
			currentProfile = await fetchAPI('get-profile', { token: Settings.accessToken });
		} else {
			currentProfile = await fetchAPI('get-profile', { tmpID: await auth() });
		}
	}

	return currentProfile;
}

export function save () {
	return new Promise(resolve => {
		const body = Buffer.from(JSON.stringify({
			...currentProfile,
			avatar: undefined
		}));

		const req = http.request(getURL('save-profile', { token: Settings.accessToken }), {
			method: 'POST',
			headers: {
				// Preventing JSON parsing
				'Content-Type': 'text/plain',
				'Content-Length': body.length
			}
		}, res => {
			// `end` event didn't fires without `data` event
			res.on('data', () => {});
			res.on('end', () => resolve());
		});

		req.write(body);
		req.end();
	});
}

export function clear () {
	return fetchAPI('remove-profile', { token: Settings.accessToken });
}
