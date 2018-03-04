/** @babel */
/** @jsx etch.dom */

import { CompositeDisposable } from 'atom';
import { platform } from 'os';
import { remote } from 'electron';
import etch from 'etch';
import Appc from '../appc';
import Project from '../project';
import Button from './button';
import Select from './select';
import Hud from './hud';
import Utils from '../utils';

etch.setScheduler(atom.views);

/**
 * Toolbar
 */
export default class Toolbar {

	constructor(configDialog) {
		this.targets = {};
		this.targetOptions = [ { value: '', text: '', disabled: true } ];
		this.state = {
			buildCommand: (Project.isTitaniumApp) ?  'run' : 'build',
			buildCommandName: (Project.isTitaniumApp) ? 'Run' : 'Build',
			platform: (platform() === 'darwin') ? 'ios' : 'android',
			platformName: (platform() === 'darwin') ? 'iOS' : 'Android',
			selectedTarget: {},
			target: null,
			targetName: null,
			disableUI: true,
			buildInProgress: false,
			showingCodeSigning: (platform() === 'darwin' && this.state.platform === 'ios'),
			showingCustom: false,
			customArgs: '',
			iOSCodeSigning: {
				certificate: null,
				provisioningProfile: null
			},
			androidKeystore: {
				path: atom.config.get('appcelerator-titanium.android.keystorePath'),
				alias: atom.config.get('appcelerator-titanium.android.keystoreAlias'),
				password: '',
				privateKeyPassword: ''
			}
		};

		this.configDialog = configDialog;

		this.subscriptions = new CompositeDisposable();
		this.subscriptions.add(
			atom.config.observe('appcelerator-titanium.android.keystorePath', value => {
				this.state.androidKeystore.path = value;
				this.update();
			}),
			atom.config.observe('appcelerator-titanium.android.keystoreAlias', value => {
				this.state.androidKeystore.alias = value;
				this.update();
			})
		);

		etch.initialize(this);

		atom.workspace.addHeaderPanel({ item: this.element });
	}

	/**
	 * Clean up
	 */
	async destroy() {
		this.subscriptions.dispose();
		await etch.destroy(this);
	}

