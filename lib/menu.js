module.exports = {
	items: [
		{
			label: 'View',
			submenu: [
				{
					label: 'Appcelerator Titanium',
					submenu: [
						{ label: 'Toggle Console', command: 'appc:console:toggle' },
						{ label: 'Open related view', command: 'appc:open-related-view' },
						{ label: 'Open related style', command: 'appc:open-related-style' },
						{ label: 'Open related controller', command: 'appc:open-related-controller' },
						{ label: 'Toggle related files', command: 'appc:open-or-close-related' }
					]
				}
			]
		},
		{
			label: 'Packages',
			submenu: [
				{
					label: 'Appcelerator Titanium',
					submenu: [
						{ label: 'Build', command: 'appc:build' },
						{ label: 'Add component...', command: 'appc:generate' }
					]
				}
			]
		}
	]
};
