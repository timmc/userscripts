// ==UserScript==
// @name           OKCupid mailbox downloader
// @namespace      tag:brainonfire.net,2008-07-05:okcupid-mailbox-downloader
// @description    Download your OKCupid inbox and outbox as XML.
// @include        http://*.okcupid.com/mailbox
// @include        http://*.okcupid.com/mailbox?folder=*
// @version        0.2
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

var re_findMessageListContainer = /<table .*?id="mailListTable".*?>(.*?)<\/table>/;
var re_getOneMessageLine = /name="selectedMsgs" value="([0-9]+)".+?\/profile\?u=([0-9a-z_-]+).+Subject: (.+?)\s*?<.+?md\(([0-9,]+?)\)/gi;
	var redex_msg_id = 1;
	var redex_msg_user = 2;
	var redex_msg_subject = 3;
	var redex_msg_date = 4;
var re_okcDate = /^([0-9]{4}),([0-9]{1,2}),([0-9]{1,2}),([0-9]{1,2}),([0-9]{1,2}),([0-9]{1,2})$/g;

// DOM cache

var downloadTrigger = undefined;

var infobox = undefined; // class = inprogress|success|failure
var ID_infobox = getUniqueID('infobox');

var statusTextNode = undefined; // text node
var ID_statusTextParent = getUniqueID('statusTextParent');

var dataOutputArea = undefined; // textarea for XML output
var ID_dataOutputArea = getUniqueID('dataOutputArea');

//State info
var curPage = undefined;
var curFolderID = undefined;

//Data

/**
 * folders: [folder]
 * folder: {ID, name, [message]}
 * message: {ID, date, interlocutor, subject}
 */
var folders = [];
var inbox = {id: 1, name: 'inbox', messages: []};
var outbox = {id: 2, name: 'outbox', messages: []};
folders[inbox.id] = inbox;
folders[outbox.id] = outbox;

// Main functions

/**
 * Update the status text.
 */
function updateStatus(msg)
{
	GM_log('Status: ' + msg);
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
	fail('Failed to retrieve a page of results.', 'The server returned the following:\n\n' + getPrintableResponse(resp));
}

/**
 * Build an RFC 2822 date string from the OKC representation.
 */
function makeProperDate(dateCommas)
{
	return new Date(eval('Date.UTC('+dateCommas+')')).toLocaleFormat('%Y-%m-%d %H:%M:%S %Z');
}

/**
 * Retrieve and process one page. Return true if messages were retrieved.
 */
function doOnePage()
{
	//grab data
	updateStatus('Requesting page '+curPage+' in '+folders[curFolderID].name);
	
	var nextURL = '/mailbox?folder='+folders[curFolderID].id+'&next='+curPage;
	
	if(!window.confirm('Requesting '+nextURL))
		throw new Exception('killed');
	
	xhr = new XMLHttpRequest();
	xhr.open('GET', nextURL, false);
	xhr.send(null);

	GM_log('Received: ' + getPrintableResponse(xhr));
	
	if(xhr.status !== 200)
		requestFail(xhr);
	
	//process data
	updateStatus('Processing page '+curPage+' in '+folders[curFolderID].name);

	var data = xhr.responseText.replace(/[\t\n\r]/g, ' ');
	var msgTable = re_findMessageListContainer.exec(data);
	if(msgTable === null)
		fail('Could not find message list container in page.');
	msgTable = msgTable[1];
	
	if(!msgTable.match(/readMessage/g))
		return false;
	
	var oneMatch = undefined;
	while(oneMatch = re_getOneMessageLine.exec(msgTable))
	{
		updateStatus('Adding message '+oneMatch[redex_msg_id]);
		
		folders[curFolderID].messages.push(
		{
			id: oneMatch[redex_msg_id],
			interlocutor: oneMatch[redex_msg_user],
			date: makeProperDate(oneMatch[redex_msg_date]),
			subject: oneMatch[redex_msg_subject]
		});
	}
	
	//XXX
	unsafeWindow.results = folders;
	
	return true;
}

/**
 * Grab all pages, using synchronous AJAX calls.
 */
function pullAllPages()
{
	var xhr = undefined;
	
	var numMessages = undefined;
	
	folders.forEach(function(folder, folderID, allFolders) // folders
	{
		curPage = 0;
		curFolderID = folderID;
		
		while(doOnePage()) // pages
		{
			curPage++;
		}
	});
	
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
			border: 4px solid black; \
			background: white; \
			overflow: auto;\
		} \
		\
		div#'+ID_infobox+'.failure { color: #800; border-color: red; } \
		div#'+ID_infobox+'.inprogress { color: #860; border-color: yellow; } \
		div#'+ID_infobox+'.success { color: #080; border-color: green; } \
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
function doDownloadSequence(evt)
{
	evt.preventDefault();
	evt.stopPropagation();
	
	downloadTrigger.parentNode.removeChild(downloadTrigger);
	
	createInfobox();
	analyzeRequest();

	pullAllPages();

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
	downloadTrigger.addEventListener('click', doDownloadSequence, false);
	
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
