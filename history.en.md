# History

 - master/HEAD
   * Improved: Open new multiple tabs in a tree if [Tree Style Tab](http://piro.sakura.ne.jp/xul/_treestyletab.html.en) is installed.
   * Modified: "jar" archive is no longer included.
   * Many tiny fixes. See the [commit log](https://github.com/piroor/observeclipboard/commits/master) for more information.
 - 1.4.2009110201
   * Works on Minefield and Firefox 3.6.
   * Improved: URI detection is updated based on codes of [Text Link](http://piro.sakura.ne.jp/xul/textlink/index.html.en) Ver.3.1.2009110201.
 - 1.3.2008052701
   * Improved: URI strings without schemer part, domain names, URIs with broken schemer can be recognized. ([Text Link](http://piro.sakura.ne.jp/xul/textlink/index.html.en) compatible)
   * Improved: When multiple URIs are loaded, duplicated URIs are ignored.
   * Fixed: Initial dialog to confirm adding the toolbar button is shown correctly in Mac OS X.
 - 1.2.2008042801
   * Fixed: Errors on showing preferences dialog disappeared.
 - 1.2.2008040701
   * Works on Firefox 3 beta5.
 - 1.2.2006100801
   * Fixed: Initial startup problem (toolbar is not initialized) is solved.
 - 1.2.20061007
   * Improved: Warning for too many tabs to be opened is supported in Firefox 2.0.
 - 1.2.20060113
   * Fixed: Empty navigation-bar doesn't show initializing dialog anymore.
 - 1.2.20051105
   * Improved: On the first startup, this extension inserts its toolbar button to the navigation toolbar automatically.
   * Fixed: "Uninstall" button is hidden for Firefox.
   * Improved: This extension shows confirming dialog on the first startup.
   * Improved: Tooltip text of the button wlll change as its state.
 - 1.2.20050321
   * Improved: The toolbar button for firefox, to toggle the operation observing clipboard, is available.
   * Improved: URI strings in the copied text aren't loaded if the text is copied while observing is disabled or Firefox doesn't run.
   * Improved: Identifier icon for Extensions Manager is available.
   * 3 new entries, from "toggleObserveClipboard.title" to "toggleObserveClipboard.tooltip" are added into "observeclipboard.dtd".
 - 1.1.20050209
   * Improved: Multiple URIs can be operated now.
   * Improved: New tabs opened from multiple URIs are grouped by TBE.
 - 1.0.20041105
   * Fixed: Service is initialized and destroyed correctly.
 - 1.0.20040613
   * Fixed: Copied URIs have been loaded into new tab correctly.
 - 1.0.20040328
   * Released.