	/**
	 * Current state virtual DOM element
	 *
	 * @returns {Object}
	 */
	render() {
		let buildButtonIcon = 'playback-play';
		switch (this.state.buildCommand) {
			case 'run':
				buildButtonIcon = 'playback-play';
				break;
			case 'dist-adhoc':
				buildButtonIcon = 'rocket';
				break;
			case 'dist-appstore':
				buildButtonIcon = 'package';
				break;
			case 'custom':
				buildButtonIcon = 'code';
				break;
			default:
				break;
		}

		let buildOptions = [];
		if (Project.isTitaniumApp) {
			switch (this.state.platform) {
				case 'ios':
					buildOptions = [
						<option value="run">Run</option>,
						<option value="dist-adhoc">Ad-Hoc</option>,
						<option value="dist-appstore">App Store</option>,
						<option value="custom">Custom</option>
					];
					break;
				case 'android':
					buildOptions = [
						<option value="run">Run</option>,
						<option value="dist-appstore">Play Store</option>,
						<option value="custom">Custom</option>
					];
					break;
				case 'windows':
					buildOptions = [
						<option value="run">Run</option>,
						<option value="custom">Custom</option>
					];
					break;
			}
		} else if (Project.isTitaniumModule) {
			buildOptions = [
				<option value="build">Build</option>
			];
		}

		let platformOptions = [];
		let platforms = Utils.platforms();

		if (Project.isTitaniumModule) {
			platforms = platforms.filter(platform => Project.platforms().includes(platform));
		}
		for (let i = 0, numPlatforms = platforms.length; i < numPlatforms; i++) {
			platformOptions.push(<option value={platforms[i]}>{Utils.nameForPlatform(platforms[i])}</option>);
		}

		let expandedToolbarRow = '';
		if (this.state.showingCodeSigning) {
			this.populateiOSCertificates();
			this.populateiOSProvisioningProfiles();
			expandedToolbarRow = (
				<div className="toolbar-row">
					<div className="toolbar-center">
						<div className="toolbar-item-title icon icon-organization" />
						<Select ref="iOSCertificateSelect" attributes={{ style: 'width:200px;' }} value={this.state.iOSCodeSigning.certificate} change={this.iOSCertificateSelectValueDidChange.bind(this)}>
							{this.iOSCertificates.map(certificate =>
								<option value={certificate.name}>{certificate.name}</option>
							)}
						</Select>
						<div className="toolbar-item-title icon icon-file" />
						<Select ref="iOSProvisioningProfileSelect" attributes={{ style: 'width:200px;' }} value={this.state.iOSCodeSigning.provisioningProfile} change={this.iOSProvisioningProfileSelectValueDidChange.bind(this)}>
							{this.iOSProvisioningProfiles.map(profile =>
								<option value={profile.uuid} disabled={profile.disabled}>{profile.name}</option>
							)}
						</Select>
					</div>
				</div>
			);
		}

		let buildButtons;
		if (this.state.buildInProgress) {
			buildButtons = (
				<div className="toolbar-item button build-button-container">
					<Button ref="buildButton" className="build-button stop" custom="true" icon="primitive-square" disabled={this.state.disableUI} click={this.stopButtonClicked.bind(this)} />
				</div>
			);
		} else {
			buildButtons = (
				<div className="toolbar-item button build-button-container">
					<Button ref="buildButton" className="build-button" custom="true" icon={buildButtonIcon} disabled={this.state.disableUI} click={this.buildButtonClicked.bind(this)} />
					<Button ref="buildButton" className="build-button" custom="true" icon="bug" disabled={this.state.disableUI} click={this.debugButtonClicked.bind(this)} />
					<Button ref="buildButton" className="build-button fast-build" custom="true" icon="light-bulb" disabled={this.state.disableUI || platform() === 'darwin'} click={this.fastBuildButtonClicked.bind(this)} />
				</div>
			);
		}

		return (
			<div className={this.state.showingCodeSigning ? 'appc-toolbar toolbar-expanded' : 'appc-toolbar'}>
				<div className="toolbar-row">

					<div className="toolbar-left main-toolbar-group">
						{buildButtons}

						<Select ref="buildSelect" class="build-select" value={this.state.buildCommand} disabled={this.state.disableUI}
							change={this.buildSelectValueDidChange.bind(this)}>
							{buildOptions}
						</Select>

						<Select ref="platformSelect" attributes={{ style: 'width:90px;' }} disabled={this.state.disableUI || this.state.buildCommand === 'custom'} change={this.platformSelectValueDidChange.bind(this)}>
							{platformOptions}
						</Select>

						<Select ref="targetSelect" attributes={{ style: 'width:150px;' }} disabled={this.state.disableUI} value={this.state.selectedTarget[this.state.platform]} change={this.targetSelectValueDidChange.bind(this)}>
							{this.targetOptions.map(target =>
								<option value={target.value} disabled={target.disabled}>{target.text}</option>
							)}
						</Select>
					</div>

					<Hud ref="hud" />

					<div className="toolbar-right main-toolbar-group">
						<Button icon="plus" className="button-right" flat="true" disabled={this.state.disableUI || !Project.isTitaniumApp} click={this.generateButtonClicked.bind(this)} />
						<Button icon="three-bars" className="button-right" flat="true" click={this.toggleConsoleButtonClicked.bind(this)} />
						<Button icon="gear" className="button-right" flat="true" click={this.showConfig.bind(this)} />
					</div>

				</div>

				{expandedToolbarRow}

			</div>
		);
	}

	/**
	 * Update component
	 *
	 * @param {Object} opts 	state
	 * @returns {Promise}
	 */
	update(opts) {
		opts && Object.assign(this.state, opts);
		return etch.update(this);
	}

	/**
	 * Read DOM after update
	 */
	readAfterUpdate() {
		this.getState();
	}

	/**
	 * HUD element
	 *
	 * @returns {Object}
	 */
	get hud() {
		return this.refs.hud;
	}

