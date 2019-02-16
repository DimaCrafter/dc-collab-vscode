import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { connect } from 'net'
import { EventEmitter } from 'events'

// Sockets
type onSocketHandler = (socket: Socket) => void;
export abstract class Socket extends EventEmitter {
	host: string;
	abstract send (event: string, ...args): any;
	abstract request (event: string, path: vscode.Uri, ...args): any;
}

let onSocketListeners: onSocketHandler[] = [];
export function onSocket (handler: onSocketHandler) {
	onSocketListeners.push(handler);
}

let sockets = {};
export function getSocket (uri: vscode.Uri) {
	const host = uri.authority;
	if (!sockets[host]) {
		const hostInfo = host.split(':');
		const socket = connect({
			host: hostInfo[0],
			port: Number(hostInfo[1])
		});

		sockets[host] = new class extends Socket {
			public host = host;
			send (event, ...args) {
				socket.write(JSON.stringify([event, ...args]) + '\0');
			}

			request (event, path, ...args) {
				return new Promise(resolve => {
					this.send(event, path, ...args);
					const handler = (replyPath, result) => {
						if (path != replyPath) return;
						if (typeof result == 'object' && result.err) {
							result.err.path = 'dc-collab://' + host + result.err.path;
						}

						resolve(result);
						this.off(event, handler);
					}
	
					this.on(event, handler);
				});
			}
		};
		sockets[host].setMaxListeners(1024);

		socket.on('data', chunk => {
			const parts = chunk.toString('utf8').split('\0').slice(0, -1);
			for (let part of parts) {
				try {
					part = JSON.parse(part);
					sockets[host].emit(...part);
				} catch {}
			}
		});

		onSocketListeners.forEach(handler => handler(sockets[host]));
	}

	return sockets[host];
}

// Resources
export function getView (name: string, vars: object = {}) {
    const viewPath = path.join(__dirname, '..', 'resources', 'views', name + '.html');
    const ctx = {
        load (resourcePath: string) {
            let data = fs.readFileSync(path.join(path.dirname(viewPath), resourcePath)).toString();
            if (resourcePath.endsWith('.css')) data = '<style>' + data + '</style>';
            else if (resourcePath.endsWith('.js')) data = '<script>' + data + '</script>';
            return data;
        }
    };

    let data = fs.readFileSync(viewPath).toString();
    data = data.replace(/{% (\w+)\((.+?)\) %}/g, (_, fn, args) => {
        args = args.split(',');
        args = args.map(arg => {
            arg = arg.trim();
            if (arg[0] == '"' || arg[0] == "'") {
                return arg.slice(1, -1);
            }
        });
        return ctx[fn](...args);
    });
    data = data.replace(/{{ (\w+) }}/g, (_, varName) => {
        return vars[varName];
    });
    return data;
}

export function getResource (name: string) {
    return {
        dark: path.join(__dirname, '..', 'resources', 'dark', name),
        light: path.join(__dirname, '..', 'resources', 'light', name)
    };
}

export function getResourceUri (name: string) {
    const result = getResource(name);
    return {
        dark: vscode.Uri.parse(result.dark),
        light: vscode.Uri.parse(result.dark)
    };
}

export function getResourcesPath () {

}
