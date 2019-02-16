import * as vscode from 'vscode';
import { getResource } from '../Utils';

interface User {
    name: string;
    color: string;
    files: [{
        path: string,
        active?: boolean
    }];
    terminals: [{
        title: string,
        active?: boolean
    }];
}

export default new class implements vscode.TreeDataProvider<vscode.TreeItem> {
	constructor () {
		vscode.window.createTreeView('collab-session', { treeDataProvider: this });
    }

    public users: User[] = [];
    private _getMenu () {
        const users = this.users.map(user => {
            let files: vscode.TreeItem[] = user.files.map(file => {
                const name = file.path.slice(file.path.lastIndexOf('/') + 1);
                return {
                    label: name,
                    tooltip: file.path,
                    description: file.active ? 'Active' : undefined,
                    resourceUri: vscode.Uri.file(name),
                    iconPath: vscode.ThemeIcon.File
                };
            });
            if (!files.length) files = [{ label: 'No opened files' }];
            else files.unshift({ label: 'Opened files:' });

            let terms: vscode.TreeItem[] = user.terminals.map(term => ({
                label: term.title,
                description: term.active ? 'Active' : undefined,
                iconPath: getResource('window.svg')
            }));
            if (!terms.length) terms = [{ label: 'No opened terminals' }];
            else terms.unshift({ label: 'Opened terminals:' });

            return {
                label: user.name,
                iconPath: getResource('account.svg'),
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                childs: [
                    ...files,
                    ...terms
                ]
            };
        });

        return [
            {
                label: 'Connected users',
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                childs: users
            }
        ]
    }

    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem>();
    public onDidChangeTreeData = this._onDidChangeTreeData.event;
    public refresh () { this._onDidChangeTreeData.fire(); }
    getTreeItem (item: vscode.TreeItem) { return item; }
    getChildren (item: vscode.TreeItem) {
        if (item) {
            return (<any> item).childs || null;
        } else {
            if ()
            return this._getMenu();
        }
    }
}