	/**
	 * Get current state
	 *
	 * @returns {Object}
	 */
	getState() {
		const buildCommand = this.refs.buildSelect.selectedOption;
		const platform = this.refs.platformSelect.selectedOption;
		const target = this.refs.targetSelect.selectedOption;

		let targetType = platform.value === 'ios' ? 'simulator' : 'emulator';
		if (this.targets.devices && target.index < this.targets.devices.length + 1) {
			targetType = 'device';
		}

		if (platform.value === 'windows') {
			if (target.value === 'ws-local') {
				targetType = 'ws-local';
			} else {
				targetType = `wp-${targetType}`;
			}
		}

		Object.assign(this.state, {
			buildCommand: buildCommand.value,
			buildCommandName: buildCommand.text,
			platform: platform.value,
			platformName: platform.text,
			target: target.value,
			targetName: target.text,
			targetType
		});

		if (this.refs.iOSCertificateSelect) {
			this.state.iOSCodeSigning = {
				certificate: this.refs.iOSCertificateSelect.selectedOption.value,
				provisioningProfile: this.refs.iOSProvisioningProfileSelect.selectedOption.value || '-'
			};
		}

		if (this.refs.androidKeystorePath) {
			this.state.androidKeystore = {
				path: this.refs.androidKeystorePath.value,
				alias: this.refs.androidKeystoreAlias.value,
				password: this.refs.androidKeystorePassword.value,
				privateKeyPassword: this.refs.androidKeystorePrivateKeyPassword.value
			};
			atom.config.set('appcelerator-titanium.android.keystorePath', this.state.androidKeystore.path);
			atom.config.set('appcelerator-titanium.android.keystoreAlias', this.state.androidKeystore.alias);
		}

		if (this.refs.customArgs) {
			this.state.customArgs = this.refs.customArgs.value;
		}

		return this.state;
	}

	/**
	 * Populate iOS targets
	 */
	populateiOSTargets() {
		this.targets = Appc.iOSTargets();
		this.targetOptions = [];
		this.targetOptions.push({ value: '', text: 'Devices', disabled: true });
		if (this.targets.devices.length === 0) {
			this.targetOptions.push({ value: '', text: 'No Device Targets', disabled: true });
		} else {
			for (const target of this.targets.devices) {
				if (target.uuid === 'itunes') {
					continue;
				}
				this.targetOptions.push({ value: target.udid, text: target.name });
				if (!this.state.selectedTarget.ios) {
					this.state.selectedTarget.ios = target.udid;
				}
			}
			if (this.targets.devices.length === 1 && this.targets.devices[0].udid === 'itunes') {
				this.targetOptions.push({ value: '', text: 'No Connected Devices', disabled: true });
			}
		}
		let sdkVersions = Object.keys(this.targets.simulators);
		sdkVersions.sort((a, b) => a < b);
		for (let i = 0, numSdkVersions = sdkVersions.length; i < numSdkVersions; i++) {
			const sdkVersion = sdkVersions[i];
			this.targetOptions.push({ value: '', text: ' ', disabled: true });
			this.targetOptions.push({ value: '', text: 'iOS ' + sdkVersion + ' Simulators', disabled: true });
			for (const simulator of this.targets.simulators[sdkVersion]) {
				const name = simulator.name + ' (' + simulator.version + ')';
				this.targetOptions.push({ value: simulator.udid, text: name });
				if (!this.state.selectedTarget.ios) {
					this.state.selectedTarget.ios = simulator.udid;
				}
			}
		}
		this.targetOptions.push({ value: '', text: '', disabled: true });
		this.targetOptions.push({ value: '', text: '──────────────────', disabled: true });
		this.targetOptions.push({ value: 'refresh', text: 'Refresh Targets' });

		etch.update(this);
	}

