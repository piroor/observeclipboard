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
 * Portions created by the Initial Developer are Copyright (C) 2004-2009
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
	
	evalInSandbox : function(aCode, aOwner) 
	{
		try {
			var sandbox = new Components.utils.Sandbox(aOwner || 'about:blank');
			return Components.utils.evalInSandbox(aCode, sandbox);
		}
		catch(e) {
		}
		return void(0);
	},
 
	// properties 
	
	get schemer() 
	{
		return this._schemer;
	},
	set schemer(val)
	{
		this._schemer = val;

		this._schemers = this.schemer
			.replace(/([\(\)\+\.\{\}])/g, '\\$1')
			.replace(/\?/g, '.')
			.replace(/\*/g, '.+')
			.split(/[,\| \n\r\t]+/);
		this._schemerRegExp = null;

		this._kURIPattern = null;
		this._kURIPatternMultibyte = null;
		return val;
	},
	_schemer : '',
	get schemers()
	{
		return this._schemers.concat(this._fixupSchemers);
	},
	_schemers : [],
	_fixupSchemers : [],
 
	schemerFixupDefault : 'http', 
 
	get schemerFixupTable() 
	{
		return this._schemerFixupTable;
	},
	set schemerFixupTable(val)
	{
		this._schemerFixupTable = val;

		this._fixupTable = this._schemerFixupTable
					.replace(/(\s*[^:\s]+)\s*=>\s*([^:\s]+)(\s*([,\| \n\r\t]|$))/g, '$1:=>$2:$3');
		this._fixupTargets = this._fixupTable
					.replace(/\s*=>\s*[^,\| \n\r\t]+|\s*=>\s*[^,\| \n\r\t]+$/g, '')
					.replace(/([\(\)\+\.\{\}])/g, '\\$1')
					.replace(/\?/g, '.')
					.replace(/\*/g, '.+')
					.split(/\s*[,\| \n\r\t]+\s*/);
		this._fixupSchemers = this._fixupTargets
					.filter(function(aTarget) {
						return /:$/.test(aTarget);
					})
					.map(function(aTarget) {
						return aTarget.replace(/:$/, '');
					});
		this._fixupTargetsPattern = this._fixupTargets.join('|');
		this._fixupTargetsRegExp = new RegExp('^('+this._fixupTargetsPattern+')');

		this._schemerRegExp = null;

		this._kURIPattern = null;
		this._kURIPatternMultibyte = null;
		return val;
	},
	_schemerFixupTable : '',
 
	get shouldParseMultibyteCharacters() 
	{
		return this._shouldParseMultibyteCharacters;
	},
	set shouldParseMultibyteCharacters(val)
	{
		this._shouldParseMultibyteCharacters = val;
		this._schemerRegExp = null;
		this._URIMatchingRegExp = null;
		this._URIPartRegExp_start = null;
		this._URIPartRegExp_end = null;
		return val;
	},
	_shouldParseMultibyteCharacters : true,
 
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

		data = data.value.QueryInterface(Components.interfaces.nsISupportsString);
		str = data.data.substring(0, dataLength.value / 2);

		return str;
	},
  
	get isBrowserWindow() 
	{
		return (Components.lookupMethod(window, 'top').call(window).document.documentElement.getAttribute('windowtype') == 'navigator:browser');
	},
  
