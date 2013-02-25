// Ruby v0.3.27
// http://Ruby.github.com
// Copyright 2012, Adam Beynon
// Released under the MIT License
(function(undefined) {
// The Ruby object that is exposed globally
var Ruby = this.Ruby = {};

// Core Object class
function Object(){}

// Class' class
function Class(){}

// the class of nil
function NilClass(){}

// TopScope is used for inheriting constants from the top scope
var TopScope = function(){};

// Ruby just acts as the top scope
TopScope.prototype = Ruby;

// To inherit scopes
Ruby.alloc  = TopScope;

// This is a useful reference to global object inside ruby files
Ruby.global = this;

// Minify common function calls
var __hasOwn = Ruby.hasOwnProperty;
var __slice  = Ruby.slice = Array.prototype.slice;

// Generates unique id for every ruby object
var unique_id = 0;

// Table holds all class variables
Ruby.cvars = {};

// Globals table
Ruby.gvars = {};

Ruby.klass = function(base, superklass, id, constructor) {
  var klass;
  if (base._isObject) {
    base = base._klass;
  }

  if (superklass === null) {
    superklass = Object;
  }

  if (__hasOwn.call(base._scope, id)) {
    klass = base._scope[id];
  }
  else {
    if (!superklass._methods) {
      var bridged = superklass;
      superklass  = Object;
      klass       = bridge_class(bridged);
    }
    else {
      klass = boot_class(superklass, constructor);
    }

    klass._name = (base === Object ? id : base._name + '::' + id);

    var const_alloc   = function() {};
    var const_scope   = const_alloc.prototype = new base._scope.alloc();
    klass._scope      = const_scope;
    const_scope.alloc = const_alloc;

    base[id] = base._scope[id] = klass;

    if (superklass.$inherited) {
      superklass.$inherited(klass);
    }
  }

  return klass;
};

// Define new module (or return existing module)
Ruby.module = function(base, id, constructor) {
  var klass;
  if (base._isObject) {
    base = base._klass;
  }

  if (__hasOwn.call(base._scope, id)) {
    klass = base._scope[id];
  }
  else {
    klass = boot_class(Class, constructor);
    klass._name = (base === Object ? id : base._name + '::' + id);

    klass._isModule = true;
    klass.$included_in = [];

    var const_alloc   = function() {};
    var const_scope   = const_alloc.prototype = new base._scope.alloc();
    klass._scope      = const_scope;
    const_scope.alloc = const_alloc;

    base[id] = base._scope[id]    = klass;
  }

  return klass;
}

// Utility function to raise a "no block given" error
var no_block_given = function() {
  throw new Error('no block given');
};

// Boot a base class (makes instances).
var boot_defclass = function(id, constructor, superklass) {
  if (superklass) {
    var ctor           = function() {};
        ctor.prototype = superklass.prototype;

    constructor.prototype = new ctor();
  }

  var prototype = constructor.prototype;

  prototype.constructor = constructor;
  prototype._isObject   = true;
  prototype._klass      = constructor;

  constructor._included_in  = [];
  constructor._isClass      = true;
  constructor._name         = id;
  constructor._super        = superklass;
  constructor._methods      = [];
  constructor._smethods     = [];
  constructor._isObject     = false;

  constructor._donate = __donate;
  constructor._sdonate = __sdonate;

  Ruby[id] = constructor;

  return constructor;
};

// Create generic class with given superclass.
var boot_class = function(superklass, constructor) {
  var ctor = function() {};
      ctor.prototype = superklass.prototype;

  constructor.prototype = new ctor();
  var prototype = constructor.prototype;

  prototype._klass      = constructor;
  prototype.constructor = constructor;

  constructor._included_in  = [];
  constructor._isClass      = true;
  constructor._super        = superklass;
  constructor._methods      = [];
  constructor._isObject     = false;
  constructor._klass        = Class;
  constructor._donate       = __donate
  constructor._sdonate      = __sdonate;

  constructor['$==='] = module_eqq;
  constructor.$to_s = module_to_s;

  var smethods;

  smethods = superklass._smethods.slice();

  constructor._smethods = smethods;
  for (var i = 0, length = smethods.length; i < length; i++) {
    var m = smethods[i];
    constructor[m] = superklass[m];
  }

  return constructor;
};

var bridge_class = function(constructor) {
  constructor.prototype._klass = constructor;

  constructor._included_in  = [];
  constructor._isClass      = true;
  constructor._super        = Object;
  constructor._klass        = Class;
  constructor._methods      = [];
  constructor._smethods     = [];
  constructor._isObject     = false;

  constructor._donate = function(){};
  constructor._sdonate = __sdonate;

  constructor['$==='] = module_eqq;
  constructor.$to_s = module_to_s;

  var smethods = constructor._smethods = Class._methods.slice();
  for (var i = 0, length = smethods.length; i < length; i++) {
    var m = smethods[i];
    constructor[m] = Object[m];
  }

  bridged_classes.push(constructor);

  var table = Object.prototype, methods = Object._methods;

  for (var i = 0, length = methods.length; i < length; i++) {
    var m = methods[i];
    constructor.prototype[m] = table[m];
  }

  constructor._smethods.push('$allocate');

  return constructor;
};

Ruby.puts = function(a) { console.log(a); };

// Initialization
// --------------

boot_defclass('Object', Object);
boot_defclass('Class', Class, Object);

Class.prototype = Function.prototype;
Object._klass = Class._klass = Class;

// Implementation of Class#===
function module_eqq(object) {
  if (object == null) {
    return false;
  }

  var search = object._klass;

  while (search) {
    if (search === this) {
      return true;
    }

    search = search._super;
  }

  return false;
}

// Implementation of Class#to_s
function module_to_s() {
  return this._name;
}

// Donator for all 'normal' classes and modules
function __donate(defined, indirect) {
  var methods = this._methods, included_in = this.$included_in;

  // if (!indirect) {
    this._methods = methods.concat(defined);
  // }

  if (included_in) {
    for (var i = 0, length = included_in.length; i < length; i++) {
      var includee = included_in[i];
      var dest = includee.prototype;

      for (var j = 0, jj = defined.length; j < jj; j++) {
        var method = defined[j];
        dest[method] = this.prototype[method];
      }

      if (includee.$included_in) {
        includee._donate(defined, true);
      }
    }

  }
}

// Donator for singleton (class) methods
function __sdonate(defined) {
  this._smethods = this._smethods.concat(defined);
}

var bridged_classes = Object.$included_in = [];

Object._scope = Ruby;
Ruby.Module = Ruby.Class;
Ruby.Kernel = Object;

var class_const_alloc = function(){};
var class_const_scope = new TopScope();
class_const_scope.alloc = class_const_alloc;
Class._scope = class_const_scope;

Object.prototype.toString = function() {
  return this.$to_s();
};

Ruby.top = new Object;

Ruby.klass(Object, Object, 'NilClass', NilClass)
Ruby.nil = new NilClass;
Ruby.nil.call = Ruby.nil.apply = no_block_given;

Ruby.breaker  = new Error('unexpected break');
Ruby.version = "0.3.27";
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, def = self._klass.prototype, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __gvars = __Ruby.gvars;

  __gvars["~"] = nil;
  __gvars["/"] = "\n";
  __scope.RUBY_ENGINE = "Ruby";
  __scope.RUBY_PLATFORM = "Ruby";
  __scope.RUBY_VERSION = "1.9.2";
  __scope.Ruby_VERSION = __Ruby.version;
  self.$to_s = function() {

    return "main";
  };
  return self.$include = function(mod) {

    return __scope.Object.$include(mod);
  };
})();
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __klass = __Ruby.klass;

  return (function(__base, __super){
    // line 1, /Users/elia/Code/Ruby/core/class.rb, class Class
    function Class() {};
    Class = __klass(__base, __super, "Class", Class);

    ;Class._sdonate(["$new"]);    var Class_prototype = Class.prototype, __scope = Class._scope, TMP_1, TMP_2, TMP_3, TMP_4;

    Class.$new = TMP_1 = function(sup) {
      var __context, block;
      block = TMP_1._p || nil, __context = block._s, TMP_1._p = null;
      if (sup == null) {
        sup = __scope.Object
      }

      function AnonClass(){};
      var klass   = boot_class(sup, AnonClass)
      klass._name = nil;

      sup.$inherited(klass);

      if (block !== nil) {
        block.call(klass);
      }

      return klass;

    };

    Class_prototype.$allocate = function() {


      var obj = new this;
      obj._id = unique_id++;
      return obj;

    };

    Class_prototype.$alias_method = function(newname, oldname) {

      this.prototype['$' + newname] = this.prototype['$' + oldname];
      return this;
    };

    Class_prototype.$ancestors = function() {


      var parent = this,
          result = [];

      while (parent) {
        result.push(parent);
        parent = parent._super;
      }

      return result;

    };

    Class_prototype.$append_features = function(klass) {


      var module = this;

      if (!klass.$included_modules) {
        klass.$included_modules = [];
      }

      for (var idx = 0, length = klass.$included_modules.length; idx < length; idx++) {
        if (klass.$included_modules[idx] === module) {
          return;
        }
      }

      klass.$included_modules.push(module);

      if (!module.$included_in) {
        module.$included_in = [];
      }

      module.$included_in.push(klass);

      var donator   = module.prototype,
          prototype = klass.prototype,
          methods   = module._methods;

      for (var i = 0, length = methods.length; i < length; i++) {
        var method = methods[i];
        prototype[method] = donator[method];
      }

      if (klass.$included_in) {
        klass._donate(methods.slice(), true);
      }

      return this;
    };

    Class_prototype.$attr_accessor = function() {

      return nil;
    };

    Class_prototype.$attr_reader = Class_prototype.$attr_accessor;

    Class_prototype.$attr_writer = Class_prototype.$attr_accessor;

    Class_prototype.$attr = Class_prototype.$attr_accessor;

    Class_prototype.$define_method = TMP_2 = function(name) {
      var __context, block;
      block = TMP_2._p || nil, __context = block._s, TMP_2._p = null;


      if (block === nil) {
        no_block_given();
      }

      var jsid    = '$' + name;
      block._jsid = jsid;
      block._sup  = this.prototype[jsid];

      this.prototype[jsid] = block;
      this._donate([jsid]);

      return nil;

    };

    Class_prototype.$include = function(mods) {
      mods = __slice.call(arguments, 0);

      var i = mods.length - 1, mod;
      while (i >= 0) {
        mod = mods[i];
        i--;

        if (mod === this) {
          continue;
        }

        (mod).$append_features(this);
        (mod).$included(this);
      }

      return this;

    };

    Class_prototype.$instance_methods = function(include_super) {
      if (include_super == null) {
        include_super = false
      }

      var methods = [], proto = this.prototype;

      for (var prop in this.prototype) {
        if (!include_super && !proto.hasOwnProperty(prop)) {
          continue;
        }

        if (prop.charAt(0) === '$') {
          methods.push(prop.substr(1));
        }
      }

      return methods;

    };

    Class_prototype.$included = function(mod) {

      return nil;
    };

    Class_prototype.$inherited = function(cls) {

      return nil;
    };

    Class_prototype.$module_eval = TMP_3 = function() {
      var __context, block;
      block = TMP_3._p || nil, __context = block._s, TMP_3._p = null;


      if (block === nil) {
        no_block_given();
      }

      return block.call(this);

    };

    Class_prototype.$class_eval = Class_prototype.$module_eval;

    Class_prototype.$name = function() {

      return this._name;
    };

    Class_prototype.$new = TMP_4 = function(args) {
      var __context, block;
      block = TMP_4._p || nil, __context = block._s, TMP_4._p = null;
      args = __slice.call(arguments, 0);

      var obj = new this;
      obj._id = unique_id++;
      obj.$initialize._p  = block;

      obj.$initialize.apply(obj, args);
      return obj;

    };

    Class_prototype.$public = function() {

      return nil;
    };

    Class_prototype.$private = Class_prototype.$public;

    Class_prototype.$protected = Class_prototype.$public;

    Class_prototype.$superclass = function() {


      return this._super || nil;

    };

    return nil;
  })(self, null)
})();
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __module = __Ruby.module;

  return (function(__base){
    // line 1, /Users/elia/Code/Ruby/core/kernel.rb, module Kernel
    function Kernel() {};
    Kernel = __module(__base, "Kernel", Kernel);
    var Kernel_prototype = Kernel.prototype, __scope = Kernel._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_7, TMP_8;

    Kernel_prototype['$=~'] = function(obj) {

      return false;
    };

    Kernel_prototype['$=='] = function(other) {

      return this === other;
    };

    Kernel_prototype['$==='] = function(other) {

      return this == other;
    };

    Kernel_prototype.$__send__ = TMP_1 = function(symbol, args) {
      var __context, block;
      block = TMP_1._p || nil, __context = block._s, TMP_1._p = null;
      args = __slice.call(arguments, 1);

      return this['$' + symbol].apply(this, args);

    };

    Kernel_prototype['$eql?'] = Kernel_prototype['$=='];

    Kernel_prototype.$Array = function(object) {


      if (object.$to_ary) {
        return object.$to_ary();
      }
      else if (object.$to_a) {
        return object.$to_a();
      }

      return [object];

    };

    Kernel_prototype.$attribute_get = function(name) {


      var meth = '$' + name;
      if (this[meth]) {
        return this[meth]();
      }

      meth += '?';
      if (this[meth]) {
        return this[meth]()
      }

      return nil;

    };

    Kernel_prototype.$attribute_set = function(name, value) {


    if (this['$' + name + '=']) {
      return this['$' + name + '='](value);
    }

    return nil;

    };

    Kernel_prototype.$class = function() {

      return this._klass;
    };

    Kernel_prototype.$define_singleton_method = TMP_2 = function(name) {
      var __context, body;
      body = TMP_2._p || nil, __context = body._s, TMP_2._p = null;


      if (body === nil) {
        no_block_given();
      }

      var jsid   = '$' + name;
      body._jsid = jsid;
      body._sup  = this[jsid]

      this[jsid] = body;

      return this;

    };

    Kernel_prototype['$equal?'] = function(other) {

      return this === other;
    };

    Kernel_prototype.$extend = function(mods) {
      mods = __slice.call(arguments, 0);

      for (var i = 0, length = mods.length; i < length; i++) {
        this.$singleton_class().$include(mods[i]);
      }

      return this;

    };

    Kernel_prototype.$hash = function() {

      return this._id;
    };

    Kernel_prototype.$initialize = function() {

      return nil;
    };

    Kernel_prototype.$inspect = function() {

      return this.$to_s();
    };

    Kernel_prototype.$instance_eval = TMP_3 = function(string) {
      var __context, block;
      block = TMP_3._p || nil, __context = block._s, TMP_3._p = null;


      if (block === nil) {
        no_block_given();
      }

      return block.call(this, this);

    };

    Kernel_prototype.$instance_exec = TMP_4 = function(args) {
      var __context, block;
      block = TMP_4._p || nil, __context = block._s, TMP_4._p = null;
      args = __slice.call(arguments, 0);

      if (block === nil) {
        no_block_given();
      }

      return block.apply(this, args);

    };

    Kernel_prototype['$instance_of?'] = function(klass) {

      return this._klass === klass;
    };

    Kernel_prototype['$instance_variable_defined?'] = function(name) {

      return __hasOwn.call(this, name.substr(1));
    };

    Kernel_prototype.$instance_variable_get = function(name) {


      var ivar = this[name.substr(1)];

      return ivar == null ? nil : ivar;

    };

    Kernel_prototype.$instance_variable_set = function(name, value) {

      return this[name.substr(1)] = value;
    };

    Kernel_prototype.$instance_variables = function() {


      var result = [];

      for (var name in this) {
        result.push(name);
      }

      return result;

    };

    Kernel_prototype['$is_a?'] = function(klass) {


      var search = this._klass;

      while (search) {
        if (search === klass) {
          return true;
        }

        search = search._super;
      }

      return false;

    };

    Kernel_prototype['$kind_of?'] = Kernel_prototype['$is_a?'];

    Kernel_prototype.$lambda = TMP_5 = function() {
      var __context, block;
      block = TMP_5._p || nil, __context = block._s, TMP_5._p = null;

      return block;
    };

    Kernel_prototype.$loop = TMP_6 = function() {
      var __context, block;
      block = TMP_6._p || nil, __context = block._s, TMP_6._p = null;

      while (true) {;
      if (block.call(__context) === __breaker) return __breaker.$v;
      };
      return this;
    };

    Kernel_prototype['$nil?'] = function() {

      return false;
    };

    Kernel_prototype.$object_id = function() {

      return this._id || (this._id = unique_id++);
    };

    Kernel_prototype.$proc = TMP_7 = function() {
      var __context, block;
      block = TMP_7._p || nil, __context = block._s, TMP_7._p = null;


      if (block === nil) {
        no_block_given();
      }
      block.is_lambda = false;
      return block;

    };

    Kernel_prototype.$puts = function(strs) {
      strs = __slice.call(arguments, 0);

      for (var i = 0; i < strs.length; i++) {
        __Ruby.puts((strs[i]).$to_s());
      }

      return nil;
    };

    Kernel_prototype.$print = Kernel_prototype.$puts;

    Kernel_prototype.$raise = function(exception, string) {


      if (typeof(exception) === 'string') {
        exception = __scope.RuntimeError.$new(exception);
      }
      else if (!exception['$is_a?'](__scope.Exception)) {
        exception = exception.$new(string);
      }

      throw exception;

    };

    Kernel_prototype.$rand = function(max) {

      return max == null ? Math.random() : Math.floor(Math.random() * max);
    };

    Kernel_prototype['$respond_to?'] = function(name) {

      return !!this['$' + name];
    };

    Kernel_prototype.$send = Kernel_prototype.$__send__;

    Kernel_prototype.$singleton_class = function() {


      if (this._isClass) {
        if (this._singleton) {
          return this._singleton;
        }

        var meta = new __Ruby.Class;
        meta._klass = __Ruby.Class;
        this._singleton = meta;
        meta.prototype = this;

        return meta;
      }

      if (!this._isObject) {
        return this._klass;
      }

      if (this._singleton) {
        return this._singleton;
      }

      else {
        var orig_class = this._klass,
            class_id   = "#<Class:#<" + orig_class._name + ":" + orig_class._id + ">>";

        function Singleton() {};
        var meta = boot_class(orig_class, Singleton);
        meta._name = class_id;

        meta.prototype = this;
        this._singleton = meta;
        meta._klass = orig_class._klass;

        return meta;
      }

    };

    Kernel_prototype.$tap = TMP_8 = function() {
      var __context, block;
      block = TMP_8._p || nil, __context = block._s, TMP_8._p = null;

      if (block.call(__context, this) === __breaker) return __breaker.$v;
      return this;
    };

    Kernel_prototype.$to_json = function() {

      return this.$to_s().$to_json();
    };

    Kernel_prototype.$to_proc = function() {

      return this;
    };

    Kernel_prototype.$to_s = function() {

      return "#<" + this._klass._name + ":" + this._id + ">";
    };
        ;Kernel._donate(["$=~", "$==", "$===", "$__send__", "$eql?", "$Array", "$attribute_get", "$attribute_set", "$class", "$define_singleton_method", "$equal?", "$extend", "$hash", "$initialize", "$inspect", "$instance_eval", "$instance_exec", "$instance_of?", "$instance_variable_defined?", "$instance_variable_get", "$instance_variable_set", "$instance_variables", "$is_a?", "$kind_of?", "$lambda", "$loop", "$nil?", "$object_id", "$proc", "$puts", "$print", "$raise", "$rand", "$respond_to?", "$send", "$singleton_class", "$tap", "$to_json", "$to_proc", "$to_s"]);
  })(self)
})();
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __klass = __Ruby.klass;

  return (function(__base, __super){
    // line 1, /Users/elia/Code/Ruby/core/nil_class.rb, class NilClass
    function NilClass() {};
    NilClass = __klass(__base, __super, "NilClass", NilClass);

    var NilClass_prototype = NilClass.prototype, __scope = NilClass._scope;

    NilClass_prototype['$&'] = function(other) {

      return false;
    };

    NilClass_prototype['$|'] = function(other) {

      return other !== false && other !== nil;
    };

    NilClass_prototype['$^'] = function(other) {

      return other !== false && other !== nil;
    };

    NilClass_prototype['$=='] = function(other) {

      return other === nil;
    };

    NilClass_prototype.$inspect = function() {

      return "nil";
    };

    NilClass_prototype['$nil?'] = function() {

      return true;
    };

    NilClass_prototype.$singleton_class = function() {

      return __scope.NilClass;
    };

    NilClass_prototype.$to_a = function() {

      return [];
    };

    NilClass_prototype.$to_i = function() {

      return 0;
    };

    NilClass_prototype.$to_f = NilClass_prototype.$to_i;

    NilClass_prototype.$to_json = function() {

      return "null";
    };

    NilClass_prototype.$to_native = function() {

      return null;
    };

    NilClass_prototype.$to_s = function() {

      return "";
    };

    return nil;
  })(self, null)
})();
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __klass = __Ruby.klass;

  return (function(__base, __super){
    // line 1, /Users/elia/Code/Ruby/core/boolean.rb, class Boolean
    function Boolean() {};
    Boolean = __klass(__base, __super, "Boolean", Boolean);

    var Boolean_prototype = Boolean.prototype, __scope = Boolean._scope;


    Boolean_prototype._isBoolean = true;


    Boolean_prototype['$&'] = function(other) {

      return (this == true) ? (other !== false && other !== nil) : false;
    };

    Boolean_prototype['$|'] = function(other) {

      return (this == true) ? true : (other !== false && other !== nil);
    };

    Boolean_prototype['$^'] = function(other) {

      return (this == true) ? (other === false || other === nil) : (other !== false && other !== nil);
    };

    Boolean_prototype['$=='] = function(other) {

      return (this == true) === other.valueOf();
    };

    Boolean_prototype.$singleton_class = Boolean_prototype.$class;

    Boolean_prototype.$to_json = function() {

      return (this == true) ? 'true' : 'false';
    };

    Boolean_prototype.$to_s = function() {

      return (this == true) ? 'true' : 'false';
    };

    return nil;
  })(self, Boolean)
})();
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __klass = __Ruby.klass;

  (function(__base, __super){
    // line 1, /Users/elia/Code/Ruby/core/error.rb, class Exception
    function Exception() {};
    Exception = __klass(__base, __super, "Exception", Exception);

    ;Exception._sdonate(["$new"]);    var Exception_prototype = Exception.prototype, __scope = Exception._scope;
    Exception_prototype.message = nil;

    Exception_prototype.$message = function() {

      return this.message
    }, nil;

    Exception.$new = function(message) {
      if (message == null) {
        message = ""
      }

      var err = new Error(message);
      err._klass = this;
      return err;

    };

    Exception_prototype.$backtrace = function() {


      var backtrace = this.stack;

      if (typeof(backtrace) === 'string') {
        return backtrace.split("\n").slice(0, 15);
      }
      else if (backtrace) {
        return backtrace.slice(0, 15);
      }

      return [];

    };

    Exception_prototype.$inspect = function() {

      return "#<" + (this.$class().$name()) + ": '" + (this.message) + "'>";
    };

    return Exception_prototype.$to_s = Exception_prototype.$message;
  })(self, Error);
  __scope.StandardError = __scope.Exception;
  __scope.RuntimeError = __scope.Exception;
  __scope.LocalJumpError = __scope.Exception;
  __scope.TypeError = __scope.Exception;
  __scope.NameError = __scope.Exception;
  __scope.NoMethodError = __scope.Exception;
  __scope.ArgumentError = __scope.Exception;
  __scope.IndexError = __scope.Exception;
  __scope.KeyError = __scope.Exception;
  return __scope.RangeError = __scope.Exception;
})();
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __klass = __Ruby.klass, __gvars = __Ruby.gvars;

  (function(__base, __super){
    // line 1, /Users/elia/Code/Ruby/core/regexp.rb, class Regexp
    function Regexp() {};
    Regexp = __klass(__base, __super, "Regexp", Regexp);

    ;Regexp._sdonate(["$escape", "$new"]);    var Regexp_prototype = Regexp.prototype, __scope = Regexp._scope;

    Regexp.$escape = function(string) {

      return string.replace(/([.*+?^=!:${}()|[]\/\])/g, '\$1');
    };

    Regexp.$new = function(string, options) {

      return new RegExp(string, options);
    };

    Regexp_prototype['$=='] = function(other) {

      return other.constructor == RegExp && this.toString() === other.toString();
    };

    Regexp_prototype['$==='] = Regexp_prototype.test;

    Regexp_prototype['$=~'] = function(string) {


      var result = this.exec(string);

      if (result) {
        result.$to_s    = match_to_s;
        result.$inspect = match_inspect;
        result._klass = __scope.MatchData;

        __gvars["~"] = result;
      }
      else {
        __gvars["~"] = nil;
      }

      return result ? result.index : nil;

    };

    Regexp_prototype['$eql?'] = Regexp_prototype['$=='];

    Regexp_prototype.$inspect = Regexp_prototype.toString;

    Regexp_prototype.$match = function(pattern) {


      var result  = this.exec(pattern);

      if (result) {
        result.$to_s    = match_to_s;
        result.$inspect = match_inspect;
        result._klass = __scope.MatchData;

        return __gvars["~"] = result;
      }
      else {
        return __gvars["~"] = nil;
      }

    };

    Regexp_prototype.$to_s = function() {

      return this.source;
    };


    function match_to_s() {
      return this[0];
    }

    function match_inspect() {
      return "<#MatchData " + this[0].$inspect() + ">";
    }

  })(self, RegExp);
  return (function(__base, __super){
    // line 71, /Users/elia/Code/Ruby/core/regexp.rb, class MatchData
    function MatchData() {};
    MatchData = __klass(__base, __super, "MatchData", MatchData);

    var MatchData_prototype = MatchData.prototype, __scope = MatchData._scope;

    return nil
  })(self, null);
})();
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __module = __Ruby.module;

  return (function(__base){
    // line 1, /Users/elia/Code/Ruby/core/comparable.rb, module Comparable
    function Comparable() {};
    Comparable = __module(__base, "Comparable", Comparable);
    var Comparable_prototype = Comparable.prototype, __scope = Comparable._scope;

    Comparable_prototype['$<'] = function(other) {

      return this['$<=>'](other)['$=='](-1);
    };

    Comparable_prototype['$<='] = function(other) {

      return this['$<=>'](other)['$<='](0);
    };

    Comparable_prototype['$=='] = function(other) {

      return this['$<=>'](other)['$=='](0);
    };

    Comparable_prototype['$>'] = function(other) {

      return this['$<=>'](other)['$=='](1);
    };

    Comparable_prototype['$>='] = function(other) {

      return this['$<=>'](other)['$>='](0);
    };

    Comparable_prototype['$between?'] = function(min, max) {
      var __a;
      return ((__a = this['$>'](min)) ? this['$<'](max) : __a);
    };
        ;Comparable._donate(["$<", "$<=", "$==", "$>", "$>=", "$between?"]);
  })(self)
})();
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __module = __Ruby.module;

  return (function(__base){
    // line 1, /Users/elia/Code/Ruby/core/enumerable.rb, module Enumerable
    function Enumerable() {};
    Enumerable = __module(__base, "Enumerable", Enumerable);
    var Enumerable_prototype = Enumerable.prototype, __scope = Enumerable._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_7, TMP_8, TMP_9, TMP_10, TMP_11;

    Enumerable_prototype['$all?'] = TMP_1 = function() {
      var __context, block;
      block = TMP_1._p || nil, __context = block._s, TMP_1._p = null;


      var result = true, proc;

      if (block !== nil) {
        proc = function(obj) {
          var value;

          if ((value = block.call(__context, obj)) === __breaker) {
            return __breaker.$v;
          }

          if (value === false || value === nil) {
            result = false;
            __breaker.$v = nil;

            return __breaker;
          }
        }
      }
      else {
        proc = function(obj) {
          if (obj === false || obj === nil) {
            result = false;
            __breaker.$v = nil;

            return __breaker;
          }
        }
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    Enumerable_prototype['$any?'] = TMP_2 = function() {
      var __context, block;
      block = TMP_2._p || nil, __context = block._s, TMP_2._p = null;


      var result = false, proc;

      if (block !== nil) {
        proc = function(obj) {
          var value;

          if ((value = block.call(__context, obj)) === __breaker) {
            return __breaker.$v;
          }

          if (value !== false && value !== nil) {
            result       = true;
            __breaker.$v = nil;

            return __breaker;
          }
        }
      }
      else {
        proc = function(obj) {
          if (obj !== false && obj !== nil) {
            result      = true;
            __breaker.$v = nil;

            return __breaker;
          }
        }
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    Enumerable_prototype.$collect = TMP_3 = function() {
      var __context, block;
      block = TMP_3._p || nil, __context = block._s, TMP_3._p = null;


      var result = [];

      var proc = function() {
        var obj = __slice.call(arguments), value;

        if ((value = block.apply(__context, obj)) === __breaker) {
          return __breaker.$v;
        }

        result.push(value);
      };

      this.$each._p = proc;
      this.$each();

      return result;

    };

    Enumerable_prototype.$count = TMP_4 = function(object) {
      var __context, block;
      block = TMP_4._p || nil, __context = block._s, TMP_4._p = null;


      var result = 0;

      if (object != null) {
        block = function(obj) { return (obj)['$=='](object); };
      }
      else if (block === nil) {
        block = function() { return true; };
      }

      var proc = function(obj) {
        var value;

        if ((value = block.call(__context, obj)) === __breaker) {
          return __breaker.$v;
        }

        if (value !== false && value !== nil) {
          result++;
        }
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    Enumerable_prototype.$detect = TMP_5 = function(ifnone) {
      var __context, block;
      block = TMP_5._p || nil, __context = block._s, TMP_5._p = null;


      var result = nil;

      this.$each._p = function(obj) {
        var value;

        if ((value = block.call(__context, obj)) === __breaker) {
          return __breaker.$v;
        }

        if (value !== false && value !== nil) {
          result      = obj;
          __breaker.$v = nil;

          return __breaker;
        }
      };

      this.$each();

      if (result !== nil) {
        return result;
      }

      if (typeof(ifnone) === 'function') {
        return ifnone.$call();
      }

      return ifnone == null ? nil : ifnone;

    };

    Enumerable_prototype.$drop = function(number) {


      var result  = [],
          current = 0;

      this.$each._p = function(obj) {
        if (number < current) {
          result.push(e);
        }

        current++;
      };

      this.$each();

      return result;

    };

    Enumerable_prototype.$drop_while = TMP_6 = function() {
      var __context, block;
      block = TMP_6._p || nil, __context = block._s, TMP_6._p = null;


      var result = [];

      this.$each._p = function(obj) {
        var value;

        if ((value = block.call(__context, obj)) === __breaker) {
          return __breaker;
        }

        if (value === false || value === nil) {
          result.push(obj);
          return value;
        }


        return __breaker;
      };

      this.$each();

      return result;

    };

    Enumerable_prototype.$each_with_index = TMP_7 = function() {
      var __context, block;
      block = TMP_7._p || nil, __context = block._s, TMP_7._p = null;


      var index = 0;

      this.$each._p = function(obj) {
        var value;

        if ((value = block.call(__context, obj, index)) === __breaker) {
          return __breaker.$v;
        }

        index++;
      };

      this.$each();

      return nil;

    };

    Enumerable_prototype.$each_with_object = TMP_8 = function(object) {
      var __context, block;
      block = TMP_8._p || nil, __context = block._s, TMP_8._p = null;


      this.$each._p = function(obj) {
        var value;

        if ((value = block.call(__context, obj, object)) === __breaker) {
          return __breaker.$v;
        }
      };

      this.$each();

      return object;

    };

    Enumerable_prototype.$entries = function() {


      var result = [];

      this.$each._p = function(obj) {
        result.push(obj);
      };

      this.$each();

      return result;

    };

    Enumerable_prototype.$find = Enumerable_prototype.$detect;

    Enumerable_prototype.$find_all = TMP_9 = function() {
      var __context, block;
      block = TMP_9._p || nil, __context = block._s, TMP_9._p = null;


      var result = [];

      this.$each._p = function(obj) {
        var value;

        if ((value = block.call(__context, obj)) === __breaker) {
          return __breaker.$v;
        }

        if (value !== false && value !== nil) {
          result.push(obj);
        }
      };

      this.$each();

      return result;

    };

    Enumerable_prototype.$find_index = TMP_10 = function(object) {
      var __context, block;
      block = TMP_10._p || nil, __context = block._s, TMP_10._p = null;


      var proc, result = nil, index = 0;

      if (object != null) {
        proc = function (obj) {
          if ((obj)['$=='](object)) {
            result = index;
            return __breaker;
          }
          index += 1;
        };
      }
      else {
        proc = function(obj) {
          var value;

          if ((value = block.call(__context, obj)) === __breaker) {
            return __breaker.$v;
          }

          if (value !== false && value !== nil) {
            result     = index;
            __breaker.$v = index;

            return __breaker;
          }
          index += 1;
        };
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    Enumerable_prototype.$first = function(number) {


      var result = [],
          current = 0,
          proc;

      if (number == null) {
        result = nil;
        proc = function(obj) {
            result = obj; return __breaker;
          };
      } else {
        proc = function(obj) {
            if (number <= current) {
              return __breaker;
            }

            result.push(obj);

            current++;
          };
      }

      this.$each._p = proc;
      this.$each();

      return result;

    };

    Enumerable_prototype.$grep = TMP_11 = function(pattern) {
      var __context, block;
      block = TMP_11._p || nil, __context = block._s, TMP_11._p = null;


      var result = [];

      this.$each._p = (block !== nil
        ? function(obj) {
            var value = pattern['$==='](obj);

            if (value !== false && value !== nil) {
              if ((value = block.call(__context, obj)) === __breaker) {
                return __breaker.$v;
              }

              result.push(value);
            }
          }
        : function(obj) {
            var value = pattern['$==='](obj);

            if (value !== false && value !== nil) {
              result.push(obj);
            }
          });

      this.$each();

      return result;

    };

    Enumerable_prototype.$select = Enumerable_prototype.$find_all;

    Enumerable_prototype.$take = Enumerable_prototype.$first;

    Enumerable_prototype.$to_a = Enumerable_prototype.$entries;
        ;Enumerable._donate(["$all?", "$any?", "$collect", "$count", "$detect", "$drop", "$drop_while", "$each_with_index", "$each_with_object", "$entries", "$find", "$find_all", "$find_index", "$first", "$grep", "$select", "$take", "$to_a"]);
  })(self)
})();
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __klass = __Ruby.klass;

  return (function(__base, __super){
    // line 1, /Users/elia/Code/Ruby/core/array.rb, class Array
    function Array() {};
    Array = __klass(__base, __super, "Array", Array);

    ;Array._sdonate(["$[]", "$new"]);    var Array_prototype = Array.prototype, __scope = Array._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_7, TMP_8, TMP_9, TMP_10, TMP_11, TMP_12, TMP_13, TMP_14, TMP_15, TMP_16, TMP_17;


    Array_prototype._isArray = true;


    Array.$include(__scope.Enumerable);

    Array['$[]'] = function(objects) {
      objects = __slice.call(arguments, 0);

      return objects;

    };

    Array.$new = TMP_1 = function(size, obj) {
      var __context, block;
      block = TMP_1._p || nil, __context = block._s, TMP_1._p = null;
      if (obj == null) {
        obj = nil
      }

      var arr = [];

      if (size && size._isArray) {
        for (var i = 0; i < size.length; i++) {
          arr[i] = size[i];
        }
      }
      else {
        if (block === nil) {
          for (var i = 0; i < size; i++) {
            arr[i] = obj;
          }
        }
        else {
          for (var i = 0; i < size; i++) {
            arr[i] = block.call(__context, i);
          }
        }
      }

      return arr;

    };

    Array_prototype['$&'] = function(other) {


      var result = [],
          seen   = {};

      for (var i = 0, length = this.length; i < length; i++) {
        var item = this[i];

        if (!seen[item]) {
          for (var j = 0, length2 = other.length; j < length2; j++) {
            var item2 = other[j];

            if ((item === item2) && !seen[item]) {
              seen[item] = true;

              result.push(item);
            }
          }
        }
      }

      return result;

    };

    Array_prototype['$*'] = function(other) {


      if (typeof(other) === 'string') {
        return this.join(other);
      }

      var result = [];

      for (var i = 0; i < other; i++) {
        result = result.concat(this);
      }

      return result;

    };

    Array_prototype['$+'] = function(other) {

      return this.slice().concat(other.slice());
    };

    Array_prototype['$-'] = function(other) {
      var __a, __b;
      return (__b = this, __b.$reject._p = (__a = function(i) {


        if (i == null) i = nil;

        return other['$include?'](i)
      }, __a._s = this, __a), __b.$reject());
    };

    Array_prototype['$<<'] = function(object) {

      this.push(object);
      return this;
    };

    Array_prototype['$<=>'] = function(other) {


      if (this.$hash() === other.$hash()) {
        return 0;
      }

      if (this.length != other.length) {
        return (this.length > other.length) ? 1 : -1;
      }

      for (var i = 0, length = this.length, tmp; i < length; i++) {
        if ((tmp = (this[i])['$<=>'](other[i])) !== 0) {
          return tmp;
        }
      }

      return 0;

    };

    Array_prototype['$=='] = function(other) {


      if (!other || (this.length !== other.length)) {
        return false;
      }

      for (var i = 0, length = this.length; i < length; i++) {
        if (!(this[i])['$=='](other[i])) {
          return false;
        }
      }

      return true;

    };

    Array_prototype['$[]'] = function(index, length) {


      var size = this.length;

      if (typeof index !== 'number') {
        if (index._isRange) {
          var exclude = index.exclude;
          length      = index.end;
          index       = index.begin;

          if (index > size) {
            return nil;
          }

          if (length < 0) {
            length += size;
          }

          if (!exclude) length += 1;
          return this.slice(index, length);
        }
        else {
          this.$raise("bad arg for Array#[]");
        }
      }

      if (index < 0) {
        index += size;
      }

      if (length !== undefined) {
        if (length < 0 || index > size || index < 0) {
          return nil;
        }

        return this.slice(index, index + length);
      }
      else {
        if (index >= size || index < 0) {
          return nil;
        }

        return this[index];
      }

    };

    Array_prototype['$[]='] = function(index, value) {


      var size = this.length;

      if (index < 0) {
        index += size;
      }

      return this[index] = value;

    };

    Array_prototype.$assoc = function(object) {


      for (var i = 0, length = this.length, item; i < length; i++) {
        if (item = this[i], item.length && (item[0])['$=='](object)) {
          return item;
        }
      }

      return nil;

    };

    Array_prototype.$at = function(index) {


      if (index < 0) {
        index += this.length;
      }

      if (index < 0 || index >= this.length) {
        return nil;
      }

      return this[index];

    };

    Array_prototype.$clear = function() {

      this.splice(0, this.length);
      return this;
    };

    Array_prototype.$clone = function() {

      return this.slice();
    };

    Array_prototype.$collect = TMP_2 = function() {
      var __context, block;
      block = TMP_2._p || nil, __context = block._s, TMP_2._p = null;


      var result = [];

      for (var i = 0, length = this.length, value; i < length; i++) {
        if ((value = block.call(__context, this[i])) === __breaker) {
          return __breaker.$v;
        }

        result.push(value);
      }

      return result;

    };

    Array_prototype['$collect!'] = TMP_3 = function() {
      var __context, block;
      block = TMP_3._p || nil, __context = block._s, TMP_3._p = null;


      for (var i = 0, length = this.length, val; i < length; i++) {
        if ((val = block.call(__context, this[i])) === __breaker) {
          return __breaker.$v;
        }

        this[i] = val;
      }

      return this;
    };

    Array_prototype.$compact = function() {


      var result = [];

      for (var i = 0, length = this.length, item; i < length; i++) {
        if ((item = this[i]) !== nil) {
          result.push(item);
        }
      }

      return result;

    };

    Array_prototype['$compact!'] = function() {


      var original = this.length;

      for (var i = 0, length = this.length; i < length; i++) {
        if (this[i] === nil) {
          this.splice(i, 1);

          length--;
          i--;
        }
      }

      return this.length === original ? nil : this;

    };

    Array_prototype.$concat = function(other) {


      for (var i = 0, length = other.length; i < length; i++) {
        this.push(other[i]);
      }

      return this;
    };

    Array_prototype.$count = function(object) {


      if (object == null) {
        return this.length;
      }

      var result = 0;

      for (var i = 0, length = this.length; i < length; i++) {
        if ((this[i])['$=='](object)) {
          result++;
        }
      }

      return result;

    };

    Array_prototype.$delete = function(object) {


      var original = this.length;

      for (var i = 0, length = original; i < length; i++) {
        if ((this[i])['$=='](object)) {
          this.splice(i, 1);

          length--;
          i--;
        }
      }

      return this.length === original ? nil : object;

    };

    Array_prototype.$delete_at = function(index) {


      if (index < 0) {
        index += this.length;
      }

      if (index < 0 || index >= this.length) {
        return nil;
      }

      var result = this[index];

      this.splice(index, 1);

      return result;

    };

    Array_prototype.$delete_if = TMP_4 = function() {
      var __context, block;
      block = TMP_4._p || nil, __context = block._s, TMP_4._p = null;


      for (var i = 0, length = this.length, value; i < length; i++) {
        if ((value = block.call(__context, this[i])) === __breaker) {
          return __breaker.$v;
        }

        if (value !== false && value !== nil) {
          this.splice(i, 1);

          length--;
          i--;
        }
      }

      return this;
    };

    Array_prototype.$drop = function(number) {

      return this.slice(number);
    };

    Array_prototype.$dup = Array_prototype.$clone;

    Array_prototype.$each = TMP_5 = function() {
      var __context, block;
      block = TMP_5._p || nil, __context = block._s, TMP_5._p = null;

      for (var i = 0, length = this.length; i < length; i++) {
      if (block.call(__context, this[i]) === __breaker) return __breaker.$v;
      };
      return this;
    };

    Array_prototype.$each_index = TMP_6 = function() {
      var __context, block;
      block = TMP_6._p || nil, __context = block._s, TMP_6._p = null;

      for (var i = 0, length = this.length; i < length; i++) {
      if (block.call(__context, i) === __breaker) return __breaker.$v;
      };
      return this;
    };

    Array_prototype['$empty?'] = function() {

      return !this.length;
    };

    Array_prototype.$fetch = TMP_7 = function(index, defaults) {
      var __context, block;
      block = TMP_7._p || nil, __context = block._s, TMP_7._p = null;


      var original = index;

      if (index < 0) {
        index += this.length;
      }

      if (index >= 0 && index < this.length) {
        return this[index];
      }

      if (defaults != null) {
        return defaults;
      }

      if (block !== nil) {
        return block(__context, original);
      }

      this.$raise("Array#fetch");

    };

    Array_prototype.$first = function(count) {


      if (count != null) {
        return this.slice(0, count);
      }

      return this.length === 0 ? nil : this[0];

    };

    Array_prototype.$flatten = function(level) {


      var result = [];

      for (var i = 0, length = this.length, item; i < length; i++) {
        item = this[i];

        if (item._isArray) {
          if (level == null) {
            result = result.concat((item).$flatten());
          }
          else if (level === 0) {
            result.push(item);
          }
          else {
            result = result.concat((item).$flatten(level - 1));
          }
        }
        else {
          result.push(item);
        }
      }

      return result;

    };

    Array_prototype['$flatten!'] = function(level) {


      var size = this.length;
      this.$replace(this.$flatten(level));

      return size === this.length ? nil : this;

    };

    Array_prototype.$hash = function() {

      return this._id || (this._id = unique_id++);
    };

    Array_prototype['$include?'] = function(member) {


      for (var i = 0, length = this.length; i < length; i++) {
        if ((this[i])['$=='](member)) {
          return true;
        }
      }

      return false;

    };

    Array_prototype.$index = TMP_8 = function(object) {
      var __context, block;
      block = TMP_8._p || nil, __context = block._s, TMP_8._p = null;


      if (object != null) {
        for (var i = 0, length = this.length; i < length; i++) {
          if ((this[i])['$=='](object)) {
            return i;
          }
        }
      }
      else if (block !== nil) {
        for (var i = 0, length = this.length, value; i < length; i++) {
          if ((value = block.call(__context, this[i])) === __breaker) {
            return __breaker.$v;
          }

          if (value !== false && value !== nil) {
            return i;
          }
        }
      }

      return nil;

    };

    Array_prototype.$insert = function(index, objects) {
      objects = __slice.call(arguments, 1);

      if (objects.length > 0) {
        if (index < 0) {
          index += this.length + 1;

          if (index < 0) {
            this.$raise("" + (index) + " is out of bounds");
          }
        }
        if (index > this.length) {
          for (var i = this.length; i < index; i++) {
            this.push(nil);
          }
        }

        this.splice.apply(this, [index, 0].concat(objects));
      }

      return this;
    };

    Array_prototype.$inspect = function() {


      var i, inspect, el, el_insp, length, object_id;

      inspect = [];
      object_id = this.$object_id();
      length = this.length;

      for (i = 0; i < length; i++) {
        el = this['$[]'](i);

        // Check object_id to ensure it's not the same array get into an infinite loop
        el_insp = (el).$object_id() === object_id ? '[...]' : (el).$inspect();

        inspect.push(el_insp);
      }
      return '[' + inspect.join(', ') + ']';

    };

    Array_prototype.$join = function(sep) {
      if (sep == null) {
        sep = ""
      }

      var result = [];

      for (var i = 0, length = this.length; i < length; i++) {
        result.push((this[i]).$to_s());
      }

      return result.join(sep);

    };

    Array_prototype.$keep_if = TMP_9 = function() {
      var __context, block;
      block = TMP_9._p || nil, __context = block._s, TMP_9._p = null;


      for (var i = 0, length = this.length, value; i < length; i++) {
        if ((value = block.call(__context, this[i])) === __breaker) {
          return __breaker.$v;
        }

        if (value === false || value === nil) {
          this.splice(i, 1);

          length--;
          i--;
        }
      }

      return this;
    };

    Array_prototype.$last = function(count) {


      var length = this.length;

      if (count == null) {
        return length === 0 ? nil : this[length - 1];
      }
      else if (count < 0) {
        this.$raise("negative count given");
      }

      if (count > length) {
        count = length;
      }

      return this.slice(length - count, length);

    };

    Array_prototype.$length = function() {

      return this.length;
    };

    Array_prototype.$map = Array_prototype.$collect;

    Array_prototype['$map!'] = Array_prototype['$collect!'];

    Array_prototype.$pop = function(count) {


      var length = this.length;

      if (count == null) {
        return length === 0 ? nil : this.pop();
      }

      if (count < 0) {
        this.$raise("negative count given");
      }

      return count > length ? this.splice(0, this.length) : this.splice(length - count, length);

    };

    Array_prototype.$push = function(objects) {
      objects = __slice.call(arguments, 0);

      for (var i = 0, length = objects.length; i < length; i++) {
        this.push(objects[i]);
      }

      return this;
    };

    Array_prototype.$rassoc = function(object) {


      for (var i = 0, length = this.length, item; i < length; i++) {
        item = this[i];

        if (item.length && item[1] !== undefined) {
          if ((item[1])['$=='](object)) {
            return item;
          }
        }
      }

      return nil;

    };

    Array_prototype.$reject = TMP_10 = function() {
      var __context, block;
      block = TMP_10._p || nil, __context = block._s, TMP_10._p = null;


      var result = [];

      for (var i = 0, length = this.length, value; i < length; i++) {
        if ((value = block.call(__context, this[i])) === __breaker) {
          return __breaker.$v;
        }

        if (value === false || value === nil) {
          result.push(this[i]);
        }
      }
      return result;

    };

    Array_prototype['$reject!'] = TMP_11 = function() {
      var __a, __context, block;
      block = TMP_11._p || nil, __context = block._s, TMP_11._p = null;


      var original = this.length;
      (__a = this, __a.$delete_if._p = block.$to_proc(), __a.$delete_if());
      return this.length === original ? nil : this;

    };

    Array_prototype.$replace = function(other) {


      this.splice(0, this.length);
      this.push.apply(this, other);
      return this;

    };

    Array_prototype.$reverse = Array_prototype.reverse;

    Array_prototype['$reverse!'] = function() {


      this.splice(0);
      this.push.apply(this, this.$reverse());
      return this;

    };

    Array_prototype.$reverse_each = TMP_12 = function() {
      var __a, __context, block;
      block = TMP_12._p || nil, __context = block._s, TMP_12._p = null;

      (__a = this.$reverse(), __a.$each._p = block.$to_proc(), __a.$each());
      return this;
    };

    Array_prototype.$rindex = TMP_13 = function(object) {
      var __context, block;
      block = TMP_13._p || nil, __context = block._s, TMP_13._p = null;


      if (block !== nil) {
        for (var i = this.length - 1, value; i >= 0; i--) {
          if ((value = block.call(__context, this[i])) === __breaker) {
            return __breaker.$v;
          }

          if (value !== false && value !== nil) {
            return i;
          }
        }
      }
      else {
        for (var i = this.length - 1; i >= 0; i--) {
          if ((this[i])['$=='](object)) {
            return i;
          }
        }
      }

      return nil;

    };

    Array_prototype.$select = TMP_14 = function() {
      var __context, block;
      block = TMP_14._p || nil, __context = block._s, TMP_14._p = null;


      var result = [];

      for (var i = 0, length = this.length, item, value; i < length; i++) {
        item = this[i];

        if ((value = block.call(__context, item)) === __breaker) {
          return __breaker.$v;
        }

        if (value !== false && value !== nil) {
          result.push(item);
        }
      }

      return result;

    };

    Array_prototype['$select!'] = TMP_15 = function() {
      var __a, __context, block;
      block = TMP_15._p || nil, __context = block._s, TMP_15._p = null;


      var original = this.length;
      (__a = this, __a.$keep_if._p = block.$to_proc(), __a.$keep_if());
      return this.length === original ? nil : this;

    };

    Array_prototype.$shift = function(count) {


      if (this.length === 0) {
        return nil;
      }

      return count == null ? this.shift() : this.splice(0, count)

    };

    Array_prototype.$size = Array_prototype.$length;

    Array_prototype.$slice = Array_prototype['$[]'];

    Array_prototype['$slice!'] = function(index, length) {


      if (index < 0) {
        index += this.length;
      }

      if (length != null) {
        return this.splice(index, length);
      }

      if (index < 0 || index >= this.length) {
        return nil;
      }

      return this.splice(index, 1)[0];

    };

    Array_prototype.$take = function(count) {

      return this.slice(0, count);
    };

    Array_prototype.$take_while = TMP_16 = function() {
      var __context, block;
      block = TMP_16._p || nil, __context = block._s, TMP_16._p = null;


      var result = [];

      for (var i = 0, length = this.length, item, value; i < length; i++) {
        item = this[i];

        if ((value = block.call(__context, item)) === __breaker) {
          return __breaker.$v;
        }

        if (value === false || value === nil) {
          return result;
        }

        result.push(item);
      }

      return result;

    };

    Array_prototype.$to_a = function() {

      return this;
    };

    Array_prototype.$to_ary = Array_prototype.$to_a;

    Array_prototype.$to_json = function() {


      var result = [];

      for (var i = 0, length = this.length; i < length; i++) {
        result.push((this[i]).$to_json());
      }

      return '[' + result.join(', ') + ']';

    };

    Array_prototype.$to_s = Array_prototype.$inspect;

    Array_prototype.$uniq = function() {


      var result = [],
          seen   = {};

      for (var i = 0, length = this.length, item, hash; i < length; i++) {
        item = this[i];
        hash = item;

        if (!seen[hash]) {
          seen[hash] = true;

          result.push(item);
        }
      }

      return result;

    };

    Array_prototype['$uniq!'] = function() {


      var original = this.length,
          seen     = {};

      for (var i = 0, length = original, item, hash; i < length; i++) {
        item = this[i];
        hash = item;

        if (!seen[hash]) {
          seen[hash] = true;
        }
        else {
          this.splice(i, 1);

          length--;
          i--;
        }
      }

      return this.length === original ? nil : this;

    };

    Array_prototype.$unshift = function(objects) {
      objects = __slice.call(arguments, 0);

      for (var i = objects.length - 1; i >= 0; i--) {
        this.unshift(objects[i]);
      }

      return this;

    };

    Array_prototype.$zip = TMP_17 = function(others) {
      var __context, block;
      block = TMP_17._p || nil, __context = block._s, TMP_17._p = null;
      others = __slice.call(arguments, 0);

      var result = [], size = this.length, part, o;

      for (var i = 0; i < size; i++) {
        part = [this[i]];

        for (var j = 0, jj = others.length; j < jj; j++) {
          o = others[j][i];

          if (o == null) {
            o = nil;
          }

          part[j + 1] = o;
        }

        result[i] = part;
      }

      if (block !== nil) {
        for (var i = 0; i < size; i++) {
          block.call(__context, result[i]);
        }

        return nil;
      }

      return result;

    };

    return nil;
  })(self, Array)
})();
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __klass = __Ruby.klass;

  return (function(__base, __super){
    // line 1, /Users/elia/Code/Ruby/core/hash.rb, class Hash
    function Hash() {};
    Hash = __klass(__base, __super, "Hash", Hash);

    ;Hash._sdonate(["$[]", "$allocate", "$from_native", "$new"]);    var Hash_prototype = Hash.prototype, __scope = Hash._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_7, TMP_8, TMP_9, TMP_10, TMP_11, TMP_12;
    Hash_prototype.proc = Hash_prototype.none = nil;

    Hash.$include(__scope.Enumerable);


    __hash = Ruby.hash = function() {
      var hash   = new Hash,
          args   = __slice.call(arguments),
          keys   = [],
          assocs = {};

      hash.map   = assocs;
      hash.keys  = keys;

      for (var i = 0, length = args.length, key; i < length; i++) {
        var key = args[i], obj = args[++i];

        if (assocs[key] == null) {
          keys.push(key);
        }

        assocs[key] = obj;
      }

      return hash;
    };

    // hash2 is a faster creator for hashes that just use symbols and
    // strings as keys. The map and keys array can be constructed at
    // compile time, so they are just added here by the constructor
    // function
    __hash2 = Ruby.hash2 = function(keys, map) {
      var hash = new Hash;
      hash.keys = keys;
      hash.map = map;
      return hash;
    }


    Hash['$[]'] = function(objs) {
      objs = __slice.call(arguments, 0);
      return __hash.apply(null, objs);
    };

    Hash.$allocate = function() {

      return __hash();
    };

    Hash.$from_native = function(obj) {


      var hash = __hash(), map = hash.map, keys = hash.keys;

      for (var key in obj) {
        keys.push(key);
        map[key] = obj[key];
      }

      return hash;

    };

    Hash.$new = TMP_1 = function(defaults) {
      var __context, block;
      block = TMP_1._p || nil, __context = block._s, TMP_1._p = null;


      var hash = __hash();

      if (defaults != null) {
        hash.none = defaults;
      }
      else if (block !== nil) {
        hash.proc = block;
      }

      return hash;

    };

    Hash_prototype['$=='] = function(other) {


      if (this === other) {
        return true;
      }

      if (!other.map || !other.keys) {
        return false;
      }

      if (this.keys.length !== other.keys.length) {
        return false;
      }

      var map  = this.map,
          map2 = other.map;

      for (var i = 0, length = this.keys.length; i < length; i++) {
        var key = this.keys[i], obj = map[key], obj2 = map2[key];

        if (!(obj)['$=='](obj2)) {
          return false;
        }
      }

      return true;

    };

    Hash_prototype['$[]'] = function(key) {


      var bucket = this.map[key];

      if (bucket != null) {
        return bucket;
      }

      var proc = this.proc;

      if (proc !== nil) {
        return (proc).$call(this, key);
      }

      return this.none;

    };

    Hash_prototype['$[]='] = function(key, value) {


      var map = this.map;

      if (!__hasOwn.call(map, key)) {
        this.keys.push(key);
      }

      map[key] = value;

      return value;

    };

    Hash_prototype.$assoc = function(object) {


      var keys = this.keys, key;

      for (var i = 0, length = keys.length; i < length; i++) {
        key = keys[i];

        if ((key)['$=='](object)) {
          return [key, this.map[key]];
        }
      }

      return nil;

    };

    Hash_prototype.$clear = function() {


      this.map = {};
      this.keys = [];
      return this;

    };

    Hash_prototype.$clone = function() {


      var result = __hash(),
          map    = this.map,
          map2   = result.map,
          keys2  = result.keys;

      for (var i = 0, length = this.keys.length; i < length; i++) {
        keys2.push(this.keys[i]);
        map2[this.keys[i]] = map[this.keys[i]];
      }

      return result;

    };

    Hash_prototype.$default = function() {

      return this.none;
    };

    Hash_prototype['$default='] = function(object) {

      return this.none = object;
    };

    Hash_prototype.$default_proc = function() {

      return this.proc;
    };

    Hash_prototype['$default_proc='] = function(proc) {

      return this.proc = proc;
    };

    Hash_prototype.$delete = function(key) {


      var map  = this.map, result = map[key];

      if (result != null) {
        delete map[key];
        this.keys.$delete(key);

        return result;
      }

      return nil;

    };

    Hash_prototype.$delete_if = TMP_2 = function() {
      var __context, block;
      block = TMP_2._p || nil, __context = block._s, TMP_2._p = null;


      var map = this.map, keys = this.keys, value;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((value = block.call(__context, key, obj)) === __breaker) {
          return __breaker.$v;
        }

        if (value !== false && value !== nil) {
          keys.splice(i, 1);
          delete map[key];

          length--;
          i--;
        }
      }

      return this;

    };

    Hash_prototype.$dup = Hash_prototype.$clone;

    Hash_prototype.$each = TMP_3 = function() {
      var __context, block;
      block = TMP_3._p || nil, __context = block._s, TMP_3._p = null;


      var map = this.map, keys = this.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        if (block.call(__context, key, map[key]) === __breaker) {
          return __breaker.$v;
        }
      }

      return this;

    };

    Hash_prototype.$each_key = TMP_4 = function() {
      var __context, block;
      block = TMP_4._p || nil, __context = block._s, TMP_4._p = null;


      var keys = this.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        if (block.call(__context, key) === __breaker) {
          return __breaker.$v;
        }
      }

      return this;

    };

    Hash_prototype.$each_pair = Hash_prototype.$each;

    Hash_prototype.$each_value = TMP_5 = function() {
      var __context, block;
      block = TMP_5._p || nil, __context = block._s, TMP_5._p = null;


      var map = this.map, keys = this.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        if (block.call(__context, map[keys[i]]) === __breaker) {
          return __breaker.$v;
        }
      }

      return this;

    };

    Hash_prototype['$empty?'] = function() {


      return this.keys.length === 0;

    };

    Hash_prototype['$eql?'] = Hash_prototype['$=='];

    Hash_prototype.$fetch = TMP_6 = function(key, defaults) {
      var __context, block;
      block = TMP_6._p || nil, __context = block._s, TMP_6._p = null;


      var value = this.map[key];

      if (value != null) {
        return value;
      }

      if (block !== nil) {
        var value;

        if ((value = block.call(__context, key)) === __breaker) {
          return __breaker.$v;
        }

        return value;
      }

      if (defaults != null) {
        return defaults;
      }

      this.$raise("key not found");

    };

    Hash_prototype.$flatten = function(level) {


      var map = this.map, keys = this.keys, result = [];

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], value = map[key];

        result.push(key);

        if (value._isArray) {
          if (level == null || level === 1) {
            result.push(value);
          }
          else {
            result = result.concat((value).$flatten(level - 1));
          }
        }
        else {
          result.push(value);
        }
      }

      return result;

    };

    Hash_prototype['$has_key?'] = function(key) {

      return this.map[key] != null;
    };

    Hash_prototype['$has_value?'] = function(value) {


      for (var assoc in this.map) {
        if ((this.map[assoc])['$=='](value)) {
          return true;
        }
      }

      return false;

    };

    Hash_prototype.$hash = function() {

      return this._id;
    };

    Hash_prototype['$include?'] = Hash_prototype['$has_key?'];

    Hash_prototype.$index = function(object) {


      var map = this.map, keys = this.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        if (object['$=='](map[key])) {
          return key;
        }
      }

      return nil;

    };

    Hash_prototype.$indexes = function(keys) {
      keys = __slice.call(arguments, 0);

      var result = [], map = this.map, val;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], val = map[key];

        if (val != null) {
          result.push(val);
        }
        else {
          result.push(this.none);
        }
      }

      return result;

    };

    Hash_prototype.$indices = Hash_prototype.$indexes;

    Hash_prototype.$inspect = function() {


      var inspect = [], keys = this.keys, map = this.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];
        inspect.push((key).$inspect() + '=>' + (map[key]).$inspect());
      }

      return '{' + inspect.join(', ') + '}';

    };

    Hash_prototype.$invert = function() {


      var result = __hash(), keys = this.keys, map = this.map,
          keys2 = result.keys, map2 = result.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        keys2.push(obj);
        map2[obj] = key;
      }

      return result;

    };

    Hash_prototype.$keep_if = TMP_7 = function() {
      var __context, block;
      block = TMP_7._p || nil, __context = block._s, TMP_7._p = null;


      var map = this.map, keys = this.keys, value;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((value = block.call(__context, key, obj)) === __breaker) {
          return __breaker.$v;
        }

        if (value === false || value === nil) {
          keys.splice(i, 1);
          delete map[key];

          length--;
          i--;
        }
      }

      return this;

    };

    Hash_prototype.$key = Hash_prototype.$index;

    Hash_prototype['$key?'] = Hash_prototype['$has_key?'];

    Hash_prototype.$keys = function() {


      return this.keys.slice(0);

    };

    Hash_prototype.$length = function() {


      return this.keys.length;

    };

    Hash_prototype['$member?'] = Hash_prototype['$has_key?'];

    Hash_prototype.$merge = TMP_8 = function(other) {
      var __context, block;
      block = TMP_8._p || nil, __context = block._s, TMP_8._p = null;


      var keys = this.keys, map = this.map,
          result = __hash(), keys2 = result.keys, map2 = result.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        keys2.push(key);
        map2[key] = map[key];
      }

      var keys = other.keys, map = other.map;

      if (block === nil) {
        for (var i = 0, length = keys.length; i < length; i++) {
          var key = keys[i];

          if (map2[key] == null) {
            keys2.push(key);
          }

          map2[key] = map[key];
        }
      }
      else {
        for (var i = 0, length = keys.length; i < length; i++) {
          var key = keys[i];

          if (map2[key] == null) {
            keys2.push(key);
            map2[key] = map[key];
          }
          else {
            map2[key] = block.call(__context, key, map2[key], map[key]);
          }
        }
      }

      return result;

    };

    Hash_prototype['$merge!'] = TMP_9 = function(other) {
      var __context, block;
      block = TMP_9._p || nil, __context = block._s, TMP_9._p = null;


      var keys = this.keys, map = this.map,
          keys2 = other.keys, map2 = other.map;

      if (block === nil) {
        for (var i = 0, length = keys2.length; i < length; i++) {
          var key = keys2[i];

          if (map[key] == null) {
            keys.push(key);
          }

          map[key] = map2[key];
        }
      }
      else {
        for (var i = 0, length = keys2.length; i < length; i++) {
          var key = keys2[i];

          if (map[key] == null) {
            keys.push(key);
            map[key] = map2[key];
          }
          else {
            map[key] = block.call(__context, key, map[key], map2[key]);
          }
        }
      }

      return this;

    };

    Hash_prototype.$rassoc = function(object) {


      var keys = this.keys, map = this.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((obj)['$=='](object)) {
          return [key, obj];
        }
      }

      return nil;

    };

    Hash_prototype.$reject = TMP_10 = function() {
      var __context, block;
      block = TMP_10._p || nil, __context = block._s, TMP_10._p = null;


      var keys = this.keys, map = this.map,
          result = __hash(), map2 = result.map, keys2 = result.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key], value;

        if ((value = block.call(__context, key, obj)) === __breaker) {
          return __breaker.$v;
        }

        if (value === false || value === nil) {
          keys2.push(key);
          map2[key] = obj;
        }
      }

      return result;

    };

    Hash_prototype.$replace = function(other) {


      var map = this.map = {}, keys = this.keys = [];

      for (var i = 0, length = other.keys.length; i < length; i++) {
        var key = other.keys[i];
        keys.push(key);
        map[key] = other.map[key];
      }

      return this;

    };

    Hash_prototype.$select = TMP_11 = function() {
      var __context, block;
      block = TMP_11._p || nil, __context = block._s, TMP_11._p = null;


      var keys = this.keys, map = this.map,
          result = __hash(), map2 = result.map, keys2 = result.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key], value;

        if ((value = block.call(__context, key, obj)) === __breaker) {
          return __breaker.$v;
        }

        if (value !== false && value !== nil) {
          keys2.push(key);
          map2[key] = obj;
        }
      }

      return result;

    };

    Hash_prototype['$select!'] = TMP_12 = function() {
      var __context, block;
      block = TMP_12._p || nil, __context = block._s, TMP_12._p = null;


      var map = this.map, keys = this.keys, value, result = nil;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((value = block.call(__context, key, obj)) === __breaker) {
          return __breaker.$v;
        }

        if (value === false || value === nil) {
          keys.splice(i, 1);
          delete map[key];

          length--;
          i--;
          result = this
        }
      }

      return result;

    };

    Hash_prototype.$shift = function() {


      var keys = this.keys, map = this.map;

      if (keys.length) {
        var key = keys[0], obj = map[key];

        delete map[key];
        keys.splice(0, 1);

        return [key, obj];
      }

      return nil;

    };

    Hash_prototype.$size = Hash_prototype.$length;

    Hash_prototype.$to_a = function() {


      var keys = this.keys, map = this.map, result = [];

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];
        result.push([key, map[key]]);
      }

      return result;

    };

    Hash_prototype.$to_hash = function() {

      return this;
    };

    Hash_prototype.$to_json = function() {


      var inspect = [], keys = this.keys, map = this.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];
        inspect.push((key).$to_json() + ': ' + (map[key]).$to_json());
      }

      return '{' + inspect.join(', ') + '}';

    };

    Hash_prototype.$to_native = function() {


      var result = {}, keys = this.keys, map = this.map, bucket, value;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if (obj.$to_native) {
          result[key] = (obj).$to_native();
        }
        else {
          result[key] = obj;
        }
      }

      return result;

    };

    Hash_prototype.$to_s = Hash_prototype.$inspect;

    Hash_prototype.$update = Hash_prototype['$merge!'];

    Hash_prototype['$value?'] = function(value) {


      var map = this.map;

      for (var assoc in map) {
        var v = map[assoc];
        if ((v)['$=='](value)) {
          return true;
        }
      }

      return false;

    };

    Hash_prototype.$values_at = Hash_prototype.$indexes;

    Hash_prototype.$values = function() {


      var map    = this.map,
          result = [];

      for (var key in map) {
        result.push(map[key]);
      }

      return result;

    };

    return nil;
  })(self, null)
})();
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __klass = __Ruby.klass, __gvars = __Ruby.gvars;

  (function(__base, __super){
    // line 1, /Users/elia/Code/Ruby/core/string.rb, class String
    function String() {};
    String = __klass(__base, __super, "String", String);

    ;String._sdonate(["$try_convert", "$new"]);    var String_prototype = String.prototype, __scope = String._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5;

    String_prototype._isString = true;

    String.$include(__scope.Comparable);

    String.$try_convert = function(what) {

      try {
      return what.$to_str()
      } catch ($err) {
      if (true) {
      nil}
      else { throw $err; }
      }
    };

    String.$new = function(str) {
      if (str == null) {
        str = ""
      }

      return new String(str)
    ;
    };

    String_prototype['$%'] = function(data) {


      var idx = 0;
      return this.replace(/%((%)|s)/g, function (match) {
        return match[2] || data[idx++] || '';
      });

    };

    String_prototype['$*'] = function(count) {


      if (count < 1) {
        return '';
      }

      var result  = '',
          pattern = this.valueOf();

      while (count > 0) {
        if (count & 1) {
          result += pattern;
        }

        count >>= 1, pattern += pattern;
      }

      return result;

    };

    String_prototype['$+'] = function(other) {

      return this.toString() + other;
    };

    String_prototype['$<=>'] = function(other) {


      if (typeof other !== 'string') {
        return nil;
      }

      return this > other ? 1 : (this < other ? -1 : 0);

    };

    String_prototype['$<'] = function(other) {

      return this < other;
    };

    String_prototype['$<='] = function(other) {

      return this <= other;
    };

    String_prototype['$>'] = function(other) {

      return this > other;
    };

    String_prototype['$>='] = function(other) {

      return this >= other;
    };

    String_prototype['$=='] = function(other) {

      return other == String(this);
    };

    String_prototype['$==='] = String_prototype['$=='];

    String_prototype['$=~'] = function(other) {


      if (typeof other === 'string') {
        this.$raise("string given");
      }

      return other['$=~'](this);

    };

    String_prototype['$[]'] = function(index, length) {


      var size = this.length;

      if (index._isRange) {
        var exclude = index.exclude,
            length  = index.end,
            index   = index.begin;

        if (index > size) {
          return nil;
        }

        if (length < 0) {
          length += size;
        }

        if (exclude) length -= 1;
        return this.substr(index, length);
      }

      if (index < 0) {
        index += this.length;
      }

      if (length == null) {
        if (index >= this.length || index < 0) {
          return nil;
        }

        return this.substr(index, 1);
      }

      if (index > this.length || index < 0) {
        return nil;
      }

      return this.substr(index, length);

    };

    String_prototype.$capitalize = function() {

      return this.charAt(0).toUpperCase() + this.substr(1).toLowerCase();
    };

    String_prototype.$casecmp = function(other) {


      if (typeof other !== 'string') {
        return other;
      }

      var a = this.toLowerCase(),
          b = other.toLowerCase();

      return a > b ? 1 : (a < b ? -1 : 0);

    };

    String_prototype.$chars = TMP_1 = function() {
      var __context, __yield;
      __yield = TMP_1._p || nil, __context = __yield._s, TMP_1._p = null;


      for (var i = 0, length = this.length; i < length; i++) {
        if (__yield.call(__context, this.charAt(i)) === __breaker) return __breaker.$v
      }

    };

    String_prototype.$chomp = function(separator) {
      if (separator == null) {
        separator = __gvars["/"]
      }

      if (separator === "\n") {
        return this.replace(/(\n|\r|\r\n)$/, '');
      }
      else if (separator === "") {
        return this.replace(/(\n|\r\n)+$/, '');
      }
      return this.replace(new RegExp(separator + '$'), '');

    };

    String_prototype.$chop = function() {

      return this.substr(0, this.length - 1);
    };

    String_prototype.$chr = function() {

      return this.charAt(0);
    };

    String_prototype.$count = function(str) {

      return (this.length - this.replace(new RegExp(str,"g"), '').length) / str.length;
    };

    String_prototype.$demodulize = function() {


      var idx = this.lastIndexOf('::');

      if (idx > -1) {
        return this.substr(idx + 2);
      }

      return this;

    };

    String_prototype.$downcase = String_prototype.toLowerCase;

    String_prototype.$each_char = String_prototype.$chars;

    String_prototype.$each_line = TMP_2 = function(separator) {
      var __context, __yield;
      __yield = TMP_2._p || nil, __context = __yield._s, TMP_2._p = null;
      if (separator == null) {
        separator = __gvars["/"]
      }

      var splitted = this.split(separator);

      for (var i = 0, length = splitted.length; i < length; i++) {
        if (__yield.call(__context, splitted[i] + separator) === __breaker) return __breaker.$v
      }

    };

    String_prototype['$empty?'] = function() {

      return this.length === 0;
    };

    String_prototype['$end_with?'] = function(suffixes) {
      suffixes = __slice.call(arguments, 0);

      for (var i = 0, length = suffixes.length; i < length; i++) {
        var suffix = suffixes[i];

        if (this.lastIndexOf(suffix) === this.length - suffix.length) {
          return true;
        }
      }

      return false;

    };

    String_prototype['$eql?'] = String_prototype['$=='];

    String_prototype['$equal?'] = function(val) {

      return this.toString() === val.toString();
    };

    String_prototype.$getbyte = String_prototype.charCodeAt;

    String_prototype.$gsub = TMP_3 = function(pattern, replace) {
      var __a, __context, block;
      block = TMP_3._p || nil, __context = block._s, TMP_3._p = null;

      if ((__a = pattern['$is_a?'](__scope.String)) !== false && __a !== nil) {
        pattern = (new RegExp("" + __scope.Regexp.$escape(pattern)))
      };

      var pattern = pattern.toString(),
          options = pattern.substr(pattern.lastIndexOf('/') + 1) + 'g',
          regexp  = pattern.substr(1, pattern.lastIndexOf('/') - 1);

      return (__a = this, __a.$sub._p = block.$to_proc(), __a.$sub(new RegExp(regexp, options), replace));

    };

    String_prototype.$hash = String_prototype.toString;

    String_prototype.$hex = function() {

      return this.$to_i(16);
    };

    String_prototype['$include?'] = function(other) {

      return this.indexOf(other) !== -1;
    };

    String_prototype.$index = function(what, offset) {
      var __a;

      if (!what._isString && !what._isRegexp) {
        throw new Error('type mismatch');
      }

      var result = -1;

      if (offset != null) {
        if (offset < 0) {
          offset = this.length - offset;
        }

        if (what['$is_a?'](__scope.Regexp)) {
          result = ((__a = what['$=~'](this.substr(offset))), __a !== false && __a !== nil ? __a : -1)
        }
        else {
          result = this.substr(offset).indexOf(substr);
        }

        if (result !== -1) {
          result += offset;
        }
      }
      else {
        if (what['$is_a?'](__scope.Regexp)) {
          result = ((__a = what['$=~'](this)), __a !== false && __a !== nil ? __a : -1)
        }
        else {
          result = this.indexOf(substr);
        }
      }

      return result === -1 ? nil : result;

    };

    String_prototype.$inspect = function() {


      var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
          meta      = {
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
          };

      escapable.lastIndex = 0;

      return escapable.test(this) ? '"' + this.replace(escapable, function(a) {
        var c = meta[a];

        return typeof c === 'string' ? c :
          '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
      }) + '"' : '"' + this + '"';

    };

    String_prototype.$intern = function() {

      return this;
    };

    String_prototype.$lines = String_prototype.$each_line;

    String_prototype.$length = function() {

      return this.length;
    };

    String_prototype.$ljust = function(integer, padstr) {
      if (padstr == null) {
        padstr = " "
      }
      return this.$raise(__scope.NotImplementedError);
    };

    String_prototype.$lstrip = function() {

      return this.replace(/^\s*/, '');
    };

    String_prototype.$match = TMP_4 = function(pattern, pos) {
      var __a, __b, __context, block;
      block = TMP_4._p || nil, __context = block._s, TMP_4._p = null;

      return (__a = (function() { if ((__b = pattern['$is_a?'](__scope.Regexp)) !== false && __b !== nil) {
        return pattern
        } else {
        return (new RegExp("" + __scope.Regexp.$escape(pattern)))
      }; return nil; }).call(this), __a.$match._p = block.$to_proc(), __a.$match(this, pos));
    };

    String_prototype.$next = function() {


      if (this.length === 0) {
        return "";
      }

      var initial = this.substr(0, this.length - 1);
      var last    = String.fromCharCode(this.charCodeAt(this.length - 1) + 1);

      return initial + last;

    };

    String_prototype.$ord = function() {

      return this.charCodeAt(0);
    };

    String_prototype.$partition = function(str) {


      var result = this.split(str);
      var splitter = (result[0].length === this.length ? "" : str);

      return [result[0], splitter, result.slice(1).join(str.toString())];

    };

    String_prototype.$reverse = function() {

      return this.split('').reverse().join('');
    };

    String_prototype.$rstrip = function() {

      return this.replace(/\s*$/, '');
    };

    String_prototype.$size = String_prototype.$length;

    String_prototype.$slice = String_prototype['$[]'];

    String_prototype.$split = function(pattern, limit) {
      var __a;if (pattern == null) {
        pattern = ((__a = __gvars[";"]), __a !== false && __a !== nil ? __a : " ")
      }
      return this.split(pattern, limit);
    };

    String_prototype['$start_with?'] = function(prefixes) {
      prefixes = __slice.call(arguments, 0);

      for (var i = 0, length = prefixes.length; i < length; i++) {
        if (this.indexOf(prefixes[i]) === 0) {
          return true;
        }
      }

      return false;

    };

    String_prototype.$strip = function() {

      return this.replace(/^\s*/, '').replace(/\s*$/, '');
    };

    String_prototype.$sub = TMP_5 = function(pattern, replace) {
      var __context, block;
      block = TMP_5._p || nil, __context = block._s, TMP_5._p = null;


      if (typeof(replace) === 'string') {
        return this.replace(pattern, replace);
      }
      if (block !== nil) {
        return this.replace(pattern, function(str, a) {
          __gvars["1"] = a;
          return block.call(__context, str);
        });
      }
      else if (replace != null) {
        if (replace['$is_a?'](__scope.Hash)) {
          return this.replace(pattern, function(str) {
            var value = replace['$[]'](this.$str());

            return (value == null) ? nil : this.$value().$to_s();
          });
        }
        else {
          replace = __scope.String.$try_convert(replace);

          if (replace == null) {
            this.$raise(__scope.TypeError, "can't convert " + (replace.$class()) + " into String");
          }

          return this.replace(pattern, replace);
        }
      }
      else {
        return this.replace(pattern, replace.toString());
      }

    };

    String_prototype.$succ = String_prototype.$next;

    String_prototype.$sum = function(n) {
      if (n == null) {
        n = 16
      }

      var result = 0;

      for (var i = 0, length = this.length; i < length; i++) {
        result += (this.charCodeAt(i) % ((1 << n) - 1));
      }

      return result;

    };

    String_prototype.$swapcase = function() {


      var str = this.replace(/([a-z]+)|([A-Z]+)/g, function($0,$1,$2) {
        return $1 ? $0.toUpperCase() : $0.toLowerCase();
      });

      if (this._klass === String) {
        return str;
      }

      return this.$class().$new(str);

    };

    String_prototype.$to_a = function() {


      if (this.length === 0) {
        return [];
      }

      return [this];

    };

    String_prototype.$to_f = function() {


      var result = parseFloat(this);

      return isNaN(result) ? 0 : result;

    };

    String_prototype.$to_i = function(base) {
      if (base == null) {
        base = 10
      }

      var result = parseInt(this, base);

      if (isNaN(result)) {
        return 0;
      }

      return result;

    };

    String_prototype.$to_json = String_prototype.$inspect;

    String_prototype.$to_proc = function() {


      var name = '$' + this;

      return function(arg) { return arg[name](arg); };

    };

    String_prototype.$to_s = String_prototype.toString;

    String_prototype.$to_str = String_prototype.$to_s;

    String_prototype.$to_sym = String_prototype.$intern;

    String_prototype.$underscore = function() {

      return this.replace(/[-\s]+/g, '_')
            .replace(/([A-Z\d]+)([A-Z][a-z])/g, '$1_$2')
            .replace(/([a-z\d])([A-Z])/g, '$1_$2')
            .toLowerCase();
    };

    return String_prototype.$upcase = String_prototype.toUpperCase;
  })(self, String);
  return __scope.Symbol = __scope.String;
})();
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __klass = __Ruby.klass;

  (function(__base, __super){
    // line 1, /Users/elia/Code/Ruby/core/numeric.rb, class Numeric
    function Numeric() {};
    Numeric = __klass(__base, __super, "Numeric", Numeric);

    var Numeric_prototype = Numeric.prototype, __scope = Numeric._scope, TMP_1, TMP_2, TMP_3;


    Numeric_prototype._isNumber = true;


    Numeric.$include(__scope.Comparable);

    Numeric_prototype['$+'] = function(other) {

      return this + other;
    };

    Numeric_prototype['$-'] = function(other) {

      return this - other;
    };

    Numeric_prototype['$*'] = function(other) {

      return this * other;
    };

    Numeric_prototype['$/'] = function(other) {

      return this / other;
    };

    Numeric_prototype['$%'] = function(other) {

      return this % other;
    };

    Numeric_prototype['$&'] = function(other) {

      return this & other;
    };

    Numeric_prototype['$|'] = function(other) {

      return this | other;
    };

    Numeric_prototype['$^'] = function(other) {

      return this ^ other;
    };

    Numeric_prototype['$<'] = function(other) {

      return this < other;
    };

    Numeric_prototype['$<='] = function(other) {

      return this <= other;
    };

    Numeric_prototype['$>'] = function(other) {

      return this > other;
    };

    Numeric_prototype['$>='] = function(other) {

      return this >= other;
    };

    Numeric_prototype['$<<'] = function(count) {

      return this << count;
    };

    Numeric_prototype['$>>'] = function(count) {

      return this >> count;
    };

    Numeric_prototype['$+@'] = function() {

      return +this;
    };

    Numeric_prototype['$-@'] = function() {

      return -this;
    };

    Numeric_prototype['$~'] = function() {

      return ~this;
    };

    Numeric_prototype['$**'] = function(other) {

      return Math.pow(this, other);
    };

    Numeric_prototype['$=='] = function(other) {

      return this == other;
    };

    Numeric_prototype['$<=>'] = function(other) {


      if (typeof(other) !== 'number') {
        return nil;
      }

      return this < other ? -1 : (this > other ? 1 : 0);

    };

    Numeric_prototype.$abs = function() {

      return Math.abs(this);
    };

    Numeric_prototype.$ceil = function() {

      return Math.ceil(this);
    };

    Numeric_prototype.$chr = function() {

      return String.fromCharCode(this);
    };

    Numeric_prototype.$downto = TMP_1 = function(finish) {
      var __context, block;
      block = TMP_1._p || nil, __context = block._s, TMP_1._p = null;


      for (var i = this; i >= finish; i--) {
        if (block.call(__context, i) === __breaker) {
          return __breaker.$v;
        }
      }

      return this;

    };

    Numeric_prototype['$eql?'] = Numeric_prototype['$=='];

    Numeric_prototype['$even?'] = function() {

      return this % 2 === 0;
    };

    Numeric_prototype.$floor = function() {

      return Math.floor(this);
    };

    Numeric_prototype.$hash = function() {

      return this.toString();
    };

    Numeric_prototype['$integer?'] = function() {

      return this % 1 === 0;
    };

    Numeric_prototype.$magnitude = Numeric_prototype.$abs;

    Numeric_prototype.$modulo = Numeric_prototype['$%'];

    Numeric_prototype.$next = function() {

      return this + 1;
    };

    Numeric_prototype['$nonzero?'] = function() {

      return this === 0 ? nil : this;
    };

    Numeric_prototype['$odd?'] = function() {

      return this % 2 !== 0;
    };

    Numeric_prototype.$ord = function() {

      return this;
    };

    Numeric_prototype.$pred = function() {

      return this - 1;
    };

    Numeric_prototype.$succ = Numeric_prototype.$next;

    Numeric_prototype.$times = TMP_2 = function() {
      var __context, block;
      block = TMP_2._p || nil, __context = block._s, TMP_2._p = null;


      for (var i = 0; i < this; i++) {
        if (block.call(__context, i) === __breaker) {
          return __breaker.$v;
        }
      }

      return this;

    };

    Numeric_prototype.$to_f = function() {

      return parseFloat(this);
    };

    Numeric_prototype.$to_i = function() {

      return parseInt(this);
    };

    Numeric_prototype.$to_json = function() {

      return this.toString();
    };

    Numeric_prototype.$to_s = function(base) {
      if (base == null) {
        base = 10
      }
      return this.toString();
    };

    Numeric_prototype.$upto = TMP_3 = function(finish) {
      var __context, block;
      block = TMP_3._p || nil, __context = block._s, TMP_3._p = null;


      for (var i = this; i <= finish; i++) {
        if (block.call(__context, i) === __breaker) {
          return __breaker.$v;
        }
      }

      return this;

    };

    Numeric_prototype['$zero?'] = function() {

      return this == 0;
    };

    return nil;
  })(self, Number);
  return __scope.Fixnum = __scope.Numeric;
})();
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __klass = __Ruby.klass;

  return (function(__base, __super){
    // line 1, /Users/elia/Code/Ruby/core/proc.rb, class Proc
    function Proc() {};
    Proc = __klass(__base, __super, "Proc", Proc);

    ;Proc._sdonate(["$new"]);    var Proc_prototype = Proc.prototype, __scope = Proc._scope, TMP_1;


    Proc_prototype._isProc = true;
    Proc_prototype.is_lambda = true;


    Proc.$new = TMP_1 = function() {
      var __context, block;
      block = TMP_1._p || nil, __context = block._s, TMP_1._p = null;

      if (block === nil) no_block_given();
      block.is_lambda = false;
      return block;
    };

    Proc_prototype.$call = function(args) {
      args = __slice.call(arguments, 0);
      return this.apply(this._s, args);
    };

    Proc_prototype.$to_proc = function() {

      return this;
    };

    Proc_prototype['$lambda?'] = function() {

      return !!this.is_lambda;
    };

    Proc_prototype.$arity = function() {

      return this.length - 1;
    };

    return nil;
  })(self, Function)
})();
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __klass = __Ruby.klass;

  return (function(__base, __super){
    // line 1, /Users/elia/Code/Ruby/core/range.rb, class Range
    function Range() {};
    Range = __klass(__base, __super, "Range", Range);

    var Range_prototype = Range.prototype, __scope = Range._scope, TMP_1;
    Range_prototype.begin = Range_prototype.end = nil;

    Range.$include(__scope.Enumerable);


    Range_prototype._isRange = true;

    Ruby.range = function(beg, end, exc) {
      var range         = new Range;
          range.begin   = beg;
          range.end     = end;
          range.exclude = exc;

      return range;
    };


    Range_prototype.$begin = function() {

      return this.begin
    }, nil;

    Range_prototype.$end = function() {

      return this.end
    }, nil;

    Range_prototype.$initialize = function(min, max, exclude) {
      if (exclude == null) {
        exclude = false
      }
      this.begin = min;
      this.end = max;
      return this.exclude = exclude;
    };

    Range_prototype['$=='] = function(other) {


      if (!other._isRange) {
        return false;
      }

      return this.exclude === other.exclude && this.begin == other.begin && this.end == other.end;

    };

    Range_prototype['$==='] = function(obj) {

      return obj >= this.begin && (this.exclude ? obj < this.end : obj <= this.end);
    };

    Range_prototype['$cover?'] = function(value) {
      var __a, __b, __c;
      return ((__a = (this.begin)['$<='](value)) ? value['$<=']((function() { if ((__b = this['$exclude_end?']()) !== false && __b !== nil) {
        return (__b = this.end, __c = 1, typeof(__b) === 'number' ? __b - __c : __b['$-'](__c))
        } else {
        return this.end;
      }; return nil; }).call(this)) : __a);
    };

    Range_prototype.$each = TMP_1 = function() {
      var current = nil, __a, __b, __context, __yield;
      __yield = TMP_1._p || nil, __context = __yield._s, TMP_1._p = null;

      current = this.$min();
      while ((__b = !current['$=='](this.$max())) !== false && __b !== nil){if (__yield.call(__context, current) === __breaker) return __breaker.$v;
      current = current.$succ();};
      if ((__a = this['$exclude_end?']()) === false || __a === nil) {
        if (__yield.call(__context, current) === __breaker) return __breaker.$v
      };
      return this;
    };

    Range_prototype['$eql?'] = function(other) {
      var __a;
      if ((__a = __scope.Range['$==='](other)) === false || __a === nil) {
        return false
      };
      return (__a = ((__a = this['$exclude_end?']()['$=='](other['$exclude_end?']())) ? (this.begin)['$eql?'](other.$begin()) : __a), __a !== false && __a !== nil ? (this.end)['$eql?'](other.$end()) : __a);
    };

    Range_prototype['$exclude_end?'] = function() {

      return this.exclude;
    };

    Range_prototype['$include?'] = function(val) {

      return obj >= this.begin && obj <= this.end;
    };

    Range_prototype.$max = Range_prototype.$end;

    Range_prototype.$min = Range_prototype.$begin;

    Range_prototype['$member?'] = Range_prototype['$include?'];

    Range_prototype.$step = function(n) {
      if (n == null) {
        n = 1
      }
      return this.$raise(__scope.NotImplementedError);
    };

    Range_prototype.$to_s = function() {

      return this.begin + (this.exclude ? '...' : '..') + this.end;
    };

    return Range_prototype.$inspect = Range_prototype.$to_s;
  })(self, null)
})();
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __klass = __Ruby.klass;

  return (function(__base, __super){
    // line 1, /Users/elia/Code/Ruby/core/time.rb, class Time
    function Time() {};
    Time = __klass(__base, __super, "Time", Time);

    ;Time._sdonate(["$at", "$new", "$now"]);    var Time_prototype = Time.prototype, __scope = Time._scope;

    Time.$include(__scope.Comparable);

    Time.$at = function(seconds, frac) {
      if (frac == null) {
        frac = 0
      }
      return new Date(seconds * 1000 + frac);
    };

    Time.$new = function(year, month, day, hour, minute, second, millisecond) {


      switch (arguments.length) {
        case 1:
          return new Date(year);
        case 2:
          return new Date(year, month - 1);
        case 3:
          return new Date(year, month - 1, day);
        case 4:
          return new Date(year, month - 1, day, hour);
        case 5:
          return new Date(year, month - 1, day, hour, minute);
        case 6:
          return new Date(year, month - 1, day, hour, minute, second);
        case 7:
          return new Date(year, month - 1, day, hour, minute, second, millisecond);
        default:
          return new Date();
      }

    };

    Time.$now = function() {

      return new Date();
    };

    Time_prototype['$+'] = function(other) {
      var __a, __b;
      return __scope.Time.$allocate((__a = this.$to_f(), __b = other.$to_f(), typeof(__a) === 'number' ? __a + __b : __a['$+'](__b)));
    };

    Time_prototype['$-'] = function(other) {
      var __a, __b;
      return __scope.Time.$allocate((__a = this.$to_f(), __b = other.$to_f(), typeof(__a) === 'number' ? __a - __b : __a['$-'](__b)));
    };

    Time_prototype['$<=>'] = function(other) {

      return this.$to_f()['$<=>'](other.$to_f());
    };

    Time_prototype.$day = Time_prototype.getDate;

    Time_prototype['$eql?'] = function(other) {
      var __a;
      return (__a = other['$is_a?'](__scope.Time), __a !== false && __a !== nil ? this['$<=>'](other)['$zero?']() : __a);
    };

    Time_prototype['$friday?'] = function() {

      return this.getDay() === 5;
    };

    Time_prototype.$hour = Time_prototype.getHours;

    Time_prototype.$mday = Time_prototype.$day;

    Time_prototype.$min = Time_prototype.getMinutes;

    Time_prototype.$mon = function() {

      return this.getMonth() + 1;
    };

    Time_prototype['$monday?'] = function() {

      return this.getDay() === 1;
    };

    Time_prototype.$month = Time_prototype.$mon;

    Time_prototype['$saturday?'] = function() {

      return this.getDay() === 6;
    };

    Time_prototype.$sec = Time_prototype.getSeconds;

    Time_prototype['$sunday?'] = function() {

      return this.getDay() === 0;
    };

    Time_prototype['$thursday?'] = function() {

      return this.getDay() === 4;
    };

    Time_prototype.$to_f = function() {

      return this.getTime() / 1000;
    };

    Time_prototype.$to_i = function() {

      return parseInt(this.getTime() / 1000);
    };

    Time_prototype['$tuesday?'] = function() {

      return this.getDay() === 2;
    };

    Time_prototype.$wday = Time_prototype.getDay;

    Time_prototype['$wednesday?'] = function() {

      return this.getDay() === 3;
    };

    return Time_prototype.$year = Time_prototype.getFullYear;
  })(self, Date)
})();
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __module = __Ruby.module, __hash2 = __Ruby.hash2;

  var json_parse = JSON.parse;
  return (function(__base){
    // line 3, /Users/elia/Code/Ruby/core/json.rb, module JSON
    function JSON() {};
    JSON = __module(__base, "JSON", JSON);
    var JSON_prototype = JSON.prototype, __scope = JSON._scope;

    JSON.$parse = function(source) {

      return to_Ruby(json_parse(source));
    };

    JSON.$from_object = function(js_object) {

      return to_Ruby(js_object);
    };


    function to_Ruby(value) {
      switch (typeof value) {
        case 'string':
          return value;

        case 'number':
          return value;

        case 'boolean':
          return !!value;

        case 'null':
          return nil;

        case 'object':
          if (!value) return nil;

          if (value._isArray) {
            var arr = [];

            for (var i = 0, ii = value.length; i < ii; i++) {
              arr.push(to_Ruby(value[i]));
            }

            return arr;
          }
          else {
            var hash = __hash2([], {}), v, map = hash.map, keys = hash.keys;

            for (var k in value) {
              if (__hasOwn.call(value, k)) {
                v = to_Ruby(value[k]);
                keys.push(k);
                map[k] = v;
              }
            }
          }

          return hash;
      }
    };

        ;JSON._sdonate(["$parse", "$from_object"]);
  })(self);
})();
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __klass = __Ruby.klass, __hash2 = __Ruby.hash2;

  return (function(__base, __super){
    // line 1, /Users/elia/Code/Ruby/core/template.rb, class Template
    function Template() {};
    Template = __klass(__base, __super, "Template", Template);

    ;Template._sdonate(["$[]", "$[]="]);    var Template_prototype = Template.prototype, __scope = Template._scope, TMP_1;
    Template_prototype.body = nil;

    Template._cache = __hash2([], {});

    Template['$[]'] = function(name) {

      if (this._cache == null) this._cache = nil;

      return this._cache['$[]'](name)
    };

    Template['$[]='] = function(name, instance) {

      if (this._cache == null) this._cache = nil;

      return this._cache['$[]='](name, instance)
    };

    Template_prototype.$initialize = TMP_1 = function(name) {
      var __context, body;
      body = TMP_1._p || nil, __context = body._s, TMP_1._p = null;

      this.body = body;
      this.name = name;
      return __scope.Template['$[]='](name, this);
    };

    Template_prototype.$render = function(ctx) {
      var __a;if (ctx == null) {
        ctx = this
      }
      return (__a = ctx, __a.$instance_eval._p = this.body.$to_proc(), __a.$instance_eval());
    };

    return nil;
  })(self, null)
})();
}).call(this);

// racc.rb
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __module = __Ruby.module, __klass = __Ruby.klass;

  return (function(__base){
    // line 15, racc, module Racc
    function Racc() {};
    Racc = __module(__base, "Racc", Racc);
    var Racc_prototype = Racc.prototype, __scope = Racc._scope;

    (function(__base, __super){
      // line 17, racc, class Parser
      function Parser() {};
      Parser = __klass(__base, __super, "Parser", Parser);

      var Parser_prototype = Parser.prototype, __scope = Parser._scope;
      Parser_prototype.yydebug = nil;

      Parser_prototype.$_racc_setup = function() {

        return (this.$class())._scope.Racc_arg;
      };

      Parser_prototype.$do_parse = function() {

        return this.$_racc_do_parse_rb(this.$_racc_setup(), false);
      };

      Parser_prototype.$_racc_do_parse_rb = function(arg, in_debug) {
        var action_table = nil, action_check = nil, action_default = nil, action_pointer = nil, goto_table = nil, goto_check = nil, goto_default = nil, goto_pointer = nil, nt_base = nil, reduce_table = nil, token_table = nil, shift_n = nil, reduce_n = nil, use_result = nil, racc_state = nil, racc_tstack = nil, racc_vstack = nil, racc_t = nil, racc_tok = nil, racc_val = nil, racc_read_next = nil, racc_user_yyerror = nil, racc_error_status = nil, token = nil, act = nil, i = nil, nerr = nil, custate = nil, curstate = nil, reduce_i = nil, reduce_len = nil, reduce_to = nil, method_id = nil, tmp_t = nil, tmp_v = nil, reduce_call_result = nil, k1 = nil, __a, __b, __c, __d;
        action_table = arg['$[]'](0);
        action_check = arg['$[]'](1);
        action_default = arg['$[]'](2);
        action_pointer = arg['$[]'](3);
        goto_table = arg['$[]'](4);
        goto_check = arg['$[]'](5);
        goto_default = arg['$[]'](6);
        goto_pointer = arg['$[]'](7);
        nt_base = arg['$[]'](8);
        reduce_table = arg['$[]'](9);
        token_table = arg['$[]'](10);
        shift_n = arg['$[]'](11);
        reduce_n = arg['$[]'](12);
        use_result = arg['$[]'](13);
        racc_state = [0];
        racc_tstack = [];
        racc_vstack = [];
        racc_t = nil;
        racc_tok = nil;
        racc_val = nil;
        racc_read_next = true;
        racc_user_yyerror = false;
        racc_error_status = 0;
        token = nil;
        act = nil;
        i = nil;
        nerr = nil;
        custate = nil;
        while ((__b = true) !== false && __b !== nil){i = action_pointer['$[]'](racc_state['$[]'](-1));
        if (i !== false && i !== nil) {
          if (racc_read_next !== false && racc_read_next !== nil) {
            if ((__b = !racc_t['$=='](0)) !== false && __b !== nil) {
              token = this.$next_token();
              racc_tok = token['$[]'](0);
              racc_val = token['$[]'](1);
              if (racc_tok['$=='](false)) {
                racc_t = 0
                } else {
                racc_t = token_table['$[]'](racc_tok);
                if ((__b = racc_t) === false || __b === nil) {
                  racc_t = 1
                };
              };
              if ((__b = this.yydebug) !== false && __b !== nil) {
                this.$racc_read_token(racc_t, racc_tok, racc_val)
              };
              racc_read_next = false;
            }
          };
          i = i['$+'](racc_t);
          if ((__b = ((__c = ((__d = i['$<'](0)), __d !== false && __d !== nil ? __d : (act = action_table['$[]'](i))['$nil?']())), __c !== false && __c !== nil ? __c : !action_check['$[]'](i)['$=='](racc_state['$[]'](-1)))) !== false && __b !== nil) {
            act = action_default['$[]'](racc_state['$[]'](-1))
          };
          } else {
          act = action_default['$[]'](racc_state['$[]'](-1))
        };
        if ((__b = this.yydebug) !== false && __b !== nil) {
          this.$puts("(act: " + (act) + ", shift_n: " + (shift_n) + ", reduce_n: " + (reduce_n) + ")")
        };
        if ((__b = ((__c = act['$>'](0)) ? act['$<'](shift_n) : __c)) !== false && __b !== nil) {
          if (racc_error_status['$>'](0)) {
            if ((__b = !racc_t['$=='](1)) !== false && __b !== nil) {
              racc_error_status = racc_error_status['$-'](1)
            }
          };
          racc_vstack.$push(racc_val);
          curstate = act;
          racc_state['$<<'](act);
          racc_read_next = true;
          if ((__b = this.yydebug) !== false && __b !== nil) {
            racc_tstack.$push(racc_t);
            this.$racc_shift(racc_t, racc_tstack, racc_vstack);
          };
          } else {
          if ((__b = ((__c = act['$<'](0)) ? act['$>'](reduce_n['$-@']()) : __c)) !== false && __b !== nil) {
            reduce_i = (__b = act, __c = -3, typeof(__b) === 'number' ? __b * __c : __b['$*'](__c));
            reduce_len = reduce_table['$[]'](reduce_i);
            reduce_to = reduce_table['$[]']((__b = reduce_i, __c = 1, typeof(__b) === 'number' ? __b + __c : __b['$+'](__c)));
            method_id = reduce_table['$[]']((__b = reduce_i, __c = 2, typeof(__b) === 'number' ? __b + __c : __b['$+'](__c)));
            tmp_t = racc_tstack.$last(reduce_len);
            tmp_v = racc_vstack.$last(reduce_len);
            racc_state.$pop(reduce_len);
            racc_vstack.$pop(reduce_len);
            racc_tstack.$pop(reduce_len);
            if (use_result !== false && use_result !== nil) {
              reduce_call_result = this.$__send__(method_id, tmp_v, nil, tmp_v['$[]'](0));
              racc_vstack.$push(reduce_call_result);
              } else {
              this.$raise("not using result??")
            };
            racc_tstack.$push(reduce_to);
            if ((__b = this.yydebug) !== false && __b !== nil) {
              this.$racc_reduce(tmp_t, reduce_to, racc_tstack, racc_vstack)
            };
            k1 = (__b = reduce_to, __c = nt_base, typeof(__b) === 'number' ? __b - __c : __b['$-'](__c));
            if ((__b = !(reduce_i = goto_pointer['$[]'](k1))['$=='](nil)) !== false && __b !== nil) {
              reduce_i = reduce_i['$+'](racc_state['$[]'](-1));
              if ((__b = (__c = ((__c = reduce_i['$>='](0)) ? !(curstate = goto_table['$[]'](reduce_i))['$=='](nil) : __c), __c !== false && __c !== nil ? goto_check['$[]'](reduce_i)['$=='](k1) : __c)) !== false && __b !== nil) {
                racc_state.$push(curstate)
                } else {
                racc_state.$push(goto_default['$[]'](k1))
              };
              } else {
              racc_state.$push(goto_default['$[]'](k1))
            };
            } else {
            if (act['$=='](shift_n)) {
              return racc_vstack['$[]'](0)
              } else {
              if (act['$=='](reduce_n['$-@']())) {
                this.$raise("Ruby Syntax Error: unexpected '" + (racc_tok.$inspect()) + "'")
                } else {
                this.$raise("Rac: unknown action: " + (act))
              }
            }
          }
        };
        if ((__b = this.yydebug) !== false && __b !== nil) {
          this.$racc_next_state(racc_state['$[]'](-1), racc_state)
        };};
      };

      Parser_prototype.$racc_read_token = function(t, tok, val) {

        this.$puts("read    " + (tok) + "(" + (this.$racc_token2str(t)) + ") " + (val.$inspect()));
        return this.$puts("\n");
      };

      Parser_prototype.$racc_shift = function(tok, tstack, vstack) {

        this.$puts("shift  " + (this.$racc_token2str(tok)));
        this.$racc_print_stacks(tstack, vstack);
        return this.$puts("\n");
      };

      Parser_prototype.$racc_reduce = function(toks, sim, tstack, vstack) {
        var __a, __b;
        this.$puts("reduce " + ((function() { if ((__a = toks['$empty?']()) !== false && __a !== nil) {
          return "<none>"
          } else {
          return (__b = toks, __b.$map._p = (__a = function(t) {


            if (t == null) t = nil;

            return this.$racc_token2str(t)
          }, __a._s = this, __a), __b.$map())
        }; return nil; }).call(this)));
        this.$puts("  --> " + (this.$racc_token2str(sim)));
        return this.$racc_print_stacks(tstack, vstack);
      };

      Parser_prototype.$racc_next_state = function(curstate, state) {

        this.$puts("goto  " + (curstate));
        this.$racc_print_states(state);
        return this.$puts("\n");
      };

      Parser_prototype.$racc_token2str = function(tok) {

        return (this.$class())._scope.Racc_token_to_s_table['$[]'](tok);
      };

      Parser_prototype.$racc_print_stacks = function(t, v) {
        var __a, __b;
        this.$puts("  [");
        (__b = t, __b.$each_index._p = (__a = function(i) {


          if (i == null) i = nil;

          return this.$puts("    (" + (this.$racc_token2str(t['$[]'](i))) + " " + (v['$[]'](i).$inspect()) + ")")
        }, __a._s = this, __a), __b.$each_index());
        return this.$puts("  ]");
      };

      Parser_prototype.$racc_print_states = function(s) {
        var __a, __b;
        this.$puts("  [");
        (__b = s, __b.$each._p = (__a = function(st) {


          if (st == null) st = nil;

          return this.$puts("   " + (st))
        }, __a._s = this, __a), __b.$each());
        return this.$puts("  ]");
      };

      return nil;
    })(Racc, null)

  })(self)
})();
// strscan.rb
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __klass = __Ruby.klass;

  return (function(__base, __super){
    // line 1, strscan, class StringScanner
    function StringScanner() {};
    StringScanner = __klass(__base, __super, "StringScanner", StringScanner);

    var StringScanner_prototype = StringScanner.prototype, __scope = StringScanner._scope;
    StringScanner_prototype.pos = StringScanner_prototype.matched = StringScanner_prototype.working = nil;

    StringScanner_prototype.$pos = function() {

      return this.pos
    }, nil;

    StringScanner_prototype.$matched = function() {

      return this.matched
    }, nil;

    StringScanner_prototype.$initialize = function(string) {

      this.string = string;
      this.pos = 0;
      this.matched = "";
      return this.working = string;
    };

    StringScanner_prototype.$scan = function(regex) {


      var regex  = new RegExp('^' + regex.toString().substring(1, regex.toString().length - 1)),
          result = regex.exec(this.working);

      if (result == null) {
        this.matched = '';

        return nil;
      }
      else if (typeof(result) === 'object') {
        this.pos      += result[0].length;
        this.working  = this.working.substring(result[0].length);
        this.matched  = result[0];

        return result[0];
      }
      else if (typeof(result) === 'string') {
        this.pos     += result.length;
        this.working  = this.working.substring(result.length);

        return result;
      }
      else {
        return nil;
      }

    };

    StringScanner_prototype.$check = function(regex) {


      var regexp = new RegExp('^' + regex.toString().substring(1, regex.toString().length - 1)),
          result = regexp.exec(this.working);

      if (result == null) {
        return this.matched = nil;
      }

      return this.matched = result[0];

    };

    StringScanner_prototype.$peek = function(length) {

      return this.working.substring(0, length);
    };

    StringScanner_prototype['$eos?'] = function() {

      return this.working.length === 0;
    };

    return nil;
  })(self, null)
})();
// lib/Ruby/grammar.rb
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __module = __Ruby.module, __klass = __Ruby.klass, __hash = __Ruby.hash;

  //= require racc/parser.rb;
  return (function(__base){
    // line 8, Ruby/grammar, module Ruby
    function Ruby() {};
    Ruby = __module(__base, "Ruby", Ruby);
    var Ruby_prototype = Ruby.prototype, __scope = Ruby._scope;

    (function(__base, __super){
      // line 9, Ruby/grammar, class Grammar
      function Grammar() {};
      Grammar = __klass(__base, __super, "Grammar", Grammar);

      var clist = nil, racc_action_table = nil, arr = nil, idx = nil, racc_action_check = nil, racc_action_pointer = nil, racc_action_default = nil, racc_goto_table = nil, racc_goto_check = nil, racc_goto_pointer = nil, racc_goto_default = nil, racc_reduce_table = nil, racc_reduce_n = nil, racc_shift_n = nil, racc_token_table = nil, racc_nt_base = nil, racc_use_result_var = nil, Grammar_prototype = Grammar.prototype, __scope = Grammar._scope, __a, __b, __c, __d, __e;
      Grammar_prototype.line = Grammar_prototype.scope_line = Grammar_prototype.string_parse = Grammar_prototype.file = Grammar_prototype.scope = Grammar_prototype.line_number = nil;

      clist = ["63,64,65,7,51,525,197,198,57,58,197,198,372,61,561,59,60,62,23,24,66", "67,196,-470,262,590,22,28,27,89,88,90,91,262,669,17,197,198,197,198", "701,6,41,8,9,93,92,83,50,85,84,86,87,94,95,489,81,82,589,38,39,37,-303", "-77,-74,654,657,590,-417,-303,-85,73,100,-415,525,-417,560,99,525,74", "-415,36,-82,532,30,-470,525,52,-80,723,525,-59,32,294,262,257,40,100", "-80,-424,589,-74,99,-84,18,-81,-470,261,-74,79,73,75,76,77,78,100,261", "524,74,80,99,-303,63,64,65,294,51,56,-67,654,57,58,-415,53,54,61,668", "59,60,62,248,249,66,67,741,726,654,-78,247,278,282,89,88,90,91,100,257", "197,198,702,99,100,549,653,41,554,99,93,92,83,50,85,84,86,87,94,95,261", "81,82,-472,38,39,37,100,257,524,800,100,99,524,778,-82,99,-82,419,100", "-82,524,217,100,99,524,202,590,99,206,-82,-80,52,-80,661,549,-80,595", "-81,244,-81,40,726,-81,532,551,550,549,100,209,653,590,257,99,79,73", "75,76,77,78,589,-415,-79,74,80,100,-85,653,-415,-418,99,251,56,63,64", "65,-418,51,53,54,-422,57,58,531,589,532,61,-422,59,60,62,248,249,66", "67,551,550,562,374,247,278,282,89,88,90,91,217,551,550,100,217,-472", "-73,567,99,41,685,813,93,92,83,50,85,84,86,87,94,95,549,81,82,649,38", "39,37,217,221,226,227,228,223,225,233,234,229,230,415,210,211,-73,100", "231,232,416,202,99,-73,206,549,726,52,521,323,322,326,325,214,731,220", "40,216,215,212,213,224,222,218,209,219,287,288,732,79,73,75,76,77,78", "551,550,552,74,80,733,235,63,64,65,549,51,56,518,-423,57,58,417,53,54", "61,-423,59,60,62,23,24,66,67,518,551,550,556,22,28,27,89,88,90,91,844", "-251,17,-259,-424,-72,100,845,-251,41,-259,99,93,92,83,50,85,84,86,87", "94,95,501,81,82,500,38,39,37,-257,551,550,547,-423,519,501,-257,194", "503,-419,-423,-473,-72,254,195,-70,-419,-423,202,-72,255,206,-78,613", "52,501,520,-421,503,843,-251,244,-259,40,-421,483,-251,-258,-258,509", "510,18,484,-251,-258,-258,79,73,75,76,77,78,572,741,726,74,80,100,-257", "63,64,65,99,51,56,738,193,57,58,-423,53,54,61,719,59,60,62,248,249,66", "67,501,197,198,500,247,278,282,89,88,90,91,726,-74,482,-251,-258,-258", "745,567,-82,41,813,746,93,92,83,50,85,84,86,87,94,95,519,81,82,518,38", "39,37,217,221,226,227,228,223,225,233,234,229,230,-412,210,211,492,515", "231,232,-412,202,513,493,206,487,488,52,323,322,326,325,246,214,217", "220,40,216,215,212,213,224,222,218,209,219,326,325,-257,79,73,75,76", "77,78,-257,718,533,74,80,-473,235,713,-212,665,506,251,56,63,64,65,663", "51,53,54,417,57,58,712,504,217,61,455,59,60,62,248,249,66,67,761,763", "518,766,247,278,282,89,88,90,91,665,455,691,-420,544,768,-257,737,571", "41,-420,545,93,92,83,50,85,84,86,87,94,95,664,81,82,453,38,39,37,217", "221,226,227,228,223,225,233,234,229,230,-257,210,211,-71,257,231,232", "-257,202,-72,-79,206,-473,381,52,489,-80,383,382,664,214,217,220,40", "216,215,212,213,224,222,218,209,219,-239,491,490,79,73,75,76,77,78,704", "555,257,74,80,294,235,63,64,65,217,51,56,266,-76,57,58,-257,53,54,61", "-84,59,60,62,248,249,66,67,485,479,638,478,247,278,282,89,88,90,91,-258", "214,779,780,781,216,215,-258,257,41,645,257,93,92,83,50,85,84,86,87", "94,95,217,81,82,236,38,39,37,217,221,226,227,228,223,225,233,234,229", "230,-259,210,211,477,784,231,232,-259,202,785,-58,206,787,462,52,323", "322,326,325,-258,214,-237,220,40,216,215,212,213,224,222,218,209,219", "791,634,607,79,73,75,76,77,78,608,455,795,74,80,797,235,63,64,65,7,51", "56,453,450,57,58,-259,53,54,61,421,59,60,62,23,24,66,67,420,633,-472", "803,22,28,27,89,88,90,91,294,418,17,102,103,104,105,106,6,41,8,9,93", "92,83,50,85,84,86,87,94,95,217,81,82,570,38,39,37,217,221,226,227,228", "223,225,233,234,229,230,607,210,211,807,808,231,232,608,36,294,632,30", "495,214,52,619,817,216,215,32,214,-240,220,40,216,215,212,213,224,222", "218,18,219,384,687,818,79,73,75,76,77,78,645,820,722,74,80,294,235,63", "64,65,363,51,56,360,518,57,58,-473,53,54,61,559,59,60,62,248,249,66", "67,830,831,339,-67,247,278,282,89,88,90,91,102,103,104,105,106,323,322", "326,325,41,834,618,93,92,83,50,85,84,86,87,94,95,836,81,82,837,38,39", "37,217,221,226,227,228,223,225,233,234,229,230,518,210,211,617,766,231", "232,236,202,294,462,206,770,771,52,772,94,95,286,609,214,846,220,40", "216,215,212,213,224,222,218,209,219,285,-238,462,79,73,75,76,77,78,236", "852,294,74,80,565,235,63,64,65,217,51,56,632,604,57,58,192,53,54,61", "191,59,60,62,23,24,66,67,190,189,862,518,22,28,27,89,88,90,91,864,214", "17,865,188,216,215,212,213,41,566,-237,93,92,83,50,85,84,86,87,94,95", "96,81,82,569,38,39,37,217,221,226,227,228,223,225,233,234,229,230,518", "210,211,,,231,232,,202,,,206,,,52,,,,,,214,,220,40,216,215,212,213,224", "222,218,18,219,,,,79,73,75,76,77,78,,,,74,80,,235,63,64,65,217,51,56", ",,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91", ",214,,,,216,215,212,213,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38", "39,37,217,221,226,227,228,223,225,233,234,229,230,,210,211,,,231,232", ",202,,,206,,,52,,,,,595,214,,220,40,216,215,212,213,224,222,218,209", "219,,,,79,73,75,76,77,78,,,,74,80,,235,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,", ",93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,217,221,226,227,228", "223,225,233,234,229,230,,210,211,,,231,232,,202,,,206,,,52,,,,,,214", ",220,40,216,215,212,213,224,222,218,209,219,,,,79,73,75,76,77,78,,,", "74,80,,235,,-212,,,251,56,63,64,65,,51,53,54,,57,58,,,,61,,59,60,62", "248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50", "85,84,86,87,94,95,,81,82,,38,39,37,217,221,226,227,228,223,225,233,234", "229,230,,210,211,,,231,232,,202,,,206,,,52,,,,,246,214,,220,40,216,215", "212,213,224,222,218,209,219,,,,79,73,75,76,77,78,,,,74,80,,235,587,", ",,251,56,63,64,65,7,51,53,54,,57,58,,,,61,,59,60,62,23,24,66,67,,,,", "22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95", ",81,82,,38,39,37,217,221,226,227,228,223,225,233,234,229,230,,210,211", ",,231,232,,36,,,30,,,52,,,,,32,214,,220,40,216,215,212,213,224,222,218", "18,219,,,,79,73,75,76,77,78,,,,74,80,,235,63,64,65,,51,56,,,57,58,,53", "54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,", ",93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,217,221,226,227,228", "223,225,233,234,229,230,,210,211,,,231,232,,202,,,206,,,52,,,,,,214", ",220,40,216,215,212,213,224,222,218,18,219,,,,79,73,75,76,77,78,,,,74", "80,,235,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,", "22,28,27,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81", "82,,38,39,37,217,221,226,227,228,223,225,233,234,229,230,,210,211,,", "231,232,,202,,,206,,,52,,,,,,214,,220,40,216,215,212,213,224,222,218", "209,219,,,,79,73,75,76,77,78,,,,74,80,,235,63,64,65,7,51,56,,,57,58", ",53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6", "41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,217,221,226,227", "228,223,225,233,234,229,230,,210,211,,,231,232,,36,,,30,,,52,,,,,32", "214,,220,40,216,215,212,213,224,222,218,18,219,,,,79,73,75,76,77,78", ",,,74,80,,235,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66", "67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86", "87,94,95,,81,82,,38,39,37,217,221,226,227,228,223,225,233,234,229,230", ",210,211,,,231,232,,36,,,30,,,52,,,,,32,214,,220,40,216,215,212,213", "224,222,218,18,219,,,,79,73,75,76,77,78,,,,74,80,,235,63,64,65,,51,56", ",,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,28,27,89,88,90,91", ",,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,217,221", "226,227,228,223,225,233,234,229,230,,210,211,,,231,232,,202,,,206,,", "52,,,,,246,214,244,220,40,216,215,212,213,224,222,218,209,219,,,,79", "73,75,76,77,78,,,,74,80,316,235,320,318,317,319,251,56,63,64,65,,51", "53,54,,57,58,,,,61,,59,60,62,248,249,66,67,,,,,247,28,27,89,88,90,91", ",,,,323,322,326,325,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,217,221,226,227,228,223,225,233,234,229,230,,210,211,,,231,232,,202", ",,206,,,52,,,,,246,214,244,220,40,216,215,212,213,224,222,218,209,219", ",,,79,73,75,76,77,78,,,,74,80,679,235,320,318,317,319,251,56,63,64,65", ",51,53,54,,57,58,,,,61,,59,60,62,248,249,66,67,,,,,247,28,27,89,88,90", "91,,,,,323,322,326,325,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38", "39,37,,,,,,,,,,,,,,316,,320,318,317,319,202,,,206,,,52,,,,,246,,244", ",40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,323,322,326,325,,,251", "56,63,64,65,7,51,53,54,,57,58,,,,61,,59,60,62,23,24,66,67,,,,,22,28", "27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81", "82,,38,39,37,217,-494,-494,-494,-494,223,225,,,-494,-494,,,,,,231,232", ",36,,,30,,,52,,,,,32,214,,220,40,216,215,212,213,224,222,218,18,219", ",,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59", "60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,279,,,93,92", "83,50,85,84,86,87,94,95,,81,82,,,,283,,,,,,,,,,,,,,679,,320,318,317", "319,647,,,206,,,52,,,-350,316,,320,318,317,319,-350,-350,-350,,,-350", "-350,-350,,-350,,,79,73,75,76,77,78,-350,-350,-350,74,80,323,322,326", "325,,-350,-350,56,-350,-350,-350,-350,-350,53,54,,323,322,326,325,,", ",,,,,706,,,,,,,-350,-350,-350,-350,-350,-350,-350,-350,-350,-350,-350", "-350,-350,-350,,,-350,-350,-350,,,-350,,257,-350,,,,,-350,,-350,,-350", ",-350,-350,-350,-350,-350,-350,-350,,-350,-350,-350,,316,,320,318,317", "319,,,,,,-350,-350,-350,-350,,-350,-265,,,,,,-350,-265,-265,-265,,,-265", "-265,-265,679,-265,320,318,317,319,308,,,,,-265,-265,323,322,326,325", ",,,-265,-265,,-265,-265,-265,-265,-265,,316,,320,318,317,319,,,,673", ",,,,,,323,322,326,325,-265,-265,-265,-265,-265,-265,-265,-265,-265,-265", "-265,-265,-265,-265,,,-265,-265,-265,512,,-265,,266,-265,323,322,326", "325,-265,,-265,,-265,,-265,-265,-265,-265,-265,-265,-265,,-265,,-265", ",,,,,,,,,,,,-265,-265,-265,-265,,-265,63,64,65,7,51,,-265,,57,58,,,", "61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9", "93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,217,221,226,227,228,223", "225,233,,229,230,,,,,,231,232,,36,,,268,,,52,,,,,32,214,,220,40,216", "215,212,213,224,222,218,18,219,,,,79,73,75,76,77,78,,,,74,80,,,63,64", "65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282", "89,88,90,91,,,,,,,,,,279,,,93,92,83,50,85,84,86,87,94,95,,81,82,217", ",679,283,320,318,317,319,,,,,,,,,231,232,,,,,,276,,,273,,,52,,214,,220", "272,216,215,212,213,,673,218,,219,,,,323,322,326,325,79,73,75,76,77", "78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66", "67,,,,,247,278,282,89,88,90,91,,,,,,,,,,279,,,93,92,83,50,85,84,86,87", "94,95,,81,82,,,,283,217,221,226,227,228,223,225,,,229,230,,,,,,231,232", ",276,,,206,,,52,,,,,,214,,220,,216,215,212,213,224,222,218,,219,,,,79", "73,75,76,77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60", "62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83", "50,85,84,86,87,94,95,,81,82,,38,39,37,217,-494,-494,-494,-494,223,225", ",,-494,-494,,,,,,231,232,,36,,,30,,,52,,,,,32,214,,220,40,216,215,212", "213,224,222,218,18,219,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,7,51", "56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91", ",,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,217", "-494,-494,-494,-494,223,225,,,-494,-494,,,,,,231,232,,36,,,30,,,52,", ",,,32,214,,220,40,216,215,212,213,224,222,218,18,219,,,,79,73,75,76", "77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24", "66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84", "86,87,94,95,,81,82,,38,39,37,217,-494,-494,-494,-494,223,225,,,-494", "-494,,,,,,231,232,,36,,,30,,,52,,,,,32,214,,220,40,216,215,212,213,224", "222,218,18,219,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,7,51,56,,,57", "58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,", ",,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,217,-494,-494", "-494,-494,223,225,,,-494,-494,,,,,,231,232,,36,,,30,,,52,,,,,32,214", ",220,40,216,215,212,213,224,222,218,18,219,,,,79,73,75,76,77,78,,,,74", "80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247", "278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81", "82,,38,39,37,217,-494,-494,-494,-494,223,225,,,-494,-494,,,,,,231,232", ",202,,,206,,,52,,,,,,214,,220,40,216,215,212,213,224,222,218,209,219", ",,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59", "60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92", "83,50,85,84,86,87,94,95,,81,82,,38,39,37,217,,,,,,,,,,,,,,,,231,232", ",202,,,206,,,52,,,,,,214,,220,40,216,215,212,213,,,218,209,219,,,,79", "73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62", "248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50", "85,84,86,87,94,95,,81,82,,38,39,37,217,221,226,227,228,223,225,233,234", "229,230,,-494,-494,,,231,232,,202,,,206,,,52,,,,,,214,,220,40,216,215", "212,213,224,222,218,209,219,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65", ",51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89", "88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37", "217,221,226,227,228,223,225,233,234,229,230,,-494,-494,,,231,232,,202", ",,206,,,52,,,,,595,214,244,220,40,216,215,212,213,224,222,218,209,219", ",,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59", "60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92", "83,50,85,84,86,87,94,95,,81,82,,38,39,37,217,,,,,,,,,,,,,,,,231,232", ",202,,,206,,,52,,,,,,214,,220,40,216,215,212,213,,,218,209,219,,,,79", "73,75,76,77,78,,-252,,74,80,,,,-252,-252,-252,,56,-252,-252,-252,217", "-252,53,54,,,,,,-252,,-252,-252,,,,231,232,,,-252,-252,,-252,-252,-252", "-252,-252,,,,214,,220,,216,215,212,213,,,218,,219,,,,,,-252,-252,-252", "-252,-252,-252,-252,-252,-252,-252,-252,-252,-252,-252,,,-252,-252,-252", ",,-252,,,-252,,,-252,,-252,,-252,,-252,,-252,-252,-252,-252,-252,-252", "-252,,-252,,-252,,,,,,,,,,,,,-252,-252,-252,-252,,-252,,,-252,-252,", ",-252,63,64,65,,51,,,,57,58,,,,61,,59,60,62,23,24,66,67,,,,,22,28,27", "89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,217,81,82", ",38,39,37,,217,,,,,,,,231,232,,,,,,,231,232,202,,,206,,214,52,220,,216", "215,212,213,214,,40,,216,215,212,213,,,18,,,,,79,73,75,76,77,78,,,,74", "80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247", "278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81", "82,,38,39,37,217,,,,,,,,,,,,,,,,231,232,,202,,,206,,,52,,,,,246,214", ",220,40,216,215,212,213,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,,,,", "251,56,63,64,65,,51,53,54,,57,58,,,,61,,59,60,62,248,249,66,67,,,,,247", "278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81", "82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,246,,,,40,,,,,,,", "209,,,,,79,73,75,76,77,78,,,,74,80,,,,,,,251,56,63,64,65,,51,53,54,", "57,58,,,,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,", ",,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,", ",,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78,", ",,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,", ",,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94", "95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,", ",,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53", "54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,", ",93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202", ",,206,,,52,,,,,,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63", "64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89", "88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,18,,,,,79,73", "75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23", "24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84", "86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,", ",,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,100,,,,,99,,56,63,64", "65,7,51,53,54,,57,58,,,,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88", "90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73", "75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248", "249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84", "86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,595", ",,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,", "57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91", ",,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,", ",,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77", "78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67", ",,,,22,28,27,89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84,86,87,94", "95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,", ",,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53", "54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,279", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,,,283,,,,,,,,,,,,,,,,,,,,825", ",,206,,,52,,,,,,,,,,,,,,,,,,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65", ",51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89", "88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37", ",,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,246,,,,40,,,,,,,,209,,,,,79,73", "75,76,77,78,,,,74,80,,,,,,,251,56,-475,-475,-475,,-475,53,54,,-475,-475", ",,,-475,,-475,-475,-475,-475,-475,-475,-475,,,,,-475,-475,-475,-475", "-475,-475,-475,,,,,,,,,,-475,,,-475,-475,-475,-475,-475,-475,-475,-475", "-475,-475,,-475,-475,,-475,-475,-475,,,,,,,,,,,,,,,,,,,,-475,,,-475", "-475,,-475,,,,,-475,,-475,,-475,,,,,,,,-475,,,,,-475,-475,-475,-475", "-475,-475,,,,-475,-475,,,,,,,-475,-475,-469,-469,-469,,-469,-475,-475", ",-469,-469,,,,-469,,-469,-469,-469,-469,-469,-469,-469,,-469,,,-469", "-469,-469,-469,-469,-469,-469,,,,,,,,,,-469,,,-469,-469,-469,-469,-469", "-469,-469,-469,-469,-469,,-469,-469,,-469,-469,-469,,,,,,,,,,,,,,,,", ",,,-469,,,-469,-469,,-469,,,,,-469,,-469,,-469,,,,,,,,-469,,-469,,,-469", "-469,-469,-469,-469,-469,,,,-469,-469,,,,,,,-469,-469,-470,-470,-470", ",-470,-469,-469,,-470,-470,,,,-470,,-470,-470,-470,-470,-470,-470,-470", ",-470,,,-470,-470,-470,-470,-470,-470,-470,,,,,,,,,,-470,,,-470,-470", "-470,-470,-470,-470,-470,-470,-470,-470,,-470,-470,,-470,-470,-470,", ",,,,,,,,,,,,,,,,,,-470,,,-470,-470,,-470,,,,,-470,,-470,,-470,,,,,,", ",-470,,-470,,,-470,-470,-470,-470,-470,-470,,,,-470,-470,,,,,,,-470", "-470,63,64,65,7,51,-470,-470,,57,58,,,,61,,59,60,62,23,24,66,67,,,,", "22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95", ",81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,", ",18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54", "61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9", "93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36", ",,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63", "64,65,374,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27", "89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38", "39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,18,,,,,79", "73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62", "23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85", "84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,", ",,,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56", ",,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17", ",,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,", ",,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,", ",,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,", ",,22,28,27,89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95", ",81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,", ",18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54", "61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9", "93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36", ",,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63", "64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282", "89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73", "75,76,77,78,,,,74,80,,,-474,-474,-474,,-474,56,,,-474,-474,,53,54,-474", ",-474,-474,-474,-474,-474,-474,-474,,,,,-474,-474,-474,-474,-474,-474", "-474,,,,,,,,,,-474,,,-474,-474,-474,-474,-474,-474,-474,-474,-474,-474", ",-474,-474,,-474,-474,-474,,,,,,,,,,,,,,,,,,,,-474,,,-474,-474,,-474", ",,,,-474,,-474,,-474,,,,,,,,-474,,,,-257,-474,-474,-474,-474,-474,-474", "-257,-257,-257,-474,-474,,-257,-257,,-257,,-474,-474,,,,,,-474,-474", ",,,,,,,,-257,-257,,-257,-257,-257,-257,-257,,,,,,,,,,,,,,,,,,,,,,-257", "-257,-257,-257,-257,-257,-257,-257,-257,-257,-257,-257,-257,-257,,,-257", "-257,-257,,580,,,,-257,,,,,,,-257,,-257,,-257,-257,-257,-257,-257,-257", "-257,,-257,,-257,,,,,,,,,,,,,-257,-257,,-75,,-257,,,,,-83,,-257,63,64", "65,7,51,,,,57,58,,,,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91", ",,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,", ",,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76", "77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24", "66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84", "86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32", ",,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57", "58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,,,,,,", ",41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,", ",,,,202,,,206,,,52,,,,,391,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,", ",74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,", ",22,28,27,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81", "82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,391,,,,40,,,,,,,", "209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,,,,,,,,41,,,93,92", "83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206", ",,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65", ",51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89", "88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37", ",,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,246,,,,40,,,,,,,,209,,,,,79,73", "75,76,77,78,-476,,,74,80,,,-476,-476,-476,,251,56,-476,-476,,-476,,53", "54,,,,,,-476,,,,,,,,,,-476,-476,,-476,-476,-476,-476,-476,,,,,,,,,,", ",,,,,,,,,,,-476,-476,-476,-476,-476,-476,-476,-476,-476,-476,-476,-476", "-476,-476,,,-476,-476,-476,,577,,,,-476,,,,,,,-476,,-476,,-476,-476", "-476,-476,-476,-476,-476,,-476,-476,-476,,,,,,,,,,,,,-476,-476,,-73", ",-476,-492,,,,-81,,-476,-492,-492,-492,,,-492,-492,-492,,-492,,,,,,", ",,-492,-492,-492,,,,,,,,-492,-492,,-492,-492,-492,-492,-492,,,,,,,,", ",,,,,,,,,,,,,-492,-492,-492,-492,-492,-492,-492,-492,-492,-492,-492", "-492,-492,-492,,,-492,-492,-492,,,-492,,257,-492,,,,,-492,,-492,,-492", ",-492,-492,-492,-492,-492,-492,-492,,-492,-492,-492,,,,,,,,,,,,,-492", "-492,-492,-492,,-492,63,64,65,,51,,-492,,57,58,,,,61,,59,60,62,23,24", "66,67,,,,,22,28,27,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87", "94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40", ",,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58", ",53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,", "41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,", ",,,202,,,206,,,52,,,,,,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28", "27,89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82", ",38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,18,,,", ",79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59", "60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,,,93,92,83", "50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,", ",52,,,,,,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,", "51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88", "90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,", ",,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75", "76,77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23", "24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85", "84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,", "32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56", ",,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91", ",,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,", ",,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77", "78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66", "67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87", "94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,690,,,", "40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57", "58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,", ",,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,", ",,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78", ",,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67", ",,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87", "94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40", ",,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,", "53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,", ",,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,", ",,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74", "80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247", "278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81", "82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209", ",,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,", "59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93", "92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,", ",206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63", "64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282", "89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73", "75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248", "249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84", "86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,", ",,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,", "57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91", ",,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,", ",,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77", "78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66", "67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87", "94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40", ",,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58", ",53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,", ",,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,", ",,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,", "74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,", ",,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95", ",81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,", ",209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,", ",93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202", ",,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63", "64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282", "89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73", "75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248", "249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84", "86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,", ",,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,", "57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91", ",,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,", ",,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77", "78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66", "67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87", "94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40", ",,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58", ",53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,", ",,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,", ",,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,", "74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,", ",,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95", ",81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,", ",209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,", ",93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202", ",,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63", "64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282", "89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73", "75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248", "249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84", "86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,", ",,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,", "57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91", ",,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,", ",,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77", "78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66", "67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87", "94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40", ",,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58", ",53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,", ",,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,", ",,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,", "74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,", ",,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95", ",81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,", ",209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,", ",93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202", ",,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63", "64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282", "89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73", "75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248", "249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84", "86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,", ",,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,", "57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91", ",,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,", ",,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77", "78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67", ",,,,22,28,27,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95", ",81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,", ",209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54", "61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9", "93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36", ",,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63", "64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89", "88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38", "39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79", "73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62", "248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50", "85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52", ",,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51", "56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91", ",,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,", ",,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77", "78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66", "67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87", "94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40", ",,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58", ",53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,", ",,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,", ",,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,", "74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,", "22,28,27,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81", "82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209", ",,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,", "59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93", "92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,", ",206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63", "64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89", "88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38", "39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79", "73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62", "248,249,66,67,,,,,247,28,27,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85", "84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,", ",,246,,244,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,,,,,251,56", "63,64,65,,51,53,54,,57,58,,,,61,,59,60,62,248,249,66,67,,,,,247,28,27", "89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,,,,,,,,,,,,,,,,,,,,202,,,206,,,471,,,,,246,,244,,40,,,,,,,,209,,", ",,79,73,75,76,77,78,,,,74,80,,,,,,,251,56,63,64,65,,51,53,54,,57,58", ",,,61,,59,60,62,248,249,66,67,,,,,247,28,27,89,88,90,91,,,,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,475,52,,,,,246,,244,,40,,,,,,,,209,,,,,79,73,75,76,77,78", ",-476,,74,80,,,,-476,-476,-476,251,56,-476,-476,-476,,-476,53,54,,,", ",,,-476,-476,-476,,,,,,,,-476,-476,,-476,-476,-476,-476,-476,,,,,,,", ",,,,,,,,,,,,,,-476,-476,-476,-476,-476,-476,-476,-476,-476,-476,-476", "-476,-476,-476,,,-476,-476,-476,,703,-476,,,-476,,,-476,,-476,,-476", ",-476,,-476,-476,-476,-476,-476,-476,-476,,-476,-476,-476,,,,,,,,,,", ",,-476,-476,-476,-476,,-476,,,,,-81,,-476,63,64,65,7,51,,,,57,58,,,", "61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9", "93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36", ",,268,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63", "64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282", "89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,246,,,,40,,,,,,,,209,,,,,79", "73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62", "23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85", "84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,", ",,,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56", ",,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91", ",,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,", ",,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77", "78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66", "67,,,,,247,278,282,89,88,90,91,,,,,,,,,,279,,,93,92,83,50,85,84,86,87", "94,95,,81,82,,,,283,,,,,,,,,,,,,,,,,,,,276,,,206,,,52,,,,,,,,,,,,,,", ",,,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54", "61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9", "93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36", ",,268,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,-257,,74,80", ",,,-257,-257,-257,,56,-257,-257,-257,,-257,53,54,,,,,,,,-257,-257,,", ",,,,,-257,-257,,-257,-257,-257,-257,-257,,,,,,,,,,,,,,,,,,,,,,-257,-257", "-257,-257,-257,-257,-257,-257,-257,-257,-257,-257,-257,-257,,,-257,-257", "-257,,580,-257,,,-257,,,-257,,-257,,-257,,-257,,-257,-257,-257,-257", "-257,-257,-257,,-257,,-257,,,,,,,,,,,,,-257,-257,-257,-257,,-257,,63", "64,65,-83,51,-257,,,57,58,,,,61,,59,60,62,248,249,66,67,,,,,247,278", "282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,", "38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,", ",79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59", "60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92", "83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206", ",,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65", "7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90", "91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37", ",,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75", "76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248", "249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84", "86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,", ",,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,", "57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91", ",,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,", ",,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77", "78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66", "67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86", "87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,", "40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58", ",53,54,61,,59,60,62,248,249,66,67,,,,,247,28,27,89,88,90,91,,,,,,,,", ",41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,", ",,,,202,,,206,,,52,,,,,595,,244,,40,,,,,,,,209,,,,,79,73,75,76,77,78", ",,,74,80,,,,,,,251,56,63,64,65,,51,53,54,,57,58,,,,61,,59,60,62,248", "249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,279,,,93,92,83,50,85", "84,534,87,94,95,,81,82,,,,283,,,,,,,,,,,,,,,,,,,,535,,,206,,,52,,,,", ",,,,,,,,,,,,,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58", ",53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,", ",,,279,,,93,92,83,50,85,84,534,87,94,95,,81,82,,,,283,,,,,,,,,,,,,,", ",,,,,535,,,206,,,52,,,,,,,,,,,,,,,,,,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28", "27,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38", "39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,209,,,,,79", "73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62", "248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50", "85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52", ",,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,7,51", "56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91", ",,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,", ",,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76", "77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24", "66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84", "86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32", ",,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57", "58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,", ",,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,", ",,,,,,,,,202,,,206,495,,52,,,,,,,,,40,,,,,,,,209,,,,,79,73,75,76,77", "78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66", "67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86", "87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,", "40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58", ",53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,", "41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,", ",,,202,,,206,,,52,,,,,,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28", "27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81", "82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18", ",,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,", "59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,,,93,92", "83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206", ",,52,,,,,,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65", "7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90", "91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37", ",,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75", "76,77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23", "24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85", "84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,", "32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56", ",,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91", ",,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,", ",,,,,,,,,,,,202,,,206,,,52,,,,,391,,,,40,,,,,,,,209,,,,,79,73,75,76", "77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66", "67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84,86,87", "94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40", ",,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,", "53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,,52,,,,,,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,", ",63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247,278", "282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,", "38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,246,,,,40,,,,,,,,209", ",,,,79,73,75,76,77,78,,,,74,80,,,,,,,251,56,63,64,65,,51,53,54,,57,58", ",,,61,,59,60,62,248,249,66,67,,,,,247,278,282,89,88,90,91,,,,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,,52,,,,,246,,,,40,,,,,,,,209,,,,,79,73,75,76,77,78,,,,74", "80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,248,249,66,67,,,,,247", "278,282,89,88,90,91,,,,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81", "82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,244,,40,,,,,,,", "209,,,,,79,73,75,76,77,78,,-492,,74,80,,,,-492,-492,-492,251,56,-492", "-492,-492,,-492,53,54,,,,,,,,-492,,,,,,,,,-492,-492,,-492,-492,-492", "-492,-492,,,,,,,,,,,,-492,,,,,,,-492,-492,-492,,,-492,-492,-492,,-492", ",,,,-492,,,,,-492,,-492,,,,,257,-492,-492,-492,,-492,-492,-492,-492", "-492,,,,,,,,,,,,,-492,,,,,,,,,,,,,-492,,-492,,,-492,,-492,,,,,,,-492", ",,,,257,-492,,,,,,,,,,,,,,,,,,,,,-492,,,,,,,,,,,,,-492,,-492,,,-492", "153,164,154,177,150,170,160,159,,,175,158,157,152,178,,,162,151,165", "169,171,163,156,,,172,179,174,173,166,176,161,149,168,167,180,181,182", "183,184,148,155,146,147,144,145,109,111,,,110,,,,,,,,137,138,,135,119", "120,121,143,124,126,,,122,,,,,139,140,127,128,,,,,,,,,,,,,132,131,,118", "136,134,133,129,130,125,123,116,142,117,,,141,185,153,164,154,177,150", "170,160,159,,80,175,158,157,152,178,,,162,151,165,169,171,163,156,,", "172,179,174,173,166,176,161,149,168,167,180,181,182,183,184,148,155", "146,147,144,145,109,111,,,110,,,,,,,,137,138,,135,119,120,121,143,124", "126,,,122,,,,,139,140,127,128,,,,,,,,,,,,,132,131,,118,136,134,133,129", "130,125,123,116,142,117,,,141,185,153,164,154,177,150,170,160,159,,80", "175,158,157,152,178,,,162,151,165,169,171,163,156,,,172,179,174,173", "166,176,161,149,168,167,180,181,182,183,184,148,155,146,147,144,145", "109,111,108,,110,,,,,,,,137,138,,135,119,120,121,143,124,126,,,122,", ",,,139,140,127,128,,,,,,,,,,,,,132,131,,118,136,134,133,129,130,125", "123,116,142,117,,,141,185,153,164,154,177,150,170,160,159,,80,175,158", "157,152,178,,,162,151,165,169,171,163,156,,,172,179,174,173,166,176", "161,149,168,167,180,181,182,183,184,148,155,146,147,144,145,109,111", ",,110,,,,,,,,137,138,,135,119,120,121,143,124,126,,,122,,,,,139,140", "127,128,,,,,,,,,,,,,132,131,,118,136,134,133,129,130,125,123,116,142", "117,,,141,185,153,164,154,177,150,170,160,159,,80,175,158,157,152,178", ",,162,151,165,169,171,163,156,,,172,179,174,173,166,176,161,149,168", "167,180,181,182,183,184,148,155,146,147,144,145,109,111,370,369,110", "371,,,,,,,137,138,,135,119,120,121,143,124,126,,,122,,,,,139,140,127", "128,,,,,,,,,,,,,132,131,,118,136,134,133,129,130,125,123,116,142,117", ",,141,153,164,154,177,150,170,160,159,,,175,158,157,152,178,,,162,151", "165,169,171,163,156,,,172,179,174,347,346,348,345,149,168,167,180,181", "182,183,184,148,155,146,147,343,344,341,111,85,84,342,87,,,,,,,137,138", ",135,119,120,121,143,124,126,,,122,,,,,139,140,127,128,,,,,,353,,,,", ",,132,131,,118,136,134,133,129,130,125,123,116,142,117,,,141,153,164", "154,177,150,170,160,159,,,175,158,157,152,178,,,162,151,165,169,171", "163,156,,,172,179,174,173,166,176,161,149,168,167,180,181,182,183,184", "148,155,146,147,144,145,109,111,,,110,,,,,,,,137,138,,135,119,120,121", "143,124,126,,,122,,,,,139,140,127,128,,,,,,,,,,,,,132,131,,118,136,134", "133,129,130,125,123,116,142,117,,,141,153,164,154,177,150,170,160,159", ",,175,158,157,152,178,,,162,151,165,169,171,163,156,,,172,179,174,173", "166,176,161,149,168,167,180,181,182,183,184,148,155,146,147,144,145", "109,111,370,369,110,371,,,,,,,137,138,,135,119,120,121,143,124,126,", ",122,,,,,139,140,127,128,,,,,,,,,,,,,132,131,,118,136,134,133,129,130", "125,123,116,142,117,459,403,141,,460,,,,,,,,137,138,,135,119,120,121", "143,124,126,,,122,,,,,139,140,127,128,,,,,,,,,,,,,132,131,,118,136,134", "133,129,130,125,123,116,142,117,459,403,141,,460,,,,,,,,137,138,,135", "119,120,121,143,124,126,,,122,,,,,139,140,127,128,,,,,,,,,,,,,132,131", ",118,136,134,133,129,130,125,123,116,142,117,751,409,141,,794,,,,,,", ",137,138,,135,119,120,121,143,124,126,,,122,,,,,139,140,127,128,,,,", ",,,,,,,,132,131,,118,136,134,133,129,130,125,123,116,142,117,857,403", "141,,858,,,,,,,,137,138,,135,119,120,121,143,124,126,,,122,,,,,139,140", "127,128,,,,,,257,,,,,,,132,131,,118,136,134,133,129,130,125,123,116", "142,117,859,409,141,,860,,,,,,,,137,138,,135,119,120,121,143,124,126", ",,122,,,,,139,140,127,128,,,,,,,,,,,,,132,131,,118,136,134,133,129,130", "125,123,116,142,117,583,409,141,,584,,,,,,,,137,138,,135,119,120,121", "143,124,126,,,122,,,,,139,140,127,128,,,,,,,,,,,,,132,131,,118,136,134", "133,129,130,125,123,116,142,117,581,403,141,,582,,,,,,,,137,138,,135", "119,120,121,143,124,126,,,122,,,,,139,140,127,128,,,,,,257,,,,,,,132", "131,,118,136,134,133,129,130,125,123,116,142,117,459,403,141,,460,,", ",,,,,137,138,,135,119,120,121,143,124,126,,,122,,,,,139,140,127,128", ",,,,,,,,,,,,132,131,,118,136,134,133,129,130,125,123,116,142,117,405", "409,141,,407,,,,,,,,137,138,,135,119,120,121,143,124,126,,,122,,,,,139", "140,127,128,,,,,,,,,,,,,132,131,,118,136,134,133,129,130,125,123,116", "142,117,399,403,141,,400,,,,,,,,137,138,,135,119,120,121,143,124,126", ",,122,,,,,139,140,127,128,,,,,,257,,,,,,,132,131,,118,136,134,133,129", "130,125,123,116,142,117,459,403,141,,460,,,,,,,,137,138,,135,119,120", "121,143,124,126,,,122,,,,,139,140,127,128,,,,,,,,,,,,,132,131,,118,136", "134,133,129,130,125,123,116,142,117,624,409,141,,625,,,,,,,,137,138", ",135,119,120,121,143,124,126,,,122,,,,,139,140,127,128,,,,,,,,,,,,,132", "131,,118,136,134,133,129,130,125,123,116,142,117,621,403,141,,622,,", ",,,,,137,138,,135,119,120,121,143,124,126,,,122,,,,,139,140,127,128", ",,,,,257,,,,,,,132,131,,118,136,134,133,129,130,125,123,116,142,117", "751,409,141,,749,,,,,,,,137,138,,135,119,120,121,143,124,126,,,122,", ",,,139,140,127,128,,,,,,,,,,,,,132,131,,118,136,134,133,129,130,125", "123,116,142,117,581,403,141,,582,,,,,,,,137,138,,135,119,120,121,143", "124,126,,,122,,,,,139,140,127,128,,,,,,257,,,,,,,132,131,,118,136,134", "133,129,130,125,123,116,142,117,583,409,141,,584,,,,,,,,137,138,,135", "119,120,121,143,124,126,,,122,,,,,139,140,127,128,,,,,,,,,,,,,132,131", ",118,136,134,133,129,130,125,123,116,142,117,459,403,141,,460,,,,,,", ",137,138,,135,119,120,121,143,124,126,,,122,,,,,139,140,127,128,,,,", ",257,,,,,,,132,131,,118,136,134,133,129,130,125,123,116,142,117,,,141"];

      racc_action_table = arr = __Ruby.Object._scope.Array.$new(21316, nil);

      idx = 0;

      (__b = clist, __b.$each._p = (__a = function(str) {

        var __a, __b;
        if (str == null) str = nil;

        return (__b = str.$split(",", -1), __b.$each._p = (__a = function(i) {

          var __a;
          if (i == null) i = nil;

          if ((__a = i['$empty?']()) === false || __a === nil) {
            arr['$[]='](idx, i.$to_i())
          };
          return idx = idx['$+'](1);
        }, __a._s = this, __a), __b.$each())
      }, __a._s = Grammar, __a), __b.$each());

      clist = ["0,0,0,0,0,790,296,296,0,0,670,670,96,0,364,0,0,0,0,0,0,0,14,534,55,462", "0,0,0,0,0,0,0,280,539,0,630,630,546,546,581,0,0,0,0,0,0,0,0,0,0,0,0", "0,0,418,0,0,462,0,0,0,42,14,622,748,530,473,346,42,14,71,754,534,747", "346,364,754,330,71,534,0,858,529,0,534,329,0,581,630,829,618,0,296,26", "280,0,670,857,201,473,622,670,418,0,859,534,55,622,0,0,0,0,0,0,790,280", "790,0,0,790,42,450,450,450,546,450,0,618,527,450,450,534,0,0,450,539", "450,450,450,450,450,450,450,861,861,528,201,450,450,450,450,450,450", "450,539,26,15,15,582,539,748,359,748,450,359,748,450,450,450,450,450", "450,450,450,450,450,26,450,450,859,450,450,450,747,623,747,747,330,747", "330,704,858,330,858,203,329,858,329,426,829,329,829,450,472,829,450", "582,857,450,857,535,366,857,450,859,450,859,450,832,859,832,359,359", "557,527,450,527,448,626,527,450,450,450,450,450,450,472,342,704,450", "450,528,203,528,342,347,528,450,450,455,455,455,347,455,450,450,343", "455,455,334,448,334,455,343,455,455,455,455,455,455,455,366,366,366", "335,455,455,455,455,455,455,455,628,557,557,674,629,624,624,586,674", "455,557,837,455,455,455,455,455,455,455,455,455,455,357,455,455,523", "455,455,455,586,586,586,586,586,586,586,586,586,586,586,200,586,586", "624,669,586,586,200,455,669,624,455,361,631,455,327,837,837,837,837", "586,636,586,455,586,586,586,586,586,586,586,455,586,37,37,637,455,455", "455,455,455,455,357,357,357,455,455,639,586,471,471,471,355,471,455", "640,823,471,471,200,455,455,471,823,471,471,471,471,471,471,471,643", "361,361,361,471,471,471,471,471,471,471,824,826,471,722,35,621,3,824", "826,471,722,3,471,471,471,471,471,471,471,471,471,471,298,471,471,298", "471,471,471,749,355,355,355,823,645,299,749,13,299,348,274,749,621,25", "13,35,348,274,471,621,25,471,35,471,471,304,324,344,304,824,826,471", "722,471,344,275,277,846,485,307,307,471,275,277,846,485,471,471,471", "471,471,471,400,648,648,471,471,333,749,482,482,482,333,482,471,647", "13,482,482,274,471,471,482,614,482,482,482,482,482,482,482,301,328,328", "301,482,482,482,482,482,482,482,650,400,275,277,846,485,656,389,400", "482,763,658,482,482,482,482,482,482,482,482,482,482,316,482,482,313", "482,482,482,389,389,389,389,389,389,389,389,389,389,389,341,389,389", "289,312,389,389,341,482,311,289,482,283,283,482,763,763,763,763,482", "389,427,389,482,389,389,389,389,389,389,389,482,389,518,518,625,482", "482,482,482,482,482,625,611,336,482,482,625,389,606,389,537,302,482", "482,489,489,489,537,489,482,482,289,489,489,605,300,428,489,597,489", "489,489,489,489,489,489,675,676,677,679,489,489,489,489,489,489,489", "646,594,570,345,350,682,625,646,399,489,345,350,489,489,489,489,489", "489,489,489,489,489,537,489,489,592,489,489,489,494,494,494,494,494", "494,494,494,494,494,494,860,494,494,570,406,494,494,860,489,399,570", "489,860,108,489,286,399,108,108,646,494,291,494,489,494,494,494,494", "494,494,494,489,494,689,288,287,489,489,489,489,489,489,585,360,282", "489,489,279,494,490,490,490,425,490,489,278,286,490,490,860,489,489", "490,286,490,490,490,490,490,490,490,276,271,511,270,490,490,490,490", "490,490,490,661,425,707,708,711,425,425,661,714,490,515,715,490,490", "490,490,490,490,490,490,490,490,429,490,490,717,490,490,490,777,777", "777,777,777,777,777,777,777,777,777,865,777,777,269,720,777,777,865", "490,721,267,490,724,256,490,515,515,515,515,661,777,727,777,490,777", "777,777,777,777,777,777,490,777,728,498,716,490,490,490,490,490,490", "716,245,739,490,490,742,777,847,847,847,847,847,490,242,241,847,847", "865,490,490,847,205,847,847,847,847,847,847,847,204,497,751,752,847", "847,847,847,847,847,847,716,202,847,373,373,373,373,373,847,847,847", "847,847,847,847,847,847,847,847,847,847,847,424,847,847,398,847,847", "847,397,397,397,397,397,397,397,397,397,397,397,466,397,397,757,758", "397,397,466,847,759,496,847,486,424,847,481,774,424,424,847,397,775", "397,847,397,397,397,397,397,397,397,847,397,186,561,782,847,847,847", "847,847,847,733,783,620,847,847,466,397,491,491,491,78,491,847,77,793", "491,491,794,847,847,491,363,491,491,491,491,491,491,491,798,799,63,477", "491,491,491,491,491,491,491,5,5,5,5,5,733,733,733,733,491,804,476,491", "491,491,491,491,491,491,491,491,491,809,491,491,810,491,491,491,239", "239,239,239,239,239,239,239,239,239,239,811,239,239,474,813,239,239", "468,491,41,578,491,683,683,491,683,683,683,36,467,239,825,239,491,239", "239,239,239,239,239,239,491,239,34,568,573,491,491,491,491,491,491,20", "835,465,491,491,385,239,495,495,495,443,495,491,842,464,495,495,12,491", "491,495,11,495,495,495,495,495,495,495,10,9,851,853,495,495,495,495", "495,495,495,854,443,495,856,8,443,443,443,443,495,386,394,495,495,495", "495,495,495,495,495,495,495,1,495,495,392,495,495,495,19,19,19,19,19", "19,19,19,19,19,19,812,19,19,,,19,19,,495,,,495,,,495,,,,,,19,,19,495", "19,19,19,19,19,19,19,495,19,,,,495,495,495,495,495,495,,,,495,495,,19", "500,500,500,444,500,495,,,500,500,,495,495,500,,500,500,500,500,500", "500,500,,,,,500,500,500,500,500,500,500,,444,,,,444,444,444,444,500", ",,500,500,500,500,500,500,500,500,500,500,,500,500,,500,500,500,705", "705,705,705,705,705,705,705,705,705,705,,705,705,,,705,705,,500,,,500", ",,500,,,,,500,705,,705,500,705,705,705,705,705,705,705,500,705,,,,500", "500,500,500,500,500,,,,500,500,,705,503,503,503,,503,500,,,503,503,", "500,500,503,,503,503,503,503,503,503,503,,,,,503,503,503,503,503,503", "503,,,,,,,,,,503,,,503,503,503,503,503,503,503,503,503,503,,503,503", ",503,503,503,610,610,610,610,610,610,610,610,610,610,610,,610,610,,", "610,610,,503,,,503,,,503,,,,,,610,,610,503,610,610,610,610,610,610,610", "503,610,,,,503,503,503,503,503,503,,,,503,503,,610,,610,,,503,503,843", "843,843,,843,503,503,,843,843,,,,843,,843,843,843,843,843,843,843,,", ",,843,843,843,843,843,843,843,,,,,,,,,,843,,,843,843,843,843,843,843", "843,843,843,843,,843,843,,843,843,843,447,447,447,447,447,447,447,447", "447,447,447,,447,447,,,447,447,,843,,,843,,,843,,,,,843,447,,447,843", "447,447,447,447,447,447,447,843,447,,,,843,843,843,843,843,843,,,,843", "843,,447,447,,,,843,843,841,841,841,841,841,843,843,,841,841,,,,841", ",841,841,841,841,841,841,841,,,,,841,841,841,841,841,841,841,,,841,", ",,,,841,841,841,841,841,841,841,841,841,841,841,841,841,841,,841,841", ",841,841,841,412,412,412,412,412,412,412,412,412,412,412,,412,412,,", "412,412,,841,,,841,,,841,,,,,841,412,,412,841,412,412,412,412,412,412", "412,841,412,,,,841,841,841,841,841,841,,,,841,841,,412,17,17,17,,17", "841,,,17,17,,841,841,17,,17,17,17,17,17,17,17,,,,,17,17,17,17,17,17", "17,,,17,,,,,,,17,,,17,17,17,17,17,17,17,17,17,17,,17,17,,17,17,17,700", "700,700,700,700,700,700,700,700,700,700,,700,700,,,700,700,,17,,,17", ",,17,,,,,,700,,700,17,700,700,700,700,700,700,700,17,700,,,,17,17,17", "17,17,17,,,,17,17,,700,18,18,18,,18,17,,,18,18,,17,17,18,,18,18,18,18", "18,18,18,,,,,18,18,18,18,18,18,18,,,,,,,,,,18,,,18,18,18,18,18,18,18", "18,18,18,,18,18,,18,18,18,698,698,698,698,698,698,698,698,698,698,698", ",698,698,,,698,698,,18,,,18,,,18,,,,,,698,,698,18,698,698,698,698,698", "698,698,18,698,,,,18,18,18,18,18,18,,,,18,18,,698,509,509,509,509,509", "18,,,509,509,,18,18,509,,509,509,509,509,509,509,509,,,,,509,509,509", "509,509,509,509,,,509,,,,,,509,509,509,509,509,509,509,509,509,509,509", "509,509,509,,509,509,,509,509,509,695,695,695,695,695,695,695,695,695", "695,695,,695,695,,,695,695,,509,,,509,,,509,,,,,509,695,,695,509,695", "695,695,695,695,695,695,509,695,,,,509,509,509,509,509,509,,,,509,509", ",695,833,833,833,833,833,509,,,833,833,,509,509,833,,833,833,833,833", "833,833,833,,,,,833,833,833,833,833,833,833,,,833,,,,,,833,833,833,833", "833,833,833,833,833,833,833,833,833,833,,833,833,,833,833,833,693,693", "693,693,693,693,693,693,693,693,693,,693,693,,,693,693,,833,,,833,,", "833,,,,,833,693,,693,833,693,693,693,693,693,693,693,833,693,,,,833", "833,833,833,833,833,,,,833,833,,693,22,22,22,,22,833,,,22,22,,833,833", "22,,22,22,22,22,22,22,22,,,,,22,22,22,22,22,22,22,,,,,,,,,,22,,,22,22", "22,22,22,22,22,22,22,22,,22,22,,22,22,22,688,688,688,688,688,688,688", "688,688,688,688,,688,688,,,688,688,,22,,,22,,,22,,,,,22,688,22,688,22", "688,688,688,688,688,688,688,22,688,,,,22,22,22,22,22,22,,,,22,22,62", "688,62,62,62,62,22,22,23,23,23,,23,22,22,,23,23,,,,23,,23,23,23,23,23", "23,23,,,,,23,23,23,23,23,23,23,,,,,62,62,62,62,,23,,,23,23,23,23,23", "23,23,23,23,23,,23,23,,23,23,23,627,627,627,627,627,627,627,627,627", "627,627,,627,627,,,627,627,,23,,,23,,,23,,,,,23,627,23,627,23,627,627", "627,627,627,627,627,23,627,,,,23,23,23,23,23,23,,,,23,23,673,627,673", "673,673,673,23,23,24,24,24,,24,23,23,,24,24,,,,24,,24,24,24,24,24,24", "24,,,,,24,24,24,24,24,24,24,,,,,673,673,673,673,,24,,,24,24,24,24,24", "24,24,24,24,24,,24,24,,24,24,24,,,,,,,,,,,,,,513,,513,513,513,513,24", ",,24,,,24,,,,,24,,24,,24,,,,,,,,24,,,,,24,24,24,24,24,24,,,,24,24,513", "513,513,513,,,24,24,510,510,510,510,510,24,24,,510,510,,,,510,,510,510", "510,510,510,510,510,,,,,510,510,510,510,510,510,510,,,510,,,,,,510,510", "510,510,510,510,510,510,510,510,510,510,510,510,,510,510,,510,510,510", "433,433,433,433,433,433,433,,,433,433,,,,,,433,433,,510,,,510,,,510", ",,,,510,433,,433,510,433,433,433,433,433,433,433,510,433,,,,510,510", "510,510,510,510,,,,510,510,,,519,519,519,,519,510,,,519,519,,510,510", "519,,519,519,519,519,519,519,519,,,,,519,519,519,519,519,519,519,,,", ",,,,,,519,,,519,519,519,519,519,519,519,519,519,519,,519,519,,,,519", ",,,,,,,,,,,,,761,,761,761,761,761,519,,,519,,,519,,,27,589,,589,589", "589,589,27,27,27,,,27,27,27,,27,,,519,519,519,519,519,519,27,27,27,519", "519,761,761,761,761,,27,27,519,27,27,27,27,27,519,519,,589,589,589,589", ",,,,,,,589,,,,,,,27,27,27,27,27,27,27,27,27,27,27,27,27,27,,,27,27,27", ",,27,,27,27,,,,,27,,27,,27,,27,27,27,27,27,27,27,,27,27,27,,56,,56,56", "56,56,,,,,,27,27,27,27,,27,28,,,,,,27,28,28,28,,,28,28,28,542,28,542", "542,542,542,56,,,,,28,28,56,56,56,56,,,,28,28,,28,28,28,28,28,,308,", "308,308,308,308,,,,542,,,,,,,542,542,542,542,28,28,28,28,28,28,28,28", "28,28,28,28,28,28,,,28,28,28,308,,28,,28,28,308,308,308,308,28,,28,", "28,,28,28,28,28,28,28,28,,28,,28,,,,,,,,,,,,,28,28,28,28,,28,30,30,30", "30,30,,28,,30,30,,,,30,,30,30,30,30,30,30,30,,,,,30,30,30,30,30,30,30", ",,30,,,,,,30,30,30,30,30,30,30,30,30,30,30,30,30,30,,30,30,,30,30,30", "446,446,446,446,446,446,446,446,,446,446,,,,,,446,446,,30,,,30,,,30", ",,,,30,446,,446,30,446,446,446,446,446,446,446,30,446,,,,30,30,30,30", "30,30,,,,30,30,,,31,31,31,,31,30,,,31,31,,30,30,31,,31,31,31,31,31,31", "31,,,,,31,31,31,31,31,31,31,,,,,,,,,,31,,,31,31,31,31,31,31,31,31,31", "31,,31,31,437,,816,31,816,816,816,816,,,,,,,,,437,437,,,,,,31,,,31,", ",31,,437,,437,31,437,437,437,437,,816,437,,437,,,,816,816,816,816,31", "31,31,31,31,31,,,,31,31,,,32,32,32,,32,31,,,32,32,,31,31,32,,32,32,32", "32,32,32,32,,,,,32,32,32,32,32,32,32,,,,,,,,,,32,,,32,32,32,32,32,32", "32,32,32,32,,32,32,,,,32,445,445,445,445,445,445,445,,,445,445,,,,,", "445,445,,32,,,32,,,32,,,,,,445,,445,,445,445,445,445,445,445,445,,445", ",,,32,32,32,32,32,32,,,,32,32,,,522,522,522,522,522,32,,,522,522,,32", "32,522,,522,522,522,522,522,522,522,,,,,522,522,522,522,522,522,522", ",,522,,,,,,522,522,522,522,522,522,522,522,522,522,522,522,522,522,", "522,522,,522,522,522,438,438,438,438,438,438,438,,,438,438,,,,,,438", "438,,522,,,522,,,522,,,,,522,438,,438,522,438,438,438,438,438,438,438", "522,438,,,,522,522,522,522,522,522,,,,522,522,,,526,526,526,526,526", "522,,,526,526,,522,522,526,,526,526,526,526,526,526,526,,,,,526,526", "526,526,526,526,526,,,526,,,,,,526,526,526,526,526,526,526,526,526,526", "526,526,526,526,,526,526,,526,526,526,439,439,439,439,439,439,439,,", "439,439,,,,,,439,439,,526,,,526,,,526,,,,,526,439,,439,526,439,439,439", "439,439,439,439,526,439,,,,526,526,526,526,526,526,,,,526,526,,,531", "531,531,531,531,526,,,531,531,,526,526,531,,531,531,531,531,531,531", "531,,,,,531,531,531,531,531,531,531,,,531,,,,,,531,531,531,531,531,531", "531,531,531,531,531,531,531,531,,531,531,,531,531,531,440,440,440,440", "440,440,440,,,440,440,,,,,,440,440,,531,,,531,,,531,,,,,531,440,,440", "531,440,440,440,440,440,440,440,531,440,,,,531,531,531,531,531,531,", ",,531,531,,,822,822,822,822,822,531,,,822,822,,531,531,822,,822,822", "822,822,822,822,822,,,,,822,822,822,822,822,822,822,,,822,,,,,,822,822", "822,822,822,822,822,822,822,822,822,822,822,822,,822,822,,822,822,822", "441,441,441,441,441,441,441,,,441,441,,,,,,441,441,,822,,,822,,,822", ",,,,822,441,,441,822,441,441,441,441,441,441,441,822,441,,,,822,822", "822,822,822,822,,,,822,822,,,38,38,38,,38,822,,,38,38,,822,822,38,,38", "38,38,38,38,38,38,,,,,38,38,38,38,38,38,38,,,,,,,,,,38,,,38,38,38,38", "38,38,38,38,38,38,,38,38,,38,38,38,442,442,442,442,442,442,442,,,442", "442,,,,,,442,442,,38,,,38,,,38,,,,,,442,,442,38,442,442,442,442,442", "442,442,38,442,,,,38,38,38,38,38,38,,,,38,38,,,39,39,39,,39,38,,,39", "39,,38,38,39,,39,39,39,39,39,39,39,,,,,39,39,39,39,39,39,39,,,,,,,,", ",39,,,39,39,39,39,39,39,39,39,39,39,,39,39,,39,39,39,434,,,,,,,,,,,", ",,,,434,434,,39,,,39,,,39,,,,,,434,,434,39,434,434,434,434,,,434,39", "434,,,,39,39,39,39,39,39,,,,39,39,,,40,40,40,,40,39,,,40,40,,39,39,40", ",40,40,40,40,40,40,40,,,,,40,40,40,40,40,40,40,,,,,,,,,,40,,,40,40,40", "40,40,40,40,40,40,40,,40,40,,40,40,40,422,422,422,422,422,422,422,422", "422,422,422,,422,422,,,422,422,,40,,,40,,,40,,,,,,422,,422,40,422,422", "422,422,422,422,422,40,422,,,,40,40,40,40,40,40,,,,40,40,,,820,820,820", ",820,40,,,820,820,,40,40,820,,820,820,820,820,820,820,820,,,,,820,820", "820,820,820,820,820,,,,,,,,,,820,,,820,820,820,820,820,820,820,820,820", "820,,820,820,,820,820,820,423,423,423,423,423,423,423,423,423,423,423", ",423,423,,,423,423,,820,,,820,,,820,,,,,820,423,820,423,820,423,423", "423,423,423,423,423,820,423,,,,820,820,820,820,820,820,,,,820,820,,", "421,421,421,,421,820,,,421,421,,820,820,421,,421,421,421,421,421,421", "421,,,,,421,421,421,421,421,421,421,,,,,,,,,,421,,,421,421,421,421,421", "421,421,421,421,421,,421,421,,421,421,421,435,,,,,,,,,,,,,,,,435,435", ",421,,,421,,,421,,,,,,435,,435,421,435,435,435,435,,,435,421,435,,,", "421,421,421,421,421,421,,50,,421,421,,,,50,50,50,,421,50,50,50,436,50", "421,421,,,,,,50,,50,50,,,,436,436,,,50,50,,50,50,50,50,50,,,,436,,436", ",436,436,436,436,,,436,,436,,,,,,50,50,50,50,50,50,50,50,50,50,50,50", "50,50,,,50,50,50,,,50,,,50,,,50,,50,,50,,50,,50,50,50,50,50,50,50,,50", ",50,,,,,,,,,,,,,50,50,50,50,,50,,,50,50,,,50,52,52,52,,52,,,,52,52,", ",,52,,52,52,52,52,52,52,52,,,,,52,52,52,52,52,52,52,,,52,,,,,,,52,,", "52,52,52,52,52,52,52,52,52,52,430,52,52,,52,52,52,,432,,,,,,,,430,430", ",,,,,,432,432,52,,,52,,430,52,430,,430,430,430,430,432,,52,,432,432", "432,432,,,52,,,,,52,52,52,52,52,52,,,,52,52,,,53,53,53,,53,52,,,53,53", ",52,52,53,,53,53,53,53,53,53,53,,,,,53,53,53,53,53,53,53,,,,,,,,,,53", ",,53,53,53,53,53,53,53,53,53,53,,53,53,,53,53,53,431,,,,,,,,,,,,,,,", "431,431,,53,,,53,,,53,,,,,53,431,,431,53,431,431,431,431,,,,53,,,,,53", "53,53,53,53,53,,,,53,53,,,,,,,53,53,54,54,54,,54,53,53,,54,54,,,,54", ",54,54,54,54,54,54,54,,,,,54,54,54,54,54,54,54,,,,,,,,,,54,,,54,54,54", "54,54,54,54,54,54,54,,54,54,,54,54,54,,,,,,,,,,,,,,,,,,,,54,,,54,,,54", ",,,,54,,,,54,,,,,,,,54,,,,,54,54,54,54,54,54,,,,54,54,,,,,,,54,54,420", "420,420,,420,54,54,,420,420,,,,420,,420,420,420,420,420,420,420,,,,", "420,420,420,420,420,420,420,,,,,,,,,,420,,,420,420,420,420,420,420,420", "420,420,420,,420,420,,420,420,420,,,,,,,,,,,,,,,,,,,,420,,,420,,,420", ",,,,,,,,420,,,,,,,,420,,,,,420,420,420,420,420,420,,,,420,420,,,806", "806,806,806,806,420,,,806,806,,420,420,806,,806,806,806,806,806,806", "806,,,,,806,806,806,806,806,806,806,,,806,,,,,,806,806,806,806,806,806", "806,806,806,806,806,806,806,806,,806,806,,806,806,806,,,,,,,,,,,,,,", ",,,,,806,,,806,,,806,,,,,806,,,,806,,,,,,,,806,,,,,806,806,806,806,806", "806,,,,806,806,,,57,57,57,,57,806,,,57,57,,806,806,57,,57,57,57,57,57", "57,57,,,,,57,57,57,57,57,57,57,,,57,,,,,,,57,,,57,57,57,57,57,57,57", "57,57,57,,57,57,,57,57,57,,,,,,,,,,,,,,,,,,,,57,,,57,,,57,,,,,,,,,57", ",,,,,,,57,,,,,57,57,57,57,57,57,,,,57,57,,,58,58,58,,58,57,,,58,58,", "57,57,58,,58,58,58,58,58,58,58,,,,,58,58,58,58,58,58,58,,,58,,,,,,,58", ",,58,58,58,58,58,58,58,58,58,58,,58,58,,58,58,58,,,,,,,,,,,,,,,,,,,", "58,,,58,,,58,,,,,,,,,58,,,,,,,,58,,,,,58,58,58,58,58,58,,,,58,58,,,61", "61,61,,61,58,,,61,61,,58,58,61,,61,61,61,61,61,61,61,,,,,61,61,61,61", "61,61,61,,,61,,,,,,,61,,,61,61,61,61,61,61,61,61,61,61,,61,61,,61,61", "61,,,,,,,,,,,,,,,,,,,,61,,,61,,,61,,,,,,,,,61,,,,,,,,61,,,,,61,61,61", "61,61,61,,,,61,61,61,,,,,61,,61,801,801,801,801,801,61,61,,801,801,", ",,801,,801,801,801,801,801,801,801,,,,,801,801,801,801,801,801,801,", ",801,,,,,,801,801,801,801,801,801,801,801,801,801,801,801,801,801,,801", "801,,801,801,801,,,,,,,,,,,,,,,,,,,,801,,,801,,,801,,,,,801,,,,801,", ",,,,,,801,,,,,801,801,801,801,801,801,,,,801,801,,,800,800,800,,800", "801,,,800,800,,801,801,800,,800,800,800,800,800,800,800,,,,,800,800", "800,800,800,800,800,,,,,,,,,,800,,,800,800,800,800,800,800,800,800,800", "800,,800,800,,800,800,800,,,,,,,,,,,,,,,,,,,,800,,,800,,,800,,,,,800", ",,,800,,,,,,,,800,,,,,800,800,800,800,800,800,,,,800,800,,,419,419,419", ",419,800,,,419,419,,800,800,419,,419,419,419,419,419,419,419,,,,,419", "419,419,419,419,419,419,,,,,,,,,,419,,,419,419,419,419,419,419,419,419", "419,419,,419,419,,419,419,419,,,,,,,,,,,,,,,,,,,,419,,,419,,,419,,,", ",,,,,419,,,,,,,,419,,,,,419,419,419,419,419,419,,,,419,419,,,796,796", "796,,796,419,,,796,796,,419,419,796,,796,796,796,796,796,796,796,,,", ",796,796,796,796,796,796,796,,,796,,,,,,,796,,,796,796,796,796,796,796", "796,796,796,796,,796,796,,796,796,796,,,,,,,,,,,,,,,,,,,,796,,,796,", ",796,,,,,,,,,796,,,,,,,,796,,,,,796,796,796,796,796,796,,,,796,796,", ",791,791,791,,791,796,,,791,791,,796,796,791,,791,791,791,791,791,791", "791,,,,,791,791,791,791,791,791,791,,,,,,,,,,791,,,791,791,791,791,791", "791,791,791,791,791,,791,791,,,,791,,,,,,,,,,,,,,,,,,,,791,,,791,,,791", ",,,,,,,,,,,,,,,,,,,,,791,791,791,791,791,791,,,,791,791,,,417,417,417", ",417,791,,,417,417,,791,791,417,,417,417,417,417,417,417,417,,,,,417", "417,417,417,417,417,417,,,,,,,,,,417,,,417,417,417,417,417,417,417,417", "417,417,,417,417,,417,417,417,,,,,,,,,,,,,,,,,,,,417,,,417,,,417,,,", ",417,,,,417,,,,,,,,417,,,,,417,417,417,417,417,417,,,,417,417,,,,,,", "417,417,410,410,410,,410,417,417,,410,410,,,,410,,410,410,410,410,410", "410,410,,,,,410,410,410,410,410,410,410,,,,,,,,,,410,,,410,410,410,410", "410,410,410,410,410,410,,410,410,,410,410,410,,,,,,,,,,,,,,,,,,,,410", ",,410,410,,410,,,,,410,,410,,410,,,,,,,,410,,,,,410,410,410,410,410", "410,,,,410,410,,,,,,,410,410,83,83,83,,83,410,410,,83,83,,,,83,,83,83", "83,83,83,83,83,,83,,,83,83,83,83,83,83,83,,,,,,,,,,83,,,83,83,83,83", "83,83,83,83,83,83,,83,83,,83,83,83,,,,,,,,,,,,,,,,,,,,83,,,83,83,,83", ",,,,83,,83,,83,,,,,,,,83,,83,,,83,83,83,83,83,83,,,,83,83,,,,,,,83,83", "86,86,86,,86,83,83,,86,86,,,,86,,86,86,86,86,86,86,86,,86,,,86,86,86", "86,86,86,86,,,,,,,,,,86,,,86,86,86,86,86,86,86,86,86,86,,86,86,,86,86", "86,,,,,,,,,,,,,,,,,,,,86,,,86,86,,86,,,,,86,,86,,86,,,,,,,,86,,86,,", "86,86,86,86,86,86,,,,86,86,,,,,,,86,86,787,787,787,787,787,86,86,,787", "787,,,,787,,787,787,787,787,787,787,787,,,,,787,787,787,787,787,787", "787,,,787,,,,,,787,787,787,787,787,787,787,787,787,787,787,787,787,787", ",787,787,,787,787,787,,,,,,,,,,,,,,,,,,,,787,,,787,,,787,,,,,787,,,", "787,,,,,,,,787,,,,,787,787,787,787,787,787,,,,787,787,,,98,98,98,98", "98,787,,,98,98,,787,787,98,,98,98,98,98,98,98,98,,,,,98,98,98,98,98", "98,98,,,98,,,,,,98,98,98,98,98,98,98,98,98,98,98,98,98,98,,98,98,,98", "98,98,,,,,,,,,,,,,,,,,,,,98,,,98,,,98,,,,,98,,,,98,,,,,,,,98,,,,,98", "98,98,98,98,98,,,,98,98,,,102,102,102,98,102,98,,,102,102,,98,98,102", ",102,102,102,102,102,102,102,,,,,102,102,102,102,102,102,102,,,102,", ",,,,,102,,,102,102,102,102,102,102,102,102,102,102,,102,102,,102,102", "102,,,,,,,,,,,,,,,,,,,,102,,,102,,,102,,,,,,,,,102,,,,,,,,102,,,,,102", "102,102,102,102,102,,,,102,102,,,103,103,103,,103,102,,,103,103,,102", "102,103,,103,103,103,103,103,103,103,,,,,103,103,103,103,103,103,103", ",,103,,,,,,,103,,,103,103,103,103,103,103,103,103,103,103,,103,103,", "103,103,103,,,,,,,,,,,,,,,,,,,,103,,,103,,,103,,,,,,,,,103,,,,,,,,103", ",,,,103,103,103,103,103,103,,,,103,103,,,104,104,104,,104,103,,,104", "104,,103,103,104,,104,104,104,104,104,104,104,,,,,104,104,104,104,104", "104,104,,,104,,,,,,,104,,,104,104,104,104,104,104,104,104,104,104,,104", "104,,104,104,104,,,,,,,,,,,,,,,,,,,,104,,,104,,,104,,,,,,,,,104,,,,", ",,,104,,,,,104,104,104,104,104,104,,,,104,104,,,105,105,105,,105,104", ",,105,105,,104,104,105,,105,105,105,105,105,105,105,,,,,105,105,105", "105,105,105,105,,,105,,,,,,,105,,,105,105,105,105,105,105,105,105,105", "105,,105,105,,105,105,105,,,,,,,,,,,,,,,,,,,,105,,,105,,,105,,,,,,,", ",105,,,,,,,,105,,,,,105,105,105,105,105,105,,,,105,105,,,106,106,106", "106,106,105,,,106,106,,105,105,106,,106,106,106,106,106,106,106,,,,", "106,106,106,106,106,106,106,,,106,,,,,,106,106,106,106,106,106,106,106", "106,106,106,106,106,106,,106,106,,106,106,106,,,,,,,,,,,,,,,,,,,,106", ",,106,,,106,,,,,106,,,,106,,,,,,,,106,,,,,106,106,106,106,106,106,,", ",106,106,,,778,778,778,,778,106,,,778,778,,106,106,778,,778,778,778", "778,778,778,778,,,,,778,778,778,778,778,778,778,,,,,,,,,,778,,,778,778", "778,778,778,778,778,778,778,778,,778,778,,778,778,778,,,,,,,,,,,,,,", ",,,,,778,,,778,,,778,,,,,,,,,778,,,,,,,,778,,,,,778,778,778,778,778", "778,,,,778,778,,,409,409,409,,409,778,,,409,409,,778,778,409,,409,409", "409,409,409,409,409,,,,,409,409,409,409,409,409,409,,,,,,,,,,409,,,409", "409,409,409,409,409,409,409,409,409,,409,409,,409,409,409,,,,,,,,,,", ",,,,,,,,,409,,,409,409,,409,,,,,409,,409,,409,,,,,,,,409,,,,407,409", "409,409,409,409,409,407,407,407,409,409,,407,407,,407,,409,409,,,,,", "409,409,,,,,,,,,407,407,,407,407,407,407,407,,,,,,,,,,,,,,,,,,,,,,407", "407,407,407,407,407,407,407,407,407,407,407,407,407,,,407,407,407,,407", ",,,407,,,,,,,407,,407,,407,407,407,407,407,407,407,,407,,407,,,,,,,", ",,,,,407,407,,407,,407,,,,,407,,407,188,188,188,188,188,,,,188,188,", ",,188,,188,188,188,188,188,188,188,,,,,188,188,188,188,188,188,188,", ",188,,,,,,188,188,188,188,188,188,188,188,188,188,188,188,188,188,,188", "188,,188,188,188,,,,,,,,,,,,,,,,,,,,188,,,188,,,188,,,,,188,,,,188,", ",,,,,,188,,,,,188,188,188,188,188,188,,,,188,188,,,189,189,189,189,189", "188,,,189,189,,188,188,189,,189,189,189,189,189,189,189,,,,,189,189", "189,189,189,189,189,,,189,,,,,,189,189,189,189,189,189,189,189,189,189", "189,189,189,189,,189,189,,189,189,189,,,,,,,,,,,,,,,,,,,,189,,,189,", ",189,,,,,189,,,,189,,,,,,,,189,,,,,189,189,189,189,189,189,,,,189,189", ",,190,190,190,,190,189,,,190,190,,189,189,190,,190,190,190,190,190,190", "190,,,,,190,190,190,190,190,190,190,,,,,,,,,,190,,,190,190,190,190,190", "190,190,190,190,190,,190,190,,190,190,190,,,,,,,,,,,,,,,,,,,,190,,,190", ",,190,,,,,190,,,,190,,,,,,,,190,,,,,190,190,190,190,190,190,,,,190,190", ",,191,191,191,,191,190,,,191,191,,190,190,191,,191,191,191,191,191,191", "191,,,,,191,191,191,191,191,191,191,,,,,,,,,,191,,,191,191,191,191,191", "191,191,191,191,191,,191,191,,191,191,191,,,,,,,,,,,,,,,,,,,,191,,,191", ",,191,,,,,191,,,,191,,,,,,,,191,,,,,191,191,191,191,191,191,,,,191,191", ",,192,192,192,,192,191,,,192,192,,191,191,192,,192,192,192,192,192,192", "192,,,,,192,192,192,192,192,192,192,,,,,,,,,,192,,,192,192,192,192,192", "192,192,192,192,192,,192,192,,192,192,192,,,,,,,,,,,,,,,,,,,,192,,,192", ",,192,,,,,,,,,192,,,,,,,,192,,,,,192,192,192,192,192,192,,,,192,192", ",,193,193,193,,193,192,,,193,193,,192,192,193,,193,193,193,193,193,193", "193,,,,,193,193,193,193,193,193,193,,,,,,,,,,193,,,193,193,193,193,193", "193,193,193,193,193,,193,193,,193,193,193,,,,,,,,,,,,,,,,,,,,193,,,193", ",,193,,,,,193,,,,193,,,,,,,,193,,,,,193,193,193,193,193,193,405,,,193", "193,,,405,405,405,,193,193,405,405,,405,,193,193,,,,,,405,,,,,,,,,,405", "405,,405,405,405,405,405,,,,,,,,,,,,,,,,,,,,,,405,405,405,405,405,405", "405,405,405,405,405,405,405,405,,,405,405,405,,405,,,,405,,,,,,,405", ",405,,405,405,405,405,405,405,405,,405,405,405,,,,,,,,,,,,,405,405,", "405,,405,401,,,,405,,405,401,401,401,,,401,401,401,,401,,,,,,,,,401", "401,401,,,,,,,,401,401,,401,401,401,401,401,,,,,,,,,,,,,,,,,,,,,,401", "401,401,401,401,401,401,401,401,401,401,401,401,401,,,401,401,401,,", "401,,401,401,,,,,401,,401,,401,,401,401,401,401,401,401,401,,401,401", "401,,,,,,,,,,,,,401,401,401,401,,401,196,196,196,,196,,401,,196,196", ",,,196,,196,196,196,196,196,196,196,,,,,196,196,196,196,196,196,196", ",,,,,,,,,196,,,196,196,196,196,196,196,196,196,196,196,,196,196,,196", "196,196,,,,,,,,,,,,,,,,,,,,196,,,196,,,196,,,,,,,,,196,,,,,,,,196,,", ",,196,196,196,196,196,196,,,,196,196,,,197,197,197,,197,196,,,197,197", ",196,196,197,,197,197,197,197,197,197,197,,,,,197,197,197,197,197,197", "197,,,197,,,,,,,197,,,197,197,197,197,197,197,197,197,197,197,,197,197", ",197,197,197,,,,,,,,,,,,,,,,,,,,197,,,197,,,197,,,,,,,,,197,,,,,,,,197", ",,,,197,197,197,197,197,197,,,,197,197,,,198,198,198,,198,197,,,198", "198,,197,197,198,,198,198,198,198,198,198,198,,,,,198,198,198,198,198", "198,198,,,198,,,,,,,198,,,198,198,198,198,198,198,198,198,198,198,,198", "198,,198,198,198,,,,,,,,,,,,,,,,,,,,198,,,198,,,198,,,,,,,,,198,,,,", ",,,198,,,,,198,198,198,198,198,198,,,,198,198,,,540,540,540,,540,198", ",,540,540,,198,198,540,,540,540,540,540,540,540,540,,,,,540,540,540", "540,540,540,540,,,540,,,,,,,540,,,540,540,540,540,540,540,540,540,540", "540,,540,540,,540,540,540,,,,,,,,,,,,,,,,,,,,540,,,540,,,540,,,,,,,", ",540,,,,,,,,540,,,,,540,540,540,540,540,540,,,,540,540,,,766,766,766", ",766,540,,,766,766,,540,540,766,,766,766,766,766,766,766,766,,,,,766", "766,766,766,766,766,766,,,,,,,,,,766,,,766,766,766,766,766,766,766,766", "766,766,,766,766,,766,766,766,,,,,,,,,,,,,,,,,,,,766,,,766,,,766,,,", ",,,,,766,,,,,,,,766,,,,,766,766,766,766,766,766,,,,766,766,,,753,753", "753,753,753,766,,,753,753,,766,766,753,,753,753,753,753,753,753,753", ",,,,753,753,753,753,753,753,753,,,753,,,,,,753,753,753,753,753,753,753", "753,753,753,753,753,753,753,,753,753,,753,753,753,,,,,,,,,,,,,,,,,,", ",753,,,753,,,753,,,,,753,,,,753,,,,,,,,753,,,,,753,753,753,753,753,753", ",,,753,753,,,567,567,567,,567,753,,,567,567,,753,753,567,,567,567,567", "567,567,567,567,,,,,567,567,567,567,567,567,567,,,,,,,,,,567,,,567,567", "567,567,567,567,567,567,567,567,,567,567,,567,567,567,,,,,,,,,,,,,,", ",,,,,567,,,567,,,567,,,,,,,,,567,,,,,,,,567,,,,,567,567,567,567,567", "567,,,,567,567,,,569,569,569,,569,567,,,569,569,,567,567,569,,569,569", "569,569,569,569,569,,,,,569,569,569,569,569,569,569,,,,,,,,,,569,,,569", "569,569,569,569,569,569,569,569,569,,569,569,,569,569,569,,,,,,,,,,", ",,,,,,,,,569,,,569,,,569,,,,,569,,,,569,,,,,,,,569,,,,,569,569,569,569", "569,569,,,,569,569,,,391,391,391,,391,569,,,391,391,,569,569,391,,391", "391,391,391,391,391,391,,,,,391,391,391,391,391,391,391,,,,,,,,,,391", ",,391,391,391,391,391,391,391,391,391,391,,391,391,,391,391,391,,,,", ",,,,,,,,,,,,,,,391,,,391,,,391,,,,,,,,,391,,,,,,,,391,,,,,391,391,391", "391,391,391,,,,391,391,,,206,206,206,206,206,391,,,206,206,,391,391", "206,,206,206,206,206,206,206,206,,,,,206,206,206,206,206,206,206,,,206", ",,,,,206,206,206,206,206,206,206,206,206,206,206,206,206,206,,206,206", ",206,206,206,,,,,,,,,,,,,,,,,,,,206,,,206,,,206,,,,,206,,,,206,,,,,", ",,206,,,,,206,206,206,206,206,206,,,,206,206,,,209,209,209,,209,206", ",,209,209,,206,206,209,,209,209,209,209,209,209,209,,,,,209,209,209", "209,209,209,209,,,,,,,,,,209,,,209,209,209,209,209,209,209,209,209,209", ",209,209,,209,209,209,,,,,,,,,,,,,,,,,,,,209,,,209,,,209,,,,,,,,,209", ",,,,,,,209,,,,,209,209,209,209,209,209,,,,209,209,,,210,210,210,,210", "209,,,210,210,,209,209,210,,210,210,210,210,210,210,210,,,,,210,210", "210,210,210,210,210,,,,,,,,,,210,,,210,210,210,210,210,210,210,210,210", "210,,210,210,,210,210,210,,,,,,,,,,,,,,,,,,,,210,,,210,,,210,,,,,,,", ",210,,,,,,,,210,,,,,210,210,210,210,210,210,,,,210,210,,,211,211,211", ",211,210,,,211,211,,210,210,211,,211,211,211,211,211,211,211,,,,,211", "211,211,211,211,211,211,,,,,,,,,,211,,,211,211,211,211,211,211,211,211", "211,211,,211,211,,211,211,211,,,,,,,,,,,,,,,,,,,,211,,,211,,,211,,,", ",,,,,211,,,,,,,,211,,,,,211,211,211,211,211,211,,,,211,211,,,212,212", "212,,212,211,,,212,212,,211,211,212,,212,212,212,212,212,212,212,,,", ",212,212,212,212,212,212,212,,,,,,,,,,212,,,212,212,212,212,212,212", "212,212,212,212,,212,212,,212,212,212,,,,,,,,,,,,,,,,,,,,212,,,212,", ",212,,,,,,,,,212,,,,,,,,212,,,,,212,212,212,212,212,212,,,,212,212,", ",213,213,213,,213,212,,,213,213,,212,212,213,,213,213,213,213,213,213", "213,,,,,213,213,213,213,213,213,213,,,,,,,,,,213,,,213,213,213,213,213", "213,213,213,213,213,,213,213,,213,213,213,,,,,,,,,,,,,,,,,,,,213,,,213", ",,213,,,,,,,,,213,,,,,,,,213,,,,,213,213,213,213,213,213,,,,213,213", ",,214,214,214,,214,213,,,214,214,,213,213,214,,214,214,214,214,214,214", "214,,,,,214,214,214,214,214,214,214,,,,,,,,,,214,,,214,214,214,214,214", "214,214,214,214,214,,214,214,,214,214,214,,,,,,,,,,,,,,,,,,,,214,,,214", ",,214,,,,,,,,,214,,,,,,,,214,,,,,214,214,214,214,214,214,,,,214,214", ",,215,215,215,,215,214,,,215,215,,214,214,215,,215,215,215,215,215,215", "215,,,,,215,215,215,215,215,215,215,,,,,,,,,,215,,,215,215,215,215,215", "215,215,215,215,215,,215,215,,215,215,215,,,,,,,,,,,,,,,,,,,,215,,,215", ",,215,,,,,,,,,215,,,,,,,,215,,,,,215,215,215,215,215,215,,,,215,215", ",,216,216,216,,216,215,,,216,216,,215,215,216,,216,216,216,216,216,216", "216,,,,,216,216,216,216,216,216,216,,,,,,,,,,216,,,216,216,216,216,216", "216,216,216,216,216,,216,216,,216,216,216,,,,,,,,,,,,,,,,,,,,216,,,216", ",,216,,,,,,,,,216,,,,,,,,216,,,,,216,216,216,216,216,216,,,,216,216", ",,217,217,217,,217,216,,,217,217,,216,216,217,,217,217,217,217,217,217", "217,,,,,217,217,217,217,217,217,217,,,,,,,,,,217,,,217,217,217,217,217", "217,217,217,217,217,,217,217,,217,217,217,,,,,,,,,,,,,,,,,,,,217,,,217", ",,217,,,,,,,,,217,,,,,,,,217,,,,,217,217,217,217,217,217,,,,217,217", ",,218,218,218,,218,217,,,218,218,,217,217,218,,218,218,218,218,218,218", "218,,,,,218,218,218,218,218,218,218,,,,,,,,,,218,,,218,218,218,218,218", "218,218,218,218,218,,218,218,,218,218,218,,,,,,,,,,,,,,,,,,,,218,,,218", ",,218,,,,,,,,,218,,,,,,,,218,,,,,218,218,218,218,218,218,,,,218,218", ",,219,219,219,,219,218,,,219,219,,218,218,219,,219,219,219,219,219,219", "219,,,,,219,219,219,219,219,219,219,,,,,,,,,,219,,,219,219,219,219,219", "219,219,219,219,219,,219,219,,219,219,219,,,,,,,,,,,,,,,,,,,,219,,,219", ",,219,,,,,,,,,219,,,,,,,,219,,,,,219,219,219,219,219,219,,,,219,219", ",,220,220,220,,220,219,,,220,220,,219,219,220,,220,220,220,220,220,220", "220,,,,,220,220,220,220,220,220,220,,,,,,,,,,220,,,220,220,220,220,220", "220,220,220,220,220,,220,220,,220,220,220,,,,,,,,,,,,,,,,,,,,220,,,220", ",,220,,,,,,,,,220,,,,,,,,220,,,,,220,220,220,220,220,220,,,,220,220", ",,221,221,221,,221,220,,,221,221,,220,220,221,,221,221,221,221,221,221", "221,,,,,221,221,221,221,221,221,221,,,,,,,,,,221,,,221,221,221,221,221", "221,221,221,221,221,,221,221,,221,221,221,,,,,,,,,,,,,,,,,,,,221,,,221", ",,221,,,,,,,,,221,,,,,,,,221,,,,,221,221,221,221,221,221,,,,221,221", ",,222,222,222,,222,221,,,222,222,,221,221,222,,222,222,222,222,222,222", "222,,,,,222,222,222,222,222,222,222,,,,,,,,,,222,,,222,222,222,222,222", "222,222,222,222,222,,222,222,,222,222,222,,,,,,,,,,,,,,,,,,,,222,,,222", ",,222,,,,,,,,,222,,,,,,,,222,,,,,222,222,222,222,222,222,,,,222,222", ",,223,223,223,,223,222,,,223,223,,222,222,223,,223,223,223,223,223,223", "223,,,,,223,223,223,223,223,223,223,,,,,,,,,,223,,,223,223,223,223,223", "223,223,223,223,223,,223,223,,223,223,223,,,,,,,,,,,,,,,,,,,,223,,,223", ",,223,,,,,,,,,223,,,,,,,,223,,,,,223,223,223,223,223,223,,,,223,223", ",,224,224,224,,224,223,,,224,224,,223,223,224,,224,224,224,224,224,224", "224,,,,,224,224,224,224,224,224,224,,,,,,,,,,224,,,224,224,224,224,224", "224,224,224,224,224,,224,224,,224,224,224,,,,,,,,,,,,,,,,,,,,224,,,224", ",,224,,,,,,,,,224,,,,,,,,224,,,,,224,224,224,224,224,224,,,,224,224", ",,225,225,225,,225,224,,,225,225,,224,224,225,,225,225,225,225,225,225", "225,,,,,225,225,225,225,225,225,225,,,,,,,,,,225,,,225,225,225,225,225", "225,225,225,225,225,,225,225,,225,225,225,,,,,,,,,,,,,,,,,,,,225,,,225", ",,225,,,,,,,,,225,,,,,,,,225,,,,,225,225,225,225,225,225,,,,225,225", ",,226,226,226,,226,225,,,226,226,,225,225,226,,226,226,226,226,226,226", "226,,,,,226,226,226,226,226,226,226,,,,,,,,,,226,,,226,226,226,226,226", "226,226,226,226,226,,226,226,,226,226,226,,,,,,,,,,,,,,,,,,,,226,,,226", ",,226,,,,,,,,,226,,,,,,,,226,,,,,226,226,226,226,226,226,,,,226,226", ",,227,227,227,,227,226,,,227,227,,226,226,227,,227,227,227,227,227,227", "227,,,,,227,227,227,227,227,227,227,,,,,,,,,,227,,,227,227,227,227,227", "227,227,227,227,227,,227,227,,227,227,227,,,,,,,,,,,,,,,,,,,,227,,,227", ",,227,,,,,,,,,227,,,,,,,,227,,,,,227,227,227,227,227,227,,,,227,227", ",,228,228,228,,228,227,,,228,228,,227,227,228,,228,228,228,228,228,228", "228,,,,,228,228,228,228,228,228,228,,,,,,,,,,228,,,228,228,228,228,228", "228,228,228,228,228,,228,228,,228,228,228,,,,,,,,,,,,,,,,,,,,228,,,228", ",,228,,,,,,,,,228,,,,,,,,228,,,,,228,228,228,228,228,228,,,,228,228", ",,229,229,229,,229,228,,,229,229,,228,228,229,,229,229,229,229,229,229", "229,,,,,229,229,229,229,229,229,229,,,,,,,,,,229,,,229,229,229,229,229", "229,229,229,229,229,,229,229,,229,229,229,,,,,,,,,,,,,,,,,,,,229,,,229", ",,229,,,,,,,,,229,,,,,,,,229,,,,,229,229,229,229,229,229,,,,229,229", ",,230,230,230,,230,229,,,230,230,,229,229,230,,230,230,230,230,230,230", "230,,,,,230,230,230,230,230,230,230,,,,,,,,,,230,,,230,230,230,230,230", "230,230,230,230,230,,230,230,,230,230,230,,,,,,,,,,,,,,,,,,,,230,,,230", ",,230,,,,,,,,,230,,,,,,,,230,,,,,230,230,230,230,230,230,,,,230,230", ",,231,231,231,,231,230,,,231,231,,230,230,231,,231,231,231,231,231,231", "231,,,,,231,231,231,231,231,231,231,,,,,,,,,,231,,,231,231,231,231,231", "231,231,231,231,231,,231,231,,231,231,231,,,,,,,,,,,,,,,,,,,,231,,,231", ",,231,,,,,,,,,231,,,,,,,,231,,,,,231,231,231,231,231,231,,,,231,231", ",,232,232,232,,232,231,,,232,232,,231,231,232,,232,232,232,232,232,232", "232,,,,,232,232,232,232,232,232,232,,,,,,,,,,232,,,232,232,232,232,232", "232,232,232,232,232,,232,232,,232,232,232,,,,,,,,,,,,,,,,,,,,232,,,232", ",,232,,,,,,,,,232,,,,,,,,232,,,,,232,232,232,232,232,232,,,,232,232", ",,233,233,233,,233,232,,,233,233,,232,232,233,,233,233,233,233,233,233", "233,,,,,233,233,233,233,233,233,233,,,,,,,,,,233,,,233,233,233,233,233", "233,233,233,233,233,,233,233,,233,233,233,,,,,,,,,,,,,,,,,,,,233,,,233", ",,233,,,,,,,,,233,,,,,,,,233,,,,,233,233,233,233,233,233,,,,233,233", ",,234,234,234,,234,233,,,234,234,,233,233,234,,234,234,234,234,234,234", "234,,,,,234,234,234,234,234,234,234,,,,,,,,,,234,,,234,234,234,234,234", "234,234,234,234,234,,234,234,,234,234,234,,,,,,,,,,,,,,,,,,,,234,,,234", ",,234,,,,,,,,,234,,,,,,,,234,,,,,234,234,234,234,234,234,,,,234,234", ",,235,235,235,,235,234,,,235,235,,234,234,235,,235,235,235,235,235,235", "235,,,,,235,235,235,235,235,235,235,,,,,,,,,,235,,,235,235,235,235,235", "235,235,235,235,235,,235,235,,235,235,235,,,,,,,,,,,,,,,,,,,,235,,,235", ",,235,,,,,,,,,235,,,,,,,,235,,,,,235,235,235,235,235,235,,,,235,235", ",,571,571,571,,571,235,,,571,571,,235,235,571,,571,571,571,571,571,571", "571,,,,,571,571,571,571,571,571,571,,,,,,,,,,571,,,571,571,571,571,571", "571,571,571,571,571,,571,571,,571,571,571,,,,,,,,,,,,,,,,,,,,571,,,571", ",,571,,,,,,,,,571,,,,,,,,571,,,,,571,571,571,571,571,571,,,,571,571", ",,744,744,744,744,744,571,,,744,744,,571,571,744,,744,744,744,744,744", "744,744,,,,,744,744,744,744,744,744,744,,,744,,,,,,744,744,744,744,744", "744,744,744,744,744,744,744,744,744,,744,744,,744,744,744,,,,,,,,,,", ",,,,,,,,,744,,,744,,,744,,,,,744,,,,744,,,,,,,,744,,,,,744,744,744,744", "744,744,,,,744,744,,,743,743,743,743,743,744,,,743,743,,744,744,743", ",743,743,743,743,743,743,743,,,,,743,743,743,743,743,743,743,,,743,", ",,,,743,743,743,743,743,743,743,743,743,743,743,743,743,743,,743,743", ",743,743,743,,,,,,,,,,,,,,,,,,,,743,,,743,,,743,,,,,743,,,,743,,,,,", ",,743,,,,,743,743,743,743,743,743,,,,743,743,,,244,244,244,,244,743", ",,244,244,,743,743,244,,244,244,244,244,244,244,244,,,,,244,244,244", "244,244,244,244,,,,,,,,,,244,,,244,244,244,244,244,244,244,244,244,244", ",244,244,,244,244,244,,,,,,,,,,,,,,,,,,,,244,,,244,,,244,,,,,,,,,244", ",,,,,,,244,,,,,244,244,244,244,244,244,,,,244,244,,,572,572,572,,572", "244,,,572,572,,244,244,572,,572,572,572,572,572,572,572,,,,,572,572", "572,572,572,572,572,,,,,,,,,,572,,,572,572,572,572,572,572,572,572,572", "572,,572,572,,572,572,572,,,,,,,,,,,,,,,,,,,,572,,,572,,,572,,,,,,,", ",572,,,,,,,,572,,,,,572,572,572,572,572,572,,,,572,572,,,246,246,246", ",246,572,,,246,246,,572,572,246,,246,246,246,246,246,246,246,,,,,246", "246,246,246,246,246,246,,,,,,,,,,246,,,246,246,246,246,246,246,246,246", "246,246,,246,246,,246,246,246,,,,,,,,,,,,,,,,,,,,246,,,246,,,246,,,", ",,,,,246,,,,,,,,246,,,,,246,246,246,246,246,246,,,,246,246,,,251,251", "251,,251,246,,,251,251,,246,246,251,,251,251,251,251,251,251,251,,,", ",251,251,251,251,251,251,251,,,,,,,,,,251,,,251,251,251,251,251,251", "251,251,251,251,,251,251,,251,251,251,,,,,,,,,,,,,,,,,,,,251,,,251,", ",251,,,,,,,,,251,,,,,,,,251,,,,,251,251,251,251,251,251,,,,251,251,", ",577,577,577,,577,251,,,577,577,,251,251,577,,577,577,577,577,577,577", "577,,,,,577,577,577,577,577,577,577,,,,,,,,,,577,,,577,577,577,577,577", "577,577,577,577,577,,577,577,,577,577,577,,,,,,,,,,,,,,,,,,,,577,,,577", ",,577,,,,,,,,,577,,,,,,,,577,,,,,577,577,577,577,577,577,,,,577,577", ",,580,580,580,,580,577,,,580,580,,577,577,580,,580,580,580,580,580,580", "580,,,,,580,580,580,580,580,580,580,,,,,,,,,,580,,,580,580,580,580,580", "580,580,580,580,580,,580,580,,580,580,580,,,,,,,,,,,,,,,,,,,,580,,,580", ",,580,,,,,,,,,580,,,,,,,,580,,,,,580,580,580,580,580,580,,,,580,580", ",,726,726,726,726,726,580,,,726,726,,580,580,726,,726,726,726,726,726", "726,726,,,,,726,726,726,726,726,726,726,,,726,,,,,,726,726,726,726,726", "726,726,726,726,726,726,726,726,726,,726,726,,726,726,726,,,,,,,,,,", ",,,,,,,,,726,,,726,,,726,,,,,726,,,,726,,,,,,,,726,,,,,726,726,726,726", "726,726,,,,726,726,,,257,257,257,,257,726,,,257,257,,726,726,257,,257", "257,257,257,257,257,257,,,,,257,257,257,257,257,257,257,,,,,,,,,,257", ",,257,257,257,257,257,257,257,257,257,257,,257,257,,257,257,257,,,,", ",,,,,,,,,,,,,,,257,,,257,,,257,,,,,257,,257,,257,,,,,,,,257,,,,,257", "257,257,257,257,257,,,,257,257,,,,,,,257,257,258,258,258,,258,257,257", ",258,258,,,,258,,258,258,258,258,258,258,258,,,,,258,258,258,258,258", "258,258,,,,,,,,,,258,,,258,258,258,258,258,258,258,258,258,258,,258", "258,,258,258,258,,,,,,,,,,,,,,,,,,,,258,,,258,,,258,,,,,258,,258,,258", ",,,,,,,258,,,,,258,258,258,258,258,258,,,,258,258,,,,,,,258,258,266", "266,266,,266,258,258,,266,266,,,,266,,266,266,266,266,266,266,266,,", ",,266,266,266,266,266,266,266,,,,,,,,,,266,,,266,266,266,266,266,266", "266,266,266,266,,266,266,,266,266,266,,,,,,,,,,,,,,,,,,,,266,,,266,", "266,266,,,,,266,,266,,266,,,,,,,,266,,,,,266,266,266,266,266,266,,583", ",266,266,,,,583,583,583,266,266,583,583,583,,583,266,266,,,,,,,583,583", "583,,,,,,,,583,583,,583,583,583,583,583,,,,,,,,,,,,,,,,,,,,,,583,583", "583,583,583,583,583,583,583,583,583,583,583,583,,,583,583,583,,583,583", ",,583,,,583,,583,,583,,583,,583,583,583,583,583,583,583,,583,583,583", ",,,,,,,,,,,,583,583,583,583,,583,,,,,583,,583,268,268,268,268,268,,", ",268,268,,,,268,,268,268,268,268,268,268,268,,,,,268,268,268,268,268", "268,268,,,268,,,,,,268,268,268,268,268,268,268,268,268,268,268,268,268", "268,,268,268,,268,268,268,,,,,,,,,,,,,,,,,,,,268,,,268,,,268,,,,,268", ",,,268,,,,,,,,268,,,,,268,268,268,268,268,268,,,,268,268,,,718,718,718", ",718,268,,,718,718,,268,268,718,,718,718,718,718,718,718,718,,,,,718", "718,718,718,718,718,718,,,,,,,,,,718,,,718,718,718,718,718,718,718,718", "718,718,,718,718,,718,718,718,,,,,,,,,,,,,,,,,,,,718,,,718,,,718,,,", ",718,,,,718,,,,,,,,718,,,,,718,718,718,718,718,718,,,,718,718,,,353", "353,353,,353,718,,,353,353,,718,718,353,,353,353,353,353,353,353,353", ",,,,353,353,353,353,353,353,353,,,353,,,,,,,353,,,353,353,353,353,353", "353,353,353,353,353,,353,353,,353,353,353,,,,,,,,,,,,,,,,,,,,353,,,353", ",,353,,,,,,,,,353,,,,,,,,353,,,,,353,353,353,353,353,353,,,,353,353", ",,703,703,703,,703,353,,,703,703,,353,353,703,,703,703,703,703,703,703", "703,,,,,703,703,703,703,703,703,703,,,,,,,,,,703,,,703,703,703,703,703", "703,703,703,703,703,,703,703,,703,703,703,,,,,,,,,,,,,,,,,,,,703,,,703", ",,703,,,,,,,,,703,,,,,,,,703,,,,,703,703,703,703,703,703,,,,703,703", ",,272,272,272,,272,703,,,272,272,,703,703,272,,272,272,272,272,272,272", "272,,,,,272,272,272,272,272,272,272,,,,,,,,,,272,,,272,272,272,272,272", "272,272,272,272,272,,272,272,,,,272,,,,,,,,,,,,,,,,,,,,272,,,272,,,272", ",,,,,,,,,,,,,,,,,,,,,272,272,272,272,272,272,,,,272,272,,,273,273,273", "273,273,272,,,273,273,,272,272,273,,273,273,273,273,273,273,273,,,,", "273,273,273,273,273,273,273,,,273,,,,,,273,273,273,273,273,273,273,273", "273,273,273,273,273,273,,273,273,,273,273,273,,,,,,,,,,,,,,,,,,,,273", ",,273,,,273,,,,,273,,,,273,,,,,,,,273,,,,,273,273,273,273,273,273,,584", ",273,273,,,,584,584,584,,273,584,584,584,,584,273,273,,,,,,,,584,584", ",,,,,,,584,584,,584,584,584,584,584,,,,,,,,,,,,,,,,,,,,,,584,584,584", "584,584,584,584,584,584,584,584,584,584,584,,,584,584,584,,584,584,", ",584,,,584,,584,,584,,584,,584,584,584,584,584,584,584,,584,,584,,,", ",,,,,,,,,584,584,584,584,,584,,587,587,587,584,587,584,,,587,587,,,", "587,,587,587,587,587,587,587,587,,,,,587,587,587,587,587,587,587,,,", ",,,,,,587,,,587,587,587,587,587,587,587,587,587,587,,587,587,,587,587", "587,,,,,,,,,,,,,,,,,,,,587,,,587,,,587,,,,,,,,,587,,,,,,,,587,,,,,587", "587,587,587,587,587,,,,587,587,,,702,702,702,,702,587,,,702,702,,587", "587,702,,702,702,702,702,702,702,702,,,,,702,702,702,702,702,702,702", ",,,,,,,,,702,,,702,702,702,702,702,702,702,702,702,702,,702,702,,702", "702,702,,,,,,,,,,,,,,,,,,,,702,,,702,,,702,,,,,,,,,702,,,,,,,,702,,", ",,702,702,702,702,702,702,,,,702,702,,,591,591,591,591,591,702,,,591", "591,,702,702,591,,591,591,591,591,591,591,591,,,,,591,591,591,591,591", "591,591,,,591,,,,,,591,591,591,591,591,591,591,591,591,591,591,591,591", "591,,591,591,,591,591,591,,,,,,,,,,,,,,,,,,,,591,,,591,,,591,,,,,591", ",,,591,,,,,,,,591,,,,,591,591,591,591,591,591,,,,591,591,,,701,701,701", ",701,591,,,701,701,,591,591,701,,701,701,701,701,701,701,701,,,,,701", "701,701,701,701,701,701,,,,,,,,,,701,,,701,701,701,701,701,701,701,701", "701,701,,701,701,,701,701,701,,,,,,,,,,,,,,,,,,,,701,,,701,,,701,,,", ",,,,,701,,,,,,,,701,,,,,701,701,701,701,701,701,,,,701,701,,,595,595", "595,,595,701,,,595,595,,701,701,595,,595,595,595,595,595,595,595,,,", ",595,595,595,595,595,595,595,,,,,,,,,,595,,,595,595,595,595,595,595", "595,595,595,595,,595,595,,595,595,595,,,,,,,,,,,,,,,,,,,,595,,,595,", ",595,,,,,,,,,595,,,,,,,,595,,,,,595,595,595,595,595,595,,,,595,595,", ",603,603,603,603,603,595,,,603,603,,595,595,603,,603,603,603,603,603", "603,603,,,,,603,603,603,603,603,603,603,,,603,,,,,,603,603,603,603,603", "603,603,603,603,603,603,603,603,603,,603,603,,603,603,603,,,,,,,,,,", ",,,,,,,,,603,,,603,,,603,,,,,603,,,,603,,,,,,,,603,,,,,603,603,603,603", "603,603,,,,603,603,,,609,609,609,,609,603,,,609,609,,603,603,609,,609", "609,609,609,609,609,609,,,,,609,609,609,609,609,609,609,,,,,,,,,,609", ",,609,609,609,609,609,609,609,609,609,609,,609,609,,609,609,609,,,,", ",,,,,,,,,,,,,,,609,,,609,,,609,,,,,609,,609,,609,,,,,,,,609,,,,,609", "609,609,609,609,609,,,,609,609,,,,,,,609,609,340,340,340,,340,609,609", ",340,340,,,,340,,340,340,340,340,340,340,340,,,,,340,340,340,340,340", "340,340,,,,,,,,,,340,,,340,340,340,340,340,340,340,340,340,340,,340", "340,,,,340,,,,,,,,,,,,,,,,,,,,340,,,340,,,340,,,,,,,,,,,,,,,,,,,,,,340", "340,340,340,340,340,,,,340,340,,,338,338,338,,338,340,,,338,338,,340", "340,338,,338,338,338,338,338,338,338,,,,,338,338,338,338,338,338,338", ",,,,,,,,,338,,,338,338,338,338,338,338,338,338,338,338,,338,338,,,,338", ",,,,,,,,,,,,,,,,,,,338,,,338,,,338,,,,,,,,,,,,,,,,,,,,,,338,338,338", "338,338,338,,,,338,338,,,691,691,691,,691,338,,,691,691,,338,338,691", ",691,691,691,691,691,691,691,,,,,691,691,691,691,691,691,691,,,,,,,", ",,691,,,691,691,691,691,691,691,691,691,691,691,,691,691,,691,691,691", ",,,,,,,,,,,,,,,,,,,691,,,691,,,691,,,,,,,,,691,,,,,,,,691,,,,,691,691", "691,691,691,691,,,,691,691,,,690,690,690,,690,691,,,690,690,,691,691", "690,,690,690,690,690,690,690,690,,,,,690,690,690,690,690,690,690,,,", ",,,,,,690,,,690,690,690,690,690,690,690,690,690,690,,690,690,,690,690", "690,,,,,,,,,,,,,,,,,,,,690,,,690,,,690,,,,,,,,,690,,,,,,,,690,,,,,690", "690,690,690,690,690,,,,690,690,,,615,615,615,615,615,690,,,615,615,", "690,690,615,,615,615,615,615,615,615,615,,,,,615,615,615,615,615,615", "615,,,615,,,,,,615,615,615,615,615,615,615,615,615,615,615,615,615,615", ",615,615,,615,615,615,,,,,,,,,,,,,,,,,,,,615,,,615,,,615,,,,,615,,,", "615,,,,,,,,615,,,,,615,615,615,615,615,615,,,,615,615,,,616,616,616", "616,616,615,,,616,616,,615,615,616,,616,616,616,616,616,616,616,,,,", "616,616,616,616,616,616,616,,,616,,,,,,616,616,616,616,616,616,616,616", "616,616,616,616,616,616,,616,616,,616,616,616,,,,,,,,,,,,,,,,,,,,616", ",,616,,,616,,,,,616,,,,616,,,,,,,,616,,,,,616,616,616,616,616,616,,", ",616,616,,,293,293,293,,293,616,,,293,293,,616,616,293,,293,293,293", "293,293,293,293,,,,,293,293,293,293,293,293,293,,,,,,,,,,293,,,293,293", "293,293,293,293,293,293,293,293,,293,293,,293,293,293,,,,,,,,,,,,,,", ",,,,,293,,,293,293,,293,,,,,,,,,293,,,,,,,,293,,,,,293,293,293,293,293", "293,,,,293,293,,,295,295,295,295,295,293,,,295,295,,293,293,295,,295", "295,295,295,295,295,295,,,,,295,295,295,295,295,295,295,,,295,,,,,,295", "295,295,295,295,295,295,295,295,295,295,295,295,295,,295,295,,295,295", "295,,,,,,,,,,,,,,,,,,,,295,,,295,,,295,,,,,295,,,,295,,,,,,,,295,,,", ",295,295,295,295,295,295,,,,295,295,,,332,332,332,,332,295,,,332,332", ",295,295,332,,332,332,332,332,332,332,332,,,,,332,332,332,332,332,332", "332,,,332,,,,,,,332,,,332,332,332,332,332,332,332,332,332,332,,332,332", ",332,332,332,,,,,,,,,,,,,,,,,,,,332,,,332,,,332,,,,,,,,,332,,,,,,,,332", ",,,,332,332,332,332,332,332,,,,332,332,,,684,684,684,684,684,332,,,684", "684,,332,332,684,,684,684,684,684,684,684,684,,,,,684,684,684,684,684", "684,684,,,684,,,,,,684,684,684,684,684,684,684,684,684,684,684,684,684", "684,,684,684,,684,684,684,,,,,,,,,,,,,,,,,,,,684,,,684,,,684,,,,,684", ",,,684,,,,,,,,684,,,,,684,684,684,684,684,684,,,,684,684,,,331,331,331", ",331,684,,,331,331,,684,684,331,,331,331,331,331,331,331,331,,,,,331", "331,331,331,331,331,331,,,331,,,,,,,331,,,331,331,331,331,331,331,331", "331,331,331,,331,331,,331,331,331,,,,,,,,,,,,,,,,,,,,331,,,331,,,331", ",,,,,,,,331,,,,,,,,331,,,,,331,331,331,331,331,331,,,,331,331,,,672", "672,672,672,672,331,,,672,672,,331,331,672,,672,672,672,672,672,672", "672,,,,,672,672,672,672,672,672,672,,,672,,,,,,672,672,672,672,672,672", "672,672,672,672,672,672,672,672,,672,672,,672,672,672,,,,,,,,,,,,,,", ",,,,,672,,,672,,,672,,,,,672,,,,672,,,,,,,,672,,,,,672,672,672,672,672", "672,,,,672,672,,,671,671,671,671,671,672,,,671,671,,672,672,671,,671", "671,671,671,671,671,671,,,,,671,671,671,671,671,671,671,,,671,,,,,,671", "671,671,671,671,671,671,671,671,671,671,671,671,671,,671,671,,671,671", "671,,,,,,,,,,,,,,,,,,,,671,,,671,,,671,,,,,671,,,,671,,,,,,,,671,,,", ",671,671,671,671,671,671,,,,671,671,,,632,632,632,,632,671,,,632,632", ",671,671,632,,632,632,632,632,632,632,632,,,,,632,632,632,632,632,632", "632,,,,,,,,,,632,,,632,632,632,632,632,632,632,632,632,632,,632,632", ",632,632,632,,,,,,,,,,,,,,,,,,,,632,,,632,,,632,,,,,632,,,,632,,,,,", ",,632,,,,,632,632,632,632,632,632,,,,632,632,,,668,668,668,,668,632", ",,668,668,,632,632,668,,668,668,668,668,668,668,668,,,,,668,668,668", "668,668,668,668,,,668,,,,,,,668,,,668,668,668,668,668,668,668,668,668", "668,,668,668,,668,668,668,,,,,,,,,,,,,,,,,,,,668,,,668,,,668,,,,,,,", ",668,,,,,,,,668,,,,,668,668,668,668,668,668,,,,668,668,,,660,660,660", ",660,668,,,660,660,,668,668,660,,660,660,660,660,660,660,660,,,,,660", "660,660,660,660,660,660,,,660,,,,,,,660,,,660,660,660,660,660,660,660", "660,660,660,,660,660,,660,660,660,,,,,,,,,,,,,,,,,,,,660,,,660,,,660", ",,,,,,,,660,,,,,,,,660,,,,,660,660,660,660,660,660,,,,660,660,,,664", "664,664,,664,660,,,664,664,,660,660,664,,664,664,664,664,664,664,664", ",,,,664,664,664,664,664,664,664,,,,,,,,,,664,,,664,664,664,664,664,664", "664,664,664,664,,664,664,,664,664,664,,,,,,,,,,,,,,,,,,,,664,,,664,", ",664,,,,,664,,,,664,,,,,,,,664,,,,,664,664,664,664,664,664,,,,664,664", ",,,,,,664,664,659,659,659,,659,664,664,,659,659,,,,659,,659,659,659", "659,659,659,659,,,,,659,659,659,659,659,659,659,,,,,,,,,,659,,,659,659", "659,659,659,659,659,659,659,659,,659,659,,659,659,659,,,,,,,,,,,,,,", ",,,,,659,,,659,,,659,,,,,659,,,,659,,,,,,,,659,,,,,659,659,659,659,659", "659,,,,659,659,,,453,453,453,,453,659,,,453,453,,659,659,453,,453,453", "453,453,453,453,453,,,,,453,453,453,453,453,453,453,,,,,,,,,,453,,,453", "453,453,453,453,453,453,453,453,453,,453,453,,453,453,453,,,,,,,,,,", ",,,,,,,,,453,,,453,,,453,,,,,,,453,,453,,,,,,,,453,,,,,453,453,453,453", "453,453,,461,,453,453,,,,461,461,461,453,453,461,461,461,,461,453,453", ",,,,,,,461,,,,,,,,,461,461,,461,461,461,461,461,,,,,,,,,,,,458,,,,,", ",458,458,458,,,458,458,458,,458,,,,,461,,,,,458,,461,,,,,461,461,458", "458,,458,458,458,458,458,,,,,,,,,,,,,461,,,,,,,,,,,,,461,,461,,,461", ",458,,,,,,,458,,,,,458,458,,,,,,,,,,,,,,,,,,,,,458,,,,,,,,,,,,,458,", "458,,,458,7,7,7,7,7,7,7,7,,,7,7,7,7,7,,,7,7,7,7,7,7,7,,,7,7,7,7,7,7", "7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,,,7,,,,,,,,7,7,,7,7,7,7,7,7,7,,,7", ",,,,7,7,7,7,,,,,,,,,,,,,7,7,,7,7,7,7,7,7,7,7,7,7,7,,,7,7,384,384,384", "384,384,384,384,384,,7,384,384,384,384,384,,,384,384,384,384,384,384", "384,,,384,384,384,384,384,384,384,384,384,384,384,384,384,384,384,384", "384,384,384,384,384,384,384,,,384,,,,,,,,384,384,,384,384,384,384,384", "384,384,,,384,,,,,384,384,384,384,,,,,,,,,,,,,384,384,,384,384,384,384", "384,384,384,384,384,384,384,,,384,384,6,6,6,6,6,6,6,6,,384,6,6,6,6,6", ",,6,6,6,6,6,6,6,,,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,,6", ",,,,,,,6,6,,6,6,6,6,6,6,6,,,6,,,,,6,6,6,6,,,,,,,,,,,,,6,6,,6,6,6,6,6", "6,6,6,6,6,6,,,6,6,380,380,380,380,380,380,380,380,,6,380,380,380,380", "380,,,380,380,380,380,380,380,380,,,380,380,380,380,380,380,380,380", "380,380,380,380,380,380,380,380,380,380,380,380,380,380,380,,,380,,", ",,,,,380,380,,380,380,380,380,380,380,380,,,380,,,,,380,380,380,380", ",,,,,,,,,,,,380,380,,380,380,380,380,380,380,380,380,380,380,380,,,380", "380,79,79,79,79,79,79,79,79,,380,79,79,79,79,79,,,79,79,79,79,79,79", "79,,,79,79,79,79,79,79,79,79,79,79,79,79,79,79,79,79,79,79,79,79,79", "79,79,79,79,79,79,,,,,,,79,79,,79,79,79,79,79,79,79,,,79,,,,,79,79,79", "79,,,,,,,,,,,,,79,79,,79,79,79,79,79,79,79,79,79,79,79,,,79,65,65,65", "65,65,65,65,65,,,65,65,65,65,65,,,65,65,65,65,65,65,65,,,65,65,65,65", "65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,65", ",,,,,,65,65,,65,65,65,65,65,65,65,,,65,,,,,65,65,65,65,,,,,,65,,,,,", ",65,65,,65,65,65,65,65,65,65,65,65,65,65,,,65,681,681,681,681,681,681", "681,681,,,681,681,681,681,681,,,681,681,681,681,681,681,681,,,681,681", "681,681,681,681,681,681,681,681,681,681,681,681,681,681,681,681,681", "681,681,681,681,,,681,,,,,,,,681,681,,681,681,681,681,681,681,681,,", "681,,,,,681,681,681,681,,,,,,,,,,,,,681,681,,681,681,681,681,681,681", "681,681,681,681,681,,,681,185,185,185,185,185,185,185,185,,,185,185", "185,185,185,,,185,185,185,185,185,185,185,,,185,185,185,185,185,185", "185,185,185,185,185,185,185,185,185,185,185,185,185,185,185,185,185", "185,185,185,185,,,,,,,185,185,,185,185,185,185,185,185,185,,,185,,,", ",185,185,185,185,,,,,,,,,,,,,185,185,,185,185,185,185,185,185,185,185", "185,185,185,254,254,185,,254,,,,,,,,254,254,,254,254,254,254,254,254", "254,,,254,,,,,254,254,254,254,,,,,,,,,,,,,254,254,,254,254,254,254,254", "254,254,254,254,254,254,255,255,254,,255,,,,,,,,255,255,,255,255,255", "255,255,255,255,,,255,,,,,255,255,255,255,,,,,,,,,,,,,255,255,,255,255", "255,255,255,255,255,255,255,255,255,737,737,255,,737,,,,,,,,737,737", ",737,737,737,737,737,737,737,,,737,,,,,737,737,737,737,,,,,,,,,,,,,737", "737,,737,737,737,737,737,737,737,737,737,737,737,844,844,737,,844,,", ",,,,,844,844,,844,844,844,844,844,844,844,,,844,,,,,844,844,844,844", ",,,,,844,,,,,,,844,844,,844,844,844,844,844,844,844,844,844,844,844", "845,845,844,,845,,,,,,,,845,845,,845,845,845,845,845,845,845,,,845,", ",,,845,845,845,845,,,,,,,,,,,,,845,845,,845,845,845,845,845,845,845", "845,845,845,845,493,493,845,,493,,,,,,,,493,493,,493,493,493,493,493", "493,493,,,493,,,,,493,493,493,493,,,,,,,,,,,,,493,493,,493,493,493,493", "493,493,493,493,493,493,493,492,492,493,,492,,,,,,,,492,492,,492,492", "492,492,492,492,492,,,492,,,,,492,492,492,492,,,,,,492,,,,,,,492,492", ",492,492,492,492,492,492,492,492,492,492,492,607,607,492,,607,,,,,,", ",607,607,,607,607,607,607,607,607,607,,,607,,,,,607,607,607,607,,,,", ",,,,,,,,607,607,,607,607,607,607,607,607,607,607,607,607,607,195,195", "607,,195,,,,,,,,195,195,,195,195,195,195,195,195,195,,,195,,,,,195,195", "195,195,,,,,,,,,,,,,195,195,,195,195,195,195,195,195,195,195,195,195", "195,194,194,195,,194,,,,,,,,194,194,,194,194,194,194,194,194,194,,,194", ",,,,194,194,194,194,,,,,,194,,,,,,,194,194,,194,194,194,194,194,194", "194,194,194,194,194,608,608,194,,608,,,,,,,,608,608,,608,608,608,608", "608,608,608,,,608,,,,,608,608,608,608,,,,,,,,,,,,,608,608,,608,608,608", "608,608,608,608,608,608,608,608,484,484,608,,484,,,,,,,,484,484,,484", "484,484,484,484,484,484,,,484,,,,,484,484,484,484,,,,,,,,,,,,,484,484", ",484,484,484,484,484,484,484,484,484,484,484,483,483,484,,483,,,,,,", ",483,483,,483,483,483,483,483,483,483,,,483,,,,,483,483,483,483,,,,", ",483,,,,,,,483,483,,483,483,483,483,483,483,483,483,483,483,483,663", "663,483,,663,,,,,,,,663,663,,663,663,663,663,663,663,663,,,663,,,,,663", "663,663,663,,,,,,,,,,,,,663,663,,663,663,663,663,663,663,663,663,663", "663,663,415,415,663,,415,,,,,,,,415,415,,415,415,415,415,415,415,415", ",,415,,,,,415,415,415,415,,,,,,415,,,,,,,415,415,,415,415,415,415,415", "415,415,415,415,415,415,416,416,415,,416,,,,,,,,416,416,,416,416,416", "416,416,416,416,,,416,,,,,416,416,416,416,,,,,,,,,,,,,416,416,,416,416", "416,416,416,416,416,416,416,416,416,665,665,416,,665,,,,,,,,665,665", ",665,665,665,665,665,665,665,,,665,,,,,665,665,665,665,,,,,,665,,,,", ",,665,665,,665,665,665,665,665,665,665,665,665,665,665,,,665"];

      racc_action_check = arr = __Ruby.Object._scope.Array.$new(21316, nil);

      idx = 0;

      (__c = clist, __c.$each._p = (__a = function(str) {

        var __a, __b;
        if (str == null) str = nil;

        return (__b = str.$split(",", -1), __b.$each._p = (__a = function(i) {

          var __a;
          if (i == null) i = nil;

          if ((__a = i['$empty?']()) === false || __a === nil) {
            arr['$[]='](idx, i.$to_i())
          };
          return idx = idx['$+'](1);
        }, __a._s = this, __a), __b.$each())
      }, __a._s = Grammar, __a), __c.$each());

      racc_action_pointer = [-2, 1165, nil, 289, nil, 983, 19655, 19435, 1039, 1025, 1000, 992, 1036, 367, -62, 122, nil, 1730, 1852, 1108, 1076, nil, 2218, 2346, 2474, 373, 69, 2816, 2944, nil, 3070, 3192, 3314, nil, 969, 325, 1026, 298, 3924, 4046, 4168, 948, -13, nil, nil, nil, nil, nil, nil, nil, 4530, nil, 4663, 4785, 4913, -1, 2878, 5285, 5407, nil, nil, 5529, 2291, 932, nil, 19984, nil, nil, nil, nil, nil, -41, nil, nil, nil, nil, nil, 868, 865, 19875, nil, nil, nil, 6523, nil, nil, 6651, nil, nil, nil, nil, nil, nil, nil, nil, nil, 12, nil, 6901, nil, nil, nil, 7023, 7145, 7267, 7389, 7511, nil, 657, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, 20202, 847, nil, 7998, 8120, 8242, 8364, 8486, 8608, 20792, 20733, 8979, 9101, 9223, nil, 248, 15, 847, 111, 756, 796, 10077, nil, nil, 10199, 10321, 10443, 10565, 10687, 10809, 10931, 11053, 11175, 11297, 11419, 11541, 11663, 11785, 11907, 12029, 12151, 12273, 12395, 12517, 12639, 12761, 12883, 13005, 13127, 13249, 13371, nil, nil, nil, 986, nil, 748, 747, nil, 13859, 775, 14103, nil, nil, nil, nil, 14225, nil, nil, 20261, 20320, 737, 14713, 14841, nil, nil, nil, nil, nil, nil, nil, 14969, 739, 15220, 732, 681, 642, 15708, 15830, 370, 395, 713, 396, 663, 620, 8, nil, 652, 521, nil, nil, 626, 666, 665, 495, nil, 652, nil, 17667, nil, 17789, -29, nil, 305, 318, 542, 394, 510, nil, 338, nil, nil, 344, 2939, nil, nil, 451, 446, 427, nil, nil, 417, nil, nil, nil, nil, nil, nil, nil, 412, nil, nil, 289, 482, 74, 66, 18155, 17911, 370, 246, 148, 587, nil, 17057, nil, 16935, 492, 163, 182, 387, 583, -7, 171, 369, nil, 584, nil, nil, 15464, nil, 318, nil, 248, nil, 105, 619, 278, nil, 883, -43, nil, 155, nil, nil, nil, nil, nil, nil, 864, nil, nil, nil, nil, nil, nil, 19765, nil, nil, nil, 19545, 999, 1044, nil, nil, 492, nil, 9955, 1043, nil, 1029, nil, nil, 864, 833, 579, 403, 8853, nil, nil, nil, 8725, 612, 7865, nil, 7755, 6395, nil, 1608, nil, nil, 21087, 21146, 6267, -29, 5901, 5041, 4412, 4168, 4290, 857, 683, 135, 524, 570, 735, 4656, 4785, 4664, 2602, 4046, 4412, 4481, 3188, 3436, 3558, 3680, 3802, 3924, 1049, 1171, 3314, 3070, 1480, 156, nil, 120, nil, nil, 19137, nil, 248, nil, nil, 19309, nil, nil, 19255, -47, nil, 1029, 983, 864, 955, 1041, nil, nil, 370, 132, -5, 976, nil, 944, 888, nil, nil, nil, 866, 492, 20969, 20910, 398, 864, nil, nil, 620, 742, 986, 20615, 20556, 620, 1108, 942, 880, 763, nil, 1230, nil, nil, 1352, nil, nil, nil, nil, nil, 1974, 2602, 680, nil, 2502, nil, 738, nil, nil, 504, 2724, nil, nil, 3436, 296, nil, nil, 3558, 103, 120, 67, 57, 3680, nil, nil, -2, 158, nil, 543, nil, 33, 9345, nil, 2910, nil, nil, nil, 3, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, 167, nil, nil, nil, 847, nil, nil, nil, nil, nil, 9711, 970, 9833, 573, 13493, 13981, 1003, nil, nil, nil, 14347, 978, nil, 14469, -44, 75, 15087, 15948, 646, 248, 16075, nil, 2768, nil, 16319, 555, nil, 571, 16563, nil, 551, nil, nil, nil, nil, nil, 16685, nil, 544, 528, 20674, 20851, 16807, 1352, 485, nil, nil, 420, 17423, 17545, nil, 3, nil, 892, 322, -24, 98, 201, 527, 142, 2346, 219, 223, 1, 322, 18521, nil, nil, nil, 235, 349, nil, 245, 253, nil, nil, 269, nil, 307, 580, 447, 475, nil, 513, nil, nil, nil, nil, nil, 524, nil, 529, 19015, 18765, 702, nil, 21028, 18887, 21205, nil, nil, 18643, 205, -25, 18399, 18277, 2419, 164, 519, 520, 521, nil, 515, nil, 20093, 572, 1022, 18033, nil, nil, nil, 2218, 603, 17301, 17179, nil, 2096, nil, 1974, nil, nil, 1852, nil, 1730, 16441, 16197, 15586, 107, 1230, nil, 674, 771, nil, nil, 672, nil, nil, 698, 701, 777, 775, 15342, nil, 712, 817, 333, nil, 821, nil, 14591, 713, 765, nil, nil, nil, nil, 932, nil, nil, nil, 20379, nil, 852, nil, nil, 855, 13737, 13615, nil, nil, 62, 39, 359, nil, 803, 800, 9589, -50, nil, nil, 933, 934, 826, nil, 2752, nil, 488, nil, nil, 9467, nil, nil, nil, nil, nil, nil, nil, 846, 835, nil, 742, 7633, nil, nil, nil, 886, 857, nil, nil, nil, 6779, nil, nil, -7, 6145, nil, 870, 911, nil, 6023, nil, 1001, 1002, 5779, 5657, nil, nil, 1022, nil, 5163, nil, nil, 955, 921, 936, 1058, 933, nil, nil, 3205, nil, nil, nil, 4290, nil, 3802, 304, 330, 1029, 331, nil, nil, 78, nil, nil, 205, 2096, nil, 1095, nil, 245, nil, nil, nil, 1608, 1109, 1480, 20438, 20497, 397, 864, nil, nil, nil, 1125, nil, 1010, 1134, nil, 1055, 86, 70, 93, 620, 131, nil, nil, nil, 742, nil];

      racc_action_default = [-492, -494, -1, -481, -4, -5, -494, -494, -494, -494, -494, -494, -494, -494, -251, -31, -32, -494, -494, -37, -39, -40, -262, -299, -300, -44, -229, -229, -229, -56, -492, -60, -65, -66, -494, -423, -494, -494, -494, -494, -494, -483, -211, -244, -245, -246, -247, -248, -249, -250, -471, -253, -494, -492, -492, -268, -492, -494, -494, -273, -276, -481, -494, -285, -291, -494, -301, -302, -368, -369, -370, -371, -372, -492, -375, -492, -492, -492, -492, -492, -402, -408, -409, -412, -413, -414, -415, -416, -417, -418, -419, -420, -421, -422, -425, -426, -494, -3, -482, -488, -489, -490, -494, -494, -494, -494, -494, -7, -494, -90, -91, -92, -93, -94, -95, -96, -99, -100, -101, -102, -103, -104, -105, -106, -107, -108, -109, -110, -111, -112, -113, -114, -115, -116, -117, -118, -119, -120, -121, -122, -123, -124, -125, -126, -127, -128, -129, -130, -131, -132, -133, -134, -135, -136, -137, -138, -139, -140, -141, -142, -143, -144, -145, -146, -147, -148, -149, -150, -151, -152, -153, -154, -155, -156, -157, -158, -159, -160, -161, -162, -163, -164, -165, -166, -167, -494, -12, -97, -492, -492, -494, -494, -494, -492, -494, -494, -494, -494, -494, -35, -494, -423, -494, -251, -494, -494, -492, -36, -203, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -494, -339, -341, -41, -212, -222, -493, -493, -226, -494, -237, -494, -262, -299, -300, -465, -494, -42, -43, -494, -494, -48, -492, -494, -267, -344, -351, -353, -54, -349, -55, -494, -56, -492, -494, -494, -61, -63, -492, -70, -494, -494, -77, -265, -483, -494, -303, -350, -494, -64, -68, -258, -410, -411, -494, -188, -189, -204, -494, -484, -492, -483, -213, -485, -485, -494, -485, -494, -462, -485, -269, -270, -494, -494, -314, -315, -459, -459, -459, -331, -332, -445, -441, -442, -443, -444, -446, -451, -452, -454, -455, -456, -494, -38, -494, -494, -494, -494, -481, -494, -482, -494, -323, -494, -288, -494, -90, -91, -127, -128, -144, -149, -156, -159, -294, -494, -423, -460, -494, -373, -494, -388, -494, -390, -494, -494, -494, -380, -494, -494, -386, -494, -401, -403, -404, -405, -406, 867, -6, -491, -13, -14, -15, -16, -17, -494, -9, -10, -11, -494, -494, -494, -20, -28, -168, -237, -494, -494, -21, -29, -30, -22, -170, -494, -472, -473, -229, -346, -474, -475, -472, -229, -473, -348, -477, -478, -27, -177, -33, -34, -494, -494, -492, -258, -494, -494, -494, -178, -179, -180, -181, -182, -183, -184, -185, -190, -191, -192, -193, -194, -195, -196, -197, -198, -199, -200, -201, -202, -205, -206, -207, -208, -494, -492, -223, -494, -236, -224, -494, -234, -494, -238, -468, -229, -472, -473, -229, -492, -49, -494, -483, -483, -493, -222, -230, -231, -494, -492, -492, -494, -264, -494, -57, -256, -69, -62, -494, -492, -494, -494, -76, -494, -410, -411, -494, -494, -494, -494, -494, -209, -494, -360, -494, -494, -214, -487, -486, -215, -487, -260, -464, -261, -463, -311, -492, -492, -494, -313, -494, -327, -494, -329, -330, -494, -494, -453, -457, -492, -304, -305, -306, -492, -494, -494, -494, -494, -492, -355, -282, -86, -494, -88, -494, -251, -494, -494, -292, -440, -296, -479, -480, -483, -374, -389, -392, -393, -395, -376, -391, -377, -378, -379, -494, -382, -384, -385, -494, -407, -8, -98, -18, -19, -494, -243, -494, -259, -494, -494, -50, -220, -221, -345, -494, -52, -347, -494, -472, -473, -472, -473, -494, -168, -494, -335, -494, -337, -492, -493, -235, -239, -494, -466, -494, -467, -45, -342, -46, -343, -492, -216, -494, -494, -494, -494, -494, -37, -494, -228, -232, -494, -492, -492, -263, -57, -67, -494, -472, -473, -492, -476, -75, -494, -176, -186, -187, -494, -492, -492, -254, -255, -239, -494, -494, -312, -459, -459, -447, -458, -459, -333, -494, -334, -494, -492, -307, -492, -274, -308, -309, -310, -277, -494, -280, -494, -494, -494, -86, -87, -494, -492, -494, -286, -427, -494, -494, -494, -492, -492, -440, -494, -459, -459, -459, -439, -445, -449, -494, -494, -494, -492, -381, -383, -387, -169, -241, -494, -494, -24, -172, -25, -173, -51, -26, -174, -53, -175, -494, -494, -494, -259, -210, -336, -494, -494, -225, -240, -494, -217, -218, -492, -492, -483, -494, -494, -233, -494, -494, -71, -266, -492, -321, -492, -361, -492, -362, -363, -316, -317, -494, -325, -326, -328, -494, -258, -494, -318, -319, -494, -492, -492, -279, -281, -494, -494, -86, -89, -476, -494, -492, -494, -429, -289, -494, -494, -483, -431, -494, -435, -494, -437, -438, -494, -297, -461, -394, -397, -398, -399, -400, -494, -242, -23, -171, -494, -338, -340, -47, -494, -493, -352, -354, -2, -492, -367, -322, -494, -494, -365, -459, -257, -271, -494, -272, -494, -494, -494, -492, -283, -259, -494, -428, -492, -293, -295, -494, -459, -459, -459, -494, -450, -448, -440, -396, -219, -227, -494, -366, -492, -78, -494, -494, -85, -364, -324, -494, -275, -278, -492, -492, -287, -494, -430, -494, -433, -434, -436, -492, -360, -492, -494, -494, -84, -492, -356, -357, -358, -494, -290, -459, -494, -359, -494, -472, -473, -476, -83, -492, -284, -432, -298, -79, -320];

      clist = ["26,293,300,336,112,112,349,452,466,281,281,522,526,388,395,2,497,26", "26,530,368,463,26,26,26,299,304,672,314,631,26,256,263,265,314,199,675", "641,97,207,241,241,241,115,115,270,284,644,401,406,107,187,26,309,269", "814,662,26,26,739,796,26,724,112,240,240,240,260,264,596,296,267,301", "651,655,328,328,112,640,328,643,742,614,350,514,516,517,373,543,593", "329,330,593,295,333,379,334,539,26,541,331,35,26,26,26,26,26,677,458", "461,612,499,502,101,505,743,332,507,548,596,328,328,328,328,558,744", "368,600,660,814,602,35,274,274,591,375,376,377,378,357,359,833,398,366", "338,753,540,806,603,340,238,252,253,671,542,681,816,307,615,616,508", "306,469,666,639,299,351,675,271,352,380,101,186,448,472,473,848,659", "728,790,354,355,302,112,750,361,557,98,26,26,26,26,26,410,364,769,26", "26,26,35,683,684,759,385,386,810,26,35,392,392,305,387,393,396,656,413", "414,411,786,1,,270,,,,,,,,,,,,,,,,,677,486,,,,,,,,,593,,281,,,,,,498", "26,26,,,,,849,,644,26,,26,401,406,,866,26,,467,241,,,,314,14,,270,241", "641,480,,270,35,35,,476,,802,26,,481,793,468,240,841,,,,511,,35,240", "267,675,14,277,277,267,,281,,281,,686,260,,264,,,811,,812,,,26,26,,", ",,623,696,,,,,699,,,623,,,328,328,,,26,,,,709,,,716,,,,527,528,585,10", "529,35,,546,,274,35,855,,,112,14,,677,112,600,602,465,470,14,,299,12", ",757,758,474,,35,10,,,,,853,,,,573,,,,,578,734,735,410,,736,115,,,12", "115,592,,563,605,606,,564,801,,620,,,,,,,,351,,351,575,101,,,,579,762", "764,765,,,,299,729,,,,593,,714,715,599,,10,601,,,14,14,26,822,10,804", ",,,,,,,410,,,,,14,12,296,,410,,,,26,12,281,,575,,,575,,,,682,,,26,26", "847,,630,678,,,850,,623,,,26,,636,637,26,835,,,707,26,,,,,,648,,,26", "650,,,,,658,,819,14,,,,277,14,10,10,,670,,,314,854,,,,828,,,,,26,26", "10,,,14,26,12,12,,592,,838,839,840,,,,,,26,692,694,,,12,,697,,,,,26", ",,708,,,26,35,35,,752,,26,26,,711,538,351,538,767,35,,,863,35,,,720", "721,35,,,10,299,652,652,,10,,,,,678,,,,667,392,717,,,,,,,12,,26,410", "10,12,575,,,579,26,,,26,26,,,,782,747,328,112,,,,,26,12,328,,,,,26,35", "748,,,,,623,774,,754,,,35,,,,,,,,776,,,,35,35,,809,,,,,,,26,,,,,,,,", "410,783,,,,,789,,26,26,,,,,,,,,26,,575,575,,798,799,,,,,,,,,,281,,,35", "35,,,,,,755,756,,,,760,35,,26,678,,14,14,856,,,,26,,,,538,26,821,14", ",,26,14,,,,,14,,328,299,832,,,,,,26,,,,,35,,829,,,,26,,,,842,,,,26,", "410,35,35,,26,851,,,,,,35,,,,652,,,,861,,805,,,,,,,,14,,,,10,10,,,,", ",,14,,,,35,10,,,823,10,,,14,14,10,12,12,,35,,,,,35,,,,,12,,,,12,,,,", "12,,35,,,,,,,,,,,35,,,,,,,,35,,,,,,35,,,,14,14,,,,,10,,,,,,773,14,,", ",,10,,,,,,,,,,,12,10,10,,,,,,,,,,12,,,13,,,,,,,,,12,12,14,,,,,,200,200", ",,,200,200,200,,,,14,14,13,275,275,,,,,,14,,,,10,10,,,,,,,,,200,,,10", ",200,200,,,200,,,,12,12,,,,,,14,,,,826,,12,,,,,,,,14,,,,,14,,,,,,10", "13,,,,200,200,200,200,13,14,,,,,,,10,10,,,14,,12,,,,10,,14,,,,,,14,", ",,,12,12,,,,,,,,,12,,,,,,,,,,,10,,,,827,,,,,,,,,,10,,,,,10,,,,12,,,", ",,,13,13,200,200,200,10,,12,200,200,200,,12,,,208,10,,13,239,239,239", ",,10,,,,12,,10,,,,,290,291,292,,12,,,,,,,,12,,,239,239,,12,,,,,,,,,", ",,,,,,200,200,,,,,,,,200,,13,,,,275,13,,,,,,,,,,,297,303,,310,,,,,,", ",13,,,,,,,,,356,,358,358,362,365,358,,,,,,,,,,,,,,,,,,,,,200,200,,,", ",,537,,537,,,,,,,,,,,,,200,,,,,,,,,,,,,,,,,,,,,,389,239,397,239,,,412", ",,390,394,,,,,,,,,208,422,423,424,425,426,427,428,429,430,431,432,433", "434,435,436,437,438,439,440,441,442,443,444,445,446,447,,,,297,,,,,239", ",239,,,,,239,,454,,456,,239,239,,457,,,,,,239,,,,,,,,,,,,,,,,,,,,200", ",,,,,,494,,,,,,,,,,464,,,,,,,200,,,,,,,,,,,,,,13,13,,,,,,,,,646,,,13", ",,,13,,,,,13,,,,,,,,,200,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,200,200,,,,239", "200,,,,,,,,568,,,,,,13,,,,,,,,,,,239,13,412,586,397,,,200,,,,,,13,13", ",,,,,,,,,,,,,,,574,,,239,,,239,,239,,,,594,,,597,297,598,,,,,,,610,", ",,200,,,,,611,,239,200,,,13,13,,627,628,629,,,588,,,,,13,239,,,239,574", ",200,574,588,635,,,597,,,,,,588,588,,,,,,,,,297,,,,,,,,,,,,,13,,,,,", ",,,,,,,,,,,13,13,,,,,,,,688,13,239,,693,695,,,,,698,689,,700,,,,,,,705", ",,,,,,,239,,,,,,,13,,710,,824,,,239,,200,,,,,13,,594,,,13,,,,,,,,,,", "239,,,,,13,,,,727,,,,,,,13,,,,,,,,13,,,239,,,13,,239,,,,390,574,,,,", ",,,725,730,,,,,,,,,,,,239,777,,,725,,725,,,775,,693,695,698,,,,,,,297", ",,,,,,,239,,,,,,,,,390,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,574,574,,,,,239", ",,,788,,,,792,815,,,777,,,,,,,,,,,,,,,,,,,,,,239,,,,,,,,,635,,,,,,,", ",,,239,,,,,,,,,635,,,,,,,,,,,,,,239,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,", ",,725,,,,,,,,,,,297,,,,,,,,,,,,,,,,,,725"];

      racc_goto_table = arr = __Ruby.Object._scope.Array.$new(2089, nil);

      idx = 0;

      (__d = clist, __d.$each._p = (__a = function(str) {

        var __a, __b;
        if (str == null) str = nil;

        return (__b = str.$split(",", -1), __b.$each._p = (__a = function(i) {

          var __a;
          if (i == null) i = nil;

          if ((__a = i['$empty?']()) === false || __a === nil) {
            arr['$[]='](idx, i.$to_i())
          };
          return idx = idx['$+'](1);
        }, __a._s = this, __a), __b.$each())
      }, __a._s = Grammar, __a), __d.$each());

      clist = ["35,48,20,76,45,45,44,55,30,49,49,72,72,22,22,2,3,35,35,75,44,33,35,35", "35,52,52,79,106,4,35,32,32,32,106,24,102,133,8,16,50,50,50,47,47,2,40", "107,31,31,12,12,35,100,37,134,42,35,35,73,101,35,5,45,27,27,27,53,53", "137,24,36,50,74,74,24,24,45,104,24,104,5,57,80,105,105,105,10,81,56", "14,14,56,82,14,10,8,43,35,43,83,41,35,35,35,35,35,104,31,31,56,51,51", "78,51,84,85,51,125,137,24,24,24,24,125,86,44,54,87,134,54,41,41,41,34", "14,14,14,14,122,122,88,20,122,89,90,91,92,34,93,29,29,29,94,95,96,97", "98,34,34,99,71,58,77,103,52,41,102,39,67,25,78,13,109,111,112,113,114", "115,116,120,121,68,45,42,123,124,11,35,35,35,35,35,45,126,127,35,35", "35,41,128,129,131,2,2,132,35,41,50,50,69,16,16,16,75,24,24,16,6,1,,2", ",,,,,,,,,,,,,,,,104,48,,,,,,,,,56,,49,,,,,,48,35,35,,,,,5,,107,35,,35", "31,31,,73,35,,50,50,,,,106,21,,2,50,133,40,,2,41,41,,37,,74,35,,37,104", "27,27,79,,,,100,,41,27,36,102,21,21,21,36,,49,,49,,125,53,,53,,,104", ",104,,,35,35,,,,,31,33,,,,,33,,,31,,,24,24,,,35,,,,55,,,30,,,,14,14", "20,15,8,41,,24,,41,41,4,,,45,21,,104,45,54,54,29,29,21,,52,18,,3,3,29", ",41,15,,,,,104,,,,32,,,,,32,105,105,45,,105,47,,,18,47,52,,12,48,48", ",12,72,,20,,,,,,,,41,,41,53,78,,,,53,105,105,105,,,,52,22,,,,56,,31", "31,32,,15,32,,,21,21,35,72,15,3,,,,,,,,45,,,,,21,18,24,,45,,,,35,18", "49,,53,,,53,,,,48,,,35,35,72,,24,106,,,75,,31,,,35,,2,2,35,3,,,76,35", ",,,,,2,,,35,2,,,,,2,,55,21,,,,21,21,15,15,,24,,,106,3,,,,105,,,,,35", "35,15,,,21,35,18,18,,52,,105,105,105,,,,,,35,16,16,,,18,,16,,,,,35,", ",2,,,35,41,41,,20,,35,35,,2,21,41,21,44,41,,,105,41,,,2,2,41,,,15,52", "78,78,,15,,,,,106,,,,78,50,27,,,,,,,18,,35,45,15,18,53,,,53,35,,,35", "35,,,,48,50,24,45,,,,,35,18,24,,,,,35,41,14,,,,,31,2,,14,,,41,,,,,,", ",16,,,,41,41,,48,,,,,,,35,,,,,,,,,45,50,,,,,2,,35,35,,,,,,,,,35,,53", "53,,2,2,,,,,,,,,,49,,,41,41,,,,,,78,78,,,,78,41,,35,106,,21,21,20,,", ",35,,,,21,35,2,21,,,35,21,,,,,21,,24,52,2,,,,,,35,,,,,41,,14,,,,35,", ",,2,,,,35,,45,41,41,,35,2,,,,,,41,,,,78,,,,2,,78,,,,,,,,21,,,,15,15", ",,,,,,21,,,,41,15,,,41,15,,,21,21,15,18,18,,41,,,,,41,,,,,18,,,,18,", ",,,18,,41,,,,,,,,,,,41,,,,,,,,41,,,,,,41,,,,21,21,,,,,15,,,,,,21,21", ",,,,15,,,,,,,,,,,18,15,15,,,,,,,,,,18,,,19,,,,,,,,,18,18,21,,,,,,19", "19,,,,19,19,19,,,,21,21,19,19,19,,,,,,21,,,,15,15,,,,,,,,,19,,,15,,19", "19,,,19,,,,18,18,,,,,,21,,,,21,,18,,,,,,,,21,,,,,21,,,,,,15,19,,,,19", "19,19,19,19,21,,,,,,,15,15,,,21,,18,,,,15,,21,,,,,,21,,,,,18,18,,,,", ",,,,18,,,,,,,,,,,15,,,,15,,,,,,,,,,15,,,,,15,,,,18,,,,,,,19,19,19,19", "19,15,,18,19,19,19,,18,,,26,15,,19,26,26,26,,,15,,,,18,,15,,,,,26,26", "26,,18,,,,,,,,18,,,26,26,,18,,,,,,,,,,,,,,,,19,19,,,,,,,,19,,19,,,,19", "19,,,,,,,,,,,9,9,,9,,,,,,,,19,,,,,,,,,9,,9,9,9,9,9,,,,,,,,,,,,,,,,,", ",,,19,19,,,,,,19,,19,,,,,,,,,,,,,19,,,,,,,,,,,,,,,,,,,,,,26,26,26,26", ",,26,,,23,23,,,,,,,,,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26", "26,26,26,26,26,26,26,26,26,26,26,,,,9,,,,,26,,26,,,,,26,,23,,23,,26", "26,,23,,,,,,26,,,,,,,,,,,,,,,,,,,,19,,,,,,,26,,,,,,,,,,9,,,,,,,19,,", ",,,,,,,,,,,19,19,,,,,,,,,19,,,19,,,,19,,,,,19,,,,,,,,,19,,,,,,,,,,,", ",,,,,,,,,,,,,,,,,,,19,19,,,,26,19,,,,,,,,23,,,,,,19,,,,,,,,,,,26,19", "26,26,26,,,19,,,,,,19,19,,,,,,,,,,,,,,,,9,,,26,,,26,,26,,,,23,,,23,9", "23,,,,,,,26,,,,19,,,,,23,,26,19,,,19,19,,26,26,26,,,9,,,,,19,26,,,26", "9,,19,9,9,23,,,23,,,,,,9,9,,,,,,,,,9,,,,,,,,,,,,,19,,,,,,,,,,,,,,,,", "19,19,,,,,,,,26,19,26,,26,26,,,,,26,23,,26,,,,,,,26,,,,,,,,26,,,,,,", "19,,23,,19,,,26,,19,,,,,19,,23,,,19,,,,,,,,,,,26,,,,,19,,,,23,,,,,,", "19,,,,,,,,19,,,26,,,19,,26,,,,23,9,,,,,,,,9,9,,,,,,,,,,,,26,26,,,9,", "9,,,23,,26,26,26,,,,,,,9,,,,,,,,26,,,,,,,,,23,,,,,,,,,,,,,,,,,,,,,,", ",,,,,,,,,,9,9,,,,,26,,,,9,,,,9,23,,,26,,,,,,,,,,,,,,,,,,,,,,26,,,,,", ",,,23,,,,,,,,,,,26,,,,,,,,,23,,,,,,,,,,,,,,26,,,,,,,,,,,,,,,,,,,,,,", ",,,,,,,,,,,,9,,,,,,,,,,,9,,,,,,,,,,,,,,,,,,9"];

      racc_goto_check = arr = __Ruby.Object._scope.Array.$new(2089, nil);

      idx = 0;

      (__e = clist, __e.$each._p = (__a = function(str) {

        var __a, __b;
        if (str == null) str = nil;

        return (__b = str.$split(",", -1), __b.$each._p = (__a = function(i) {

          var __a;
          if (i == null) i = nil;

          if ((__a = i['$empty?']()) === false || __a === nil) {
            arr['$[]='](idx, i.$to_i())
          };
          return idx = idx['$+'](1);
        }, __a._s = this, __a), __b.$each())
      }, __a._s = Grammar, __a), __e.$each());

      racc_goto_pointer = [nil, 219, 15, -279, -467, -569, -506, nil, 35, 1227, -11, 184, 44, 165, 33, 367, 21, nil, 390, 996, -51, 281, -177, 1190, 18, 63, 1181, 42, nil, 128, -249, -146, 5, -235, -314, 0, 41, 24, nil, 137, 14, 101, -479, -241, -59, -2, nil, 37, -40, -22, 18, -187, -28, 41, -331, -235, -361, -389, -96, nil, nil, nil, nil, nil, nil, nil, nil, 104, 128, 155, nil, 105, -318, -589, -454, -315, -59, -376, 110, -515, 18, -262, 42, 41, -536, 56, -530, -405, -661, 81, -521, -193, -609, 85, -388, -195, -388, -611, 101, -147, -3, -681, -506, -349, -435, -227, -28, -468, nil, -63, nil, -87, -87, -656, -355, -454, -549, nil, nil, nil, 109, 108, 64, 108, -175, -237, 116, -488, -350, -350, nil, -471, -556, -476, -708, nil, nil, -384];

      racc_goto_default = [nil, nil, 496, nil, nil, 740, nil, 3, nil, 4, 5, 335, nil, nil, nil, 204, 16, 11, 205, 289, nil, 203, nil, 245, 15, nil, 19, 20, 21, nil, 25, 626, nil, nil, nil, 280, 29, nil, 31, 34, 33, 201, 536, nil, 114, 404, 113, 69, nil, 42, 298, nil, 242, 402, 576, 449, 243, nil, nil, 258, 451, 43, 44, 45, 46, 47, 48, 49, nil, 259, 55, nil, nil, nil, nil, nil, nil, nil, 523, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, 337, nil, 311, 312, 313, nil, 642, 315, 237, nil, 408, nil, nil, nil, nil, nil, nil, 68, 70, 71, 72, nil, nil, nil, nil, 553, nil, nil, nil, nil, 367, 674, 676, 321, 680, 324, 327, 250];

      racc_reduce_table = [0, 0, "racc_error", 1, 138, "_reduce_1", 4, 140, "_reduce_2", 2, 139, "_reduce_3", 1, 144, "_reduce_4", 1, 144, "_reduce_5", 3, 144, "_reduce_6", 0, 162, "_reduce_7", 4, 147, "_reduce_8", 3, 147, "_reduce_9", 3, 147, "_reduce_none", 3, 147, "_reduce_11", 2, 147, "_reduce_12", 3, 147, "_reduce_13", 3, 147, "_reduce_14", 3, 147, "_reduce_15", 3, 147, "_reduce_16", 3, 147, "_reduce_none", 4, 147, "_reduce_none", 4, 147, "_reduce_none", 3, 147, "_reduce_20", 3, 147, "_reduce_21", 3, 147, "_reduce_22", 6, 147, "_reduce_none", 5, 147, "_reduce_24", 5, 147, "_reduce_none", 5, 147, "_reduce_none", 3, 147, "_reduce_none", 3, 147, "_reduce_28", 3, 147, "_reduce_29", 3, 147, "_reduce_30", 1, 147, "_reduce_none", 1, 161, "_reduce_none", 3, 161, "_reduce_33", 3, 161, "_reduce_34", 2, 161, "_reduce_35", 2, 161, "_reduce_36", 1, 161, "_reduce_none", 1, 151, "_reduce_none", 1, 153, "_reduce_none", 1, 153, "_reduce_none", 2, 153, "_reduce_41", 2, 153, "_reduce_42", 2, 153, "_reduce_43", 1, 165, "_reduce_none", 4, 165, "_reduce_none", 4, 165, "_reduce_none", 4, 170, "_reduce_none", 2, 164, "_reduce_48", 3, 164, "_reduce_none", 4, 164, "_reduce_50", 5, 164, "_reduce_none", 4, 164, "_reduce_52", 5, 164, "_reduce_none", 2, 164, "_reduce_54", 2, 164, "_reduce_55", 1, 154, "_reduce_56", 3, 154, "_reduce_57", 1, 174, "_reduce_58", 3, 174, "_reduce_59", 1, 173, "_reduce_60", 2, 173, "_reduce_61", 3, 173, "_reduce_62", 2, 173, "_reduce_63", 2, 173, "_reduce_64", 1, 173, "_reduce_65", 1, 176, "_reduce_66", 3, 176, "_reduce_67", 2, 175, "_reduce_68", 3, 175, "_reduce_69", 1, 177, "_reduce_70", 4, 177, "_reduce_none", 3, 177, "_reduce_none", 3, 177, "_reduce_none", 3, 177, "_reduce_none", 3, 177, "_reduce_none", 2, 177, "_reduce_none", 1, 177, "_reduce_none", 1, 152, "_reduce_78", 4, 152, "_reduce_79", 3, 152, "_reduce_80", 3, 152, "_reduce_81", 3, 152, "_reduce_82", 3, 152, "_reduce_none", 2, 152, "_reduce_none", 1, 152, "_reduce_none", 1, 179, "_reduce_none", 2, 180, "_reduce_87", 1, 180, "_reduce_88", 3, 180, "_reduce_89", 1, 181, "_reduce_none", 1, 181, "_reduce_none", 1, 181, "_reduce_none", 1, 181, "_reduce_93", 1, 181, "_reduce_94", 1, 149, "_reduce_95", 1, 149, "_reduce_96", 1, 150, "_reduce_97", 3, 150, "_reduce_98", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 3, 163, "_reduce_168", 5, 163, "_reduce_none", 3, 163, "_reduce_170", 6, 163, "_reduce_171", 5, 163, "_reduce_172", 5, 163, "_reduce_none", 5, 163, "_reduce_none", 5, 163, "_reduce_none", 4, 163, "_reduce_none", 3, 163, "_reduce_none", 3, 163, "_reduce_178", 3, 163, "_reduce_179", 3, 163, "_reduce_180", 3, 163, "_reduce_181", 3, 163, "_reduce_182", 3, 163, "_reduce_183", 3, 163, "_reduce_184", 3, 163, "_reduce_185", 4, 163, "_reduce_none", 4, 163, "_reduce_none", 2, 163, "_reduce_188", 2, 163, "_reduce_189", 3, 163, "_reduce_190", 3, 163, "_reduce_191", 3, 163, "_reduce_192", 3, 163, "_reduce_193", 3, 163, "_reduce_194", 3, 163, "_reduce_195", 3, 163, "_reduce_196", 3, 163, "_reduce_197", 3, 163, "_reduce_198", 3, 163, "_reduce_199", 3, 163, "_reduce_200", 3, 163, "_reduce_201", 3, 163, "_reduce_202", 2, 163, "_reduce_203", 2, 163, "_reduce_204", 3, 163, "_reduce_205", 3, 163, "_reduce_206", 3, 163, "_reduce_207", 3, 163, "_reduce_208", 3, 163, "_reduce_209", 5, 163, "_reduce_210", 1, 163, "_reduce_none", 1, 160, "_reduce_none", 1, 157, "_reduce_213", 2, 157, "_reduce_214", 2, 157, "_reduce_215", 3, 190, "_reduce_216", 4, 190, "_reduce_217", 4, 190, "_reduce_none", 6, 190, "_reduce_none", 1, 191, "_reduce_none", 1, 191, "_reduce_none", 1, 166, "_reduce_222", 2, 166, "_reduce_223", 2, 166, "_reduce_224", 4, 166, "_reduce_225", 1, 166, "_reduce_226", 4, 194, "_reduce_none", 1, 194, "_reduce_none", 0, 196, "_reduce_229", 2, 169, "_reduce_230", 1, 195, "_reduce_none", 2, 195, "_reduce_232", 3, 195, "_reduce_233", 2, 193, "_reduce_234", 2, 192, "_reduce_235", 1, 192, "_reduce_236", 1, 187, "_reduce_237", 2, 187, "_reduce_238", 3, 187, "_reduce_239", 4, 187, "_reduce_240", 3, 159, "_reduce_241", 4, 159, "_reduce_none", 2, 159, "_reduce_243", 1, 186, "_reduce_none", 1, 186, "_reduce_none", 1, 186, "_reduce_none", 1, 186, "_reduce_none", 1, 186, "_reduce_none", 1, 186, "_reduce_none", 1, 186, "_reduce_none", 1, 186, "_reduce_none", 1, 186, "_reduce_none", 0, 219, "_reduce_253", 4, 186, "_reduce_254", 4, 186, "_reduce_none", 3, 186, "_reduce_256", 3, 186, "_reduce_257", 2, 186, "_reduce_258", 4, 186, "_reduce_259", 3, 186, "_reduce_260", 3, 186, "_reduce_261", 1, 186, "_reduce_262", 4, 186, "_reduce_263", 3, 186, "_reduce_264", 1, 186, "_reduce_265", 5, 186, "_reduce_266", 2, 186, "_reduce_267", 1, 186, "_reduce_none", 2, 186, "_reduce_269", 2, 186, "_reduce_270", 6, 186, "_reduce_271", 6, 186, "_reduce_272", 0, 220, "_reduce_273", 0, 221, "_reduce_274", 7, 186, "_reduce_275", 0, 222, "_reduce_276", 0, 223, "_reduce_277", 7, 186, "_reduce_278", 5, 186, "_reduce_279", 4, 186, "_reduce_280", 5, 186, "_reduce_281", 0, 224, "_reduce_282", 0, 225, "_reduce_283", 9, 186, "_reduce_none", 0, 226, "_reduce_285", 0, 227, "_reduce_286", 7, 186, "_reduce_287", 0, 228, "_reduce_288", 0, 229, "_reduce_289", 8, 186, "_reduce_290", 0, 230, "_reduce_291", 0, 231, "_reduce_292", 6, 186, "_reduce_293", 0, 232, "_reduce_294", 6, 186, "_reduce_295", 0, 233, "_reduce_296", 0, 234, "_reduce_297", 9, 186, "_reduce_298", 1, 186, "_reduce_299", 1, 186, "_reduce_300", 1, 186, "_reduce_301", 1, 186, "_reduce_none", 1, 156, "_reduce_none", 1, 209, "_reduce_none", 1, 209, "_reduce_none", 1, 209, "_reduce_none", 2, 209, "_reduce_none", 1, 211, "_reduce_none", 1, 211, "_reduce_none", 1, 211, "_reduce_none", 2, 208, "_reduce_311", 3, 235, "_reduce_312", 2, 235, "_reduce_313", 1, 235, "_reduce_none", 1, 235, "_reduce_none", 3, 236, "_reduce_316", 3, 236, "_reduce_317", 1, 210, "_reduce_318", 0, 238, "_reduce_319", 6, 210, "_reduce_320", 1, 142, "_reduce_none", 2, 142, "_reduce_322", 1, 213, "_reduce_323", 6, 237, "_reduce_324", 4, 237, "_reduce_325", 4, 237, "_reduce_326", 2, 237, "_reduce_327", 4, 237, "_reduce_328", 2, 237, "_reduce_329", 2, 237, "_reduce_330", 1, 237, "_reduce_331", 1, 240, "_reduce_332", 3, 240, "_reduce_333", 3, 244, "_reduce_334", 1, 171, "_reduce_none", 2, 171, "_reduce_336", 1, 171, "_reduce_337", 3, 171, "_reduce_338", 0, 246, "_reduce_339", 5, 245, "_reduce_340", 2, 167, "_reduce_341", 4, 167, "_reduce_none", 4, 167, "_reduce_none", 2, 207, "_reduce_344", 4, 207, "_reduce_345", 3, 207, "_reduce_346", 4, 207, "_reduce_347", 3, 207, "_reduce_348", 2, 207, "_reduce_349", 1, 207, "_reduce_350", 0, 248, "_reduce_351", 5, 206, "_reduce_352", 0, 249, "_reduce_353", 5, 206, "_reduce_354", 0, 251, "_reduce_355", 6, 212, "_reduce_356", 1, 250, "_reduce_357", 1, 250, "_reduce_none", 6, 141, "_reduce_359", 0, 141, "_reduce_360", 1, 252, "_reduce_361", 1, 252, "_reduce_none", 1, 252, "_reduce_none", 2, 253, "_reduce_364", 1, 253, "_reduce_365", 2, 143, "_reduce_366", 1, 143, "_reduce_none", 1, 198, "_reduce_368", 1, 198, "_reduce_369", 1, 198, "_reduce_none", 1, 199, "_reduce_371", 1, 256, "_reduce_none", 2, 256, "_reduce_none", 3, 257, "_reduce_374", 1, 257, "_reduce_375", 3, 200, "_reduce_376", 3, 201, "_reduce_377", 3, 202, "_reduce_378", 3, 202, "_reduce_379", 1, 260, "_reduce_380", 3, 260, "_reduce_381", 1, 261, "_reduce_382", 2, 261, "_reduce_383", 3, 203, "_reduce_384", 3, 203, "_reduce_385", 1, 263, "_reduce_386", 3, 263, "_reduce_387", 1, 258, "_reduce_388", 2, 258, "_reduce_389", 1, 259, "_reduce_390", 2, 259, "_reduce_391", 1, 262, "_reduce_392", 0, 265, "_reduce_393", 3, 262, "_reduce_394", 0, 266, "_reduce_395", 4, 262, "_reduce_396", 1, 264, "_reduce_397", 1, 264, "_reduce_398", 1, 264, "_reduce_399", 1, 264, "_reduce_none", 2, 184, "_reduce_401", 1, 184, "_reduce_none", 1, 267, "_reduce_none", 1, 267, "_reduce_none", 1, 267, "_reduce_none", 1, 267, "_reduce_none", 3, 255, "_reduce_407", 1, 254, "_reduce_none", 1, 254, "_reduce_none", 2, 254, "_reduce_none", 2, 254, "_reduce_none", 1, 178, "_reduce_412", 1, 178, "_reduce_413", 1, 178, "_reduce_414", 1, 178, "_reduce_415", 1, 178, "_reduce_416", 1, 178, "_reduce_417", 1, 178, "_reduce_418", 1, 178, "_reduce_419", 1, 178, "_reduce_420", 1, 178, "_reduce_421", 1, 178, "_reduce_422", 1, 204, "_reduce_423", 1, 155, "_reduce_424", 1, 158, "_reduce_none", 1, 158, "_reduce_none", 1, 214, "_reduce_427", 3, 214, "_reduce_428", 2, 214, "_reduce_429", 4, 216, "_reduce_430", 2, 216, "_reduce_431", 6, 268, "_reduce_432", 4, 268, "_reduce_433", 4, 268, "_reduce_434", 2, 268, "_reduce_435", 4, 268, "_reduce_436", 2, 268, "_reduce_437", 2, 268, "_reduce_438", 1, 268, "_reduce_439", 0, 268, "_reduce_440", 1, 270, "_reduce_441", 1, 270, "_reduce_442", 1, 270, "_reduce_443", 1, 270, "_reduce_444", 1, 270, "_reduce_445", 1, 239, "_reduce_446", 3, 239, "_reduce_447", 3, 271, "_reduce_448", 1, 269, "_reduce_449", 3, 269, "_reduce_450", 1, 272, "_reduce_none", 1, 272, "_reduce_none", 2, 241, "_reduce_453", 1, 241, "_reduce_454", 1, 273, "_reduce_none", 1, 273, "_reduce_none", 2, 243, "_reduce_457", 2, 242, "_reduce_458", 0, 242, "_reduce_459", 1, 217, "_reduce_460", 4, 217, "_reduce_461", 1, 205, "_reduce_462", 2, 205, "_reduce_463", 2, 205, "_reduce_464", 1, 189, "_reduce_465", 3, 189, "_reduce_466", 3, 274, "_reduce_467", 2, 274, "_reduce_468", 1, 172, "_reduce_none", 1, 172, "_reduce_none", 1, 172, "_reduce_none", 1, 168, "_reduce_none", 1, 168, "_reduce_none", 1, 168, "_reduce_none", 1, 168, "_reduce_none", 1, 247, "_reduce_none", 1, 247, "_reduce_none", 1, 247, "_reduce_none", 1, 218, "_reduce_none", 1, 218, "_reduce_none", 0, 145, "_reduce_none", 1, 145, "_reduce_none", 0, 185, "_reduce_none", 1, 185, "_reduce_none", 0, 188, "_reduce_none", 1, 188, "_reduce_none", 1, 188, "_reduce_none", 1, 215, "_reduce_none", 1, 215, "_reduce_none", 1, 148, "_reduce_none", 2, 148, "_reduce_none", 0, 146, "_reduce_none", 0, 197, "_reduce_none"];

      racc_reduce_n = 494;

      racc_shift_n = 867;

      racc_token_table = __hash(false, 0, "error", 1, "CLASS", 2, "MODULE", 3, "DEF", 4, "UNDEF", 5, "BEGIN", 6, "RESCUE", 7, "ENSURE", 8, "END", 9, "IF", 10, "UNLESS", 11, "THEN", 12, "ELSIF", 13, "ELSE", 14, "CASE", 15, "WHEN", 16, "WHILE", 17, "UNTIL", 18, "FOR", 19, "BREAK", 20, "NEXT", 21, "REDO", 22, "RETRY", 23, "IN", 24, "DO", 25, "DO_COND", 26, "DO_BLOCK", 27, "RETURN", 28, "YIELD", 29, "SUPER", 30, "SELF", 31, "NIL", 32, "TRUE", 33, "FALSE", 34, "AND", 35, "OR", 36, "NOT", 37, "IF_MOD", 38, "UNLESS_MOD", 39, "WHILE_MOD", 40, "UNTIL_MOD", 41, "RESCUE_MOD", 42, "ALIAS", 43, "DEFINED", 44, "klBEGIN", 45, "klEND", 46, "LINE", 47, "FILE", 48, "IDENTIFIER", 49, "FID", 50, "GVAR", 51, "IVAR", 52, "CONSTANT", 53, "CVAR", 54, "NTH_REF", 55, "BACK_REF", 56, "STRING_CONTENT", 57, "INTEGER", 58, "FLOAT", 59, "REGEXP_END", 60, "+@", 61, "-@", 62, "-@NUM", 63, "**", 64, "<=>", 65, "==", 66, "===", 67, "!=", 68, ">=", 69, "<=", 70, "&&", 71, "||", 72, "=~", 73, "!~", 74, ".", 75, "..", 76, "...", 77, "[]", 78, "[]=", 79, "<<", 80, ">>", 81, "::", 82, "::@", 83, "OP_ASGN", 84, "=>", 85, "PAREN_BEG", 86, "(", 87, ")", 88, "tLPAREN_ARG", 89, "ARRAY_BEG", 90, "]", 91, "tLBRACE", 92, "tLBRACE_ARG", 93, "SPLAT", 94, "*", 95, "&@", 96, "&", 97, "~", 98, "%", 99, "/", 100, "+", 101, "-", 102, "<", 103, ">", 104, "|", 105, "!", 106, "^", 107, "LCURLY", 108, "}", 109, "BACK_REF2", 110, "SYMBOL_BEG", 111, "STRING_BEG", 112, "XSTRING_BEG", 113, "REGEXP_BEG", 114, "WORDS_BEG", 115, "AWORDS_BEG", 116, "STRING_DBEG", 117, "STRING_DVAR", 118, "STRING_END", 119, "STRING", 120, "SYMBOL", 121, "\\n", 122, "?", 123, ":", 124, ",", 125, "SPACE", 126, ";", 127, "LABEL", 128, "LAMBDA", 129, "LAMBEG", 130, "DO_LAMBDA", 131, "=", 132, "LOWEST", 133, "[@", 134, "[", 135, "{", 136);

      racc_nt_base = 137;

      racc_use_result_var = true;

      __scope.Racc_arg = [racc_action_table, racc_action_check, racc_action_default, racc_action_pointer, racc_goto_table, racc_goto_check, racc_goto_default, racc_goto_pointer, racc_nt_base, racc_reduce_table, racc_token_table, racc_shift_n, racc_reduce_n, racc_use_result_var];

      __scope.Racc_token_to_s_table = ["$end", "error", "CLASS", "MODULE", "DEF", "UNDEF", "BEGIN", "RESCUE", "ENSURE", "END", "IF", "UNLESS", "THEN", "ELSIF", "ELSE", "CASE", "WHEN", "WHILE", "UNTIL", "FOR", "BREAK", "NEXT", "REDO", "RETRY", "IN", "DO", "DO_COND", "DO_BLOCK", "RETURN", "YIELD", "SUPER", "SELF", "NIL", "TRUE", "FALSE", "AND", "OR", "NOT", "IF_MOD", "UNLESS_MOD", "WHILE_MOD", "UNTIL_MOD", "RESCUE_MOD", "ALIAS", "DEFINED", "klBEGIN", "klEND", "LINE", "FILE", "IDENTIFIER", "FID", "GVAR", "IVAR", "CONSTANT", "CVAR", "NTH_REF", "BACK_REF", "STRING_CONTENT", "INTEGER", "FLOAT", "REGEXP_END", "\"+@\"", "\"-@\"", "\"-@NUM\"", "\"**\"", "\"<=>\"", "\"==\"", "\"===\"", "\"!=\"", "\">=\"", "\"<=\"", "\"&&\"", "\"||\"", "\"=~\"", "\"!~\"", "\".\"", "\"..\"", "\"...\"", "\"[]\"", "\"[]=\"", "\"<<\"", "\">>\"", "\"::\"", "\"::@\"", "OP_ASGN", "\"=>\"", "PAREN_BEG", "\"(\"", "\")\"", "tLPAREN_ARG", "ARRAY_BEG", "\"]\"", "tLBRACE", "tLBRACE_ARG", "SPLAT", "\"*\"", "\"&@\"", "\"&\"", "\"~\"", "\"%\"", "\"/\"", "\"+\"", "\"-\"", "\"<\"", "\">\"", "\"|\"", "\"!\"", "\"^\"", "LCURLY", "\"}\"", "BACK_REF2", "SYMBOL_BEG", "STRING_BEG", "XSTRING_BEG", "REGEXP_BEG", "WORDS_BEG", "AWORDS_BEG", "STRING_DBEG", "STRING_DVAR", "STRING_END", "STRING", "SYMBOL", "\"\\\\n\"", "\"?\"", "\":\"", "\",\"", "SPACE", "\";\"", "LABEL", "LAMBDA", "LAMBEG", "DO_LAMBDA", "\"=\"", "LOWEST", "\"[@\"", "\"[\"", "\"{\"", "$start", "target", "compstmt", "bodystmt", "opt_rescue", "opt_else", "opt_ensure", "stmts", "opt_terms", "none", "stmt", "terms", "fitem", "undef_list", "expr_value", "lhs", "command_call", "mlhs", "var_lhs", "primary_value", "aref_args", "backref", "mrhs", "arg_value", "expr", "@1", "arg", "command", "block_command", "call_args", "block_call", "operation2", "command_args", "cmd_brace_block", "opt_block_var", "operation", "mlhs_basic", "mlhs_entry", "mlhs_head", "mlhs_item", "mlhs_node", "variable", "cname", "cpath", "fname", "op", "reswords", "symbol", "opt_nl", "primary", "args", "trailer", "assocs", "paren_args", "opt_paren_args", "opt_block_arg", "block_arg", "call_args2", "open_args", "@2", "none_block_pass", "literal", "strings", "xstring", "regexp", "words", "awords", "var_ref", "assoc_list", "brace_block", "method_call", "lambda", "then", "if_tail", "do", "case_body", "block_var", "superclass", "term", "f_arglist", "singleton", "dot_or_colon", "@3", "@4", "@5", "@6", "@7", "@8", "@9", "@10", "@11", "@12", "@13", "@14", "@15", "@16", "@17", "@18", "f_larglist", "lambda_body", "block_var_args", "@19", "f_arg", "f_block_optarg", "f_rest_arg", "opt_f_block_arg", "f_block_arg", "f_block_opt", "do_block", "@20", "operation3", "@21", "@22", "cases", "@23", "exc_list", "exc_var", "numeric", "dsym", "string", "string1", "string_contents", "xstring_contents", "word_list", "word", "string_content", "qword_list", "string_dvar", "@24", "@25", "sym", "f_args", "f_optarg", "f_norm_arg", "f_opt", "restarg_mark", "blkarg_mark", "assoc"];

      __scope.Racc_debug_parser = false;

      Grammar_prototype.$_reduce_1 = function(val, _values, result) {

        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_2 = function(val, _values, result) {

        result = this.$new_body(val['$[]'](0), val['$[]'](1), val['$[]'](2), val['$[]'](3));
        return result;
      };

      Grammar_prototype.$_reduce_3 = function(val, _values, result) {
        var comp = nil, __a, __b;
        comp = this.$new_compstmt(val['$[]'](0));
        if ((__a = (__b = ((__b = comp !== false && comp !== nil) ? comp['$[]'](0)['$==']("begin") : __b), __b !== false && __b !== nil ? comp.$size()['$=='](2) : __b)) !== false && __a !== nil) {
          result = comp['$[]'](1);
          result['$line='](comp.$line());
          } else {
          result = comp
        };
        return result;
      };

      Grammar_prototype.$_reduce_4 = function(val, _values, result) {

        result = this.$new_block();
        return result;
      };

      Grammar_prototype.$_reduce_5 = function(val, _values, result) {

        result = this.$new_block(val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_6 = function(val, _values, result) {

        val['$[]'](0)['$<<'](val['$[]'](2));
        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_7 = function(val, _values, result) {

        this.lex_state = "expr_fname";
        return result;
      };

      Grammar_prototype.$_reduce_8 = function(val, _values, result) {

        result = this.$s("alias", val['$[]'](1), val['$[]'](3));
        return result;
      };

      Grammar_prototype.$_reduce_9 = function(val, _values, result) {

        result = this.$s("valias", val['$[]'](1).$intern(), val['$[]'](2).$intern());
        return result;
      };

      Grammar_prototype.$_reduce_11 = function(val, _values, result) {

        result = this.$s("valias", val['$[]'](1).$intern(), val['$[]'](2).$intern());
        return result;
      };

      Grammar_prototype.$_reduce_12 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_13 = function(val, _values, result) {

        result = this.$new_if(val['$[]'](2), val['$[]'](0), nil);
        return result;
      };

      Grammar_prototype.$_reduce_14 = function(val, _values, result) {

        result = this.$new_if(val['$[]'](2), nil, val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_15 = function(val, _values, result) {

        result = this.$s("while", val['$[]'](2), val['$[]'](0), true);
        return result;
      };

      Grammar_prototype.$_reduce_16 = function(val, _values, result) {

        result = this.$s("until", val['$[]'](2), val['$[]'](0), true);
        return result;
      };

      Grammar_prototype.$_reduce_20 = function(val, _values, result) {

        result = this.$new_assign(val['$[]'](0), val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_21 = function(val, _values, result) {

        result = this.$s("masgn", val['$[]'](0), this.$s("to_ary", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_22 = function(val, _values, result) {

        result = this.$new_op_asgn(val['$[]'](1).$intern(), val['$[]'](0), val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_24 = function(val, _values, result) {

        result = this.$s("op_asgn2", val['$[]'](0), ("" + (val['$[]'](2)) + "=").$intern(), val['$[]'](3).$intern(), val['$[]'](4));
        return result;
      };

      Grammar_prototype.$_reduce_28 = function(val, _values, result) {

        result = this.$new_assign(val['$[]'](0), this.$s("svalue", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_29 = function(val, _values, result) {

        result = this.$s("masgn", val['$[]'](0), this.$s("to_ary", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_30 = function(val, _values, result) {

        result = this.$s("masgn", val['$[]'](0), val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_33 = function(val, _values, result) {

        result = this.$s("and", val['$[]'](0), val['$[]'](2));
        result['$line='](val['$[]'](0).$line());
        return result;
      };

      Grammar_prototype.$_reduce_34 = function(val, _values, result) {

        result = this.$s("or", val['$[]'](0), val['$[]'](2));
        result['$line='](val['$[]'](0).$line());
        return result;
      };

      Grammar_prototype.$_reduce_35 = function(val, _values, result) {

        result = this.$s("not", val['$[]'](1));
        result['$line='](val['$[]'](1).$line());
        return result;
      };

      Grammar_prototype.$_reduce_36 = function(val, _values, result) {

        result = this.$s("not", val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_41 = function(val, _values, result) {
        var args = nil;
        args = val['$[]'](1);
        if (args.$size()['$=='](2)) {
          args = args['$[]'](1)
        };
        result = this.$s("return", args);
        return result;
      };

      Grammar_prototype.$_reduce_42 = function(val, _values, result) {
        var args = nil;
        args = val['$[]'](1);
        if (args.$size()['$=='](2)) {
          args = args['$[]'](1)
        };
        result = this.$s("break", args);
        return result;
      };

      Grammar_prototype.$_reduce_43 = function(val, _values, result) {
        var args = nil;
        args = val['$[]'](1);
        if (args.$size()['$=='](2)) {
          args = args['$[]'](1)
        };
        result = this.$s("next", args);
        return result;
      };

      Grammar_prototype.$_reduce_48 = function(val, _values, result) {

        result = this.$new_call(nil, val['$[]'](0).$intern(), val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_50 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), val['$[]'](2).$intern(), val['$[]'](3));
        return result;
      };

      Grammar_prototype.$_reduce_52 = function(val, _values, result) {

        result = "result = ['call', val[0], val[2], val[3]];";
        return result;
      };

      Grammar_prototype.$_reduce_54 = function(val, _values, result) {

        result = this.$new_super(val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_55 = function(val, _values, result) {

        result = this.$new_yield(val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_56 = function(val, _values, result) {

        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_57 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_58 = function(val, _values, result) {

        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_59 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_60 = function(val, _values, result) {

        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_61 = function(val, _values, result) {

        result = val['$[]'](0)['$<<'](val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_62 = function(val, _values, result) {

        result = val['$[]'](0)['$<<'](this.$s("splat", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_63 = function(val, _values, result) {

        result = val['$[]'](0)['$<<'](this.$s("splat"));
        return result;
      };

      Grammar_prototype.$_reduce_64 = function(val, _values, result) {

        result = this.$s("array", this.$s("splat", val['$[]'](1)));
        return result;
      };

      Grammar_prototype.$_reduce_65 = function(val, _values, result) {

        result = this.$s("array", this.$s("splat"));
        return result;
      };

      Grammar_prototype.$_reduce_66 = function(val, _values, result) {

        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_67 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_68 = function(val, _values, result) {

        result = this.$s("array", val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_69 = function(val, _values, result) {

        result = val['$[]'](0)['$<<'](val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_70 = function(val, _values, result) {

        result = this.$new_assignable(val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_78 = function(val, _values, result) {

        result = this.$new_assignable(val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_79 = function(val, _values, result) {
        var args = nil;
        args = val['$[]'](2);
        if (args['$[]'](0)['$==']("array")) {
          args['$[]='](0, "arglist")
        };
        result = this.$s("attrasgn", val['$[]'](0), "[]=", args);
        return result;
      };

      Grammar_prototype.$_reduce_80 = function(val, _values, result) {

        result = this.$s("attrasgn", val['$[]'](0), ("" + (val['$[]'](2)) + "=").$intern(), this.$s("arglist"));
        return result;
      };

      Grammar_prototype.$_reduce_81 = function(val, _values, result) {

        result = this.$s("attrasgn", val['$[]'](0), ("" + (val['$[]'](2)) + "=").$intern(), this.$s("arglist"));
        return result;
      };

      Grammar_prototype.$_reduce_82 = function(val, _values, result) {

        result = this.$s("attrasgn", val['$[]'](0), ("" + (val['$[]'](2)) + "=").$intern(), this.$s("arglist"));
        return result;
      };

      Grammar_prototype.$_reduce_87 = function(val, _values, result) {

        result = this.$s("colon3", val['$[]'](1).$intern());
        return result;
      };

      Grammar_prototype.$_reduce_88 = function(val, _values, result) {

        result = val['$[]'](0).$intern();
        return result;
      };

      Grammar_prototype.$_reduce_89 = function(val, _values, result) {

        result = this.$s("colon2", val['$[]'](0), val['$[]'](2).$intern());
        return result;
      };

      Grammar_prototype.$_reduce_93 = function(val, _values, result) {

        this.lex_state = "expr_end";
        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_94 = function(val, _values, result) {

        this.lex_state = "expr_end";
        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_95 = function(val, _values, result) {

        result = this.$s("lit", val['$[]'](0).$intern());
        return result;
      };

      Grammar_prototype.$_reduce_96 = function(val, _values, result) {

        result = this.$s("lit", val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_97 = function(val, _values, result) {

        result = this.$s("undef", val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_98 = function(val, _values, result) {

        result = val['$[]'](0)['$<<'](val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_168 = function(val, _values, result) {

        result = this.$new_assign(val['$[]'](0), val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_170 = function(val, _values, result) {

        result = this.$new_op_asgn(val['$[]'](1).$intern(), val['$[]'](0), val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_171 = function(val, _values, result) {
        var args = nil;
        args = val['$[]'](2);
        if (args['$[]'](0)['$==']("array")) {
          args['$[]='](0, "arglist")
        };
        result = this.$s("op_asgn1", val['$[]'](0), val['$[]'](2), val['$[]'](4).$intern(), val['$[]'](5));
        result['$line='](val['$[]'](0).$line());
        return result;
      };

      Grammar_prototype.$_reduce_172 = function(val, _values, result) {

        result = this.$s("op_asgn2", val['$[]'](0), ("" + (val['$[]'](2)) + "=").$intern(), val['$[]'](3).$intern(), val['$[]'](4));
        return result;
      };

      Grammar_prototype.$_reduce_178 = function(val, _values, result) {

        result = this.$s("dot2", val['$[]'](0), val['$[]'](2));
        result['$line='](val['$[]'](0).$line());
        return result;
      };

      Grammar_prototype.$_reduce_179 = function(val, _values, result) {

        result = this.$s("dot3", val['$[]'](0), val['$[]'](2));
        result['$line='](val['$[]'](0).$line());
        return result;
      };

      Grammar_prototype.$_reduce_180 = function(val, _values, result) {

        result = this.$s("operator", "+", val['$[]'](0), val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_181 = function(val, _values, result) {

        result = this.$s("operator", "-", val['$[]'](0), val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_182 = function(val, _values, result) {

        result = this.$s("operator", "*", val['$[]'](0), val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_183 = function(val, _values, result) {

        result = this.$s("operator", "/", val['$[]'](0), val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_184 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), "%", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_185 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), "**", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_188 = function(val, _values, result) {
        var __a, __b;
        result = this.$new_call(val['$[]'](1), "+@", this.$s("arglist"));
        if ((__a = ((__b = val['$[]'](1)['$[]'](0)['$==']("lit")) ? __scope.Numeric['$==='](val['$[]'](1)['$[]'](1)) : __b)) !== false && __a !== nil) {
          result = val['$[]'](1)
        };
        return result;
      };

      Grammar_prototype.$_reduce_189 = function(val, _values, result) {
        var __a, __b;
        result = this.$new_call(val['$[]'](1), "-@", this.$s("arglist"));
        if ((__a = ((__b = val['$[]'](1)['$[]'](0)['$==']("lit")) ? __scope.Numeric['$==='](val['$[]'](1)['$[]'](1)) : __b)) !== false && __a !== nil) {
          val['$[]'](1)['$[]='](1, val['$[]'](1)['$[]'](1)['$-@']());
          result = val['$[]'](1);
        };
        return result;
      };

      Grammar_prototype.$_reduce_190 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), "|", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_191 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), "^", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_192 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), "&", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_193 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), "<=>", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_194 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), ">", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_195 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), ">=", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_196 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), "<", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_197 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), "<=", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_198 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), "==", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_199 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), "===", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_200 = function(val, _values, result) {

        result = this.$s("not", this.$new_call(val['$[]'](0), "==", this.$s("arglist", val['$[]'](2))));
        return result;
      };

      Grammar_prototype.$_reduce_201 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), "=~", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_202 = function(val, _values, result) {

        result = this.$s("not", this.$new_call(val['$[]'](0), "=~", this.$s("arglist", val['$[]'](2))));
        return result;
      };

      Grammar_prototype.$_reduce_203 = function(val, _values, result) {

        result = this.$s("not", val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_204 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](1), "~", this.$s("arglist"));
        return result;
      };

      Grammar_prototype.$_reduce_205 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), "<<", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_206 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), ">>", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_207 = function(val, _values, result) {

        result = this.$s("and", val['$[]'](0), val['$[]'](2));
        result['$line='](val['$[]'](0).$line());
        return result;
      };

      Grammar_prototype.$_reduce_208 = function(val, _values, result) {

        result = this.$s("or", val['$[]'](0), val['$[]'](2));
        result['$line='](val['$[]'](0).$line());
        return result;
      };

      Grammar_prototype.$_reduce_209 = function(val, _values, result) {

        result = this.$s("defined", val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_210 = function(val, _values, result) {

        result = this.$s("if", val['$[]'](0), val['$[]'](2), val['$[]'](4));
        result['$line='](val['$[]'](0).$line());
        return result;
      };

      Grammar_prototype.$_reduce_213 = function(val, _values, result) {

        result = nil;
        return result;
      };

      Grammar_prototype.$_reduce_214 = function(val, _values, result) {

        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_215 = function(val, _values, result) {

        result = this.$s("array", this.$s.apply(this, ["hash"].concat(val['$[]'](0))));
        return result;
      };

      Grammar_prototype.$_reduce_216 = function(val, _values, result) {

        result = nil;
        return result;
      };

      Grammar_prototype.$_reduce_217 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_222 = function(val, _values, result) {

        result = this.$s("array", val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_223 = function(val, _values, result) {

        result = val['$[]'](0);
        this.$add_block_pass(val['$[]'](0), val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_224 = function(val, _values, result) {

        result = this.$s("arglist", this.$s.apply(this, ["hash"].concat(val['$[]'](0))));
        this.$add_block_pass(result, val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_225 = function(val, _values, result) {

        result = val['$[]'](0);
        result['$<<'](this.$s.apply(this, ["hash"].concat(val['$[]'](2))));
        return result;
      };

      Grammar_prototype.$_reduce_226 = function(val, _values, result) {

        result = this.$s("arglist");
        this.$add_block_pass(result, val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_229 = function(val, _values, result) {

        this.$cmdarg_push(1);
        return result;
      };

      Grammar_prototype.$_reduce_230 = function(val, _values, result) {

        this.$cmdarg_pop();
        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_232 = function(val, _values, result) {

        result = nil;
        return result;
      };

      Grammar_prototype.$_reduce_233 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_234 = function(val, _values, result) {

        result = this.$s("block_pass", val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_235 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_236 = function(val, _values, result) {

        result = nil;
        return result;
      };

      Grammar_prototype.$_reduce_237 = function(val, _values, result) {

        result = this.$s("array", val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_238 = function(val, _values, result) {

        result = this.$s("array", this.$s("splat", val['$[]'](1)));
        return result;
      };

      Grammar_prototype.$_reduce_239 = function(val, _values, result) {

        result = val['$[]'](0)['$<<'](val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_240 = function(val, _values, result) {

        result = val['$[]'](0)['$<<'](this.$s("splat", val['$[]'](3)));
        return result;
      };

      Grammar_prototype.$_reduce_241 = function(val, _values, result) {

        val['$[]'](0)['$<<'](val['$[]'](2));
        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_243 = function(val, _values, result) {

        result = this.$s("splat", val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_253 = function(val, _values, result) {

        result = this.line;
        return result;
      };

      Grammar_prototype.$_reduce_254 = function(val, _values, result) {

        result = this.$s("begin", val['$[]'](2));
        result['$line='](val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_256 = function(val, _values, result) {
        var __a;
        result = ((__a = val['$[]'](1)), __a !== false && __a !== nil ? __a : this.$s("nil"));
        return result;
      };

      Grammar_prototype.$_reduce_257 = function(val, _values, result) {

        result = this.$s("colon2", val['$[]'](0), val['$[]'](2).$intern());
        return result;
      };

      Grammar_prototype.$_reduce_258 = function(val, _values, result) {

        result = this.$s("colon3", val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_259 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), "[]", val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_260 = function(val, _values, result) {
        var __a;
        result = ((__a = val['$[]'](1)), __a !== false && __a !== nil ? __a : this.$s("array"));
        return result;
      };

      Grammar_prototype.$_reduce_261 = function(val, _values, result) {

        result = this.$s.apply(this, ["hash"].concat(val['$[]'](1)));
        return result;
      };

      Grammar_prototype.$_reduce_262 = function(val, _values, result) {

        result = this.$s("return");
        return result;
      };

      Grammar_prototype.$_reduce_263 = function(val, _values, result) {

        result = this.$new_yield(val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_264 = function(val, _values, result) {

        result = this.$s("yield");
        return result;
      };

      Grammar_prototype.$_reduce_265 = function(val, _values, result) {

        result = this.$s("yield");
        return result;
      };

      Grammar_prototype.$_reduce_266 = function(val, _values, result) {

        result = this.$s("defined", val['$[]'](3));
        return result;
      };

      Grammar_prototype.$_reduce_267 = function(val, _values, result) {

        result = val['$[]'](1);
        result['$[]='](1, this.$new_call(nil, val['$[]'](0).$intern(), this.$s("arglist")));
        return result;
      };

      Grammar_prototype.$_reduce_269 = function(val, _values, result) {

        result = val['$[]'](1);
        result['$[]='](1, val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_270 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_271 = function(val, _values, result) {

        result = this.$new_if(val['$[]'](1), val['$[]'](3), val['$[]'](4));
        return result;
      };

      Grammar_prototype.$_reduce_272 = function(val, _values, result) {

        result = this.$new_if(val['$[]'](1), val['$[]'](4), val['$[]'](3));
        return result;
      };

      Grammar_prototype.$_reduce_273 = function(val, _values, result) {

        this.$cond_push(1);
        result = this.line;
        return result;
      };

      Grammar_prototype.$_reduce_274 = function(val, _values, result) {

        this.$cond_pop();
        return result;
      };

      Grammar_prototype.$_reduce_275 = function(val, _values, result) {

        result = this.$s("while", val['$[]'](2), val['$[]'](5), true);
        result['$line='](val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_276 = function(val, _values, result) {

        this.$cond_push(1);
        result = this.line;
        return result;
      };

      Grammar_prototype.$_reduce_277 = function(val, _values, result) {

        this.$cond_pop();
        return result;
      };

      Grammar_prototype.$_reduce_278 = function(val, _values, result) {

        result = this.$s("until", val['$[]'](2), val['$[]'](5), true);
        result['$line='](val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_279 = function(val, _values, result) {

        result = this.$s.apply(this, ["case", val['$[]'](1)].concat(val['$[]'](3)));
        result['$line='](val['$[]'](1).$line());
        return result;
      };

      Grammar_prototype.$_reduce_280 = function(val, _values, result) {

        result = this.$s.apply(this, ["case", nil].concat(val['$[]'](2)));
        result['$line='](val['$[]'](2).$line());
        return result;
      };

      Grammar_prototype.$_reduce_281 = function(val, _values, result) {

        result = this.$s("case", nil, val['$[]'](3));
        result['$line='](val['$[]'](3).$line());
        return result;
      };

      Grammar_prototype.$_reduce_282 = function(val, _values, result) {

        result = "this.cond_push(1);";
        return result;
      };

      Grammar_prototype.$_reduce_283 = function(val, _values, result) {

        result = "this.cond_pop();";
        return result;
      };

      Grammar_prototype.$_reduce_285 = function(val, _values, result) {

        result = this.line;
        return result;
      };

      Grammar_prototype.$_reduce_286 = function(val, _values, result) {

        return result;
      };

      Grammar_prototype.$_reduce_287 = function(val, _values, result) {

        result = this.$new_class(val['$[]'](2), val['$[]'](3), val['$[]'](5));
        result['$line='](val['$[]'](1));
        result['$end_line='](this.line);
        return result;
      };

      Grammar_prototype.$_reduce_288 = function(val, _values, result) {

        result = this.line;
        return result;
      };

      Grammar_prototype.$_reduce_289 = function(val, _values, result) {

        return result;
      };

      Grammar_prototype.$_reduce_290 = function(val, _values, result) {

        result = this.$new_sclass(val['$[]'](3), val['$[]'](6));
        result['$line='](val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_291 = function(val, _values, result) {

        result = this.line;
        return result;
      };

      Grammar_prototype.$_reduce_292 = function(val, _values, result) {

        return result;
      };

      Grammar_prototype.$_reduce_293 = function(val, _values, result) {

        result = this.$new_module(val['$[]'](2), val['$[]'](4));
        result['$line='](val['$[]'](1));
        result['$end_line='](this.line);
        return result;
      };

      Grammar_prototype.$_reduce_294 = function(val, _values, result) {

        result = this.scope_line;
        this.$push_scope();
        return result;
      };

      Grammar_prototype.$_reduce_295 = function(val, _values, result) {

        result = this.$new_defn(val['$[]'](2), val['$[]'](1), val['$[]'](3), val['$[]'](4));
        this.$pop_scope();
        return result;
      };

      Grammar_prototype.$_reduce_296 = function(val, _values, result) {

        return result;
      };

      Grammar_prototype.$_reduce_297 = function(val, _values, result) {

        result = this.scope_line;
        this.$push_scope();
        return result;
      };

      Grammar_prototype.$_reduce_298 = function(val, _values, result) {

        result = this.$new_defs(val['$[]'](5), val['$[]'](1), val['$[]'](4), val['$[]'](6), val['$[]'](7));
        this.$pop_scope();
        return result;
      };

      Grammar_prototype.$_reduce_299 = function(val, _values, result) {

        result = this.$s("break");
        return result;
      };

      Grammar_prototype.$_reduce_300 = function(val, _values, result) {

        result = this.$s("next");
        return result;
      };

      Grammar_prototype.$_reduce_301 = function(val, _values, result) {

        result = this.$s("redo");
        return result;
      };

      Grammar_prototype.$_reduce_311 = function(val, _values, result) {
        var call = nil;
        call = this.$new_call(nil, "lambda", this.$s("arglist"));
        result = this.$new_iter(call, val['$[]'](0), val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_312 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_313 = function(val, _values, result) {

        result = nil;
        return result;
      };

      Grammar_prototype.$_reduce_316 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_317 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_318 = function(val, _values, result) {

        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_319 = function(val, _values, result) {

        result = this.line;
        return result;
      };

      Grammar_prototype.$_reduce_320 = function(val, _values, result) {

        result = this.$s("if", val['$[]'](2), val['$[]'](4), val['$[]'](5));
        result['$line='](val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_322 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_323 = function(val, _values, result) {

        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_324 = function(val, _values, result) {

        result = this.$new_block_args(val['$[]'](0), val['$[]'](2), val['$[]'](4), val['$[]'](5));
        return result;
      };

      Grammar_prototype.$_reduce_325 = function(val, _values, result) {

        result = this.$new_block_args(val['$[]'](0), val['$[]'](2), nil, val['$[]'](3));
        return result;
      };

      Grammar_prototype.$_reduce_326 = function(val, _values, result) {

        result = this.$new_block_args(val['$[]'](0), nil, val['$[]'](2), val['$[]'](3));
        return result;
      };

      Grammar_prototype.$_reduce_327 = function(val, _values, result) {

        result = this.$new_block_args(val['$[]'](0), nil, nil, val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_328 = function(val, _values, result) {

        result = this.$new_block_args(nil, val['$[]'](0), val['$[]'](2), val['$[]'](3));
        return result;
      };

      Grammar_prototype.$_reduce_329 = function(val, _values, result) {

        result = this.$new_block_args(nil, val['$[]'](0), nil, val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_330 = function(val, _values, result) {

        result = this.$new_block_args(nil, nil, val['$[]'](0), val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_331 = function(val, _values, result) {

        result = this.$new_block_args(nil, nil, nil, val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_332 = function(val, _values, result) {

        result = this.$s("block", val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_333 = function(val, _values, result) {

        val['$[]'](0)['$<<'](val['$[]'](2));
        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_334 = function(val, _values, result) {

        result = this.$new_assign(this.$new_assignable(this.$s("identifier", val['$[]'](0).$intern())), val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_336 = function(val, _values, result) {

        result = 0;
        return result;
      };

      Grammar_prototype.$_reduce_337 = function(val, _values, result) {

        result = 0;
        return result;
      };

      Grammar_prototype.$_reduce_338 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_339 = function(val, _values, result) {

        this.$push_scope("block");
        result = this.line;
        return result;
      };

      Grammar_prototype.$_reduce_340 = function(val, _values, result) {

        result = this.$new_iter(nil, val['$[]'](2), val['$[]'](3));
        result['$line='](val['$[]'](1));
        this.$pop_scope();
        return result;
      };

      Grammar_prototype.$_reduce_341 = function(val, _values, result) {

        result = val['$[]'](1);
        result['$[]='](1, val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_344 = function(val, _values, result) {

        result = this.$new_call(nil, val['$[]'](0).$intern(), val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_345 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), val['$[]'](2).$intern(), val['$[]'](3));
        return result;
      };

      Grammar_prototype.$_reduce_346 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), "call", val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_347 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), val['$[]'](2).$intern(), val['$[]'](3));
        return result;
      };

      Grammar_prototype.$_reduce_348 = function(val, _values, result) {

        result = this.$new_call(val['$[]'](0), val['$[]'](2).$intern(), this.$s("arglist"));
        return result;
      };

      Grammar_prototype.$_reduce_349 = function(val, _values, result) {

        result = this.$new_super(val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_350 = function(val, _values, result) {

        result = this.$s("zsuper");
        return result;
      };

      Grammar_prototype.$_reduce_351 = function(val, _values, result) {

        this.$push_scope("block");
        result = this.line;
        return result;
      };

      Grammar_prototype.$_reduce_352 = function(val, _values, result) {

        result = this.$new_iter(nil, val['$[]'](2), val['$[]'](3));
        result['$line='](val['$[]'](1));
        this.$pop_scope();
        return result;
      };

      Grammar_prototype.$_reduce_353 = function(val, _values, result) {

        this.$push_scope("block");
        result = this.line;
        return result;
      };

      Grammar_prototype.$_reduce_354 = function(val, _values, result) {

        result = this.$new_iter(nil, val['$[]'](2), val['$[]'](3));
        result['$line='](val['$[]'](1));
        this.$pop_scope();
        return result;
      };

      Grammar_prototype.$_reduce_355 = function(val, _values, result) {

        result = this.line;
        return result;
      };

      Grammar_prototype.$_reduce_356 = function(val, _values, result) {
        var part = nil, __a;
        part = this.$s("when", val['$[]'](2), val['$[]'](4));
        part['$line='](val['$[]'](2).$line());
        result = [part];
        if ((__a = val['$[]'](5)) !== false && __a !== nil) {
          result.$push.apply(result, [].concat(val['$[]'](5)))
        };
        return result;
      };

      Grammar_prototype.$_reduce_357 = function(val, _values, result) {

        result = [val['$[]'](0)];
        return result;
      };

      Grammar_prototype.$_reduce_359 = function(val, _values, result) {
        var exc = nil, __a;
        exc = ((__a = val['$[]'](1)), __a !== false && __a !== nil ? __a : this.$s("array"));
        if ((__a = val['$[]'](2)) !== false && __a !== nil) {
          exc['$<<'](this.$new_assign(val['$[]'](2), this.$s("gvar", "$!".$intern())))
        };
        result = [this.$s("resbody", exc, val['$[]'](4))];
        if ((__a = val['$[]'](5)) !== false && __a !== nil) {
          result.$push(val['$[]'](5).$first())
        };
        return result;
      };

      Grammar_prototype.$_reduce_360 = function(val, _values, result) {

        result = nil;
        return result;
      };

      Grammar_prototype.$_reduce_361 = function(val, _values, result) {

        result = this.$s("array", val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_364 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_365 = function(val, _values, result) {

        result = nil;
        return result;
      };

      Grammar_prototype.$_reduce_366 = function(val, _values, result) {
        var __a;
        result = (function() { if ((__a = val['$[]'](1)['$nil?']()) !== false && __a !== nil) {
          return this.$s("nil")
          } else {
          return val['$[]'](1)
        }; return nil; }).call(this);
        return result;
      };

      Grammar_prototype.$_reduce_368 = function(val, _values, result) {

        result = this.$s("lit", val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_369 = function(val, _values, result) {

        result = this.$s("lit", val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_371 = function(val, _values, result) {

        result = this.$new_str(val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_374 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_375 = function(val, _values, result) {

        result = this.$s("str", val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_376 = function(val, _values, result) {

        result = this.$new_xstr(val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_377 = function(val, _values, result) {

        result = this.$new_regexp(val['$[]'](1), val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_378 = function(val, _values, result) {

        result = this.$s("array");
        return result;
      };

      Grammar_prototype.$_reduce_379 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_380 = function(val, _values, result) {

        result = this.$s("array");
        return result;
      };

      Grammar_prototype.$_reduce_381 = function(val, _values, result) {
        var part = nil;
        part = val['$[]'](1);
        if (part['$[]'](0)['$==']("evstr")) {
          part = this.$s("dstr", "", val['$[]'](1))
        };
        result = val['$[]'](0)['$<<'](part);
        return result;
      };

      Grammar_prototype.$_reduce_382 = function(val, _values, result) {

        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_383 = function(val, _values, result) {

        result = val['$[]'](0).$concat([val['$[]'](1)]);
        return result;
      };

      Grammar_prototype.$_reduce_384 = function(val, _values, result) {

        result = this.$s("array");
        return result;
      };

      Grammar_prototype.$_reduce_385 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_386 = function(val, _values, result) {

        result = this.$s("array");
        return result;
      };

      Grammar_prototype.$_reduce_387 = function(val, _values, result) {

        result = val['$[]'](0)['$<<'](this.$s("str", val['$[]'](1)));
        return result;
      };

      Grammar_prototype.$_reduce_388 = function(val, _values, result) {

        result = nil;
        return result;
      };

      Grammar_prototype.$_reduce_389 = function(val, _values, result) {

        result = this.$str_append(val['$[]'](0), val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_390 = function(val, _values, result) {

        result = nil;
        return result;
      };

      Grammar_prototype.$_reduce_391 = function(val, _values, result) {

        result = this.$str_append(val['$[]'](0), val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_392 = function(val, _values, result) {

        result = this.$s("str", val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_393 = function(val, _values, result) {

        result = this.string_parse;
        this.string_parse = nil;
        return result;
      };

      Grammar_prototype.$_reduce_394 = function(val, _values, result) {

        this.string_parse = val['$[]'](1);
        result = this.$s("evstr", val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_395 = function(val, _values, result) {

        this.$cond_push(0);
        this.$cmdarg_push(0);
        result = this.string_parse;
        this.string_parse = nil;
        this.lex_state = "expr_beg";
        return result;
      };

      Grammar_prototype.$_reduce_396 = function(val, _values, result) {

        this.string_parse = val['$[]'](1);
        this.$cond_lexpop();
        this.$cmdarg_lexpop();
        result = this.$s("evstr", val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_397 = function(val, _values, result) {

        result = this.$s("gvar", val['$[]'](0).$intern());
        return result;
      };

      Grammar_prototype.$_reduce_398 = function(val, _values, result) {

        result = this.$s("ivar", val['$[]'](0).$intern());
        return result;
      };

      Grammar_prototype.$_reduce_399 = function(val, _values, result) {

        result = this.$s("cvar", val['$[]'](0).$intern());
        return result;
      };

      Grammar_prototype.$_reduce_401 = function(val, _values, result) {

        result = val['$[]'](1).$intern();
        this.lex_state = "expr_end";
        return result;
      };

      Grammar_prototype.$_reduce_407 = function(val, _values, result) {

        result = this.$new_dsym(val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_412 = function(val, _values, result) {

        result = this.$s("identifier", val['$[]'](0).$intern());
        return result;
      };

      Grammar_prototype.$_reduce_413 = function(val, _values, result) {

        result = this.$s("ivar", val['$[]'](0).$intern());
        return result;
      };

      Grammar_prototype.$_reduce_414 = function(val, _values, result) {

        result = this.$s("gvar", val['$[]'](0).$intern());
        return result;
      };

      Grammar_prototype.$_reduce_415 = function(val, _values, result) {

        result = this.$s("const", val['$[]'](0).$intern());
        return result;
      };

      Grammar_prototype.$_reduce_416 = function(val, _values, result) {

        result = this.$s("cvar", val['$[]'](0).$intern());
        return result;
      };

      Grammar_prototype.$_reduce_417 = function(val, _values, result) {

        result = this.$s("nil");
        return result;
      };

      Grammar_prototype.$_reduce_418 = function(val, _values, result) {

        result = this.$s("self");
        return result;
      };

      Grammar_prototype.$_reduce_419 = function(val, _values, result) {

        result = this.$s("true");
        return result;
      };

      Grammar_prototype.$_reduce_420 = function(val, _values, result) {

        result = this.$s("false");
        return result;
      };

      Grammar_prototype.$_reduce_421 = function(val, _values, result) {

        result = this.$s("str", this.file);
        return result;
      };

      Grammar_prototype.$_reduce_422 = function(val, _values, result) {

        result = this.$s("lit", this.line);
        return result;
      };

      Grammar_prototype.$_reduce_423 = function(val, _values, result) {

        result = this.$new_var_ref(val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_424 = function(val, _values, result) {

        result = this.$new_assignable(val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_427 = function(val, _values, result) {

        result = nil;
        return result;
      };

      Grammar_prototype.$_reduce_428 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_429 = function(val, _values, result) {

        result = nil;
        return result;
      };

      Grammar_prototype.$_reduce_430 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_431 = function(val, _values, result) {

        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_432 = function(val, _values, result) {

        result = this.$new_args(val['$[]'](0), val['$[]'](2), val['$[]'](4), val['$[]'](5));
        return result;
      };

      Grammar_prototype.$_reduce_433 = function(val, _values, result) {

        result = this.$new_args(val['$[]'](0), val['$[]'](2), nil, val['$[]'](3));
        return result;
      };

      Grammar_prototype.$_reduce_434 = function(val, _values, result) {

        result = this.$new_args(val['$[]'](0), nil, val['$[]'](2), val['$[]'](3));
        return result;
      };

      Grammar_prototype.$_reduce_435 = function(val, _values, result) {

        result = this.$new_args(val['$[]'](0), nil, nil, val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_436 = function(val, _values, result) {

        result = this.$new_args(nil, val['$[]'](0), val['$[]'](2), val['$[]'](3));
        return result;
      };

      Grammar_prototype.$_reduce_437 = function(val, _values, result) {

        result = this.$new_args(nil, val['$[]'](0), nil, val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_438 = function(val, _values, result) {

        result = this.$new_args(nil, nil, val['$[]'](0), val['$[]'](1));
        return result;
      };

      Grammar_prototype.$_reduce_439 = function(val, _values, result) {

        result = this.$new_args(nil, nil, nil, val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_440 = function(val, _values, result) {

        result = this.$s("args");
        return result;
      };

      Grammar_prototype.$_reduce_441 = function(val, _values, result) {

        this.$raise("formal argument cannot be a constant");
        return result;
      };

      Grammar_prototype.$_reduce_442 = function(val, _values, result) {

        this.$raise("formal argument cannot be an instance variable");
        return result;
      };

      Grammar_prototype.$_reduce_443 = function(val, _values, result) {

        this.$raise("formal argument cannot be a class variable");
        return result;
      };

      Grammar_prototype.$_reduce_444 = function(val, _values, result) {

        this.$raise("formal argument cannot be a global variable");
        return result;
      };

      Grammar_prototype.$_reduce_445 = function(val, _values, result) {

        result = val['$[]'](0).$intern();
        this.scope.$add_local(result);
        return result;
      };

      Grammar_prototype.$_reduce_446 = function(val, _values, result) {

        result = [val['$[]'](0)];
        return result;
      };

      Grammar_prototype.$_reduce_447 = function(val, _values, result) {

        val['$[]'](0)['$<<'](val['$[]'](2));
        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_448 = function(val, _values, result) {

        result = this.$new_assign(this.$new_assignable(this.$s("identifier", val['$[]'](0).$intern())), val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_449 = function(val, _values, result) {

        result = this.$s("block", val['$[]'](0));
        return result;
      };

      Grammar_prototype.$_reduce_450 = function(val, _values, result) {

        result = val['$[]'](0);
        val['$[]'](0)['$<<'](val['$[]'](2));
        return result;
      };

      Grammar_prototype.$_reduce_453 = function(val, _values, result) {

        result = ("*" + (val['$[]'](1))).$intern();
        return result;
      };

      Grammar_prototype.$_reduce_454 = function(val, _values, result) {

        result = "*";
        return result;
      };

      Grammar_prototype.$_reduce_457 = function(val, _values, result) {

        result = ("&" + (val['$[]'](1))).$intern();
        return result;
      };

      Grammar_prototype.$_reduce_458 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_459 = function(val, _values, result) {

        result = nil;
        return result;
      };

      Grammar_prototype.$_reduce_460 = function(val, _values, result) {

        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_461 = function(val, _values, result) {

        result = val['$[]'](1);
        return result;
      };

      Grammar_prototype.$_reduce_462 = function(val, _values, result) {

        result = [];
        return result;
      };

      Grammar_prototype.$_reduce_463 = function(val, _values, result) {

        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_464 = function(val, _values, result) {

        this.$raise("unsupported assoc list type (" + (this.line_number) + ")");
        return result;
      };

      Grammar_prototype.$_reduce_465 = function(val, _values, result) {

        result = val['$[]'](0);
        return result;
      };

      Grammar_prototype.$_reduce_466 = function(val, _values, result) {
        var __a;
        result = (__a = val['$[]'](0)).$push.apply(__a, [].concat(val['$[]'](2)));
        return result;
      };

      Grammar_prototype.$_reduce_467 = function(val, _values, result) {

        result = [val['$[]'](0), val['$[]'](2)];
        return result;
      };

      Grammar_prototype.$_reduce_468 = function(val, _values, result) {

        result = [this.$s("lit", val['$[]'](0).$intern()), val['$[]'](1)];
        return result;
      };

      Grammar_prototype.$_reduce_none = function(val, _values, result) {

        return val['$[]'](0);
      };

      return nil;
    })(Ruby, (__scope.Racc)._scope.Parser)

  })(self);
})();
// lib/Ruby/lexer.rb
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __klass = __Ruby.klass, __module = __Ruby.module, __range = __Ruby.range, __hash2 = __Ruby.hash2;

  //= require Ruby/grammar;
  //= require strscan;
  (function(__base, __super){
    // line 4, Ruby/lexer, class Array
    function Array() {};
    Array = __klass(__base, __super, "Array", Array);

    var Array_prototype = Array.prototype, __scope = Array._scope;
    Array_prototype.line = Array_prototype.end_line = nil;

    Array_prototype.$line = function() {

      return this.line
    },
    Array_prototype['$line='] = function(val) {

      return this.line = val
    }, nil;

    return Array_prototype.$end_line = function() {

      return this.end_line
    },
    Array_prototype['$end_line='] = function(val) {

      return this.end_line = val
    }, nil;
  })(self, null);
  return (function(__base){
    // line 9, Ruby/lexer, module Ruby
    function Ruby() {};
    Ruby = __module(__base, "Ruby", Ruby);
    var Ruby_prototype = Ruby.prototype, __scope = Ruby._scope;

    (function(__base, __super){
      // line 11, Ruby/lexer, class Grammar
      function Grammar() {};
      Grammar = __klass(__base, __super, "Grammar", Grammar);

      var Grammar_prototype = Grammar.prototype, __scope = Grammar._scope;
      Grammar_prototype.line = Grammar_prototype.file = Grammar_prototype.scopes = Grammar_prototype.scope = Grammar_prototype.cond = Grammar_prototype.cmdarg = Grammar_prototype.string_parse = Grammar_prototype.scanner = Grammar_prototype.lex_state = Grammar_prototype.start_of_lambda = nil;

      Grammar_prototype.$line = function() {

        return this.line
      }, nil;

      Grammar_prototype.$initialize = function() {

        this.lex_state = "expr_beg";
        this.cond = 0;
        this.cmdarg = 0;
        this.line = 1;
        this.scopes = [];
        return this.string_parse_stack = [];
      };

      Grammar_prototype.$s = function(parts) {
        var sexp = nil;parts = __slice.call(arguments, 0);
        sexp = __scope.Array.$new(parts);
        sexp['$line='](this.line);
        return sexp;
      };

      Grammar_prototype.$parse = function(source, file) {
        var result = nil;if (file == null) {
          file = "(string)"
        }
        this.file = file;
        this.scanner = __scope.StringScanner.$new(source);
        this.$push_scope();
        result = this.$do_parse();
        this.$pop_scope();
        return result;
      };

      Grammar_prototype.$on_error = function(t, val, vstack) {

        return this.$raise("parse error on value " + (val.$inspect()) + " :" + (this.file) + ":" + (this.line));
      };

      (function(__base, __super){
        // line 45, Ruby/lexer, class LexerScope
        function LexerScope() {};
        LexerScope = __klass(__base, __super, "LexerScope", LexerScope);

        var LexerScope_prototype = LexerScope.prototype, __scope = LexerScope._scope;
        LexerScope_prototype.locals = LexerScope_prototype.parent = LexerScope_prototype.block = nil;

        LexerScope_prototype.$locals = function() {

          return this.locals
        }, nil;

        LexerScope_prototype.$parent = function() {

          return this.parent
        },
        LexerScope_prototype['$parent='] = function(val) {

          return this.parent = val
        }, nil;

        LexerScope_prototype.$initialize = function(type) {

          this.block = type['$==']("block");
          this.locals = [];
          return this.parent = nil;
        };

        LexerScope_prototype.$add_local = function(local) {

          return this.locals['$<<'](local);
        };

        LexerScope_prototype['$has_local?'] = function(local) {
          var __a, __b;
          if ((__a = this.locals['$include?'](local)) !== false && __a !== nil) {
            return true
          };
          if ((__a = (__b = this.parent, __b !== false && __b !== nil ? this.block : __b)) !== false && __a !== nil) {
            return this.parent['$has_local?'](local)
          };
          return false;
        };

        return nil;
      })(Grammar, null);

      Grammar_prototype.$push_scope = function(type) {
        var top = nil, scope = nil;if (type == null) {
          type = nil
        }
        top = this.scopes.$last();
        scope = __scope.LexerScope.$new(type);
        scope['$parent='](top);
        this.scopes['$<<'](scope);
        return this.scope = scope;
      };

      Grammar_prototype.$pop_scope = function() {

        this.scopes.$pop();
        return this.scope = this.scopes.$last();
      };

      Grammar_prototype.$new_block = function(stmt) {
        var s = nil;if (stmt == null) {
          stmt = nil
        }
        s = this.$s("block");
        if (stmt !== false && stmt !== nil) {
          s['$<<'](stmt)
        };
        return s;
      };

      Grammar_prototype.$new_compstmt = function(block) {

        if (block.$size()['$=='](1)) {
          return nil
          } else {
          if (block.$size()['$=='](2)) {
            return block['$[]'](1)
            } else {
            block['$line='](block['$[]'](1).$line());
            return block;
          }
        };
      };

      Grammar_prototype.$new_body = function(compstmt, res, els, ens) {
        var s = nil, __a, __b;
        s = ((__a = compstmt), __a !== false && __a !== nil ? __a : this.$s("block"));
        if (compstmt !== false && compstmt !== nil) {
          s['$line='](compstmt.$line())
        };
        if (res !== false && res !== nil) {
          s = this.$s("rescue", s);
          (__b = res, __b.$each._p = (__a = function(r) {


            if (r == null) r = nil;

            return s['$<<'](r)
          }, __a._s = this, __a), __b.$each());
          if (els !== false && els !== nil) {
            s['$<<'](els)
          };
        };
        if (ens !== false && ens !== nil) {
          return this.$s("ensure", s, ens)
          } else {
          return s
        };
      };

      Grammar_prototype.$new_defn = function(line, name, args, body) {
        var scope = nil, s = nil, __a;
        if ((__a = !body['$[]'](0)['$==']("block")) !== false && __a !== nil) {
          body = this.$s("block", body)
        };
        scope = this.$s("scope", body);
        if (body.$size()['$=='](1)) {
          body['$<<'](this.$s("nil"))
        };
        scope['$line='](body.$line());
        args['$line='](line);
        s = this.$s("defn", name.$to_sym(), args, scope);
        s['$line='](line);
        s['$end_line='](this.line);
        return s;
      };

      Grammar_prototype.$new_defs = function(line, recv, name, args, body) {
        var scope = nil, s = nil;
        scope = this.$s("scope", body);
        scope['$line='](body.$line());
        s = this.$s("defs", recv, name.$to_sym(), args, scope);
        s['$line='](line);
        s['$end_line='](this.line);
        return s;
      };

      Grammar_prototype.$new_class = function(path, sup, body) {
        var scope = nil, s = nil, __a;
        scope = this.$s("scope");
        if ((__a = body.$size()['$=='](1)) === false || __a === nil) {
          scope['$<<'](body)
        };
        scope['$line='](body.$line());
        s = this.$s("class", path, sup, scope);
        return s;
      };

      Grammar_prototype.$new_sclass = function(expr, body) {
        var scope = nil, s = nil;
        scope = this.$s("scope");
        scope['$<<'](body);
        scope['$line='](body.$line());
        s = this.$s("sclass", expr, scope);
        return s;
      };

      Grammar_prototype.$new_module = function(path, body) {
        var scope = nil, s = nil, __a;
        scope = this.$s("scope");
        if ((__a = body.$size()['$=='](1)) === false || __a === nil) {
          scope['$<<'](body)
        };
        scope['$line='](body.$line());
        s = this.$s("module", path, scope);
        return s;
      };

      Grammar_prototype.$new_iter = function(call, args, body) {
        var s = nil;
        s = this.$s("iter", call, args);
        if (body !== false && body !== nil) {
          s['$<<'](body)
        };
        s['$end_line='](this.line);
        return s;
      };

      Grammar_prototype.$new_if = function(expr, stmt, tail) {
        var s = nil;
        s = this.$s("if", expr, stmt, tail);
        s['$line='](expr.$line());
        s['$end_line='](this.line);
        return s;
      };

      Grammar_prototype.$new_args = function(norm, opt, rest, block) {
        var res = nil, e = nil, __a, __b, __c;
        res = this.$s("args");
        if (norm !== false && norm !== nil) {
          (__b = norm, __b.$each._p = (__a = function(arg) {


            if (this.scope == null) this.scope = nil;

            if (arg == null) arg = nil;

            this.scope.$add_local(arg);
            return res['$<<'](arg);
          }, __a._s = this, __a), __b.$each())
        };
        if (opt !== false && opt !== nil) {
          (__c = opt['$[]'](__range(1, -1, false)), __c.$each._p = (__a = function(_opt) {


            if (_opt == null) _opt = nil;

            return res['$<<'](_opt['$[]'](1))
          }, __a._s = this, __a), __c.$each())
        };
        if (rest !== false && rest !== nil) {
          res['$<<'](rest);
          this.scope.$add_local((function() { try {
          rest.$to_s()['$[]'](__range(1, -1, false)).$to_sym()
          } catch ($err) {
          if (__scope.ArgumentError['$===']($err)) {
          e = $err;(function() { if ((__a = e.$message()['$=~'](/empty/)) !== false && __a !== nil) {
            return nil
            } else {
            return this.$raise()
          }; return nil; }).call(this);
          "";}
          else { throw $err; }
          } }).call(this));
        };
        if (block !== false && block !== nil) {
          res['$<<'](block);
          this.scope.$add_local(block.$to_s()['$[]'](__range(1, -1, false)).$to_sym());
        };
        if (opt !== false && opt !== nil) {
          res['$<<'](opt)
        };
        return res;
      };

      Grammar_prototype.$new_block_args = function(norm, opt, rest, block) {
        var res = nil, r = nil, b = nil, __a, __b, __c, __d;
        res = this.$s("array");
        if (norm !== false && norm !== nil) {
          (__b = norm, __b.$each._p = (__a = function(arg) {


            if (this.scope == null) this.scope = nil;

            if (arg == null) arg = nil;

            this.scope.$add_local(arg);
            return res['$<<'](this.$s("lasgn", arg));
          }, __a._s = this, __a), __b.$each())
        };
        if (opt !== false && opt !== nil) {
          (__c = opt['$[]'](__range(1, -1, false)), __c.$each._p = (__a = function(_opt) {


            if (_opt == null) _opt = nil;

            return res['$<<'](this.$s("lasgn", _opt['$[]'](1)))
          }, __a._s = this, __a), __c.$each())
        };
        if (rest !== false && rest !== nil) {
          r = rest.$to_s()['$[]'](__range(1, -1, false)).$to_sym();
          res['$<<'](this.$s("splat", this.$s("lasgn", r)));
          this.scope.$add_local(r);
        };
        if (block !== false && block !== nil) {
          b = block.$to_s()['$[]'](__range(1, -1, false)).$to_sym();
          res['$<<'](this.$s("block_pass", this.$s("lasgn", b)));
          this.scope.$add_local(b);
        };
        if (opt !== false && opt !== nil) {
          res['$<<'](opt)
        };
        if ((__a = ((__d = res.$size()['$=='](2)) ? norm : __d)) !== false && __a !== nil) {
          return res['$[]'](1)
          } else {
          return this.$s("masgn", res)
        };
      };

      Grammar_prototype.$new_call = function(recv, meth, args) {
        var call = nil, __a;if (args == null) {
          args = nil
        }
        call = this.$s("call", recv, meth);
        if ((__a = args) === false || __a === nil) {
          args = this.$s("arglist")
        };
        if (args['$[]'](0)['$==']("array")) {
          args['$[]='](0, "arglist")
        };
        call['$<<'](args);
        if (recv !== false && recv !== nil) {
          call['$line='](recv.$line())
          } else {
          if ((__a = args['$[]'](1)) !== false && __a !== nil) {
            call['$line='](args['$[]'](1).$line())
          }
        };
        if (args.$length()['$=='](1)) {
          args['$line='](call.$line())
          } else {
          args['$line='](args['$[]'](1).$line())
        };
        return call;
      };

      Grammar_prototype.$add_block_pass = function(arglist, block) {

        if (block !== false && block !== nil) {
          arglist['$<<'](block)
        };
        return arglist;
      };

      Grammar_prototype.$new_op_asgn = function(op, lhs, rhs) {
        var $case = nil, result = nil;
        $case = op;if ("||"['$===']($case)) {
        result = this.$s("op_asgn_or", this.$new_gettable(lhs));
        result['$<<'](lhs['$<<'](rhs));
        }
        else if ("&&"['$===']($case)) {
        result = this.$s("op_asgn_and", this.$new_gettable(lhs));
        result['$<<'](lhs['$<<'](rhs));
        }
        else {result = lhs;
        result['$<<'](this.$new_call(this.$new_gettable(lhs), op, this.$s("arglist", rhs)));};
        result['$line='](lhs.$line());
        return result;
      };

      Grammar_prototype.$new_assign = function(lhs, rhs) {
        var $case = nil;
        return (function() { $case = lhs['$[]'](0);if ("iasgn"['$===']($case) || "cdecl"['$===']($case) || "lasgn"['$===']($case) || "gasgn"['$===']($case) || "cvdecl"['$===']($case)) {
        lhs['$<<'](rhs);
        return lhs;
        }
        else if ("call"['$===']($case) || "attrasgn"['$===']($case)) {
        lhs.$last()['$<<'](rhs);
        return lhs;
        }
        else {return this.$raise("Bad lhs for new_assign: " + (lhs['$[]'](0)))} }).call(this);
      };

      Grammar_prototype.$new_assignable = function(ref) {
        var $case = nil, __a;
        $case = ref['$[]'](0);if ("ivar"['$===']($case)) {
        ref['$[]='](0, "iasgn")
        }
        else if ("const"['$===']($case)) {
        ref['$[]='](0, "cdecl")
        }
        else if ("identifier"['$===']($case)) {
        if ((__a = this.scope['$has_local?'](ref['$[]'](1))) === false || __a === nil) {
          this.scope.$add_local(ref['$[]'](1))
        };
        ref['$[]='](0, "lasgn");
        }
        else if ("gvar"['$===']($case)) {
        ref['$[]='](0, "gasgn")
        }
        else if ("cvar"['$===']($case)) {
        ref['$[]='](0, "cvdecl")
        }
        else {this.$raise("Bad new_assignable type: " + (ref['$[]'](0)))};
        return ref;
      };

      Grammar_prototype.$new_gettable = function(ref) {
        var res = nil, $case = nil;
        res = (function() { $case = ref['$[]'](0);if ("lasgn"['$===']($case)) {
        return this.$s("lvar", ref['$[]'](1))
        }
        else if ("iasgn"['$===']($case)) {
        return this.$s("ivar", ref['$[]'](1))
        }
        else if ("gasgn"['$===']($case)) {
        return this.$s("gvar", ref['$[]'](1))
        }
        else if ("cvdecl"['$===']($case)) {
        return this.$s("cvar", ref['$[]'](1))
        }
        else {return this.$raise("Bad new_gettable ref: " + (ref['$[]'](0)))} }).call(this);
        res['$line='](ref.$line());
        return res;
      };

      Grammar_prototype.$new_var_ref = function(ref) {
        var $case = nil, __a;
        return (function() { $case = ref['$[]'](0);if ("self"['$===']($case) || "nil"['$===']($case) || "true"['$===']($case) || "false"['$===']($case) || "line"['$===']($case) || "file"['$===']($case)) {
        return ref
        }
        else if ("const"['$===']($case)) {
        return ref
        }
        else if ("ivar"['$===']($case) || "gvar"['$===']($case) || "cvar"['$===']($case)) {
        return ref
        }
        else if ("lit"['$===']($case)) {
        return ref
        }
        else if ("str"['$===']($case)) {
        return ref
        }
        else if ("identifier"['$===']($case)) {
        if ((__a = this.scope['$has_local?'](ref['$[]'](1))) !== false && __a !== nil) {
          return this.$s("lvar", ref['$[]'](1))
          } else {
          return this.$s("call", nil, ref['$[]'](1), this.$s("arglist"))
        }
        }
        else {return this.$raise("Bad var_ref type: " + (ref['$[]'](0)))} }).call(this);
      };

      Grammar_prototype.$new_super = function(args) {
        var __a;
        args = ((__a = args), __a !== false && __a !== nil ? __a : this.$s("arglist"))['$[]'](__range(1, -1, false));
        return this.$s.apply(this, ["super"].concat(args));
      };

      Grammar_prototype.$new_yield = function(args) {
        var __a;
        args = ((__a = args), __a !== false && __a !== nil ? __a : this.$s("arglist"))['$[]'](__range(1, -1, false));
        return this.$s.apply(this, ["yield"].concat(args));
      };

      Grammar_prototype.$new_xstr = function(str) {
        var $case = nil, __a;
        if ((__a = str) === false || __a === nil) {
          return this.$s("xstr", "")
        };
        $case = str['$[]'](0);if ("str"['$===']($case)) {
        str['$[]='](0, "xstr")
        }
        else if ("dstr"['$===']($case)) {
        str['$[]='](0, "dxstr")
        }
        else if ("evstr"['$===']($case)) {
        str = this.$s("dxstr", "", str)
        };
        return str;
      };

      Grammar_prototype.$new_dsym = function(str) {
        var $case = nil, __a;
        if ((__a = str) === false || __a === nil) {
          return this.$s("nil")
        };
        $case = str['$[]'](0);if ("str"['$===']($case)) {
        str['$[]='](0, "lit");
        str['$[]='](1, str['$[]'](1).$to_sym());
        }
        else if ("dstr"['$===']($case)) {
        str['$[]='](0, "dsym")
        };
        return str;
      };

      Grammar_prototype.$new_str = function(str) {
        var __a, __b;
        if ((__a = str) === false || __a === nil) {
          return this.$s("str", "")
        };
        if ((__a = (__b = ((__b = str.$size()['$=='](3)) ? str['$[]'](1)['$==']("") : __b), __b !== false && __b !== nil ? str['$[]'](0)['$==']("str") : __b)) !== false && __a !== nil) {
          return str['$[]'](2)
          } else {
          if ((__a = ((__b = str['$[]'](0)['$==']("str")) ? str.$size()['$>'](3) : __b)) !== false && __a !== nil) {
            str['$[]='](0, "dstr");
            return str;
            } else {
            if (str['$[]'](0)['$==']("evstr")) {
              return this.$s("dstr", "", str)
              } else {
              return str
            }
          }
        };
      };

      Grammar_prototype.$new_regexp = function(reg, ending) {
        var $case = nil, res = nil, __a;
        if ((__a = reg) === false || __a === nil) {
          return this.$s("lit", /^/)
        };
        return (function() { $case = reg['$[]'](0);if ("str"['$===']($case)) {
        return this.$s("lit", __scope.Regexp.$new(reg['$[]'](1), ending))
        }
        else if ("evstr"['$===']($case)) {
        return res = this.$s("dregx", "", reg)
        }
        else if ("dstr"['$===']($case)) {
        reg['$[]='](0, "dregx");
        return reg;
        }
        else {return nil} }).call(this);
      };

      Grammar_prototype.$str_append = function(str, str2) {
        var __a;
        if ((__a = str) === false || __a === nil) {
          return str2
        };
        if ((__a = str2) === false || __a === nil) {
          return str
        };
        if (str.$first()['$==']("evstr")) {
          str = this.$s("dstr", "", str)
          } else {
          if (str.$first()['$==']("str")) {
            str = this.$s("dstr", str['$[]'](1))
          }
        };
        str['$<<'](str2);
        return str;
      };

      Grammar_prototype.$cond_push = function(n) {

        return this.cond = this.cond['$<<'](1)['$|'](n['$&'](1));
      };

      Grammar_prototype.$cond_pop = function() {

        return this.cond = this.cond['$>>'](1);
      };

      Grammar_prototype.$cond_lexpop = function() {

        return this.cond = this.cond['$>>'](1)['$|'](this.cond['$&'](1));
      };

      Grammar_prototype['$cond?'] = function() {

        return !this.cond['$&'](1)['$=='](0);
      };

      Grammar_prototype.$cmdarg_push = function(n) {

        return this.cmdarg = this.cmdarg['$<<'](1)['$|'](n['$&'](1));
      };

      Grammar_prototype.$cmdarg_pop = function() {

        return this.cmdarg = this.cmdarg['$>>'](1);
      };

      Grammar_prototype.$cmdarg_lexpop = function() {

        return this.cmdarg = this.cmdarg['$>>'](1)['$|'](this.cmdarg['$&'](1));
      };

      Grammar_prototype['$cmdarg?'] = function() {

        return !this.cmdarg['$&'](1)['$=='](0);
      };

      Grammar_prototype.$next_string_token = function() {
        var str_parse = nil, scanner = nil, space = nil, interpolate = nil, words = nil, str_buffer = nil, result = nil, complete_str = nil, __a, __b;
        str_parse = this.string_parse;
        scanner = this.scanner;
        space = false;
        interpolate = str_parse['$[]']("interpolate");
        words = ["w", "W"]['$include?'](str_parse['$[]']("beg"));
        if ((__a = (__b = ["w", "W"]['$include?'](str_parse['$[]']("beg")), __b !== false && __b !== nil ? scanner.$scan(/\s+/) : __b)) !== false && __a !== nil) {
          space = true
        };
        str_buffer = [];
        if ((__a = scanner.$scan(__scope.Regexp.$new(__scope.Regexp.$escape(str_parse['$[]']("end"))))) !== false && __a !== nil) {
          if ((__a = ((__b = words !== false && words !== nil) ? !str_parse['$[]']("done_last_space") : __b)) !== false && __a !== nil) {
            str_parse['$[]=']("done_last_space", true);
            (__a = scanner, __a['$pos='](__a.$pos()['$-'](1)));
            return ["SPACE", " "];
          };
          this.string_parse = nil;
          if ((__a = str_parse['$[]']("balance")) !== false && __a !== nil) {
            if (str_parse['$[]']("nesting")['$=='](0)) {
              this.lex_state = "expr_end";
              return ["STRING_END", scanner.$matched()];
              } else {
              str_buffer['$<<'](scanner.$matched());
              'FIXME(op_asgn1)';
              this.string_parse = str_parse;
            }
            } else {
            if ((__a = ["\"", "'"]['$include?'](str_parse['$[]']("beg"))) !== false && __a !== nil) {
              this.lex_state = "expr_end";
              return ["STRING_END", scanner.$matched()];
              } else {
              if (str_parse['$[]']("beg")['$==']("`")) {
                this.lex_state = "expr_end";
                return ["STRING_END", scanner.$matched()];
                } else {
                if (str_parse['$[]']("beg")['$==']("/")) {
                  result = scanner.$scan(/\w+/);
                  this.lex_state = "expr_end";
                  return ["REGEXP_END", result];
                  } else {
                  this.lex_state = "expr_end";
                  return ["STRING_END", scanner.$matched()];
                }
              }
            }
          };
        };
        if (space !== false && space !== nil) {
          return ["SPACE", " "]
        };
        if ((__a = (__b = str_parse['$[]']("balance"), __b !== false && __b !== nil ? scanner.$scan(__scope.Regexp.$new(__scope.Regexp.$escape(str_parse['$[]']("beg")))) : __b)) !== false && __a !== nil) {
          str_buffer['$<<'](scanner.$matched());
          'FIXME(op_asgn1)';
          } else {
          if ((__a = scanner.$check(/#[@$]/)) !== false && __a !== nil) {
            scanner.$scan(/#/);
            if (interpolate !== false && interpolate !== nil) {
              return ["STRING_DVAR", scanner.$matched()]
              } else {
              str_buffer['$<<'](scanner.$matched())
            };
            } else {
            if ((__a = scanner.$scan(/#\{/)) !== false && __a !== nil) {
              if (interpolate !== false && interpolate !== nil) {
                return ["STRING_DBEG", scanner.$matched()]
                } else {
                str_buffer['$<<'](scanner.$matched())
              }
              } else {
              if ((__a = scanner.$scan(/\#/)) !== false && __a !== nil) {
                str_buffer['$<<']("#")
              }
            }
          }
        };
        this.$add_string_content(str_buffer, str_parse);
        complete_str = str_buffer.$join("");
        this.line = this.line['$+'](complete_str.$count("\n"));
        return ["STRING_CONTENT", complete_str];
      };

      Grammar_prototype.$add_string_content = function(str_buffer, str_parse) {
        var scanner = nil, end_str_re = nil, interpolate = nil, words = nil, c = nil, handled = nil, reg = nil, __a, __b, __c;
        scanner = this.scanner;
        end_str_re = __scope.Regexp.$new(__scope.Regexp.$escape(str_parse['$[]']("end")));
        interpolate = str_parse['$[]']("interpolate");
        words = ["W", "w"]['$include?'](str_parse['$[]']("beg"));
        while (!((__b = scanner['$eos?']()) !== false && __b !== nil)) {c = nil;
        handled = true;
        if ((__b = scanner.$check(end_str_re)) !== false && __b !== nil) {
          if ((__b = (__c = str_parse['$[]']("balance"), __c !== false && __c !== nil ? !str_parse['$[]']("nesting")['$=='](0) : __c)) !== false && __b !== nil) {
            scanner.$scan(end_str_re);
            c = scanner.$matched();
            'FIXME(op_asgn1)';
            } else {
            break;
          }
          } else {
          if ((__b = (__c = str_parse['$[]']("balance"), __c !== false && __c !== nil ? scanner.$scan(__scope.Regexp.$new(__scope.Regexp.$escape(str_parse['$[]']("beg")))) : __c)) !== false && __b !== nil) {
            'FIXME(op_asgn1)';
            c = scanner.$matched();
            } else {
            if ((__b = ((__c = words !== false && words !== nil) ? scanner.$scan(/\s/) : __c)) !== false && __b !== nil) {
              (__b = scanner, __b['$pos='](__b.$pos()['$-'](1)));
              break;;
              } else {
              if ((__b = ((__c = interpolate !== false && interpolate !== nil) ? scanner.$check(/#(?=[\$\@\{])/) : __c)) !== false && __b !== nil) {
                break;
                } else {
                if ((__b = scanner.$scan(/\\/)) !== false && __b !== nil) {
                  if ((__b = str_parse['$[]']("regexp")) !== false && __b !== nil) {
                    if ((__b = scanner.$scan(/(.)/)) !== false && __b !== nil) {
                      c = (__b = "\\", __c = scanner.$matched(), typeof(__b) === 'number' ? __b + __c : __b['$+'](__c))
                    }
                    } else {
                    c = (function() { if ((__b = scanner.$scan(/n/)) !== false && __b !== nil) {
                      return "\n"
                      } else {
                      if ((__b = scanner.$scan(/r/)) !== false && __b !== nil) {
                        return "\r"
                        } else {
                        if ((__b = scanner.$scan(/\n/)) !== false && __b !== nil) {
                          return "\n"
                          } else {
                          scanner.$scan(/./);
                          return scanner.$matched();
                        }
                      }
                    }; return nil; }).call(this)
                  }
                  } else {
                  handled = false
                }
              }
            }
          }
        };
        if ((__b = handled) === false || __b === nil) {
          reg = (function() { if (words !== false && words !== nil) {
            return __scope.Regexp.$new("[^" + (__scope.Regexp.$escape(str_parse['$[]']("end"))) + "#0\n \\\\]+|.")
            } else {
            if ((__b = str_parse['$[]']("balance")) !== false && __b !== nil) {
              return __scope.Regexp.$new("[^" + (__scope.Regexp.$escape(str_parse['$[]']("end"))) + (__scope.Regexp.$escape(str_parse['$[]']("beg"))) + "#0\\\\]+|.")
              } else {
              return __scope.Regexp.$new("[^" + (__scope.Regexp.$escape(str_parse['$[]']("end"))) + "#0\\\\]+|.")
            }
          }; return nil; }).call(this);
          scanner.$scan(reg);
          c = scanner.$matched();
        };
        ((__b = c), __b !== false && __b !== nil ? __b : c = scanner.$matched());
        str_buffer['$<<'](c);};
        if ((__a = scanner['$eos?']()) !== false && __a !== nil) {
          return this.$raise("reached EOF while in string")
          } else {
          return nil
        };
      };

      Grammar_prototype.$next_token = function() {
        var scanner = nil, space_seen = nil, cmd_start = nil, c = nil, start_word = nil, end_word = nil, interpolate = nil, result = nil, heredoc = nil, sign = nil, matched = nil, $case = nil, __a, __b, __c;
        if ((__a = this.string_parse) !== false && __a !== nil) {
          return this.$next_string_token()
        };
        scanner = this.scanner;
        space_seen = false;
        cmd_start = false;
        c = "";
        while ((__b = true) !== false && __b !== nil){if ((__b = scanner.$scan(/\ |\t|\r/)) !== false && __b !== nil) {
          space_seen = true;
          continue;;
          } else {
          if ((__b = scanner.$scan(/(\n|#)/)) !== false && __b !== nil) {
            c = scanner.$matched();
            if (c['$==']("#")) {
              scanner.$scan(/(.*)/)
              } else {
              this.line = this.line['$+'](1)
            };
            scanner.$scan(/(\n+)/);
            if ((__b = scanner.$matched()) !== false && __b !== nil) {
              this.line = this.line['$+'](scanner.$matched().$length())
            };
            if ((__b = ["expr_beg", "expr_dot"]['$include?'](this.lex_state)) !== false && __b !== nil) {
              continue;
            };
            cmd_start = true;
            this.lex_state = "expr_beg";
            return ["\\n", "\\n"];
            } else {
            if ((__b = scanner.$scan(/\;/)) !== false && __b !== nil) {
              this.lex_state = "expr_beg";
              return [";", ";"];
              } else {
              if ((__b = scanner.$scan(/\"/)) !== false && __b !== nil) {
                this.string_parse = __hash2(["beg", "end", "interpolate"], {"beg": "\"", "end": "\"", "interpolate": true});
                return ["STRING_BEG", scanner.$matched()];
                } else {
                if ((__b = scanner.$scan(/\'/)) !== false && __b !== nil) {
                  this.string_parse = __hash2(["beg", "end"], {"beg": "'", "end": "'"});
                  return ["STRING_BEG", scanner.$matched()];
                  } else {
                  if ((__b = scanner.$scan(/\`/)) !== false && __b !== nil) {
                    this.string_parse = __hash2(["beg", "end", "interpolate"], {"beg": "`", "end": "`", "interpolate": true});
                    return ["XSTRING_BEG", scanner.$matched()];
                    } else {
                    if ((__b = scanner.$scan(/\%W/)) !== false && __b !== nil) {
                      start_word = scanner.$scan(/./);
                      end_word = ((__b = __hash2(["(", "[", "{"], {"(": ")", "[": "]", "{": "}"})['$[]'](start_word)), __b !== false && __b !== nil ? __b : start_word);
                      this.string_parse = __hash2(["beg", "end", "interpolate"], {"beg": "W", "end": end_word, "interpolate": true});
                      scanner.$scan(/\s*/);
                      return ["WORDS_BEG", scanner.$matched()];
                      } else {
                      if ((__b = scanner.$scan(/\%w/)) !== false && __b !== nil) {
                        start_word = scanner.$scan(/./);
                        end_word = ((__b = __hash2(["(", "[", "{"], {"(": ")", "[": "]", "{": "}"})['$[]'](start_word)), __b !== false && __b !== nil ? __b : start_word);
                        this.string_parse = __hash2(["beg", "end"], {"beg": "w", "end": end_word});
                        scanner.$scan(/\s*/);
                        return ["AWORDS_BEG", scanner.$matched()];
                        } else {
                        if ((__b = scanner.$scan(/\%[Qq]/)) !== false && __b !== nil) {
                          interpolate = scanner.$matched()['$end_with?']("Q");
                          start_word = scanner.$scan(/./);
                          end_word = ((__b = __hash2(["(", "[", "{"], {"(": ")", "[": "]", "{": "}"})['$[]'](start_word)), __b !== false && __b !== nil ? __b : start_word);
                          this.string_parse = __hash2(["beg", "end", "balance", "nesting", "interpolate"], {"beg": start_word, "end": end_word, "balance": true, "nesting": 0, "interpolate": interpolate});
                          return ["STRING_BEG", scanner.$matched()];
                          } else {
                          if ((__b = scanner.$scan(/\%x/)) !== false && __b !== nil) {
                            start_word = scanner.$scan(/./);
                            end_word = ((__b = __hash2(["(", "[", "{"], {"(": ")", "[": "]", "{": "}"})['$[]'](start_word)), __b !== false && __b !== nil ? __b : start_word);
                            this.string_parse = __hash2(["beg", "end", "balance", "nesting", "interpolate"], {"beg": start_word, "end": end_word, "balance": true, "nesting": 0, "interpolate": true});
                            return ["XSTRING_BEG", scanner.$matched()];
                            } else {
                            if ((__b = scanner.$scan(/\//)) !== false && __b !== nil) {
                              if ((__b = ["expr_beg", "expr_mid"]['$include?'](this.lex_state)) !== false && __b !== nil) {
                                this.string_parse = __hash2(["beg", "end", "interpolate", "regexp"], {"beg": "/", "end": "/", "interpolate": true, "regexp": true});
                                return ["REGEXP_BEG", scanner.$matched()];
                                } else {
                                if ((__b = scanner.$scan(/\=/)) !== false && __b !== nil) {
                                  this.lex_state = "expr_beg";
                                  return ["OP_ASGN", "/"];
                                  } else {
                                  if (this.lex_state['$==']("expr_fname")) {
                                    this.lex_state = "expr_end"
                                  }
                                }
                              };
                              return ["/", "/"];
                              } else {
                              if ((__b = scanner.$scan(/\%/)) !== false && __b !== nil) {
                                if ((__b = scanner.$scan(/\=/)) !== false && __b !== nil) {
                                  this.lex_state = "expr_beg";
                                  return ["OP_ASGN", "%"];
                                };
                                this.lex_state = (function() { if (this.lex_state['$==']("expr_fname")) {
                                  return "expr_end"
                                  } else {
                                  return "expr_beg"
                                }; return nil; }).call(this);
                                return ["%", "%"];
                                } else {
                                if ((__b = scanner.$scan(/\(/)) !== false && __b !== nil) {
                                  result = scanner.$matched();
                                  if ((__b = ["expr_beg", "expr_mid"]['$include?'](this.lex_state)) !== false && __b !== nil) {
                                    result = "PAREN_BEG"
                                    } else {
                                    if (space_seen !== false && space_seen !== nil) {
                                      result = "("
                                    }
                                  };
                                  this.lex_state = "expr_beg";
                                  this.$cond_push(0);
                                  this.$cmdarg_push(0);
                                  return [result, scanner.$matched()];
                                  } else {
                                  if ((__b = scanner.$scan(/\)/)) !== false && __b !== nil) {
                                    this.$cond_lexpop();
                                    this.$cmdarg_lexpop();
                                    this.lex_state = "expr_end";
                                    return [")", scanner.$matched()];
                                    } else {
                                    if ((__b = scanner.$scan(/\[/)) !== false && __b !== nil) {
                                      result = scanner.$matched();
                                      if ((__b = ["expr_fname", "expr_dot"]['$include?'](this.lex_state)) !== false && __b !== nil) {
                                        this.lex_state = "expr_arg";
                                        if ((__b = scanner.$scan(/\]=/)) !== false && __b !== nil) {
                                          return ["[]=", "[]="]
                                          } else {
                                          if ((__b = scanner.$scan(/\]/)) !== false && __b !== nil) {
                                            return ["[]", "[]"]
                                            } else {
                                            this.$raise("Unexpected '[' token")
                                          }
                                        };
                                        } else {
                                        if ((__b = ((__c = ["expr_beg", "expr_mid"]['$include?'](this.lex_state)), __c !== false && __c !== nil ? __c : space_seen)) !== false && __b !== nil) {
                                          this.lex_state = "expr_beg";
                                          this.$cond_push(0);
                                          this.$cmdarg_push(0);
                                          return ["[", scanner.$matched()];
                                          } else {
                                          this.lex_state = "expr_beg";
                                          this.$cond_push(0);
                                          this.$cmdarg_push(0);
                                          return ["[@", scanner.$matched()];
                                        }
                                      };
                                      } else {
                                      if ((__b = scanner.$scan(/\]/)) !== false && __b !== nil) {
                                        this.$cond_lexpop();
                                        this.$cmdarg_lexpop();
                                        this.lex_state = "expr_end";
                                        return ["]", scanner.$matched()];
                                        } else {
                                        if ((__b = scanner.$scan(/\}/)) !== false && __b !== nil) {
                                          this.$cond_lexpop();
                                          this.$cmdarg_lexpop();
                                          this.lex_state = "expr_end";
                                          return ["}", scanner.$matched()];
                                          } else {
                                          if ((__b = scanner.$scan(/\.\.\./)) !== false && __b !== nil) {
                                            this.lex_state = "expr_beg";
                                            return ["...", scanner.$matched()];
                                            } else {
                                            if ((__b = scanner.$scan(/\.\./)) !== false && __b !== nil) {
                                              this.lex_state = "expr_beg";
                                              return ["..", scanner.$matched()];
                                              } else {
                                              if ((__b = scanner.$scan(/\./)) !== false && __b !== nil) {
                                                if ((__b = this.lex_state['$==']("expr_fname")) === false || __b === nil) {
                                                  this.lex_state = "expr_dot"
                                                };
                                                return [".", scanner.$matched()];
                                                } else {
                                                if ((__b = scanner.$scan(/\*\*\=/)) !== false && __b !== nil) {
                                                  this.lex_state = "expr_beg";
                                                  return ["OP_ASGN", "**"];
                                                  } else {
                                                  if ((__b = scanner.$scan(/\*\*/)) !== false && __b !== nil) {
                                                    return ["**", "**"]
                                                    } else {
                                                    if ((__b = scanner.$scan(/\*\=/)) !== false && __b !== nil) {
                                                      this.lex_state = "expr_beg";
                                                      return ["OP_ASGN", "*"];
                                                      } else {
                                                      if ((__b = scanner.$scan(/\*/)) !== false && __b !== nil) {
                                                        result = scanner.$matched();
                                                        if (this.lex_state['$==']("expr_fname")) {
                                                          this.lex_state = "expr_end";
                                                          return ["*", result];
                                                          } else {
                                                          if ((__b = ((__c = space_seen !== false && space_seen !== nil) ? scanner.$check(/\S/) : __c)) !== false && __b !== nil) {
                                                            this.lex_state = "expr_beg";
                                                            return ["SPLAT", result];
                                                            } else {
                                                            if ((__b = ["expr_beg", "expr_mid"]['$include?'](this.lex_state)) !== false && __b !== nil) {
                                                              this.lex_state = "expr_beg";
                                                              return ["SPLAT", result];
                                                              } else {
                                                              this.lex_state = "expr_beg";
                                                              return ["*", result];
                                                            }
                                                          }
                                                        };
                                                        } else {
                                                        if ((__b = scanner.$scan(/\:\:/)) !== false && __b !== nil) {
                                                          if ((__b = ["expr_beg", "expr_mid", "expr_class"]['$include?'](this.lex_state)) !== false && __b !== nil) {
                                                            this.lex_state = "expr_beg";
                                                            return ["::@", scanner.$matched()];
                                                          };
                                                          this.lex_state = "expr_dot";
                                                          return ["::", scanner.$matched()];
                                                          } else {
                                                          if ((__b = scanner.$scan(/\:/)) !== false && __b !== nil) {
                                                            if ((__b = ((__c = ["expr_end", "expr_endarg"]['$include?'](this.lex_state)), __c !== false && __c !== nil ? __c : scanner.$check(/\s/))) !== false && __b !== nil) {
                                                              if ((__b = scanner.$check(/\w/)) === false || __b === nil) {
                                                                this.lex_state = "expr_beg";
                                                                return [":", ":"];
                                                              };
                                                              this.lex_state = "expr_fname";
                                                              return ["SYMBOL_BEG", ":"];
                                                            };
                                                            if ((__b = scanner.$scan(/\'/)) !== false && __b !== nil) {
                                                              this.string_parse = __hash2(["beg", "end"], {"beg": "'", "end": "'"})
                                                              } else {
                                                              if ((__b = scanner.$scan(/\"/)) !== false && __b !== nil) {
                                                                this.string_parse = __hash2(["beg", "end", "interpolate"], {"beg": "\"", "end": "\"", "interpolate": true})
                                                              }
                                                            };
                                                            this.lex_state = "expr_fname";
                                                            return ["SYMBOL_BEG", ":"];
                                                            } else {
                                                            if ((__b = scanner.$check(/\|/)) !== false && __b !== nil) {
                                                              if ((__b = scanner.$scan(/\|\|\=/)) !== false && __b !== nil) {
                                                                this.lex_state = "expr_beg";
                                                                return ["OP_ASGN", "||"];
                                                                } else {
                                                                if ((__b = scanner.$scan(/\|\|/)) !== false && __b !== nil) {
                                                                  this.lex_state = "expr_beg";
                                                                  return ["||", "||"];
                                                                  } else {
                                                                  if ((__b = scanner.$scan(/\|\=/)) !== false && __b !== nil) {
                                                                    this.lex_state = "expr_beg";
                                                                    return ["OP_ASGN", "|"];
                                                                    } else {
                                                                    if ((__b = scanner.$scan(/\|/)) !== false && __b !== nil) {
                                                                      if (this.lex_state['$==']("expr_fname")) {
                                                                        this.lex_state = "expr_end";
                                                                        return ["|", scanner.$matched()];
                                                                        } else {
                                                                        this.lex_state = "expr_beg";
                                                                        return ["|", scanner.$matched()];
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                              }
                                                              } else {
                                                              if ((__b = scanner.$scan(/\^\=/)) !== false && __b !== nil) {
                                                                this.lex_state = "exor_beg";
                                                                return ["OP_ASGN", "^"];
                                                                } else {
                                                                if ((__b = scanner.$scan(/\^/)) !== false && __b !== nil) {
                                                                  if (this.lex_state['$==']("expr_fname")) {
                                                                    this.lex_state = "expr_end";
                                                                    return ["^", scanner.$matched()];
                                                                  };
                                                                  this.lex_state = "expr_beg";
                                                                  return ["^", scanner.$matched()];
                                                                  } else {
                                                                  if ((__b = scanner.$check(/\&/)) !== false && __b !== nil) {
                                                                    if ((__b = scanner.$scan(/\&\&\=/)) !== false && __b !== nil) {
                                                                      this.lex_state = "expr_beg";
                                                                      return ["OP_ASGN", "&&"];
                                                                      } else {
                                                                      if ((__b = scanner.$scan(/\&\&/)) !== false && __b !== nil) {
                                                                        this.lex_state = "expr_beg";
                                                                        return ["&&", scanner.$matched()];
                                                                        } else {
                                                                        if ((__b = scanner.$scan(/\&\=/)) !== false && __b !== nil) {
                                                                          this.lex_state = "expr_beg";
                                                                          return ["OP_ASGN", "&"];
                                                                          } else {
                                                                          if ((__b = scanner.$scan(/\&/)) !== false && __b !== nil) {
                                                                            if ((__b = (__c = ((__c = space_seen !== false && space_seen !== nil) ? !scanner.$check(/\s/) : __c), __c !== false && __c !== nil ? ((__c = this.lex_state['$==']("expr_cmdarg")), __c !== false && __c !== nil ? __c : this.lex_state['$==']("expr_arg")) : __c)) !== false && __b !== nil) {
                                                                              return ["&@", "&"]
                                                                              } else {
                                                                              if ((__b = ["expr_beg", "expr_mid"]['$include?'](this.lex_state)) !== false && __b !== nil) {
                                                                                return ["&@", "&"]
                                                                                } else {
                                                                                return ["&", "&"]
                                                                              }
                                                                            }
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                    } else {
                                                                    if ((__b = scanner.$check(/\</)) !== false && __b !== nil) {
                                                                      if ((__b = scanner.$scan(/\<\<\=/)) !== false && __b !== nil) {
                                                                        this.lex_state = "expr_beg";
                                                                        return ["OP_ASGN", "<<"];
                                                                        } else {
                                                                        if ((__b = scanner.$scan(/\<\</)) !== false && __b !== nil) {
                                                                          if (this.lex_state['$==']("expr_fname")) {
                                                                            this.lex_state = "expr_end";
                                                                            return ["<<", "<<"];
                                                                            } else {
                                                                            if ((__b = (__c = !["expr_end", "expr_dot", "expr_endarg", "expr_class"]['$include?'](this.lex_state), __c !== false && __c !== nil ? space_seen : __c)) !== false && __b !== nil) {
                                                                              if ((__b = scanner.$scan(/(-?)(\w+)/)) !== false && __b !== nil) {
                                                                                heredoc = scanner['$[]'](2);
                                                                                scanner.$scan(/.*\n/);
                                                                                this.string_parse = __hash2(["beg", "end", "interpolate"], {"beg": heredoc, "end": heredoc, "interpolate": true});
                                                                                return ["STRING_BEG", heredoc];
                                                                              };
                                                                              this.lex_state = "expr_beg";
                                                                              return ["<<", "<<"];
                                                                            }
                                                                          };
                                                                          this.lex_state = "expr_beg";
                                                                          return ["<<", "<<"];
                                                                          } else {
                                                                          if ((__b = scanner.$scan(/\<\=\>/)) !== false && __b !== nil) {
                                                                            if (this.lex_state['$==']("expr_fname")) {
                                                                              this.lex_state = "expr_end"
                                                                              } else {
                                                                              this.lex_state = "expr_beg"
                                                                            };
                                                                            return ["<=>", "<=>"];
                                                                            } else {
                                                                            if ((__b = scanner.$scan(/\<\=/)) !== false && __b !== nil) {
                                                                              if (this.lex_state['$==']("expr_fname")) {
                                                                                this.lex_state = "expr_end"
                                                                                } else {
                                                                                this.lex_state = "expr_beg"
                                                                              };
                                                                              return ["<=", "<="];
                                                                              } else {
                                                                              if ((__b = scanner.$scan(/\</)) !== false && __b !== nil) {
                                                                                if (this.lex_state['$==']("expr_fname")) {
                                                                                  this.lex_state = "expr_end"
                                                                                  } else {
                                                                                  this.lex_state = "expr_beg"
                                                                                };
                                                                                return ["<", "<"];
                                                                              }
                                                                            }
                                                                          }
                                                                        }
                                                                      }
                                                                      } else {
                                                                      if ((__b = scanner.$check(/\>/)) !== false && __b !== nil) {
                                                                        if ((__b = scanner.$scan(/\>\>\=/)) !== false && __b !== nil) {
                                                                          return ["OP_ASGN", ">>"]
                                                                          } else {
                                                                          if ((__b = scanner.$scan(/\>\>/)) !== false && __b !== nil) {
                                                                            return [">>", ">>"]
                                                                            } else {
                                                                            if ((__b = scanner.$scan(/\>\=/)) !== false && __b !== nil) {
                                                                              if (this.lex_state['$==']("expr_fname")) {
                                                                                this.lex_state = "expr_end"
                                                                                } else {
                                                                                this.lex_state = "expr_beg"
                                                                              };
                                                                              return [">=", scanner.$matched()];
                                                                              } else {
                                                                              if ((__b = scanner.$scan(/\>/)) !== false && __b !== nil) {
                                                                                if (this.lex_state['$==']("expr_fname")) {
                                                                                  this.lex_state = "expr_end"
                                                                                  } else {
                                                                                  this.lex_state = "expr_beg"
                                                                                };
                                                                                return [">", ">"];
                                                                              }
                                                                            }
                                                                          }
                                                                        }
                                                                        } else {
                                                                        if ((__b = scanner.$scan(/->/)) !== false && __b !== nil) {
                                                                          this.lex_state = "expr_arg";
                                                                          this.start_of_lambda = true;
                                                                          return ["LAMBDA", scanner.$matched()];
                                                                          } else {
                                                                          if ((__b = scanner.$scan(/[+-]/)) !== false && __b !== nil) {
                                                                            result = scanner.$matched();
                                                                            sign = (__b = result, __c = "@", typeof(__b) === 'number' ? __b + __c : __b['$+'](__c));
                                                                            if ((__b = ((__c = this.lex_state['$==']("expr_beg")), __c !== false && __c !== nil ? __c : this.lex_state['$==']("expr_mid"))) !== false && __b !== nil) {
                                                                              this.lex_state = "expr_mid";
                                                                              return [sign, sign];
                                                                              } else {
                                                                              if (this.lex_state['$==']("expr_fname")) {
                                                                                this.lex_state = "expr_end";
                                                                                if ((__b = scanner.$scan(/@/)) !== false && __b !== nil) {
                                                                                  return ["IDENTIFIER", (__b = result, __c = scanner.$matched(), typeof(__b) === 'number' ? __b + __c : __b['$+'](__c))]
                                                                                };
                                                                                return [result, result];
                                                                              }
                                                                            };
                                                                            if ((__b = scanner.$scan(/\=/)) !== false && __b !== nil) {
                                                                              this.lex_state = "expr_beg";
                                                                              return ["OP_ASGN", result];
                                                                            };
                                                                            this.lex_state = "expr_beg";
                                                                            return [result, result];
                                                                            } else {
                                                                            if ((__b = scanner.$scan(/\?/)) !== false && __b !== nil) {
                                                                              if ((__b = ["expr_end", "expr_endarg", "expr_arg"]['$include?'](this.lex_state)) !== false && __b !== nil) {
                                                                                this.lex_state = "expr_beg";
                                                                                return ["?", scanner.$matched()];
                                                                              };
                                                                              if ((__b = scanner.$check(/\ |\t|\r/)) === false || __b === nil) {
                                                                                this.lex_state = "expr_end";
                                                                                return ["STRING", scanner.$scan(/./)];
                                                                              };
                                                                              this.lex_state = "expr_beg";
                                                                              return ["?", scanner.$matched()];
                                                                              } else {
                                                                              if ((__b = scanner.$scan(/\=\=\=/)) !== false && __b !== nil) {
                                                                                if (this.lex_state['$==']("expr_fname")) {
                                                                                  this.lex_state = "expr_end";
                                                                                  return ["===", "==="];
                                                                                };
                                                                                this.lex_state = "expr_beg";
                                                                                return ["===", "==="];
                                                                                } else {
                                                                                if ((__b = scanner.$scan(/\=\=/)) !== false && __b !== nil) {
                                                                                  if (this.lex_state['$==']("expr_fname")) {
                                                                                    this.lex_state = "expr_end";
                                                                                    return ["==", "=="];
                                                                                  };
                                                                                  this.lex_state = "expr_beg";
                                                                                  return ["==", "=="];
                                                                                  } else {
                                                                                  if ((__b = scanner.$scan(/\=\~/)) !== false && __b !== nil) {
                                                                                    if (this.lex_state['$==']("expr_fname")) {
                                                                                      this.lex_state = "expr_end";
                                                                                      return ["=~", "=~"];
                                                                                    };
                                                                                    this.lex_state = "expr_beg";
                                                                                    return ["=~", "=~"];
                                                                                    } else {
                                                                                    if ((__b = scanner.$scan(/\=\>/)) !== false && __b !== nil) {
                                                                                      this.lex_state = "expr_beg";
                                                                                      return ["=>", "=>"];
                                                                                      } else {
                                                                                      if ((__b = scanner.$scan(/\=/)) !== false && __b !== nil) {
                                                                                        this.lex_state = "expr_beg";
                                                                                        return ["=", "="];
                                                                                        } else {
                                                                                        if ((__b = scanner.$scan(/\!\=/)) !== false && __b !== nil) {
                                                                                          if (this.lex_state['$==']("expr_fname")) {
                                                                                            this.lex_state['$==']("expr_end");
                                                                                            return ["!=", "!="];
                                                                                          };
                                                                                          this.lex_state = "expr_beg";
                                                                                          return ["!=", "!="];
                                                                                          } else {
                                                                                          if ((__b = scanner.$scan(/\!\~/)) !== false && __b !== nil) {
                                                                                            this.lex_state = "expr_beg";
                                                                                            return ["!~", "!~"];
                                                                                            } else {
                                                                                            if ((__b = scanner.$scan(/\!/)) !== false && __b !== nil) {
                                                                                              if (this.lex_state['$==']("expr_fname")) {
                                                                                                this.lex_state = "expr_end";
                                                                                                return ["!", "!"];
                                                                                              };
                                                                                              this.lex_state = "expr_beg";
                                                                                              return ["!", "!"];
                                                                                              } else {
                                                                                              if ((__b = scanner.$scan(/\~/)) !== false && __b !== nil) {
                                                                                                if (this.lex_state['$==']("expr_fname")) {
                                                                                                  this.lex_state = "expr_end";
                                                                                                  return ["~", "~"];
                                                                                                };
                                                                                                this.lex_state = "expr_beg";
                                                                                                return ["~", "~"];
                                                                                                } else {
                                                                                                if ((__b = scanner.$scan(/\$[\+\'\`\&!@\"~*$?\/\\:;=.,<>_]/)) !== false && __b !== nil) {
                                                                                                  this.lex_state = "expr_end";
                                                                                                  return ["GVAR", scanner.$matched()];
                                                                                                  } else {
                                                                                                  if ((__b = scanner.$scan(/\$\w+/)) !== false && __b !== nil) {
                                                                                                    this.lex_state = "expr_end";
                                                                                                    return ["GVAR", scanner.$matched()];
                                                                                                    } else {
                                                                                                    if ((__b = scanner.$scan(/\@\@\w*/)) !== false && __b !== nil) {
                                                                                                      this.lex_state = "expr_end";
                                                                                                      return ["CVAR", scanner.$matched()];
                                                                                                      } else {
                                                                                                      if ((__b = scanner.$scan(/\@\w*/)) !== false && __b !== nil) {
                                                                                                        this.lex_state = "expr_end";
                                                                                                        return ["IVAR", scanner.$matched()];
                                                                                                        } else {
                                                                                                        if ((__b = scanner.$scan(/\,/)) !== false && __b !== nil) {
                                                                                                          this.lex_state = "expr_beg";
                                                                                                          return [",", scanner.$matched()];
                                                                                                          } else {
                                                                                                          if ((__b = scanner.$scan(/\{/)) !== false && __b !== nil) {
                                                                                                            if ((__b = this.start_of_lambda) !== false && __b !== nil) {
                                                                                                              this.start_of_lambda = false;
                                                                                                              this.lex_state = "expr_beg";
                                                                                                              return ["LAMBEG", scanner.$matched()];
                                                                                                              } else {
                                                                                                              if ((__b = ["expr_end", "expr_arg", "expr_cmdarg"]['$include?'](this.lex_state)) !== false && __b !== nil) {
                                                                                                                result = "LCURLY"
                                                                                                                } else {
                                                                                                                if (this.lex_state['$==']("expr_endarg")) {
                                                                                                                  result = "LBRACE_ARG"
                                                                                                                  } else {
                                                                                                                  result = "{"
                                                                                                                }
                                                                                                              }
                                                                                                            };
                                                                                                            this.lex_state = "expr_beg";
                                                                                                            this.$cond_push(0);
                                                                                                            this.$cmdarg_push(0);
                                                                                                            return [result, scanner.$matched()];
                                                                                                            } else {
                                                                                                            if ((__b = scanner.$check(/[0-9]/)) !== false && __b !== nil) {
                                                                                                              this.lex_state = "expr_end";
                                                                                                              if ((__b = scanner.$scan(/[\d_]+\.[\d_]+\b/)) !== false && __b !== nil) {
                                                                                                                return ["FLOAT", scanner.$matched().$gsub(/_/, "").$to_f()]
                                                                                                                } else {
                                                                                                                if ((__b = scanner.$scan(/[\d_]+\b/)) !== false && __b !== nil) {
                                                                                                                  return ["INTEGER", scanner.$matched().$gsub(/_/, "").$to_i()]
                                                                                                                  } else {
                                                                                                                  if ((__b = scanner.$scan(/0(x|X)(\d|[a-f]|[A-F])+/)) !== false && __b !== nil) {
                                                                                                                    return ["INTEGER", scanner.$matched().$to_i()]
                                                                                                                    } else {
                                                                                                                    this.$raise("Lexing error on numeric type: `" + (scanner.$peek(5)) + "`")
                                                                                                                  }
                                                                                                                }
                                                                                                              };
                                                                                                              } else {
                                                                                                              if ((__b = scanner.$scan(/(\w)+[\?\!]?/)) !== false && __b !== nil) {
                                                                                                                matched = scanner.$matched();
                                                                                                                if ((__b = (__c = !scanner.$peek(2)['$==']("::"), __c !== false && __c !== nil ? scanner.$scan(/:/) : __c)) !== false && __b !== nil) {
                                                                                                                  this.lex_state = "expr_beg";
                                                                                                                  return ["LABEL", "" + (matched)];
                                                                                                                };
                                                                                                                $case = matched;if ("class"['$===']($case)) {
                                                                                                                if (this.lex_state['$==']("expr_dot")) {
                                                                                                                  this.lex_state = "expr_end";
                                                                                                                  return ["IDENTIFIER", matched];
                                                                                                                };
                                                                                                                this.lex_state = "expr_class";
                                                                                                                return ["CLASS", matched];
                                                                                                                }
                                                                                                                else if ("module"['$===']($case)) {
                                                                                                                if (this.lex_state['$==']("expr_dot")) {
                                                                                                                  return ["IDENTIFIER", matched]
                                                                                                                };
                                                                                                                this.lex_state = "expr_class";
                                                                                                                return ["MODULE", matched];
                                                                                                                }
                                                                                                                else if ("defined?"['$===']($case)) {
                                                                                                                if (this.lex_state['$==']("expr_dot")) {
                                                                                                                  return ["IDENTIFIER", matched]
                                                                                                                };
                                                                                                                this.lex_state = "expr_arg";
                                                                                                                return ["DEFINED", "defined?"];
                                                                                                                }
                                                                                                                else if ("def"['$===']($case)) {
                                                                                                                this.lex_state = "expr_fname";
                                                                                                                this.scope_line = this.line;
                                                                                                                return ["DEF", matched];
                                                                                                                }
                                                                                                                else if ("undef"['$===']($case)) {
                                                                                                                this.lex_state = "expr_fname";
                                                                                                                return ["UNDEF", matched];
                                                                                                                }
                                                                                                                else if ("end"['$===']($case)) {
                                                                                                                if ((__b = ["expr_dot", "expr_fname"]['$include?'](this.lex_state)) !== false && __b !== nil) {
                                                                                                                  this.lex_state = "expr_end";
                                                                                                                  return ["IDENTIFIER", matched];
                                                                                                                };
                                                                                                                this.lex_state = "expr_end";
                                                                                                                return ["END", matched];
                                                                                                                }
                                                                                                                else if ("do"['$===']($case)) {
                                                                                                                if ((__b = this.start_of_lambda) !== false && __b !== nil) {
                                                                                                                  this.start_of_lambda = false;
                                                                                                                  this.lex_state = "expr_beg";
                                                                                                                  return ["DO_LAMBDA", scanner.$matched()];
                                                                                                                  } else {
                                                                                                                  if ((__b = this['$cond?']()) !== false && __b !== nil) {
                                                                                                                    this.lex_state = "expr_beg";
                                                                                                                    return ["DO_COND", matched];
                                                                                                                    } else {
                                                                                                                    if ((__b = (__c = this['$cmdarg?'](), __c !== false && __c !== nil ? !this.lex_state['$==']("expr_cmdarg") : __c)) !== false && __b !== nil) {
                                                                                                                      this.lex_state = "expr_beg";
                                                                                                                      return ["DO_BLOCK", matched];
                                                                                                                      } else {
                                                                                                                      if (this.lex_state['$==']("expr_endarg")) {
                                                                                                                        return ["DO_BLOCK", matched]
                                                                                                                        } else {
                                                                                                                        this.lex_state = "expr_beg";
                                                                                                                        return ["DO", matched];
                                                                                                                      }
                                                                                                                    }
                                                                                                                  }
                                                                                                                }
                                                                                                                }
                                                                                                                else if ("if"['$===']($case)) {
                                                                                                                if (this.lex_state['$==']("expr_beg")) {
                                                                                                                  return ["IF", matched]
                                                                                                                };
                                                                                                                this.lex_state = "expr_beg";
                                                                                                                return ["IF_MOD", matched];
                                                                                                                }
                                                                                                                else if ("unless"['$===']($case)) {
                                                                                                                if (this.lex_state['$==']("expr_beg")) {
                                                                                                                  return ["UNLESS", matched]
                                                                                                                };
                                                                                                                this.lex_state = "expr_beg";
                                                                                                                return ["UNLESS_MOD", matched];
                                                                                                                }
                                                                                                                else if ("else"['$===']($case)) {
                                                                                                                return ["ELSE", matched]
                                                                                                                }
                                                                                                                else if ("elsif"['$===']($case)) {
                                                                                                                return ["ELSIF", matched]
                                                                                                                }
                                                                                                                else if ("self"['$===']($case)) {
                                                                                                                if ((__b = this.lex_state['$==']("expr_fname")) === false || __b === nil) {
                                                                                                                  this.lex_state = "expr_end"
                                                                                                                };
                                                                                                                return ["SELF", matched];
                                                                                                                }
                                                                                                                else if ("true"['$===']($case)) {
                                                                                                                this.lex_state = "expr_end";
                                                                                                                return ["TRUE", matched];
                                                                                                                }
                                                                                                                else if ("false"['$===']($case)) {
                                                                                                                this.lex_state = "expr_end";
                                                                                                                return ["FALSE", matched];
                                                                                                                }
                                                                                                                else if ("nil"['$===']($case)) {
                                                                                                                this.lex_state = "expr_end";
                                                                                                                return ["NIL", matched];
                                                                                                                }
                                                                                                                else if ("__LINE__"['$===']($case)) {
                                                                                                                this.lex_state = "expr_end";
                                                                                                                return ["LINE", this.line.$to_s()];
                                                                                                                }
                                                                                                                else if ("__FILE__"['$===']($case)) {
                                                                                                                this.lex_state = "expr_end";
                                                                                                                return ["FILE", matched];
                                                                                                                }
                                                                                                                else if ("begin"['$===']($case)) {
                                                                                                                if ((__b = ["expr_dot", "expr_fname"]['$include?'](this.lex_state)) !== false && __b !== nil) {
                                                                                                                  this.lex_state = "expr_end";
                                                                                                                  return ["IDENTIFIER", matched];
                                                                                                                };
                                                                                                                this.lex_state = "expr_beg";
                                                                                                                return ["BEGIN", matched];
                                                                                                                }
                                                                                                                else if ("rescue"['$===']($case)) {
                                                                                                                if ((__b = ["expr_dot", "expr_fname"]['$include?'](this.lex_state)) !== false && __b !== nil) {
                                                                                                                  return ["IDENTIFIER", matched]
                                                                                                                };
                                                                                                                if (this.lex_state['$==']("expr_beg")) {
                                                                                                                  return ["RESCUE", matched]
                                                                                                                };
                                                                                                                this.lex_state = "expr_beg";
                                                                                                                return ["RESCUE_MOD", matched];
                                                                                                                }
                                                                                                                else if ("ensure"['$===']($case)) {
                                                                                                                this.lex_state = "expr_beg";
                                                                                                                return ["ENSURE", matched];
                                                                                                                }
                                                                                                                else if ("case"['$===']($case)) {
                                                                                                                this.lex_state = "expr_beg";
                                                                                                                return ["CASE", matched];
                                                                                                                }
                                                                                                                else if ("when"['$===']($case)) {
                                                                                                                this.lex_state = "expr_beg";
                                                                                                                return ["WHEN", matched];
                                                                                                                }
                                                                                                                else if ("or"['$===']($case)) {
                                                                                                                this.lex_state = "expr_beg";
                                                                                                                return ["OR", matched];
                                                                                                                }
                                                                                                                else if ("and"['$===']($case)) {
                                                                                                                this.lex_state = "expr_beg";
                                                                                                                return ["AND", matched];
                                                                                                                }
                                                                                                                else if ("not"['$===']($case)) {
                                                                                                                this.lex_state = "expr_beg";
                                                                                                                return ["NOT", matched];
                                                                                                                }
                                                                                                                else if ("return"['$===']($case)) {
                                                                                                                this.lex_state = "expr_mid";
                                                                                                                return ["RETURN", matched];
                                                                                                                }
                                                                                                                else if ("next"['$===']($case)) {
                                                                                                                if ((__b = ((__c = this.lex_state['$==']("expr_dot")), __c !== false && __c !== nil ? __c : this.lex_state['$==']("expr_fname"))) !== false && __b !== nil) {
                                                                                                                  this.lex_state = "expr_end";
                                                                                                                  return ["IDENTIFIER", matched];
                                                                                                                };
                                                                                                                this.lex_state = "expr_mid";
                                                                                                                return ["NEXT", matched];
                                                                                                                }
                                                                                                                else if ("redo"['$===']($case)) {
                                                                                                                if ((__b = ((__c = this.lex_state['$==']("expr_dot")), __c !== false && __c !== nil ? __c : this.lex_state['$==']("expr_fname"))) !== false && __b !== nil) {
                                                                                                                  this.lex_state = "expr_end";
                                                                                                                  return ["IDENTIFIER", matched];
                                                                                                                };
                                                                                                                this.lex_state = "expr_mid";
                                                                                                                return ["REDO", matched];
                                                                                                                }
                                                                                                                else if ("break"['$===']($case)) {
                                                                                                                this.lex_state = "expr_mid";
                                                                                                                return ["BREAK", matched];
                                                                                                                }
                                                                                                                else if ("super"['$===']($case)) {
                                                                                                                this.lex_state = "expr_arg";
                                                                                                                return ["SUPER", matched];
                                                                                                                }
                                                                                                                else if ("then"['$===']($case)) {
                                                                                                                return ["THEN", matched]
                                                                                                                }
                                                                                                                else if ("while"['$===']($case)) {
                                                                                                                if (this.lex_state['$==']("expr_beg")) {
                                                                                                                  return ["WHILE", matched]
                                                                                                                };
                                                                                                                this.lex_state = "expr_beg";
                                                                                                                return ["WHILE_MOD", matched];
                                                                                                                }
                                                                                                                else if ("until"['$===']($case)) {
                                                                                                                if (this.lex_state['$==']("expr_beg")) {
                                                                                                                  return ["UNTIL", matched]
                                                                                                                };
                                                                                                                this.lex_state = "expr_beg";
                                                                                                                return ["UNTIL_MOD", matched];
                                                                                                                }
                                                                                                                else if ("yield"['$===']($case)) {
                                                                                                                this.lex_state = "expr_arg";
                                                                                                                return ["YIELD", matched];
                                                                                                                }
                                                                                                                else if ("alias"['$===']($case)) {
                                                                                                                this.lex_state = "expr_fname";
                                                                                                                return ["ALIAS", matched];
                                                                                                                };
                                                                                                                matched = matched;
                                                                                                                if ((__b = (__c = !scanner.$peek(2)['$==']("::"), __c !== false && __c !== nil ? scanner.$scan(/\:/) : __c)) !== false && __b !== nil) {
                                                                                                                  return ["LABEL", matched]
                                                                                                                };
                                                                                                                if (this.lex_state['$==']("expr_fname")) {
                                                                                                                  if ((__b = scanner.$scan(/\=/)) !== false && __b !== nil) {
                                                                                                                    this.lex_state = "expr_end";
                                                                                                                    return ["IDENTIFIER", (__b = matched, __c = scanner.$matched(), typeof(__b) === 'number' ? __b + __c : __b['$+'](__c))];
                                                                                                                  }
                                                                                                                };
                                                                                                                if ((__b = ["expr_beg", "expr_dot", "expr_mid", "expr_arg", "expr_cmdarg"]['$include?'](this.lex_state)) !== false && __b !== nil) {
                                                                                                                  this.lex_state = (function() { if (cmd_start !== false && cmd_start !== nil) {
                                                                                                                    return "expr_cmdarg"
                                                                                                                    } else {
                                                                                                                    return "expr_arg"
                                                                                                                  }; return nil; }).call(this)
                                                                                                                  } else {
                                                                                                                  this.lex_state = "expr_end"
                                                                                                                };
                                                                                                                return [(function() { if ((__b = matched['$=~'](/[A-Z]/)) !== false && __b !== nil) {
                                                                                                                  return "CONSTANT"
                                                                                                                  } else {
                                                                                                                  return "IDENTIFIER"
                                                                                                                }; return nil; }).call(this), matched];
                                                                                                              }
                                                                                                            }
                                                                                                          }
                                                                                                        }
                                                                                                      }
                                                                                                    }
                                                                                                  }
                                                                                                }
                                                                                              }
                                                                                            }
                                                                                          }
                                                                                        }
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                }
                                                                              }
                                                                            }
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                              }
                                                            }
                                                          }
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        };
        if ((__b = scanner['$eos?']()) !== false && __b !== nil) {
          return [false, false]
        };
        this.$raise("Unexpected content in parsing stream `" + (scanner.$peek(5)) + "` :" + (this.file) + ":" + (this.line));};
      };

      return nil;
    })(Ruby, (__scope.Racc)._scope.Parser)

  })(self);
})();
// lib/Ruby/scope.rb
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __module = __Ruby.module, __klass = __Ruby.klass, __hash2 = __Ruby.hash2;

  return (function(__base){
    // line 1, Ruby/scope, module Ruby
    function Ruby() {};
    Ruby = __module(__base, "Ruby", Ruby);
    var Ruby_prototype = Ruby.prototype, __scope = Ruby._scope;

    (function(__base, __super){
      // line 2, Ruby/scope, class Parser
      function Parser() {};
      Parser = __klass(__base, __super, "Parser", Parser);

      var Parser_prototype = Parser.prototype, __scope = Parser._scope;

      return (function(__base, __super){
        // line 7, Ruby/scope, class Scope
        function Scope() {};
        Scope = __klass(__base, __super, "Scope", Scope);

        var Scope_prototype = Scope.prototype, __scope = Scope._scope;
        Scope_prototype.parent = Scope_prototype.name = Scope_prototype.block_name = Scope_prototype.scope_name = Scope_prototype.ivars = Scope_prototype.type = Scope_prototype.defines_defn = Scope_prototype.defines_defs = Scope_prototype.mid = Scope_prototype.defs = Scope_prototype.methods = Scope_prototype.smethods = Scope_prototype.uses_super = Scope_prototype.locals = Scope_prototype.temps = Scope_prototype.parser = Scope_prototype.proto_ivars = Scope_prototype.args = Scope_prototype.queue = Scope_prototype.unique = Scope_prototype.while_stack = Scope_prototype.identity = Scope_prototype.uses_block = nil;

        Scope_prototype.$parent = function() {

          return this.parent
        },
        Scope_prototype['$parent='] = function(val) {

          return this.parent = val
        }, nil;

        Scope_prototype.$name = function() {

          return this.name
        },
        Scope_prototype['$name='] = function(val) {

          return this.name = val
        }, nil;

        Scope_prototype.$block_name = function() {

          return this.block_name
        },
        Scope_prototype['$block_name='] = function(val) {

          return this.block_name = val
        }, nil;

        Scope_prototype.$scope_name = function() {

          return this.scope_name
        }, nil;

        Scope_prototype.$ivars = function() {

          return this.ivars
        }, nil;

        Scope_prototype.$type = function() {

          return this.type
        }, nil;

        Scope_prototype.$defines_defn = function() {

          return this.defines_defn
        },
        Scope_prototype['$defines_defn='] = function(val) {

          return this.defines_defn = val
        }, nil;

        Scope_prototype.$defines_defs = function() {

          return this.defines_defs
        },
        Scope_prototype['$defines_defs='] = function(val) {

          return this.defines_defs = val
        }, nil;

        Scope_prototype.$mid = function() {

          return this.mid
        },
        Scope_prototype['$mid='] = function(val) {

          return this.mid = val
        }, nil;

        Scope_prototype.$defs = function() {

          return this.defs
        },
        Scope_prototype['$defs='] = function(val) {

          return this.defs = val
        }, nil;

        Scope_prototype.$methods = function() {

          return this.methods
        }, nil;

        Scope_prototype.$smethods = function() {

          return this.smethods
        }, nil;

        Scope_prototype.$uses_super = function() {

          return this.uses_super
        },
        Scope_prototype['$uses_super='] = function(val) {

          return this.uses_super = val
        }, nil;

        Scope_prototype.$initialize = function(type, parser) {

          this.parser = parser;
          this.type = type;
          this.locals = [];
          this.temps = [];
          this.args = [];
          this.ivars = [];
          this.parent = nil;
          this.queue = [];
          this.unique = "a";
          this.while_stack = [];
          this.defines_defs = false;
          this.defines_defn = false;
          this.methods = [];
          this.smethods = [];
          this.uses_block = false;
          return this.proto_ivars = [];
        };

        Scope_prototype['$class_scope?'] = function() {
          var __a;
          return ((__a = this.type['$==']("class")), __a !== false && __a !== nil ? __a : this.type['$==']("module"));
        };

        Scope_prototype['$class?'] = function() {

          return this.type['$==']("class");
        };

        Scope_prototype['$module?'] = function() {

          return this.type['$==']("module");
        };

        Scope_prototype['$top?'] = function() {

          return this.type['$==']("top");
        };

        Scope_prototype['$iter?'] = function() {

          return this.type['$==']("iter");
        };

        Scope_prototype['$def_in_class?'] = function() {
          var __a;
          return (__a = (__a = (__a = !this.defs, __a !== false && __a !== nil ? this.type['$==']("def") : __a), __a !== false && __a !== nil ? this.parent : __a), __a !== false && __a !== nil ? this.parent['$class?']() : __a);
        };

        Scope_prototype.$proto = function() {

          return "" + (this.name) + "_prototype";
        };

        Scope_prototype['$should_donate?'] = function() {
          var __a;
          return ((__a = this.type['$==']("module")), __a !== false && __a !== nil ? __a : this.name.$to_s()['$==']("Object"));
        };

        Scope_prototype.$to_vars = function() {
          var vars = nil, iv = nil, indent = nil, res = nil, str = nil, pvars = nil, __a, __b, __c, __d;
          vars = (__b = this.locals, __b.$map._p = (__a = function(l) {


            if (l == null) l = nil;

            return "" + (l) + " = nil"
          }, __a._s = this, __a), __b.$map());
          vars.$push.apply(vars, [].concat(this.temps));
          iv = (__c = this.$ivars(), __c.$map._p = (__a = function(ivar) {


            if (ivar == null) ivar = nil;

            return "if (this" + (ivar) + " == null) this" + (ivar) + " = nil;\n"
          }, __a._s = this, __a), __c.$map());
          indent = this.parser.$parser_indent();
          res = (function() { if ((__a = vars['$empty?']()) !== false && __a !== nil) {
            return ""
            } else {
            return "var " + (vars.$join(", ")) + ";"
          }; return nil; }).call(this);
          str = (function() { if ((__a = this.$ivars()['$empty?']()) !== false && __a !== nil) {
            return res
            } else {
            return "" + (res) + "\n" + (indent) + (iv.$join(indent))
          }; return nil; }).call(this);
          if ((__a = (__d = this['$class?'](), __d !== false && __d !== nil ? !this.proto_ivars['$empty?']() : __d)) !== false && __a !== nil) {
            pvars = (__d = this.proto_ivars, __d.$map._p = (__a = function(i) {


              if (i == null) i = nil;

              return "" + (this.$proto()) + (i)
            }, __a._s = this, __a), __d.$map()).$join(" = ");
            return "%s\n%s%s = nil;"['$%']([str, indent, pvars]);
            } else {
            return str
          };
        };

        Scope_prototype.$to_donate_methods = function() {
          var out = nil, __a, __b;
          out = "";
          if ((__a = (__b = this['$should_donate?'](), __b !== false && __b !== nil ? !this.methods['$empty?']() : __b)) !== false && __a !== nil) {
            out = out['$+'](("%s;" + (this.name) + "._donate([%s]);")['$%']([this.parser.$parser_indent(), (__a = this.methods, __a.$map._p = "inspect".$to_proc(), __a.$map()).$join(", ")]))
          };
          if ((__b = this.smethods['$empty?']()) === false || __b === nil) {
            out = out['$+'](("%s;" + (this.name) + "._sdonate([%s]);")['$%']([this.parser.$parser_indent(), (__b = this.smethods, __b.$map._p = "inspect".$to_proc(), __b.$map()).$join(", ")]))
          };
          return out;
        };

        Scope_prototype.$add_ivar = function(ivar) {
          var __a;
          if ((__a = this['$def_in_class?']()) !== false && __a !== nil) {
            return this.parent.$add_proto_ivar(ivar)
            } else {
            if ((__a = this.ivars['$include?'](ivar)) !== false && __a !== nil) {
              return nil
              } else {
              return this.ivars['$<<'](ivar)
            }
          };
        };

        Scope_prototype.$add_proto_ivar = function(ivar) {
          var __a;
          if ((__a = this.proto_ivars['$include?'](ivar)) !== false && __a !== nil) {
            return nil
            } else {
            return this.proto_ivars['$<<'](ivar)
          };
        };

        Scope_prototype.$add_arg = function(arg) {
          var __a;
          if ((__a = this.args['$include?'](arg)) !== false && __a !== nil) {
            return nil
            } else {
            return this.args['$<<'](arg)
          };
        };

        Scope_prototype.$add_local = function(local) {
          var __a;
          if ((__a = this['$has_local?'](local)) !== false && __a !== nil) {
            return nil
          };
          return this.locals['$<<'](local);
        };

        Scope_prototype['$has_local?'] = function(local) {
          var __a, __b;
          if ((__a = ((__b = this.locals['$include?'](local)), __b !== false && __b !== nil ? __b : this.args['$include?'](local))) !== false && __a !== nil) {
            return true
          };
          if ((__a = (__b = this.parent, __b !== false && __b !== nil ? this.type['$==']("iter") : __b)) !== false && __a !== nil) {
            return this.parent['$has_local?'](local)
          };
          return false;
        };

        Scope_prototype.$add_temp = function(tmps) {
          var __a;tmps = __slice.call(arguments, 0);
          return (__a = this.temps).$push.apply(__a, [].concat(tmps));
        };

        Scope_prototype['$has_temp?'] = function(tmp) {

          return this.temps['$include?'](tmp);
        };

        Scope_prototype.$new_temp = function() {
          var tmp = nil, __a;
          if ((__a = this.queue['$empty?']()) === false || __a === nil) {
            return this.queue.$pop()
          };
          tmp = "__" + (this.unique);
          this.unique = this.unique.$succ();
          this.temps['$<<'](tmp);
          return tmp;
        };

        Scope_prototype.$queue_temp = function(name) {

          return this.queue['$<<'](name);
        };

        Scope_prototype.$push_while = function() {
          var info = nil;
          info = __hash2([], {});
          this.while_stack.$push(info);
          return info;
        };

        Scope_prototype.$pop_while = function() {

          return this.while_stack.$pop();
        };

        Scope_prototype['$in_while?'] = function() {

          return !this.while_stack['$empty?']();
        };

        Scope_prototype['$uses_block!'] = function() {
          var __a, __b;
          if ((__a = ((__b = this.type['$==']("iter")) ? this.parent : __b)) !== false && __a !== nil) {
            return this.parent['$uses_block!']()
            } else {
            this.uses_block = true;
            return this['$identify!']();
          };
        };

        Scope_prototype['$identify!'] = function() {
          var __a;
          if ((__a = this.identity) !== false && __a !== nil) {
            return this.identity
          };
          this.identity = this.parser.$unique_temp();
          this.parent.$add_temp(this.identity);
          return this.identity;
        };

        Scope_prototype.$identity = function() {

          return this.identity;
        };

        Scope_prototype.$get_super_chain = function() {
          var chain = nil, scope = nil, defn = nil, mid = nil, __a, __b;
          __a = [[], this, "null", "null"], chain = __a[0], scope = __a[1], defn = __a[2], mid = __a[3];
          while (scope !== false && scope !== nil){if (scope.$type()['$==']("iter")) {
            chain['$<<'](scope['$identify!']());
            if ((__b = scope.$parent()) !== false && __b !== nil) {
              scope = scope.$parent()
            };
            } else {
            if (scope.$type()['$==']("def")) {
              defn = scope['$identify!']();
              mid = "'$" + (scope.$mid()) + "'";
              break;;
              } else {
              break;
            }
          }};
          return [chain, defn, mid];
        };

        Scope_prototype['$uses_block?'] = function() {

          return this.uses_block;
        };

        return nil;
      })(Parser, null)
    })(Ruby, null)

  })(self)
})();
// lib/Ruby/parser.rb
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __module = __Ruby.module, __klass = __Ruby.klass, __hash2 = __Ruby.hash2, __range = __Ruby.range;

  //= require Ruby/lexer;
  //= require Ruby/grammar;
  //= require Ruby/scope;
  return (function(__base){
    // line 5, Ruby/parser, module Ruby
    function Ruby() {};
    Ruby = __module(__base, "Ruby", Ruby);
    var Ruby_prototype = Ruby.prototype, __scope = Ruby._scope;

    (function(__base, __super){
      // line 42, Ruby/parser, class Parser
      function Parser() {};
      Parser = __klass(__base, __super, "Parser", Parser);

      var Parser_prototype = Parser.prototype, __scope = Parser._scope, TMP_1, TMP_2, TMP_3, TMP_4, __a, __b;
      Parser_prototype.grammar = Parser_prototype.requires = Parser_prototype.file = Parser_prototype.line = Parser_prototype.indent = Parser_prototype.unique = Parser_prototype.scope = Parser_prototype.helpers = Parser_prototype.while_loop = Parser_prototype.space = nil;

      __scope.INDENT = "  ";

      __scope.LEVEL = ["stmt", "stmt_closure", "list", "expr", "recv"];

      __scope.COMPARE = ["<", ">", "<=", ">="];

      __scope.RESERVED = ["break", "case", "catch", "continue", "debugger", "default", "delete", "do", "else", "finally", "for", "function", "if", "in", "instanceof", "new", "return", "switch", "this", "throw", "try", "typeof", "var", "let", "void", "while", "with", "class", "enum", "export", "extends", "import", "super", "true", "false", "native", "const"];

      __scope.STATEMENTS = ["xstr", "dxstr"];

      Parser_prototype.$grammar = function() {

        return this.grammar
      }, nil;

      Parser_prototype.$requires = function() {

        return this.requires
      }, nil;

      Parser_prototype.$parse = function(source, file) {
        if (file == null) {
          file = "(file)"
        }
        this.grammar = __scope.Grammar.$new();
        this.requires = [];
        this.file = file;
        this.line = 1;
        this.indent = "";
        this.unique = 0;
        this.helpers = __hash2(["breaker", "slice"], {"breaker": true, "slice": true});
        return this.$top(this.grammar.$parse(source, file));
      };

      Parser_prototype.$error = function(msg) {

        return this.$raise("" + (msg) + " :" + (this.file) + ":" + (this.line));
      };

      Parser_prototype.$parser_indent = function() {

        return this.indent;
      };

      Parser_prototype.$s = function(parts) {
        var sexp = nil;parts = __slice.call(arguments, 0);
        sexp = __scope.Array.$new(parts);
        sexp['$line='](this.line);
        return sexp;
      };

      Parser_prototype.$mid_to_jsid = function(mid) {
        var __a, __b;
        if ((__a = /\=|\+|\-|\*|\/|\!|\?|\<|\>|\&|\||\^|\%|\~|\[/['$=~'](mid.$to_s())) !== false && __a !== nil) {
          return "['$" + (mid) + "']"
          } else {
          return (__a = ".$", __b = mid, typeof(__a) === 'number' ? __a + __b : __a['$+'](__b))
        };
      };

      Parser_prototype.$unique_temp = function() {

        return "TMP_" + (this.unique = this.unique['$+'](1));
      };

      Parser_prototype.$top = function(sexp, options) {
        var code = nil, vars = nil, __a, __b;if (options == null) {
          options = __hash2([], {})
        }
        code = nil;
        vars = [];
        (__b = this, __b.$in_scope._p = (__a = function() {

          var __a, __b, __c, __d, __e, __f, __g, __h, __i, __j;
          if (this.scope == null) this.scope = nil;
          if (this.helpers == null) this.helpers = nil;


          (__b = this, __b.$indent._p = (__a = function() {

            var __a, __b;
            if (this.indent == null) this.indent = nil;


            return code = (__a = this.indent, __b = this.$process(this.$s("scope", sexp), "stmt"), typeof(__a) === 'number' ? __a + __b : __a['$+'](__b))
          }, __a._s = this, __a), __b.$indent());
          vars['$<<']("__Ruby = Ruby");
          vars['$<<']("self = __Ruby.top");
          vars['$<<']("__scope = __Ruby");
          vars['$<<']("nil = __Ruby.nil");
          if ((__a = this.scope.$defines_defn()) !== false && __a !== nil) {
            vars['$<<']("def = " + (this.$current_self()) + "._klass.prototype")
          };
          vars.$concat((__c = this.helpers.$keys(), __c.$map._p = (__a = function(h) {


            if (h == null) h = nil;

            return "__" + (h) + " = __Ruby." + (h)
          }, __a._s = this, __a), __c.$map()));
          return code = (__a = (__e = (__g = (__i = "" + (__scope.INDENT) + "var " + (vars.$join(", ")) + ";\n", __j = __scope.INDENT, typeof(__i) === 'number' ? __i + __j : __i['$+'](__j)), __h = this.scope.$to_vars(), typeof(__g) === 'number' ? __g + __h : __g['$+'](__h)), __f = "\n", typeof(__e) === 'number' ? __e + __f : __e['$+'](__f)), __d = code, typeof(__a) === 'number' ? __a + __d : __a['$+'](__d));
        }, __a._s = this, __a), __b.$in_scope("top"));
        return "(function() {\n" + (code) + "\n})();";
      };

      Parser_prototype.$in_scope = TMP_1 = function(type) {
        var parent = nil, __a, __b, __context, __yield;
        __yield = TMP_1._p || nil, __context = __yield._s, TMP_1._p = null;

        if (__yield === nil) {
          return nil
        };
        parent = this.scope;
        this.scope = (__b = __scope.Scope.$new(type, this), __b.$tap._p = (__a = function(s) {


          if (s == null) s = nil;

          return s['$parent='](parent)
        }, __a._s = this, __a), __b.$tap());
        if (__yield.call(__context, this.scope) === __breaker) return __breaker.$v;
        return this.scope = parent;
      };

      Parser_prototype.$indent = TMP_2 = function() {
        var indent = nil, res = nil, __a, __context, block;
        block = TMP_2._p || nil, __context = block._s, TMP_2._p = null;

        indent = this.indent;
        this.indent = this.indent['$+'](__scope.INDENT);
        this.space = "\n" + (this.indent);
        res = (((__a = block.call(__context)) === __breaker) ? __breaker.$v : __a);
        this.indent = indent;
        this.space = "\n" + (this.indent);
        return res;
      };

      Parser_prototype.$with_temp = TMP_3 = function() {
        var tmp = nil, res = nil, __a, __context, block;
        block = TMP_3._p || nil, __context = block._s, TMP_3._p = null;

        tmp = this.scope.$new_temp();
        res = (((__a = block.call(__context, tmp)) === __breaker) ? __breaker.$v : __a);
        this.scope.$queue_temp(tmp);
        return res;
      };

      Parser_prototype.$in_while = TMP_4 = function() {
        var result = nil, __a, __context, __yield;
        __yield = TMP_4._p || nil, __context = __yield._s, TMP_4._p = null;

        if (__yield === nil) {
          return nil
        };
        this.while_loop = this.scope.$push_while();
        result = (((__a = __yield.call(__context)) === __breaker) ? __breaker.$v : __a);
        this.scope.$pop_while();
        return result;
      };

      Parser_prototype['$in_while?'] = function() {

        return this.scope['$in_while?']();
      };

      Parser_prototype.$process = function(sexp, level) {
        var type = nil, meth = nil, __a;
        type = sexp.$shift();
        meth = "process_" + (type);
        if ((__a = (!!this['$' + meth])) === false || __a === nil) {
          this.$raise("Unsupported sexp: " + (type))
        };
        this.line = sexp.$line();
        return this.$__send__(meth, sexp, level);
      };

      Parser_prototype.$returns = function(sexp) {
        var $case = nil, __a, __b;
        if ((__a = sexp) === false || __a === nil) {
          return this.$returns(this.$s("nil"))
        };
        return (function() { $case = sexp.$first();if ("break"['$===']($case) || "next"['$===']($case)) {
        return sexp
        }
        else if ("yield"['$===']($case)) {
        sexp['$[]='](0, "returnable_yield");
        return sexp;
        }
        else if ("scope"['$===']($case)) {
        sexp['$[]='](1, this.$returns(sexp['$[]'](1)));
        return sexp;
        }
        else if ("block"['$===']($case)) {
        if (sexp.$length()['$>'](1)) {
          sexp['$[]='](-1, this.$returns(sexp['$[]'](-1)))
          } else {
          sexp['$<<'](this.$returns(this.$s("nil")))
        };
        return sexp;
        }
        else if ("when"['$===']($case)) {
        sexp['$[]='](2, this.$returns(sexp['$[]'](2)));
        return sexp;
        }
        else if ("rescue"['$===']($case)) {
        sexp['$[]='](1, this.$returns(sexp['$[]'](1)));
        return sexp;
        }
        else if ("ensure"['$===']($case)) {
        sexp['$[]='](1, this.$returns(sexp['$[]'](1)));
        return sexp;
        }
        else if ("while"['$===']($case)) {
        return sexp
        }
        else if ("return"['$===']($case)) {
        return sexp
        }
        else if ("xstr"['$===']($case)) {
        if ((__a = /return|;/['$=~'](sexp['$[]'](1))) === false || __a === nil) {
          sexp['$[]='](1, "return " + (sexp['$[]'](1)) + ";")
        };
        return sexp;
        }
        else if ("dxstr"['$===']($case)) {
        if ((__a = /return|;|\n/['$=~'](sexp['$[]'](1))) === false || __a === nil) {
          sexp['$[]='](1, "return " + (sexp['$[]'](1)))
        };
        return sexp;
        }
        else if ("if"['$===']($case)) {
        sexp['$[]='](2, this.$returns(((__a = sexp['$[]'](2)), __a !== false && __a !== nil ? __a : this.$s("nil"))));
        sexp['$[]='](3, this.$returns(((__a = sexp['$[]'](3)), __a !== false && __a !== nil ? __a : this.$s("nil"))));
        return sexp;
        }
        else {return (__b = this.$s("js_return", sexp), __b.$tap._p = (__a = function(s) {


          if (s == null) s = nil;

          return s['$line='](sexp.$line())
        }, __a._s = this, __a), __b.$tap())} }).call(this);
      };

      Parser_prototype['$expression?'] = function(sexp) {

        return !__scope.STATEMENTS['$include?'](sexp.$first());
      };

      Parser_prototype.$process_block = function(sexp, level) {
        var result = nil, stmt = nil, type = nil, yasgn = nil, expr = nil, code = nil, __a, __b;
        result = [];
        if ((__a = sexp['$empty?']()) !== false && __a !== nil) {
          sexp['$<<'](this.$s("nil"))
        };
        while (!((__b = sexp['$empty?']()) !== false && __b !== nil)) {stmt = sexp.$shift();
        type = stmt.$first();
        if ((__b = yasgn = this.$find_inline_yield(stmt)) !== false && __b !== nil) {
          result['$<<']("" + (this.$process(yasgn, level)) + ";")
        };
        (__b = expr = this['$expression?'](stmt), __b !== false && __b !== nil ? __scope.LEVEL.$index(level)['$<'](__scope.LEVEL.$index("list")) : __b);
        code = this.$process(stmt, level);
        if ((__b = code['$==']("")) === false || __b === nil) {
          result['$<<']((function() { if (expr !== false && expr !== nil) {
            return "" + (code) + ";"
            } else {
            return code
          }; return nil; }).call(this))
        };};
        return result.$join((function() { if ((__a = this.scope['$class_scope?']()) !== false && __a !== nil) {
          return "\n\n" + (this.indent)
          } else {
          return "\n" + (this.indent)
        }; return nil; }).call(this));
      };

      Parser_prototype.$find_inline_yield = function(stmt) {
        var found = nil, $case = nil, arglist = nil, __a, __b, __c;
        found = nil;
        $case = stmt.$first();if ("js_return"['$===']($case)) {
        found = this.$find_inline_yield(stmt['$[]'](1))
        }
        else if ("array"['$===']($case)) {
        (__b = stmt['$[]'](__range(1, -1, false)), __b.$each_with_index._p = (__a = function(el, idx) {

          var __a, __b;
          if (el == null) el = nil;
if (idx == null) idx = nil;

          if (el.$first()['$==']("yield")) {
            found = el;
            return stmt['$[]=']((__a = idx, __b = 1, typeof(__a) === 'number' ? __a + __b : __a['$+'](__b)), this.$s("js_tmp", "__yielded"));
            } else {
            return nil
          }
        }, __a._s = this, __a), __b.$each_with_index())
        }
        else if ("call"['$===']($case)) {
        arglist = stmt['$[]'](3);
        (__c = arglist['$[]'](__range(1, -1, false)), __c.$each_with_index._p = (__a = function(el, idx) {

          var __a, __b;
          if (el == null) el = nil;
if (idx == null) idx = nil;

          if (el.$first()['$==']("yield")) {
            found = el;
            return arglist['$[]=']((__a = idx, __b = 1, typeof(__a) === 'number' ? __a + __b : __a['$+'](__b)), this.$s("js_tmp", "__yielded"));
            } else {
            return nil
          }
        }, __a._s = this, __a), __c.$each_with_index());
        };
        if (found !== false && found !== nil) {
          if ((__a = this.scope['$has_temp?']("__yielded")) === false || __a === nil) {
            this.scope.$add_temp("__yielded")
          };
          return this.$s("yasgn", "__yielded", found);
          } else {
          return nil
        };
      };

      Parser_prototype.$process_scope = function(sexp, level) {
        var stmt = nil, code = nil, __a;
        stmt = sexp.$shift();
        if (stmt !== false && stmt !== nil) {
          if ((__a = this.scope['$class_scope?']()) === false || __a === nil) {
            stmt = this.$returns(stmt)
          };
          code = this.$process(stmt, "stmt");
          } else {
          code = "nil"
        };
        return code;
      };

      Parser_prototype.$process_js_return = function(sexp, level) {

        return "return " + (this.$process(sexp.$shift(), "expr"));
      };

      Parser_prototype.$process_js_tmp = function(sexp, level) {

        return sexp.$shift().$to_s();
      };

      Parser_prototype.$process_operator = function(sexp, level) {
        var meth = nil, recv = nil, arg = nil, mid = nil, __a, __b;
        ((__a = sexp)._isArray ? __a : (__a = [__a])), meth = (__a[0] == null ? nil : __a[0]), recv = (__a[1] == null ? nil : __a[1]), arg = (__a[2] == null ? nil : __a[2]);
        mid = this.$mid_to_jsid(meth.$to_s());
        return (__b = this, __b.$with_temp._p = (__a = function(a) {

          var __a, __b;
          if (a == null) a = nil;

          return (__b = this, __b.$with_temp._p = (__a = function(b) {

            var l = nil, r = nil;
            if (b == null) b = nil;

            l = this.$process(recv, "expr");
            r = this.$process(arg, "expr");
            return "(%s = %s, %s = %s, typeof(%s) === 'number' ? %s %s %s : %s%s(%s))"['$%']([a, l, b, r, a, a, meth.$to_s(), b, a, mid, b]);
          }, __a._s = this, __a), __b.$with_temp())
        }, __a._s = this, __a), __b.$with_temp());
      };

      Parser_prototype.$js_block_given = function(sexp, level) {

        this.scope['$uses_block!']();
        return "(" + (this.scope.$block_name()) + " !== nil)";
      };

      Parser_prototype.$handle_block_given = function(sexp, reverse) {
        var name = nil;if (reverse == null) {
          reverse = false
        }
        this.scope['$uses_block!']();
        name = this.scope.$block_name();
        if (reverse !== false && reverse !== nil) {
          return "" + (name) + " === nil"
          } else {
          return "" + (name) + " !== nil"
        };
      };

      Parser_prototype.$process_lit = function(sexp, level) {
        var val = nil, $case = nil;
        val = sexp.$shift();
        return (function() { $case = val;if (__scope.Numeric['$===']($case)) {
        if (level['$==']("recv")) {
          return "(" + (val.$inspect()) + ")"
          } else {
          return val.$inspect()
        }
        }
        else if (__scope.Symbol['$===']($case)) {
        return val.$to_s().$inspect()
        }
        else if (__scope.Regexp['$===']($case)) {
        if (val['$=='](/^/)) {
          return /^/.$inspect()
          } else {
          return val.$inspect()
        }
        }
        else if (__scope.Range['$===']($case)) {
        this.helpers['$[]=']("range", true);
        return "__range(" + (val.$begin()) + ", " + (val.$end()) + ", " + (val['$exclude_end?']()) + ")";
        }
        else {return this.$raise("Bad lit: " + (val.$inspect()))} }).call(this);
      };

      Parser_prototype.$process_dregx = function(sexp, level) {
        var parts = nil, __a, __b;
        parts = (__b = sexp, __b.$map._p = (__a = function(part) {

          var __a;
          if (part == null) part = nil;

          if ((__a = __scope.String['$==='](part)) !== false && __a !== nil) {
            return part.$inspect()
            } else {
            if (part['$[]'](0)['$==']("str")) {
              return this.$process(part, "expr")
              } else {
              return this.$process(part['$[]'](1), "expr")
            }
          }
        }, __a._s = this, __a), __b.$map());
        return "(new RegExp(" + (parts.$join(" + ")) + "))";
      };

      Parser_prototype.$process_dot2 = function(sexp, level) {
        var lhs = nil, rhs = nil;
        lhs = this.$process(sexp['$[]'](0), "expr");
        rhs = this.$process(sexp['$[]'](1), "expr");
        this.helpers['$[]=']("range", true);
        return "__range(%s, %s, false)"['$%']([lhs, rhs]);
      };

      Parser_prototype.$process_dot3 = function(sexp, level) {
        var lhs = nil, rhs = nil;
        lhs = this.$process(sexp['$[]'](0), "expr");
        rhs = this.$process(sexp['$[]'](1), "expr");
        this.helpers['$[]=']("range", true);
        return "__range(%s, %s, true)"['$%']([lhs, rhs]);
      };

      Parser_prototype.$process_str = function(sexp, level) {
        var str = nil;
        str = sexp.$shift();
        if (str['$=='](this.file)) {
          this.uses_file = true;
          return this.file.$inspect();
          } else {
          return str.$inspect()
        };
      };

      Parser_prototype.$process_defined = function(sexp, level) {
        var part = nil, $case = nil, mid = nil, recv = nil, __a;
        part = sexp['$[]'](0);
        return (function() { $case = part['$[]'](0);if ("self"['$===']($case)) {
        return "self".$inspect()
        }
        else if ("nil"['$===']($case)) {
        return "nil".$inspect()
        }
        else if ("true"['$===']($case)) {
        return "true".$inspect()
        }
        else if ("false"['$===']($case)) {
        return "false".$inspect()
        }
        else if ("call"['$===']($case)) {
        mid = this.$mid_to_jsid(part['$[]'](2).$to_s());
        recv = (function() { if ((__a = part['$[]'](1)) !== false && __a !== nil) {
          return this.$process(part['$[]'](1), "expr")
          } else {
          return this.$current_self()
        }; return nil; }).call(this);
        return "(" + (recv) + (mid) + " ? 'method' : nil)";
        }
        else if ("xstr"['$===']($case)) {
        return "(typeof(" + (this.$process(part, "expression")) + ") !== 'undefined')"
        }
        else if ("colon2"['$===']($case)) {
        return "false"
        }
        else {return this.$raise("bad defined? part: " + (part['$[]'](0)))} }).call(this);
      };

      Parser_prototype.$process_not = function(sexp, level) {
        var code = nil;
        code = "!" + (this.$process(sexp.$shift(), "expr"));
        return code;
      };

      Parser_prototype.$process_block_pass = function(exp, level) {

        return this.$process(this.$s("call", exp.$shift(), "to_proc", this.$s("arglist")), "expr");
      };

      Parser_prototype.$process_iter = function(sexp, level) {
        var call = nil, args = nil, body = nil, code = nil, params = nil, scope_name = nil, block_arg = nil, splat = nil, len = nil, __a, __b, __c;
        ((__a = sexp)._isArray ? __a : (__a = [__a])), call = (__a[0] == null ? nil : __a[0]), args = (__a[1] == null ? nil : __a[1]), body = (__a[2] == null ? nil : __a[2]);
        ((__a = body), __a !== false && __a !== nil ? __a : body = this.$s("nil"));
        body = this.$returns(body);
        code = "";
        params = nil;
        scope_name = nil;
        if ((__a = __scope.Fixnum['$==='](args)) !== false && __a !== nil) {
          args = nil
        };
        ((__a = args), __a !== false && __a !== nil ? __a : args = this.$s("masgn", this.$s("array")));
        args = (function() { if (args.$first()['$==']("lasgn")) {
          return this.$s("array", args)
          } else {
          return args['$[]'](1)
        }; return nil; }).call(this);
        if ((__a = (__b = args.$last()['$is_a?'](__scope.Array), __b !== false && __b !== nil ? args.$last()['$[]'](0)['$==']("block_pass") : __b)) !== false && __a !== nil) {
          block_arg = args.$pop();
          block_arg = block_arg['$[]'](1)['$[]'](1).$to_sym();
        };
        if ((__a = (__b = args.$last()['$is_a?'](__scope.Array), __b !== false && __b !== nil ? args.$last()['$[]'](0)['$==']("splat") : __b)) !== false && __a !== nil) {
          splat = args.$last()['$[]'](1)['$[]'](1);
          args.$pop();
          len = args.$length();
        };
        (__b = this, __b.$indent._p = (__a = function() {

          var __a, __b;

          return (__b = this, __b.$in_scope._p = (__a = function() {

            var blk = nil, __a, __b, __c;
            if (this.scope == null) this.scope = nil;
            if (this.indent == null) this.indent = nil;


            (__b = args['$[]'](__range(1, -1, false)), __b.$each._p = (__a = function(arg) {

              var __a;
              if (arg == null) arg = nil;

              arg = arg['$[]'](1);
              if ((__a = __scope.RESERVED['$include?'](arg.$to_s())) !== false && __a !== nil) {
                arg = "" + (arg) + "$"
              };
              return code = code['$+']("if (" + (arg) + " == null) " + (arg) + " = nil;\n");
            }, __a._s = this, __a), __b.$each());
            params = this.$js_block_args(args['$[]'](__range(1, -1, false)));
            if (splat !== false && splat !== nil) {
              params['$<<'](splat);
              code = code['$+']("" + (splat) + " = __slice.call(arguments, " + ((__a = len, __c = 1, typeof(__a) === 'number' ? __a - __c : __a['$-'](__c))) + ");");
            };
            if (block_arg !== false && block_arg !== nil) {
              this.scope['$block_name='](block_arg);
              this.scope.$add_temp(block_arg);
              this.scope.$add_temp("__context");
              scope_name = this.scope['$identify!']();
              blk = "\n%s%s = %s._p || nil, __context = %s._s, %s.p = null;\n%s"['$%']([this.indent, block_arg, scope_name, block_arg, scope_name, this.indent]);
              code = (__a = blk, __c = code, typeof(__a) === 'number' ? __a + __c : __a['$+'](__c));
            };
            code = code['$+']((__a = "\n" + (this.indent), __c = this.$process(body, "stmt"), typeof(__a) === 'number' ? __a + __c : __a['$+'](__c)));
            if ((__a = this.scope.$defines_defn()) !== false && __a !== nil) {
              this.scope.$add_temp("def = (" + (this.$current_self()) + "._isObject ? " + (this.$current_self()) + " : " + (this.$current_self()) + ".prototype)")
            };
            code = "\n" + (this.indent) + (this.scope.$to_vars()) + "\n" + (this.indent) + (code);
            return scope_name = this.scope.$identity();
          }, __a._s = this, __a), __b.$in_scope("iter"))
        }, __a._s = this, __a), __b.$indent());
        return (__c = this, __c.$with_temp._p = (__a = function(tmp) {

          var itercode = nil;
          if (this.indent == null) this.indent = nil;

          if (tmp == null) tmp = nil;

          itercode = "function(" + (params.$join(", ")) + ") {\n" + (code) + "\n" + (this.indent) + "}";
          if (scope_name !== false && scope_name !== nil) {
            itercode = "" + (scope_name) + " = " + (itercode)
          };
          call['$<<']("(%s = %s, %s._s = %s, %s)"['$%']([tmp, itercode, tmp, this.$current_self(), tmp]));
          return this.$process(call, level);
        }, __a._s = this, __a), __c.$with_temp());
      };

      Parser_prototype.$js_block_args = function(sexp) {
        var __a, __b;
        return (__b = sexp, __b.$map._p = (__a = function(arg) {

          var a = nil, __a;
          if (this.scope == null) this.scope = nil;

          if (arg == null) arg = nil;

          a = arg['$[]'](1).$to_sym();
          if ((__a = __scope.RESERVED['$include?'](a.$to_s())) !== false && __a !== nil) {
            a = ("" + (a) + "$").$to_sym()
          };
          this.scope.$add_arg(a);
          return a;
        }, __a._s = this, __a), __b.$map());
      };

      Parser_prototype.$process_attrasgn = function(exp, level) {
        var recv = nil, mid = nil, arglist = nil;
        recv = exp['$[]'](0);
        mid = exp['$[]'](1);
        arglist = exp['$[]'](2);
        return this.$process(this.$s("call", recv, mid, arglist), level);
      };

      Parser_prototype.$handle_attr_optimize = function(meth, attrs) {
        var out = nil, __a, __b, __c;
        out = [];
        (__b = attrs, __b.$each._p = (__a = function(attr) {

          var mid = nil, ivar = nil, pre = nil, __a;
          if (this.scope == null) this.scope = nil;

          if (attr == null) attr = nil;

          mid = attr['$[]'](1);
          ivar = ("@" + (mid)).$to_sym();
          pre = this.scope.$proto();
          if ((__a = meth['$==']("attr_writer")) === false || __a === nil) {
            out['$<<'](this.$process(this.$s("defn", mid, this.$s("args"), this.$s("scope", this.$s("ivar", ivar))), "stmt"))
          };
          if (meth['$==']("attr_reader")) {
            return nil
            } else {
            mid = ("" + (mid) + "=").$to_sym();
            return out['$<<'](this.$process(this.$s("defn", mid, this.$s("args", "val"), this.$s("scope", this.$s("iasgn", ivar, this.$s("lvar", "val")))), "stmt"));
          };
        }, __a._s = this, __a), __b.$each());
        return (__a = out.$join(", \n" + (this.indent)), __c = ", nil", typeof(__a) === 'number' ? __a + __c : __a['$+'](__c));
      };

      Parser_prototype.$handle_alias_native = function(sexp) {
        var args = nil, meth = nil, func = nil;
        args = sexp['$[]'](2);
        meth = this.$mid_to_jsid(args['$[]'](1)['$[]'](1).$to_s());
        func = args['$[]'](2)['$[]'](1);
        this.scope.$methods()['$<<'](meth);
        return "%s%s = %s.%s"['$%']([this.scope.$proto(), meth, this.scope.$proto(), func]);
      };

      Parser_prototype.$handle_respond_to = function(sexp, level) {
        var recv = nil, mid = nil, arglist = nil, meth = nil, __a;
        ((__a = sexp)._isArray ? __a : (__a = [__a])), recv = (__a[0] == null ? nil : __a[0]), mid = (__a[1] == null ? nil : __a[1]), arglist = (__a[2] == null ? nil : __a[2]);
        ((__a = recv), __a !== false && __a !== nil ? __a : recv = this.$s("self"));
        if ((__a = arglist['$[]'](1)) !== false && __a !== nil) {
          meth = this.$process(arglist['$[]'](1), level)
        };
        return "(!!" + (this.$process(recv, level)) + "['$' + " + (meth) + "])";
      };

      Parser_prototype.$process_call = function(sexp, level) {
        var recv = nil, meth = nil, arglist = nil, iter = nil, mid = nil, $case = nil, path = nil, splat = nil, block = nil, tmprecv = nil, args = nil, recv_code = nil, result = nil, dispatch = nil, __a, __b, __c;
        ((__a = sexp)._isArray ? __a : (__a = [__a])), recv = (__a[0] == null ? nil : __a[0]), meth = (__a[1] == null ? nil : __a[1]), arglist = (__a[2] == null ? nil : __a[2]), iter = (__a[3] == null ? nil : __a[3]);
        mid = this.$mid_to_jsid(meth.$to_s());
        $case = meth;if ("attr_reader"['$===']($case) || "attr_writer"['$===']($case) || "attr_accessor"['$===']($case)) {
        return this.$handle_attr_optimize(meth, arglist['$[]'](__range(1, -1, false)))
        }
        else if ("block_given?"['$===']($case)) {
        return this.$js_block_given(sexp, level)
        }
        else if ("alias_native"['$===']($case)) {
        if ((__a = this.scope['$class_scope?']()) !== false && __a !== nil) {
          return this.$handle_alias_native(sexp)
        }
        }
        else if ("require"['$===']($case)) {
        path = arglist['$[]'](1);
        if ((__a = ((__b = path !== false && path !== nil) ? path['$[]'](0)['$==']("str") : __b)) !== false && __a !== nil) {
          this.requires['$<<'](path['$[]'](1))
        };
        return "//= require " + (path['$[]'](1));
        }
        else if ("respond_to?"['$===']($case)) {
        return this.$handle_respond_to(sexp, level)
        };
        splat = (__b = arglist['$[]'](__range(1, -1, false)), __b['$any?']._p = (__a = function(a) {


          if (a == null) a = nil;

          return a.$first()['$==']("splat")
        }, __a._s = this, __a), __b['$any?']());
        if ((__a = (__c = __scope.Array['$==='](arglist.$last()), __c !== false && __c !== nil ? arglist.$last().$first()['$==']("block_pass") : __c)) !== false && __a !== nil) {
          block = this.$process(this.$s("js_tmp", this.$process(arglist.$pop(), "expr")), "expr")
          } else {
          if (iter !== false && iter !== nil) {
            block = iter
          }
        };
        ((__a = recv), __a !== false && __a !== nil ? __a : recv = this.$s("self"));
        if (block !== false && block !== nil) {
          tmprecv = this.scope.$new_temp()
          } else {
          if ((__a = (__c = ((__c = splat !== false && splat !== nil) ? !recv['$=='](["self"]) : __c), __c !== false && __c !== nil ? !recv['$[]'](0)['$==']("lvar") : __c)) !== false && __a !== nil) {
            tmprecv = this.scope.$new_temp()
          }
        };
        args = "";
        recv_code = this.$process(recv, "recv");
        args = this.$process(arglist, "expr");
        result = (function() { if (block !== false && block !== nil) {
          dispatch = "(%s = %s, %s%s._p = %s, %s%s"['$%']([tmprecv, recv_code, tmprecv, mid, block, tmprecv, mid]);
          if (splat !== false && splat !== nil) {
            return "%s.apply(null, %s))"['$%']([dispatch, args])
            } else {
            return "%s(%s))"['$%']([dispatch, args])
          };
          } else {
          dispatch = (function() { if (tmprecv !== false && tmprecv !== nil) {
            return "(" + (tmprecv) + " = " + (recv_code) + ")" + (mid)
            } else {
            return "" + (recv_code) + (mid)
          }; return nil; }).call(this);
          if (splat !== false && splat !== nil) {
            return "" + (dispatch) + ".apply(" + (((__a = tmprecv), __a !== false && __a !== nil ? __a : recv_code)) + ", " + (args) + ")"
            } else {
            return "" + (dispatch) + "(" + (args) + ")"
          };
        }; return nil; }).call(this);
        return result;
      };

      Parser_prototype.$process_arglist = function(sexp, level) {
        var code = nil, work = nil, splat = nil, arg = nil, join = nil, __a, __b;
        code = "";
        work = [];
        while (!((__b = sexp['$empty?']()) !== false && __b !== nil)) {splat = sexp.$first().$first()['$==']("splat");
        arg = this.$process(sexp.$shift(), "expr");
        if (splat !== false && splat !== nil) {
          if ((__b = work['$empty?']()) !== false && __b !== nil) {
            if ((__b = code['$empty?']()) !== false && __b !== nil) {
              code = code['$+']("[].concat(" + (arg) + ")")
              } else {
              code = code['$+'](".concat(" + (arg) + ")")
            }
            } else {
            join = "[" + (work.$join(", ")) + "]";
            code = code['$+']((function() { if ((__b = code['$empty?']()) !== false && __b !== nil) {
              return join
              } else {
              return ".concat(" + (join) + ")"
            }; return nil; }).call(this));
            code = code['$+'](".concat(" + (arg) + ")");
          };
          work = [];
          } else {
          work.$push(arg)
        };};
        if ((__a = work['$empty?']()) === false || __a === nil) {
          join = work.$join(", ");
          code = code['$+']((function() { if ((__a = code['$empty?']()) !== false && __a !== nil) {
            return join
            } else {
            return ".concat([" + (work) + "])"
          }; return nil; }).call(this));
        };
        return code;
      };

      Parser_prototype.$process_splat = function(sexp, level) {

        if (sexp.$first()['$=='](["nil"])) {
          return "[]"
        };
        if (sexp.$first().$first()['$==']("lit")) {
          return "[" + (this.$process(sexp.$first(), "expr")) + "]"
        };
        return this.$process(sexp.$first(), "recv");
      };

      Parser_prototype.$process_class = function(sexp, level) {
        var cid = nil, sup = nil, body = nil, code = nil, base = nil, name = nil, spacer = nil, cls = nil, boot = nil, comment = nil, __a, __b;
        ((__a = sexp)._isArray ? __a : (__a = [__a])), cid = (__a[0] == null ? nil : __a[0]), sup = (__a[1] == null ? nil : __a[1]), body = (__a[2] == null ? nil : __a[2]);
        if ((__a = body['$[]'](1)) === false || __a === nil) {
          body['$[]='](1, this.$s("nil"))
        };
        code = nil;
        this.helpers['$[]=']("klass", true);
        if ((__a = ((__b = __scope.Symbol['$==='](cid)), __b !== false && __b !== nil ? __b : __scope.String['$==='](cid))) !== false && __a !== nil) {
          base = this.$current_self();
          name = cid.$to_s();
          } else {
          if (cid['$[]'](0)['$==']("colon2")) {
            base = this.$process(cid['$[]'](1), "expr");
            name = cid['$[]'](2).$to_s();
            } else {
            if (cid['$[]'](0)['$==']("colon3")) {
              base = "Ruby.Object";
              name = cid['$[]'](1).$to_s();
              } else {
              this.$raise("Bad receiver in class")
            }
          }
        };
        sup = (function() { if (sup !== false && sup !== nil) {
          return this.$process(sup, "expr")
          } else {
          return "null"
        }; return nil; }).call(this);
        (__b = this, __b.$indent._p = (__a = function() {

          var __a, __b;

          return (__b = this, __b.$in_scope._p = (__a = function() {

            var needs_block = nil, last_body_statement = nil, __a, __b, __c, __d, __e, __f;
            if (this.scope == null) this.scope = nil;
            if (this.indent == null) this.indent = nil;


            this.scope['$name='](name);
            this.scope.$add_temp("" + (this.scope.$proto()) + " = " + (name) + ".prototype", "__scope = " + (name) + "._scope");
            if ((__a = __scope.Array['$==='](body.$last())) !== false && __a !== nil) {
              needs_block = !body.$last().$first()['$==']("block");
              body.$last().$first()['$==']("block");
              last_body_statement = (function() { if (needs_block !== false && needs_block !== nil) {
                return body.$last()
                } else {
                return body.$last().$last()
              }; return nil; }).call(this);
              if ((__a = ((__b = last_body_statement !== false && last_body_statement !== nil) ? __scope.Array['$==='](last_body_statement) : __b)) !== false && __a !== nil) {
                if ((__a = ["defn", "defs"]['$include?'](last_body_statement.$first())) !== false && __a !== nil) {
                  if (needs_block !== false && needs_block !== nil) {
                    body['$[]='](-1, this.$s("block", body['$[]'](-1)))
                  };
                  body.$last()['$<<'](this.$s("nil"));
                }
              };
            };
            body = this.$returns(body);
            body = this.$process(body, "stmt");
            code = "\n" + (this.scope.$to_donate_methods());
            return code = code['$+']((__a = (__c = (__e = this.indent, __f = this.scope.$to_vars(), typeof(__e) === 'number' ? __e + __f : __e['$+'](__f)), __d = "\n\n" + (this.indent), typeof(__c) === 'number' ? __c + __d : __c['$+'](__d)), __b = body, typeof(__a) === 'number' ? __a + __b : __a['$+'](__b)));
          }, __a._s = this, __a), __b.$in_scope("class"))
        }, __a._s = this, __a), __b.$indent());
        spacer = "\n" + (this.indent) + (__scope.INDENT);
        cls = "function " + (name) + "() {};";
        boot = "" + (name) + " = __klass(__base, __super, " + (name.$inspect()) + ", " + (name) + ");";
        comment = "" + (spacer) + "// line " + (sexp.$line()) + ", " + (this.file) + ", class " + (name);
        return "(function(__base, __super){" + (comment) + (spacer) + (cls) + (spacer) + (boot) + "\n" + (code) + "\n" + (this.indent) + "})(" + (base) + ", " + (sup) + ")";
      };

      Parser_prototype.$process_sclass = function(sexp, level) {
        var recv = nil, body = nil, code = nil, call = nil, __a, __b;
        recv = sexp['$[]'](0);
        body = sexp['$[]'](1);
        code = nil;
        (__b = this, __b.$in_scope._p = (__a = function() {

          var __a, __b;
          if (this.scope == null) this.scope = nil;


          this.scope.$add_temp("__scope = self._scope");
          return code = (__a = this.scope.$to_vars(), __b = this.$process(body, "stmt"), typeof(__a) === 'number' ? __a + __b : __a['$+'](__b));
        }, __a._s = this, __a), __b.$in_scope("sclass"));
        call = this.$s("call", recv, "singleton_class", this.$s("arglist"));
        return "(function(){" + (code) + "}).call(" + (this.$process(call, "expr")) + ")";
      };

      Parser_prototype.$process_module = function(sexp, level) {
        var cid = nil, body = nil, code = nil, base = nil, name = nil, spacer = nil, cls = nil, boot = nil, comment = nil, __a, __b;
        cid = sexp['$[]'](0);
        body = sexp['$[]'](1);
        code = nil;
        this.helpers['$[]=']("module", true);
        if ((__a = ((__b = __scope.Symbol['$==='](cid)), __b !== false && __b !== nil ? __b : __scope.String['$==='](cid))) !== false && __a !== nil) {
          base = this.$current_self();
          name = cid.$to_s();
          } else {
          if (cid['$[]'](0)['$==']("colon2")) {
            base = this.$process(cid['$[]'](1), "expr");
            name = cid['$[]'](2).$to_s();
            } else {
            if (cid['$[]'](0)['$==']("colon3")) {
              base = "Ruby.Object";
              name = cid['$[]'](1).$to_s();
              } else {
              this.$raise("Bad receiver in class")
            }
          }
        };
        (__b = this, __b.$indent._p = (__a = function() {

          var __a, __b;

          return (__b = this, __b.$in_scope._p = (__a = function() {

            var __a, __b, __c, __d, __e, __f, __g, __h, __i, __j;
            if (this.scope == null) this.scope = nil;
            if (this.indent == null) this.indent = nil;


            this.scope['$name='](name);
            this.scope.$add_temp("" + (this.scope.$proto()) + " = " + (name) + ".prototype", "__scope = " + (name) + "._scope");
            body = this.$process(body, "stmt");
            return code = (__a = (__c = (__e = (__g = (__i = this.indent, __j = this.scope.$to_vars(), typeof(__i) === 'number' ? __i + __j : __i['$+'](__j)), __h = "\n\n" + (this.indent), typeof(__g) === 'number' ? __g + __h : __g['$+'](__h)), __f = body, typeof(__e) === 'number' ? __e + __f : __e['$+'](__f)), __d = "\n" + (this.indent), typeof(__c) === 'number' ? __c + __d : __c['$+'](__d)), __b = this.scope.$to_donate_methods(), typeof(__a) === 'number' ? __a + __b : __a['$+'](__b));
          }, __a._s = this, __a), __b.$in_scope("module"))
        }, __a._s = this, __a), __b.$indent());
        spacer = "\n" + (this.indent) + (__scope.INDENT);
        cls = "function " + (name) + "() {};";
        boot = "" + (name) + " = __module(__base, " + (name.$inspect()) + ", " + (name) + ");";
        comment = "" + (spacer) + "// line " + (sexp.$line()) + ", " + (this.file) + ", module " + (name);
        return "(function(__base){" + (comment) + (spacer) + (cls) + (spacer) + (boot) + "\n" + (code) + "\n" + (this.indent) + "})(" + (base) + ")";
      };

      Parser_prototype.$process_undef = function(exp, level) {
        var jsid = nil;
        this.helpers['$[]=']("undef", true);
        jsid = this.$mid_to_jsid(exp['$[]'](0)['$[]'](1).$to_s());
        return "delete " + (this.scope.$proto()) + (jsid);
      };

      Parser_prototype.$process_defn = function(sexp, level) {
        var mid = nil, args = nil, stmts = nil;
        mid = sexp['$[]'](0);
        args = sexp['$[]'](1);
        stmts = sexp['$[]'](2);
        return this.$js_def(nil, mid, args, stmts, sexp.$line(), sexp.$end_line());
      };

      Parser_prototype.$process_defs = function(sexp, level) {
        var recv = nil, mid = nil, args = nil, stmts = nil;
        recv = sexp['$[]'](0);
        mid = sexp['$[]'](1);
        args = sexp['$[]'](2);
        stmts = sexp['$[]'](3);
        return this.$js_def(recv, mid, args, stmts, sexp.$line(), sexp.$end_line());
      };

      Parser_prototype.$js_def = function(recvr, mid, args, stmts, line, end_line) {
        var jsid = nil, smethod = nil, recv = nil, code = nil, params = nil, scope_name = nil, uses_super = nil, opt = nil, block_name = nil, splat = nil, len = nil, defcode = nil, __a, __b;
        jsid = this.$mid_to_jsid(mid.$to_s());
        if (recvr !== false && recvr !== nil) {
          this.scope['$defines_defs='](true);
          if ((__a = (__b = this.scope['$class_scope?'](), __b !== false && __b !== nil ? recvr.$first()['$==']("self") : __b)) !== false && __a !== nil) {
            smethod = true
          };
          recv = this.$process(recvr, "expr");
          } else {
          this.scope['$defines_defn='](true);
          recv = this.$current_self();
        };
        code = "";
        params = nil;
        scope_name = nil;
        uses_super = nil;
        if ((__a = __scope.Array['$==='](args.$last())) !== false && __a !== nil) {
          opt = args.$pop()
        };
        if ((__a = args.$last().$to_s()['$start_with?']("&")) !== false && __a !== nil) {
          block_name = args.$pop().$to_s()['$[]'](__range(1, -1, false)).$to_sym()
        };
        if ((__a = args.$last().$to_s()['$start_with?']("*")) !== false && __a !== nil) {
          if (args.$last()['$==']("*")) {
            args.$pop()
            } else {
            splat = args['$[]'](-1).$to_s()['$[]'](__range(1, -1, false)).$to_sym();
            args['$[]='](-1, splat);
            len = (__a = args.$length(), __b = 2, typeof(__a) === 'number' ? __a - __b : __a['$-'](__b));
          }
        };
        (__b = this, __b.$indent._p = (__a = function() {

          var __a, __b;

          return (__b = this, __b.$in_scope._p = (__a = function() {

            var yielder = nil, blk = nil, __a, __b, __c;
            if (this.scope == null) this.scope = nil;
            if (this.indent == null) this.indent = nil;


            this.scope['$mid='](mid);
            if (recvr !== false && recvr !== nil) {
              this.scope['$defs='](true)
            };
            if (block_name !== false && block_name !== nil) {
              this.scope['$uses_block!']()
            };
            yielder = ((__a = block_name), __a !== false && __a !== nil ? __a : "__yield");
            this.scope['$block_name='](yielder);
            params = this.$process(args, "expr");
            if (opt !== false && opt !== nil) {
              (__b = opt['$[]'](__range(1, -1, false)), __b.$each._p = (__a = function(o) {

                var id = nil, __a, __b;
                if (this.indent == null) this.indent = nil;

                if (o == null) o = nil;

                if (o['$[]'](2)['$[]'](2)['$==']("undefined")) {
                  return nil;
                };
                id = this.$process(this.$s("lvar", o['$[]'](1)), "expr");
                return code = code['$+']("if (%s == null) {\n%s%s\n%s}"['$%']([id, (__a = this.indent, __b = __scope.INDENT, typeof(__a) === 'number' ? __a + __b : __a['$+'](__b)), this.$process(o, "expre"), this.indent]));
              }, __a._s = this, __a), __b.$each())
            };
            if (splat !== false && splat !== nil) {
              code = code['$+']("" + (splat) + " = __slice.call(arguments, " + (len) + ");")
            };
            code = code['$+']((__a = "\n" + (this.indent), __c = this.$process(stmts, "stmt"), typeof(__a) === 'number' ? __a + __c : __a['$+'](__c)));
            scope_name = this.scope.$identity();
            if ((__a = this.scope['$uses_block?']()) !== false && __a !== nil) {
              this.scope.$add_temp("__context");
              this.scope.$add_temp(yielder);
              blk = "\n%s%s = %s._p || nil, __context = %s._s, %s._p = null;\n%s"['$%']([this.indent, yielder, scope_name, yielder, scope_name, this.indent]);
              code = (__a = blk, __c = code, typeof(__a) === 'number' ? __a + __c : __a['$+'](__c));
            };
            uses_super = this.scope.$uses_super();
            return code = (__a = "" + (this.indent) + (this.scope.$to_vars()), __c = code, typeof(__a) === 'number' ? __a + __c : __a['$+'](__c));
          }, __a._s = this, __a), __b.$in_scope("def"))
        }, __a._s = this, __a), __b.$indent());
        defcode = "" + ((function() { if (scope_name !== false && scope_name !== nil) {
          return "" + (scope_name) + " = "
          } else {
          return nil
        }; return nil; }).call(this)) + "function(" + (params) + ") {\n" + (code) + "\n" + (this.indent) + "}";
        if (recvr !== false && recvr !== nil) {
          if (smethod !== false && smethod !== nil) {
            this.scope.$smethods()['$<<']("$" + (mid));
            return "" + (this.scope.$name()) + (jsid) + " = " + (defcode);
            } else {
            return "" + (recv) + (jsid) + " = " + (defcode)
          }
          } else {
          if ((__a = this.scope['$class_scope?']()) !== false && __a !== nil) {
            this.scope.$methods()['$<<']("$" + (mid));
            if (uses_super !== false && uses_super !== nil) {
              this.scope.$add_temp(uses_super);
              uses_super = "" + (uses_super) + " = " + (this.scope.$proto()) + (jsid) + ";\n" + (this.indent);
            };
            return "" + (uses_super) + (this.scope.$proto()) + (jsid) + " = " + (defcode);
            } else {
            if (this.scope.$type()['$==']("iter")) {
              return "def" + (jsid) + " = " + (defcode)
              } else {
              if (this.scope.$type()['$==']("top")) {
                return "" + (this.$current_self()) + (jsid) + " = " + (defcode)
                } else {
                return "def" + (jsid) + " = " + (defcode)
              }
            }
          }
        };
      };

      Parser_prototype.$arity_check = function(args, opt, splat) {
        var arity = nil, aritycode = nil, __a, __b, __c, __d;
        arity = (__a = args.$size(), __b = 1, typeof(__a) === 'number' ? __a - __b : __a['$-'](__b));
        if (opt !== false && opt !== nil) {
          arity = arity['$-']((__a = opt.$size(), __b = 1, typeof(__a) === 'number' ? __a - __b : __a['$-'](__b)))
        };
        if (splat !== false && splat !== nil) {
          arity = arity['$-'](1)
        };
        if ((__a = ((__b = opt), __b !== false && __b !== nil ? __b : splat)) !== false && __a !== nil) {
          arity = (__a = arity['$-@'](), __b = 1, typeof(__a) === 'number' ? __a - __b : __a['$-'](__b))
        };
        aritycode = "var $arity = arguments.length; if ($arity !== 0) { $arity -= 1; }";
        if (arity['$<'](0)) {
          return (__a = aritycode, __b = "if ($arity < " + ((__c = arity, __d = 1, typeof(__c) === 'number' ? __c + __d : __c['$+'](__d))['$-@']()) + ") { Ruby.arg_error($arity, " + (arity) + "); }", typeof(__a) === 'number' ? __a + __b : __a['$+'](__b))
          } else {
          return (__a = aritycode, __b = "if ($arity !== " + (arity) + ") { Ruby.arg_error($arity, " + (arity) + "); }", typeof(__a) === 'number' ? __a + __b : __a['$+'](__b))
        };
      };

      Parser_prototype.$process_args = function(exp, level) {
        var args = nil, a = nil, __a, __b;
        args = [];
        while (!((__b = exp['$empty?']()) !== false && __b !== nil)) {a = exp.$shift().$to_sym();
        if ((__b = __scope.RESERVED['$include?'](a.$to_s())) !== false && __b !== nil) {
          a = ("" + (a) + "$").$to_sym()
        };
        this.scope.$add_arg(a);
        args['$<<'](a);};
        return args.$join(", ");
      };

      Parser_prototype.$process_self = function(sexp, level) {

        return this.$current_self();
      };

      Parser_prototype.$current_self = function() {
        var __a;
        if ((__a = this.scope['$class_scope?']()) !== false && __a !== nil) {
          return this.scope.$name()
          } else {
          if ((__a = this.scope['$top?']()) !== false && __a !== nil) {
            return "self"
            } else {
            if ((__a = this.scope['$top?']()) !== false && __a !== nil) {
              return "self"
              } else {
              return "this"
            }
          }
        };
      };

      (__b = ["true", "false", "nil"], __b.$each._p = (__a = function(name) {

        var __a, __b;
        if (name == null) name = nil;

        return (__b = this, __b.$define_method._p = (__a = function(exp, level) {


          if (exp == null) exp = nil;
if (level == null) level = nil;

          return name
        }, __a._s = this, __a), __b.$define_method("process_" + (name)))
      }, __a._s = Parser, __a), __b.$each());

      Parser_prototype.$process_array = function(sexp, level) {
        var code = nil, work = nil, splat = nil, part = nil, join = nil, __a, __b;
        if ((__a = sexp['$empty?']()) !== false && __a !== nil) {
          return "[]"
        };
        code = "";
        work = [];
        while (!((__b = sexp['$empty?']()) !== false && __b !== nil)) {splat = sexp.$first().$first()['$==']("splat");
        part = this.$process(sexp.$shift(), "expr");
        if (splat !== false && splat !== nil) {
          if ((__b = work['$empty?']()) !== false && __b !== nil) {
            code = code['$+']((function() { if ((__b = code['$empty?']()) !== false && __b !== nil) {
              return part
              } else {
              return ".concat(" + (part) + ")"
            }; return nil; }).call(this))
            } else {
            join = "[" + (work.$join(", ")) + "]";
            code = code['$+']((function() { if ((__b = code['$empty?']()) !== false && __b !== nil) {
              return join
              } else {
              return ".concat(" + (join) + ")"
            }; return nil; }).call(this));
            code = code['$+'](".concat(" + (part) + ")");
          };
          work = [];
          } else {
          work['$<<'](part)
        };};
        if ((__a = work['$empty?']()) === false || __a === nil) {
          join = "[" + (work.$join(", ")) + "]";
          code = code['$+']((function() { if ((__a = code['$empty?']()) !== false && __a !== nil) {
            return join
            } else {
            return ".concat(" + (join) + ")"
          }; return nil; }).call(this));
        };
        return code;
      };

      Parser_prototype.$process_hash = function(sexp, level) {
        var keys = nil, vals = nil, hash_obj = nil, hash_keys = nil, map = nil, __a, __b, __c, __d, __e, __f;
        keys = [];
        vals = [];
        (__b = sexp, __b.$each_with_index._p = (__a = function(obj, idx) {

          var __a;
          if (obj == null) obj = nil;
if (idx == null) idx = nil;

          if ((__a = idx['$even?']()) !== false && __a !== nil) {
            return keys['$<<'](obj)
            } else {
            return vals['$<<'](obj)
          }
        }, __a._s = this, __a), __b.$each_with_index());
        if ((__a = (__d = keys, __d['$all?']._p = (__c = function(k) {


          if (k == null) k = nil;

          return ["lit", "str"]['$include?'](k['$[]'](0))
        }, __c._s = this, __c), __d['$all?']())) !== false && __a !== nil) {
          hash_obj = __hash2([], {});
          hash_keys = [];
          (__c = keys.$size(), __c.$times._p = (__a = function(i) {

            var k = nil, __a;
            if (i == null) i = nil;

            k = this.$process(keys['$[]'](i), "expr");
            if ((__a = hash_obj['$include?'](k)) === false || __a === nil) {
              hash_keys['$<<'](k)
            };
            return hash_obj['$[]='](k, this.$process(vals['$[]'](i), "expr"));
          }, __a._s = this, __a), __c.$times());
          map = (__e = hash_keys, __e.$map._p = (__a = function(k) {


            if (k == null) k = nil;

            return "" + (k) + ": " + (hash_obj['$[]'](k))
          }, __a._s = this, __a), __e.$map());
          this.helpers['$[]=']("hash2", true);
          return "__hash2([" + (hash_keys.$join(", ")) + "], {" + (map.$join(", ")) + "})";
          } else {
          this.helpers['$[]=']("hash", true);
          return "__hash(" + ((__f = sexp, __f.$map._p = (__a = function(p) {


            if (p == null) p = nil;

            return this.$process(p, "expr")
          }, __a._s = this, __a), __f.$map()).$join(", ")) + ")";
        };
      };

      Parser_prototype.$process_while = function(sexp, level) {
        var expr = nil, stmt = nil, redo_var = nil, stmt_level = nil, pre = nil, code = nil, __a, __b, __c;
        expr = sexp['$[]'](0);
        stmt = sexp['$[]'](1);
        redo_var = this.scope.$new_temp();
        stmt_level = (function() { if ((__a = ((__b = level['$==']("expr")), __b !== false && __b !== nil ? __b : level['$==']("recv"))) !== false && __a !== nil) {
          return "stmt_closure"
          } else {
          return "stmt"
        }; return nil; }).call(this);
        pre = "while (";
        code = "" + (this.$js_truthy(expr)) + "){";
        (__b = this, __b.$in_while._p = (__a = function() {

          var body = nil, __a, __b, __c, __d;
          if (this.while_loop == null) this.while_loop = nil;


          if (stmt_level['$==']("stmt_closure")) {
            this.while_loop['$[]=']("closure", true)
          };
          this.while_loop['$[]=']("redo_var", redo_var);
          body = this.$process(stmt, "stmt");
          if ((__a = this.while_loop['$[]']("use_redo")) !== false && __a !== nil) {
            pre = (__a = (__c = "" + (redo_var) + "=false;", __d = pre, typeof(__c) === 'number' ? __c + __d : __c['$+'](__d)), __b = "" + (redo_var) + " || ", typeof(__a) === 'number' ? __a + __b : __a['$+'](__b));
            code = code['$+']("" + (redo_var) + "=false;");
          };
          return code = code['$+'](body);
        }, __a._s = this, __a), __b.$in_while());
        code = code['$+']("}");
        code = (__a = pre, __c = code, typeof(__a) === 'number' ? __a + __c : __a['$+'](__c));
        this.scope.$queue_temp(redo_var);
        if (stmt_level['$==']("stmt_closure")) {
          code = "(function() {" + (code) + "; return nil;}).call(" + (this.$current_self()) + ")"
        };
        return code;
      };

      Parser_prototype.$process_until = function(exp, level) {
        var expr = nil, stmt = nil, redo_var = nil, stmt_level = nil, pre = nil, code = nil, __a, __b, __c;
        expr = exp['$[]'](0);
        stmt = exp['$[]'](1);
        redo_var = this.scope.$new_temp();
        stmt_level = (function() { if ((__a = ((__b = level['$==']("expr")), __b !== false && __b !== nil ? __b : level['$==']("recv"))) !== false && __a !== nil) {
          return "stmt_closure"
          } else {
          return "stmt"
        }; return nil; }).call(this);
        pre = "while (!(";
        code = "" + (this.$js_truthy(expr)) + ")) {";
        (__b = this, __b.$in_while._p = (__a = function() {

          var body = nil, __a, __b, __c, __d;
          if (this.while_loop == null) this.while_loop = nil;


          if (stmt_level['$==']("stmt_closure")) {
            this.while_loop['$[]=']("closure", true)
          };
          this.while_loop['$[]=']("redo_var", redo_var);
          body = this.$process(stmt, "stmt");
          if ((__a = this.while_loop['$[]']("use_redo")) !== false && __a !== nil) {
            pre = (__a = (__c = "" + (redo_var) + "=false;", __d = pre, typeof(__c) === 'number' ? __c + __d : __c['$+'](__d)), __b = "" + (redo_var) + " || ", typeof(__a) === 'number' ? __a + __b : __a['$+'](__b));
            code = code['$+']("" + (redo_var) + "=false;");
          };
          return code = code['$+'](body);
        }, __a._s = this, __a), __b.$in_while());
        code = code['$+']("}");
        code = (__a = pre, __c = code, typeof(__a) === 'number' ? __a + __c : __a['$+'](__c));
        this.scope.$queue_temp(redo_var);
        if (stmt_level['$==']("stmt_closure")) {
          code = "(function() {" + (code) + "; return nil;}).call(" + (this.$current_self()) + ")"
        };
        return code;
      };

      Parser_prototype.$process_alias = function(exp, level) {
        var new$ = nil, old = nil, current = nil, __a;
        new$ = this.$mid_to_jsid(exp['$[]'](0)['$[]'](1).$to_s());
        old = this.$mid_to_jsid(exp['$[]'](1)['$[]'](1).$to_s());
        if ((__a = ["class", "module"]['$include?'](this.scope.$type())) !== false && __a !== nil) {
          this.scope.$methods()['$<<']("$" + (exp['$[]'](0)['$[]'](1).$to_s()));
          return "%s%s = %s%s"['$%']([this.scope.$proto(), new$, this.scope.$proto(), old]);
          } else {
          current = this.$current_self();
          return "%s.prototype%s = %s.prototype%s"['$%']([current, new$, current, old]);
        };
      };

      Parser_prototype.$process_masgn = function(sexp, level) {
        var lhs = nil, rhs = nil, tmp = nil, len = nil, code = nil, __a, __b;
        lhs = sexp['$[]'](0);
        rhs = sexp['$[]'](1);
        tmp = this.scope.$new_temp();
        len = 0;
        lhs.$shift();
        if (rhs['$[]'](0)['$==']("array")) {
          len = (__a = rhs.$length(), __b = 1, typeof(__a) === 'number' ? __a - __b : __a['$-'](__b));
          code = ["" + (tmp) + " = " + (this.$process(rhs, "expr"))];
          } else {
          if (rhs['$[]'](0)['$==']("to_ary")) {
            code = ["((" + (tmp) + " = " + (this.$process(rhs['$[]'](1), "expr")) + ")._isArray ? " + (tmp) + " : (" + (tmp) + " = [" + (tmp) + "]))"]
            } else {
            if (rhs['$[]'](0)['$==']("splat")) {
              code = ["" + (tmp) + " = " + (this.$process(rhs['$[]'](1), "expr"))]
              } else {
              this.$raise("Unsupported mlhs type")
            }
          }
        };
        (__b = lhs, __b.$each_with_index._p = (__a = function(l, idx) {

          var s = nil;
          if (l == null) l = nil;
if (idx == null) idx = nil;

          if (l.$first()['$==']("splat")) {
            s = l['$[]'](1);
            s['$<<'](this.$s("js_tmp", "__slice.call(" + (tmp) + ", " + (idx) + ")"));
            return code['$<<'](this.$process(s, "expr"));
            } else {
            if (idx['$>='](len)) {
              l['$<<'](this.$s("js_tmp", "(" + (tmp) + "[" + (idx) + "] == null ? nil : " + (tmp) + "[" + (idx) + "])"))
              } else {
              l['$<<'](this.$s("js_tmp", "" + (tmp) + "[" + (idx) + "]"))
            };
            return code['$<<'](this.$process(l, "expr"));
          }
        }, __a._s = this, __a), __b.$each_with_index());
        this.scope.$queue_temp(tmp);
        return code.$join(", ");
      };

      Parser_prototype.$process_svalue = function(sexp, level) {

        return this.$process(sexp.$shift(), level);
      };

      Parser_prototype.$process_lasgn = function(sexp, level) {
        var lvar = nil, rhs = nil, res = nil, __a;
        lvar = sexp['$[]'](0);
        rhs = sexp['$[]'](1);
        if ((__a = __scope.RESERVED['$include?'](lvar.$to_s())) !== false && __a !== nil) {
          lvar = ("" + (lvar) + "$").$to_sym()
        };
        this.scope.$add_local(lvar);
        res = "" + (lvar) + " = " + (this.$process(rhs, "expr"));
        if (level['$==']("recv")) {
          return "(" + (res) + ")"
          } else {
          return res
        };
      };

      Parser_prototype.$process_lvar = function(exp, level) {
        var lvar = nil, __a;
        lvar = exp.$shift().$to_s();
        if ((__a = __scope.RESERVED['$include?'](lvar)) !== false && __a !== nil) {
          lvar = "" + (lvar) + "$"
        };
        return lvar;
      };

      Parser_prototype.$process_iasgn = function(exp, level) {
        var ivar = nil, rhs = nil, lhs = nil, __a;
        ivar = exp['$[]'](0);
        rhs = exp['$[]'](1);
        ivar = ivar.$to_s()['$[]'](__range(1, -1, false));
        lhs = (function() { if ((__a = __scope.RESERVED['$include?'](ivar)) !== false && __a !== nil) {
          return "" + (this.$current_self()) + "['" + (ivar) + "']"
          } else {
          return "" + (this.$current_self()) + "." + (ivar)
        }; return nil; }).call(this);
        return "" + (lhs) + " = " + (this.$process(rhs, "expr"));
      };

      Parser_prototype.$process_ivar = function(exp, level) {
        var ivar = nil, part = nil, __a;
        ivar = exp.$shift().$to_s()['$[]'](__range(1, -1, false));
        part = (function() { if ((__a = __scope.RESERVED['$include?'](ivar)) !== false && __a !== nil) {
          return "['" + (ivar) + "']"
          } else {
          return "." + (ivar)
        }; return nil; }).call(this);
        this.scope.$add_ivar(part);
        return "" + (this.$current_self()) + (part);
      };

      Parser_prototype.$process_gvar = function(sexp, level) {
        var gvar = nil;
        gvar = sexp.$shift().$to_s()['$[]'](__range(1, -1, false));
        this.helpers['$[]=']("gvars", true);
        return "__gvars[" + (gvar.$inspect()) + "]";
      };

      Parser_prototype.$process_gasgn = function(sexp, level) {
        var gvar = nil, rhs = nil;
        gvar = sexp['$[]'](0).$to_s()['$[]'](__range(1, -1, false));
        rhs = sexp['$[]'](1);
        this.helpers['$[]=']("gvars", true);
        return "__gvars[" + (gvar.$to_s().$inspect()) + "] = " + (this.$process(rhs, "expr"));
      };

      Parser_prototype.$process_const = function(sexp, level) {

        return "__scope." + (sexp.$shift());
      };

      Parser_prototype.$process_cdecl = function(sexp, level) {
        var const$ = nil, rhs = nil;
        const$ = sexp['$[]'](0);
        rhs = sexp['$[]'](1);
        return "__scope." + (const$) + " = " + (this.$process(rhs, "expr"));
      };

      Parser_prototype.$process_return = function(sexp, level) {
        var val = nil, __a;
        val = this.$process(((__a = sexp.$shift()), __a !== false && __a !== nil ? __a : this.$s("nil")), "expr");
        if ((__a = level['$==']("stmt")) === false || __a === nil) {
          this.$raise("Cannot return as an expression")
        };
        return "return " + (val);
      };

      Parser_prototype.$process_xstr = function(sexp, level) {
        var code = nil, __a, __b;
        code = sexp.$first().$to_s();
        if ((__a = ((__b = level['$==']("stmt")) ? !code['$include?'](";") : __b)) !== false && __a !== nil) {
          code = code['$+'](";")
        };
        if (level['$==']("recv")) {
          return "(" + (code) + ")"
          } else {
          return code
        };
      };

      Parser_prototype.$process_dxstr = function(sexp, level) {
        var code = nil, __a, __b, __c;
        code = (__b = sexp, __b.$map._p = (__a = function(p) {

          var __a;
          if (p == null) p = nil;

          if ((__a = __scope.String['$==='](p)) !== false && __a !== nil) {
            return p.$to_s()
            } else {
            if (p.$first()['$==']("evstr")) {
              return this.$process(p.$last(), "stmt")
              } else {
              if (p.$first()['$==']("str")) {
                return p.$last().$to_s()
                } else {
                return this.$raise("Bad dxstr part")
              }
            }
          }
        }, __a._s = this, __a), __b.$map()).$join();
        if ((__a = ((__c = level['$==']("stmt")) ? !code['$include?'](";") : __c)) !== false && __a !== nil) {
          code = code['$+'](";")
        };
        if (level['$==']("recv")) {
          code = "(" + (code) + ")"
        };
        return code;
      };

      Parser_prototype.$process_dstr = function(sexp, level) {
        var parts = nil, res = nil, __a, __b;
        parts = (__b = sexp, __b.$map._p = (__a = function(p) {

          var __a, __b, __c, __d;
          if (p == null) p = nil;

          if ((__a = __scope.String['$==='](p)) !== false && __a !== nil) {
            return p.$inspect()
            } else {
            if (p.$first()['$==']("evstr")) {
              return (__a = (__c = "(", __d = this.$process(p.$last(), "expr"), typeof(__c) === 'number' ? __c + __d : __c['$+'](__d)), __b = ")", typeof(__a) === 'number' ? __a + __b : __a['$+'](__b))
              } else {
              if (p.$first()['$==']("str")) {
                return p.$last().$inspect()
                } else {
                return this.$raise("Bad dstr part")
              }
            }
          }
        }, __a._s = this, __a), __b.$map());
        res = parts.$join(" + ");
        if (level['$==']("recv")) {
          return "(" + (res) + ")"
          } else {
          return res
        };
      };

      Parser_prototype.$process_dsym = function(sexp, level) {
        var parts = nil, __a, __b;
        parts = (__b = sexp, __b.$map._p = (__a = function(p) {

          var __a;
          if (p == null) p = nil;

          if ((__a = __scope.String['$==='](p)) !== false && __a !== nil) {
            return p.$inspect()
            } else {
            if (p.$first()['$==']("evstr")) {
              return this.$process(this.$s("call", p.$last(), "to_s", this.$s("arglist")), "expr")
              } else {
              if (p.$first()['$==']("str")) {
                return p.$last().$inspect()
                } else {
                return this.$raise("Bad dsym part")
              }
            }
          }
        }, __a._s = this, __a), __b.$map());
        return "(" + (parts.$join("+")) + ")";
      };

      Parser_prototype.$process_if = function(sexp, level) {
        var test = nil, truthy = nil, falsy = nil, returnable = nil, check = nil, code = nil, __a, __b, __c;
        ((__a = sexp)._isArray ? __a : (__a = [__a])), test = (__a[0] == null ? nil : __a[0]), truthy = (__a[1] == null ? nil : __a[1]), falsy = (__a[2] == null ? nil : __a[2]);
        returnable = ((__a = level['$==']("expr")), __a !== false && __a !== nil ? __a : level['$==']("recv"));
        if (returnable !== false && returnable !== nil) {
          truthy = this.$returns(((__a = truthy), __a !== false && __a !== nil ? __a : this.$s("nil")));
          falsy = this.$returns(((__a = falsy), __a !== false && __a !== nil ? __a : this.$s("nil")));
        };
        if ((__a = ((__b = falsy !== false && falsy !== nil) ? !truthy : __b)) !== false && __a !== nil) {
          truthy = falsy;
          falsy = nil;
          check = this.$js_falsy(test);
          } else {
          check = this.$js_truthy(test)
        };
        code = "if (" + (check) + ") {\n";
        if (truthy !== false && truthy !== nil) {
          (__b = this, __b.$indent._p = (__a = function() {

            var __a, __b;
            if (this.indent == null) this.indent = nil;


            return code = code['$+']((__a = this.indent, __b = this.$process(truthy, "stmt"), typeof(__a) === 'number' ? __a + __b : __a['$+'](__b)))
          }, __a._s = this, __a), __b.$indent())
        };
        if (falsy !== false && falsy !== nil) {
          (__c = this, __c.$indent._p = (__a = function() {


            if (this.indent == null) this.indent = nil;


            return code = code['$+']("\n" + (this.indent) + "} else {\n" + (this.indent) + (this.$process(falsy, "stmt")))
          }, __a._s = this, __a), __c.$indent())
        };
        code = code['$+']("\n" + (this.indent) + "}");
        if (returnable !== false && returnable !== nil) {
          code = "(function() { " + (code) + "; return nil; }).call(" + (this.$current_self()) + ")"
        };
        return code;
      };

      Parser_prototype.$js_truthy_optimize = function(sexp) {
        var mid = nil, name = nil, __a;
        if (sexp.$first()['$==']("call")) {
          mid = sexp['$[]'](2);
          if (mid['$==']("block_given?")) {
            return this.$process(sexp, "expr")
            } else {
            if ((__a = __scope.COMPARE['$include?'](mid.$to_s())) !== false && __a !== nil) {
              return this.$process(sexp, "expr")
              } else {
              if (mid['$==']("==")) {
                return this.$process(sexp, "expr")
                } else {
                return nil
              }
            }
          };
          } else {
          if ((__a = ["lvar", "self"]['$include?'](sexp.$first())) !== false && __a !== nil) {
            name = this.$process(sexp, "expr");
            return "" + (name) + " !== false && " + (name) + " !== nil";
            } else {
            return nil
          }
        };
      };

      Parser_prototype.$js_truthy = function(sexp) {
        var optimized = nil, __a, __b;
        if ((__a = optimized = this.$js_truthy_optimize(sexp)) !== false && __a !== nil) {
          return optimized
        };
        return (__b = this, __b.$with_temp._p = (__a = function(tmp) {


          if (tmp == null) tmp = nil;

          return "(%s = %s) !== false && %s !== nil"['$%']([tmp, this.$process(sexp, "expr"), tmp])
        }, __a._s = this, __a), __b.$with_temp());
      };

      Parser_prototype.$js_falsy = function(sexp) {
        var mid = nil, __a, __b;
        if (sexp.$first()['$==']("call")) {
          mid = sexp['$[]'](2);
          if (mid['$==']("block_given?")) {
            return this.$handle_block_given(sexp, true)
          };
        };
        return (__b = this, __b.$with_temp._p = (__a = function(tmp) {


          if (tmp == null) tmp = nil;

          return "(%s = %s) === false || %s === nil"['$%']([tmp, this.$process(sexp, "expr"), tmp])
        }, __a._s = this, __a), __b.$with_temp());
      };

      Parser_prototype.$process_and = function(sexp, level) {
        var lhs = nil, rhs = nil, t = nil, tmp = nil, __a, __b;
        lhs = sexp['$[]'](0);
        rhs = sexp['$[]'](1);
        t = nil;
        tmp = this.scope.$new_temp();
        if ((__a = t = this.$js_truthy_optimize(lhs)) !== false && __a !== nil) {
          return (__b = ("((" + (tmp) + " = " + (t) + ") ? " + (this.$process(rhs, "expr")) + " : " + (tmp) + ")"), __b.$tap._p = (__a = function() {


            if (this.scope == null) this.scope = nil;


            return this.scope.$queue_temp(tmp)
          }, __a._s = this, __a), __b.$tap())
        };
        this.scope.$queue_temp(tmp);
        return "(%s = %s, %s !== false && %s !== nil ? %s : %s)"['$%']([tmp, this.$process(lhs, "expr"), tmp, tmp, this.$process(rhs, "expr"), tmp]);
      };

      Parser_prototype.$process_or = function(sexp, level) {
        var lhs = nil, rhs = nil, t = nil, __a, __b;
        lhs = sexp['$[]'](0);
        rhs = sexp['$[]'](1);
        t = nil;
        return (__b = this, __b.$with_temp._p = (__a = function(tmp) {


          if (tmp == null) tmp = nil;

          return "((%s = %s), %s !== false && %s !== nil ? %s : %s)"['$%']([tmp, this.$process(lhs, "expr"), tmp, tmp, tmp, this.$process(rhs, "expr")])
        }, __a._s = this, __a), __b.$with_temp());
      };

      Parser_prototype.$process_yield = function(sexp, level) {
        var call = nil, __a, __b;
        call = this.$handle_yield_call(sexp, level);
        if (level['$==']("stmt")) {
          return "if (" + (call) + " === __breaker) return __breaker.$v"
          } else {
          return (__b = this, __b.$with_temp._p = (__a = function(tmp) {


            if (tmp == null) tmp = nil;

            return "(((" + (tmp) + " = " + (call) + ") === __breaker) ? __breaker.$v : " + (tmp) + ")"
          }, __a._s = this, __a), __b.$with_temp())
        };
      };

      Parser_prototype.$process_yasgn = function(sexp, level) {
        var call = nil;
        call = this.$handle_yield_call(this.$s.apply(this, [].concat(sexp['$[]'](1)['$[]'](__range(1, -1, false)))), "stmt");
        return "if ((%s = %s) === __breaker) return __breaker.$v"['$%']([sexp['$[]'](0), call]);
      };

      Parser_prototype.$process_returnable_yield = function(sexp, level) {
        var call = nil, __a, __b;
        call = this.$handle_yield_call(sexp, level);
        return (__b = this, __b.$with_temp._p = (__a = function(tmp) {


          if (tmp == null) tmp = nil;

          return "return %s = %s, %s === __breaker ? %s : %s"['$%']([tmp, call, tmp, tmp, tmp])
        }, __a._s = this, __a), __b.$with_temp());
      };

      Parser_prototype.$handle_yield_call = function(sexp, level) {
        var splat = nil, args = nil, y = nil, __a, __b;
        this.scope['$uses_block!']();
        splat = (__b = sexp, __b['$any?']._p = (__a = function(s) {


          if (s == null) s = nil;

          return s.$first()['$==']("splat")
        }, __a._s = this, __a), __b['$any?']());
        if ((__a = splat) === false || __a === nil) {
          sexp.$unshift(this.$s("js_tmp", "__context"))
        };
        args = this.$process_arglist(sexp, level);
        y = ((__a = this.scope.$block_name()), __a !== false && __a !== nil ? __a : "__yield");
        if (splat !== false && splat !== nil) {
          return "" + (y) + ".apply(__context, " + (args) + ")"
          } else {
          return "" + (y) + ".call(" + (args) + ")"
        };
      };

      Parser_prototype.$process_break = function(exp, level) {
        var val = nil, __a;
        val = (function() { if ((__a = exp['$empty?']()) !== false && __a !== nil) {
          return "nil"
          } else {
          return this.$process(exp.$shift(), "expr")
        }; return nil; }).call(this);
        if ((__a = this['$in_while?']()) !== false && __a !== nil) {
          if ((__a = this.while_loop['$[]']("closure")) !== false && __a !== nil) {
            return "return " + (val) + ";"
            } else {
            return "break;"
          }
          } else {
          if ((__a = this.scope['$iter?']()) !== false && __a !== nil) {
            if ((__a = level['$==']("stmt")) === false || __a === nil) {
              this.$error("break must be used as a statement")
            };
            return "return (__breaker.$v = " + (val) + ", __breaker)";
            } else {
            return this.$error("cannot use break outside of iter/while")
          }
        };
      };

      Parser_prototype.$process_case = function(exp, level) {
        var code = nil, expr = nil, returnable = nil, done_else = nil, wen = nil, __a, __b, __c;
        code = [];
        this.scope.$add_local("$case");
        expr = this.$process(exp.$shift(), "expr");
        returnable = !level['$==']("stmt");
        done_else = false;
        while (!((__b = exp['$empty?']()) !== false && __b !== nil)) {wen = exp.$shift();
        if ((__b = ((__c = wen !== false && wen !== nil) ? wen.$first()['$==']("when") : __c)) !== false && __b !== nil) {
          if (returnable !== false && returnable !== nil) {
            this.$returns(wen)
          };
          wen = this.$process(wen, "stmt");
          if ((__b = code['$empty?']()) === false || __b === nil) {
            wen = "else " + (wen)
          };
          code['$<<'](wen);
          } else {
          if (wen !== false && wen !== nil) {
            done_else = true;
            if (returnable !== false && returnable !== nil) {
              wen = this.$returns(wen)
            };
            code['$<<']("else {" + (this.$process(wen, "stmt")) + "}");
          }
        };};
        if ((__a = ((__b = returnable !== false && returnable !== nil) ? !done_else : __b)) !== false && __a !== nil) {
          code['$<<']("else {return nil}")
        };
        code = "$case = " + (expr) + ";" + (code.$join(this.space));
        if (returnable !== false && returnable !== nil) {
          code = "(function() { " + (code) + " }).call(" + (this.$current_self()) + ")"
        };
        return code;
      };

      Parser_prototype.$process_when = function(exp, level) {
        var arg = nil, body = nil, test = nil, a = nil, call = nil, splt = nil, __a, __b;
        arg = exp.$shift()['$[]'](__range(1, -1, false));
        body = exp.$shift();
        if (body !== false && body !== nil) {
          body = this.$process(body, level)
        };
        test = [];
        while (!((__b = arg['$empty?']()) !== false && __b !== nil)) {a = arg.$shift();
        if (a.$first()['$==']("splat")) {
          call = this.$s("call", this.$s("js_tmp", "$splt[i]"), "===", this.$s("arglist", this.$s("js_tmp", "$case")));
          splt = "(function($splt) {for(var i = 0; i < $splt.length; i++) {";
          splt = splt['$+']("if (" + (this.$process(call, "expr")) + ") { return true; }");
          splt = splt['$+']("} return false; }).call(" + (this.$current_self()) + ", " + (this.$process(a['$[]'](1), "expr")) + ")");
          test['$<<'](splt);
          } else {
          call = this.$s("call", a, "===", this.$s("arglist", this.$s("js_tmp", "$case")));
          call = this.$process(call, "expr");
          test['$<<'](call);
        };};
        return "if (%s) {%s%s%s}"['$%']([test.$join(" || "), this.space, body, this.space]);
      };

      Parser_prototype.$process_match3 = function(sexp, level) {
        var lhs = nil, rhs = nil, call = nil;
        lhs = sexp['$[]'](0);
        rhs = sexp['$[]'](1);
        call = this.$s("call", lhs, "=~", this.$s("arglist", rhs));
        return this.$process(call, level);
      };

      Parser_prototype.$process_cvar = function(exp, level) {
        var __a, __b;
        return (__b = this, __b.$with_temp._p = (__a = function(tmp) {


          if (tmp == null) tmp = nil;

          return "((%s = Ruby.cvars[%s]) == null ? nil : %s)"['$%']([tmp, exp.$shift().$to_s().$inspect(), tmp])
        }, __a._s = this, __a), __b.$with_temp());
      };

      Parser_prototype.$process_cvasgn = function(exp, level) {

        return "(Ruby.cvars[" + (exp.$shift().$to_s().$inspect()) + "] = " + (this.$process(exp.$shift(), "expr")) + ")";
      };

      Parser_prototype.$process_cvdecl = function(exp, level) {

        return "(Ruby.cvars[" + (exp.$shift().$to_s().$inspect()) + "] = " + (this.$process(exp.$shift(), "expr")) + ")";
      };

      Parser_prototype.$process_colon2 = function(sexp, level) {
        var base = nil, name = nil;
        base = sexp['$[]'](0);
        name = sexp['$[]'](1);
        return "(%s)._scope.%s"['$%']([this.$process(base, "expr"), name.$to_s()]);
      };

      Parser_prototype.$process_colon3 = function(exp, level) {

        return "__Ruby.Object._scope." + (exp.$shift().$to_s());
      };

      Parser_prototype.$process_super = function(sexp, level) {
        var args = nil, __a, __b;
        args = [];
        while (!((__b = sexp['$empty?']()) !== false && __b !== nil)) {args['$<<'](this.$process(sexp.$shift(), "expr"))};
        return this.$js_super("[" + (args.$join(", ")) + "]");
      };

      Parser_prototype.$process_zsuper = function(exp, level) {

        return this.$js_super("[self].concat(__slice.call(arguments))");
      };

      Parser_prototype.$js_super = function(args) {
        var mid = nil, sid = nil, identity = nil, cls_name = nil, jsid = nil, chain = nil, defn = nil, trys = nil, __a, __b;
        if ((__a = this.scope['$def_in_class?']()) !== false && __a !== nil) {
          mid = this.scope.$mid().$to_s();
          sid = "super_" + (this.$unique_temp());
          this.scope['$uses_super='](sid);
          return "" + (sid) + ".apply(" + (this.$current_self()) + ", " + (args) + ")";
          } else {
          if (this.scope.$type()['$==']("def")) {
            identity = this.scope['$identify!']();
            cls_name = this.scope.$parent().$name();
            jsid = this.$mid_to_jsid(this.scope.$mid().$to_s());
            if ((__a = this.scope.$defs()) !== false && __a !== nil) {
              return "%s._super%s.apply(this, %s)"['$%']([cls_name, jsid, args])
              } else {
              return ("" + (this.$current_self()) + "._klass._super.prototype%s.apply(" + (this.$current_self()) + ", %s)")['$%']([jsid, args])
            };
            } else {
            if (this.scope.$type()['$==']("iter")) {
              ((__a = this.scope.$get_super_chain())._isArray ? __a : (__a = [__a])), chain = (__a[0] == null ? nil : __a[0]), defn = (__a[1] == null ? nil : __a[1]), mid = (__a[2] == null ? nil : __a[2]);
              trys = (__b = chain, __b.$map._p = (__a = function(c) {


                if (c == null) c = nil;

                return "" + (c) + "._sup"
              }, __a._s = this, __a), __b.$map()).$join(" || ");
              return "(" + (trys) + " || this._klass._super.prototype[" + (mid) + "]).apply(this, " + (args) + ")";
              } else {
              return this.$raise("Cannot call super() from outside a method block")
            }
          }
        };
      };

      Parser_prototype.$process_op_asgn_or = function(exp, level) {

        return this.$process(this.$s("or", exp.$shift(), exp.$shift()), "expr");
      };

      Parser_prototype.$process_op_asgn1 = function(sexp, level) {

        return "'FIXME(op_asgn1)'";
      };

      Parser_prototype.$process_op_asgn2 = function(exp, level) {
        var lhs = nil, mid = nil, op = nil, rhs = nil, __a, __b;
        lhs = this.$process(exp.$shift(), "expr");
        mid = exp.$shift().$to_s()['$[]'](__range(0, -2, false));
        op = exp.$shift();
        rhs = exp.$shift();
        if (op.$to_s()['$==']("||")) {
          return this.$raise("op_asgn2 for ||")
          } else {
          return (__b = this, __b.$with_temp._p = (__a = function(temp) {

            var getr = nil, oper = nil, asgn = nil;
            if (temp == null) temp = nil;

            getr = this.$s("call", this.$s("js_tmp", temp), mid, this.$s("arglist"));
            oper = this.$s("call", getr, op, this.$s("arglist", rhs));
            asgn = this.$s("call", this.$s("js_tmp", temp), "" + (mid) + "=", this.$s("arglist", oper));
            return "(" + (temp) + " = " + (lhs) + ", " + (this.$process(asgn, "expr")) + ")";
          }, __a._s = this, __a), __b.$with_temp())
        };
      };

      Parser_prototype.$process_ensure = function(exp, level) {
        var begn = nil, retn = nil, body = nil, ensr = nil, res = nil, __a, __b;
        begn = exp.$shift();
        if ((__a = ((__b = level['$==']("recv")), __b !== false && __b !== nil ? __b : level['$==']("expr"))) !== false && __a !== nil) {
          retn = true;
          begn = this.$returns(begn);
        };
        body = this.$process(begn, level);
        ensr = ((__a = exp.$shift()), __a !== false && __a !== nil ? __a : this.$s("nil"));
        ensr = this.$process(ensr, level);
        if ((__a = body['$=~'](/^try \{/)) === false || __a === nil) {
          body = "try {\n" + (body) + "}"
        };
        res = "" + (body) + (this.space) + "finally {" + (this.space) + (ensr) + "}";
        if (retn !== false && retn !== nil) {
          res = "(function() { " + (res) + "; }).call(" + (this.$current_self()) + ")"
        };
        return res;
      };

      Parser_prototype.$process_rescue = function(exp, level) {
        var body = nil, parts = nil, part = nil, code = nil, __a, __b, __c;
        body = (function() { if (exp.$first().$first()['$==']("resbody")) {
          return this.$s("nil")
          } else {
          return exp.$shift()
        }; return nil; }).call(this);
        body = this.$process(body, level);
        parts = [];
        while (!((__b = exp['$empty?']()) !== false && __b !== nil)) {part = this.$process(exp.$shift(), level);
        if ((__b = parts['$empty?']()) === false || __b === nil) {
          part = (__b = "else ", __c = part, typeof(__b) === 'number' ? __b + __c : __b['$+'](__c))
        };
        parts['$<<'](part);};
        parts['$<<']("else { throw $err; }");
        code = "try {" + (this.space) + (body) + (this.space) + "} catch ($err) {" + (this.space) + (parts.$join(this.space)) + (this.space) + "}";
        if (level['$==']("expr")) {
          code = "(function() { " + (code) + " }).call(" + (this.$current_self()) + ")"
        };
        return code;
      };

      Parser_prototype.$process_resbody = function(exp, level) {
        var args = nil, body = nil, types = nil, err = nil, val = nil, __a, __b, __c;
        args = exp['$[]'](0);
        body = exp['$[]'](1);
        body = this.$process(((__a = body), __a !== false && __a !== nil ? __a : this.$s("nil")), level);
        types = args['$[]'](__range(1, -2, false));
        err = (__b = types, __b.$map._p = (__a = function(t) {

          var call = nil, a = nil;
          if (t == null) t = nil;

          call = this.$s("call", t, "===", this.$s("arglist", this.$s("js_tmp", "$err")));
          a = this.$process(call, "expr");
          return a;
        }, __a._s = this, __a), __b.$map()).$join(", ");
        if ((__a = err['$empty?']()) !== false && __a !== nil) {
          err = "true"
        };
        if ((__a = (__c = __scope.Array['$==='](args.$last()), __c !== false && __c !== nil ? ["lasgn", "iasgn"]['$include?'](args.$last().$first()) : __c)) !== false && __a !== nil) {
          val = args.$last();
          val['$[]='](2, this.$s("js_tmp", "$err"));
          val = (__a = this.$process(val, "expr"), __c = ";", typeof(__a) === 'number' ? __a + __c : __a['$+'](__c));
        };
        return "if (" + (err) + ") {" + (this.space) + (val) + (body) + "}";
      };

      Parser_prototype.$process_begin = function(exp, level) {

        return this.$process(exp['$[]'](0), level);
      };

      Parser_prototype.$process_next = function(exp, level) {
        var val = nil, __a;
        val = (function() { if ((__a = exp['$empty?']()) !== false && __a !== nil) {
          return "nil"
          } else {
          return this.$process(exp.$shift(), "expr")
        }; return nil; }).call(this);
        if ((__a = this['$in_while?']()) !== false && __a !== nil) {
          return "continue;"
          } else {
          return "return " + (val) + ";"
        };
      };

      Parser_prototype.$process_redo = function(exp, level) {
        var __a;
        if ((__a = this['$in_while?']()) !== false && __a !== nil) {
          this.while_loop['$[]=']("use_redo", true);
          return "" + (this.while_loop['$[]']("redo_var")) + " = true";
          } else {
          return "REDO()"
        };
      };

      return nil;
    })(Ruby, null)

  })(self);
})();
// lib/Ruby/builder.rb
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __module = __Ruby.module, __klass = __Ruby.klass, __hash2 = __Ruby.hash2;

  //= require Ruby/parser;
  return (function(__base){
    // line 3, Ruby/builder, module Ruby
    function Ruby() {};
    Ruby = __module(__base, "Ruby", Ruby);
    var Ruby_prototype = Ruby.prototype, __scope = Ruby._scope;

    (function(__base, __super){
      // line 6, Ruby/builder, class Builder
      function Builder() {};
      Builder = __klass(__base, __super, "Builder", Builder);

      var Builder_prototype = Builder.prototype, __scope = Builder._scope;
      Builder_prototype.options = Builder_prototype.sources = Builder_prototype.requires = Builder_prototype.parser = Builder_prototype.files = Builder_prototype.dir = nil;

      Builder_prototype.$initialize = function(options) {
        if (options == null) {
          options = __hash2([], {})
        }
        this.sources = this.$Array(options['$[]']("files"));
        return this.options = options;
      };

      Builder_prototype.$build = function() {
        var files = nil, __a, __b, __c;
        this.dir = __scope.File.$expand_path(((__a = this.options['$[]']("dir")), __a !== false && __a !== nil ? __a : __scope.Dir.$getwd()));
        files = this.$files_for(this.sources);
        this.files = __hash2([], {});
        this.requires = __hash2([], {});
        this.parser = __scope.Parser.$new();
        (__b = files, __b.$each._p = (__a = function(f) {


          if (f == null) f = nil;

          return this.$build_file(f)
        }, __a._s = this, __a), __b.$each());
        return (__c = this.$build_order(this.requires), __c.$map._p = (__a = function(r) {


          if (this.files == null) this.files = nil;

          if (r == null) r = nil;

          return this.files['$[]'](r)
        }, __a._s = this, __a), __c.$map()).$join("\n");
      };

      Builder_prototype.$files_for = function(sources) {
        var files = nil, __a, __b;
        files = [];
        (__b = sources, __b.$each._p = (__a = function(s) {

          var __a;
          if (this.dir == null) this.dir = nil;

          if (s == null) s = nil;

          s = __scope.File.$expand_path(__scope.File.$join(this.dir, s));
          if ((__a = __scope.File['$directory?'](s)) !== false && __a !== nil) {
            return files.$push.apply(files, [].concat(__scope.Dir['$[]'](__scope.File.$join(s, "**/*.rb"))))
            } else {
            if (__scope.File.$extname(s)['$=='](".rb")) {
              return files['$<<'](s)
              } else {
              return nil
            }
          };
        }, __a._s = this, __a), __b.$each());
        return files;
      };

      Builder_prototype.$build_order = function(files) {
        var all = nil, result = nil, handled = nil, __a, __b;
        all = files.$keys();
        result = [];
        handled = __hash2([], {});
        (__b = all, __b.$each._p = (__a = function(r) {


          if (r == null) r = nil;

          return this.$_find_build_order(r, files, handled, result)
        }, __a._s = this, __a), __b.$each());
        return result;
      };

      Builder_prototype.$_find_build_order = function(file, files, handled, result) {
        var __a, __b;
        if ((__a = ((__b = handled['$[]'](file)), __b !== false && __b !== nil ? __b : !files['$[]'](file))) !== false && __a !== nil) {
          return nil
        };
        handled['$[]='](file, true);
        (__b = files['$[]'](file), __b.$each._p = (__a = function(r) {


          if (r == null) r = nil;

          return this.$_find_build_order(r, files, handled, result)
        }, __a._s = this, __a), __b.$each());
        return result['$<<'](file);
      };

      Builder_prototype.$build_file = function(file) {
        var lib_name = nil, parser_name = nil, code = nil;
        lib_name = this.$lib_name_for(file);
        parser_name = this.$parser_name_for(file);
        if (__scope.File.$extname(file)['$=='](".rb")) {
          code = this.parser.$parse(__scope.File.$read(file), lib_name);
          this.requires['$[]='](lib_name, this.parser.$requires());
        };
        return this.files['$[]='](lib_name, "// " + (parser_name) + "\n" + (code));
      };

      Builder_prototype.$parser_name_for = function(file) {

        return file.$sub((new RegExp("^" + this.dir + "\\/")), "");
      };

      Builder_prototype.$lib_name_for = function(file) {

        file = file.$sub((new RegExp("^" + this.dir + "\\/")), "");
        file = file.$chomp(__scope.File.$extname(file));
        return file.$sub(/^(lib|spec|app)\//, "");
      };

      return nil;
    })(Ruby, null)

  })(self);
})();
// lib/Ruby/version.rb
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __module = __Ruby.module;

  return (function(__base){
    // line 1, Ruby/version, module Ruby
    function Ruby() {};
    Ruby = __module(__base, "Ruby", Ruby);
    var Ruby_prototype = Ruby.prototype, __scope = Ruby._scope;

    __scope.VERSION = "0.3.27"

  })(self)
})();
// lib/Ruby.rb
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __module = __Ruby.module, __hash2 = __Ruby.hash2;

  //= require Ruby/parser;
  //= require Ruby/builder;
  //= require Ruby/version;
  return (function(__base){
    // line 7, Ruby, module Ruby
    function Ruby() {};
    Ruby = __module(__base, "Ruby", Ruby);
    var Ruby_prototype = Ruby.prototype, __scope = Ruby._scope;

    Ruby.$parse = function(str, file) {
      if (file == null) {
        file = "(file)"
      }
      return __scope.Parser.$new().$parse(str, file)
    };

    Ruby.$runtime = function() {
      var core_dir = nil, load_order = nil, corelib = nil, runtime = nil, __a, __b;
      core_dir = __scope.Ruby.$core_dir();
      load_order = __scope.File.$join(core_dir, "load_order");
      corelib = (__b = __scope.File.$read(load_order).$strip().$split(), __b.$map._p = (__a = function(c) {

        var file = nil, source = nil;
        if (c == null) c = nil;

        file = __scope.File.$join(core_dir, "" + (c) + ".rb");
        source = __scope.File.$read(file);
        return __scope.Ruby.$parse(source, file);
      }, __a._s = this, __a), __b.$map());
      runtime = __scope.File.$read(__scope.File.$join(core_dir, "runtime.js"));
      corelib = corelib.$join("\n");
      return ["// Ruby v" + ((__scope.Ruby)._scope.VERSION), "// http://Ruby.github.com", "// Copyright 2012, Adam Beynon", "// Released under the MIT License", "(function(undefined) {", runtime, "Ruby.version = " + ((__scope.Ruby)._scope.VERSION.$inspect()) + ";", corelib, "}).call(this);"].$join("\n");
    };

    Ruby.$parser_code = function() {

      return [__scope.Builder.$new(__hash2(["files", "dir"], {"files": ["racc.rb", "strscan.rb"], "dir": __scope.File.$join(this.$core_dir(), "parser")})).$build(), this.$build_gem("Ruby"), __scope.File.$read(__scope.File.$join(this.$core_dir(), "parser", "browser.js"))].$join("\n")
    };

    Ruby.$build_gem = function(name) {
      var spec = nil;
      spec = (__scope.Gem)._scope.Specification.$find_by_name(name);
      return __scope.Builder.$new(__hash2(["files", "dir"], {"files": spec.$require_paths(), "dir": spec.$full_gem_path()})).$build();
    };

    Ruby.$build_files = function(files, dir) {
      if (dir == null) {
        dir = nil
      }
      return __scope.Builder.$new(__hash2(["files", "dir"], {"files": files, "dir": dir})).$build()
    };

    Ruby.$Ruby_dir = function() {

      return __scope.File.$expand_path("../..", "Ruby")
    };

    Ruby.$core_dir = function() {

      return __scope.File.$join(this.$Ruby_dir(), "core")
    };
        ;Ruby._sdonate(["$parse", "$runtime", "$parser_code", "$build_gem", "$build_files", "$Ruby_dir", "$core_dir"]);
  })(self);
})();
// lib/Ruby/rake_task.rb
(function() {
  var __Ruby = Ruby, self = __Ruby.top, __scope = __Ruby, nil = __Ruby.nil, __breaker = __Ruby.breaker, __slice = __Ruby.slice, __module = __Ruby.module, __klass = __Ruby.klass, __hash2 = __Ruby.hash2;

  //= require Ruby;
  //= require Ruby/builder;
  //= require fileutils;
  return (function(__base){
    // line 5, Ruby/rake_task, module Ruby
    function Ruby() {};
    Ruby = __module(__base, "Ruby", Ruby);
    var Ruby_prototype = Ruby.prototype, __scope = Ruby._scope;

    (function(__base, __super){
      // line 6, Ruby/rake_task, class RakeTask
      function RakeTask() {};
      RakeTask = __klass(__base, __super, "RakeTask", RakeTask);

      var RakeTask_prototype = RakeTask.prototype, __scope = RakeTask._scope, __a, TMP_1;
      RakeTask_prototype.name = RakeTask_prototype.build_dir = RakeTask_prototype.specs_dir = RakeTask_prototype.files = RakeTask_prototype.dependencies = RakeTask_prototype.parser = RakeTask_prototype.dir = RakeTask_prototype.project_dir = nil;

      if ((__a = false) !== false && __a !== nil) {
        RakeTask.$include((__scope.Rake)._scope.DSL)
      };

      RakeTask_prototype.$name = function() {

        return this.name
      },
      RakeTask_prototype['$name='] = function(val) {

        return this.name = val
      },
      RakeTask_prototype.$build_dir = function() {

        return this.build_dir
      },
      RakeTask_prototype['$build_dir='] = function(val) {

        return this.build_dir = val
      },
      RakeTask_prototype.$specs_dir = function() {

        return this.specs_dir
      },
      RakeTask_prototype['$specs_dir='] = function(val) {

        return this.specs_dir = val
      },
      RakeTask_prototype.$files = function() {

        return this.files
      },
      RakeTask_prototype['$files='] = function(val) {

        return this.files = val
      },
      RakeTask_prototype.$dependencies = function() {

        return this.dependencies
      },
      RakeTask_prototype['$dependencies='] = function(val) {

        return this.dependencies = val
      },
      RakeTask_prototype.$parser = function() {

        return this.parser
      },
      RakeTask_prototype['$parser='] = function(val) {

        return this.parser = val
      },
      RakeTask_prototype.$dir = function() {

        return this.dir
      },
      RakeTask_prototype['$dir='] = function(val) {

        return this.dir = val
      }, nil;

      RakeTask_prototype.$initialize = TMP_1 = function(namespace) {
        var __context, __yield;
        __yield = TMP_1._p || nil, __context = __yield._s, TMP_1._p = null;
        if (namespace == null) {
          namespace = nil
        }
        this.project_dir = __scope.Dir.$getwd();
        this.name = __scope.File.$basename(this.project_dir);
        this.dir = this.project_dir;
        this.build_dir = "build";
        this.specs_dir = "spec";
        this.files = __scope.Dir['$[]']("lib/**/*.rb");
        this.dependencies = [];
        if ((__yield !== nil)) {
          if (__yield.call(__context, this) === __breaker) return __breaker.$v
        };
        return this.$define_tasks();
      };

      RakeTask_prototype.$build_gem = function(name) {
        var out = nil, e = nil;
        try {
        out = __scope.File.$join(this.build_dir, "" + (name) + ".js");
        this.$puts(" * " + (out));
        return this.$write_code(__scope.Ruby.$build_gem(name), out);
        } catch ($err) {
        if ((__scope.Gem)._scope.LoadError['$===']($err)) {
        e = $err;this.$puts("  - Error: Could not find gem " + (name))}
        else { throw $err; }
        };
      };

      RakeTask_prototype.$write_code = function(code, out) {
        var __a, __b;
        __scope.FileUtils.$mkdir_p(__scope.File.$dirname(out));
        return (__b = __scope.File, __b.$open._p = (__a = function(o) {


          if (o == null) o = nil;

          return o.$puts(code)
        }, __a._s = this, __a), __b.$open(out, "w+"));
      };

      RakeTask_prototype.$define_tasks = function() {
        var __a, __b, __c, __d, __e;
        this.$desc("Build Ruby project");
        (__b = this, __b.$task._p = (__a = function() {

          var out = nil;
          if (this.build_dir == null) this.build_dir = nil;
          if (this.name == null) this.name = nil;
          if (this.files == null) this.files = nil;
          if (this.dir == null) this.dir = nil;


          out = __scope.File.$join(this.build_dir, "" + (this.name) + ".js");
          this.$puts(" * " + (out));
          return this.$write_code(__scope.Ruby.$build_files(this.files, this.dir), out);
        }, __a._s = this, __a), __b.$task("Ruby:build"));
        this.$desc("Build specs");
        (__c = this, __c.$task._p = (__a = function() {

          var out = nil;
          if (this.build_dir == null) this.build_dir = nil;
          if (this.specs_dir == null) this.specs_dir = nil;


          out = __scope.File.$join(this.build_dir, "specs.js");
          this.$puts(" * " + (out));
          return this.$write_code(__scope.Ruby.$build_files(this.specs_dir), out);
        }, __a._s = this, __a), __c.$task("Ruby:spec"));
        this.$desc("Build dependencies");
        (__d = this, __d.$task._p = (__a = function() {

          var out = nil, __a, __b;
          if (this.build_dir == null) this.build_dir = nil;
          if (this.parser == null) this.parser = nil;
          if (this.dependencies == null) this.dependencies = nil;


          out = __scope.File.$join(this.build_dir, "Ruby.js");
          this.$puts(" * " + (out));
          this.$write_code(__scope.Ruby.$runtime(), out);
          if ((__a = this.parser) !== false && __a !== nil) {
            out = __scope.File.$join(this.build_dir, "Ruby-parser.js");
            this.$puts(" * " + (out));
            this.$write_code(__scope.Ruby.$parser_code(), out);
          };
          return (__b = this.dependencies, __b.$each._p = (__a = function(dep) {


            if (dep == null) dep = nil;

            return this.$build_gem(dep)
          }, __a._s = this, __a), __b.$each());
        }, __a._s = this, __a), __d.$task("Ruby:dependencies"));
        this.$desc("Run specs in spec/index.html");
        (__e = this, __e.$task._p = (__a = function() {

          var runner = nil;

          runner = __scope.File.$join(__scope.Ruby.$core_dir(), "test_runner", "runner.js");
          return this.$sh("phantomjs " + (runner) + " spec/index.html");
        }, __a._s = this, __a), __e.$task("Ruby:test"));
        this.$desc("Build Ruby files, dependencies and specs");
        return this.$task(__hash2(["Ruby"], {"Ruby": ["Ruby:build", "Ruby:dependencies", "Ruby:spec"]}));
      };

      return nil;
    })(Ruby, null)

  })(self);
})();
(function() {
  // quick exit if not insde browser
  if (typeof(window) === 'undefined' || typeof(document) === 'undefined') {
    return;
  }


  var matched, browser;

  // Use of jQuery.browser is frowned upon.
  // More details: http://api.jquery.com/jQuery.browser
  // jQuery.uaMatch maintained for back-compat
  function uaMatch( ua ) {
      ua = ua.toLowerCase();

      var match = /(chrome)[ \/]([\w.]+)/.exec( ua ) ||
          /(webkit)[ \/]([\w.]+)/.exec( ua ) ||
          /(opera)(?:.*version|)[ \/]([\w.]+)/.exec( ua ) ||
          /(msie) ([\w.]+)/.exec( ua ) ||
          ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec( ua ) ||
          [];

      return {
          browser: match[ 1 ] || "",
          version: match[ 2 ] || "0"
      };
  };

  matched = uaMatch( navigator.userAgent );
  browser = {};

  if ( matched.browser ) {
      browser[ matched.browser ] = true;
      browser.version = matched.version;
  }

  // Chrome is Webkit, but Webkit is also Safari.
  if ( browser.chrome ) {
      browser.webkit = true;
  } else if ( browser.webkit ) {
      browser.safari = true;
  }


  function findRubyScripts()
  {
    
    var e = document.getElementsByTagName("script")

    for (var t = 0, n; t < e.length; t++)
    {
      if(e[t].type === "text/ruby") {
        replaceRuby(e[t])
      }
    }

  }
  function replaceRuby(element)
  {
    var source = element.innerHTML;
    var js = Ruby.Ruby.Parser.$new().$parse(source);

    if(browser.mozilla) {
      eval(js);
    }

    element.type = "text/javascript";
    element.innerHTML = js;
  }
  function runRuby(source)
  {
    var js = Ruby.Ruby.Parser.$new().$parse(source);
    eval(js)
  }

  function request(url, callback) {
    var xhr = new (window.ActiveXObject || XMLHttpRequest)('Microsoft.XMLHTTP');
    xhr.open('GET', url, true);
    if ('overrideMimeType' in xhr) {
      xhr.overrideMimeType('text/plain');
    }
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 0 || xhr.status === 200) {
          callback(xhr.responseText);
        }
        else {
          throw new Error('Could not load ruby at: ' + url);
        }
      }
    };
    xhr.send(null);
  }

  if (window.addEventListener) {
    window.addEventListener('DOMContentLoaded', findRubyScripts, false);
  }
  else {
    window.attachEvent('onload', findRubyScripts);
  }
})();