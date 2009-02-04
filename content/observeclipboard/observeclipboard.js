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
 * Portions created by the Initial Developer are Copyright (C) 2004-2008
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
  
	// URI manipulation (from textlink) 
	
	get kURIPattern() 
	{
		if (!this._kURIPattern)
			this._kURIPattern = this.kURIPattern_base.replace(
					/%PART_PATTERN%/g,
					this.kURIPattern_part
				).replace(
					/%DOMAIN_PATTERN%/g,
					'[0-9a-z\\.-]+\\.('+this.kTopLevelDomains.join('|')+')\\b'
				);

		return this._kURIPattern;
	},
	_kURIPattern : null,
 
	get kURIPatternMultibyte() 
	{
		if (!this._kURIPatternMultibyte)
			this._kURIPatternMultibyte = this.kURIPatternMultibyte_base.replace(
					/%PART_PATTERN%/g,
					this.kURIPatternMultibyte_part
				).replace(
					/%DOMAIN_PATTERN%/g,
					'[0-9a-z\\.-]+[\\.\uff0e]('+this.kTopLevelDomains.join('|')+')\\b'
/*
					'[0-9a-z\\.-\uff10-\uff19\uff41-\uff5a\uff21-\uff3a\uff0e\uff0d]+[\\.\uff0e]('+
					this.kTopLevelDomains.join('|')+
					'|'+
					this.convertHalfWidthToFullWidth(this.kTopLevelDomains.join('|')).replace(/\uff5c/g, '|')+
					')'
*/
				);

		return this._kURIPatternMultibyte;
	},
	_kURIPatternMultibyte : null,
 
	kURIPattern_base : '\\(?([\\*\\+\\w]+:(//)?%PART_PATTERN%|%DOMAIN_PATTERN%(/%PART_PATTERN%)?)', 
	kURIPatternMultibyte_base : '[\\(\uff08]?([\\*\\+a-z0-9_\uff41-\uff5a\uff21-\uff3a\uff10-\uff19\uff3f]+[:\uff1a](//|\uff0f\uff0f)?%PART_PATTERN%|%DOMAIN_PATTERN%([/\uff0f]%PART_PATTERN%)?)',

	kURIPattern_part : '[-_\\.!~*\'()a-z0-9;/?:@&=+$,%#]+',
	kURIPatternMultibyte_part : '[-_\\.!~*\'()a-z0-9;/?:@&=+$,%#\uff0d\uff3f\uff0e\uff01\uff5e\uffe3\uff0a\u2019\uff08\uff09\uff41-\uff5a\uff21-\uff3a\uff10-\uff19\uff1b\uff0f\uff1f\uff1a\uff20\uff06\uff1d\uff0b\uff04\uff0c\uff05\uff03]+',

	kOnebyteArray : '-_.!~~*\'()acdefghijklmnopqrstuvwxyzACDEFGHIJKLMNOPQRSTUVWXYZ0123456789;/?:@&=+$,%#',
	kMultibyteArray : '\uff0d\uff3f\uff0e\uff01\uffe3\uff5e\uff0a\u2019\uff08\uff09\uff41\uff43\uff44\uff45\uff46\uff47\uff48\uff49\uff4a\uff4b\uff4c\uff4d\uff4e\uff4f\uff50\uff51\uff52\uff53\uff54\uff55\uff56\uff57\uff58\uff59\uff5a\uff21\uff23\uff24\uff25\uff26\uff27\uff28\uff29\uff2a\uff2b\uff2c\uff2d\uff2e\uff2f\uff30\uff31\uff32\uff33\uff34\uff35\uff36\uff37\uff38\uff39\uff3a\uff10\uff11\uff12\uff13\uff14\uff15\uff16\uff17\uff18\uff19\uff1b\uff0f\uff1f\uff1a\uff20\uff06\uff1d\uff0b\uff04\uff0c\uff05\uff03',

	// see http://www4.plala.or.jp/nomrax/TLD/
	kTopLevelDomains : [
		// iTLD , gTLD
		'arpa', 'int', 'nato', 'com', 'net', 'org', 'info', 'biz', 'name', 'pro', 'museum', 'coop', 'aero', 'edu', 'gov', 'mil',

		// ccTLD
		'ac', 'ad', 'ae', 'af', 'ag', 'ai', 'al', 'am', 'an', 'ao', 'aq', 'ar', 'as', 'at', 'au', 'aw', 'ax', 'az',
		'ba', 'bb', 'bd', 'be', 'bf', 'bg', 'bh', 'bi', 'bj', 'bm', 'bn', 'bo', 'br', 'bs', 'bt', 'bu', 'bv', 'bw', 'by', 'bz',
		'ca', 'cc', 'cd', 'cf', 'cg', 'ch', 'ci', 'ck', 'cl', 'cm', 'cn', 'co', 'cp', 'cr', 'cs', 'sk', 'cu', 'cv', 'cx', 'cy', 'cz',
		'dd', 'de', 'dg', 'dj', 'dk', 'dm', 'do', 'dz',
		'ea', 'ec', 'ee', 'eg', 'eh', 'er', 'es', 'et',
		'fi', 'fj', 'fk', 'fm', 'fo', 'fr', 'fx',
		'ga', 'gb', 'gd', 'ge', 'gf', 'gg', 'gh', 'gi', 'gl', 'gm', 'gn', 'gp', 'gq', 'gr', 'gs', 'gt', 'gu', 'gw', 'gy',
		'hk', 'hm', 'hn', 'hr', 'ht', 'hu',
		'ic', 'id', 'ie', 'il', 'im', 'in', 'io', 'iq', 'ir', 'is', 'it',
		'je', 'jm', 'jo', 'jp',
		'ke', 'kg', 'kh', 'ki', 'km', 'kn', 'kp', 'kr', 'kw', 'ky', 'kz',
		'la', 'lb', 'lc', 'li', 'lk', 'lr', 'ls', 'lt', 'lu', 'lv', 'ly',
		'ma', 'mc', 'md', 'mg', 'mh', 'mk', 'ml', 'mm', 'mn', 'mo', 'mp', 'mq', 'mr', 'ms', 'mt', 'mu', 'mv', 'mw', 'mx', 'my', 'mz',
		'na', 'nc', 'ne', 'nf', 'ng', 'ni', 'nl', 'no', 'np', 'nr', 'nt', 'nu', 'nz',
		'om',
		'pa', 'pc', 'pe', 'pf', 'pg', 'ph', 'pk', 'pl', 'pm', 'pn', 'pr', 'ps', 'pt', 'pw', 'py', 'qa',
		're', 'ro', 'ru', 'rw',
		'sa', 'sb', 'sc', 'sd', 'se', 'sg', 'sh', 'si', 'sj', 'sk', 'sl', 'sm', 'sn', 'so', 'sr', 'st', 'su', 'sv', 'sy', 'sz',
		'ta', 'tc', 'td', 'tf', 'tg', 'th', 'tj', 'tk', 'tm', 'tn', 'to', 'tp', 'tr', 'tt', 'tv', 'tw', 'tz',
		'ua', 'ug', 'uk', 'um', 'us', 'uy', 'uz',
		'va', 'vc', 've', 'vg', 'vi', 'vn', 'vu',
		'wf', 'wg', 'ws',
		'yd', 'ye', 'yt', 'yu',
		'za', 'zm', 'zr', 'zw'
	],
 
	// from http://taken.s101.xrea.com/blog/article.php?id=510
	convertFullWidthToHalfWidth : function(aString) 
	{
		return aString.replace(this.fullWidthRegExp, this.f2h);
	},
	fullWidthRegExp : /[\uFF01\uFF02\uFF03\uFF04\uFF05\uFF06\uFF07\uFF08\uFF09\uFF0A\uFF0B\uFF0C\uFF0D\uFF0E\uFF0F\uFF10\uFF11\uFF12\uFF13\uFF14\uFF15\uFF16\uFF17\uFF18\uFF19\uFF1A\uFF1B\uFF1C\uFF1D\uFF1E\uFF1F\uFF20\uFF21\uFF22\uFF23\uFF24\uFF25\uFF26\uFF27\uFF28\uFF29\uFF2A\uFF2B\uFF2C\uFF2D\uFF2E\uFF2F\uFF30\uFF31\uFF32\uFF33\uFF34\uFF35\uFF36\uFF37\uFF38\uFF39\uFF3A\uFF3B\uFF3C\uFF3D\uFF3E\uFF3F\uFF40\uFF41\uFF42\uFF43\uFF44\uFF45\uFF46\uFF47\uFF48\uFF49\uFF4A\uFF4B\uFF4C\uFF4D\uFF4E\uFF4F\uFF50\uFF51\uFF52\uFF53\uFF54\uFF55\uFF56\uFF57\uFF58\uFF59\uFF5A\uFF5B\uFF5C\uFF5D\uFF5E]/g,
	f2h : function() {
		var str = arguments[0];
		var code = str.charCodeAt(0);
		code &= 0x007F;
		code += 0x0020;
		return String.fromCharCode(code);
	},

	convertHalfWidthToFullWidth : function(aString)
	{
		return aString.replace(this.halfWidthRegExp, this.h2f);
	},
	halfWidthRegExp : /[!"#$%&'\(\)\*\+,-\.\/0123456789:;<=>\?@ABCDEFGHIJKLMNOPQRSTUVWXYZ\[\\\]\^_`abcdefghijklmnopqrstuvwxyz\{\|\}~]/g,
	h2f : function() {
		var str = arguments[0];
		var code = str.charCodeAt(0);
		code += 0xFF00;
		code -= 0x0020;
		return String.fromCharCode(code);
	},
 
	matchURIRegExp : function(aString) 
	{
		var regexp = [];
		if (this.getPref('observeclipboard.multibyte.enabled')) {
			regexp.push(this.kURIPatternMultibyte);
		}
		else {
			regexp.push(this.kURIPattern);
		}
		return aString.match(new RegExp(regexp.join('|'), 'ig'));
	},
 
	fixupURI : function(aURIComponent) 
	{
		if (this.getPref('observeclipboard.multibyte.enabled')) {
			aURIComponent = this.convertFullWidthToHalfWidth(aURIComponent);
		}

		aURIComponent = this.sanitizeURIString(aURIComponent);
		if (!aURIComponent) return null;

		aURIComponent = this.fixupSchemer(aURIComponent);

		var regexp = new RegExp();
		if (
			regexp.compile(
				'('+
				this.getPref('observeclipboard.schemer')
						.replace(/([\(\)\+\.\{\}])/g, '\\$1')
						.replace(/\?/g, '.')
						.replace(/\*/g, '.+')
						.replace(/[,\| \n\r\t]+/g, '|')+
				')'
			).test(
				aURIComponent.substr(0, aURIComponent.indexOf(':')).toLowerCase()
			)
			)
			return aURIComponent;

		return null;
	},
	 
	sanitizeURIString : function(aURIComponent) 
	{
		while (
			aURIComponent.match(/^\((.*)$/) ||
			aURIComponent.match(/^([^\(]*)\)$/) ||
			aURIComponent.match(/^(.*)[\.,]$/) ||
			aURIComponent.match(/^([^\"]*)\"$/) ||
			aURIComponent.match(/^([^\']*)\'$/) ||
			aURIComponent.match(/^(.+)\s*\([^\)]+$/) ||
			aURIComponent.match(/^[^\(]+\)\s*(.+)$/) ||
			aURIComponent.match(/^[^\.\/:]*\((.+)\)[^\.\/]*$/)
			)
			aURIComponent = RegExp.$1;

		return aURIComponent; // aURIComponent.replace(/^.*\((.+)\).*$/, '$1');
	},
 
	fixupSchemer : function(aURI) 
	{
		var table = this.getPref('observeclipboard.schemer.fixup.table')
						.replace(/(\s*[^:\s]+)\s*=>\s*([^:\s]+)(\s*([,\| \n\r\t]|$))/g, '$1:=>$2:$3');
		var regexp = new RegExp();

		var targets = table.replace(/\s*=>\s*[^,\| \n\r\t]+|\s*=>\s*[^,\| \n\r\t]+$/g, '')
						.replace(/([\(\)\+\.\{\}])/g, '\\$1')
						.replace(/\?/g, '.')
						.replace(/\*/g, '.+')
						.replace(/\s*[,\| \n\r\t]+\s*/g, '|');

		if (aURI.match(regexp.compile('^('+targets+')', 'g'))) {
			var target = RegExp.$1;
			eval((targets+'|')
					.replace(/([^|]+)\|/g,
						'if (/^$1$/.test("'+target+'")) table = table.replace(/\\b$1\\s*=>/, "'+target+'=>");'
				));

			if (table.match(
					regexp.compile(
						'([,\\| \\n\\r\\t]|^)'+
						target.replace(/([\(\)\+\?\.\{\}])/g, '\\$1')
							.replace(/\?/g, '.')
							.replace(/\*/g, '.+')+
						'\\s*=>\\s*([^,\\| \\n\\r\\t]+)'
					)
				))
				aURI = aURI.replace(target, RegExp.$2);
		}
		else if (!/^\w+:/.test(aURI)) {
			var schemer = this.getPref('observeclipboard.schemer.fixup.default');
			if (schemer)
				aURI = schemer+'://'+aURI;
		}

		return aURI;
	},
   
	getURIsFromClipboard : function() 
	{
		var res = [];
		var done = {};
		try {
			var str = this.getClipboardContent();
			if (!str) return res;

			// is the string an URI?
			var uris = this.matchURIRegExp(str);
			if (!uris.length) return res;

			var uri;
			for (var i in uris)
			{
				uri = this.fixupURI(uris[i]);
				if (uri && !(uri in done)) {
					res.push(uri);
					done[uri] = true;
				}
			}
		}
		catch(e) {
		}
		return res;
	},
 
	getURIFromClipboard : function() 
	{
		var uris = this.getURIsFromClipboard();
		return uris.length ? uris[0] : null ;
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
					null,
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


		if (
			uris.length > 1 &&
			('BookmarksCommand' in window &&
			'_confirmOpenTabs' in BookmarksCommand) ? // Firefox 2.0
				!BookmarksCommand._confirmOpenTabs(uris.length) :
			('PlacesController' in window) ? // Firefox 3
				!PlacesController.prototype._confirmOpenTabs(uris.length) :
				false
			)
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
		var count = this.getTabs(gBrowser).snapshotLength;

		window.__observeclipboard__BrowserOpenTab();

		if (
			ClipboardObserverService.getPref('observeclipboard.loadOnNewTab') &&
			this.getTabs(gBrowser).snapshotLength > count
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

			var tabs = this.getTabs(gBrowser);
			var t = tabs.snapshotItem(tabs.snapshotLength-1);
			gBrowser.getBrowserForTab(t).loadURI(clipboardURI);

			gURLBar.value = clipboardURI;
		}
		catch(e) {
		}
	},
  
	getTabs : function(aTabBrowser) 
	{
		return aTabBrowser.ownerDocument.evaluate(
				'descendant::*[local-name()="tab"]',
				aTabBrowser.mTabContainer,
				null,
				XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
				null
			);
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
 
