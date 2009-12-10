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
 
var ClipboardObserverService = { 
	XULNS : 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
	PREFROOT : 'extensions.{84BE9FF4-6D4F-4477-8E8A-86CF17F053BA}',
	
	init : function() 
	{
		window.removeEventListener('load', this, false);

		var module = {};
		Components.utils.import('resource://observeclipboard-modules/observeclipboard.js', module);
		this.__proto__ = module.ClipboardObserverService;

		window.setTimeout(
			function()
			{
				window.__observeclipboard__BrowserOpenTab = window.BrowserOpenTab;
				window.BrowserOpenTab = ClipboardObserverService.newBrowserOpenTab;
			},
			10
		);

		this.addPrefListener(this);
		this.onPrefChange('observeclipboard.type');

		window.addEventListener('unload', this, false);

		this.initialShow();
	},
	
	initialShow : function() 
	{
		// show custom buttons only in the initial startup
		var bar = document.getElementById('nav-bar');
		if (bar && bar.currentSet) {
			var STRBUNDLE = Components.classes['@mozilla.org/intl/stringbundle;1']
							.getService(Components.interfaces.nsIStringBundleService);
			var msg = STRBUNDLE.createBundle('chrome://observeclipboard/locale/observeclipboard.properties');

			var PromptService = Components.classes['@mozilla.org/embedcomp/prompt-service;1']
								.getService(Components.interfaces.nsIPromptService);

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
  
	destroy : function() 
	{
		window.removeEventListener('unload', this, false);
		this.removePrefListener(this);
	},
 
	handleEvent : function(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'load':
				this.init();
				return;
			case 'unload':
				this.destroy();
				return;
		}
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
		var count = ClipboardObserverService.getTabs(gBrowser).snapshotLength;

		window.__observeclipboard__BrowserOpenTab.apply(window, arguments);

		var tabs = ClipboardObserverService.getTabs(gBrowser);
		if (
			ClipboardObserverService.getPref('observeclipboard.loadOnNewTab') &&
			tabs.snapshotLength > count
			)
			window.setTimeout(function(aTab) {
				ClipboardObserverService.pasteAndGo(aTab);
			}, 0, tabs.snapshotItem(tabs.snapshotLength-1));
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
		var value = this.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'observeclipboard.type':
			case 'observeclipboard.interval':
				var broadcaster = document.getElementById('toggleObserveClipboard-broadcaster');
				if (broadcaster) {
					if (this.getPref('observeclipboard.type') > -1) {
						broadcaster.setAttribute('checked', true);
						broadcaster.setAttribute('tooltiptext', broadcaster.getAttribute('tooltiptext-checked'));
					}
					else {
						broadcaster.removeAttribute('checked');
						broadcaster.setAttribute('tooltiptext', broadcaster.getAttribute('tooltiptext-unchecked'));
					}
				}
				break;
		}
	}
  
}; 
  
window.addEventListener('load', ClipboardObserverService, false); 
 
