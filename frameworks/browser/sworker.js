/*
 * nide_sworker.js
 * Naanlib/frameworks/browser
 *
 *     Nide service worker script.
 *
 * The goal of this service worker is to 1) cache fetch requests for static content, and 2) relay
 * fetch requests in the /run/ URL path namespace to instances of the IDE that can provide it. The
 * identifier for the various browser windows is by "clientId", which is a GUID reported by the
 * service worker and message channel APIs. Here we use the term clientId to refer to windows that
 * consume data in the /run/ path, i.e. the IDE targets, and the term sourceId to refer to windows
 * that provide data, i.e. the IDE instances.
 *     When the service worker is first executed it sends messages to all known windows requesting
 * that they establish a message channel and forward the service worker's port to it. This secondary
 * channel is used to communicate fetch requests from the service worker to the source IDE and then
 * get the response. If an IDE is executed subsequently then it registers itself by sending the port
 * unilatterally, instead of waiting to be requested.
 *     The service worker gets a fetch request when a non-cached resource is requested by a client
 * window. If the URL path is not within /run/ then this executes a normal network request. IF the
 * URL path is within /run/ then this asks the IDE source(s) to fetch it. Initially every IDE source
 * is sent the request, but when one provides a 200 response then this stores that source port under
 * the clientId in fetchPorts so that subsequent requests can go only to the correct IDE. This works
 * great until an IDE goes away or becomes unresponsive.
 *     Unfortunately there is no event that tells us when a window is closed or goes away. The first
 * indication of trouble is when an IDE fails to respond within a reasonable amount of time, which
 * could be anything. We can enumerates the valid clients, which gives us a chance to validate our
 * knowledge of which ones are responding. If a request takes longer than a second to respond then
 * this executes a validate operation, which eliminates any clients that have gone away and rejects
 * their pending operations.
 *     One potential problem is stale caches. When an older version is discovered then we notify the
 * client and invalidate the old cache.
 *
 * column positioning:                          //                          //                      !
 *
 * Copyright (c) 2020-2022 by Richard C. Zulch
 *
 */

var CurrentCacheName = "Naanlang-1.0.7+2";


//
// locals
//

var fetchQueue = [];                            // queue for outstanding requests to sources
var fetchNextSeq = 1;                           // sequence number for source requests
var msgPorts = {};                              // message ports keyed by sourceId
var fetchPorts = {};                            // message ports keyed by clientId
var waitingForInit = [];                        // initialization functions, or false after done


/*
 * initialize
 *
 *     Initiate listening for incoming messages from our clients. This waits for any client responses
 * and then quits. Any clients that want to participate after that must unilaterally send a port for
 * communication.
 *
 */

