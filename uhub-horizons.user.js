// ==UserScript==
// @name            UHub Horizons
// @namespace       tag:brainonfire.net,2021-11-11:uhub-horizons
// @version         1.1.4
// @description     Block comments by some authors, and responses to those comments. This is inspired by the Chrome extension <https://github.com/balsama/nomagoo>.
// @match           http*://*.universalhub.com/*
// @author          Tim McCormack
// @run-at          document-start
// @grant           unsafeWindow
// ==/UserScript==


//==== Configuration ====//


// Add to or remove from this list as desired. Use the *username*, not
// the display name.
//
// For example, if you click on the author link on a comment by
// "MisterMagooForYou", the URL you end up on is
// <https://www.universalhub.com/users/mistermagooforyou> -- so
// you'll want to use 'mistermagooforyou' here.
var blockedUsernames = [
    // "MisterMagooForYou": Has a really annoying shtick
    'mistermagooforyou',
    // General trolls or shit-stirrers
    'notfromboston', // "Notfromboston"
    'rwgfy', // "Rwgfy"
    'bostonperson', // "Bostonperson"
    // "SwirlyGrrl": Sometimes informative, but picks a lot of fights
    'swirlygrrl',
    // "John Costello": Picks fights
    'john-costello',
];

// Sometimes there are actually good comments by unregistered users,
// but you can hide those as well by setting this to true.
var hideAnonymousComments = false;


//==== Code ====//

function doHiding(event) {
    if (event.target != unsafeWindow) return;

    function hideOneComment(commentNode) {
        // Hide the comment itself
        $(commentNode).hide();
        // And hide the <div class="indented"> that follows it, which contains all the replies (and their replies, etc.)
        $(commentNode).nextUntil('.comment', '.indented').first().hide();
    }

    function hideAllFromUsername(username) {
        // Find comments via their author URLs
        var foundAuthorLinks = $(`.comment .username[href="/users/${CSS.escape(username)}"]`);
        // Go back up to the containing class="comment" block and hide it.
        foundAuthorLinks.closest('.comment').each((i, el) => hideOneComment(el));
        // Log what happened.
        $log.append(`Hid ${foundAuthorLinks.size()} comments by ${username}\n`);
    }

    function hideAllFromAnonymous() {
        var foundAnonComments = $('.comment-by-anonymous');
        foundAnonComments.each((i, el) => hideOneComment(el));
        // Log what happened.
        $log.append(`Hid ${foundAnonComments.size()} anonymous comments\n`);
    }

    var $ = unsafeWindow.jQuery;
    $('#comments').append(`
    <details>
      <summary style="display: list-item">
        UHub Horizons output
        [<a href="https://github.com/timmc/userscripts/blob/master/uhub-horizons.user.js">src</a>]
      </summary>
      <pre id="horizons-log"></pre>
    </details>`);
    var $log = $('#horizons-log');

    blockedUsernames.forEach(hideAllFromUsername);

    if (hideAnonymousComments) {
        hideAllFromAnonymous();
    }
}

// Don't run until jQuery and other things are loaded.
unsafeWindow.addEventListener('load', doHiding);


//==== Changelog ====//

// - 1.0.0: Original.
// - 1.0.1: Replace @match with @include and remove include-star
//   (was activating other places, I think.)
// - 1.0.2: Move $ declaration below functions to satisfy Chrome
//   (although it still worked, despite the console error...)
// - 1.1.0:
//   - Move logging to a collapsed element at the end of the comments block
//   - Expand inclusions to with/without www subdomain, http or https
//   - Drop unnecessary useCapture=false
//   - Restrict to window load event, not bubbled-up document load event that
//     Chromium does. (And restore var scope.)
// - 1.1.1: Finally fixed the bug where the script wouldn't activate
//   when a link was opened in a new, background tab.
// - 1.1.2: Fix a bug where if a hidden comment didn't have replies, the
//   next set of replies in the comment tree was hidden instead.
// - 1.1.3: Switch from @include back to @match -- working better now,
//   I guess.
// - 1.1.4: Listen/filter load event on unsafeWindow, not window. (Using
//   window stopped working at some point, but had been wrong anyhow.)
