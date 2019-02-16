import * as vscode from 'vscode'
interface SettingsObject {
	accessToken?: string;
	collabs: [{
		label: string,
		address: string
	}]
}

interface Settings extends SettingsObject {
	init (ctx: vscode.ExtensionContext): void;
	save (): void;
	clear (): Promise<void>;
	readonly mid: string;
	readonly context: vscode.ExtensionContext
}

const settings = <Settings> {
	get mid () { return vscode.env.machineId },

	init (ctx: vscode.ExtensionContext) {
		this.context = ctx;
		const saved = settings.context.globalState.get<SettingsObject>('settings');
		if (saved) Object.assign(this, saved);
		if (!this.collabs) this.collabs = [];
	},
	save () {
		settings.context.globalState.update('settings', {
			accessToken: settings.accessToken,
			collabs: settings.collabs
		});
	},
	async clear () {
		await settings.context.globalState.update('settings', null);
		delete this.accessToken;
		delete this.collabs;
		settings.init(settings.context);
	}
};

export default settings
