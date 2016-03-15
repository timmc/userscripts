// ==UserScript==
// @name        Google one-page login
// @namespace   tag:brainonfire.net,2016-03-14:google-login-simple
// @description Present both email and password fields on Google login screen, just like the old days
// @include     https://accounts.google.com/ServiceLoginAuth
// @include     https://accounts.google.com/ServiceLoginAuth?*
// @version     1.0
// @grant       none
// ==/UserScript==

var pw = document.getElementById('Passwd-hidden');
pw.setAttribute('id', 'Passwd');
pw.setAttribute('name', 'Passwd');
pw.setAttribute('placeholder', 'Enter your password');
pw.classList.remove('hidden');

