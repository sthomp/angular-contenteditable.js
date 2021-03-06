

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
.constant('stRichEditorConstants',{
    events: {
        contentchange: "richeditor:contentchange",
        textselection: "richeditor:textselection",
        mouseup: "richeditor:mouseup",
        keydown: "richeditor:keydown",
        input: "richeditor:input",
        keyup: "richeditor:keyup",
        keypress: "richeditor:keypress",
        focus: "richeditor:focus",
        unfocus: "richeditor:unfocus"
    },
    // There are different kinds of nodeTypes:
    // - rich: You can format H1, H2, etc
    // - basic: You can only type text and set text to bold, italic, href.
    //    No inserting images, H1, H2
    nodeTypes: {
      rich: 'richeditor:nodetype:rich',
      basic: 'richeditor:nodetype:basic'
    }
})
.directive("stRichEditor", ['$compile', 'debounce', 'throttle', function($compile, debounce, throttle){
	return {
        restrict: "E",
        template: "<div class='st-rich-editor' contenteditable='true'></div>",
        replace: true,
        controller: ['$scope', '$element', '$timeout', '$window', '$document', 'stRichEditorConstants', function($scope, $element, $timeout, $window, $document, stRichEditorConstants){

            var events = stRichEditorConstants.events;

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
                events: events,

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
                    // Ensure links are not relative links
                    var httpRegex = /^(http:\/\/|https:\/\/)/i; // Check if starts with http or https
                    if(!httpRegex.test(url)){
                        url = "http://" + url
                    }

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
                    var figcaption = document.createElement("FIGCAPTION");
                    img.setAttribute('src', url)
                    figure.appendChild(img);
                    figure.appendChild(figcaption);
                    figcaption.setAttribute('contenteditable', true);
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
                      if(elem.tagName.toLowerCase() == "a"){
                        return elem;
                      }
                      else{
                        return false;
                      }
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
                      if((elem.tagName.toLowerCase() == "a") && (elem.className.split(" ").indexOf(clazz) != -1)){
                        return elem;
                      }
                      else{
                        return false;
                      }
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
                    return rangeHelper.getCurrentSelection().cloneRange();
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


            function domNodeToString(node){
              var tmp = document.createElement("div");
              tmp.appendChild(node);
              return tmp.innerHTML;
            }

            function createNewLine(){

              var currentLineElem = getElementLineOfStartSelection();

              var range = document.createRange();
              range.setStartAfter(currentLineElem);
              range.setEndAfter(currentLineElem);
              range.collapse(false);
              $scope.richEditorApi.setCurrentSelection(range);

              try{
                  // firefox throws an error here: NS_ERROR_FAILURE
                document.execCommand("insertParagraph", false);
              }
              finally{
                // move the cursor into the newly created line
                range.setStartAfter(currentLineElem);
                range.setEndAfter(currentLineElem);
                range.collapse(false);
                $scope.richEditorApi.setCurrentSelection(range);
              }
            }

            var rangeHelper = {
                getCurrentSelection: function(){
                    var selection = $window.getSelection();
                    var range = selection.getRangeAt(0);
                    return range;
                },
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
                },
                htmlNodeToString: function(node){
                    var tmp = document.createElement("div");
                    tmp.appendChild(node);
                    return tmp.innerHTML;
                }
            }

            $element.on('blur keyup change input', function(e) {
                $scope.$emit(events.contentchange);
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
            $scope.$watch('richEditorApi.currentSelection.focusNode', function(){
              preventEmptyNode();

              // Send an event whenever the cursor enters or leaves the editor
              // This is so consumers can know if the editor is focused or not
              if(isElementInsideEditor($scope.richEditorApi.currentSelection.focusNode)){
                $scope.$emit(events.focus);
              }
              else{
                $scope.$emit(events.unfocus);
              }
            });
            // React to selectoin changes
            $scope.$watchCollection('[richEditorApi.currentSelection.anchorOffset, richEditorApi.currentSelection.focusOffset, richEditorApi.currentSelection.anchorNode, richEditorApi.currentSelection.focusNode]', function() {
                // Stop capturing text input if the cursor leaves the editor
                clearCaptureRangeIfCursorIsOutside();
            });
            // Listen to mouse and keyboard and update the selection so we can capture selection change events
            $document.on("keydown keyup keypress mousedown mouseup mouseclick input", function(e){
                
                if(e.type=="keydown"){

                  var keycode = {
                    backspace: 8,
                    del: 46,
                    enter: 13
                  }

                  // for figcaption we want to stop backspace/delete when the figcaption is empty
                  // Also, pressing enter should leave the figcaption
                  function preventDefaultForFigcaption(){
                    if(e.keyCode == keycode.backspace || e.keyCode == keycode.del || e.keyCode == keycode.enter){
                      var isRangeSelection = rangeHelper.isRangeSelection();
                      if (!isRangeSelection) {
                        var selection = $window.getSelection();
                        
                        var elem = isInsideElementTypeOrRichEditor(['figcaption'], selection.focusNode);
                        if(elem && elem.tagName.toLowerCase()=='figcaption'){
                          if(e.keyCode == keycode.backspace && selection.focusOffset==0){
                            // prevent deleting if backspacing to the beginning of the figcaption
                            e.preventDefault();
                          }
                          else if(e.keyCode == keycode.del && selection.focusOffset == elem.textContent.length){
                            // prevent forwardDelete if deleting past the end of the figcaption
                            e.preventDefault();
                          }
                        }
                      } 
                      else if(e.keyCode == keycode.enter){
                        createNewLine();
                        e.preventDefault();
                      }
                    }
                  }


                  function preventDeletingNonContenteditable(){

                    function isNonContentEditable(node){
                      return node.hasAttribute('contenteditable') && node.getAttribute('contenteditable')=="false";
                    }

                    if(e.keyCode == keycode.backspace || e.keyCode == keycode.del){
                      var isRangeSelection = rangeHelper.isRangeSelection();
                      if (!isRangeSelection) {
                        var selection = $window.getSelection();
                        var lineElem = getElementLineOfStartSelection();
                        
                        if(e.keyCode == keycode.del && selection.focusOffset==lineElem.textContent.length){
                          var nextSibling = lineElem.nextSibling;
                          if(nextSibling && isNonContentEditable(nextSibling)){
                            // Dont allow the user to forwardDelete into contenteditable
                            e.preventDefault();
                            var range = document.createRange();
                            range.selectNode(nextSibling);
                            $scope.richEditorApi.setCurrentSelection(range);
                            document.execCommand('delete',false);
                          }
                        }
                        else if(e.keyCode == keycode.backspace && selection.focusOffset==0){
                          var previousSibling = lineElem.previousSibling;
                          if(previousSibling && isNonContentEditable(previousSibling)){
                            // Dont allow the user to backspace into contenteditable
                            e.preventDefault(); 
                            var range = document.createRange();
                            range.selectNode(previousSibling);
                            $scope.richEditorApi.setCurrentSelection(range);
                            document.execCommand('delete',false);
                          }
                        }
                      }
                    }
                  }

                  preventDefaultForFigcaption();
                  preventDeletingNonContenteditable();

                  if(!e.metaKey && doesKeycodeChangeText(e.keyCode)){
                      ensureNoChangesToAtomicElement();
                  }


                  $scope.$emit(events.keydown,e);
                }

                updateSelection(e);
                
                // Check if the user did a multiline selection
                if(e.type == "mouseup" || e.type == "keyup"){
                  var selection = $window.getSelection();
                  var isRangeSelection = rangeHelper.isRangeSelection();
                  if(isRangeSelection && isElementInsideEditor(selection.focusNode)){
                    var isMultiLineSelection = rangeHelper.isMultiLineSelection();
                    if(!isMultiLineSelection){
                      var containerNodeType = getParentContainerNodeType($scope.richEditorApi.currentSelection.focusNode);
                      $scope.$emit(events.textselection, {
                        multi: isMultiLineSelection,
                        nodeType: containerNodeType
                      });
                    }
                  }
                }
            });
            function doesKeycodeChangeText(c){
                if([16,17,18,19,20,27,33,34,35,36,37,38,39,40,144,145].indexOf(c) != -1 || (c>=112 && c<=123 /* F Keys */)){
                    return false;
                }
                else{
                    return true;
                }
            }

            function ensureNoChangesToAtomicElement(){
                var selection = $window.getSelection();
                var focusAtomicElement = isInsideAtomicElement(selection.focusNode);
                var anchorAtomicElement = isInsideAtomicElement(selection.anchorNode);
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

            // Given an array of tagNames, this will traverse up the DOM
            // If a matching tagName is found then return the matching element.
            // Additionally, if we reach the rich-editor then return it.
            // Otherwise returns false.
            function isInsideElementTypeOrRichEditor(arrayOfTypes, testElem){
              var result = traverseUpDom(testElem, function(elem){
                if(elem.tagName){
                  if(arrayOfTypes.indexOf(elem.tagName.toLowerCase()) != -1){
                    return elem;
                  } 
                  else if(elem == $element[0]){
                    return elem;
                  }
                  else{
                    return false;
                  }
                }
                else{
                  // This is a text node and has no tagName
                  return false;
                }
              });

              return result;
            }

            // There are some special types we need to keep an eye out for
            // See 'nodeTypes' above
            function getParentContainerNodeType(testElem){
              var basicTypes = ['figcaption', 'li'];
              
              var result = isInsideElementTypeOrRichEditor(basicTypes, testElem);
              if(result){
                if(basicTypes.indexOf(result.tagName.toLowerCase()) != -1){
                  return stRichEditorConstants.nodeTypes.basic;
                }
                else{
                  return stRichEditorConstants.nodeTypes.rich;
                }
              }
              else{
                return null;
              }
            }

            function preventEmptyNode(){
              // Only preventEmpty() if there is not currently a range selection
              var isRangeSelection = rangeHelper.isRangeSelection();
              var blockType = document.queryCommandValue("formatBlock");
              if(!isRangeSelection && (blockType=='' || blockType=='div')){
                var focusContainerNodeType = getParentContainerNodeType($scope.richEditorApi.currentSelection.focusNode);
                var anchorContainerNodeType = getParentContainerNodeType($scope.richEditorApi.currentSelection.anchorNode);
                // Only preventEmpty() if we are operating on a rich content area
                if(focusContainerNodeType == stRichEditorConstants.nodeTypes.rich && anchorContainerNodeType == stRichEditorConstants.nodeTypes.rich){
                  document.execCommand('formatblock', false, '<p>');
                  $element.focus();   // for some reason Firefox loses focus after formatBlock
                }
              }
            }

            $element.on("mouseup", function(e){
                $scope.$emit(events.mouseup);
            });


            // Called every time the content changes
            $element.on("input", function(e){
                if($element.text().length==0){
                    $element.addClass("empty");
                }
                else{
                    $element.removeClass("empty");
                }

                $scope.$emit(events.input,e);
            });

            $element.on("keypress", function(e){
                
                if(e.keyCode == 13 /* return */){
                    
                    // Clear formatting when the user hits enter
                    $timeout(function(){
                        $scope.richEditorApi.clearFormatting();
                    });
                    
                }
                
                $scope.$emit(events.keypress,e);
            });

            $element.on("keyup", function(e){
                $scope.$emit(events.keyup,e);
            });

            // doesnt work in firefox
            // $element.on("textInput", function(e){
            //     $scope.$emit("richeditor:textInput",e);
            // });

            $element.on("paste", function(e){
                e.preventDefault();
                var imageUrlRegex = /^https?:\/\/(?:[a-z\-\d]+\.)+[a-z]{2,6}(?:\/[^\/#?]+)+\.(?:jpe?g|gif|png)$/i;
                var youtubeUrl = /youtube\.com\/watch/i;
                var html = '';
                var pastedText = e.originalEvent.clipboardData.getData('text/plain');

                // http://stackoverflow.com/questions/9714525/javascript-image-url-verify
                function testImage(url, callback) {
                    timeout = 3000;
                    var timedOut = false, timer;
                    var img = new Image();
                    img.onerror = img.onabort = function() {
                        if (!timedOut) {
                            clearTimeout(timer);
                            callback(false);
                        }
                    };
                    img.onload = function() {
                        if (!timedOut) {
                            clearTimeout(timer);
                            callback(true);
                        }
                    };
                    img.src = url;
                    timer = setTimeout(function() {
                        timedOut = true;
                        callback(false);
                    }, timeout); 
                }

                if(youtubeUrl.test(pastedText)){
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
                    testImage(pastedText, function(isImg){
                        if(isImg){
                            $scope.richEditorApi.insertImage(pastedText);
                        }
                        else{
                            document.execCommand('insertText', false, pastedText);
                            preventEmptyNode();
                        }
                    });
                    
                }
                
            });


            // Traverse up from the current node
            // Return true if the given condition is met
            function traverseUpDom(elem, fn){
              if(!elem || !fn){
                return false;
              }
              else{
                var result = fn(elem);
                if(result){
                  return result;
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
                if(elem == $element[0]){
                  return elem;
                }
                else{
                  return false;
                }
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
                if(angular.element(elem).hasClass("capture-range")){
                  return elem;
                }
                else{
                  return false;
                }
              });
            }

            function isInsideAtomicElement(theElement){
                if(angular.isUndefined(theElement) || theElement==null){
                    return false;
                }
                else{
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
                            if(contents.length > 0){
                                contents.unwrap();
                                rangeHelper.setCursorAfterNode(contents[0]);
                            }
                            else{
                                angular.element($scope.richEditorApi.capture.elem).remove();
                            }
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
                        rangeHelper.setCursorAfterNode(newnode[0]);
                        $element.focus();
                    });
                },
                /* Note: this style of replace won't work with <span> because the browser will let the user edit the content of the <span> */
                replaceAtomicLink: function(elem){
                    elem.attr("data-atomic-element",true);
                    elem.addClass("atomic-element")
                    var str = domNodeToString(elem[0]);
                    // var str = angular.element('<div>').append(elem.clone()).html();
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
