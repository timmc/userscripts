// ==UserScript==
// @name           OKCupid: Quickmatch Snitch
// @namespace      tag:brainonfire.net,2008-12-30:okcupid-quickmatch-snitch
// @description    Add a link to the user's profile at the top of the QuickMatch page, since OKCupid leaves out important information such as the user's first essay, and whether they smoke.
// @include        http://www.okcupid.com/quickmatch
// @version        0.1
// ==/UserScript==


/* From http://wiki.greasespot.net/Code_snippets */
function $xpath(p, context)
{
	if(!context)
		context = document;
	var i;
	var arr = [];
	var xpr = document.evaluate(p, context, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
	for(i = 0; item = xpr.snapshotItem(i); i++)
		arr.push(item);
	return arr;
}


var uname = $xpath('//form[@id="essays-form"]//input[@name="sn"]/@value')[0].nodeValue;

var profLink = document.createElement('a');
profLink.appendChild(document.createTextNode(uname));
profLink.setAttribute('href', '/profile/'+encodeURI(uname));

var QM_title_span = $xpath('//div[@id="main_content"]/h1[1]/span')[0];
QM_title_span.parentNode.insertBefore(profLink, QM_title_span.nextSibling);
QM_title_span.parentNode.insertBefore(document.createTextNode(' '), QM_title_span.nextSibling);
QM_title_span.textContent += ':';

