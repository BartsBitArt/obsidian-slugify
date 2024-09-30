import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";

// Symbols to exclude for file naming conventions
const stockIllegalSymbols = /[\\/:|#^[\]]|\.$/g;

interface FilenameHeadingSyncPluginSettings {
	userIllegalSymbols: string[];
	ignoreRegexen: string[];
	ignoredFiles: { [key: string]: null };
}

const DEFAULT_SETTINGS: FilenameHeadingSyncPluginSettings = {
	userIllegalSymbols: [],
	ignoredFiles: {},
	ignoreRegexen: [],
};

export default class FilenameHeadingSyncPlugin extends Plugin {
	settings: FilenameHeadingSyncPluginSettings;

	async onload() {
		await this.loadSettings();

		this.registerEvent(
			this.app.workspace.on("file-open", (file: TFile) => {
				this.handleSyncFilenameToHeading(file);
			}),
		);

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "sample-editor-command",
			name: "Sample editor command",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection("Sample Editor Command");
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new FilenameHeadingSyncSettingTab(this.app, this));
	}

	handleSyncFilenameToHeading(file: TFile) {
		new Notice('test');
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class FilenameHeadingSyncSettingTab extends PluginSettingTab {
	plugin: FilenameHeadingSyncPlugin;

	constructor(app: App, plugin: FilenameHeadingSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Filename Heading Sync" });
		containerEl.createEl("p", {
			text: "This plugin will overwrite the first heading found in a file with the filename.",
		});
		containerEl.createEl("p", {
			text: "If no header is found, will insert a new one at the first line (after frontmatter).",
		});

		new Setting(containerEl)
			.setName("Add a new file ignore Regex")
			.setDesc("Add a new Regex for ignoring files.")
			.addButton((button) => {
				button.setButtonText("Add Regex");
				button.setCta();
				button.onClick(() => {
					this.plugin.settings.ignoreRegexen.push("");
					this.display(); // Re-render settings
				});
			});

		// Create a setting for each option in the list
		this.plugin.settings.ignoreRegexen.forEach((option, index) => {
			new Setting(containerEl)
				.setName(`Regex ${index + 1}`)
				.addText((text) =>
					text
						.setPlaceholder("Enter your Regex")
						.setValue(option)
						.onChange(async (value) => {
							// Update the value in the settings
							this.plugin.settings.ignoreRegexen[index] = value;
							await this.plugin.saveSettings();
						}),
				)
				.addExtraButton((button) => {
					// Add a "Remove" button to delete this option
					button
						.setIcon("trash")
						.setTooltip("Remove this Regex")
						.onClick(async () => {
							// Remove the option from the list and refresh the settings UI
							this.plugin.settings.ignoreRegexen.splice(index, 1);
							await this.plugin.saveSettings();
							this.display(); // Re-render settings
						});
				});
		});
	}
}