// string operations 
	
	// from http://taken.s101.xrea.com/blog/article.php?id=510
	convertFullWidthToHalfWidth : function(aString) 
	{
		return aString.replace(this.fullWidthRegExp, this.f2h)
					.replace(/\u301c/g, '~'); // another version of tilde
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
  
	// URI manipulation (from textlink) 
	
	get kURIPattern() 
	{
		if (!this._kURIPattern) {
			this._kURIPattern = this.kURIPattern_base
				.replace(
					/%SCHEMER_PATTERN%/g,
					'('+this.schemers.join('|')+'):'
				)
				.replace(
					/%PART_PATTERN%/g,
					this.kURIPattern_part
				)
				.replace(
					/%DOMAIN_PATTERN%/g,
					'[0-9a-z\\.-]+\\.('+this.kTopLevelDomains.join('|')+')\\b'
				);
		}

		return this._kURIPattern;
	},
	_kURIPattern : null,
 
	get kURIPatternMultibyte() 
	{
		if (!this._kURIPatternMultibyte) {
			this._kURIPatternMultibyte = this.kURIPatternMultibyte_base
				.replace(
					/%SCHEMER_PATTERN%/g,
					'('+
					this.schemers.map(function(aSchemer) {
						return aSchemer+'|'+this.convertHalfWidthToFullWidth(aSchemer);
					}, this).join('|')+
					')[:\uff1a]'
				)
				.replace(
					/%PART_PATTERN%/g,
					this.kURIPatternMultibyte_part
				)
				.replace(
					/%DOMAIN_PATTERN%/g,
					'[0-9a-z\\.-]+[\\.]('+this.kTopLevelDomains.join('|')+')\\b'
/*
					'[0-9a-z\\.-\uff10-\uff19\uff41-\uff5a\uff21-\uff3a\uff0e\uff0d]+[\\.\uff0e]('+
					this.kTopLevelDomains.join('|')+
					'|'+
					this.convertHalfWidthToFullWidth(this.kTopLevelDomains.join('|')).replace(/\uff5c/g, '|')+
					')'
*/
				);
		}

		return this._kURIPatternMultibyte;
	},
	_kURIPatternMultibyte : null,
 
	kURIPattern_base : '\\(?(%SCHEMER_PATTERN%(//)?%PART_PATTERN%|%DOMAIN_PATTERN%(/%PART_PATTERN%)?)', 
	kURIPatternMultibyte_base : '[\\(\uff08]?(%SCHEMER_PATTERN%(//|\uff0f\uff0f)?%PART_PATTERN%|%DOMAIN_PATTERN%([/\uff0f]%PART_PATTERN%)?)',

	kSchemerPattern : '[\\*\\+a-z0-9_]+:',
	kSchemerPatternMultibyte : '[\\*\\+a-z0-9_\uff41-\uff5a\uff21-\uff3a\uff10-\uff19\uff3f]+[:\uff1a]',

	kURIPattern_part : '[-_\\.!~*\'()a-z0-9;/?:@&=+$,%#]+',
	kURIPatternMultibyte_part : '[-_\\.!~*\'()a-z0-9;/?:@&=+$,%#\u301c\uff0d\uff3f\uff0e\uff01\uff5e\uffe3\uff0a\u2019\uff08\uff09\uff41-\uff5a\uff21-\uff3a\uff10-\uff19\uff1b\uff0f\uff1f\uff1a\uff20\uff06\uff1d\uff0b\uff04\uff0c\uff05\uff03]+',

	// http://www4.plala.or.jp/nomrax/TLD/
	// http://ja.wikipedia.org/wiki/%E3%83%88%E3%83%83%E3%83%97%E3%83%AC%E3%83%99%E3%83%AB%E3%83%89%E3%83%A1%E3%82%A4%E3%83%B3%E4%B8%80%E8%A6%A7
	kTopLevelDomains : [
		// gTLD
		'aero',
		'arpa',
		'asia',
		'biz',
		'cat',
		'com',
		'coop',
		'edu',
		'gov',
		'info',
		'int',
		'jobs',
		'mil',
		'mobi',
		'museum',
		'name',
		'nato',
		'net',
		'org',
		'pro',
		'tel',
		'travel',

		// ccTLD
		'ac',
		'ad',
		'ae',
		'af',
		'ag',
		'ai',
		'al',
		'am',
		'an',
		'ao',
		'aq',
		'ar',
		'as',
		'at',
		'au',
		'aw',
		'ax',
		'az',
		'ba',
		'bb',
		'bd',
		'be',
		'bf',
		'bg',
		'bh',
		'bi',
		'bj',
		'bm',
		'bn',
		'bo',
		'br',
		'bs',
		'bt',
		'bv',
		'bw',
		'by',
		'bz',
		'ca',
		'cc',
		'cd',
		'cf',
		'cg',
		'ch',
		'ci',
		'ck',
		'cl',
		'cm',
		'cn',
		'co',
		'cr',
		'cs',
		'cu',
		'cv',
		'cx',
		'cy',
		'cz',
		'dd',
		'de',
		'dj',
		'dk',
		'dm',
		'do',
		'dz',
		'ec',
		'ee',
		'eg',
		'eh',
		'er',
		'es',
		'et',
		'eu',
		'fi',
		'fj',
		'fk',
		'fm',
		'fo',
		'fr',
		'ga',
		'gb',
		'gd',
		'ge',
		'gf',
		'gg',
		'gh',
		'gi',
		'gl',
		'gm',
		'gn',
		'gp',
		'gq',
		'gr',
		'gs',
		'gt',
		'gu',
		'gw',
		'gy',
		'hk',
		'hm',
		'hn',
		'hr',
		'ht',
		'hu',
		'id',
		'ie',
		'il',
		'im',
		'in',
		'io',
		'iq',
		'ir',
		'is',
		'it',
		'je',
		'jm',
		'jo',
		'jp',
		'ke',
		'kg',
		'kh',
		'ki',
		'km',
		'kn',
		'kp',
		'kr',
		'kw',
		'ky',
		'kz',
		'la',
		'lb',
		'lc',
		'li',
		'lk',
		'lr',
		'ls',
		'lt',
		'lu',
		'lv',
		'ly',
		'ma',
		'mc',
		'md',
		'me',
		'mg',
		'mh',
		'mk',
		'ml',
		'mm',
		'mn',
		'mo',
		'mp',
		'mq',
		'mr',
		'ms',
		'mt',
		'mu',
		'mv',
		'mw',
		'mx',
		'my',
		'mz',
		'na',
		'nc',
		'ne',
		'nf',
		'ng',
		'ni',
		'nl',
		'no',
		'np',
		'nr',
		'nu',
		'nz',
		'om',
		'pa',
		'pe',
		'pf',
		'pg',
		'ph',
		'pk',
		'pl',
		'pm',
		'pn',
		'pr',
		'ps',
		'pt',
		'pw',
		'py',
		'qa',
		're',
		'ro',
		'rs',
		'ru',
		'rw',
		'sa',
		'sb',
		'sc',
		'sd',
		'se',
		'sg',
		'sh',
		'si',
		'sj',
		'sk',
		'sl',
		'sm',
		'sn',
		'so',
		'sr',
		'st',
		'su',
		'sv',
		'sy',
		'sz',
		'tc',
		'td',
		'tf',
		'tg',
		'th',
		'tj',
		'tk',
		'tl',
		'tm',
		'tn',
		'to',
		'tp',
		'tr',
		'tt',
		'tv',
		'tw',
		'tz',
		'ua',
		'ug',
		'uk',
		'um',
		'us',
		'uy',
		'uz',
		'va',
		'vc',
		've',
		'vg',
		'vi',
		'vn',
		'vu',
		'wf',
		'ws',
		'ye',
		'yt',
		'yu',
		'za',
		'zm',
		'zr',
		'zw'
	],
 
	matchURIRegExp : function(aString) 
	{
		this._updateURIRegExp();
		return aString.match(this._URIMatchingRegExp);
	},
	isHeadOfNewURI : function(aString)
	{
		this._updateURIRegExp();
		var match = aString.match(this._URIMatchingRegExp_fromHead);
		match = match ? match[1] : '' ;
		return this.hasLoadableSchemer(match) ? match == aString : false ;
	},
	_URIMatchingRegExp : null,
	_URIMatchingRegExp_fromHead : null,
	_updateURIRegExp : function()
	{
		if (this._URIMatchingRegExp) return;
		var regexp;
		if (this.shouldParseMultibyteCharacters) {
			this._URIMatchingRegExp_fromHead = new RegExp(this.kURIPatternMultibyte, 'i');
			regexp = this.kURIPatternMultibyte;
		}
		else {
			this._URIMatchingRegExp_fromHead = new RegExp(this.kURIPattern, 'i');
			regexp = this.kURIPattern;
		}
		this._URIMatchingRegExp = new RegExp(regexp, 'ig');
	},
 
	hasLoadableSchemer : function(aURI) 
	{
		if (!this._schemerRegExp) {
			var schemers = this.schemers;
			var colon = ':';
			if (this.shouldParseMultibyteCharacters) {
				schemers = schemers.map(function(aSchemer) {
						return aSchemer+'|'+this.convertHalfWidthToFullWidth(aSchemer);
					}, this);
				colon = '[:\uff1a]';
			}
			this._schemerRegExp = new RegExp('^('+this.schemers.join('|')+')'+colon, 'i');
		}
		return this._schemerRegExp.test(aURI);
	},
	_schemerRegExp : null,
 
	hasSchemer : function(aInput) 
	{
		return this._firstSchemerRegExp.test(aInput);
	},
	removeSchemer : function(aInput)
	{
		return aInput.replace(this._firstSchemerRegExp, '');
	},
	get _firstSchemerRegExp()
	{
		if (!this.__firstSchemerRegExp) {
			this.__firstSchemerRegExp = new RegExp('^'+this.kSchemerPatternMultibyte, 'i');
		}
		return this.__firstSchemerRegExp;
	},
	__firstSchemerRegExp : null,
 
	fixupURI : function(aURIComponent, aBaseURI) 
	{
		if (this.shouldParseMultibyteCharacters) {
			aURIComponent = this.convertFullWidthToHalfWidth(aURIComponent);
		}

		aURIComponent = this.sanitizeURIString(aURIComponent);
		if (!aURIComponent) {
			return null;
		}

		aURIComponent = this.fixupSchemer(aURIComponent);

		return this.hasLoadableSchemer(aURIComponent) ? aURIComponent : null ;
	},
	
	sanitizeURIString : function(aURIComponent) 
	{
		// escape patterns like program codes like JavaScript etc.
		if (!this._topLevelDomainsRegExp) {
			this._topLevelDomainsRegExp = new RegExp('^(' + this.kTopLevelDomains.join('|') + ')$');
		}
		if (this.shouldParseRelativePath) {
			if (
				(
					aURIComponent.match(/^([^\/\.]+\.)+([^\/\.]+)$/) &&
					!RegExp.$2.match(this._topLevelDomainsRegExp)
				) ||
				aURIComponent.match(/(\(\)|\([^\/]+\)|[;\.,])$/)
				)
				return '';
		}

		aURIComponent = this.removeParen(aURIComponent);

		while (
			aURIComponent.match(/^\((.*)$/) ||
			aURIComponent.match(/^([^\(]*)\)$/) ||
			aURIComponent.match(/^(.*)[\.,]$/) ||
			aURIComponent.match(/^([^\"]*)\"$/) ||
			aURIComponent.match(/^([^\']*)\'$/) ||
			aURIComponent.match(/^(.+)\s*\([^\)]+$/) ||
			aURIComponent.match(/^[^\(]+\)\s*(.+)$/) ||
			aURIComponent.match(/^[^\.\/:]*\((.+)\)[^\.\/]*$/) ||
			(
				!this.shouldParseRelativePath &&
				aURIComponent.match(/^[\.\/:](.+)$/)
			)
			) {
			aURIComponent = RegExp.$1;
		}

		aURIComponent = this.removeParen(aURIComponent);

		return aURIComponent; // aURIComponent.replace(/^.*\((.+)\).*$/, '$1');
	},
	_topLevelDomainsRegExp : null,
 
	removeParen : function(aInput) 
	{
		var doRemoveParen = function(aRegExp) {
				let match = aInput.match(aRegExp);
				if (!match) return false;
				aInput = match[1];
				return true;
			};
		while (this._parenPatterns.some(doRemoveParen)) {}
		return aInput;
	},
	_parenPatterns : [
		/^["\u201d\u201c\u301d\u301f](.+)["\u201d\u201c\u301d\u301f]$/,
		/^[`'\u2019\u2018](.+)[`'\u2019\u2018]$/,
		/^[(\uff08](.+)[)\uff09]$/,
		/^[{\uff5b](.+)[}\uff5d]$/,
		/^[\[\uff3b](.+)[\]\uff3d]$/,
		/^[<\uff1c](.+)[>\uff1e]$/,
		/^[\uff62\u300c](.+)[\uff63\u300d]$/,
		/^\u226a(.+)\u226b$/,
		/^\u3008(.+)\u3009$/,
		/^\u300a(.+)\u300b$/,
		/^\u300e(.+)\u300f$/,
		/^\u3010(.+)\u3011$/,
		/^\u3014(.+)\u3015$/,
		/^(.+)["\u201d\u201c\u301d\u301f][^"\u201d\u201c\u301d\u301f]*$/,
		/^(.+)[`'\u2019\u2018][^`'\u2019\u2018]*$/,
		/^(.+)[(\uff08][^)\uff09]*$/,
		/^(.+)[{\uff5b][^}\uff5d]*$/,
		/^(.+)[\[\uff3b][^\]\uff3d]*$/,
		/^(.+)[<\uff1c][^>\uff1e]*$/,
		/^(.+)[\uff62\u300c][^\uff63\u300d]*$/,
		/^(.+)\u226a[^\u226b$]*/,
		/^(.+)\u3008[^\u3009$]*/,
		/^(.+)\u300a[^\u300b$]*/,
		/^(.+)\u300e[^\u300f$]*/,
		/^(.+)\u3010[^\u3011$]*/,
		/^(.+)\u3014[^\u3015$]*/
	],
 
	fixupSchemer : function(aURI) 
	{
		var match = aURI.match(this._fixupTargetsRegExp);
		if (match) {
			var target = match[1];
			var table = this.evalInSandbox('(function() {'+
					'var table = '+this._fixupTable.quote()+';'+
					'var target = '+target.quote()+';'+
					((this._fixupTargetsPattern+'|')
						.replace(
							/([^|]+)\|/g,
							<![CDATA[
								if (/^$1$/.test(target))
									table = table.replace(/\b$1\s*=>/, target+"=>");
							]]>
						))+
					'return table;'+
				'})()');
			match = table.match(new RegExp(
					'(?:[,\\| \\n\\r\\t]|^)'+
					target.replace(/([\(\)\+\?\.\{\}])/g, '\\$1')
						.replace(/\?/g, '.')
						.replace(/\*/g, '.+')+
					'\\s*=>\\s*([^,\\| \\n\\r\\t]+)'
				));
			if (match)
				aURI = aURI.replace(target, match[1]);
		}
		else if (!this._firstSchemerRegExp.test(aURI)) {
			var schemer = this.schemerFixupDefault;
			if (schemer)
				aURI = schemer+'://'+aURI;
		}

		return aURI;
	},
	_fixupTable : null,
	_fixupTargets : null,
	_fixupTargetsPattern : null,
	_fixupTargetsRegExp : null,
   
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

		this.addPrefListener(this);
		this.onPrefChange();
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
 
	observes : function(aSubject, aTopic, aData) 
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
	},
 
	observe : function(aSubject, aTopic, aData) 
	{
		if (aTopic == 'nsPref:changed')
			this.onPrefChange(aData);
	},
	
	domains : [ 
		'observeclipboard.'
	],
 
	onPrefChange : function(aPrefName) 
	{
		switch (aPrefName)
		{
			case 'observeclipboard.schemer':
				this.schemer = value;
				return;

			case 'observeclipboard.schemer.fixup.table':
				this.schemerFixupTable = value;
				return;

			case 'observeclipboard.schemer.fixup.default':
				this.schemerFixupDefault = value;
				return;

			case 'observeclipboard.multibyte.enabled':
				this.shouldParseMultibyteCharacters = value;
				return;

			case 'observeclipboard.type':
			case 'observeclipboard.interval':
try{
				var broadcaster = document.getElementById('toggleObserveClipboard-broadcaster');
				if (this.getPref('observeclipboard.type') > -1) {
					if (broadcaster) {
						if (broadcaster.getAttribute('checked') != true)
							window.gClipboardObserverLastContent.shouldIgnoreFirst = true;
						broadcaster.setAttribute('checked', true);
						broadcaster.setAttribute('tooltiptext', broadcaster.getAttribute('tooltiptext-checked'));
					}

					if (this.timer) return;

					var interval = this.getPref('observeclipboard.interval');
					if (interval < 1) interval = 1;
					this.timer = window.setInterval(this.observes, interval);
				}
				else {
					if (broadcaster) {
						broadcaster.removeAttribute('checked');
						broadcaster.setAttribute('tooltiptext', broadcaster.getAttribute('tooltiptext-unchecked'));
					}

					if (this.timer) {
						window.clearInterval(this.timer);
						this.timer = null;
					}
				}
}
catch(e){
}
				break;
		}
	}
   
}; 
ClipboardObserverService.__proto__ = window['piro.sakura.ne.jp'].prefs;
 
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
 
