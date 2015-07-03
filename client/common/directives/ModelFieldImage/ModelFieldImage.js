angular.module('dashboard.directives.ModelFieldImage', [
  "dashboard.services.GeneralModel"
])

.directive('modelFieldImageView', function($compile) {
  return {
    restrict: 'E',
    template: '<b>{{ field.label }}</b>: {{ data[field.name] }}',
    scope: {
      field: '=options',
      data: '=ngModel'
    },
    link: function(scope, element, attrs) {

    }
  };
})

.directive('modelFieldImageEdit', function($compile, $document, GeneralModelService, SessionService) {
  return {
    restrict: 'E',
    template: '<div class="image-container" style="background: no-repeat center center url(\'{{ imageUrl }}\'); background-size: contain;" ng-click="imageClick()"></div> \
      <div class="button-menu show-menu">\
      <button class="btn btn-default upload-button">Select File</button> \
      <button class="btn btn-default clear-button" ng-show="imageUrl" ng-click="clear()">Clear</button> \
      </div> \
      <div ng-file-drop="onFileSelect($files)" ng-file-drag-over-class="optional-css-class-name-or-function" ng-show="dropSupported && !disabled" class="image-drop">{{ uploadStatus }}</div> \
      <div ng-file-drop-available="dropSupported=true" ng-show="!dropSupported">HTML5 Drop File is not supported!</div> \
      <input type="file" ng-file-select="onFileSelect($files)" ng-hide="disabled"> \
      <button ng-click="upload.abort()" class="cancel-button">Cancel Upload</button>',
    scope: {
      key: "=key",
      options: '=options',
      disabled: '=disabled',
      data: '=ngModel',
      modelData: '=modelData'
    },
    link: function(scope, element, attrs) {
        var selectedFile = null;

        scope.uploadStatus = "Upload File";

        /**
         * scope.data updates async from controller so need to watch for the first change only
         */
        var unwatch = scope.$watch('data', function(data) {
          if (data) { 
            unwatch(); //Remove the watch
            if (!scope.options || !scope.options.model) {
              //Not a Table reference (the field contains the image URL)
              if (typeof data === "string") {
                scope.imageUrl = data;
              } else if (typeof data === "object") {
                if (data.fileUrl) scope.imageUrl = data.fileUrl;
                if (data.imageUrl) scope.imageUrl = data.imageUrl;
              }
            } else {
              //Media table reference (data is the ID reference)
              GeneralModelService.get(scope.options.model, data)
              .then(function(response) {
                if (!response) return;  //in case http request was cancelled
                //scope.options.urlKey defines the column field name for where the URL of the image is stored
                scope.imageUrl = response[scope.options.urlKey];
                if (!scope.imageUrl) scope.imageUrl = response["mediumUrl"]; //HACK FOR SMS PROJECT (PROB SHOULD REMOVE)
              });
              
            }
            
          }
       });

        //Use the FileReader to display a preview of the image before uploading
        var fileReader = new FileReader();
        fileReader.onload = function (event) {
          
          //Set the preview image via scope.imageUrl binding
          scope.imageUrl = event.target.result;
          
          //Check for any export requirements and export image of various sizes specified in config
          if (scope.options && scope.options.export) {
            scope.uploadStatus = "Creatimg Image Sizes";
            scope.exportImages(function() {
              scope.uploadStatus = "Upload File";
              scope.$apply();
            });
          }
          scope.$apply();
        };
        fileReader.onerror = function(error) {
          console.log(error);
        };

        scope.clear = function() {
          //Clear out an existing selected image
          scope.data = null; //null out the data field
          if (scope.modelData.__ModelFieldImageData && scope.modelData.__ModelFieldImageData[scope.key]) {
            //make sure to remove any pending image uploads for this image field
            delete scope.modelData.__ModelFieldImageData[scope.key];
          }
          delete scope.imageUrl; //remove the preview image
        };
        
        scope.onFileSelect = function($files) {
          //$files: an array of files selected, each file has name, size, and type.
          if ($files.length < 1) return;
          selectedFile = $files[0];
          var s3Path = scope.options.path; //S3 path needed when getting S3 Credentials for validation;
          
          //bind back to parent scope's __ModelFieldImageData object with info on selected file
          if (!scope.modelData.__ModelFieldImageData) scope.modelData.__ModelFieldImageData = {};
          if (scope.options && scope.options.urlKey) {
            //When field options involve a reference table use model key and urlKey as reference 
            if (!scope.modelData.__ModelFieldImageData[scope.key]) scope.modelData.__ModelFieldImageData[scope.key] = {};
            scope.modelData.__ModelFieldImageData[scope.key][scope.options.urlKey] = {path: s3Path, file: selectedFile};
          } else {
            //No table reference (file URL assigned directly into current model's field)
            scope.modelData.__ModelFieldImageData[scope.key] = {path: s3Path, file: selectedFile};
          }
                    
          //Load the Preview before uploading
          fileReader.readAsDataURL(selectedFile);

        };

        scope.exportImages = function(callback) {
          var index = arguments[1];
          if (!index) index = 0;
          var keys = Object.keys(scope.options.export);
          
          if (index >= keys.length) {
            callback(); //finished exporting images
            return;
          }
          var exportKey = keys[index];
          var settings = scope.options.export[exportKey];
          scope.resizeImage(scope.imageUrl, settings, function(blob) {
            //Store resized image as a blob in __ModelFieldImageData using exportKey
            scope.modelData.__ModelFieldImageData[scope.key][exportKey] = blob;
            index++;
            scope.exportImages(callback, index);
          });
        };
        
        scope.resizeImage = function(imageUrl, settings, callback) {
          var canvas = document.createElement("canvas");
          var context = canvas.getContext("2d");

          var image = new Image();
          image.onload = function() {
            var width = settings.width;
            var height = settings.height;
            if (!settings.aspect) {
              settings.aspect = "fit";
            }
            switch(settings.aspect) {
              case "stretch":
                canvas.width = width;
                canvas.height = height;
                break;
              case "fill": {
                canvas.width = width;
                canvas.height = height;
                var scale = Math.max(width / image.width, height / image.height);
                width = image.width * scale;
                height = image.height * scale;
              } break;
              case "fit":
              default: {
                var scale = Math.min(width / image.width, height / image.height);
                width = image.width * scale;
                height = image.height * scale;
                canvas.width = width;
                canvas.height = height;
              } break;
          }
            
            context.drawImage(image, 0, 0, width, height);
            var dataUrl = canvas.toDataURL("image/jpeg", 0.8);
            var blob = scope.dataURItoBlob(dataUrl);
            callback(blob);
          };
          image.src = imageUrl;
        };
        
        scope.dataURItoBlob = function(dataURI) {
          // convert base64/URLEncoded data component to raw binary data held in a string
          var byteString;
          if (dataURI.split(',')[0].indexOf('base64') >= 0)
              byteString = atob(dataURI.split(',')[1]);
          else
              byteString = unescape(dataURI.split(',')[1]);

          // separate out the mime component
          var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

          // write the bytes of the string to a typed array
          var ia = new Uint8Array(byteString.length);
          for (var i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
          }

          return new Blob([ia], {type:mimeString});
        };
        
        scope.imageClick = function() {
          //When user clicks the image container
          if (scope.options && scope.options.isLightbox || scope.options.isLightboxWithZoom) {
            //Display Full Screen
            var image = new Image();
            image.onload = function () {
              var $modal = $('<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color:rgba(0,0,0,0); z-index: 9999;"></div>');
              var $container = $('<div style="position: absolute; top: 5%; left: 5%; right: 5%; bottom: 5%; opacity: 0.0; cursor: pointer;"></div>');
              $modal.append($container);
              $("body").append($modal);

              if (scope.options.isLightbox) {
                //Lightbox only
                var scale = Math.min($container.width() / image.width, $container.height() / image.height);
                var width = image.width * scale;
                var height = image.height * scale;
                $container.css({
                  background: 'no-repeat center center url(' + scope.imageUrl + ')',
                  backgroundSize: width + 'px ' + height + 'px'
                });
              } else {
                //Lightbox with zoom capability
                var $thumbnail = $('<div style="display: inline-block; width: 30%; height: 100%;"></div>');
                var $zoom = $('<div style="display: inline-block; width: 70%; height: 100%"></div>');
                $container.append($thumbnail);
                $container.append($zoom);
                var scale = Math.min($thumbnail.width() / image.width, $thumbnail.height() / image.height);
                var thumbnailWidth = image.width * scale;
                var thumbnailHeight = image.height * scale;
                $thumbnail.css({
                  background: 'no-repeat center center url(' + scope.imageUrl + ')',
                  backgroundSize: thumbnailWidth + 'px ' + thumbnailHeight + 'px'
                });
                scale = 1.0;
                var zoomWidth = image.width * scale;
                var zoomHeight = image.height * scale;
                $zoom.css({
                  background: 'no-repeat center center url(' + scope.imageUrl + '), #111',
                  backgroundSize: zoomWidth + 'px ' + zoomHeight + 'px',
                  border: 'solid 1px #000'
                });
                $thumbnail.on("mousemove", function(event) {
                  var x = event.offsetX;
                  var y = event.offsetY;
                  if (!x) x = event.pageX; //Firefox
                  if (!y) y = event.pageY; //Firefox

                  //calculate position on thumbnail
                  x -= $thumbnail.width()/2 - thumbnailWidth/2;
                  y -= $thumbnail.height()/2 - thumbnailHeight/2;

                  //find position to zoom to
                  x *= -zoomWidth/thumbnailWidth; //scale
                  y *= -zoomHeight/thumbnailHeight;
                  x += $zoom.width()/2; //center
                  y += $zoom.height()/2;
                  $zoom.css({ backgroundPosition: x + "px " + y + "px" });
                });

              }
              $modal.animate({backgroundColor: "rgba(0,0,0,0.65)"}, 600, function () {
                $container.animate({opacity: 1.0}, 300);
              });
              $container.click(function () {
                $modal.animate({opacity: 0}, 300, function () {
                  $modal.remove();
                });
              });

            };
            image.src = scope.imageUrl;
          } else {
            var $imageContainer = element.find(".image-container");
            if ($imageContainer.width() <= 160) {
              $imageContainer.animate({width: "400px", height: "400px"}, 300);
            } else {
              $imageContainer.animate({width: "160px", height: "160px"}, 300);

            }
          }
        };
        
        //Prevent accidental file drop
        $document.on("drop", function(event) {
          if (event.target.nodeName != "INPUT") {
            event.preventDefault();
          } 
        });

        $document.on("dragover", function( event ) {
          event.preventDefault();
          //Show Drop Target
          element.find(".image-drop").addClass("show-upload");
          element.find(".input[type=file]").addClass("show-upload");
          element.find(".button-menu").addClass("hide-menu");
        });

        $(window).on("mouseleave", function() {
          //Hide Drop Target
          element.find(".image-drop").removeClass("show-upload");
          element.find(".input[type=file]").removeClass("show-upload");
          element.find(".button-menu").removeClass("hide-menu");
        });

        scope.$on('$destroy', function() {
          //event clean up
          $document.off("drop");
          $document.off("dragover");
          $(window).off("mouseleave");
        });


    }
  };
})

;
