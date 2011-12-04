// ==UserScript==
// @name           Google Maps Fullscreen
// @namespace      tag:brainonfire.net,2009-11-22:gmaps-fullscreen
// @description    Expand the Google Maps map view to fill the entire page (for better screenshots, etc.) You'll have to collapse the left panel yourself, though! Also, I recommend fullscreening the browser (F11) *after* launching this script. Note that the script is to be launched using the Greasemonkey menu.
// @include        http://maps.google.com/*
// @version        0.2
// @changelog      Since 0.1: Fix regex for removing class name, actually toggle isFullscreen.
// ==/UserScript==


/* From http://wiki.greasespot.net/Code_snippets */
function $xpath(p, context)
{
	if(!context)
		context = document;
	var i, arr = [], xpr = document.evaluate(p, context, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
	for(i = 0; item = xpr.snapshotItem(i); i++)
		arr.push(item);
	return arr;
}


var map = document.getElementById('map');
if(!map) {
	return;
}

var encloser = document.getElementById('main_map');
if(!encloser) {
	return;
}

GM_addStyle(<><![CDATA[
	#main_map.fullscreen #map {
		position: fixed !important;
		top: 0 !important;
		bottom: 0 !important;
		left: 0 !important;
		right: 0 !important;
		height: 100% !important;
	}
]]></>.toString());

var isFullscreen = false;

/*
function ensurePanelHidden() {
	var hider = $xpath('//*[@title="Hide panel"]');
	if(hider.length !== 0) {
		return;
	}
	hider = hider[0];
	var evt = document.createEvent("MouseEvents");
	evt.initMouseEvent("click", true, true, unsafeWindow, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
	hider.dispatchEvent(evt);
}
*/

function toggleFullscreen() {
/*	ensurePanelHidden();*/
	
	if(isFullscreen) {
		encloser.className = encloser.className.replace(/(^| )fullscreen($| )/, ' ');
		isFullscreen = false;
	} else {
		encloser.className += ' fullscreen';
		isFullscreen = true;
	}
}

GM_registerMenuCommand("Toggle fullscreen", toggleFullscreen);