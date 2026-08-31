/* Skill Arena — room networking.

   There is no game server to pay for: peers meet on free public MQTT
   brokers and relay small JSON messages through two topics.
     .../h  host  -> everyone   (world snapshots)
     .../c  client -> host      (inputs, joins, skill picks)

   Every peer connects to as many relays as its network allows, so a room
   works as long as the two sides share any one of them. Messages carry a
   sender id and a sequence number, and anything already seen on another
   relay is dropped on arrival. */
(function (SA) {
  'use strict';

  var BROKERS = [
    { url: 'wss://broker.emqx.io:8084/mqtt', name: 'relay 1', host: 'broker.emqx.io', port: 8084 },
    { url: 'wss://broker.hivemq.com:8884/mqtt', name: 'relay 2', host: 'broker.hivemq.com', port: 8884 },
    { url: 'wss://test.mosquitto.org:8081/mqtt', name: 'relay 3', host: 'test.mosquitto.org', port: 8081 }
  ];
  var TOPIC_ROOT = 'skillarena/v1/';
  var LIB_SOURCES = [
    'js/vendor/mqtt.min.js',
    'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js',
    'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js'
  ];

  var libPromise = null;
  function loadLib() {
    if (window.mqtt) return Promise.resolve(window.mqtt);
    if (libPromise) return libPromise;
    libPromise = new Promise(function (resolve, reject) {
      var i = 0;
      (function next() {
        if (i >= LIB_SOURCES.length) return reject(new Error('Could not load the networking library.'));
        var s = document.createElement('script');
        s.src = LIB_SOURCES[i++];
        s.onload = function () { window.mqtt ? resolve(window.mqtt) : next(); };
        s.onerror = next;
        document.head.appendChild(s);
      })();
    });
    return libPromise;
  }

  function connectBroker(mqtt, broker, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var client = mqtt.connect(broker.url, {
        clientId: 'sa_' + SA.uid(),
        keepalive: 30,
        connectTimeout: timeoutMs || 9000,
        reconnectPeriod: 4000,
        resubscribe: true,
        queueQoSZero: false,
        clean: true
      });
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        try { client.end(true); } catch (e) {}
        reject(new Error('no answer'));
      }, (timeoutMs || 9000) + 1500);
      client.on('connect', function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(client);
      });
      client.on('error', function (err) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { client.end(true); } catch (e) {}
        reject(err);
      });
    });
  }

  /* ------------------------------------------------------------------ Relay */
  function Relay() {
    this.conns = [];
    this.code = null;
    this.isHost = false;
    this.onMsg = null;
    this.onStatus = null;
    this.connected = false;
    this.selfId = SA.uid();
    this.outSeq = 0;
    this.lastSeq = {};
    this.senderConn = {};
    this.sentBytes = 0;
    this.recvBytes = 0;
  }

  Relay.prototype.status = function (state, text) {
    if (this.onStatus) this.onStatus(state, text);
  };

  Relay.prototype.liveNames = function () {
    var out = [];
    for (var i = 0; i < this.conns.length; i++) {
      if (this.conns[i].connected) out.push(this.conns[i].__name);
    }
    return out;
  };

  Relay.prototype.reportStatus = function () {
    var live = this.liveNames();
    if (!live.length) this.status('reconnecting', 'Reconnecting…');
    else this.status('online', 'Connected via ' + live.join(' + '));
  };

  Relay.prototype.start = function (opts) {
    var self = this;
    this.isHost = !!opts.isHost;
    this.onMsg = opts.onMsg;
    this.onStatus = opts.onStatus;
    this.code = opts.code;
    var base = TOPIC_ROOT + this.code + '/';
    this.pubTopic = base + (this.isHost ? 'h' : 'c');
    this.subTopic = base + (this.isHost ? 'c' : 'h');

    return loadLib().then(function (mqtt) {
      self.status('connecting', 'Connecting…');
      return new Promise(function (resolve, reject) {
        var pending = BROKERS.length, done = false, errs = [];
        BROKERS.forEach(function (b) {
          connectBroker(mqtt, b, 9000).then(function (client) {
            self.attach(client, b);
            pending--;
            if (!done) { done = true; self.connected = true; resolve(self.code); }
          }).catch(function (e) {
            errs.push(b.name + ' ' + ((e && e.message) || 'blocked'));
            pending--;
            if (!pending && !done) reject(new Error(errs.join(', ')));
          });
        });
      });
    });
  };

  Relay.prototype.attach = function (client, broker) {
    var self = this;
    client.__name = broker.name;
    this.conns.push(client);
    client.subscribe(this.subTopic, { qos: 0 }, function () {});
    client.on('message', function (topic, payload) { self.handle(payload, client); });
    client.on('connect', function () {
      client.subscribe(self.subTopic, { qos: 0 }, function () {});
      self.reportStatus();
    });
    client.on('close', function () { self.reportStatus(); });
    this.reportStatus();
  };

  Relay.prototype.handle = function (payload, client) {
    this.recvBytes += payload.length;
    var msg;
    try { msg = JSON.parse(payload.toString()); } catch (e) { return; }
    if (msg.__s) {
      if (msg.__s === this.selfId) return;
      var last = this.lastSeq[msg.__s] || 0;
      if (msg.__q <= last) return;          // already arrived on another relay
      this.lastSeq[msg.__s] = msg.__q;
      this.senderConn[msg.__s] = client;    // this relay reaches them
    }
    if (this.onMsg) this.onMsg(msg);
  };

  /* Once we have heard from someone we know which relay reaches them, so we
     stop shouting down the others. Until then, announce on everything. */
  Relay.prototype.targets = function () {
    var list = [];
    for (var k in this.senderConn) {
      var c = this.senderConn[k];
      if (c && c.connected && list.indexOf(c) < 0) list.push(c);
    }
    return list.length ? list : this.conns;
  };

  Relay.prototype.pub = function (obj) {
    if (!this.conns.length) return;
    obj.__s = this.selfId;
    obj.__q = ++this.outSeq;
    var text = JSON.stringify(obj);
    var to = this.targets();
    for (var i = 0; i < to.length; i++) {
      if (!to[i].connected) continue;
      this.sentBytes += text.length;
      try { to[i].publish(this.pubTopic, text, { qos: 0 }); } catch (e) { /* dropped frame */ }
    }
  };

  /* end(false) lets the last "I'm leaving" frame reach the broker before the
     socket closes; the forced close is only a safety net. */
  Relay.prototype.stop = function () {
    this.connected = false;
    var conns = this.conns;
    this.conns = [];
    conns.forEach(function (client) {
      try {
        client.end(false);
        setTimeout(function () { try { client.end(true); } catch (e) {} }, 1200);
      } catch (e) {
        try { client.end(true); } catch (e2) {}
      }
    });
  };

  /* Used by the "check my network" button: which relays does this network let
     through? Runs the same connection the game would make. */
  SA.probeRelays = function (onEach) {
    return loadLib().then(function (mqtt) {
      return Promise.all(BROKERS.map(function (b) {
        var t0 = Date.now();
        return connectBroker(mqtt, b, 8000).then(function (c) {
          try { c.end(true); } catch (e) {}
          var r = { name: b.name, host: b.host, port: b.port, ok: true, ms: Date.now() - t0 };
          if (onEach) onEach(r);
          return r;
        }).catch(function (e) {
          var r = { name: b.name, host: b.host, port: b.port, ok: false, err: (e && e.message) || 'blocked' };
          if (onEach) onEach(r);
          return r;
        });
      }));
    });
  };

  SA.Relay = Relay;
  SA.BROKERS = BROKERS;
  SA.newRoomCode = function () { return SA.roomCode(); };

})(window.SA);
