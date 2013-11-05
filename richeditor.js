

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
.directive("stSingleLineField", [function(){
	return {
        restrict: "A",
        require: '?ngModel', // get a hold of NgModelController
        controller: ['$scope', '$element', '$timeout', function($scope, $element, $timeout){
        	
        }],
        link: function(scope, element, attrs, ngModel){
        	element.attr("contenteditable","true");
            element.addClass("st-single-line-field");

            if(element.text().length==0){
                checkIfEmpty();
            }
            element.on("focus", function(e){
                checkIfEmpty();
            });
            element.on("input", function(e){
                checkIfEmpty();
            });

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
	        	if(element.text().length==0){
                    element.addClass("empty");
                }
                else{
                    element.removeClass("empty");
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
.directive("stRichEditor", ['$compile', 'debounce', 'throttle',function($compile, debounce, throttle){
	return {
        restrict: "E",
        template: "<div class='st-rich-editor' contenteditable='true'></div>",
        replace: true,
        controller: ['$scope', '$element', '$timeout', '$window', '$document',function($scope, $element, $timeout, $window, $document){

            $scope.richEditorApi = {
                defaultNode: '<p style="min-height:1em;"></p>',
                enterCount: 0,      // Used to track consecutive presses of enter
                currentSelection: {
                    anchorOffset: null,
                    focusOffset: null,
                    anchorNode: null,
                    focusNode: null,
                    e: null
                },
                rangeHelper: {
                    setCursorAfterNode: function(node){
                        var range = document.createRange();
                        range.setStartAfter(node);
                        range.setEndAfter(node);
                        range.collapse(false);
                        var selection = window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(range);
                    },
                    isRangeSelection: function(){
                        var selection = $window.getSelection();
                        // Check if a range is selected or if its just a single cursor
                        if(selection.anchorNode != selection.focusNode){
                            return true;
                        }
                        else{
                            if(selection.anchorOffset != selection.focusOffset){
                                return true;
                            }
                            else{
                                return false;
                            }
                        }
                    },
                    isMultiLineSelection: function(){
                        var startElement = getElementLineOfStartSelection();
                        var endElement = getElementLineOfEndSelection();
                        if(startElement == null || endElement == null){
                            return true;
                        }
                        else{
                            return startElement != endElement;
                        }
                    }
                },

                /*
                 *  API Methods
                 */

                /* Use this to load existing content */
                setHtml: function(html){
                    $element.html(html);
                },
                toggleSelectionBold: function(){
                    ensureNoChangesToAtomicElement()
                    document.execCommand("bold", null, false);
                },
                toggleSelectionItalic: function(){
                    ensureNoChangesToAtomicElement()
                    document.execCommand("italic", null, false);
                },
                toggleSelectionUnderline: function(){
                    ensureNoChangesToAtomicElement()
                    document.execCommand("underline", null, false);
                },
                setSelectionLink: function(url){
                    ensureNoChangesToAtomicElement()
                    document.execCommand("CreateLink", null, url);
                },
                removeLink: function(){
                    // TODO: Need a better way to remove the link
                    ensureNoChangesToAtomicElement()
                    document.execCommand("unlink", null, null);
                },
                toggleBlockH1: function(){
                    if($scope.richEditorApi.isH1()){
                        $scope.richEditorApi.clearBlock();
                    }
                    else{
                        // $scope.richEditorApi.clearLists();
                        document.execCommand("formatBlock", null, "<H2>");
                    }
                },
                toggleBlockH2: function(){
                    if($scope.richEditorApi.isH2()){
                        $scope.richEditorApi.clearBlock();
                    }
                    else{
                        // $scope.richEditorApi.clearLists();
                        document.execCommand("formatBlock", null, "<H3>");
                    }
                },
                clearLists: function(){
                    // Toggle each list type twice to make sure it clears
                    document.execCommand("insertOrderedList", null, false);
                    document.execCommand("insertOrderedList", null, false);
                    if($scope.richEditorApi.isOL()){
                        document.execCommand("insertOrderedList", null, false);
                    }
                    document.execCommand("insertUnorderedList", null, false);
                    document.execCommand("insertUnorderedList", null, false);
                    if($scope.richEditorApi.isUL()){
                        document.execCommand("insertUnorderedList", null, false);
                    }
                },
                clearHeaders: function(){
                    $scope.richEditorApi.clearBlock();
                },
                clearBlock: function(){
                    document.execCommand("formatBlock", null, "<P>");
                },
                toggleUnorderedList: function(){
                    document.execCommand("insertUnorderedList", null, false);
                },
                toggleOrderedList: function(){
                    document.execCommand("insertOrderedList", null, false);
                },
                isBold: function(){
                    return document.queryCommandState('bold');
                },
                isItalic: function(){
                    return document.queryCommandState('italic');
                },
                isUnderline: function(){
                    return document.queryCommandState('underline');
                },
                isH1: function(){
                    return document.queryCommandValue('formatBlock') == "h2";
                },
                isH2: function(){
                    return document.queryCommandValue('formatBlock') == "h3";
                },
                isOL: function(){
                    return document.queryCommandState('insertOrderedList');
                },
                isUL: function(){
                    return document.queryCommandState('insertUnorderedList');
                },
                insertImage: function(url){
                    var elemOfCurrentLine = getElementLineOfStartSelection();
                    var figure = document.createElement("FIGURE");
                    figure.setAttribute('contenteditable',false);
                    var img = document.createElement("IMG");
                    img.setAttribute('src', url)
                    figure.appendChild(img);
                    // insert a paragraph node before incase we need to edit above the image
                    angular.element(elemOfCurrentLine).after(figure);
                    angular.element(figure).after(angular.element($scope.richEditorApi.defaultNode));
                },
                clearFormatting: function(){
                    if($scope.richEditorApi.isBold()){
                        $scope.richEditorApi.toggleSelectionBold();
                    }

                    if($scope.richEditorApi.isItalic()){
                        $scope.richEditorApi.toggleSelectionItalic();
                    }

                    if($scope.richEditorApi.isUnderline()){
                        $scope.richEditorApi.toggleSelectionUnderline();
                    }
                },
                isLink: function(){
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
                },
                isLinkWithClass: function(clazz){
                    var currentElement = getSelectionBoundaryElement(true);
                    var isLinkWithClass = traverseUpDom(currentElement, function(elem){
                        return (elem.tagName.toLowerCase() == "a") && (elem.className.split(" ").indexOf(clazz) != -1);
                    });
                    return isLinkWithClass;
                },
                focus: function(){
                    $element.focus();
                    // set cursor at the end
                    var range = document.createRange();
                    range.selectNodeContents($element[0]);
                    range.collapse(false);
                    var selection = $window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                },
                getCurrentSelection: function(){
                    var selection = $window.getSelection();
                    var range = selection.getRangeAt(0).cloneRange();
                    return range;
                },
                setCurrentSelection: function(range){
                    var selection = $window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                    // updateSelection($scope.richEditorApi.currentSelection.e);
                },
                getHtml: function(){
                    return $element.html();
                },
                getElementsWithClass: function(clazz){
                    return $element.find('.' + clazz);
                }
            };

            $element.on('blur keyup change input', function(e) {
                $scope.$emit("richeditor:contentchange");
            });

            // $element.append(angular.element($scope.richEditorApi.defaultNode));

            // Updating the current selection requires throttling to improve performance
            // TODO: Put a debounce on this
            var updateSelection = function(e){
                $timeout(function(){
                    var selection = $window.getSelection();
                    $scope.richEditorApi.currentSelection.anchorOffset = selection.anchorOffset;
                    $scope.richEditorApi.currentSelection.focusOffset = selection.focusOffset;
                    $scope.richEditorApi.currentSelection.anchorNode = selection.anchorNode;
                    $scope.richEditorApi.currentSelection.focusNode = selection.focusNode;
                    $scope.richEditorApi.currentSelection.e = e;
                });
            };
            // React to selectoin changes
            $scope.$watchCollection('[richEditorApi.currentSelection.anchorOffset, richEditorApi.currentSelection.focusOffset, richEditorApi.currentSelection.anchorNode, richEditorApi.currentSelection.focusNode]', function() {
                clearCaptureRangeIfCursorIsOutside();
            });
            // Listen to mouse and keyboard and update the selection so we can capture selection change events
            $document.on("keydown keyup keypress mousedown mouseup mouseclick input", function(e){
                
                if(e.type=="keydown"){
                    console.log();
                    if(!e.metaKey || [37,38,39,40].indexOf(e.keyCode) == -1 /* Check arrow keys */){
                        ensureNoChangesToAtomicElement();
                    }
                }

                updateSelection(e);

                if(e.type == "mouseup" || e.type == "keyup"){
                    var selection = $window.getSelection();
                    var isRangeSelection = $scope.richEditorApi.rangeHelper.isRangeSelection();
                    if(isRangeSelection && isElementInsideEditor(selection.focusNode)){
                        var isMultiLineSelection = $scope.richEditorApi.rangeHelper.isMultiLineSelection();
                        if(!isMultiLineSelection){
                            $scope.$emit("richeditor:textselection", isMultiLineSelection);
                        }
                    }
                }
            });

            function ensureNoChangesToAtomicElement(){

                var focusAtomicElement = isInsideAtomicElement($scope.richEditorApi.currentSelection.focusNode);
                var anchorAtomicElement = isInsideAtomicElement($scope.richEditorApi.currentSelection.anchorNode);
                if(focusAtomicElement==anchorAtomicElement){
                    if(focusAtomicElement){
                        // Caret is in a single position
                        unwrapElement(focusAtomicElement);
                    }
                }
                else{
                    if(focusAtomicElement){
                        // Range selection
                        unwrapElement(focusAtomicElement);
                    }
                    if(anchorAtomicElement){
                        // Range selection
                        unwrapElement(anchorAtomicElement);
                    }
                }
            }

            function unwrapElement(elem){
                var range = document.createRange();
                var text = elem.textContent;
                range.selectNode(elem);
                $scope.richEditorApi.setCurrentSelection(range);
                document.execCommand("delete");
                document.execCommand("insertText",false, text);
            }

            // Make sure <br> tags are off when pressing return
            document.execCommand('insertBrOnReturn',false, false);

            function preventEmptyNode(){
                var blockType = document.queryCommandValue("formatBlock");
                if(blockType=='' || blockType=='div'){
                    document.execCommand('formatblock', false, '<p>');
                    $element.focus();   // for some reason Firefox loses focus after formatBlock
                }
            }

            $element.on("mouseup", function(e){
                $scope.$emit("richeditor:mouseup");
            });

            $element.on("keydown", function(e){
                /* Some code test mess around with double enter */
                if(e.which == 13 /* enter/return */){
                    $scope.richEditorApi.enterCount += 1;
                    if($scope.richEditorApi.enterCount == 2){
                        // document.execCommand("insertHorizontalRule");
                        $scope.richEditorApi.enterCount = 0;
                    }
                }
                else{
                    $scope.richEditorApi.enterCount = 0;
                }

                $scope.$emit("richeditor:keydown",e);
            });

            // Called every time the content changes
            $element.on("input", function(e){
                if($element.text().length==0){
                    $element.addClass("empty");
                }
                else{
                    $element.removeClass("empty");
                }

                $scope.$emit("richeditor:input",e);
            });

            $element.on("keypress", function(e){
                
                preventEmptyNode();
                if(e.keyCode == 13 /* return */){
                    
                    // Clear formatting when the user hits enter
                    $timeout(function(){
                        $scope.richEditorApi.clearFormatting();
                    });
                    
                }
                
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
                var imageUrlRegex = /^https?:\/\/(?:[a-z\-]+\.)+[a-z]{2,6}(?:\/[^\/#?]+)+\.(?:jpe?g|gif|png)$/i;
                var youtubeUrl = /youtube\.com\/watch/i;
                var html = '';
                var pastedText = e.originalEvent.clipboardData.getData('text/plain');

                if(imageUrlRegex.test(pastedText)){
                    $scope.richEditorApi.insertImage(pastedText);
                }
                else if(youtubeUrl.test(pastedText)){
                    var vidWidth = 425;
                    var vidHeight = 344;

                    var obj = '<object width="' + vidWidth + '" height="' + vidHeight + '">' +
                        '<param name="movie" value="http://www.youtube.com/v/[vid]&hl=en&fs=1">' +
                        '</param><param name="allowFullScreen" value="true"></param><param ' +
                        'name="allowscriptaccess" value="always"></param><em' +
                        'bed src="http://www.youtube.com/v/[vid]&hl=en&fs=1" ' +
                        'type="application/x-shockwave-flash" allowscriptaccess="always" ' +
                        'allowfullscreen="true" width="' + vidWidth + '" ' + 'height="' +
                        vidHeight + '"></embed></object> ';

                    var vid = pastedText.match(/(?:v=)([\w\-]+)/g);
                    if (vid.length) {
                        var figure = document.createElement("FIGURE");
                        figure.setAttribute('contenteditable',false);
                        var youtubeVideo = obj.replace(/\[vid\]/g, vid[0].replace('v=',''));
                        var youtubeVideoElement = angular.element(youtubeVideo);
                        var elemOfCurrentLine = getElementLineOfStartSelection();
                        angular.element(figure).append(youtubeVideoElement);
                        angular.element(elemOfCurrentLine).after(figure);
                        angular.element(figure).after(angular.element($scope.richEditorApi.defaultNode));
                    }
                }
                else{
                    document.execCommand('insertText', false, pastedText);
                    preventEmptyNode();
                }
                
            });


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

            function traverseUpDomToEditorRoot(elem){
                if(elem.parentNode == $element[0]){
                    return elem;
                }
                else{
                    return traverseUpDomToEditorRoot(elem.parentNode);
                }
            }

            function getElementLineOfStartSelection(){
                var anchorNode = $window.getSelection().anchorNode;
                if(isElementInsideEditor(anchorNode)){
                    return traverseUpDomToEditorRoot(anchorNode);    
                }
                else{
                    return null;
                }
            }

            function getElementLineOfEndSelection(){
                var focusNode = $window.getSelection().focusNode;
                if(isElementInsideEditor(focusNode)){
                    return traverseUpDomToEditorRoot(focusNode);    
                }
                else{
                    return null;
                }
            }

            function isElementInsideEditor(elem){
                var result =  traverseUpDom(elem, function(elem){
                    return elem == $element[0];
                });
                return result;
            }

            /* Capture Text Input */

            function clearCaptureRangeIfCursorIsOutside(){
                if($scope.richEditorApi.capture.isCapturing){
                    var selection = $window.getSelection();
                    var atomicElement = isInsideCaptureRange(selection.anchorNode);
                    if(!atomicElement){
                        $scope.richEditorApi.capture.cancel();
                    }
                    else{
                        var atomicElement = isInsideCaptureRange(selection.focusNode);
                        if(!atomicElement){
                            $scope.richEditorApi.capture.elem.cancel();
                        }
                    }
                }
            }

            function isInsideCaptureRange(theElement){
                return traverseUpDom(theElement, function(elem){
                    return angular.element(elem).hasClass("capture-range");
                });
            }

            function isInsideAtomicElement(theElement){
                if(!theElement.parentNode){
                    return false;
                }
                else{
                    if(theElement.parentNode.getAttribute("data-atomic-element")){
                        return theElement.parentNode;
                    }
                    else{
                        return null;
                    }
                }
                
            }

            $scope.richEditorApi.capture = {
                elem: document.createElement("span"),
                isCapturing: false, // This is set through a watch on elem.parentElement
                start: function(initString){
                    $timeout(function(){
                        var newnode = angular.element($scope.richEditorApi.capture.elem);
                        newnode.text(initString);
                        newnode.addClass('capture-range');
                        // Get current cursor position
                        var s1 = document.getSelection();
                        // Check if the cursor position is inside an atomic element
                        // var atomicElement = isInsideAtomicElement(s1.getRangeAt(0).startContainer);
                        
                        // Make sure we're not inserting inside an atomic element
                        // if(atomicElement){
                        //     // If we are inside an atomic element then insert after the element
                        //     angular.element(atomicElement).after(newnode);
                        // }
                        // else{
                            // Otherwise just insert at the cursor location
                            s1.getRangeAt(0).insertNode(newnode[0]);
                        // }
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
                        if($scope.richEditorApi.capture.isCapturing){
                            var contents = angular.element($scope.richEditorApi.capture.elem).contents().last();
                            contents.unwrap();
                            $scope.richEditorApi.rangeHelper.setCursorAfterNode(contents[0]);
                        }
                    });
                },
                get: function(){
                    return angular.element($scope.richEditorApi.capture.elem).text();
                },
                replace: function(newnode){
                    // Use timeout to trigger the $watch
                    $timeout(function(){
                        var elem = angular.element($scope.richEditorApi.capture.elem);
                        elem.replaceWith(newnode);
                        $scope.richEditorApi.rangeHelper.setCursorAfterNode(newnode[0]);
                        $element.focus();
                    });
                },
                /* Note: this style of replace won't work with <span> because the browser will let the user edit the content of the <span> */
                replaceAtomicLink: function(elem){
                    elem.attr("data-atomic-element",true);
                    elem.addClass("atomic-element")
                    var str = angular.element('<div>').append(elem.clone()).html();
                    // Use timeout to trigger the $watch
                    $timeout(function(){
                        var elem = angular.element($scope.richEditorApi.capture.elem);
                        var range = document.createRange();
                        range.selectNode($scope.richEditorApi.capture.elem);
                        $scope.richEditorApi.setCurrentSelection(range);
                        document.execCommand("delete");
                        document.execCommand("insertHTML",false, str + "&nbsp;");
                    });   
                }
            }
            // To figure out if we're currently capturing input we can check
            // if the capture element is currently on the screen by looking
            // if it has a parent element
            $scope.$watch('richEditorApi.capture.elem.parentNode', function() {
                console.log("Parent node change");
                if($scope.richEditorApi.capture.elem.parentNode==null){
                    $scope.richEditorApi.capture.isCapturing = false;
                }
                else{
                    $scope.richEditorApi.capture.isCapturing = true;
                }
            });

            /* Helper Functions */

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
