import { App, MarkdownView, Plugin, PluginManifest } from 'obsidian';

function noLongerIdle(timestamper: Timestamper) {
	// check if active note is a daily log
	const activeLeaf = timestamper.plugin.app.workspace.activeLeaf;
	if (activeLeaf != null && activeLeaf.view != null && activeLeaf.view instanceof MarkdownView) {
		const markdownView = activeLeaf.view as MarkdownView;
		if (timestamper.verifyDailyLog(markdownView)) {
			const now = new Date();
			let refreshRequired = false;

			if (now.getTime() - timestamper.keyUpDateTime.getTime() > 30000) {
				// haven't typed for more than a minute
				if (!timestamper.ended) { // add an end time
					timestamper.insertTimestamp(markdownView,">", timestamper.keyUpDateTime, false);
					timestamper.ended = true;
					timestamper.started = false;
					refreshRequired = true;
				}
			}

			// if not started then start
			if (!timestamper.started) {
				timestamper.insertTimestamp(markdownView, "##", now, true);
				timestamper.started = true;
				timestamper.ended = false;
				refreshRequired = true;
			}

			if (refreshRequired) {
				markdownView.editor.refresh();
			}
			timestamper.keyUpDateTime = now;
		}	
	}
}

export default class TimestamperPlugin extends Plugin {
	timestamper: Timestamper;

	constructor(app:App, manifest: PluginManifest) {
		super(app, manifest)
		this.timestamper = new Timestamper(this);
	}

	async onload() {
		window.addEventListener('keyup', noLongerIdle.bind(null, this.timestamper));
	}

	onunload() {
		window.removeEventListener('keyup', noLongerIdle.bind(null, this.timestamper));
		window.clearInterval(this.timestamper.intervalId);
	}
}

class Timestamper {
	plugin: TimestamperPlugin;
	intervalId: number;
	started:boolean;
	ended:boolean;
	keyUpDateTime: Date;

	constructor(plugin: TimestamperPlugin) {
		this.plugin = plugin;
		this.intervalId = window.setInterval(()=>this.idleCheck(), 10000);
		this.plugin.registerInterval(this.intervalId);

		this.started = false;
		this.ended = false;
		this.keyUpDateTime = new Date();
	}

	idleCheck() {
		const d = new Date();
		console.log("Running idle check at "+d.toLocaleString());

		const activeLeaf = this.plugin.app.workspace.activeLeaf;
		if (activeLeaf != null && activeLeaf.view != null && activeLeaf.view instanceof MarkdownView) {
			const markdownView = activeLeaf.view as MarkdownView;
			if (this.verifyDailyLog(markdownView)) {
				const now = new Date();
				if (now.getTime() - this.keyUpDateTime.getTime() > 30000) {
					if (!this.ended) { // add an end time since now idle
						this.insertTimestamp(markdownView,">", this.keyUpDateTime, false);
						this.ended = true;
						this.started = false;
						markdownView.editor.refresh();
					}
				}
			}
		}
	}

	getTimestamp(dateTime:Date) {
		let hours = dateTime.getHours();
		let suffix = "AM"
		if (hours == 12) {
			suffix = "PM";
		} else if (hours > 12) {
			hours = hours - 12;
			suffix = "PM";
		}

		return dateTime.getFullYear()+"-"
			+(dateTime.getMonth()+1).toString().padStart(2, '0')
			+"-"+dateTime.getDate().toString().padStart(2, '0')
			+" "+hours.toString().padStart(2, '0')
			+":"+dateTime.getMinutes().toString().padStart(2, '0')
			+" "+suffix
	}

	getDailyFilename() {
		const d = new Date();
		return d.getFullYear()
			+"-"+(d.getMonth()+1).toString().padStart(2, '0')
			+"-"+d.getDate().toString().padStart(2, '0')
			+".md"
	}

	verifyDailyLog(markdownView: MarkdownView): boolean {
		if (markdownView.file.name == this.getDailyFilename()) {
			if (markdownView.editor.lastLine() > 2) { 	
				const line0 = markdownView.editor.getLine(0);
				const line1 = markdownView.editor.getLine(1);
				if (line0 == '---' && line1.match(`^noteType: *"Daily Note" *$`)) {
					return true;
				}
			}
		}
		return false;
	}

	insertTimestamp(markdownView:MarkdownView, prefix:string, dateTime:Date, after:boolean) {
		let move = false;
		if (markdownView.editor.getCursor().line == markdownView.editor.lastLine()) {
			move = true;
		}

		const currentLine = markdownView.editor.getLine(markdownView.editor.lastLine());
		if (after) {
			markdownView.editor.setLine(markdownView.editor.lastLine(), prefix+" "+this.getTimestamp(dateTime)+"\n");
			markdownView.editor.setLine(markdownView.editor.lastLine(), "\n");				
			markdownView.editor.setLine(markdownView.editor.lastLine(), currentLine);
		} else {
			markdownView.editor.setLine(markdownView.editor.lastLine(), currentLine+"\n\n");
			markdownView.editor.setLine(markdownView.editor.lastLine(), prefix+" "+this.getTimestamp(dateTime)+"\n");
			markdownView.editor.setLine(markdownView.editor.lastLine(), "\n");
		}

		if (move) {
			markdownView.editor.setCursor(markdownView.editor.lastLine());
		}
	}
}
