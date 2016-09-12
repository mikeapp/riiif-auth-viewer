

var currentService;

function displayOpenSeadragon(tilesource) {
    $('#image').html("<div id='openseadragon' style='width:400px; height:400px'></div>");
    var viewer = OpenSeadragon({
        id: "openseadragon",
        prefixUrl: "/riiif-auth-viewer/openseadragon/images/",
        tileSources: [ tilesource ]
    });
    logit("Created OpenSeadragon", tilesource['@id']);
}


function logit(msg, obj) {
    var time = new Date();
    console.log(msg);
    console.log(obj);
    $('#log').prepend("<p><i>" + time + "</i><br/>" + msg + ": " + obj + "</p>");

}

function logjson(json) {
    var time = new Date();
    console.log(json);
    $('#responses').prepend("<i>" + time + "</i><br/><pre>" + JSON.stringify(json, null, '\t') + "</pre>");
}


function fetchInfo(uri, bearerToken, success, failure) {
    headers = null;
    if (bearerToken) {
        headers = [];
        headers['Authorization'] = "Bearer " + bearerToken;
    }
    $.ajax(
        {
            url: uri,
            type: "GET",
            dataType: 'json',
            headers: headers
        }
    ).done(success).fail(failure);
}


function getAuthService(imageInfo) {
    var service = imageInfo['service'];
    if (service['profile'] == "http://iiif.io/api/auth/0/login") {
        return service;
    }
    return null;
}

function getTokenService(authService) {
    var services = authService['service'];
    if (services['@id']) {
        services = [services];
    }
    var tokenService = null;
    $.each(services, function(index, value) {
       if (value['profile'] == 'http://iiif.io/api/auth/0/token') {
            tokenService = value;
        }
    });
    return tokenService;
}

function openLoginWindow() {
    var w = window.open(currentService['authService']['@id']);
    $(w).on("unload",
      function() {
          continueAuthFlowAfterLogin();
      }
    );
}

function beginAuthFlow(image_id, imageInfo) {
    var authService = getAuthService(imageInfo);
    var tokenService = getTokenService(authService);
    logit("Authentication service", authService['@id']);
    logit('Token service', tokenService['@id']);
    currentService = {
        authService: authService,
        tokenService: tokenService,
        imageInfo: imageInfo,
        pendingImage: image_id
    }
    $("#loginbutton").prop("disabled", false);
    $("#loginbutton").addClass("btn-primary");
    $("#beginbutton").removeClass("btn-primary");
}

function continueAuthFlowAfterLogin() {
    logit("Window closed!", "");
    var id = "1";
    var hostname = location.protocol + "//" + location.host;
    $('#frames').html("<iframe id='" + id + "' src='" + currentService.tokenService['@id'] + "?messageId=" + id + "&origin=" + hostname +"'></iframe>");
}

function continueAuthFlowAfterToken() {
    var imageInfo = currentService['imageInfo'];
    var tokenService = currentService['tokenService'];
    var originalImage = currentService['pendingImage'];
    var firstReturnedImage = imageInfo['@id'];
    var token = currentService['token'];

    fetchInfo(originalImage + "/info.json",
        token,
        function(json) {
            logjson(json);
            var secondReturnedImage = json['@id'];
            if (firstReturnedImage == secondReturnedImage) {
                logit("Same imageId returned after auth, no further action possible", secondReturnedImage);
            } else if (secondReturnedImage == originalImage) {
                logit("Success! Retrieved desired image after auth.", secondReturnedImage);
                displayOpenSeadragon(json);
            } else {
                logit("New image encountered, retry.", secondReturnedImage);
            }
        },
        function(xhr, status, error) {
            logit("AJAX failure (" + status +")", xhr);

        }
    );
}


function showTestImage() {
    var image_id = "http://images.iiif-auth.mikeapps.me/image-service/b16d987c-94de-4b9b-8a3a-588310b9ee9d-3";
    fetchInfo(image_id,
        null,
        function(json) {
            displayOpenSeadragon(json);  // may be the degraded image
            logjson(json);
            if (json['@id'] != image_id) {
                logit("Found new @id, auth required", json['@id']);
                beginAuthFlow(image_id, json);
            }
        },
        function(xhr, status, error) {
            log("AJAX failure (" + status +")", error);

        }
    );
}

window.addEventListener("message", receive_message);

function receive_message(event) {
    data = event.data;
    logit("Message received", data);
    var token, error;
    if (data.hasOwnProperty('accessToken')) {
        token = data.accessToken;
        logit("Token received", token);
        currentService['token'] = token;
        continueAuthFlowAfterToken();
    } else {
    }
}

