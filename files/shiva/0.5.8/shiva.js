(function (root) {

  // Store setTimeout reference so promise-polyfill will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var setTimeoutFunc = setTimeout;

  function noop() {}
  
  // Polyfill for Function.prototype.bind
  function bind(fn, thisArg) {
    return function () {
      fn.apply(thisArg, arguments);
    };
  }

  function Promise(fn) {
    if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new');
    if (typeof fn !== 'function') throw new TypeError('not a function');
    this._state = 0;
    this._handled = false;
    this._value = undefined;
    this._deferreds = [];

    doResolve(fn, this);
  }

  function handle(self, deferred) {
    while (self._state === 3) {
      self = self._value;
    }
    if (self._state === 0) {
      self._deferreds.push(deferred);
      return;
    }
    self._handled = true;
    Promise._immediateFn(function () {
      var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
      if (cb === null) {
        (self._state === 1 ? resolve : reject)(deferred.promise, self._value);
        return;
      }
      var ret;
      try {
        ret = cb(self._value);
      } catch (e) {
        reject(deferred.promise, e);
        return;
      }
      resolve(deferred.promise, ret);
    });
  }

  function resolve(self, newValue) {
    try {
      // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
      if (newValue === self) throw new TypeError('A promise cannot be resolved with itself.');
      if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
        var then = newValue.then;
        if (newValue instanceof Promise) {
          self._state = 3;
          self._value = newValue;
          finale(self);
          return;
        } else if (typeof then === 'function') {
          doResolve(bind(then, newValue), self);
          return;
        }
      }
      self._state = 1;
      self._value = newValue;
      finale(self);
    } catch (e) {
      reject(self, e);
    }
  }

  function reject(self, newValue) {
    self._state = 2;
    self._value = newValue;
    finale(self);
  }

  function finale(self) {
    if (self._state === 2 && self._deferreds.length === 0) {
      Promise._immediateFn(function() {
        if (!self._handled) {
          Promise._unhandledRejectionFn(self._value);
        }
      });
    }

    for (var i = 0, len = self._deferreds.length; i < len; i++) {
      handle(self, self._deferreds[i]);
    }
    self._deferreds = null;
  }

  function Handler(onFulfilled, onRejected, promise) {
    this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
    this.onRejected = typeof onRejected === 'function' ? onRejected : null;
    this.promise = promise;
  }

  /**
   * Take a potentially misbehaving resolver function and make sure
   * onFulfilled and onRejected are only called once.
   *
   * Makes no guarantees about asynchrony.
   */
  function doResolve(fn, self) {
    var done = false;
    try {
      fn(function (value) {
        if (done) return;
        done = true;
        resolve(self, value);
      }, function (reason) {
        if (done) return;
        done = true;
        reject(self, reason);
      });
    } catch (ex) {
      if (done) return;
      done = true;
      reject(self, ex);
    }
  }

  Promise.prototype['catch'] = function (onRejected) {
    return this.then(null, onRejected);
  };

  Promise.prototype.then = function (onFulfilled, onRejected) {
    var prom = new (this.constructor)(noop);

    handle(this, new Handler(onFulfilled, onRejected, prom));
    return prom;
  };

  Promise.all = function (arr) {
    var args = Array.prototype.slice.call(arr);

    return new Promise(function (resolve, reject) {
      if (args.length === 0) return resolve([]);
      var remaining = args.length;

      function res(i, val) {
        try {
          if (val && (typeof val === 'object' || typeof val === 'function')) {
            var then = val.then;
            if (typeof then === 'function') {
              then.call(val, function (val) {
                res(i, val);
              }, reject);
              return;
            }
          }
          args[i] = val;
          if (--remaining === 0) {
            resolve(args);
          }
        } catch (ex) {
          reject(ex);
        }
      }

      for (var i = 0; i < args.length; i++) {
        res(i, args[i]);
      }
    });
  };

  Promise.resolve = function (value) {
    if (value && typeof value === 'object' && value.constructor === Promise) {
      return value;
    }

    return new Promise(function (resolve) {
      resolve(value);
    });
  };

  Promise.reject = function (value) {
    return new Promise(function (resolve, reject) {
      reject(value);
    });
  };

  Promise.race = function (values) {
    return new Promise(function (resolve, reject) {
      for (var i = 0, len = values.length; i < len; i++) {
        values[i].then(resolve, reject);
      }
    });
  };

  // Use polyfill for setImmediate for performance gains
  Promise._immediateFn = (typeof setImmediate === 'function' && function (fn) { setImmediate(fn); }) ||
    function (fn) {
      setTimeoutFunc(fn, 0);
    };

  Promise._unhandledRejectionFn = function _unhandledRejectionFn(err) {
    if (typeof console !== 'undefined' && console) {
      console.warn('Possible Unhandled Promise Rejection:', err); // eslint-disable-line no-console
    }
  };

  /**
   * Set the immediate function to execute callbacks
   * @param fn {function} Function to execute
   * @deprecated
   */
  Promise._setImmediateFn = function _setImmediateFn(fn) {
    Promise._immediateFn = fn;
  };

  /**
   * Change the function to execute on unhandled rejection
   * @param {function} fn Function to execute on unhandled rejection
   * @deprecated
   */
  Promise._setUnhandledRejectionFn = function _setUnhandledRejectionFn(fn) {
    Promise._unhandledRejectionFn = fn;
  };
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Promise;
  } else if (!root.Promise) {
    root.Promise = Promise;
  }

})(this);
(function() {
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var shiva;
(function (shiva) {
    var Properties = (function () {
        function Properties() {
        }
        Properties.style = function (object, vars) {
            var element;
            if (object.element) {
                element = object.element;
            }
            else {
                element = object;
            }
            for (var i in vars) {
                if (vars.hasOwnProperty(i)) {
                    var value = vars[i];
                    if (typeof (value) === "number") {
                        if (value) {
                            switch (i) {
                                case "x":
                                    value = vars[i].toString();
                                    value += "px";
                                    break;
                                case "y":
                                    value = vars[i].toString();
                                    value += "px";
                                    break;
                                case "height":
                                    value = vars[i].toString();
                                    value += "px";
                                    break;
                                case "width":
                                    value = vars[i].toString();
                                    value += "px";
                                    break;
                                case "backgroundColor":
                                    value = "rgb(" + (vars[i] >> 16) + "," + ((vars[i] >> 8) & 255) + "," + (vars[i] & 255) + ")";
                                    break;
                                case "color":
                                    value = "rgb(" + (vars[i] >> 16) + "," + ((vars[i] >> 8) & 255) + "," + (vars[i] & 255) + ")";
                                    break;
                                default:
                                    break;
                            }
                        }
                    }
                    var styleName = i;
                    switch (i) {
                        case "x":
                            styleName = "left";
                            break;
                        case "y":
                            styleName = "top";
                            break;
                        case "alpha":
                            styleName = "opacity";
                            break;
                        default:
                            break;
                    }
                    element.style[styleName] = value;
                }
            }
        };
        return Properties;
    }());
    shiva.Properties = Properties;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var Event = (function () {
        function Event(type, targetObj, data, sourceEvent) {
            this._type = type;
            this._target = targetObj;
            this._sourceEvent = sourceEvent;
            this._data = data;
        }
        Object.defineProperty(Event.prototype, "target", {
            get: function () {
                return this._target;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Event.prototype, "type", {
            get: function () {
                return this._type;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Event.prototype, "data", {
            get: function () {
                return this._data;
            },
            set: function (payload) {
                this._data = payload;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Event.prototype, "sourceEvent", {
            get: function () {
                return this._sourceEvent;
            },
            enumerable: true,
            configurable: true
        });
        return Event;
    }());
    shiva.Event = Event;
    var EventDispatcher = (function () {
        function EventDispatcher() {
            this._listeners = [];
        }
        EventDispatcher.prototype.hasEventListener = function (type, listener) {
            var exists = false;
            for (var i = 0; i < this._listeners.length; i++) {
                if (this._listeners[i].type === type && this._listeners[i].listener === listener) {
                    exists = true;
                }
            }
            return exists;
        };
        EventDispatcher.prototype.addEventListener = function (scope, typeStr, listenerFunc, data, useCapture, scopedEventListener) {
            if (useCapture === void 0) { useCapture = false; }
            if (scopedEventListener === void 0) { scopedEventListener = undefined; }
            if (this.hasEventListener(typeStr, listenerFunc)) {
                return;
            }
            this._listeners.push({
                scope: scope,
                type: typeStr,
                listener: listenerFunc,
                useCapture: useCapture,
                scopedEventListener: scopedEventListener,
                data: data
            });
        };
        EventDispatcher.prototype.removeEventListener = function (typeStr, listenerFunc) {
            var listener = this._listeners.filter(function (item) {
                return (item.type === typeStr && item.listener.toString() === listenerFunc.toString());
            });
            this._listeners = this._listeners.filter(function (item) {
                return (!(item.type === typeStr && item.listener.toString() === listenerFunc.toString()));
            });
            return listener[0];
        };
        EventDispatcher.prototype.dispatchEvent = function (evt) {
            for (var i = 0; i < this._listeners.length; i++) {
                if (this._listeners[i].type === evt.type) {
                    if (this._listeners[i].data) {
                        evt.data = this._listeners[i].data;
                    }
                    this._listeners[i].listener.call(this._listeners[i].scope, evt);
                }
            }
        };
        return EventDispatcher;
    }());
    shiva.EventDispatcher = EventDispatcher;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var Container = (function (_super) {
        __extends(Container, _super);
        function Container(config) {
            _super.call(this);
            this.transitions = {};
            if (config) {
                if (config.root) {
                    this._element = document.createElement("div");
                    this._element.style.position = "absolute";
                    this._element.style.height = "100%";
                    this._element.style.width = "100%";
                    this._element.style.top = "0px";
                    this._element.style.left = "0px";
                    this._element.style.margin = "0px";
                    this._element.id = "app";
                    document.body.appendChild(this._element);
                }
                else {
                    if (config.type) {
                        this._element = document.createElement(config.type);
                    }
                    else {
                        this._element = document.createElement("div");
                    }
                }
                if (config.id) {
                    this._element.id = config.id;
                }
                if (config.text) {
                    this.innerHtml = config.text;
                }
                this.style(config.style);
                this.style(config);
            }
            else {
                this._element = document.createElement("div");
            }
        }
        Container.prototype.addToBody = function () {
            document.body.appendChild(this._element);
        };
        Container.prototype.style = function (vars) {
            shiva.Properties.style(this._element, vars);
        };
        Container.prototype.className = function () {
            var _this = this;
            var names = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                names[_i - 0] = arguments[_i];
            }
            names.map((function (name) {
                _this._element.className = name;
            }));
        };
        Container.prototype.addChild = function (child) {
            var childElement;
            if (child.element) {
                childElement = child.element;
            }
            this._element.appendChild(childElement);
        };
        Container.prototype.removeChild = function (child) {
            if (this._element === child.element.parentNode) {
                this._element.removeChild(child.element);
            }
        };
        Container.prototype.to = function (config) {
            var _this = this;
            this.style({
                transform: "translateZ(1px)"
            });
            var delay = 10;
            if (config.delay) {
                delay = config.delay * 1000;
            }
            setTimeout(function () {
                for (var i in config.toVars) {
                    var vo = {};
                    if (config.duration) {
                        vo["duration"] = config.duration;
                    }
                    if (_this.transitions[i]) {
                        vo["count"] = _this.transitions[i].count + 1;
                    }
                    else {
                        vo["count"] = 0;
                    }
                    _this.transitions[i] = vo;
                }
                _this.style({
                    transition: _this.convertTransitionObjectToString(_this.transitions),
                });
                if (config.ease) {
                    _this.style({
                        transitionTimingFunction: config.ease.toString()
                    });
                }
                _this.style(config.toVars);
            }, delay);
            if (config.resolve) {
                setTimeout(function () {
                    _this.style({
                        transition: _this.removeCompletedTransitionsAndReapply(config.toVars)
                    });
                    _this.dispatchEvent(new shiva.Event("TRANSITION_COMPLETE", _this));
                    config.resolve();
                }, (config.duration * 1000) + delay);
                return null;
            }
            else {
                return new Promise(function (resolve, reject) {
                    setTimeout(function () {
                        _this.style({
                            transition: _this.removeCompletedTransitionsAndReapply(config.toVars)
                        });
                        resolve();
                        _this.dispatchEvent(new shiva.Event("TRANSITION_COMPLETE", _this));
                    }, (config.duration * 1000) + delay);
                });
            }
        };
        Container.prototype.convertTransitionStyleToObject = function (style) {
            var _this = this;
            if (style.transitionProperty) {
                var transitionProps = style.transitionProperty.split(",");
                var transitionDuration_1 = style.transitionDuration.split(",");
                var transitionDelay_1 = style.transitionDelay.split(",");
                var transitionObject_1 = {};
                var count_1 = 0;
                transitionProps.map(function (prop) {
                    var propNoSpace = prop.replace(/^\s/g, "");
                    propNoSpace = _this.hyphenToCamel(propNoSpace);
                    var vo = {};
                    var duration = transitionDuration_1[count_1].replace(/^\s/g, "");
                    if (transitionDuration_1[count_1]) {
                        vo["duration"] = transitionDuration_1[count_1].replace(/^\s/g, "").replace("s", "");
                    }
                    if (transitionDelay_1[count_1]) {
                        var trimTransitionDelayValue = transitionDelay_1[count_1].replace(/^\s/g, "").replace("s", "");
                        if (trimTransitionDelayValue !== ("initial" || "inherit")) {
                            vo["delay"] = trimTransitionDelayValue;
                        }
                    }
                    transitionObject_1[propNoSpace] = vo;
                    count_1++;
                });
                return transitionObject_1;
            }
            else {
                return {};
            }
        };
        Container.prototype.convertTransitionObjectToString = function (transition) {
            var transitionString = "";
            for (var i in transition) {
                if (transitionString !== "") {
                    transitionString += ", ";
                }
                var hyphenCaseIndex = this.camelToHyphen(i);
                transitionString += hyphenCaseIndex + " " + transition[i]["duration"] + "s";
                if (transition[i]["delay"]) {
                    transitionString += " " + transition[i]["delay"] + "s";
                }
            }
            return transitionString;
        };
        Container.prototype.removeCompletedTransitionsAndReapply = function (toVars) {
            for (var i in toVars) {
                if (this.transitions[i]) {
                    if (this.transitions[i].count > 0) {
                        this.transitions[i].count--;
                    }
                    else {
                        delete this.transitions[i];
                    }
                }
            }
            return this.convertTransitionObjectToString(this.transitions);
        };
        Container.prototype.fromTo = function (config) {
            var _this = this;
            this.style({
                transform: "translateZ(1px)"
            });
            if (config.delay) {
                config.delay = config.delay * 1000;
                if (config.immediateRender) {
                    this.style(config.fromVars);
                }
            }
            else {
                this.style(config.fromVars);
                config.delay = 10;
            }
            return new Promise(function (resolve, reject) {
                setTimeout(function () {
                    _this.style(config.fromVars);
                    setTimeout(function () {
                        _this.to({
                            duration: config.duration,
                            ease: config.ease,
                            toVars: config.toVars,
                            resolve: resolve
                        });
                    }, 10);
                }, config.delay);
            });
        };
        Container.prototype.camelToHyphen = function (camel) {
            return camel.replace(/[a-z][A-Z]/g, function (match, index) {
                var matchArray = match.split("");
                matchArray[2] = matchArray[1];
                matchArray[1] = "-";
                matchArray[2] = matchArray[2].toLowerCase();
                var result = "";
                matchArray.map(function (char) {
                    result += char;
                });
                return result;
            });
        };
        Container.prototype.hyphenToCamel = function (hyphen) {
            return hyphen.replace(/-([a-z])/g, function (match, index) {
                return match[1].toUpperCase();
            });
        };
        Container.prototype.addEventListener = function (scope, typeStr, listenerFunc, data, useCapture) {
            if (useCapture === void 0) { useCapture = false; }
            var that = this;
            var scopedEventListener = function (e) {
                listenerFunc.apply(scope, [new shiva.Event(typeStr, that, data, e)]);
            };
            _super.prototype.addEventListener.call(this, scope, typeStr, listenerFunc, data, useCapture, scopedEventListener);
            if (this._element.addEventListener) {
                this._element.addEventListener(typeStr, scopedEventListener, useCapture);
            }
            else if (this._element["attachEvent"]) {
                this._element["attachEvent"]('on' + typeStr, scopedEventListener);
                this._element["attachEvent"]("onpropertychange", function (e) {
                    if (e.eventType === typeStr) {
                        e.cancelBubble = true;
                        e.returnValue = false;
                        e.data = e.customData;
                        scopedEventListener(e);
                    }
                });
            }
        };
        Container.prototype.removeEventListener = function (typeStr, listenerFunc) {
            var listener = _super.prototype.removeEventListener.call(this, typeStr, listenerFunc);
            if (this._element.removeEventListener) {
                this._element.removeEventListener(typeStr, listener.scopedEventListener, listener.useCapture);
            }
            else if (this._element["detachEvent"]) {
                this._element["detachEvent"]('on' + typeStr, listenerFunc);
            }
            return listener;
        };
        Container.prototype.preventDefault = function (e) {
            e.preventDefault ? e.preventDefault() : e.returnValue = false;
        };
        Object.defineProperty(Container.prototype, "width", {
            get: function () {
                return this.shadow().width;
            },
            set: function (w) {
                shiva.Properties.style(this._element, { width: w });
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Container.prototype, "height", {
            get: function () {
                return this.shadow().height;
            },
            set: function (h) {
                shiva.Properties.style(this._element, { height: h });
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Container.prototype, "y", {
            get: function () {
                return this._element.offsetTop;
            },
            set: function (yPos) {
                shiva.Properties.style(this._element, { y: yPos });
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Container.prototype, "x", {
            get: function () {
                return this._element.offsetLeft;
            },
            set: function (xPos) {
                shiva.Properties.style(this._element, { x: xPos });
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Container.prototype, "alpha", {
            get: function () {
                return parseFloat(this._element.style.opacity);
            },
            set: function (value) {
                shiva.Properties.style(this._element, { opacity: value.toString() });
            },
            enumerable: true,
            configurable: true
        });
        Container.prototype.hide = function () {
            shiva.Properties.style(this._element, { display: "none" });
        };
        Container.prototype.show = function () {
            shiva.Properties.style(this._element, { display: "block" });
        };
        Container.prototype.fillContainer = function () {
            shiva.Properties.style(this._element, {
                minWidth: "100%",
                minHeight: "100%",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                position: "relative"
            });
        };
        Container.prototype.centreHorizontal = function () {
            shiva.Properties.style(this._element, {
                display: "block",
                marginLeft: "auto",
                marginRight: "auto",
                position: "relative"
            });
        };
        Container.prototype.centreHorizontalText = function () {
            shiva.Properties.style(this._element, {
                textAlign: "center"
            });
        };
        Container.prototype.shadow = function () {
            if (!document.body.contains(this._element)) {
                var parent_1 = this._element.parentElement;
                document.body.appendChild(this._element);
                var dimensions = this.dimensionsPolyfill();
                document.body.removeChild(this._element);
                if (parent_1) {
                    parent_1.appendChild(this._element);
                }
                else {
                    document.body.removeChild(this._element);
                }
                return dimensions;
            }
            else {
                return this.dimensionsPolyfill();
            }
        };
        Container.prototype.dimensionsPolyfill = function () {
            var height = this._element.getBoundingClientRect().height;
            var width = this._element.getBoundingClientRect().width;
            if (width && height) {
            }
            else {
                width = this._element.scrollWidth;
                height = this._element.scrollHeight;
            }
            var dimensions = new shiva.Dimensions(width, height);
            return dimensions;
        };
        Object.defineProperty(Container.prototype, "value", {
            get: function () {
                var inputElement = this._element;
                return inputElement.value;
            },
            set: function (_value) {
                var inputElement = this._element;
                inputElement.value = _value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Container.prototype, "id", {
            get: function () {
                return this._element.id;
            },
            set: function (identifier) {
                this._element.id = identifier;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Container.prototype, "element", {
            get: function () {
                return this._element;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Container.prototype, "innerHtml", {
            get: function () {
                return this._element.innerHTML;
            },
            set: function (html) {
                this._element.innerHTML = html;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Container.prototype, "href", {
            get: function () {
                var element = this._element;
                return element.href;
            },
            set: function (link) {
                var element = this._element;
                element.href = link;
            },
            enumerable: true,
            configurable: true
        });
        Container.TRANSITION_COMPLETE = "TRANSITION_COMPLETE";
        return Container;
    }(shiva.EventDispatcher));
    shiva.Container = Container;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var Anchor = (function (_super) {
        __extends(Anchor, _super);
        function Anchor(config) {
            config.type = "a";
            _super.call(this, config);
            var element = this.element;
            element.href = config.href;
        }
        return Anchor;
    }(shiva.Container));
    shiva.Anchor = Anchor;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var Button = (function (_super) {
        __extends(Button, _super);
        function Button(config) {
            var type;
            if (config.href) {
                type = "a";
            }
            else {
                type = "button";
            }
            if (config.type) {
                type = config.type;
            }
            _super.call(this, {
                id: config.id,
                type: type,
                cursor: "pointer",
                display: "inline-block"
            });
            this.href = config.href;
            this.enabled = true;
            if (config.icon && config.icon.code) {
                this.icon = new shiva.Container({
                    type: "span",
                    text: config.icon.code
                });
            }
            this.update(config);
        }
        Button.prototype.update = function (config) {
            this.config = {};
            for (var i in shiva.Styles.button) {
                this.config[i] = shiva.Styles.button[i];
            }
            if (config && config.style) {
                for (var i in config.style) {
                    this.config[i] = config.style[i];
                }
            }
            for (var i in config) {
                this.config[i] = config[i];
            }
            if (config.style) {
                for (var i in config.style.icon) {
                    this.config.icon[i] = config.style.icon[i];
                }
            }
            this.innerHtml = config.text;
            this.addEventListener(this, "mouseover", this.overWithEnable);
            this.addEventListener(this, "mouseout", this.outWithEnable);
            if (this.config.icon && this.config.icon.code) {
                if (this.config.icon.align === "left") {
                    this.icon.style({
                        paddingRight: this.config.icon.padding,
                    });
                }
                else {
                    this.icon.style({
                        paddingLeft: this.config.icon.padding
                    });
                }
                this.icon.style({
                    fontFamily: this.config.icon.fontFamily,
                    fontSize: this.config.icon.fontSize,
                    float: this.config.icon.align,
                    pointerEvents: "none"
                });
                this.addChild(this.icon);
            }
            this.style(this.config);
        };
        Button.prototype.over = function () {
            this.to({
                duration: this.config.durationIn,
                toVars: {
                    backgroundColor: this.config.backgroundColorHover,
                    color: this.config.colorHover
                }
            });
        };
        Button.prototype.out = function () {
            this.to({
                duration: this.config.durationOut,
                toVars: {
                    backgroundColor: this.config.backgroundColor,
                    color: this.config.color
                }
            });
        };
        Button.prototype.click = function (e) {
            if (this.enabled) {
                var event = new shiva.Event(Button.CLICK, this, e);
                this.dispatchEvent(event);
            }
        };
        Button.prototype.disable = function () {
            this.enabled = false;
            this.style({ cursor: "default" });
        };
        Button.prototype.select = function () {
            this.enabled = false;
            this.style({ cursor: "default" });
        };
        Button.prototype.enable = function () {
            this.enabled = true;
            this.style({ cursor: "pointer" });
            this.out();
        };
        Object.defineProperty(Button.prototype, "data", {
            get: function () {
                return this.config.data;
            },
            enumerable: true,
            configurable: true
        });
        Button.prototype.overWithEnable = function (e) {
            if (this.enabled) {
                this.over();
            }
        };
        Button.prototype.outWithEnable = function (e) {
            if (this.enabled) {
                this.out();
            }
        };
        Button.CLICK = "click";
        return Button;
    }(shiva.Container));
    shiva.Button = Button;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var CheckBox = (function (_super) {
        __extends(CheckBox, _super);
        function CheckBox(config) {
            _super.call(this, {
                type: "input"
            });
            var element = this.element;
            element.type = "checkbox";
            if (config) {
                if (config.id) {
                    this.id = config.id;
                }
                this.style(config.style);
                this.style(config);
                element.checked = config.checked;
            }
        }
        Object.defineProperty(CheckBox.prototype, "checked", {
            get: function () {
                var element = this.element;
                return element.checked;
            },
            enumerable: true,
            configurable: true
        });
        CheckBox.CLICK = "click";
        return CheckBox;
    }(shiva.Container));
    shiva.CheckBox = CheckBox;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var Dimensions = (function () {
        function Dimensions(width, height) {
            this.width = width;
            this.height = height;
        }
        return Dimensions;
    }());
    shiva.Dimensions = Dimensions;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var Ease = (function () {
        function Ease() {
        }
        Ease.Linear = "linear";
        Ease.Ease = "ease";
        Ease.EaseIn = "ease-in";
        Ease.EaseOut = "ease-out";
        Ease.EaseInOut = "ease-in-out";
        return Ease;
    }());
    shiva.Ease = Ease;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var Image = (function (_super) {
        __extends(Image, _super);
        function Image(config) {
            var containerConfig;
            if (config.style) {
                containerConfig = config.style;
            }
            else {
                containerConfig = {};
            }
            containerConfig.type = "img";
            _super.call(this, containerConfig);
            this.load(config.path);
        }
        Image.prototype.load = function (path) {
            this.element.setAttribute("src", path);
        };
        Image.COMPLETE = "load";
        Image.ERROR = "error";
        return Image;
    }(shiva.Container));
    shiva.Image = Image;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var Loader = (function (_super) {
        __extends(Loader, _super);
        function Loader() {
            _super.call(this);
        }
        Loader.prototype.load = function (url, method, params, headers, cache) {
            var _this = this;
            if (this.http) {
                this.http.abort();
            }
            else {
                this.http = new XMLHttpRequest();
            }
            if (method === shiva.Loader.GET) {
                url = url + this.concatParams(params);
            }
            this.http.open(method, url, true);
            this.http.timeout = 20000;
            if (headers) {
                headers.map(function (header) {
                    _this.http.setRequestHeader(header.value, header.variable);
                });
            }
            this.http.onreadystatechange = this.handleResponse.bind(this);
            return new Promise(function (resolve, reject) {
                _this.resolve = resolve;
                _this.reject = reject;
                _this.http.send(params);
            });
        };
        Loader.prototype.concatParams = function (params) {
            var queryString = "?";
            for (var i in params) {
                if (params.hasOwnProperty(i)) {
                    queryString = queryString.concat(i, "=", encodeURI(params[i]), "&");
                }
            }
            queryString = queryString.slice(0, -1);
            return queryString;
        };
        Loader.prototype.setRequestHeader = function (header) {
            this.http.setRequestHeader(header.value, header.variable);
        };
        Loader.prototype.handleResponse = function () {
            if (this.http.readyState === 4) {
                if (this.http.status === 200) {
                    var event_1 = new shiva.LoaderEvent(Loader.COMPLETE, this, this.http.responseText, this.http.status, this.http);
                    _super.prototype.dispatchEvent.call(this, event_1);
                    this.resolve(this.http.responseText);
                    this.http.onreadystatechange = undefined;
                }
                else {
                    var error = void 0;
                    if (this.http.status === 0) {
                        error = "Network Error 0x2ee7";
                    }
                    else {
                        error = this.http.statusText;
                    }
                    var event_2 = new shiva.LoaderEvent(Loader.ERROR, this, error, this.http.status, this.http);
                    _super.prototype.dispatchEvent.call(this, event_2);
                    this.reject({
                        error: error,
                        status: this.http.status
                    });
                }
            }
        };
        Loader.COMPLETE = "COMPLETE";
        Loader.ERROR = "ERROR";
        Loader.GET = "GET";
        Loader.PUT = "PUT";
        Loader.POST = "POST";
        Loader.UPDATE = "UPDATE";
        return Loader;
    }(shiva.EventDispatcher));
    shiva.Loader = Loader;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var LoaderEvent = (function (_super) {
        __extends(LoaderEvent, _super);
        function LoaderEvent(type, targetObj, response, status, httpMetaData, data, sourceEvent) {
            _super.call(this, type, targetObj, data, sourceEvent);
            this._response = response;
            this._status = status;
            this._httpMetaData = httpMetaData;
        }
        Object.defineProperty(LoaderEvent.prototype, "response", {
            get: function () {
                return this._response;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LoaderEvent.prototype, "status", {
            get: function () {
                return this._status;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(LoaderEvent.prototype, "httpMetaData", {
            get: function () {
                return this._httpMetaData;
            },
            enumerable: true,
            configurable: true
        });
        return LoaderEvent;
    }(shiva.Event));
    shiva.LoaderEvent = LoaderEvent;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var Observer = (function () {
        function Observer() {
        }
        Observer.addEventListener = function (scope, type, callback) {
            if (!this.observers[type]) {
                this.observers[type] = [];
            }
            this.observers[type].push({ scope: scope, type: type, callback: callback });
        };
        Observer.removeEventListener = function (type, callback) {
            var indexOfClosureToRemove;
            for (var i = 0; i < this.observers[type].length; i++) {
                if (this.observers[type].callback === callback) {
                    indexOfClosureToRemove = i;
                    break;
                }
            }
            this.observers[type].splice(indexOfClosureToRemove, 1);
        };
        Observer.dispatchEvent = function (evt) {
            var type = evt.type;
            if (this.observers[type]) {
                for (var i = 0; i < this.observers[type].length; i++) {
                    this.observers[type][i].callback.call(this.observers[type][i].scope, evt);
                }
            }
            else {
                console.log("DISPATCH ERROR: NO OBSERVER REGISTERED");
            }
        };
        Observer.observers = {};
        return Observer;
    }());
    shiva.Observer = Observer;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var Pages = (function (_super) {
        __extends(Pages, _super);
        function Pages(config) {
            _super.call(this, {
                id: config.id,
                position: "relative"
            });
            this.pages = {};
            this.zIndex = 100;
            this.config = config;
            this.style(config.style);
        }
        Pages.prototype.update = function (pageName) {
            var _this = this;
            if (pageName !== this.currentPageName) {
                if (this.config.pages[pageName]) {
                    clearTimeout(this.delayTimeout);
                    this.currentPageName = pageName;
                    if (this.currentPage) {
                        if (this.currentPage.sleep) {
                            this.currentPage.sleep();
                        }
                        if (this.config.delayTransition) {
                            var viewToRemove_1 = this.currentPage;
                            this.delayTimeout = setTimeout(function () {
                                _this.removeChild(viewToRemove_1);
                            }, this.config.delayTransition * 1000);
                        }
                        else {
                            this.removeChild(this.currentPage);
                        }
                    }
                    if (this.pages[pageName]) {
                    }
                    else {
                        var page = new this.config.pages[pageName](pageName);
                        this.pages[pageName] = page;
                    }
                    this.currentPage = this.pages[pageName];
                    if (this.currentPage.wake) {
                        this.currentPage.wake();
                    }
                    this.currentPage.style({
                        position: "absolute",
                        width: "100%",
                        top: "0px",
                        left: "0px"
                    });
                    this.addChild(this.currentPage);
                }
                else {
                }
            }
            else {
                console.log("view already loaded: ");
            }
        };
        return Pages;
    }(shiva.Container));
    shiva.Pages = Pages;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var RadioButton = (function (_super) {
        __extends(RadioButton, _super);
        function RadioButton(config) {
            _super.call(this, {
                type: "input"
            });
            var element = this.element;
            element.type = "radio";
            if (config) {
                if (config.id) {
                    this.id = config.id;
                }
                this.style(config.style);
                this.style(config);
                element.checked = config.checked;
            }
        }
        Object.defineProperty(RadioButton.prototype, "checked", {
            get: function () {
                var element = this.element;
                return element.checked;
            },
            enumerable: true,
            configurable: true
        });
        RadioButton.CLICK = "click";
        return RadioButton;
    }(shiva.Container));
    shiva.RadioButton = RadioButton;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var Resize = (function () {
        function Resize() {
        }
        Resize.proportionalOutside = function (objectWidth, objectHeight, areaWidth, areaHeight) {
            var ratio = objectWidth / objectHeight;
            var targetWidth = areaWidth;
            var targetHeight = areaWidth / ratio;
            if (targetHeight < areaHeight) {
                targetHeight = areaHeight;
                targetWidth = targetHeight * ratio;
            }
            return { height: targetHeight, width: targetWidth };
        };
        Resize.proportionalInside = function (objectWidth, objectHeight, areaWidth, areaHeight) {
            var ratio = objectWidth / objectHeight;
            var targetWidth = areaWidth;
            var targetHeight = areaWidth * ratio;
            if (targetHeight > areaHeight) {
                targetHeight = areaHeight;
                targetWidth = targetHeight * ratio;
            }
            return { height: targetHeight, width: targetWidth };
        };
        return Resize;
    }());
    shiva.Resize = Resize;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var Select = (function (_super) {
        __extends(Select, _super);
        function Select(config) {
            var _this = this;
            config.type = "select";
            _super.call(this, config);
            var element = this.element;
            if (config.name) {
                element.name = config.name;
            }
            var options = config.options;
            options.map(function (option) {
                var item = new shiva.Container({
                    text: option,
                    type: "option"
                });
                _this.addChild(item);
            });
        }
        Object.defineProperty(Select.prototype, "value", {
            get: function () {
                var element = this.element;
                return element.value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Select.prototype, "selectedIndex", {
            get: function () {
                var element = this.element;
                return element.selectedIndex;
            },
            enumerable: true,
            configurable: true
        });
        Select.CHANGE = "change";
        return Select;
    }(shiva.Container));
    shiva.Select = Select;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var Styles = (function () {
        function Styles() {
        }
        Styles.button = {
            fontSize: "1.2em",
            fontFamily: "sans-serif",
            fontWeight: "300",
            fontColourOver: 0x333333,
            fontColourOut: 0xffffff,
            letterSpacing: "0em",
            backgroundColor: "#f1f1f1",
            backgroundColorHover: "#dddddd",
            cornerRadius: "0.5em",
            durationOut: 1,
            durationIn: 0,
            padding: "0.5em",
            textAlign: "left",
            whiteSpace: "nowrap",
            msTouchAction: "manipulation",
            touchAction: "manipulation",
            cursor: "pointer",
            webkitUserSelect: "none",
            mozUserSelect: "none",
            msUserSelect: "none",
            userSelect: "none",
            backgroundImage: "none",
            border: "1px solid transparent",
            borderColor: "#dddddd",
            color: "#333333",
            colorHover: "#ffffff",
            text: "button"
        };
        Styles.caret = {
            width: "0px",
            height: "0px",
            borderLeftWidth: "0.35rem",
            borderLeftStyle: "solid",
            borderLeftColor: "transparent",
            borderRightWidth: "0.35rem",
            borderRightStyle: "solid",
            borderRightColor: "transparent",
            borderTopWidth: "0.35rem",
            borderTopStyle: "solid",
            borderTopColor: "black",
            display: "inline-block",
            verticalAlign: "middle",
            marginLeft: "0.35rem"
        };
        Styles.drop = {
            fontFamily: "sans-serif",
            fontSize: "1.2rem",
            backgroundColor: "#ffffff",
            backgroundColorHover: "#cccccc",
            colorHover: "#000000",
            color: "#000000",
            durationIn: 0,
            durationOut: 0.5,
            listStyle: "none",
            zIndex: "1000",
            position: "absolute",
            marginTop: "0px",
            minWidth: "5rem",
            border: "1px solid rgba(0,0,0,.15)",
            webkitBoxShadow: "0 6px 12px rgba(0,0,0,.175)",
            boxShadow: "0px 6px 12px rgba(0,0,0,0.175)",
            fontWeight: "300",
            paddingLeft: "0px",
            durationExpand: "0.5",
            durationContract: "0.5"
        };
        return Styles;
    }());
    shiva.Styles = Styles;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var Transition = (function () {
        function Transition() {
            this.callback = function () { console.log("not set"); };
        }
        Transition.prototype.then = function (callback, data) {
            this.callback = callback;
            console.log("callback: ", this.callback);
            return new Transition();
        };
        Transition.prototype.execute = function () {
            if (this.callback) {
                this.callback(this.data);
            }
        };
        Transition.prototype.printCallback = function () {
            return this;
        };
        return Transition;
    }());
    shiva.Transition = Transition;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var Window = (function () {
        function Window() {
        }
        Window.scrollY = function () {
            var scrollTop = document.body.scrollTop;
            if (scrollTop == 0) {
                if (window.pageYOffset) {
                    scrollTop = window.pageYOffset;
                }
                else {
                    scrollTop = (document.body.parentElement) ? document.body.parentElement.scrollTop : 0;
                }
            }
            return scrollTop;
        };
        Window.scrollX = function () {
            var scrollLeft = document.body.scrollLeft;
            if (scrollLeft == 0) {
                if (window.pageXOffset) {
                    scrollLeft = window.pageXOffset;
                }
                else {
                    scrollLeft = (document.body.parentElement) ? document.body.parentElement.scrollLeft : 0;
                }
            }
            return scrollLeft;
        };
        Object.defineProperty(Window, "height", {
            get: function () {
                return window.innerHeight
                    || document.documentElement.clientHeight
                    || document.body.clientHeight;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Window, "width", {
            get: function () {
                return window.innerWidth
                    || document.documentElement.clientWidth
                    || document.body.clientWidth;
            },
            enumerable: true,
            configurable: true
        });
        return Window;
    }());
    shiva.Window = Window;
})(shiva || (shiva = {}));
var shiva;
(function (shiva) {
    var DropDown = (function (_super) {
        __extends(DropDown, _super);
        function DropDown(config) {
            var _this = this;
            var buttonText = "Button";
            if (config.text) {
                buttonText = config.text;
            }
            config.text = undefined;
            config.position = "relative";
            _super.call(this, config);
            this.items = [];
            this.button = new shiva.Button({
                style: shiva.Styles.button,
                display: "inline-block",
                text: "button",
                type: "div",
                zIndex: "1001",
                position: "absolute"
            });
            if (config.button) {
                config.button.text = buttonText;
                this.button.update(config.button);
            }
            this.addChild(this.button);
            var caret = new shiva.Container({
                id: "drop-caret",
                style: shiva.Styles.caret,
                pointerEvents: "none"
            });
            if (config.caret) {
                caret.style(config.caret);
            }
            this.button.addChild(caret);
            this.button.addEventListener(this, "mousedown", this.buttonClicked);
            this.unorderedList = new shiva.Container({
                type: "ul",
                id: this.id
            });
            this.dropConfig = {};
            for (var i in shiva.Styles.drop) {
                this.dropConfig[i] = shiva.Styles.drop[i];
            }
            for (var i in config.drop) {
                this.dropConfig[i] = config.drop[i];
            }
            this.unorderedList.style(this.dropConfig);
            this.addChild(this.unorderedList);
            var count = 0;
            config.options.map(function (option) {
                var item = new shiva.Container({
                    id: count.toString(),
                    type: "li"
                });
                _this.unorderedList.addChild(item);
                var anchor = new shiva.Container({
                    id: count.toString(),
                    type: "a"
                });
                anchor.style({
                    display: "list-item",
                    position: "static",
                    color: _this.dropConfig.color,
                    paddingLeft: "0.5em",
                    paddingRight: "0px",
                    paddingBottom: "0.5em",
                    paddingTop: "0.5em",
                    cursor: "pointer"
                });
                _this.items.push(item);
                anchor.innerHtml = option;
                anchor.addEventListener(_this, "mouseover", _this.itemOver);
                anchor.addEventListener(_this, "mouseout", _this.itemOut);
                anchor.addEventListener(_this, "mousedown", _this.itemClicked);
                item.addChild(anchor);
                count++;
            });
            this.unorderedList.style({
                display: "none"
            });
            this.style(config);
        }
        DropDown.prototype.itemClicked = function (e) {
            var element = e.target;
            this.dispatchEvent(new shiva.Event(DropDown.CHANGE, this, element.id));
            this.unorderedList.style({
                opacity: "1"
            });
            this.unorderedList.addEventListener(this, shiva.Container.TRANSITION_COMPLETE, this.hideList);
            this.unorderedList.to({
                duration: this.dropConfig.durationContract,
                delay: 0.3,
                toVars: {
                    opacity: "0"
                }
            });
        };
        DropDown.prototype.itemOver = function (e) {
            var element = e.target;
            element.to({
                duration: this.dropConfig.durationIn,
                toVars: {
                    backgroundColor: this.dropConfig.backgroundColorHover,
                    color: this.dropConfig.colorHover
                }
            });
        };
        DropDown.prototype.itemOut = function (e) {
            var element = e.target;
            element.to({
                duration: this.dropConfig.durationOut,
                toVars: {
                    backgroundColor: this.dropConfig.backgroundColor,
                    color: this.dropConfig.color
                }
            });
        };
        DropDown.prototype.buttonClicked = function (e) {
            var _this = this;
            this.unorderedList.style({
                display: "block",
                opacity: "0",
                top: "0px"
            });
            this.unorderedList.to({
                duration: this.dropConfig.durationExpand,
                toVars: {
                    alpha: 1,
                    y: this.button.height
                }
            });
            this.scopedEventHandler = function (g) { _this.closeDrop(g); };
            document.body.addEventListener("mousedown", this.scopedEventHandler, true);
            this.button.removeEventListener("mousedown", this.buttonClicked);
        };
        DropDown.prototype.closeDrop = function (e) {
            var _this = this;
            document.body.removeEventListener("mousedown", this.scopedEventHandler, true);
            setTimeout(function () {
                _this.button.addEventListener(_this, "mousedown", _this.buttonClicked);
            }, 10);
            this.unorderedList.addEventListener(this, shiva.Container.TRANSITION_COMPLETE, this.hideList);
            this.unorderedList.to({
                duration: this.dropConfig.durationContract,
                toVars: {
                    opacity: "0",
                }
            });
        };
        DropDown.prototype.hideList = function () {
            this.unorderedList.removeEventListener(shiva.Container.TRANSITION_COMPLETE, this.hideList);
            this.unorderedList.style({
                display: "none"
            });
        };
        DropDown.prototype.disable = function () {
            this.button.disable();
            this.button.removeEventListener(shiva.Button.CLICK, this.buttonClicked);
        };
        DropDown.prototype.enable = function () {
            this.button.enable();
            this.button.addEventListener(this, shiva.Button.CLICK, this.buttonClicked);
        };
        DropDown.CHANGE = "change";
        return DropDown;
    }(shiva.Container));
    shiva.DropDown = DropDown;
})(shiva || (shiva = {}));

//# sourceMappingURL=shiva.js.map

 /** Detect free variable `global` from Node.js. */
    var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

    /** Detect free variable `self`. */
    var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

    /** Used as a reference to the global object. */
    var root = freeGlobal || freeSelf || Function('return this')();

    /** Detect free variable `exports`. */
    var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

    /** Detect free variable `module`. */
    var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

    /** Detect the popular CommonJS extension `module.exports`. */
    var moduleExports = freeModule && freeModule.exports === freeExports;

    /** Detect free variable `process` from Node.js. */
    var freeProcess = moduleExports && freeGlobal.process;

    // Some AMD build optimizers, like r.js, check for condition patterns like:
    if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
        // Expose Lodash on the global object to prevent errors when Lodash is
        // loaded by a script tag in the presence of an AMD loader.
        // See http://requirejs.org/docs/errors.html#mismatch for more details.
        // Use `_.noConflict` to remove Lodash from the global object.
        root.shiva = shiva;

        // Define as an anonymous module so, through path mapping, it can be
        // referenced as the "underscore" module.
        define(function () {
            return shiva;
        });
    }
    // Check for `exports` after `define` in case a build optimizer adds it.
    else if (freeModule) {
        // Export for Node.js.
        (freeModule.exports = shiva).shiva = shiva;
        // Export for CommonJS support.
        freeExports.shiva = shiva;
    }
    else {
        // Export to the global object.
        root.shiva = shiva;
    }
}.call(this));