(function initialize() {
    if (!waitingForInit)
        return;                                                             // already initialized
    var pending = 0;
    
    // doneInit
    //
    // Call this to resolve any waiting promises and release them for attempting to fetch from the
    // IDEs (sources.)
    //
    function doneInit() {
        if (!waitingForInit)
            return;                                                         // already done
        var waiters = waitingForInit;
        waitingForInit = false;                                             // no more waiters allowed
        for (var wdex in waiters)
            waiters[wdex]();                                                // call each waiter
    }

    // self.onmessage events
    //
    // This receives channel port messages from the IDEs as they either 1) respond to a request to
    // register, or 2) spontaneously register themselves as they notice that we're running.
    //
    self.addEventListener('message', function(event) {
        var msgport = event.data.hereIsYourPort;                            // message port of a client
        var pubID = event.data.hereIsMyID;
        var pubVersion = event.data.hereIsMyVersion;
        var sourceId = event.source.id;                                     // client id of sender of message
        msgPorts[sourceId] = msgport;
        console.log("[1.0.7+2] received new msgport for", sourceId, pubID, "-", pubVersion);
        if (pubVersion != "1.0.7+2")
            msgport.postMessage({                                           // notify new version available
                id: "upgrade",
                version: "1.0.7+2"
            });
        Reaper();                                                           // clean up obsolete info
        
        // msgport.onmessage events
        //
        // This receives channel port messages that are responding to our fetch requests. The IDE
        // can also send a text message for logging, but that is used only for debugging.
        //
        msgport.onmessage = function(msg) {
            msg = msg.data;
            if (msg.id == "response")
                processResponse(msg);
            else if (msg.id == "text")
                console.log("[1.0.7+2] msg received:", msg.text);
        };
        
        // send text to IDE log
        //
        // This is only for debugging.
        //
            /*
            // don't clutter the log
            msgport.postMessage({
                id: "text",
                text: "port received by 1.0.7+2",
            });
            */
        if (--pending === 0)
             doneInit();                                                    // we finished all known clients
    });

    // initialize known IDE instances.
    //
    // This sends a port request to each known IDE instance. Fetches that occur prior to completion
    // of initialization will wait for these instances to respond. A timeout prevents one errant IDE
    // from hanging all requests, by releasing the fetches even before all source IDEs respond.
    //
    self.clients.matchAll({
        includeUncontrolled: true
    }).then(function(clientList) {
        clientList.every(function(client) {
            console.log("[1.0.7+2] requesting new msgport for", client.id);
            ++pending;
            client.postMessage({                                            // tell client(s) we need this fetch source
                msg: "Naan_need_fetch_port",
            });
        });
        setTimeout(doneInit, 10000);                                        // release fetches
    });

    // processResponse
    //
    // An IDE source has responded to our fetch request. If this was successful then we record the
    // IDE (sourceId) so that subsequent requests from that target (clientId) will go to the same
    // source.
    //
    function processResponse(msg) {
        var fqdex, response, item;
        for (fqdex = 0; fqdex < fetchQueue.length; ++fqdex)
            if (fetchQueue[fqdex].seq === msg.seq) {
                item = fetchQueue.splice(fqdex, 1)[0];
                if (item.clientId && msg.init.status == 200)
                    fetchPorts[item.clientId] = item.msgport;               // successful lookup
                item.resolve(new Response(msg.body, msg.init));
                break;
            }
    }
})();


/*
 * Reaper
 *
 * Periodic cleanup returning a promise. This removes anything that is obsolete and resolve all
 * associated transactions.
 *
 */

function Reaper() {
    var promise = self.clients.matchAll({
        includeUncontrolled: true
    }).then(function(clientList) {                                          // both sources and clients
        var clients = {};
        for (var clidex in clientList)
            clients[clientList[clidex].id] = clientList[clidex];
        for (var sourceId in msgPorts)
            if (!clients[sourceId]) {
                console.log("[1.0.7+2] source gone:", sourceId);
                delete msgPorts[sourceId];                                  // no longer a source
            }
        for (var clientId in fetchPorts)
            if (!clients[clientId]) {
                console.log("[1.0.7+2] client gone:", clientId);
                delete fetchPorts[clientId];                                // no longer a client
            }
        for (var fqdex = 0; fqdex < fetchQueue.length; ++fqdex) {
            var item = fetchQueue[fqdex];
            while (item.clientId && !clients[item.clientId]
                || !Object.values(msgPorts).includes(item.msgport)) {
                fetchQueue.splice(fqdex, 1);                                // either client or source missing
                item.resolve(new Response(undefined, {
                    status: 404,
                    statusText: "Source Disappeared"                        // if client is gone this disappears too
                }));
                if (fqdex >= fetchQueue.length)
                    break;                                                  // we've run out of transactions
                item = fetchQueue[fqdex];
            }
        }
    });
    return (promise);
}


/*
 * ClearCaches
 *
 * Clear obsolete caches, returning a promise.
 *
 */

function ClearCaches() {
    var promise = caches.keys().then(function(cacheNames) {                 // delete old cache entries
            return (Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName != CurrentCacheName) {
                        console.log('[1.0.7+2] deleting old cache:', cacheName);
                        return (caches.delete(cacheName));
                    }
                })
            ));
        }).then(function() {                                                // claim all clients
            console.log('[1.0.7+2] claiming clients');
            return (self.clients.claim());
        });
    return (promise);
}


