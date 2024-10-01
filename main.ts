import {
	App,
	ButtonComponent,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TextAreaComponent,
	TextComponent,
	TFile,
} from "obsidian";
import { type } from "os";

// Symbols to exclude for file naming conventions
const stockIllegalSymbols = /[\\/:|#^[\]]|\.$/g;

interface FilenameHeadingSyncPluginSettings {
	userIllegalSymbols: string;
	fileIgnoreRegexen: string[];
}

const DEFAULT_SETTINGS: FilenameHeadingSyncPluginSettings = {
	userIllegalSymbols: "",
	fileIgnoreRegexen: ["/.*.excalidraw.md$/g"],
};

/** Deserialize a RegExp string into an actual RegExp object
 * If the regex is invalid return a default regex
 *
 * @param {string} regex The string to turn into a regex
 */
function deserializeRegExp(regExpString: string): RegExp {
	const match = regExpString.match(/\/(.*)?\/([a-z]*)/);
	// If match is null, return empty Regex
	if (match) {
		return new RegExp(match[1], match[2]);
	} else {
		new Notice(`Invalid RegExp string: "${regExpString}"`);
		return new RegExp("$^", "g"); // Or return a default RegExp, e.g. /default/
	}
}

export default class FilenameHeadingSyncPlugin extends Plugin {
	settings: FilenameHeadingSyncPluginSettings;

	async onload() {
		await this.loadSettings();

		this.app.workspace.on("file-open", (file: TFile) => {
			if (!this.ignoreFile(file)) {
				this.handleSyncFilenameToHeading(file);
			}
		});

		this.app.vault.on("rename", (file: TFile) => {
			if (!this.ignoreFile(file)) {
				this.handleSyncFilenameToHeading(file);
			}
		});

		this.app.vault.on("modify", (file: TFile) => {
			if (!this.ignoreFile(file)) {
				this.handleSyncHeadingToFilename(file);
			}
		});

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

	/**
	 * Syncs the Filename to the first lvl 1 heading
	 */
	handleSyncFilenameToHeading(file: TFile) {
		const sanitizedHeading = this.sanitizeHeading(file.basename);

		// Format heading
		let heading = sanitizedHeading.replace(/-/g, " ");
		heading = "# " + heading[0].toUpperCase() + heading.slice(1);

		this.app.vault.read(file).then((data) => {
			const lines = data.split("\n");
			const headingLine = this.getHeadingLine(lines);

			if (headingLine != -1) {
				lines[headingLine] = heading;
			} else {
				lines.unshift(heading);
			}

			data = lines.join("\n");
			this.app.vault.modify(file, data);
		});
	}

	/**
	 * Syncs the first lvl 1 heading to the filename.
	 * If no heading is found creates a first level heading based on the file name
	 */
	handleSyncHeadingToFilename(file: TFile) {
		this.app.vault.read(file).then((data) => {
			const lines = data.split("\n");
			const headingLine = this.getHeadingLine(lines);

			if (headingLine != -1) {
				let heading = this.sanitizeHeading(lines[headingLine]);
				heading = heading.replace(/ /g, "-");
				heading = heading.toLowerCase();
				const newPath = `${file.parent?.path}/${heading}.md`;
				this.app.fileManager.renameFile(file, newPath);
			} else {
				this.handleSyncFilenameToHeading(file);
			}
		});
	}

	/**
	 * Checks if the file should be ignored
	 */
	ignoreFile(file: TFile): boolean {
		// Check if file is markdown
		if (file.extension != "md" && file.extension != "markdown") {
			return true;
		}

		// Check for plugins
		const fileCache = this.app.metadataCache.getFileCache(file);
		if (!!fileCache?.frontmatter) {
			if (!!fileCache.frontmatter["excalidraw-plugin"]) {
				return true;
			} else if (!!fileCache.frontmatter["kanban-plugin"]) {
				return true;
			}
		}

		// Check ignore regexen
		for (let i in this.settings.fileIgnoreRegexen) {
			const regex = deserializeRegExp(this.settings.fileIgnoreRegexen[i]);
			let test = regex.exec(file.path)?.toString();
			if (test != null) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Returns a heading with illegal characters removed
	 *
	 * @param {string} heading The heading you want to sanitize
	 */
	sanitizeHeading(heading: string): string {
		heading = heading.replace(stockIllegalSymbols, "");
		heading = heading.replace(
			deserializeRegExp(this.settings.userIllegalSymbols),
			"",
		);
		heading = heading.trim();
		return heading;
	}

	/**
	 * Returns the line number of the first line after the yaml.
	 * If there is no yaml returns 0
	 *
	 * @param {string[]} lines The file split on new line.
	 */
	getStartLine(lines: string[]): number {
		let startingLine = 0;
		if (lines[startingLine] == "---") {
			startingLine = lines.indexOf("---", 1) + 1;
		}
		return startingLine;
	}

	/**
	 * Returns the linenumber of the first lvl 1 heading.
	 * If no heading is found returns -1.
	 *
	 * @param {string[]} lines The file split on new line.
	 */
	getHeadingLine(lines: string[]): number {
		const startLine = this.getStartLine(lines);
		for (let i = startLine; i < lines.length; i++) {
			if (lines[i].startsWith("# ")) {
				return i;
			}
		}
		return -1;
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
		// Intro
		containerEl.createEl("h2", { text: "Filename Heading Sync" });
		containerEl.createEl("p", {
			text: "This plugin will overwrite the first heading found in a file with the filename.",
		});
		containerEl.createEl("p", {
			text: "If no header is found, will insert a new one at the first line (after frontmatter).",
		});

		// Illegal characters
		new Setting(containerEl)
			.setName("Custom Illegal Characters/Strings Regex")
			.setDesc("Make your own regex for illegal heading symbols.")
			.addText((text) =>
				text
					.setPlaceholder("/@#(/g")
					.setValue(this.plugin.settings.userIllegalSymbols)
					.onChange(async (value) => {
						this.plugin.settings.userIllegalSymbols =
							deserializeRegExp(value).toString();
						if (
							this.plugin.settings.userIllegalSymbols ==
								"/(?:)/g" ||
							this.plugin.settings.userIllegalSymbols == "/(?:)/"
						) {
							text.setValue("//g");
						} else {
							text.setValue(
								this.plugin.settings.userIllegalSymbols,
							);
						}
						await this.plugin.saveSettings();
					}),
			);

		// File ignore
		new Setting(containerEl)
			.setName("Add a new file ignore Regex")
			.setDesc("Add a new Regex for ignoring files.")
			.addButton((button) => {
				button.setButtonText("Add Regex");
				button.setCta();
				button.onClick(() => {
					this.plugin.settings.fileIgnoreRegexen.push("//g");
					this.display(); // Re-render settings
				});
			});

		const files = this.app.vault.getFiles();

		// Create a setting for each option in the list
		this.plugin.settings.fileIgnoreRegexen.forEach((option, index) => {
			let textArea: TextAreaComponent;
			let text: TextComponent;
			let setting = new Setting(containerEl)
				.addText((t) => {
					text = t;
					text.setPlaceholder("/@#(/g")
						.setValue(option)
						.onChange(async (value) => {
							this.plugin.settings.fileIgnoreRegexen[index] =
								deserializeRegExp(value).toString();
							if (
								this.plugin.settings.fileIgnoreRegexen[index] ==
									"/(?:)/g" ||
								this.plugin.settings.fileIgnoreRegexen[index] ==
									"/(?:)/" ||
								this.plugin.settings.fileIgnoreRegexen[index] ==
									"/$^/g"
							) {
								text.setValue("//g");
							} else {
								text.setValue(
									this.plugin.settings.fileIgnoreRegexen[
										index
									],
								);
							}
							await this.plugin.saveSettings();
							this.updateIgnoredFiles(text.getValue(), textArea, files);
						});
				})
				.addTextArea((ta) => {
					textArea = ta;
					textArea.setDisabled(true);
					textArea.inputEl.style.minWidth = "39ch";
					this.updateIgnoredFiles(text.getValue(), textArea, files);
				})
				.addExtraButton((button) => {
					// Add a "Remove" button to delete this option
					button
						.setIcon("trash")
						.setTooltip("Remove this Regex")
						.onClick(async () => {
							// Remove the option from the list and refresh the settings UI
							this.plugin.settings.fileIgnoreRegexen.splice(
								index,
								1,
							);
							await this.plugin.saveSettings();
							this.display(); // Re-render settings
						});
				});
		});
	}
	updateIgnoredFiles(
		regex: string,
		textArea: TextAreaComponent,
		files: TFile[],
	) {
		let filesIgnored = "This regex ignores the following files:";
		files
			.filter((file) => {
				const reg = deserializeRegExp(regex);
				let test = reg.exec(file.path)?.toString();
				if (test != null) {
					return true;
				}
			})
			.forEach((file) => {
				filesIgnored += "\n" + file.path;
			});

		textArea.setValue(filesIgnored);
		this.autoResize(textArea.inputEl);
	}
	// Function to automatically resize the textarea based on its content
	autoResize(textAreaEl: HTMLTextAreaElement) {
		textAreaEl.style.height = "auto"; // Reset height
		textAreaEl.style.height = `${textAreaEl.scrollHeight}px`; // Set height to the scroll height
	}
}