	/**
	 * Populate Android targets
	 */
	populateAndroidTargets() {
		this.targets = Appc.androidTargets();
		this.targetOptions = [];
		this.targetOptions.push({ value: '', text: 'Devices', disabled: true });
		if (this.targets.devices.length === 0) {
			this.targetOptions.push({ value: '', text: 'No Connected Devices', disabled: true });
		} else {
			for (const target of this.targets.devices) {
				this.targetOptions.push({ value: target.id, text: target.name });
				if (!this.state.selectedTarget.android) {
					this.state.selectedTarget.android = target.id;
				}
			}
		}
		for (const type in this.targets.emulators) {
			this.targetOptions.push({ value: '', text: ' ', disabled: true });
			this.targetOptions.push({ value: '', text: type, disabled: true });
			for (const emulator of this.targets.emulators[type]) {
				const emulatorSdkVersion = emulator['sdk-version'] || 'SDK not installed';
				const name = `${emulator.name} (${emulatorSdkVersion})`;
				this.targetOptions.push({ value: emulator.id, text: name });
				if (!this.state.selectedTarget.android) {
					this.state.selectedTarget.android = emulator.id;
				}
			}
			if (this.targets.emulators[type].length === 0) {
				this.targetOptions.push({ value: '', text: `No ${type} Emulators`, disabled: true });
			}
		}

		this.targetOptions.push({ value: '', text: '', disabled: true });
		this.targetOptions.push({ value: '', text: '──────────────────', disabled: true });
		this.targetOptions.push({ value: 'refresh', text: 'Refresh Targets' });

		etch.update(this);
	}

	/**
	 * Populate Windows targets
	 */
	populateWindowsTargets() {
		this.targets = Appc.windowsTargets();
		this.targetOptions = [];

		this.targetOptions.push({ value: '', text: 'Devices', disabled: true });
		if (this.targets.devices.length === 0) {
			this.targetOptions.push({ value: '', text: 'No Device Targets', disabled: true });
		} else {
			for (const target of this.targets.devices) {
				this.targetOptions.push({ value: target.udid, text: target.name });
			}
		}
		this.targetOptions.push({ value: 'ws-local', text: 'Local Machine' });
		for (const sdkVersion in this.targets.emulators) {
			this.targetOptions.push({ value: '', text: ' ', disabled: true });
			this.targetOptions.push({ value: '', text: 'Windows ' + sdkVersion + ' Emulators', disabled: true });
			for (const emulator of this.targets.emulators[sdkVersion]) {
				const name = emulator.name + ' (' + emulator.version + ')';
				this.targetOptions.push({ value: emulator.udid, text: name });
				if (!this.state.selectedTarget.windows) {
					this.state.selectedTarget.windows = emulator.udid;
				}
			}
		}
		this.targetOptions.push({ value: '', text: '', disabled: true });
		this.targetOptions.push({ value: '', text: '──────────', disabled: true });
		this.targetOptions.push({ value: 'refresh', text: 'Refresh Targets' });

		etch.update(this);
	}

	/**
	 * Populate iOS certificates
	 */
	populateiOSCertificates() {
		this.iOSCertificates = Appc.iosCertificates(this.state.buildCommand === 'run' ? 'developer' : 'distribution');
		this.iOSCertificates.sort(function (a, b) {
			return a.name > b.name;
		});
	}

	/**
	 * Populate iOS provisioining profiles
	 */
	populateiOSProvisioningProfiles() {
		let certificate = this.iOSCertificates[0];
		if (this.state.iOSCodeSigning.certificate) {
			certificate = this.iOSCertificates.find(cert => cert.name === this.state.iOSCodeSigning.certificate);
		}

		let deployment = 'development';
		if (this.state.buildCommand === 'dist-adhoc') {
			deployment = 'distribution';
		} else if (this.state.buildCommand === 'dist-appstore') {
			deployment = 'appstore';
		}
		this.iOSProvisioningProfiles = Appc.iosProvisioningProfiles(deployment, certificate, Project.appId());

		// check selected provisioning profile is still valid
		if (this.state.iOSCodeSigning.provisioningProfile && this.state.iOSCodeSigning.provisioningProfile !== '-') {
			const provisioningProfile = this.iOSProvisioningProfiles.find(profile => profile.uuid === this.state.iOSCodeSigning.provisioningProfile);
			if (provisioningProfile && provisioningProfile.disabled) {
				this.state.iOSCodeSigning.provisioningProfile = '-';
			}
		}
		this.iOSProvisioningProfiles.sort(function (a, b) {
			var nameA = a.name.toLowerCase();
			var nameB = b.name.toLowerCase();
			if (nameA < nameB) {
				return -1;
			} else if (nameA > nameB) {
				return 1;
			}
			return 0;
		});
	}

