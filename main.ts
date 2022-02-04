import { App, MarkdownView, Notice, Plugin, PluginManifest, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface TimestamperPluginSettings {
	intervalMinutes: string;
}

const DEFAULT_SETTINGS: TimestamperPluginSettings = {
	intervalMinutes: '30',
}

export default class TimestamperPlugin extends Plugin {
	settings: TimestamperPluginSettings;
	timestamper: Timestamper;

	constructor(app:App, manifest: PluginManifest) {
		super(app, manifest)
		this.timestamper = new Timestamper(this, 0);
	}

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new TimestamperSettingTab(this.app, this));

	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		const parsed = parseInt(this.settings.intervalMinutes);
		this.timestamper.setIntervalMinutes(parsed); // get the timer going at the saved interval
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class Timestamper {
	plugin: TimestamperPlugin;
	private intervalMinutes: number;
	private intervalId: number;

	constructor(plugin: TimestamperPlugin, intervalMinutes: number) {
		this.plugin = plugin;
		this.intervalId = null;
		this.setIntervalMinutes(intervalMinutes);
	}

	getIntervalMinutes(): number {
		return this.intervalMinutes;
	}

	setIntervalMinutes(intervalMinutes:number) {
		this.intervalMinutes = intervalMinutes;
		if (intervalMinutes > 0) {			
			const coeff = 1000 * 60 * this.intervalMinutes;
			const date = new Date();  //or use any other date
			const rounded = new Date(Math.ceil(date.getTime() / coeff) * coeff)

			const ms = rounded.getTime() - date.getTime();
			if (ms < 55000) {
				this.startBounce(ms);
			} else {
				this.startNormal();
			}
		} else {
			if (this.intervalId != null) {
				window.clearInterval(this.intervalId); // clear the interval if invalid
				this.intervalId = null;
			}
		}
	}

	startBounce(timeToRound: number) {
		console.log("start bounce at "+this.getTimestamp()+" after "+timeToRound+" ms")
		window.clearInterval(this.intervalId);
		this.intervalId = window.setInterval(()=>this.bounceIntervalEvent(), timeToRound);
		this.plugin.registerInterval(this.intervalId);
	}

	bounceIntervalEvent() {
		if (this.intervalId != null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}

		const coeff = 1000 * 60 * this.intervalMinutes;
		const date = new Date();  //or use any other date
		const rounded = new Date(Math.ceil(date.getTime() / coeff) * coeff)

		const ms = rounded.getTime() - date.getTime();

		if (ms < 55000) {
			this.startBounce(ms);
		} else {
			this.startNormal();
		}
	}

	startNormal() {
		console.log("start normal at "+this.getTimestamp());

		this.insertTimestamp();

		if (this.intervalId != null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}

		// schedule to keep going
		this.intervalId = window.setInterval(()=>this.normalIntervalEvent(), this.intervalMinutes*60*1000);
		this.plugin.registerInterval(this.intervalId);
	}

	getTimestamp() {
		const d = new Date();
		let hours = d.getHours();
		let suffix = "AM"
		if (hours > 12) {
			hours = hours - 12;
			suffix = "PM";
		}

		return d.getFullYear()+"-"
			+(d.getMonth()+1).toString().padStart(2, '0')
			+"-"+d.getDate().toString().padStart(2, '0')
			+" "+hours.toString().padStart(2, '0')
			+":"+d.getMinutes().toString().padStart(2, '0')
			+" "+suffix
	}

	getDailyFilename() {
		const d = new Date();
		return d.getFullYear()
			+"-"+(d.getMonth()+1).toString().padStart(2, '0')
			+"-"+d.getDate().toString().padStart(2, '0')
			+".md"
	}

	normalIntervalEvent() {
		console.log("normal event "+this.getTimestamp());
		this.insertTimestamp();

		const coeff = 1000 * 60 * this.intervalMinutes;
		const date = new Date();  //or use any other date
		const rounded = new Date(Math.ceil(date.getTime() / coeff) * coeff)

		const ms = rounded.getTime() - date.getTime();
		if (ms < 55000)	{ // if more than 5 seconds off set a bounce
			this.startBounce(ms);
		}
	}

	insertTimestamp() {
		const activeLeaf = this.plugin.app.workspace.activeLeaf;
		if (activeLeaf != null && activeLeaf.view != null && activeLeaf.view instanceof MarkdownView) {
			const markdownView = activeLeaf.view as MarkdownView;
			if (markdownView.file.name == this.getDailyFilename()) {
				let move = false;
				if (markdownView.editor.getCursor().line == markdownView.editor.lastLine()) {
					move = true;
				}

				const currentLine = markdownView.editor.getLine(markdownView.editor.lastLine());
				if (currentLine == "") {
					markdownView.editor.setLine(markdownView.editor.lastLine(), "\n");
				} else {
					markdownView.editor.setLine(markdownView.editor.lastLine(), currentLine+"\n\n");
				}
				markdownView.editor.setLine(markdownView.editor.lastLine(), "> "+this.getTimestamp()+"\n");
				markdownView.editor.setLine(markdownView.editor.lastLine(), "\n");

				if (move) {
					markdownView.editor.setCursor(markdownView.editor.lastLine());
				}

				markdownView.editor.refresh();
			}
		}
	}
}

class TimestamperSettingTab extends PluginSettingTab {
	plugin: TimestamperPlugin;

	constructor(app: App, plugin: TimestamperPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'General Settings'});

		new Setting(containerEl)
			.setName('Timestamp Interval')
			.setDesc('Time interval at which to attempt to insert a timestamp')
			.addDropdown(dropDown => {
				dropDown.addOption('1', '1 minute');
				dropDown.addOption('5', '5 minutes');
				dropDown.addOption('15', '15 minutes');
				dropDown.addOption('30', '30 minutes');
				dropDown.addOption('60', '60 minutes');
				dropDown.setValue(this.plugin.settings.intervalMinutes)
				dropDown.onChange(async (value) => {
					const parsed = parseInt(value, 10);
					if (isNaN(parsed)) {
						new Notice("Please specify a valid number.");
					} else {
						this.plugin.timestamper.setIntervalMinutes(parsed);
						this.plugin.settings.intervalMinutes = value;
						await this.plugin.saveSettings();
					}
				});
			})
	}
}
