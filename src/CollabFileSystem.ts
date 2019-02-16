import { Uri, FileType, FileSystemProvider } from 'vscode';
import * as vscode from 'vscode';
import CollabSession from './views/CollabSession'
import { getSocket, onSocket } from './Utils';
import Settings from './Settings'

export interface CursorEvent {
    mid: string;
    color: string;
    nick: string;
    selections: [[
        { x: number, y: number },
        { x: number, y: number }
    ]];
    path: string;
}

// Events
const _onCursor = new vscode.EventEmitter<CursorEvent>();
export const onCursor = _onCursor.event;
const _onEdit = new vscode.EventEmitter<{ uri: Uri, edits: vscode.TextEdit[] }>();
export const onEdit = _onEdit.event;
const _onSave = new vscode.EventEmitter<Uri>();
export const onSave = _onSave.event;

onSocket(socket => {
    const tmpID = Settings.context.globalState.get(socket.host + '#id');
    Settings.context.globalState.update(socket.host + '#id', undefined);

    socket.send('auth', tmpID);
    socket.once('init', e => {
        if (!e.authed) {
            switch (e.code) {
                case 'NoAdmins':
                    vscode.window.showErrorMessage('All administrators are offline, connection was automatically rejected.');
                    break;
                case 'AdminRejected':
                    vscode.window.showErrorMessage('Your connection was rejected by administrator.');
                    break;
                default:
                    vscode.window.showErrorMessage('Authorization failed with unknown code.');
                    break;
            }
            return;
        }

        CollabSession.users = e.users;
        CollabSession.refresh();
    });

    socket.on('cursor', e => {
        e.path = `/${socket.host}/${e.path}`;
        e.mid = e.id;
        e.nick = e.id;
        e.color = '#fff000';
        delete e.id;
        _onCursor.fire(e);
    });

    socket.on('edit', (path, changes) => {
        const edits = changes.map(change => {
            return new vscode.TextEdit(
                new vscode.Range(
                    new vscode.Position(change.range[0].line, change.range[0].character),
                    new vscode.Position(change.range[1].line, change.range[1].character)
                ),
                change.newText
            );
        });

        _onEdit.fire({
            edits,
            uri: Uri.parse(`dc-collab://${socket.host}/${path}`)
        });
    });

    socket.on('save', path => {
        const uri = Uri.parse(`dc-collab://${socket.host}/${path}`);
        _onSave.fire(uri);
    });
})

export class CollabFS implements FileSystemProvider {
    private _cursorTimeouts = {};
    public updateCursor (uri: Uri, selections: vscode.Selection[]) {
        const path = uri.path;
        if (path in this._cursorTimeouts) clearTimeout(this._cursorTimeouts[path]);
        this._cursorTimeouts[path] = setTimeout(() => {
            getSocket(uri).send('cursor', {
                path,
                selections: selections.map(s => [{
                    x: s.start.character,
                    y: s.start.line
                }, {
                    x: s.end.character,
                    y: s.end.line
                }]),
            });
            delete this._cursorTimeouts[path];
        }, 75);
    }

    public emitEdit (uri: Uri, changes: vscode.TextDocumentContentChangeEvent[]) {
        getSocket(uri).send('edit', uri.path, changes.map(change => ({ range: change.range, newText: change.text })));
    }

    // Оболочка класса
    private _request (task: string, uri: Uri, ...packet: any[]): Promise<any> {
        const socket = getSocket(uri);
        return socket.request(task, ...packet);
    }

    private _freeze: string[] = [];
    public freeze (path: string, status: boolean) {
        let i = this._freeze.indexOf(path);
        if (status) {
            if (!~i) this._freeze.push(path);
        } else {
            if (~i) this._freeze.splice(i);
        }
    }

    public isFreezed (path: string) {
        return this._freeze.indexOf(path) != -1;
    }

    // Оболочка файловой системы
    async stat (uri: Uri): Promise<vscode.FileStat> {
        const result = await this._request('stat', uri, uri.path);
        if (result.err) {
            if (result.err.code == 'ENOENT') throw vscode.FileSystemError.FileNotFound(Uri.parse(result.err.path));
            else throw result.err;
        } else {
            return {
                ctime: result.ctime || Date.now(),
                mtime: result.mtime || Date.now(),
                size: result.size || 0,
                type: <FileType> FileType[<string> result.type]
            };
        }
    }

    async createDirectory(uri: Uri) {
        const result = await this._request('create-dir', uri, uri.path);
        if (result.err) throw result.err;
    }

    async readDirectory (uri: Uri) {
        const result = await this._request('readDirectory', uri, uri.path);
        if (result.err) throw result.err;
        else return result.map(entry => ['collab:/' + uri.path + entry[0], FileType[entry[1]]]);
    }

    async readFile (uri: Uri): Promise<Buffer> {
        const result = await this._request('readFile', uri, uri.path);
        if (result.err) throw result.err;
        else return Buffer.from(result);
    }

    async writeFile (uri: Uri, data: Buffer, options: { create: boolean, overwrite: boolean }): Promise<void> {
        if (this.isFreezed(uri.path)) return;
        const result = await this._request('writeFile', uri, uri.path, data.toString(), options);
        if (result.err) throw result.err;
    }

    async delete (uri: Uri) {
        const result = await this._request('delete', uri, uri.path);
        if (result.err) throw result.err;
    }

    async rename (oldUri: Uri, newUri: Uri, options: { overwrite: boolean }) {
        const result = await this._request('rename', oldUri, oldUri.path, newUri.path);
        if (result.err) throw result.err;
    }

    // Непонятная дичь с watch
    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;
    watch (resource: vscode.Uri, opts): vscode.Disposable {
        // :watch
        console.log('watch', resource.path);
        this._emitter.fire([{
            type: vscode.FileChangeType.Changed,
            uri: resource
        }]);
        // this.onDidChangeFile()
        return new vscode.Disposable(() => {
            // :unwatch
        });
    }
}
