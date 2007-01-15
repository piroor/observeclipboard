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
 * Portions created by the Initial Developer are Copyright (C) 2004-2005
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
	
var _elementIDs = [ 
	'type',
	'type_multiple',
	'loadInBackground',
	'loadInBackgroundWindow',
	'interval',
	'loadOnNewTab'
];

function controlLinkedItems(elem, aShouldEnable, aAttr)
{
	var target = elem.getAttribute(aAttr || 'linked').split(/ +/);
	var item;

	var disabled = (aShouldEnable !== void(0)) ? !aShouldEnable :
				(elem.localName == 'textbox' ? (!elem.value || !Number(elem.value)) : !elem.checked );

	for (var i in target)
	{
		item = document.getElementById(target[i]);
		if (!item) continue;

		if (disabled)
			item.setAttribute('disabled', true);
		else
			item.removeAttribute('disabled');
	}
}

function spinButtonsUpDown(aEvent, aTargetID, aMin, aMax)
{
	var eventNode = aEvent.target;
	while (eventNode.localName != 'spinbuttons')
		eventNode = eventNode.parentNode;

	var buttonNode = aEvent.originalTarget;
	while (buttonNode.localName != 'image')
		buttonNode = buttonNode.buttonNode;

	if (eventNode.getAttribute('disabled') == 'true' ||
		eventNode.disabled) return;


	var node = document.getElementById(aTargetID);
	var val = Number(node.value);
	if (isNaN(val)) val = 0;

	if (buttonNode.getAttribute('class') == 'up')
		val++;
	else if (buttonNode.getAttribute('class') == 'down')
		val--;

	if (
		(aMin !== void(0) && val < aMin) ||
		(aMax !== void(0) && val > aMax)
		)
		return;

	node.value = val;
}
 
// About 
const WindowManager = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
function opener()
{
	return WindowManager.getMostRecentWindow('navigator:browser');
}

function loadURI(uri)
{
	if (opener())
		opener().loadURI(uri);
	else
		window.open(uri);
}
 
// Uninstall 
var unreg = new exUnregisterer(
	'chrome://observeclipboard/content/contents.rdf',
	'jar:%chromeFolder%observeclipboard.jar!/locale/en-US/observeclipboard/contents.rdf',
	'jar:%chromeFolder%observeclipboard.jar!/locale/ja-JP/observeclipboard/contents.rdf'
);
var STRBUNDLE = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService);
var msg = STRBUNDLE.createBundle('chrome://observeclipboard/locale/observeclipboard.properties');


function Unregister()
{
	if (!confirm(msg.GetStringFromName('uninstall_confirm'))) return;

	if (!confirm(msg.GetStringFromName('uninstall_prefs_confirm')))
		window.unreg.removePrefs('observeclipboard');

	window.unreg.unregister();

	alert(
		msg.GetStringFromName('uninstall_removefile').replace(/%S/i,
			window.unreg.getFilePathFromURLSpec(
				(window.unreg.exists(window.unreg.UChrome+'observeclipboard.jar') ? window.unreg.UChrome+'observeclipboard.jar' : window.unreg.Chrome+'observeclipboard.jar' )
			)
		)
	);

	window.close();
}
  
