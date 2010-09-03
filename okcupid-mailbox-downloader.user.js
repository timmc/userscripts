// ==UserScript==
// @name           OKCupid mailbox downloader
// @namespace      tag:brainonfire.net,2008-07-05:okcupid-mailbox-downloader
// @description    Download your OKCupid inbox or outbox 
// @include        http://*.okcupid.com/mailbox
// @include        http://*.okcupid.com/mailbox?folder=*
// @version        0.1
// ==/UserScript==

/*
 * Restrict URLs for security and sanity
 */
 
re_host_onOKC = /(^|\.)okcupid.com$/;
re_pathPlus_inMailboxFolder = /^\/mailbox(\?folder=[0-9+])?$/;

//restrict to subdomains of OKC (or main domain)
if(!re_host_onOKC.test(location.hostname))
	return;

//only folder querystrings are OK beyond "/mailbox"
if(!re_pathPlus_inMailboxFolder.test(location.pathname + location.search))
	return;

/*
 * Library stuff
 */

/*LIB: From http://wiki.greasespot.net/Code_snippets */
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

/*LIB: Ceate a unique ID for this element */
function getUniqueID(prefix)
{
	var prefix = prefix ? prefix+'_' : '';
	return prefix+btoa(Math.random()).replace(/[^a-z0-9]/gi, '');
}


//Constants

var INBOX_FOLDER = 1;
var OUTBOX_FOLDER = 2;

// DOM cache

var downloadTrigger = undefined;

var infobox = undefined; // class = inprogress|success|failure
var ID_infobox = getUniqueID('infobox');

var statusTextNode = undefined; // text node
var ID_statusTextParent = getUniqueID('statusTextParent');

var dataOutputArea = undefined; // textarea for XML output
var ID_dataOutputArea = getUniqueID('dataOutputArea');

//Data

var allMessages = []; // each message looks like {ID, date, fromUserName, toUserName, subject, body}

//State info

var folderIDs = [INBOX_FOLDER, OUTBOX_FOLDER];
var folderDex = 0;
var pages = undefined;
var curPage = 0;

// Main functions

/**
 * Update the status text.
 */
function updateStatus(msg)
{
	statusTextNode.nodeValue = msg;
}

/**
 * Show a failure message and throw an exception.
 */
function fail(msg, extra)
{
	updateStatus(msg);
	infobox.className = 'failure';
	
	if(extra)
		msg += '\n\nExtra info: '+extra;		
	throw new Exception(msg);
}

/**
 * Return a more human-readable version of the XHR response.
 */
function getPrintableResponse(resp)
{
	return resp.status + ': ' + resp.statusText + '\n'
		resp.responseHeaders + '\n\n' + resp.responseText;
}

/**
 * Fail on an async request.
 */
function requestFail(resp)
{
	alert('fail');
	fail('Failed to retrieve a page of results.', 'The server returned the following:\n\n' + getPrintableResponse(resp));
}

/**
 * Issue a call for the next page.
 */
function getOnePage()
{
	updateStatus('Requesting page '+curPage+' in folder #'+folderDex);
	
	GM_xmlhttpRequest(
	{
		method: 'GET',
		url: '/mailbox?folder='+folderIDs[folderDex]+'&next='+curPage,
		onload: readOnePage,
		onerror: requestFail
	});
}

/**
 * Interpret the page, increment the counter, and call for another page.
 */
function readOnePage(resp)
{
	alert('succeed');
	GM_log('success: ' + getPrintableResponse(resp));
	updateStatus('Processing page '+curPage+' in folder #'+folderDex);
	
	var data = resp.responseText;
	
	if(data.indexOf('readMessage') === -1)
	{
		folderDex++;
		if(folderDex === folderIDs.length)
		{
			finishDownloadSequence();
			return;
		}

		curPage = 0;
		getOnePage();
		return;
	}
	
	curPage++;
	getOnePage();
}

/**
 * 
 */
function readOneMessage(msgID)
{

}


