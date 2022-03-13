/*
 * nide_sworker.js
 * Naanlib/frameworks/browser
 *
 *     Nide service worker script.
 *
 * column positioning:                          //                          //                      !
 *
 * Copyright (c) 2020 by Richard C. Zulch
 *
 */

var CurrentCacheName = "Naan IDE 1.0.1-2"


//
// locals
//

var fetchQueue = [];
var fetchNextSeq = 1;
var msgport;


/*
 * message event
 *
 *     Received when someone sends us a.
 *
 */

var promiseport = new Promise(function (resolve, reject) {
    self.addEventListener('message', function(event) {
        console.log("[1.0.1-2] port received");
        msgport = event.data.hereIsYourPort;
        msgport.onmessage = function(msg) {
            msg = msg.data;
            if (msg.id == "response")
                postResponse(msg);
            else if (msg.id == "text")
                console.log("[1.0.1-2] msg received:", msg.text);
        };
/*
        // don't clutter the log
        msgport.postMessage({
            id: "text",
            text: "port received by 1.0.1-2",
        });
*/
        resolve(msgport);

        //
        // postResponse
        //
        
        function postResponse(msg) {
            var fqdex, response, item;
            for (fqdex = 0; fqdex < fetchQueue.length; ++fqdex)
                if (fetchQueue[fqdex].seq === msg.seq) {
                    item = fetchQueue.splice(fqdex, 1);
                    item[0].resolve(new Response(msg.body, msg.init));
                    break;
                }
        }
    });
});


/*
 * install event
 *
 *     Received when the service worker is first installed.
 *
 */

self.addEventListener('install', function(event) {
    console.log("[1.0.1-2] install");
    self.skipWaiting();
});


/*
 * fetch event
 *
 *     Received when a page within scope is asking for a site resource.
 *
 */

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request).then(function(response)
        {
            if (response)
                return (response);
            var tid;
            var promise;
            var url = new URL(event.request.url);
            var nocache = event.method != "GET" || url.search.length > 0;
            if (nocache && url.pathname.startsWith("/run/")) {
                if (msgport)
                    promise = Promise.resolve(msgport);
                else {
                    promise = self.clients.matchAll({
                        includeUncontrolled: true
                    }).then(function(clientList) {
                        console.log("[1.0.1-2] requesting new msgport");
                        var urls = clientList.map(function(client) {
                            client.postMessage({                                // tell client(s) we need a fetch source
                                msg: "Naan_need_fetch_port"
                            });
                            return (client.url);
                        });
                        console.log('[1.0.1-2] matching clients:', urls.join(', '));
                        return (promiseport);
                    });
                }
                promise = promise.then(function(mp) { return new Promise(function(resolve, reject) {
                    /*
                    tid = setTimeout( function() {
                        reject("timeout!");
                    }, 250); */
                    var seqno = fetchNextSeq++;
                    if (msgport) {
                        fetchQueue.push({
                            seq: seqno,
                            resolve: resolve
                        });
                        msgport.postMessage({
                            id: "fetch",
                            seq: seqno,
                            version: "1.0.1-2",
                            request: {
                                method: event.request.method,
                                url: event.request.url
                            },
                        });
                    } else {
                        console.log("[1.0.1-2] fetch has no msgport");
                        return (reject("fatal delegation error"));
                    }
                }) });
            }
            else
                promise = fetch(event.request);
            return (promise.then(function(response) {
                // delete tid timer ###
                if (!nocache) {
                    var responseClone = response.clone();
                    caches.open(CurrentCacheName).then(function(cache) {
                        cache.put(event.request, responseClone);
                    });
                }
                return (response);
            }));
        })
    );
});


/*
 * activate event
 *
 *     Received when our service worker is actually started, so remove any old cache data and claim clients.
 *
 */

self.addEventListener('activate', function(event) {
    console.log("[1.0.1-2] activate");
    self.clients.matchAll({                                                 // for debugging, list controlled clients           
        includeUncontrolled: true
    }).then(function(clientList) {
        var urls = clientList.map(function(client) {
            return (client.url);
        });
        console.log('[1.0.1-2] matching clients:', urls.join(', '));
    });
    var promise = caches.keys().then(function(cacheNames) {                 // delete old cache entries
            return (Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CurrentCacheName) {
                        console.log('[1.0.1-2] deleting old cache:', cacheName);
                        return (caches.delete(cacheName));
                    }
                })
            ));
        }).then(function() {                                                // claim all clients
            console.log('[1.0.1-2] claiming clients for version', CurrentCacheName);
            return (self.clients.claim());
        });
    if (event.waitUntil)
        event.waitUntil(promise);
});
