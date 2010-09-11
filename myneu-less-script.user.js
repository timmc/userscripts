// ==UserScript==
// @name           MyNEU javascript remover
// @namespace      tag:brainonfire.net,2008-07-27:myneu-less-script
// @description    Replace Javascript popup links with real links & target=_blank
// @include        *myneu*
// @version        0.2
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


//modules
function generic_location()
{
	var tabs = $xpath('//a[starts-with(@href, "javascript:")]');
	tabs.forEach(function(link)
	{
		var oldHref = link.getAttribute('href');
		var newHref = oldHref.replace(/^javascript:Open(?:Win)?NEU\('https?:(([^']|\\')+)'\);?$/, '$1');
		if(oldHref !== newHref)
		{
			link.setAttribute('href', newHref);
			link.setAttribute('target', '_blank');
		}
	});
}

//TODO: Put in modules here, to be called in different URL contexts

//do different pages and sections

generic_location();

//TODO: you can put in the URL-switched module calls here
