/*
 * index.js
 * naanide-relay
 * 
 * Yandex Cloud Function for proxying API requests from NaanIDE in the browser.
 *
 * This function acts as a relay (mitm) proxy so that a browser may access Yandex Cloud APIs without
 * needing a transient access token and without CORS problems. Security is provided by a pre-shared
 * static key, configured as an environment variable in the YCF and known to the browser code.
 *
 * The request to the proxy should be precisely what is intended for the target API, except that the
 * following headers should be included:
 *
 *      x-naanide-auth:     <pre-shared-key>
 *      x-naanide-ep:       <target-url-with-path-and-query-variables>
 *      x-naanide-hdrs:     <optional headers>
 *
 * The response in the browser contains some remapped headers, but is otherwise the API's response.
 *
 * Assuming the pre-shared key is "foo", the following gets a list of YDB databases in a folder:

curl -H "x-naanide-auth: foo" \
     -H "x-naanide-ep: https://ydb.api.cloud.yandex.net/ydb/v1/databases?folderId=b1gjjahqm5u9tjolom9l" \
     'https://functions.yandexcloud.net/d4e5gicpajcqdbj91jt8'

 *
 * column positioning:                          //                          //                      !
 *
 * Copyright (c) 2022 by Richard C. Zulch
 * 
 */


/*
 * index.handler
 *
 * Forward a request and respond with the result.
 *
 */

module.exports.handler = async function (event, context) {
    "use strict";
    const authorizationKey = process.env.NAANIDE_AUTH_KEY;
    
    //
    // OPTIONS request
    //
    // Allow our headers for CORS
    //

    if (event.httpMethod == "OPTIONS")
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Headers": "*"
            }
        };
    
    //
    // Failed authentication
    //

    if (event.headers["X-Naanide-Auth"] != authorizationKey) {
        return {
            statusCode: 401
        };
    }
    
    //
    // Authenticated
    //

    let https = require("https");
    let url = event.headers["X-Naanide-Ep"];
    let headers = event.headers["X-Naanide-Hdrs"];
    if (headers) {
        try {
            headers = JSON.parse(headers);
        } catch (e) {
            console.log("X-Naanide-Hdrs parse error", e);
            headers = false;
        }
    }
    if (!headers)
        headers = { };
    if (!headers[Object.keys(headers).find(key => key.toLowerCase() === "authorization")])
        headers.Authorization = context.token.token_type.concat(" ", context.token.access_token);
    let options = {
        method: event.httpMethod,
        headers: headers
    };
    let chunks = [];
    let content = false;
    let finalResponse = {
        statusCode: 500
    };

    //
    // forward_request
    //
    async function forward_request() {
        return new Promise(function(resolve, reject) {
            let req = https.request(url, options, function(resp) {
                finalResponse.statusCode = resp.statusCode;
                // data event
                resp.on("data", function (chunk) {
                    chunks.push(chunk);
                });
                // end event
                resp.on("end", function () {
                    if (resp.complete)
                    {
                        let content = Buffer.concat(chunks);
                        let contentType = resp.headers["content-type"];
                        finalResponse.body = content.toString();
                        if (resp.headers["x-request-id"]) {
                            resp.headers["x-upstream-request-id"] = resp.headers["x-request-id"];
                            delete resp.headers["x-request-id"];
                        }
                        finalResponse.headers = resp.headers;
                    }
                    else {
                        console.log("request terminated before full response received");
                        finalResponse.statusCode = 502;
                    }
                    resolve();
                });
            });
            // error event
            req.on("error", function (err) {
                console.log("upstream request error:", err);
                finalResponse.statusCode = 502;
                reject(err);
            });
            console.log("event.body", event.body, event.isBase64Encoded);
            if (event.body) {
                if (event.isBase64Encoded)
                    req.write(decodeURIComponent(escape(atob(event.body))));
                else
                    req.write(event.body);
            }
            req.end();
        });
    }
    
    await forward_request();
    return finalResponse;
}
