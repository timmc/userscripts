// ==UserScript==
// @name          OKCupid questions downloader
// @namespace     tag:brainonfire.net,2009-11-17:okcupid-questions-downloader
// @description   Download your answers to OKCupid match questions as JSON. (This takes a while.) http://www.okcupid.com/questions
// @include       http://www.okcupid.com/questions
// @require       http://code.jquery.com/jquery-latest.min.js
// @version       0.1
// ==/UserScript==

GM_registerMenuCommand("Harvest question data", startHarvesting);

// personal
var username;
var maxLow;

// constants
var minLow = 1;
var perPage = 10;

// DOM
var loaderFrame;
var infobox;

// state
var curLow = minLow;
var questions = {};

/**
 * Create infobox, start XHR chain.
 */
function startHarvesting()
{
	username = unsafeWindow.SCREENNAME;
	maxLow = Number(jQuery(".questions ul.pagination li:last-child a").attr('href').replace(/.*\?low=([0-9]+)$/gi, '$1'));
	
	loaderFrame = document.createElement('iframe');
	document.body.appendChild(loaderFrame);
	loaderFrame.addEventListener('load', receivePage, false);
	
	infobox = document.createElement('ol');
	document.body.appendChild(infobox);
	
	GM_log('About to make first call.');

	loadPage();
}

/**
 * Finish XHR chain, display results.
 */
function finish()
{
	var dump = document.createElement('textarea');
	document.body.appendChild(dump);
	dump.value = uneval(questions);
	
	updateStatus('Done!');
}


/*=====================*
 * Core loop functions *
 *=====================*/

/**
 * 1. Start a request for the current offset.
 */
function loadPage()
{
	// check for terminal state
	if(curLow > maxLow)
		return finish(); // goto 3
	
	updateStatus('Requesting at most '+perPage+' questions starting at #'+curLow);
	
	loaderFrame.src = '/profile/'+username+'/questions?low='+curLow; // goto 2
}

/**
 * 2. Harvest data from loaded page.
 */
function receivePage()
{
	updateStatus('Loaded page starting at '+curLow);
	
	var qs = jQuery(".questions .question", loaderFrame.contentDocument);
	if(qs.length < perPage && curLow < maxLow) {
		//throw "Failed to load page of questions: "+curLow;
	}
	qs.each(processQuestion);
	
	curLow += perPage;
	loadPage(); // goto 1
}

function processQuestion(i) {
	//updateStatus("Reading "+i+"th question.");

	var $q = jQuery(this);
	var qID = $q.attr('id').replace(/^question_([0-9]+)$/, '$1');
	var isPublic = $q.hasClass('public');
	var qHTML = $q.find('p.qtext').html();
	var importance = Number($q.find('input#question_'+qID+'_importance').attr('value'));
	var answers = {};
	$q.find('.self_answers > li').each(function processAnswer(i) {
		var $a = $(this);
		var aID = Number($a.attr('id').replace(/.*_/gi, ''));
		var aText = $a.html();
		var isMine = $a.hasClass('mine');
		var isMatch = $a.hasClass('match');
		answers[aID] = {
			text: aText,
			isMine: isMine,
			isMatch: isMatch
		};
	});
	if(questions[qID]) {
		//throw "Question already harvested: "+qID; // occasionally seeing some overlap between consecutive pages
	}
	questions[qID] = {
		text: qHTML,
		isPublic: isPublic,
		importance: importance,
		answers: answers
	};
}

/*==================*
 * Helper functions *
 *==================*/

/**
 * Update the status text.
 */
function updateStatus(msg)
{
	GM_log('Status: ' + msg);
	
	var line = document.createElement('li');
	line.appendChild(document.createTextNode(msg));
	infobox.appendChild(line);
}

