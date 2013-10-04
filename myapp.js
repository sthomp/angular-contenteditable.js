var app = angular.module("myapp",[]);

app.controller('myctrl',['$scope',function($scope){
	$scope.model = {
		title: ""
	}
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
        scope: {},
        template: "<div class='rich-editor' contenteditable='true'></div>",
        replace: true,
        controller: ['$scope', '$element', '$timeout', '$window',function($scope, $element, $timeout, $window){

        	$scope.model = {
        		richEditorToolbar: {
        			isShown: false,
        			element: $compile("<rich-editor-toolbar></rich-editor-toolbar>")($scope)
        		}
        	}

        	function hideRichEditorToolbar(){
        		if($scope.model.richEditorToolbar.isShown){
        			$scope.model.richEditorToolbar.element.remove();
        			$scope.model.richEditorToolbar.isShown = false;
        		}
        	}

        	function showRichEditorToolbar(){
        		if(!$scope.model.richEditorToolbar.isShown){
	        		$element.after($scope.model.richEditorToolbar.element);
	        		$scope.model.richEditorToolbar.isShown = true;
        		}
        	}

        	// Get a text selection or return null
        	function getMaybeSelection(){
        		var selection = $window.getSelection();
        		if(selection.type=="Range"){
        			var range = selection.getRangeAt(0);
        			showRichEditorToolbar();
        		}
        		else{
        			hideRichEditorToolbar();
        			return null;
        		}
        	}

        	// Listen for mouse selection
        	$element.on("mouseup keyup", function(e){
        		getMaybeSelection();
        	});

        	// If the user clicks anywhere except the toolbar element then close it
        	$window.onclick = function (e) {
        		if($scope.model.richEditorToolbar.isShown){
        			if(!e.target.classList.contains('rich-editor')){
        				var elem = angular.element(e.target);
        				console.log("hide");
        				hideRichEditorToolbar();
        			}
        		}
	        };
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