/**
 * Pop a lightbox-type info window onto the page.
 */
function createInfobox()
{
	infobox = document.createElement('div');
	infobox.setAttribute('id', ID_infobox);
	infobox.setAttribute('class', 'inprogress');
	GM_addStyle(
		'div#'+ID_infobox+' \
		{ \
			min-height: 5em; \
			min-width: 15em; \
			height: 50%; \
			width: 50%; \
			position: fixed; \
			top: '+window.innerHeight/4+'px; \
			left: '+window.innerWidth/4+'px; \
			padding: 4px; \
			border: 1px solid black; \
			background: white; \
			overflow: auto;\
		} \
		\
		div#'+ID_infobox+'.failure { color: #800; } \
		div#'+ID_infobox+'.inprogress { color: #860; } \
		div#'+ID_infobox+'.success { color: #080; } \
		'
	);
	
	statusTextParent = document.createElement('p');
	statusTextParent.setAttribute('id', ID_statusTextParent);
	statusTextNode = document.createTextNode('Initializing');
	statusTextParent.appendChild(statusTextNode);
	infobox.appendChild(statusTextParent);

	dataOutputArea = document.createElement('textarea');
	dataOutputArea.setAttribute('id', ID_dataOutputArea);
	GM_addStyle(
		'textarea#'+ID_dataOutputArea+' \
		{ \
			width: 95%;\
			min-height: 10em;\
			overflow: scroll;\
		} \
		'
	);
	infobox.appendChild(dataOutputArea);

	document.body.appendChild(infobox);
	
	updateStatus('Processing request');
}

/**
 * Determine how many pages
 */
function analyzeRequest()
{
	updateStatus('Analyzing request');
	
	
	updateStatus('Checking pathnames');
	
	var countInbox = $xpath('//div[@id="rightContent"]/h1/following-sibling::ul[1][@id="tabs"]/li/a[contains(@href, "mailbox?folder=1")]').length;
	if(countInbox !== 1)
		fail('Page structure (or path to mailbox) has changed.', 'Inbox XPath returned '+countInbox+' results.');

	var countOutbox = $xpath('//div[@id="rightContent"]/h1/following-sibling::ul[1][@id="tabs"]/li/a[contains(@href, "mailbox?folder=2")]').length;
	if(countOutbox !== 1)
		fail('Page structure (or path to mailbox) has changed.', 'Outbox XPath returned '+countOutbox+' results.');
	
	
	updateStatus('Counting messages');
}

/**
 * Create infobox, start XHR chain.
 */
function startDownloadSequence(evt)
{
	evt.preventDefault();
	evt.stopPropagation();
	
	downloadTrigger.parentNode.removeChild(downloadTrigger);
	
	createInfobox();
	analyzeRequest();
	getOnePage();
}

/**
 * Collect data and present it.
 */
function finishDownloadSequence()
{
	updateStatus('Building XML file');
	//TODO
		
	infobox.setAttribute('class', 'success');
}

/**
 * Add "download mail" link to header.
 */
function insertTriggerLink()
{
	var mailboxHeader = $xpath('//div[@id="rightContent"]/h1[following-sibling::ul[1][@id="tabs"]]');
	if(mailboxHeader.length !== 1)
		return;
	mailboxHeader = mailboxHeader[0];
	
	downloadTrigger = document.createElement('button');
	downloadTrigger.appendChild(document.createTextNode('download'));
	downloadTrigger.addEventListener('click', startDownloadSequence, false);
	
	mailboxHeader.appendChild(document.createTextNode(' '));
	mailboxHeader.appendChild(downloadTrigger);
}

//start it all
insertTriggerLink();

/*
var downloadLink = document.createElement('a');
downloadLink.setAttribute('href', 'data:application/octet-stream;base64,PHhtbD5IZWxsbywgd29ybGQhPC94bWw+');
downloadLink.appendChild(document.createTextNode('okcupid-mailbox-phyzome-20080705.xml'));
document.body.insertBefore(downloadLink, null);
*/
