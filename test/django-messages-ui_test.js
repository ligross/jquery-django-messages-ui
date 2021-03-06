(function ($) {

  'use strict';

  module('init', {
    setup: function () {
      this.container = $('#qunit-fixture #messages');
      this.msg = $('<div class="message"></div>');
      this.close = $('<button class="close">close</button>').appendTo(this.msg);
      this.opts = $.extend({}, $.fn.messages.defaults);
      this.methods = this.container.messages('exposeMethods');
      sinon.stub(this.methods, 'remove');
      sinon.stub(this.methods, 'add');
      sinon.stub(this.methods, 'bindHandlers');
      this.xhr = sinon.useFakeXMLHttpRequest();
      var requests = this.requests = [];
      this.xhr.onCreate = function (xhr) {
        requests.push(xhr);
      };
    },
    teardown: function () {
      this.container.removeData('messages-ui-opts');
      this.methods.remove.restore();
      this.methods.add.restore();
      this.methods.bindHandlers.restore();
      this.xhr.restore();
    }
  });

  test('init is chainable', function () {
    ok(this.container.messages('init').is(this.container), 'is chainable');
  });

  test('saves opts as data-messages-ui-opts on list element', function () {
    var expected = $.extend({}, $.fn.messages.defaults, {message: '.test-message'});
    this.container.messages('init', {message: '.test-message'});

    deepEqual(this.container.data('messages-ui-opts'), expected, 'opts have been extended and saved');
  });

  test('uses old opts if called twice on same list element', function () {
    var expected = $.extend({}, $.fn.messages.defaults, {message: '.test-message', closeLink: null});
    this.container.messages('init', {message: '.test-message'});
    this.container.messages('init', {closeLink: null});

    deepEqual(this.container.data('messages-ui-opts'), expected, 'opts have been combined and saved');
  });

  test('calls methods.bindHandlers with message, opts, and list element', function () {
    this.container.append(this.msg);
    this.container.messages('init');

    ok(this.methods.bindHandlers.calledOnce, 'bindHandlers was called once');
    ok(this.methods.bindHandlers.args[0][0].is(this.msg), 'bindHandlers was passed existing msg');
    deepEqual(this.methods.bindHandlers.args[0][1], this.opts, 'bindHandlers was passed opts');
    ok(this.methods.bindHandlers.args[0][2].is(this.container), 'bindHandlers was passed list element');
  });

  test('on closeLink click, calls preventDefault() and blur()', function () {
    var ev = { type: 'click', preventDefault: sinon.spy() };
    sinon.spy($.fn, 'blur');
    this.container.append(this.msg);
    this.container.messages('init');
    this.close.trigger(ev);

    ok(ev.preventDefault.calledOnce, 'preventDefault was called once');
    ok(this.close.blur.calledOnce, 'blur was called once on closeLink');

    $.fn.blur.restore();
  });

  test('on closeLink click, calls methods.remove with msg, opts, and list element', function () {
    this.container.append(this.msg);
    this.container.messages('init', {test: 'opts'});
    this.close.trigger('click');

    ok(this.methods.remove.calledOnce, 'remove was called once');
    ok(this.methods.remove.args[0][0].is(this.msg), 'remove was passed msg');
    deepEqual(this.methods.remove.args[0][1], {test: 'opts'}, 'remove was passed opts');
    ok(this.methods.remove.args[0][2].is(this.container), 'remove was passed list element');
  });

  test('if handleAjax, filters ajax response to call methods.add with any messages', function () {
    this.container.messages('init', {handleAjax: true});
    $.get('/test/url/');
    this.requests[0].respond(200, {'content-type': 'application/json'}, '{"messages": [{"test1": "msg1"}, {"test2": "msg2"}]}');

    ok(this.methods.add.calledTwice, 'add was called twice');
    deepEqual(this.methods.add.args[0][0], {test1: 'msg1'}, 'add was passed first msg');
    deepEqual(this.methods.add.args[0][1], {handleAjax: true}, 'add was passed opts');
    ok(this.methods.add.args[0][2].is(this.container), 'add was passed list element');
    deepEqual(this.methods.add.args[1][0], {test2: 'msg2'}, 'add was passed first msg');
    deepEqual(this.methods.add.args[1][1], {handleAjax: true}, 'add was passed opts');
    ok(this.methods.add.args[1][2].is(this.container), 'add was passed list element');
  });

  test('if handleAjax, all ajax responses are interpreted as json', function () {
    this.container.messages('init', {handleAjax: true});
    $.get('/test/url/');
    this.requests[0].respond(200, {'content-type': 'text/html'}, '{"messages": [{"test": "msg"}]}');

    ok(this.methods.add.calledOnce, 'add was called once');
    deepEqual(this.methods.add.args[0][0], {test: 'msg'}, 'add was passed msg');
  });

  test('if handleAjax, empty ajax response does not throw errors', function () {
    this.container.messages('init', {handleAjax: true});
    $.get('/test/url/');
    this.requests[0].respond(200);

    ok(!this.methods.add.called, 'add was not called');
  });

  test('if handleAjax, incorrect json ajax response does not throw errors', function () {
    this.container.messages('init', {handleAjax: true});
    $.get('/test/url/');
    this.requests[0].respond(200, {'content-type': 'application/json'}, '{messages: [{test: msg}]}');

    ok(!this.methods.add.called, 'add was not called');
  });

  test('if handleAjax, ajax response without list of messages does not call methods.add', function () {
    this.container.messages('init', {handleAjax: true});
    $.get('/test/url/');
    this.requests[0].respond(200, {'content-type': 'application/json'}, '{"success": "true"}');

    ok(!this.methods.add.called, 'add was not called');
  });


  module('add', {
    setup: function () {
      this.container = $('#qunit-fixture #messages');
      this.data = {message: 'test msg'};
      this.html = '<li class="message {{tags}}">\n' +
        '  <p class="body">{{#escapeHTML}}{{message}}{{/escapeHTML}}{{^escapeHTML}}{{{message}}}{{/escapeHTML}}</p>\n' +
        '  <a href="#" class="close">dismiss this message</a>\n' +
        '</li>';
      ich.addTemplate('message', this.html);
      this.hbsTpl = Handlebars.templates.message;
      this.hbsMsgHtml = $(Handlebars.templates.message(this.data)).get(0).outerHTML;
      this.ichMsgHtml = $(ich.message(this.data)).get(0).outerHTML;
      this.opts = $.extend({}, $.fn.messages.defaults);
      this.methods = this.container.messages('exposeMethods');
      sinon.stub(this.methods, 'bindHandlers');
    },
    teardown: function () {
      this.container.removeData('messages-ui-opts');
      ich.clearAll();
      this.methods.bindHandlers.restore();
    }
  });

  test('appends new msg to msgList using handlebars', function (assert) {
    this.container.messages('add', this.data);

    assert.htmlEqual(this.container.children('.message:last-child').get(0).outerHTML, this.hbsMsgHtml, 'new msg was appended to msgList');
  });

  test('appends new msg to msgList using ich', function (assert) {
    this.container.messages('add', this.data, {template: ich.message});

    assert.htmlEqual(this.container.children('.message:last-child').get(0).outerHTML, this.ichMsgHtml, 'new msg was appended to msgList');
  });

  test('handlebars and ich render exact same tpl', function (assert) {
    assert.htmlEqual(this.hbsMsgHtml, this.ichMsgHtml, 'hbsMsg and ichMsg are identical');
  });

  test('appends to msgList arg, if provided', function (assert) {
    var list = $('<div class="new-list"></div>').appendTo(this.container);
    this.container.messages('add', this.data, undefined, list);

    assert.htmlEqual(list.children('.message:last-child').get(0).outerHTML, this.hbsMsgHtml, 'new msg was appended to passed msgList');
  });

  test('returns new msg', function () {
    var msg = this.container.messages('add', this.data);

    ok(this.container.children('.message:last-child').is(msg), 'new msg was returned');
  });

  test('msg is added even if no data is passed', function () {
    this.container.messages('add');

    ok(this.container.find('.message').length, 'msg has been added');
  });

  test('calls methods.bindHandlers with msg, opts, and list element', function () {
    var msg = this.container.messages('add', this.data);

    ok(this.methods.bindHandlers.calledOnce, 'bindHandlers was called once');
    ok(this.methods.bindHandlers.args[0][0].is(msg), 'bindHandlers was passed existing msg');
    deepEqual(this.methods.bindHandlers.args[0][1], this.opts, 'bindHandlers was passed opts');
    ok(this.methods.bindHandlers.args[0][2].is(this.container), 'bindHandlers was passed list element');
  });

  test('does not call methods.bindHandlers if template does not exist', function () {
    var tpl = Handlebars.templates.message;
    Handlebars.templates.message = false;

    throws(function () { this.container.messages('add', null, {template: null}); }, new Error('Template not found'), 'throws error if template not found');
    ok(!this.methods.bindHandlers.called, 'bindHandlers was not called');

    Handlebars.templates.message = tpl;
  });

  test('uses old opts if stored on container', function () {
    var expected = $.extend({}, $.fn.messages.defaults, {test: 'opts'});
    this.container.data('messages-ui-opts', {test: 'opts'});
    this.container.messages('add');

    deepEqual(this.methods.bindHandlers.args[0][1], expected, 'bindHandlers was passed stored opts');
  });


  module('remove', {
    setup: function () {
      this.container = $('#qunit-fixture #messages');
      this.msg = $('<div class="message"></div>').appendTo(this.container);
      this.opts = $.extend({}, $.fn.messages.defaults);
      $.doTimeout = sinon.spy();
      $.fx.off = true;
    },
    teardown: function () {
      delete $.doTimeout;
      $.fx.off = false;
    }
  });

  test('calls options.closeCallback fn', function () {
    var callback = sinon.spy();
    this.container.messages('remove', this.msg, {closeCallback: callback});

    ok(callback.calledOnce, 'callback was called once');
    ok(callback.calledWith(this.msg), 'callback was passed msg');
  });

  test('uses old opts if stored on container', function () {
    var callback = sinon.spy();
    this.container.data('messages-ui-opts', {closeCallback: callback});
    this.container.messages('remove', this.msg);

    ok(callback.calledOnce, 'callback was called once');
  });

  test('uses passed message list arg, if applicable', function () {
    var callback = sinon.spy();
    var newCont = $('<div></div>');
    newCont.data('messages-ui-opts', {closeCallback: callback});
    this.container.messages('remove', this.msg, undefined, newCont);

    ok(callback.calledOnce, 'callback was called once');
  });

  test('if msg has data-count, calls doTimeout to cancel timeout', function () {
    this.msg.data('count', 'test-count');
    this.container.messages('remove', this.msg, {closeCallback: false});

    ok($.doTimeout.calledOnce, 'doTimeout was called once');
    ok($.doTimeout.calledWith('msg-test-count'), 'doTimeout was called with "msg-test-count"');
  });

  test('default callback stops animation and initiates a fast fadeout before removing msg', function () {
    sinon.spy($.fn, 'stop');
    sinon.spy($.fn, 'fadeOut');
    this.container.messages('remove', this.msg);

    ok(this.msg.stop.calledOnce, 'stop() was called once on msg');
    ok(this.msg.fadeOut.calledOnce, 'fadeOut() was called once on msg');
    ok(this.msg.fadeOut.calledWith('fast'), 'fadeOut() was called with "fast" arg');
    ok(!this.container.find(this.msg).length, 'msg has been removed');

    $.fn.stop.restore();
    $.fn.fadeOut.restore();
  });


  module('bindHandlers', {
    setup: function () {
      this.container = $('#qunit-fixture #messages');
      this.msg = $('<div class="message success msg1"></div>');
      this.msg2 = $('<div class="message msg2"></div>');
      this.msgs = this.msg.add(this.msg2);
      $.doTimeout = sinon.stub().callsArg(2);
      $.fx.off = true;
      sinon.spy($.fn, 'one');
      sinon.spy($.fn, 'off');
    },
    teardown: function () {
      delete $.doTimeout;
      $.fx.off = false;
      $.fn.one.restore();
      $.fn.off.restore();
    }
  });

  test('does nothing if there are no transient msgs', function () {
    this.container.messages('bindHandlers', this.msgs, {transientMessage: '.transient'});

    ok(!this.msg.data('count'), 'msg does not have data-count');
    ok(!this.msg2.data('count'), 'msg2 does not have data-count');
  });

  test('sets data-count on transient msg', function () {
    this.container.messages('bindHandlers', this.msgs);
    var count = this.msg.data('count');

    ok(this.msg.data('count'), 'msg has data-count');

    $(document).off('.msg-' + count);
    this.msg.off('.msg-' + count);
  });

  test('uses old opts if stored on container', function () {
    this.container.data('messages-ui-opts', {transientMessage: '.msg2'});
    this.container.messages('bindHandlers', this.msgs);
    var count = this.msg2.data('count');

    ok(!this.msg.data('count'), 'msg does not have data-count');

    $(document).off('.msg-' + count);
    this.msg2.off('.msg-' + count);
  });

  test('uses passed message list arg, if applicable', function () {
    var newCont = $('<div></div>');
    newCont.data('messages-ui-opts', {transientMessage: '.msg2'});
    this.container.messages('bindHandlers', this.msgs, undefined, newCont);
    var count = this.msg2.data('count');

    ok(this.msg2.data('count'), 'msg2 has data-count');

    $(document).off('.msg-' + count);
    this.msg2.off('.msg-' + count);
  });

  QUnit.cases([
    { title: 'mousedown', evt: 'mousedown', target: $(document) },
    { title: 'keydown', evt: 'keydown', target: $(document) },
    { title: 'scroll', evt: 'scroll', target: $(document) },
    { title: 'mouseover', evt: 'mouseover' }
  ]).test('event trigger unbinds event handler', function (params) {
    var msg = this.msg;
    var target = params.target || msg;
    this.container.messages('bindHandlers', this.msgs, {transientCallback: false});
    var count = msg.data('count');
    target.trigger(params.evt);
    var calledOnDoc = false;
    var calledOnMsg = false;
    $.each($.fn.off.thisValues, function (i, v) {
      if (v.is($(document))) { calledOnDoc = true; }
      if (v.is(msg)) { calledOnMsg = true; }
    });

    ok($.fn.off.called, 'off() was called');
    ok($.fn.off.calledWith('.msg-' + count), 'off() was called with event namespace');
    ok(calledOnDoc, 'off() was called on document');
    ok(calledOnMsg, 'off() was called on msg');
  });

  test('event trigger calls options.transientCallback after options.transientDelay', function () {
    var callback = sinon.spy();
    this.container.messages('bindHandlers', this.msgs, {transientCallback: callback, transientDelay: 'test-delay'});
    var count = this.msg.data('count');
    $(document).trigger('mousedown');

    ok($.doTimeout.calledOnce, 'doTimeout was called once');
    ok($.doTimeout.calledWith('msg-' + count, 'test-delay'), 'doTimeout was passed namespace and transientDelay');
    ok(callback.calledOnce, 'callback was called once');
    ok(callback.args[0][0].is(this.msg), 'callback was passed msg');
  });

  test('default callback initiates a 2s fadeout before removing msg', function () {
    sinon.spy($.fn, 'fadeOut');
    this.msgs.appendTo(this.container);
    this.container.messages('bindHandlers', this.msgs);
    $(document).trigger('mousedown');

    ok(this.msg.fadeOut.calledOnce, 'fadeOut() was called once on msg');
    ok(this.msg.fadeOut.calledWith(2000), 'fadeOut() was called with 2000ms arg');
    ok(!this.container.find(this.msg).length, 'msg has been removed');

    $.fn.fadeOut.restore();
  });


  module('messages methods', {
    setup: function () {
      this.container = $('#qunit-fixture #messages');
      this.methods = this.container.messages('exposeMethods');
      this.initStub = sinon.stub(this.methods, 'init');
    },
    teardown: function () {
      this.initStub.restore();
    }
  });

  test('if no args, calls init method', function () {
    this.container.messages();

    ok(this.initStub.calledOnce, 'init was called once');
  });

  test('if first arg is an object, calls init method with args', function () {
    this.container.messages({test: 'data'}, 'more');

    ok(this.initStub.calledOnce, 'init was called once');
    ok(this.initStub.calledWith({test: 'data'}, 'more'), 'init was passed args');
  });

  test('if first arg is a method, calls method with remaining args', function () {
    this.container.messages('init', {test: 'data'}, 'more');

    ok(this.initStub.calledOnce, 'init was called once');
    ok(this.initStub.calledWith({test: 'data'}, 'more'), 'init was passed remaining args');
  });

  test('if first arg not a method or object, returns an error', function () {
    sinon.stub($, 'error');
    this.container.messages('test');

    ok(!this.initStub.called, 'init was not called');
    ok($.error.calledOnce, '$.error was called once');
    ok($.error.calledWith('Method test does not exist on jQuery.messages'), '$.error was passed error msg');

    $.error.restore();
  });

}(jQuery));
