angular.module('dashboard.directives.ModelFieldCanvas', [
    'dashboard.Dashboard.Model.Edit.SaveDialog',
    "dashboard.Config",
    "ui.bootstrap",
    "dashboard.services.GeneralModel",
    "ui.select"
  ])

.directive('modelFieldCanvasView', function($compile) {
  "ngInject";

  return {
    restrict: 'E',
    template: '<b>{{ options.model }}</b>: {{ data[options.key] }}',
    scope: {
      options: '=options',
      data: '=ngModel',
      required: 'ngRequired',
      disabled: 'disabled'
    },
    link: function(scope, element, attrs) {
    }
  };
})

.directive('modelFieldCanvasEdit', function($compile, $cookies, $timeout, Config, FileUploadService) {
  "ngInject";

  function getTemplate() {
    var template = '\
    <img ng-src="{{ data.fileUrl || data }}" crossOrigin="anonymous" class="disabled-div" ng-hide="!disabled"/></img>\
    <canvas ng-hide="disabled" ng-signature-pad="signature" width="300" height="150" ng-mouseup="changed()"></canvas>\
    <button ng-hide="disabled" class="btn btn-default" ng-click="clearCanvas()">Clear</button>\
  ';
    return template;
  }

  return {
    restrict: 'E',
    require: "ngModel",
    scope: {
      key: '=key',
      property: '=property',
      options: '=options',
      data: '=ngModel',
      modelData: '=modelData',
      disabled: '=ngDisabled',
      ngChange: '&',
    },
    link: function(scope, element, attrs, ngModel) {

      scope.isLoading = true;
      scope.signature = {};

      scope.$on('revertDataSignature', function($event, key) {
        if (key !== scope.key) return;
        $timeout(function() {
          scope.isLoading = true;
          var canvas = scope.signature._canvas;
          var context = scope.signature._canvas.getContext("2d");
          context.clearRect(0, 0, canvas.width, canvas.height);
          drawNewImage()
        }, 1)
      })

      scope.clearCanvas = function() {
        var canvas = scope.signature._canvas;
        var context = scope.signature._canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height)
        scope.data = null;
        if (scope.ngChange) {
          setTimeout(function() {
            scope.ngChange({key: scope.key})
          }, 1)
        }
      };

      scope.$watch('signature._mouseButtonDown', function() {
        drawNewImage()
      });

      function drawNewImage() {
        if (scope.signature.fromDataURL && scope.isLoading) {
          //Load Existing Signature
          scope.isLoading = false;
          //Load Image because of CORS issue
          var image = new Image();
          image.setAttribute('crossOrigin', 'anonymous');
          image.onload = function() {
            var context = scope.signature._canvas.getContext("2d");
            context.drawImage(image, 0, 0);
          };
          if (scope.data && typeof scope.data === 'object' && scope.data.fileUrl) {
            image.src = scope.data.fileUrl;
          } else {
            image.src = scope.data;
          }
        } else if (scope.signature.toDataURL) {
          //When done signing store into data
          var dataUrl = scope.signature.toDataURL();
          scope.data = dataUrl;
        }
      }

      scope.changed = function() {
        if (scope.ngChange) {
          setTimeout(function() {
            scope.ngChange({key: scope.key})
          }, 1)
        }
      }

      element.html(getTemplate()).show();
      $compile(element.contents())(scope);
    }
  };
})

;
