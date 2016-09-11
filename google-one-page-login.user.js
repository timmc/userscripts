// ==UserScript==
// @name        Google one-page login
// @namespace   tag:brainonfire.net,2016-03-14:google-login-simple
// @description Present both email and password fields on Google login screen, just like the old days
// @include     https://accounts.google.com/ServiceLogin
// @include     https://accounts.google.com/ServiceLogin?*
// @include     https://accounts.google.com/ServiceLogin#*
// @include     https://accounts.google.com/ServiceLoginAuth
// @include     https://accounts.google.com/ServiceLoginAuth?*
// @include     https://accounts.google.com/ServiceLoginAuth#*
// @version     1.3
// @grant       none
// ==/UserScript==

/*

Standard flow goes:

- /ServiceLogin -- initial screen, showing only username field
- /AccountLoginInfo -- intermediary screen, showing only password field
- /ServiceLoginAuth -- post-login redirection

Going to ServiceLoginAuth directly will present the ServiceLogin interface.

This script simply restores the password field and repoints the form
to the final URL.

Changelog:

- v1.0 Sometimes worked, but not always
- v1.1 Expanded @includes to initial screen, repointed form to third
  URL (I think I had been testing the initial version on the third
  URL, masking the issue)
- v1.2 Added @include variants with fragment wildcards
- v1.3 Remove event listeners on form to sidestep XHR flow
*/

// Replace form with deep clone in order to shake off the event listeners
var origForm = document.getElementById('gaia_loginform');
var form = origForm.cloneNode(true);
origForm.parentNode.appendChild(form, origForm);
origForm.parentNode.removeChild(origForm);

var formAction = form.getAttribute('action');
var actionBetter = formAction.replace('/AccountLoginInfo', '/ServiceLoginAuth');
form.setAttribute('action', actionBetter);

var pw = document.getElementById('Passwd-hidden');
pw.setAttribute('id', 'Passwd');
pw.setAttribute('name', 'Passwd');
pw.setAttribute('placeholder', 'Enter your password');
pw.classList.remove('hidden');