	/**
	 * Build button clicked
	 */
	buildButtonClicked() {
		atom.commands.dispatch(atom.views.getView(atom.workspace), (this.state.buildInProgress) ? 'appc:stop' : 'appc:build');
	}

	fastBuildButtonClicked() {
		atom.commands.dispatch(atom.views.getView(atom.workspace), (this.state.buildInProgress) ? 'appc:stop' : 'appc:fast-build');
	}

	debugButtonClicked() {
		atom.commands.dispatch(atom.views.getView(atom.workspace), (this.state.buildInProgress) ? 'appc:stop' : 'appc:debug');
	}

	stopButtonClicked() {
		atom.commands.dispatch(atom.views.getView(atom.workspace), 'appc:stop');
	}

	/**
	 * Build select value changed
	 */
	buildSelectValueDidChange() {
		this.getState();
		etch.update(this);
	}

	/**
	 * Platform select value changed
	 */
	platformSelectValueDidChange() {
		this.getState();
		switch (this.state.platform) {
			case 'ios':
				this.populateiOSTargets();
				break;
			case 'android':
				if (this.state.buildCommand === 'dist-adhoc') {
					this.refs.buildSelect.update({ value: 'dist-appstore' });
					this.getState();
				}
				this.populateAndroidTargets();
				break;
			case 'windows':
				this.populateWindowsTargets();
				break;
		}
		etch.update(this);
	}

	/**
	 * Target select value changed
	 *
	 * @param {Object} event 	change event object
	 */
	targetSelectValueDidChange(event) {
		if (event.target.value === 'refresh') {
			this.targets = [];
			this.targetOptions = [ { value: '', text: '', disabled: true } ];
			this.update({ disableUI: true });
			this.hud.display({
				text: 'Refreshing Targets...',
				spinner: true
			});
			Appc.getInfo(() => {
				switch (this.state.platform) {
					case 'ios':
						this.populateiOSTargets();
						break;
					case 'android':
						this.populateAndroidTargets();
						break;
					case 'windows':
						this.populateWindowsTargets();
						break;
				}
				this.hud.displayDefault();
				this.getState();
				this.update({ disableUI: false });
			});
		} else {
			this.getState();
			this.state.selectedTarget[this.state.platform] = this.state.target;
			etch.update(this);
		}
	}

	/**
	 * iOS certificate select value changed
	 */
	iOSCertificateSelectValueDidChange() {
		this.getState();
		this.populateiOSProvisioningProfiles();
		etch.update(this);
	}

	/**
	 * iOS provisioning profile select changed
	 */
	iOSProvisioningProfileSelectValueDidChange() {
		this.getState();
	}

	/**
	 * Android keystore button clicked
	 */
	androidKeystoreButtonClicked() {
		const filePaths = remote.dialog.showOpenDialog({ properties: [ 'openFile', 'showHiddenFiles' ] });
		if (filePaths && filePaths[0].length > 0) {
			this.state.androidKeystore.path = filePaths[0];
		}
		etch.update(this);
	}

	/**
	 * Android keystore changed
	 */
	androidKeystoreDidChange() {
		this.getState();
		etch.update(this);
	}

	/**
	 * Custom args changed
	 */
	customArgsDidChange() {
		this.getState();
		etch.update(this);
	}

	/**
	 * Generate button clicked
	 */
	generateButtonClicked() {
		atom.commands.dispatch(atom.views.getView(atom.workspace), 'appc:generate');
	}

	/**
	 * Console button clicked
	 */
	toggleConsoleButtonClicked() {
		atom.commands.dispatch(atom.views.getView(atom.workspace), 'appc:console:toggle');
	}

	showConfig() {
		let config;
		this.configDialog.setCloseAction(() => {
			config.destroy();
		});
		config = atom.workspace.addModalPanel({ item: this.configDialog });
	}
}
