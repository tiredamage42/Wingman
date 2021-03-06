/*
    Wingman (an in-browser html/css/js editor)
    Copyright (C) 2020  Andres Gomez

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

*/



/*
    handle teh iframe element that displays the finished product
    of the html, css, and js code

    ( AKA left half of the screen )

    we do this by formatting the supplied html, css, and js code into our own
    custom built html source code (with some special considerations for being displayed within the iframe)

    and then settings the iframe's source to this built html string
*/

import { assertHTMLIsWithinHTMLTags } from './dom-utils.js';

export function initResultDisplay (allHotKeys, hotkeysSource, sessionStringsGet, consoleWindow, handleHotkey) {
    // an iframe element
    let resultDisplay = document.getElementById("result-display");

    /*
        we intercept the result display's iframe console.logs (and warns / errors)

        by injecting a script into the formatted final display html that overrides the iframe context's
        console.log/warn/error to send a message to our outer window wiht the arguments instead

        then we display them in our custom console window, this way logs from the
        in browser editor dont get confused with normal developer console logs
    */
   const overrideConsoleLogInIFrameScript =`
        function postMessageToParentWindow (args, severity) {
            function obj2String (obj) {
                if (Array.isArray(obj))
                    return \`[ \${obj.toString()} ]\`;
                else if (typeof obj === 'object') {
                    if (obj.toString !== Object.prototype.toString)
                        return obj.toString();
                    return JSON.stringify(obj);
                }
                return String(obj);
            }
            args = Array.from(args).map(a => obj2String(a) );
            args.push(severity);
            args.push('LOG');
            window.parent.postMessage(args, '*');
        }
        console.log = function() { postMessageToParentWindow (arguments, 0); };
        console.warn = function() { postMessageToParentWindow (arguments, 1); };
        console.error = function() { postMessageToParentWindow (arguments, 2); };
    `;
    // prepare to receive a message from the iframe with the log arguments
    window.addEventListener("message", (event) => {
        if (event.data[event.data.length - 1] !== 'LOG')
            return;
        let type = event.data.pop();
        let severity = event.data.pop();
        // add a string representation to the log messages element
        consoleWindow.addLog ( event.data.join(' - '), severity );
    });


    // we need to define hotkeys manually in the iframe,
    // since hotkeys assigned outside dont work when hovering the mosue
    // within iframe context
    const initializeHotKeysScript = `
        <script src="${hotkeysSource}"></script>
        <script>
            hotkeys.filter = function(event) {
                return true;
            }
            hotkeys('${allHotKeys}', function(event, handler) {

                // send a message to the parent that a hotkey was pressed
                window.parent.postMessage([ handler.key, 'HOTKEY' ], '*');

                // return false to prevent event default
                return false;
            });
        </script>
    `;

    // prepare to receive a message from the iframe with the hotkey arguments
    window.addEventListener("message", (event) => {
        if (event.data[1] === 'HOTKEY')
            handleHotkey(event.data[0]);
    });


    function updateDisplay () {
        let { html, css, js } = sessionStringsGet();

        let htmlNode = assertHTMLIsWithinHTMLTags (html);

        // fix links to always open in a new tab,
        // links inside iframes generate CORS errors when going to a differnt domain
        // TODO: waht if user wants link to open in editor?
        let links = htmlNode.getElementsByTagName('a');
        for (let i = 0; i < links.length; i++)
            links[i].setAttribute('target', '_base');

        // reconstruct html as string
        let finalHTML = `
            <html>
                <head>
                    ${htmlNode.getElementsByTagName('head')[0].innerHTML}
                    <style>${css}</style>
                </head>
                <body>
                    ${htmlNode.getElementsByTagName('body')[0].innerHTML}
                    <script>
                        ${overrideConsoleLogInIFrameScript}
                        // surround the js script section in a try catch, so that any
                        // errors get sent up to our custom console
                        try {
                            ${js}
                        }
                        catch(e) {
                            console.error(e);
                        }
                    </script>
                    ${initializeHotKeysScript}
                </body>
            </html>
        `;
        resultDisplay.srcdoc = finalHTML;
    }

    return { updateDisplay };
}




