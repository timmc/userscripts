// ==UserScript==
// @name            UHub Horizons
// @namespace       tag:brainonfire.net,2021-11-11:uhub-horizons
// @version         1.0.0
// @description     Block comments by some authors, and responses to those comments.
// @include         *
// @author          Tim McCormack
// @match           https://www.universalhub.com/*
// @run-at          document-idle
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
    // "Notfromboston": General troll or shit-stirrer
    'notfromboston',
];

// Sometimes there are actually good comments by unregistered users,
// but you can hide those as well by setting this to true.
var hideAnonymousComments = false;


//==== Code ====//


function doHiding() {
    var $ = unsafeWindow.jQuery;

    function hideOneComment(commentNode) {
        // Hide the comment itself
        $(commentNode).hide();
        // And hide the <div class="indented"> that follows it, which contains all the replies (and their replies, etc.)
        $(commentNode).nextAll('.indented').first().hide();
    }

    function hideAllFromUsername(username) {
        // Find comments via their author URLs
        var foundAuthorLinks = $(`.comment .username[href="/users/${CSS.escape(username)}"]`);
        // Go back up to the containing class="comment" block and hide it.
        foundAuthorLinks.closest('.comment').each((i, el) => hideOneComment(el));
        // Log what happened.
        console.log(`Hid ${foundAuthorLinks.size()} comments by ${username}`);
    }

    function hideAllFromAnonymous() {
        var foundAnonComments = $('.comment-by-anonymous');
        foundAnonComments.each((i, el) => hideOneComment(el));
        // Log what happened.
        console.log(`Hid ${foundAnonComments.size()} anonymous comments`);
    }

    blockedUsernames.forEach(hideAllFromUsername);

    if (hideAnonymousComments) {
        hideAllFromAnonymous();
    }
}

// Don't run until jQuery and other things are loaded.
window.addEventListener('load', doHiding, false);
