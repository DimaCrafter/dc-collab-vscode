import * as vscode from 'vscode';
import { getView, getResourceUri, getResource } from '../Utils'
import Settings from '../Settings'
import { get as getProfile } from '../Profile'

export default new class {
    private _panel: vscode.WebviewPanel | null;
    async open () {
        if (!this._panel) {
            this._panel = vscode.window.createWebviewPanel(
                'collab-menu',
                'Collab Manager',
                vscode.ViewColumn.Active,
                { enableScripts: true, retainContextWhenHidden: true }
            );

            this._panel.iconPath = getResourceUri('icon.svg');
            this._panel.onDidDispose(() => this._panel = null);
            this._panel.webview.onDidReceiveMessage(e => this.onMessage(e));
		}

        this._panel.webview.html = getView('welcome-page', {
            add_icon_path: (<any> this._panel.webview).asWebviewUri(getResourceUri('add.svg').dark),
            tools_icon_path: (<any> this._panel.webview).asWebviewUri(getResourceUri('tools.svg').dark)
        });

        this._panel.reveal();
        this._panel.webview.postMessage({ type: 'auth' });

        this._panel.webview.postMessage({
            type: 'set-collabs',
            collabs: Settings.collabs
        });

        this._panel.webview.postMessage({
            type: 'set-profile',
            profile: await getProfile()
        });
    }

    onMessage (data) {
        switch (data.type) {
            case 'settings-change':
                Settings[data.key] = data.value;
                Settings.save();
                break;
            case 'open':
                vscode.commands.executeCommand('collab.open-workspace', data.addr);
                break;
            case 'add-workspace':
                vscode.commands.executeCommand('collab.add-workspace').then(info => {
                    if (!this._panel || !info) return;
                    this._panel.webview.postMessage({
                        type: 'add-workspace',
                        info
                    });
                });
                break;
            case 'remove-workspace':
                vscode.commands.executeCommand('collab.remove-workspace', data.address);
                break;
            case 'clear-data':
                vscode.commands.executeCommand('collab.clear-data').then(() => {
                    if (!this._panel) return;
                    this._panel.dispose();
                    this.open();
                });
                break;
            case 'save-profile':
                vscode.commands.executeCommand('collab.save-profile', data.value).then(() => {
                    if (!this._panel) return;
                    this._panel.webview.postMessage({ type: 'done' });
                });
                break;
        }
    }
}
