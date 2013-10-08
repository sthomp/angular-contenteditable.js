

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

            $element.on("keypress", function(e){
                if($element.text().length==0){
                    document.execCommand('formatBlock', false, '<P>');
                }
            });

            // When creating new lines use <p> instead of <div>
            $element.on("keyup", function(e){
                if (e.which === 13 /* enter */) {
                    var blockType = document.queryCommandValue("formatBlock"); 
                    if(blockType == 'div'){
                        document.execCommand('formatBlock', false, '<P>');
                    }
                    
                }
            });

            $element.on("paste", function(e){
                e.preventDefault();
                var pastedText = e.originalEvent.clipboardData.getData('text/plain');
                document.execCommand('insertHTML', false, pastedText/*.replace(/[\r\n]/g, '<br>')*/);
                
            });

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

            $scope.richEditorApi.removeLink = function(){
                // TODO: Need a better way to remove the link
                document.execCommand("unlink", null, null);
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

            $scope.richEditorApi.toggleUnorderedList = function(){
                document.execCommand("insertUnorderedList", null, false);
            }

            $scope.richEditorApi.toggleOrderedList = function(){
                document.execCommand("insertOrderedList", null, false);
            }

            $scope.richEditorApi.insertLinkBlock = function(url, text, clazz){
                var html = '<a href="' + url + '" contenteditable="false" target="_" class ="' + clazz + '">' + text + '</a>';
                pasteHtmlAtCaret(html, false);
            }

            $scope.richEditorApi.isBold = function(){
                return document.queryCommandState('bold');
            }

            $scope.richEditorApi.isItalic = function(){
                return document.queryCommandState('italic');
            }

            $scope.richEditorApi.isUnderline = function(){
                return document.queryCommandState('underline');
            }

            $scope.richEditorApi.isH1 = function(){
                return document.queryCommandValue('formatBlock') == "h2";
            }

            $scope.richEditorApi.isH2 = function(){
                return document.queryCommandValue('formatBlock') == "h3";
            }

            $scope.richEditorApi.isOL = function(){
                return document.queryCommandState('insertOrderedList');
            }

            $scope.richEditorApi.isUL = function(){
                return document.queryCommandState('insertUnorderedList');
            }

            function traverseUpDom(elem, fn){
                if(fn(elem)){
                    return true;
                }
                else if(elem == $element[0]){
                    return false;
                }
                else{
                    return traverseUpDom(elem.parentNode, fn);
                }
            }

            $scope.richEditorApi.isLink = function(){
                var currentElement = getSelectionBoundaryElement(true);
                var isLink = traverseUpDom(currentElement, function(elem){
                    return elem.tagName.toLowerCase() == "a";
                });
                return isLink;
            }

            $scope.richEditorApi.isLinkWithClass = function(clazz){
                var currentElement = getSelectionBoundaryElement(true);
                var isLinkWithClass = traverseUpDom(currentElement, function(elem){
                    return (elem.tagName.toLowerCase() == "a") && (elem.className.split(" ").indexOf(clazz) != -1);
                });
                return isLinkWithClass;
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

            $element.on("click", function(e){
                var selection = $window.getSelection();
            });

            // Listen for key presses
            $element.on("keypress", function(e){
                $scope.$emit("richeditor:keypress",e);
            });

            $element.on("keyup", function(e){
                $scope.$emit("richeditor:keyup",e);
            });

            /* Helper Functions */

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

            // http://stackoverflow.com/questions/1335252/how-can-i-get-the-dom-element-which-contains-the-current-selection/1335347#1335347 
            // by Tim Down
            function getSelectionBoundaryElement(isStart) {
                var range, sel, container;
                if (document.selection) {
                    range = document.selection.createRange();
                    range.collapse(isStart);
                    return range.parentElement();
                } else {
                    sel = window.getSelection();
                    if (sel.getRangeAt) {
                        if (sel.rangeCount > 0) {
                            range = sel.getRangeAt(0);
                        }
                    } else {
                        // Old WebKit
                        range = document.createRange();
                        range.setStart(sel.anchorNode, sel.anchorOffset);
                        range.setEnd(sel.focusNode, sel.focusOffset);

                        // Handle the case when the selection was selected backwards (from the end to the start in the document)
                        if (range.collapsed !== sel.isCollapsed) {
                            range.setStart(sel.focusNode, sel.focusOffset);
                            range.setEnd(sel.anchorNode, sel.anchorOffset);
                        }
                   }

                    if (range) {
                       container = range[isStart ? "startContainer" : "endContainer"];

                       // Check if the container is a text node and return its parent if so
                       return container.nodeType === 3 ? container.parentNode : container;
                    }   
                }
            }
        }],
        link: function(scope, element, attrs){
        	
        }
    }
}])
