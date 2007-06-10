/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Clipboard Observer.
 *
 * The Initial Developer of the Original Code is SHIMODA Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2004-2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): SHIMODA Hiroshi <piro@p.club.ne.jp>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
 
var gClipboardObserverLastURI; 
var gClipboardObserverLastContent;
 
var ClipboardObserverService = { 

	activated : false,

	timer : null,

	XULNS : 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
	PREFROOT : 'extensions.{84BE9FF4-6D4F-4477-8E8A-86CF17F053BA}',

	knsISupportsString : ('nsISupportsWString' in Components.interfaces) ? Components.interfaces.nsISupportsWString : Components.interfaces.nsISupportsString,
	
	// properties 
	
	get IOService() 
	{
		if (!this._IOService) {
			this._IOService = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
		}
		return this._IOService;
	},
	_IOService : null,
 
	get WindowManager() 
	{
		if (!this._WindowManager) {
			this._WindowManager = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
		}
		return this._WindowManager;
	},
	_WindowManager : null,
	
	get browserWindowsWithZOrder() 
	{
		var browserWindows = [];

		var targets = this.WindowManager.getZOrderDOMWindowEnumerator('navigator:browser', true),
			target;
		while (targets.hasMoreElements())
		{
			target = targets.getNext().QueryInterface(Components.interfaces.nsIDOMWindowInternal);
			browserWindows.push(target);
		}

		return browserWindows;
	},
  
	get Clipboard() 
	{
		if (!this._Clipboard) {
			this._Clipboard = Components.classes['@mozilla.org/widget/clipboard;1'].getService(Components.interfaces.nsIClipboard);
		}
		return this._Clipboard;
	},
	_Clipboard : null,
	
	getURIFromClipboard : function() 
	{
		var uris = this.getURIsFromClipboard();
		return uris.length ? uris[0] : null ;
	},
	getURIsFromClipboard : function()
	{
		var res = [];
		try {
			var str = this.getClipboardContent();
			if (!str) return res;

			// is the string an URI?
			var uris = str.match(/([-+a-z0-9.]+:\/\/|[-a-z0-9]+(\.[-a-z0-9]+)+)[-_.!~*'()a-z0-9;\/?:\@&=+\$,%#]+/gi);
			if (!uris.length) return res;

			for (var i in uris)
			{
				if (uris[i].constructor == 'Array')
					uris[i] = uris[i][0];
				else if (typeof uris[i] != 'string')
					uris[i] = String(uris[i]);

				if (uris[i].match(/^(\w+:\/\/|urn:|www[0-9]*\.)/)/* ||
					uris[i].match(/[-a-z0-9.]\.(com|org|net|edu|gov|mil|(co|or|ne|ed|ac|ad|go|mi)\.[a-z]{2})/i)*/)
					res.push(uris[i]
							.replace(/^(www[0-9]*\.)/, 'http://$1')
							.replace(/^(ftp\.)/, 'http://$1')
							.replace(/^h?t?t?p:\/\//, 'http://')
							.replace(/^h?t?t?ps:\/\//, 'https://'));
			}
		}
		catch(e) {
		}
		return res;
	},
	getClipboardContent : function()
	{
		var str = '';

		// get string from clipboard
		var trans = Components.classes['@mozilla.org/widget/transferable;1'].createInstance(Components.interfaces.nsITransferable);
		trans.addDataFlavor('text/unicode');
		try {
			this.Clipboard.getData(trans, this.Clipboard.kSelectionClipboard);
		}
		catch(ex) {
			this.Clipboard.getData(trans, this.Clipboard.kGlobalClipboard);
		}

		var data       = {},
			dataLength = {};
		trans.getTransferData('text/unicode', data, dataLength);

		if (!data) return str;

		data = data.value.QueryInterface(this.knsISupportsString);
		str = data.data.substring(0, dataLength.value / 2);

		return str;
	},
  
	get Prefs() 
	{
		if (!this._Prefs) {
			this._Prefs = Components.classes['@mozilla.org/preferences;1'].getService(Components.interfaces.nsIPrefBranch);
		}
		return this._Prefs;
	},
	_Prefs : null,
	
	getPref : function(aPrefstring) 
	{
		try {
			switch (this.Prefs.getPrefType(aPrefstring))
			{
				case this.Prefs.PREF_STRING:
					return this.Prefs.getComplexValue(aPrefstring, this.knsISupportsString).data;
					break;
				case this.Prefs.PREF_INT:
					return this.Prefs.getIntPref(aPrefstring);
					break;
				default:
					return this.Prefs.getBoolPref(aPrefstring);
					break;
			}
		}
		catch(e) {
		}

		return null;
	},
 
	setPref : function(aPrefstring, aNewValue, aPrefObj) 
	{
		var pref = aPrefObj || this.Prefs ;
		var type;
		try {
			type = typeof aNewValue;
		}
		catch(e) {
			type = null;
		}

		switch (type)
		{
			case 'string':
				var string = ('@mozilla.org/supports-wstring;1' in Components.classes) ?
						Components.classes['@mozilla.org/supports-wstring;1'].createInstance(this.knsISupportsString) :
						Components.classes['@mozilla.org/supports-string;1'].createInstance(this.knsISupportsString) ;
				string.data = aNewValue;
				pref.setComplexValue(aPrefstring, this.knsISupportsString, string);
				break;
			case 'number':
				pref.setIntPref(aPrefstring, parseInt(aNewValue));
				break;
			default:
				pref.setBoolPref(aPrefstring, aNewValue);
				break;
		}
		return true;
	},
 
	addPrefListener : function(aObserver) 
	{
		var domains = ('domains' in aObserver) ? aObserver.domains : [aObserver.domain] ;
		try {
			var pbi = this.Prefs.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
			for (var i = 0; i < domains.length; i++)
				pbi.addObserver(domains[i], aObserver, false);
		}
		catch(e) {
		}
	},
 
	removePrefListener : function(aObserver) 
	{
		var domains = ('domains' in aObserver) ? aObserver.domains : [aObserver.domain] ;
		try {
			var pbi = this.Prefs.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
			for (var i = 0; i < domains.length; i++)
				pbi.removeObserver(domains[i], aObserver, false);
		}
		catch(e) {
		}
	},
  
	get isBrowserWindow() 
	{
		return (Components.lookupMethod(window, 'top').call(window).document.documentElement.getAttribute('windowtype') == 'navigator:browser');
	},
  
	init : function() 
	{
		if (this.activated) return;
		this.activated = true;

		this.loadDefaultPrefs();

		if (!this.isBrowserWindow) return;


		this.initialShow();


		var targets = this.WindowManager.getEnumerator(null, true),
			target;
		while (targets.hasMoreElements())
		{
			target = targets.getNext().QueryInterface(Components.interfaces.nsIDOMWindowInternal);
			if (!target.gClipboardObserverLastURI) continue;

			window.gClipboardObserverLastURI = target.gClipboardObserverLastURI;
			window.gClipboardObserverLastContent = target.gClipboardObserverLastContent;
			break;
		}
		if (!window.gClipboardObserverLastURI) {
			window.gClipboardObserverLastURI = {
				value        : this.getPref('observeclipboard.lastURI') || ''
			};
			window.gClipboardObserverLastContent = {
				value             : '',
				shouldIgnoreFirst : (this.getClipboardContent() ? true : false ),
				observingNow      : false
			};
		}

		window.setTimeout(
			function()
			{
				window.__observeclipboard__BrowserOpenTab = window.BrowserOpenTab;
				window.BrowserOpenTab = ClipboardObserverService.newBrowserOpenTab;
			},
			10
		);

		this.addPrefListener(gClipboardObserverPrefListener);
		gClipboardObserverPrefListener.observe(null, 'nsPref:changed', null);
	},
	initialShow : function()
	{
		// show custom buttons only in the initial startup
		var bar = document.getElementById('nav-bar');
		if (bar && bar.currentSet) {
			var STRBUNDLE = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService);
			var msg = STRBUNDLE.createBundle('chrome://observeclipboard/locale/observeclipboard.properties');

			var PromptService = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService);

			var currentset = bar.currentSet;
			var buttons = currentset.replace(/__empty/, '').split(',');
			var initial = [
					'toggleObserveClipboard-button'
				];
			for (var i in initial)
			{
				if (!this.getPref(this.PREFROOT+'.initialshow.'+initial[i])) {
					if (currentset.indexOf(initial[i]) < 0)
						buttons.push(initial[i]);
					this.setPref(this.PREFROOT+'.initialshow.'+initial[i], true);
				}
			}
			currentset = bar.currentSet.replace(/__empty/, '');
			var newset = buttons.join(',');
			if (currentset != newset &&
				PromptService.confirmEx(
					window,
					msg.GetStringFromName('initialshow_confirm_title'),
					msg.GetStringFromName('initialshow_confirm_text'),
					(PromptService.BUTTON_TITLE_YES * PromptService.BUTTON_POS_0) +
					(PromptService.BUTTON_TITLE_NO  * PromptService.BUTTON_POS_1),
					null, null, null, null, {}
				) == 0) {
				bar.currentSet = newset;
				bar.setAttribute('currentset', newset);
				document.persist(bar.id, 'currentset');
			}
			if ('BrowserToolboxCustomizeDone' in window)
				window.setTimeout('BrowserToolboxCustomizeDone(true);', 0);
		}
	},
	
	loadDefaultPrefs : function() 
	{
		if (this.getPref('observeclipboard.default')) return;

		const DEFPrefs = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefService).getDefaultBranch(null);
		var nullPointer;

		function pref(aPrefstring, aValue) {
			ClipboardObserverService.setPref(aPrefstring, aValue, DEFPrefs);
			nullPointer = ClipboardObserverService.getPref(aPrefstring);
		}

		eval(this.readFromURI('chrome://observeclipboard/content/default.js'));
	},
	
	readFromURI : function(aURI) 
	{
		try {
			var uri = this.IOService.newURI(aURI, null, null);

			var channel = this.IOService.newChannelFromURI(uri);
			var stream  = channel.open();

			var scriptableStream = Components.classes['@mozilla.org/scriptableinputstream;1'].createInstance(Components.interfaces.nsIScriptableInputStream);
			scriptableStream.init(stream);

			var fileContents = scriptableStream.read(scriptableStream.available());

			scriptableStream.close();
			stream.close();

			return fileContents;
		}
		catch(e) {
		}

		return null;
	},
   
	destruct : function() 
	{
		if (!this.activated) return;
		this.activated = false;

		if (!this.isBrowserWindow) return;

		this.removePrefListener(gClipboardObserverPrefListener);

		if (this.timer) {
			window.clearInterval(this.timer);
			this.timer = null;
		}

		if (window.gClipboardObserverLastURI.value)
			this.setPref('observeclipboard.lastURI', String(window.gClipboardObserverLastURI.value));
	},
 
	observes : function() 
	{
//try {
//dump('OBSERVES\n');
		if (window.gClipboardObserverLastContent.observingNow) return;

		window.gClipboardObserverLastContent.observingNow = true;


		var sv = ClipboardObserverService;
		var clipboardContent = sv.getClipboardContent();
		if (window.gClipboardObserverLastContent.shouldIgnoreFirst) {
			window.gClipboardObserverLastContent.shouldIgnoreFirst = false;
			window.gClipboardObserverLastContent.observingNow = false;
		}
		if (window.gClipboardObserverLastContent.value == clipboardContent)
			window.gClipboardObserverLastContent.observingNow = false;

		window.gClipboardObserverLastContent.value = clipboardContent;
		if (!window.gClipboardObserverLastContent.observingNow)
			return;


		// if the window is not top-level browser window, don't open tab
		var w = sv.browserWindowsWithZOrder;
		if (!w || !w.length || window != w[0]) {
			window.gClipboardObserverLastContent.observingNow = false;
//dump('OBSERVES:: NO WINDOW\n');
			return;
		}

		var uris = sv.getURIsFromClipboard();
		if (
			!uris.length ||
			window.gClipboardObserverLastURI.value.indexOf(uris.join('|')) > -1
			) {
//dump('OBSERVES:: NO URI\n');
			window.gClipboardObserverLastContent.observingNow = false;
			return;
		}


		if (uris.length > 1 &&
			sv.getPref('observeclipboard.multiple.type') == 0)
			uris = [uris[0]];


		var openInFlag = sv.getPref(uris.length == 1 ? 'observeclipboard.type' : 'observeclipboard.multiple.type' );
		if (openInFlag < 0) {
//dump('OBSERVES:: NO REACTION\n');
			window.gClipboardObserverLastContent.observingNow = false;
			return;
		}


		var b = gBrowser;
		var i;

		if (uris.length == 1) {
			var browsers = b.browsers;
			for (i = 0; i < browsers.length; i++)
				if (browsers[i].currentURI && browsers[i].currentURI.spec == uris[0]) {
//dump('OBSERVES:: ALREADY LOADED\n');
					window.gClipboardObserverLastContent.observingNow = false;
					return;
				}
		}


		window.gClipboardObserverLastURI.value = uris.join('|');


		var firstTab;
		var tab;


		// Firefox 2.0
		if (uris.length > 1 &&
			'_confirmOpenTabs' in BookmarksCommand &&
			!BookmarksCommand._confirmOpenTabs(uris.length))
			return;


		for (i in uris)
		{
			if (
				(
					('isReallyBlank' in b.selectedTab) ? b.selectedTab.isReallyBlank :
						(b.currentURI && b.currentURI.spec == 'about:blank')
				)
				) {
				b.loadURI(uris[i]);
				if (!firstTab) firstTab = b.selectedTab;
			}
			else {
				switch (openInFlag)
				{
					case 0: // current tab
						b.loadURI(uris[i]);
						break;

					case 1: // new tab
						tab = b.addTab(uris[i]);
						if (b.tabGroupsAvailable && firstTab) // for TBE
							tab.parentTab = firstTab;
						break;

					case 2: // new window
						window.open(uris[i]);
						break;


					default:
						break;
				}
				if (openInFlag == 1 && !firstTab) firstTab = tab;
			}
		}

		switch (openInFlag)
		{
			case 0:
				if (!sv.getPref('observeclipboard.loadInBackgroundWindow'))
					window.focus();
				break;

			case 1: // new tab
				if (firstTab &&
					!sv.getPref('observeclipboard.loadInBackground')) {
					b.selectedTab = firstTab;
					if ('scrollTabbarTo' in b) b.scrollTabbarTo(firstTab);
					if ('setFocusInternal' in b) b.setFocusInternal();
				}
				if (!sv.getPref('observeclipboard.loadInBackgroundWindow'))
					window.focus();
				break;

			case 2: // new window
				break;


			default:
				break;
		}

//dump('OBSERVES:: LOAD!\n');
		window.gClipboardObserverLastContent.observingNow = false;
//}
//catch(e) {
//	dump(e+'\n');
//}
	},
 
	toggleObserveClipboard : function() 
	{
		if (this.getPref('observeclipboard.type') < 0) {
			if (this.getPref('observeclipboard.type.ui') < 0)
				this.setPref('observeclipboard.type.ui', 1);
			this.setPref('observeclipboard.type', this.getPref('observeclipboard.type.ui'));
		}
		else {
			this.setPref('observeclipboard.type.ui', this.getPref('observeclipboard.type'));
			this.setPref('observeclipboard.type', -1);
		}
	},
 
	newBrowserOpenTab : function() 
	{
		var tabs = gBrowser.mTabContainer.childNodes.length;

		window.__observeclipboard__BrowserOpenTab();

		if (
			ClipboardObserverService.getPref('observeclipboard.loadOnNewTab') &&
			gBrowser.mTabContainer.childNodes.length > tabs
			)
			window.setTimeout('ClipboardObserverService.onNewTab();', 0);
	},
	
	onNewTab : function() 
	{
		try {
			var clipboardURI = this.getURIFromClipboard();
			if (!clipboardURI) return;

			var exists = false;

			var browsers = gBrowser.browsers;
			for (var i = 0; i < browsers.length; i++)
				if (
					(
					'mTab' in browsers[i] ? browsers[i].mTab.mTabInfo.loadingURI :
					browsers[i].currentURI ? browsers[i].currentURI.spec :
					'about:blank'
					) == clipboardURI
					)
					return;

			var t = gBrowser.mTabContainer.childNodes[gBrowser.mTabContainer.childNodes.length-1];
			gBrowser.getBrowserForTab(t).loadURI(clipboardURI);

			gURLBar.value = clipboardURI;
		}
		catch(e) {
		}
	}
   
}; 
 
var gClipboardObserverPrefListener = 
{
	domains : [
		'observeclipboard.type',
		'observeclipboard.interval'
	],
	observe : function(aSubject, aTopic, aPrefName)
	{
		if (aTopic != 'nsPref:changed') return;
try{
		var sv = ClipboardObserverService;
		var broadcaster = document.getElementById('toggleObserveClipboard-broadcaster');

		if (sv.getPref('observeclipboard.type') > -1) {
			if (broadcaster) {
				if (broadcaster.getAttribute('checked') != true)
					window.gClipboardObserverLastContent.shouldIgnoreFirst = true;
				broadcaster.setAttribute('checked', true);
				broadcaster.setAttribute('tooltiptext', broadcaster.getAttribute('tooltiptext-checked'));
			}

			if (sv.timer) return;

			var interval = sv.getPref('observeclipboard.interval');
			if (interval < 1) interval = 1;
			sv.timer = window.setInterval(sv.observes, interval);
		}
		else {
			if (broadcaster) {
				broadcaster.removeAttribute('checked');
				broadcaster.setAttribute('tooltiptext', broadcaster.getAttribute('tooltiptext-unchecked'));
			}

			if (sv.timer) {
				window.clearInterval(sv.timer);
				sv.timer = null;
			}
		}

}
catch(e){
}
	}
};
 
window.addEventListener('unload', function() 
{
	if (!ClipboardObserverService.activated) return;

	ClipboardObserverService.destruct();
},
false);
window.addEventListener('unload', function()
{
	if (!ClipboardObserverService.activated) return;

	ClipboardObserverService.destruct();
},
false);

window.addEventListener('load', function()
{
	if (ClipboardObserverService.activated) return;

	ClipboardObserverService.init();
},
false);
window.addEventListener('load', function()
{
	if (ClipboardObserverService.activated) return;

	ClipboardObserverService.init();
},
false);
 
