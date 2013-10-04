var app = angular.module("myapp",[]);

app.controller('myctrl',['$scope',function($scope){
	$scope.model = {
		title: ""
	}




    $scope.$on("richeditor:selection", function(e, data){
        $scope.richEditorApi.setSelectionLink("www.yahoo.com")
    });
}]);

/*
 Optional Params:
 data-placeholder="Type your title"
 data-maxlength="3"
 data-singleline
*/
app.directive("ngContentditable", [function(){
	return {
        restrict: "A",
        require: '?ngModel', // get a hold of NgModelController
        controller: ['$scope', '$element', '$timeout', function($scope, $element, $timeout){
        	
        }],
        link: function(scope, element, attrs, ngModel){
        	element.attr("contenteditable","true");

        	/* Check if we need to prevent input. ie: maxlength or singleline input */
        	element.on('keydown', function(e){
        		if(attrs.singleline != undefined && e.keyCode==13){
        			e.preventDefault();
        		}
        		else{
        			if(attrs.maxlength){
	        			if((e.keyCode==32 || e.keyCode > 46) && element.text().length >= attrs.maxlength){
		        			e.preventDefault();
		        		}
	        		}
        		}
        	});

        	function safeApply(){
	        	var phase = scope.$root.$$phase
	        	if(phase != '$apply' && phase !=' $digest'){
	        		scope.$apply();
	        	}
	        }

	        function checkIfEmpty(){
	        	if(element.text()==""){
	        		element.html("");
	        	}
	        }

        	// Listen for changes to the model
        	ngModel.$render = function() {
        		element.text(ngModel.$viewValue || '');
        		checkIfEmpty();
	        };

	        // Listen for changes to the html element
	        element.on('blur keyup change', function(e) {
	        	ngModel.$setViewValue(element.text());
	        	checkIfEmpty();
	        	safeApply();
	        });
        }
    }
}]);








app.directive("richEditor", ['$compile', function($compile){
	return {
        restrict: "E",
        template: "<div class='rich-editor' contenteditable='true'></div>",
        replace: true,
        controller: ['$scope', '$element', '$timeout', '$window', '$document',function($scope, $element, $timeout, $window, $document){
            $scope.richEditorApi = {};

            /* API */

            $scope.richEditorApi.toggleSelectionBold = function(){
                document.execCommand("bold", null, false);
            }

            $scope.richEditorApi.toggleSelectionItalic = function(){
                document.execCommand("italic", null, false);
            }

            $scope.richEditorApi.toggleSelectionUnderline = function(){
                document.execCommand("underline", null, false);
            }

            $scope.richEditorApi.setSelectionLink = function(url){
                document.execCommand("CreateLink", null, url);
            }

            /* Events */

        	// Listen for text selection
        	$element.on("mouseup keyup", function(e){
        		var selection = $window.getSelection();
                if(selection.type=="Range"){
                    $scope.$emit("richeditor:selection",{});
                }
                else{

                }
        	});
        }],
        link: function(scope, element, attrs){
        	
        }
    }
}])
.directive("richEditorToolbar", [function(){
	return {
        restrict: "E",
        scope: {},
        templateUrl: "richEditorToolbar.html",
        replace: true,
        controller: ['$scope', '$element', '$timeout', '$window',function($scope, $element, $timeout, $window){

        }],
        link: function(scope, element, attrs){

        }
    }
}]);