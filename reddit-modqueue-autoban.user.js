// ==UserScript==
// @name           Reddit: Modqueue autoban
// @namespace      tag:brainonfire.net,2010-07-31:reddit-modqueue-autoban
// @description    Allow a moderator to set a spammer as "autobanned". The script will then automatically confirm removal of all of their posts in the modqueue (upon every load) and hide these entries. The sidebar will be modified to contain a list of these users, and will allow their removal from the list.
// @include        http://www.reddit.com/r/mod/about/modqueue*
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

function partial(fn) {
   var baseArgs = Array.prototype.slice.call(arguments, 1);
   return function() {
      var plusArgs = Array.prototype.slice.call(arguments);
      return fn.apply(window, baseArgs.concat(plusArgs));
   };
};

/**
 * Call an asynchronous function once for each element of the list, then
 * continue with k. The provided function must have signature (el k & opt) where
 * el is an element of the list and k is called as a continuation. The function
 * will be passed any extra arguments that kEach and its continuations are called
 * with.
 * Returns undefined.
 */
function kEach(fn, list, k) {
   var index = 0;
   function trampoline() {
      index++;
      if(index < list.length) {
         fn.apply(this, [list[index], trampoline].concat([].slice.apply(arguments)));
      } else {
         if(k) k();
      }
   }
   fn.apply(this, [list[index], trampoline].concat([].slice.call(arguments, 3)));
}

/* From http://plugins.jquery.com/project/Cookie under GPL */
jQuery.cookie = function(name, value, options) {
    if (typeof value != 'undefined') { // name and value given, set cookie
        options = options || {};
        if (value === null) {
            value = '';
            options.expires = -1;
        }
        var expires = '';
        if (options.expires && (typeof options.expires == 'number' || options.expires.toUTCString)) {
            var date;
            if (typeof options.expires == 'number') {
                date = new Date();
                date.setTime(date.getTime() + (options.expires * 24 * 60 * 60 * 1000));
            } else {
                date = options.expires;
            }
            expires = '; expires=' + date.toUTCString(); // use expires attribute, max-age is not supported by IE
        }
        // CAUTION: Needed to parenthesize options.path and options.domain
        // in the following expressions, otherwise they evaluate to undefined
        // in the packed version for some reason...
        var path = options.path ? '; path=' + (options.path) : '';
        var domain = options.domain ? '; domain=' + (options.domain) : '';
        var secure = options.secure ? '; secure' : '';
        document.cookie = [name, '=', encodeURIComponent(value), expires, path, domain, secure].join('');
    } else { // only name given, get cookie
        var cookieValue = null;
        if (document.cookie && document.cookie != '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = jQuery.trim(cookies[i]);
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) == (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
};

/*======*
 * DATA *
 *======*/

const cookieStore = 'autoban';
const storeVersion = 0; // must match script major version

function upgradeStore(store) {
   //for now, it is this simple
   if(storeVersion == 1 && store.version == 0) {
      store.version = 1;
      return;
   }
   throw "Upgrade the reddit-modqueue-autoban script. Stored data is of version "+store.version+", which is greater than the script's version.";
}

function getBanDirectory() {
   var cookie, store;
   if(!(cookie = $.cookie(cookieStore)) || !(store = $.secureEvalJSON(cookie))) {
      setBanDirectory({});
      return {};
   }
   if(store.version != storeVersion) {
      upgradeStore(store);
   }
   return store.byreddit;
}

function setBanDirectory(byreddit) {
   $.cookie(cookieStore, $.toJSON({'version':storeVersion, 'byreddit':byreddit}), {expires: 1000, path: '/', domain:'.reddit.com'});
}

function banUser(sr, uname) {
   var directory = getBanDirectory();
   var users = directory[sr];
   if(!users) {
      users = [uname];
   } else if(users.indexOf(uname) < 0) {
      directory[sr].push(uname);
   }
   directory[sr] = users;
   setBanDirectory(directory);
}

function unbanUser(sr, uname) {
   var directory = getBanDirectory();
   var users = directory[sr];
   if(!users) {
      return;
   }
   var foundAt = users.indexOf(uname);
   if(foundAt < 0) {
      return;
   }
   users.splice(foundAt, 1);
   directory[sr] = users;
   setBanDirectory(directory);
}

/*========*
 * EVENTS *
 *========*/

function doAutoban(item, ev) {
   var user = $('.author', item).text();
   var sr = $('.subreddit', item).text();
   if(!window.confirm('Autoban user '+user+' from '+sr+'?'))
      return;
   banUser(sr, user);
   addToBanListing(sr, user);
   var miniDir = {};
   miniDir[sr] = [user];
   scanAndNuke(miniDir);
   
   return false;
}

function doUnban(sr, username, ev) {
   unbanUser(sr, username);
   $(ev.target).parent('li').remove();
   
   return false;
}

/*=====*
 * GUI *
 *=====*/

var $banlist;

function makeBanListing(directory) {
   $banlist = $('<div class="spacer"><div class="sidecontentbox autobanlist"><h1><a href="http://userscripts.org/scripts/show/82709">Autoban list</a></h1><div class="content"><ul></ul></div></div></div>')
      .insertAfter('body > .side > .spacer:first')
      .find('ul');
   for(var sr in directory) {
      var userlist = directory[sr];
      for(var unameDex in userlist) {
         var username = userlist[unameDex];
         addToBanListing(sr, username, $banlist);
      }
   };
}

function addToBanListing(sr, uname, listing) {
   listing = listing || $('.autobanlist ul').get(0);
   $('<li><a href="/user/'+uname+'" title="Go to user page">'+uname+'</a> \
          in <a href="/r/'+sr+'" title="Got to subreddit">'+sr+'</a> \
          [<a class="unban" href="javascript:void()" title="Remove user from autoban list">unban</a>]</li>', listing)
      .appendTo(listing)
      .find('a.unban')
      .bind('click', partial(doUnban, sr, uname));
}

/*======*
 * CORE *
 *======*/

function judgeItem(item, k, directory) {
   var pause = 0;
   var user = $(item).find('.author').eq(0).text();
   var subreddit = $(item).find('.subreddit').eq(0).text();
   if(directory[subreddit] && directory[subreddit].indexOf(user) != -1) {
      $('.big-mod-buttons .negative', item).click();
      $(item).add($(item).next('.clearleft')).remove();
      pause = 200; // give the removal time to run
   }
   setTimeout(partial(k, directory), pause);
}

function scanAndNuke(directory, k) {
   kEach(judgeItem, $('#siteTable > .thing'), k, directory);
}

function addBanLink(i, el) {
   var $buttons = $('.buttons', el);
   $('<li><a class="autoban" href="javascript:void(0)" title="Automatically remove this user\'s posts from this subreddit, always">autoban</a></li>')
      .bind('click', partial(doAutoban, el))
      .appendTo($buttons); // http://dev.jquery.com/ticket/6856
}

function innervateRemaining() {
   $('#siteTable > .thing').each(addBanLink);
}

/*======*
 * INIT *
 *======*/

var directory = getBanDirectory();
makeBanListing(directory);
scanAndNuke(directory, innervateRemaining);
