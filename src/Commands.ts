import * as vscode from 'vscode'
import WelcomePage from './views/WelcomePage'
import Settings from './Settings'
import * as Profile from './Profile'

export default {
	// Common
	'menu': () => WelcomePage.open(),

	// Data manipulation
    async 'clear-data' () {
        await Profile.clear();
        await Settings.clear();
    },

    async 'save-profile' (newData) {
        const profile = await Profile.get();
        if (!profile) return;
        Object.assign(profile, newData);
        await Profile.save();
    },

	// Workspaces
	async 'add-workspace' () {
		const address = await vscode.window.showInputBox({
            prompt: 'Enter IP:port of collab server',
            ignoreFocusOut: true
        });

        if (address) {
            const label = await vscode.window.showInputBox({
                prompt: 'Enter name for collab workspace',
                placeHolder: address
            });

            const info = {
                label: label || address,
                address
            };
            Settings.collabs.push(info);
			Settings.save();
            return info;
        }
	},

	async 'open-workspace' (address: string) {
		await Settings.context.globalState.update(address + '#id', await Profile.auth());
		vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.parse('dc-collab://' + address));
	},

	'remove-workspace' (address: string) {
        console.log(':remove', address, Settings.collabs);
		const i = Settings.collabs.findIndex(item => item.address == address);
        if (~i) {
            Settings.collabs.splice(i, 1);
            Settings.save();
        }
	}
}
