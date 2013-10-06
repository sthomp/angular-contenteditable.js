

/*
 Optional Params:
 data-placeholder="Type your title"
 data-maxlength="3"
 data-singleline
*/
angular.module("richeditor",[])
.directive("ngContentditable", [function(){
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
}])
.directive("richEditor", ['$compile', function($compile){
	return {
        restrict: "E",
        template: "<div class='rich-editor' contenteditable='true'></div>",
        replace: true,
        controller: ['$scope', '$element', '$timeout', '$window', '$document',function($scope, $element, $timeout, $window, $document){
            $scope.richEditorApi = {};

            /* Text Editor */

            function checkIfEmpty(){
                if($element.text()==""){
                    $element.html("");
                }
            }

            // http://stackoverflow.com/questions/1197401/how-can-i-get-the-element-the-caret-is-in-with-javascript-when-using-contentedi
            // by You
            function getSelectionStart() {
                var node = document.getSelection().anchorNode,
                    startNode = (node && node.nodeType === 3 ? node.parentNode : node);
                return startNode;
            }

            // When creating new lines use <p> instead of <div>
            // by http://daviferreira.github.io/medium-editor
            $element.on("keypress", function(e){
                var node = getSelectionStart();
                if (node) {
                    node = node.tagName.toLowerCase();
                }
                if (e.which === 13 && !e.shiftKey) {
                    document.execCommand('formatBlock', false, 'p');
                }
            });

            $element.on("keyup", function(e){
                if(e.keyCode == 8){
                    checkIfEmpty();
                }
            })

            /* http://stackoverflow.com/questions/6690752/insert-html-at-caret-in-a-contenteditable-div/6691294#6691294
            * by Tim Down */
            function pasteHtmlAtCaret(html, selectPastedContent) {
                var sel, range;
                if (window.getSelection) {
                    // IE9 and non-IE
                    sel = window.getSelection();
                    if (sel.getRangeAt && sel.rangeCount) {
                        range = sel.getRangeAt(0);
                        range.deleteContents();

                        // Range.createContextualFragment() would be useful here but is
                        // only relatively recently standardized and is not supported in
                        // some browsers (IE9, for one)
                        var el = document.createElement("div");
                        el.innerHTML = html;
                        var frag = document.createDocumentFragment(), node, lastNode;
                        while ( (node = el.firstChild) ) {
                            lastNode = frag.appendChild(node);
                        }
                        var firstNode = frag.firstChild;
                        range.insertNode(frag);

                        // Preserve the selection
                        if (lastNode) {
                            range = range.cloneRange();
                            range.setStartAfter(lastNode);
                            if (selectPastedContent) {
                                range.setStartBefore(firstNode);
                            } else {
                                range.collapse(true);
                            }
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    }
                } else if ( (sel = document.selection) && sel.type != "Control") {
                    // IE < 9
                    var originalRange = sel.createRange();
                    originalRange.collapse(true);
                    sel.createRange().pasteHTML(html);
                    var range = sel.createRange();
                    range.setEndPoint("StartToStart", originalRange);
                    range.select();
                }
            }

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

            $scope.richEditorApi.setBlockH1 = function(){
                document.execCommand("formatBlock", null, "<H2>");
            }

            $scope.richEditorApi.setBlockH2 = function(){
                document.execCommand("formatBlock", null, "<H3>");
            }

            $scope.richEditorApi.clearBlock = function(){
                document.execCommand("formatBlock", null, "<P>");
            }

            $scope.richEditorApi.insertUnorderedList = function(){
                document.execCommand("insertUnorderedList", null, false);
            }

            $scope.richEditorApi.insertOrderedList = function(){
                document.execCommand("insertOrderedList", null, false);
            }

            $scope.richEditorApi.insertLinkBlock = function(url, text){
                //document.execCommand("insertHTML", false, "<a href='" + url + "' contenteditable='false'>" + text + "</a>");
                var newElement = document.createElement('a');
                newElement.contentEditable=false;
                newElement.href=url;
                newElement.text=text;
                //var range = window.getSelection().getRangeAt(0);
                //range.insertNode(newElement);
                //var embed = '<a href="www.google.com" contenteditable>blah blah</a>';
                pasteHtmlAtCaret('<a href="' + url + '" contenteditable="false" target="_">' + text + '</a>', false);
                //document.execCommand("Inserthtml", false, newElement);
                //document.execCommand('insertunorderedlist', false, '');
            }

            /* Events */

        	// Listen for text selection
        	$element.on("mouseup keyup", function(e){
        		var selection = $window.getSelection();
                if(selection.type=="Range"){
                    $scope.$emit("richeditor:selection",e);
                }
                else{

                }
        	});

            // Listen for key presses
            $element.on("keypress", function(e){
                $scope.$emit("richeditor:keypress",e);
            });
        }],
        link: function(scope, element, attrs){
        	
        }
    }
}])
