

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
    var params = {
        url: uri,
        type: "GET",
        dataType: 'json'
    };
    if (bearerToken) {
        headers = [];
        headers['Authorization'] = "Bearer " + bearerToken;
        params['headers'] = headers;
    }
    $.ajax(
        params
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
    var popupchecker = window.setInterval(
      function() {
          if (w.closed !== false) {
              window.clearInterval(popupchecker);
              continueAuthFlowAfterLogin();
          }
      }, 200
    );
}

function beginAuthFlow(image_id, imageInfo) {
    var authService = getAuthService(imageInfo);
    var tokenService = getTokenService(authService);
    logit("Identified Login service", authService['@id']);
    logit('Identified Token service', tokenService['@id']);
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

    fetchInfo(originalImage,
        token,
        function(json) {
            logjson(json);
            var secondReturnedImage = json['@id'] + '/info.json';
            if (firstReturnedImage == secondReturnedImage) {
                logit("Same image @id returned after authentication, no further action possible, use degraded image", secondReturnedImage);
            } else if (secondReturnedImage == originalImage) {
                logit("Retrieved image originally requested", secondReturnedImage);
                displayOpenSeadragon(json);
            } else {
                logit("New image @id encountered, retry", secondReturnedImage);
            }
        },
        function(xhr, status, error) {
            logit("Failure (" + status +")", xhr);

        }
    );
}


function showTestImage() {
    window.addEventListener("message", receive_message);
    var image_id = "http://images.iiif-auth.mikeapps.me/image-service/b16d987c-94de-4b9b-8a3a-588310b9ee9d-3/info.json";
    logit('Intitial request for IIIF image', image_id);
    fetchInfo(image_id,
        null,
        function(json) {
            displayOpenSeadragon(json);  // may be the degraded image
            logjson(json);
            if (json['@id'] != image_id) {
                logit("Found image with new @id, this is a degraded image", json['@id']);
                beginAuthFlow(image_id, json);
            }
        },
        function(xhr, status, error) {
            console.log(xhr);
            logit("AJAX failure (" + status +")", error);

        }
    );
}



function receive_message(event) {
    data = event.data;
    logit("PostMessage received", data);
    var token, error;
    if (data.hasOwnProperty('accessToken')) {
        token = data.accessToken;
        logit("Auth token received in PostMessage", token);
        currentService['token'] = token;
        continueAuthFlowAfterToken();
    } else {
    }
}

