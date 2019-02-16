import * as vscode from 'vscode'
import { onCursor, CollabFS, onEdit, onSave } from './CollabFileSystem'
import * as DocWrap from './DocumentWrapper'
const { store: dwStore } = DocWrap;
import { getSocket, Socket, onSocket } from './Utils'
import Settings from './Settings'
import CollabSession from './views/CollabSession'
import Commands from './Commands';

export function activate (context: vscode.ExtensionContext) {
    // Registering commands and context
    Settings.init(context);
    for (const commandName in Commands) {
        context.subscriptions.push(vscode.commands.registerCommand('collab.' + commandName, Commands[commandName]));
    }

    // Registering virtual file system
    const cfs = new CollabFS();
    context.subscriptions.push(vscode.workspace.registerFileSystemProvider('dc-collab', cfs, { isCaseSensitive: true }));

    // Hooking editor events
	vscode.window.onDidChangeActiveTextEditor(DocWrap.active, null, context.subscriptions);

    vscode.window.onDidChangeTextEditorSelection(e => {
        cfs.updateCursor(e.textEditor.document.uri, e.textEditor.selections);
    }, null, context.subscriptions);

    // Will be fired when somebody edited document
    let editing = false;
    onEdit(async e => {
        editing = true;
        const edit = new vscode.WorkspaceEdit();
        edit.set(e.uri, e.edits);
        await vscode.workspace.applyEdit(edit);
        editing = false;
    });

    // Emitting edit event if file was edited locally
    vscode.workspace.onDidChangeTextDocument(e => {
        if (!editing && e.document.uri.scheme == 'dc-collab' && e.contentChanges.length) {
            cfs.emitEdit(e.document.uri, e.contentChanges);
        }
    });

    // Show user's nick on hover
    vscode.languages.registerHoverProvider({ scheme: 'dc-collab' }, {
        provideHover (doc, pos, token) {
            if (doc.uri.path in dwStore.documents) {
                const cursor = dwStore.documents[doc.uri.path].getCursor(pos);
                if (cursor) return new vscode.Hover(cursor.nick);
            }
        }
    });

    // Calls when cursors positions was changed
    onCursor(e => {
        dwStore.documents[e.path].parseCursor(e);
        if (dwStore.activeDocument && dwStore.activeDocument.uri.path == e.path) {
            dwStore.activeDocument.renderCursors();
        }
    });

    // Will be fired when somebody saved document
    onSave(async uri => {
        console.log(':save', uri);
        // let { editor } = dwStore.documents[uri.path];
        // if (editor) {
        //     cfs.freeze(uri.path, true);
        //     await editor.document.save();
        //     cfs.freeze(uri.path, false);
        // }
    });

    // Updating openned files list for current user on server
    vscode.workspace.onDidOpenTextDocument(document => {
        if (document.uri.scheme != 'dc-collab') return;
        const socket: Socket = getSocket(document.uri);
        socket.send('openDocument', document.uri.path.split('/').slice(2).join('/'));
    });
    vscode.workspace.onDidCloseTextDocument(document => {
        if (document.uri.scheme != 'dc-collab') return;
        const socket: Socket = getSocket(document.uri);
        socket.send('closeDocument', document.uri.path.split('/').slice(2).join('/'));
    });
    vscode.window.onDidChangeVisibleTextEditors(list => {
        let result: string[] = [];
        for (const item of list) {
            if (item.document.uri.scheme != 'dc-collab') continue;
            result.push(item.document.uri.path.split('/').slice(2).join('/'));
        }

        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
            const socket: Socket = getSocket(vscode.workspace.workspaceFolders[0].uri);
            socket.send('activeDocuments', result);
        }
    });

    onSocket(socket => {
        // Updating local openned files list for remote user
        socket.on('openDocument', data => {
            const user = CollabSession.users.find(u => u.name == data.nick);
            if (!user) return;
            const i = user.files.findIndex(file => file.path == data.path);
            if (!~i) user.files.push({ path: data.path });
            CollabSession.refresh();
        });
        socket.on('closeDocument', data => {
            const user = CollabSession.users.find(u => u.name == data.nick);
            if (!user) return;
            const i = user.files.findIndex(file => file.path == data.path);
            if (~i) user.files.splice(i, 1);
            CollabSession.refresh();
        });
        socket.on('activeDocuments', data => {
            const user = CollabSession.users.find(u => u.name == data.nick);
            if (!user) return;
            for (const file of user.files) {
                if (~data.list.indexOf(file.path)) file.active = true;
                else delete file.active;
            }
            CollabSession.refresh();
        });

        // Asking to approve connection of new user if current user is administrator
        socket.on('approveConnection', user => {
            vscode.window.showInformationMessage(`User ${user.name} trying to connect from ${user.ip}.\nAccept connection?`, 'Accept', 'Reject').then(action => {
                switch (action) {
                    case 'Accept':
                        socket.send('approveConnection', user.token, true);
                        break;
                    case 'Reject':
                        socket.send('approveConnection', user.token, false);
                        break;
                }
            });
        });
    });

    // Hooking terminal open
    context.subscriptions.push(vscode.window.onDidOpenTerminal((e: any) => {
        let uri;
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length) {
            for (const workspace of vscode.workspace.workspaceFolders) {
                if (workspace.uri.scheme == 'dc-collab') {
                    uri = workspace.uri;
                    break;
                }
            }
        }

        if (!uri) return;
        if (e._creationOptions.remote) return;
        e.dispose();

        const socket: Socket = getSocket(uri);
        const onWrite = new vscode.EventEmitter<string>();
        const onTitle = new vscode.EventEmitter<string>();
        let pid;
        const term = vscode.window.createTerminal(<vscode.TerminalOptions> {
            name: 'Remote terminal',
            remote: true,
            created: Date.now(),
            pty: {
                onTitleChange: onTitle.event,
                onDidWrite: onWrite.event,
                open (size) {
                    socket.send('term', 'init');
                    onWrite.fire('Connecting to remote terminal...\r\n');
                    socket.on('term', (type: string, data: any) => {
                        switch (type) {
                            case 'created':
                                onWrite.fire('Connected!\r\n\n');
                                if (size) socket.send('term', 'resize', { pid, ...size });
                                pid = data.pid;
                                break;
                            case 'output':
                                if (data.pid != pid) return;
                                onWrite.fire(data.chunk.replace(/\r?\n/g, '\r\n'));
                                break;
                            case 'close':
                                if (data.pid != pid) return;
                                term.dispose();
                                break;
                        }
                    });

                    let i = 0;
                    setInterval(() => {
                        onTitle.fire('i - ' + i++);
                    }, 500);
                },
                close () {
                    socket.send('term', 'close', { pid });
                },
                setDimensions (size) {
                    socket.send('term', 'resize', { pid, ...size });
                },
                handleInput (chunk: string) {
                    if (chunk == '\r') {
                        onWrite.fire('\r');
                        chunk = '\n';
                    }

                    socket.send('term', 'input', { pid, chunk });
                }
            }
        });

        term.show();
    }));
}
