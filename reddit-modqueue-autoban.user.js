// ==UserScript==
// @name           Reddit: Modqueue autoban
// @namespace      tag:brainonfire.net,2010-07-31:reddit-modqueue-autoban
// @description    Allow a moderator to set a spammer as "autobanned". The script will then automatically confirm removal of all of their posts in the modqueue (upon every load) and hide these entries. The sidebar will be modified to contain a list of these users, and will allow their removal from the list.
// @include        http://www.reddit.com/r/*/about/modqueue*
// @include        http://www.reddit.com/r/*/about/spam*
// @include        http://www.reddit.com/r/*/about/reports*
// @license        GPL
// @version        2.1.1
// ==/UserScript==

if(!/^http:\/\/www\.reddit\.com\/r\/[0-9a-z_]+\/about\/(spam|modqueue|reports)[\/.?#]?.*$/i.exec(document.location)) {
   return;
}

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

var natnum_re = /^[0-9]+$/;
function isNaturalNumber(x) {
   // (isFinite(x) && x >= 0) still doesn't check for integrality
   return (typeof x == "number" || x instanceof Number) && natnum_re.exec(""+x) != null && x >= 0;
}

/*========*
 * CONFIG *
 *========*
 Configure the script according to the current environment. */

var srFilter = reddit.post_site || null;

/*======*
 * DATA *
 *======*
 Data store manipulation. */

const cookieStore = 'autoban';
const storeVersion = 2; // must match script major version!

function makeEmptyStore() {
   return {'version':storeVersion, // Datastore compatibility version (matches script major version)
           'byreddit':{}, // hash of subreddits to username arrays (banned within subreddit)
           'sitewide':{} // hash of usernames to subreddit name arrays (banned globally, was local to those subreddits)
   };
}

/** Perform in-place upgrade of store. */
function upgradeStore(store) {
   if(!isNaturalNumber(store.version)) {
      fail("Store's version field is not a natural number.");
   } else if(store.version > storeVersion) {
      fail("Upgrade the reddit-modqueue-autoban script. Stored data is of version "+store.version+", which is greater than the script's version.");
   }
   
   // I finally have a use for the fallthrough behavior of switch!
   switch(store.version) {
   case 0:
      store.version = 1;
   case 1:
      store.version = 2;
      store.sitewide = {};
   }
}

function getStore() {
   var cookie, store;
   if(!(cookie = $.cookie(cookieStore)) || !(store = $.secureEvalJSON(cookie))) {
      store = makeEmptyStore();
   }
   if(store.version != storeVersion) {
      upgradeStore(store);
   }
   return store;
}

function setStore(store) {
   $.cookie(cookieStore, $.toJSON(store), {expires: 1000, path: '/', domain:'.reddit.com'});
}

/*=====*
 * OPS *
 *=====*
 Modify a valid store instance in-place. */

/** Adds a local ban (or adds to listing in any global ban.) */
function banUser(store, sr, uname) {
   if(store.sitewide[uname]) {
      store.sitewide[uname].push(sr);
      return;
   }
   var users = store.byreddit[sr];
   if(!users) {
      store.byreddit[sr] = [uname];
   } else if(users.indexOf(uname) < 0) {
      store.byreddit[sr].push(uname);
   }
}

/** Removes a local ban (or removes from listing in any global ban.) */
function unbanUser(store, sr, uname) {
   if(store.sitewide[uname]) {
      var subs = store.sitewide[uname];
      var pos = subs.indexOf(sr);
      if(pos >= 0) {
         subs.splice(pos, 1);
         return;
      }
   }
   var users = store.byreddit[sr];
   if(!users) {
      return;
   }
   var foundAt = users.indexOf(uname);
   if(foundAt < 0) {
      return;
   }
   users.splice(foundAt, 1);
   store.byreddit[sr] = users;
}

/**
 * Make this user banned site-wide.
 */
function promoteBan(store, uname) {
   var locals = [];
   for(var sr in store.byreddit) {
      var ul = store.byreddit[sr];
      var pos = ul.indexOf(uname);
      if(pos != -1) {
         locals.push(sr); // add to global
         ul.splice(pos, 1); // remove from local
      }
   }
   if(store.sitewide[uname]) {
      locals.concat(store.sitewide[uname]);
   }
   store.sitewide[uname] = locals;
}

/**
 * Convert a global ban into local ones.
 */
function demoteBan(store, uname) {
   if(!store.sitewide[uname]) {
      return;
   }
   var subs = store.sitewide[uname]; // copy and delete, or banUser will put them right back!
   delete store.sitewide[uname];
   subs.forEach(function(sr) {
      banUser(store, sr, uname);
   });
}

function isBanned(store, uname, sr) {
   return store.sitewide[uname] || store.byreddit[sr] && store.byreddit[sr].indexOf(uname) != -1;
}

/*=====*
 * GUI *
 *=====*
 Modify the DOM. */

var $banlist;

function makeBanListing() {
   $('head').append('<style type="text/css"> \
                        .autobanlist { position: relative; } \
                        .autobanlist a.expand { position: absolute; top: -2px; right: 0; } \
                        .autobanlist u.listing { padding-left: 1em; text-indent: -1em; line-height: 1.5; font-size: .9em; } \
                     </style>');
   $('<div class="spacer"> \
         <div class="sidecontentbox autobanlist thing"> \
            <h1> \
               <a href="http://userscripts.org/scripts/show/82709" title="Go to userscript page">Autoban list</a> \
            </h1> \
            <div class="content entry"> \
               <div class="collapsed"> \
                  <a class="expand" onclick="return showcomment(this)" href="#">[+]</a> \
                  (collapsed) \
               </div> \
               <div class="noncollapsed" style="display:none"> \
                  <a class="expand" onclick="return hidecomment(this)" href="#">[-]</a> \
                  <ul class="listing"></ul> \
               </div> \
            </div> \
         </div> \
      </div>')
      .insertAfter('body > .side > .spacer:first');
}

function showCurrentBans(store) {
   if(srFilter) {
      var smaller = makeEmptyStore();
      smaller.byreddit[srFilter] = store.byreddit[srFilter];
      smaller.sitewide = store.sitewide;
      store = smaller;
   }
   var $banlist = $('.autobanlist ul.listing');
   $banlist.empty();
   for(var sr in store.byreddit) {
      var userlist = store.byreddit[sr];
      for(var unameDex in userlist) {
         var username = userlist[unameDex];
         showLocalBan(sr, username, $banlist);
      }
   };
   for(var uname in store.sitewide) {
      var srs = store.sitewide[uname];
      showGlobalBan(uname, srs, $banlist);
   }
}

function showLocalBan(sr, uname, listing) {
   $('<li class="local"><a href="/user/'+uname+'">'+uname+'</a> in <a href="/r/'+sr+'">'+sr+'</a> \
          [<a class="unban" href="javascript:void()" title="Remove user from autoban list">unban</a>] \
          [<a class="sitewide" href="javascript:void()" title="Make this a site-wide ban">global</a>]</li>')
      .appendTo(listing)
      .find('a.unban').bind('click', partial(askedUnban, sr, uname)).end()
      .find('a.sitewide').bind('click', partial(askedPromote, uname)).end();
}

function showGlobalBan(uname, srs, listing) {
   $('<li class="global"><a href="/user/'+uname+'">'+uname+'</a> <abbr title="Was banned in: '+srs.join(', ')+'">site-wide</abbr> \
          [<a class="unban" href="javascript:void()" title="Entirely remove user from autoban list">unban</a>] \
          [<a class="local" href="javascript:void()" title="Move back to local bans:">local</a>]</li>')
      .appendTo(listing)
      .find('a.local').bind('click', partial(askedDemote, uname)).end();
}

function fail(msg) {
   $('<div style="color: red; border: 1px solid red; padding: .25em; font-size: 15px"></div>').text("autoban script error: "+msg).prependTo('body');
   throw msg;
}

/*======*
 * CORE *
 *======*/

function judgeItem(item, k, store) {
   var pause = 0;
   var user = $(item).find('.author').eq(0).text();
   var subreddit = srFilter || $(item).find('.subreddit').eq(0).text();
   if(isBanned(store, user, subreddit)) {
      $('.big-mod-buttons .negative', item).attr('onclick', '').click();
      $(item).add($(item).next('.clearleft')).remove();
      pause = 2000; // give the removal time to run
   }
   setTimeout(partial(k, store), pause);
}

function scanAndNuke(store, k) {
   kEach(judgeItem, $('#siteTable > .thing'), k, store);
}

function addBanLink(i, el) {
   var $buttons = $('.buttons', el);
   $('<li><a class="autoban" href="javascript:void(0)" title="Automatically remove this user\'s posts from this subreddit, always">autoban</a></li>')
      .bind('click', partial(askedAutoban, el))
      .appendTo($buttons); // Would like .appendTo('.buttons', el), but... http://dev.jquery.com/ticket/6856
}

function innervateRemaining() {
   $('#siteTable > .thing').each(addBanLink);
}

/*========*
 * EVENTS *
 *========*
 Respond to page events. */

function askedAutoban(item) {
   var user = $('.author', item).text();
   var sr = srFilter || $('.subreddit', item).text();
   if(!window.confirm('Autoban user '+user+' from '+sr+'?'))
      return;

   var store = getStore();
   banUser(store, sr, user);
   setStore(store);
   
   showCurrentBans(store);
   
   var miniDir = {};
   miniDir[sr] = [user];
   scanAndNuke(miniDir);
   
   return false;
}

function askedUnban(sr, username) {
   var store = getStore();
   unbanUser(store, sr, username);
   setStore(store);
   
   showCurrentBans(store);
   
   return false;
}


function askedPromote(uname) {
   var store = getStore();
   promoteBan(store, uname);
   showCurrentBans(store);
   setStore(store);
   
   return false;
}

function askedDemote(uname) {
   var store = getStore();
   demoteBan(store, uname);
   showCurrentBans(store);
   setStore(store);
   
   return false;
}

/*=====*
 * API *
 *=====*
 Functions that are callable from the global namespace. */

/**
 * Called when a link has been auto-removed.
 */
function afterRemoved() {
   //TODO
}

window.autoban = {
   //events
   afterRemoved:afterRemoved,
   //data
   read:getStore,
   write:setStore,
   add:banUser,
   remove:unbanUser,
   promote:promoteBan,
   demote:demoteBan,
   //GUI
   refresh:showCurrentBans
};

/*======*
 * INIT *
 *======*/

var initStore = getStore();
makeBanListing();
showCurrentBans(initStore);
scanAndNuke(initStore, innervateRemaining);
