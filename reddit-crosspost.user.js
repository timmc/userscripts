// ==UserScript==
// @name           Reddit crosspost helper
// @namespace      tag:brainonfire.net,2010-07-25:reddit-crosspost
// @description    Add a "crosspost" link to the toolbar on posts to go to a pre-populated submission page. You will be prompted for a subreddit to post to.
// @include        http://www.reddit.com/r/*/comments/*/
// @license        GPL
// @version        1.0
// ==/UserScript==

/** Run entire script inside page. From http://wiki.greasespot.net/Content_Scope_Runner */
if(typeof __PAGE_SCOPE_RUN__ == 'undefined') {
   (function page_scope_runner() {
      var script = document.createElement('script');
      script.setAttribute("type", "application/javascript");
      script.textContent = "(function() { var __PAGE_SCOPE_RUN__ = 'yes'; (" + page_scope_runner.caller.toString() + ")(); })();";
      document.documentElement.appendChild(script);
      document.documentElement.removeChild(script);
   })();
   return;
}

if($('#siteTable .entry .usertext-body').length) {
   return; //self-post
}

$('<li><a href="javascript:void(0)">Cross-post</a></li>')
   .appendTo('#siteTable .thing .entry .buttons')
   .find('a')
   .click(grabMetadata);

function grabMetadata(ev) {
   $.getJSON(document.location+'.json', undefined, goToSubmit);
}

function goToSubmit(data) {
   var data = data[0].data.children[0].data;
   var nextReddit = window.prompt("Crosspost to which subreddit?") || "";
   if(nextReddit == "") { return; }
   document.location = "http://www.reddit.com/r/"+nextReddit+"/submit?title="+encodeURIComponent(data.title+" [xpost/"+data.subreddit+"]")+"&url="+encodeURIComponent(data.url);
}
