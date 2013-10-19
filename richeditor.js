

/*
 Optional Params:
 data-placeholder="Type your title"
 data-maxlength="3"
 data-singleline
*/
angular.module("richeditor",[])
// https://github.com/angular/angular.js/issues/2690
.factory('debounce', ['$timeout', function ($timeout) {
    return function(fn, timeout, apply){ // debounce fn
        timeout = angular.isUndefined(timeout) ? 0 : timeout;
        apply = angular.isUndefined(apply) ? true : apply; // !!default is true! most suitable to my experience
        var nthCall = 0;
        return function(){ // intercepting fn
            var that = this;
            var argz = arguments;
            nthCall++;
            var later = (function(version){
                return function(){
                    if (version === nthCall){
                        return fn.apply(that, argz);
                    }
                };
            })(nthCall);
            return $timeout(later, timeout, apply);
        };
    };
}])
.factory('throttle', ['$timeout', function ($timeout) {
    return function(func, wait, options) {
        var context, args, result;
        var timeout = null;
        var previous = 0;
        var getTime = (Date.now || function() {
            return new Date().getTime();
        });
        options || (options = {});
        var later = function() {
          previous = options.leading === false ? 0 : getTime();
          timeout = null;
          result = func.apply(context, args);
        };
        return function() {
          var now = getTime();
          if (!previous && options.leading === false) previous = now;
          var remaining = wait - (now - previous);
          context = this;
          args = arguments;
          if (remaining <= 0) {
            clearTimeout(timeout);
            timeout = null;
            previous = now;
            result = func.apply(context, args);
          } else if (!timeout && options.trailing !== false) {
            timeout = setTimeout(later, remaining);
          }
          return result;
        };
    };
}])
.directive("stNotEditable", [function(){
    return {
        restrict: "A",
        replace: true,
        controller: ['$scope', '$document', function($scope,$document){
            $document.on('selectionchange', function(e){
                
            });
        }],
        link: function(scope,element,attrs){
            
        }
    }
}])
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
.directive("richEditor", ['$compile', 'debounce', 'throttle',function($compile, debounce, throttle){
	return {
        restrict: "E",
        template: "<div class='rich-editor' contenteditable='true'></div>",
        replace: true,
        controller: ['$scope', '$element', '$timeout', '$window', '$document',function($scope, $element, $timeout, $window, $document){
            $scope.richEditorApi = {
                
            };

            $scope.richEditorApi.currentSelection = {
                anchorOffset: null,
                focusOffset: null,
                anchorNode: null,
                focusNode: null
            }

            var updateSelection = throttle(function(e){
                $timeout(function(){
                    var selection = $window.getSelection();
                    $scope.richEditorApi.currentSelection.anchorOffset = selection.anchorOffset;
                    $scope.richEditorApi.currentSelection.focusOffset = selection.focusOffset;
                    $scope.richEditorApi.currentSelection.anchorNode = selection.anchorNode;
                    $scope.richEditorApi.currentSelection.focusNode = selection.focusNode;
                })
            }, 200);

            $scope.$watchCollection('[richEditorApi.currentSelection.anchorOffset, richEditorApi.currentSelection.focusOffset, richEditorApi.currentSelection.anchorNode, richEditorApi.currentSelection.focusNode]', function() {
                var selection = $window.getSelection();
                var isRangeSelection = selection.anchorOffset!=selection.focusOffset;
                if(isRangeSelection && isElementInsideEditor(selection.focusNode)){
                    $scope.$emit("richeditor:selection");
                }
            });


            $element.append('<p style="min-height:1em;"></p>');

            // Listen to mouse and keyboard and update the selection so we can capture selection change events
            $document.on("keydown keyup keypress mousemove mousedown mouseup mouseclick", function(e){
                updateSelection();
            });

            // Make sure <br> tags are off when pressing return
            document.execCommand('insertBrOnReturn',false, false);

            function preventEmptyNode(){
                var blockType = document.queryCommandValue("formatBlock");
                var check = blockType!="p" && blockType!="h1" && blockType!="h2" && blockType!="h3";
                if(check){
                    document.execCommand('formatBlock', false, '<p>');
                    $element.focus();   // for some reason Firefox loses focus after formatBlock
                }
            }

            /* Text Editor */
            $element.on("focus", function(e){
                if($element.text().length==0){
                    $element.addClass("empty");
                }
                else{
                    $element.removeClass("empty");
                }
            });

            // Called every time the content changes
            $element.on("input", function(e){
                preventEmptyNode();
                if($element.text().length==0){
                    $element.addClass("empty");
                }
                else{
                    $element.removeClass("empty");
                }

                $scope.$emit("richeditor:input",e);
            });

            $element.on("keypress", function(e){
                $scope.$emit("richeditor:keypress",e);
            });

            $element.on("keyup", function(e){
                $scope.$emit("richeditor:keyup",e);
            });

            // doesnt work in firefox
            // $element.on("textInput", function(e){
            //     $scope.$emit("richeditor:textInput",e);
            // });

            $element.on("paste", function(e){
                e.preventDefault();
                var html = '';
                var pastedText = e.originalEvent.clipboardData.getData('text/plain');
                document.execCommand('insertText', false, pastedText);
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
                var html = '<a href="' + url + '" contenteditable="false" target="_" class ="' + clazz + '" readonly>' + text + '</a>';
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

            // Traverse up from the current node
            // Return true if the given condition is met
            function traverseUpDom(elem, fn){
                if(!elem || !fn){
                    return false;
                }
                else if(fn(elem)){
                    return elem;
                }
                else if(elem.nodeName.toLowerCase()=="body"){
                    return false;
                }
                else if(elem == $element[0]){
                    return false;
                }
                else{
                    return traverseUpDom(elem.parentNode, fn);
                }
            }

            function isElementInsideEditor(elem){
                var result =  traverseUpDom(elem, function(elem){
                    return elem == $element[0];
                });
                return result;
            }

            $scope.richEditorApi.isLink = function(){
                var currentElement = getSelectionBoundaryElement(true);
                var isLink = traverseUpDom(currentElement, function(elem){
                    return elem.tagName.toLowerCase() == "a";
                });
                if(isLink){
                    return true;
                }
                else{
                    return false;
                }
            }

            $scope.richEditorApi.isLinkWithClass = function(clazz){
                var currentElement = getSelectionBoundaryElement(true);
                var isLinkWithClass = traverseUpDom(currentElement, function(elem){
                    return (elem.tagName.toLowerCase() == "a") && (elem.className.split(" ").indexOf(clazz) != -1);
                });
                return isLinkWithClass;
            }

            $scope.richEditorApi.focus = function(){
                $element.focus();
                // set cursor at the end
                var range = document.createRange();
                range.selectNodeContents($element[0]);
                range.collapse(false);
                var selection = $window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }

            /* Capture Text Input */

            function isInsideAtomicElement(theElement){
                return traverseUpDom(theElement, function(elem){
                    return angular.element(elem).attr("atomic-element");
                });
            }

            $scope.richEditorApi.rangeHelper = {
                setCursorAfterNode: function(node){
                    var range = document.createRange();
                    range.setStartAfter(node);
                    range.setEndAfter(node);
                    range.collapse(false);
                    var selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }

            $scope.richEditorApi.capture = {
                elem: document.createElement("span"),
                isCapturing: false, // This is set through a watch on elem.parentElement
                start: function(initString){
                    preventEmptyNode();
                    $timeout(function(){
                        var newnode = angular.element($scope.richEditorApi.capture.elem);
                        newnode.text(initString);
                        newnode.addClass('capture-range');
                        // Get current cursor position
                        var s1 = document.getSelection();
                        var atomicElement = isInsideAtomicElement(s1.anchorNode);
                        
                        // Make sure we're not inserting inside an atomic element
                        if(atomicElement){
                            // If we are inside an atomic element then insert after the element
                            angular.element(atomicElement).after(newnode);
                        }
                        else{
                            // Otherwise just insert at the cursor location
                            s1.getRangeAt(0).insertNode(newnode[0]);
                        }
                        // Set the cursor inside the node
                        var range = document.createRange();
                        range.selectNodeContents(newnode[0]);
                        range.collapse(false);
                        var selection = $window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(range);
                    })
                    
                },
                cancel: function(){
                    $timeout(function(){
                        var contents = angular.element($scope.richEditorApi.capture.elem).contents().last();
                        contents.unwrap();
                        $scope.richEditorApi.rangeHelper.setCursorAfterNode(contents[0]);
                    });
                },
                get: function(){
                    return angular.element($scope.richEditorApi.capture.elem).text();
                },
                replace: function(newnode, isAtomic){
                    // Use timeout to trigger the $watch
                    $timeout(function(){
                        var elem = angular.element($scope.richEditorApi.capture.elem);
                        elem.replaceWith(newnode);

                        // Set the cursor at the end of the parent element
                        if(isAtomic){ 
                            newnode.attr('atomic-element', true); 
                        }
                        $scope.richEditorApi.rangeHelper.setCursorAfterNode(newnode[0]);
                        $element.focus();
                    });
                }
            }
            // To figure out if we're currently capturing input we can check
            // if the capture element is currently on the screen by looking
            // if it has a parent element
            $scope.$watch('richEditorApi.capture.elem.parentNode', function() {
                if($scope.richEditorApi.capture.elem.parentNode==null){
                    $scope.richEditorApi.capture.isCapturing = false;
                }
                else{
                    $scope.richEditorApi.capture.isCapturing = true;
                }
            });

            /* Events */
            

            // This is to support 'selectionchange' on firefox
            // $document.on("mouseup keyup", function(e){
            //     checkForElementSelection(e);
            // });
            // $document.on("selectionchange", function(e){
            //     checkForElementSelection(e);
            // });
            // var checkForElementSelection = debounce(function(e){
            //     var selection = $window.getSelection();
            //     var isRangeSelection = selection.anchorOffset!=selection.focusOffset;
            //     if(isRangeSelection && isElementInsideEditor(selection.focusNode)){
            //         $scope.$emit("richeditor:selection",e);
            //     }
            // }, 300);

            $element.on("keydown", function(e){
                // Emit the keydown event
                $scope.$emit("richeditor:keydown",e);

                // If we were capturing input then cancel it
                // if($scope.richEditorApi.capture.isCapturing && e.keyCode == 13 /* enter */){
                //     $scope.richEditorApi.capture.cancel();
                // }
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