/*
 * GetClientResponse
 *
 *     Get message ports from the current clients if they can supply contents for the specified URL.
 * This returns a promise that is resolved after the msgPorts object is updated. Note that the
 * clientId argument is the requester, but the client that actually has the available data will
 * often be a different window.
 *     On the first request from a given client, every source is requested to respond to the URL
 * pathname, and the first one that does is designated the official source for that client. While
 * asking all the sources, this checks every second to see if any of them have gone away so that it
 * does not hang waiting. A source can be unresponsive and delay the fetch forever, e.g. in the
 * debugger, but if the window has closed then it will get reaped and the fetch will complete.
 *     On subsequent requests, to a known source, this does not have a timeout. If the source goes
 * away then the fetch will not complete, but the client is screwed anyway in that case. Eventually
 * the reaper will be called for other reasons and it will clean things up then.
 *
 */

function GetClientResponse(event, urlpath) {

    // delegate
    //
    // Delegate to a source window and return a promise
    //
    function delegate(msgport, clientId) {
        return (new Promise(function(resolve, reject) {
            var seqno = fetchNextSeq++;
            fetchQueue.push({
                seq: seqno,
                msgport: msgport,
                clientId: clientId,
                resolve: resolve
            });
            msgport.postMessage({
                id: "fetch",
                seq: seqno,
                version: "1.0.7+2",
                request: {
                    method: event.request.method,
                    url: event.request.url
                },
            });
        }));
    }

    var clientId;
    if (event.clientId !== "") {
        clientId = event.clientId;
        if (fetchPorts[clientId])
            return (delegate(fetchPorts[clientId], false));
    }
    else
        clientId = event.resultingClientId;                                 // new window
    var pending = [];
    var sourceIds = Object.getOwnPropertyNames(msgPorts);
    for (var mdex = 0; mdex < sourceIds.length; ++mdex)
    {
        var sourceId = sourceIds[mdex];
        pending.push(delegate(msgPorts[sourceId], clientId));
    }
    if (pending.length === 0)
        return (Promise.resolve(new Response(undefined, {
            status: 404,
            statusText: "No Sources"
        })));
    var toid = setInterval(Reaper, 1000);                                   // reap every second while pending
    return (Promise.all(pending).then(function(responses) {
        clearInterval(toid);                                                // all completed
        for (var idex in responses)
            if (responses[idex].status == 200)
                return (responses[idex]);                                   // this is the one we want
        return (responses[0]);                                              // fall back to first
    }));
}


/*
 * install event
 *
 *     Received when the service worker is first installed.
 *
 */

self.addEventListener('install', function(event) {
    console.log("[1.0.7+2] install");
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
            var nocache = event.request.method != "GET"
                || url.search.length !== 0 && url.searchParams.get("naanver") !== "cb-1.0.7+2"
                || event.request.headers.get('range');
            if (url.pathname.startsWith("/run/")) {
                nocache = true;
                if (waitingForInit) {
                    promise = new Promise(function(resolve, reject) {
                        waitingForInit.push(function(){
                            resolve();                                      // init was complete
                        });
                    }).then(function(){
                        return (GetClientResponse(event, url.pathname));    // then get the response
                    });
                } else
                    promise = GetClientResponse(event, url.pathname);
            }
            else
                promise = fetch(event.request).catch(function (e) {
                    console.log("[1.0.7+2] fetch failed", e);
                    return (new Response(undefined, {
                        status: 404,
                        statusText: "Fetch Failed"
                    }));
                });
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
    console.log("[1.0.7+2] activate");
    self.clients.matchAll({                                                 // for debugging, list controlled clients           
        includeUncontrolled: true
    }).then(function(clientList) {
        var urls = clientList.map(function(client) {
            return (client.url);
        });
        console.log('[1.0.7+2] matching clients:', urls.join(', '));
    });
    var promise = ClearCaches();
    if (event.waitUntil)
        event.waitUntil(promise);
});
